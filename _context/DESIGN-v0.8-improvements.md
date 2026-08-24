# DESIGN — GODITOR v0.8 개선 14건 (fable 울트라플랜)

- 작성: 태양(fable 오케스트레이터) 2026-08-24 · 위임: 지디(현빈 지시: 지디 직접구현 금지·태양 오케)
- **base = dev (ae13bfe)** · worktree `/Users/a1/web-editor-taeyang-v08` · 브랜치 `feature/v0.8-improvements` · ⛔머지·배포는 현빈 게이트
- 원천: `~/.claude/skills/지디/handoff/goditor-v0.8-improvements-plan-brief.md`(정찰 실측 — ★재정찰 금지, 라인 ±는 grep 보정만)
- ⛔ 라이브 9334(admin 실행중)·release 체크아웃 web-editor·타 워크트리·web-editor-taeyang(P2) 무접촉. QA는 «격리 인스턴스»(별도 포트·userData 사본)로.

## 0. 실행 원칙
1. **PGE**: 브리프가 Plan을 이미 줌 → 유닛마다 **Generate(opus 서브에이전트 구현) → Execute(격리 CDP QA + 고디터QA 세션 검증)**. 통과해야 다음 유닛.
2. **1유닛 = 1커밋 이상**. 커밋은 오케스트레이터(나)가. 유닛 브리프에 «변경 파일 + 구현 스펙 + 검증 스펙» 명시.
3. **★기능 1개 끝날 때마다 고디터QA 세션(tmux `srv-고디터QA`, id a1-0b)에 위임 QA** → 통과해야 다음. (내 격리 CDP QA는 1차, 고디터QA가 2차 게이트.)
4. **회귀 0**: 각 유닛은 «기존 동작 불변» 실증(특히 #13 digit 가드·⌘M OS충돌·저장본 하위호환). 격리 인스턴스에서 실제 조작.
5. **★디자인 일관성 게이트(필수)**: 새 UI(태그 칩·바별 피커·회전 핸들·셀 색 UI·정렬 버튼)는 기존 토큰(`--ui-*`·`--sel-*`)·공용 클래스(`.prop-btn`/`.prop-btn-sm`/`.gap-preset-btn`/`.fp-menu-item` 등) 재사용. 룩어라이크 CSS 신작 금지. 더미 스크린샷으로 인접 UI와 대조 후 완료.
6. **보고**: 기능 완료마다 ⓐ 노션카페 블랙보드(전체게시판·카테고리「업무결과」) ⓑ 지디 SendMessage 핑.

## 1. 잠금 결정 (지디 확정 — 코드 반영)
- **#12** = ⌥+click, `js/alt-click-layer-select.js` 확장(SELECTABLE에 `.section-block`·하이라이트). capture 순서·`_altLayerSelect` 재진입 마커 주의.
- **#13** = ⌥+숫자(1/2/3) 부모섹션 기준 정렬. ★기존 digit 핸들러(editor.js 갭 프리셋·텍스트타입)에 **`!e.altKey` 가드** 후 alt 분기를 «더 앞에서» preventDefault+return.
- **병합 = ⌘M(빈 키)** · `preventDefault`(Electron 최소화 충돌) · 갭선택→#8 / 셀선택→#5-b 분기.
- **#2 dev-gate** = 기존 admin IPC(`preload.js isAdmin()`·`main.js app:is-admin`) 재사용. 기본 `#ai-btn.fp-btn-ai`·`#claude-pm-btn`만 숨김. **그 외 `.fp-btn`은 목록 뽑아 지디→현빈 확인 후 결정**(임의 숨김 금지).

## 2. 실행 순서 (페이즈)
- **Phase 1 — S (PGE 워밍업, 병렬 가능):** #15 · #2(버튼목록 확인 게이트 포함) · #9 · #11 · #7*
  - *#7은 「인라인 style.padding 잔존」 확인 후 S/M 확정(실 proj.json 확인 = 유닛 첫 스텝).
- **Phase 2 — M (의존 순서 주의):** #13-가드+정렬 → #12(레이어 드릴) → #8(갭병합 ⌘M) → #10(패딩0 중앙) → #3(icon PNG) → #4(그래프 바색) → #14(핸들 회전) → #5-a(로우 높이) → #6-a(셀 부분색)
  - ⌘M은 #8·#5-b 공용 → #8에서 ⌘M keydown 프레임을 «컨텍스트 분기»로 세우고, #5-b가 셀분기를 붙인다.
  - digit 키: #13 가드를 #15보다 «먼저»는 아니어도, #13 착수 시 #15 핸들러와 같은 블록을 건드리므로 #15 완료 후 #13.
- **Phase 3 — L (별도 페이즈, fable 재플랜):** #5-b(테이블 rowspan 병합) · #6-b(스티커 리치텍스트) — export/figma 재직렬화·저장모델 변경이라 위험 큼. Phase 1·2 통과 후 별도 착수.
- **#16** = 이번 구현 안 함(다음 세션·설계 A안 추천). **#1** 보류.

## 3. 유닛 스펙 (실행 에이전트용)

### Phase 1
**U15 (#15 갭 프리셋 동기화)** — `js/editor.js`(갭 번호키 핸들러 끝)·`js/props/prop-gap.js:41`(슬라이더 input).
- 구현: 번호키로 갭 높이 세팅 직후 `propPanel.querySelectorAll('.gap-preset-btn').forEach(b=>b.classList.toggle('active', +b.dataset.h===h))` 호출(프리셋 패널 열린 경우만·null 가드). 슬라이더 `input` 핸들러에도 동일 `updatePresetActive`(있으면 재사용).
- 검증: 갭 선택→숫자키 → 해당 프리셋 버튼만 active · 슬라이더 드래그 → active 추종 · 프리셋 클릭 왕복 불변. 회귀: 갭 없을 때 숫자키 no-op.

**U2 (#2 플로팅 버튼 dev-gate)** — `index.html`(플로팅 버튼 IIFE, 배지 admin 토글 패턴 복제).
- 구현: DOMContentLoaded 후 `if(!(await api.isAdmin())){ document.querySelector('#ai-btn.fp-btn-ai')?.style.setProperty('display','none'); document.getElementById('claude-pm-btn')?.style.setProperty('display','none'); }`. ⌘K 단축키 유지. **다른 `.fp-btn` 전체 id·title 목록을 수집해 보고**(숨김 여부는 지디→현빈 게이트, 이 유닛에선 위 2개만 숨김).
- 검증: admin 모드(argv admin)면 버튼 보임 · 비admin(패키지 시뮬 or IPC 스텁 false)이면 2개만 사라지고 나머지 UI/로직 무변 · 콘솔 0.

**U9 (#9 스포이드 확장)** — `js/editor.js`(i키 EyeDropper 대상 판정).
- 구현: 현재 `.text-block.selected`→`applyTextBlockColor` 만 → 대상 분기 추가: `.section-block.selected`→`sec.style.backgroundColor=color`+dataset.bg 동기+pushHistory+autosave · `.shape-block.selected`→prop-shape fill 적용 헬퍼. ⌘I(이탤릭)과 무충돌 확인.
- 검증: 섹션 선택+i+픽 → 배경 반영·저장 · shape 선택+i+픽 → fill 반영 · text 기존 동작 불변.

**U11 (#11 템플릿 태그 표시)** — `js/panels/template-system.js`(insertTemplate)·`.section-label` or prop-section.
- 구현: `insertTemplate`에서 `if(tpl.tags?.length) sec.dataset.tags=tpl.tags.join(',')`. 렌더: `.section-label` 옆 태그 칩(기존 칩 클래스 있으면 재사용, 없으면 `--ui-*` 토큰 최소 칩). 저장 canvas에 dataset.tags 보존·로드 시 칩 복원.
- 검증: 태그 있는 템플릿 삽입 → 칩 표시·저장/로드 왕복 유지 · 태그 없는 템플릿 → 칩 없음.

**U7 (#7 H2 상하패딩 비대칭)** — 먼저 실 proj.json 확인 → `css/editor-layout.css:.tb-h2`.
- 스텝0: 실측(잔존 인라인 style.padding 있으면 그게 직접원인 → 그 제거로 방향 전환, M 상향 가능).
- 구현(잔존 없으면): `.tb-h2 { padding-block:0; line-height:<상수>; }` + 필요 시 leading-trim(`text-box-trim` 지원 확인, 미지원이면 margin 보정). H1/H3/Body 대칭성도 회귀 확인.
- 검증: H2 위/아래 여백 시각 대칭(스크린샷 픽셀 측정) · 다른 텍스트타입 불변.

### Phase 2 (요지 — 유닛 착수 시 상세 서브브리프 발부)
- **U13** digit `!e.altKey` 가드(#15·텍스트타입·갭 전부) + `alignToParent(block, dir)` 신규(`closest('.section-block')` rect 기준 left/center/right, ⌥+1/2/3). ★가드 없으면 이중발동 — 회귀 테스트 필수.
- **U12** `alt-click-layer-select.js` SELECTABLE += `.section-block`·하이라이트 라인, `_collectStack` 재사용. 합성클릭 재진입 마커 유지.
- **U8** ⌘M keydown 프레임(preventDefault) + 컨텍스트 분기(갭선택→합산 병합: offsetHeight 합→첫 블록 height·나머지 row 제거·pushHistory·autosave·buildLayerPanel). 비인접/타섹션 규칙 정의(같은 section-inner 연속만 or 전체 합산 정책 — 서브브리프서 확정).
- **U10** `prop-text-wireup-align.js` 정렬 시 폭≠100%면 `alignSelf`(or margin auto) 동기. 저장본 회귀(기존 좌정렬) 방어.
- **U3** iconify PNG: accept += image/png, `/\.svg$/i` 거부 분기 완화, 래스터는 `<img src=data:>`+object-fit. ★data-URL proj.json 비대화 → **외부화 경로 태울지 결정**(assetsSaveCanvasImage 재사용 권장, 서브브리프서 확정). sanitizeCanvasHtml `<img>` 통과 확인.
- **U4** 그래프 items에 `item.color` + bar-v/bar-h fillStyle 인라인 + prop-graph 바별 피커행. AI fill 병합 시 color 유실 방지.
- **U14** 회전: `asset-rotate.js` 인프라를 대상 블록(shape 등)에 확장, `overlay-handles.js:20~44` 훅, `prop-shape.js applyRotation` 연동. ★회전후 리사이즈 핸들 좌표 보정.
- **U5a** 테이블 로우별 높이: `tr.style.height` + 셀선택모델(prop-table rowH 일괄 → 개별).
- **U6a** 셀 부분색: `applyColorToSel`/`_lastSelRange`를 전역 헬퍼로 승격해 contenteditable 셀에 배선.

### Phase 3 (별도 페이즈)
- **U5b** 바디셀 rowspan 병합(신규 인프라·export/figma 재직렬화). **U6b** 스티커 리치텍스트 저장모델. → Phase 1·2 통과 후 fable 재플랜.

## 4. QA 프로토콜
- **1차(내 격리 CDP)**: 라이브 userData 사본에 더미 프로젝트 + `electron <APP=web-editor-taeyang-v08> --user-data-dir=<사본> --remote-debugging-port=9362 admin`(라이브 9334·userData 무접촉). cdp.mjs로 조작·검증. ★index.html은 앱 루트(nav 절대경로).
- **2차(고디터QA 세션)**: 유닛 통과분을 tmux `srv-고디터QA`(a1-0b)에 tele-code로 QA 위임 → 통과 회신.
- 회귀: Phase 종료마다 핵심 플로우(생성→편집→저장→복원→export) 격리 스모크.

## 5. 완료 정의
- 유닛: 코드 + 1차 CDP QA + 고디터QA 2차 통과 + 디자인 일관성 검수 + 블랙보드 기록 + 지디 핑.
- 전체: 현빈 사후검수·배포 게이트. ⛔머지 금지.

## 6. 열린 게이트(지디→현빈)
1. base=dev 확정(권장) — 무응답 시 dev로 진행.
2. #2 나머지 `.fp-btn` 숨김 목록(U2가 수집 후 상신).
3. #8 갭 병합 규칙(연속만 vs 전체 합산), #3 PNG 외부화 여부, #14 회전 대상 블록 범위 — 각 유닛 서브브리프서 확정·필요 시 상신.
