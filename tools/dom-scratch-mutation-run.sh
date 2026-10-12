#!/bin/bash
# 1009t3 ⑦＋⑤ — ★전·후 ×N ＋ ★변이. ⛔스크래치패드가 아니라 ★이 durable 자리에 산다(사라지면 조용히 안 돈다).
set -u
L="$(cd "$(dirname "$0")/.." && pwd)"   # ★레포 뿌리 — ★스크립트 자리에서(⛔레인 경로 ★박지 않는다)
B="${GD_MUT_OUT:-/tmp/dom-scratch-mut}"; mkdir -p "$B"   # ★산출물 — env 로 옮긴다
O=$B/out-$(date +%H%M%S); mkdir -p "$O"
GUARDLOG="$B/guard-tally.log"   # ★누적 — ★회차를 넘어 ★남는다(발동/끊은 수)
touch "$GUARDLOG"
W=/Users/a1/.claude/skills/지디/tools/suite-window.sh
CFG=tests/dom/playwright.dom.config.js
SG=tests/dom/scratch-group-mode.dom.spec.js
SP=tests/dom/scratch-pull-near-section.dom.spec.js
SC=tests/dom/scratch-cut-paste-group.dom.spec.js   # ⑧ ⌘X·붙여넣기·1장 그룹 자동 풂
cd "$L" || exit 9
say(){ echo "$@"; }
LOADNOW(){ sysctl -n vm.loadavg | awk '{print $2}'; }
# ★★`free` ★하나는 ★미확인이다 — ★`total` 이 ★움직이면 ★같은 free 가 ★다른 뜻이다(지디 실측 1,024M 축소)
# ★★`memory_pressure` free % — ★★창 도구의 `_pressfree` 와 ★★같은 파서다(⛔새로 짜지 않는다)
_pressfree(){ memory_pressure 2>/dev/null | awk -F': *' '/free percentage/ { gsub(/%/,"",$2); printf "%d", $2; exit }' || true; }
_swapall(){ sysctl vm.swapusage 2>/dev/null | sed -n 's/.*total = \([0-9.]*\)M.*used = \([0-9.]*\)M.*free = \([0-9.]*\)M.*/total=\1 used=\2 free=\3/p'; }
# ★★«내가 띄운 pid 의 ★자손»만 RSS 를 합한다 — ⛔전체 합 금지(★공유 메모리가 ★중복 계상된다)
#   ⛔이 자가 ★★안 재는 것: ★swap 으로 ★나간 몫은 ★RSS 에 ★안 잡힌다(t3suite 가 적었다)
#            ＋ ★공유 라이브러리가 ★프로세스마다 ★거듭 세어진다(RSS 의 ★알려진 한계)
_rss_tree(){ python3 - "$1" <<'PYEOF'
import subprocess,sys
root=int(sys.argv[1])
out=subprocess.run(['ps','-eo','pid=,ppid=,rss='],capture_output=True,text=True).stdout
kids={};rss={}
for l in out.splitlines():
    f=l.split()
    if len(f)>=3:
        try: pid,ppid,r=int(f[0]),int(f[1]),int(f[2])
        except ValueError: continue
        kids.setdefault(ppid,[]).append(pid); rss[pid]=r
seen=set();st=[root];tot=0;n=0
while st:
    q=st.pop()
    if q in seen: continue
    seen.add(q); tot+=rss.get(q,0)
    if q in rss: n+=1
    st.extend(kids.get(q,[]))
print(tot,n)
PYEOF
}
STOP=""        # ⛔LOWMAX·LOWLINE 은 ★위 ⚰️ 와 함께 ★사라졌다(쓰는 자가 ★0 이다)
# ★★★«<500×3» ★★★떼었다 — ★server-manager ★수용(2026-10-10 07:0x) · ★지디 비준 · ⛔되돌리지 않는다
#   ★까닭 ⑴ ★그 축이 ★★«남의 변동»이다 — t3suite 실측: ★러너 0 에서 ★655MB 가 혼자 움직였다
#   ★까닭 ⑵ ★내 실측: ★그 자가 ★pre-group 을 ★20초에 끊었는데 ★내 RSS 최고는 ★812,336KB 로 ★멀쩡했다
#   ★까닭 ⑶ ★★입구 선을 ★폐기하면서 ★★같은 축의 ★이 겹을 ★유지한 것이 ★비일관이었다(server-manager 자인)
#   ★★★그리고 ★★분모가 ★움직인다 — 지디 교차검증: swap `total` 이 ★29,696M → ★28,672M (★1,024M ★줄었다)
#     ⇒ ★`free` 가 떨어지는 까닭이 ★★둘이다: ㉠누가 더 썼다 ㉡★OS 가 ★스왑 파일을 ★줄였다
#     ⇒ ★★`free` ★하나로는 ★★못 가른다 ⇒ ★아래 로그에 ★★`total·used·free` ★★셋을 ★다 찍는다
# ★★남긴 것 = ★★«pressure free < 15% ★1회 ⇒ ★즉시 멈춤». ⛔이건 ★절대 ★끄지 마라 — ★OOM 임박의 ★유일한 자다
#   (⚰️ 처음엔 ★swap free < 200MB 였다 — ★server-manager 가 ★pressure 로 갈았다 · ★`total` 이 ★양방향으로 움직여서)
# ★★주 자(phys_footprint_peak)가 ★N 과 함께 ★서면 ★그것이 ★주 신호가 된다


