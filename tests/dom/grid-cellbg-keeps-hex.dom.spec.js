/* grid-cellbg-keeps-hex.dom.spec.js — E127 ⒜(지디 10-06 · ⑴ 회귀): 칸 배경이 «설정돼» 있으면 그리드 줄은 프리셋 변수를 쓰지 않고 그 배경에 맞는 옛 hex
 * 증상(잼 · 사본 proj_1790917712926 sec_ts0he_hraqygg): 어두운 섹션 프리셋(body #aaaaaa) + 흰 칸(data-cells bg '#ffffff') → E127 뒤 본문 rgb(170,170,170) on 흰색(옅어짐) · dev rgb(85,85,85).
 * 뜻(지디): «글자가 섹션 색을 따른다»가 E127 의 뜻 — 칸이 «자기 배경을 칠하면» 그 바깥. 조건은 하나 «칸 배경 설정됨»(밝음/어두움 판정 아님 —
 *   프리셋은 섹션 배경에 맞춰 고른 것이므로). 어두운 칸은 원래도 on-dark 표 hex 라 두 문구가 같다(㉢ 잼 — 아래 ⒤-2 값).
 * ⒦ 전제: 재기 전에 칸 계산 배경을 찍고 단언한다(인라인 말고 계산값 · 알파 포함).
 * ⒥ 개선 잠금: 칸 배경이 «없으면» 변수가 걸린다 — 없으면 리팩터가 변수를 떨궈도 초록으로 남는다.
 * ⒧ 음성대조: 고침을 끈 판(e1452fa5 · 또는 그 한 줄을 되돌린 나무)에서 ⒤-1 빨강 — 로그로 남김.
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 사본 섹션과 같은 어두운 프리셋 변수(인라인 --preset-*) · 검정 배경 */
const DARK = `data-preset="dark" style="--preset-h1-color:#ffffff;--preset-h2-color:#eeeeee;--preset-h3-color:#cccccc;--preset-body-color:#aaaaaa;--preset-caption-color:#666666;background:#000000"`;
/* 밝은 섹션 + 기본 아닌 프리셋(brand 값) */
const BRAND = `data-preset="brand" style="--preset-h1-color:#1a3a6b;--preset-h2-color:#2d4a7a;--preset-h3-color:#3d5a8a;--preset-body-color:#444444;--preset-caption-color:#888888;background:#ffffff"`;

/* ㉢ 잰 값(10-06 · e1452fa5 = dev 0f572e2a 같음): 어두운 칸 #111111 + 어두운 프리셋 → on-dark 표 hex, 변수 없음 ⇒ 두 문구가 같은 결과.
 *   (같은 판 흰 칸 #ffffff: h1 var → rgb(255,255,255) «흰 위 흰» · body rgb(170,170,170) · caption rgb(102,102,102) — 고칠 대상) */
const C_DARK_EXPECT = {
  h1: { inline: '#ffffff', computed: 'rgb(255, 255, 255)' },
  body: { inline: '#f2f2f2', computed: 'rgb(242, 242, 242)' },
  caption: { inline: '#cccccc', computed: 'rgb(204, 204, 204)' },
};

async function grid(page, secAttrs, bg) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(([secAttrs, bg]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sK" data-section="1" ${secAttrs}><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="rK" data-layout="stack"></div></div></div>`);
    window.rebindAll?.();
    const L = [{ type: 'h1', text: '제목' }, { type: 'body', text: '본문' }, { type: 'caption', text: '캡션' }];
    const cell = { lines: L }; if (bg) cell.bg = bg;
    const { block } = window.makeGridBlock({ cols: [{ width: 1, lines: L }], rows: [{ height: 140 }], cells: [[cell]] });
    document.getElementById('rK').appendChild(block); window.renderGridBlock(block); window.applyZoom?.(100);
    const cellEl = block.querySelector('.grd-cell');
    const lines = Object.fromEntries([...block.querySelectorAll('.grd-line')].map(l => [(l.className.match(/grd-(\w+)$/) || [])[1],
      { inline: (l.getAttribute('style').match(/color:([^;]+);/) || [])[1] || null, computed: getComputedStyle(l).color }]));
    return { cellBg: getComputedStyle(cellEl).backgroundColor, lines };
  }, [secAttrs, bg]);
  console.log(`[E127a] sec=${secAttrs.slice(13, 18)} bg=${bg} ⒦ cellBg=${r.cellBg} ${JSON.stringify(r.lines)}`);
  return { errs, ...r };
}

test('E127a ⒤-1 [새 것] 흰 칸 배경(#ffffff) + 어두운 섹션 프리셋 → 옛 hex(본문 #555555 · rgb 85) — 프리셋 #aaaaaa 아님', async ({ page }) => {
  const g = await grid(page, DARK, '#ffffff');
  expect(g.cellBg, '⒦ 전제 — 칸이 정말 흰 배경을 칠했다(계산값)').toBe('rgb(255, 255, 255)');
  expect(g.lines, '⒤-1 칸 배경 설정됨 ⇒ 변수 안 씀 · 옛 hex').toEqual({
    h1: { inline: '#111111', computed: 'rgb(17, 17, 17)' },
    body: { inline: '#555555', computed: 'rgb(85, 85, 85)' },
    caption: { inline: '#999999', computed: 'rgb(153, 153, 153)' },
  });
  expect(g.errs).toEqual([]);
});

test('E127a ⒤-2 [지킴] 어두운 칸 배경(#111111) + 어두운 섹션 프리셋 → 그대로(on-dark 표 hex · ㉢ 잰 값)', async ({ page }) => {
  const g = await grid(page, DARK, '#111111');
  expect(g.cellBg, '⒦ 전제 — 칸이 정말 어두운 배경을 칠했다(계산값)').toBe('rgb(17, 17, 17)');
  expect(g.lines, '⒤-2 ㉢ 값 그대로(두 문구 «설정됨» · «밝을 때만» 이 같은 자리)').toEqual(C_DARK_EXPECT);
  expect(g.errs).toEqual([]);
});

test('E127a ⒥ [지킴 · 개선 잠금] 칸 배경 없음 + 밝은 섹션의 기본 아닌 프리셋(brand) → 변수가 걸려 프리셋 색', async ({ page }) => {
  const g = await grid(page, BRAND, null);
  expect(g.cellBg, '⒦ 전제 — 칸은 배경을 안 칠했다(투명 · 알파 0)').toBe('rgba(0, 0, 0, 0)');
  expect(g.lines, '⒥ 칸 배경 없음 ⇒ var(--preset-<역할>-color, hex) · 계산 = 섹션 프리셋').toEqual({
    h1: { inline: 'var(--preset-h1-color, #111111)', computed: 'rgb(26, 58, 107)' },
    body: { inline: 'var(--preset-body-color, #555555)', computed: 'rgb(68, 68, 68)' },
    caption: { inline: 'var(--preset-caption-color, #999999)', computed: 'rgb(136, 136, 136)' },
  });
  expect(g.errs).toEqual([]);
});
