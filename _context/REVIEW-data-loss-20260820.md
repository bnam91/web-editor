# 독립 적대적 리뷰 — 일괄 외부화 데이터손실 (2026-08-20, 리뷰어=지디 스폰 독립 에이전트, 읽기전용)
브랜치 feature/asset-batch-externalize (79497b8). ★태양 자체 리허설 「전항목 PASS」가 놓친 구멍들 — 놓친 이유도 각 항에 명시.

## 최종 판정: 데이터 손실 «가능». 경로 = F1(폴백 체인에 늙은 백업이 히스토리를 이김) + F2(되돌리기가 변환 이후 작업 전량을 수명 1.5초 슬롯에만 남김).

## 치명 (데이터 손실)
### F1. 폴백 체인 순서가 설계와 반대 — main.js:1127-1143
- 설계 §3-1은 「체인 맨 끝에 proj_pre-externalize」인데 코드는 backup→pre-externalize→history 순(1131-1134가 히스토리 루프 1135보다 앞). mtime/updatedAt 비교 0. 첫 파싱성공본 채택 후 _atomicWriteFileSync 자가치유(1150-1151).
- pre-externalize는 변환 1회 후 안 갱신(externalizer.js:229-235) → 계속 늙음.
- 시나리오: 8/20 자동변환→pre-externalize=8/20 고정. 한 달 편집(history는 5슬롯 회전). 롤링 백업 비원자적 copyFileSync(1242,1290) 복사중 죽으면 잘림. proj.json 손상 시 backup(잘림)→pre-externalize(8/20) 채택 → 한 달 전으로 덮음. 토스트는 「백업에서 복구」(save-load.js:1506)라 사용자 모름. 최신 history 조회 안 됨.
- ★이 브랜치가 만든 회귀(이전 체인은 backup→history 최신순).

### F2. 되돌리기가 변환 이후 작업 전량 파기 — externalizer.js:259-278 · settings-modal.js:322-337
- rollbackExternalize가 현재 proj.json을 롤링 proj_backup.json에 복사(265) 후 백업본으로 덮음. 그 슬롯은 다음 save가 즉시 덮음(main.js:1242). externalizer 헤더 주석 스스로 「롤링 backup은 되돌리기 지점으로 못 씀」이라 적고 유일한 보관처로 씀.
- 시나리오: 8/20 변환→9/20까지 편집(섹션40→120)→되돌리기. 확인문구는 언제 상태인지·한달 사라짐을 안 알림. reload후 첫 편집→autosave 1.5초→copyFileSync(8/20→backup)→보관본 소멸. history 5슬롯도 ~50분 편집이면 전부 회전.
- rollback엔 검증 0(변환엔 5종).

## 높음
### F3. 열 때 자동변환이 localStorage 스냅샷에 조용히 되돌려짐 + 백업 무한누적 — save-load.js:1534-1567
- externalizeProjectFile이 updatedAt 미갱신 → fileTs=마지막 autosave. initLoad는 lsTs+500>fileTs면 LS 우선(1555), lsTs는 파일쓰기 직전(1280-1281)이라 항상 이름 → 성립. 방어카운트 변환전후 동일이라 통과(1565)→applyAndFinish(lsData) base64 DOM 복원→recordExternalizeBaseline이 base64 베이스라인→다음 autosave가 proj.json을 base64로 되돌림.
- 대상: 직렬화 2MB미만(그이상 LS삭제 1197-1203). 실측 base64잔존 38중 18개가 2MB미만. 새로고침 1회=변환 1회. 2회차부터 pre-externalize.<ts>.json 회전본을 지우는 코드 없음→새로고침당 proj.json 사본 1개 영구적립.
- 리허설이 못잡은 이유: 격리 user-data-dir라 LS 비었고, 수동은 flush가 updatedAt 갱신. 자동경로에만 걸림.

### F4. 되돌리기에 autosave 억제·flush 없음 — settings-modal.js:322-337
- 수동변환은 flush→변환→reload로 경합 방지(asset-externalize.js:199-205)인데 되돌리기엔 셋 다 없음. confirm() 중 autosave 타이머 만료→종료직후 발화→rollback이 pre-externalize unlink(268) 후 큐잉된 save가 외부화본 재기록. 파일 안 되돌아갔는데 되돌리기 지점 영구삭제. UI는 「✓ 되돌렸습니다」.

### F5. 협업 제외 게이트 fail-open — main.js:1103-1105 · 1167-1170
- try{collabRef=meta.collabRef}catch(_){} — meta 없거나 파싱실패면 collabRef=null→변환진행. meta는 수시 재기록돼 잘릴 수 있음. 수동도 force게이트 없이 통과. fail-closed(제외)여야.

### F6. 부분실패를 성공으로 보고 — externalizer.js:212-216
- remaining 계산만 하고 미검사(dead var). 「잔존 base64=저장실패분만」 게이트 미구현. 실제 방어는 "성공 URI 남았나"(216)뿐→수집이 놓친 base64는 통과. skipped>0에도 ok:true→main.js:1109가 externalized 발사→사용자 완료 인식.

## 낮음
- F7 atomicWrite ENOSPC시 .tmp 누수(externalizer.js:63-68, main.js:725-733). 단 상위 catch renameSync(backup→proj)로 원본계약은 지켜짐.
- F8 flat 레이아웃(<id>.json) 통째 무시(externalizer.js:51-62).
- F9 복제본 유령 마커 — duplicate가 meta복사(externalized 따라감)하나 pre-externalize 미복사(표시오류).
- F10 prefix 치환 이론적 위험(externalizer.js:203-208, 성립조건 좁음).
- F11 에셋 무결성 size>0뿐(217-221), saveImageBytes 기존파일 내용확인없이 재사용(111), 폴백 비원자적 writeFileSync(main.js:951).

## 확인 후 «문제없음» (표본명시)
- 해시충돌/덮어쓰기: content-hash+existsSync 스킵이라 안전(externalizer.js:111).
- 정규식 절단: 실측 60MB미만 29개·879매치, 이상종결자 0. ★108MB·94.5MB는 표본제외(전프로젝트 안전 아님).
- 되돌리기후 에셋GC: 미참조 GC 코드 0건→하드링크 복제본 안깨짐.
- temp→rename atomic: 동일볼륨 원자적. 단 rename(proj→backup)~atomicWrite(proj) 창 실재→그 창 복구가 F1에 걸림.
- v1/v2: canvasSlots pages우선→data.canvas, snapshot.canvas는 noop 비파괴.
- 라이브 무오염: proj_pre-externalize* 0건(실사용 미접촉).
- 기본 OFF: main.js:87-89·settings-store.js:21 둘다 false, 정확히 지켜짐.

## 머지 전 최소조치(우선순위)
1. F1 폴백 후보 updatedAt 내림차순 정렬(또는 pre-externalize를 history 뒤로).
2. F2 되돌리기 보관처를 전용파일(proj_pre-rollback.json)+실수치 경고(「N일전·섹션120→40」).
3. F3 변환시 updatedAt 갱신(또는 on-open후 LS키 제거)+회전백업 상한.
4. F4 되돌리기도 flush→_dirtySinceSave=false→IPC→reload.
5. F5 meta 읽기실패시 fail-closed.
6. F6 remaining을 실제 게이트로, skipped>0이면 «부분완료» 통지.
★G2(기본ON): 최소 F1·F3·F5 수정 전엔 상신 불가(열때 자동변환이 전사용자 적용).
