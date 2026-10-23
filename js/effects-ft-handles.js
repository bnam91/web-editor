/* effects-ft-handles — 글상자 ★자유변형 ★U3 «모서리 손잡이» (2026-10-24 · 지디 · 현빈 GO 「바로 시작하고」)
 *   발주 : ~/.gd-work/team-lead/ORDER-u3-handles-261023.md (★갈래 A — 「그대로 둬라」)
 *   정본 : js/effects-freetransform.js — ★이 파일은 ★그 모듈의 ★«문 하나»만 부른다.
 *
 * ★★★이 파일이 ★«하지 않는» 것 — ★그게 ★설계의 ★몸통이다:
 *   ⛔제 상태를 ★안 ★들고 있다 — ★네 점은 `tb.dataset.tfCorners` 가 ★정본이고
 *     ★잰 값(`W H OX OY`)은 `ftStateOf(tb)` 가 ★정본이다(★WeakMap).
 *   ⛔`matrix3d` 를 ★안 ★만든다 — ★그리기는 `applyFxFreeTransform` 하나뿐이다.
 *   ⛔`js/fx/homography.js` 를 ★안 ★열었다(★U2-SCOPE 금지선 · text-freetransform.dom.spec.js:859).
 *   ⛔글자 속성(font-size·letter-spacing·transform:scale)으로 ★안 ★굳힌다(★발주 ② — ★1회성 굳힘 금지).
 *
 * ★★왜 ★모서리 ★«넷»뿐인가 — ★★실측으로 ★선 ★한계다(⛔내 ★판단이 ★아니다):
 *   `js/fx/homography.js:22` `homography(src, dst)` 가 ★★`for (let i = 0; i < 4; i++)` 다.
 *   ⇒ ★★4점 ★호모그래피는 ★★«변이 ★휘는 것»을 ★★담지 ★못한다(★평행 아닌 ★사다리꼴까지만).
 *   ⇒ ★★그러므로 ★발주의 「★변의 1/3·2/3 ★여덟」은 ★★두 뜻 중 ★하나여야 ★한다:
 *       ⒜ ★끌면 ★이웃 ★두 모서리를 ★같이 ★민다(= ★변 ★전체를 ★민다)  ⇒ ★4점 모델로 ★된다
 *       ⒝ ★★변이 ★휜다(★Warp)                                    ⇒ ★★★메시가 ★필요하다
 *          ⇒ ★`homography.js`(금지선)를 ★열고 ★U1 의 ★15칸을 ★다시 ★세워야 ★한다(★발주 ④⒤ 가 ★그 비용을 ★적었다)
 *   ★★★⇒ ⛔그 ★갈림은 ★★현빈 ★칸이다. ★★★지어내지 ★않았다 — ★올려 ★물었다(261024).
 *   ⇒ ★그 답이 ★오면 ★여기에 ★여덟을 ★더한다. ★그때까지 ★★넷으로 ★★«끌 수 ★있다»가 ★선다.
 *
 * ★이름 `tfh-` 를 고른 까닭(실측 261024): ⛔`ft-` 는 ★임자가 있다 —
 *   `projects-onescreen` 의 폴더 타일(`.ft-tile`·`.ft-add`·`.ft-sub` · ★레포 48건).
 *   `tfh-`·`tfc-`·`tform-`·`distort-`·`tfgrid` = ★0건(★양성대조 `ft-tile` 48 ⇒ 자가 산다).
 * ★그 두 이름은 ★`beea5848` 에서 ★★명부 ★쌍(정본 ＋ serializeCleanRoot)에 ★먼저 ★올렸다 —
 *   ⇒ ★저장본·PNG·썸네일·단독 HTML 로 ★★안 ★샌다(`EXPORT-SELECTED-HANDLE-BAKED-IN-01`).
 *   ★그 쌍이 ★정말 ★묶였나 : ★직렬에서만 ★빼면 ★★`R1` 이 ★fail 1(★변이로 ★확인했다).
 */
import { ftCornersOf, ftStateOf, setFxFreeTransform, applyFxFreeTransform } from './effects-freetransform.js';
import { normalizeCorners } from './fx/homography.js';   /* ★읽기만 — ⛔고치지 않는다 */

/** 모서리 넷의 순서 — `tfCorners` 의 저장 순서 그대로(nw·ne·se·sw · 발주 ②). */
const CORNERS = [
  { i: 0, id: 'nw', cursor: 'nwse-resize' },
  { i: 1, id: 'ne', cursor: 'nesw-resize' },
  { i: 2, id: 'se', cursor: 'nwse-resize' },
  { i: 3, id: 'sw', cursor: 'nesw-resize' },
];

/** 캔버스 실제 배율 — ⛔`window.currentZoom` 을 ★가정하지 않고 ★잰다(정본 `_scaleOf` 와 ★같은 자).
 *  ★까닭: 끌기 델타는 ★화면 px 로 오고 ★네 점은 ★모델 px 다 ⇒ ★나눠야 ★한다.
 *  ⛔`--inv-zoom` 은 ★손잡이 ★«크기»만 되돌린다(CSS) — ★델타에는 ★안 쓴다. */
function _scaleOf(el) {
  const ow = el && el.offsetWidth;
  if (!ow) return 1;
  const z = el.getBoundingClientRect().width / ow;
  return Number.isFinite(z) && z > 0.01 ? z : 1;
}

/** 이 블럭의 손잡이·격자를 ★걷는다 — ★`:scope >` 로 ★제 것만(★관용구: gradient-select.js:26). */
export function ftHandlesClear(tb) {
  if (!tb || !tb.querySelectorAll) return 0;
  const els = tb.querySelectorAll(':scope > .tfh-handle, :scope > .tfh-grid');
  els.forEach((h) => h.remove());
  return els.length;
}

