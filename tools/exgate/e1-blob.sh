#!/bin/bash
# E1 — 음성 표본에서 blobPx(3x3 침식) 분포를 «잰다». pixdiff.py --json 이 값을 찍는다(판정 무변경).
CMP="$HOME/.claude/skills/goditor-export-qa/scripts/pixdiff.py"
D="$1"
printf '%-26s %-24s %8s %8s %8s %6s %6s %5s %5s\n' PROJ SEC TOTAL maxCell blobPx band size dx dy
for e in "$D"/*.export.png; do
  t="${e%.export.png}.truth.png"; [ -s "$t" ] || continue
  b=$(basename "$e" .export.png)
  arch -arm64 python3 "$CMP" "$e" "$t" --json 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);
    const p=process.argv[1].split(".");
    console.log([p[0],p[1],o.total,o.maxCell,o.blobPx,o.bandCount,o.sizeMismatch?1:0,o.maxDx,o.maxDy]
      .map((v,i)=>String(v).padEnd([26,24,9,9,9,7,7,6,6][i])).join(" "));});' "$b"
done
