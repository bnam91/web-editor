#!/usr/bin/env python3
"""dom-scratch-mutate.py — ★DOM 스크래치 축 ★변이·탐침 (★t2cmdl · 2026-10-10)

★★왜 ★넷째인가 — ⛔«중복이라 합쳐라»로 ★읽히지 ★않게 ★근거를 ★적는다(★전수로 쟀다):
  ★집안: `tools/exgate/e2-mutate.py` · `tools/mutation-sweep.js` · `tools/mcp-mutation-sweep.mjs`
         ＋ 명부 `tools/mutations.json`(★54건) ＋ 닻검사 `tests/dom/_mutation-anchor.js`(★소비자 5벌)
  ★★집안에 ★★없는 칸 ★셋 — ★그래서 ★이 파일이 있다:
    ㉠′ ★조건 ★보존(`rc 5`) — ★치환이 ★`if (…)` 를 ★지우면 ★★«누가 ★타나»가 ★«누가 ★닿나»로 ★바뀐다
        (⚠️`_mutation-anchor.js` 는 ★닻 1건의 ★임자이고, ★★스스로 ★「행동은 ★안 잰다」고 ★적었다)
    ㉢′ ★★명부 ★밖 ★실패 — `mcp-mutation-sweep.mjs` 는 ★`missed`(기대했는데 안 빨개진 것)만 센다.
        ⇒ ★★«엉뚱한 칸이 ★빨개진 것»을 ★안 센다 ⇒ ★★∅ 가 ★일치로 ★둔갑한다
    ㉣ ★`rc 9` = ★★«안 쟀다»(산출물 못 읽음 · suite 0건) — ★집안에 ★없다. ⛔★«초록»이 ★아니다
  ★★축이 ★다르다: ★여기 10건 = ★DOM 스크래치(⑤⑦⑧) / ★`mutations.json` 54건 = main.js·저장·prune(MCP 0)
  ★★⇒ ★겹치는 ★항목 ★★0. ★★그러나 ★꼴은 ★같다.
★★★명부가 ★이제 ★★셋이다 — ⛔숨기지 ★않는다:
  ⑴ `tools/mutations.json`(54) ⑵ `mcp-mutation-sweep.mjs` ★인라인(14 · ★expectRed 때문에 갈라졌다)
  ⑶ ★★이 파일(10 · ★DOM 스크래치 축)
  ⇒ ★★합치는 값이 ★있나는 ★★팀 판정이다 — ★그쪽 머리말이 ★★비용을 ★★이미 적어 뒀다
    (★mutations.json 에 더하면 ★표준 스윕이 ★매 변이마다 ★unit 전체 1102 를 돌린다)
  ⇒ ★★이 수(★3)가 ★그 판정의 ★근거다.

★★★⛔이 자가 ★안 재는 것 — ★먼저 적는다
  ★`--probe` 는 ★★«누가 ★그 갈래를 ★타나»만 잰다. ★★«무엇이 ★잠겼나»는 ★★안 잰다.
  ⇒ ★★그 둘을 ★섞으면 ★★멀쩡한 검사를 ★「항등식」이라 ★잘못 라벨한다
     (★★2026-10-10 ★내가 ★X4 를 ★★세 회차 ★그렇게 ★불렀다 — ★변이가 ★★안 지나는 줄을 ★쳤던 것이다)

★★쓰는 레인(★분모) = ★★2 — ★t2cmdl(지음) · ★t3frame(2026-10-10 지디 전달)
  ⛔«공용»이라 적을 땐 ★★쓰는 레인 수를 ★같이 세라. ★1 이면 ★안 적는다.

★원 자리: `~/.gd-work/cmdlink-1009t2/mutate.py` ⇒ ★버전관리 ★밖이었다 ⇒ ★★옮겼다(지디 판정)
  ★까닭: ★★«둘이 쓰는 도구가 ★버전관리 밖» · ★오늘 `r13.sh` 가 ★미커밋이라 ★사본이 ★버그를 ★복원했다
"""
"""변이 적용/원복 — ★닻이 ★정확히 1건임을 ★확인하고, ★원복은 ★해시로 ★단언한다."""
import sys, re, os, json, hashlib, pathlib, shutil, subprocess
# ★뿌리 — ★기본은 ★★«스크립트 자리»(★이 파일이 레포 안에 있으니 ★제 레포를 가리킨다)
#   ★★`GD_MUT_LANE` 로 ★덮을 수 있다 — ★★«한 레인의 사본으로 ★다른 트리를 ★잴 때» (t3frame 요청 2026-10-10)
L = pathlib.Path(os.environ.get('GD_MUT_LANE') or pathlib.Path(__file__).resolve().parent.parent)
# ★★㉡ ★그 경로가 ★실재하나 — ⛔먼저 ★단언한다.
#   ★까닭(지디 2026-10-10 실측): ★★«없는 경로»로 `git -C` 를 부르면 ★fatal 뒤 ★★빈 값이 오고
#   ★그 빈 값을 ★★«0»으로 읽어 ★★«비ff»로 ★읽힐 뻔했다. ⇒ ★★이 도구도 ★같은 자리를 ★지난다.
if not (L / '.git').exists() and not (L / 'js').is_dir():
    print("  ⛔뿌리가 ★레포가 ★아니다: %s\n     ⇒ ★`GD_MUT_LANE` 를 ★레포 뿌리로 주라" % L)
    sys.exit(10)   # rc 10 = lane
