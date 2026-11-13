/* _panel-sections — 우측 패널 «절» 판독·판정 공용 부품. (right-panel-unify U0 · §6-1)
 * 정본 표는 js/props/_section-spec.js 를 vm 으로 «읽어» 쓴다(⛔여기 순서표를 베끼지 않는다 — 두 벌은 갈라진다).
 *   loadSectionSpec()     → { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle, OWNERSHIP_EXEMPT, OWNERSHIP_EXEMPT_SCOPES, controlIdent, ownerOf }
 *   readPanel(page)       → 지금 패널의 절 목록(브라우저에서 잰 값 · 컨트롤마다 id·type·data-*·색짝·제외그릇)
 *   judgePanel(list, spec, order?) → 위반 문자열 배열(빈 배열 = 통과). order 를 바꿔 넣으면 양성대조가 된다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { ROOT } = require('./_root-harness.js');
const { rosterOf } = require('./_block-roster-294.js');

/* 로스터 입구 별칭 — 이름 파생(add<클래스>Block)이 실제 입구와 다른 블록. ⛔드물게 · 까닭 한 줄.
   icon-block 은 addIconifyBlock 이 넣는다(addIconBlock 은 없다 · js/block-factory.js window.addIconifyBlock). */
const ENTRY_ALIAS = Object.freeze({ 'icon-block': 'addIconifyBlock' });
/** rosterOf + 별칭 → [{ cls, entry, entryOk }] — entryOk = 그 이름이 window 의 실제 함수인가(별칭 오타도 여기서 거짓). */
async function resolveRoster(page) {
  const roster = (await rosterOf(page)).map((k) => ({ ...k, entry: k.entry || ENTRY_ALIAS[k.cls] || null }));
  const real = await page.evaluate((names) => names.map((n) => !!n && typeof window[n] === 'function'), roster.map((k) => k.entry));
  return roster.map((k, i) => ({ ...k, entryOk: real[i] }));
}

function loadSectionSpec() {
  const src = fs.readFileSync(path.join(ROOT, 'js/props/_section-spec.js'), 'utf8').replace(/^export\s+/gm, '');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src + '\n;globalThis.__S = { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle, OWNERSHIP_EXEMPT, OWNERSHIP_EXEMPT_SCOPES, controlIdent, ownerOf, ownerOfControl, explicitOwnOf };', ctx);
  return ctx.__S;
}

