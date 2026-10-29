#!/bin/bash
# unit-time-slot.sh — tests/unit-time.gate.js 를 «부르는 자»(196 ⑸ · 266 · S3 261029 · 지디 23:0x)
#
# ★왜 레포 안에 두나(266 GATE-FILES-IN-REPO-WITH-ZERO-CALLERS-01):
#   이 게이트를 부른 자는 레인 홈(~/taeyang-098/s3-137/k196-slot.sh · 버전관리 밖)뿐이었다 ⇒ «자는 레포 안 · 부르는 자는 밖» 이라
#   git grep 으로 «누가 부르나» 가 안 보였다. 자와 부르는 자를 같은 나무에 둔다(tests/unit/gate-callers.test.mjs 가 잰다).
# ⛔CI(.github/workflows) 에 «node tests/unit-time.gate.js» 한 줄 다는 것은 답이 아니다:
#   이 게이트의 «연속 두 회차» 는 --record 로 tests/unit/UNIT_SLOW.json 의 last_over 를 «파일에 써서» 다음 회차로 넘긴다
#   (unit-time.gate.js :53 · :74). CI 러너는 일회용이고 커밋하지 않는다 ⇒ 둘째 회차가 영영 안 선다 ⇒ «돈다» 고 믿게 될 뿐이다.
#   부르는 자의 조건 셋(지디 23:0x): ⑴ 기록(last_over)을 커밋할 수 있다 ⑵ 유닛 전수를 돌 창이 있다 ⑶ 사람이 결과를 읽고 판정한다 ⇒ 레인 슬롯.
#
# 하는 일(두 회차 · 같은 판):
#   ① 유닛 전수 1 회차(JUnit 덧보고) → 게이트 --record(이번 넘음을 last_over 로 · 명부 낡음 한 줄도 찍힘)
#   ② 유닛 전수 2 회차 → 게이트 판정(연속 두 회차 넘으면 rc 1)
#   ⇒ 끝나면 tests/unit/UNIT_SLOW.json 의 last_over 변경을 «회차 증거와 함께» 커밋하는 것은 사람 몫(이 스크립트는 커밋 안 함).
# 갈음 자리(레인마다 다름 · 환경변수):
#   SLOT_GATE   착수·회차 사이 문턱 명령(없으면 안 잼)   예: SLOT_GATE="bash ~/taeyang-098/heavy-gate.sh"
#   SLOT_RUNNER 유닛 전수 명령(기본 «npm test»)          예: SLOT_RUNNER="bash ~/taeyang-098/run-test.sh unit"
#   SLOT_OUT    회차 산출 폴더(기본 ./.slot-out/unit-time-<시각>) · ⛔레포 안 추적 파일에 쓰지 않는다(UNIT_SLOW.json 의 --record 만 예외)
# 쓰기: bash tools/slots/unit-time-slot.sh   (레포 뿌리에서) → rc 0 통과 · 1 연속 두 회차 느려짐 · 3 못 잼 · 5 문턱 미달
set -u
cd "$(dirname "$0")/../.." || exit 3
OUT=${SLOT_OUT:-.slot-out/unit-time-$(date +%H%M%S)}; mkdir -p "$OUT"
RUNNER=${SLOT_RUNNER:-npm test}
gate() { [ -z "${SLOT_GATE:-}" ] && return 0; eval "$SLOT_GATE" | tee -a "$OUT/hdr.log"; return ${PIPESTATUS[0]}; }
echo "# $(git rev-parse HEAD) · unit-time-slot · $(date '+%F %T')" > "$OUT/hdr.log"
for tag in u1 u2; do
  gate || { echo "문턱 미달($tag 앞) — 안 돎" | tee -a "$OUT/hdr.log"; exit 5; }
  GOYA_TEST_JUNIT="$PWD/$OUT/$tag.xml" eval "$RUNNER" > "$OUT/$tag.log" 2>&1; echo "$tag 러너 rc $?" | tee -a "$OUT/hdr.log"
  [ -s "$OUT/$tag.xml" ] || { echo "⛔$tag JUnit 없음 — 못 잰다" | tee -a "$OUT/hdr.log"; exit 3; }
done
node tests/unit-time.gate.js "$OUT/u1.xml" --record | tee -a "$OUT/hdr.log"; r1=${PIPESTATUS[0]}
node tests/unit-time.gate.js "$OUT/u2.xml" | tee -a "$OUT/hdr.log"; r2=${PIPESTATUS[0]}
echo "게이트 u1(--record) rc $r1 · u2 rc $r2 · last_over 변경은 회차 증거($OUT)와 함께 사람이 커밋" | tee -a "$OUT/hdr.log"
exit $r2
