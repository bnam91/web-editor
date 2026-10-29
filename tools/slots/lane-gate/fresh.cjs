// 진짜 새 프로젝트: 프로젝트 목록으로 간 뒤 New Design · 실패를 숨기지 않는다(스윕B 무효 까닭)
const { chromium } = require(process.env.PW_PATH || (() => { throw new Error('PW_PATH(아이맥 playwright 경로) 필요'); })());
(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:' + (process.env.LANE_CDP || (() => { throw new Error('LANE_CDP 필요'); })()));
  const ctx = b.contexts()[0]; const p = ctx.pages()[0];
  const before = p.url();
  await p.goto('file://' + (process.env.TREE || (() => { throw new Error('TREE 필요'); })()) + '/pages/projects.html');
  await p.click('#btn-new');
  await p.waitForURL(/index\.html\?project=/, { timeout: 30000 });
  await p.waitForFunction(() => typeof window.deselectAll === 'function' && document.querySelector('#canvas'), null, { timeout: 30000 });
  const st = await p.evaluate(() => ({ url: location.href.slice(-30), sections: document.querySelectorAll('#canvas .section-block').length, nodes: document.getElementById('canvas').getElementsByTagName('*').length }));
  if (p.url() === before || st.sections !== 0) { console.log('★새 프로젝트 아님', JSON.stringify(st)); process.exit(4); }
  console.log('새 프로젝트', JSON.stringify(st)); await b.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
