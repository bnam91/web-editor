---
project: web-editor
type: browser-cdp
cdp_port: [9335, 9334]
entry: window.addSection()
results_dir: .qa/results
notion_db: 333111a5-7788-817f-91ab-f20f5ede759d
notion_guide: https://www.notion.so/QA-Squad-330111a5778881c29bc9d92c73461103
guard_doc: /Users/a1/.claude/skills/webeditor-regression-guard/skill.md
roles:
  core: [QA-01, QA-02, QA-03, QA-04, QA-05, QA-06]
  special: [QA-Explorer, QA-Regression, QA-Boundary, QA-UX]
---

# web-editor (상페마법사 웹에디터) QA Profile

> 이 파일은 qa-squad 엔진이 RUN 모드에서 로드하는 프로젝트별 QA 명세다.
> 방법론·하네스·결과포맷은 엔진(`~/.claude/skills/qa-squad/SKILL.md`)에 있다.
> 여기엔 **이 프로젝트를 무엇으로/어떻게 검증하는지**만 담는다.

---

## 환경 / 사전체크

- **프로젝트 경로**: `/Users/a1/web-editor/`
- **CDP 포트**: `9335` (기본) / `9334` (구버전 — 실행 시 port-status로 먼저 확인)
- **진입점**: `window.addSection()`
- **QA 체크리스트 DB(Notion)**: `333111a5-7788-817f-91ab-f20f5ede759d`
- **노션 운영지침**: https://www.notion.so/QA-Squad-330111a5778881c29bc9d92c73461103
- **결과 저장**: `/Users/a1/web-editor/.qa/results/qa-*.json`

```bash
# CDP 포트 확인 (port-status 스킬)
ps aux | grep remote-debugging-port | grep -E "9334|9335"

# 활성 포트 응답 확인
for PORT in 9334 9335; do
  RESULT=$(curl -s --connect-timeout 1 http://localhost:$PORT/json/version 2>/dev/null)
  [ -n "$RESULT" ] && echo "✅ $PORT 열림" || echo "❌ $PORT 닫힘"
done
```

CDP 없으면 사용자에게 "앱 실행 후 다시 의뢰해주세요" 안내 후 중단.

---

## ⚠️ 작업 전 필수: 회귀 방지 가드 확인

**`/Users/a1/.claude/skills/webeditor-regression-guard/skill.md` 를 반드시 읽고 시작한다.**
- QA-Regression 에이전트는 가드 문서의 S-01~S-06 스모크 테스트를 R 목록 앞에 반드시 실행
- 절대 금지 사항(배너 블록 관련 삭제된 코드) 숙지 후 진행
- 가드 문서의 위험 패턴(P-01~P-07) 인지 후 관련 시나리오 테스트 시 주의

---

## 역할 구성 (총 10명)

### 🔵 Core QA — 기능별 전문 에이전트 (6명)

| 에이전트 | 담당 영역 | 시나리오 방식 |
|---------|---------|------------|
| **QA-01** | 텍스트/갭/구분선 | 연속 편집 시나리오 |
| **QA-02** | 에셋/이미지/서클 | 업로드→편집→저장 흐름 |
| **QA-03** | 카드/테이블/그래프 | 데이터 입력 전체 흐름 |
| **QA-04** | 저장/로드/브랜치/히스토리 | 저장→탭전환→복귀 시나리오 |
| **QA-05** | 내보내기/템플릿/레이어패널 | 삽입→수정→내보내기 흐름 |
| **QA-06** | 드래그앤드롭/그룹/멀티선택 | 드래그 시퀀스 + group/ungroup 흐름 |

### 🔴 Special QA — 전문 역할 에이전트 (4명)

| 에이전트 | 역할 | 접근 방식 |
|---------|------|---------|
| **QA-Explorer** | 자유 탐색형 | 실제 사용자처럼 5분 자유 사용 후 이상 동작 보고 |
| **QA-Regression** | 회귀 테스트 | 이전 수정된 버그 목록 전담 재확인 |
| **QA-Boundary** | 엣지케이스 | 극단값, 빠른 연속 클릭, 빈 상태 공략 |
| **QA-UX** | UX 일관성 | 피그마 대비 단축키/커서/피드백 일관성 |

### 부분 의뢰 매핑

| 사용자 언급 | 투입 에이전트 |
|-----------|------------|
| "텍스트 QA" | QA-01 |
| "이미지 QA" | QA-02 |
| "저장 QA" / "히스토리 QA" | QA-04 |
| "회귀 테스트" / "버그 재발 확인" | QA-Regression |
| "이상한 거 찾아봐" / "자유 탐색" | QA-Explorer |
| "엣지케이스" / "극단값" | QA-Boundary |
| "UX 확인" / "단축키 점검" | QA-UX |
| "전체 QA" / 미지정 | 전 에이전트 병렬 투입 |

---

## 에이전트별 시나리오 명세

### QA-01 텍스트/갭/구분선

