import PDFDocument from "pdfkit";
import {
  type CaseExportInput,
  type CaseExportColumn,
  type CaseExportRow,
  companyName,
  valueFor,
} from "./types";
import { LOGO_PNG_BUFFER } from "./logo";

// PDF export via pdfkit. Landscape A4 with a Midnight Counsel styled
// header band on top of a fully-bordered table:
//
//   ┌────────────────────────────────────────────────────────────────────┐
//   │  ▢ TC   Testing Chambers                                           │  ← ink band
//   │         Tejas Gudur  ·  Krishnagiri, Tamil Nadu  ·  +91 9XXXXXXXXX │
//   ├────────────────────────────────────────────────────────────────────┤
//   │  Case Report  ·  26 May 2026                                       │  ← copper band
//   ├────────────────────────────────────────────────────────────────────┤
//   │  Filter: Court — DJK · Krishnagiri                                 │  ← muted italic
//   │                                                                    │
//   │  ┌─────┬───────┬────────┬─────────────┬──────────────┐             │
//   │  │S.NO │ FILE  │ CASE   │ CLIENT NAME │ APPEARING    │  ← copper   │
//   │  │     │ NO    │ NO     │             │ FOR          │     header  │
//   │  ├─────┼───────┼────────┼─────────────┼──────────────┤             │
//   │  │  1  │ NLD…  │ O.S. … │ Hameera     │ Defendant    │  ← body row │
//   │  └─────┴───────┴────────┴─────────────┴──────────────┘             │
//   │                              Page 1                                 │
//   └────────────────────────────────────────────────────────────────────┘
//
// Table layout notes:
//   – Every cell gets a full rectangular border (top + bottom + left +
//     right) so columns can't visually run into each other.
//   – Header cells word-wrap onto two lines when needed; row height
//     auto-grows to fit the tallest cell.
//   – Body cells word-wrap up to 3 lines, then truncate with ellipsis.
//   – Column widths floor at the widest single word in the header label
//     so narrow weight-6 columns (S.No, Court No) never collapse so far
//     that "S.NO" wraps character-by-character.
//
// Colours match the in-app theme as closely as the PDF spec allows.

const INK = "#0a1124";
const IVORY = "#f5ebd6";
const COPPER = "#c5853a";
const COPPER_TEXT = "#1f1308";
const COPPER_DEEP = "#9b6622";
const CANVAS_2 = "#ebe2d0";
const EDGE = "#d9cfb8";
const EDGE_STRONG = "#a89875";
const MUTED = "#6b6253";

const MARGIN = 28;
const HEADER_BAND_HEIGHT = 64;
const COPPER_BAND_HEIGHT = 28;

const FONT_SIZE = 8;
const CELL_PAD_X = 4;
const CELL_PAD_Y = 5;
const MIN_BODY_ROW_HEIGHT = 20;
const MIN_HEADER_ROW_HEIGHT = 26;
const MAX_BODY_LINES = 3;

