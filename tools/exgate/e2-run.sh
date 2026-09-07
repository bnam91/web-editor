#!/bin/bash
# E2 한 판: 변이 적용 → 앱 재기동 → 지정 섹션 측정 → 되돌림.
set -u
M="$1"; PORT=9379; UD="$HOME/srv-지디_qa-udEXG"
SECS="sec_84a7j_38ar44f sec_84a7j_z111gyv sec_yelczva sec_84a7j_l97x981 sec_84a7j_wc4zr06 sec_84a7j_igy0ky9 sec_84a7j_b8tmqs3 sec_4adpy6d"
cd "$(dirname "$0")/../.." || exit 1
arch -arm64 python3 tools/exgate/e2-mutate.py "$M" apply || exit 1
pkill -f "remote-debugging-port=$PORT"; sleep 3
nohup ./node_modules/.bin/electron . --enable-logging --remote-debugging-port=$PORT --remote-allow-origins='*' \
  --user-data-dir="$UD" --disable-background-timer-throttling --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows --window-position=-2400,0 admin > /tmp/exgate-app-$M.log 2>&1 &
sleep 14
node tools/exgate/e2-measure.js "$PORT" proj_1788000000001 "$M" $SECS
arch -arm64 python3 tools/exgate/e2-mutate.py "$M" revert || echo "⛔되돌리기 실패 — 손으로 확인하라"
