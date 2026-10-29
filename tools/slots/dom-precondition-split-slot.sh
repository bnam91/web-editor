#!/bin/bash
# dom-precondition-split-slot.sh — tests/dom/precondition-split.gate.js 를 «부르는 자»(293 · imac-grade 261029)
#
# ★왜: 전수 빨강 수를 판정에 쓰기 전에 «전제 실패(판 정체)» 를 떼어 낸다 — Intel «늘 빨강 89» 중 42 가 안 돈 것이었다(293).
#   ⇒ 부르는 자리 = run-complete.gate 바로 옆(같은 회차 로그 · 같은 명령 묶음). «나중에 사람이 본다» 면 또 썩는다.
# ⛔CI 한 줄로 갈음하지 않는다(dom-run-complete-slot.sh 머리말과 같은 까닭 — 이 자는 그 회차 전수 로그를 읽는다).
# 하는 일: 전수 로그 하나 → run-complete.gate(끝까지 돌았나) → precondition-split.gate(전제 실패 / 그 밖).
# 쓰기: bash tools/slots/dom-precondition-split-slot.sh <전수 로그>
#        (로그를 안 주면 가장 새 .slot-out/dom-*/run.log — dom-run-complete-slot.sh 가 남긴 것)
# rc = precondition-split rc(0 갈랐다 · 3 못 쟀다) · run-complete rc 는 옆에 같이 찍기만 한다
#   ⛔run-complete rc 로 거르지 않는다 — 그 자의 rc 1 은 «끝까지 안 돎» 과 «명부 밖 빨강» 둘 다다(가를 수 없다).
#   «끝까지 안 돈 로그» 는 precondition-split 이 스스로 «블록 수 ≠ failed+flaky · 요약 없음» 으로 rc 3(못 쟀다)을 낸다.
set -u
cd "$(dirname "$0")/../.." || exit 3
LOG=${1:-$(ls -t .slot-out/dom-*/run.log 2>/dev/null | head -n 1)}
[ -n "$LOG" ] && [ -f "$LOG" ] || { echo "⛔전수 로그가 없다 — 못 쟀다"; exit 3; }
node tests/dom/run-complete.gate.js "$LOG"; c=$?
node tests/dom/precondition-split.gate.js "$LOG"; p=$?
echo "run-complete.gate rc $c · precondition-split.gate rc $p · 로그 $LOG"
exit $p
