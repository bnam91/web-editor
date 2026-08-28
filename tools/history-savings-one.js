/* history-savings-one.js — 프로젝트 «한 개»의 스냅샷들을 실제로 파싱·외부화해 정밀 계측한다.
 * ★READ-ONLY. 에셋도 안 쓴다(해시만 계산). DESIGN-version-history.md §2-3.
 *   실행: node --max-old-space-size=4096 tools/history-savings-one.js proj_1787026440333
 *   2026-08-27 실측: 237.5MB → 3.9MB (61배) · 이미지 7개가 6버전에 걸쳐 dedup(추가 0바이트) */
// READ-ONLY 계측: 스냅샷 시점 외부화가 얼마나 줄이고, 스냅샷 간 에셋이 얼마나 겹치는가.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const P=path.join(process.env.HOME,'Library/Application Support/GODITOR/projects');
const RE=/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/]+=*/g;
function slots(d){const s=[];if(d&&Array.isArray(d.pages))d.pages.forEach((p,i)=>{if(p&&typeof p.canvas==='string')s.push({get:()=>d.pages[i].canvas,set:v=>{d.pages[i].canvas=v}})});else if(d&&typeof d.canvas==='string')s.push({get:()=>d.canvas,set:v=>{d.canvas=v}});return s}
function ext(mime){return({'image/jpeg':'jpg','image/jpg':'jpg','image/svg+xml':'svg','image/webp':'webp','image/gif':'gif'})[String(mime||'').toLowerCase()]||'png'}
const pid=process.argv[2];
const hdir=path.join(P,pid,'proj_history');
const files=fs.existsSync(hdir)?fs.readdirSync(hdir).filter(f=>f.endsWith('.json')).sort():[];
const cur=path.join(P,pid,'proj.json');
const targets=[...files.map(f=>path.join(hdir,f)), cur].filter(f=>fs.existsSync(f));
const globalAssets=new Map(); // hash -> bytes
let totalBefore=0,totalAfter=0,newBytesTotal=0;
for(const f of targets){
  const raw=fs.readFileSync(f,'utf8'); const before=Buffer.byteLength(raw);
  let d; try{d=JSON.parse(raw)}catch(e){console.log(path.basename(f),'PARSE FAIL');continue}
  const S=slots(d); const uris=new Set();
  for(const s of S){const h=s.get(); if(h.indexOf('data:image')===-1)continue; RE.lastIndex=0; let m; while((m=RE.exec(h))!==null){ if(/^\s+[A-Za-z0-9+/]/.test(h.slice(RE.lastIndex)))continue; uris.add(m[0]); }}
  const cache=new Map(); let newBytes=0, reused=0;
  for(const u of uris){ const c=u.indexOf(','); const hdr=u.slice(5,c); const mime=hdr.split(';')[0]; const buf=Buffer.from(u.slice(c+1),'base64'); if(!buf.length)continue;
    const hash=crypto.createHash('sha256').update(buf).digest('hex').slice(0,16); const fn=hash+'.'+ext(mime);
    cache.set(u,'goya-asset://'+pid+'/'+fn);
    if(globalAssets.has(hash)) reused++; else { globalAssets.set(hash,buf.length); newBytes+=buf.length; } }
  const sorted=[...cache.keys()].sort((a,b)=>b.length-a.length);
  for(const s of S){let h=s.get(); if(h.indexOf('data:image')===-1)continue; for(const u of sorted) if(h.indexOf(u)!==-1) h=h.split(u).join(cache.get(u)); s.set(h);}
  const after=Buffer.byteLength(JSON.stringify(d,null,2));
  totalBefore+=before; totalAfter+=after; newBytesTotal+=newBytes;
  console.log(`${path.basename(f).padEnd(20)} before=${(before/1048576).toFixed(2)}MB after=${(after/1048576).toFixed(3)}MB imgs=${String(uris.size).padStart(3)} new=${String(cache.size-reused).padStart(3)} reused=${String(reused).padStart(3)} newAssetBytes=${(newBytes/1048576).toFixed(2)}MB`);
}
console.log('---');
console.log(`합계 JSON: ${(totalBefore/1048576).toFixed(1)}MB → ${(totalAfter/1048576).toFixed(2)}MB`);
console.log(`에셋 고유본: ${globalAssets.size}개 / ${(newBytesTotal/1048576).toFixed(1)}MB`);
console.log(`신방식 총합(JSON+에셋) = ${((totalAfter+newBytesTotal)/1048576).toFixed(1)}MB  vs 구방식 ${(totalBefore/1048576).toFixed(1)}MB`);
