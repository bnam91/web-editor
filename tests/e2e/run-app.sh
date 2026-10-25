#!/bin/bash
# ★[S6-T6 · 2026-10-25] e2e 를 «spec 파일마다 새 applane 격리 앱 하나»로 차례로 돈다.
# 쓰기: tests/e2e/run-app.sh <LOGDIR> [NN …]      (기본 10 11 01 02 03 04 05 12 13 14 99)
#   · 10 11 = 순수 chromium(앱 안 띄움) · 나머지 = applane up → GD_E2E_ATTACH_* 로 붙어 돎 → down
#   · CDP 9614 · MCP 9615 만 쓴다 · 9616/9617 = 대조용 비움(9617 은 selftest 미끼로만)
#   · APPLANE=<경로> 로 applane.sh 를 바꿀 수 있다(기본 ~/taeyang-098/applane.sh)
# ⛔rm 안 씀 — udata 는 RUNID 태그라 재사용 0 · 끝에 쓴 udata 경로 목록만 summary 에 남긴다.
# ⛔npx 안 씀 · 새 config 없음 · 산출물은 전부 LOGDIR 안(레인 밖이어야 한다).
# 비0 rc: spec rc≠0 · NOT-RUN · 금지대역 hit · 잔여(PROCS/UDATA/PORT/PW)≠0 · 거절은 rc 2
set -u
export PATH="/usr/local/bin:$PATH"
TREE=$(cd "$(dirname "$0")/../.." && pwd -P)
APPLANE=${APPLANE:-$HOME/taeyang-098/applane.sh}
PW="$TREE/node_modules/.bin/playwright"
CDP=9614; MCP=9615
ST=$HOME/.gd-work/applane
LOCK=/Users/a1/taeyang-098/test.lock
GATE_MAX=1200   # 관문·up 재시도 예산(초) · spec 하나당
OWN_FORBID="9222 9334 9345 9346 9347 9348 9349 9350 9351 9352 9353 9354 9355 9356 9357 9358 9359 9360 9361 9362 9363 9364 9365 9371 9372 9381 9390 9392 9396 9410 9411 9500 9502 9507"