B = pathlib.Path(os.environ.get('GD_MUT_OUT', '/tmp/dom-scratch-mut'))   # ★산출물 — env 로 옮긴다
B.mkdir(parents=True, exist_ok=True)
# ★건드리는 파일 = ★★`MUT` 에서 ★★파생시킨다. ⛔손으로 ★둘째 명부를 ★두지 않는다
#   ⇒ ★t3frame 물음에 ★구조로 답한다: ★제 항목을 ★`MUT` 에 ★더하면 ★이 명부가 ★★저절로 ★따라온다
#   ⇒ ★그래서 ★★옛 `POST` 사본 표는 ★★없다(★원복은 ★`git checkout --` 이다)
def _files():
    return sorted({v[0] for v in MUT.values()})

def _git(*a):
    return subprocess.run(['git', '-C', str(L)] + list(a), capture_output=True, text=True)

def _dirty():
    """★건드릴 파일이 ★이미 더럽나 — ★`tools/mutation-sweep.js` 의 ★선례(git-clean 선검사)를 따른다.
       ⛔더러운 판에서 변이를 들이면 ★원복이 ★남의 변경을 ★덮는다."""
    return [l for l in _git('status', '--porcelain', '--', *_files()).stdout.splitlines() if l.strip()]
MUT = {
  # 이름: (파일, 닻, 치환본, 무엇을 죽이나)
  'M-EXCL-A': ('js/scratch-pad.js',
      "tests/dom/scratch-group-mode. */\n  if (_groupMode) _exitGroupMode();",
      "tests/dom/scratch-group-mode. */\n  /* ★변이: 내렸다 */",
      '✂ 진입이 그룹모드를 ★안 내린다 (그룹→슬라이스 방향)'),
  'M-EXCL-B': ('js/scratch-pad.js',
      "  if (_sliceMode) _exitSliceMode();            // ★진입 배타(반대쪽은 _enterSliceMode 머리)\n",
      "  /* ★변이: 내렸다 */\n",
      '★★「기대 0건」이 정상 — ★잠든 가드다(지금은 안 선다 · 등록 순서가 바뀌면 살아난다) ⛔지우지 마라'),
  'M-NOOUTSIDE': ('js/scratch-pad.js',
      "  _groupModeHandlers = { onKeyEsc, onOutsideMousedown };\n  setTimeout(() => document.addEventListener('mousedown', onOutsideMousedown, true), 0);",
      "  _groupModeHandlers = { onKeyEsc, onOutsideMousedown };\n  /* \u2605\ubcc0\uc774: capture \ub4f1\ub85d\uc744 \ub0b4\ub838\ub2e4 */",
      '★밖 mousedown capture 등록 없음 — ★모드가 안 풀린다(새 G8·G6 의 양성대조)'),
  'M-NODISSOLVE': ('js/scratch-pad.js',
      "  const touchedGroups = [...new Set(items.map(s => s.g).filter(Boolean))];",
      "  const touchedGroups = [];   /* ★변이 */",
      '★★⊘ 자동 푼을 «지우기 길»에서 내린다 — C5 가 발개지는가(⑧ 고침의 양성대조)'),
  'M-COUNT': ('js/scratchpad-link.js',
      "        if (passedCount(xc) > 1) continue;",
      "        /* ★변이 */",
      '★한 칸 규칙(수) 없음 — ★두 칸 이상도 앉는다(X2 가 잡아야 한다)'),
  'M-OLDDIST': ('js/scratchpad-link.js',
      "        if (passedCount(xc) > 1) continue;",
      "        if (gapAt(xc) > PULL_GAP + STACK_GAP + b.w) continue;   /* ★변이 */",
      '★옛 «거리» 꼴로 되돌린다 — ★X5(d≥1)가 빨개져야 한다(⑤ 고침의 양성대조)'),
  'M-CEIL4': ('js/scratchpad-link.js',
      "  const X_RUNAWAY_W = 3;      // \u00d7 \ub2f9\uae30\ub294 \ud328\ub4dc \ud3ed",
      "  const X_RUNAWAY_W = 4;      // \u00d7 \ub2f9\uae30\ub294 \ud328\ub4dc \ud3ed",
      '★천장을 ★4× 로 ★올린다 — ★X3 바깥 표본이 ★앉아버린다(★값 민감도)'),
  'M-CEIL2': ('js/scratchpad-link.js',
      "  const X_RUNAWAY_W = 3;      // \u00d7 \ub2f9\uae30\ub294 \ud328\ub4dc \ud3ed",
      "  const X_RUNAWAY_W = 2;      // \u00d7 \ub2f9\uae30\ub294 \ud328\ub4dc \ud3ed",
      '★천장을 ★2× 로 ★내린다 — ★X3 안쪽 표본이 ★못 앉는다(★지디가 처음 적은 수)'),
  'M-X4EARLY': ('js/scratchpad-link.js',
      "    if (!hits(y0)) return { x: Math.round(x), y: Math.round(y0) };",
      "    if (!hits(y0)) return { x: Math.round(x + 40), y: Math.round(y0) };",
      '★★이른 반환(막는 것 0개 길)이 x 를 40 밀다 — X4 하나만 발개지는가'),
  'M-CEIL': ('js/scratchpad-link.js',
      "        if (gapAt(xc) > X_RUNAWAY_W * w) continue;",
      "        /* ★변이: 천장을 내렸다 */",
      '★폭주 천장 ★없음'),
}
def _node_check(path):
    """★ESM 문법 — ⛔맨 `node --check` 는 ESM 에서 ★거짓빨강이다"""
    try:
        with open(path, 'rb') as fh:
            return subprocess.run(['node', '--input-type=module', '--check'],
                                  stdin=fh, capture_output=True).returncode
    except Exception:
        return 1

