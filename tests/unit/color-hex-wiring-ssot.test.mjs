/* 색 코드 칸의 «배선 한 자리» 게이트 — 2026-09-21 (유닛 colorhex 픽스 라운드)
 *
 * ★왜 이 검사가 생겼나
 *   0920 유닛 colorhex 는 「검증→적용→커밋→blur 복원」이 열 벌 넘게 손복사돼 있던 걸
 *   color-picker.js 의 wireHexText 한 자리로 모았다. 그런데 «남은 손사본 8곳»을 사람이
 *   손으로 센 목록이 보고서와 docs/styleguide.html 에 그대로 적혔고, 그 숫자가 틀렸다
 *   (실측 grep 과 안 맞았다). 손목록은 늘 낡는다 — 그래서 숫자를 «기계»가 센다.
 *
 *   ⛔이 검사가 빨강이면 「목록을 고치는」 게 답이 아니다. 새 색칸을 wireHexText 로 배선하거나,
 *     정말 예외라면 아래 화이트리스트에 «사유와 함께» 적어라.
 *
 * 두 축을 잰다(둘은 서로 다른 병이다):
 *   A) 배선  — `…-hex` 칸에 직접 addEventListener 를 다는 곳이 색-picker 밖에 있나
 *   B) 표기  — 색 코드 칸의 maxlength 가 정본 문법 밖의 수인가
 *              (7 = 6자리 hex[# 선택] · 11 = 그 + `transparent` 키워드. 그 밖은 규칙 분열이다)
 *   되돌리면 빨강: index.html 의 page-bg-hex 를 maxlength="6" 으로 되돌리면 B 가,
 *                  prop-grid.js 의 cHex 배선을 손사본으로 되돌리면 A 가 잡는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* 배선을 «만드는» 자리 — 여기 말고는 색칸에 리스너를 직접 달지 않는다. */
const WIRING_HOME = new Set(['js/props/color-picker.js']);

/* 의도적 예외(사유 필수). 비어 있는 게 정상이다 — 늘어나면 규약이 다시 갈라지는 중이라는 뜻. */
const WIRING_ALLOW = new Map([
  // 'js/xxx.js': '사유',
]);

/* maxlength 예외(사유 필수) — 색 «코드» 칸이 아닌 것만. */
const LEN_ALLOW = new Map([
  // 'index.html:123': '사유',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const JS_FILES = walk(path.join(ROOT, 'js'))
  .filter((p) => p.endsWith('.js'))
  .map((p) => path.relative(ROOT, p));

test('A) 색 코드 칸의 리스너는 wireHexText 한 자리에서만 달린다', () => {
  const offenders = [];
  for (const rel of JS_FILES) {
    if (WIRING_HOME.has(rel) || WIRING_ALLOW.has(rel)) continue;
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const lines = src.split('\n');

    /* ① `const x = document.getElementById('…-hex')` 꼴로 잡힌 변수 이름을 모은다.
          id 가 템플릿/연결식이어도 끝이 `-hex` 면 같이 잡는다(`id + '-hex'`, `` `${p}-color-hex` ``). */
    const vars = new Set();
    const decl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*(?:getElementById|querySelector)\s*\(\s*[^;\n]*-hex['"`]/g;
    let m;
    while ((m = decl.exec(src))) vars.add(m[1]);

    /* ② 그 변수(또는 인라인 셀렉터)에 리스너를 다는 줄 */
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      /* «검증·적용·커밋·복원»을 하는 이벤트만 본다. focus/mousedown 등은 다른 관심사다
         (예: prop-text-wireup-text-edit 의 focus = 캐럿 선택영역 보존 — 색 규칙과 무관). */
      const evt = /addEventListener\s*\(\s*['"](input|change|blur|keydown)['"]/.exec(L);
      if (!evt) continue;
      const inline = /(?:getElementById|querySelector)\s*\([^)]*-hex['"`][^)]*\)\s*\??\.\s*addEventListener/.test(L);
      const named = [...vars].some((v) => new RegExp(`\\b${v}\\s*\\??\\.\\s*addEventListener`).test(L));
      if (inline || named) offenders.push(`${rel}:${i + 1}: ${L.trim().slice(0, 110)}`);
    }
  }
  assert.deepEqual(offenders, [],
    '색 코드 칸에 «손으로» 리스너를 달았다 — 그 사본은 곧 규칙이 어긋난다(무효값 침묵·blur 복원 없음이 그렇게 생겼다).\n' +
    '  wireHexText(el, { parse, format, getCurrent, onApply, onCommit }) 로 배선하라.\n' +
    offenders.map((o) => '  · ' + o).join('\n'));
});

test('B) 색 코드 칸의 maxlength 는 정본 문법(7 · 11) 밖으로 안 나간다', () => {
  const files = ['index.html', ...JS_FILES];
  const bad = [];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const L = lines[i];
      /* 색 «코드» 칸인지 — 판정은 «id 가 -hex 로 끝나는 input» 이다.
         ⚠️`class="prop-color-hex"` 로 재면 오탐이다 — 그 클래스는 이 레포에서 「작은 텍스트 칸」
           공용 스킨으로도 쓰인다(chb-fontsize·icn-preset-save-input·bubble-sender-name-input…).
           «클래스 = 색칸»으로 읽으면 색과 무관한 칸에 maxlength 를 강요하게 된다.
         ⚠️자유형식 배경칸(cvb-text-bg-raw / -top-raw)은 id 가 `-raw` 라 여기 안 걸린다 —
           그 칸의 «문법»은 6자리 hex 가 아니라 자유 CSS 다(길이 상한이 규칙이 아니다). */
      const isHexField = (/<input\b/.test(L) && (/id="[^"]*-hex"/.test(L) || /id="[^"]*\$\{[^}]*\}[^"]*-hex"/.test(L)))
        || /data-el="(?:hex|gradStopHex)"/.test(L)
        || /class="[^"]*\b(?:ds-token-hex|grad-stop-hex)\b/.test(L);
      if (!isHexField) continue;
      const ml = /maxlength="(\d+)"/.exec(L);
      const key = `${rel}:${i + 1}`;
      if (LEN_ALLOW.has(key)) continue;
      if (!ml) { bad.push(`${key}: maxlength 가 «없다» — ${L.trim().slice(0, 90)}`); continue; }
      if (ml[1] !== '7' && ml[1] !== '11') bad.push(`${key}: maxlength=${ml[1]} — ${L.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(bad, [],
    '색 코드 칸의 표기 규칙이 갈라졌다 — 7(6자리 hex, # 붙여 붙여넣기 허용) 또는 11(+ `transparent`)만 쓴다.\n' +
    '  ★maxlength=6 은 `#00FF00` 의 «7번째 글자를 잘라» 무효값으로 만든다(2026-09-20 신고 그대로).\n' +
    bad.map((o) => '  · ' + o).join('\n'));
});
