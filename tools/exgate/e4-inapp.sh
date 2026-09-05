#!/bin/bash
# E4 — 앱 «안» 판정값 ≡ pixdiff.py 값 (같은 섹션·같은 두 그림). 다르면 이식이 틀린 것이다.
CMP="$HOME/.claude/skills/goditor-export-qa/scripts/pixdiff.py"
JSONL="$1"; D="$2"
ok=0; bad=0; skip=0
while read -r ln; do
  [ -z "$ln" ] && continue
  read -r pid sid w <<< "$(node -e 'const o=JSON.parse(process.argv[1]);if(!o.sid||o.err)process.exit(1);console.log(o.pid,o.sid,o.w)' "$ln" 2>/dev/null)" || continue
  e="$D/$pid.$sid.w$w.export.png"; t="$D/$pid.$sid.w$w.truth.png"
  [ -s "$e" ] && [ -s "$t" ] || { echo "  ─ $sid ★측정 불가(export 가 예외로 끝나 PNG 가 없다) — 불일치로 세지 않는다"; skip=$((skip+1)); continue; }
  py=$(arch -arm64 python3 "$CMP" "$e" "$t" --json 2>/dev/null)
  r=$(node -e '
    const app=JSON.parse(process.argv[1]), py=JSON.parse(process.argv[2]);
    const keys = py.sizeMismatch ? ["sizeMismatch"] : ["total","maxCell","bandCount","blobPx","sizeMismatch","maxDx","maxDy"];
    const d = keys.filter(k=>JSON.stringify(app[k])!==JSON.stringify(py[k]));
    console.log(d.length ? "MISMATCH "+d.map(k=>`${k}: 앱=${JSON.stringify(app[k])} py=${JSON.stringify(py[k])}`).join(" · ")
                         : `OK total=${py.total} maxCell=${py.maxCell} band=${py.bandCount} blob=${py.blobPx}`);' "$ln" "$py")
  printf '  %-24s %s\n' "$sid" "$r"
  case "$r" in OK*) ok=$((ok+1));; *) bad=$((bad+1));; esac
done < "$JSONL"
echo "── E4(앱 ≡ python): 일치 $ok · 불일치 $bad · 측정불가 $skip"
[ "$bad" = 0 ]
