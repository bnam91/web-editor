/* cert-block.js — 인증서 블럭(cert-block) · 모드 3: frame(CB1 액자 증서) · grid(CB2 증서 스캔 그리드) · collage(CB3 흩뿌린 콜라주 = S17 꼴)
 *   (인증서 블럭 A · 현빈 GO 261114 · 참값 ~/Downloads/goditor-t3/cert-pilot/rep4/r3.jpg)
 *   ★데이터는 dataset 하나(저장 = outerHTML 그대로) · 그림은 매번 renderCertBlock 이 dataset 에서 다시 짓는다(로드 때도 — save-load.js 표).
 *   ★배치 = ./cert-layout.js(순수) · 1000 단위로 셈하고 %·aspect-ratio 로 놓는다 ⇒ 섹션 폭이 바뀌어도 다시 그릴 필요 없다.
 *   ★증서 이미지는 «사용자 자기 파일»만 — 넣기는 패널이 기존 길(prop-grid.js grdPickImageFile · 자산 URL)로. 기본 = 회색 자리표시(실물 0).
 *   ⛔글자는 textContent 로만(틀 innerHTML 0) · 그림 src 는 data:image/ · goya-asset: · https: 만(그 밖은 자리표시).
 *   ⛔상표 로고(인증기관 마크 등) 번들 0 — 자리표시·샘플은 «○○ 인증» 가짜 글자와 원본 도형뿐.
 *   ★보이는 꼴은 전부 «인라인»(PNG·HTML 내보내기는 에디터 CSS 없이 그린다 — 쿠폰·인용구와 같은 규약) · CSS(editor-blocks.css)는 선택·커서만.
 */
import { genId, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';
import { collageLayout, gridLayout, CERT_SHEET_RATIO, CERT_MAX_SHEETS, CERT_PRESET_NAMES } from './cert-layout.js';

const CERT_MODES = ['collage', 'grid', 'frame'];
const CERT_STATUSES = ['', '등록', '출원', '진행중'];
const U = 1000;   // 배치 단위 폭

const CERT_DEFAULTS = Object.freeze({
  mode: 'collage',
  headline: '믿을 수 있는 인증을 받았습니다',
  sub: '구매 전 인증 내용을 확인하세요.',
  preset: 's17', seed: 1, jitter: 0, sheetW: 0.32,
  cols: 4, gap: 16,
  headSize: 40, subSize: 18, titleSize: 22, descSize: 15,
  headColor: '#111111', subColor: '#888888', titleColor: '#111111', descColor: '#777777', lineColor: '#9a9a9a',
  borderColor: '#b08d57',
  ftitle: '인 증 서', fsub: 'CERTIFICATE', fbody: '위 제품은 ○○ 기준에 적합함을 인증합니다.', fissuer: '○○ 인증원', fdate: '2026. 01. 01.', seal: '',
});
const _defCert = (i) => ({ title: `○○ 인증 ${i + 1}`, desc: '인증 내용을 한 줄로 적으세요', img: '', status: '' });
const CERT_DEFAULT_CERTS = Object.freeze([0, 1, 2, 3].map(_defCert));

const _num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const _color = (v, d) => (typeof v === 'string' && /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\))$/.test(v.trim()) ? v.trim() : d);   // 공용 색 칸은 알파면 rgba 를 준다
/** 증서 그림 주소로 받아도 되는가 — 사용자 파일(자산 URL·data 그림)과 https 만. */
function certImgOk(s) { return typeof s === 'string' && s.length <= 4_000_000 && /^(data:image\/(png|jpe?g|webp|gif);base64,|goya-asset:\/\/|https:\/\/)/i.test(s); }

function readCertState(block) {
  const d = block.dataset;
  let certs = [];
  try { const a = JSON.parse(d.certs || '[]'); if (Array.isArray(a)) certs = a; } catch (_) { certs = []; }
  certs = certs.slice(0, CERT_MAX_SHEETS).map((c, i) => ({
    title: String(c?.title ?? ''), desc: String(c?.desc ?? ''),
    img: certImgOk(c?.img) ? c.img : '', status: CERT_STATUSES.includes(c?.status) ? c.status : '',
  }));
  if (!certs.length) certs = CERT_DEFAULT_CERTS.map((c) => ({ ...c }));
  const D = CERT_DEFAULTS;
  return {
    mode: CERT_MODES.includes(d.mode) ? d.mode : D.mode, certs,
    headline: d.headline ?? D.headline, sub: d.sub ?? D.sub,
    preset: CERT_PRESET_NAMES.includes(d.preset) ? d.preset : D.preset,
    seed: Math.round(_num(d.seed, D.seed)), jitter: Math.max(0, Math.min(1, _num(d.jitter, D.jitter))),
    sheetW: Math.max(0.2, Math.min(0.45, _num(d.sheetW, D.sheetW))),
    cols: Math.max(1, Math.min(CERT_MAX_SHEETS, Math.round(_num(d.cols, D.cols)))), gap: Math.max(0, Math.min(80, _num(d.gap, D.gap))),
    headSize: _num(d.headSize, D.headSize), subSize: _num(d.subSize, D.subSize), titleSize: _num(d.titleSize, D.titleSize), descSize: _num(d.descSize, D.descSize),
    headColor: _color(d.headColor, D.headColor), subColor: _color(d.subColor, D.subColor), titleColor: _color(d.titleColor, D.titleColor),
    descColor: _color(d.descColor, D.descColor), lineColor: _color(d.lineColor, D.lineColor), borderColor: _color(d.borderColor, D.borderColor),
    ftitle: d.ftitle ?? D.ftitle, fsub: d.fsub ?? D.fsub, fbody: d.fbody ?? D.fbody, fissuer: d.fissuer ?? D.fissuer, fdate: d.fdate ?? D.fdate,
    seal: certImgOk(d.seal) ? d.seal : '',
  };
}

