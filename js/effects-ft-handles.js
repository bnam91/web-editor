/* effects-ft-handles — 글상자 ★자유변형 ★U3 «손잡이 12 ＋ 격자» (2026-10-24 · 지디 · 현빈 GO)
 *   ★★★정본 = ★시안 8판 ★`~/.gd-work/team-lead/sian/sian-08-text-freetransform-v8.html`
 *     (sha `e1338e08e1de` · 772줄 · ★★내가 만들어 ★현빈께 드린 ★그 판)
 *   발주 : `ORDER-u3-handles-261023.md` · 모듈 정본 : `js/effects-freetransform.js`
 *
 * ★★★★★261024 — ★★첫 판을 ★★버리고 ★다시 지었다. ★★까닭(★현빈 신고 ★셋 · ★전부 ★맞았다):
 *   ⒜ 「★보라 두께가 ★모서리마다 ★다르다」 ⇒ ★★손잡이를 ★★변형 ★«안»에 두어 ★★같이 ★휘었다
 *   ⒝ 「★파란 아웃라인 ★너비가 ★줄어든다」 ⇒ ★★손잡이를 ★`tb` 자식으로 두어 ★★레이아웃을 ★밀었다
 *   ⒞ 「★격자가 ★안 ★보인다」          ⇒ ★★3×3 ★분할선을 ★★아예 ★안 ★만들었다
 *   ★★★나는 ★그 ★시안을 ★★안 ★보고 ★지었다. ★그것이 ★흠이다.
 *
 * ★★시안이 ★정한 ★구조 — ★★★«세 층»이고 ★★각 층이 ★★다른 ★축에 ★선다:
 *   ⒤ ★`.text-block`(★파란 아웃라인)  ⇒ ★★★`transform` 을 ★★영영 ★안 ★건다. ★직사각형 ★유지.
 *      ★★크기만 ★글자를 ★따라간다(★현빈 msg5416 ⒞ 「★박스가 ★항상 ★글자를 ★감싼다」).
 *      ★★시안 주석 : 「★«모양만 ★변형»(msg5406) ＋ ★«아웃라인도 ★같이 ★늘어나야»(msg5413)
 *        ⇒ ★★둘은 ★«다른 축»이라 ★★양립한다. ⛔`transform` 은 ★영영 ★안 ★건다」
 *   ⅱ) ★`.tfh-fx`(= ★시안의 `.tfx`) ⇒ ★★글자와 ★★«같은 행렬»을 ★받아 ★★같이 ★휜다.
 *      ★안에 ★`.tfh-edge`(보라 테두리) ＋ ★`.tfh-grid`(★3×3 ★분할선 ★넷)
 *   ★★ⅲ) ★`.tfh-layer` ⇒ ★★★변형 ★«밖». ★★손잡이 ★12 가 ★여기 ★산다.
 *      ⇒ ★★그래서 ★★두께가 ★★균일하다(★⒜ 의 ★처방)
 *
 * ★★손잡이 ★12 = ★모서리 ★4(nw·ne·se·sw) ＋ ★변의 ★1/3·2/3 ★8 — ★★시안 `EDGEPTS` 그대로
 *   ★★변 손잡이의 ★자리는 ★★★호모그래피로 ★구한다(⛔원근에서 ★선형이 ★아니다 — ★시안 주석)
 *   ★★끌면 : ★모서리 = ★그 점 ★하나 / ★변 = ★★이웃 ★두 모서리를 ★★법선 쪽으로 ★같이 (★시안 `apply`)
 *   ★★⇧Shift = ★★맞은편을 ★축으로 ★★닮게(비율 지키기) — ★시안 `apply` 의 ★그 식
 *
 * ★자리 기준 — ⛔`getBoundingClientRect()` 를 ★변형된 ★상태에서 ★쓰지 ★마라.
 *   ★시안 주석 : 「★261022 ★스크린샷에서 ★핸들이 ★테두리에서 ★어긋나 ★보였다(★현빈 ⑤ 가 ★또 맞았다)」
 *   ⇒ ★★`ftMeasure` 가 ★★«변형을 ★끈 ★상태»에서 ★잡은 ★`OX·OY` 를 ★쓴다.
 *
 * ★이름 `tfh-` 를 고른 까닭(실측 261024): ⛔`ft-` 는 ★임자가 있다(`.ft-tile` ★48건 · projects-onescreen).
 *   ★그 이름들은 ★`beea5848` 에서 ★★명부 쌍(editor-ui-roster ＋ serializeCleanRoot)에 ★올렸다
 *   ⇒ ★저장본·PNG·썸네일·HTML 로 ★★안 ★샌다(★`H5` 가 ★잠근다).
 */
import { ftCornersOf, ftStateOf, setFxFreeTransform } from './effects-freetransform.js';
import { homography, normalizeCorners } from './fx/homography.js';   /* ★읽기만 — ⛔고치지 않는다 */