def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def do(name):
    if _dirty():
        print("  ⛔건드릴 파일이 ★이미 더럽다 — ⛔남의 변경을 덮지 않는다: %s" % _dirty())
        return RC['dirty']
    f, a, b, why = MUT[name]
    p = L / f; s = p.read_text(encoding='utf-8')
    n = s.count(a)
    if n != 1:
        print("  ⛔%s 닻 %d건 (★1이어야) — ★안 건드렸다" % (name, n)); return 1
    p.write_text(s.replace(a, b), encoding='utf-8')
    print("  ★변이 %s 들였다 · %s · %s %dB→%dB" % (name, why, f, len(s), len(p.read_text(encoding='utf-8'))))
    return 0
def revert():
    """★원복 = ★★`git checkout --` (⛔사본 파일에 ★안 매인다 — ★레인마다 사본이 다르다).
       ★그리고 ★원복 ★뒤 ★`git status` 로 ★확인한다(★«했다»도 ★재라).
       ⛔★★여기에 ★«더러우면 거절» 가드를 ★두지 ★마라 — ★★원복은 ★★«더러운 판»을 ★치우는 자다.
          ★★내가 ★한 번 ★거기 뒀다가 ★★원복이 ★영영 ★안 됐다(★자가 시험이 ★잡았다 · 2026-10-10)."""
    r = _git('checkout', '--', *_files())
    if r.returncode != 0:
        print("  ⛔git checkout 실패: %s" % r.stderr.strip()[:120]); return RC['revert']
    left = _dirty()
    if left:
        print("  ⛔원복했는데 ★아직 더럽다: %s" % left); return RC['revert']
    print("  ⇒ 원복 ✅ (git checkout · status 0건)")
    return RC['ok']

