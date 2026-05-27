#!/usr/bin/env bash
# check-design-tokens.sh — 디자인 토큰 일관성 가드레일
# 미정의 --ui-* 토큰(사용됐지만 정의 없음) 검출 + 하드코딩 색/px 카운트(회귀 추세).
# 런타임 토큰(--ui-scale, --inv-zoom)은 editor.js에서 set되므로 미정의 검사에서 제외.
set -euo pipefail
cd "$(dirname "$0")/.."

CSS_GLOB=(css/*.css)
JS_GLOB=(js/*.js js/**/*.js)
RUNTIME_TOKENS='--ui-scale|--inv-zoom'

echo "== --ui-* 토큰 검사 =="
grep -rhoE '^\s*--ui-[a-z0-9-]+\s*:' "${CSS_GLOB[@]}" 2>/dev/null | grep -oE -- '--ui-[a-z0-9-]+' | sort -u > /tmp/_ui_def.txt
grep -rhoE 'var\(\s*--ui-[a-z0-9-]+' "${CSS_GLOB[@]}" "${JS_GLOB[@]}" 2>/dev/null | grep -oE -- '--ui-[a-z0-9-]+' | sort -u > /tmp/_ui_use.txt
echo "정의: $(wc -l < /tmp/_ui_def.txt) / 사용: $(wc -l < /tmp/_ui_use.txt)"

UNDEFINED=$(comm -13 /tmp/_ui_def.txt /tmp/_ui_use.txt | grep -vE -e "$RUNTIME_TOKENS" || true)
if [ -n "$UNDEFINED" ]; then
  echo "❌ 미정의 --ui-* 토큰(사용됐지만 정의 없음):"
  echo "$UNDEFINED" | sed 's/^/   /'
  STATUS=1
else
  echo "✅ 미정의 --ui-* 토큰 없음"
  STATUS=0
fi

echo ""
echo "== 하드코딩 카운트 (추세 모니터) =="
echo "CSS 색(#hex+rgb): $(grep -rhoE '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)' "${CSS_GLOB[@]}" 2>/dev/null | wc -l | tr -d ' ')"
echo "CSS px 리터럴:    $(grep -rhoE '[0-9]+px' "${CSS_GLOB[@]}" 2>/dev/null | wc -l | tr -d ' ')"
echo "JS 색(#hex+rgb):  $(grep -rhoE '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)' "${JS_GLOB[@]}" 2>/dev/null | wc -l | tr -d ' ')  (대부분 캔버스 콘텐츠 — 정상)"

exit $STATUS
