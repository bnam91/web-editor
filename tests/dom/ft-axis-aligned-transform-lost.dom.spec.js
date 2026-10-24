/* ft-axis-aligned-transform-lost.dom.spec.js
 *   ★★★`FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01` — ★사용자가 모서리를 ★«똑바로» 끈
 *   자유변형은 ★저장→다시 열면 ★★변형이 ★통째로 ★사라진다. (2026-10-24 신설)
 *
 * ★★★이 파일은 ★«고침»이 ★아니다 — ★결함이 ★산다는 것을 ★수로 ★박아 ★명부에 올린다.
 *   ★고침 후보 = `touched` 를 ★데이터로 남기기(`tb.dataset` 새 키) ⇒ ★★저장 꼴이 바뀐다
 *   ⇒ ★분모(골든·바이트)가 생겨 ★범위 판정이 ★내 자리가 ★아니다 ⇒ ★올려 두고 ★수만 잠근다.
 *
 * ★★실측 (판 `89b127ee` · 헤드리스 · 앱 함수로 장면)
 *   | 축정렬 [[0,0],[400,0],[400,120],[0,120]] (= ★`se` 를 똑바로 끈 꼴) |
 *   | 저장 전  corners `0,0,400,0,400,120,0,120` · matrix `2.42838 / 1.19292` · tf `400px` |
 *   | ★저장본  corners `0,0,400,0,400,120,0,120`  ← ★★데이터는 ★살아 있다 |
 *   | ★복원 뒤 corners ★`0,0,338.34,0,338.34,43,0,43` · matrix ★★항등 · tf ★`338.344px` |
 *   | 사다리꼴 [[40,0],[360,0],[400,140],[0,140]] → corners ★유지 (★행렬만 갈린다 = ★C3) |
 *
 * ★★까닭 (★소스)
 *   `applyFxFreeTransform` : `if (!C || (!st.touched && _isBaseRect(C))) C = _baseRect(st.W, st.H)`
 *   `watchAllFxFreeTransform` : `st.touched = !_isBaseRect(ftCornersOf(tb))`
 *   ⇒ ★★«축 정렬 네 점»은 ★바탕 네모로 ★읽혀 ★`touched = false` ⇒ ★네 점이 ★덮어써진다.
 *   ★★★그리고 `effects-freetransform.js:171` 주석이 ★★이미 그것을 적어 뒀다 :
 *     「★«축 정렬로 줄이기만 한» 네 점(= 사람이 `se` 를 ★똑바로 끈 꼴)이 ★바탕 네모로 읽혀
 *       ★다음 렌더가 ★항등으로 되돌린다 ⇒ ★U3 에서 손잡이가 «튕기는» 것처럼 느껴진다」
 *   ★그 주석은 ★런타임 경로(`setFxFreeTransform` 의 `touched` 깃발)를 고쳤고,
 *   ★`watchAll`(로드)에는 「★런타임 깃발이 ★없다」며 ★꼴 판정을 ★그대로 뒀다.
 *   ⇒ ★★★그 ★「없다」가 ★결함이다 — ★깃발이 ★★저장본에 ★없기 때문이다.
 *
 * ⛔★이 파일이 ★안 재는 것 (★「문제 없다」로 뭉개지 않는다)
 *   · ★U3 손잡이가 ★그때 ★어떻게 보이나 — ★안 쟀다
 *   · ★실앱(9401)에서도 ★같은가 — ★안 쟀다(★헤드리스 하네스다)
 *   · ★부분 축정렬(★한 변만 똑바로)도 걸리나 — ★안 쟀다
 *   · ★`load` 경로(★문서를 ★새로 열기)도 같은가 — ★안 쟀다(load 는 이미 지나간 뒤다)
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js ft-axis-aligned-transform-lost
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** `matrix3d(...)` 의 ★괄호 ★안 숫자만 — ⛔`matrix3d` 의 ★`3` 을 ★먹지 않는다.
 *  ★★261024 에 ★밟았다 : `(s.match(/-?[0-9.]+/g))` 가 ★`3` 을 ★같이 잡아 ★17 개가 되고
 *    ★길이 16 가드가 ★`null` 을 돌려줬다(★단언이 ★그걸 드러냈다 — ★그 설계는 ★섰다). */