[ $# -ge 1 ] || { sed -n 3,9p "$0"; exit 2; }
LOGDIR_R=$(python3 -c 'import os,sys;print(os.path.realpath(sys.argv[1]))' "$1")
case "$LOGDIR_R/" in "$TREE"/*) echo "⛔LOGDIR 가 레인 안이다: $LOGDIR_R"; exit 2;; esac
mkdir -p "$LOGDIR_R" || exit 2
LOGDIR=$LOGDIR_R; shift
[ -x "$PW" ] || { echo "⛔playwright 없음: $PW"; exit 2; }
"$APPLANE" selftest 9617 >"$LOGDIR/selftest.log" 2>&1 || { echo "⛔applane selftest 9617 실패 — $(tail -1 "$LOGDIR/selftest.log")"; exit 2; }
SPECS=${*:-10 11 01 02 03 04 05 12 13 14 99}
RUNID=$(date +%y%m%d%H%M%S)-$$
HEAD=$(git -C "$TREE" rev-parse HEAD)
echo "띄운 판 $HEAD"
echo "TREE=$TREE RUNID=$RUNID LOGDIR=$LOGDIR APPLANE=$APPLANE"
echo "띄운 판 $HEAD · RUNID=$RUNID · TREE=$TREE" >"$LOGDIR/summary.txt"

CUR_TAG=""; CUR_NN=""; PW_PID=""
cleanup() {
  [ -n "$PW_PID" ] && kill -TERM "$PW_PID" 2>/dev/null
  if [ -n "$CUR_TAG" ]; then
    echo "TRAP down tag=$CUR_TAG"
    "$APPLANE" down "$CUR_TAG" >>"$LOGDIR/$CUR_NN.down.log" 2>&1
    CUR_TAG=""
  fi
}
trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM
trap 'cleanup; exit 129' HUP

own_census() {   # 자체 전수 — applane FORBID 에 없는 9372 9392 9411 까지 · 출력 마지막 줄 = hit 수
  local p n hit=0 det=""
  for p in $OWN_FORBID; do
    n=$(lsof -nP -t -iTCP:$p -sTCP:LISTEN 2>/dev/null | sort -u | tr '\n' ',')
    [ -n "$n" ] && { hit=$((hit+1)); det="$det $p:${n%,}"; }
  done
  echo "forbidden_hits=$hit${det:+ ($det )}"
}
hits_of() { sed -n 's/^forbidden_hits=\([0-9]*\).*/\1/p' <<<"$1"; }
load1() { sysctl -n vm.loadavg | awk '{print $2}'; }
left_udata() { ps -axo args= | UDPAT="--user-data-dir=$1" awk 'index($0, ENVIRON["UDPAT"])' | wc -l | tr -d ' '; }   # ★env 는 awk 에 준다(ps 에 주면 패턴이 비어 전부 센다 · 261025 스모크 791 실측)
left_port() { local p n=0; for p in 9614 9615 9616 9617; do lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1 && n=$((n+1)); done; echo $n; }
left_pw() {      # 이 레인 cwd 로 남은 playwright 프로세스 수(남의 세션 것은 cwd 가 달라 안 센다)
  local pid n=0
  for pid in $(pgrep -f playwright 2>/dev/null); do
    [ "$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')" = "$TREE" ] && n=$((n+1))
  done; echo $n
}
hshell() { pgrep -f headless_shell 2>/dev/null | wc -l | tr -d ' '; }

# ⚠️관문은 «권고»다 — 자물쇠를 잡지 않으므로 본 뒤 띄우기 사이에 남이 들어올 수 있다(TOCTOU). up 의 2벌 상한·OOM 가드가 뒷문.
gate_wait() {    # $1=NN $2=deadline(epoch) · 넘으면 rc 1
  local l
  while :; do
    l=$(load1)
    if [ ! -e "$LOCK" ] && awk -v l="$l" 'BEGIN{exit !(l<15)}'; then return 0; fi
    [ "$(date +%s)" -ge "$2" ] && return 1
    echo "GATE wait $1 lock=$([ -e "$LOCK" ] && echo yes || echo no) load1=$l"
    sleep 15
  done
}

run_pw() {       # $1=NN $2=spec 상대경로 · 나머지 = env 할당
  local nn=$1 spec=$2; shift 2
  ( cd "$TREE" && exec env "$@" "$PW" test "$spec" --config="$TREE/playwright.config.js" \
      --retries=0 --workers=1 --reporter=list --output="$LOGDIR/pw-$nn" --global-timeout=900000 ) \
    >"$LOGDIR/$nn.pw.log" 2>&1 &   # ★exec — 서브셸이 playwright 로 갈아끼워져 PW_PID 가 곧 playwright 다(trap 의 TERM 이 닿는다 · 평가자 261025: exec 없으면 고아로 남음)
  PW_PID=$!; wait "$PW_PID"; local rc=$?; PW_PID=""; return $rc
}

TOTAL_BAD=0; UDATAS=""
printf '%-4s %-7s %-34s %-4s %-6s %-6s %-5s %-7s %-7s %-6s %-5s %-5s %-5s %-4s %s\n' \
  NN mode tag rc passed failed flaky skipped didnot fhits procs udata port pw verdict >>"$LOGDIR/summary.txt"

for NN in $SPECS; do
  f=$(cd "$TREE/tests/e2e" && ls "$NN"-*.spec.js 2>/dev/null)
  if [ "$(wc -w <<<"$f" | tr -d ' ')" != 1 ]; then
    echo "== $NN NOT-RUN reason=spec-not-unique($f)"; TOTAL_BAD=1
    printf '%-4s %-7s %-34s %s\n' "$NN" - - "NOT-RUN spec-not-unique" >>"$LOGDIR/summary.txt"; continue
  fi
  case "$NN" in 10|11) MODE=pure;; *) MODE=attach;; esac
  TAG="-"; [ $MODE = attach ] && TAG="s6e2e-$RUNID-$NN"
  echo "== $NN $MODE $TAG ($f)"
  OC_B=$(own_census); HS_B=$(hshell)
  echo "OWN_CENSUS before $OC_B"
  NOTRUN=""; RC=0; UD=""; FH=0; PL=0; DRC=0; CN=3
  if [ $MODE = pure ]; then
    run_pw "$NN" "tests/e2e/$f"; RC=$?
  else
    DL=$(( $(date +%s) + GATE_MAX ))
    while :; do
      gate_wait "$NN" "$DL" || { NOTRUN="gate-timeout"; break; }
      CUR_TAG=$TAG; CUR_NN=$NN
      "$APPLANE" up "$TREE" $CDP $MCP "$TAG" >>"$LOGDIR/$NN.up.log" 2>&1; URC=$?
      [ $URC -eq 0 ] && break
      [ -f "$ST/$TAG.pid" ] || CUR_TAG=""   # 안 떴으면 내릴 것도 없다
      if [ $URC -eq 6 ] || [ $URC -eq 7 ]; then
        [ "$(date +%s)" -ge "$DL" ] && { NOTRUN="up-rc=$URC-budget"; break; }
        echo "GATE retry $NN up-rc=$URC"; sleep 15; continue
      fi
      NOTRUN="up-rc=$URC"; break
    done
    if [ -z "$NOTRUN" ]; then
      IFS='|' read -r _t _c _m UD <"$ST/$TAG.meta"
      UDATAS="$UDATAS $UD"
      run_pw "$NN" "tests/e2e/$f" GD_E2E_ATTACH_CDP=$CDP GD_E2E_ATTACH_UDATA="$UD" GD_E2E_ATTACH_TREE="$TREE"; RC=$?
    fi
    DRC=-; if [ -n "$CUR_TAG" ]; then
      "$APPLANE" down "$CUR_TAG" >>"$LOGDIR/$NN.down.log" 2>&1; DRC=$?; CUR_TAG=""
    fi
    [ -z "$UD" ] && UD="$HOME/.gd-work/udata-$TAG"
    grep -h "CENSUS forbidden_hits" "$LOGDIR/$NN.up.log" "$LOGDIR/$NN.down.log" 2>/dev/null | sed 's/^/  /'
    FH=$(grep -h "CENSUS forbidden_hits" "$LOGDIR/$NN.up.log" "$LOGDIR/$NN.down.log" 2>/dev/null | sed 's/.*=//' | awk '{s+=$1} END{print s+0}')
    PL=$(grep -h "^PROCS_LEFT=" "$LOGDIR/$NN.down.log" 2>/dev/null | tail -1 | sed 's/.*=//'); PL=${PL:-missing}   # ★줄이 없으면 «0» 이 아니라 «못 쟀다»
    CN=$(grep -h "CENSUS forbidden_hits" "$LOGDIR/$NN.up.log" "$LOGDIR/$NN.down.log" 2>/dev/null | wc -l | tr -d ' ')   # up 앞·직후 + down 뒤 = 3 줄이어야 잰 것
    echo "PROCS_LEFT=$PL DOWN_RC=$DRC CENSUS_LINES=$CN"
  fi
  [ -f "$LOGDIR/$NN.pw.log" ] && grep -E '^ *[0-9]+ (passed|failed|flaky|skipped|did not run|interrupted)' "$LOGDIR/$NN.pw.log" | sed 's/^ */  /'
  OC_A=$(own_census)
  echo "OWN_CENSUS after $OC_A"
  LU=0; [ $MODE = attach ] && LU=$(left_udata "$UD")
  LP=$(left_port); LW=$(left_pw); HS_A=$(hshell)
  echo "LEFT_UDATA_PROCS=$LU LEFT_PORT_LISTEN=$LP LEFT_PW=$LW HEADLESS_SHELL $HS_B→$HS_A"
  n_of() { [ -f "$LOGDIR/$NN.pw.log" ] && sed -n "s/^ *\([0-9]*\) $1.*/\1/p" "$LOGDIR/$NN.pw.log" | tail -1; }
  P=$(n_of passed); F=$(n_of failed); K=$(n_of flaky); S=$(n_of skipped); D=$(n_of 'did not run')
  FH=$(( FH + $(hits_of "$OC_A") ))
  V=ok
  if [ -n "$NOTRUN" ]; then V="NOT-RUN reason=$NOTRUN"; echo "$NN NOT-RUN reason=$NOTRUN"
  elif [ $RC -ne 0 ] || [ $FH -ne 0 ] || [ "$PL" != 0 ] || [ $LU -ne 0 ] || [ $LP -ne 0 ] || [ $LW -ne 0 ]; then V=BAD
  elif [ $MODE = attach ] && { [ "$DRC" != 0 ] || [ "$CN" != 3 ]; }; then V="BAD(down-rc=$DRC census-lines=$CN)"
  elif [ "${P:-0}" -eq 0 ] || [ "${D:-0}" -ne 0 ]; then V="BAD(passed=${P:-0} didnot=${D:-0})"; fi   # ★전부 skip·안 돎은 ok 아님
  [ "$V" = ok ] || TOTAL_BAD=1
  echo "rc=$RC verdict=$V"
  printf '%-4s %-7s %-34s %-4s %-6s %-6s %-5s %-7s %-7s %-6s %-5s %-5s %-5s %-4s %s\n' \
    "$NN" $MODE "$TAG" $RC "${P:-0}" "${F:-0}" "${K:-0}" "${S:-0}" "${D:-0}" $FH "$PL" $LU $LP $LW "$V" >>"$LOGDIR/summary.txt"
done

echo "udata(남김 · 지우지 않음):${UDATAS:- 없음}" >>"$LOGDIR/summary.txt"
echo "TOTAL $([ $TOTAL_BAD -eq 0 ] && echo ok || echo BAD)" >>"$LOGDIR/summary.txt"
echo "──── summary ($LOGDIR/summary.txt)"; cat "$LOGDIR/summary.txt"
[ $TOTAL_BAD -eq 0 ]
