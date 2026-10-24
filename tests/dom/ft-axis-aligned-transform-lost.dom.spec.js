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
async function run(page, corners) {
  return await page.evaluate(async (corners) => {
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
    ft.setFxFreeTransform(tb, corners, { history: false });
    const before = { corners: tb.dataset.tfCorners, m: ceOf(tb).style.transform, tfW: tf.style.width };

    window.flushCurrentPage();
    const saved = window.getSerializedCanvas ? window.getSerializedCanvas() : canvas.innerHTML;
    const savedCorners = (saved.match(/data-tf-corners="([^"]+)"/) || [])[1] || null;
    canvas.innerHTML = saved;
    window.rebindAll?.({});
    const tb2 = document.getElementById('axTb');
    if (!tb2) return { fail: '복원 뒤 못 찾음' };
    const tf2 = tb2.closest('.frame-block[data-text-frame="true"]');
    const after = { corners: tb2.dataset.tfCorners, m: ceOf(tb2).style.transform, tfW: tf2.style.width };
    return { before, savedCorners, after,
             cornersKept: before.corners === after.corners };
  }, corners);
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

test('Y1 ★★미해결을 ★수로 박는다 — ★축정렬 변형은 ★복원 뒤 ★네 점이 ★덮어써진다', async ({ page }) => {
  await bootApp(page);
  const r = await run(page, AXIS);
  expect(r.fail).toBeUndefined();
  console.log('[Y1]', JSON.stringify(r));

  /* ★★★「★결함이 ★산다」를 ★잠근다 — ⛔「고쳤다」가 ★아니다.
     ★고치면 ★이 칸이 ★빨개지고, ★그때 ★`FT-AXIS-ALIGNED-TRANSFORM-LOST-ON-RESTORE-01` 을 ★닫아라.
     ★261024 측정 : corners `0,0,400,0,400,120,0,120` → `0,0,338.34,0,338.34,43,0,43` · tf `400px` → `338.344px` */
  expect(r.cornersKept,
    '★축정렬 네 점이 ★복원 뒤에도 ★유지됐다 — ★고쳐졌다면 이 칸과 Y2 를 닫고 명부에서 지워라'
  ).toBe(false);
  /* ★행렬이 ★항등으로 ★돌아갔다 = ★변형이 ★사라졌다 */
  const d1 = identDiffOf(r.after.m);
  expect(d1, `★행렬 성분이 16 개가 아니다 — 이 검사의 자가 헛돈다 (${r.after.m})`).not.toBeNull();
  expect(d1, `★행렬이 항등이 아니다 (최대차 ${d1}) — 증상의 꼴이 바뀌었다`).toBeLessThan(1e-6);
  expect(r.after.tfW, `★프레임 폭이 안 바뀌었다 (${r.after.tfW})`).not.toBe(r.before.tfW);
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
