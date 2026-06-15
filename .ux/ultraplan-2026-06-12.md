# GODITOR ux-squad ULTRA-PLAN — 2026-06-12 (무결손 커버리지 설계)

**기준선**: HEAD `eb8c390` (= 첫 RUN report-2026-06-12.md 직후 design-squad 슬라이더 표준화 커밋 포함). 이 플랜은 감사 실행이 아니라 **다음 RUN의 차원×영역 커버리지 맵 + U-craft 첫 투입 설계**다.
**바(bar)**: Adobe/Figma급 프로. 모든 craft 판정은 "이 정제도로 Figma에서 출하될까?" 기준 — craft-rubric.md 레퍼런스 코퍼스(Figma 1순위·Linear·Vercel/Stripe·Adobe) 대비.
**전제 변화 vs 첫 RUN**: ① **U-craft 신규 차원 첫 투입**(7→7+1, active_dimensions에 craft 추가 제안). ② 첫 RUN이 명시 보고한 구멍(U-feedback 9영역 skip, U-onboarding partial 2, license.html admin 미진입, 누락 플로우 4종)을 이번에 보장. ③ G5 pm-panel은 계속 보류(독자 스타일=의도 예외) — **단 U-craft도 pm-panel 미감은 제외**(예외 일관 적용).

---

## 1. U-craft 첫 투입 계획 (신규 미감 렌즈)

### 1-0. ⚠️ 기준선 정합 가드 (HEAD에서 재측정 — 첫 RUN 코드 아님)
`eb8c390`는 "슬라이더행 표준화 + cv-chip/prop-slider focus-visible 보강" 커밋이다. 즉 **design-squad가 craft의 *기계적* 부분(bare range→.prop-slider 7곳, raw danger→토큰 4곳, focus-visible 추가)을 이미 닫았다.** U-craft는 그 위에서 **종합 미감 판정**에만 집중한다(craft-rubric §4 conformance 교차 규율). 중복 금지:
- `.prop-slider`의 `::-moz-range-thumb` 부재 → **finding 금지**. 앱은 Electron(Chromium-only)이라 Firefox 경로 비도달 → false positive. (PM패널 `.cpmt-opacity-slider`에만 moz 존재하는 것도 무관.)
- raw hex/토큰 이탈의 *기계적* 열거 → design-squad 소관. U-craft는 design 결과 참조(xref)하고 "군집이 아마추어 인상을 만드나"만 종합.

### 1-1. 1순위 타겟 — 현빈이 '촌스럽다'한 버튼류 (군집 major 후보)
craft-rubric §4: 개별 craft 이탈 = minor/nit, **한 컴포넌트에 루브릭 위반 3+ 또는 tells 3+ 군집 시에만 '아마추어 인상' major 1건 종합**. 아래는 군집 후보 — 실측 시 군집 성립 여부를 먼저 검증.

| 타겟 | 위치 | 관찰된 tells (실측 대상) | 루브릭 | 군집 가설 |
|---|---|---|---|---|
| **stb-del-btn** (step 삭제) | `js/props/prop-step.js:18` 인라인 | `style="padding:3px 6px;line-height:0"` 인라인 핵 · 비배수 패딩 · `.st-btn` radius 2px vs `.prop-btn` 4px 불일치 | C1·C4 + tell(line-height:0, 인라인 매직넘버) | **major 후보** (인라인 핵 + 패딩 비리듬 + radius 충돌 = 3+) |
| **.st-btn** (섹션 툴바) | `css/editor-layout.css:42-61` | height 18px·padding 0 6px·radius 2px, hover가 bg=border+color만(약한 폴리시), color `#999` 하드코딩 | C2·C3·C5 | 군집 검증 대상 |
| **.prop-chain-btn** (종횡비 link) | `css/editor-props.css:113-124` | hover `#888` 하드코딩 토큰밖 · active bg `rgba(45,111,232,0.12)` 18% 거의 안 보임(C5 약한 active) · 22px에 12px 아이콘(54%) 광학 | C3·C5·C2 | 군집 검증 대상 |
| **.cv-chip** (컬러변수 칩) | `css/editor-props.css:428-458` | padding `0 7px 0 5px` 비대칭(dot 보정 핵) · active 18% tint 약함 · **aria-pressed 시각훅 부재**(아래 §3 escape) | C1·C2 + escape 경계 | escape 역분류와 연동 |
| **슬라이더행 잔여** | `.prop-slider` vs `.ds-slider-row` | track 3px/thumb 12px(prop) vs `accent-color` 네이티브(ds) — **두 슬라이더 시스템 공존**. eb8c390가 range *채택*은 표준화했으나 prop/ds 두 *스타일 체계*는 잔존 | C1·C5 | medium(체계 이원 — 종합 미감) |

