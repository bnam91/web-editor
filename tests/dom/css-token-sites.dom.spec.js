/* css-token-sites — ★`css-token-lint` 가 ★토큰으로 갈아 놓은 ★자리의 ★«그려진 값»을 잰다.
 *
 * ══ 무엇을 ★단언하나 — ⛔「돈다」가 아니라 ★«이 property 가 ★이 값이다» ═══════════
 *   #rp-height-total            ★borderTopLeftRadius ＝ ★6px   (토큰 --ui-radius-md)
 *   .grb-data-item              ★rowGap              ＝ ★4px   (토큰 --ui-row-gap)
 *   .fxpart-chip-del            ★fontSize            ＝ ★9px   (토큰 --ui-fs-9)
 *   #grd-plus-layer>.grd-add-btn ★fontSize           ＝ ★20px  (토큰 --ui-fs-20)
 *   ＋ `css/report-modal.css` 가 쓰는 ★--ui-fs-base  ＝ ★11px  (옛 `var(--ui-fs-11, 11px)` 8곳)
 *
 * ══ ★왜 이 자가 ★필요한가 — ★소스로는 ★못 보는 칸이 ★하나 남는다 ══════════════════
 *   `tests/unit/css-token-lint.test.mjs` 의 ★치환 잠금 셋은 ★전부 ★«소스 등식»이다:
 *     ⑴ 토큰 값 == 바꾸기 전 리터럴  ⑵ 정의가 1곳  ⑶ index.html 이 둘을 같이 읽는다.
 *   ★그 셋이 ★다 참인데도 ★토큰이 ★«그 문서에서» ★안 풀리면 — `var()` 는 ★무효가 되고
 *   ★그 property 는 ★상속/초기값으로 ★떨어진다 ⇒ ★★치환이 ★조용히 ★무효가 된다.
 *   ★그 자리는 ★★코드가 ★「무관해야 정상」까지만 말하는 자리다 ⇒ ★★행위로 재야 닫힌다.
 *
 * ══ ★무엇으로 재나 ═══════════════════════════════════════════════════════════
 *   ★앱을 ★안 띄운다 — `bootApp`(= index.html 통째)을 ★headless chromium 에.
 *   (dom config 머리말: 「⛔앱을 안 띄운다 — 고디터 인스턴스·MCP 9345 대역 ★무접촉」)
 *   ⇒ ★9410(현빈 앱) ★무접촉 규약과 ★안 부딪친다.
 *
 * ══ ★★대조 — ⛔㉡ 없이 만든 자는 ★안 받는다 (지디 조건) ════════════════════════
 *   ★전제  네 토큰이 ★그 문서에서 ★풀린다        ⛔안 풀리면 아래가 ★0건짜리 초록
 *   ★㉡양성 토큰을 ★안 풀리게 하면 ★그 값이 ★달라지나  ⇒ ★이 자가 ★토큰을 재고 있다
 *          (★`--ui-*` 를 ★빈 값으로 ⇒ `var()` 무효. ⛔CSS 파일은 ★안 고친다 — 인라인만)
 *   ★㉢음성 ★무관한 토큰을 바꾸면 ★이 네 값이 ★안 변하나 ⇒ ★아무것에나 반응하지 않는다
 *
 * ══ ★무엇을 ★안 재나 (⛔이 칸을 지우지 마라) ══════════════════════════════════
 *   ⒜ ★«앱이 ★그 꼴을 ★만드나» — 선택자가 ★문서에 없으면 ★element 를 ★손으로 심는다.
 *      ⛔「없다」를 ★「통과」로 ★접지 않되, ★심었다는 사실을 ★단언 메시지에 ★싣는다.
 *      ⇒ ★그 자리는 ★그 블록·패널을 ★여는 ★다른 spec 의 몫이다.
 *   ⒝ ★사람 눈에 ★예쁜가 · ★라이트 테마(이 앱에 ★없다 — design-tokens.css 머리말 실측).
 *   ⒞ ★`--ui-fs-base` 를 ★쓰는 ★8곳의 ★자리 자체 — ★그 파일은 ★모달이라 ★이 하네스에서
 *      ★안 열린다. ⇒ ★토큰 ★값만 잰다(그 8곳은 `tests/unit` 의 ★발견 잠금 ②③ 이 지킨다).
 */
'use strict';
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* ★want 는 ★«바꾸기 전 리터럴»이다 — ⛔토큰 값을 ★되받지 않는다(그러면 항등식). */
const SITES = [
  { sel: '#rp-height-total', prop: 'borderTopLeftRadius', want: '6px', token: '--ui-radius-md' },
  { sel: '.grb-data-item', prop: 'rowGap', want: '4px', token: '--ui-row-gap' },
  { sel: '.fxpart-chip-del', prop: 'fontSize', want: '9px', token: '--ui-fs-9' },
  { sel: '#grd-plus-layer > .grd-add-btn', prop: 'fontSize', want: '20px', token: '--ui-fs-20' },
];
/* ★치환은 아니지만 ★같은 뿌리(=없는 토큰 이름 8곳 고침)가 ★매달린 토큰 */
const EXTRA_TOKEN = { token: '--ui-fs-base', want: '11px', why: 'css/report-modal.css 8곳 (옛 var(--ui-fs-11, 11px))' };
/* ㉢ 음성대조에 쓸 ★무관한 토큰 — ★위 네 자리와 ★아무 상관이 없다 */
const UNRELATED = { token: '--ui-bg-input', bogus: '#ff00ff' };

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1400, height: 900 });
  await bootApp(page);
  /* 선택자가 없으면 ★같은 규칙이 맞는 element 를 심고 ★그 사실을 돌려준다 */
  const made = await page.evaluate((sels) => {
    const mk = {
      '#rp-height-total': () => { const e = document.createElement('div'); e.id = 'rp-height-total'; document.body.appendChild(e); return e; },
      '.grb-data-item': () => { const e = document.createElement('div'); e.className = 'grb-data-item'; document.body.appendChild(e); return e; },
      '.fxpart-chip-del': () => {
        const w = document.createElement('div'); w.className = 'fxpart-chip-wrap';
        const e = document.createElement('button'); e.className = 'fxpart-chip-del';
        w.appendChild(e); document.body.appendChild(w); return e;
      },
      '#grd-plus-layer > .grd-add-btn': () => {
        let L = document.getElementById('grd-plus-layer');
        if (!L) { L = document.createElement('div'); L.id = 'grd-plus-layer'; document.body.appendChild(L); }
        const e = document.createElement('button'); e.className = 'grd-add-btn'; L.appendChild(e); return e;
      },
    };
    const out = {};
    for (const s of sels) {
      let el = document.querySelector(s);
      out[s] = !el;                       // true = 손으로 심었다
      if (!el) el = mk[s]();
      el.setAttribute('data-cts', s);
    }
    return out;
  }, SITES.map((s) => s.sel));
  return { errs, made };
}

