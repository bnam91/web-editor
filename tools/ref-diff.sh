#!/bin/bash
# ref-diff.sh — 런 «앞·뒤» 로 레포 refs 를 찍어 «무엇이» 바뀌었나를 이름째 찍는다
#   (291 ⒠' 표 2+3 · imac-grade 261029 — 금지선 K16 «refs/heads·refs/tags 쓰지 마라» ＋ K12 «git fetch origin 이 공유 origin/* 를 움직인다»)
#
# ★왜: 워크트리에서 만든 ref 는 그 레포(라이브)의 refs 에 산다 — 현빈의 git branch / git tag / origin/* 에 보인다.
#   금지선은 있었는데 재는 자가 0 이었다(291 표).
# ★쓰기(레포 안 어느 워크트리에서든 — 공유 .git 을 찍는다)
#   bash tools/ref-diff.sh snap <저장 파일>            # 지금 refs 전부(이름 sha)
#   bash tools/ref-diff.sh diff <앞 파일> <뒤 파일>    # + 늘어남 · - 사라짐 · ~ 바뀜 — 자리 둘로 갈라 찍는다
#     ㉮ 금지 자리 = refs/heads · refs/tags · refs/remotes/origin   ← 여기 차이가 있으면 rc 1
#     ㉯ 그 밖 자리 = refs/<레인>/… · refs/gd-*/… 등               ← 찍기만(rc 안 바꿈 · 레인 제 자리는 금지가 아니다)
#   rc 0 = 금지 자리 같다 · 1 = 금지 자리 다르다 · 3 = 못 쟀다 · 2 = 쓰는 법
# ★부르는 자리(꼴만 — 레인 슬롯 끝 · run-complete 묶음 · ⛔레인 맥 설정이라 여기서 박지 않는다):
#   bash tools/ref-diff.sh snap "$OUT/refs.before"                                   # 런 앞
#   … 런 → run-complete.gate …
#   bash tools/ref-diff.sh snap "$OUT/refs.after" && bash tools/ref-diff.sh diff "$OUT/refs.before" "$OUT/refs.after" > "$OUT/refs.diff"; echo "ref-diff rc $?" >> "$OUT/hdr.log"
# ⛔이 자가 안 재는 것: 누가·언제(reflog — 다르면 git reflog show <이름> 으로 따로) · 런 «도중» 생겼다 지워진 ref(앞뒤 둘만 본다)
set -u
FORBID='^refs/(heads|tags|remotes/origin)/'
case "${1:-}" in
  snap)
    [ -n "${2:-}" ] || { echo "⛔쓰는 법: snap <저장 파일>"; exit 2; }
    git for-each-ref --format='%(refname) %(objectname)' > "$2.tmp" || { echo "⛔for-each-ref 실패 — 못 쟀다"; rm -f "$2.tmp"; exit 3; }
    LC_ALL=C sort "$2.tmp" > "$2"; rm -f "$2.tmp"
    echo "snap $(wc -l < "$2" | tr -d ' ') refs · 금지 자리 $(grep -cE "$FORBID" "$2") · $(git rev-parse --git-common-dir) · $(date '+%F %T %Z')" ;;
  diff)
    A=${2:-}; B=${3:-}
    [ -f "$A" ] && [ -f "$B" ] || { echo "⛔앞/뒤 파일이 없다 — 못 쟀다"; exit 3; }
    # 이름으로 짝짓는다(join 입력은 사전순 — snap 이 LC_ALL=C sort 로 쓴다)
    d=$(LC_ALL=C join -a1 -a2 -e '∅' -o '0,1.2,2.2' "$A" "$B" | awk '$2!=$3 { if ($2=="∅") print "+ " $1 " " $3; else if ($3=="∅") print "- " $1 " " $2; else print "~ " $1 " " $2 " → " $3 }')
    f=$(grep -E "^[-+~] refs/(heads|tags|remotes/origin)/" <<<"$d")
    o=$(grep -vE "^[-+~] refs/(heads|tags|remotes/origin)/" <<<"$d" | grep -v '^$')
    nf=$(grep -c . <<<"$f"); no=$(grep -c . <<<"$o")
    [ -n "$f" ] && { echo "㉮ 금지 자리"; echo "$f"; }
    [ -n "$o" ] && { echo "㉯ 그 밖 자리(찍기만)"; echo "$o"; }
    echo "금지 자리 차 $nf · 그 밖 자리 차 $no · 앞 $(wc -l < "$A" | tr -d ' ') · 뒤 $(wc -l < "$B" | tr -d ' ')"
    [ "$nf" -eq 0 ] && exit 0 || exit 1 ;;
  *) echo "⛔쓰는 법: snap <파일> | diff <앞> <뒤>"; exit 2 ;;
esac
