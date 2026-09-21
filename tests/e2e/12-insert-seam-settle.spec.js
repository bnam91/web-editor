/* ══════════════════════════════════════════════════════════════════════════
   12-insert-seam-settle — T-131 게이트 C : 「삽입 한 번 = ⌘Z 한 번」을 «실앱»에서 전수로 잰다
   ──────────────────────────────────────────────────────────────────────────
   왜 실앱인가 — 이 결함은 «정착»(rAF / setTimeout / CSSOM 재직렬화)에서 났다. 그건 진짜
   레이아웃이 있어야 돈다. 단위·DOM 하네스는 «약이 제자리에 있는가»만 잴 수 있고,
   「한 번인가 두 번인가」는 여기서만 잰다. (2026-09-21 실측: 확대·목업이 섹션 경계를
   넘게 삽입되면 2였다. 대조 = 섹션 «안쪽» 삽입은 1.)

   ★두 기하를 «짝»으로 돈다 — 안쪽(대조) / 섹션 경계 넘김(결함이 났던 조건).
     한쪽만 돌면 「한 축의 0건」을 「결함 0」으로 읽게 된다.

   ⛔포트·프로필 규율 — helpers.launchApp() 은 9334 하드코딩 + 공용 프로필이라 «쓰지 않는다».
     여기서는 배정 포트(E2E_SEAM_PORT, 기본 9584)와 «격리 프로필»로 띄우고 끝나면 지운다.
     남의 포트(9334·9500·9345 대역)는 건드리지 않는다.

   ⛔부재를 통과로 읽지 않는다 — 입구가 블럭을 «안 만들면» 건너뛰지 말고 실패시킨다.
═══════════════════════════════════════════════════════════════════════════ */
const { test, expect, _electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.E2E_SEAM_PORT || '9584';
const PROFILE = path.join(os.tmpdir(), 'goditor_e2e_seam_' + PORT);

/* 인자가 필요한 입구만 적는다. 나머지는 인자 없이 부른다.
   ⚠️여기 빠져서 «안 만들어지는» 입구가 생기면 테스트가 실패한다 — 조용히 건너뛰지 않는다. */
const ARGS = {
  addDeviceMockupBlock: ['iphone', 200],
  addMockupBlock: ['iphone', 200],
  /* ★검수자가 찾은 다섯째 자리 — 인자 없이 부르면 «텍스트 모양»이 아니라 안 잡힌다.
     내 첫 스윕이 그래서 이 자리를 놓쳤고 검수자는 잡았다. 둘의 «구멍»이 서로 달랐다. */
  addStickerBlock: [{ shape: 'text' }],
};

/* ★«아직 안 고친» 입구 명부 — 지금은 «비어 있다».
 *   2026-09-21 이 스펙이 처음 전수로 쓸어 다섯을 찾았고(addSection · addBanner02Block ·
 *   addCanvasBlock · addComparisonBlock · addStickerBlock({shape:'text'})), 그 다섯은
 *   js/history.js 의 restampHistoryTop + js/insert-history.js 의 _scheduleRestamp 로 닫혔다.
 *
 *   ⛔한 줄이라도 늘면 빨강이다 — 새 입구가 조용히 이 병을 갖고 들어오지 못한다.
 *   ⛔stable:true 인데 «이제 한 번»이면 그것도 빨강이다(죽은 예외 금지).
 *   ★stable 의 뜻은 «판마다 같은 값이 나오는가»다 — 고쳤는지와 무관하다.
 *     addBanner02Block 을 한때 「정착 창이 짧아 생긴 계측기 탓」으로 적었다가 «세 번째 판»에서
 *     다시 나왔다. ⇒ «안 나온다»를 두 판으로 적지 마라. 나온 적이 있으면 «불안정»이지 «없음»이 아니다. */
const KNOWN_TWO_UNDOS = {};

/* 섹션 밖으로 나가 «정착»이 도는 조건을 만드는 높이. 안쪽 대조는 null(기본 높이). */
const GEOMETRIES = [
  { name: '안쪽(대조)', secHeight: null },
  { name: '섹션경계 넘김', secHeight: '70px' },
];

let app, page;

test.beforeAll(async () => {
  fs.mkdirSync(PROFILE, { recursive: true });
  /* 로그인 게이트 — 이 맥의 자격증명을 «격리 프로필»에만 복사하고 끝나면 프로필째 지운다. */
  const src = path.join(os.homedir(), 'Library', 'Application Support', 'GODITOR', 'auth.json');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROFILE, 'auth.json'));

  app = await _electron.launch({
    args: ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
           '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
           '--disable-backgrounding-occluded-windows', 'admin'],
    cwd: process.cwd(),
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('projects.html')) {
    await page.click('#btn-new');
    await page.waitForURL(/index\.html\?project=/, { timeout: 20000 });
  }
  await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 20000 });
});

