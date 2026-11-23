#!/usr/bin/env python3
"""tools/panel-parts/gen.py — 우측패널 부품 카탈로그 v2 md 를 측정 json 두 벌에서 자동 생성(손 고침 0 · 탑 261123 · 레드팀 2차 반영).
  python3 tools/panel-parts/gen.py <app.json> <mock.json> <out.md>
  측정 = tools/panel-parts/measure.cjs(app · mock) · 판정기 = det.js · 기본 항목 = js/props/_section-spec.js SECTION_DEFAULTS · 부품 이름 = 태양 PLAN-ds-parts-state §2.
  인용(파일:줄)은 손으로 박지 않고 이 레포에서 그 자리를 찾아 적는다(줄이 밀려도 맞게)."""
import json, sys, os, re, subprocess, collections
A, M, out = sys.argv[1:4]
A = json.load(open(A)); M = json.load(open(M))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
def cite(path, pat):
    try:
        for i, l in enumerate(open(os.path.join(ROOT, path), encoding='utf8'), 1):
            if re.search(pat, l): return f'{path}:{i}'
    except FileNotFoundError: pass
    return f'{path}:?'
PARTS = [  # data-part · PLAN 번호 · 정본 꼴 · 인용(찾을 무늬)
 ('row', '', '줄 = 라벨(--ui-form-label-w 56) | 컨트롤 | 엔드슬롯(--ui-opt-col-w 22+6) · 줄은 몸 끝 · 칸 많고 엔드슬롯 없는 줄은 .prop-row--wide(끝 칼럼까지)', [('css/editor-props.css', r'^\.prop-row \{'), ('css/editor-props.css', r'prop-row--wide \{|\.prop-row\.prop-row--wide')]),
 ('number', 'P1', '숫자 칸 = .prop-icon-input > 접두(.prop-xy-label) + input + 접미(.prop-unit) · 슬라이더 짝이면 input.prop-number · 높이 --ui-input-h', [('css/editor-props.css', r'^\.prop-icon-input'), ('css/editor-props.css', r'^\.prop-number \{')]),
 ('slider', 'P2', '슬라이더 행 = 라벨 | input.prop-slider | input.prop-number(짝 늘)', [('js/props/_helpers.js', r'export function sliderRowHTML')]),
 ('toggle', 'P3', '토글 = label.prop-toggle > input[type=checkbox] + .prop-toggle-track · ★규칙: 이진 = 토글 · 상호배타 = select(글) / align-group(아이콘) · 목록 선택 = 체크박스', [('css/editor-props.css', r'^\.prop-toggle\b')]),
 ('select', 'P4', 'select.prop-select · 높이 --ui-input-h', [('css/editor-props.css', r'^\.prop-select \{'), ('css/editor-base.css', r'--ui-input-h:')]),
 ('color', 'P5', '색 칸 = .prop-color-field(스와치 · HEX · %) · Fill 이면 VAR(.cv-chips) · 최근(.cv-recent-row) 슬롯', [('js/props/color-picker.js', r'export function colorFieldHTML'), ('js/props/color-var-chips.js', r'cv-recent-row')]),
 ('tip', 'P6', '툴팁 = 속성 부품(data-tip · DOM 없음) · 300ms · 위/아래 자동 · 포커스에도 · aria-describedby · 막힌 칸은 aria-disabled + tabindex 0(disabled 면 툴팁이 안 닿음)', []),
 ('align-group', '', '정렬 묶음 = .prop-align-group > .prop-align-btn ×N(정렬 6 + 균등) — 아이콘 상호배타도 이 꼴', [('js/props/_helpers.js', r'export function alignBtn')]),
 ('chain', '', '사슬 = .prop-chain-btn 22 · 끝 칼럼(+6) · aria-pressed(W/H 잠금 · 패딩 연동)', [('js/props/prop-text-template.js', r'txt-ph-chain')]),
 ('end-slot', '', '＋ 엔드슬롯 = 절 머리 오른쪽(＋/− · aria-expanded) 또는 띄우기 단추(.prop-chain-btn--overlay)', [('js/props/_panel-frame.js', r'headTools'), ('js/props/_helpers.js', r'export function overlayToggleBtnHTML')]),
 ('fx-card', '', '효과 카드 = .prop-cell-card[data-fx-type] > .prop-cell-card-header(눈 단추 aria-pressed · .prop-cell-card-title · ✕ 단추 aria-label) + .prop-cell-card-body · 카드 사이 10', [('css/editor-props.css', r'^\.prop-cell-card \{'), ('js/effects-noise.js', r'prop-cell-card-header')]),
 ('rot', '', '회전 행 = .prop-row.prop-rot-row = 각도 칸(.prop-icon-input + °) + 90°·좌우·상하(.prop-align-group.prop-rot-btns)', [('js/props/_helpers.js', r'export function rotRowHTML')]),
]
NAMES = [p[0] for p in PARTS]
ORDER = ['Header', 'Kind', 'Content', 'Position', 'Size', 'Layout', 'Padding', 'Appearance', 'Typography', 'Fill', 'Stroke', 'Effects', 'GIF', 'Templates', 'Template', 'Export']
def sname(s): return s['sec'] if s['sec'] in ORDER else '[Special] ' + s['sec']
def cls(v):
    if isinstance(v, str) and v.startswith('var'): return 'var'
    return 'ok'