export async function generatePdf(input: CaseExportInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: MARGIN,
      bufferPages: true,
      info: {
        Title: `${companyName(input.partner)} — Case Report`,
        Author: "Legalezi",
        Creator: "Legalezi",
        CreationDate: input.generatedAt,
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width;
    const contentWidth = pageWidth - MARGIN * 2;
    const cols = computeColumnWidths(doc, input.columns, contentWidth);
    const totalWidth = cols.reduce((acc, c) => acc + c.width, 0);

    drawHeader(doc, input, contentWidth);
    const filterSummaryHeight = drawFilterSummary(doc, input);

    let cursorY =
      MARGIN +
      HEADER_BAND_HEIGHT +
      COPPER_BAND_HEIGHT +
      filterSummaryHeight +
      8;

    let tableTop = cursorY;
    cursorY = drawTableHeader(doc, cursorY, cols);

    if (input.cases.length === 0) {
      const emptyHeight = 40;
      doc.save();
      doc
        .rect(MARGIN, cursorY, totalWidth, emptyHeight)
        .fillAndStroke("#fdfaf2", EDGE_STRONG);
      doc.restore();
      doc
        .fillColor(MUTED)
        .font("Helvetica-Oblique")
        .fontSize(10)
        .text(
          "No matters matched the current filters.",
          MARGIN,
          cursorY + 14,
          { width: totalWidth, align: "center", lineBreak: false }
        );
      cursorY += emptyHeight;
    } else {
      for (let i = 0; i < input.cases.length; i++) {
        const row = input.cases[i];
        const rowHeight = measureBodyRowHeight(
          doc,
          cols,
          input.columns,
          row,
          i
        );
        const pageBottom = doc.page.height - MARGIN - 24;

        // Page-break check. If this row plus its bottom border can't fit,
        // close out the current page's table (outer border) and start a
        // fresh page with the header band + table header re-drawn.
        if (cursorY + rowHeight > pageBottom) {
          drawOuterBorder(doc, cols, tableTop, cursorY);
          doc.addPage();
          drawHeader(doc, input, contentWidth);
          const fh = drawFilterSummary(doc, input);
          cursorY =
            MARGIN +
            HEADER_BAND_HEIGHT +
            COPPER_BAND_HEIGHT +
            fh +
            8;
          tableTop = cursorY;
          cursorY = drawTableHeader(doc, cursorY, cols);
        }

        cursorY = drawBodyRow(
          doc,
          cursorY,
          cols,
          input.columns,
          row,
          i,
          rowHeight
        );
      }
    }

    drawOuterBorder(doc, cols, tableTop, cursorY);

    // Now that every page exists, stamp each footer with a true
    // "Page X of Y" — bufferPages lets us revisit the pages at the end.
    // (Doing it inline earlier always read "Page 1", because the page
    // count isn't known until the table has finished flowing.)
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      drawPageFooter(doc, input, i + 1, range.count);
    }

    doc.end();
  });
}

type ResolvedCol = {
  def: CaseExportColumn;
  x: number;
  width: number;
};

function alignFor(
  col: CaseExportColumn
): "left" | "center" | "right" {
  if (col.align === "center") return "center";
  if (col.align === "right") return "right";
  return "left";
}

// Per-column width: floor each column at the width of its widest single
// header word (so "APPEARING" never gets sliced into "APPE / ARING"),
// then distribute the remaining content width by the column's weight.
// If the minimums alone exceed the page width — possible with many
// columns and long labels — scale every column down proportionally.
function computeColumnWidths(
  doc: PDFKit.PDFDocument,
  defs: CaseExportColumn[],
  contentWidth: number
): ResolvedCol[] {
  doc.save();
  doc.font("Helvetica-Bold").fontSize(FONT_SIZE);
  const minWidths = defs.map((c) => {
    const words = c.label.toUpperCase().split(/\s+/);
    let widest = 0;
    for (const w of words) {
      const wid = doc.widthOfString(w);
      if (wid > widest) widest = wid;
    }
    return widest + CELL_PAD_X * 2 + 2;
  });
  doc.restore();

  const totalWeight = defs.reduce((acc, c) => acc + c.width, 0);
  const preferred = defs.map(
    (c) => (c.width / totalWeight) * contentWidth
  );

  let widths = defs.map((_, i) => Math.max(minWidths[i], preferred[i]));
  let total = widths.reduce((acc, w) => acc + w, 0);

  if (total > contentWidth) {
    // Mins took us past the page width. Take the overshoot back from
    // columns that have headroom above their min, in proportion to that
    // headroom.
    const overshoot = total - contentWidth;
    const slack = widths.map((w, i) => Math.max(0, w - minWidths[i]));
    const totalSlack = slack.reduce((acc, s) => acc + s, 0);
    if (totalSlack > 0) {
      widths = widths.map(
        (w, i) => w - (slack[i] / totalSlack) * overshoot
      );
    } else {
      const k = contentWidth / total;
      widths = widths.map((w) => w * k);
    }
  } else if (total < contentWidth) {
    // Distribute the remaining slack by weight so weighty columns
    // (Court, Client) keep their visual emphasis.
    const remaining = contentWidth - total;
    widths = widths.map(
      (w, i) => w + (defs[i].width / totalWeight) * remaining
    );
  }

  let x = MARGIN;
  const out: ResolvedCol[] = [];
  for (let i = 0; i < defs.length; i++) {
    out.push({ def: defs[i], x, width: widths[i] });
    x += widths[i];
  }
  return out;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  input: CaseExportInput,
  contentWidth: number
) {
  doc
    .save()
    .rect(MARGIN, MARGIN, contentWidth, HEADER_BAND_HEIGHT)
    .fill(INK);

  // Brand mark, sat directly on the ink band (the coral logo reads well on
  // the dark band, so no backing disc is needed).
  const logoH = 36;
  doc.image(LOGO_PNG_BUFFER, MARGIN + 16, MARGIN + (HEADER_BAND_HEIGHT - logoH) / 2, {
    height: logoH,
  });

  const titleX = MARGIN + 52;
  doc
    .fillColor(IVORY)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(companyName(input.partner), titleX, MARGIN + 12, {
      lineBreak: false,
    });

  const metaParts: string[] = [];
  if (input.partner.primaryContactName) {
    metaParts.push(input.partner.primaryContactName);
  }
  if (input.partner.city || input.partner.state) {
    metaParts.push(
      [input.partner.city, input.partner.state].filter(Boolean).join(", ")
    );
  }
  if (input.partner.phone) {
    metaParts.push(input.partner.phone);
  }
  if (metaParts.length > 0) {
    doc
      .fillColor("#b89d6a")
      .font("Helvetica-Oblique")
      .fontSize(9.5)
      .text(metaParts.join("   ·   "), titleX, MARGIN + 36, {
        lineBreak: false,
      });
  }

  doc.restore();

  doc
    .save()
    .rect(
      MARGIN,
      MARGIN + HEADER_BAND_HEIGHT,
      contentWidth,
      COPPER_BAND_HEIGHT
    )
    .fill(COPPER);
  doc
    .fillColor(COPPER_TEXT)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(
      `CASE REPORT   ·   ${input.generatedAt.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })}`,
      MARGIN + 14,
      MARGIN + HEADER_BAND_HEIGHT + 8,
      { lineBreak: false }
    );
  doc.restore();
}

