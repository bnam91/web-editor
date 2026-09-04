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
/* ★행 높이 상한은 «한 곳»에서 온다. 전엔 4000(패널 input) / 4000(패널 clamp) / 4000(updateDuoBlock 검증)
 * / 2000(드래그) 로 «네 자리»에 흩어져 드래그만 2000 에서 멈췄다 — 같은 값이어야 한다.
 * 이 레포가 오늘만 다섯 번 당한 패턴이다(위임목록·저장 화이트리스트·클램프·거터 배선·이것). */
const ROW_H_MAX = 4000;
const ROW_H_MIN = 24;
const COL_MIN_PX = 40;   // 열 경계 드래그의 화면상 최소 열 폭. 호출부가 리터럴로 덮어쓰지 않는다.

function resizeColBoundary(wL, wR, W, deltaPx, minPx = COL_MIN_PX) {
  // ★NaN 가드 — 행 쪽엔 있고 열 쪽엔 없어 «비대칭»이었다(적대검수 지적).
  //   NaN 이 가중치에 들어가면 JSON 직렬화에서 null 이 돼 «비율이 사라진다».
  // ⚠️여기서 «px»(wL,wR)을 그대로 돌려주면 안 된다 — 반환 계약은 «가중치»(leftWeight/rightWeight)고
  //   호출부는 r.leftWeight 를 읽는다. px 를 돌려주면 키가 없어 undefined→width 소실이었다.
  //   델타를 0 으로 본 것과 같게 «현재 비율 그대로»를 돌려준다(합 보존 계약도 지킨다).
  if (!Number.isFinite(deltaPx)) deltaPx = 0;
  const total = wL + wR;
  if (!(total >= minPx * 2)) return null;
  let wLNext = wL + deltaPx;
  wLNext = Math.max(minPx, Math.min(total - minPx, wLNext));
  const leftWeight = Math.round((W * wLNext / total) * 100) / 100;
  const rightWeight = Math.round((W - leftWeight) * 100) / 100;
  return { leftWeight, rightWeight };
}

// ── 행 경계 드래그 (P1 병합 후 신설) ──────────────────────────────────────
// 열과 다르다 — 행 높이는 «가중치»가 아니라 «px 최소높이»(P1 R2 모델, PLAN §3-A U5a 의미론).
// 경계 r|r+1 을 끌면 «위» 행(rows[r])의 높이만 바뀐다 — 아래 행은 손대지 않는다(재분배 없음,
// PLAN §5-B-3 "행 «가중치» 재분배는 없다"). startH 는 mousedown 시점 실제 렌더 높이(px, scale로
// 나눈 값) — 'auto' 행도 「지금 화면에 보이는 높이」에서 드래그를 시작한다.
function resizeRowHeight(startH, deltaPx, minPx = ROW_H_MIN, maxPx = ROW_H_MAX) {
  if (!Number.isFinite(deltaPx) || !Number.isFinite(startH)) return Math.round(Math.max(minPx, Number(startH) || minPx));
  return Math.round(Math.max(minPx, Math.min(maxPx, startH + deltaPx)));
}

export {
  ROW_H_MAX, ROW_H_MIN, COL_MIN_PX, resizeColBoundary, resizeRowHeight };