cells = collections.defaultdict(lambda: collections.defaultdict(lambda: {'app': collections.defaultdict(set), 'mock': collections.defaultdict(set)}))
owner = {'app': collections.defaultdict(list), 'mock': collections.defaultdict(list)}
miss = {'app': collections.defaultdict(list), 'mock': collections.defaultdict(list)}
unnamed = {'app': [], 'mock': []}
for side, D in (('app', A), ('mock', M)):
    for it in D['items']:
        who = it['who'] if side == 'app' else f"{it['who']}·{it.get('kind', '')}"
        for s in it.get('secs', []):
            sn = sname(s)
            if s.get('unnamed'): unnamed[side].append((who, s['key']))
            for k, v in s['parts'].items():
                if k == 'tip': continue
                cells[sn][k][side][cls(v)].add(who)
                if cls(v) == 'var': cells[sn][k][side]['why'].add(f"{who}({v[4:]})")
            if s['ownerless']: owner[side][sn].append((who, s['ownerless']))
            if s['missing'] or s['extra']: miss[side][sn].append((who, s['missing'], s['extra']))
secs = sorted(cells, key=lambda x: (ORDER.index(x) if x in ORDER else 99, x))
nApp = len([i for i in A['items'] if 'secs' in i]); blocks = len([i for i in A['items'] if 'secs' in i and i['who'] not in ('page', 'section', 'frame')])
C_FIELD = cite('css/editor-props.css', r'^\.prop-field-label \{'); C_SUBROW = cite('css/editor-props.css', r'^\.prop-sec-sub-row \{'); C_SECOND = cite('css/editor-props.css', r'\.prop-row > \.prop-label ~ \.prop-label')
L = ['# 우측패널 공용 부품 카탈로그 v2 — 레드팀 2차 반영(★«10 부품 표준 확정»·8910 #parts v2 게시는 지디 GO 뒤)', '',
     f"- 자동 생성 = tools/panel-parts/gen.py ← 측정 json 두 벌(손 고침 0 · 인용 줄도 생성 때 레포에서 찾음). 다시 돌리기: `node tools/panel-parts/measure.cjs app a.json` · `node tools/panel-parts/measure.cjs mock m.json <panel-redesign.html>` · `python3 tools/panel-parts/gen.py a.json m.json out.md`",
     f"- 앱 = tp/front **{A['sha']}** · 측정 {A['run'][:16]}Z · DOM 하네스(bootApp) · 블럭 {blocks}종 + 페이지·섹션·프레임 = 패널 {nApp}",
     f"- 시안 = gdragon {M.get('file', '')} **{M['sha']}** · 측정 {M['run'][:16]}Z · 시안A(v117a) {len(M['items'])}상태",
     '- 판정기 한 벌 = tools/panel-parts/det.js(앱·시안 똑같이) · 부품 이름 = 태양 PLAN-ds-parts-state-261123 §2 «부품 이름 한 벌»(= data-part 값) · 절별 기본 항목 = js/props/_section-spec.js SECTION_DEFAULTS(PLAN §4b 표)',
     f"- ★이름 없는 절(빨강) = 앱 {len(unnamed['app'])} · 시안 {len(unnamed['mock'])}(맨 앞 이름표 머리 = «Header» 로 셈 · 레드팀이 본 «[Special] ? 31» 은 이 머리였음)", '',
     '## 0. 부품 12(data-part) · 정본 꼴 · 출처', '', '| data-part | PLAN | 정본 꼴 | 출처(생성 때 찾음) |', '|---|---|---|---|']