```
시나리오 1: 5분 랜딩페이지 작성 흐름
  addSection() → addTextBlock('h1') → addTextBlock('body') x2 → addGapBlock() → addDividerBlock()
  → 텍스트 내용 입력 → 볼드/이탤릭 토글 → 저장 확인
  acceptance: 저장 후 reload 시 내용 동일

시나리오 2: 텍스트 스타일 전체 순환
  h1/h2/h3/body/caption/label 각 스타일 추가 → 정렬(left/center/right) 변경
  acceptance: 각 정렬 변경 시 block.style.textAlign === 해당값

시나리오 3: 편집 중 단축키 충돌
  텍스트 편집 중 Cmd+G 누르기 → 그룹화 실행 안 됨 확인
  텍스트 편집 중 Delete 누르기 → 블록 삭제 안 됨 확인
```

### QA-02 에셋/이미지/서클

```
시나리오 1: 이미지 업로드 전체 흐름
  addAssetBlock() → 이미지 없는 상태 확인 → 이미지 편집 패널 열림 확인

시나리오 2: 서클 블록 편집모드
  addIconCircleBlock() → 클릭 → 편집모드 진입 → overflow:visible 확인
  acceptance: 편집모드 진입 시 overflow !== 'hidden'

시나리오 3: 이미지 삭제 후 dataset 정리
  이미지 있는 asset-block → 이미지 삭제
  acceptance: dataset.imgW, dataset.imgX, dataset.imgY 모두 삭제됨
```

### QA-03 카드/테이블/그래프

```
시나리오 1: 테이블 셀 편집 + Undo
  addTableBlock() → 셀 클릭 → 내용 입력 → Cmd+Z
  acceptance: Undo 후 셀 내용 원복

시나리오 2: 카드 블록 클릭 → Row 패널 응답
  addCardBlock() → 클릭 → 우측 패널 카드 프로퍼티 표시 확인
```

### QA-04 저장/로드/브랜치/히스토리

```
시나리오 1: 저장 → 탭 전환 → 복귀
  섹션 2개 + 블록 추가 → triggerAutoSave() → switchTab → 복귀
  acceptance: 복귀 후 캔버스 내용 동일

시나리오 2: Undo/Redo 체인
  블록 추가 5번 → Cmd+Z 5번 → Cmd+Shift+Z 5번
  acceptance: 각 단계 정확히 원복/복원

시나리오 3: 브랜치 전환 데이터 보존
  main 브랜치 내용 기록 → dev 전환 → main 복귀
  acceptance: main 데이터 동일, _suppressAutoSave 해제됨
```

### QA-05 내보내기/템플릿/레이어패널

```
시나리오 1: 템플릿 삽입 후 ID 충돌 없음
  템플릿 2개 연속 삽입
  acceptance: 두 섹션 id 다름 (중복 없음)

시나리오 2: 레이어패널 동기화
  블록 추가/삭제/이동 후 레이어패널 항목 수 == 실제 블록 수
```

### QA-06 드래그앤드롭/그룹/멀티선택

```
시나리오 1: 블록 드래그 이동
  섹션 내 블록 3개 → 드래그로 순서 변경
  acceptance: 변경된 순서 저장 후 유지, 드래그 중 버벅임 없음 (rAF 확인)

시나리오 2: 섹션 간 블록 이동
  섹션 2개 → 블록을 다른 섹션으로 드래그
  acceptance: 원본 섹션에서 제거, 대상 섹션에 추가됨

시나리오 3: 그룹 생성 → 해제 전체 흐름
  블록 2개 선택 → Cmd+G → group-block 생성 확인
  → 레이어패널 group 표시 확인
  → group 선택 → Cmd+Shift+G → 해제 확인
  acceptance: group-block.length 0으로 감소, 블록 2개 복원

시나리오 4: Shift+Click 멀티선택
  블록 클릭 → Shift+Click 추가 → selected 블록 수 확인
  acceptance: 2개 이상 .selected 클래스 유지
```

### QA-Explorer (자유 탐색형)

```
미션: 실제 사용자처럼 5분간 상세페이지 하나를 처음부터 만들어봐.
  - window.addSection() 부터 시작
  - 텍스트, 이미지, 구분선, gap 자유롭게 추가
  - 드래그로 섹션 순서 변경 시도
  - 저장, 브랜치 전환 시도
  - 이상하거나 막히는 동작 있으면 전부 기록

보고 형식: "~를 하려고 했는데 ~가 안 됨" 형식으로 UX 문제 기술
정량 기준 없이도 FAIL 보고 가능 (사용자 관점 판단)
```

### QA-Regression (회귀 테스트)

