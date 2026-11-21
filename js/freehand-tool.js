/* freehand-tool.js — t13A-02(현빈 GO 261119) 연필(N) · 붓(⇧B) · 떨림 보정(공통 «보정 세기» 하나)
 *
 * 연필 = 끌며 모은 점 → freehand-fit 맞춤(오차 = 보정 세기) → 펜 노드 → pen-tool commitPenNodes(펜과 «같은» 확정 길):
 *        섹션 안 = 벡터 블럭(penNodes · 점 편집·두께·색 그대로) · 섹션 밖 = 스크래치 펜 항목(t13A-04 와 같은 길 · «시작한 곳» 기준).
 * 붓   = 같은 맞춤 곡선의 «채운 외곽»(필압 없음 · 프리셋 둘: 양 끝 가늘게 · 서예 펜촉) — 획이 아니라 채움이라 점 편집은 없다(모양이 곧 붓).
 *        섹션 안 = 벡터 블럭(채움 #000000 = 벡터 색 칸이 바꾼다) · 섹션 밖 = 스크래치 그림.
 * 결과 꼴 근거(붓 = 채운 외곽): SVG 획은 한 줄에 굵기가 하나뿐이라 «가늘어지는 끝»을 못 그린다 — Illustrator Blob·perfect-freehand 와 같은 꼴(RESEARCH-t13A-02 §2 ②).
 * 키 근거: N · ⇧B 는 이 저장소에서 비어 있다(git grep KeyN/KeyB · settings-store 기본 단축키 · editor.js 단일 키 — ⌘B(굵게)만 있음).
 * 보정 세기 = 하단 플로팅 패널 안 묶음(#fh-bar · 기존 .fp-* · .prop-* 재사용) 손잡이 하나 · 이 맥에만 기억(localStorage · 실패해도 기본값) · 기본 50 = 오차 4px(⚠️마우스·트랙패드 실측 전 값).
 * 나가기 = Esc · V(공용 도구 모드 끝 명부 registerToolModeExit) · 같은 키 다시. 펜 모드와 서로 배타.
 */
import { fitCurve, segmentsToPenNodes, smoothToError, SMOOTH_DEFAULT, BRUSH_PRESETS, brushOutline, polygonToPath } from './fx/freehand-fit.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LS_KEY = 'goditor.freehandSmooth';
let _tool = null;          // 'pencil' | 'brush' | null
let _brush = 'taper';
let _stroke = null;        // { host, pts:[{x,y}], ov }
let _bar = null;

const _zoom = () => (window.currentZoom || 40) / 100;
const _local = (host, cx, cy) => { const r = host.getBoundingClientRect(), z = _zoom(); return { x: (cx - r.left) / z, y: (cy - r.top) / z }; };
function _smooth() { try { const v = parseFloat(localStorage.getItem(LS_KEY)); return Number.isFinite(v) ? v : SMOOTH_DEFAULT; } catch (_) { return SMOOTH_DEFAULT; } }
function _setSmooth(v) { try { localStorage.setItem(LS_KEY, String(v)); } catch (_) {} }

/* 막대 = 새 꼴이 아니라 기존 하단 플로팅 패널(#floating-panel) 안 한 묶음 — .fp-divider · .fp-group-label · .prop-select · .prop-slider 재사용(디자인 일관성 게이트 · 새 css 0).
   묶음 감싸개는 display:contents(제 상자 없음 — 패널의 flex 줄에 그대로 낀다). 패널이 없으면(미리보기 등) 막대 없이 도구만. */
function _showBar() {
  _bar?.remove(); _bar = null;
  const fp = document.getElementById('floating-panel');
  if (!fp) return;
  const b = document.createElement('span');
  b.id = 'fh-bar';
  b.style.display = 'contents';
  b.innerHTML = `<span class="fp-divider"></span><span class="fp-group-label" id="fh-tool">${_tool === 'brush' ? '붓 ⇧B' : '연필 N'}</span>`
    + (_tool === 'brush' ? `<select class="prop-select" id="fh-brush" aria-label="붓 프리셋">${Object.entries(BRUSH_PRESETS).map(([k, p]) => `<option value="${k}"${k === _brush ? ' selected' : ''}>${p.label}</option>`).join('')}</select>` : '')
    + `<span class="fp-group-label">보정</span><input type="range" class="prop-slider" id="fh-smooth" min="0" max="100" step="1" value="${_smooth()}" aria-label="떨림 보정 세기" title="떨림 보정 세기 — 클수록 매끈(점 적음)"><span class="fp-group-label" id="fh-smooth-val">${_smooth()}</span>`;
  b.addEventListener('mousedown', (e) => e.stopPropagation());
  fp.appendChild(b);
  b.querySelector('#fh-smooth').addEventListener('input', (e) => { _setSmooth(+e.target.value); b.querySelector('#fh-smooth-val').textContent = e.target.value; });
  b.querySelector('#fh-brush')?.addEventListener('change', (e) => { _brush = BRUSH_PRESETS[e.target.value] ? e.target.value : 'taper'; });
  _bar = b;
}