function _el(tag, cls, css, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (css) e.style.cssText = css;
  if (text != null) e.textContent = text;
  return e;
}
/** 증서 한 장 — 그림이 있으면 img, 없으면 회색 자리표시(가짜 줄 + 「증서 이미지」). */
const SHEET_LOOK = 'background:#ffffff;box-shadow:0 6px 18px rgba(0,0,0,0.18);overflow:hidden;border-radius:2px;box-sizing:border-box;';
const IMG_LOOK = 'display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;';
function _sheet(c, i) {
  const s = _el('div', 'cert-sheet');
  s.dataset.idx = String(i);
  if (c.img) {
    const img = _el('img', 'cert-img', IMG_LOOK); img.alt = ''; img.draggable = false; img.src = c.img;
    s.appendChild(img);
  } else {
    s.classList.add('cert-ph');
    // 자리표시 — 가짜 글줄(원본 도형) + 「증서 이미지» · 실물 증서·마크 0
    s.appendChild(_el('div', 'cert-ph-lines', 'position:absolute;inset:14% 12% 18% 12%;background:repeating-linear-gradient(#e2e2e2 0 2px, transparent 2px 14px);'));
    s.appendChild(_el('div', 'cert-ph-label', 'position:absolute;left:0;right:0;bottom:6%;text-align:center;font-size:12px;color:#9a9a9a;', '증서 이미지'));
  }
  return s;
}
const _sheetCss = (extra) => `${SHEET_LOOK}${extra}`;
function _caption(st, c, align) {
  const box = _el('div', 'cert-callout', `text-align:${align};line-height:1.35;`);
  const t = _el('div', 'cert-ct', `font-size:${st.titleSize}px;color:${st.titleColor};font-weight:700;`, c.title);
  if (c.status) t.appendChild(_el('span', 'cert-status', 'display:inline-block;margin-left:6px;padding:1px 7px;border:1px solid currentColor;border-radius:999px;font-size:0.6em;font-weight:600;vertical-align:middle;', c.status));
  box.append(t, _el('div', 'cert-cd', `font-size:${st.descSize}px;color:${st.descColor};margin-top:4px;`, c.desc));
  return box;
}
function _head(st) {
  const h = _el('div', 'cert-head', 'text-align:center;margin-bottom:28px;');
  if (st.headline) h.appendChild(_el('div', 'cert-headline', `font-size:${st.headSize}px;color:${st.headColor};font-weight:800;line-height:1.25;white-space:pre-line;`, st.headline));
  if (st.sub) h.appendChild(_el('div', 'cert-sub', `font-size:${st.subSize}px;color:${st.subColor};line-height:1.5;margin-top:12px;white-space:pre-line;`, st.sub));
  return h;
}

function _renderCollage(block, st) {
  const L = collageLayout({ n: st.certs.length, width: U, sheetW: st.sheetW, preset: st.preset, seed: st.seed, jitter: st.jitter, lineLen: 56, labelH: 64, pad: 12 });
  const H = L.height;
  const stage = _el('div', 'cert-stage', `position:relative;width:100%;aspect-ratio:${U} / ${H};`);
  const pct = (v, of) => `${(v / of) * 100}%`;
  for (const s of L.sheets) {
    const c = st.certs[s.i];
    const sh = _sheet(c, s.i);
    sh.style.cssText = _sheetCss(`position:absolute;left:${pct(s.cx - s.w / 2, U)};top:${pct(s.cy - s.h / 2, H)};width:${pct(s.w, U)};height:${pct(s.h, H)};transform:rotate(${s.rot.toFixed(2)}deg);z-index:${s.z};`);
    stage.appendChild(sh);
    const y1 = Math.min(s.line.y1, s.line.y2), y2 = Math.max(s.line.y1, s.line.y2);
    stage.appendChild(_el('div', 'cert-line', `position:absolute;left:${pct(s.line.x, U)};top:${pct(y1, H)};height:${pct(y2 - y1, H)};width:1px;background:${st.lineColor};z-index:20;`));
    const cap = _caption(st, c, 'center');
    cap.dataset.idx = String(s.i);
    cap.style.cssText += `position:absolute;left:${pct(s.label.x, U)};top:${pct(s.label.y, H)};transform:translate(-50%, ${s.side === 'top' ? '-100%' : '0'});z-index:21;white-space:nowrap;`;
    stage.appendChild(cap);
  }
  block.append(_head(st), stage);
}

