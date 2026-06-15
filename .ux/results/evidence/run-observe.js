// U-layout observe runner — arg: step name
const { CDP } = require('./cdp-helper');
const fs = require('fs');

const NL = String.fromCharCode(10);

async function main() {
  const step = process.argv[2];
  const c = await CDP.connect();
  const url = await c.eval('location.href');
  if (!url.includes('index.html')) { console.log('WRONG_PAGE ' + url); process.exit(2); }

  if (step === 'prop-text') {
    const selres = await c.eval(`(() => {
      const tb = [...document.querySelectorAll('.text-block')][0];
      if (!tb) return 'NOTB';
      tb.scrollIntoView({block:'center'});
      const r = tb.getBoundingClientRect();
      const ev = t => new MouseEvent(t, {bubbles:true, clientX:r.x+r.width/2, clientY:r.y+r.height/2});
      tb.dispatchEvent(ev('mousedown')); tb.dispatchEvent(ev('mouseup')); tb.dispatchEvent(ev('click'));
      return 'SEL ' + tb.id;
    })()`);
    console.log(selres);
    await new Promise(r => setTimeout(r, 400));
    const d = await c.eval(`(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width>0&&r.height>0; };
      const pb = document.querySelector('#panel-right .panel-body');
      const groups = pb ? [...pb.querySelectorAll(':scope > *')].filter(vis).map(g => ({head:(g.querySelector('.prop-section-title,h4')||{}).innerText, text:(g.innerText||'').split(String.fromCharCode(10)).join(' / ').slice(0,170), h:Math.round(g.getBoundingClientRect().height)})) : null;
      const right = document.querySelector('#panel-right').getBoundingClientRect();
      const st = document.querySelector('.section-toolbar');
      const stInfo = st ? {vis: vis(st), btns: [...st.querySelectorAll('button')].map(b=>b.title||b.innerText.trim().slice(0,15))} : 'no .section-toolbar';
      const selId = (document.querySelector('.text-block.selected,.canvas-block.selected')||{}).id;
      return { selId, groups, right: [Math.round(right.x),Math.round(right.y),Math.round(right.width),Math.round(right.height)], scrollH: pb.scrollHeight, clientH: pb.clientHeight, stInfo };
    })()`);
    console.log(JSON.stringify(d, null, 1));
    const [x, y, w, h] = d.right;
    const r = await c.send('Page.captureScreenshot', { format: 'png', clip: { x, y, width: w, height: h, scale: 1.5 } });
    fs.writeFileSync('layout-07-prop-panel-text.png', Buffer.from(r.data, 'base64'));
  }

  if (step === 'section-toolbar') {
    // select a section: click its header/edge
    const info = await c.eval(`(() => {
      const sec = document.querySelector('.section-block');
      sec.scrollIntoView({block:'center'});
      const r = sec.getBoundingClientRect();
      const ev = t => new MouseEvent(t, {bubbles:true, clientX: r.x+r.width/2, clientY: r.y+6});
      sec.dispatchEvent(ev('mousedown')); sec.dispatchEvent(ev('mouseup')); sec.dispatchEvent(ev('click'));
      return sec.id;
    })()`);
    await new Promise(r => setTimeout(r, 600));
    const d = await c.eval(`(() => {
      const vis = el => { const r = el.getBoundingClientRect(); return r.width>0&&r.height>0 && getComputedStyle(el).display!=='none'; };
      const sts = [...document.querySelectorAll('.section-toolbar, [class*=section-toolbar], .st-btn')].map(e => ({cls:(e.className||'').slice(0,40), vis:vis(e), rect:(()=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)]})(), title:e.title||undefined, text:(e.innerText||'').slice(0,20)}));
      // any floating toolbar near selected section
      const sec = document.querySelector('.section-block.selected');
      const secRect = sec ? sec.getBoundingClientRect() : null;
      const propHead = (document.querySelector('#panel-right .panel-body')||{}).innerText;
      return { sts: sts.slice(0,30), secId: sec?sec.id:null, secRect: secRect?[Math.round(secRect.x),Math.round(secRect.y),Math.round(secRect.width),Math.round(secRect.height)]:null, propFirst: propHead?propHead.slice(0,120):null };
    })()`);
    console.log('clicked', info);
    console.log(JSON.stringify(d, null, 1));
    const r2 = await c.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('layout-08-section-selected.png', Buffer.from(r2.data, 'base64'));
  }

  if (step === 'misc-panels') {
    const d = await c.eval(`(() => {
      const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { vis: r.width>0&&r.height>0&&cs.display!=='none', rect: [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)], text: (e.innerText||'').slice(0,80) }; };
      return {
        templates: q('#templates-bar') || q('[class*=tpl-browser]') || q('.comp-shelf'),
        templatesBtn: (() => { const els = [...document.querySelectorAll('div,button')].filter(e => (e.innerText||'').trim() === 'TEMPLATES' && e.children.length < 4); return els.map(e => ({cls: (e.className||'').slice(0,40), rect: (r=>[Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)])(e.getBoundingClientRect())})); })(),
        assets: q('[class*=assets-panel]') || q('.assets-grid'),
        ds: q('#design-system-panel'),
        pm: q('#claude-pm-panel') || q('[id^=claude-pm]'),
        toast: q('#editor-toast'),
        varPanel: q('#var-panel'),
        rpTop: q('#rp-top-row'),
        zoom: q('#zoom-ctrl'),
        notch: q('#canvas-notch-bar'),
        scratchCount: document.querySelectorAll('.scratch-item').length
      };
    })()`);
    console.log(JSON.stringify(d, null, 1));
  }

  c.close();
  console.log('DONE ' + step);
}
main().catch(e => { console.error('ERR', e.message); process.exit(1); });
