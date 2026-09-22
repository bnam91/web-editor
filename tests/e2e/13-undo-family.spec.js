/* ══════════════════════════════════════════════════════════════════════════
   13-undo-family — 되돌리기(⌘Z) 계열 «카드 여덟 장»을 «칸»으로 재는 게이트
   ──────────────────────────────────────────────────────────────────────────
   대상 카드 — T-005 ④ · T-009 ⑨ · T-012 ① · T-030 ⑤ · T-130 잔여 · T-131 ⑧ · T-136 · T-140

   ⚠️★[2026-09-22 · 지디] «이 판의 어느 축을 믿나» — 그물의 구멍을 그물과 «같이» 적는다.
     🔴«먹통 칸(㉢ dead)» 축은 «못 믿는다». 아래 unit() 의 정규화가 `\s+ → ' '` 만이라
       `> <` 와 `><` 를 «다르게» 본다 ⇒ 공백만 바뀐 ⌘Z 를 「바뀌었다」로 세어 «먹통 칸을 못 본다».
       재는 쪽이 스스로 철회했다. ⛔이 축의 «초록»을 「먹통 칸 없음」으로 읽지 마라 —
       T-131 ⑧ · T-136 은 「재현 안 됨」이 아니라 «이 계측기가 못 봤다» 다.
     ✅«㉠ stuck · ㉡ skipped» 축은 «성하다» — 앱이 준 getHistoryTip().pos «정수»로 재서
       위 결함이 한 글자도 안 낀다. 오늘 «되돌리기 전면 무동작» 회귀를 잡은 것이 이 축이다
       (검사 4,083건이 한 건도 못 잡았다). ⇒ ⛔그래서 이 파일을 «빼지 않는다».
     ⚠️U5(사다리를 실제로 밟았나) 빨강 2건은 «결함이 아니라 계측 실패» 다 —
       `#vtrim-apply-gif-btn` 이 «화면 밖»이라 elementFromPoint 가 null 을 준다
       (L4/③ GIF로적용 = covered-by:null). ⛔안 고치면 L4 사다리는 «영영 안 재진다».

   ★★갈아 끼울 때 «재는 양이 바뀌었나»를 이 수로 대조하라 (2026-09-22 실측, 판 = dev 2a6af5d):
       기준선 «7초록 / 4빨강»(U1×2 · U5×2)
       → row.id 고침(fdec636)만 되돌리면 «6빨강», ★늘어난 것이 «정확히 U2 둘».
     ⇒ 다시 쓴 판이 이 수와 «안 맞으면» 그건 고쳐진 것이 아니라 «재는 양이 바뀐 것»이다.
     ⛔부분 수정 금지 — 새 판이 오면 «통째로» 갈아라(축이 합쳐지는 중이다).

   ══ 왜 «칸»인가 ════════════════════════════════════════════════════════════
   「⌘Z 를 눌렀는데 안 바뀐다」는 세 가지 서로 «반대인» 원인에서 나온다.
     ㉠ 칸을 안 만든다 — 되돌아갈 자리가 아예 없다 (⌘Z 를 눌러도 칸이 «안 줄고» 화면도 그대로)
     ㉡ 한 칸에 두 동작 — ⌘Z 한 번이 마디를 «건너뛴다» (하나 되돌리려다 둘이 날아간다)
     ㉢ 먹통 칸        — 칸은 «줄었는데» 바뀐 것이 0
   ⛔그래서 ㉠ 과 ㉢ 을 같은 검사로 재지 않는다 — 읽는 «양»이 다르다:
     ㉠=stuck(칸 안 줄고 무변화) · ㉡=skipped(건너뛴 마디) · ㉢=dead(칸은 줄고 무변화)

   ══ 사다리 ════════════════════════════════════════════════════════════════
   동작 K개를 «실경로»로 밟고 마디를 적은 뒤 ⌘Z 를 눌러 내려온다. 옳으면 K번의 ⌘Z 가
   마디 K개를 하나씩 되밟는다. 세 고장은 그 내려오는 걸음에서 «따로» 드러난다.
   ⛔하네스가 상태를 «만들어 두고» 재지 않는다 — 우측 패널 숫자칸·단추를 rect+elementFromPoint 로
     확인한 뒤 진짜로 누르고, 영상은 진짜 File 로 loadVideoToAsset(= 파일선택창 «아래»의 같은 함수)을
     부른다. 그래야 실제 경로에서만 나는 결함이 잡힌다.

   ══ 판 두 벌 ══════════════════════════════════════════════════════════════
   도형(SVG)이 «있는 판»과 «없는 판»을 둘 다 돈다 — T-131·T-136 은 도형이 있을 때만 났다.
   한 판만 돌면 「한 축의 0건」을 「결함 0」으로 읽게 된다.

   ══ 포트·프로필 규율 ══════════════════════════════════════════════════════
   ⛔helpers.launchApp() 은 9334 하드코딩 + 공용 프로필이라 «쓰지 않는다».
   배정 포트(E2E_UNDO_PORT, 기본 9527) + «격리 프로필»로 띄우고, 띄운 «직후» app.getPath('userData')
   가 그 프로필인지 확인한다. 아니면 «즉시 실패»시킨다 — 현빈 실계정이기 때문이다.

   실행: npx playwright test tests/e2e/13-undo-family.spec.js --config=playwright.config.js
════════════════════════════════════════════════════════════════════════════ */
const { test, expect, _electron } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TINY_MP4_B64 } = require('../fixtures/tiny-video.js');

