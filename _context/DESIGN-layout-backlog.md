# DESIGN — 레이아웃 백로그 일괄 구현 (feature/layout-backlog)

> 2026-07-03 태양. 발주=제니(세션 개시), 소스=노션 백로그 DB(392111a5…, 35건) + engine/layout_backlog.md + LAYOUT_PALETTE.md.
> 기점 dev 1661b45. worktree /Users/a1/web-editor-taeyang-bl. 머지 금지(현빈 승인).

## 0. 정찰 총평 — 백로그 재분류의 핵심 사실 4가지

1. **add/update API는 이미 다 있다.** step·comparison·banner02·mockup·card(canvas)·chat·iconify·laurel·label-group·icon-text·speech-bubble·icon-circle 전부 `window.add*`/`window.update*` + MCP 툴 존재(mcp-server.js 등록 완비). 워커들이 "없다"고 한 것(BL-010/011/012/014/015, PALETTE '도구불가')의 실체 = **미문서화 + 미검증**. → 구현이 아니라 **검증+조립 가이드 문서**가 정답.
2. **GIF 파이프라인은 end-to-end 생존.** 삽입(setAssetImageFromSrc=img 그대로)→외부화(.gif 바이트 보존)→goya-asset 서빙(image/gif)→HTML export(재인라인, 애니 유지) 전부 무재인코딩. 모션 지원(BL-BOL-01/016/CD-09)은 **워커가 원본 GIF를 넣으면 이미 동작** + 얇은 UX(배지/토글)만 추가.
3. **padX 디폴트는 0이 아니라 32.** 변경=신규생성 리터럴 32→72(4곳). 하위호환 급소=save-load.js:442 Object.assign 머지(구 proj에 padX 키 없으면 새 디폴트 상속) → globals.js는 32 유지+백필로 차단.
4. **churn(BL-CDD-08)의 실체**: 탭복원이 activeProjectId를 쓰는 게 아니라, **initLoad(async·수초)가 await 도중 바뀐 activeProjectId를 라이브로 읽어 OLD DOM을 NEW proj로 apply/save**. 모든 저장 경로가 '저장 시점' id 바인딩인 것이 부패 벡터.

## 1. 구현 단위 (11 유닛 + 문서) — 백로그 35건 전량 매핑

