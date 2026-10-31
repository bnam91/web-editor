#!/bin/bash
# dom-flaky-roster-slot.sh — tests/dom/flaky-roster.gate.js 를 «부르는 자»(209 · S3 261029 · 지디 20:0x ①)
#
# ★왜 레포 안에 두나: 266 이 세운 자(tests/unit/gate-callers.test.mjs G1)가 «부르는 자 0» 으로 잡았다(지디 49870dc6 머지 뒤).
#   자와 부르는 자를 같은 나무에 둔다 — 이웃 dom-run-complete-slot.sh 와 같은 꼴.
# ⛔CI 에 한 줄 다는 것으로 갈음하지 않는다: 이 게이트는 «그 회차 DOM 전수 로그» 의 flaky 블럭을 읽는다 — 전수를 돌 창과
#   «명부에 없는 이름» 을 FLAKY.md 에 올릴 사람이 있는 자리(레인 슬롯)가 부르는 자다.
# 하는 일: DOM 전수 한 판(list 리포터 · workers 1 · retries 는 설정 그대로 — flaky 는 retries ≥1 일 때만 찍힌다)
#   → 같은 로그로 flaky-roster.gate(흔들린 spec 이 FLAKY.md 에 이름으로 있나).
# 갈음 자리(환경변수):
#   SLOT_LOG    이미 있는 DOM 전수 로그(주면 전수를 «안» 돈다 — dom-run-complete-slot.sh 의 run.log 를 그대로 읽힌다 · 전수 두 번 금지)
#   SLOT_GATE   착수 문턱 명령(없으면 안 잼)        예: SLOT_GATE="bash ~/taeyang-098/heavy-gate.sh"
#   SLOT_RUNNER DOM 전수 명령(기본 아래)             예: SLOT_RUNNER="bash ~/taeyang-098/run-test.sh dom"
#   SLOT_OUT    산출 폴더(기본 ./.slot-out/flaky-<시각>) · ⛔추적 파일에 쓰지 않는다
# 쓰기: bash tools/slots/dom-flaky-roster-slot.sh → rc = 게이트 rc(0 = 명부 밖 흔들림 0 · 1 = 명부에 없는 이름 · 3 = 못 잰다) · 5 문턱 미달
set -u
cd "$(dirname "$0")/../.." || exit 3
OUT=${SLOT_OUT:-.slot-out/flaky-$(date +%H%M%S)}; mkdir -p "$OUT"
LOG=${SLOT_LOG:-}
if [ -z "$LOG" ]; then
  RUNNER=${SLOT_RUNNER:-node node_modules/.bin/playwright test --config=tests/dom/playwright.dom.config.js}
  if [ -n "${SLOT_GATE:-}" ]; then eval "$SLOT_GATE" | tee -a "$OUT/hdr.log"; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "문턱 미달 — 안 돎" | tee -a "$OUT/hdr.log"; exit 5; }; fi
  LOG="$OUT/run.log"
  echo "# $(git rev-parse HEAD) · dom-flaky-roster-slot · $(date '+%F %T')" > "$LOG"
  eval "$RUNNER" --workers=1 --reporter=list >> "$LOG" 2>&1; echo "# 러너 rc $?" >> "$LOG"
fi
node tests/dom/flaky-roster.gate.js "$LOG" | tee "$OUT/gate.txt"; g=${PIPESTATUS[0]}
echo "flaky-roster.gate rc $g · 로그 $LOG" | tee -a "$OUT/hdr.log"
exit $g
