# Section Memo Processing Issue Log

## [2026-06-09] sec_rzu35th (Section 02)
- 메모: 폰트 스타일 지정이 안되는 문제
- 시도: 섹션 내 banner02 블록(bn2_qyx4sam) 확인. data-lines 배열에 kind/text/size/color/gapTop만 존재하고 fontFamily/fontWeight 필드 없음. 폰트 스타일 지정 불가 원인 = banner02 가변 lines 스키마 미지원.
- 결과: [차후처리] CDP 직접 패치 대신 wa5yfvi8n 워크플로우(banner02 폰트 가변 lines 추가) 의존. 직접 dataset만 손대면 다음 자동저장에서 reset될 위험 + render 함수가 fontFamily/fontWeight를 적용하지 않음.
- 다음 액션: wa5yfvi8n 완료 후 banner02 lines에 fontFamily/fontWeight 필드 노출되면 재처리. proj.json/dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).

## [2026-06-09] sec_e6ayc3m (Section 07)
- 메모: [Sec 17] 출처:sp_w16g3o + sp_g94emd(다중 가능) / 점수:문제 / 평가: 15 블록 모두 placeholder, 미작성 다중카드 템플릿 ---- 텍스트 누락된게 있어보임 추가하기
- 시도: 섹션 구조 점검. section-inner에 11개 직속 자식 — gap×5, frame-block×4(2개는 텍스트 있음: "KKLIZEN X ARTBOX"/"ARTBOX", 2개는 inner text-block 자체가 없는 빈 슬롯 ss_246cjeu/ss_yim751p), row×2(asset-block 1개씩, 큰 780px + 작은 200×64 로고 자리). 추가할 텍스트가 어떤 문구이며 어느 슬롯에 들어가야 하는지 결정할 소스 매핑이 없음.
- 결과: [차후처리] 단일 text-block 텍스트 치환이 아니라 (1) 소스 sp_w16g3o + sp_g94emd 본문에서 어떤 카피를 발췌할지 정하고 (2) 빈 frame-block에 새 text-block을 신규 삽입하고 (3) row의 asset-block 옆에 텍스트 카드 본문을 채우는 다중 단계가 필요. 워크플로우 wa5yfvi8n 또는 PM 소스 분석이 선결.
- 다음 액션: 소스 페이지 카피 매핑 확정 후 빈 슬롯(ss_246cjeu, ss_yim751p)에 신규 text-block 삽입 + row 카드 본문 일괄 추가. dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).

## [2026-06-09] sec_pt024wm (Section 08)
- 메모: [Sec 18] 출처:sp_g94emd + sp_w16g3o / 점수:문제 / 평가: placeholder 소제목·본문 --- iconfy 스킬로 적절한 아이콘 라벨쪽에 있는 에셋에 집어넣기
- 시도: 섹션 구조 점검. section-inner에 row 1개 안에 빈 asset-block(ab_oapgcoc, 130×130, align=left, src/bgImage 모두 비어 있음) 1개 + 텍스트("입소문으로 인해" / "언론에서도 화제 중인" / "끌리젠 보풀제거기"). 빈 asset 슬롯에 iconify 아이콘을 채워달라는 요청. window에 makeIconifyBlock/addIconifyBlock/updateIconifyBlock/openIconifyModal API는 존재하지만 asset-block → iconify-block 변환 API는 별도이고, 어떤 아이콘(예: 마이크/메가폰/뉴스)을 선정할지는 iconfy 스킬 필요.
- 결과: [차후처리] 사용자가 지시한 "iconfy" 스킬이 사용 가능한 스킬 목록에 없음(가장 가까운 건 goditor-icon-suggest). 빈 asset-block을 iconify-block으로 교체 + 의미에 맞는 아이콘(미디어/언론 화제) 선정은 단일 dataset 패치 범위를 넘는 다중 블록 재조립이라 worker 가드에 따라 시도하지 않음.
- 다음 액션: iconfy 스킬 도입(또는 goditor-icon-suggest로 대체 합의) 후, ab_oapgcoc 자리에 addIconifyBlock으로 메가폰/뉴스/입소문 류 아이콘 삽입. 그 다음 align/색상/사이즈(130×130) 유지하도록 dataset 정리. dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).

