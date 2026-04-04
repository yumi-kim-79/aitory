import { PDFParse } from "pdf-parse";
import { readFileSync } from "fs";

const filePath = process.argv[2];
const buffer = readFileSync(filePath);
const parser = new PDFParse({ data: new Uint8Array(buffer) });

const doc = await parser.load();
const numPages = doc.numPages;
const pages = [];

for (let i = 1; i <= numPages; i++) {
  const page = await doc.getPage(i);
  const viewport = page.getViewport({ scale: 1.0 });
  const textContent = await page.getTextContent();

  const items = textContent.items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      fontSize: Math.abs(item.transform[0] || item.transform[3]),
      width: item.width,
      height: Math.abs(item.transform[3]),
    }));

  pages.push({
    pageIndex: i - 1,
    width: viewport.width,
    height: viewport.height,
    items,
  });

  page.cleanup();
}

process.stdout.write(JSON.stringify(pages));