| 유닛 | 백로그 | 방식 | 규모 |
|---|---|---|---|
| U1 padX72 디폴트 | BL-JEN-01, BL-PAD, (BL-BOL-06 완화) | tab-system.js:337,344 + projects.html:319,326,486 리터럴 72 + padXExcludesAsset 명시. globals.js 32 유지(레거시 폴백) + applyProjectData에 padX undefined 백필(32) | S |
| U2 조립 API 검증+문서 | BL-010/011/012/014/015, PALETTE 도구불가 5종 | 전 add*/update* CDP 스모크(격리 인스턴스) → `docs/CDP_ASSEMBLY_API.md`(시그니처·옵션·예제·함정). goditor-api.js 래퍼 누락 전달(table headers/rows 등) 보강 | M |
| U3 테이블 확장 | BL-013, BL-CDZ-04, BL-CDD-05, BL-BOL-06 | addTableBlock에 rows/cols 수치 옵션(+기존 headers/rows 데이터 주입 문서화), textColor 옵션 + **다크섹션 테마어웨어 기본색**(생성 시 섹션 bg 휘도 판정→밝은 텍스트), highlightCol(특정열 하이라이트: colored 인프라 재사용 dataset.highlightCol+bg/fg) | M |
| U4 2컬럼 프리미티브 | BL-CDD-02 | 신규 `duo-block`(data-type=duo) — ★2026-09-05 `grid-block`/data-type=grid 로 개명(PLAN-grid-rename.md): 좌/우 2슬롯(비율 옵션 50:50/40:60/30:70), 슬롯=텍스트 스택(JSON 모델: 각 슬롯 lines[{type,text,fontSize,color,…}]). NewGrid류 자유중첩 아님(봉인 사유 회피) — step/chat처럼 **dataset 모델+render 재생성형** 콤포짓. 3컬럼은 cols:3 확장 | L |
| U5 신규블록 A | BL-CD-01(카운트업), BL-CDZ-02(가격카드), BL-CDZ-03(리뷰카드) | step-block 패턴(dataset+render+props+add/update+체크리스트 15접점). 카운트업=IntersectionObserver 애니(에디터=최종값 정적, export HTML=JS 스니펫 포함 옵션), 가격카드=기존가/할인가/할인율/적립 슬롯, 리뷰카드=★N+마스킹ID+본문 | L |
| U6 그리드류 | BL-CDZ-05, BL-BOL-02, BL-014(아이콘그리드), BL-CDZ-07(가격그리드), BL-CDZ-08(리스트카드) | 아이콘그리드=신규 `icon-grid` 블록(N열, 셀=iconify아이콘/이미지+타이틀+캡션, dataset 모델). 가격그리드·리스트카드=canvas-block(simple card) 확장으로 흡수 가능성 우선 검토(gridCols/Rows 4×4 이미 존재) → 부족분만 신규 | L |
| U7 컨테이너/데코 | BL-CDD-06(페이스라인), BL-CDD-07(bordered-card), BL-019(흰 인너카드), BL-CD-10(pill 뱃지), BL-CDZ-06(말풍선쌍) | ①divider 확장: data-line-style에 tick-rail(+marker 위치/색) 변형 ②frame-block에 border/radius/accent-bar(좌측바) 옵션+API ③BL-CD-10=export-html에 lg 버튼 CSS 추가+클론에서 `.label-item-delete-btn/.label-group-add-btn/.item-selected` 제거(export-image 포함) ④말풍선쌍=chat-block(align left/right 이미 지원) 조립 가이드로 해소+스타일 프리셋 | M |
| U8 텍스트 옵션 | BL-CDD-03(fontFamily), BL-CDD-04(스트로크) | applyTextOpts에 fontFamily·fontWeight·stroke({width,color}=-webkit-text-stroke+paint-order, 스티커 패턴 이식) 옵션. 3역할은 문서 컨벤션(display/body/mono 권장 스택 명시), 토큰 신설 안 함(오버엔지니어링 회피) | S |
| U9 그래프 프리셋 | BL-BOL-03 | line에 smooth(curve path) 옵션=temp-curve 재현, bar 비교=2시리즈 `bar-vs` chartType(items=[{label,a,b}]+시리즈 색 2개). 비주얼 프리셋 2종(css) | M |
| U10 모션/GIF | BL-BOL-01, BL-016, BL-CD-09 | data-motion 자동감지(setAssetImageFromSrc gif 스니핑)+에디터 재생배지(css ::after)+prop-asset 모션 행(정지/재생 토글, 포스터=decodeGifFrames 1프레임). assets-panel.js:435 확장자 오표기 수정. 워커 가이드(원본 GIF 직삽입) 문서 | S |
| U11 churn 픽스 | BL-CDD-08 | ⓐinitLoad 진입 시 bootProjectId 캡처, 각 await 후+applyAndFinish 전 불일치 ABORT ⓑ자동저장 편집시점 바인딩: MutationObserver 관측 시점 id 스탬프→getSaveKey/saveProjectToFile(opts.projectId)로 전달, flushSave도 await 전 캡처 ⓒsetter에 세대 카운터 | M |
| 문서 | BL-001(기술노트) | CDP_ASSEMBLY_API.md에 포트분리 절차 §로 흡수 | — |

**비구현(태양 범위 밖) → 노션 상태 '보류' + 사유 코멘트**: BL-BOL-04(원본 화질), BL-BOL-05(로제 이미지 발주), BL-017(워커 2차 정밀화), BL-018(워커 정독), BL-CDD-08 워크어라운드 부분은 U11로 근본 해소.

## 2. 구현 순서 (레버리지·리스크 순)

1. **U1**(S, 빠른 승리·전 워커 즉효) → 2. **U11**(무결성, CDP 워커 전원 해저드) → 3. **U2**(문서=2차패스 최대 언블록) → 4. **U3** → 5. **U8** → 6. **U10** → 7. **U7** → 8. **U9** → 9. **U5** → 10. **U6** → 11. **U4**(최대 규모, 마지막)

각 유닛 = 독립 커밋(기능단위), Planner→Generator→Evaluator + 필요시 코덱스 + **디자인 일관성 검수**(새 UI: prop 공용클래스·토큰 재사용, 스샷 대조).

## 3. 리스크 / 롤백 / 테스트

- **하위호환**: 모든 신규 블록/옵션은 additive(기존 직렬화 HTML 무변경). U1은 신규 proj만(레거시 백필 32). U11은 저장 경로 수정이라 최고위험 → 더미로 (a)정상 로드/저장 (b)로드 중 프로젝트 전환 (c)디바운스 중 전환 매트릭스 검증.
- **롤백**: 유닛=독립 커밋 → 개별 revert 가능.
- **테스트**: 격리 인스턴스(포트 9362, --user-data-dir=/tmp/goditor_9362, BL-001 절차) + 더미 proj만. 라이브 9334·렌즈·실proj 미접촉. 각 블록 라운드트립(저장→재로드 재렌더)+복붙+레이어패널+export HTML.
- **신규 블록 15접점 체크리스트**(정찰① §6) 각 블록마다 준수 — 누락=선택/복붙/직렬화 회귀 원인.

## 4. 산출물

- feature/layout-backlog 커밋들(유닛별) + docs/CDP_ASSEMBLY_API.md + 본 DESIGN
- 노션 백로그 상태 갱신(구현완료/보류) + 종합 보고 1회(srv-제니)
