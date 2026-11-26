#!/usr/bin/env node
/* admin-library-prep — 관리자 로컬 라이브러리 재료 사전 손질(앱 밖 1회 · 앱은 손질된 본만 읽는다).
 *   ⑴ PNG → WebP (LIB-FIGMA-MEMOJI-INCLUSIVE-192-2-01): PNG 옆에 같은 이름 .webp (있으면 건너뜀 · PNG 무수정) · 도구 = cwebp(새 npm 의존성 0)
 *       node scripts/admin-library-prep.cjs <폴더>
 *   ⑵ SVG viewBox 고침 (LIB-FIGMA-SVG-VIEWBOX-CLIP-01): 피그마 틀 밖으로 나간 획이 잘린다(예 Doodle 195-483 · viewBox 0 0 2210 1830 인데 y −592).
 *       실제 그림 bbox(패스 끝점 + 3차 곡선 «극값» · 조절점 아님)가 지금 viewBox 를 «넘을 때만» 넓힌다 — 넓힐 땐 획 굵기/2 를 더한 합집합.
 *       ★판정 = 패스 ± 여유(그 파일 획 굵기 최대/2 · 0.9.13 66 마감 ◑ 261125 지디 «여유 = max(획)/2»): 옛 «패스 자체만» 판정은 획 40 짜리 273-12335 의 화살촉 아래를 잘랐다.
 *       (옛 까닭: 획 여유로 판정하면 191-38 중 78장이 괜히 넓어짐 · 맞대기 끝 직선 — 지금은 잘림 0 을 앞세워 그 넓힘을 받아들인다.) 넘지 않으면 파일 무변 · 틀 안 여백은 그대로. width/height 도 같은 비로. 원본은 <이름>.svg.orig 로 한 번만 남긴다(다시 돌리면 .orig 에서 다시 잰다 = 멱등).
 *       같이: <use xlink:href="#id"> 는 앱 거르개(sanitizeSvgString)가 버린다 → 가리키는 <path> 를 그 자리에 펼친다(안 하면 그림 본체가 사라진다).
 *       node scripts/admin-library-prep.cjs --fix-viewbox <폴더…>
 *   ⚠️재료가 쓰는 패스 명령은 절대 M L H V C Z 뿐(261118 실측 189장) — 다른 명령(상대·Q·A …)이 나오면 그 파일은 «모름»으로 건너뛰고 목록에 낸다(추측 0).
 *   ⚠️획 여유 = 굵기/2(둥근·맞댄 끝). 뾰족 이음(miter)의 뿔은 더 나갈 수 있다 — 잘림이 또 보이면 그 파일만 여유를 늘린다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const num = (s) => (s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || []).map(Number);

/** 3차 베지에 한 축의 [min,max] — 끝점 + B'(t)=0 의 (0,1) 근. */
function cubicRange(p0, p1, p2, p3) {
  let lo = Math.min(p0, p3), hi = Math.max(p0, p3);
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;   // B'(t)/3 = a t² + b t + c
  const ts = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) ts.push(-c / b); } else {
    const d = b * b - 4 * a * c;
    if (d >= 0) { const r = Math.sqrt(d); ts.push((-b + r) / (2 * a), (-b - r) / (2 * a)); }
  }
  for (const t of ts) if (t > 0 && t < 1) {
    const u = 1 - t, v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  return [lo, hi];
}

/** 패스 d → {x0,y0,x1,y1} | null(모르는 명령). */
function pathBBox(d) {
  const toks = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) || [];
  let i = 0, cmd = null, x = 0, y = 0, sx = 0, sy = 0;
  const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const add = (px, py) => { bb.x0 = Math.min(bb.x0, px); bb.x1 = Math.max(bb.x1, px); bb.y0 = Math.min(bb.y0, py); bb.y1 = Math.max(bb.y1, py); };
  const n = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === 'Z') { x = sx; y = sy; continue; }
    if (i >= toks.length || /[A-Za-z]/.test(toks[i])) continue;
    if (cmd === 'M') { x = n(); y = n(); sx = x; sy = y; add(x, y); cmd = 'L'; }
    else if (cmd === 'L') { x = n(); y = n(); add(x, y); }
    else if (cmd === 'H') { x = n(); add(x, y); }
    else if (cmd === 'V') { y = n(); add(x, y); }
    else if (cmd === 'C') {
      const x1 = n(), y1 = n(), x2 = n(), y2 = n(), x3 = n(), y3 = n();
      const [ax, bx] = cubicRange(x, x1, x2, x3), [ay, by] = cubicRange(y, y1, y2, y3);
      add(ax, ay); add(bx, by); x = x3; y = y3;
    } else return null;
  }
  return bb.x0 === Infinity ? null : bb;
}

