// Server-side parser that turns an uploaded case roll (Word / Excel / CSV /
// PDF) into structured rows the Case Vault can import. Everything funnels
// through a single "grid of cells" representation: we recover a 2-D grid
// from each format, find the header row, map columns to Case fields via an
// alias table, and emit ParsedCaseRow[]. The UI always previews these rows
// before anything is written, so best-effort formats (PDF) stay safe.

import ExcelJS from "exceljs";

export type ParsedCaseRow = {
  caseNo: string;
  fileNo: string;
  cnr: string;
  iaNumbers: string;
  clientName: string;
  appearingFor: string;
  courtName: string;
  courtPlace: string;
  courtHall: string;
  clientPhone: string;
  clientWhatsapp: string;
  oppositeParty: string;
  oppositeAdvocate: string;
  clientAddress: string;
  status: string;
  lastHearingDate: string | null; // ISO (yyyy-mm-dd) or null
  nextHearingDate: string | null;
};

export type ParseResult = {
  rows: ParsedCaseRow[];
  // Columns we recognised in the header, for the preview's "mapped as" hint.
  mappedColumns: string[];
  // Non-fatal notes (e.g. "PDF parsed best-effort — please review").
  warnings: string[];
};

type Field = keyof ParsedCaseRow;

// Normalised header text → case field. Normalisation strips everything but
// a-z0-9 so "Case No", "case_no", "CASE  NO." all collapse to "caseno".
const HEADER_ALIASES: Record<string, Field> = {
  caseno: "caseNo",
  casenumber: "caseNo",
  case: "caseNo",
  fileno: "fileNo",
  filenumber: "fileNo",
  file: "fileNo",
  cnr: "cnr",
  cnrno: "cnr",
  cnrnumber: "cnr",
  ia: "iaNumbers",
  iano: "iaNumbers",
  ianumber: "iaNumbers",
  ianumbers: "iaNumbers",
  clientname: "clientName",
  client: "clientName",
  party: "clientName",
  partyname: "clientName",
  appearingfor: "appearingFor",
  appearing: "appearingFor",
  court: "courtName",
  courtname: "courtName",
  courtplace: "courtPlace",
  place: "courtPlace",
  district: "courtPlace",
  city: "courtPlace",
  courthall: "courtHall",
  hall: "courtHall",
  courtroom: "courtHall",
  mobile: "clientPhone",
  mobileno: "clientPhone",
  mobile1: "clientPhone",
  phone: "clientPhone",
  contact: "clientPhone",
  contactno: "clientPhone",
  contactnumber: "clientPhone",
  whatsapp: "clientWhatsapp",
  whatsappno: "clientWhatsapp",
  whatsappnumber: "clientWhatsapp",
  mobile2: "clientWhatsapp",
  altmobile: "clientWhatsapp",
  oppositeparty: "oppositeParty",
  opposite: "oppositeParty",
  opponent: "oppositeParty",
  respondent: "oppositeParty",
  oppositeadvocate: "oppositeAdvocate",
  oppadvocate: "oppositeAdvocate",
  opponentadvocate: "oppositeAdvocate",
  oppositecounsel: "oppositeAdvocate",
  clientaddress: "clientAddress",
  address: "clientAddress",
  prevdate: "lastHearingDate",
  previousdate: "lastHearingDate",
  lastdate: "lastHearingDate",
  lasthearing: "lastHearingDate",
  lasthearingdate: "lastHearingDate",
  nextdate: "nextHearingDate",
  nexthearing: "nextHearingDate",
  nexthearingdate: "nextHearingDate",
  hearingdate: "nextHearingDate",
  status: "status",
  stage: "status",
};

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function emptyRow(): ParsedCaseRow {
  return {
    caseNo: "",
    fileNo: "",
    cnr: "",
    iaNumbers: "",
    clientName: "",
    appearingFor: "",
    courtName: "",
    courtPlace: "",
    courtHall: "",
    clientPhone: "",
    clientWhatsapp: "",
    oppositeParty: "",
    oppositeAdvocate: "",
    clientAddress: "",
    status: "",
    lastHearingDate: null,
    nextHearingDate: null,
  };
}

// Parse a date written as DD/MM/YYYY (also -, . separators; 2- or 4-digit
// year) into an ISO yyyy-mm-dd string. Returns null for anything we can't
// confidently read — the preview shows blanks the user can fix.
export function parseDateCell(raw: string): string | null {
  const s = (raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) year += year < 50 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// Split a "Mobile" cell that may hold two numbers ("99... 63...") into a
// primary phone + a secondary whatsapp number.
function splitNumbers(raw: string): { phone: string; whatsapp: string } {
  const nums = (raw || "")
    .split(/[\s,/]+/)
    .map((n) => n.replace(/[^\d+]/g, ""))
    .filter((n) => n.replace(/\D/g, "").length >= 6);
  return { phone: nums[0] || "", whatsapp: nums[1] || "" };
}

function htmlDecode(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Grid extractors (one per source format) ─────────────────────────────

async function gridFromDocx(buffer: Buffer): Promise<string[][]> {
  // mammoth converts the .docx (including its tables) to clean HTML; we then
  // recover the largest <table> as a grid. Empty cells survive as empty
  // <td>, so column positions stay aligned even when a row skips a field.
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  if (tables.length === 0) return [];
  // Pick the table with the most rows (the case roll, not a stray layout one).
  let best = "";
  let bestRows = -1;
  for (const t of tables) {
    const n = (t.match(/<tr/gi) || []).length;
    if (n > bestRows) {
      bestRows = n;
      best = t;
    }
  }
  const grid: string[][] = [];
  const trs = best.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trs) {
    const cells = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    grid.push(cells.map((c) => htmlDecode(c)));
  }
  return grid;
}

async function gridFromSheet(
  buffer: Buffer,
  ext: string
): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  if (ext === "csv") {
    // exceljs' csv reader wants a stream; a tiny hand parser is sturdier and
    // handles quoted commas without the stream plumbing.
    return parseCsv(buffer.toString("utf8"));
  }
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[]; // 1-indexed; [0] is empty
    const cells: string[] = [];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      cells.push(cellToString(v));
    }
    grid.push(cells);
  });
  return grid;
}

