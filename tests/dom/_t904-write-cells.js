/* 칸 표 다시 쓰기 — node tests/dom/_t904-write-cells.js */
const fs = require('fs'); const path = require('path');
const { planOf, summary } = require('./_t904-plan.js');
const root = path.join(__dirname, '..', '..'); const p = planOf(root);
const out = `{\n"summary": ${JSON.stringify(summary(p))},\n"places": ${JSON.stringify(p.places)},\n"ops": ${JSON.stringify(p.ops)},\n"kinds": [\n${p.kinds.map((k) => JSON.stringify(k)).join(',\n')}\n],\n"cells": [\n${p.cells.map((c) => JSON.stringify(c)).join(',\n')}\n]\n}\n`;
fs.writeFileSync(path.join(__dirname, 't904-cells.json'), out); console.log(JSON.stringify(summary(p)));
