/* U-QABLOCK — admin 전용 QA 체크리스트 블록(js/blocks/qa-block.js) 단위 검사.
 * 실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * 이 파일이 못박는 것:
 *   ⑴ makeQABlock 의 기본값 — items 는 항상 done:false 로 시작한다(사람이 만들 때 강제).
 *   ⑵ updateQABlock 의 검증 — items/feedback/collapsed 각각의 타입 거부 + 정상 커밋.
 *   ⑶ 렌더가 dataset 만으로 재구성된다(재렌더에도 상태가 죽지 않는다).
 *   ⑷ 상태칩 판정(대기중/피드백있음/통과)이 items·feedback 조합으로 정확히 갈린다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { loadQAModule, fakeBlock } = createRequire(import.meta.url)('./_qa-harness.js');
const M = loadQAModule();   // document.getElementById 는 항상 null — 「조회 이전」검증 전용

/* ══ A — makeQABlock 기본값 ═══════════════════════════════════════════════ */

test('A-1 makeQABlock: 기본 dataset이 전부 채워진다 (ticket/title/items/feedback/collapsed)', () => {
  const { block } = M.makeQABlock({ ticket: 'T-020', title: '눈누 기능추가 확인', items: [{ text: '1번' }, { text: '2번' }] });
  assert.equal(block.className, 'qa-block');
  assert.match(block.id, /^qa_/, `id 접두가 qa_ 가 아니다: ${block.id}`);
  assert.equal(block.dataset.type, 'qa');
  assert.equal(block.dataset.ticket, 'T-020');
  assert.equal(block.dataset.title, '눈누 기능추가 확인');
  assert.equal(block.dataset.feedback, '');
  assert.equal(block.dataset.collapsed, 'false');
  assert.deepEqual(JSON.parse(block.dataset.items), [{ text: '1번', done: false }, { text: '2번', done: false }]);
});

test('A-2 ★makeQABlock: items에 done:true를 줘도 «항상» false로 시작한다 (admin 생성 직후는 미완료)', () => {
  const { block } = M.makeQABlock({ items: [{ text: 'x', done: true }] });
  assert.deepEqual(JSON.parse(block.dataset.items), [{ text: 'x', done: false }]);
});

test('A-3 makeQABlock: items 생략/비배열이면 빈 체크리스트로 만들어진다(죽지 않는다)', () => {
  const a = M.makeQABlock({});
  assert.deepEqual(JSON.parse(a.block.dataset.items), []);
  const b = M.makeQABlock({ items: 'not-an-array' });
  assert.deepEqual(JSON.parse(b.block.dataset.items), []);
});

test('A-4 makeQABlock: row가 block을 감싼 .row 래퍼다 (grid-block과 같은 얼개)', () => {
  const { row, block } = M.makeQABlock({ items: [] });
  assert.equal(row.dataset.layout, 'stack');
  assert.match(row.id, /^row_/);
  assert.notEqual(row.id, block.id);
});

/* ══ B — renderQABlock: 순수 렌더 ═══════════════════════════════════════════ */