const readPanel = (page, spec = loadSectionSpec()) => page.evaluate((scopes) => {
  const body = document.querySelector('#panel-right .panel-body');
  const secs = [...body.children].filter((e) => e.classList.contains('prop-section')).map((e) => ({
    sec: e.dataset.sec || null,
    isHeader: !!e.querySelector(':scope > .prop-block-label'),
    title: e.querySelector(':scope > .prop-sec-head > .prop-section-title')?.textContent.trim() ?? null,
    labels: [...e.querySelectorAll('.prop-label, .prop-field-label')].map((l) => l.textContent.trim()),
    /* 보이는 컨트롤 수 — 머리 손잡이 포함 · ★접힘(몸 hidden)은 «비었다»가 아니라서 몸 자신의 숨김은 건너뛴다 */
    liveControls: [...e.querySelectorAll('input, select, button, textarea')].filter((c) => {
      for (let n = c; n && n !== e; n = n.parentElement) {
        if (n.classList.contains('prop-sec-body')) continue;
        if (n.hidden || getComputedStyle(n).display === 'none') return false;
      }
      return true;
    }).length,
    /* 소유 판정 재료 — 컨트롤마다 id · type · data-* · 색짝(같은 .prop-color-field 안 · 바로 앞 형제가 색 칸) · 제외 그릇 */
    controls: [...e.querySelectorAll('input, select, button, textarea')].map((c) => {
      const prev = c.previousElementSibling;
      const pair = c.type === 'color' ? null : (c.closest('.prop-color-field')?.querySelector('input[type="color"]')
        || (prev?.matches?.('input[type="color"]') ? prev : prev?.querySelector?.('input[type="color"]')) || null);
      return {
        id: c.id, type: c.type, pairedColor: !!pair, pairId: pair?.id || null,
        fxCard: (() => { const k = c.closest('[id$="-fx-list"]'); return !!k && e.contains(k); })(),   // effects-registry 카드 목록 안(그 효과의 칸)
        itemCard: (() => { const k = c.closest('[data-sec-item], .prop-cell-card, [data-card-index]'); return !!k && e.contains(k); })(),   // 반복 항목 카드(카드 n · 칸 n …)
        own: (() => { const o = c.closest('[data-own]'); return o && e.contains(o) ? o.dataset.own : null; })(),   // 명시 덮어쓰기(같은 절 안 조상 줄까지)
        data: [...c.attributes].filter((a) => a.name.startsWith('data-')).map((a) => [a.name.slice(5), a.value]),
        scope: scopes.find((sid) => document.getElementById(sid)?.contains(c)) || null,
      };
    }),
  }));
  return { secs, hints: body.querySelectorAll('.prop-hint').length };
}, Object.keys(spec.OWNERSHIP_EXEMPT_SCOPES));

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
  const skey = (s) => (s.sec === 'special' ? `special:${s.title}` : s.sec);   // 절 정체 — 블록 고유 절은 제목까지
  const panelKeys = new Set(keyed.map(skey));
  for (const s of keyed) {
    const k = s.sec === 'special' ? `special:${s.title}` : s.sec;
    if (seen.has(k)) bad.push(`중복 절: ${k}`);
    seen.add(k);
    if (s.sec === 'special') { if (!spec.isValidSectionTitle(s.title)) bad.push(`special 제목 규칙 위반: ${s.title}`); }
    else if (s.title !== spec.SECTION_TITLE[s.sec]) bad.push(`제목 불일치: ${s.sec} = 「${s.title}」 (정본 「${spec.SECTION_TITLE[s.sec]}」)`);
    if (s.labels.includes(s.title)) bad.push(`라벨이 절 제목을 되풀이: ${s.title}`);
    if (s.liveControls === 0) bad.push(`빈 머리 절: ${skey(s)} — 보이는 컨트롤 0(렌더러가 그 절을 안 내야 한다)`);
    for (const c of s.controls || []) {   // 소유 — 속성이 제 절에 사는가
      const sc = c.scope && spec.OWNERSHIP_EXEMPT_SCOPES[c.scope];
      const inScope = !!sc && (sc.sec == null || sc.sec === s.sec);   // 그릇이 제 절에 있을 때만 — 엉뚱한 절의 그릇은 판정
      if (inScope || (c.id && c.id in spec.OWNERSHIP_EXEMPT) || (c.pairId && c.pairId in spec.OWNERSHIP_EXEMPT)) continue;
      if (c.itemCard && s.sec === 'content') continue;   // Content 안 반복 항목 카드는 한 항목의 색·크기·글이 한 몸 — 다른 절의 카드는 여전히 판정   // 제외 그릇 «안» · 제외 id · 제외 색 칸의 짝
      const explicit = spec.explicitOwnOf(c);
      if (explicit && !panelKeys.has(explicit)) { bad.push(`data-own 이 이 패널에 없는 절: ${c.id} → ${explicit}`); continue; }
      const own = spec.ownerOfControl(c);   // 명시 ?? fx 카드(effects) ?? 규칙
      if (own && own !== skey(s)) bad.push(`소유 위반: ${c.id || spec.controlIdent(c)} 는 ${own} 절 속성인데 ${skey(s)} 절에 있다`);
    }
  }
  if (hints > 2) bad.push(`prop-hint ${hints}개 > 2`);
  return bad;
}

module.exports = { loadSectionSpec, readPanel, judgePanel, resolveRoster, ENTRY_ALIAS };
