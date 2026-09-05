/* ═══════════════════════════════════
   GRID CELL RESIZE — 그리드(듀오) 블록 «셀 경계 드래그»의 순수 계산부 (P2)
   PLAN-gridblock.md §5-B-2. DOM 비의존 — overlay-handles.js가 이 함수만 호출한다.
   (순수함수라 단위테스트 가능. tests/unit/grid-cell-resize.test.mjs)
═══════════════════════════════════ */
//
// ⛔px 를 직접 쓰지 않는다 — 값은 항상 «가중치»(cols[i].width)다. grid-block.js 렌더러가
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
/* ★행 높이 상한은 «한 곳»에서 온다. 전엔 4000(패널 input) / 4000(패널 clamp) / 4000(updateGridBlock 검증)
 * / 2000(드래그) 로 «네 자리»에 흩어져 드래그만 2000 에서 멈췄다 — 같은 값이어야 한다.
 * 이 레포가 오늘만 다섯 번 당한 패턴이다(위임목록·저장 화이트리스트·클램프·거터 배선·이것). */
const ROW_H_MAX = 4000;
/* ⚠️ROW_H_MIN 은 «드래그 전용 바닥»이다 — 패널 입력과 API 검증의 하한은 0('auto' 허용)이라
 * 상한(ROW_H_MAX)처럼 전 계층 SSOT 가 «아니다». 일부러 다르다: 데이터로는 0/auto 가 정당하고,
 * 드래그는 손으로 잡을 수 있는 최소 높이가 필요하다. 통일하지 마라 — 통일하면 auto 가 죽는다.
 * (적대검수 G2: 테스트가 이 값을 단언해서 「전 계층이 닫힌 것」처럼 읽히던 것을 여기 명시해 둔다.) */
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
  /* ★가드 경로도 «정상 경로와 같은 클램프»를 지난다. 전엔 상한을 건너뛰어
   * R(5000, 0) = 4000 인데 R(5000, NaN) = 5000 이었다(적대검수 G3) — 델타가 망가졌다고
   * 상한이 풀릴 이유가 없다. 조기 return 이 계약을 깨는 전형이라 오늘만 두 번째다. */
  const d = Number.isFinite(deltaPx) ? deltaPx : 0;
  const h = Number.isFinite(startH) ? startH : minPx;
  return Math.round(Math.max(minPx, Math.min(maxPx, h + d)));
}

export {
  ROW_H_MAX, ROW_H_MIN, COL_MIN_PX, resizeColBoundary, resizeRowHeight };