test('B-1 renderQABlock: 체크리스트 항목 수·완료 표시가 정확하다', () => {
  const b = fakeBlock({ ticket: 'T-1', title: 'Title', items: JSON.stringify([{ text: 'a', done: false }, { text: 'b', done: true }]), feedback: '', collapsed: 'false' });
  M.renderQABlock(b);
  assert.equal((b.innerHTML.match(/class="qa-item(?!-)/g) || []).length, 2, '체크리스트 항목이 2개가 아니다');
  assert.match(b.innerHTML, /qa-item--done/, '완료 항목에 done 클래스가 없다');
  assert.match(b.innerHTML, />b</, '완료 항목의 텍스트가 안 보인다(취소선은 CSS라 텍스트는 그대로 남아야 한다)');
});

test('B-2 renderQABlock: collapsed=true 면 본문(.qa-body)이 아예 안 그려진다', () => {
  const b = fakeBlock({ items: JSON.stringify([{ text: 'x', done: false }]), collapsed: 'true' });
  M.renderQABlock(b);
  assert.doesNotMatch(b.innerHTML, /qa-body/, 'collapsed=true 인데 qa-body 가 그려졌다');
  assert.ok(b.classList.contains('qa-collapsed'), 'qa-collapsed 클래스가 블록에 안 붙었다(쉐브론 회전 근거)');
});

test('B-2b renderQABlock: collapsed=false 면 본문이 그려지고 qa-collapsed 클래스가 없다', () => {
  const b = fakeBlock({ items: JSON.stringify([{ text: 'x', done: false }]), collapsed: 'false' });
  M.renderQABlock(b);
  assert.match(b.innerHTML, /qa-body/);
  assert.equal(b.classList.contains('qa-collapsed'), false);
});

test('B-3 renderQABlock: 진행률 바 — 0/2, 1/2, 2/2 가 각각 0%, 50%, 100%', () => {
  const pct = (items) => {
    const b = fakeBlock({ items: JSON.stringify(items) });
    M.renderQABlock(b);
    return b.innerHTML.match(/qa-progress-fill[^"]*"\s+style="width:(\d+)%"/)[1];
  };
  assert.equal(pct([{ text: 'a', done: false }, { text: 'b', done: false }]), '0');
  assert.equal(pct([{ text: 'a', done: true }, { text: 'b', done: false }]), '50');
  assert.equal(pct([{ text: 'a', done: true }, { text: 'b', done: true }]), '100');
});

test('B-4 renderQABlock: 상태칩 — 빈 목록/미완료=대기중, 피드백 있으면=피드백있음, 전부 완료=통과', () => {
  const status = (items, feedback) => {
    const b = fakeBlock({ items: JSON.stringify(items), feedback: feedback || '' });
    M.renderQABlock(b);
    return b.innerHTML.match(/qa-status--(\w+)/)[1];
  };
  assert.equal(status([], ''), 'wait');
  assert.equal(status([{ text: 'a', done: false }], ''), 'wait');
  assert.equal(status([{ text: 'a', done: false }], '이상 있음'), 'feedback');
  assert.equal(status([{ text: 'a', done: true }], ''), 'pass');
  // ★완료 + 피드백이 동시에 있어도 «통과»가 이긴다 (전부 체크됐다는 사실이 더 중요한 신호)
  assert.equal(status([{ text: 'a', done: true }], '사소한 코멘트'), 'pass');
});

test('B-5 renderQABlock: 항목 텍스트의 HTML이 이스케이프된다 (XSS/레이아웃 파괴 방지)', () => {
  const b = fakeBlock({ items: JSON.stringify([{ text: '<img src=x onerror=alert(1)>', done: false }]) });
  M.renderQABlock(b);
  assert.doesNotMatch(b.innerHTML, /<img/, '항목 텍스트의 태그가 이스케이프 안 됐다');
  assert.match(b.innerHTML, /&lt;img/);
});

test('B-6 renderQABlock: 깨진 items JSON도 빈 체크리스트로 폴백한다(화면이 죽지 않는다)', () => {
  const b = fakeBlock({ items: '{not valid json' });
  assert.doesNotThrow(() => M.renderQABlock(b));
  assert.equal((b.innerHTML.match(/class="qa-item(?!-)/g) || []).length, 0);
});

test('B-7 renderQABlock: 풋터 ID칩이 block.id 를 그대로 보여준다', () => {
  const b = fakeBlock({ items: '[]' });
  b.id = 'qa_abc123';
  M.renderQABlock(b);
  assert.match(b.innerHTML, /class="qa-id-chip"[^>]*>qa_abc123</);
});

test('B-8 renderQABlock: 왕복본(dataset만 JSON 직렬화)도 같은 화면을 낸다', () => {
  const ds = { ticket: 'T-9', title: '왕복', items: JSON.stringify([{ text: 'a', done: true }]), feedback: '코멘트', collapsed: 'false' };
  const live = fakeBlock(ds);
  M.renderQABlock(live);
  const roundTripped = fakeBlock(JSON.parse(JSON.stringify(ds)));
  M.renderQABlock(roundTripped);
  assert.equal(roundTripped.innerHTML.replace(/qa_fake/g, 'ID'), live.innerHTML.replace(/qa_fake/g, 'ID'));
});

/* ══ C — updateQABlock: 「블록 조회 이전」 검증 (하네스 기본 document는 getElementById 가 항상 null) ══ */

test('C-1 updateQABlock: blockId가 없으면 NOT_FOUND (document를 건드리지 않는다)', () => {
  const r = M.updateQABlock('', {});
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_FOUND');
});

test('C-2 updateQABlock: 존재하지 않는 blockId는 NOT_FOUND', () => {
  const r = M.updateQABlock('qa_없음', { feedback: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_FOUND');
});

/* ══ D — updateQABlock: 실물 커밋 경로 (byId로 실제 블록을 등록) ══════════════ */

test('D-1 ★items 정상 커밋 — done 토글이 dataset과 렌더 양쪽에 실제로 반영된다', () => {
  const block = fakeBlock({ ticket: 'T-1', title: 'T', items: JSON.stringify([{ text: 'a', done: false }]), feedback: '', collapsed: 'false' });
  block.classList.add('qa-block');
  const M2 = loadQAModule({ byId: { [block.id]: block } });

  const r = M2.updateQABlock(block.id, { items: [{ text: 'a', done: true }] });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(JSON.parse(block.dataset.items), [{ text: 'a', done: true }]);
  assert.match(block.innerHTML, /qa-item--done/);
  // ★vm 컨텍스트의 객체는 이 realm의 Object와 다른 prototype을 가진다 — JSON 왕복으로 정규화 후 비교.
  assert.deepEqual(JSON.parse(JSON.stringify(r.applied.items)), [{ text: 'a', done: true }]);
});

test('D-2 items 검증: 배열이 아니거나 필드 타입이 틀리면 거부되고 dataset은 그대로다', () => {
  const block = fakeBlock({ items: JSON.stringify([{ text: 'a', done: false }]) });
  block.classList.add('qa-block');
  const M2 = loadQAModule({ byId: { [block.id]: block } });
  const before = block.dataset.items;

  const r1 = M2.updateQABlock(block.id, { items: 'nope' });
  assert.equal(r1.ok, false); assert.equal(r1.code, 'INVALID');
  assert.equal(block.dataset.items, before, 'INVALID인데 dataset이 바뀌었다');

  assert.equal(M2.updateQABlock(block.id, { items: [{ text: 1, done: false }] }).ok, false, 'text가 문자열이 아닌데 받아들였다');
  assert.equal(M2.updateQABlock(block.id, { items: [{ text: 'x', done: 'yes' }] }).ok, false, 'done이 boolean이 아닌데 받아들였다');
  assert.equal(M2.updateQABlock(block.id, { items: [{ text: 'x' }] }).ok, false, 'done이 없는데 받아들였다');
});

test('D-3 feedback 정상 커밋 + 타입 검증 (상태칩이 실제로 바뀐다)', () => {
  const block = fakeBlock({ items: JSON.stringify([{ text: 'a', done: false }]), feedback: '' });
  block.classList.add('qa-block');
  const M2 = loadQAModule({ byId: { [block.id]: block } });

  const r = M2.updateQABlock(block.id, { feedback: '버튼이 안 눌려요' });
  assert.equal(r.ok, true);
  assert.equal(block.dataset.feedback, '버튼이 안 눌려요');
  assert.match(block.innerHTML, /qa-status--feedback/, '피드백을 넣었는데 상태칩이 안 바뀌었다');

  assert.equal(M2.updateQABlock(block.id, { feedback: 123 }).ok, false, 'feedback이 문자열이 아닌데 받아들였다');
});

test('D-4 collapsed 정상 커밋 + 타입 검증 (렌더 결과로 실제로 접히는지 확인)', () => {
  const block = fakeBlock({ items: JSON.stringify([{ text: 'a', done: false }]), collapsed: 'false' });
  block.classList.add('qa-block');
  const M2 = loadQAModule({ byId: { [block.id]: block } });

  const r = M2.updateQABlock(block.id, { collapsed: true });
  assert.equal(r.ok, true);
  assert.doesNotMatch(block.innerHTML, /qa-body/, 'collapsed:true 인데 본문이 남아있다');

  assert.equal(M2.updateQABlock(block.id, { collapsed: 'true' }).ok, false, 'collapsed가 문자열인데 받아들였다(boolean만 허용)');
});

test('D-5 빈 partial / 미인식 필드(ticket 등)는 거부된다', () => {
  const block = fakeBlock({ items: '[]' });
  block.classList.add('qa-block');
  const M2 = loadQAModule({ byId: { [block.id]: block } });

  assert.equal(M2.updateQABlock(block.id, {}).code, 'INVALID');
  assert.equal(M2.updateQABlock(block.id, { ticket: 'T-999' }).ok, false,
    'ticket은 update 대상이 아닌데 받아들였다 — 생성 후 티켓ID를 바꿀 경로는 없어야 한다');
});

test('D-6 qa-block 클래스가 없는 요소는 같은 id라도 NOT_FOUND (다른 블록 타입 오염 방지)', () => {
  const notQA = fakeBlock({});   // classList에 'qa-block'을 안 붙임
  const M2 = loadQAModule({ byId: { [notQA.id]: notQA } });
  const r = M2.updateQABlock(notQA.id, { feedback: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_FOUND');
});