const _attr = (tag, k) => { const m = new RegExp(`\\s${k}="([^"]*)"`).exec(tag); return m ? m[1] : null; };

/** <use xlink:href|href="#id" …/> → 가리키는 <path> 의 d 로 펼친 <path …/>(use 의 칠·획 속성을 얹음). */
function inlineUses(svg) {
  let n = 0;
  const out = svg.replace(/<use\b([^>]*?)\/>/g, (all, attrs) => {
    const m = /(?:xlink:)?href="#([^"]+)"/.exec(attrs);
    const ref = m && new RegExp(`<path\\b[^>]*\\sid="${m[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`).exec(svg);
    const d = ref && _attr(ref[0], 'd');
    if (!d) return all;
    n++;
    return `<path d="${d}"${attrs.replace(/\s(?:xlink:)?href="[^"]*"/, '').replace(/\s+$/, '')}/>`;
  });
  return { svg: out, n };
}

/** svg 글자 → { svg, changed, why, oldVB, newVB, unknown } */
function fixViewBox(text) {
  const { svg: s0, n: uses } = inlineUses(text);
  const root = (/<svg\b[^>]*>/.exec(s0) || [''])[0];
  const vb = num(_attr(root, 'viewBox') || '');
  if (vb.length !== 4) return { svg: text, changed: false, why: 'viewBox 없음' };
  const swRoot = parseFloat(_attr(root, 'stroke-width')) || 0;
  const body = s0.replace(/<defs\b[\s\S]*?<\/defs>/g, '');   // defs 안(펼친 원본·그라데이션)은 그려지지 않는다
  const gb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };   // 획 여유 없는 패스 자체
  let H = 0;   // 여유 = 그 파일 획 굵기 최대/2(채움만이면 0)
  for (const m of body.matchAll(/<path\b[^>]*>/g)) {
    const t = m[0], d = _attr(t, 'd');
    if (!d) continue;
    const b = pathBBox(d);
    if (!b) return { svg: text, changed: false, unknown: true, why: '모르는 패스 명령' };
    const stroked = (_attr(t, 'stroke') || 'none') !== 'none';
    if (stroked) H = Math.max(H, (parseFloat(_attr(t, 'stroke-width')) || swRoot || 1) / 2);
    gb.x0 = Math.min(gb.x0, b.x0); gb.y0 = Math.min(gb.y0, b.y0); gb.x1 = Math.max(gb.x1, b.x1); gb.y1 = Math.max(gb.y1, b.y1);
  }
  if (gb.x0 === Infinity) return { svg: s0, changed: uses > 0, why: '패스 없음', uses };
  /* ★0.9.13 66 마감 ◑(지디 261125 · 아이맥 GRADE-0913close-4 LIB-05) — 옛 판정 = «패스 자체가 틀을 넘을 때만»(획 여유 뺌) ⇒ Doodle 원본 273-12335(획 40 · 패스 아래 끝과 틀 사이 7.2 < 20)이
     화살촉 아래 ≈13 단위 잘림. ⇒ 여유 = 그 파일 획 굵기 최대/2 를 사방에 두고, 패스 ± 여유가 틀을 넘으면 넓힌다(넓힐 때도 같은 여유 · 합집합).
     값: 맞대기 끝 직선처럼 획이 실제론 덜 나가는 파일도 넓어진다(옛 판정이 피했던 78장류) — 잘림 0 을 우선(지디). 틀 안 여백은 그대로 · 멱등. */
  const bb = { x0: gb.x0 - H, y0: gb.y0 - H, x1: gb.x1 + H, y1: gb.y1 + H };
  const [vx, vy, vw, vh] = vb, EPS = 0.5;
  const over = bb.x0 < vx - EPS || bb.y0 < vy - EPS || bb.x1 > vx + vw + EPS || bb.y1 > vy + vh + EPS;
  if (!over) return { svg: s0, changed: uses > 0, why: uses ? 'use 펼침만' : '안쪽', uses, bbox: bb };
  const r = (v) => Math.round(v * 100) / 100;
  const nx = r(Math.min(vx, bb.x0)), ny = r(Math.min(vy, bb.y0));
  const nw = r(Math.max(vx + vw, bb.x1) - nx), nh = r(Math.max(vy + vh, bb.y1) - ny);
  const w0 = parseFloat(_attr(root, 'width')), h0 = parseFloat(_attr(root, 'height'));
  let nr = root.replace(/\sviewBox="[^"]*"/, ` viewBox="${nx} ${ny} ${nw} ${nh}"`);
  if (w0) nr = nr.replace(/\swidth="[^"]*"/, ` width="${r((w0 * nw) / vw)}"`);
  if (h0) nr = nr.replace(/\sheight="[^"]*"/, ` height="${r((h0 * nh) / vh)}"`);
  return { svg: s0.replace(root, nr), changed: true, why: '넓힘', uses, oldVB: vb.join(' '), newVB: `${nx} ${ny} ${nw} ${nh}`, bbox: bb };
}