function _renderGrid(block, st) {
  const G = gridLayout({ n: st.certs.length, width: U, cols: st.cols, gap: st.gap, captionH: 0 });
  const wrap = _el('div', 'cert-grid', `display:grid;grid-template-columns:repeat(${Math.min(st.cols, st.certs.length)}, 1fr);gap:${st.gap}px;justify-content:center;`);
  st.certs.forEach((c, i) => {
    const cell = _el('div', 'cert-cell');
    const sh = _sheet(c, i);
    sh.style.cssText = _sheetCss('position:relative;width:100%;aspect-ratio:210 / 297;');
    const cap = _caption(st, c, 'center'); cap.style.marginTop = '12px';
    cell.append(sh, cap);
    wrap.appendChild(cell);
  });
  wrap.dataset.cells = String(G.cells.length);
  block.append(_head(st), wrap);
}

function _renderFrame(block, st) {
  // 이중 테두리 = border double(겉선·속선) · 종이 비율 A4 · 가운데 정렬
  const f = _el('div', 'cert-frame', `box-sizing:border-box;width:100%;max-width:640px;margin:0 auto;aspect-ratio:210 / ${(210 * CERT_SHEET_RATIO).toFixed(2)};`
    + `border:10px double ${st.borderColor};background:#fffdf8;padding:9% 10% 7%;display:flex;flex-direction:column;align-items:center;text-align:center;`);
  f.append(
    _el('div', 'cert-f-title', `color:${st.titleColor};font-size:44px;font-weight:800;letter-spacing:0.35em;`, st.ftitle),
    _el('div', 'cert-f-sub', `color:${st.borderColor};font-size:14px;letter-spacing:0.3em;margin-top:10px;`, st.fsub),
    _el('div', 'cert-f-body', `color:${st.descColor};font-size:18px;line-height:1.8;margin:auto 0;white-space:pre-line;`, st.fbody),
  );
  const foot = _el('div', 'cert-f-foot', 'display:flex;align-items:flex-end;justify-content:center;gap:18px;width:100%;');
  const who = _el('div', 'cert-f-who', 'text-align:center;');
  who.append(_el('div', 'cert-f-date', `color:${st.descColor};font-size:15px;`, st.fdate), _el('div', 'cert-f-issuer', `color:${st.titleColor};font-size:22px;font-weight:700;margin-top:6px;`, st.fissuer));
  const seal = _el('div', 'cert-f-seal', `width:72px;height:72px;border-radius:50%;border:3px solid ${st.borderColor};color:${st.borderColor};display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;overflow:hidden;flex-shrink:0;`);
  if (st.seal) { const img = _el('img', 'cert-img', 'width:100%;height:100%;object-fit:contain;pointer-events:none;'); img.alt = ''; img.draggable = false; img.src = st.seal; seal.appendChild(img); seal.classList.add('has-img'); seal.style.border = 'none'; }
  else seal.textContent = '인';
  foot.append(who, seal);
  f.appendChild(foot);
  block.appendChild(f);
}

function renderCertBlock(block) {
  if (!block) return;
  const st = readCertState(block);
  block.dataset.mode = st.mode;
  block.querySelectorAll(':scope > .cert-head, :scope > .cert-stage, :scope > .cert-grid, :scope > .cert-frame').forEach((n) => n.remove());
  if (st.mode === 'frame') _renderFrame(block, st);
  else if (st.mode === 'grid') _renderGrid(block, st);
  else _renderCollage(block, st);
}

function makeCertBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'cert-block';
  block.id = genId('crt');
  block.dataset.type = 'cert';
  block.dataset.mode = CERT_MODES.includes(opts.mode) ? opts.mode : CERT_DEFAULTS.mode;
  block.dataset.certs = JSON.stringify(Array.isArray(opts.certs) ? opts.certs : CERT_DEFAULT_CERTS);
  for (const k of ['headline', 'sub', 'preset', 'seed', 'jitter', 'sheetW', 'cols', 'gap']) block.dataset[k] = String(opts[k] ?? CERT_DEFAULTS[k]);
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

/** 증서 배열을 고쳐 쓰고 다시 그린다(패널 공용 · 저장소 = dataset.certs 하나). */
function setCertList(block, certs) {
  block.dataset.certs = JSON.stringify(certs.slice(0, CERT_MAX_SHEETS).map((c) => ({ title: c.title || '', desc: c.desc || '', img: certImgOk(c.img) ? c.img : '', status: CERT_STATUSES.includes(c.status) ? c.status : '' })));
  renderCertBlock(block);
}

window.makeCertBlock = makeCertBlock;
window.addCertBlock = addCertBlock;
window.renderCertBlock = renderCertBlock;

export { CERT_MODES, CERT_STATUSES, CERT_DEFAULTS, CERT_DEFAULT_CERTS, certImgOk, readCertState, renderCertBlock, makeCertBlock, addCertBlock, setCertList };
