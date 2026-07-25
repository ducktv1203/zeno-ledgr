import { getDocument, GlobalWorkerOptions, version as pdfjsVersion } from "pdfjs-dist";

let workerConfigured = false;

function ensurePdfWorker(): void {
  if (workerConfigured) return;
  if (typeof window !== "undefined") {
    // Served from /public so parsing stays fully in-browser.
    GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjsVersion}`;
  }
  workerConfigured = true;
}

type TextChunk = {
  str: string;
  x: number;
  y: number;
};

/**
 * Extract readable lines from a PDF ArrayBuffer using pdf.js (client-side only).
 */
export async function extractPdfTextLines(data: ArrayBuffer): Promise<string[]> {
  ensurePdfWorker();

  const loadingTask = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const lines: string[] = [];

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
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

      // Group by Y (same visual line), left-to-right.
      const byY = new Map<number, TextChunk[]>();
      for (const chunk of chunks) {
        const key = Math.round(chunk.y);
        const list = byY.get(key) ?? [];
        list.push(chunk);
        byY.set(key, list);
      }

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
    }
  } finally {
    await pdf.destroy();
  }

  return lines;
}