for k, pn, form, cites in PARTS:
    form = form.replace('|', '｜')   # 표 칸 안 «|» = 표 깨짐
    L.append(f"| `{k}` | {pn or '—'} | {form} | {' · '.join(cite(f, pat) for f, pat in cites) or '(새 부품 · 태양 P6)'} |")
L += ['', '- ★세그먼트(상호배타 글 단추)는 부품에서 뺌 — Q13 A(현빈 · 드롭다운 유지): 글 고르기 = `select` · 아이콘 고르기 = `align-group`. 토글 규칙도 이 둘을 가리킴(빈 부품을 가리키지 않게).',
      '- ★효과 카드는 〔재고〕에서 꺼냄 — 정본 꼴 = 위 `fx-card` 줄(Noise·홀로그램 카드와 같은 마크업 · 판정기가 눈 aria-pressed · 제목 · ✕ aria-label 을 봄).',
      '- Mixed(여러 블럭 값이 다름) = PLAN §1 정본: number = 빈 값 + placeholder «Mixed» · select = 맨 앞 disabled «Mixed» option · toggle = checkbox `indeterminate`(aria-checked="mixed" 는 role=switch 따로 단 때만) · color = 스와치 빗금 · 표기 «Mix» → «Mixed».',
      '', '### 토큰 · 행 규칙 한 장', '', '| 규칙 | 값 · 토큰 | 출처 |', '|---|---|---|',
      f"| 라벨 칸 | 56 · --ui-form-label-w | {cite('css/editor-base.css', r'--ui-form-label-w:')} |",
      f"| 끝 옵션 칼럼 | 22 + 6 · --ui-opt-col-w | {cite('css/editor-base.css', r'--ui-opt-col-w:')} |",
      f"| 칸 높이 | 24 · --ui-input-h(★정본 부품의 height:24px 리터럴은 이 토큰으로 바꿀 것 · 지금 리터럴 남음) | {cite('css/editor-base.css', r'--ui-input-h:')} |",
      f"| 위 라벨 → 칸 · 행 gap | 4 · --ui-space-1 / --ui-row-gap | {cite('css/editor-base.css', r'--ui-row-gap:')} |",
      f"| 줄 사이 · 안내/넓은 단추 아래 | 6 · --ui-space-1_5 | {cite('css/editor-base.css', r'--ui-space-1_5:')} |",
      f"| 절 몸 아래 | 16 · --ui-sec-body-pb | {cite('css/editor-base.css', r'--ui-sec-body-pb:')} |",
      f"| 절 제목 | --ui-sec-title-fs · --ui-sec-title-color | {cite('css/editor-base.css', r'--ui-sec-title-fs:')} |",
      f"| 하위 라벨(위 라벨) | .prop-field-label · 11/400 · 아래 4 | {C_FIELD} · {C_SUBROW} |",
      f"| 줄 안 둘째 라벨 | 글 폭(56 아님) | {C_SECOND} |",
      f"| 비활성 | --ui-disabled-opacity 0.5 · 막힌 칸 = aria-disabled + tabindex 0(툴팁 닿게) | {cite('css/editor-base.css', r'--ui-disabled-opacity:')} |",
      '| 패널 폭 · 글 크기 | 폭 1종 240 고정 · 글 크기 2종(기본 / ×1.25 흉내 — 긴 한글 라벨 잘림 위험) | — |', '',
      '## 1. 절 × 부품 — 블럭 수(ok/var) · 앱 | 시안 · ★앱≠시안 칸', '',
      '칸 = «앱 ok/var · 시안 ok/var» · ≠ = 한쪽만 있거나 판정(ok/var)이 갈림.', '', '| 절 | ' + ' | '.join(f'`{n}`' for n in NAMES if n != 'tip') + ' |', '|---|' + '---|' * (len(NAMES) - 1)]
diffs = []
for sn in secs:
    row = []
    for k in NAMES:
        if k == 'tip': continue
        c = cells[sn].get(k)
        if not c: row.append('·'); continue
        a_ok, a_var, m_ok, m_var = (len(c['app']['ok']), len(c['app']['var']), len(c['mock']['ok']), len(c['mock']['var']))
        da = 'var' if a_var else ('ok' if a_ok else '-'); dm = 'var' if m_var else ('ok' if m_ok else '-')
        ne = da != dm
        if ne: diffs.append((sn, k, da, dm))
        row.append(f"앱 {a_ok}/{a_var} · 시안 {m_ok}/{m_var}" + (' ≠' if ne else ''))
    L.append(f'| {sn} | ' + ' | '.join(row) + ' |')