> 스폰: **U-craft 에이전트 1개**가 위 5타겟 + 전 크롬 표면을 스크린샷 기반으로 스윕. 군집 성립 타겟만 major 종합, 나머지 개별은 minor로 접어 보고(노이즈 캡: craft도 judgment → **차원당 10건**, 초과분 테마 그룹핑).

### 1-2. U-craft 전 영역 craft 스윕 매트릭스 (군집 스캔)
13영역 중 pm-panel(G5) 제외 12영역. 각 영역에서 tells 3종 빠른 스캔(브라우저 기본컨트롤·radius 3종+·hover 전무·인라인 매직넘버·아이콘 크기 혼재):
- **집중 후보**(첫 RUN 발견 밀집과 교차): toolbar(아이콘 단독버튼 광학 C1·Export 메뉴 위계 C6), prop-panel(46빌더 간 슬라이더/버튼행 정제 일관 C2·C4), canvas-block(선택 핸들·인라인 컨트롤 폴리시 C5·C7), template-browser(카드 정제도 C7).
- **저밀도 예상**(clean 검증 위주): graph, pickers(첫 RUN states 모범), design-system, toast, left-panel, modals, home-pages, assets-ai — 각 "검사 K항목 통과" 결산 의무(침묵 금지).

---

## 2. 영역/플로우 재분해 (지난 RUN 얇게 본 곳 + 누락 플로우)

