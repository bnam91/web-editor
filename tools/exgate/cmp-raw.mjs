/* 원시 RGBA .bin 두 개를 앱의 compareRGBA 로 재고 JSON 으로 찍는다 (E4 검산용). */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
const src = path.resolve(process.argv[2]);          // export-gate-core.js
const alias = path.join(os.tmpdir(), `exgate-core-${process.pid}.mjs`);
fs.copyFileSync(src, alias);
const core = await import(pathToFileURL(alias).href);
fs.unlinkSync(alias);
function load(p) {
  const b = fs.readFileSync(p);
  const width = b.readUInt32LE(0), height = b.readUInt32LE(4);
  return { width, height, data: new Uint8Array(b.buffer, b.byteOffset + 8, width * height * 4) };
}
const m = core.compareRGBA(load(process.argv[3]), load(process.argv[4]));
console.log(JSON.stringify(m));
