#!/bin/bash
# touch-guard-slot.sh — tools/touch-guard.py 를 «부르는 자»(307 · S6 261031 · 지디 NINEINTEL ⑥ ㉡)
#
# ★왜 레포 안에 두나: 「런 앞뒤에 찍는다」 가 어디서 불리나가 없으면 자는 안 돈다. 자와 부르는 자를 같은 나무에 둔다.
# 재는 자 = tests/unit/touch-guard.test.mjs TG5(부름 줄을 끄면 빨강).
# 하는 일: 런 앞 snap → 명령 그대로(cwd·인자 안 바꿈) → 런 뒤 diff. ⛔나무에 안 쓴다(찍은 값은 SLOT_OUT).
# 갈음 자리(환경변수):
#   SLOT_TREE  볼 나무(기본 ./node_modules — 레인 자리에선 심링크를 풀어 그 맥 라이브를 읽기만 한다)
#   SLOT_OUT   산출 폴더(기본 mktemp -d · ⛔추적 파일에 쓰지 않는다)
# 쓰기: bash tools/slots/touch-guard-slot.sh node_modules/.bin/playwright test --config=tests/dom/playwright.dom.config.js <spec> --workers=1 --retries=0
#   → rc = 가드가 깨끗하면 명령 rc · 6 나무가 바뀜(이름은 글로) · 7 못 쟀다 · 3 python·명령 없음(안 돈다)
# ⚠️자 한계: tools/touch-guard.py 머리말 «보는 범위» 그대로(심링크 안 따라감 · 내용 안 봄 · 나무 하나 · 앞뒤 두 점). 다른 레인이 그 사이 바꿔도 6 이다(임자는 못 가른다).
set -u
HERE=$(cd "$(dirname "$0")/../.." && pwd) || exit 3
PY=$(command -v python3 || command -v python) || { echo "⛔python 없음 — 못 잰다(통과 아님) · 안 돈다"; exit 3; }
[ $# -gt 0 ] || { echo "⛔명령 없음"; exit 3; }
TREE=${SLOT_TREE:-node_modules}
OUT=${SLOT_OUT:-$(mktemp -d)}; mkdir -p "$OUT"
"$PY" -I "$HERE/tools/touch-guard.py" snap "$TREE" "$OUT/before.json" || { echo "⛔런 앞을 못 찍었다 — 안 돈다"; exit 7; }
"$@"; rc=$?
"$PY" -I "$HERE/tools/touch-guard.py" diff "$TREE" "$OUT/before.json"; g=$?
echo "touch-guard rc $g · 명령 rc $rc · 찍은 값 $OUT/before.json"
[ "$g" -eq 1 ] && exit 6
[ "$g" -eq 0 ] || exit 7
exit "$rc"