test.afterAll(async () => {
  if (app) await app.close().catch(() => {});
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) {}
});

test('C0 ★런타임 로스터가 있고, 그 전부가 «감싸져» 있다', async () => {
  const r = await page.evaluate(() => ({
    roster: window.__insertSeamRoster ? window.__insertSeamRoster() : null,
    depth: window.__insertSeamDepth ? window.__insertSeamDepth() : null,
  }));
  expect(r.roster, '★로스터 읽기창이 없다 — 이 스펙이 «안 돈» 것이지 통과가 아니다').toBeTruthy();
  expect(r.roster.length,
    `★로스터가 ${r.roster && r.roster.length}개뿐이다 — 설치가 안 돌았거나 긁기가 죽었다`).toBeGreaterThan(30);
  expect(r.depth, '★재진입 깊이가 0 이 아니다 — 앞선 호출이 새고 있다').toBe(0);

  const unwrapped = await page.evaluate((names) =>
    names.filter(n => typeof window[n] !== 'function' || !window[n].__insertSeamWrapped), r.roster);
  expect(unwrapped, '★설치 뒤 «다시 대입»돼 감싸개가 벗겨진 입구가 있다').toEqual([]);
});

for (const geo of GEOMETRIES) {
  test(`C1 [${geo.name}] 삽입 한 번 = ⌘Z 한 번 — 로스터 전수`, async () => {
    /* 입구 41개 × (정착 + 최대 4회 되돌리기 + 직렬화)라 기본 30초로는 모자란다.
       ⛔줄이려고 정착 창을 깎지 마라 — 그게 이 스펙이 재려는 바로 그 축이다. */
    test.setTimeout(300000);
    const roster = await page.evaluate(() => window.__insertSeamRoster());
    const rows = [];
    for (const name of roster) {
      const row = await page.evaluate(async ({ name, args, secHeight }) => {
        const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const tick = () => new Promise(r => setTimeout(r, 0));
        /* ⚠️정착 창이 짧으면 «느린 입구»가 결함처럼 보인다 — 첫 판에 addBanner02Block 이
           판마다 들락거렸고 그건 계측기 탓이었다. 넓게 잡고, 불안정하면 여기부터 의심해라. */
        const settle = async () => {
          await raf(); await tick(); await raf();
          await new Promise(r => setTimeout(r, 60));
          await raf();
        };
        const canvas = document.getElementById('canvas');
        /* ★계측기 — «id 가 달린 요소의 수»를 센다. 두 번 갈아탄 끝에 고른 것이라 까닭을 남긴다:
             ⑴ 전체 노드 수(querySelectorAll('*')) → 직렬화에 안 실리는 곁가지가 섞인다.
                ai-section-fill 이 MutationObserver 로 붙이는 ✨버튼 탓에 addBanner02Block 이
                undos=null 로 나왔다(같은 조작을 단독으로 밟으면 1번이었다).
             ⑵ 직렬화 문자열 전체 비교 → «너무» 엄격하다. 되돌린 «뒤»에 다시 드리프트가 나서
                41개 전부 null 이 됐다(복원 → Observer 가 또 씀 → 기준선과 영영 안 같다).
           ⇒ 블럭은 전부 id 를 갖고 곁가지는 안 갖는다. 이게 「블럭이 돌아왔나」에 가장 가깝다. */
        const n = () => canvas.querySelectorAll('[id]').length;

        document.querySelectorAll('.section-block').forEach(s => s.remove());
        window.addSection();
        const sec = document.querySelector('.section-block');
        if (secHeight) sec.style.height = secHeight;
        window.selectSection(sec);
        await settle();
        window.clearHistory();
        await settle();

        const before = n();
        let err = null;
        try { window[name].apply(window, args || []); } catch (e) { err = String(e).slice(0, 120); }
        const j1 = window.getSerializedCanvas();
        await settle();
        const j2 = window.getSerializedCanvas();
        const drift = j1 !== j2;
        const driftLen = j2.length - j1.length;
        const made = n() > before;
        if (!made) return { name, made, err, undos: null, drift, driftLen };

        /* ⌘Z 를 «사라질 때까지» 센다 — 두 번이면 정착이 한 칸을 만든 것이다. */
        let undos = 0, back = false;
        for (let i = 0; i < 4 && !back; i++) {
          window.undo(); undos++;
          await settle();
          back = n() === before;
        }
        return { name, made, err, undos: back ? undos : null, drift, driftLen };
      }, { name, args: ARGS[name], secHeight: geo.secHeight });
      rows.push(row);
    }

    /* ⛔「안 만들어졌다」를 조용히 넘기지 않는다 — 인자표가 낡았거나 입구가 죽은 것이다. */
    const notMade = rows.filter(r => !r.made).map(r => `${r.name}${r.err ? ' (' + r.err + ')' : ''}`);
    expect(notMade,
      '★이 입구들이 블럭을 «안 만들었다» — ARGS 표를 고치거나, 죽은 입구면 로스터에서 빼라. ' +
      '부재를 통과로 읽지 않으려고 여기서 실패시킨다').toEqual([]);

    const bad = rows.filter(r => r.undos !== 1);
    const unexpected = bad.filter(r => !(r.name in KNOWN_TWO_UNDOS))
      .map(r => `${r.name}=${r.undos} drift=${r.drift}/${r.driftLen}`);
    expect(unexpected,
      `★새 입구가 「삽입 한 번 ≠ ⌘Z 한 번」으로 들어왔다 [${geo.name}]. ` +
      '원인은 «삽입 직후»와 «정착 뒤»의 문자열이 달라 undo 첫 스텝이 한 칸을 더 만드는 것이다. ' +
      '지금까지 본 갈래 둘 — ⑴값이 rAF 로 늦게 박힌다(약: 비교자가 그 값을 벗긴다) ' +
      '⑵값은 같은데 «표기»가 다시 쓰인다(약: 만든 직후 CSSOM 으로 재운다). ' +
      'js/CLAUDE.md 「히스토리 규약」·tests/unit/insert-seam-settle.test.mjs 를 같이 봐라').toEqual([]);

    /* ⛔죽은 예외 금지 — 명부에 있는데 «이제 한 번»이면 그 줄을 지워야 한다. */
    const badNames = new Set(bad.map(r => r.name));
    const fixedButListed = Object.keys(KNOWN_TWO_UNDOS)
      .filter(n => KNOWN_TWO_UNDOS[n].stable && !badNames.has(n));
    expect(fixedButListed,
      `★명부에 있는데 «이제 한 번»이다 [${geo.name}] — 고쳤으면 KNOWN_TWO_UNDOS 에서 그 줄을 지워라. ` +
      '안 지우면 다음 사람이 「아직 안 고쳤다」로 읽는다').toEqual([]);
  });
}
