/* history-savings-probe.js — proj_history 전체가 «스냅샷 시점 외부화»로 얼마나 줄어드는지 계측한다.
 * ★READ-ONLY. 디스크에 아무것도 안 쓴다. DESIGN-version-history.md §2-3 의 회귀 기준선.
 *   실행: node --max-old-space-size=4096 tools/history-savings-probe.js
 *   2026-08-27 실측: 2,511.1MB → 107.3MB (4.3%) · 스냅샷 217개 · 고유에셋 117개/71.1MB
 * ⚠️ JSON.parse 없이 raw 정규식만 쓰는 «추정»이다. 정밀값은 history-savings-one.js 로. */
// 전체 proj_history 저비용 추정 — JSON.parse 없이 raw 정규식으로만.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const P=path.join(process.env.HOME,'Library/Application Support/GODITOR/projects');
const RE=/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+\/]+=*/g;
let before=0, afterEst=0, assetBytes=0, files=0, projs=0;
const seen=new Set();
for(const d of fs.readdirSync(P)){
  const hdir=path.join(P,d,'proj_history');
  if(!fs.existsSync(hdir)) continue; projs++;
  for(const f of fs.readdirSync(hdir).filter(x=>x.endsWith('.json'))){
    const raw=fs.readFileSync(path.join(hdir,f),'utf8'); files++;
    before+=Buffer.byteLength(raw);
    let strip=0,cnt=0; RE.lastIndex=0; let m;
    const local=new Set();
    while((m=RE.exec(raw))!==null){ strip+=m[0].length; cnt++;
      if(!local.has(m[0])){ local.add(m[0]);
        const c=m[0].indexOf(','); const buf=Buffer.from(m[0].slice(c+1),'base64');
        const h=crypto.createHash('sha256').update(buf).digest('hex').slice(0,16);
        if(!seen.has(h)){ seen.add(h); assetBytes+=buf.length; } } }
    afterEst += Buffer.byteLength(raw) - strip + cnt*60;
  }
}
const MB=x=>(x/1048576).toFixed(1);
console.log(`프로젝트 ${projs}개 · 스냅샷 ${files}개`);
console.log(`현행 JSON 합계   : ${MB(before)} MB`);
console.log(`외부화 후 JSON   : ${MB(afterEst)} MB`);
console.log(`고유 에셋(dedup) : ${seen.size}개 / ${MB(assetBytes)} MB`);
console.log(`신방식 총합      : ${MB(afterEst+assetBytes)} MB  (현행의 ${((afterEst+assetBytes)/before*100).toFixed(1)}%)`);
