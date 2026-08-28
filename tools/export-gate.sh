#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════
# export-gate — 「내보내기가 깨지지 않았나」를 픽셀로 증명하는 릴리스 차단 게이트.
#   현빈 지시(2026-08-28): 「메인으로 내보내기 전에 export 테스트해서 픽셀 단위로 비교해봐라,
#                          내보내기가 깨지는 경우가 있었다」
#   ⇒ dev→main→릴리스에서 «항상» 돈다. exit 0=PASS / 1=FAIL(릴리스 차단) / 2=못 쟀다.
#
# 사용: bash tools/export-gate.sh <포트> <프로젝트id:섹션수> [...]
#   예: bash tools/export-gate.sh 9396 proj_178...:6 proj_178...:4
#   ⚠️앱이 그 포트로 «격리 인스턴스»여야 한다 — export 의 captureSectionCdp 가 debugger.attach 를
#     쓰므로 CDP 가 붙은 라이브 인스턴스에서 돌리면 hang 된다(스킬 함정 박제).
#
# ★「못 쟀다」를 «PASS 로 세지 않는다» — 캡처 실패·빈 이미지는 SKIP 이 아니라 ERROR 다.
#   오늘 우리가 열 번 겪은 「검출 0 = 깨끗함」 오독을 게이트가 되풀이하면 안 된다.
# ══════════════════════════════════════════════════════════════════════════
set -o pipefail
SK=~/.claude/skills/goditor-export-qa/scripts
# ★판정기는 «스킬»의 것을 쓴다 — 개선분(격자 뭉침·전수 x·크기불일치 FAIL)이 거기 들어가 있고,
#   레포에 사본을 두면 둘이 갈린다(같은 판정을 두 곳에서 유지하게 된다).
CMP="$HOME/.claude/skills/goditor-export-qa/scripts/pixdiff.py"
PORT="${1:?포트가 필요하다}"; shift
# ★폭 — 앱이 제공하는 폭은 860(기본)과 780(쿠팡) 둘이다. 초판은 860 을 «문자열에 박아» 두었고
#   그래서 780 을 «한 번도 안 쟀다»(2026-08-28 현빈 지적). 폭이 바뀌면 스케일·반올림이 달라진다.
#   ⇒ 결과 파일·TSV 에 폭을 «남긴다». 안 그러면 860 결과와 780 결과가 섞여 어느 쪽인지 모른다.
WIDTH=860
if [ "$1" = "--width" ]; then WIDTH="$2"; shift 2; fi
OUT="${EXPORT_GATE_OUT:-${TMPDIR:-/tmp}/export-gate-$$}"
OUT="$OUT/w$WIDTH"
mkdir -p "$OUT"
PASS=0; FAIL=0; ERR=0
RESULTS="$OUT/results.tsv"; : > "$RESULTS"

free_gb=$(df -g / | tail -1 | awk '{print $4}')
if [ "${free_gb:-0}" -lt 3 ]; then
  echo "⛔디스크 여유 ${free_gb}GB — 픽셀 비교는 PNG 를 많이 만든다. 3GB 이상 확보하고 다시 돌려라."; exit 2
fi

open_project() {   # $1=projectId
  node "$SK/cdp-eval.js" "$PORT" '(async()=>{ await window.electronAPI.navigateToProjects(); return 1; })()' >/dev/null 2>&1
  sleep 3
  node "$SK/cdp-eval.js" "$PORT" '(()=>{const c=[...document.querySelectorAll(".project-card")].find(e=>e.dataset.id==="'"$1"'");if(!c)return "no";c.click();return "ok"})()' >/dev/null 2>&1
  sleep 7
}
section_ids() {    # $1=개수
  node "$SK/cdp-eval.js" "$PORT" '(()=>JSON.stringify([...document.querySelectorAll(".section-block")].slice(0,'"$1"').map(e=>e.id)))()' 2>/dev/null \
    | sed 's/^"//; s/"$//; s/\\"/"/g' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s).forEach(x=>console.log(x))}catch(e){}})'
}

for spec in "$@"; do
  pid="${spec%%:*}"; n="${spec##*:}"; [ "$n" = "$pid" ] && n=5
  echo "── $pid (섹션 $n개 · 폭 ${WIDTH}px)"
  open_project "$pid"
  ids=$(section_ids "$n")
  if [ -z "$ids" ]; then echo "  ⛔섹션을 못 읽었다 — 프로젝트가 안 열렸다"; ERR=$((ERR+1)); continue; fi
  for sid in $ids; do
    e="$OUT/$sid.w$WIDTH.export.png"; t="$OUT/$sid.w$WIDTH.truth.png"
    node "$SK/cdp-eval.js" "$PORT" '(async()=>{var s=document.getElementById("'"$sid"'");if(!s)return "NOSEC";return await window.exportSection(s,"png",'"$WIDTH"',{returnDataUrl:true});})()' > "$OUT/$sid.w$WIDTH.txt" 2>&1
    if ! grep -q '^"data:image' "$OUT/$sid.w$WIDTH.txt"; then
      echo "  ⛔ $sid  export 실패 — $(head -c 60 "$OUT/$sid.w$WIDTH.txt")"; ERR=$((ERR+1))
      printf '%s\t%s\t%s\tERROR\texport실패\t\t\n' "$pid" "$sid" "$WIDTH" >> "$RESULTS"; continue
    fi
    arch -arm64 python3 -c "
