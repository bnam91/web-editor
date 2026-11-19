#!/usr/bin/env bash
# check-design-tokens.sh — 디자인 토큰 일관성 가드레일
#   ① 미정의 --ui-* 토큰(사용됐지만 정의 없음) → exit 1
#   ② 신규 패널 층(_panel-frame.js · _section-spec.js · editor-props.css 「패널 절」 블록)에
#      색·px 리터럴(#hex · rgb(a)( · Npx — 인라인 style= 포함)이 1건이라도 → exit 1  (하드게이트)
#   ③ 래칫: scripts/design-tokens.baseline.json 보다 늘면 → exit 1. 줄면 안내만(rc 0) —
#      운영: baseline 내림은 각 단위가 하지 않고 지디가 dev 머지 때 한 번에 한다(병렬 단위끼리 baseline 충돌 방지).
# 런타임 토큰(--ui-scale, --inv-zoom)은 editor.js에서 set되므로 미정의 검사에서 제외.
#
# 사용: scripts/check-design-tokens.sh [추가-신규층-파일 ...]
#   인자로 준 파일은 ②의 신규 층에 더해 검사한다(tests/unit/design-tokens-guard.test.mjs 의 양성대조용).
# ⛔globstar 를 쓰지 않는다 — macOS 기본 bash 3.2 에는 `shopt -s globstar` 가 없다(쓰면 즉사). 재귀는 find 로.
set -euo pipefail
cd "$(dirname "$0")/.."

