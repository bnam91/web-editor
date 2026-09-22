/* ══════════════════════════════════════════════════════════════════════════
   14-undo-depth — «동작 K개를 ⌘Z K번에 처음까지 내려오는가»를 재는 그물 (증상 축)

   ══ 왜 이 그물이 따로 있나 ═══════════════════════════════════════════════
   2026-09-22, 되돌리기가 «전면 무동작»이 됐는데 npm test 3,023건 · npm run test:dom 1,060건이
   «전부 초록»이었다. 4,083건이 사용자가 제일 먼저 알아챌 고장을 한 건도 안 잡았다.
   뿌리는 「id 없는 .row 가 복원마다 새 id 를 받는다」였고, 그 «원인»은 정적 그물(W-s)이 잠갔다.
   ⛔그런데 원인 축만 잠그면 «다른 길로 같은 증상»이 오는 날 못 잡는다 — 그날 고리가 넷이었고
     앞의 셋은 조용했다. 넷째가 들어오자 전면이 됐다.
   ⇒ 이 그물은 «원인을 모른 채» 증상만 잰다: **K번 눌러 처음까지 내려오는가.**

   ══ 재는 양 ════════════════════════════════════════════════════════════════
   D1 깊이   — 동작 K개 → ⌘Z 를 눌러 «시작 지문»에 닿기까지 몇 번 걸렸나. K 여야 한다.
               · K보다 «적으면» 한 칸이 두 동작을 먹었다   · K보다 «많으면» 빈 칸이 꼈다
               · 영영 못 닿으면 복원이 «멱등»이 아니다(2026-09-22 의 그 고장이 이 모양이었다)
   D2 ⌘⇧Z   — ⌘Z «직후»에 한 편집이 ⌘⇧Z 한 번에 «되살릴 길 없이» 날아가는가.
               ㉠(push-before 가 무변화 차단에 먹히는 자리)의 «두 번째 얼굴»이다.

   ══ 지문 — ★정규화를 «제대로» 한다 ════════════════════════════════════════
   ⚠️tests/e2e/_undo-family-harness.js 의 unit() 은 끝에서 `\s+ → ' '` 만 해서 태그 사이 공백이
     «한 칸으로» 남는다 ⇒ `> <` 와 `><` 가 «다른 글자»가 되고, 재직렬화에서 공백만 달라져도
     「바뀌었다」로 센다(그 판의 U3 「먹통 칸 0」이 그래서 «못 믿을 초록»이다).
   ⇒ 여기서는 **`>\s+<` → `><`** 로 «지운 뒤» 비교한다. D0 이 그 정규화 자체를 양쪽으로 잰다.
   ⛔그래도 «UI 크롬»은 벗긴다 — 섹션 툴바·draggable·--sec-clip 은 앱 자신도 «내용 아님»으로
     다룬다(js/history.js _CHROME_RE·_NON_EDIT_ATTR_RE · js/market-merge.js · js/version-diff.js).

   ══ 공용 손 ════════════════════════════════════════════════════════════════
   ★«세 번째 벌»을 만들지 않는다 — playwright 갈래이므로
     · 앱 띄우기 = tests/e2e/helpers.js 의 launchIsolated(격리 프로필 + 뿌리 확인)
     · 브라우저 안의 손(settle·realClick·dblClick·setNum·pick·board·byId)
       = tests/e2e/_undo-family-harness.js 를 «그대로» 얹어 쓴다(⛔한 글자도 안 고친다).
   ⚠️그래서 그 하네스의 «손» 표면에 기대고 있다. D0 이 그 표면을 먼저 확인한다 —
     하네스를 다시 쓰면서 이름이 바뀌면 «조용히 안 재는» 게 아니라 D0 이 빨개진다.
   ⛔하네스의 fp()/diff()/same() 은 «안 쓴다» — 위 정규화 구멍이 거기 있다.

   실행: E2E_DEPTH_PORT=9539 E2E_DEPTH_PROFILE=/tmp/ud-9539 \
         npx playwright test tests/e2e/14-undo-depth.spec.js --config=playwright.config.js
════════════════════════════════════════════════════════════════════════════ */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchIsolated } = require('./helpers.js');

