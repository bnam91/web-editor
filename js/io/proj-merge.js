/* proj-merge — 저장할 `proj` 객체를 «한 벌»로 만든다. (T-232 ⓑ, 2026-09-27)
 *
 * ★왜 생겼나 — 같은 병합 코드가 «두 벌»이었다(js/io/save-load.js · js/commit-system.js).
 *   ⛔그리고 이미 «갈라져» 있었다 — 한쪽만 `_recovered` 를 뺐다. 그 마커는 「백업에서 복구됐다」는
 *   ★렌더러 통지용이고 「저장에 남기지 않음」이 두 곳에 명시돼 있다(main.js 의 `_recovered: c.from`
 *   주석 「serialize엔 미포함」 · save-load.js 의 `delete proj._recovered` 「메모리/저장에 남기지
 *   않음」). ⇒ 안 빼는 쪽이 결함이었고, 한 벌로 모으면 그 결함이 같이 닫힌다.
 *
 * ★왜 «제3의 모듈»인가 — 한쪽을 다른 쪽에서 import 하면 두 모듈의 «부수효과 실행 순서»가 바뀐다
 *   (index.html 은 commit-system 을 save-load 보다 «먼저» 싣는다). 이 파일은 ⛔부수효과가 0 인
 *   순수 모듈이라 누가 먼저 실려도 같다. ★그리고 순수하니 유닛이 직접 돌릴 수 있다.
 *
 * ⛔키 «순서»를 바꾸지 마라 — 옛 코드의 스프레드 순서(existing → data → id/name/updatedAt)를
 *   그대로 지킨다. JSON 은 삽입 순서로 직렬화되므로 순서를 바꾸면 저장 «바이트»가 달라진다.
 */

/** 저장본(proj.json)에 안 싣는 키 — 이것들은 `_meta.json` 이 관리한다. */
export const PROJ_META_KEYS = ['branches', 'commits', 'currentBranch', 'thumbnail'];

/** `existing` 에서만 «더» 떼는 키 — 런타임 표식이라 저장에 남기지 않는다. */
export const PROJ_RUNTIME_KEYS = ['_recovered'];

/**
 * @param {any} existing  디스크에 있던 판(없으면 null/undefined)
 * @param {any} data      지금 저장하려는 판
 * @param {string} targetId
 * @param {string} [nowIso]  ★인자로 받는다 — 시간을 함수 안에서 읽으면 검사가 못 잰다
 * @returns {object} 저장할 proj
 */
export function buildProjForSave(existing, data, targetId, nowIso) {
  const dropE = new Set([...PROJ_META_KEYS, ...PROJ_RUNTIME_KEYS]);
  const dropD = new Set(PROJ_META_KEYS);
  const proj = {};
  for (const [k, v] of Object.entries(existing || {})) if (!dropE.has(k)) proj[k] = v;
  for (const [k, v] of Object.entries(data || {})) if (!dropD.has(k)) proj[k] = v;
  proj.id = targetId;
  /* ⛔`existing?.name` 을 그대로 옮긴다 — existing 이 객체가 아니면 undefined 가 되어 data 쪽으로
     넘어간다(옛 코드와 같은 뜻). */
  proj.name = (existing && existing.name) || (data && data.name) || 'Untitled';
  proj.updatedAt = nowIso || new Date().toISOString();
  return proj;
}