L += ['', f'앱≠시안 칸 = {len(diffs)} — ' + ' · '.join(f'{s}›{k}(앱 {a} / 시안 {m})' for s, k, a, m in diffs[:40]), '',
      '### 1-b. var 까닭(앱) — 칸마다 블럭', '']
for sn in secs:
    for k in NAMES:
        c = cells[sn].get(k)
        if c and c['app']['why']: L.append(f"- **{sn} › `{k}`** — " + '; '.join(sorted(c['app']['why'])[:12]))
L += ['', '## 2. ★주인 없는 컨트롤(정본 부품 셀렉터에 안 걸린 input·select·button) — 앱', '',
      f"절 {sum(len(v) for v in owner['app'].values())} 곳 · 컨트롤 {sum(len(x[1]) for v in owner['app'].values() for x in v)} 개(시안: 절 {sum(len(v) for v in owner['mock'].values())} · 컨트롤 {sum(len(x[1]) for v in owner['mock'].values() for x in v)}). 이것이 «부품 밖 손 HTML» — PLAN §3 흡수 대상.", '', '| 절 | 블럭(주인 없는 것) |', '|---|---|']
for sn in sorted(owner['app'], key=lambda x: (ORDER.index(x) if x in ORDER else 99, x)):
    L.append(f"| {sn} | " + ' ／ '.join(f"{w}: {', '.join(o[:6])}{' …' if len(o) > 6 else ''}" for w, o in owner['app'][sn]) + ' |')
L += ['', '## 3. ★절별 기본 항목(defaults) 대비 — 빠짐 / 남음(앱) · 현빈 G', '', '| 절 | 기본 항목(SECTION_DEFAULTS) |', '|---|---|']
for k, v in A['defaults'].items(): L.append(f"| {k} | {' · '.join(f'`{x}`' for x in v)} |")
L += ['', '| 절 | 블럭 · 빠짐 / 남음 |', '|---|---|']
for sn in sorted(miss['app'], key=lambda x: (ORDER.index(x) if x in ORDER else 99, x)):
    L.append(f"| {sn} | " + ' ／ '.join(f"{w}: {('−' + ','.join(m)) if m else ''}{(' +' + ','.join(e)) if e else ''}" for w, m, e in miss['app'][sn]) + ' |')
L += ['', '- 예외(블럭이 빼도 되는 것)는 PLAN §4b 의 «블럭 허용 목록»(`-x`/`+x`)으로 — 지금은 목록이 없어 모든 빠짐이 var.',
      '', '## 4. 시안 상태번호 ↔ 앱 블럭 대응표', '', '| 시안 상태 | 꼴 이름 | 앱 블럭(로스터) |', '|---|---|---|']
appk = {i['who'] for i in A['items']}
def guess(kind):
    k = kind.replace('-', '')
    for a in sorted(appk, key=len, reverse=True):
        base = a.replace('-block', '').replace('-', '')
        if base and (k.startswith(base) or base.startswith(k)): return a
    MAP = {'text': 'text-block', 'shape': 'shape-block', 'sticker': 'sticker-block', 'section': 'section', 'asset': 'asset-block', 'documents': 'cert-block', 'slides': 'slide-block', 'cardcvb': 'canvas-block', 'labelgrouptags': 'label-group-block', 'innercard': 'innercard-block', 'infocardsimple': 'infocard-block', 'speechbubble': 'speech-bubble-block', 'devicemockup': 'mockup-block', 'youtubethumbsection': 'section'}
    for p, a in MAP.items():
        if k.startswith(p): return a
    return '—'
for it in M['items']: L.append(f"| {it['who']} | {it.get('kind', '')} | {guess(it.get('kind', ''))} |")
L += ['', '## 5. 고친 인용 · 문구', '', f"- «38종» → 정확히: 블럭 {blocks}종(로스터 · SECTION_BLOCK_TYPE_SEL 파생) + 페이지·섹션·프레임 = 패널 {nApp}.", f"- 하위 라벨 = {C_FIELD}(글 꼴) · {C_SUBROW}(줄).", '']
open(out, 'w').write('\n'.join(L) + '\n'); print('ok', len(secs), 'secs · diffs', len(diffs))
