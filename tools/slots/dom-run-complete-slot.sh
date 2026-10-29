#!/bin/bash
# dom-run-complete-slot.sh — tests/dom/run-complete.gate.js 를 «부르는 자»(266 · S3 261029 · 지디 23:0x)
#
# ★왜 레포 안에 두나: 이 게이트를 부른 자는 레인 홈 스크립트들(~/taeyang-098/*.sh · s3-137/night-137g.sh — 버전관리 밖)뿐이었다
#   ⇒ 레포 안에서는 «부르는 자 0» 으로 보였다(266). 자와 부르는 자를 같은 나무에 둔다(tests/unit/gate-callers.test.mjs 가 잰다).
# ⛔CI 에 한 줄 다는 것으로 갈음하지 않는다: 이 게이트는 «그 회차 DOM 전수 로그» 를 읽는다 — 전수를 돌 창(workers 1 · 수십 분)과
#   그 로그를 읽고 판정할 사람이 있는 자리(레인 슬롯)가 부르는 자다. CI 단계 목록에 이름만 있으면 «돈다» 고 믿게 된다.
# 하는 일: DOM 전수 한 판(list 리포터 · workers 1 · retries 는 설정 그대로) → 같은 로그로 run-complete.gate(끝까지 돌았나).
# 갈음 자리(환경변수):
#   SLOT_GATE   착수 문턱 명령(없으면 안 잼)        예: SLOT_GATE="bash ~/taeyang-098/heavy-gate.sh"
#   SLOT_RUNNER DOM 전수 명령(기본 아래)             예: SLOT_RUNNER="bash ~/taeyang-098/run-test.sh dom"
#   SLOT_OUT    산출 폴더(기본 ./.slot-out/dom-<시각>) · ⛔추적 파일에 쓰지 않는다
# 쓰기: bash tools/slots/dom-run-complete-slot.sh → rc = 게이트 rc(0 = 끝까지 돌았다) · 5 문턱 미달
set -u
cd "$(dirname "$0")/../.." || exit 3
OUT=${SLOT_OUT:-.slot-out/dom-$(date +%H%M%S)}; mkdir -p "$OUT"
RUNNER=${SLOT_RUNNER:-npx playwright test --config=tests/dom/playwright.dom.config.js}
if [ -n "${SLOT_GATE:-}" ]; then eval "$SLOT_GATE" | tee -a "$OUT/hdr.log"; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "문턱 미달 — 안 돎" | tee -a "$OUT/hdr.log"; exit 5; }; fi
echo "# $(git rev-parse HEAD) · dom-run-complete-slot · $(date '+%F %T')" > "$OUT/run.log"
eval "$RUNNER" --workers=1 --reporter=list >> "$OUT/run.log" 2>&1; echo "# 러너 rc $?" >> "$OUT/run.log"
node tests/dom/run-complete.gate.js "$OUT/run.log" | tee "$OUT/gate.txt"; g=${PIPESTATUS[0]}
echo "run-complete.gate rc $g · 로그 $OUT/run.log" | tee -a "$OUT/hdr.log"
exit $g