function drawFilterSummary(
  doc: PDFKit.PDFDocument,
  input: CaseExportInput
): number {
  if (input.filters.lines.length === 0) return 0;
  const startY = MARGIN + HEADER_BAND_HEIGHT + COPPER_BAND_HEIGHT + 6;
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(9);
  let y = startY;
  for (const line of input.filters.lines) {
    doc.text(line, MARGIN + 4, y, { lineBreak: false });
    y += 12;
  }
  return y - startY + 4;
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: ResolvedCol[]
): number {
  doc.save();
  doc.font("Helvetica-Bold").fontSize(FONT_SIZE);

  // Measure pass: tallest header cell sets the row height so wrapped
  // labels ("APPEARING / FOR", "OPPOSITE / PARTY") render fully.
  let maxTextHeight = 0;
  for (const col of cols) {
    const innerW = col.width - CELL_PAD_X * 2;
    const h = doc.heightOfString(col.def.label.toUpperCase(), {
      width: innerW,
      align: alignFor(col.def),
    });
    if (h > maxTextHeight) maxTextHeight = h;
  }
  const rowH = Math.max(
    MIN_HEADER_ROW_HEIGHT,
    maxTextHeight + CELL_PAD_Y * 2
  );
  const totalWidth = cols.reduce((acc, c) => acc + c.width, 0);

  doc.rect(MARGIN, y, totalWidth, rowH).fill(COPPER);

  doc.fillColor(COPPER_TEXT).font("Helvetica-Bold").fontSize(FONT_SIZE);
  for (const col of cols) {
    const innerW = col.width - CELL_PAD_X * 2;
    const textH = doc.heightOfString(col.def.label.toUpperCase(), {
      width: innerW,
      align: alignFor(col.def),
    });
    const ty = y + (rowH - textH) / 2;
    doc.text(col.def.label.toUpperCase(), col.x + CELL_PAD_X, ty, {
      width: innerW,
      align: alignFor(col.def),
    });
  }
  doc.restore();

  // Vertical separators inside the copper band.
  doc.save();
  doc.strokeColor(COPPER_DEEP).lineWidth(0.5);
  for (let i = 1; i < cols.length; i++) {
    doc
      .moveTo(cols[i].x, y)
      .lineTo(cols[i].x, y + rowH)
      .stroke();
  }
  doc.restore();

  // Strong divider under the header — visually anchors the table grid.
  doc.save();
  doc
    .strokeColor(INK)
    .lineWidth(0.8)
    .moveTo(MARGIN, y + rowH)
    .lineTo(MARGIN + totalWidth, y + rowH)
    .stroke();
  doc.restore();

  return y + rowH;
}

