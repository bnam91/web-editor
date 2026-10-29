#!/bin/zsh
# ★레인 문턱 자 — tools/slots/lane-gate/ (261029 지디 266 «아이맥 임시 문턱 자를 tools/slots/ 로» · 옛 자리 ~/taeyang-098/reports/S7-handoff-imac-gate/imac-gate.sh)
#   ★부르는 꼴: 다른 슬롯의 SLOT_GATE 로도 — SLOT_GATE="LANE_TAG=<태그> GATE_ONLY=1 zsh tools/slots/lane-gate/lane-gate.sh"
# (이하 옛 머리말 그대로) ★아이맥 레인 문턱 자 — S7 s7-250-slot.sh(Intel) 사본 · 지디 11:3x 처방 «값만 갈아라» · 바꾼 값: ⒜LOADMAX 6 그대로 ⒝띠 → LANE_CDP/LANE_MCP(레인 제 대역 L1 9700~9709 … L6 9750~9759) ⒞경로 → 이 폴더·$HOME 기준 ⒟지킴 pressure <30 ⒠playwright → PW_PATH(fresh.cjs)
#   쓰기(재기만): LANE_TAG=<레인태그> GATE_ONLY=1 zsh tools/slots/lane-gate/lane-gate.sh   · 발동 시험: LANE_TAG=… LANE_CDP=97x0 LANE_MCP=97x1 TREE=<판> PW_PATH=<아이맥 playwright> FIRE=1 zsh tools/slots/lane-gate/lane-gate.sh
#   ⛔이 사본은 250 성능 런(D·C·heap)을 안 싣는다 — 런은 guard-run.sh 로 지킴 아래에서.
# 시트 250 FRAME-DEEP-RENDERER-RSS-6GB-CPU100-01 재현 — S7 판(S3 t9-250-slot.sh 0ce7019b537b 를 S7 값으로 · 순서 그대로: 지킴 → D → ⑸ heap → C)
#   문턱(태양 00:36 · server-manager 261029 10:06 «무거운 런 ≤2 동시 · load ≤6»): pressure free ≥50% · load1 ≤ ${LOADMAX:-6} · swap used 1분 증가 ≤100MB 아니면 ★안 띄우고 rc 3 (대기) — 옛 «swap free ≥1500» 은 걷음
#   지킴(런 중): RSS > 3000MB · swap used 착수 대비 +1000MB · pressure free < 25% 중 하나 ⇒ 앱 내림(rc 9)
#   지킴 = rss-guard.sh 1s 마다 RSS·CPU·단계 · RSS > 3000MB 면 앱 내리고 멈춤(rc 9) ⇒ 이 스크립트도 다음 칸 안 감
#   (★Intel 원본 머리말 그대로 · 역사 줄 — 아이맥 사본에선 판·띠·태그 = TREE·LANE_CDP/LANE_MCP·LANE_TAG) 판 = b267c6f2(S3 앞 판) git archive 사본 · 띠 9618/9619 · 태그 s7-250 · ⑹ = PROFILE_DEPTH 깊이 1회차 ⌘D·⌘Z CPU 프로파일
set -u
export PATH=/usr/local/bin:$PATH
D="$(cd "$(dirname "$0")" && pwd)"; TAG=${LANE_TAG:-lane}
TREE=${TREE:-}
O=${SLOT_OUT:-$HOME/.gd-work/lane-gate-out/$TAG}; mkdir -p $O   # ★레포 안에서 돌므로 산출은 레포 밖(옛 사본은 $D/out)
STOP=$O/guard.stop.$(date +%Y%m%d%H%M%S); PH=$O/phase.txt; : > $PH   # 런마다 새 이름 — 지울 일 0
hdr() { LANE_TAG=$TAG zsh $D/hdr.sh "$1" | tee -a $O/hdr.log; }
# ★문턱(태양 00:36 · server-manager 새 자): pressure free ≥ 50% · load(1분) ≤ 4 · swap used 1분 증가 ≤ 100MB — 하나라도 아니면 안 띄움(rc 3)
swu() { sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9]+)\..*/\1/'; }
pf=$(memory_pressure | awk -F': ' '/free percentage/{gsub("%","",$2); print $2}'); load1=$(sysctl -n vm.loadavg | tr -d '{}' | xargs | cut -d' ' -f1)
sw0=$(swu); hdr "문턱 재기 시작(swap 1분)"; sleep 60; sw1=$(swu); dsw=$(( sw1 - sw0 ))
hdr "문턱 pressure free ${pf}% · load ${load1} · swap used 1분 +${dsw}MB"
others=$(ps -axo command | grep -E "Electron.*(user-data-dir|udata-)" | grep -v grep | grep -oE "udata-[A-Za-z0-9_-]+" | sort -u | grep -v "udata-$TAG" | tr "\n" " ")
nothers=$(echo $others | wc -w | tr -d ' ')   # ★동시 앱 ≤2(태양 03:44 · 나 포함) ⇒ 다른 앱 ≤ ${MAX_OTHERS:-1}
[ $nothers -gt ${MAX_OTHERS:-1} ] && { echo "문턱 밑 — 다른 앱 ${nothers} 벌 [${others}] > ${MAX_OTHERS:-1} ⇒ 안 띄움(대기)" | tee -a $O/hdr.log; exit 3; }
echo "다른 앱 ${nothers} 벌 [${others}] ≤ ${MAX_OTHERS:-1}" | tee -a $O/hdr.log
if [ $pf -lt 50 ] || [ $(echo "$load1 > ${LOADMAX:-6}" | bc) -eq 1 ] || [ $dsw -gt 100 ]; then echo "문턱 밑 — pressure free ${pf}% · load ${load1}(상한 ${LOADMAX:-6}) · swap 1분 +${dsw}MB ⇒ 안 띄움(대기)" | tee -a $O/hdr.log; exit 3; fi
[ "${GATE_ONLY:-0}" = "1" ] && { echo "문턱 통과(GATE_ONLY — 앱 안 띄움)" | tee -a $O/hdr.log; exit 0; }
THRESH=$(cat $D/thresh.mb); echo "지킴 상한(파일 $D/thresh.mb) = ${THRESH}MB" | tee -a $O/hdr.log
: ${LANE_CDP:?LANE_CDP(레인 대역 CDP 포트) 필요} ${LANE_MCP:?LANE_MCP 필요} ${TREE:?TREE(판 트리) 필요}
bash ${APPLANE:-$HOME/taeyang-098/applane.sh} up $TREE $LANE_CDP $LANE_MCP $TAG 2>&1 | grep -E "CENSUS|UP |SELFTEST|⛔" | tee -a $O/applane.log
THRESH_MB=$THRESH SWAP_UP_MB=1000 PFREE_MIN=${PFREE_MIN:-30} PAT=udata-$TAG TAG=$TAG LOG=$O/guard.log PHASE=$PH STOPFILE=$STOP zsh $D/rss-guard.sh &
GPID=$!
alive() { kill -0 $GPID 2>/dev/null; }
run() { local tag=$1; shift
  alive || { echo "지킴 멈춤(앱 내려감) — $tag 안 돎" | tee -a $O/hdr.log; return 9; }
  node $D/fresh.cjs >> $O/$tag.log 2>&1 || { echo "새 프로젝트 실패 — $tag 안 돎(숨기지 않음)" | tee -a $O/hdr.log; return 4; }
  hdr "$tag 앞"
  env PHASE=$PH "$@" node $D/perf.cjs $O/$tag.json >> $O/$tag.log 2>&1; local rc=$?
  hdr "$tag 뒤 rc $rc"
  grep -E '^\{|^flat|^void|^ERR|^prof' $O/$tag.log | cut -c1-400 | tee -a $O/hdr.log
  return $rc; }