function matNums(s) {
  const m = String(s || '').match(/\(([^)]*)\)/);
  if (!m) return [];
  return (m[1].match(/-?[0-9.]+(?:e-?[0-9]+)?/g) || []).map(Number);
}

/** 네 점으로 자유변형을 걸고 ★저장→복원한 뒤 ★전후를 돌려준다. */
async function run(page, corners, opts = {}) {
  return await page.evaluate(async ({ corners, stripKey, growText, touched }) => {
    for (const k of ['pushHistory', 'markDirty', 'scheduleAutoSave', 'updateLayerPanel', 'buildLayerPanel', 'showToast', 'deselectAll'])
      if (typeof window[k] !== 'function') window[k] = () => {};
    const ft = await import('/js/effects-freetransform.js');
    const canvas = document.getElementById('canvas');
    canvas.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...canvas.querySelectorAll('.section-block')].pop();
    window.getSelectedSection = () => sec; window._activeFrame = null;
    await window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop();
    tb.id = 'axTb';
    const tf = tb.closest('.frame-block[data-text-frame="true"]');
    if (!tf) return { fail: 'text-frame 이 없다' };
    tf.style.width = '300px'; tf.style.maxWidth = '100%'; tf.dataset.width = '300';

    const ceOf = (el) => el.querySelector('[contenteditable]') || el.querySelector('.tb-body');
    /* ★`touched: false` = ★«변형 안 하고 켜기만» (★음성대조용) */
    ft.setFxFreeTransform(tb, corners || undefined, { history: false, touched: touched !== false });
    /* ★★저장 ★전에 ★글자만 바꾸는 판 — ⛔다시 그리지 ★않는다(사용자가 ★타이핑만 한 꼴) */
    if (growText != null) (tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body')).textContent = growText;
    const before = { corners: tb.dataset.tfCorners, m: ceOf(tb).style.transform, tfW: tf.style.width };

    window.flushCurrentPage();
    const saved = window.getSerializedCanvas ? window.getSerializedCanvas() : canvas.innerHTML;
    const savedCorners = (saved.match(/data-tf-corners="([^"]+)"/) || [])[1] || null;
    const savedTouched = /data-tf-touched="1"/.test(saved);
    /* ★★★«옛 파일» 흉내 — ★저장본에서 ★키를 ★떼고 ★복원한다(★backward-compat 를 ★재는 자리) */
    canvas.innerHTML = stripKey ? saved.replace(/ data-tf-touched="1"/g, '') : saved;
    window.rebindAll?.({});
    const tb2 = document.getElementById('axTb');
    if (!tb2) return { fail: '복원 뒤 못 찾음' };
    const tf2 = tb2.closest('.frame-block[data-text-frame="true"]');
    const after = { corners: tb2.dataset.tfCorners, m: ceOf(tb2).style.transform, tfW: tf2.style.width };
    return { before, savedCorners, savedTouched, after,
             cornersKept: before.corners === after.corners };
  }, { corners, stripKey: !!opts.stripKey, growText: opts.growText ?? null, touched: opts.touched });
}

/** 항등 행렬과의 최대차 — ★대각 1 · 나머지 0. ★16 개가 아니면 `null`(자가 헛돈 것). */
const IDENT = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function identDiffOf(m) {
  const a = matNums(m);
  return a.length === 16 ? Math.max(...a.map((v, i) => Math.abs(v - IDENT[i]))) : null;
}

const AXIS = [[0, 0], [400, 0], [400, 120], [0, 120]];
const TRAP = [[40, 0], [360, 0], [400, 140], [0, 140]];