/* ★시안 `:548~554` 그대로 — ⛔수를 ★새로 짓지 ★않는다 */
const CORNERS = [['nw', 0], ['ne', 1], ['se', 2], ['sw', 3]];
const EDGES   = [['n', 0, 1], ['e', 1, 2], ['s', 2, 3], ['w', 3, 0]];
const EDGEPTS = [
  ['n1', 'n', 1 / 3], ['n2', 'n', 2 / 3], ['e1', 'e', 1 / 3], ['e2', 'e', 2 / 3],
  ['s1', 's', 1 / 3], ['s2', 's', 2 / 3], ['w1', 'w', 1 / 3], ['w2', 'w', 2 / 3],
];
const CURSOR = { nw: 'nwse-resize', ne: 'nesw-resize', se: 'nwse-resize', sw: 'nesw-resize' };

/** 캔버스 실제 배율 — ⛔`window.currentZoom` 을 ★가정하지 않고 ★잰다(정본 `_scaleOf` 와 ★같은 자). */
function _scaleOf(el) {
  const ow = el && el.offsetWidth;
  if (!ow) return 1;
  const z = el.getBoundingClientRect().width / ow;
  return Number.isFinite(z) && z > 0.01 ? z : 1;
}

/** 글자칸 — 정본 `_contentOf` 와 ★같은 순서(이 레포의 관용구 · 여덟 자리가 쓴다). */
function _glyphOf(tb) {
  if (!tb || !tb.querySelector) return null;
  return tb.querySelector('[contenteditable]')
    || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text');
}

/** 이 블럭의 ★U3 자취를 ★전부 걷는다 — ★`:scope >` 로 ★제 것만(관용구: gradient-select.js:26). */
export function ftHandlesClear(tb) {
  if (!tb || !tb.querySelectorAll) return 0;
  const els = tb.querySelectorAll(':scope > .tfh-fx, :scope > .tfh-layer');
  els.forEach((h) => h.remove());
  return els.length;
}

/** 떠야 하나 — ★`tfCorners` 가 ★있고 ★그 블럭이 ★골라져 ★있을 때.
 *  ⛔「카드가 ★열렸나」로 ★가르지 ★않는다 — ★카드는 ★접힐 수 있고 ★그때도 ★끌 수 ★있어야 ★한다. */
function _shouldShow(tb) {
  return !!(tb && tb.dataset && tb.dataset.tfCorners && tb.classList && tb.classList.contains('selected'));
}

/** 두 층을 ★없으면 만들고 ★있으면 ★그대로 — ★멱등. */
function _ensureLayers(tb) {
  let fx = tb.querySelector(':scope > .tfh-fx');
  if (!fx) {
    fx = document.createElement('div');
    fx.className = 'tfh-fx';
    /* ★격자 = ★3×3 — ★시안 `:193~197` 그대로(★v 둘 · ★h 둘 · ★33.333%·66.666%) */
    fx.innerHTML = '<div class="tfh-edge"></div><div class="tfh-grid">'
      + '<i class="v" style="left:33.333%"></i><i class="v" style="left:66.666%"></i>'
      + '<i class="h" style="top:33.333%"></i><i class="h" style="top:66.666%"></i>'
      + '</div>';
    tb.appendChild(fx);
  }
  let layer = tb.querySelector(':scope > .tfh-layer');
  if (!layer) { layer = document.createElement('div'); layer.className = 'tfh-layer'; tb.appendChild(layer); }
  return { fx, layer };
}

