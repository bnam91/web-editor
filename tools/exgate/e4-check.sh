#!/bin/bash
# E4 — 같은 픽셀을 먹여 «앱 비교기» 와 «pixdiff.py» 를 대조한다.
#   비교 항목: total · maxCell · bandCount · sizeMismatch · blobPx (자릿수까지)
#   ⚠️크기 불일치 쌍은 python 이 LANCZOS 리사이즈 후 계속 재고 앱은 «안 잰다» →
#     그 쌍은 sizeMismatch «만» 대조한다(IMPL 문서에 명시).
CORE="$(cd "$(dirname "$0")/../.." && pwd)/js/io/export-gate-core.js"
CMP="$HOME/.claude/skills/goditor-export-qa/scripts/pixdiff.py"
A="$1"; shift
arch -arm64 python3 "$(dirname "$0")/dump-raw.py" "$A" >/dev/null
ok=0; bad=0
for B in "$@"; do
  arch -arm64 python3 "$(dirname "$0")/dump-raw.py" "$B" >/dev/null
  py=$(arch -arm64 python3 "$CMP" "$A" "$B" --json 2>/dev/null)
  js=$(node "$(dirname "$0")/cmp-raw.mjs" "$CORE" "$A.raw" "$B.raw")
  r=$(node -e '
    const py=JSON.parse(process.argv[1]), js=JSON.parse(process.argv[2]);
    const keys = py.sizeMismatch ? ["sizeMismatch"] : ["sizeMismatch","total","maxCell","bandCount","blobPx"];
    const diff = keys.filter(k=>JSON.stringify(py[k])!==JSON.stringify(js[k]));
    console.log(diff.length? "MISMATCH\t"+diff.map(k=>`${k}: py=${JSON.stringify(py[k])} js=${JSON.stringify(js[k])}`).join(" · ")
                           : "OK\ttotal="+py.total+" maxCell="+py.maxCell+" band="+py.bandCount+" blob="+py.blobPx);
  ' "$py" "$js")
  printf '%-22s %s\n' "$(basename "$B")" "$r"
  case "$r" in OK*) ok=$((ok+1));; *) bad=$((bad+1));; esac
done
echo "── E4(합성/실물): 일치 $ok · 불일치 $bad"
[ "$bad" = 0 ]