```
아래 목록은 이전에 수정된 버그들. 재발했는지 CDP로 확인.

[필수 확인 목록]
R-01: 저장→새로고침 데이터 보존 (S-01 동일)
  → addSection + 텍스트 입력 → triggerAutoSave → 새로고침 → 내용 유지 확인
  ※ strip-banner 관련 R-01은 해당 블록 삭제로 제거됨

R-02: layer-panel buildFilePageSection 에러 없음
  → window.buildFilePageSection?.() 호출 시 에러 없음

R-03: editor g/t/a 단축키 섹션 반환
  → window.getSelectedSection?.() !== null 상태에서 단축키 작동

R-04: save-load Cmd+G isContentEditable 가드
  → contenteditable 내부에서 Cmd+G 누를 때 groupSelectedBlocks 호출 안 됨

R-05: section-variation resolveVariation 존재
  → typeof window.resolveVariation === 'function'

R-06: branch-system switchBranch _suppressAutoSave 가드
  → switchBranch 호출 중 autoSave 트리거 안 됨

R-07: ~~components.css banner imgPos~~ — 배너 블록 삭제됨, 제거

R-08: Cmd+Shift+G 그룹해제
  → group-block.selected 상태에서 Cmd+Shift+G → group-block 제거됨
```

### QA-Boundary (엣지케이스 전담)

```
B-01: 섹션 0개 상태에서 단축키 (g/t/a/Delete) 눌러도 에러 없음
B-02: 섹션 1개뿐일 때 섹션 삭제 시도 → 삭제 안 되거나 적절한 처리
B-03: 텍스트 블록에 1000자 이상 입력 → overflow-wrap 적용 확인
B-04: 이미지 없는 asset-block에서 이미지 편집 패널 열기 → 에러 없음
B-05: 빠른 연속 클릭 (100ms 간격으로 블록 5번 클릭) → 중복 선택 없음
B-06: Cmd+Z 50번 연속 → historyStack 경계 처리 (에러 없음)
B-07: 그룹 안의 블록 선택 후 Cmd+G → 중첩 그룹 방지 토스트 표시
B-08: 한글 IME 입력 중 g/t/a 단축키 → 블록 추가 안 됨 (IME 안전)
B-09: 이모지 포함 텍스트 저장/로드 → 이모지 유지됨
B-10: 동일 섹션 ID로 템플릿 2번 삽입 → ID 충돌 없음
```

### QA-UX (UX 일관성 전담)

```
U-01: 단축키 피그마 대비 일관성
  Cmd+D: 복제 ✓
  Cmd+Z/Shift+Z: Undo/Redo ✓
  Cmd+G: 그룹 ✓
  Cmd+Shift+G: 그룹해제 ✓
  Cmd+A: 전체선택 ✓
  Delete/Backspace: 삭제 ✓
  Arrow+Cmd: 이동 ✓

U-02: 드래그 UX 쾌적함
  dragover 핸들러에 rAF 적용 여부
  drag 중 buildLayerPanel() 호출 여부 (있으면 FAIL)
  5개 블록 배치 후 드래그 시 버벅임 여부

U-03: 선택 상태 시각 피드백
  블록 선택 시 하이라이트 즉시 반영
  멀티선택 시 복수 하이라이트 정상

U-04: 에러 상태 피드백
  지원 안 되는 동작 시도 시 토스트 메시지 표시 여부
  빈 상태 패널(블록 미선택)에서 프로퍼티 패널 처리
```

---

## Notion DB 상태 업데이트

이 프로젝트는 `notion_db`가 설정되어 있으므로 RUN 종료 후 상태 동기화를 수행한다.

```bash
# 1. 대기 항목 조회 (시나리오 이름 매핑용)
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';
const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();
const DB_ID = '333111a5-7788-817f-91ab-f20f5ede759d';

const res = await fetch('https://api.notion.com/v1/databases/' + DB_ID + '/query', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({ filter: { property: '상태', select: { equals: '대기' } } })
});
const data = await res.json();
data.results.forEach(p => {
  const name = p.properties['기능명']?.title?.[0]?.text?.content || '-';
  console.log(p.id + ' | ' + name);
});
" --input-type=module

# 2. 개별 항목 상태 업데이트 (PASS → 완료, FAIL → 실패)
node -e "
import { readFileSync } from 'fs';
import os from 'os';
import path from 'path';
const envRaw = readFileSync(path.join(os.homedir(), '.config/secrets/.env'), 'utf8');
const apiKey = envRaw.match(/NOTION_API_KEY=(.+)/)[1].trim();
const PAGE_ID = 'REPLACE_ME';  // 항목 page ID
const STATUS = '완료';  // '완료' | '실패' | '대기'

const res = await fetch('https://api.notion.com/v1/pages/' + PAGE_ID, {
  method: 'PATCH',
  headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
  body: JSON.stringify({ properties: { '상태': { select: { name: STATUS } } } })
});
const d = await res.json();
console.log(d.id ? '✅ ' + STATUS : '❌ ' + JSON.stringify(d));
" --input-type=module
```

### 매핑 규칙
- 시나리오 결과의 `name`과 Notion DB 항목의 `기능명`을 **키워드 매핑**으로 연결
- 예: "브랜치 전환" 시나리오 PASS → DB에서 "브랜치 전환" 포함 항목 → 상태 `완료`
- PASS → `완료`, FAIL → `실패`, SKIP → 업데이트 안 함
- 매핑 안 되는 시나리오는 스킵 (신규 항목 자동 추가 금지)