import base64,sys
s=open('$OUT/$sid.w$WIDTH.txt').read().strip().strip('\"')
open('$e','wb').write(base64.b64decode(s.split(',',1)[1]))" 2>/dev/null
    node "$SK/truth-capture.js" "$PORT" "$sid" "$t" >/dev/null 2>&1
    if [ ! -s "$t" ] || [ ! -s "$e" ]; then
      echo "  ⛔ $sid  캡처 없음/빈 파일 — «못 쟀다»(PASS 아님)"; ERR=$((ERR+1))
      printf '%s\t%s\t%s\tERROR\t캡처실패\t\t\n' "$pid" "$sid" "$WIDTH" >> "$RESULTS"; continue
    fi
    j=$(arch -arm64 python3 "$CMP" "$e" "$t" --json 2>/dev/null)
    if [ -z "$j" ]; then echo "  ⛔ $sid  비교기 실패"; ERR=$((ERR+1)); continue; fi
    v=$(echo "$j" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log([o.verdict,o.total,o.maxCell,(o.reasons||[]).join(" / "),o.guess||""].join("\t"))})')
    verdict=$(echo "$v" | cut -f1); total=$(echo "$v" | cut -f2); cell=$(echo "$v" | cut -f3)
    reason=$(echo "$v" | cut -f4); guess=$(echo "$v" | cut -f5)
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$pid" "$sid" "$WIDTH" "$verdict" "$total" "$cell" "$reason|$guess" >> "$RESULTS"
    if [ "$verdict" = "PASS" ]; then PASS=$((PASS+1)); printf "  ✅ %-22s TOTAL=%-6s cell=%s\n" "$sid" "$total" "$cell"
    else FAIL=$((FAIL+1)); printf "  ❌ %-22s TOTAL=%-6s cell=%-4s %s\n" "$sid" "$total" "$cell" "$reason"; [ -n "$guess" ] && echo "        추정: $guess"; fi
  done
done
echo
# ★기준선 대조 — 「이게 «새로» 깨진 것인가」에 답한다.
#   ⚠️절대 임계만 쓰면 «이전 릴리스에도 있던» 차이가 릴리스를 막는다(2026-08-28 실측: 2건이 그랬다).
#     릴리스 게이트가 답해야 하는 물음은 「완벽한가」가 아니라 「내가 «깨뜨렸나»」다.
#   사용: EXPORT_GATE_BASELINE=<이전 실행의 results.tsv> 를 주면 FAIL 을 «신규/기존»으로 가른다.
if [ -n "$EXPORT_GATE_BASELINE" ] && [ -f "$EXPORT_GATE_BASELINE" ]; then
  NEW=0; KNOWN=0
  while IFS=$'\t' read -r bp bs bw bv bt bc brest; do
    [ "$bv" = "FAIL" ] || continue
    # ★폭이 «같은» 행만 본다 — 860 기준선으로 780 을 재면 전부 「신규」로 나온다
    prev=$(awk -F'\t' -v s="$bs" -v w="$bw" '$2==s && $3==w{print $4"|"$5}' "$EXPORT_GATE_BASELINE" 2>/dev/null)
    if [ "${prev%%|*}" = "FAIL" ]; then KNOWN=$((KNOWN+1)); echo "  ○ 기존 $bs (기준선도 FAIL, TOTAL ${prev##*|})"
    else NEW=$((NEW+1)); echo "  ★신규 $bs (기준선 ${prev:-없음})"; fi
  done < "$RESULTS"
  echo "   ⇒ 신규 FAIL $NEW · 기존 FAIL $KNOWN"
  if [ "$NEW" -eq 0 ] && [ "$FAIL" -gt 0 ]; then
    echo "══ export 게이트 결과(폭 ${WIDTH}px) ══  PASS $PASS · FAIL $FAIL(전부 기존) · ERROR $ERR"
    echo "✅ ★«신규» 회귀 0 — 이 릴리스가 내보내기를 깨뜨리지 않았다(기존 FAIL 은 별건으로 남긴다)."
    [ "$ERR" -gt 0 ] && exit 2; exit 0
  fi
fi
echo "══ export 게이트 결과(폭 ${WIDTH}px) ══  PASS $PASS · FAIL $FAIL · ERROR $ERR"
echo "   산출물: $OUT   (결과표: $RESULTS)"
if [ "$ERR" -gt 0 ]; then echo "⛔ERROR 가 있다 — «못 쟀다»는 PASS 가 아니다. 원인을 풀고 다시 돌려라."; exit 2; fi
if [ "$FAIL" -gt 0 ]; then echo "⛔FAIL — 릴리스 차단."; exit 1; fi
echo "✅ 전부 PASS — 내보내기 정합성 확인됨."; exit 0