### 2-1. 차원별 얇음 → 이번 보장
| 차원 | 첫 RUN 구멍 (results 실측) | 이번 보장 |
|---|---|---|
| **U-feedback** | 13영역 중 **9개 skip**("대표 액션 4종 미포함"): left-panel·modals·template-browser·design-system·pickers·graph·home-pages 전부 미실측 | 대표 액션을 4→**핵심작업 6경로**로 확장(템플릿 삽입·재배치·재배치 undo 피드백 포함). 저가중 영역은 "1회 대표 액션 실측 or 정직 skip 사유" 둘 중 하나 — 무언 skip 금지 |
| **U-onboarding** | prop-panel·template-browser **partial** · **license.html admin 미진입**(첫 RUN이 "다음 사이클 1순위 구멍" 자가 선언) | license.html 외부 사용자 첫 관문 정식 진입(새 flow 필요 — §2-2). prop/template partial→full |
| **U-flow** | 4플로우만 주행. **드래그·다중선택·undo/redo·섹션 재배치(드래그)** 전용 플로우 부재 | §2-2 신규 플로우 4종 추가 |
| **U-layout** | pm-panel·pickers skip(정당), 나머지 findings — 깊이 OK | U-craft와 경계 분리만 재확인(배치 논리 vs 미감) |
| **U-semantics** | method=**static**(유일) — CDP 미사용. 동적 레이블 일부 정적 추정 | 동적 생성 레이블(block-factory·props/*) 일부 CDP 실렌더 표본 검증으로 승격 |

### 2-2. 누락 플로우 신규 명세 (PROFILE 갱신 — flows/ 추가 제안)
첫 RUN의 `section-rearrange.md`는 "이동/복제/삭제 + Undo 복원"만 — **드래그 재배치·다중선택·undo/redo 자체**가 흐름 명세에 없다. 신규 4종:
1. **`flows/section-drag-reorder.md`** (core_task 3 분기) — 레이어/캔버스 드래그로 순서 변경. 첫 RUN ERR-J1/flow-001이 "드래그 은닉" 지적했으나 *흐름으로* 주행 안 함. ★드래그 *발견가능성*은 ux, *버벅임*은 qa(경계 명시).
2. **`flows/multi-select.md`** (신규) — 다중 블록/섹션 선택 → 일괄 이동/삭제. 선택 모델 자체가 첫 RUN 미커버. silent no-op 협소 경로(block-factory.js:402, 첫 RUN suspected/minor)가 여기 닿음.
3. **`flows/undo-redo.md`** (core_task 보조) — Cmd+Z/Cmd+Shift+Z 연속 + **버튼 UI 부재**(ERR-J1: `#undo-btn` 데드코드) 체감 검증을 흐름으로. 첫 RUN은 단건 발견, 이번엔 연속 복구 흐름.
4. **`flows/license-onboard.md`** (core_task 0 분기) — 외부 사용자 license.html admin 첫 관문. 첫 RUN "1순위 구멍" 정식 진입.

> 게이트: 신규 flow 명세는 PROFILE 갱신 = **사용자(현빈) 승인 게이트**. 이 플랜은 명세 *제안*까지, 작성·승인은 RUN 전 단계.

---

## 3. escape 역분류 (격자 밖 발견 → 차원/왜놓침/이번보장)

| escape 항목 | 어느 차원 | 왜 첫 RUN이 놓쳤나 | 이번 보장 |
|---|---|---|---|
| **cv-chips aria-pressed 시각훅 부재** | **U-craft + U-feedback 경계** (states 폴리시) | aria-pressed 속성은 있으나 `[aria-pressed="true"]` CSS 없음 → `.active` 클래스 의존. design-squad는 토큰만, U-feedback 첫 RUN은 prop-panel을 "대표 액션 미포함"으로 안 봄 → 격자 사각 | U-craft가 C5(상태 폴리시) + C2(active 18% tint 약함)로, U-feedback이 "선택 상태 가시성"으로 **양 차원 동시 관찰**(root_cause: chip-active-signal). 단 중복이면 1건 머지 |
| **숨은 진입로** (섹션 액션·undo가 키보드/더블클릭/드래그 전용 — hidden-affordances 클러스터) | **U-flow(발견가능성) + U-onboarding** | 첫 RUN은 발견했으나(flow-001/002·UXO-J02) *흐름으로* 안 밟음(전용 flow 부재) | §2-2 신규 flow 3종이 진입로 *가시성*을 흐름 단위로 재검 |
| **슬라이더행 비일관** (.prop-slider vs .ds-slider-row 이원 + 빌더별 행 레이아웃) | **U-craft(C1·C5 미감) + design(토큰)** | eb8c390가 range *채택*만 표준화, *스타일 체계* 이원은 잔존. design-squad는 토큰 차원, 미감 종합은 무주체였음 | U-craft가 "두 슬라이더 시스템 = 미감 분열" 종합 + design 결과 xref(중복 회피) |

---

## 4. 하네스 분해 (스폰 + ⚠️ CDP 직렬구간)

**핵심 제약**(첫 RUN 프로세스 메모): CDP는 단일 Electron 창 1개 공유 → 6에이전트 페이지 전환 간섭·앱 2회 재기동 발생. **개선책 = 실주행은 직렬, 정적/스샷판단은 병렬.**

### 스폰 분해 (차원별 에이전트)
```
[정적/스샷 판단 — 병렬 가능 그룹 P] (단일창 점유 안 함 or 스샷 1회만)
  ├ U-semantics : 정적 레이블 인벤토리(+동적 표본만 CDP) — 대부분 static
  ├ U-layout    : 스크린샷 + DOM 구조 추출 (스샷 캡처 후 정적 판단)
  └ U-craft 🆕  : 스크린샷 기반 craft 루브릭 대조 (§1 — 5타겟 군집 + 12영역 스윕)
                  ※ craft는 "한 상태 스샷"이면 충분 → 실주행 직렬구간에 끼지 않음

[실주행 — 직렬 필수 그룹 S] (CDP 단일창 순차 점유 — 페이지 전환·상태변이 동반)
  ① U-flow      : flows/*.md 9종(기존4 + 신규4 + first-section) 순차 주행
  ② U-feedback  : 핵심작업 6경로 액션→피드백 ms 실측 (창 상태 변이)
  ③ U-error     : 파괴 액션 보호 전수 + 복구 경로 열거 (삭제 실행 동반 → 직렬)
  ④ U-onboarding: 빈 프로젝트 first-section + license-onboard 첫 주행 (창 초기화 필요)
  → 순서: ④(빈상태 먼저) → ① → ② → ③(파괴는 마지막, 상태 오염 후속 영향)
```
- **병렬 그룹 P**(semantics·layout·craft)는 단일 메시지 동시 스폰(run_in_background). craft는 P가 캡처한 스샷 재사용 가능(중복 캡처 회피).
- **직렬 그룹 S**는 1개씩 — 앞 에이전트 완료(창 반환) 후 다음. 오염 배치는 각자 재측정.
- **2층 검증**: conformance{blocker·major} + judgment{impact=high} + **craft{major 군집}** 적대적 반증. 작성자 본인 자기후보 닫기 금지. craft 반증 3축 = ① 루브릭 오적용 아닌가(취향 아닌가) ② 의도된 예외(MVP숨김·PM패널·다크크롬) ③ design 중복 아닌가.
- **그리드 레드팀**: U-craft 신규 투입 사이클이므로 "craft 격자가 구조적으로 못 잡는 미감 문제 5종" 1회 의무 투입.

### G5 pm-panel 보류 처리 (전 차원 일관)
- U-semantics/U-feedback: 첫 RUN대로 `deferred`/`skip(G5)` 유지.
- **U-craft 신규**: pm-panel 독자 스타일(.cpm-* Claude-blue)은 **의도 예외 → craft 감사 제외**(Observe 단계 즉시 제외). 단 "PM 패널 *내부* 레이블/피드백"은 정상(모듈 명세대로) — 미감 *구분 의도*만 예외.

---

## 5. 산출물 체크 + 정리 승계
- 신규 flows 4종 명세는 PROFILE 갱신 게이트(현빈 승인) 후 RUN 입력.
- 첫 RUN "정리 대기" 승계: 테스트 프로젝트 proj_1781188552759/proj_1775644888754 잔존 블록, ~/Downloads 부산물, edit-block 뎁스 3→4 명세 갱신 — RUN 전 정리 권고.
- active_dimensions에 `craft` 추가 = profile.md frontmatter 변경(승인 게이트).

---

## 최종 요약 (6~8줄)
1. **U-craft 1순위 타겟**: stb-del-btn(인라인 `line-height:0`+비배수 패딩+radius충돌 = **major 군집 후보**), .prop-chain-btn(#888 하드코딩+active 18% 약함), .st-btn(약한 hover 폴리시), cv-chip(비대칭 패딩+aria-pressed 시각훅 부재), 슬라이더행 이원(.prop-slider vs .ds-slider-row). 군집 3+만 '아마추어 인상' major 종합.
2. **U-craft 기준선 가드**: eb8c390가 슬라이더 *채택*·focus-visible은 이미 표준화 → 기계적 부분은 design 소관, U-craft는 종합 미감만. `::-moz-range-thumb` 부재는 Electron(Chromium-only)이라 **finding 금지**(false positive).
3. **누락 플로우 4종 신규**: section-drag-reorder · multi-select · undo-redo · license-onboard. 첫 RUN이 발견은 했으나 *흐름으로* 안 밟은 hidden-affordances와 미진입 license.html admin 관문을 흐름 단위로 보장.
4. **얇음 보장**: U-feedback 9영역 skip→핵심작업 6경로로 확장, U-onboarding partial 2종→full, U-semantics static→동적 레이블 표본 CDP 승격.
5. **escape 역분류 3건**: cv-chips aria-pressed(craft+feedback 경계, root_cause=chip-active-signal) · 숨은 진입로(flow+onboarding, 신규 flow가 재검) · 슬라이더 이원(craft+design xref).
6. **스폰 분해**: 병렬 P(semantics·layout·**craft**=스샷 1회) // 직렬 S(onboarding→flow→feedback→error, 단일 Electron 창 순차 점유, 파괴 액션 마지막). craft는 P 스샷 재사용으로 직렬구간 회피. pm-panel은 craft 포함 전 차원 G5 보류 일관.
