---
name: goditor-figma
description: Figma ↔ 상페마법사 웹에디터 간 양방향 연동 스킬. Talk to Figma WebSocket(ws://localhost:3055)으로 프레임 가져오기(import), 에디터→피그마 업로드(export), 피그마 직접 제어를 모두 담당한다.
version: 1.0.0
---

# goditor-figma

## 역할

Talk to Figma 플러그인(WebSocket)을 통해 Figma와 상페마법사 에디터를 연결한다.

| 작업 방향 | 내용 |
|-----------|------|
| **Figma → 에디터** | 프레임 읽기 → Goditor Spec v2 변환 → 에디터 빌드 |
| **에디터 → Figma** | 에디터 섹션 → Figma 업로드 (기존 기능) |
| **Figma 직접 제어** | `figma_cmd.mjs`로 노드 생성/수정/조회 |

---

## 세션 시작 루틴

**매 세션 시작 시 반드시 실행:**

```bash
# WebSocket 서버 상태 확인 (포트 3055)
lsof -i :3055 | grep LISTEN
```

- **결과 있음** → 서버 정상 실행 중, 바로 작업 진행
- **결과 없음** → 서버 꺼진 상태, 아래 명령으로 백그라운드 실행:

```bash
cd /Users/a1/web-editor && npm run figma &
sleep 2
lsof -i :3055 | grep LISTEN && echo "✅ 서버 시작 완료" || echo "❌ 서버 시작 실패"
```

서버 시작 후 Figma 플러그인에서 **Reconnect** 클릭.

---

## 환경

- **Talk to Figma WebSocket**: `ws://localhost:3055`
- **채널**: 사용자가 제공 (예: `33bugs6o`) — "Connect to Figma, channel abc123" 형태도 허용, 마지막 단어만 추출
- **CDP 포트**: `9336` (에디터 빌드 시)
- **figma_cmd 경로**: `/Users/a1/web-editor/figma-renderer/figma_cmd.mjs`
- **임포터 스크립트**: `/Users/a1/web-editor/scripts/goditor_figma_importer.js`
- **러너 스크립트**: `/Users/a1/web-editor/scripts/goditor_runner.js`

---

## A. Figma → 에디터 (프레임 임포트)

> **VECTOR 자동 감지**: 선택한 프레임이 VECTOR / ELLIPSE / STAR / POLYGON / BOOLEAN_OPERATION / LINE 타입이면
> 임포터가 자동으로 SVG 추출 → `addVectorBlock()` 경로로 전환한다. `--build` 플래그 필수.

### Step 1. 프레임 목록 확인

```bash
node /Users/a1/web-editor/scripts/goditor_figma_importer.js --channel {채널ID}
```

출력 예:
```
📄 현재 페이지: Page 1
프레임 목록:
  --frame 100:15  → "Hook 섹션"
  --frame 100:32  → "Main 섹션"
```

### Step 2. 프레임 → 에디터 빌드

```bash
# Spec 저장 + 빌드까지 한 번에
node /Users/a1/web-editor/scripts/goditor_figma_importer.js \
  --channel {채널ID} --frame {프레임ID} --build

# Spec만 저장 (검토 후 수동 빌드)
node /Users/a1/web-editor/scripts/goditor_figma_importer.js \
  --channel {채널ID} --frame {프레임ID}
# → /tmp/goditor_spec_figma_{프레임명}.json 저장

# 수동 빌드
node /Users/a1/web-editor/scripts/goditor_runner.js /tmp/goditor_spec_figma_{프레임명}.json
```

### 전체 페이지 일괄 빌드

```bash
for FRAME_ID in 100:15 100:32 100:51; do
  node /Users/a1/web-editor/scripts/goditor_figma_importer.js \
    --channel {채널ID} --frame $FRAME_ID --build
  sleep 0.5
done
```

### 변환 규칙

**텍스트 style 매핑**

| Figma fontSize | Goditor style |
|----------------|---------------|
| ≥ 90px | h1 |
| ≥ 60px | h2 |
| ≥ 44px | h3 |
| ≥ 30px | body |
| < 30px + fontWeight ≥ 600 | label |
| < 30px | caption |

**이미지 preset 매핑** (노드높이 / 프레임높이 비율)

| 비율 | preset |
|------|--------|
| < 0.75 | wide |
| 0.75 ~ 0.95 | standard |
| 0.95 ~ 1.10 | square |
| > 1.10 | tall |

**레이아웃 감지**: Y좌표 기준 행 그루핑(허용 오차 프레임높이×4%), 행 내 노드 수에 따라 stack/flex 결정

---

## B. 벡터 노드 → 에디터 벡터 블록 임포트

VECTOR / GROUP / FRAME 노드를 SVG로 추출해 에디터의 **벡터 블록**으로 추가한다.

### Step 1. 노드 ID 확인

```bash
# 문서 루트 자식 목록 조회
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command get_document_info --params '{}' --channel {채널ID}

# 특정 그룹/프레임 내부 트리 확인
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command get_node_info --params '{"nodeId":"{nodeId}"}' --channel {채널ID}
```

### Step 2. SVG 익스포트

```bash
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command export_node_as_image \
  --params '{"nodeId":"{nodeId}","format":"SVG","scale":1}' \
  --channel {채널ID} | python3 -c "
import sys, json, base64
d = json.load(sys.stdin)
svg = base64.b64decode(d['imageData']).decode()
with open('/tmp/my_vector.svg','w') as f: f.write(svg)
print('saved:', len(svg), 'bytes')
"
```

> **주의**: `format`은 반드시 대문자 `"SVG"` / `"PNG"` 사용. 소문자는 타임아웃 발생.

### Step 3. 에디터에 벡터 블록 추가 (CDP)

```javascript
// 1) SVG 파일을 브라우저로 로드
await fetch('file:///tmp/my_vector.svg').then(r => r.text())
  .then(svg => { window.__pendingSvg = svg; });

// 2) 벡터 블록 추가
window.addVectorBlock(window.__pendingSvg, {
  w: 400,    // 원본 width
  h: 258,    // 원본 height
  label: 'my_vector'
});
```

### 벡터 블록 dataset 속성

| 속성 | 설명 |
|------|------|
| `data-svg` | 원본 SVG 문자열 |
| `data-color` | fill 색상 (기본 `#000000`) |
| `data-w` / `data-h` | 표시 크기 (px) |
| `data-rotate-deg` | 회전 각도 |
| `data-flip-h` / `data-flip-v` | 좌우/상하 반전 (`'1'`=on) |

### 프로퍼티 패널 기능

벡터 블록 클릭 시 우측 패널에서 조절 가능:
- **크기** W / H
- **색상** SVG fill 색상 (단색 치환)
- **회전 / 반전** 각도 입력 + 90° 버튼 + 좌우/상하 반전

### 단축키

| 키 | 동작 |
|----|------|
| `G` | 선택된 벡터 블록 바로 아래 Gap 추가 |
| `T` | 아래 텍스트 블록 추가 |

---

## C. 에디터 → Figma (업로드)

에디터 UI 상단 Export 드롭다운 → "Figma 업로드" 버튼 사용.
또는 CDP로:

```javascript
window.doFigmaUpload()  // 모달 열기
```

채널 입력 후 업로드할 섹션 선택 → 업로드.

---

## C. Figma 직접 제어

`figma_cmd.mjs`로 단일 커맨드 실행:

```bash
# 문서 정보 조회
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command get_document_info --params '{}' --channel {채널ID}

# 특정 노드 정보 조회
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command get_node_info --params '{"nodeId":"100:15"}' --channel {채널ID}

# 사각형 생성
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command create_rectangle \
  --params '{"x":0,"y":0,"width":860,"height":400,"name":"Section"}' \
  --channel {채널ID}

# 노드 삭제
node /Users/a1/web-editor/figma-renderer/figma_cmd.mjs \
  --command delete_node --params '{"nodeId":"100:15"}' --channel {채널ID}
```

주요 커맨드: `get_document_info`, `get_node_info`, `get_selection`,
`create_frame`, `create_text`, `create_rectangle`,
`set_fill_color`, `set_font_name`, `resize_node`, `delete_node`

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `Disconnected from server` / Reconnect 눌러도 안 됨 | WebSocket 서버(포트 3055)가 꺼진 상태 | 아래 서버 재시작 명령 실행 |
| `문서 조회 실패` | Talk to Figma 플러그인 미실행 | Figma에서 플러그인 열고 채널 확인 |
| `프레임 ID 없음` | 잘못된 ID | `--frame` 없이 실행해 목록 확인 |
| `에디터 없음` | CDP 포트 미연결 | `cd /Users/a1/web-editor && npx electron . --remote-debugging-port=9336 admin` |
| 텍스트 줄바꿈 | fontSize가 col 너비 초과 | Spec JSON 열어 fontSize 줄여서 재빌드 |

### WebSocket 서버 재시작

```bash
cd /Users/a1/web-editor && npm run figma
```

> `bun` 명령이 안 될 때 `~/.bun/bin/bun figma-plugin/socket.js`로 직접 실행. 서버 뜨면 피그마 플러그인에서 Reconnect 클릭.

---

## 에스컬레이션

| 상황 | 담당 |
|------|------|
| 임포터/변환 로직 버그, 에디터 빌드 API 이상 | **`/goditor`** 에 수정 요청 |
| Talk to Figma WebSocket 연결 문제 해결 안 될 때 | **`/goditor`** 에 수정 요청 |
| Goditor API 자체가 없거나 부족할 때 | **`/goditor-api`** 에 구현 요청 |

---

## 관련 스킬

| 스킬 | 역할 |
|------|------|
| `/goditor-layout-planner` | 이미지 분석 → Spec 작성 |
| `/goditor-layout-generator` | Spec → 에디터 빌드 |
| `/goditor-layout-orchestrator` | 전체 파이프라인 총괄 |
| `/goditor` | 에디터/스크립트 코드 수정 |