/** 손잡이가 ★떠야 하나 — ★`tfCorners` 가 ★있고 ★그 블럭이 ★골라져 ★있을 때.
 *  ⛔「카드가 열렸나」로 ★가르지 ★않는다 — ★카드는 ★접힐 수 있고 ★그때도 ★끌 수 ★있어야 ★한다(발주 ①). */
function _shouldShow(tb) {
  return !!(tb && tb.dataset && tb.dataset.tfCorners
    && tb.classList && tb.classList.contains('selected'));
}

/** 손잡이·격자를 ★놓는다(없으면 만들고, 있으면 ★자리만 옮긴다 · ★멱등).
 *  ★돌려주는 것: 놓은 손잡이 수(안 떠야 하면 0).
 *  ★자리 계산 — ★정본이 그리는 식과 ★같은 자를 쓴다:
 *    `applyFxFreeTransform` 이 ★`normalizeCorners(C).D` 로 호모그래피를 풀고
 *    ★`transformOrigin = OX px OY px` 를 ★글자칸에 건다
 *    ⇒ ★모서리 `D[i]` 는 ★블럭 좌표에서 ★`(OX + x, OY + y)` 에 ★보인다. */
export function ftHandlesSync(tb) {
  if (!_shouldShow(tb)) { ftHandlesClear(tb); return 0; }
  const C = ftCornersOf(tb);
  const st = ftStateOf(tb);
  if (!C || !st) { ftHandlesClear(tb); return 0; }
  const { D } = normalizeCorners(C);

  /* ★격자 — ★글자칸과 ★같은 행렬을 ★타는 ★네모 하나. ⛔제 행렬을 ★만들지 않고 ★베낀다
     (★두 벌이 되면 ★한쪽이 ★늙는다 — `editor-ui-roster.js` 머리말이 ★그 까닭을 적었다). */
  let grid = tb.querySelector(':scope > .tfh-grid');
  if (!grid) { grid = document.createElement('div'); grid.className = 'tfh-grid'; tb.appendChild(grid); }
  const ce = tb.querySelector('[contenteditable]')
    || tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner,.itb-text');
  grid.style.width = st.W + 'px';
  grid.style.height = st.H + 'px';
  grid.style.left = st.OX + 'px';
  grid.style.top = st.OY + 'px';
  grid.style.transform = ce ? (ce.style.transform || '') : '';
  grid.style.transformOrigin = '0px 0px';

  let n = 0;
  CORNERS.forEach(({ i, id, cursor }) => {
    let h = tb.querySelector(`:scope > .tfh-handle[data-tfh="${id}"]`);
    if (!h) {
      h = document.createElement('div');
      h.className = 'tfh-handle';
      h.dataset.tfh = id;
      h.style.cursor = cursor;
      tb.appendChild(h);
      _bindDrag(h, tb, i);
    }
    h.style.left = (st.OX + D[i][0]) + 'px';
    h.style.top = (st.OY + D[i][1]) + 'px';
    n++;
  });
  return n;
}

/** 한 모서리를 끈다 — ★★«바꾸는 문 하나»(`setFxFreeTransform`)로만 간다.
 *  ★이력: 한 제스처 한 걸음 ⇒ ★첫 mousemove 에서만 `history: true`(정본 규약 「push-before」).
 *  ★`touched: true` — ⛔정본이 ★그렇게 ★적었다: 「가르는 자는 `touched` 하나다 · ⛔«꼴»로 가르지 마라」
 *    (★안 주면 ★축 정렬로 줄이기만 한 네 점이 ★바탕 네모로 읽혀 ★다음 렌더가 ★항등으로 되돌린다
 *     = ★손잡이가 ★«튕긴다» · 정본이 261023 무력화 대조로 ★그 함정을 먼저 닫아 뒀다). */
function _bindDrag(handle, tb, idx) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const C0 = ftCornersOf(tb);
    if (!C0) return;
    /* ⛔끌기 «중»에 다시 읽지 않는다 — 쓰기 직후 읽기는 ★강제 동기 레이아웃이다
       (★관용구: gradient-select.js 의 「드래그 시작 시 1회만 읽는다」 주석). */
    const scale = _scaleOf(tb);
    const sx = e.clientX, sy = e.clientY;
    let first = true;

    const onMove = (ev) => {
      const dx = (ev.clientX - sx) / scale;
      const dy = (ev.clientY - sy) / scale;
      const C = C0.map((p) => [p[0], p[1]]);
      C[idx] = [C0[idx][0] + dx, C0[idx][1] + dy];
      const r = setFxFreeTransform(tb, C, { history: first, touched: true });
      first = false;
      /* ★못 풀면(네 점이 한 줄·겹침) 정본이 ★그리지 않는다 — ★그때는 손잡이도 ★안 옮긴다. */
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

/** 문서를 연 뒤·고른 것이 바뀐 뒤 — 걸린 블럭의 손잡이를 ★다시 놓는다(멱등).
 *  ⛔제 load 리스너를 ★따로 달지 않는다 — ★부르는 쪽(editor 선택 흐름 · 정본 watchAll)이 ★부른다. */
export function ftHandlesSyncAll(root = document) {
  if (!root || !root.querySelectorAll) return 0;
  let n = 0;
  root.querySelectorAll('.text-block[data-tf-corners]').forEach((tb) => { n += ftHandlesSync(tb) > 0 ? 1 : 0; });
  return n;
}

if (typeof window !== 'undefined') {
  Object.assign(window, { ftHandlesSync, ftHandlesClear, ftHandlesSyncAll });
}
