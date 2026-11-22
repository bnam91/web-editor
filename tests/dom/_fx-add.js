/* _fx-add.js — 패널 «효과 추가»를 두 꼴 다 다룬다(기준판 통일 261122 · 탑).
 *   텍스트 패널(시안 v10 · 현빈 GO 261120) = 머리 ＋ 단추 #<P>-fx-add-btn → 종류 메뉴 #<P>-fx-menu [data-fx]
 *   도형·에셋 등 = 옛 고르개 <select id="<P>-fx-add">(option value = 종류)
 * ⛔spec 마다 따로 짓지 않는다 — dev 쪽 spec 들이 옛 고르개만 알아 텍스트에서 selectOption 시간초과로 무더기 빨강이 났다(tpf42 · 058e3e7d0). */
async function addFx(page, P, key) {
  if (await page.locator(`#${P}-fx-add-btn`).count()) {
    await page.locator(`#${P}-fx-add-btn`).scrollIntoViewIfNeeded();
    await page.click(`#${P}-fx-add-btn`);
    await page.click(`#${P}-fx-menu [data-fx="${key}"]`);
    return;
  }
  await page.locator(`#${P}-fx-add`).scrollIntoViewIfNeeded();
  await page.selectOption(`#${P}-fx-add`, key);
}
/** 지금 «더할 수 있는» 종류 키 목록(메뉴 항목 또는 고르개 option) · 둘 다 없으면 null */
function fxAddKeys(page, P) {
  return page.evaluate((P) => {
    const m = document.getElementById(`${P}-fx-menu`);
    if (m) return [...m.querySelectorAll('[data-fx]')].map((b) => b.dataset.fx);
    const a = document.getElementById(`${P}-fx-add`);
    return a ? [...a.options].map((o) => o.value).filter(Boolean) : null;
  }, P);
}
/** 종류 키의 보이는 이름(메뉴 글 또는 option 글) */
function fxAddLabel(page, P, key) {
  return page.evaluate(([P, key]) => {
    const b = document.querySelector(`#${P}-fx-menu [data-fx="${key}"]`) || document.querySelector(`#${P}-fx-add option[value="${key}"]`);
    return b ? b.textContent.trim() : null;
  }, [P, key]);
}
/** 패널에 «효과 추가» 입구(단추 또는 고르개)가 있나 */
const FX_ADD_SEL = (P) => `#${P}-fx-add-btn, #${P}-fx-add`;
module.exports = { addFx, fxAddKeys, fxAddLabel, FX_ADD_SEL };