CSS_FILES=()
while IFS= read -r f; do CSS_FILES+=("$f"); done < <(find css -name '*.css' -type f | sort)
JS_FILES=()
while IFS= read -r f; do JS_FILES+=("$f"); done < <(find js -name '*.js' -type f | sort)
PROPS_JS=()
while IFS= read -r f; do PROPS_JS+=("$f"); done < <(find js/props -name '*.js' -type f | sort)
RUNTIME_TOKENS='--ui-scale|--inv-zoom'
LIT_RE='#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|[0-9]+(px|r?em)\b'
# PF_CSS · BASELINE 은 환경변수로 덮어쓸 수 있다(tests/unit/design-tokens-guard.test.mjs 양성대조 G4·G5 용)
BASELINE=${BASELINE:-scripts/design-tokens.baseline.json}
TMP=$(mktemp -d "${TMPDIR:-/tmp}/gd-tokens.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
STATUS=0
# ★세기 = node 한 벌(기계 무관) — grep 은 판·로캘마다 \b 를 다르게 본다: UTF-8 로캘의 grep·rg 는 한글을 «글자»로 봐
#   css/editor-base.css:177 주석 «#252525로» 를 안 세고(1635), ASCII \b 판(macOS 13 grep 등)은 센다(1636).
#   JS 정규식 \b 는 늘 ASCII 라 어디서나 같은 수.
#   정규식 글자는 그대로 · grep 처럼 «줄 단위»(줄을 넘는 매치 없음) · node 는 npm test 가 도는 곳(windows-latest 포함)에 늘 있다.
#   rx_count RE 파일…  → 전체 매치 수 · rx_list RE 파일… → «파일:줄:매치» 한 줄씩 · rx_inline STYLE_RE LIT_RE 파일… → LIT 를 품은 STYLE 매치 수
_rx() { node -e '
const fs = require("fs"); const [mode, a, b, ...files] = process.argv.slice(1);
const ra = new RegExp(a, "g"); const rb = mode === "inline" ? new RegExp(b) : null; if (mode !== "inline") files.unshift(b);
let n = 0; const out = [];
for (const f of files) { if (!f) continue; let t; try { t = fs.readFileSync(f, "utf8"); } catch { continue; }
  t.split(/\r?\n/).forEach((ln, i) => { for (const m of ln.matchAll(ra)) {
    if (mode === "inline") { if (rb.test(m[0])) n++; } else if (mode === "list") out.push(`${f}:${i + 1}:${m[0]}`); else n++; } }); }
process.stdout.write(mode === "list" ? (out.length ? out.join("\n") + "\n" : "") : String(n) + "\n");
' "$@"; }
rx_count()  { _rx count "$@"; }
rx_list()   { _rx list "$@"; }
rx_inline() { _rx inline "$@"; }

# ①의 이름 글자에 _ 포함(261119) — 전엔 --ui-space-0_5 를 --ui-space-0 으로 잘라 «정의·사용»을 잘린 이름끼리 맞췄다(오타 0_6 도 통과). 조임이지 래칫 완화 아님.
echo "== ① --ui-* 토큰 검사 =="
{ grep -hoE '^\s*--ui-[a-z0-9_-]+\s*:' "${CSS_FILES[@]}" 2>/dev/null || true; } | grep -oE -- '--ui-[a-z0-9_-]+' | sort -u > "$TMP/def.txt" || true
{ grep -hoE 'var\(\s*--ui-[a-z0-9_-]+' "${CSS_FILES[@]}" "${JS_FILES[@]}" 2>/dev/null || true; } | grep -oE -- '--ui-[a-z0-9_-]+' | sort -u > "$TMP/use.txt" || true
echo "정의: $(wc -l < "$TMP/def.txt" | tr -d ' ') / 사용: $(wc -l < "$TMP/use.txt" | tr -d ' ')"
UNDEFINED=$(comm -13 "$TMP/def.txt" "$TMP/use.txt" | grep -vE -e "$RUNTIME_TOKENS" || true)
if [ -n "$UNDEFINED" ]; then
  echo "❌ 미정의 --ui-* 토큰(사용됐지만 정의 없음):"
  echo "$UNDEFINED" | sed 's/^/   /'
  STATUS=1
else
  echo "✅ 미정의 --ui-* 토큰 없음"
fi

echo ""
echo "== ② 신규 패널 층 하드게이트 (색·px 리터럴 0) =="
# 기본 신규 층 JS 는 «있으면» 잰다(그 파일을 들이는 커밋 전 판에서도 돌게) · 인자로 준 파일은 없으면 실패다.
NEW_LAYER=()
for f in js/props/_panel-frame.js js/props/_section-spec.js; do [ -f "$f" ] && NEW_LAYER+=("$f"); done
for f in "$@"; do NEW_LAYER+=("$f"); done
: > "$TMP/newlayer.txt"
for f in ${NEW_LAYER[@]+"${NEW_LAYER[@]}"}; do
  [ -f "$f" ] || { echo "❌ 신규 층 파일이 없다: $f"; STATUS=1; continue; }
  rx_list "$LIT_RE" "$f" >> "$TMP/newlayer.txt"
done
# editor-props.css 의 「패널 절」 블록 — BEGIN/END 표식 사이만 (표식이 없으면 못 잰 것이다 ⇒ 실패)
PF_CSS=${PF_CSS:-css/editor-props.css}
if grep -q 'panel-frame:BEGIN' "$PF_CSS" && grep -q 'panel-frame:END' "$PF_CSS"; then
  awk '/panel-frame:BEGIN/{on=1;next} /panel-frame:END/{on=0} on{print FILENAME":"NR":"$0}' "$PF_CSS" \
    | { grep -E "$LIT_RE" || true; } >> "$TMP/newlayer.txt"
else
  echo "❌ $PF_CSS 에 panel-frame:BEGIN/END 표식이 없다 — 신규 층 CSS 를 못 잰다"
  STATUS=1
fi
if [ -s "$TMP/newlayer.txt" ]; then
  echo "❌ 신규 층에 리터럴 $(wc -l < "$TMP/newlayer.txt" | tr -d ' ')건 — var(--ui-*) 로 바꿔라:"
  sed 's/^/   /' "$TMP/newlayer.txt"
  STATUS=1
else
  echo "✅ 신규 층 리터럴 0 (${#NEW_LAYER[@]}파일 + 패널 절 CSS 블록)"
fi

echo ""
echo "== ③ 래칫 (baseline: $BASELINE) =="
# props-inline-hardcoded = js/props/**.js 의 인라인 style="…"/style='…' 중 색·px 리터럴을 품은 것의 수
PROPS_INLINE=$(rx_inline "style=\"[^\"]*\"|style='[^']*'" "$LIT_RE" "${PROPS_JS[@]}")
CSS_PX=$(rx_count '[0-9]+px' "${CSS_FILES[@]}")
CSS_COLOR=$(rx_count '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)' "${CSS_FILES[@]}")
JS_COLOR=$(rx_count '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)' "${JS_FILES[@]}")
base_of() { grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" "$BASELINE" | grep -oE '[0-9]+$' || true; }
ratchet() { # 이름 현재값
  local b; b=$(base_of "$1")
  if [ -z "$b" ]; then echo "❌ $1: baseline 에 값이 없다"; STATUS=1; return; fi
  if [ "$2" -gt "$b" ]; then echo "❌ $1: $2 > 기준 $b — 하드코딩이 늘었다(토큰을 써라)"; STATUS=1
  elif [ "$2" -lt "$b" ]; then echo "✅ $1: $2 < 기준 $b — 줄었다. $BASELINE 을 $2 로 내려 커밋하라(래칫)"
  else echo "✅ $1: $2 = 기준"; fi
}
if [ -f "$BASELINE" ]; then
  ratchet props-inline-hardcoded "$PROPS_INLINE"
  ratchet css-px "$CSS_PX"
  ratchet css-color "$CSS_COLOR"
else
  echo "❌ $BASELINE 이 없다"; STATUS=1
fi
echo "JS 색(#hex+rgb):  $JS_COLOR  (대부분 캔버스 콘텐츠 — 정상 · 추세만)"

exit $STATUS