const PORT    = process.env.E2E_UNDO_PORT || '9527';
const PROFILE = process.env.E2E_UNDO_PROFILE || path.join(os.tmpdir(), 'goditor_e2e_undo_' + PORT);
const HARNESS = fs.readFileSync(path.join(__dirname, '_undo-family-harness.js'), 'utf8');

/* ⛔serial 로 두지 않는다 — 한 검사가 빨강이면 나머지가 «안 돈 채» 초록도 빨강도 아니게 된다.
   세 고장을 따로 보려면 셋이 다 돌아야 한다. */
let app, page;
let NAV_RETRIES = 0;
/* 판별 결과 — beforeAll 에서 «한 번» 재고 검사 셋이 서로 «다른 양»을 읽는다.
   (영상 GIF 인코딩이 실시간이라 판마다 다시 돌리면 느리다) */
const R = { plain: null, shape: null, instrument: null };

test.beforeAll(async () => {
  test.setTimeout(600000);
  fs.mkdirSync(PROFILE, { recursive: true });
  /* 로그인 게이트 — 이 맥의 자격증명을 «격리 프로필»에만 복사한다. */
  const src = path.join(os.homedir(), 'Library', 'Application Support', 'GODITOR', 'auth.json');
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(PROFILE, 'auth.json'));

  app = await _electron.launch({
    args: ['.', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
           '--disable-renderer-backgrounding', '--disable-background-timer-throttling',
           '--disable-backgrounding-occluded-windows', 'admin'],
    cwd: path.join(__dirname, '..', '..'),
  });
  /* ★★띄운 «직후» 뿌리 경로 확인 — 현빈 실계정(~/Library/Application Support/GODITOR)이면 즉시 끈다. */
  const root = await app.evaluate(({ app }) => app.getPath('userData'));
  if (path.resolve(root) !== path.resolve(PROFILE)) {
    await app.close().catch(() => {});
    throw new Error(`★프로필 격리 실패 — userData=${root} (기대: ${PROFILE}). 현빈 실계정일 수 있어 즉시 껐다.`);
  }

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

  await install();

  R.instrument = await run(measureInstrumentSrc());
  R.plain      = await run(measureBoardSrc(), false);
  R.shape      = await run(measureBoardSrc(), true);
});

/** 하네스를 «앱 안»에 얹는다 — 탐색(navigation)이 나면 컨텍스트가 날아가므로 다시 얹어야 한다. */
async function install() {
  await page.evaluate(HARNESS);
  await page.evaluate(b64 => { window.__UF_MP4 = b64; }, TINY_MP4_B64);
}

