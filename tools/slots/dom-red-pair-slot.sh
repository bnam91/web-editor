#!/bin/bash
# dom-red-pair-slot.sh — tools/nameset-judge.py 를 «부르는 자»(310 · S3 261031 · 지디 SEVENINTEL ⑦)
#
# ★왜 레포 안에 두나: 판정 자를 부른 자가 레인 홈 슬롯들뿐이었다 ⇒ 규칙은 레포에 · 자는 한 맥에(310). 자와 부르는 자를 같은 나무에 둔다.
# ⛔이 슬롯이 재는 것 = «이 칸은 이 문구로 빨개야 한다» 를 이름 집합으로 — 수로 판정 안 함. 재는 자 = tests/unit/nameset-judge.test.mjs N9·N10.
# 하는 일: DOM spec 한 벌(list 리포터 · workers 1 · retries 0) → 같은 로그로 nameset-judge.
# 갈음 자리(환경변수):
#   SLOT_LOG    이미 있는 list 로그(주면 안 돈다)
#   SLOT_SPEC   돌릴 spec(SLOT_LOG 없을 때 필수)
#   SLOT_GATE   착수 문턱 명령(없으면 안 잼)
#   SLOT_RUNNER DOM 명령(기본 아래) · 변이 사본은 GD1001_ROOT 를 그대로 물려받는다
#   SLOT_OUT    산출 폴더(기본 ./.slot-out/red-pair-<시각>) · ⛔추적 파일에 쓰지 않는다
# 쓰기: SLOT_SPEC=tests/dom/x.dom.spec.js bash tools/slots/dom-red-pair-slot.sh --red 'M12=안 붙었다' --green U0,U1
#   → rc = 판정 자 rc(0 통과 · 1 어긋남 · 2 못 읽음) · 3 python 없음·SLOT_SPEC 없음 · 5 문턱 미달
set -u
cd "$(dirname "$0")/../.." || exit 3
OUT=${SLOT_OUT:-.slot-out/red-pair-$(date +%H%M%S)}; mkdir -p "$OUT"
PY=$(command -v python3 || command -v python) || { echo "⛔python 없음 — 못 잰다(통과 아님)"; exit 3; }
LOG=${SLOT_LOG:-}
if [ -z "$LOG" ]; then
  [ -n "${SLOT_SPEC:-}" ] || { echo "⛔SLOT_SPEC 없음"; exit 3; }
  RUNNER=${SLOT_RUNNER:-node_modules/.bin/playwright test --config=tests/dom/playwright.dom.config.js}
  if [ -n "${SLOT_GATE:-}" ]; then eval "$SLOT_GATE" | tee -a "$OUT/hdr.log"; [ ${PIPESTATUS[0]} -eq 0 ] || { echo "문턱 미달 — 안 돎" | tee -a "$OUT/hdr.log"; exit 5; }; fi
  LOG="$OUT/run.log"
  echo "# $(git rev-parse HEAD) · dom-red-pair-slot · $(date '+%F %T')" > "$LOG"
  eval "$RUNNER" "$SLOT_SPEC" --workers=1 --retries=0 --reporter=list >> "$LOG" 2>&1; echo "# 러너 rc $?" >> "$LOG"
fi
"$PY" tools/nameset-judge.py "$LOG" "$@" --root . | tee "$OUT/judge.txt"; g=${PIPESTATUS[0]}
echo "nameset-judge rc $g · 로그 $LOG" | tee -a "$OUT/hdr.log"
exit $g
