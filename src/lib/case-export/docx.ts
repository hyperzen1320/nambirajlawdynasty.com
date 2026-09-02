import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeightRule,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import {
  type CaseExportInput,
  companyName,
  companyInitials,
  valueFor,
} from "./types";
import { LOGO_PNG_BUFFER } from "./logo";

// DOCX export. Word's table styling is more restrictive than Excel's
// but we can still produce a clean letter-style report:
//   • Top band with company name, primary contact + filter summary
//   • Copper "monogram" rendered as a coloured paragraph next to the
//     title (DOCX has no real image support without bundling a PNG —
//     this is intentionally a text monogram, branded with copper)
//   • Table with copper header row + alternating row shading
//   • Footer with generated date

const INK_HEX = "0A1124";
const IVORY_HEX = "F5EBD6";
const COPPER_HEX = "C5853A";
const COPPER_TEXT_HEX = "1F1308";
const CANVAS_2_HEX = "EBE2D0";
const EDGE_HEX = "D9CFB8";
const MUTED_HEX = "6B6253";

export async function generateDocx(input: CaseExportInput): Promise<Buffer> {
  const cols = input.columns;
  // Word table widths are in DXA (1/20th of a point). Scale the column
  // weight hints so the WHOLE table fits the landscape-A4 content width
  // (page 16838 twips − 720+720 margins ≈ 15398). Previously each column
  // was a fixed `width * 110`, so with the full column set the table was
  // ~20,000 DXA — wider than the page — and Word clipped every column past
  // "Court". Scaling to a fixed target keeps all columns on the page no
  // matter how many the user picks; long cells wrap instead of overflowing.
  const PAGE_CONTENT_DXA = 15000;
  const weightTotal = cols.reduce((a, c) => a + c.width, 0) || 1;
  const colWidths = cols.map((c) =>
    Math.max(360, Math.round((c.width / weightTotal) * PAGE_CONTENT_DXA))
  );
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const headerRow = new TableRow({
    tableHeader: true,
    height: { value: 480, rule: HeightRule.ATLEAST },
    children: cols.map((c, i) =>
      cell(c.label, {
        widthDxa: colWidths[i],
        bg: COPPER_HEX,
        color: COPPER_TEXT_HEX,
        bold: true,
        align: c.align,
      })
    ),
  });

  const bodyRows = input.cases.map(
    (row, idx) =>
      new TableRow({
        height: { value: 360, rule: HeightRule.ATLEAST },
        children: cols.map((c, i) =>
          cell(valueFor(c, row, idx), {
            widthDxa: colWidths[i],
            bg: idx % 2 === 1 ? CANVAS_2_HEX : undefined,
            color: INK_HEX,
            align: c.align,
          })
        ),
      })
  );

  const emptyRow =
    input.cases.length === 0
      ? [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: cols.length,
                width: { size: totalWidth, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: "No matters matched the current filters.",
                        italics: true,
                        color: MUTED_HEX,
                        size: 20,
                      }),
                    ],
                  }),
                ],
                margins: {
                  top: 200,
                  bottom: 200,
                  left: 100,
                  right: 100,
                },
              }),
            ],
          }),
        ]
      : [];

  const table = new Table({
    rows: [headerRow, ...bodyRows, ...emptyRow],
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: EDGE_HEX },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: EDGE_HEX },
      left: { style: BorderStyle.SINGLE, size: 4, color: EDGE_HEX },
      right: { style: BorderStyle.SINGLE, size: 4, color: EDGE_HEX },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: EDGE_HEX },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: EDGE_HEX },
    },
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

  const doc = new Document({
    creator: "Legalezi",
    title: `${companyName(input.partner)} — Case Report`,
    description: "Case Vault export",
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Generated ${formatLong(input.generatedAt)}  ·  ${companyInitials(input.partner)}`,
                    color: MUTED_HEX,
                    italics: true,
                    size: 16,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Branded header band (no built-in table cell shading on a
          // paragraph — we fake the band with the table that follows
          // having a coloured header row, and the title here sits on
          // an ink-shaded paragraph).
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: INK_HEX, color: "auto" },
            spacing: { before: 0, after: 0 },
            children: [
              new ImageRun({
                type: "png",
                data: LOGO_PNG_BUFFER,
                transformation: { width: 20, height: 42 },
              }),
              new TextRun({
                text: `   ${companyName(input.partner)}`,
                bold: true,
                size: 36,
                color: IVORY_HEX,
                font: "Calibri",
              }),
            ],
          }),
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: INK_HEX, color: "auto" },
            spacing: { before: 0, after: 0 },
            children: [
              new TextRun({
                text: `   ${metaParts.join("  ·  ") || " "}`,
                italics: true,
                size: 18,
                color: "B89D6A",
              }),
            ],
          }),
          // Copper banner row with the report title.
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: COPPER_HEX, color: "auto" },
            spacing: { before: 0, after: 240 },
            children: [
              new TextRun({
                text: `   Case Report  ·  ${formatLong(input.generatedAt)}`,
                bold: true,
                size: 20,
                color: COPPER_TEXT_HEX,
              }),
            ],
          }),
          // Filter summary (italic, muted).
          ...input.filters.lines.map(
            (line) =>
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: line,
                    italics: true,
                    color: MUTED_HEX,
                    size: 18,
                  }),
                ],
              })
          ),
          // Spacer.
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [new TextRun({ text: "" })],
          }),
          table,
        ],
      },
    ],
  });

  return Packer.toBuffer(doc) as unknown as Promise<Buffer>;
}

type CellOpts = {
  widthDxa: number;
  bg?: string;
  color?: string;
  bold?: boolean;
  align?: "left" | "center" | "right";
};

function cell(text: string, opts: CellOpts): TableCell {
  const alignment =
    opts.align === "center"
      ? AlignmentType.CENTER
      : opts.align === "right"
        ? AlignmentType.RIGHT
        : AlignmentType.LEFT;
  return new TableCell({
    width: { size: opts.widthDxa, type: WidthType.DXA },
    shading: opts.bg
      ? { type: ShadingType.CLEAR, fill: opts.bg, color: "auto" }
      : undefined,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text: text || "",
            bold: opts.bold ?? false,
            color: opts.color || INK_HEX,
            size: 18,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}