const PORT    = process.env.E2E_DEPTH_PORT || '9529';
const PROFILE = process.env.E2E_DEPTH_PROFILE || path.join(os.tmpdir(), 'goditor_e2e_depth_' + PORT);
const HAND    = fs.readFileSync(path.join(__dirname, '_undo-family-harness.js'), 'utf8');

let app, page;
const R = { hand: null, norm: null, ladders: null, redo: null };

test.beforeAll(async () => {
  test.setTimeout(600000);
  app = await launchIsolated({ port: PORT, profile: PROFILE, cwd: path.join(__dirname, '..', '..') });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  if (page.url().includes('projects.html')) {
    await page.click('#btn-new');
    await page.waitForURL(/index\.html\?project=/, { timeout: 30000 });
  }
  await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 30000 });
  /* ⛔창이 뒤에 있으면 화면 갱신이 멈춰 «값이 안 바뀐 것처럼» 보인다 — 포커스는 «뺏지 않고» 푼다. */
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await cdp.send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});

  await page.evaluate(HAND);
  await page.evaluate(INSTALL_DEPTH);

  R.hand    = await page.evaluate(() => window.__UD.handSurface());
  R.norm    = await page.evaluate(() => window.__UD.normSelfCheck());
  R.ladders = await page.evaluate(() => window.__UD.runLadders());
  R.redo    = await page.evaluate(() => window.__UD.runRedoAxis());
});

test.afterAll(async () => {
  if (app) await app.close().catch(() => {});
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) {}
});

