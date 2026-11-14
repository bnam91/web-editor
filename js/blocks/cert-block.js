/* cert-block.js — A4 용지 스택(보이는 이름 «Documents» · 현빈 261114 · 내부 클래스는 cert-block 그대로) (A · 현빈 GO 261114 → reframe 같은 날)
 *   현빈: «인증서라고 생각하지 말고 A4 용지들을 배치하는 거라고 생각해.» ⇒ 본질 = 세로 A4(1:1.414) 용지를 겹쳐 세운 «스택» 하나.
 *   ★슬롯 = 에셋 블럭처럼: 파일을 끌어다 놓기(drop) · 더블클릭 = 파일창(prop-grid.js grdPickImageFile — 기존 길) · 빈 칸 = 체크무늬(checkerBg 정본)
 *   ★모드 = stack(cert-layout.js collageLayout · 기본 fan · s17/stair/pile/auto 는 같은 스택의 다른 겹침) · grid(A4 칸 · 열·간격)
 *   ★이펙트(용지마다): 회전 · 기울기(3D 원근) · 끝말림 · 그림자(기본 부드럽게) · 옵션(기본 끔): 지시선 글(+상태 칩) · 위 제목/부제(비우면 안 그림)
 *   ⛔원형 인증마크·낙관 슬롯은 «안 둔다»(사용자가 스티커/마크로 따로 올린다) · 상표 로고 번들 0
 *   ★데이터 = dataset 하나(저장 = outerHTML) · 그림은 renderCertBlock 이 매번 다시(로드 때도 save-load.js 표) · 보이는 꼴은 인라인(내보내기 규약)
 *   ⛔글은 textContent 만 · 그림 주소는 data:image/ · goya-asset: · https: 만(그 밖 = 빈 칸)
 *   ★내부 이름(cert-block · data-type cert · genId crt · window.*Cert*)을 안 바꾼 까닭: 등록 14파일·명부 래칫 9파일이 이 이름을 문다 — 보이는 이름만 바꿨다.
 */