heap() { alive || return 9; echo "⑸ heap 스냅샷(D 판 · 낮은 깊이)" >> $PH; node $D/heap.cjs $O/heap-D.json >> $O/heap.log 2>&1; local rc=$?; grep -E '^heap|^ERR' $O/heap.log | cut -c1-400 | tee -a $O/hdr.log; return $rc; }
if [ "${FIRE:-0}" = "1" ]; then node $D/fresh.cjs >> $O/fire.log 2>&1; for i in $(seq 1 90); do alive || break; sleep 1; done; if alive; then echo "발동 시험: 90s 안에 안 멈춤 ⇒ 실패" | tee -a $O/hdr.log; touch $STOP; wait $GPID; bash ${APPLANE:-$HOME/taeyang-098/applane.sh} down $TAG >> $O/applane.log 2>&1; exit 7; fi; wait $GPID; echo "발동 시험: 지킴 rc $? · $(grep -E 'STOP' $O/guard.log | tail -1)" | tee -a $O/hdr.log; echo "앱 프로세스 $(pgrep -f udata-$TAG | wc -l | tr -d ' ') · 띠 LISTEN $(lsof -nP -iTCP:$LANE_CDP-$LANE_MCP -sTCP:LISTEN 2>/dev/null | grep -c LISTEN)" | tee -a $O/hdr.log; exit 0; fi
echo "이 사본은 GATE_ONLY=1 · FIRE=1 만 — 런은 guard-run.sh 로(250 성능 런은 Intel S7 몫)" | tee -a $O/hdr.log; touch $STOP; wait $GPID 2>/dev/null; bash ${APPLANE:-$HOME/taeyang-098/applane.sh} down $TAG >/dev/null 2>&1; exit 2
run D FLAT=128 DEPTHS=1 REPS=10 PROFILE_DEPTH=1 && heap && run C DEPTHS=128,64,32,16,8,4,2,1 REPS=10 PROFILE_DEPTH=16
touch $STOP; wait $GPID 2>/dev/null; GRC=$?
grep -E "STOP" $O/guard.log | tee -a $O/hdr.log
echo "지킴 rc $GRC · RSS 최고 $(grep -oE 'rssMax [0-9]+MB' $O/guard.log | awk '{gsub("MB","",$2); if($2+0>m+0)m=$2} END{print m}')MB · cpu합 최고 $(grep -oE 'cpu합 [0-9]+%' $O/guard.log | awk '{gsub("%","",$2); if($2+0>m+0)m=$2} END{print m}')%" | tee -a $O/hdr.log
bash ~/taeyang-098/applane.sh down s7-250 2>&1 | grep -E "PROCS|CENSUS|DOWN" | tee -a $O/applane.log
hdr 끝
