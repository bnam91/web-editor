#!/bin/bash
# 프로브 기반 변이 스윕 — mutation-sweep.js 는 «유닛»만 돌린다.
# 실 DOM 에서만 잴 수 있는 가드(킬스위치·프리셋 유실)는 프로브가 잡으므로 여기서 따로 건다.
# 사용: bash tools/probe-sweep.sh
cd "$(dirname "$0")/.." || exit 1
node - "$@" <<'JS'
const fs=require('fs'),cp=require('child_process');
const muts=JSON.parse(fs.readFileSync('tools/mutations.json','utf8'))
  .filter(m=>/^(FIGMA|LOGO)-/.test(m.name));
const probes=['tools/figma-killswitch-probe/run.js','tools/logo-preset-probe/run.js'];
let survived=0;
for(const m of muts){
  const orig=fs.readFileSync(m.file,'utf8');
  if(!orig.includes(m.find)){console.log(`⚠️ SKIP ${m.name} — find 없음`);continue;}
  fs.writeFileSync(m.file,orig.split(m.find).join(m.replace));
  let dead=[];
  try{ for(const p of probes){ const r=cp.spawnSync('node',[p],{encoding:'utf8',timeout:120000});
    if(r.status!==0) dead.push(p.split('/')[1]); } }
  finally{ fs.writeFileSync(m.file,orig); }
  if(dead.length) console.log(`✅ 사망  ${m.name}  → ${dead.join(', ')}`);
  else { survived++; console.log(`❌ 생존  ${m.name}`); }
}
console.log(`\n생존(=구멍) ${survived}건`);
process.exit(survived?1:0);
JS