function _overlay(host) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'fh-preview');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:60;';
  const pl = document.createElementNS(SVG_NS, 'polyline');
  pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', 'var(--sel-color, #4a9eff)'); pl.setAttribute('stroke-width', String(1.5 / _zoom()));
  svg.appendChild(pl);
  host.appendChild(svg);
  return svg;
}

function _onDown(e) {
  if (!_tool || e.button !== 0) return;
  const host = window.penHostOf?.(e);
  if (!host) return;
  e.stopPropagation(); e.preventDefault();
  _stroke = { host, pts: [_local(host, e.clientX, e.clientY)], ov: _overlay(host) };
  document.addEventListener('mousemove', _onMove, true);
  document.addEventListener('mouseup', _onUp, true);
}
function _onMove(e) {
  if (!_stroke) return;
  e.stopPropagation(); e.preventDefault();
  _stroke.pts.push(_local(_stroke.host, e.clientX, e.clientY));
  _stroke.ov.firstChild.setAttribute('points', _stroke.pts.map((p) => `${p.x},${p.y}`).join(' '));
}
function _onUp(e) {
  document.removeEventListener('mousemove', _onMove, true);
  document.removeEventListener('mouseup', _onUp, true);
  const s = _stroke; _stroke = null;
  if (!s) return;
  e.stopPropagation();
  s.ov.remove();
  commitFreehand(s.host, s.pts);
}

/** 모은 점(host 로컬 px) → 확정. 시험·진단도 이 문(현재 도구·보정 세기·붓 프리셋을 따른다). 만든 것을 돌려준다(없으면 null). */
function commitFreehand(host, pts, tool = _tool) {
  const segs = fitCurve(pts, smoothToError(_smooth()) / _zoom());   // 보정 오차 = 화면 px → 로컬 px
  if (!segs.length) { window.showToast?.('조금 더 길게 그려 주세요'); return null; }
  if (tool !== 'brush') return window.commitPenNodes?.(host, segmentsToPenNodes(segs), false) ?? null;
  const poly = brushOutline(segs, _brush);
  if (poly.length < 4) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const pad = 2, w = Math.max(20, Math.ceil(maxX - minX + pad * 2)), h = Math.max(20, Math.ceil(maxY - minY + pad * 2));
  const local = poly.map((p) => ({ x: p.x - minX + pad, y: p.y - minY + pad }));
  const svg = `<svg xmlns="${SVG_NS}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${polygonToPath(local)}" fill="#000000"/></svg>`;
  if (host.id === 'canvas-scaler') {   // 섹션 밖 = 스크래치 그림(재료 · t13A-04 와 같은 «시작한 곳» 규칙)
    window._scratchAddAndSave?.('data:image/svg+xml;base64,' + btoa(svg), Math.round(minX - pad), Math.round(minY - pad), w);
    return host;
  }
  window.selectSection?.(host);
  return window.addVectorBlock?.(svg, { w, h, color: '#1a1a1a', label: 'Brush' }) ?? null;
}

/* 그린 뒤 click 이 아래 블럭·섹션 고르기로 새지 않게(pen-tool _onClick 과 같은 뜻) */
function _onClickBlock(e) { if (_tool && window.penHostOf?.(e)) { e.stopPropagation(); e.preventDefault(); } }

function _onKey(e) {
  if (e.key !== 'Escape') return;
  const a = document.activeElement;
  if (a && !a.closest('#fh-bar') && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;   // 막대 손잡이 포커스는 글자 칸 아님(editor.js N·⇧B 와 같은 뜻)
  e.stopPropagation(); exitFreehand();
}

export function enterFreehand(tool) {
  if (tool !== 'pencil' && tool !== 'brush') return;
  window.exitVectorPenMode?.(); window.exitPenMode?.(); window.exitPenEditMode?.();
  if (_tool) exitFreehand();
  _tool = tool;
  document.body.classList.add('vpen-mode', 'fh-mode');   // vpen-mode = 스크래치 마퀴 가드(scratch-pad)·펜과 같은 커서
  const wrap = document.getElementById('canvas-wrap');
  wrap?.addEventListener('mousedown', _onDown, true);
  wrap?.addEventListener('click', _onClickBlock, true);
  document.addEventListener('keydown', _onKey, true);
  _showBar();
  window.showToast?.(tool === 'brush' ? '🖌 붓 — 끌어 그리기 · Esc 끝' : '✏️ 연필 — 끌어 그리기 · Esc 끝');
}
export function exitFreehand() {
  if (!_tool) return false;
  _tool = null;
  document.body.classList.remove('vpen-mode', 'fh-mode');
  document.getElementById('canvas-wrap')?.removeEventListener('mousedown', _onDown, true);
  document.getElementById('canvas-wrap')?.removeEventListener('click', _onClickBlock, true);
  document.removeEventListener('keydown', _onKey, true);
  if (_stroke) { _stroke.ov.remove(); _stroke = null; }
  _bar?.remove(); _bar = null;
  return true;
}
export const toggleFreehand = (tool) => (_tool === tool ? exitFreehand() : enterFreehand(tool));

Object.assign(window, { enterFreehand, exitFreehand, toggleFreehand, commitFreehand, freehandTool: () => _tool });
window.registerToolModeExit?.('freehand', () => exitFreehand());