/* ★앱이 «스스로» 화면을 갈아치우는 일이 드물게 있다(저장/홈이동 경로). 그때 page.evaluate 는
   «Execution context was destroyed» 로 죽는데, 그건 결함이 아니라 계측 실패다.
   ⛔그걸 빨강으로 읽지 않는다 — 다시 얹고 «한 번» 더 잰다. 몇 번 그랬는지는 U0 이 보고한다. */
async function run(fn, arg) {
  try { return await page.evaluate(fn, arg); }
  catch (e) {
    if (!/Execution context was destroyed|Target (page|closed)/.test(String(e.message))) throw e;
    NAV_RETRIES++;
    await page.waitForLoadState('domcontentloaded');
    if (page.url().includes('projects.html')) {
      await page.click('#btn-new');
      await page.waitForURL(/index\.html\?project=/, { timeout: 30000 });
    }
    await page.waitForFunction(() => typeof window.addSection === 'function', null, { timeout: 30000 });
    await install();
    return await page.evaluate(fn, arg);
  }
}

test.afterAll(async () => {
  if (app) await app.close().catch(() => {});
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (_) {}
});

/* ── 브라우저에서 돌 코드 ─────────────────────────────────────────────────── */

/** U0 계측기 자체 점검 — 「빨강의 이유가 내가 재려는 것과 같은가」를 먼저 세운다. */
function measureInstrumentSrc() {
  return async () => {
    const U = window.__UF;
    const sid = await U.board(false);
    const tb = document.getElementById(sid).querySelector('.text-block');
    await U.pick(tb.id);
    const before = U.fp();
    const numField = document.getElementById('txt-size-number');
    const nr = numField ? numField.getBoundingClientRect() : null;
    U.setNum('txt-size-number', 41);
    await U.settle(350);
    const after = U.fp();
    const d = U.diff(before, after);
    /* 정렬 단추 — «닿는가»를 rect + elementFromPoint 로 확인한다(0×0 유령/가려짐 판별) */
    await U.pick(tb.id);
    const btns = [...document.querySelectorAll('#panel-right .prop-align-btn')];
    const target = btns.find(b => !b.classList.contains('active'));
    const br = target ? target.getBoundingClientRect() : null;
    const clicked = U.realClick(target);
    await U.settle(350);
    const after2 = U.fp();
    return {
      fieldRect: nr && { w: +nr.width.toFixed(1), h: +nr.height.toFixed(1) },
      numFieldSeen: d.n, numFieldIds: d.changed,
      alignBtnRect: br && { w: +br.width.toFixed(1), h: +br.height.toFixed(1) },
      alignClicked: clicked, alignSeen: U.diff(after, after2).n,
    };
  };
}