/** 손잡이·격자를 ★놓는다(멱등). 돌려주는 것 = 놓은 손잡이 수(안 떠야 하면 0). */
export function ftHandlesSync(tb) {
  if (!_shouldShow(tb)) { ftHandlesClear(tb); return 0; }
  const C = ftCornersOf(tb);
  const st = ftStateOf(tb);
  const glyph = _glyphOf(tb);
  if (!C || !st || !glyph || !(st.W > 0) || !(st.H > 0)) { ftHandlesClear(tb); return 0; }

  const { D } = normalizeCorners(C);
  const h = homography([[0, 0], [st.W, 0], [st.W, st.H], [0, st.H]], D);
  if (!h) return 0;                       /* ★한 줄·겹침 ⇒ 못 푼다 — ★정본도 그리지 않는다 */

  const { fx, layer } = _ensureLayers(tb);
  /* ★★⒤ 꾸밈 층 — ★글자와 ★«같은 행렬». ★시안 `:570~571` 그대로(origin `0 0`). */
  fx.style.width = st.W + 'px'; fx.style.height = st.H + 'px';
  fx.style.left = st.OX + 'px'; fx.style.top = st.OY + 'px';
  fx.style.transform = glyph.style.transform || '';
  fx.style.transformOrigin = '0 0';

  /* ★★ⅱ) 손잡이 층 — ★★변형 ★«밖». ⇒ ★★두께가 ★균일하다(★현빈 ⒜ 의 ★처방). */
  const scale = _scaleOf(tb);
  const toLocal = ([x, y]) => [st.OX + x, st.OY + y];      /* ★모델 px · ★블럭 좌표 */
  const put = (name, pt, kind) => {
    let el = layer.querySelector(`:scope > [data-tfh="${name}"]`);
    if (!el) {
      el = document.createElement('span');
      el.className = 'tfh-handle ' + kind;
      el.dataset.tfh = name;
      el.tabIndex = 0;
      el.setAttribute('aria-label', name + ' 핸들');
      if (CURSOR[name]) el.style.cursor = CURSOR[name];
      layer.appendChild(el);
      _bind(el, tb, name, kind);
    }
    el.style.left = pt[0] + 'px';
    el.style.top = pt[1] + 'px';
  };
  CORNERS.forEach(([n, i]) => put(n, toLocal(D[i]), 'corner'));
  /* ★변의 ★1/3·2/3 — ★★호모그래피로 ★그 자리를 ★구한다(★★원근에서 ★선형이 ★아니다 · ★시안 주석) */
  const srcPt = { n: [[0, 0], [st.W, 0]], e: [[st.W, 0], [st.W, st.H]], s: [[st.W, st.H], [0, st.H]], w: [[0, st.H], [0, 0]] };
  EDGEPTS.forEach(([n, side, t]) => {
    const [a, b] = srcPt[side];
    const m = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const w = h[6] * m[0] + h[7] * m[1] + 1;
    put(n, toLocal([(h[0] * m[0] + h[1] * m[1] + h[2]) / w, (h[3] * m[0] + h[4] * m[1] + h[5]) / w]), 'edge');
  });
  void scale;
  return layer.querySelectorAll(':scope > .tfh-handle').length;
}

/** 끌기 — ★★«바꾸는 문 하나»(`setFxFreeTransform`)로만. ★시안 `apply`(`:659~690`) 와 ★같은 식.
 *  ★`touched: true` — ★정본이 적어 둔 ⛔다(안 주면 ★축 정렬 네 점이 ★항등으로 ★되돌려 ★«튕긴다»).
 *  ★이력 : ★첫 move 에서만 `history: true`(★한 제스처 ★한 걸음 · push-before 규약). */
function _bind(el, tb, name, kind) {
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation(); e.stopPropagation(); e.preventDefault();
    const C0 = ftCornersOf(tb);
    if (!C0) return;
    const scale = _scaleOf(tb);            /* ⛔끌기 «중»에 다시 읽지 않는다(강제 동기 레이아웃) */
    const sx = e.clientX, sy = e.clientY;
    let first = true;

    const onMove = (ev) => {
      const mx = (ev.clientX - sx) / scale, my = (ev.clientY - sy) / scale;
      let C;
      if (kind === 'corner') {
        const i = CORNERS.find((c) => c[0] === name)[1];
        if (ev.shiftKey) {
          /* ⇧ = ★비율 지키기 — ★맞은편을 ★축으로 ★닮게 (★시안 `:669~673` 그대로) */
          const o = C0[(i + 2) % 4];
          const den = (Math.hypot(C0[i][0] - o[0], C0[i][1] - o[1]) ** 2) || 1;
          const k = Math.max(0.2, 1 + (mx * (C0[i][0] - o[0]) + my * (C0[i][1] - o[1])) / den);
          C = C0.map((p) => [o[0] + (p[0] - o[0]) * k, o[1] + (p[1] - o[1]) * k]);
        } else {
          C = C0.map((p) => p.slice());
          C[i] = [C0[i][0] + mx, C0[i][1] + my];     /* ★★모서리 ★하나만 — ★이것이 ★Distort 다 */
        }
      } else {
        /* ★변 — ★★이웃 ★두 모서리를 ★★그 변의 ★법선 쪽으로 ★같이 (★시안 `:680~688` 그대로) */
        const side = EDGEPTS.find((x) => x[0] === name)[1];
        const [, a, b] = EDGES.find((x) => x[0] === side);
        const n = [-(C0[b][1] - C0[a][1]), C0[b][0] - C0[a][0]];
        const L = Math.hypot(n[0], n[1]) || 1;
        const t = (mx * n[0] + my * n[1]) / L / L;
        C = C0.map((p) => p.slice());
        C[a] = [C0[a][0] + n[0] * t, C0[a][1] + n[1] * t];
        C[b] = [C0[b][0] + n[0] * t, C0[b][1] + n[1] * t];
      }
      const r = setFxFreeTransform(tb, C, { history: first, touched: true });
      first = false;
      if (r && r.ok) ftHandlesSync(tb);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/** 문서를 연 뒤·고른 것이 바뀐 뒤 — 걸린 블럭의 손잡이를 ★다시 놓는다(멱등). */
export function ftHandlesSyncAll(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  let n = 0;
  root.querySelectorAll('.text-block[data-tf-corners]').forEach((tb) => { n += ftHandlesSync(tb) > 0 ? 1 : 0; });
  return n;
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ftHandlesSync, ftHandlesClear, ftHandlesSyncAll });
}
