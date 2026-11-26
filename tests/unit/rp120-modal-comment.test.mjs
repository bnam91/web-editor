/* rp120-modal-comment — RP-CLEANUP-HINTS-HEIGHT-COMMENT-01 ⑤(AUDIT O5): prop-modal.js B/I/S/H 배선 주석이 실제와 반대였다
 *   «슬롯 글자는 _esc() 평문 … 부분 선택 서식은 원리적으로 불가» — 지금 슬롯 마크업은 dataset.*Html 을 sanitizeRichTextHtml 로 그린다(modal-block.js _textHtml · 캔버스 ⌘B 부분 서식).
 *   다음 사람이 R2·R3 을 «의도»로 오독하지 않게 — 주석이 «패널 단추 = 슬롯 전체 · 부분 서식 = 캔버스 편집(textHtml)» 을 말한다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'js', 'props', 'prop-modal.js'), 'utf8');
const blk = fs.readFileSync(path.join(ROOT, 'js', 'blocks', 'modal-block.js'), 'utf8');

test('O1 전제 — 모달 슬롯은 부분 서식 마크업을 그린다(textHtml · sanitizeRichTextHtml)', () => {
  assert.match(blk, /function _textHtml\(/);
  assert.match(blk, /sanitizeRichTextHtml/);
});

test('O2 prop-modal B/I/S/H 주석 — «원리적으로 불가» 없음 · textHtml 부분 서식을 가리킨다', () => {
  const at = src.indexOf("['mdl-typo-bold-btn', 'bold']");
  assert.ok(at > 0, 'B/I/S/H 배선을 못 찾았다');
  const head = src.slice(Math.max(0, at - 700), at);
  assert.ok(!/원리적으로 불가/.test(src), '낡은 주석 «원리적으로 불가» 가 남았다');
  assert.match(head, /textHtml/, '주석이 부분 서식 길(textHtml)을 말하지 않는다');
});