/** 판 하나에서 사다리 넷 + T-135 대조 + T-009(⌘Z 직후 편집)을 잰다. */
function measureBoardSrc() {
  return async (withShape) => {
    const U = window.__UF;
    const mp4 = () => {
      const bin = atob(window.__UF_MP4); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return new File([u], 'tiny.mp4', { type: 'video/mp4' });
    };
    const out = {};

    /* ── 사다리 L1 : 일반(삽입 + 우측 패널) — 대조용. 여기가 빨강이면 계측기를 의심해라. ── */
    {
      const sid = await U.board(withShape); let tid = null;
      out.L1 = await U.ladder('L1 일반', [
        { name: '①텍스트추가', run: async () => {
            window.selectSection(U.byId(sid)); await U.settle(200);
            const b = U.fp(); window.addTextBlock('body'); await U.settle(400);
            tid = U.diff(b, U.fp()).added.find(id => { const e = U.byId(id); return e && e.classList.contains('text-block'); });
            return tid; } },
        { name: '②글자크기44', run: async () => { await U.pick(tid); return U.setNum('txt-size-number', 44); } },
        { name: '③정렬단추',   run: async () => { await U.pick(tid);
            const b = [...document.querySelectorAll('#panel-right .prop-align-btn')].find(x => !x.classList.contains('active'));
            return U.realClick(b); } },
        { name: '④갭추가',     run: async () => { window.selectSection(U.byId(sid)); await U.settle(250); window.addGapBlock(); return true; } },
        { name: '⑤글자크기20', run: async () => { await U.pick(tid); return U.setNum('txt-size-number', 20); } },
      ]);
    }

    /* ── 사다리 L2 : 스텝 블럭 (T-030 ⑤ — 스텝 추가 + 설명 편집) ── */
    {
      const sid = await U.board(withShape); let bid = null;
      out.L2 = await U.ladder('L2 스텝(T-030)', [
        { name: '①스텝블럭추가', wait: 450, run: async () => {
            window.selectSection(U.byId(sid)); await U.settle(200);
            window.addStepBlock(); await U.settle(400);
            bid = document.querySelector('.step-block').id; return bid; } },
        { name: '②스텝추가단추', wait: 450, run: async () => { await U.pick(bid);
            return U.realClick(document.getElementById('stb-add-step')); } },
        { name: '③설명편집',     wait: 450, run: async () => {
            const b = U.byId(bid); const t = b.querySelector('.stb-desc') || b.querySelector('.stb-title');
            if (!t) return 'no-target';
            const dc = U.dblClick(t); if (dc !== true) return dc;
            await U.settle(150);
            t.textContent = '설명바뀜ABC'; t.dispatchEvent(new Event('input', { bubbles: true })); t.blur();
            return true; } },
      ]);
    }

    /* ── 사다리 L3 : 영상 (T-130 잔여 — 업로드가 칸을 안 만든다 / T-012 ① — GIF 적용) ── */
    {
      const sid = await U.board(withShape); let aid = null;
      out.L3 = await U.ladder('L3 영상(T-130·T-012)', [
        { name: '①에셋추가', wait: 450, run: async () => {
            window.selectSection(U.byId(sid)); await U.settle(200);
            window.addAssetBlock(); await U.settle(400);
            aid = document.querySelector('.asset-block').id; return aid; } },
        { name: '②영상업로드', wait: 700, run: async () => { await U.pick(aid);
            window.loadVideoToAsset(U.byId(aid), mp4());
            for (let i = 0; i < 50; i++) { const x = U.byId(aid);
              if (x && x.dataset.assetType === 'video-pending' && x.querySelector('video') && x.querySelector('video').readyState >= 1) break;
              await U.settle(120); }
            const x = U.byId(aid); return !!(x && x.dataset.assetType === 'video-pending'); } },
        { name: '③재생속도2배', wait: 600, run: async () => { await U.pick(aid); await U.settle(300);
            const sel = document.getElementById('vtrim-speed'); if (!sel) return 'no-select';
            sel.value = '2'; sel.dispatchEvent(new Event('change', { bubbles: true }));
            await U.settle(250); return U.byId(aid).dataset.playbackRate; } },
      ]);
    }

    /* ── 사다리 L4 : 영상 → GIF 적용 (T-012 ①) ── */
    {
      const sid = await U.board(withShape); let aid = null;
      out.L4 = await U.ladder('L4 GIF적용(T-012)', [
        { name: '①에셋추가', wait: 450, run: async () => {
            window.selectSection(U.byId(sid)); await U.settle(200);
            window.addAssetBlock(); await U.settle(400);
            aid = document.querySelector('.asset-block').id; return aid; } },
        { name: '②영상업로드', wait: 700, run: async () => { await U.pick(aid);
            window.loadVideoToAsset(U.byId(aid), mp4());
            for (let i = 0; i < 50; i++) { const x = U.byId(aid);
              if (x && x.dataset.assetType === 'video-pending' && x.querySelector('video') && x.querySelector('video').readyState >= 1) break;
              await U.settle(120); }
            return !!(U.byId(aid) && U.byId(aid).dataset.assetType === 'video-pending'); } },
        { name: '③GIF로적용', wait: 800, run: async () => { await U.pick(aid); await U.settle(350);
            const btn = document.getElementById('vtrim-apply-gif-btn'); if (!btn) return 'no-btn';
            const c = U.realClick(btn); if (c !== true) return c;
            for (let i = 0; i < 150; i++) { const x = U.byId(aid); if (x && x.dataset.motion === 'gif') break; await U.settle(200); }
            return !!(U.byId(aid) && U.byId(aid).dataset.motion === 'gif'); } },
      ]);
    }

    /* ── T-009 ⑨ : ⌘Z «직후»의 그리드 줄 편집 ──────────────────────────────
       ⛔사다리로 못 잰다 — «가운데»에 ⌘Z 가 끼는 모양이라 따로 잰다. */
    {
      const sid = await U.board(withShape);
      window.selectSection(U.byId(sid)); await U.settle(200);
      window.addGridBlock(); await U.settle(400);
      const gid = document.querySelector('.grid-block').id;
      await U.pick(gid);
      window.clearHistory(); await U.settle(250);
      const fA = U.fp(), tA = U.tip();
      U.setNum('grd-col-gap-number', 40); await U.settle(350);
      const fB = U.fp(), tB = U.tip();
      window.undo(); await U.settle(400);
      const fC = U.fp(), tC = U.tip();
      /* ⌘Z «직후»에 그리드 줄 «글자»를 고친다 — 실경로(더블클릭 → 입력 → blur) */
      await U.pick(gid);
      const host = U.byId(gid) && U.byId(gid).querySelector('.grd-cell [data-line]');
      const hr = host ? host.getBoundingClientRect() : null;
      const dc = host ? U.dblClick(host) : 'no-host';
      await U.settle(200);
      const editable = host ? host.getAttribute('contenteditable') : null;
      if (host) { host.innerText = '그리드줄바뀜XYZ'; host.dispatchEvent(new Event('input', { bubbles: true })); host.blur(); }
      await U.settle(450);
      const fD = U.fp(), tD = U.tip();
      window.undo(); await U.settle(450);
      const fE = U.fp(), tE = U.tip();
      out.T009 = {
        hostRect: hr && { w: +hr.width.toFixed(1), h: +hr.height.toFixed(1) }, dblClick: dc, editable,
        step1Slot: tB.pos - tA.pos, undo1Back: U.same(fC, fA), undo1Changed: U.diff(fB, fC).n,
        lineEditChanged: U.diff(fC, fD).n, lineEditSlot: tD.pos - tC.pos,
        undo2Changed: U.diff(fD, fE).n, undo2PosMoved: tE.pos !== tD.pos,
        backToBeforeLineEdit: U.same(fE, fC),
        tips: [tA, tB, tC, tD, tE],
      };
    }

    /* ── T-009 형제 : ⌘Z «직후»의 «정렬 단추»(그리드가 아닌 push-before 자리) ──────────
       ★한 자리만 재면 「그리드 버그」로 읽힌다. 입구를 하나 더 둬서 «⌘Z 직후»라는 조건이
         원인인지 가린다. */
    {
      const sid = await U.board(withShape);
      const tb = U.byId(sid).querySelector('.text-block');
      await U.pick(tb.id);
      const fA = U.fp(), tA = U.tip();
      U.setNum('txt-size-number', 33); await U.settle(350);
      window.undo(); await U.settle(400);
      const fC = U.fp(), tC = U.tip();
      await U.pick(tb.id);
      const btn = [...document.querySelectorAll('#panel-right .prop-align-btn')].find(x => !x.classList.contains('active'));
      const clicked = U.realClick(btn); await U.settle(400);
      const fD = U.fp(), tD = U.tip();
      window.undo(); await U.settle(450);
      const fE = U.fp(), tE = U.tip();
      out.T009b = {
        clicked, undo1Back: U.same(fC, fA),
        editChanged: U.diff(fC, fD).n, editSlot: tD.pos - tC.pos,
        undo2Changed: U.diff(fD, fE).n, undo2PosMoved: tE.pos !== tD.pos,
        backToBeforeEdit: U.same(fE, fC), tips: [tA, tC, tD, tE],
      };
    }

    /* ── T-135 대조 : 「바로 전 값」으로 돌아오는 멀쩡한 자리(숫자칸·정렬단추) ── */
    {
      const sid = await U.board(withShape);
      const tb = U.byId(sid).querySelector('.text-block');
      await U.pick(tb.id);
      const f0 = U.fp(), t0 = U.tip();
      U.setNum('txt-size-number', 40); await U.settle(350);
      const f1 = U.fp(), t1 = U.tip();
      window.undo(); await U.settle(400);
      const f2 = U.fp(), t2 = U.tip();
      /* ★정렬 단추는 «새 판»에서 잰다 — 앞의 ⌘Z 를 그대로 물고 가면 T-009 조건(⌘Z 직후의
         push-before 편집)이 대조에 섞여 «대조가 결함을 베낀다». 실측으로 한 번 그랬다. */
      const sid2 = await U.board(withShape);
      const tb2 = U.byId(sid2).querySelector('.text-block');
      await U.pick(tb2.id);
      const g0 = U.fp();
      const btn = [...document.querySelectorAll('#panel-right .prop-align-btn')].find(x => !x.classList.contains('active'));
      const clicked = U.realClick(btn); await U.settle(400);
      const g1 = U.fp();
      window.undo(); await U.settle(400);
      const g2 = U.fp();
      out.T135 = {
        numSlot: t1.pos - t0.pos, numEditChanged: U.diff(f0, f1).n,
        numUndoChanged: U.diff(f1, f2).n, numBack: U.same(f2, f0),
        alignClicked: clicked, alignEditChanged: U.diff(g0, g1).n,
        alignUndoChanged: U.diff(g1, g2).n, alignBack: U.same(g2, g0),
        tips: [t0, t1, t2],
      };
    }
    return out;
  };
}

