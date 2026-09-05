const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const [port, pid, tag, ...secs] = process.argv.slice(2);
(async () => {
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = pages.find(p => p.type === 'page' && !p.url.includes('devtools'));
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 512*1024*1024 });
  let mid=0; const pend={};
  ws.on('message', d=>{const m=JSON.parse(d); if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id];}});
  await new Promise(r=>ws.on('open',r));
  const ev=(e,ms=300000)=>new Promise((ok,no)=>{const id=++mid;pend[id]=ok;ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:e,awaitPromise:true,returnByValue:true}}));setTimeout(()=>no(new Error('timeout')),ms);});
  const val=r=>{if(r?.result?.exceptionDetails)throw new Error(String(r.result.exceptionDetails.text||'').slice(0,160));return r?.result?.result?.value;};
  await ev(`(async()=>{await window.electronAPI.navigateToProjects();return 1})()`);
  await new Promise(r=>setTimeout(r,3000));
  await ev(`(()=>{const c=[...document.querySelectorAll(".project-card")].find(e=>e.dataset.id===${JSON.stringify(pid)});c&&c.click();return 1})()`);
  let n=0,w=0; while(w<180){await new Promise(r=>setTimeout(r,2000));w+=2;n=val(await ev(`(()=>document.querySelectorAll(".section-block").length)()`))||0;if(n>0){await new Promise(r=>setTimeout(r,3000));break;}}
  for (const sid of secs) {
    for (const W of [860]) {
      let out;
      try {
        out = val(await ev(`(async()=>{
          const G=window.__exportGate, sec=document.getElementById(${JSON.stringify(sid)});
          if(!sec)return JSON.stringify({sid:${JSON.stringify(sid)},err:'nosec'});
          const bg=G.sectionBgColor(sec);
          const du=await window.exportSection(sec,'png',${W},{returnDataUrl:true});
          const im=new Image(); im.src=du; await new Promise(r=>{im.onload=r;});
          const ec=document.createElement('canvas'); ec.width=im.width; ec.height=im.height; ec.getContext('2d').drawImage(im,0,0);
          const t1=await G.captureTruth(sec,${W},bg);
          const m=G.compareRGBA(G.canvasToImageData(ec), G.canvasToImageData(t1.canvas));
          const v=G.judgeExportDiff(m,{native:true,format:'png',imgTimedOut:t1.imgTimedOut,repro:null});
          return JSON.stringify({mut:${JSON.stringify(tag)},sid:${JSON.stringify(sid)},w:${W},tier:v.tier,reasons:v.reasons,
            total:m.total,maxCell:m.maxCell,blobPx:m.blobPx,band:m.bandCount+'/'+m.truthBandCount,bandMis:m.bandMismatch,
            size:m.sizeMismatch,he:ec.height,ht:t1.canvas.height,to:t1.imgTimedOut});
        })()`));
      } catch (e) { out = JSON.stringify({mut:tag,sid,w:W,err:e.message}); }
      console.log(out);
    }
  }
  ws.close(); process.exit(0);
})().catch(e=>{console.error(JSON.stringify({mut:tag,err:e.message}));process.exit(1)});
