/* ═══════════════════════════════════
   GRID CELL RESIZE — 그리드(듀오) 블록 «셀 경계 드래그»의 순수 계산부 (P2)
   PLAN-gridblock.md §5-B-2. DOM 비의존 — overlay-handles.js가 이 함수만 호출한다.
   (순수함수라 단위테스트 가능. tests/unit/grid-cell-resize.test.mjs)
═══════════════════════════════════ */
//
// ⛔px 를 직접 쓰지 않는다 — 값은 항상 «가중치»(cols[i].width)다. duo-block.js 렌더러가
//   flex:(w/총합*100) 로 쓰므로, 두 인접 열의 가중치 합(W)만 보존하면 다른 열은 안 건드린다.
//
// wL,wR   = 드래그 시작 시점의 두 열 «화면 px 폭»(scale로 나눈 캔버스 px, mousedown 1회 스냅샷)
// W       = 두 열 «가중치 합»(cols[i].width + cols[i+1].width) — 드래그 내내 불변
// deltaPx = mousemove 누적 델타(캔버스 px, scale 이미 나눈 값). 오른쪽(+)이면 경계가 오른쪽으로.
// minPx   = 화면상 최소 열 폭 클램프(기본 40, PLAN 5-B-2)
//
// 반환: { leftWeight, rightWeight } — leftWeight + rightWeight === W (항상, 반올림 오차 없이
//   rightWeight = round(W - leftWeight, 2)로 계산해서 합을 강제한다).
// 두 열의 화면 폭 합이 이미 2*minPx 미만이면(극단으로 좁은 상태) 드래그가 의미 없어 null.
function resizeColBoundary(wL, wR, W, deltaPx, minPx = 40) {
  const total = wL + wR;
  if (!(total >= minPx * 2)) return null;
  let wLNext = wL + deltaPx;
  wLNext = Math.max(minPx, Math.min(total - minPx, wLNext));
  const leftWeight = Math.round((W * wLNext / total) * 100) / 100;
  const rightWeight = Math.round((W - leftWeight) * 100) / 100;
  return { leftWeight, rightWeight };
}

// ═══════════════════════════════════
// 행 경계 드래그 — P1(행 축) 위에 얹는 셀 경계 드래그의 나머지 절반(PLAN §5-B-3).
// 열과 달리 «가중치 합 보존» 제약이 없다 — 행 높이는 3-A 모델에서 각 행이 독립된
// px 최소높이(minmax(px, auto)) 이거나 'auto' 다. 그래서 드래그 대상 행 «하나»만
// 바뀌고 다른 행은 데이터상 아예 손대지 않는다(호출부가 rows[r] 하나만 덮어쓴다).
//
// startPx = 드래그 시작 시점 «행 r»의 화면 px 높이(scale로 나눈 캔버스 px, mousedown 1회
//   스냅샷). ★'auto' 행을 처음 드래그하면 호출부가 «현재 렌더된 높이»를 이 값으로 굳혀서
//   넘긴다(순수함수는 'auto' 문자열 자체를 모른다 — px 변환은 DOM을 아는 overlay-handles.js
//   책임).
// deltaPx = mousemove 누적 델타(캔버스 px, scale 이미 나눈 값). 아래(+)면 행이 커진다.
// minPx/maxPx = 클램프 상하한(기본 24/2000 — PLAN §5-B-3 그대로) — 0/음수 행이 되는 것을 막는다.
//
// 반환: 다음 행 높이(px, 정수 반올림). startPx/deltaPx가 유효한 수가 아니면 null(no-op).
function resizeRowBoundary(startPx, deltaPx, minPx = 24, maxPx = 2000) {
  if (!Number.isFinite(startPx) || !Number.isFinite(deltaPx)) return null;
  const next = startPx + deltaPx;
  return Math.round(Math.max(minPx, Math.min(maxPx, next)));
}

export { resizeColBoundary, resizeRowBoundary };
