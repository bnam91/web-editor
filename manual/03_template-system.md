# 03. 섹션 템플릿 시스템

## 개요

섹션 단위로 디자인을 저장하고 재사용할 수 있는 템플릿 라이브러리.
폴더(테마) > 카테고리 > 템플릿 이름의 3단 구조로 관리된다.

---

## 저장 구조

```
templates/
├── index.json          ← 메타데이터 전용 (canvas 없음)
└── canvas/
    ├── tpl_xxx.html    ← 섹션 outerHTML
    └── tpl_yyy.html
```

### index.json 예시

```json
[
  {
    "id": "tpl_1711234567890",
    "name": "풀스크린 텍스트형",
    "folder": "미니멀 쇼핑몰",
    "category": "Hero",
    "createdAt": "2026-03-23T...",
    "thumbnail": null
  }
]
```

- `folder` = 테마명 (사용자가 자유롭게 지정)
- `category` = 섹션 타입 (Hero / Main / Feature / Detail / CTA / Event / 기타)
- canvas HTML은 개별 파일로 분리 → index.json은 항상 가볍게 유지

---

## 3단 계층 구조

```
folder (테마)
└── "미니멀 쇼핑몰"
    ├── Hero       → 템플릿 N개
    ├── Feature    → 템플릿 N개
    ├── CTA        → 템플릿 N개
    └── ...
```

**폴더 = 테마** 개념으로 설계되었다.
특정 테마의 모든 카테고리가 채워지면 → 하나의 완성된 테마 팩이 된다.

---

## 주요 함수

| 함수 | 설명 |
|------|------|
| `initTemplates()` | 앱 시작 시 index.json 로드 + localStorage 마이그레이션 |
| `loadTemplates()` | 메모리 캐시 반환 (sync) |
| `saveTemplates(arr)` | 캐시 갱신 + index.json 저장 |
| `saveAsTemplate(sec, name, folder, category)` | 섹션 → index + canvas 파일 저장 |
| `deleteTemplate(id)` | canvas 파일 삭제 + index 갱신 |
| `insertTemplate(tpl)` | canvas 파일 로드 → DOM 삽입 (async) |
| `showTemplatePreview(id)` | canvas 로드 → 미리보기 모달 (async) |
| `_loadCanvas(id)` | canvas/{id}.html 파일 읽기 (내부용) |

---

## 향후 로드맵 (테마 팩 방향)

- [ ] **테마 완성도 표시** — 폴더 내 카테고리 채운 비율 프로그레스바
- [ ] **테마 통째로 프로젝트에 적용** — 폴더 선택 시 카테고리별 대표 섹션 1개씩 자동 캔버스 구성
- [ ] **테마 내보내기/가져오기** — index.json + canvas/ 폴더를 zip으로 묶어 공유
- [ ] **canvas JSON 전환** — 현재 outerHTML 저장 → serializeSection() 추출 후 JSON으로 교체 (HTML 구조 변경에 강함)
- [ ] **썸네일 자동 생성** — 저장 시 html2canvas로 thumbnail 생성

---

## 알려진 제약

- canvas 파일은 현재 섹션 `outerHTML` 저장 → 에디터 HTML 구조 변경 시 오래된 템플릿 깨질 수 있음
- 이미지 src가 data URL이 아닌 외부 경로면 다른 환경에서 불러올 때 깨질 수 있음
- 썸네일 미구현 → 현재 이름/카테고리로만 구분
