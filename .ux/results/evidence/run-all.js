// U-layout full observe — atomic single run
const { CDP } = require('./cdp-helper');
const fs = require('fs');

(async () => {
  const c = await CDP.connect();
  const log = (...a) => console.log(...a);
  const shotFull = async name => { const r = await c.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(name, Buffer.from(r.data, 'base64')); };
  const shotClip = async (name, [x, y, w, h]) => { const r = await c.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale: 1.5 } }); fs.writeFileSync(name, Buffer.from(r.data, 'base64')); };

  const url = await c.eval('location.href');
  log('URL', url);
  if (!url.includes('index.html')) { log('WRONG PAGE'); process.exit(2); }
  await c.eval(`new Promise(res => { const t = setInterval(() => { if (document.querySelector('.section-block')) { clearInterval(t); res(1); } }, 200); setTimeout(() => { clearInterval(t); res(0); }, 10000); })`);

  // ---- geometry
  const geo = await c.eval(`(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    return { vw: innerWidth, vh: innerHeight, left: r('#panel-left'), right: r('#panel-right'), topbar: r('#topbar'), fp: r('#floating-panel') };
  })()`);
  log('GEO', JSON.stringify(geo));

  // ---- 1) full
  await shotFull('layout-01-full.png');
  await shotClip('layout-02-topbar.png', [0, 0, geo.vw, 44]);
  await shotClip('layout-03-left-panel.png', geo.left);

  // ---- 2) select TEXT block -> prop panel
  const selT = await c.eval(`(() => {
    const tb = document.querySelector('.text-block');
    if (!tb) return 'NOTB';
    tb.scrollIntoView({ block: 'center' });
    const r = tb.getBoundingClientRect();
    const mk = t => new MouseEvent(t, { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
    tb.dispatchEvent(mk('mousedown')); tb.dispatchEvent(mk('mouseup')); tb.dispatchEvent(mk('click'));
    return 'SEL ' + tb.id;
  })()`);
  log('TEXTSEL', selT);
  await new Promise(r => setTimeout(r, 500));
  const propText = await c.eval(`(() => {
    const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const pb = document.querySelector('#panel-right .panel-body');
    const sep = ' || ';
    const groups = pb ? [...pb.querySelectorAll(':scope > *')].filter(vis).map(g => ({ head: (g.querySelector('.prop-section-title,h4') || {}).innerText, text: (g.innerText || '').split(String.fromCharCode(10)).join(' / ').slice(0, 200), h: Math.round(g.getBoundingClientRect().height) })) : null;
    return { selNow: (document.querySelector('.text-block.selected') || {}).id, groups, scrollH: pb.scrollHeight, clientH: pb.clientHeight };
  })()`);
  log('PROPTEXT', JSON.stringify(propText, null, 1));
  await shotClip('layout-07-prop-panel-text.png', geo.right);

  // ---- 3) select SECTION -> section toolbar
  const selS = await c.eval(`(() => {
    const sec = document.querySelector('.section-block');
    sec.scrollIntoView({ block: 'center' });
    const r = sec.getBoundingClientRect();
    const mk = (t, x, y) => new MouseEvent(t, { bubbles: true, clientX: x, clientY: y });
    sec.dispatchEvent(mk('mousedown', r.x + 4, r.y + 4)); sec.dispatchEvent(mk('mouseup', r.x + 4, r.y + 4)); sec.dispatchEvent(mk('click', r.x + 4, r.y + 4));
    return 'SEL ' + sec.id;
  })()`);
  log('SECSEL', selS);
  await new Promise(r => setTimeout(r, 500));
  const secInfo = await c.eval(`(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
    const tools = [...document.querySelectorAll('[class*="section-toolbar"], [class*="sec-toolbar"], [class*="st-"], [id*="section-tool"]')].filter(vis).slice(0, 25).map(e => ({ cls: (typeof e.className === 'string' ? e.className : '').slice(0, 50), title: e.title || undefined, text: (e.innerText || '').slice(0, 25), rect: (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(e.getBoundingClientRect()) }));
    const sec = document.querySelector('.section-block.selected');
    const propHead = (document.querySelector('#panel-right .panel-body') || { innerText: '' }).innerText.split(String.fromCharCode(10)).slice(0, 25).join(' / ');
    const secKidsUI = sec ? [...sec.querySelectorAll('button, [class*=handle], [class*=ctrl], [class*=toolbar]')].filter(vis).slice(0, 20).map(e => ({ cls: (typeof e.className === 'string' ? e.className : '').slice(0, 45), title: e.title || undefined, text: (e.innerText || '').trim().slice(0, 15) })) : null;
    return { secSel: sec ? sec.id : null, tools, secKidsUI, propHead: propHead.slice(0, 400) };
  })()`);
  log('SECINFO', JSON.stringify(secInfo, null, 1));
  await shotFull('layout-08-section-selected.png');
  await shotClip('layout-09-prop-panel-section.png', geo.right);

  // ---- 4) misc panels presence
  const misc = await c.eval(`(() => {
    const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { vis: r.width > 0 && r.height > 0 && cs.display !== 'none', rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], text: (e.innerText || '').slice(0, 60) }; };
    return {
      templatesBar: q('#templates-bar'), tplBrowser: q('[class*=tpl-browser]'), compShelf: q('[class*=comp-shelf]'),
      assetsPanel: q('[class*=assets-panel]') || q('#assets-panel'), aiImg: q('[class*=ai-img]') || q('[class*=aig-]'),
      dsPanel: q('#design-system-panel'), pmPanel: q('#claude-pm-panel') || q('[id^=claude-pm]'),
      toast: q('#editor-toast'), varPanel: q('#var-panel'), rpTop: q('#rp-top-row'), zoomCtrl: q('#zoom-ctrl'),
      notch: q('#canvas-notch-bar'), graph: q('[class*=grb-data]'), picker: q('[class*=goya-cp]'),
      scratch: document.querySelectorAll('.scratch-item').length,
      leftTabs: [...document.querySelectorAll('.panel-tabs > *')].map(t => ({ cls: (t.className || '').slice(0, 40), title: t.title || t.getAttribute('aria-label') || (t.innerText || '').trim().slice(0, 12), active: (t.className || '').includes('active') }))
    };
  })()`);
  log('MISC', JSON.stringify(misc, null, 1));

  // ---- 5) publish dropdown open
  const pub = await c.eval(`(() => {
    const b = document.querySelector('#publish-btn'); if (!b) return 'nobtn';
    b.click();
    return 'clicked';
  })()`);
  await new Promise(r => setTimeout(r, 400));
  const pubInfo = await c.eval(`(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.display !== 'none'; };
    const items = [...document.querySelectorAll('[class*=pub-dd]')].filter(vis).map(e => ({ cls: (e.className || '').slice(0, 40), text: (e.innerText || '').split(String.fromCharCode(10)).join(' / ').slice(0, 200), rect: (b => [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)])(e.getBoundingClientRect()) }));
    return items;
  })()`);
  log('PUB', JSON.stringify(pubInfo, null, 1));
  await shotFull('layout-10-publish-dropdown.png');
  await c.eval(`document.querySelector('#publish-btn') && document.querySelector('#publish-btn').click()`); // close

  // ---- 6) floating panel clip
  if (geo.fp) await shotClip('layout-05-floating-bar.png', [Math.max(0, geo.fp[0] - 20), geo.fp[1] - 60, Math.min(geo.vw, geo.fp[2] + 40), geo.fp[3] + 70]);

  c.close();
  log('ALL DONE');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
