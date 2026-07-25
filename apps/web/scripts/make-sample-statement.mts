import { writeFileSync } from "fs";
import { join } from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseStatementLines } from "../lib/parse-statement";

const lines = [
  "Sample Bank — Transaction Statement",
  "Account Number 12345678",
  "Statement Period 01/06/2026 - 31/07/2026",
  "Date Description Debit Credit Balance",
  "01/06/2026 NETFLIX.COM 22.99 1200.00",
  "01/06/2026 SPOTIFY P12345 11.99 1188.01",
  "08/06/2026 Adobe Systems 29.99 1158.02",
  "15/06/2026 WOOLWORTHS 4521 84.32 1073.70",
  "22/06/2026 Amazon Prime*AB12 9.99 1063.71",
  "01/07/2026 NETFLIX.COM 22.99 1040.72",
  "01/07/2026 SPOTIFY P12345 11.99 1028.73",
  "03/07/2026 UBER *TRIP HELP.UBER.COM 18.40 1010.33",
  "08/07/2026 Adobe Systems 29.99 980.34",
  "12/07/2026 COLES 8832 56.10 924.24",
  "20/07/2026 ORIGIN ENERGY 142.00 782.24",
  "22/07/2026 Amazon Prime*AB12 9.99 772.25",
  "Closing Balance 772.25",
];

async function buildPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let y = 750;
  for (const line of lines) {
    page.drawText(line, {
      x: 40,
      y,
      size: 11,
      font,
      color: rgb(0.05, 0.05, 0.05),
    });
    y -= 18;
  }
  return doc.save();
}

async function extractLines(data: Uint8Array): Promise<string[]> {
  const loadingTask = getDocument({
    data: data.slice(),
    useSystemFonts: true,
    isEvalSupported: false,
    disableWorker: true,
  } as never);
  const pdf = await loadingTask.promise;
  const out: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const chunks: { str: string; x: number; y: number }[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = item.transform as number[];
        chunks.push({
          str: item.str,
          x: transform[4] ?? 0,
          y: Math.round((transform[5] ?? 0) * 10) / 10,
        });
      }
      const byY = new Map<number, typeof chunks>();
      for (const c of chunks) {
        const key = Math.round(c.y);
        const list = byY.get(key) ?? [];
        list.push(c);
        byY.set(key, list);
      }
      for (const y of [...byY.keys()].sort((a, b) => b - a)) {
        const row = (byY.get(y) ?? []).sort((a, b) => a.x - b.x);
        const line = row
          .map((c) => c.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (line) out.push(line);
      }
    }
  } finally {
    await pdf.cleanup();
    await loadingTask.destroy();
  }
  return out;
}

const pdfBytes = await buildPdf();
const outPath = join(process.cwd(), "public", "samples", "sample-statement.pdf");
writeFileSync(outPath, pdfBytes);
console.log("wrote", outPath, pdfBytes.byteLength, "bytes");

const extracted = await extractLines(pdfBytes);
console.log("extracted lines:", extracted.length);
console.log(extracted.slice(0, 6));

const parsed = parseStatementLines(extracted);
console.log(
  JSON.stringify(
    {
      count: parsed.rows.length,
      warnings: parsed.warnings,
      rows: parsed.rows,
    },
    null,
    2,
  ),
);

if (parsed.rows.length < 8) {
  console.error("FAIL: expected at least 8 transactions");
  process.exit(1);
}
console.log("PASS");
