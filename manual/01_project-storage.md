# 프로젝트 저장소 구조 설계

## 개요

`projects/` 폴더는 **GitHub 저장소 래퍼** 개념으로 설계한다.
각 레포(repo) = 하나의 상세페이지 작업 단위이며, 레포 내부에 브랜치가 존재한다.

---

## 현재 구조 (v1 — 플랫 구조)

```
projects/
  proj_1774198910789.json   ← 프로젝트 파일 (브랜치 없음)
  proj_sample.json
```

- 프로젝트 1개 = JSON 파일 1개
- 브랜치 데이터는 별도로 `localStorage(web-editor-branches)` 에 저장됨
- 프로젝트와 브랜치 데이터가 분리되어 있어 연결성 없음

---

## 목표 구조 (v2 — 레포 기반 구조)

```
projects/
  {repo-id}/                         ← 레포 단위 폴더 (= GitHub repo)
    _meta.json                       ← 레포 메타 (이름, 생성일, 현재 브랜치 등)
    main.json                        ← main 브랜치 스냅샷
    dev.json                         ← dev 브랜치 스냅샷
    feature-hero-section.json        ← feature 브랜치 (이름 자유)
    feature-price-table.json
  another-repo/
    _meta.json
    main.json
    dev.json
```

### 파일 역할

| 파일 | 역할 |
|------|------|
| `_meta.json` | 레포 이름, 생성일, 마지막 수정일, 현재 브랜치 이름 |
| `main.json` | 배포용 최종본. 직접 편집하지 않고 dev → main 병합으로만 업데이트 |
| `dev.json` | 개발/작업용 브랜치. 일상적인 작업은 여기서 진행 |
| `feature-*.json` | 특정 섹션 실험용 브랜치. 작업 완료 후 dev 또는 main에 병합 |

---

## GitHub 개념 대응표

| GitHub | 이 앱 |
|--------|--------|
| Repository | `projects/{repo-id}/` 폴더 |
| Branch | `{branch-name}.json` 파일 |
| Commit | Commit 버튼 → 현재 브랜치 JSON에 스냅샷 저장 |
| Merge | 브랜치 병합 → 대상 브랜치 JSON에 덮어쓰기 (섹션 단위 또는 전체) |
| Clone / Fork | (미구현) |
| main branch | `main.json` — 삭제 불가, 항상 존재 |
| dev branch | `dev.json` — 삭제 불가, 항상 존재 |
| feature branch | `feature-*.json` — 자유 생성/삭제 |

---

## `_meta.json` 구조

```json
{
  "id": "repo_1774198910789",
  "name": "2024 여름 신상 상세페이지",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T12:30:00.000Z",
  "currentBranch": "dev"
}
```

---

## 브랜치 JSON 구조

```json
{
  "branch": "dev",
  "version": 2,
  "currentPageId": "page_1",
  "committedAt": "2025-01-15T12:30:00.000Z",
  "pages": [
    {
      "id": "page_1",
      "name": "Page 1",
      "label": "",
      "pageSettings": { "bg": "#f5f5f5", "gap": 100, "padX": 32, "padY": 32 },
      "canvas": "<!-- 섹션 HTML -->"
    }
  ]
}
```

---

## Commit 버튼 동작 (목표)

현재: JSON 파일을 Downloads에 다운로드
목표: **현재 브랜치 JSON 파일에 스냅샷 저장** + 타임스탬프 갱신

```
Commit 버튼 클릭
  └─ serializeProject() 호출
  └─ projects/{repo-id}/{current-branch}.json 에 저장
  └─ _meta.json의 updatedAt + currentBranch 업데이트
  └─ 토스트 메시지: "dev에 커밋됨"
```

---

## UI 흐름 (목표)

```
홈 화면 (projects.html)
  └─ 레포 카드 목록 표시 (projects/ 하위 폴더 기준)
       ├─ 레포 이름, 마지막 수정일, 현재 브랜치 표시
       └─ 레포 선택 시
            └─ 해당 레포의 브랜치 목록 표시 (main / dev / feature-*)
                 └─ 브랜치 선택 → 에디터 열기 (?repo=xxx&branch=dev)
```

---

## 현재 브랜치 시스템 현황

`js/branch-system.js` 기준:

- `main`, `dev` 브랜치는 항상 존재 (삭제 불가)
- `feature/*` 브랜치 자유 생성 가능
- 브랜치 전환 시 현재 브랜치 자동 스냅샷 저장
- 섹션 단위 스코프 병합 지원 (`scope: [sectionId, ...]`)
- **현재는 localStorage에만 저장** → v2에서 파일 기반으로 전환 예정

---

## 마이그레이션 계획

| 단계 | 작업 |
|------|------|
| Step 1 | `projects/{repo-id}/` 폴더 구조 생성 (`main.js` IPC 수정) |
| Step 2 | `projects.html` UI → 레포 목록 + 브랜치 선택 화면으로 변경 |
| Step 3 | `index.html` URL 파라미터 `?repo=xxx&branch=dev` 방식으로 전환 |
| Step 4 | Commit 버튼 → 파일 저장으로 교체 |
| Step 5 | `branch-system.js` → localStorage 대신 파일 기반으로 전환 |
| Step 6 | 기존 `projects/*.json` 플랫 파일 마이그레이션 스크립트 |
