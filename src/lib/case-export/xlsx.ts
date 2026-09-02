import ExcelJS from "exceljs";
import {
  type CaseExportInput,
  companyName,
  valueFor,
} from "./types";
import { LOGO_PNG_BASE64 } from "./logo";

// XLSX export. Two sheets would be overkill for a single report; we use
// one sheet with a banded header block at the top (logo monogram +
// company name + filters + generated date) followed by the table.
//
// Colour palette mirrors Midnight Counsel where Excel allows it:
//   • Header band background      → ink            (#0a1124)
//   • Header band text            → ivory          (#f5ebd6)
//   • Monogram disc background    → copper         (#c5853a)
//   • Monogram text               → ink            (#0a1124)
//   • Table header row background → copper         (#c5853a)
//   • Table header text           → copper-text    (#1f1308)
//   • Zebra stripe (every other)  → canvas-2       (#ebe2d0)

const INK = "FF0A1124";
const IVORY = "FFF5EBD6";
const COPPER = "FFC5853A";
const COPPER_TEXT = "FF1F1308";
const CANVAS_2 = "FFEBE2D0";
const EDGE = "FFD9CFB8";

export async function generateXlsx(input: CaseExportInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Legalezi";
  wb.created = input.generatedAt;

  const sheet = wb.addWorksheet("Case Report", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    views: [{ showGridLines: false }],
  });

  const numCols = input.columns.length;

  // Configure column widths up front so the header band spans
  // correctly when we merge the title row across all columns.
  for (let i = 0; i < numCols; i++) {
    const c = sheet.getColumn(i + 1);
    c.width = input.columns[i].width;
  }

  // Brand mark — floated over the right end of the ink header band, inset
  // from the edge and sized to sit cleanly within the two-row ink band.
  const logoId = wb.addImage({ base64: LOGO_PNG_BASE64, extension: "png" });
  sheet.addImage(logoId, {
    tl: { col: Math.max(0, numCols - 0.85), row: 0.1 },
    ext: { width: 22, height: 46 },
  });

  // Row 1 — company name, large. Merged across the table.
  const titleRow = sheet.addRow([companyName(input.partner)]);
  titleRow.height = 28;
  sheet.mergeCells(titleRow.number, 1, titleRow.number, numCols);
  const titleCell = titleRow.getCell(1);
  titleCell.value = companyName(input.partner);
  titleCell.font = {
    name: "Calibri",
    size: 22,
    bold: true,
    color: { argb: IVORY },
  };
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: INK },
  };

  // Row 2 — sub-line with the monogram (left side of the merged cell)
  // baked into the title via a Unicode bullet trick is fiddly; instead
  // we use a second row showing the partner's contact text and a
  // copper-tinted strip on the right.
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
  const metaRow = sheet.addRow([metaParts.join("  ·  ")]);
  metaRow.height = 18;
  sheet.mergeCells(metaRow.number, 1, metaRow.number, numCols);
  const metaCell = metaRow.getCell(1);
  metaCell.font = {
    name: "Calibri",
    size: 10,
    italic: true,
    color: { argb: "FFB89D6A" },
  };
  metaCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  metaCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: INK },
  };

  // Row 3 — "Case Report" + generated date + monogram on the right.
  const banner = sheet.addRow([
    `Case Report  ·  ${input.generatedAt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })}`,
  ]);
  banner.height = 22;
  sheet.mergeCells(banner.number, 1, banner.number, numCols);
  const bannerCell = banner.getCell(1);
  bannerCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: COPPER_TEXT },
  };
  bannerCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  bannerCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COPPER },
  };

  // Optional filter summary block (one row per filter).
  if (input.filters.lines.length > 0) {
    for (const line of input.filters.lines) {
      const r = sheet.addRow([line]);
      r.height = 16;
      sheet.mergeCells(r.number, 1, r.number, numCols);
      const cell = r.getCell(1);
      cell.font = {
        name: "Calibri",
        size: 9,
        italic: true,
        color: { argb: "FF6B6253" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "left",
        indent: 1,
      };
    }
  }

  // Spacer row.
  sheet.addRow([]);

  // Table header.
  const headerRow = sheet.addRow(input.columns.map((c) => c.label));
  headerRow.height = 22;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: COPPER_TEXT },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COPPER },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: input.columns[colNumber - 1]?.align || "left",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: EDGE } },
      bottom: { style: "thin", color: { argb: EDGE } },
      left: { style: "thin", color: { argb: EDGE } },
      right: { style: "thin", color: { argb: EDGE } },
    };
  });

  // Body rows with zebra striping.
  input.cases.forEach((row, i) => {
    const dataRow = sheet.addRow(
      input.columns.map((c) => valueFor(c, row, i))
    );
    // Deliberately no fixed row height: with wrapText on, Excel auto-fits
    // the row to its tallest wrapped cell, so long Status text shows in
    // full instead of being clipped to a single 18px line.
    dataRow.eachCell((cell, colNumber) => {
      const col = input.columns[colNumber - 1];
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: INK },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col?.align || "left",
        wrapText: true,
      };
      if (i % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CANVAS_2 },
        };
      }
      cell.border = {
        bottom: { style: "thin", color: { argb: EDGE } },
        right: { style: "thin", color: { argb: EDGE } },
      };
    });
  });

  if (input.cases.length === 0) {
    const empty = sheet.addRow(["No matters matched the current filters."]);
    sheet.mergeCells(empty.number, 1, empty.number, numCols);
    const cell = empty.getCell(1);
    cell.font = {
      name: "Calibri",
      size: 10,
      italic: true,
      color: { argb: "FF6B6253" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
  }

  // Freeze the header band + table header so scrolling keeps them
  // visible — small touch, big quality lift.
  sheet.views = [
    {
      state: "frozen",
      ySplit: headerRow.number,
      xSplit: 0,
      showGridLines: false,
    },
  ];

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer as ArrayBuffer);
}
