# EDITING.md — 편집 축 (기존 블록 수정 워크플로우)

> 이 문서는 **이미 만들어진 텍스트 블록을 수정**하는 작업을 다룬다.
> 새 섹션·블록을 **추가**하는 작업은 `./SECTION-TEMPLATES.md`(레이아웃)와
> `./DESIGN-RULES.md`(스타일)를 따른다. 수정 시 적용할 크기·갭·컬러 토큰의
> 출처도 항상 `DESIGN-RULES.md`다 — 이 문서는 "어떻게 고치나"만 설명한다.
>
> 대상 도구: `get_canvas_state`(읽기) · `update_block`(수정) · `add_asset_block`의
> `sectionId` 옵션. 자세한 `window.*` 시그니처는 `docs/goditor-api-reference.md` 참조.

---

## 1. 개요 — 추가(add_*) vs 수정(update_block)

| 구분 | 도구 | 언제 |
|------|------|------|
| **추가** | `build_basic_section` / `add_section` / `add_text_block` / `add_asset_block` | 없던 섹션·블록·이미지 자리를 **새로** 만들 때 |
| **수정** | `update_block` | **이미 있는** 텍스트 블록의 내용·색·크기·굵기·정렬을 바꿀 때 |
| **읽기** | `get_canvas_state` | 수정 대상 블록의 `blockId`를 찾을 때 (수정 전 필수 선행) |

- "○○ 문구를 바꿔/색 입혀/키워줘" → **수정**. 먼저 blockId를 찾아야 한다.
- "○○ 섹션/문구 추가해줘" → **추가**. EDITING.md 대상 아님.
- 수정은 **텍스트 블록만** 가능 (h1/h2/h3/body/label/caption). 에셋·구분선 등
  비텍스트 블록 속성 수정은 아직 미지원 (→ 5. 한계 참조).

---

## 2. 워크플로우 (3단계)

```
① get_canvas_state  → 섹션/블록 트리에서 대상 blockId 찾기
② update_block      → blockId + 바꿀 필드만 전달
③ 결과 확인          → 반환 before/applied 로 변경 검증
```

### ① 대상 블록 찾기 — "특정 문구"를 blockId로

`update_block`은 **blockId(`tb_xxx`)** 로만 동작한다. 사용자는 보통 문구로 말하므로
(`"가격 19,900원 문구"`) 텍스트→blockId 매칭이 먼저다.

```
get_canvas_state({})                 // 전체 캔버스
get_canvas_state({ sectionId })      // 특정 섹션만 (대상이 어느 섹션인지 알 때)
```

반환 `sections[].blocks[]` 의 각 항목은 `{ blockId, type, text, color, fontSize, align }`.
사용자가 말한 문구와 `text`가 일치(또는 부분 포함)하는 블록의 `blockId`를 고른다.

- **유일 매칭**: 텍스트가 한 블록에만 있으면 그 `blockId` 사용.
- **중복/모호**: 같은/비슷한 문구가 여러 블록이면 → 섹션 이름·type·순서를 근거로
  사용자에게 "○○ 섹션의 가격 문구 말씀이신가요?"라고 확인 후 진행.
- **못 찾음**: 일치 텍스트가 없으면 추측해서 아무 블록이나 고치지 말고,
  어느 문구인지 사용자에게 되묻는다.

### ② 수정 — update_block 호출

찾은 blockId에 **바꿀 필드만** 담아 호출. 안 보낸 필드는 그대로 유지된다.

```
update_block({ blockId: 'tb_a1b2', color: '#FF3B30' })          // 색만
update_block({ blockId: 'tb_a1b2', fontSize: 100 })             // 크기만
update_block({ blockId: 'tb_a1b2', content: '단 하나의 선택', fontWeight: 600, align: 'center' })
```

### ③ 결과 확인

반환의 `before`(수정 전 값)와 `applied`(적용된 값)를 비교해 의도대로 됐는지 본다.
여러 블록을 연속 수정한 뒤에는 `get_canvas_state`를 한 번 더 호출해 전체를 검증해도 된다.

---

## 3. update_block 레퍼런스

대상: **텍스트 블록 1개**. 한 호출이 undo 1단위(`pushHistory`)로 묶인다.

### 파라미터

| 필드 | 타입 | 필수 | 범위/값 | 의미 |
|------|------|------|---------|------|
| `blockId` | string | ✅ | `tb_xxx` | 수정할 텍스트 블록 id (get_canvas_state로 획득) |
| `content` | string | — | — | 텍스트 내용 교체. 미전달 시 기존 유지 |
| `color` | hex | — | `#RRGGBB` | 글자 색 (예: `#FF3B30`) |
| `fontSize` | int | — | **8–400** | 폰트 크기(px) |
| `fontWeight` | int\|string | — | **100–900** 또는 `normal`\|`bold` | 굵기 |
| `align` | string | — | `left`\|`center`\|`right` | 정렬 |