test('Y0 ★전제 — 저장본에 네 점이 ★살아 있다(★데이터 손실이 ★«저장»에서 난 것이 아니다)', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await run(page, AXIS);
  expect(r.fail).toBeUndefined();
  /* ★★이 칸이 ★먼저다 — ★저장본에 ★없으면 ★증상의 ★자리가 ★다르다(복원이 아니라 ★저장이다) */
  expect(r.savedCorners, '★저장본에 네 점이 안 실렸다 — 그러면 아래 판정(복원이 범인)이 틀린다')
    .toBe('0,0,400,0,400,120,0,120');
  expect(r.before.m, '★켜도 행렬이 안 걸렸다').toContain('matrix3d');
  expect(errs, `★앱 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('Y1 ★★★닫혔다 — ★축정렬 변형이 ★복원 뒤에도 ★유지된다 (★전엔 ★통째로 사라졌다)', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, AXIS);
  expect(r.fail).toBeUndefined();
  console.log('[Y1]', JSON.stringify(r));

  /* ★★전제 — ★키가 ★저장본에 ★실렸나. ⛔안 실리면 ★아래 「유지된다」는 ★다른 까닭일 수 있다. */
  expect(r.savedTouched, '★`data-tf-touched="1"` 이 저장본에 안 실렸다 — 키를 쓰는 자리가 죽었다').toBe(true);

  /* ★★★본 단언 — ★261024 ★고침(`tfTouched`)이 ★잠그는 자리.
     ★고치기 전 실측 : corners `0,0,400,0,400,120,0,120` → ★`0,0,338.34,0,338.34,43,0,43` ·
       matrix ★항등 · tf `400px` → `338.344px` */
  expect(r.cornersKept,
    `★축정렬 네 점이 ★복원 뒤 ★덮어써졌다 — ★고침이 되돌려졌다 (${r.before.corners} → ${r.after.corners})`
  ).toBe(true);
  const d1 = identDiffOf(r.after.m);
  expect(d1, `★행렬 성분이 16 개가 아니다 — 자가 헛돈다 (${r.after.m})`).not.toBeNull();
  expect(d1, '★행렬이 ★항등으로 돌아갔다 = ★변형이 사라졌다').toBeGreaterThan(1e-6);
  expect(r.after.tfW, `★프레임 폭이 변했다 (${r.before.tfW} → ${r.after.tfW})`).toBe(r.before.tfW);
});

test('Y1b ★★backward-compat — ★«옛 파일»(키 없음)은 ★옛 동작 그대로다 (⛔「전부 고쳤다」가 아니다)', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, AXIS, { stripKey: true });
  expect(r.fail).toBeUndefined();
  console.log('[Y1b]', JSON.stringify(r));

  /* ★★이 칸은 ★«결함이 ★옛 파일에 ★남는다»를 ★★일부러 ★잠근다 —
     ⛔「전부 고쳤다」로 ★읽히지 않게 ★★수로 박아 둔다.
     ★옛 파일을 ★고치려면 ★마이그레이션이 ★필요하고, ★그건 ★★별개 결정이다
       (★이름 = `FT-TOUCHED-OLD-FILES-NOT-MIGRATED-01` · ★0.9.9 후보).
     ★이 칸이 ★빨개지면 = ★옛 파일도 ★고쳐졌다는 뜻이다 ⇒ ★그때 ★이 칸을 ★닫고 ★명부에서 지워라. */
  expect(r.cornersKept,
    '★키가 없는 판에서도 네 점이 유지됐다 — ★옛 파일까지 고쳐졌다면 이 칸을 닫아라'
  ).toBe(false);
  const d = identDiffOf(r.after.m);
  expect(d, `★행렬 성분이 16 개가 아니다 (${r.after.m})`).not.toBeNull();
  expect(d, '★옛 파일 판인데 행렬이 항등이 아니다 — 증상의 꼴이 바뀌었다').toBeLessThan(1e-6);
});

test('Y2 ★★음성대조 — ★사다리꼴은 ★네 점이 ★유지된다 (★「복원하면 ★늘 잃는다」가 아니다)', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, TRAP);
  expect(r.fail).toBeUndefined();
  console.log('[Y2]', JSON.stringify(r));

  /* ★★이 칸이 ★Y1 을 ★의미 있게 만든다 — ⛔없으면 「복원하면 ★전부 잃는다」와 ★구분이 안 된다.
     ★그리고 ★이 칸이 ★빨개지면 ★★병이 ★넓어진 것이다(사다리꼴까지) ⇒ ★그쪽이 ★더 급하다.
     ★★단 ★행렬은 ★사다리꼴에서도 ★갈린다 — ★그건 ★별개 결함이다(C3 ·
       `ft-restore-remeasures-at-other-width.dom.spec.js` X1 이 잠근다) ⇒ ★여기서 ★안 잰다. */
  expect(r.cornersKept,
    `★사다리꼴 네 점까지 ★덮어써졌다 — ★병이 넓어졌다 (${r.before.corners} → ${r.after.corners})`
  ).toBe(true);
  const d2 = identDiffOf(r.after.m);
  expect(d2, `★행렬 성분이 16 개가 아니다 — 자가 헛돈다 (${r.after.m})`).not.toBeNull();
  expect(d2, '★사다리꼴인데 행렬이 항등이다 — 변형이 통째로 사라졌다').toBeGreaterThan(1e-6);
});

/* ══ Y3 ★★★음성대조 넷 — ★«변형 안 하고 ★글자만 바꿔 저장한» 글상자는 ★찌그러지지 ★않는다 ══
   ★★이 칸이 ★★«무접촉 길»을 ★기각한 ★근거다(261024) :
     `_isBaseRect` 를 ★「바탕 W·H 와 같은가」로 ★좁히면 ★축정렬 변형은 ★지켜지지만
     ★이 네 판이 ★★찌그러졌다 — ★실측 identDiff ★0.77 ～ ★4.28.
   ⇒ ★`tfTouched` 길은 ★그 넷을 ★★안 건드린다(★키가 ★없으니 ★옛 꼴 판정 그대로) — ★그것을 ★잠근다.
   ⛔이 칸이 ★빨개지면 ★★내 고침이 ★그 판을 ★건드린 것이다. */
const GROW   = '가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사';
const SHRINK = '짧';

test('Y3 ★★음성대조 — 변형 ★안 하고 ★글자만 바꿔 저장해도 ★행렬이 ★항등이다 (넷)', async ({ page }) => {
  await bootApp(page);
  const cases = [
    ['grow',   { touched: false, growText: GROW }],
    ['shrink', { touched: false, growText: SHRINK }],
    ['grow_oldFile',   { touched: false, growText: GROW,   stripKey: true }],
    ['shrink_oldFile', { touched: false, growText: SHRINK, stripKey: true }],
  ];
  const seen = {};
  for (const [name, opts] of cases) {
    const r = await run(page, null, opts);   /* ★C 를 ★안 준다 = ★변형 안 함 */
    expect(r.fail).toBeUndefined();
    const d = identDiffOf(r.after.m);
    seen[name] = { corners: r.after.corners, identDiff: d, savedTouched: r.savedTouched };
    /* ★★전제 — ★`touched: false` 면 ★키가 ★저장본에 ★없어야 ★한다(★대칭) */
    expect(r.savedTouched, `★${name}: 변형 안 했는데 키가 저장본에 실렸다 — 대칭이 깨졌다`).toBe(false);
    expect(d, `★${name}: 행렬 성분이 16 개가 아니다 (${r.after.m})`).not.toBeNull();
    /* ★★★본 단언 — ★찌그러지지 ★않는다 */
    expect(d, `★${name}: 변형 안 한 글상자가 ★찌그러졌다 (identDiff ${d} · corners ${r.after.corners})`)
      .toBeLessThan(1e-6);
  }
  console.log('[Y3]', JSON.stringify(seen));
});
