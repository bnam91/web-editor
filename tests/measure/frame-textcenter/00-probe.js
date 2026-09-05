const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1600, height: 1600 } });
  pg.on('console', m => { if (m.type()==='error') console.log('CONSOLE ERR:', m.text().slice(0,300)); });
  await pg.goto('http://127.0.0.1:8899/tests/measure/frame-textcenter/harness.html', { waitUntil: 'networkidle' });
  const out = await pg.evaluate(() => ({
    loaded: window.__loaded, err: window.__err,
    hasBindFrameDropZone: typeof window.bindFrameDropZone,
    hasAddText: typeof window.addTextBlock,
    hasMakeFrame: typeof window.makeFrameBlock,
  }));
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})();