# ─── ★⑴ ★★잡았나? — ★내 다음 행동의 ★첫 줄(17분 자백의 처방) · ★두 겹으로 ★확인한다
say "═══ ⑴ ★★잡았나 — ★두 겹"
ST=$(bash "$W" status 2>&1); say "$ST" | sed 's/^/  /'
if ! printf '%s' "$ST" | grep -q 't2cmdl'; then
  say "⛔★창이 ★내 것이 ★아니다 — ★아무것도 ★안 돌린다"; exit 2
fi
say "  ✅ status 에 t2cmdl"

# ─── ★⑴b ★★입구 — ★★`swap free` 선은 ★폐기됐고 ★★`pressure` 선으로 ★갈렸다 (★server-manager 확정 2026-10-10)
#   ★실측: ★러너 ★0 · headless ★0 인데 swap free 가 ★992→337MB ⇒ ★★655MB 가 ★혼자 움직였다
#   ⇒ ★★«swap free» 는 ★«내 회차가 먹을 양»이 아니라 ★★«남이 먹고 남긴 양»이다 ⇒ ★입구 판정에 ★축이 안 맞는다
#   ＋ ★옛 선 둘의 차(1024−500=524MB)가 ★남의 변동폭(655MB)보다 ★작았다 ⇒ ★논리적으로도 ★안 맞았다
#   ⇒ ★★겨냥·묶음의 ★«swap» 입구 선은 ★없다. ★★대신 ★`pressure free ≥ 25%` ★하나를 ★둔다(아래).
#   ⇒ ★★그리고 ★★돌는 중에 ★다시 잰다(⑴c) — ★`pressure free < 15%` ★1회면 ★멈춘다.
#   ★전수(390 spec)는 ★별건이다 — ★그쪽 입구는 ★창 도구가 든다.
PF=$(_pressfree); PF=${PF:-0}
# ★★입구 = ★★`memory_pressure` free ≥ ★25% (★server-manager 확정 2026-10-10)
#   ⛔`swap free` 는 ★★게이트에서 ★★전부 ★빠졌다 — ★`total` 이 ★★양방향으로 움직인다(표본 셋: 29696 → 28672 → 29696)
#   ⇒ ★같은 `free` 가 ★다른 뜻이 된다 ⇒ ★판정 축으로 ★못 쓴다. ★★보고에는 ★셋 다 ★계속 적는다.
say "  ★입구 = pressure free ${PF}% (선 25) · 참고 swap $(_swapall)"
if [ -z "${PF}" ] || [ "${PF}" -lt 25 ]; then
  say "⛔★pressure free ${PF}% < 25 — ★안 돌린다"; exit 6
fi
say "  ✅ 입구 통과"

# ─── ★⑵ ★판·사본 전제 단언
say "═══ ⑵ ★판 ＋ ★사본 (★전제를 ★단언한다)"
HEADSHA=$(git rev-parse --short=8 HEAD); say "  HEAD = $HEADSHA (0 $(git rev-list --count origin/dev..HEAD))"
DIRTY=$(git -C "$L" status --porcelain -- js css tests/dom | wc -l | tr -d ' ')
if [ "$DIRTY" != "0" ]; then say "⛔작업트리가 ★더럽다(${DIRTY}건) — ⛔남의 변경을 덮지 않는다"; exit 7; fi
say "  ✅ 작업트리 깨끗 — ★사본 대신 ★git 으로 ★전제를 ★단언한다"