/* ── 판정 ──────────────────────────────────────────────────────────────── */

const BOARDS = [['도형 없는 판', 'plain'], ['도형(SVG) 있는 판', 'shape']];
const LADDERS = ['L1', 'L2', 'L3', 'L4'];
const show = o => JSON.stringify(o, null, 1);

test('U0 ★계측기 자체 점검 — 내가 재려는 것이 실제로 보이는가', () => {
  const I = R.instrument;
  /* ⚠️오늘 다른 검사가 «화면 밖»의 요소를 눌러 고치기 전·후가 똑같이 「안 움직임」으로 나왔다.
     그 무의미한 빨강을 막으려고, 재기 전에 «닿는가»와 «보이는가»를 먼저 세운다. */
  expect(I.fieldRect && I.fieldRect.w, `★숫자칸이 0×0 이다 — 무의미한 빨강이 된다\n${show(I)}`).toBeGreaterThan(0);
  expect(I.numFieldSeen, `★지문이 «글자크기 변경»을 못 본다 — 이 계측기로 잰 모든 0 은 무의미하다\n${show(I)}`).toBe(1);
  expect(I.alignBtnRect && I.alignBtnRect.w, `★정렬 단추가 0×0 이다\n${show(I)}`).toBeGreaterThan(0);
  expect(I.alignClicked, `★정렬 단추에 마우스가 «안 닿는다»(가려짐/화면 밖) — 클릭이 통과로 읽힌다\n${show(I)}`).toBe(true);
  expect(I.alignSeen, `★지문이 «정렬 변경»을 못 본다\n${show(I)}`).toBeGreaterThan(0);
  /* 계측 중 앱이 스스로 화면을 갈아치운 횟수 — 0 이 아니면 그 판은 «다시» 잰 것이다(결함 아님). */
  expect(NAV_RETRIES, `★계측 중 탐색이 ${NAV_RETRIES}번 났고 그만큼 다시 쟀다 — 3번 이상이면 계측기를 먼저 의심해라`).toBeLessThan(3);
});