function cellToString(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (typeof o.text === "string") return o.text;
    if (o.result != null) return String(o.result);
    return "";
  }
  return String(v).trim();
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim());
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

async function gridFromPdf(buffer: Buffer): Promise<string[][]> {
  // Best-effort: PDFs carry no table structure, only positioned text. We
  // cluster text items into lines by their y-coordinate, then split each
  // line into cells on wide horizontal gaps. Imperfect by nature — the
  // import preview is the safety net.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Text extraction needs no rendering, so run on the main thread.
  pdfjs.GlobalWorkerOptions.workerSrc = "";
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  const grid: string[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    type Item = { str: string; x: number; y: number };
    const items: Item[] = [];
    for (const it of content.items as Array<{ str: string; transform: number[] }>) {
      if (!it.str || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5] });
    }
    items.sort((a, b) => (Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x));
    let line: Item[] = [];
    let lastY: number | null = null;
    const flush = () => {
      if (line.length === 0) return;
      line.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let cur = line[0].str;
      let prevX = line[0].x + line[0].str.length;
      for (let k = 1; k < line.length; k++) {
        const gap = line[k].x - prevX;
        if (gap > 18) {
          cells.push(cur.trim());
          cur = line[k].str;
        } else {
          cur += " " + line[k].str;
        }
        prevX = line[k].x + line[k].str.length;
      }
      cells.push(cur.trim());
      grid.push(cells);
      line = [];
    };
    for (const it of items) {
      if (lastY != null && Math.abs(it.y - lastY) > 3) flush();
      line.push(it);
      lastY = it.y;
    }
    flush();
  }
  return grid;
}

// ─── Grid → rows ──────────────────────────────────────────────────────────

function findHeader(grid: string[][]): {
  index: number;
  map: Map<number, Field>;
} | null {
  let bestIdx = -1;
  let bestMap = new Map<number, Field>();
  grid.forEach((cells, idx) => {
    const map = new Map<number, Field>();
    cells.forEach((c, i) => {
      const field = HEADER_ALIASES[norm(c)];
      if (field && ![...map.values()].includes(field)) map.set(i, field);
    });
    // A real header maps several columns AND includes the required caseNo.
    if (
      map.size > bestMap.size &&
      map.size >= 3 &&
      [...map.values()].includes("caseNo")
    ) {
      bestIdx = idx;
      bestMap = map;
    }
  });
  return bestIdx >= 0 ? { index: bestIdx, map: bestMap } : null;
}

function buildRow(cells: string[], map: Map<number, Field>): ParsedCaseRow {
  const row = emptyRow();
  for (const [col, field] of map) {
    const val = (cells[col] || "").trim();
    if (!val) continue;
    if (field === "lastHearingDate" || field === "nextHearingDate") {
      row[field] = parseDateCell(val);
    } else if (field === "clientPhone") {
      const { phone, whatsapp } = splitNumbers(val);
      row.clientPhone = phone;
      if (whatsapp && !row.clientWhatsapp) row.clientWhatsapp = whatsapp;
    } else {
      row[field] = val;
    }
  }
  return row;
}

export async function parseCasesFromFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  const warnings: string[] = [];
  let grid: string[][] = [];

  if (ext === "docx" || ext === "doc") {
    grid = await gridFromDocx(buffer);
  } else if (ext === "xlsx" || ext === "xls") {
    grid = await gridFromSheet(buffer, "xlsx");
  } else if (ext === "csv") {
    grid = await gridFromSheet(buffer, "csv");
  } else if (ext === "pdf") {
    grid = await gridFromPdf(buffer);
    warnings.push(
      "PDF was read best-effort — please review every row carefully before importing."
    );
  } else {
    throw new Error("Unsupported file. Upload a Word, Excel, CSV or PDF file.");
  }

  if (grid.length === 0) {
    throw new Error(
      "Couldn't read any rows from that file. Make sure the cases are in a table with a header row."
    );
  }

  const header = findHeader(grid);
  if (!header) {
    throw new Error(
      "Couldn't find a header row with a 'Case No' column. Check the column titles and try again."
    );
  }

  const rows: ParsedCaseRow[] = [];
  for (let i = header.index + 1; i < grid.length; i++) {
    const cells = grid[i];
    if (!cells.some((c) => c && c.trim())) continue; // skip blank rows
    const row = buildRow(cells, header.map);
    // Need at least a case number or a client name to be a real row.
    if (!row.caseNo && !row.clientName) continue;
    rows.push(row);
  }

  const mappedColumns = [...new Set([...header.map.values()])];
  return { rows, mappedColumns, warnings };
}
