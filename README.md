# 상페마법사 웹에디터 (sangpe-editor)

상세페이지를 블록 단위로 쌓아 만드는 Electron 기반 인라인 에디터.
Figma 플러그인 연동으로 디자인 자동 업로드 지원.

---

## 실행

```bash
npm run dev          # 개발 (핫리로드 + DevTools, 포트 9334)
npm run dev:step2    # 개발 서버 (포트 9335)
npm start            # 프로덕션
npm run build:mac    # macOS 빌드
npm run release:mac  # macOS 배포 (auto-update)
npm run release:win  # Windows 배포
npm run figma        # Figma WebSocket 서버 실행
npm run test:e2e     # Playwright E2E 테스트
```

---

## DOM 구조

```
section-block
  └── section-inner
        ├── frame-block[data-text-frame]   ← 텍스트 투명 래퍼 (자동 생성)
        │     └── text-block
        ├── asset-block
        ├── frame-block                    ← 프레임 (Auto / Free layout)
        │     ├── frame-block[data-text-frame] > text-block
        │     ├── asset-block / gap-block / ...
        │     └── frame-block              ← 중첩 프레임 가능
        └── ...
```

- `frame-block[data-free-layout="true"]` → freeLayout (절대 위치 배치)
- `frame-block[data-full-width="true"]` → 전체 너비 플로우
- `frame-block[data-text-frame="true"]` → 텍스트 전용 투명 래퍼

---

## 블록 종류

| 블록 | 클래스 | ID 접두사 | 설명 |
|------|--------|----------|------|
| Text | `.text-block` | `tb_` | h1 / h2 / h3 / body / caption / label |
| Asset | `.asset-block` | `ab_` | 이미지 (placeholder or uploaded) |
| Gap | `.gap-block` | `gb_` | 여백 블록 |
| Frame | `.frame-block` | `fb_` | Auto / Free layout 컨테이너 |
| Icon Circle | `.icon-circle-block` | `icb_` | 아이콘+레이블 원형 블록 |
| Table | `.table-block` | `tbl_` | 스펙 테이블 |
| Label Group | `.label-group-block` | `lg_` | 태그 pill 그룹 |
| Card | `.card-block` | `cb_` | 카드형 블록 |
| Graph | `.graph-block` | `grb_` | 그래프 블록 |
| Strip Banner | `.strip-banner-block` | `sb_` | 가로 배너 |
| Divider | `.divider-block` | `div_` | 구분선 |
| Speech Bubble | `.speech-bubble-block` | `spb_` | 말풍선 블록 |
| Shape | `.shape-block` | `shp_` | 도형 블록 |
| Checklist | `.checklist-block` | `cl_` | 체크리스트 블록 |

---

## 주요 파일

