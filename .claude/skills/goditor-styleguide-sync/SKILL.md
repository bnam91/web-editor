---
name: goditor-styleguide-sync
description: GODITOR 디자인/CSS 작업 후 프로젝트 명세·기준을 지켰는지 확인하고, 정본 디자인 문서 docs/styleguide.html을 현재 코드에 맞게 동기화하는 스킬. 사용자가 "스타일가이드 동기화", "디자인 기준 확인하고 styleguide 업데이트", "styleguide 갱신", "디자인 명세 점검", "/goditor-styleguide-sync" 등을 말할 때 실행해. 디자인 토큰/색상/간격/선택 outline/컴포넌트 작업을 한 직후에 쓰는 게 가장 효과적.
---

# GODITOR 스타일가이드 동기화

GODITOR(vanilla-JS + Electron 디자인 에디터)의 **정본 디자인 문서** `docs/styleguide.html`을 현재 코드 상태에 맞춰 갱신한다. 이 문서는 사람(현빈)이 브라우저(`file://`)로 열어보는 **외부 의존 0, 단일 자체완결 HTML**(다크 테마)이다.

> ⚠️ **이 스킬은 앱 코드를 직접 고치지 않는다.** 발견한 앱 수정거리는 styleguide의 🔧 고칠 후보 대기열(FIXQ 배열)에만 누적한다 — 나중에 fable 세션이 일괄 처리.

## 1) 기준 대조 — 위반 검출

아래 기준 문서/스크립트로 방금 한 디자인 작업이 규칙을 지켰는지 확인한다:

| 기준 | 무엇을 본다 |
|---|---|
| `.claude/rules/css-blocks.md` | 블록 선택 outline(현재 `--sel-outline-w` 단일 토큰 통일), 핸들, speech-bubble 패턴 |
| `_context/DESIGN_SYSTEM.md` | 토큰 계층(primitive `--p-*` → semantic → `--ui-*`), 블록 목록, 패널 구조 |
| `docs/RIGHT_PANEL_PROPS.md` · `docs/LEFT_PANEL_LAYER.md` | 속성/레이어 패널 구조·치수 |
| `scripts/check-design-tokens.sh` | 하드코딩 색·미정의 토큰 자동 lint (있으면 실행) |

핵심 점검 항목: 색을 토큰으로 거쳤는지(하드코딩 hex 금지), 파란 강조는 `--ui-accent-primary` 하나인지, 폰트크기·weight·radius·간격이 토큰(`--ui-fs-*`/`--ui-fw-*`/`--ui-radius-*`/`--space-*`) 스케일인지, 선택 outline이 `--sel-outline-w`인지(하드코딩 px outline = DS-09 통일 회귀로 위반), 대비 AA(본문 4.5:1)인지.

### ⭐ 의도적 비토큰 레지스트리 (예외 — 위반으로 잡지 말 것 · 🔧 대기열에 넣지 말 것)

아래는 **의도적으로** 토큰을 안 거친 raw 값이다. 디자인 판단으로 확정된 것이라 lint/대조에서 하드코딩으로 걸려도 **위반 아님 → 부채 대기열 금지 → 토큰화/값 변경 금지**(고치면 의도가 깨짐). styleguide 이슈 섹션엔 "의도적 비토큰(고치지 말 것)"으로만 1줄 기록.

| 위치 | 값 | 이유(고치면 깨지는 것) |
|---|---|---|
| `css/editor-panels.css` `.layer-item-type` | `font-size:8px` + `color:#6e6e6e` | 레이어 패널 **최약 위계**(이름 11px#aaa > 섹션헤더 9px볼드#969696 > type). 토큰화·밝기상향 시 type가 이름/헤더와 경쟁해 위계 붕괴 (2026-06-14 현빈 확정) |

> 새 의도적 비토큰을 확정할 때마다 이 표에 추가한다. 표에 없는 raw 값만 진짜 부채로 본다.

## 2) styleguide.html 동기화

`<script>` 블록 상단의 데이터 배열을 **실제 css와 grep으로 대조해 일치**시킨다:

- **토큰 배열**: `UI` / `GRAY` / `BLUE` / `PMISC` / `DEAD` / `STATUS` / `PRESET` / `RT` / `TYPO` / `TYPO_CANVAS` / `FW` / `SHADOW` — 정의(`css/editor-base.css`, `css/design-tokens.css`)와 사용횟수(`grep -roh 'var(--token)' css js | wc -l`)를 재집계. 삭제된 토큰은 제거, 신설 토큰은 추가.
- **이슈 섹션**: 코드가 이미 해결한 이슈는 `✅ fable 해결됨` 배지 표시.
- **🔧 대기열(FIXQ 배열)**: 새 부채는 `[제목, 위치, 증상, 제안]` 형식으로 행 추가. (상태/코멘트는 사용자가 브라우저에서 지정 — localStorage)
- **서술 갱신**: 코드가 바뀐 섹션(폰트 Pretendard/Noto, 그림자 토큰, 선택색 파랑/보라 체계, 핸들 7px, z-index 밴드 등) 본문 수정.
- 사용횟수는 fable이 코드를 계속 편집해 drift하므로 "YYYY-MM-DD 스냅샷"으로 표기.

## 3) 제약 (절대 어기지 말 것)

- **외부 의존 0**: `fetch`/XHR/CDN/외부 `<script>`·`<link>` 금지. `file://` 더블클릭으로 열려야 함.
- 영속은 `localStorage`, 복사는 `navigator.clipboard` + `execCommand` 폴백만.
- 토큰명 클릭 복사는 `var(--token)` 형태 — raw hex를 토큰명 자리에 넣지 말 것(무효 `var(#xxx)` 복사됨).
- 기존 `--doc-*` 테마 토큰만 재사용.

## 4) 검증 + 보고

1. `<script>` 블록 추출해 `node --check` 통과 확인.
2. 렌더 검증 — 앱(9334)을 방해하지 않게, 현재 페이지에 **숨김 iframe**으로 `file://.../styleguide.html`을 로드해 콘솔 오류 0·섹션 렌더·인터랙션(상태 select·코멘트·전체복사) 동작 확인. (CDP 새 탭은 9334가 앱이라 막힘)
3. 무엇을 고쳤는지(동기화한 토큰, 추가한 대기열 항목, 해결 표시한 이슈) 보고.

### 렌더 검증 스니펫 (chrome-devtools evaluate_script)

```js
async () => { return await new Promise(res => {
  const ifr=document.createElement('iframe');
  ifr.style.cssText='position:fixed;left:-9999px;width:1280px;height:1000px';
  ifr.src='file:///Users/a1/web-editor/docs/styleguide.html?'+Math.random();
  ifr.onload=()=>setTimeout(()=>{ const d=ifr.contentDocument; const errs=[]; ifr.contentWindow.onerror=m=>errs.push(''+m);
    const r={errors:errs, sections:d.querySelectorAll('main section').length, fqRows:d.querySelectorAll('#fq-body tr').length};
    document.body.removeChild(ifr); res(r); },450);
  document.body.appendChild(ifr); }); }
```