- 변경할 필드만 보낸다. 보내지 않은 필드는 건드리지 않는다.
- 값은 `DESIGN-RULES.md` 토큰에 맞춘다 — 메인카피 **90–100** / 본문 **~30** /
  굵기 제목 **600+**·본문 **300** / 히어로성 텍스트 **center**.

### 반환

```jsonc
// 성공
{ ok: true, blockId, type, before: {…기존 값}, applied: {…적용 값} }

// 실패
{ ok: false, code: 'USER_BUSY' }   // 사용자가 입력 중
{ ok: false, code: 'NOT_FOUND' }   // 해당 blockId 없음
```

### 에러 처리

- **`USER_BUSY`** — 사용자가 캔버스에서 편집 중. **1회만** 잠시 후 재시도하고,
  그래도 막히면 "지금 편집 중이신 것 같아요, 끝나면 다시 적용할게요"라고 양해를 구한다.
  무한 재시도 금지.
- **`NOT_FOUND`** — blockId가 사라졌거나 잘못됨. `get_canvas_state`로 다시 찾는다.
  (블록이 삭제·이동됐을 수 있음.)

---

## 4. 실전 예시

토큰 기준은 모두 `DESIGN-RULES.md` (메인카피 90–100, 본문 ~30, 갭 100/50/30, center).

### (a) "이 가격 문구 빨간색으로 해줘"
```
1) get_canvas_state({})                         // 가격 문구 검색
   → blocks 중 text="19,900원" 인 { blockId:'tb_77' } 발견
2) update_block({ blockId:'tb_77', color:'#FF3B30' })   // Apple Red
3) 반환 applied.color === '#FF3B30' 확인
```
> 강조색은 한 섹션에 1개로 절제 (DESIGN-RULES 컬러 원칙).

### (b) "메인카피 더 크게"
```
1) get_canvas_state({ sectionId })              // 해당 섹션의 h1 찾기
   → type='h1' 블록 { blockId:'tb_12', fontSize:72 }
2) update_block({ blockId:'tb_12', fontSize:100 })   // 메인카피 권장 90–100 상한
3) 본문과 3:1 위계 유지 확인 (본문이 30이면 OK)
```

### (c) "이 섹션(맨 아래)에 이미지 한 칸 추가해줘"
이미지 자리 추가는 수정이 아니라 **추가**지만, "특정 섹션"을 지정한다는 점에서
`add_asset_block`의 `sectionId` 옵션을 쓴다 (선택된 섹션이 아니어도 됨).
```
1) get_canvas_state({})                         // 대상 섹션 id 확인
2) add_asset_block({ preset:'img1', sectionId:'sec_wd3nixu' })
```
> `sectionId` 생략 시 현재 선택된 섹션에 추가된다.

### (d) "이 섹션 전체적으로 좀 다듬어줘" (모호 — 분해 필요)
"다듬어줘" 같은 자동 플래닝은 **미지원**. 추측으로 일괄 수정하지 말고 먼저 분해·확인한다.
```
1) get_canvas_state({ sectionId })로 현재 상태 파악
2) 사용자에게 구체화 질문:
   "메인카피 키울까요 / 본문 줄일까요 / 정렬 center로 맞출까요 / 강조색 넣을까요?"
3) 확정된 항목마다 update_block 1콜씩 (각각 undo 1단위)
   예) update_block({ blockId:'tb_12', fontSize:100 })   // 메인카피
       update_block({ blockId:'tb_13', fontSize:30 })    // 본문
       update_block({ blockId:'tb_13', align:'center' })
```
> 한 번에 "알아서 예쁘게"는 못 한다. 토큰 기준으로 항목을 나눠 제안하고 승인받아 수정.

---

## 5. 주의 / 한계

- **undo 1단위**: `update_block` 한 호출 = `pushHistory` 1단위. 사용자가 Cmd+Z 1번으로
  되돌릴 수 있도록, 한 의미 단위는 한 호출로 (여러 필드는 한 호출에 함께 담아도 됨).
- **사용자 편집 중(USER_BUSY)**: 1회 재시도 후 양해. 강제로 덮어쓰지 않는다.
- **미지원 동작** (요청 시 "현재는 안 됩니다" 안내):
  - 블록 **삭제 / 이동 / 순서 변경**
  - **비텍스트 블록**(에셋·구분선·아이콘 등) 속성 수정
  - "다듬어줘"류 **자동 플래닝** — 사용자와 분해해서 update_block 여러 번으로 처리
- **직접 파일 편집 금지**: `../proj_*.json`(Goditor 본)을 텍스트로 직접 고치지 않는다.
  캔버스 변경은 **반드시 MCP 도구**(update_block / add_* / get_canvas_state)로만.
- **blockId 신뢰**: blockId는 get_canvas_state로 갓 읽은 값을 쓴다. 사이에 사용자가
  편집하면 stale 될 수 있으므로, NOT_FOUND가 나면 다시 읽어 매칭한다.

---

## 업데이트 로그
- (초안) 추가/수정 구분 · get_canvas_state→update_block 워크플로우 · update_block 레퍼런스 · 실전 예시 4종 · 한계(삭제/이동/비텍스트/자동플래닝 미지원) 정리.
