# 상페마법사 웹에디터 (sangpe-editor)

상세페이지를 블록 단위로 쌓아 만드는 Electron 기반 인라인 에디터.
Figma 플러그인 연동으로 디자인 자동 업로드 지원.

---

## 실행

```bash
npm run dev     # 개발 (핫리로드 + DevTools)
npm start       # 프로덕션
```

---

## 구조

```
Canvas (860px 고정)
└── Page
    └── Section          ← 장표 단위 (id: sec_xxxxx)
        └── section-inner
            ├── Gap      ← 여백 (id: gb_xxxxx)
            ├── Row
            │   └── Col
            │       ├── Text Block   (id: tb_xxxxx)
            │       └── Asset Block  (id: ab_xxxxx)
            ├── Icon Circle Block    (id: icb_xxxxx)
            └── Table Block          (id: tbl_xxxxx)
```

### 블록 종류

| 블록 | 클래스 | ID 접두사 | 설명 |
|------|--------|----------|------|
| Text | `.text-block` | `tb_` | Heading / Subheading / Body / Caption / Label(Tag) |
| Asset | `.asset-block` | `ab_` | 이미지 (placeholder or uploaded) |
| Gap | `.gap-block` | `gb_` | 섹션/블록 간 여백 |
| Icon Circle | `.icon-circle-block` | `icb_` | 아이콘+레이블 원형 블록 |
| Table | `.table-block` | `tbl_` | 스펙 테이블 |
| Tags | `.label-group-block` | `lg_` | 태그 pill 그룹 (개별 색상/크기 설정 가능) |

---

## 주요 파일

```
main.js                          ← Electron 메인 프로세스, IPC 핸들러
preload.js                       ← contextBridge API 노출
index.html                       ← 에디터 메인 화면
js/
  editor.js                      ← 선택·줌·키보드·프리셋 로직
  drag-drop.js                   ← 블록 생성(make*), 섹션 추가(addSection), DnD
  save-load.js                   ← 직렬화(serializeProject), 로드(rebindAll)
  export.js                      ← Figma 업로드용 JSON 빌드 (buildFigmaExportJSON)
  layer-panel.js                 ← 레이어 패널 트리 렌더링
  prop-*.js                      ← Properties 패널 (text / asset / page / layout 등)
  image-handling.js              ← 이미지 업로드 처리
css/editor.css                   ← 전체 스타일
presets/                         ← default / dark / brand / minimal 프리셋 JSON
figma-renderer/
  sangpe_to_figma.mjs            ← Figma 업로드 메인 스크립트
  figma_cmd.mjs                  ← Figma WebSocket 커맨드 러너
```

---

## Figma 연동 구조

```
앱 (Electron)
  → figma:upload IPC
    → sangpe_to_figma.mjs (JSON → Figma 커맨드 순차 실행)
      → figma_cmd.mjs (WebSocket으로 명령 전송)
        → ws://localhost:3055 (MCP 서버, arinspunk/claude-talk-to-figma-mcp)
          → Figma 플러그인 (code.js)
            → Figma Plugin API
```

**플러그인 위치**: `/Users/a1/Desktop/figma-plugin2/Claude Talk to Figma/`

**채널 ID**: Figma 플러그인 실행 후 표시되는 채널 코드 입력 (예: `2eabtt9b`)

---

## 데이터 포맷 (sangpe-design-v1)

```json
{
  "schema": "sangpe-design-v1",
  "meta": { "canvasWidth": 860, "theme": { "background": "#fff", "sectionGap": 100 } },
  "sections": [
    {
      "name": "Section 01",
      "background": "#ffffff",
      "blocks": [
        { "type": "gap", "height": 100 },
        {
          "type": "text",
          "variant": "heading",
          "id": "tb_x9m4p1q",
          "content": "Headline goes here",
          "style": { "fontSize": 104, "fontWeight": 700, "color": "#111", "textAlign": "center" },
          "padding": { "top": 0, "right": 32, "bottom": 0, "left": 32 }
        },
        {
          "type": "text",
          "variant": "label",
          "id": "tb_a3k9r2m",
          "content": "Label",
          "style": { "fontSize": 26, "fontWeight": 700, "color": "#ffffff" },
          "labelBox": { "bg": "#111111", "radius": 8, "paddingH": 36, "paddingV": 11 }
        },
        { "type": "image", "id": "ab_8n2j5rc", "height": 780 }
      ]
    }
  ]
}
```

---

## 블록 ID 체계

모든 블록은 생성 시 고유 ID를 가짐 (`drag-drop.js`의 `genId()`).
기존 저장 파일 로드 시 ID 없는 블록은 `rebindAll()`에서 자동 부여 (하위 호환).

```
sec_a3f7k2b   ← 섹션
tb_x9m4p1q    ← 텍스트 블록
ab_8n2j5rc    ← 에셋(이미지) 블록
gb_k1w7z4e    ← 갭 블록
icb_m3p9x2n   ← 아이콘 서클 블록
tbl_q5r8y1c   ← 테이블 블록
lg_b2d4f6h    ← 태그 그룹 블록
```

---

## 프리셋 CSS 변수

| 변수 | 역할 |
|------|------|
| `--preset-h1-color` | H1 텍스트 색상 |
| `--preset-h2-color` | H2 텍스트 색상 |
| `--preset-body-color` | Body 텍스트 색상 |
| `--preset-label-bg` | Label 배경색 |
| `--preset-label-color` | Label 텍스트 색상 |
| `--preset-label-radius` | Label border-radius |

CSS 변수는 섹션 element의 인라인 style로 저장됨 (직렬화 시 보존).

---

## 저장 / 버전 관리

### 현재 방식
- **Commit 버튼** — localStorage 스냅샷 + JSON 파일 다운로드. 이전 커밋을 `LAST_COMMIT_KEY`로 백업.
- **↩ 되돌리기 버튼** — 직전 커밋 스냅샷으로 복원.
- **다른 이름으로 저장** — 파일명 변경 후 JSON 다운로드.

### TODO: GitHub 연동 (예정)
- GitHub OAuth 로그인
- 프로젝트 = GitHub repo 1개 (히스토리/버전 레포 단위 관리)
- Commit 버튼 → GitHub API로 실제 commit + push
- 되돌리기 → git 히스토리 기반 전체 버전 탐색
- 서버 저장 비용 0 (유저 본인 repo에 저장)