function walk(d, f) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, f); else f(p, e.name); } }

function runFixViewBox(dirs) {
  const rows = { 넓힘: [], use: [], 모름: [] }; let total = 0;
  for (const dir of dirs) walk(dir, (p, name) => {
    if (!/\.svg$/i.test(name)) return;
    total++;
    const orig = `${p}.orig`;
    const src = fs.readFileSync(fs.existsSync(orig) ? orig : p, 'utf8');   // 멱등: 늘 원본에서 잰다
    const r = fixViewBox(src);
    if (r.unknown) { rows.모름.push(p); return; }
    if (!r.changed) { if (fs.existsSync(orig)) { fs.writeFileSync(p, src); fs.unlinkSync(orig); } return; }   // 고칠 것 없으면 원본 그대로(.orig 걷음)
    if (!fs.existsSync(orig)) fs.copyFileSync(p, orig);
    fs.writeFileSync(p, r.svg);
    if (r.why === '넓힘') rows.넓힘.push(`${path.relative(process.cwd(), p)} ${r.oldVB} → ${r.newVB}`);
    if (r.uses) rows.use.push(`${path.relative(process.cwd(), p)} use ${r.uses}`);
  });
  console.log(`[admin-library-prep] SVG ${total} · viewBox 넓힘 ${rows.넓힘.length} · use 펼침 ${rows.use.length} · 모름(건너뜀) ${rows.모름.length}`);
  for (const k of ['넓힘', 'use', '모름']) for (const x of rows[k]) console.log(`  [${k}] ${x}`);
  return rows;
}

function runWebp(dir) {
  let made = 0, skip = 0, inB = 0, outB = 0;
  walk(dir, (p, name) => {
    if (!/\.png$/i.test(name)) return;
    const out = p.replace(/\.png$/i, '.webp');
    if (fs.existsSync(out)) { skip++; return; }
    execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '90', p, '-o', out]);
    made++; inB += fs.statSync(p).size; outB += fs.statSync(out).size;
  });
  console.log(`[admin-library-prep] 만듦 ${made} · 건너뜀 ${skip} · PNG ${(inB / 1048576).toFixed(1)}MB → WebP ${(outB / 1048576).toFixed(1)}MB`);
}

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--fix-viewbox' && a.length > 1) runFixViewBox(a.slice(1));
  else if (a.length === 1 && fs.statSync(a[0]).isDirectory()) runWebp(a[0]);
  else { console.error('쓰는 법: admin-library-prep.cjs <폴더>  |  admin-library-prep.cjs --fix-viewbox <폴더…>'); process.exit(2); }
}

module.exports = { cubicRange, pathBBox, inlineUses, fixViewBox };
