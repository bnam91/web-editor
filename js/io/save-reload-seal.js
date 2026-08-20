/* ═══════════════════════════════════════════════════════════════════════════
   save-reload-seal.js — 되돌리기/리로드 직전 «autosave 봉인»의 순수 결정 로직 (F4).
   ───────────────────────────────────────────────────────────────────────────
   save-load.js의 cancelPendingAutoSaveForReload가 실제로 호출하고, 단위테스트도 «이 실코드»를
   import 한다(리허설의 손으로 쓴 seal 모델이 아니라). 부수효과·브라우저 의존 0 → Node에서 그대로 import 가능.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * 되돌리기 봉인 시 대기열(_pendingSaves) 정리 — ★«되돌리기 대상 프로젝트»만 제거한다(구멍2 회귀방지).
 * Map은 targetId별 슬롯이므로 전체 clear()하면 탭 전환으로 큐잉된 «다른 프로젝트»의 마지막 편집까지
 * 버려져 그 파일·LS 양쪽에 최신본이 사라진다. targetId만 지우면 타 프로젝트 저장은 정상 드레인된다.
 * targetId가 없으면(방어) 전체 clear로 폴백.
 * @param {Map<string,*>} pendingMap
 * @param {string|null|undefined} targetId
 */
export function clearPendingForReload(pendingMap, targetId) {
  if (!pendingMap || typeof pendingMap.delete !== 'function') return;
  if (targetId) pendingMap.delete(targetId);
  else pendingMap.clear();
}

/**
 * 드레인 완료 판정(구멍1) — in-flight 저장(_isSavingToFile)이 끝났는가.
 * false면 5s 드레인 타임아웃(대형 프로젝트에서 autosave 1회가 5s를 넘길 수 있다)으로 저장이 아직 살아 있다는 뜻.
 * ★호출측(되돌리기 핸들러)은 이 값이 false면 rollback IPC를 «내보내지 말아야» 한다 — 안 그러면 살아있는
 * 저장이 복원본을 재덮고, backup은 이미 unlink돼 복구 지점이 사라진다.
 * @param {boolean} isSaving
 * @returns {boolean} true=완전 정지(되돌리기 안전), false=아직 저장 중(되돌리기 중단해야 함)
 */
export function isDrainSettled(isSaving) { return !isSaving; }