/* ── 브라우저 안에 얹는 얇은 층 ───────────────────────────────────────────── */
function INSTALL_DEPTH() {
  const U = window.__UF;
  /* ★정규화 — 「무엇이 «내용»인가」를 내가 짓지 않는다. 앱 자신이 이미 «내용 아님»으로
     다루는 셋만 벗기고(js/history.js _CHROME_RE·_NON_EDIT_ATTR_RE), 그 위에 태그 사이
     공백을 «지운다». ⛔공백을 «한 칸으로» 남기면 `> <` 와 `><` 가 갈려 거짓 빨강·거짓 초록이
     둘 다 난다(_undo-family-harness.js 의 알려진 구멍). */
  function norm(html) {
    return String(html == null ? '' : html)
      .replace(/<div class="section-toolbar">[\s\S]*?<\/div>/g, '')
      .replace(/ draggable="(?:true|false)"/g, '')
      .replace(/--sec-clip:[^;"]*;?/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const shot = () => norm(window.getSerializedCanvas());
  const pos  = () => window.getHistoryTip().pos;

  /* ⛔「손」이 있는지부터 — 하네스를 다시 쓰다 이름이 바뀌면 «조용히 안 재는» 대신 여기서 빨개진다. */
  function handSurface() {
    const need = ['settle', 'realClick', 'dblClick', 'setNum', 'pick', 'board', 'byId'];
    const missing = need.filter(k => !U || typeof U[k] !== 'function');
    return { missing, has: need.filter(k => U && typeof U[k] === 'function') };
  }

  /* ★정규화 자체의 양성·음성 대조 — 「내 자가 실제로 그 일을 하는가」. */
  function normSelfCheck() {
    return {
      spaceIgnored:  norm('<b>x</b> <i>y</i>') === norm('<b>x</b><i>y</i>'),
      newlineIgnored: norm('<b>x</b>\n  <i>y</i>') === norm('<b>x</b><i>y</i>'),
      /* ⛔너무 벗기면 «진짜 변화»까지 못 본다 — 반대쪽도 같이 잰다. */
      textSeen:      norm('<b>x</b>') !== norm('<b>y</b>'),
      attrSeen:      norm('<b s="1">x</b>') !== norm('<b s="2">x</b>'),
      /* 태그 «안»의 글자 사이 공백은 내용이다 — 지워지면 안 된다(한 칸으로만 줄어든다). */
      innerSpaceKept: norm('<b>a  b</b>') === '<b>a b</b>' && norm('<b>ab</b>') !== norm('<b>a b</b>'),
    };
  }

  /* 사다리 하나 — 동작 K개를 «실경로»로 밟고, ⌘Z 로 시작 지문까지 내려온다. */
  async function ladder(name, steps) {
    const start = shot();
    const notes = [];
    for (const s of steps) {
      const before = shot();
      const ret = await s.run();
      await U.settle(s.wait || 400);
      notes.push({ name: s.name, ret: ret === undefined ? null : ret, changed: shot() !== before });
    }
    const end = shot();
    let undos = 0, reached = false;
    const walk = [];
    /* K+3 번까지만 — 안 닿으면 «영영 안 닿는» 것이다(복원이 멱등이 아닌 모양). */
    for (let i = 0; i < steps.length + 3; i++) {
      const p0 = pos();
      window.undo();
      await U.settle(400);
      undos++;
      const now = shot();
      walk.push({ i, pos: p0 + '→' + pos(), sameAsStart: now === start });
      if (now === start) { reached = true; break; }
    }
    return { name, notes, steps: steps.length, undos, reached, walk,
             movedAtAll: end !== start };
  }

  async function runLadders() {
    const out = {};

    /* ── L1 정렬 단추(㉠ 이 고친 자리) + 숫자칸 ── */
    {
      const sid = await U.board(false);
      const tb = U.byId(sid).querySelector('.text-block');
      out.L1 = await ladder('L1 텍스트(정렬·크기)', [
        { name: '①정렬단추', run: async () => { await U.pick(tb.id);
            const b = [...document.querySelectorAll('#panel-right .prop-align-btn')].find(x => x.dataset.align && !x.classList.contains('active'));
            return U.realClick(b); } },
        { name: '②글자크기44', run: async () => { await U.pick(tb.id); return U.setNum('txt-size-number', 44); } },
        { name: '③정렬단추2', run: async () => { await U.pick(tb.id);
            const b = [...document.querySelectorAll('#panel-right .prop-align-btn')].find(x => x.dataset.align && !x.classList.contains('active'));
            return U.realClick(b); } },
      ]);
    }

    /* ── L2 스텝 블럭 — 2026-09-22 의 «전면 무동작»이 난 바로 그 모양 ── */
    {
      const sid = await U.board(false); let bid = null;
      out.L2 = await ladder('L2 스텝', [
        { name: '①스텝추가', wait: 500, run: async () => {
            window.selectSection(U.byId(sid)); await U.settle(250);
            window.addStepBlock(); await U.settle(450);
            bid = document.querySelector('.step-block')?.id; return bid || 'no-step'; } },
        { name: '②스텝추가단추', wait: 500, run: async () => { await U.pick(bid);
            return U.realClick(document.getElementById('stb-add-step')); } },
        { name: '③설명편집', wait: 500, run: async () => {
            const b = U.byId(bid); const t = b && (b.querySelector('.stb-desc') || b.querySelector('.stb-title'));
            if (!t) return 'no-target';
            const dc = U.dblClick(t); if (dc !== true) return dc;
            await U.settle(200);
            t.textContent = '설명바뀜ABC'; t.dispatchEvent(new Event('input', { bubbles: true })); t.blur();
            return true; } },
      ]);
    }

    /* ── L3 월계수 — «줄 추가/줄 순서 변경»(T-135 형제 뒤집기가 걸린 자리) ── */
    {
      const sid = await U.board(false); let lid = null;
      out.L3 = await ladder('L3 월계수(줄 추가·순서)', [
        { name: '①월계수추가', wait: 550, run: async () => {
            window.selectSection(U.byId(sid)); await U.settle(250);
            if (typeof window.addLaurelBlock !== 'function') return 'no-entry';
            window.addLaurelBlock(); await U.settle(500);
            lid = document.querySelector('.laurel-block')?.id; return lid || 'no-laurel'; } },
        { name: '②줄추가', wait: 550, run: async () => { await U.pick(lid); await U.settle(250);
            const b = document.querySelector('#panel-right .lrl-line-add');
            return b ? U.realClick(b) : 'no-btn'; } },
        { name: '③줄순서변경', wait: 550, run: async () => { await U.pick(lid); await U.settle(250);
            /* 줄 카드가 접혀 있으면 ↑ 가 0×0 이다 — «사용자와 같은 경로»로 편다. */
            const toggles = [...document.querySelectorAll('#panel-right .lrl-line-toggle')];
            for (const t of toggles) { if (t.getAttribute('aria-expanded') !== 'true') U.realClick(t); }
            await U.settle(300);
            const ups = [...document.querySelectorAll('#panel-right .lrl-line-up')];
            const up = ups[ups.length - 1];
            return up ? U.realClick(up) : 'no-btn'; } },
      ]);
    }
    return out;
  }

  /* ── D2 ⌘⇧Z 축 ────────────────────────────────────────────────────────
     ⌘Z «직후»의 편집은 «죽은 미래»(redo 꼬리) 옆에 놓인다. 그 편집이 스택에 한 번도 안 찍히면
     ⌘⇧Z 한 번이 그것을 덮어쓰고 «되살릴 표본이 없다». ㉠ 의 두 번째 얼굴이다. */
  async function runRedoAxis() {
    const sid = await U.board(false);
    const tb = U.byId(sid).querySelector('.text-block');
    await U.pick(tb.id);
    window.clearHistory(); await U.settle(250);
    const s0 = shot();
    U.setNum('txt-size-number', 33); await U.settle(400);      // push-after 편집
    const s1 = shot();
    window.undo(); await U.settle(450);                        // ⌘Z — 여기서 redo 꼬리가 생긴다
    const s2 = shot();
    await U.pick(tb.id); await U.settle(200);
    const btn = [...document.querySelectorAll('#panel-right .prop-align-btn')].find(x => x.dataset.align && !x.classList.contains('active'));
    const clicked = U.realClick(btn); await U.settle(450);     // ⌘Z «직후»의 편집
    const s3 = shot();
    window.redo(); await U.settle(450);                        // ⌘⇧Z
    const s4 = shot();
    /* 한 번 더 ⌘⇧Z/⌘Z 로도 못 돌아오면 «되살릴 길이 없다». */
    window.redo(); await U.settle(400);
    const s5 = shot();
    window.undo(); await U.settle(400);
    const s6 = shot();
    return {
      clicked,
      undoWorked: s2 === s0,            // ⌘Z 가 제 일을 했나(전제)
      editChanged: s3 !== s2,           // 편집이 캔버스를 바꿨나(전제)
      keptAfterRedo: s4 === s3,         // ★⌘⇧Z 가 그 편집을 «안» 날렸나
      recoverable: s4 === s3 || s5 === s3 || s6 === s3,   // 날아갔어도 되찾을 길이 있나
      wentToStale: s4 === s1,           // 죽은 미래로 갔나(증상의 이름)
    };
  }

  window.__UD = { norm, shot, pos, handSurface, normSelfCheck, runLadders, runRedoAxis };
}

/* ── 판정 ──────────────────────────────────────────────────────────────── */
const show = o => JSON.stringify(o, null, 1);
const LADDERS = ['L1', 'L2', 'L3'];

test('D0 ★계측기 자체 점검 — 손이 있고, 정규화가 «양쪽»으로 맞나', () => {
  expect(R.hand.missing,
    `★공용 손(tests/e2e/_undo-family-harness.js)의 표면이 바뀌었다 — 이 그물이 «조용히 안 재는» 대신 여기서 멈춘다.\n${show(R.hand)}`).toEqual([]);
  const n = R.norm;
  /* 양성대조 — 「공백만 다른 두 문자열이 «같아지는가»」. 이게 거짓이면 D1·D2 의 모든 빨강이 무의미하다. */
  expect(n.spaceIgnored,   `★태그 사이 공백이 «안» 지워진다 — \`> <\` 와 \`><\` 가 갈려 거짓 빨강이 난다\n${show(n)}`).toBe(true);
  expect(n.newlineIgnored, `★줄바꿈+들여쓰기가 «안» 지워진다\n${show(n)}`).toBe(true);
  /* 음성대조 — 「너무 벗겨서 진짜 변화까지 못 보는가」. 한쪽만 재면 반대쪽에서 속는다. */
  expect(n.textSeen,       `★글자가 바뀐 것을 «못» 본다 — 너무 벗겼다\n${show(n)}`).toBe(true);
  expect(n.attrSeen,       `★속성이 바뀐 것을 «못» 본다 — 너무 벗겼다\n${show(n)}`).toBe(true);
  expect(n.innerSpaceKept, `★태그 «안»의 공백까지 지웠다 — 글자 사이 공백은 내용이다\n${show(n)}`).toBe(true);
});

test('D0b ★사다리가 실제로 «동작»을 밟았나 — 부재를 통과로 읽지 않는다', () => {
  const notRun = [];
  for (const k of LADDERS) for (const n of R.ladders[k].notes) {
    if (n.ret === false || (typeof n.ret === 'string' && /^(no-|zero-size|covered-by)/.test(n.ret))) notRun.push(`${k}/${n.name}=${n.ret}`);
    if (!n.changed) notRun.push(`${k}/${n.name}: 캔버스가 «안» 바뀜(동작이 안 먹었다)`);
  }
  expect(notRun,
    '★동작이 «안 일어났다» — 그 자리의 깊이 값은 결함이 아니라 계측 실패다. ' +
    `입구 이름·단추 id 가 바뀌었는지 먼저 봐라.\n${show(R.ladders)}`).toEqual([]);
});

for (const k of LADDERS) {
  test(`D1 [${k}] ★동작 K개를 ⌘Z K번에 «처음»까지 내려온다`, () => {
    const L = R.ladders[k];
    expect(L.movedAtAll, `★${L.name}: 동작 K개를 했는데 캔버스가 시작과 같다 — 깊이를 말할 수 없다`).toBe(true);
    expect(L.reached,
      `★${L.name}: ⌘Z ${L.undos}번으로도 «처음»까지 못 내려왔다 — 되돌릴 수 없는 편집이 있거나 복원이 «멱등»이 아니다.\n` +
      '기전 둘(실측으로 갈라라): ⑴ 어떤 동작이 칸을 «안» 만들었다(push-before 가 무변화 차단에 먹힘) ' +
      '⑵ 복원이 DOM 을 또 고쳐 라이브가 꼭대기와 «영영» 달라진다(2026-09-22 의 id 없는 .row 가 그 모양이었다).\n' +
      `${show(L)}`).toBe(true);
    expect(L.undos,
      `★${L.name}: 동작 ${L.steps}개를 ⌘Z ${L.undos}번에 풀었다 — ` +
      '적으면 한 칸이 둘을 먹은 것이고, 많으면 빈 칸(먹통 칸)이 낀 것이다.\n' +
      `${show(L)}`).toBe(L.steps);
  });
}

test('D2 ★⌘Z «직후»의 편집이 ⌘⇧Z 한 번에 «되살릴 길 없이» 날아가지 않는다', () => {
  const r = R.redo;
  expect(r.clicked,     `★정렬 단추에 마우스가 안 닿았다 — 빨강의 이유가 다르다\n${show(r)}`).toBe(true);
  expect(r.undoWorked,  `★⌘Z 가 제 일을 안 했다 — 이 검사의 전제가 안 선다\n${show(r)}`).toBe(true);
  expect(r.editChanged, `★⌘Z 직후의 편집이 캔버스를 «안» 바꿨다 — 전제가 안 선다\n${show(r)}`).toBe(true);
  expect(r.recoverable,
    '★⌘Z 직후에 한 편집이 ⌘⇧Z 한 번에 사라졌고 «되찾을 길이 없다».\n' +
    '기전: 그 편집이 push-before 인데 꼭대기와 같은 상태를 찍어 무변화 차단에 버려지면 칸이 안 생기고, ' +
    '차단은 redo 꼬리도 «안» 자른다 ⇒ ⌘⇧Z 가 «죽은 미래»를 되살리며 그 편집을 덮어쓴다. ' +
    '그 편집은 스택에 한 번도 안 찍혔으므로 복원할 표본이 없다.\n' +
    `${show(r)}`).toBe(true);
  expect(r.keptAfterRedo,
    `★⌘⇧Z 가 «죽은 미래»(wentToStale=${r.wentToStale})로 갔다 — ⌘Z 뒤에 편집을 했으면 그 꼬리는 죽은 것이다.\n${show(r)}`).toBe(true);
});