const readSites = (sites) => sites.map((s) => {
  const el = document.querySelector(`[data-cts="${s.sel}"]`);
  return el ? getComputedStyle(el)[s.prop] : null;
});

test('CTS1 전제 — 네 토큰 ＋ --ui-fs-base 가 ★그 문서에서 ★풀린다 (안 풀리면 아래가 0건짜리)', async ({ page }) => {
  await boot(page);
  const toks = await page.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    const o = {};
    for (const n of names) o[n] = cs.getPropertyValue(n).trim();
    return o;
  }, [...SITES.map((s) => s.token), EXTRA_TOKEN.token]);
  for (const s of SITES) {
    expect(toks[s.token], `★${s.token} 이 ★이 문서에서 ${JSON.stringify(toks[s.token])} 다`
      + ' — ★안 풀리면 var() 가 ★무효가 되고 그 property 가 ★상속으로 떨어진다').toBe(s.want);
  }
  expect(toks[EXTRA_TOKEN.token], `★${EXTRA_TOKEN.token} (${EXTRA_TOKEN.why})`).toBe(EXTRA_TOKEN.want);
});

test('CTS2 ㉠ — ★그려진 값이 ★«바꾸기 전 리터럴»과 같다 (property 이름으로 단언)', async ({ page }) => {
  const { errs, made } = await boot(page);
  const got = await page.evaluate(readSites, SITES);
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i];
    expect(got[i], `★${s.sel} 의 ★${s.prop} = ${got[i]} (기대 ${s.want} · 토큰 ${s.token})`
      + (made[s.sel] ? '  ⚠️이 element 는 ★손으로 심었다 — ★«앱이 그 꼴을 만드나»는 ★안 쟀다' : ''))
      .toBe(s.want);
  }
  expect(errs, `★pageerror: ${errs.slice(0, 2).join(' | ')}`).toHaveLength(0);
});

test('CTS3 ㉡ 양성 — 토큰을 ★안 풀리게 하면 ★그 값이 ★달라진다 (⇒ 이 자가 ★토큰을 잰다)', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(readSites, SITES);
  /* ★CSS 파일은 ★안 고친다 — ★인라인으로 ★빈 값을 덮어 `var()` 를 ★무효로 만든다 */
  const after = await page.evaluate((sites) => {
    for (const s of sites) document.documentElement.style.setProperty(s.token, ' ');
    return sites.map((s) => {
      const el = document.querySelector(`[data-cts="${s.sel}"]`);
      return el ? getComputedStyle(el)[s.prop] : null;
    });
  }, SITES);
  for (let i = 0; i < SITES.length; i++) {
    const s = SITES[i];
    expect(after[i], `★${s.token} 을 ★안 풀리게 했는데 ★${s.sel} 의 ★${s.prop} 가`
      + ` ${before[i]} → ${after[i]} 로 ★안 변했다`
      + ' — ⛔그러면 CTS2 의 초록은 ★토큰을 ★안 재고 있다(★박힌 리터럴을 재는 것과 구분 안 된다)')
      .not.toBe(before[i]);
  }
});

test('CTS4 ㉢ 음성 — ★무관한 토큰을 바꾸면 ★이 네 값은 ★안 변한다 (⇒ 아무것에나 반응하지 않는다)', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(readSites, SITES);
  const after = await page.evaluate(({ sites, un }) => {
    document.documentElement.style.setProperty(un.token, un.bogus);
    return sites.map((s) => {
      const el = document.querySelector(`[data-cts="${s.sel}"]`);
      return el ? getComputedStyle(el)[s.prop] : null;
    });
  }, { sites: SITES, un: UNRELATED });
  /* ★전제 — 그 무관한 토큰이 ★정말 바뀌었나(⛔안 바뀌면 이 음성대조는 ★0건짜리) */
  const un = await page.evaluate((t) => getComputedStyle(document.documentElement).getPropertyValue(t).trim(), UNRELATED.token);
  expect(un, `★전제: ${UNRELATED.token} 을 바꿨는데 ${un} 다 — 이 음성대조가 ★아무것도 안 했다`).toBe(UNRELATED.bogus);
  for (let i = 0; i < SITES.length; i++) {
    expect(after[i], `★${UNRELATED.token} 을 바꿨더니 ★${SITES[i].sel} 의 ★${SITES[i].prop} 가`
      + ` ${before[i]} → ${after[i]} 로 ★변했다 — 이 자가 ★무관한 것에 반응한다`).toBe(before[i]);
  }
});
