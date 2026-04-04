import { PDFParse } from "pdf-parse";
import { readFileSync } from "fs";

const filePath = process.argv[2];
const buffer = readFileSync(filePath);
const parser = new PDFParse({ data: new Uint8Array(buffer) });
const result = await parser.getText();
process.stdout.write(result.text);
