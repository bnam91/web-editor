#!/bin/bash
# 유닛 전체 스위트 러너 — 합계 pass/fail 을 한 줄로. 사용: bash tools/run-unit.sh
#
# ★[2026-08-28] 크래시를 «세는» 이유: 초판은 파일이 통째로 죽어도(SyntaxError 등)
#   pass/fail 숫자를 «못 읽어» 0 으로 치고 TOTAL 에 fail=0 을 찍었다.
#   3개 파일이 로드조차 안 되는데 「fail=0」이 나왔고, 나는 그 줄을 보고 커밋했다.
#   ⇒ 「못 쟀다」를 「이상 없다」로 읽는 그 병이다. 크래시는 크래시로 «따로» 센다.
cd "$(dirname "$0")/.." || exit 1
tp=0; tf=0; tc=0; bad=0
for f in tests/unit/*.test.js tests/unit/*.test.mjs; do
  out=$(node "$f" 2>&1); code=$?
  p=$(echo "$out" | grep -E 'pass [0-9]+$' | tail -1 | grep -oE '[0-9]+')
  fl=$(echo "$out" | grep -E 'fail [0-9]+$' | tail -1 | grep -oE '[0-9]+')
  if [ -z "$p" ] && [ -z "$fl" ]; then
    # 테스트 러너가 요약조차 못 냈다 = 파일이 죽었다
    tc=$((tc+1)); bad=1
    printf "CRASH %-40s exit=%s  %s\n" "$(basename "$f")" "$code" "$(echo "$out" | grep -m1 -E 'Error|error:' | cut -c1-90)"
    continue
  fi
  p=${p:-0}; fl=${fl:-0}
  tp=$((tp+p)); tf=$((tf+fl))
  if [ "$code" != "0" ] || [ "$fl" != "0" ]; then
    bad=1; printf "FAIL  %-40s pass=%s fail=%s exit=%s\n" "$(basename "$f")" "$p" "$fl" "$code"
  fi
done
if [ "$tc" != "0" ]; then
  echo "TOTAL pass=$tp fail=$tf ★CRASH=$tc  ⛔크래시가 있으면 pass 합계는 «못 믿는다»"
else
  echo "TOTAL pass=$tp fail=$tf"
fi
exit $bad
