// U-layout remaining areas — reversible interactions only
const { CDP } = require('./cdp-helper');
const fs = require('fs');
(async () => {
  const c = await CDP.connect();
  const shotFull = async name => { const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(name, Buffer.from(r.data, 'base64')); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // 0) identify rp-top blue button + left tabs
  const ids = await c.eval(`(() => {
    const row = document.querySelector('#rp-top-row');
    const kids = row ? [...row.querySelectorAll('button, div')].map(e => ({ id: e.id || undefined, cls: (e.className || '').slice(0, 30), title: e.title || undefined, text: (e.innerText || '').trim().slice(0, 10) })) : null;
    const tabs = [...document.querySelectorAll('.panel-tabs > *')].map(t => ({ cls: (t.className || '').slice(0, 40), title: t.title || undefined, id: t.id || undefined }));
    return { kids, tabs };
  })()`);
  console.log('IDS', JSON.stringify(ids, null, 1));

  // 1) settings modal
  await c.eval(`document.querySelector('#settings-btn').click()`);
  await sleep(500);
  const setInfo = await c.eval(`(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none'; };
    const m = [...document.querySelectorAll('[class*=settings-]')].filter(vis).slice(0, 5).map(e => ({ cls: (e.className || '').slice(0, 40), rect: (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(e.getBoundingClientRect()), text: (e.innerText || '').split(String.fromCharCode(10)).slice(0, 20).join(' / ').slice(0, 300) }));
    return m;
  })()`);
  console.log('SETTINGS', JSON.stringify(setInfo, null, 1));
  await shotFull('layout-11-settings-modal.png');
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);
  const closed = await c.eval(`(() => { const e = [...document.querySelectorAll('[class*=settings-]')].find(x => x.getBoundingClientRect().width > 200); return e ? 'STILL OPEN' : 'closed'; })()`);
  console.log('SETTINGS_AFTER_ESC', closed);
  if (closed === 'STILL OPEN') { await c.eval(`(document.querySelector('[class*=settings-] [class*=close], .settings-close') || {click(){}} ).click()`); await sleep(300); }

  // 2) templates bar open
  const tplOpen = await c.eval(`(() => {
    const bar = [...document.querySelectorAll('div')].find(e => (e.innerText || '').trim() === 'TEMPLATES' && e.getBoundingClientRect().height < 40 && e.getBoundingClientRect().height > 0);
    if (!bar) return 'nobar';
    bar.click(); return 'clicked ' + (bar.className || bar.id);
  })()`);
  console.log('TPL', tplOpen);
  await sleep(600);
  const tplInfo = await c.eval(`(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 50 && r.height > 50 && cs.display !== 'none'; };
    const els = [...document.querySelectorAll('[class*=tpl-]')].filter(vis).slice(0, 8).map(e => ({ cls: (e.className || '').slice(0, 40), rect: (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(e.getBoundingClientRect()), text: (e.innerText || '').split(String.fromCharCode(10)).slice(0, 12).join(' / ').slice(0, 200) }));
    return els;
  })()`);
  console.log('TPLINFO', JSON.stringify(tplInfo, null, 1));
  await shotFull('layout-12-template-browser.png');
  // close (click bar again or Esc)
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(300);

  // 3) left panel tabs — click each non-active, capture asset/folder tab
  const tabRes = await c.eval(`(() => {
    const tabs = [...document.querySelectorAll('.panel-tabs > *')];
    const out = tabs.map(t => ({ title: t.title, cls: t.className }));
    const folder = tabs.find(t => (t.title || '').match(/asset|file|folder|자산|에셋/i) && !t.className.includes('active'));
    return JSON.stringify(out);
  })()`);
  console.log('TABS', tabRes);

  c.close();
  console.log('REST DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