# ─── 한 벌 돌리는 자 — ★rc 를 ★파이프 없이 받고 ★명부를 ★이름으로 뜬다
run(){ # run <태그> <spec…>
  local tag="$1"; shift
  local jf="$O/$tag.json" lg="$O/$tag.log" l0; l0=$(LOADNOW)
  if [ -n "$STOP" ]; then say "  %-10s ⛔건너뛴다 — ★이미 멈췄다"; return 0; fi
  PLAYWRIGHT_JSON_OUTPUT_NAME="$jf" npx playwright test --config="$CFG" --reporter=json "$@" >"$lg" 2>&1 &
  local kid=$! low=0 pf rr nn
  local rssPeak=0 rssFirst=0 rssLast=0 procLast=0 samples=0 fpMax=0 fpSum=0 fpN=0 fpTop=- fpline=
  # ★★«돌는 중»에 ★행위로 잰다 — ★5초 간격(지디/server-manager 확정)
  #   ★주 신호(목표) = ★★«내 자손 RSS 증가» — ★이번 회차에선 ★★«재서 올린다»(아직 ★문턱 없음)
  #   ★안전장치 = ★★pressure free < 15% ★★1회 → ★★즉시 멈춤 ＋ ★명시 기록 (⚰️ 옛 꼴은 swap free < 200MB)
  #   ★안전장치 ⑵ = ★swap free < 500MB ★3회 연속 → 멈춤
  #     ⚠️★★이것은 ★폐기 ★예정이다 — ★단 ★★RSS 자가 ★서기 ★전에 떼면 ★중단 장치가 ★★0 이 된다
  #     ⇒ ★★순서를 지킨다: ★«<200×1» 을 ★먼저 넣고, ★«<500×3» 은 ★RSS 문턱이 ★설 때 ★뺀다(지디 판정)
  while kill -0 "$kid" 2>/dev/null; do
    sleep 5
    pf=$(_pressfree); pf=${pf:-0}      # ⛔★쓰는 자리보다 ★먼저 — `set -u` 아래서 ★첫 회차가 ★죽는다
    set -- $(_rss_tree "$kid"); rr=${1:-0}; nn=${2:-0}
    samples=$(( samples + 1 ))
    [ "$samples" -eq 1 ] && rssFirst=$rr
    [ "$rr" -gt "$rssPeak" ] && rssPeak=$rr
    echo "$(date '+%H:%M:%S') $tag press=${pf}% $(_swapall) load=$(LOADNOW) rssKB=${rr} proc=${nn}" >> "$O/mem.log"
    rssLast=$rr; procLast=$nn
    # ★★주 자 — `phys_footprint_peak` 합(★내 자손만). ★peak 이라 ★매 표본 필요 없다 ⇒ ★3회마다.
    #   ⛔RSS 는 ★보조다 — ★압축기가 ★살아 있는 채로 ★빼 간다(실측 83,792KB → 7,152KB)
    if [ $(( samples % 3 )) -eq 1 ]; then
      fpline=$(python3 "$L/tools/dom-scratch-fp-tree.py" "$kid" 2>/dev/null)
      set -- ${fpline:-0 0 -}; fpSum=${1:-0}; fpN=${2:-0}; fpTop=${3:--}
      echo "$(date '+%H:%M:%S') $tag fpPeakSumMB=${fpSum} procs=${fpN} top=${fpTop}" >> "$O/footprint.log"
      fpMax=$(python3 -c "print(max(float('${fpMax:-0}'),float('${fpSum:-0}')))")
    fi
    # ★안전장치 ⑴ — ★1회로 ★즉시
    # ★★안전장치 — ★★`memory_pressure` free < 15% ★★1회 ⇒ ★즉시 멈춤 (★server-manager 확정 2026-10-10)
    #   ★★⚰️여기 ★«swap free < 200MB ×1» 이 ★있었다. ★갈아 끼웠다 — ★★`swap free` 는 ★분모가 움직여 ★축이 안 맞는다.
    #   ⛔이 자는 ★★끄지 ★마라 — ★★OOM 임박의 ★유일한 자다(★입구 선이 ★폐기된 뒤로는 ★더욱).
    if [ "$pf" -lt 15 ]; then
      say "  ⛔★★pressure free ${pf}% < 15% — ★★1회로 ★즉시 멈춘다(★명시 기록 · 안전장치)"
      echo "STOP=press15 tag=$tag pressFree=${pf} $(_swapall) rssKB=${rr}" >> "$O/STOP.why"
      # ★★«보호한 것 vs ★끊은 것»을 ★견주려면 ★둘을 ★같이 세야 한다(server-manager 조건)
      echo "fired=1 killed=1 line=press15 tag=$tag press=${pf} $(date '+%F %H:%M:%S')" >> "$GUARDLOG"
      kill "$kid" 2>/dev/null; sleep 2; kill -9 "$kid" 2>/dev/null; STOP=1; break
    fi
    # ★★⚰️여기 ★«swap free < 500 ×3 ⇒ 멈춤» 갈래가 ★있었다. ★★줄째 ★★뺐다(★server-manager 수용 · 지디 비준).
    #   ⛔«LOWLINE=0 으로 꺼 두기»로 ★남기지 ★않았다 — ★그러면 ★★«막아둔 까닭은 죽고 ★문만 남는» 꼴이 된다.
    #   ★무엇을 잃나: ★이 자는 ★★한 번 ★발동했고(06:36 pre-group 을 20초에 끊었다) ★★그 발동이 ★거짓이었다
    #     (★같은 때 ★내 RSS 최고 812,336KB = ★멀쩡 · ★swap 변동은 ★남의 것).
    #   ★★남은 보호 = ★위 ★«< 200MB ★1회» ★하나다. ⛔그것은 ★끄지 ★마라.
  done
  # ⛔«끝 RSS» 를 ★자식이 ★죽은 ★뒤에 재면 ★★언제나 ★0 이다 — ★그 0 은 ★«메모리가 돌아왔다»가 ★아니라
  #   ★«그 나무가 ★없다»는 뜻이다(★실측으로 걸렸다: 죽은 root → `0 0`).
  #   ⇒ ★그래서 ★★«루프 ★마지막 표본»(rssLast)을 ★참값으로 쓴다.
  echo "$tag ★주자_fpPeakSumMB=${fpMax:-0} ｜ 보조_rssFirst=${rssFirst} rssPeak=${rssPeak} rssLast=${rssLast:-0} procLast=${procLast:-0} samples=${samples}" >> "$O/baseline.txt"
  say "  ★★주 자 footprint peak 합 = ${fpMax:-0}MB   ｜ ★보조 RSS(KB) 첫 ${rssFirst} · 최고 ${rssPeak} · 마지막 ${rssLast:-0}(프로세스 ${procLast:-0}) · 표본 ${samples}"
  say "     ⚠️RSS 는 ★압축에 ★무너진다(실측 83,792KB → 7,152KB · 프로세스는 ★살아 있었다) ⇒ ★N 판정에 ★쓰지 마라"
  wait "$kid"; local rc=$?   # ⛔파이프 뒤에서 받지 않는다
  python3 - "$jf" "$tag" "$rc" "$l0" <<'PY'
import json,sys
jf,tag,rc,l0=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
try: d=json.load(open(jf,encoding='utf-8'))
except Exception as e:
    print("  %-10s ⛔json 못 읽음 rc=%s (%s)"%(tag,rc,e)); sys.exit(0)
P=[];F=[];S=[]
def walk(su):
    for sp in su.get('specs',[]):
        ok=sp.get('ok'); st=[t.get('status') for r in sp.get('tests',[]) for t in r.get('results',[])]
        tgt = S if 'skipped' in st and not ok else (P if ok else F)
        tgt.append(sp.get('title','?'))
    for c in su.get('suites',[]): walk(c)
for su in d.get('suites',[]): walk(su)
print("  %-10s rc=%s  초록 %d · ★빨강 %d · skip %d   (load %s → %s)"%(tag,rc,len(P),len(F),len(S),l0,__import__('subprocess').run(['sysctl','-n','vm.loadavg'],capture_output=True,text=True).stdout.split()[1]))
for t in F: print("      ★빨강: "+t[:120])
for t in S: print("      skip : "+t[:120])
open(jf+'.red','w',encoding='utf-8').write("\n".join(F))
PY
}

