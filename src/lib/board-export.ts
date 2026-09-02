import ExcelJS from "exceljs";

// Board → XLSX. The chambers' "Download → Data" option: the whole board
// flattened to one card-per-row sheet so a partner can read the work
// outside the canvas (or hand it to someone who lives in Excel).
//
// Visual language mirrors the Case report (src/lib/case-export/xlsx.ts) so
// the two exports feel like one product:
//   • Header band background      → ink         (#0a1124)
//   • Header band text            → ivory       (#f5ebd6)
//   • Monogram disc background    → copper      (#c5853a)
//   • Table header row background → copper       (#c5853a)
//   • Table header text           → copper-text  (#1f1308)
//   • Zebra stripe (every other)  → canvas-2     (#ebe2d0)

const INK = "FF0A1124";
const IVORY = "FFF5EBD6";
const COPPER = "FFC5853A";
const COPPER_TEXT = "FF1F1308";
const CANVAS_2 = "FFEBE2D0";
const EDGE = "FFD9CFB8";

export type BoardExportRow = {
  listTitle: string;
  cardTitle: string;
  assignee: string;
  dueDate: string | null; // ISO
  priority: string; // "", "low", "medium", "high"
  checklist: string; // "2/5" or ""
  description: string;
};

export type BoardExportInput = {
  boardTitle: string;
  partner: {
    name: string;
    officeName: string;
  };
  rows: BoardExportRow[];
  generatedAt: Date;
};

function companyName(p: BoardExportInput["partner"]): string {
  return p.officeName?.trim() || p.name?.trim() || "Legalezi";
}

function companyInitials(p: BoardExportInput["partner"]): string {
  const name = companyName(p);
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "LE";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function titleCase(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Column layout — widths tuned so the common case (short titles, a name,
// a date) reads without horizontal scrolling while Description gets room.
const COLUMNS: Array<{
  header: string;
  width: number;
  get: (r: BoardExportRow) => string;
}> = [
  { header: "List", width: 22, get: (r) => r.listTitle },
  { header: "Card", width: 34, get: (r) => r.cardTitle },
  { header: "Assignee", width: 22, get: (r) => r.assignee },
  { header: "Due", width: 16, get: (r) => formatDate(r.dueDate) },
  { header: "Priority", width: 12, get: (r) => titleCase(r.priority) },
  { header: "Checklist", width: 12, get: (r) => r.checklist },
  { header: "Description", width: 50, get: (r) => r.description },
];

export async function generateBoardXlsx(
  input: BoardExportInput
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Legalezi";
  wb.created = input.generatedAt;

  const sheet = wb.addWorksheet("Board", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.3,
        footer: 0.3,
      },
    },
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const lastCol = COLUMNS.length; // 1-indexed inclusive
  const lastColLetter = sheet.getColumn(lastCol).letter;

  COLUMNS.forEach((c, i) => {
    sheet.getColumn(i + 1).width = c.width;
  });

  // ─── Header band (rows 1-3) ───────────────────────────────────────────
  sheet.mergeCells(`A1:${lastColLetter}3`);
  const bandCell = sheet.getCell("A1");
  bandCell.value = "";
  bandCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: INK },
  };
  sheet.getRow(1).height = 22;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 22;

  // Monogram disc (A1 overlaid via a second merged region would fight the
  // band; instead we letter the band itself with rich text).
  bandCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  bandCell.value = {
    richText: [
      {
        font: {
          name: "Arial",
          size: 16,
          bold: true,
          color: { argb: COPPER },
        },
        text: `${companyInitials(input.partner)}  `,
      },
      {
        font: {
          name: "Arial",
          size: 15,
          bold: true,
          color: { argb: IVORY },
        },
        text: companyName(input.partner),
      },
      {
        font: { name: "Arial", size: 11, color: { argb: "FFB9C2D8" } },
        text: `      Board — ${input.boardTitle}`,
      },
    ],
  };

  // ─── Sub-line (row 4): generated date + count ─────────────────────────
  sheet.mergeCells(`A4:${lastColLetter}4`);
  const subCell = sheet.getCell("A4");
  subCell.value = `Generated ${input.generatedAt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })}   ·   ${input.rows.length} card${input.rows.length === 1 ? "" : "s"}`;
  subCell.font = {
    name: "Arial",
    size: 10,
    italic: true,
    color: { argb: "FF6B6150" },
  };
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(4).height = 18;

  // ─── Table header (row 5) ─────────────────────────────────────────────
  const headerRow = sheet.getRow(5);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COPPER },
    };
    cell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: COPPER_TEXT },
    };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = {
      bottom: { style: "thin", color: { argb: INK } },
    };
  });
  headerRow.height = 20;

  // ─── Body rows ────────────────────────────────────────────────────────
  // Rows are pre-sorted by list then card order in the route. We repeat
  // the list name on every row (rather than merging) so filtering/sorting
  // in Excel stays sane, but we visually de-emphasise repeats by only
  // bolding the first row of each list group.
  let prevList: string | null = null;
  input.rows.forEach((row, idx) => {
    const r = sheet.getRow(6 + idx);
    const isNewGroup = row.listTitle !== prevList;
    prevList = row.listTitle;
    const zebra = idx % 2 === 1;

    COLUMNS.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      const isListCol = i === 0;
      cell.value = isListCol && !isNewGroup ? "" : c.get(row);
      cell.font = {
        name: "Arial",
        size: 10,
        bold: isListCol && isNewGroup,
        color: { argb: isListCol ? INK : "FF2A2118" },
      };
      cell.alignment = {
        vertical: "top",
        horizontal: "left",
        indent: 1,
        wrapText: i === 1 || i === COLUMNS.length - 1, // Card + Description wrap
      };
      if (zebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: CANVAS_2 },
        };
      }
      cell.border = {
        bottom: { style: "hair", color: { argb: EDGE } },
      };
    });
  });

  if (input.rows.length === 0) {
    const r = sheet.getRow(6);
    sheet.mergeCells(`A6:${lastColLetter}6`);
    const cell = r.getCell(1);
    cell.value = "This board has no cards yet.";
    cell.font = {
      name: "Arial",
      size: 10,
      italic: true,
      color: { argb: "FF6B6150" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    r.height = 28;
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}