import { genId, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { checkerBg } from '../checker-tokens.js';
import { grdImageFileOk, grdPickedImageSrc, grdPickImageFile } from '../props/prop-grid.js';
import { collageLayout, CERT_MAX_SHEETS, CERT_PRESET_NAMES } from './cert-layout.js';

const CERT_MODES = ['stack', 'grid'];   // 현빈 결정 261114 — 스택(부채 등 겹침) + 격자(A4 칸 · A 원판 grid 를 되살림)

const CERT_STATUSES = ['', '등록', '출원', '진행중'];
/* 이펙트(현빈 261114 «이펙트» 절) — 용지(슬롯)마다: 회전(평면 · 배치 각에 더함) · 기울기(3D rotateY + 원근) · 끝말림 · 그림자 */
const CERT_SHADOWS = { none: 'none', soft: '0 6px 18px rgba(0,0,0,0.18)', strong: '0 14px 32px rgba(0,0,0,0.32)' };
const CERT_FX_DEFAULT = Object.freeze({ rot: 0, tilt: 0, curl: 'off', shadow: 'soft' });
function normFx(fx) {
  const f = fx && typeof fx === 'object' ? fx : {};
  const n = (v, lo, hi) => { const x = parseFloat(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : 0; };
  return { rot: n(f.rot, -30, 30), tilt: n(f.tilt, -40, 40), curl: f.curl === 'on' ? 'on' : 'off', shadow: Object.prototype.hasOwnProperty.call(CERT_SHADOWS, f.shadow) ? f.shadow : CERT_FX_DEFAULT.shadow };
}
/** 용지 transform — 배치 각(base) + 회전 · 기울기가 있을 때만 원근(없으면 2D 그대로 — 측정·내보내기 단순). */
function sheetTransform(base, fx) {
  const z = (base + fx.rot).toFixed(2);
  return fx.tilt ? `perspective(1200px) rotate(${z}deg) rotateY(${fx.tilt.toFixed(1)}deg)` : (Number(z) ? `rotate(${z}deg)` : 'none');
}
const U = 1000;   // 배치 단위 폭
const _onOff = (v, d) => (v === 'on' || v === 'off' ? v : d);

const CERT_DEFAULTS = Object.freeze({
  mode: 'stack', cols: 4, gap: 16,
  headline: '', sub: '',
  preset: 'fan', seed: 1, jitter: 0, sheetW: 0.32,
  callouts: 'off',
  headSize: 40, subSize: 18, titleSize: 22, descSize: 15,
  headColor: '#111111', subColor: '#888888', titleColor: '#111111', descColor: '#777777', lineColor: '#9a9a9a',
});
const _defCert = (i) => ({ title: `제목 ${i + 1}`, desc: '설명 한 줄', img: '', status: '' });
const CERT_DEFAULT_CERTS = Object.freeze([0, 1, 2, 3].map(_defCert));

const _num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const _color = (v, d) => (typeof v === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$/.test(v.trim()) ? v.trim() : d);   // 공용 색 칸은 알파면 rgba 를 준다
/** 용지 그림 주소로 받아도 되는가 — 사용자 파일(자산 URL·data 그림)과 https 만. */
function certImgOk(s) { return typeof s === 'string' && s.length <= 4_000_000 && /^(data:image\/(png|jpe?g|webp|gif);base64,|goya-asset:\/\/|https:\/\/)/i.test(s); }

function readCertState(block) {
  const d = block.dataset;
  let certs = [];
  try { const a = JSON.parse(d.certs || '[]'); if (Array.isArray(a)) certs = a; } catch (_) { certs = []; }
  certs = certs.slice(0, CERT_MAX_SHEETS).map((c) => ({
    title: String(c?.title ?? ''), desc: String(c?.desc ?? ''),
    img: certImgOk(c?.img) ? c.img : '', status: CERT_STATUSES.includes(c?.status) ? c.status : '',
    fx: normFx(c?.fx),
  }));
  if (!certs.length) certs = CERT_DEFAULT_CERTS.map((c) => ({ ...c, fx: normFx() }));
  const D = CERT_DEFAULTS;
  return {
    certs,
    mode: CERT_MODES.includes(d.mode) ? d.mode : D.mode,
    cols: Math.max(1, Math.min(CERT_MAX_SHEETS, Math.round(_num(d.cols, D.cols)))), gap: Math.max(0, Math.min(80, _num(d.gap, D.gap))),
    headline: d.headline ?? D.headline, sub: d.sub ?? D.sub,
    preset: CERT_PRESET_NAMES.includes(d.preset) ? d.preset : D.preset,
    seed: Math.round(_num(d.seed, D.seed)), jitter: Math.max(0, Math.min(1, _num(d.jitter, D.jitter))),
    sheetW: Math.max(0.2, Math.min(0.45, _num(d.sheetW, D.sheetW))),
    callouts: _onOff(d.callouts, D.callouts),
    headSize: _num(d.headSize, D.headSize), subSize: _num(d.subSize, D.subSize), titleSize: _num(d.titleSize, D.titleSize), descSize: _num(d.descSize, D.descSize),
    headColor: _color(d.headColor, D.headColor), subColor: _color(d.subColor, D.subColor), titleColor: _color(d.titleColor, D.titleColor),
    descColor: _color(d.descColor, D.descColor), lineColor: _color(d.lineColor, D.lineColor),
  };
}

function _el(tag, cls, css, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (css) e.style.cssText = css;
  if (text != null) e.textContent = text;
  return e;
}
const SHEET_LOOK = 'background:#ffffff;overflow:hidden;border-radius:2px;box-sizing:border-box;';
const IMG_LOOK = 'display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;';
/* 종이 끝 말림 — 오른쪽 아래 모서리를 접어 올린 꼴(그라데이션 + 그림자). 원본 도형 · 내보내기 인라인 · 목업 블럭엔 같은 효과 없음(실측 grep curl 0). */
const CURL_LOOK = 'position:absolute;right:0;bottom:0;width:22%;height:16%;pointer-events:none;'
  + 'background:linear-gradient(315deg, rgba(0,0,0,0) 0 48%, #d9d9d9 50%, #f4f4f4 62%, #ffffff 80%);'
  + 'border-top-left-radius:100% 60%;box-shadow:-3px -3px 6px rgba(0,0,0,0.12);';

/** 용지 한 장 — 그림이 있으면 img, 없으면 체크무늬 빈 칸(인라인 배경 · _sheetCss). */
function _sheet(c, i, st) {
  const s = _el('div', 'cert-sheet');
  s.dataset.idx = String(i);
  if (c.img) {
    const img = _el('img', 'cert-img', IMG_LOOK); img.alt = ''; img.draggable = false; img.src = c.img;
    s.appendChild(img);
  } else {
    s.classList.add('cert-ph');
  }
  if (c.fx.curl === 'on') s.appendChild(_el('div', 'cert-curl', CURL_LOOK));
  return s;
}
const _sheetCss = (c, extra) => `${SHEET_LOOK}box-shadow:${CERT_SHADOWS[c.fx.shadow]};${c.img ? '' : `background:${checkerBg('big', '16px')};`}${extra}`;

function _caption(st, c, align) {
  const box = _el('div', 'cert-callout', `text-align:${align};line-height:1.35;`);
  const t = _el('div', 'cert-ct', `font-size:${st.titleSize}px;color:${st.titleColor};font-weight:700;`, c.title);
  if (c.status) t.appendChild(_el('span', 'cert-status', 'display:inline-block;margin-left:6px;padding:1px 7px;border:1px solid currentColor;border-radius:999px;font-size:0.6em;font-weight:600;vertical-align:middle;', c.status));
  box.append(t, _el('div', 'cert-cd', `font-size:${st.descSize}px;color:${st.descColor};margin-top:4px;`, c.desc));
  return box;
}
function _head(st) {
  if (!st.headline && !st.sub) return null;
  const h = _el('div', 'cert-head', 'text-align:center;margin-bottom:28px;');
  if (st.headline) h.appendChild(_el('div', 'cert-headline', `font-size:${st.headSize}px;color:${st.headColor};font-weight:800;line-height:1.25;white-space:pre-line;`, st.headline));
  if (st.sub) h.appendChild(_el('div', 'cert-sub', `font-size:${st.subSize}px;color:${st.subColor};line-height:1.5;margin-top:12px;white-space:pre-line;`, st.sub));
  return h;
}

/* 격자(A4 칸) — 열·간격 · 칸 = 세로 A4 · 지시선 글을 켜면 칸 «아래»에 제목·설명(+상태) */
function _renderGridStage(st) {
  const cols = Math.min(st.cols, st.certs.length);
  const stage = _el('div', 'cert-stage cert-grid', `display:grid;grid-template-columns:repeat(${cols}, 1fr);gap:${st.gap}px;align-items:start;`);
  st.certs.forEach((c, i) => {
    const cell = _el('div', 'cert-cell', 'min-width:0;');
    const sh = _sheet(c, i, st);
    sh.style.cssText = _sheetCss(c, `position:relative;width:100%;aspect-ratio:210 / 297;transform:${sheetTransform(0, c.fx)};`);
    cell.appendChild(sh);
    if (st.callouts === 'on') { const cap = _caption(st, c, 'center'); cap.dataset.idx = String(i); cap.style.marginTop = '12px'; cell.appendChild(cap); }
    stage.appendChild(cell);
  });
  return stage;
}

function renderCertBlock(block) {
  if (!block) return;
  const st = readCertState(block);
  block.dataset.mode = st.mode;
  block.querySelectorAll(':scope > .cert-head, :scope > .cert-stage').forEach((n) => n.remove());
  if (st.mode === 'grid') {
    const head = _head(st);
    if (head) block.append(head);
    block.append(_renderGridStage(st));
    _bindSlotInput(block);
    return;
  }
  const withCallouts = st.callouts === 'on';
  const L = collageLayout({ n: st.certs.length, width: U, sheetW: st.sheetW, preset: st.preset, seed: st.seed, jitter: st.jitter,
    lineLen: 56, labelH: 64, pad: 12, labels: withCallouts });
  const H = L.height;
  const stage = _el('div', 'cert-stage', `position:relative;width:100%;aspect-ratio:${U} / ${H};`);
  const pct = (v, of) => `${(v / of) * 100}%`;
  for (const s of L.sheets) {
    const c = st.certs[s.i];
    const sh = _sheet(c, s.i, st);
    sh.style.cssText = _sheetCss(c, `position:absolute;left:${pct(s.cx - s.w / 2, U)};top:${pct(s.cy - s.h / 2, H)};width:${pct(s.w, U)};height:${pct(s.h, H)};transform:${sheetTransform(s.rot, c.fx)};z-index:${s.z};`);
    stage.appendChild(sh);
    if (!withCallouts) continue;
    const y1 = Math.min(s.line.y1, s.line.y2), y2 = Math.max(s.line.y1, s.line.y2);
    stage.appendChild(_el('div', 'cert-line', `position:absolute;left:${pct(s.line.x, U)};top:${pct(y1, H)};height:${pct(y2 - y1, H)};width:1px;background:${st.lineColor};z-index:20;`));
    const cap = _caption(st, c, 'center');
    cap.dataset.idx = String(s.i);
    cap.style.cssText += `position:absolute;left:${pct(s.label.x, U)};top:${pct(s.label.y, H)};transform:translate(-50%, ${s.side === 'top' ? '-100%' : '0'});z-index:21;white-space:nowrap;`;
    stage.appendChild(cap);
  }
  const head = _head(st);
  if (head) block.append(head);
  block.append(stage);
  _bindSlotInput(block);
}

/** 용지 배열을 고쳐 쓰고 다시 그린다(패널·끌어 놓기 공용 · 저장소 = dataset.certs 하나). */
function setCertList(block, certs) {
  block.dataset.certs = JSON.stringify(certs.slice(0, CERT_MAX_SHEETS).map((c) => ({ title: c.title || '', desc: c.desc || '', img: certImgOk(c.img) ? c.img : '', status: CERT_STATUSES.includes(c.status) ? c.status : '', fx: normFx(c.fx) })));
  renderCertBlock(block);
}
/** 슬롯 i 에 그림 — 기록·저장·(골라져 있으면) 패널 새로. */
function setCertSlotImage(block, i, src) {
  if (!block?.isConnected) return false;
  const certs = readCertState(block).certs;
  if (!certs[i] || !certImgOk(src)) return false;
  window.pushHistory?.('A4 용지 그림');
  certs[i] = { ...certs[i], img: src };
  setCertList(block, certs);
  window.scheduleAutoSave?.();
  if (block.classList.contains('selected')) window.showCertProperties?.(block);
  return true;
}

/* 슬롯 입력 — 에셋 블럭처럼 «파일 끌어 놓기» · «더블클릭 = 파일창». 블럭에 한 번만 위임(다시 그려도 안 겹친다). */
function _bindSlotInput(block) {
  if (block._certSlotBound) return;
  block._certSlotBound = true;
  const slotOf = (e) => e.target.closest?.('.cert-sheet');
  block.addEventListener('dragover', (e) => {
    if (!slotOf(e) || !e.dataTransfer || ![...(e.dataTransfer.types || [])].includes('Files')) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
  });
  block.addEventListener('drop', async (e) => {
    const sheet = slotOf(e);
    const file = e.dataTransfer?.files?.[0];
    if (!sheet || !file) return;
    e.preventDefault(); e.stopPropagation();
    if (!grdImageFileOk(file)) return;
    const got = await grdPickedImageSrc(file);
    if (got) setCertSlotImage(block, +sheet.dataset.idx, got.src);
  });
  block.addEventListener('dblclick', (e) => {
    const sheet = slotOf(e);
    if (!sheet) return;
    e.stopPropagation();
    const i = +sheet.dataset.idx;
    grdPickImageFile((src) => setCertSlotImage(block, i, src));
  });
}

function makeCertBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'cert-block';
  block.id = genId('crt');
  block.dataset.type = 'cert';
  block.dataset.layerName = opts.layerName || 'Documents';
  block.dataset.certs = JSON.stringify(Array.isArray(opts.certs) ? opts.certs : CERT_DEFAULT_CERTS);
  for (const k of ['mode', 'cols', 'gap', 'headline', 'sub', 'preset', 'seed', 'jitter', 'sheetW', 'callouts']) block.dataset[k] = String(opts[k] ?? CERT_DEFAULTS[k]);
  renderCertBlock(block);
  const row = document.createElement('div');
  row.className = 'row';
  row.id = genId('row');
  row.dataset.layout = 'stack';
  row.appendChild(block);
  return { row, block };
}

function addCertBlock(opts = {}) {
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showNoSelectionHint?.(); return null; }
  window.pushHistory?.();
  const made = makeCertBlock(opts);
  insertAfterSelected(sec, made.row);
  bindBlock(made.block);
  window.buildLayerPanel?.();
  try { window.selectBlock?.(made.block.id); } catch (_) {}
  window.triggerAutoSave?.();
  return made;
}

window.makeCertBlock = makeCertBlock;
window.addCertBlock = addCertBlock;
window.renderCertBlock = renderCertBlock;

export { CERT_MODES, CERT_SHADOWS, CERT_FX_DEFAULT, normFx, sheetTransform, CERT_STATUSES, CERT_DEFAULTS, CERT_DEFAULT_CERTS, certImgOk, readCertState, renderCertBlock, makeCertBlock, addCertBlock, setCertList, setCertSlotImage };