```
main.js                          ← Electron 메인 프로세스, IPC 핸들러
preload.js                       ← contextBridge API 노출
index.html                       ← 에디터 메인 화면
pages/projects.html              ← 프로젝트 목록 페이지

js/
  editor.js                      ← 선택·줌·키보드·프리셋 로직
  block-factory.js               ← 블록 생성 팩토리 (make*, add*)
  drag-drop.js                   ← DnD 조율 (block-drag, section-drag, drag-utils 통합)
  block-drag.js                  ← 블록 드래그 로직
  section-drag.js                ← 섹션 드래그 로직
  drag-utils.js                  ← DnD 유틸
  smart-guides.js                ← 스냅/정렬 가이드
  overlay-handles.js             ← 리사이즈·코너반경 핸들 (ss-handles-overlay)
  history.js                     ← Undo/Redo
  globals.js                     ← 전역 변수/상수
  tab-system.js                  ← 좌측 탭 시스템
  inspector.js                   ← Inspector 탭
  branch-system.js               ← 브랜치 생성/전환
  commit-system.js               ← 커밋/되돌리기
  image-handling.js              ← 이미지 업로드 처리
  animation-engine.js            ← 애니메이션 엔진
  gif.js / gif.worker.js         ← GIF 생성
  preview.js                     ← Preview 모드
  ai-prompt.js                   ← AI 프롬프트 UI
  design-system.js               ← 디자인 시스템 토큰
  theme-system.js                ← 테마/프리셋 시스템
  goditor-api.js                 ← Goditor API 연동
  variable-binding.js            ← 변수 바인딩

  panels/
    layer-panel.js               ← 레이어 패널 트리
    layer-panel-items.js         ← 레이어 아이템 렌더링
    template-system.js           ← 템플릿 저장/로드
    template-browser.js          ← 템플릿 브라우저 UI
    iconify-panel.js             ← Iconify 아이콘 패널
    mockup-panel.js              ← 목업 디바이스 패널
    mockup-devices.js            ← 목업 디바이스 정의

  props/
    prop-text.js / prop-asset.js / prop-frame.js
    prop-section.js / prop-page.js / prop-canvas.js
    prop-card.js / prop-graph.js / prop-table.js
    prop-gap.js / prop-divider.js / prop-shape.js
    prop-label-group.js / prop-icon-circle.js
    prop-layout.js / prop-row.js / prop-multisel.js
    prop-step.js / prop-joker.js / prop-vector.js
    prop-mockup.js / prop-iconify.js

  io/
    save-load.js                 ← 직렬화(serializeProject), 로드(rebindAll)
    export-design-json.js        ← 디자인 JSON 내보내기
    export-figma-json.js         ← Figma 업로드용 JSON 빌드
    export-html.js               ← HTML 내보내기
    export-image.js              ← 이미지 내보내기
    import-figma-json.js         ← Figma JSON 가져오기
    figma-publish.js             ← Figma 업로드 실행

css/editor.css                   ← 전체 스타일
presets/                         ← default / dark / brand / minimal 프리셋 JSON
templates/                       ← 템플릿 메타데이터 + canvas HTML
projects/                        ← 프로젝트 JSON 저장소
figma-plugin/                    ← Figma 플러그인 + WebSocket 서버
figma-renderer/                  ← Figma 렌더러 스크립트
_context/                        ← 설계 문서 (DESIGN_SYSTEM.md 등)
```

---

## 저장 포맷 (v2)

```json
{
  "version": 2,
  "currentPageId": "page_1",
  "pages": [
    {
      "id": "page_1",
      "name": "Page 1",
      "label": "Hook",
      "pageSettings": { "bg": "#969696", "gap": 100, "padX": 32, "padY": 32 },
      "canvas": "<HTML 문자열>"
    }
  ]
}
```

프로젝트 파일은 `projects/` 폴더에 JSON으로 저장됨.
멀티페이지 지원 (Hook / Main / Detail / CTA / Event).

---

## Figma 연동 구조

```
앱 (Electron)
  → figma:upload IPC
    → figma-publisher.js (JSON → Figma 커맨드 순차 실행)
      → figma-plugin/socket.js (WebSocket 서버, ws://localhost:3055)
        → Figma 플러그인 (figma-plugin/code.js)
          → Figma Plugin API
```

**플러그인 실행**: `npm run figma` → Figma에서 플러그인 열고 채널 코드 입력

---

## 블록 ID 체계

모든 블록은 생성 시 고유 ID를 가짐 (`block-factory.js`의 `genId()`).

```
sec_a3f7k2b   ← 섹션
tb_x9m4p1q    ← 텍스트 블록
ab_8n2j5rc    ← 에셋(이미지) 블록
gb_k1w7z4e    ← 갭 블록
fb_r2p5m9t    ← 프레임 블록
icb_m3p9x2n   ← 아이콘 서클 블록
tbl_q5r8y1c   ← 테이블 블록
lg_b2d4f6h    ← 라벨 그룹 블록
cb_j7n1s3k    ← 카드 블록
grb_v4x8w2q   ← 그래프 블록
```

---

## 참고 문서

- 디자인 시스템: `_context/DESIGN_SYSTEM.md`
- Claude 작업 지침: `CLAUDE.md`
