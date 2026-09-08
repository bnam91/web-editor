# Section Backlog (auto-generated)

Generated: 2026-06-09T05:21:23.390Z
Source: data-memo @ CDP :9334 (page: Goya Web Design Editor)
Sections scanned: 81 · with-memo: 28 · matched rows: 14

## Summary

| category | priority | count |
|---|---|---|
| system:api-missing | high | 1 |
| system:explicit-fix | high | 6 |
| system:protection-needed | high | 1 |
| content:fill | medium | 2 |
| system:discoverability | medium | 1 |
| system:ui-unclear | medium | 1 |
| content:cleanup | low | 2 |

## system:api-missing — 시스템 API/제어 인터페이스 누락 (high) · 1건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_uk8ggh2 | 3 | [Sec 14] 출처:sp_3dmpx8 + sp_1va562 / 점수:양호 / 평가: 메인 타이틀 'Premium Lint Remover' 브… | /(제어\\s*가능)\|(>>\\s*mcp)\|(mcp\\s*로)/i |

## system:explicit-fix — 명시적 FIX 요청 (high) · 6건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_na3rn0y | 30 | FIX-NEEDED [검토필요]: "22년 동안 연구" 표기 신뢰성 검토 필요 — 실제 22년인지, 표현 다듬을지 확인 | /FIX[-_\\s]?NEEDED/i |
| sec_3iswgnu | 35 | FIX-NEEDED [검토필요]: "정밀한 메탈 블레이드/강력한 모터" — 흡입모터인지 칼날 구조인지 맥락 불분명, 카피 명확화 필요 | /FIX[-_\\s]?NEEDED/i |
| sec_eyu1tl6 | 36 | FIX-NEEDED: "소프트 스프링 탑재" 카피가 sec_m0231bu와 중복 — 둘 중 하나 삭제하거나 한쪽 카피 차별화 필요 | /FIX[-_\\s]?NEEDED/i |
| sec_z8lg3v4 | 44 | FIX-NEEDED: 빈 섹션 + 이름 'Section 102' 중복, 의도 불명확 — 사용자 결정 필요 | /FIX[-_\\s]?NEEDED/i |
| sec_lyteok6 | 52 | FIX-NEEDED [검토필요]: "KKLIZEN 23 F/W" 시즌 표기 — 시즌 지난 카피, 갱신 또는 시즌 표기 제거 검토 | /FIX[-_\\s]?NEEDED/i |
| sec_v9b091y | 54 | FIX-NEEDED [검토필요]: "CHECK 04" — CHECK 03 누락된 듯, 번호 흐름 점검 필요 | /FIX[-_\\s]?NEEDED/i |

## system:protection-needed — 보호/잠금 필요 (실수 삭제 방지) (high) · 1건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_lj6m144 | 6 | 삭제하지말것 [검토완료 2026-06-09] "삭제하지말것" 보존 메모 확인. 변경 없이 유지. | /삭제\\s*하지\\s*말\\s*것\|삭제금지\|지우지\\s*마/i |

## content:fill — 콘텐츠 미작성/플레이스홀더 (medium) · 2건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_e6ayc3m | 4 | [Sec 17] 출처:sp_w16g3o + sp_g94emd(다중 가능) / 점수:문제 / 평가: 15 블록 모두 placeholder, 미작… | /placeholder\|미작성/i |
| sec_pt024wm | 5 | [Sec 18] 출처:sp_g94emd + sp_w16g3o / 점수:문제 / 평가: placeholder 소제목·본문 --- iconfy 스… | /placeholder\|미작성/i |

## system:discoverability — 발견성/이스터에그/참고자료 (medium) · 1건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_c26q9ud | 9 | SOLD OUT은 스티커 블록으로 해도 될듯 92,000대 돌파 > 텍스트 네온효과 → 텍스트블럭 이스트에그에서 가능할듯. 참고하기. [검토완… | /이스(트\|터)에그\|참고\\s*하기/ |

