---
name: goditor-icon-suggest
description: 이미지(스크래치 sp_xxx)나 텍스트 요구사항을 받아 적절한 Iconify 아이콘을 선정하고, search_iconify + add_iconify_block MCP 도구로 캔버스에 일괄 삽입한다. 시각 일관성(동일 prefix + weight) 보장. 사용자가 "아이콘 추천해줘", "이 이미지처럼 아이콘 그리드 만들어줘", "/goditor-icon-suggest", "이 무드에 맞는 아이콘 골라줘" 등을 말할 때 실행해.
version: 1.0.0
---

# goditor-icon-suggest

Goditor 에디터에서 Iconify 아이콘 삽입을 자동화하는 단일 작업 스킬. 다른 스킬을 호출하지 않는다 (orchestrator 아님).

---

## 사용 도구 (MCP, 포트 9345)

| 도구 | 용도 |
|---|---|
| `search_iconify({query, prefix?, limit?})` | 아이콘 검색. `prefix` 화이트리스트: mdi, material-symbols, heroicons, lucide, ph, tabler, bi, feather, ion, ri |
| `add_iconify_block({sectionId?, name, size?, color?})` | SVG fetch + 캔버스 삽입. `name`은 "prefix:icon-name" 형식 |
| `get_canvas_state({sectionId?})` | 현재 섹션/블록 상태 조회 (필요 시) |
| `read_scratch_item(id)` | 스크래치 이미지 데이터 조회 (있는 경우) |

---

## 패밀리(prefix) 자동 선택 룰

이미지 무드 / 요구사항 → prefix 선택 (한 작업당 1개만):

| 무드 / 키워드 | prefix | weight 힌트 |
|---|---|---|
| 미니멀 · 얇은 라인 · 깔끔 | `lucide` 또는 `feather` | 단일 weight |
| 굵은 솔리드 · 친근 · POP | `ph` (Phosphor) | `-bold` 또는 `-fill` suffix 통일 |
| 다양한 weight 필요 | `tabler` | 다양 |
| iOS · 둥근 · 모던 | `heroicons` 또는 `ion` | 단일 |
| 다목적 7000+ · Material | `mdi` | 단일 |
| Material Bold 강조 | `material-symbols` | weight 조절 |

**철칙: 한 작업 내 모든 아이콘은 같은 prefix + 같은 weight suffix를 사용한다.** 시각 일관성이 무너지면 결과물이 망가진다.

---

## 작업 흐름

### 1) 입력 파악
- 사용자가 스크래치 ID(sp_xxx) + 셀별 의미를 주는 경우 → 셀별 의미 키워드 추출
- 텍스트로 "X개 아이콘 그리드, 의미는 ~~"를 주는 경우 → 의미 리스트 그대로 사용
- 이미지 분석이 필요한 경우 → 이미지 보고 셀(아이콘)을 격자로 분해 + 각 셀 의미 추정

### 2) 패밀리(prefix) 결정 — 단 한 번
- 위 매핑표로 prefix 1개 결정
- 무드가 애매하면 `ph-bold` (Phosphor bold)를 기본값으로
- 사용자가 패밀리를 직접 지정하면 그대로 사용

### 3) 검색 — 셀별 병렬 `search_iconify`
```
search_iconify({ query: "fan",   prefix: "ph", limit: 5 })
search_iconify({ query: "shirt", prefix: "ph", limit: 5 })
...
```
- 셀이 N개면 `search_iconify` 호출도 N개 — *병렬 실행*
- `limit: 5` 정도면 후보 충분 (더 많으면 노이즈)

### 4) 후보 픽 — POC 교훈 반영
- **검색 결과 첫 후보를 자동 채택하지 말 것**
- 후보 fullName(예: `ph:fan-bold`, `ph:fan-light`, `ph:wind-bold`)을 보고:
  - 의미가 query와 직접 매치되는지
  - weight suffix가 작업 통일 weight(`-bold` 등)와 일치하는지
- POC 사례: `query: "engine"` → 후보에 손가락 클릭 아이콘이 첫 줄에 나옴. fullName 확인 안 하면 오선택.
- 의미적으로 안 맞으면 **query를 1회 변형해서 재검색** (예: `engine` → `motor` → `gear`)
- 그래도 매치 없으면 사용자에게 보고하고 해당 셀은 스킵

### 5) 삽입 — 순차 `add_iconify_block`
```
add_iconify_block({
  sectionId: "sec_xxx",       // 대상 섹션 (선택사항)
  name: "ph:fan-bold",         // 4)에서 픽한 fullName
  size: 96,                    // 작업 통일 크기
  color: "#000000"             // 옵션 — 강조 색 필요 시
})
```
- *순차* 실행 (병렬 X) — 순서 보장 + atomic IIFE의 selectSection 충돌 방지
- size는 작업 내 통일 (예: 모두 96 또는 모두 128). 셀마다 다른 크기 금지

### 6) 검증
- `get_canvas_state({sectionId})`로 새로 들어간 `icon-block` 개수 확인
- 각 블록의 `iconName`이 의도한 fullName과 일치하는지 빠르게 점검
- 사용자에게 결과 보고 — `삽입 N개 / 실패 M개 / 변형검색 K개`

---

## 에러 대응

| 상황 | 처리 |
|---|---|
| `search_iconify` 결과 0개 | query 1회 변형 후 재시도. 그래도 0이면 셀 스킵 + 보고 |
| `add_iconify_block` USER_BUSY | 2초 대기 후 재시도 1회. 그래도면 사용자에게 보고 |
| network/timeout | 즉시 사용자에게 보고 (재시도 X) |
| color invalid | 검증 통과 형식으로 변환 (#RGB → #RRGGBB) 후 재호출 |
| name 형식 오류 | 코드 버그 — 즉시 보고 |

---

## 산출물 보고 양식

```
패밀리: ph (Phosphor) · weight: -bold · size: 96px
삽입 결과:
  ✓ sec_xxx 내 9/9 (icn_aaa, icn_bbb, ...)
  - 1건은 query 변형으로 매치 (engine → motor)
  - 0건 실패
```

---

## 금지사항
- 한 작업 안에서 prefix를 섞지 말 것 (예: ph + lucide 혼용 금지)
- weight suffix 섞지 말 것 (예: ph:home-bold + ph:user-light 혼용 금지)
- 검색 결과 첫 후보를 자동 채택하지 말 것 (POC에서 1건 오선택 사례 있음)
- 셀별로 size를 다르게 하지 말 것 (UI 일관성)
- 다른 스킬을 호출하지 말 것 (이 스킬은 단일 작업 스킬)