# ─── ★⑶ ★★«전»(고치기 전) 빨강 — ★제품만 HEAD 로, ★spec 둘은 ★그대로
say "═══ ⑶ ★★«전» 빨강 — ★제품 3파일만 HEAD 로 되돌린다(spec 둘은 ★그대로 둔다)"
# ⛔`git checkout --` 를 ★쓰지 ★않는다 — ★⑦⑤ 를 ★커밋한 뒤로 ★HEAD 가 ★«고친 판»이다.
#   ★양성대조의 ★판은 ★HEAD 가 아니라 ★★못박은 ref(be4ebbc1) 여야 한다.
PRE="${GD_MUT_PRE:-be4ebbc1}"   # ★«고치기 전» 핀 — ⛔HEAD 로 두지 마라 · env 로 바꾼다
for f in js/scratch-pad.js js/scratchpad-link.js css/editor-canvas.css; do
  git -C "$L" show "${PRE}:${f}" > "$L/$f" || { say "⛔${PRE}:${f} 를 못 떴다"; exit 4; }
  if [ "$(git -C "$L" show "${PRE}:${f}" | shasum -a 256 | cut -d' ' -f1)" = "$(shasum -a 256 "$L/$f" | cut -d' ' -f1)" ]; then
    say "  ✅ $f = $PRE"
  else
    say "  ⛔ $f ≠ $PRE — ★중단"; exit 4
  fi