# ══ ★공용 탐침 — ★쓰는 법 ══════════════════════════════════════════════════════
#   ⑴ ★예상을 ★먼저 박고 ★탐침을 들인다(★마른 시험이 ★안에서 돈다):
#        python3 tools/dom-scratch-mutate.py --probe <변이이름> --expect X4,N1,N2,N3,N5
#   ⑵ ★그 spec 을 ★돌려 ★json 을 남긴다(★창 안에서):
#        PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/p.json npx playwright test --reporter=json <spec>
#   ⑶ ★★도구가 ★예상 ↔ 실측을 ★가린다(⛔사람 기억에 ★안 맡긴다):
#        python3 tools/dom-scratch-mutate.py --verdict /tmp/p.json
#   ⑷ ★반드시 ★원복: --revert   (★`git checkout --` ＋ ★`git status` 확인)
#   ★rc 표: --rc
# ★★rc — ★★«빨강»과 ★★«안 쟀다»를 ★가른다(★`t1bstar` 의 rc 셋을 본떴다)
RC = {
    'ok': 0,
    'name': 2,     # 그 이름의 변이가 ★없다
    'anchor': 3,   # ★닻이 ★정확히 1건이 ★아니다
    'syntax': 4,   # ★탐침이 ★문법을 ★깼다
    'cond': 5,     # ★★조건이 ★사라졌다 — ★«누가 타나»가 ★«누가 닿나»로 ★바뀐다
    'revert': 6,   # ★원복이 ★확인되지 ★않는다
    'dirty': 7,    # ★건드릴 파일이 ★이미 ★더럽다(⛔남의 변경을 ★덮지 않는다)
    'expect': 8,   # ★★예상과 ★실측이 ★갈렸다
    'noev': 9,     # ★★증거가 ★없다(산출물 못 읽음 · ★suite 0건) — ⛔★«초록»이 ★아니다
    'lane': 10,    # ★뿌리가 ★레포가 ★아니다(★`GD_MUT_LANE` 를 ★잘못 줬다)
}
EXPECT_FILE = B / 'probe-expect.json'


# ══ ★★★«탐침을 ★어디에 ★두나»가 ★★«무엇을 ★재나»를 ★바꾼다 — ★★표로 적는다
#    (2026-10-10 · ★t2cmdl ＋ ★t3frame 이 ★★서로 ★다른 자리에서 ★★같은 병을 밟았다)
#
#   ┌ 둔 자리 ────────────┬ 재는 것 ──────────┬ 언제 ★맞나 ───────────────────────┐
#   │ ★함수 ★머리에 throw   │ ★★«누가 ★부르나»   │ ★★그 함수 ★자체가 ★«판정자»일 때       │
#   │                     │                  │ (t3frame: `clipsContent` ⇒ 부른다≡지난다) │
#   │ ★줄째 ★throw          │ ★★«누가 ★닿나»     │ ⛔거의 없다 — ★조건이 ★사라진다        │
#   │                     │                  │ (t2cmdl: ★11/11 이 나왔다)             │
#   │ ★★«결과만» throw      │ ★★«누가 ★타나»     │ ★★조건부 줄의 ★갈래를 잴 때 — ★★이 도구  │
#   └─────────────────────┴──────────────────┴──────────────────────────────────────┘
#   ⇒ ★★`rc 5 (cond)` 는 ★★둘째 칸을 ★막는다. ⛔첫째 칸을 ★금지하지는 ★않는다 —
#      ★★그 함수가 ★판정자면 ★★«함수 머리 throw»가 ★맞는 자리다(★그 예외를 ★지우지 마라).
def check_anchors():
    """★★★닻 ★전수 — ★★«돌리지 ★않고» ★★썩은 닻을 ★찾는다 (★t3frame 발견 2026-10-10).
       ★★왜 필요한가: ★`do`/`probe` 의 ★`rc 3` 은 ★★«그 변이를 ★돌릴 때»만 ★잡는다.
         ⇒ ★★한 번도 ★안 돌린 항목의 ★닻이 ★썩으면 ★★아무도 ★모른다.
         ⇒ ★★그리고 ★★죽은 닻은 ★★«빨강이 ★안 난다»를 내고 ★그걸 ★★«잠겼다»로 ★읽는다.
       ★실례(★t3frame 실측 · ★내가 ★독립으로 ★재서 ★같았다): ★`tools/mutations.json` ★54항목 중
         ★★0건(죽은 닻) ★★3건 · ★정확히 1건 ★51 · ★2건+ ★0.
       ⇒ ★★그 집(mutations.json)은 ★★내 소관이 ★아니다 — ★★그러나 ★★내 명부는 ★★내가 ★쓸어야 한다.

       ★★⛔이 자의 ★한계 — ★★«부분문자열»로 센다(★`str.count`):
         ★닻 ★뒤에 ★무엇이 ★붙어도(예: 주석) ★★여전히 ★1건으로 ★센다.
         ★★그건 ★★흠이 ★아니다 — ★치환도 ★부분문자열로 하니 ★★그 판에서도 ★제대로 ★먹는다.
         ★★참 썩음 = ★★«닻 ★안쪽»이 ★바뀐 것(★변수명·공백·순서) ⇒ ★★그때 ★0건이 되어 ★잡힌다.
         ★★★그 둘을 ★가려 적는다 — ★★내 ★첫 양성대조가 ★★앞엣것을 써서 ★★«안 잡힌다»로 ★읽힐 뻔했다
           (★2026-10-10 · ★자를 ★의심하기 ★전에 ★★대조를 ★의심해서 ★걸렀다)."""
    bad = []
    for name, (f, a, _b, _why) in MUT.items():
        path = L / f
        if not path.exists():
            bad.append((name, f, 'none')); continue
        n = path.read_text(encoding='utf-8').count(a)
        if n != 1: bad.append((name, f, n))
    print("  ★명부 %d건 · ★정확히 1건 %d · ★★어긋남 %d" % (len(MUT), len(MUT) - len(bad), len(bad)))
    for name, f, n in bad:
        print("  ⛔%-14s %s — 닻 %s건 %s" % (name, f, n,
              '(★0 = ★소스가 바뀌어 ★썩었다)' if n == 0 else '(★2+ = ★치환이 ★반쪽/전부로 ★갈린다)'))
    if bad: return RC['anchor']
    print("  ✅ ★전부 ★정확히 1건 — ★썩은 닻 ★0")
    return RC['ok']

