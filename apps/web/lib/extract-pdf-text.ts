import { getDocument, GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";

export type StatementReadProgress = {
  stage: "reading" | "ocr" | "parsing";
  message: string;
  page?: number;
  pages?: number;
};

export type PdfReadResult = {
  lines: string[];
  usedOcr: boolean;
  pageCount: number;
};

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  if (typeof window !== "undefined") {
    GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjsVersion}`;
  }
  workerConfigured = true;
}

type TextChunk = {
  str: string;
  x: number;
  y: number;
};

const DATE_HINT =
  /\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/;

const MONEY_HINT = /\d{1,3}(?:,\d{3})*(?:\.\d{2})\b/;

function pageLooksTransactional(lines: string[]): boolean {
  let dated = 0;
  let withMoney = 0;
  for (const line of lines) {
    if (DATE_HINT.test(line)) dated += 1;
    if (MONEY_HINT.test(line)) withMoney += 1;
  }
  return dated >= 1 && withMoney >= 1;
}

function chunksToLines(chunks: TextChunk[]): string[] {
  const byY = new Map<number, TextChunk[]>();
  for (const chunk of chunks) {
    const key = Math.round(chunk.y);
    const list = byY.get(key) ?? [];
    list.push(chunk);
    byY.set(key, list);
  }

  const lines: string[] = [];
  const sortedYs = [...byY.keys()].sort((a, b) => b - a);
  for (const y of sortedYs) {
    const row = (byY.get(y) ?? []).sort((a, b) => a.x - b.x);
    const line = row
      .map((c) => c.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) lines.push(line);
  }
  return lines;
}

async function extractPageTextLines(page: PDFPageProxy): Promise<string[]> {
  const content = await page.getTextContent();
  const chunks: TextChunk[] = [];
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const transform = item.transform as number[];
    chunks.push({
      str: item.str,
      x: transform[4] ?? 0,
      y: Math.round((transform[5] ?? 0) * 10) / 10,
    });
  }
  return chunksToLines(chunks);
}

async function renderPageToCanvas(page: PDFPageProxy, scale = 2): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not create canvas for OCR");

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const renderTask = page.render({
    canvas,
    canvasContext: context,
    viewport,
  });
  await renderTask.promise;
  return canvas;
}

async function ocrCanvas(
  canvas: HTMLCanvasElement,
  worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>>,
): Promise<string[]> {
  const result = await worker.recognize(canvas);
  return result.data.text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Read a PDF in-browser.
 * Pass 1: extract embedded text from every page (no page cap).
 * Pass 2 (optional): OCR only when the whole document yields no usable transactions.
 */
export async function readPdfStatement(
  data: ArrayBuffer,
  onProgress?: (p: StatementReadProgress) => void,
  options?: { forceOcr?: boolean },
): Promise<PdfReadResult> {
  ensurePdfWorker();
  onProgress?.({ stage: "reading", message: "Opening PDF…" });

  // Copy buffer — pdf.js may transfer/detach the ArrayBuffer.
  const bytes = new Uint8Array(data.slice(0));
  const loadingTask = getDocument({
    data: bytes,
    useSystemFonts: true,
  });
  const pdf: PDFDocumentProxy = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const allLines: string[] = [];
  let usedOcr = false;
  let ocrWorker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
  const forceOcr = Boolean(options?.forceOcr);

  try {
    // Always pull text from every page first (33-page statements included).
    if (!forceOcr) {
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        onProgress?.({
          stage: "reading",
          message: `Reading page ${pageNum} of ${pageCount}…`,
          page: pageNum,
          pages: pageCount,
        });
        const page = await pdf.getPage(pageNum);
        const pageLines = await extractPageTextLines(page);
        allLines.push(...pageLines);
      }
    }

    const textLooksEmpty = !pageLooksTransactional(allLines);
    if (forceOcr || textLooksEmpty) {
      if (typeof document === "undefined") {
        onProgress?.({ stage: "parsing", message: "Parsing transactions…" });
        return { lines: allLines, usedOcr, pageCount };
      }

      const { createWorker } = await import("tesseract.js");
      ocrWorker = await createWorker("eng");
      usedOcr = true;
      allLines.length = 0;

      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        onProgress?.({
          stage: "ocr",
          message: `OCR page ${pageNum} of ${pageCount}…`,
          page: pageNum,
          pages: pageCount,
        });
        const page = await pdf.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, 2);
        const ocrLines = await ocrCanvas(canvas, ocrWorker);
        canvas.width = 0;
        canvas.height = 0;
        allLines.push(...ocrLines);
      }
    }
  } finally {
    if (ocrWorker) {
      try {
        await ocrWorker.terminate();
      } catch {
        // ignore OCR shutdown errors
      }
    }
    try {
      await pdf.cleanup();
    } catch {
      // ignore
    }
    try {
      await loadingTask.destroy();
    } catch {
      // ignore
    }
  }

  onProgress?.({
    stage: "parsing",
    message: `Parsing transactions from ${pageCount} page${pageCount === 1 ? "" : "s"}…`,
    pages: pageCount,
  });
  return { lines: allLines, usedOcr, pageCount };
}

/**
 * OCR a photo / image statement page (PNG, JPEG, WebP).
 */
export async function readImageStatement(
  file: File,
  onProgress?: (p: StatementReadProgress) => void,
): Promise<PdfReadResult> {
  onProgress?.({ stage: "ocr", message: "Loading OCR engine…" });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    onProgress?.({ stage: "ocr", message: "Scanning image…" });
    const result = await worker.recognize(file);
    const lines = result.data.text
      .split(/\r?\n/)
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    onProgress?.({ stage: "parsing", message: "Parsing transactions…" });
    return { lines, usedOcr: true, pageCount: 1 };
  } finally {
    await worker.terminate();
  }
}