## [2026-06-09] sec_xjvl5qr (Section 16)
- 메모: #sp_user9w >> 디바이더가 있었어야되고 라벨이 왜 검정배경의 라벨인지 모르겠음 실제 스크래치패드랑 다른데
- 시도: 섹션 구조 점검. 14개 블록(gap×5, frame-block×4 with text-block 자식, row×1 + asset-block, heading 2개, label 1개). 라벨 tb_nux1wh6('kklizen', data-type="label") 컴퓨티드 스타일 확인 → .tb-label 내부에 기본 다크 라벨 스타일 적용: backgroundColor rgb(17,17,17), color rgb(255,255,255), padding 11px 36px, border-radius 8px. 이는 editor가 새 label 블록 만들 때 적용하는 디폴트 스타일이고 원본 스크래치패드 sp_user9w와 다르다는 게 사용자 지적. divider-block은 섹션 내 0개로 누락 확인. window.sp_user9w 노드는 editor에 로드 안 되어 직접 비교 불가.
- 결과: [차후처리] 단일 dataset 패치 범위 초과. (1) 원본 스크래치패드 sp_user9w 시각 비교가 필요하고(이미지/소스 분석 → orchestrator 영역), (2) divider-block 신규 삽입(어느 위치인지 원본 매칭 필요), (3) 라벨 재스타일(bg 투명/원본 색 + 글자색/border-radius 변경)을 거쳐야 함. worker 가드(이미지 분석·다중 블록 재조립 금지) + MEMORY 의무(/goditor-layout-orchestrator 사용)에 따라 직접 시도 중단.
- 다음 액션: /goditor-layout-orchestrator로 sp_user9w 원본과 sec_xjvl5qr 비교 → divider 삽입 위치 결정 + 라벨 tb_nux1wh6 스타일 원본에 맞춰 재설정(.tb-label bg/color/border-radius 패치). dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).

## [2026-06-09] sec_9qt52bb (Section 17)
- 메모: #sp_k8aucy > 스크래치패드에 있는 스타일대로 svg채우고 드래그앤드랍으로 넣을수 있게하기. \n\n텍스트도 텍스트 채워넣기
- 시도: 프로젝트 proj_1780630539284 전체에서 sp_k8aucy 검색 → 섹션 메모 본문 1회만 등장, 실제 scratchpad 항목으로는 존재하지 않음(현재 등록된 sp_ 20개: sp_1va562/sp_3dmpx8/sp_722g17/sp_75hisg/sp_8lhy8t/sp_9w6rs0/sp_cldybm/sp_dg4og7/sp_g94emd/sp_ipnqx7/sp_kt43o5/sp_ni5x7i/sp_no8x8c/sp_po7ow4/sp_rt7byh/sp_smbm6j/sp_user9w/sp_w16g3o/sp_yvvb15에 sp_k8aucy 미포함). 섹션 자체는 정상 로드되며 child 3개(gap-block, 빈 frame-block ss_tpzkfd8, row_48tb6mf with canvas-block cvb_47exnxk: 3×3 카드 그리드, cards 9개 모두 placeholder "카드 제목").
- 결과: [차후처리] (1) 참조 스크래치패드 sp_k8aucy 자체 부재 → 스타일 추출 불가, (2) "SVG 자동 채움"은 어떤 SVG를 어디에 둘지 결정하는 소스 매핑 + 신규 svg/asset 블록 삽입 필요(다중 블록 재조립), (3) "드래그앤드랍으로 넣을 수 있게" = 에디터 인터랙션 wiring 신규 구현(에디터 코어 변경), (4) 텍스트 채움은 canvas-block 9개 카드 카피 결정 필요. worker 가드(이미지 분석·다중 블록 재조립·신규 기능 wiring 금지)에 따라 직접 시도 중단.
- 다음 액션: (a) 사용자에게 sp_k8aucy 실제 ID 확인(오타/삭제 여부) 또는 대체 스크래치패드 지정 요청, (b) 스크래치패드 → 섹션 SVG 자동 채움 + 드래그앤드랍 wiring은 별도 워크플로우(에디터 코어 변경)로 분리, (c) canvas-block cvb_47exnxk 카드 카피는 본 섹션 컨셉(레퍼런스 sp_k8aucy 또는 대체) 확정 후 일괄 입력. dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).