function measureBodyRowHeight(
  doc: PDFKit.PDFDocument,
  cols: ResolvedCol[],
  defs: CaseExportColumn[],
  row: CaseExportRow,
  index: number
): number {
  doc.save();
  doc.font("Helvetica").fontSize(FONT_SIZE);
  const lineHeight = doc.currentLineHeight();
  const maxCellHeight = lineHeight * MAX_BODY_LINES;
  let maxH = 0;
  for (let i = 0; i < cols.length; i++) {
    const value = valueFor(defs[i], row, index);
    if (!value) continue;
    const innerW = cols[i].width - CELL_PAD_X * 2;
    const natural = doc.heightOfString(value, {
      width: innerW,
      align: alignFor(defs[i]),
    });
    const capped = Math.min(natural, maxCellHeight);
    if (capped > maxH) maxH = capped;
  }
  doc.restore();
  return Math.max(MIN_BODY_ROW_HEIGHT, maxH + CELL_PAD_Y * 2);
}

function drawBodyRow(
  doc: PDFKit.PDFDocument,
  y: number,
  cols: ResolvedCol[],
  defs: CaseExportColumn[],
  row: CaseExportRow,
  index: number,
  rowH: number
): number {
  const totalWidth = cols.reduce((acc, c) => acc + c.width, 0);

  // Zebra striping. Odd rows pick up canvas-2 so the eye can track
  // across long rows; even rows keep the paper background.
  if (index % 2 === 1) {
    doc.save().rect(MARGIN, y, totalWidth, rowH).fill(CANVAS_2).restore();
  }

  doc.save();
  doc.fillColor(INK).font("Helvetica").fontSize(FONT_SIZE);
  const innerH = rowH - CELL_PAD_Y * 2;
  for (let i = 0; i < cols.length; i++) {
    const value = valueFor(defs[i], row, index);
    if (!value) continue;
    const innerW = cols[i].width - CELL_PAD_X * 2;
    doc.text(value, cols[i].x + CELL_PAD_X, y + CELL_PAD_Y, {
      width: innerW,
      height: innerH,
      align: alignFor(defs[i]),
      ellipsis: true,
    });
  }
  doc.restore();

  // Cell separators — vertical between columns, horizontal under the
  // row. Together with the outer border drawn at the end, every cell
  // ends up with a complete rectangular outline.
  doc.save();
  doc.strokeColor(EDGE).lineWidth(0.4);
  for (let i = 1; i < cols.length; i++) {
    doc.moveTo(cols[i].x, y).lineTo(cols[i].x, y + rowH).stroke();
  }
  doc
    .moveTo(MARGIN, y + rowH)
    .lineTo(MARGIN + totalWidth, y + rowH)
    .stroke();
  doc.restore();

  return y + rowH;
}

function drawOuterBorder(
  doc: PDFKit.PDFDocument,
  cols: ResolvedCol[],
  topY: number,
  bottomY: number
) {
  const totalWidth = cols.reduce((acc, c) => acc + c.width, 0);
  doc.save();
  doc.strokeColor(EDGE_STRONG).lineWidth(0.8);
  // Outer rectangle around the entire table on this page.
  doc
    .rect(MARGIN, topY, totalWidth, bottomY - topY)
    .stroke();
  doc.restore();
}

function drawPageFooter(
  doc: PDFKit.PDFDocument,
  input: CaseExportInput,
  pageNum: number,
  totalPages: number
) {
  const y = doc.page.height - MARGIN - 12;

  doc.save();
  doc.fillColor(MUTED).font("Helvetica-Oblique").fontSize(8);
  doc.text(
    `${companyName(input.partner)}  ·  ${input.generatedAt.toLocaleDateString(
      "en-IN",
      { day: "2-digit", month: "short", year: "numeric" }
    )}`,
    MARGIN,
    y,
    { lineBreak: false }
  );
  doc.text(
    `Page ${pageNum} of ${totalPages}`,
    doc.page.width - MARGIN - 110,
    y,
    { width: 110, align: "right", lineBreak: false }
  );
  doc.restore();
}