def _probe_repl(anchor, name):
    """★결과만 `throw` 로 · ★조건은 ★남긴다. ⇒ (치환본, 조건머리 or None)"""
    thr = "throw new Error('PROBE-TRAVERSE-%s');" % name
    if ' return ' in anchor:
        head = anchor[:anchor.index(' return ') + 1]     # `    if (...)` 까지
        return head + thr, head.strip()
    indent = anchor[:len(anchor) - len(anchor.lstrip())]
    return indent + thr, None

def probe(name, expect=None):
    """★㉢ ★«그 검사가 ★그 줄을 ★지나나» — ★행위로 잰다.
       ★★㉡ ★마른 시험이 ★도구 ★안에 있다: ★적용 → ★문법 → ★그 줄 확인 → ★조건 확인 → ★원복(해시).
       ⚠️★이 자는 ★★«무엇이 ★잠겼나»를 ★재지 ★않는다 — ★★«누가 ★그 갈래를 ★타나»만 잰다."""
    if _dirty():
        print("  ⛔건드릴 파일이 ★이미 더럽다 — ⛔남의 변경을 덮지 않는다: %s" % _dirty())
        return RC['dirty']
    if name not in MUT:
        print("  ⛔그 이름의 변이가 없다: %s (있는 것: %s)" % (name, ', '.join(MUT)))
        return RC['name']
    f, a, _b, _why = MUT[name]
    path = L / f
    orig = path.read_text(encoding='utf-8')
    h0 = hashlib.sha256(orig.encode('utf-8')).hexdigest()
    if orig.count(a) != 1:
        print("  ⛔㉠ 닻 %d건 (★1이어야) — ★안 건드렸다" % orig.count(a)); return RC['anchor']
    repl, cond = _probe_repl(a, name)
    # ─── ★★㉡ 마른 시험 — ★창을 ★쓰기 ★전에 ★도구가 ★스스로 ★본다
    path.write_text(orig.replace(a, repl), encoding='utf-8')
    cur = path.read_text(encoding='utf-8')
    bad = None
    if cur.count("PROBE-TRAVERSE-%s" % name) != 1:
        bad = ('syntax', '탐침 표지가 1건이 아니다')
    elif _node_check(path) != 0:
        bad = ('syntax', 'node --check 가 ★죽었다')
    elif cond is not None and cur.count(cond) != 1:
        # ★★㉠ ★조건이 ★살아 있나 — ★★내가 ★첫 꼴에서 ★틀린 자리다
        bad = ('cond', '★조건(%s)이 %d건 — ★사라졌다 ⇒ ★«누가 타나»가 ★«누가 닿나»로 바뀐다'
               % (cond[:40], cur.count(cond)))
    if bad:
        path.write_text(orig, encoding='utf-8')
        print("  ⛔%s — %s (★원복했다)" % (bad[0], bad[1])); return RC[bad[0]]
    print("  ★탐침 %s 들였다 — ★결과만 throw · ★조건 %s"
          % (name, ('남았다(1건): ' + cond[:46]) if cond else '없다(무조건 줄)'))
    print("  ✅㉡ 마른 시험: 표지 1건 · 문법 ✅ · 조건 ✅ · (★원복은 --revert 로)")
    if expect:
        EXPECT_FILE.write_text(json.dumps({'probe': name, 'expect': sorted(expect)}), encoding='utf-8')
        print("  ★㉢ 예상 받았다(★돌리기 전에 박혔다): %s" % sorted(expect))
    else:
        if EXPECT_FILE.exists(): EXPECT_FILE.unlink()
        print("  ⚠️㉢ 예상을 ★안 받았다 — ⛔그러면 ★결과를 보고 ★고를 수 있다. `--expect` 를 쓰라")
    return RC['ok']

