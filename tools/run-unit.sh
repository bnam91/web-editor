#!/bin/bash
# 유닛 전체 스위트 러너 — 합계 pass/fail 를 한 줄로. 사용: bash tools/run-unit.sh
cd "$(dirname "$0")/.." || exit 1
tp=0; tf=0; bad=0
for f in tests/unit/*.test.js tests/unit/*.test.mjs; do
  out=$(node "$f" 2>&1); code=$?
  p=$(echo "$out" | grep -E 'pass [0-9]+$' | tail -1 | grep -oE '[0-9]+')
  fl=$(echo "$out" | grep -E 'fail [0-9]+$' | tail -1 | grep -oE '[0-9]+')
  p=${p:-0}; fl=${fl:-0}
  tp=$((tp+p)); tf=$((tf+fl))
  if [ "$code" != "0" ] || [ "$fl" != "0" ]; then bad=1; printf "FAIL %-40s pass=%s fail=%s exit=%s\n" "$(basename $f)" "$p" "$fl" "$code"; fi
done
echo "TOTAL pass=$tp fail=$tf"
exit $bad
