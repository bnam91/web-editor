/* _panel-sections — 우측 패널 «절» 판독·판정 공용 부품. (right-panel-unify U0 · §6-1)
 * 정본 표는 js/props/_section-spec.js 를 vm 으로 «읽어» 쓴다(⛔여기 순서표를 베끼지 않는다 — 두 벌은 갈라진다).
 *   loadSectionSpec()     → { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle }
 *   readPanel(page)       → 지금 패널의 절 목록(브라우저에서 잰 값)
 *   judgePanel(list, spec, order?) → 위반 문자열 배열(빈 배열 = 통과). order 를 바꿔 넣으면 양성대조가 된다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./_root-harness.js');

function loadSectionSpec() {
  const src = fs.readFileSync(path.join(ROOT, 'js/props/_section-spec.js'), 'utf8').replace(/^export\s+/gm, '');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + '\n;globalThis.__S = { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle };', ctx);
  return ctx.__S;
}

const readPanel = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const secs = [...body.children].filter((e) => e.classList.contains('prop-section')).map((e) => ({
    sec: e.dataset.sec || null,
    isHeader: !!e.querySelector(':scope > .prop-block-label'),
    title: e.querySelector(':scope > .prop-sec-head > .prop-section-title')?.textContent.trim() ?? null,
    labels: [...e.querySelectorAll('.prop-label, .prop-field-label')].map((l) => l.textContent.trim()),
  }));
  return { secs, hints: body.querySelectorAll('.prop-hint').length };
});

function judgePanel(panel, spec, order = spec.SECTION_ORDER) {
  const bad = [];
  const { secs, hints } = panel;
  const keyed = secs.filter((s) => s.sec);
  if (!keyed.length) bad.push('data-sec 절이 0개 — 틀을 안 거쳤거나 패널이 비었다');
  secs.forEach((s, i) => { if (!s.sec && !(i === 0 && s.isHeader)) bad.push(`머리 없는 절 #${i} — header(맨 앞 블록 머리)만 허용`); });
  const idx = keyed.map((s) => order.indexOf(s.sec));
  if (idx.some((v) => v < 0)) bad.push(`모르는 key: ${keyed.filter((s, i) => idx[i] < 0).map((s) => s.sec)}`);
  for (let i = 1; i < idx.length; i++) if (idx[i] < idx[i - 1]) bad.push(`순서 위반: ${keyed[i - 1].sec} 뒤에 ${keyed[i].sec}`);
  const seen = new Set();
  for (const s of keyed) {
    const k = s.sec === 'special' ? `special:${s.title}` : s.sec;
    if (seen.has(k)) bad.push(`중복 절: ${k}`);
    seen.add(k);
    if (s.sec === 'special') { if (!spec.isValidSectionTitle(s.title)) bad.push(`special 제목 규칙 위반: ${s.title}`); }
    else if (s.title !== spec.SECTION_TITLE[s.sec]) bad.push(`제목 불일치: ${s.sec} = 「${s.title}」 (정본 「${spec.SECTION_TITLE[s.sec]}」)`);
    if (s.labels.includes(s.title)) bad.push(`라벨이 절 제목을 되풀이: ${s.title}`);
  }
  if (hints > 2) bad.push(`prop-hint ${hints}개 > 2`);
  return bad;
}

module.exports = { loadSectionSpec, readPanel, judgePanel };