def verdict(jsonpath):
    """★★㉢ ★예상 ↔ 실측을 ★★도구가 ★가린다(⛔사람 기억에 ★안 맡긴다).
       ★rc: 0 일치 · 8 갈림 · 9 ★증거 없음(★«초록»이 아니다)."""
    if not EXPECT_FILE.exists():
        print("  ⛔㉢ 예상 파일이 없다 — `--probe <이름> --expect …` 를 ★먼저"); return RC['noev']
    exp = json.loads(EXPECT_FILE.read_text(encoding='utf-8'))
    try:
        d = json.loads(pathlib.Path(jsonpath).read_text(encoding='utf-8'))
    except Exception as e:
        print("  ⛔㉣ 증거가 없다 — 산출물을 못 읽었다(%s) ⇒ ★«안 쟀다»다" % e); return RC['noev']
    red = set()
    def walk(su):
        for sp in su.get('specs', []):
            if not sp.get('ok'): red.add(sp.get('title', '?').split()[0])
        for c in su.get('suites', []): walk(c)
    for su in d.get('suites', []): walk(su)
    if not d.get('suites'):
        print("  ⛔㉣ 산출물에 suite 가 0건 ⇒ ★«안 쟀다»다"); return RC['noev']
    want = set(exp['expect'])
    print("  ★탐침 %s · ★예상 %s" % (exp['probe'], sorted(want)))
    print("  ★실측 빨강 %s" % sorted(red))
    if red == want:
        print("  ✅㉢ 일치 — ★그 칸들이 ★그 갈래를 ★탄다"); return RC['ok']
    print("  ⛔㉢ 갈림 — ★더 나온 것 %s · ★덜 나온 것 %s" % (sorted(red - want), sorted(want - red)))
    print("     ⚠️★전부(또는 거의 전부)가 빨강이면 ★조건이 ★사라졌는지 보라(★«닿나»를 재고 있다)")
    return RC['expect']

if __name__ == '__main__':
    if sys.argv[1] == '--revert': sys.exit(revert())
    if sys.argv[1] == '--probe':
        exp = None
        if '--expect' in sys.argv:
            exp = [x for x in sys.argv[sys.argv.index('--expect') + 1].split(',') if x]
        sys.exit(probe(sys.argv[2], exp))
    if sys.argv[1] == '--verdict': sys.exit(verdict(sys.argv[2]))
    if sys.argv[1] == '--check-anchors': sys.exit(check_anchors())
    if sys.argv[1] == '--rc':
        for k, v in RC.items(): print("  rc %d  %s" % (v, k))
        sys.exit(0)
    if sys.argv[1] == '--list':
        for k, v in MUT.items(): print("  %-10s %s  ← %s" % (k, v[3], v[0]))
        sys.exit(0)
    sys.exit(do(sys.argv[1]))
