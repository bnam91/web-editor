/* ══════════════════════════════════════════════════════════════════════════
   filename-modal-escape — T-049 후속 : 파일명 모달이 «사용자 글자»를 틀에 안 끼운다
   ──────────────────────────────────────────────────────────────────────────
   무슨 자리인가 — `showFilenameModal(defaultName)` 이 `overlay.innerHTML` 안에
   `value="${defaultName}"` 로 값을 끼우고 있었다. 그 값의 출처는
   `window.currentFileName || window.getProjectName?.()` 라, «사용자가 정한 글자»가
   HTML 속성 자리로 흘러들었다. (2026-09-21 dev fd8f85d 기준 재측정에서 «여전히 열림» 확인)

   ★고친 모양은 이 파일이 «이미 쓰던» 것이다 — 빈 칸을 만들고 값으로 채운다
     (:147 `<span class="cm-project"></span>` + :172 `.textContent = projectName`).
     새 이스케이프 헬퍼를 만들지 않았다. 레포에 이미 넷이 따로 있어서(section-protection ·
     badge-transform · settings-modal · import-figma-json) 다섯째를 더하면 정본이 더 흐려진다.

   ⛔이 파일은 «소스 모양»만 잰다. 행동(모달을 열어 글자가 글자로 남나)은 실앱에서 따로 쟀고,
     그 결과는 카드에 적혀 있다 — 여기 초록을 «행동까지 봤다»로 읽지 마라.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'js', 'commit-system.js'), 'utf8');

/* ★주석을 걷고 «코드만» 잰다.
   안 걷었더니 이 고침의 «설명 주석»(옛 모양을 인용한 줄)이 스스로 빨강을 냈다 —
   검사가 자기 문서를 결함으로 읽은 것이다. 산문은 코드가 아니다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** 틀(innerHTML/insertAdjacentHTML) 안에 «보간»이 들어간 속성 자리를 찾는다. */
const ATTR_INTERP = /\b(value|title|placeholder|alt|href|src)\s*=\s*"\$\{/g;

test('FN-1 파일명 모달이 value 를 «틀에 끼우지» 않는다', () => {
  const i = SRC.indexOf('function showFilenameModal');
  assert.ok(i > 0, '★showFilenameModal 을 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  const body = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10) + 1 || undefined);
  assert.ok(/id="filename-modal-input"/.test(body), '★입력칸 자리를 못 찾았다 — 검사가 안 돈 것이다');
  assert.doesNotMatch(body, /id="filename-modal-input"[^>]*value\s*=\s*"\$\{/,
    '★value="${…}" 가 돌아왔다 — 사용자 글자가 HTML 속성 자리로 흘러든다. ' +
    '빈 칸으로 두고 .value 로 채워라(:147/:172 가 같은 방식이다)');
});

test('FN-2 대신 «값으로» 채운다 (부재를 통과로 읽지 않는다)', () => {
  assert.match(SRC, /input\.value\s*=/,
    '★.value 대입이 없다 — value= 를 지우기만 하고 채우지 않으면 기본 파일명이 사라진다');
});

test('FN-3 ★이 파일 전체에 «틀 안 속성 보간»이 없다', () => {
  const hits = [...CODE.matchAll(ATTR_INTERP)].map(m => m[1] + ' = "${…}"');
  assert.deepEqual(hits, [],
    '★틀 안 속성 자리에 보간이 있다 — 그 값이 «사용자 글자»면 T-049 와 같은 자리다. ' +
    '빈 칸 + 값 대입(.value/.textContent)으로 바꿔라');
});

test('FN-4 ★음성대조 — 이 검사가 «옛 모양»을 실제로 잡는가', () => {
  /* 화석을 베끼지 않는다 — 지금 소스에서 옛 모양을 «되돌린» 변형본을 만든다. */
  const mutated = CODE.replace('<input id="filename-modal-input" type="text"',
                              '<input id="filename-modal-input" type="text" value="${defaultName}"');
  assert.notEqual(mutated, CODE, '★변환이 늙었다 — 입력칸 자리를 못 찾아 변형본이 원본과 같다');
  assert.match(mutated, /id="filename-modal-input"[^>]*value\s*=\s*"\$\{/,
    '★변형본에 옛 모양이 안 들어갔다 — FN-1 의 초록이 «검사처럼 생긴 문장»일 수 있다');
  assert.ok([...mutated.matchAll(ATTR_INTERP)].length > 0,
    '★FN-3 의 정규식이 옛 모양을 못 잡는다 — 그 초록은 «없어서»가 아니라 «못 봐서»다');
});