done
say "  dirty(제품 되돌린 뒤): $(git -C "$L" status --porcelain -- js css | tr '\n' '|')"

run pre-group "$SG"
run pre-pull  "$SP"
run pre-cut   "$SC"

# ─── ★⑷ ★원복 — ★해시로 ★확인한다(⛔「원복했다」도 ★재라)
[ -n "$STOP" ] && { say "⛔★멈췄다 — ★원복만 하고 ★나간다"; python3 "$MU" --revert | sed "s/^/  /"; git -C "$L" checkout -- js css; say "★출력: $O"; exit 7; }
say "═══ ⑷ ★원복(post) — ★해시 5/5"
git -C "$L" checkout -- js/scratch-pad.js js/scratchpad-link.js css/editor-canvas.css
LEFT=$(git -C "$L" status --porcelain -- js css | wc -l | tr -d ' ')
if [ "$LEFT" = "0" ]; then say "  ✅ 원복 (git checkout · status 0건)"
else say "⛔원복 안 됐다(${LEFT}건) — 중단"; exit 5; fi


say "═══ ⑸ ★★«후» 초록 ×3"
for i in 1 2 3; do run "post-group-$i" "$SG"; run "post-pull-$i" "$SP"; run "post-cut-$i" "$SC"; done

# ─── ★⑹ ★★변이 — ★「이 줄을 죽이면 ★무엇이 ★빨개지나」. ⛔0건이면 ★재는 자가 ★없다는 뜻이다
say "═══ ⑹ ★★변이 ×9 (★매 벌 ★원복 ★해시 확인) — ★수는 ★명부에서 센다"
MU="$L/tools/dom-scratch-mutate.py"
for pair in "M-EXCL-A:$SG" "M-EXCL-B:$SG" "M-NOOUTSIDE:$SG" "M-NODISSOLVE:$SC" "M-COUNT:$SP" "M-OLDDIST:$SP" "M-CEIL:$SP" "M-CEIL4:$SP" "M-CEIL2:$SP" "M-X4EARLY:$SP"; do
  m="${pair%%:*}"; sp="${pair##*:}"
  say "  ─── $m"
  python3 "$MU" "$m" || { say "  ⛔닻 실패 — 건너뛴다"; python3 "$MU" --revert >/dev/null; continue; }
  node --input-type=module --check < "js/scratch-pad.js" >/dev/null 2>&1 || say "    ⚠️scratch-pad.js 문법 깨짐"
  node --input-type=module --check < "js/scratchpad-link.js" >/dev/null 2>&1 || say "    ⚠️scratchpad-link.js 문법 깨짐"
  run "mut-$m" "$sp"
  python3 "$MU" --revert | sed 's/^/    /'
done

say "═══ ★끝 — load $(LOADNOW) · disk $(df -m / | awk 'NR==2{printf "%.2f", $4/1024}')GB"
say "★출력 자리: $O"