for (const [label, key] of BOARDS) {
  test(`U1 [${label}] ㉠ 되돌아갈 «자리»가 없는 동작이 있다 — 칸을 안 만든다`, () => {
    const B = R[key];
    /* 재는 양 = 「⌘Z 를 눌렀는데 «칸도 안 줄고» 바뀐 것도 0」인 횟수(stuck).
       ⛔㉢(먹통 칸)과 섞지 않는다 — 그쪽은 «칸이 줄었는데» 무변화다. */
    const stuck = LADDERS.map(k => ({ k, n: B[k].stuck, notes: B[k].notes, undos: B[k].undos }))
      .filter(x => x.n > 0);
    expect(stuck.map(x => `${x.k}=${x.n}`),
      `★사다리에서 「⌘Z 를 눌러도 칸이 안 줄고 화면도 그대로」가 나왔다 — 되돌아갈 자리가 없다.\n${show(stuck)}`).toEqual([]);

    /* T-009 ⑨ — ⌘Z «직후»의 그리드 줄 편집. 이 편집은 칸을 만들어야 한다. */
    const g = B.T009;
    expect(g.dblClick, `★그리드 줄에 더블클릭이 안 닿았다 — 빨강의 이유가 다르다\n${show(g)}`).toBe(true);
    expect(g.editable, `★그리드 줄이 편집 상태로 안 들어갔다 — 빨강의 이유가 다르다\n${show(g)}`).toBe('true');
    expect(g.lineEditChanged, `★줄 편집이 캔버스를 «안» 바꿨다 — 그러면 칸 이야기를 할 수 없다\n${show(g)}`).toBeGreaterThan(0);
    expect(g.lineEditSlot,
      `★T-009 ⑨ — ⌘Z «직후»의 그리드 줄 편집이 되돌리기 «칸»을 안 만든다(칸 +${g.lineEditSlot}).\n` +
      '기전: 줄 편집은 push-before 다. ⌘Z 직후엔 살아있는 캔버스가 꼭대기와 «같아서» ' +
      'pushHistory 의 무변화 차단이 그대로 돌아나간다 ⇒ 그 뒤의 편집은 스택에 한 칸도 안 남는다.\n' +
      `그래서 ⌘Z 를 눌러도 아무 일이 안 난다(바뀐 것 ${g.undo2Changed} · 칸 이동 ${g.undo2PosMoved}).\n${show(g)}`).toBeGreaterThan(0);

    /* 형제 자리 — 그리드가 아닌 입구(정렬 단추)도 같은 조건에서 같은 일이 나는가. */
    const b = B.T009b;
    expect(b.clicked, `★정렬 단추에 마우스가 안 닿았다 — 빨강의 이유가 다르다\n${show(b)}`).toBe(true);
    expect(b.editChanged, `★정렬 단추가 캔버스를 «안» 바꿨다\n${show(b)}`).toBeGreaterThan(0);
    expect(b.editSlot,
      '★T-009 형제 — ⌘Z «직후»의 «정렬 단추»(그리드 아님)도 되돌리기 칸을 안 만든다.\n' +
      `조건은 «그리드»가 아니라 «⌘Z 직후의 push-before 편집»이다.\n${show(b)}`).toBeGreaterThan(0);
  });

  test(`U2 [${label}] ㉡ ⌘Z 한 번이 «두 동작»을 되돌린다`, () => {
    const B = R[key];
    /* ★재는 양 = 「동작 K개를 ⌘Z 몇 번에 다 풀었나」. K보다 «적으면» 한 칸이 둘을 먹은 것이다.
       ⛔지문 일치(skipped)로 «판정»하지 않는다 — 복원 뒤 자동으로 새로 붙는 껍데기 id
         (스텝 블럭을 감싸는 row_ 래퍼, 실측 2026-09-22)가 마디를 «안 맞는 것처럼» 만든다.
         그건 무의미한 빨강이다. skipped 는 «어디서» 먹혔는지 가리키는 안내로만 싣는다. */
    const bad = [];
    for (const k of LADDERS) {
      const L = B[k];
      if (!L.reachedStart) {
        /* ⛔여기서 기록을 빼지 마라 — 「못 내려왔다」만 적으면 다음 사람이 «왜»를 다시 재야 한다.
           실측으로 두 갈래가 있었다: ⑴ 칸이 안 줄어 제자리(㉠) ⑵ 복원 때마다 껍데기가 «새 id»를
           받아 마디가 영영 안 맞는다(캔버스가 정착을 안 한다). 둘은 고치는 자리가 다르다. */
        bad.push(`${k}: ⌘Z ${L.undoCount}번으로도 처음까지 못 내려왔다 — ` +
          `칸 수 ${L.notes.map(n => n.name + '=+' + n.slot).join(' · ')} / ` +
          `걸음 ${L.undos.map(u => `#${u.i} pos${u.posBefore}→${u.posAfter} 바뀜${u.changed} [${u.ids.join(',')}]`).join(' | ')}`);
        continue;
      }
      if (L.undosToStart < L.steps) {
        bad.push(`${k}: 동작 ${L.steps}개를 ⌘Z ${L.undosToStart}번에 다 풀었다` +
          ` (칸 수 ${L.notes.map(n => n.name + '=+' + n.slot).join(' · ')}` +
          `${L.skipped.length ? ' / 건너뛴 마디 ' + L.skipped.map(i => L.notes[i - 1] && L.notes[i - 1].name).join(',') : ''})`);
      }
    }
    expect(bad,
      '★⌘Z 한 번이 «두 동작»을 되돌렸다 — 하나를 되돌리려다 둘이 같이 날아간다.\n' +
      '기전 두 갈래: ⑴ 앞 동작이 칸을 «안» 만들었다(push-before 가 무변화 차단에 먹힘) ' +
      '⑵ 뒤 동작이 push-after 라 «그 사이» 표본이 한 번도 안 찍혔다.\n' +
      `${show(bad.map(x => x))}`).toEqual([]);
  });

  test(`U3 [${label}] ㉢ 먹통 칸 — 칸은 줄었는데 바뀐 것이 0`, () => {
    const B = R[key];
    /* 재는 양 = historyPos 는 줄었는데 지문이 하나도 안 바뀐 ⌘Z 의 수. */
    const dead = LADDERS.map(k => ({ k, n: B[k].dead, undos: B[k].undos.filter(u => u.posAfter < u.posBefore && u.changed === 0) }))
      .filter(x => x.n > 0);
    expect(dead.map(x => `${x.k}=${x.n}`),
      '★먹통 칸 — ⌘Z 가 칸을 하나 먹었는데 화면이 그대로다.\n' +
      '기전: 꼭대기와 라이브가 «편집이 아닌 것»(툴바 재배치·정착 값·상호작용 플래그)으로만 달라 ' +
      'ensureHistoryCheckpoint 가 빈 칸을 하나 더 만든 것이다. js/history.js _stripNonEdit·_CHROME_RE 를 봐라.\n' +
      `${show(dead)}`).toEqual([]);
  });

  test(`U4 [${label}] 대조(초록이어야 한다) — T-135 숫자칸·정렬단추는 «바로 전 값»으로`, () => {
    const t = R[key].T135;
    expect(t.numEditChanged,  `★숫자칸 편집이 캔버스를 안 바꿨다\n${show(t)}`).toBe(1);
    expect(t.numUndoChanged,  `★숫자칸 ⌘Z 가 «하나»만 되돌리지 않았다\n${show(t)}`).toBe(1);
    expect(t.numBack,         `★숫자칸 ⌘Z 가 «바로 전 값»으로 안 돌아왔다\n${show(t)}`).toBe(true);
    expect(t.alignClicked,    `★정렬 단추에 마우스가 안 닿았다\n${show(t)}`).toBe(true);
    expect(t.alignEditChanged, `★정렬 단추가 캔버스를 안 바꿨다\n${show(t)}`).toBe(1);
    expect(t.alignUndoChanged, `★정렬 ⌘Z 가 «하나»만 되돌리지 않았다\n${show(t)}`).toBe(1);
    expect(t.alignBack,       `★정렬 ⌘Z 가 «바로 전 값»으로 안 돌아왔다\n${show(t)}`).toBe(true);
  });

  test(`U5 [${label}] ★사다리가 실제로 «동작»을 밟았나 — 부재를 통과로 읽지 않는다`, () => {
    const B = R[key];
    const notRun = [];
    for (const k of LADDERS) for (const n of B[k].notes) {
      if (n.ret === false || typeof n.ret === 'string' && /^(no-|zero-size|covered-by)/.test(n.ret)) notRun.push(`${k}/${n.name}=${n.ret}`);
      if (n.changed === 0) notRun.push(`${k}/${n.name}: 캔버스가 «안» 바뀜(동작이 안 먹었다)`);
    }
    expect(notRun,
      '★동작이 «안 일어났다» — 그 자리의 칸 수 0 은 결함이 아니라 계측 실패다. ' +
      '입구 이름·인자·단추 id 가 바뀌었는지 먼저 봐라.').toEqual([]);
  });
}
