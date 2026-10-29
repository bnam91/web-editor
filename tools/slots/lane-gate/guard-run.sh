#!/bin/zsh
# 레인 공통 지킴(지디 03:16) — 아무 런이든 지킴 아래에서: guard-run.sh <PAT> <TAG(내릴 applane 태그 · 없으면 none)> <로그폴더> -- <명령…>
#   상한 = ~/taeyang-098/S7-FIX/t250/thresh.mb(파일에서 읽어 머리에 박음) · swap +1000 · pressure <25 · 지킴이 멈추면 ⛔런 값 버리지 않음 — 그때 단계(PHASE 끝 줄)·지킴 마지막 줄을 STOP 줄로 남김
#   PHASE 파일 = <로그폴더>/phase.txt — 명령 쪽이 단계 줄을 쓰면 지킴 줄마다 같이 찍힘(env PHASE 로 넘김)
set -u
export PATH=/usr/local/bin:$PATH
PAT=$1; TAG=$2; O=$3; shift 3; [ "$1" = "--" ] && shift
mkdir -p $O; PH=$O/phase.txt; STOP=$O/guard.stop; : > $PH
D="$(cd "$(dirname "$0")" && pwd)"; TH=$(cat $D/thresh.mb); echo "$(date +%T) 지킴 상한(파일) ${TH}MB · PAT ${PAT} · 태그 ${TAG}" | tee -a $O/hdr.log
THRESH_MB=$TH SWAP_UP_MB=1000 PFREE_MIN=${PFREE_MIN:-30} PAT="$PAT" TAG=$TAG LOG=$O/guard.log PHASE=$PH STOPFILE=$STOP zsh $D/rss-guard.sh &
GP=$!
ktree() { local p; for p in $(pgrep -P $1 2>/dev/null); do ktree $p; done; kill $1 2>/dev/null; }
env PHASE=$PH "$@" &
CP=$!
while kill -0 $CP 2>/dev/null; do
  if ! kill -0 $GP 2>/dev/null; then
    echo "$(date +%T) ★지킴 STOP — 런 멈춤 · 단계 «$(tail -1 $PH 2>/dev/null)» · $(grep -E 'STOP' $O/guard.log | tail -1)" | tee -a $O/hdr.log
    ktree $CP; wait $CP 2>/dev/null; echo "남은 자식 $(pgrep -P $CP 2>/dev/null | wc -l | tr -d ' ')" | tee -a $O/hdr.log; echo "런 rc(멈춤) 137" | tee -a $O/hdr.log; exit 9
  fi
  sleep 1
done
wait $CP; RC=$?
touch $STOP; wait $GP 2>/dev/null
echo "$(date +%T) 런 rc ${RC} · 지킴 RSS 하나 최고 $(grep -oE 'rssMax [0-9]+MB' $O/guard.log | awk '{gsub("MB","",$2); if($2+0>m+0)m=$2} END{print m+0}')MB(미측 표본 $(grep -c 'rssMax 미측' $O/guard.log)/$(grep -c rssMax $O/guard.log)) · 합 최고 $(grep -oE 'rss합 [0-9]+MB' $O/guard.log | awk '{gsub("MB","",$2); if($2+0>m+0)m=$2} END{print m+0}')MB · swap Δ 최대 $(grep -oE '\(\+-?[0-9]+\)' $O/guard.log | tr -d '()+' | sort -n | tail -1)MB · pressure 최저 $(grep -oE 'pressure free [0-9]+%' $O/guard.log | grep -oE '[0-9]+' | sort -n | head -1)%" | tee -a $O/hdr.log
exit $RC