## system:ui-unclear — UI 불명확/이유 모호 (medium) · 1건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_xjvl5qr | 10 | #sp_user9w >> 디바이더가 있었어야되고 라벨이 왜 검정배경의 라벨인지 모르겠음 실제 스크래치패드랑 다른데 [차후처리 2026-06-0… | /왜\\s+.{0,40}(모르겠\|모름\|이러\|되는지\|되지\|이지)/ |

## content:cleanup — 잔재/템플릿 정리 필요 (low) · 2건

| sectionId | idx | memo (excerpt) | matched pattern |
|---|---|---|---|
| sec_jx5etks | 8 | [Sec 30] 출처:sp_smbm6j / 점수:문제 / 평가: '두더지퇴치기' 카피 — 보풀제거기와 제품명 불일치, 템플릿 잔재 [검토완료 … | /(템플릿\\s*잔재)\|(\\S+\\s*잔재)/ |
| sec_kpitvw8 | 21 | [Sec 96] 출처:sp_user9w / 점수:문제 / 평가: NOTICE 01 안내문 내 '__TEST_POSITION__' 테스트 마커 … | /(템플릿\\s*잔재)\|(\\S+\\s*잔재)/ |

---

## 🅿️ 보류 — 블록 「겹침(pullUp)」 · 더 고민이 필요한 영역 (2026-09-04)

**상태: dev 에서 «분리»됨. 브랜치 `feat/block-overlap` @ `f808390` 에 전량 보존.**
dev 분리 커밋 = `a08bab7`. 되살릴 땐 그 브랜치를 다시 보면 된다 — 잃은 것 없음.

### 왜 멈췄나 (현빈 판단)
「겹침」이 **오버레이·자유배치처럼 쓰일 소지**가 있다. 의도는 «포인트로 살짝 걸치기»
(이미지 위에 텍스트 끝만 걸치는 식)인데, 이름과 넓은 한도가 그 뜻을 넘어선다.
**근간을 흔들면 다른 게 모두 불편해질 수 있다** → 더 고민하고 재개.

### 재개할 때 «반드시» 지킬 전제
- **한도 = 자기 블록 높이의 1/3.** 현빈 결정(2026-09-04).
  · 지디 실측 반론도 함께 남긴다 — 실제 프로젝트 23섹션·194블록에서
    텍스트 프레임 중앙 50px → 1/3 = **17px**, 텍스트 블록 중앙 73px → **24px**.
    사진과 글자 사이 갭이 보통 40~100px 이라 「사진에 얹기」는 갭조차 못 건넌다.
    반대로 row(중앙 344px)엔 115px 을 허용한다.
  · **현빈은 그 «좁음»이 의도라고 답했다.** ⇒ 이 전제로 다시 설계할 것. 반론으로 되돌리지 말 것.

### 미확정 (정해야 재개 가능)
1. **이름** — 걸치기 / 올려붙이기 / 미세이동 (「겹침」은 폐기 방향)
2. **방식** — ⒜ 흐름을 당긴다(현재 구현) ⒝ 블록 «상자»는 두고 안의 내용 y 만 옮긴다
   · ⒝ 는 아래 블록·섹션 높이·드래그 판정·레이어가 **하나도 안 흔들린다**(근간 무접촉)
   · 대신 내용이 빠져나간 자리에 빈칸이 남는다
3. **Figma JSON · Design JSON** — 두 파일 모두 세로 오프셋 축이 없어 겹침을 «못 싣는다»
   (`export-figma-json.js:881` 섹션 객체에 y·height 없음, `:889` 오프라인 파싱).
   「화면·저장·HTML·PNG 전용」으로 명시할지, 스키마를 확장할지 미정.

### 이미 끝나 있는 것 (재개 시 재검증 불요, 단 전제가 바뀌면 다시)
저장·재로드·HTML·PNG 실측 통과 · 픽셀 대조(겹침 위쪽 «다른 픽셀 0개») ·
섹션 합치기(⌘M) 후 생존 · undo/redo · 히스토리 폭주 방지 · 입력 방어(NaN·극단값·갭·섹션).
상세: `feat/block-overlap` 의 `QA-block-overlap.md`.

시안: https://claude.ai/code/artifact/2cfa443e-8fbc-4bf4-ad59-627a5f9be3fe

---

## [그리드 줄 타이포] 후속 티켓 — `feat/grid-line-typo` 에서 «의도적으로» 남긴 것

> 2026-09-09. 본 작업은 커밋 A(패널·선택·배선) / B(§7-ⓐ 역할 기본색) 로 갈라 놨다.
> 아래는 적대 검수가 잡았지만 «이 단위의 발주 밖»이라 뺀 것들. ⛔「나중에」가 아니라 «티켓»이다.

### C — 중첩 duo 줄의 색 전파가 «무검사»
- D 픽스처에 `type:'duo'` 줄이 **0건**이라, `renderGridBlock` 이 중첩 재귀에
  `useRoleColor` 를 물려 주는 그 경로를 «아무도 안 잰다».
- 중첩 줄은 `addr=null` + `useRoleColor=true` 라는 **새 조합**이다(§7-ⓐ 이전엔 없던 조합).
- ⇒ 픽스처에 중첩 duo 를 넣고 「중첩 안쪽 줄도 역할색을 받는가 / innercard 안의 중첩은 안 받는가」를 갈라 재라.
- 관련: `js/blocks/grid-block.js` 의 addr 주석에 이미 «옆에 대비»를 세워 뒀다(사실이던 문장은 안 지웠다).

### F1 — `_GRD_TYPO_FIELDS` 명부와 범위가드가 «무검사»
- `prop-grid.js` 의 `_GRD_TYPO_FIELDS`(8개)에서 하나를 지워도 전부 초록.
  ⇒ 「↺ 역할로」가 그 필드를 **안 지우고 남긴다**(사용자는 되돌렸다고 믿는데 값이 남는다).
- `_gridLineHtml` 의 `lineHeight`(0<n≤10) · `letterSpacing`(|n|≤100) 범위가드를 지워도 초록.
- ⇒ 「명부 × 렌더러가 실제로 읽는 필드」를 대조하는 검사 + 범위 밖 값의 음성대조.

### F2 — 편집 마커가 «비교 키»와 «스코프 없는 CSS» 로 새는 자리 (★bn2 가 원래부터)
- `js/market-merge.js:9` · `js/version-diff.js:31` 의 `_RUNTIME_CLS` 에
  `bn2-line-selected` · `grd-line-selected` 가 **없다** ⇒ 줄을 선택한 것만으로
  섹션 정규화 문자열이 달라져 협업 머지·버전 비교에서 **「변경됨」 오탐**이 난다.
  (같은 병: `feedback_watch_diff_by_exact_string` — 변화를 문자열 완전일치로 재면 점검자가 오탐을 만든다)
- `.bn2-line-selected` 의 CSS 는 `.banner02-block .bn2-line-selected` 로 **스코프가 없다**.
  그래서 `prop-mockup.js` · `save-load.js` 썸네일처럼 클론을 `document.body` 로 내보내 찍는
  경로에서 **PNG 에 실제로 그려질 수 있다**. (`.grd-line-selected` 는 `#canvas` 스코프라 안전)
- ⇒ 처방 둘 중 하나: ⑴ `_RUNTIME_CLS` 를 `tests/_export-channels.js` 의 `MARKER_TOKENS` 와
  같은 곳에서 받게 하거나 ⑵ bn2 CSS 에 `#canvas` 스코프를 붙인다.
- 명부(`tests/_export-channels.js`)에 `kind:'compare'` 로 **이미 적어 뒀다** — 숨기지 않았다.
