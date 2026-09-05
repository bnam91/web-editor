#!/bin/bash
# ★회귀 테스트의 «유효성»은 초록으로 증명되지 않는다 — 결함을 되살려 «빨강»이 뜨는지로 증명된다.
#   각 변이는 판정 술어에서 축 하나를 지운다. 테스트가 그대로 초록이면 그 테스트는 이름값을 못 한다.
cd "$(dirname "$0")/../.." || exit 1
SRC=js/io/export-gate-core.js
BAK=$(mktemp); cp "$SRC" "$BAK"
run() { node --test "tests/unit/export-gate-judge.test.mjs" >/tmp/exgate-mut.log 2>&1; }
try() {                       # $1=이름  $2=sed 표현식
  cp "$BAK" "$SRC"
  arch -arm64 python3 - "$2" <<'PY'
import sys, re
p='js/io/export-gate-core.js'; s=open(p).read()
old, new = sys.argv[1].split('|||')
assert old in s, 'anchor missing: '+old[:60]
open(p,'w').write(s.replace(old, new, 1))
PY
  if run; then echo "  ⛔ $1 — 변이했는데 «초록»(테스트가 이 축을 안 지킨다)"; BAD=$((BAD+1));
  else echo "  ✅ $1 — 빨강 ($(grep -c '^not ok\|✖' /tmp/exgate-mut.log 2>/dev/null | head -1)건 실패)"; fi
}
BAD=0
echo "── judge 변이 검증"
try "(a) sizeMismatch 분기 제거" "  if (m.sizeMismatch) reasons.push('sizeMismatch');|||"
try "(b) bandCount 를 «다시» 판정에 넣기(오탐 복귀)" "  if (m.sizeMismatch) reasons.push('sizeMismatch');|||  if (m.sizeMismatch) reasons.push('sizeMismatch');\n  if (m.bandMismatch) reasons.push('bandCount');"
try "(c) 재검사(unstable) 무시"  "  if (c.repro === 'unstable')      return { tier: 'unmeasured', reasons: ['unstable'] };|||"
try "(d) imgTimedOut 무시"       "  if (c.imgTimedOut)               return { tier: 'unmeasured', reasons: ['imgTimeout'] };|||"
try "(e) blob 임계를 0 으로(항상 켜짐)" "export let BLOB_MIN = Infinity;|||export let BLOB_MIN = 0;"
try "(f) 루마를 «채널 최대»로(three-way 식)" "  return (r * 19595 + g * 38470 + b * 7471 + 32768) >> 16;|||  return Math.max(r, g, b);"
try "(g) 침식을 «안 하고» 그냥 total 로"   "        if (all) blob++;|||        blob++;"
try "(h) minor 를 mismatch 로(오탐 방지선 제거)" "  if (m.total > 0) return { tier: 'minor', reasons: [] };|||  if (m.total > 0) return { tier: 'mismatch', reasons: ['total'] };"
cp "$BAK" "$SRC"; rm -f "$BAK"
echo "── 변이 중 «초록으로 통과한» 것: $BAD (0 이어야 한다)"
[ "$BAD" = 0 ]
