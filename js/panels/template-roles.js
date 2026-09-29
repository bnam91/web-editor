/* 템플릿 «역할» 명부 — head / body / foot / etc  (현빈 2026-09-28)
 *
 * ★왜 별도 파일인가 — 이 명부를 읽는 곳이 «셋»이다:
 *   ⑴ 저장 UI(prop-section.js) 의 역할 select ＋ 추천 태그 칩
 *   ⑵ 템플릿 패널(template-system.js) 의 그룹 제목·차례
 *   ⑶ 옛 자료 이사(legacy category → 역할)
 *   ⛔세 곳에 각자 적으면 한쪽만 늙는다. 이 파일이 단일 진실원이다.
 *
 * ★태그는 «추천»이지 «가둠»이 아니다 — 현빈 지시: "지금처럼 타이핑 할수도 있지만
 *   어떤걸 선택하느냐에 따라서 밑에 태그추천이 뜨게". 그래서 입력칸은 자유 그대로 두고
 *   칩을 «누르면 더해지는» 보조로만 둔다. ⛔칩에 없는 태그를 막지 않는다.
 */
export const TPL_ROLES = [
  { key: 'head', ko: '머리 (head)', tags: ['notice','hero','key_claim','social_proof','brand_story','guarantee','review','cta','etc'] },
  { key: 'body', ko: '본문 (body)', tags: ['pain_point','solution','feature','comparison','visual'] },
  { key: 'foot', ko: '꼬리 (foot)', tags: ['specs','faq','disclamer'] },
  { key: 'etc',  ko: '기타 (etc)',  tags: [] },
];
export const TPL_ROLE_KEYS = TPL_ROLES.map(r => r.key);
export const tplRoleKo   = (k) => (TPL_ROLES.find(r => r.key === k) || {}).ko || k;
export const tplRoleTags = (k) => ((TPL_ROLES.find(r => r.key === k) || {}).tags || []);

/* ★옛 자료 이사 — 저장된 값을 «고쳐 쓰지 않는다»(비가역). 보여줄 때만 역할로 읽는다.
 *   ⛔안 그러면 이미 저장된 템플릿이 패널에서 통째로 사라진다. */
const LEGACY = {
  hero: 'head', main: 'body', feature: 'body', detail: 'body',
  cta: 'head', event: 'head', hook: 'head',
  heading: 'head', graph: 'body', vector: 'body',
};
export function tplRoleOf(category) {
  const raw = String(category || '').trim();
  if (!raw) return 'etc';
  const low = raw.toLowerCase();
  if (TPL_ROLE_KEYS.includes(low)) return low;
  return LEGACY[low] || 'etc';
}
