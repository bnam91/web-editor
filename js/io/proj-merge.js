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
/** «평범한 객체»인가 — 문자열·배열·null 을 가른다. ⛔`typeof x === 'object'` 만 보면 배열·null 이 통과한다. */
function _isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function buildProjForSave(existing, data, targetId, nowIso) {
  const dropE = new Set([...PROJ_META_KEYS, ...PROJ_RUNTIME_KEYS]);
  const dropD = new Set(PROJ_META_KEYS);
  const proj = {};
  /* ★★[T-232 ⓑ②] `existing` 이 «객체가 아니면» 바탕을 비운다 — 둘째 방어선이다.
     ⛔`Object.entries('proj_1775704460431')` 는 `[['0','p'],['1','r'],…]` 가 된다. 그렇게 펼쳐진
       파일이 실제로 디스크에 있었다(`undefined.json`, 2026-07-14). 첫 방어선은 그 문자열이
       «오는 길»을 끊은 것이고(main.js projects:load 의 isProjectShaped 가드), 이것은 그래도
       다른 문(localStorage·다른 IPC)으로 들어올 때를 막는다.
     ★`existing` 은 «덮여도 되는 바탕»이라 비워도 데이터가 안 사라진다 — `data` 가 그 위에 얹힌다. */
  const base = _isPlainObject(existing) ? existing : {};
  /* ⛔`data` 는 «비우지 않는다» — 그건 저장할 내용 자체라, 조용히 비우면 «빈 프로젝트로 덮는»
     데이터 손실이 된다. 대신 «드러낸다»(조용한 실패 금지). 호출 계약 위반이므로 고칠 곳은 부르는 쪽이다. */
  if (data != null && !_isPlainObject(data)) {
    try { console.warn('[proj-merge] data 가 객체가 아니다 — 저장 내용이 비어 나갈 수 있다:', typeof data); } catch (_) {}
  }
  for (const [k, v] of Object.entries(base)) if (!dropE.has(k)) proj[k] = v;
  for (const [k, v] of Object.entries(_isPlainObject(data) ? data : {})) if (!dropD.has(k)) proj[k] = v;
  proj.id = targetId;
  /* ⛔옛 코드의 `existing?.name || data.name || 'Untitled'` 와 «같은 뜻»이다 — existing 이 객체가
     아니면 `.name` 이 undefined 라 data 쪽으로 넘어간다(그래서 base 로 바꿔도 결과가 같다). */
  proj.name = base.name || (_isPlainObject(data) && data.name) || 'Untitled';
  proj.updatedAt = nowIso || new Date().toISOString();
  return proj;
}