## [2026-06-09] sec_3flg45n (Section 81)
- 메모: #sp_po7ow4 > 에셋블럭 크기로 좌우측 붙이기 하면될거 같긴한데 레이아웃만 잡아둬 보기
- 시도: proj_1780630539284 DOM 조회 → 섹션 child 4개(gap-block gb_pbmocyw / frame-block ss_d5fqwl8 with heading text-block tb_14nxzrv 빈 placeholder "소제목을 입력하세요" / gap-block gb_xgn94rb)만 존재. 참조 sp_po7ow4는 스크래치패드 패널에 실제 존재(scratch-item, 이미지 860x2095 data:image/png base64, 위치 left:947.5 top:14248.8). 즉 "에셋블럭 크기"는 sp_po7ow4 이미지(860x2095)를 기준으로 좌우 분할 레이아웃을 신규 구성하라는 의도.
- 결과: [차후처리] 작업은 (1) 이미지 분석으로 좌/우 영역 구획 결정, (2) 신규 row/col 컨테이너 + asset block(또는 image block) 좌측 + 텍스트/콘텐츠 블록 우측 삽입, (3) 에셋블럭 크기 매칭(860 폭 또는 분할 비율 결정) — 다중 블록 재조립 + 이미지 분석. worker 가드(이미지 분석·다중 블록 재조립 금지)에 해당.
- 다음 액션: /goditor-layout-orchestrator로 sp_po7ow4 이미지 분석 → 좌/우 분할 spec 생성 → 섹션 sec_3flg45n에 row + 좌측 asset(이미지) + 우측 텍스트/콘텐츠 블록 자동 조립. 기존 빈 heading text-block(tb_14nxzrv)는 우측 컬럼에 흡수 또는 제거 결정. dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).

## [2026-06-09] sec_8bxdbvt (Section 21)
- 메모: #sp_cldybm >> 해당섹션대로 데이터 입력후 행,칼럼 만들어보기 디자인 같게
- 시도: proj_1780630539284 DOM 조회. 섹션 child = section-hitzone/section-toolbar/section-inner(1 block: table-block tbl_6y56fxq). 현재 표는 2열×8행 placeholder(헤더 "항목/내용", body "항목 1~7" + 빈 칸), dataset(style=default, showHeader=true, cellAlign=center, rowH=96, lineColor=#cccccc, headerBg=#f0f0f0). 참조 sp_cldybm 1차 getElementById 실패 → scratch-item은 data-scratch-id 속성 사용 확인 후 재조회. 스크래치패드 패널에 실존 (scratch-item, 860x1331 JPEG 이미지). 즉 참조는 사용 가능하나, 행/열 개수·헤더·셀별 텍스트·디자인(라인색/배경/폰트/정렬)은 이미지 분석 필수.
- 결과: [차후처리] 단순 dataset 패치/단일 셀 텍스트 치환 범위를 넘는다. (1) sp_cldybm 이미지에서 표 구조(rows×cols, header 유무, 셀 데이터) 추출 = 이미지 분석, (2) 현 tbl_6y56fxq 행/열 개수 재조정(window.tableSetRows/Cols 류 호출), (3) 8 cell 이상 텍스트 일괄 입력, (4) 디자인(headerBg/lineColor/textColor/fontFamily/rowH) 매칭 = 다중 블록 재조립. worker 가드(이미지 분석·다중 블록 재조립 금지) 적용.
- 다음 액션: /goditor-layout-orchestrator로 sp_cldybm 이미지 분석 → 표 spec(행/열 수, 헤더 텍스트, 본문 셀 데이터, 라인색/헤더배경/폰트 컬러) 도출 → window.updateTableBlock류 API 또는 tbl_6y56fxq 직접 패치로 일괄 반영. dataset.memo는 차후처리 마커로 업데이트 완료(2026-06-09).
