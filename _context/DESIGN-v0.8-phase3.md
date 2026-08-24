# DESIGN — GODITOR v0.8 Phase 3 (L) 재플랜 (fable)

- 작성: 태양(fable) 2026-08-24 · base dev · worktree `/Users/a1/web-editor-taeyang-v08` · 브랜치 `feature/v0.8-improvements` · ⛔머지·배포 현빈 게이트
- 전제: Phase 1(QA통과)·Phase 2(#4 재검 통과 시 9유닛 완료) 이후 착수. **Phase 3 = #5-b(테이블 rowspan 병합)·#6-b(스티커 리치텍스트)** — 둘 다 «데이터 무결성» 위험이 큰 L 유닛.
- ★지디 지시(현빈): **둘 다 데이터손실 위험이 크다 → 아래 «게이트 규율»을 반드시 지킨다.**

## 0. ★게이트 규율 (Phase 3 절대 조건)
1. **각 유닛 착수 전 지디 게이트**: 유닛별 상세 서브브리프(변경 파일·저장모델·마이그레이션·재직렬화 경로·롤백)를 지디에 올려 «착수 승인» 받은 뒤에만 구현.
2. **P0급 데이터손실 시나리오 고QA**: 각 유닛은 «저장→로드→export(PNG/HTML)→figma→.gdt 왕복→기존 저장본 하위호환»의 **전 경로 무손실**을 고디터QA가 실증해야 통과.
3. **무손실 실증 안 되면 그 유닛 «멈춘다»**: 하나라도 손실/깨짐이 재현되면 그 유닛은 커밋하지 않고 상신(부분 구현 금지). #5-b·#6-b는 독립이라 한쪽이 멈춰도 다른쪽 진행 가능.
4. dev 미머지·라이브 무접촉 유지. 부분 완성으로 «완료» 표기 금지.

## 1. 실측 (2026-08-24, 설계 근거)
- **#5-b**: `js/props/prop-table.js`에 **colspan(헤더 병합)·`mergedHeaderCols` dataset**만 존재(:28~600). **rowspan·바디셀 병합 코드 전무**. `js/io/export-html.js`·`export-figma-json.js`·`main/gdt/export.js` 모두 **rowspan 인지 0**. 셀 «선택» 모델도 없음(#5a·#6a 실측: dblclick contenteditable 편집뿐).
- **#6-b**: `js/blocks/sticker-block.js` — 스티커 텍스트 = **`dataset.text` 평문**(:100), 커밋/재렌더가 `block.innerHTML = <span>${safeText}</span>`(:144)로 «평문만» 보존. `<b>`/`<span style>` 부분서식은 재렌더 시 소실. 저장모델을 리치텍스트로 바꾸지 않는 한 부분서식 불가.

## 2. #5-b 테이블 바디셀 rowspan 병합 (설계안)
### 2-1 필요 신규
- **셀 선택 모델**: 현재 없음. `td/th`에 `.cell-selected` + 드래그 사각 선택(anchor~focus 셀 범위) 또는 shift-click. `prop-table` 또는 별도 `table-cell-select.js`.
- **병합 실행**: 선택 사각형(연속 셀 블록)을 `rowspan`/`colspan`으로 «좌상 셀에 병합, 나머지 셀 DOM 제거». 사각형 아닌 선택(L자 등)은 거부.
- **rowspan 정규화**: 병합/해제 후 각 tr의 논리 열 수 정합(colspan+rowspan 고려). `prop-table`의 logical colCount 계산(:213~)을 rowspan까지 확장.
- **prop-table 로직 정합**: rowH(행 높이)·셀 색칠(#6a)·선 긋기가 병합셀에서 오정렬 안 되게(병합셀은 여러 tr 걸침 → 높이 합산·색 범위).
### 2-2 ★재직렬화 (P0 위험)
- **저장/로드**: 테이블은 라이브 DOM innerHTML 직렬화(#5a 확인) → `rowspan`/`colspan` 속성이 그대로 왕복. `serializeCleanRoot`가 span 속성 보존하는지 확인 필수.
- **export-html**: 병합셀 HTML 그대로 나가는지(포터블화가 rowspan 안 깨는지).
- **export-figma-json**: ★figma는 rowspan 개념이 다름 → 병합셀을 어떻게 매핑? (셀 병합→단일 프레임 or 미지원 경고). **재인라인 시 셀 밀림/유실 방지가 핵심 난점.**
- **.gdt 왕복**: rowspan 속성이 project.json에 그대로(에셋 아님) → 왕복 무손실(단 export/figma 경유는 별개).
### 2-3 P0 시나리오 (고QA)
병합 테이블 만들기 → ⓐ저장→로드 병합구조·셀내용 무손실 ⓑPNG export 시각 정합 ⓒHTML export 병합 유지 ⓓfigma export 셀 밀림 0(or 미지원 명시) ⓔ.gdt 왕복 무손실 ⓕ병합→해제→재편집 무손실 ⓖ기존(병합없는) 테이블 회귀 0.
### 2-5 셀병합 텍스트 정책 (지디 확정 2026-08-24)
- **기본 = «무손실 join»**(병합 셀들의 비어있지 않은 텍스트를 행/열 순서로 이어붙임). 손실 없는 게 안전 기본값. 고QA P0 통과.
- 엑셀식 «좌상 셀만 유지»(나머지 파괴)는 **옵션 여지로만 문서화**(기본 아님). 현빈이 원하면 후속 1줄 전환(mergeSelectedCells의 texts 수집을 좌상만으로).

### 2-4 롤백
셀 선택·병합은 신규 파일 위주 → 유닛 커밋 revert. 기존 colspan 헤더 인프라 무접촉.

## 3. #6-b 스티커 리치텍스트 (설계안)
### 3-1 저장모델 변경
- 현재 `dataset.text`(평문) → **리치텍스트 보존**: `dataset.textHtml`(sanitize된 innerHTML, `<b>/<i>/<span style=color/...>`만 허용) 신설, 렌더가 `textHtml` 있으면 그걸, 없으면 `dataset.text`(하위호환).
- 편집 커밋 시 `sticker-text` contenteditable innerHTML → sanitize(#4 교훈: 화이트리스트 태그·속성만) → `dataset.textHtml`.
### 3-2 ★하위호환·마이그레이션 (P0 위험)
- **기존 저장본**: `dataset.text`만 있는 옛 스티커 → 로드 시 그대로 평문 렌더(textHtml 없으면 text). **마이그레이션 강제 안 함**(옛 저장본 안 깨지게).
- **sanitize**: 리치텍스트라 XSS 표면 → `<script>/on*/javascript:` 제거 + 허용 태그/속성 화이트리스트(색·볼드·이탤릭·밑줄만). #4와 같은 클래스.
### 3-3 P0 시나리오 (고QA)
리치 스티커(부분 볼드·색) → ⓐ저장→로드 서식 유지 ⓑ.gdt 왕복 유지 ⓒexport(PNG/HTML) 서식 반영 ⓓ**기존 평문 스티커 로드 회귀 0**(textHtml 없는 옛 저장본) ⓔXSS 페이로드 삽입→sanitize로 무해 ⓕ서식 지우기→평문 복귀.
### 3-4 롤백
`dataset.textHtml` 미사용(text 폴백)이 기본이라, 유닛 revert 시 옛 스티커 그대로. 회귀 위험 = «textHtml 렌더 경로가 평문 경로를 안 깨뜨리는가»에 집중.

## 4. 실행 순서
- #5-b·#6-b **독립**(파일: prop-table/table-cell-select vs sticker-block). 각자 «착수 전 지디 게이트 → 구현 → P0 고QA → 통과 시 커밋». 병렬 가능하나 각 게이트 별도.
- 권고: **#6-b 먼저**(저장모델+하위호환·sanitize로 위험이 «국소적») → #5-b(재직렬화·figma 매핑이 넓게 퍼짐). 단 순서는 지디 재량.
- 하나라도 P0 무손실 실증 실패 → 그 유닛 멈춤·상신, 다른 유닛만 진행.

## 5. 완료 정의
- 유닛: 착수 전 게이트 통과 + 코드 + 1차 격리 CDP QA + **P0 데이터손실 고QA 무손실 실증** + 디자인 일관성 + 트래킹. 전체: 현빈 사후검수·배포 게이트. ⛔머지 금지.

## 6. #14b — 회전 확장(표·그래프 제외 전 블록) · ★착수 대기(현빈 최종 GO)
원 16건 밖의 «신규 확장». 지디 «기술 승인»(2026-08-24)·구현 착수는 현빈 «표·그래프 빼고 전부 회전» 최종 GO를 지디 경유 받은 뒤. 그전엔 문서·트래킹만.
### 6-1 설계 요지
- (a) 각도 저장 통일: 신규 대상(텍스트·iconify·mockup·canvas·vector·icon-circle 등)에 **dataset.rotation 신규 부여**(asset 규약 재사용). 기존 3규약(asset=rotation·shape=shapeRotation·frame=rotateDeg) 무접촉. asset-rotate.js `_restoreRotation`이 신규 타입 자동 복원(save-load 추가 불요). `_ROTATE_HANDLERS`에 신규 타입 add/remove 핫존 등록(자유배치=자식 핫존 / overflow:hidden=오버레이 트랙, U14 2트랙). prop 각도필드=공유 회전 헬퍼를 각 prop-*.js.
- (b) 회전후 리사이즈 좌표보정: `_cornerScreen`·`_unrotateDelta` 범용 재사용(회전0=픽셀동일).
- (c) 자유배치/편집 충돌: 텍스트 편집 중 회전 핫존 숨김·회전+정렬(#13/#10 align-self)+transform 조합. 컴포넌트=절대배치 회전 or 오버레이 트랙.
### 6-2 ★착수 시 게이트 조건 (지디 확정 — 통과 못하면 그 타입 멈춤·상신)
1. 기존 asset/shape/frame 회전·리사이즈·편집 **회귀0**(registry 확장이 기존 2타입 동작 불변 실증).
2. 신규 dataset.rotation **저장 왕복**(디스크 재조회로 각도 생존).
3. **회전0 = 픽셀동일**(신규 타입 전부).
4. ★텍스트: 회전 + 정렬(#13/#10) + 편집 캐럿 조합 «안 깨짐» 집중검증(가장 까다로운 지점).
