#!/bin/zsh
# rss-guard.sh — 시트 250 FRAME-DEEP-RENDERER-RSS-6GB-CPU100-01 지킴(S3 · 261029)
#   PAT 에 맞는 프로세스들(기본 = 내 앱 udata-t9s3)의 RSS 최대·CPU 합을 INTERVAL 초마다 «계속» 찍는다(끝 한 번 아님).
#   어느 하나라도 RSS > THRESH_MB 면 → (DRY=1 아니면) applane.sh down <TAG> 로 앱을 내리고 STOP 줄 · rc 9.
#   PHASE 파일(perf.cjs 가 씀)의 마지막 줄을 같이 찍는다 = 오르는 단계 가르기(사슬 만들 때 / ⌘D / ⌘Z).
#   STOPFILE 이 생기면 조용히 끝(rc 0) — 런 스크립트가 다 돌면 만든다.
#   ★S7 더함(태양 00:36 · server-manager 새 자): 런 중 swap used 가 착수 대비 +SWAP_UP_MB(기본 1000) 이상 늘거나
#     pressure free 가 PFREE_MIN(기본 25)% 밑이면 같은 길로 내림(rc 9) — 셋 중 하나라도.
# 쓰기: THRESH_MB=3000 PAT=udata-t9s3 TAG=t9s3 LOG=<로그> PHASE=<파일> STOPFILE=<파일> zsh rss-guard.sh
set -u
THRESH_MB=${THRESH_MB:-3000}; PAT=${PAT:-udata-t9s3}; TAG=${TAG:-t9s3}; INTERVAL=${INTERVAL:-1}; DRY=${DRY:-0}
SWAP_UP_MB=${SWAP_UP_MB:-1000}; PFREE_MIN=${PFREE_MIN:-30}   # ★아이맥 사본: 지디 통일 값 30(Intel 원본 25)
LOG=${LOG:-/dev/stdout}; PHASE=${PHASE:-/dev/null}; STOPFILE=${STOPFILE:-/nonexistent}
export PATH=/usr/local/bin:$PATH
swapused() { sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9]+)\..*/\1/'; }
pfree() { memory_pressure | awk -F': ' '/free percentage/{gsub("%","",$2); print $2}'; }
SWAP0=$(swapused); echo "$(date +%T) 지킴 시작 · swap used 착수 ${SWAP0}MB · pressure free $(pfree)% · 문턱 rss>${THRESH_MB} | swap +${SWAP_UP_MB} | pfree<${PFREE_MIN}" >> $LOG
while true; do
  [ -e "$STOPFILE" ] && { echo "$(date +%T) 끝(STOPFILE)" >> $LOG; exit 0; }
  rows=$(ps -Ao pid=,rss=,%cpu=,command= | grep -F -- "$PAT" | grep -vE "grep|rss-guard")
  if [ -z "$rows" ]; then echo "$(date +%T) 앱 없음 · phase $(tail -1 $PHASE 2>/dev/null)" >> $LOG; sleep $INTERVAL; continue; fi
  max=$(echo "$rows" | awk '{if($2+0>m+0){m=$2+0;p=$1}} END{printf "%d %d", m/1024, p}')
  mx=${max% *}; mp=${max#* }
  if [ "$mp" = "0" ]; then mxs="미측(pid 0)"; else mxs="${mx}MB(pid ${mp})"; fi   # ★지디 04:15 — pid 0 = 그 표본의 하나-최대 «미측» · ⛔0MB 로 찍지 않음
  cpu=$(echo "$rows" | awk '{s+=$3} END{printf "%.0f", s}')
  rsum=$(echo "$rows" | awk '{s+=$2} END{printf "%d", s/1024}')   # ★합(태양 03:44 · «하나 최대» 와 «합» 을 갈라 적음 — 멈춤 판정은 «하나 최대»)
  n=$(echo "$rows" | wc -l | tr -d ' ')
  echo "$(date +%T) rssMax ${mxs} · rss합 ${rsum}MB · cpu합 ${cpu}% · 프로세스 ${n} · load $(sysctl -n vm.loadavg | tr -d '{}' | xargs | cut -d' ' -f1) · phase $(tail -1 $PHASE 2>/dev/null)" >> $LOG
  su=$(swapused); pf=$(pfree); dsw=$(( su - SWAP0 ))
  echo "$(date +%T)   swap used ${su}MB(+${dsw}) · pressure free ${pf}%" >> $LOG
  why=""
  [ "$mp" != "0" ] && [ ${mx} -gt ${THRESH_MB} ] && why="rss ${mx}MB > ${THRESH_MB}"
  [ ${dsw} -ge ${SWAP_UP_MB} ] && why="${why:+$why · }swap +${dsw}MB ≥ ${SWAP_UP_MB}"
  [ ${pf} -lt ${PFREE_MIN} ] && why="${why:+$why · }pressure free ${pf}% < ${PFREE_MIN}"
  if [ -n "$why" ]; then
    if [ "$DRY" = "1" ]; then echo "$(date +%T) STOP(DRY) ${why} — 내리지 않음(양성대조)" >> $LOG; exit 9; fi
    echo "$(date +%T) STOP ${why} — applane down ${TAG}" >> $LOG
    bash ~/taeyang-098/applane.sh down ${TAG} >> $LOG 2>&1
    exit 9
  fi
  sleep $INTERVAL
done
