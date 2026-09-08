/* reflinks-strip-channels.test.js — `data-ref-links` 를 «벗기는 채널»이 몇 곳인가. (BL-SPL-05)
 * 실행: node --test tests/unit/reflinks-strip-channels.test.js
 *
 * ★왜 있나 — js/scratchpad-link.js 머리가 「export(HTML/figma/.gdt) 에서는 strip 한다」고
 *   «주장»했는데, 전수로 재니 실제로 벗기는 곳은 «하나»뿐이었다(2026-09-09).
 *   ⇒ 그건 «안심을 주는 문장»이라 경고 부재보다 나쁘다 — 읽는 사람이 「세 경로 다 처리됨」으로 믿는다.
 *   주석은 사실로 정정했고, 이 파일이 그 사실을 «집행»한다.
 *
 * ⛔이 검사는 「벗겨야 한다」를 주장하지 «않는다». 처분은 아직 안 정해졌다
 *   (「템플릿·.gdt 는 배송인가 저장인가」 — BL-SPL-05 §4, 지디·현빈 판단 대기).
 *   여기가 잠그는 것은 «명부와 문서와 주석이 함께 움직이는가» 하나다.
 *   ⇒ 어느 채널에 strip 이 «생기면» 빨강, «사라져도» 빨강. 그때 셋을 같이 고치라는 뜻이다.
 *
 * ★짝: BL-SPL-03/04 = tests/unit/scratch-paste-dup.test.js
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readSrc, toPosix } = require('./_srcread.js');       // ⛔CRLF — win-portability ①-3
const { stripComments } = require('./_strip-comments.js');   // ⛔주석 거르기는 «정본»만 (자체 구현 금지)

const ROOT = path.join(__dirname, '..', '..');

/** `data-ref-links` 를 «실제로 떼어내는» 문장. 읽기(_parse)나 쓰기(_write)는 아니다. */
const STRIP_RE = /removeAttribute\(\s*['"]data-ref-links['"]\s*\)|delete\s+\w+\.dataset\.refLinks/;

/** js/ · main/ 아래 모든 .js — ⛔「부분집합을 세고 전체를 말하지 마라」. 범위를 코드로 박는다. */
function allJsFiles() {
  const out = [];
  for (const top of ['js', 'main']) {
    const base = path.join(ROOT, top);
    if (!fs.existsSync(base)) continue;
    (function walk(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.js')) out.push(p);
      }
    })(base);
  }
  return out.sort();
}

/* ⛔주석을 «먼저» 걷는다 — 안 걷으면 이 검사가 «자기 설명문»에 걸린다.
     실측(2026-09-09): js/scratchpad-link.js 에 실측 정정 문단을 넣자마자 그 안의
     `removeAttribute('data-ref-links')` 문자열이 「벗기는 채널」로 잡혔다.
   ★거르개는 정본(tests/unit/_strip-comments.js)만 쓴다. 자체 구현하면 따로 늙는다 —
     이 레포에 실제로 거르개가 «둘»이고 서로 «다른» 결함을 갖고 있었다(2026-09-09). */
function strippingChannels(extra = []) {
  const hits = [];
  for (const p of allJsFiles()) {
    if (STRIP_RE.test(stripComments(readSrc(p)))) hits.push(toPosix(path.relative(ROOT, p)));
  }
  for (const { rel, src } of extra) if (STRIP_RE.test(stripComments(src))) hits.push(rel);
  return hits.sort();
}

/* ★명부 = 「오늘 «실제로» 벗기는 곳」이지 「벗겨야 하는 곳」이 아니다.
   ⛔여기 이름을 더해 빨강을 끄지 마라 — 더할 땐 BL-SPL-05 문서와 scratchpad-link.js 주석을 같이 고쳐라. */
const STRIPPING_CHANNELS = ['js/io/export-html.js'];

test('R1 ★전수 — refLinks 를 벗기는 채널이 명부 그대로인가', () => {
  const found = strippingChannels();
  assert.deepEqual(found, STRIPPING_CHANNELS,
    '★refLinks strip 명부가 어긋났다.\n' +
    '  잰 것 : ' + JSON.stringify(found) + '\n' +
    '  적힌 것: ' + JSON.stringify(STRIPPING_CHANNELS) + '\n' +
    '  ⇒ 늘었으면 «처분이 정해졌다»는 뜻이다 — _context/BACKLOG-reflinks-strip-channels.md 와\n' +
    '    js/scratchpad-link.js 머리의 실측 문단을 «같이» 고쳐라(셋이 따로 낡는 게 다음 사고다).\n' +
    '  ⇒ 줄었으면 배송본에 死참조가 실리기 시작했다는 뜻이다.');
});

test('R1a ⛔거르개가 «실제로» 돌고 있다 — 안 돌면 아래 명부가 주석까지 센다', () => {
  /* 양성대조: 주석 «안»의 strip 문장은 세면 안 된다. 그리고 그 문장은 실제로 존재한다
     (js/scratchpad-link.js 의 실측 정정 문단). 거르개가 죽으면 R1 이 그것부터 신고한다. */
  const raw = readSrc(ROOT, 'js', 'scratchpad-link.js');
  assert.ok(STRIP_RE.test(raw), '★전제: 그 파일 «원문»에 strip 문장이 (주석으로) 있어야 이 대조가 성립한다');
  assert.ok(!STRIP_RE.test(stripComments(raw)),
    '★거르개가 안 돌고 있다 — 주석 속 예시 문장이 「벗기는 채널」로 세어져 명부가 거짓 빨강이 된다');
});

test('R1b ★양성대조 — 그 술어가 «실제로» 잡는가 (0건이 「못 재서」가 아니다)', () => {
  const fake = { rel: 'js/__fake__.js', src: "el.removeAttribute('data-ref-links');" };
  const found = strippingChannels([fake]);
  assert.ok(found.includes('js/__fake__.js'),
    '★새 strip 자리를 «못 잡는다» — R1 의 「한 곳」은 「못 재고 있다」와 구분이 안 된다');
  assert.equal(found.length, STRIPPING_CHANNELS.length + 1, '★잡긴 했는데 수가 안 맞는다');
});

test('R1c ★음성대조 — «읽기·쓰기»를 strip 으로 세지 않는다', () => {
  const readers = [
    { rel: 'js/__read__.js',  src: "const v = sec.dataset.refLinks || '';" },
    { rel: 'js/__write__.js', src: "sec.setAttribute('data-ref-links', arr.join(','));" },
    { rel: 'js/__query__.js', src: "root.querySelectorAll('[data-ref-links]').forEach(el => n++);" },
  ];
  const found = strippingChannels(readers);
  assert.deepEqual(found, STRIPPING_CHANNELS,
    '★읽기/쓰기/조회를 «벗기는 것»으로 셌다 — 그러면 명부가 부풀어 아무도 안 본다');
});

test('R2 ★주석이 «사실»을 말하는가 — 안심을 주는 옛 문장이 되살아나지 않았나', () => {
  const src = readSrc(ROOT, 'js', 'scratchpad-link.js');
  /* 옛 문장: 「export(HTML/figma/.gdt) 에서는 refLinks 를 strip 한다」 — 셋을 다 한다고 «주장»했다.
     ⛔그 주장은 실측과 다르다. 사실 문단이 옆에 서 있어야 한다. */
  assert.ok(src.includes('실제로 벗기는 곳은 «하나»뿐이다'),
    '★실측 정정 문단이 사라졌다 — 그러면 머리 주석이 다시 「세 경로 다 한다」로 읽힌다. ' +
    '★사실인 문장은 지우지 말고 «옆에 대비»를 세워라(안심을 주는 문장은 경고 부재보다 나쁘다).');
  assert.ok(src.includes('BACKLOG-reflinks-strip-channels.md'),
    '★티켓을 가리키지 않는다 — 읽는 사람이 「그래서 어쩌라고」에서 멈춘다');
});

test('R3 ★전제 — serializeCleanRoot 는 «선택 마커»는 벗기고 refLinks 는 안 벗긴다', () => {
  /* ⛔지디의 진단(「bn2 마커가 남아 있다 ⇒ 세척을 통째로 안 한다」)을 반증한 자리.
     세척은 꼼꼼하고 refLinks «하나»만 빠졌다 — 두 증상이 아니라 한 증상이다.
     이 단언이 무너지면 BL-SPL-05 §0 의 반증도 같이 무너지므로 여기 박아 둔다. */
  const src = readSrc(ROOT, 'js', 'io', 'section-serialize.js');
  for (const marker of ['bn2-line-selected', 'grd-line-selected', 'cell-selected']) {
    assert.ok(src.includes(`.${marker}`),
      `★serializeCleanRoot 가 ${marker} 를 «안» 벗긴다 — BL-SPL-05 §0 의 반증 전제가 깨졌다`);
  }
  assert.ok(!STRIP_RE.test(src),
    '★serializeCleanRoot 가 refLinks 를 벗기기 시작했다 — 그러면 그건 «처분이 정해졌다»는 뜻이니 ' +
    'R1 명부와 BL-SPL-05 를 같이 고쳐라');
});
