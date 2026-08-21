# 독립 «재검증» 리뷰 — 일괄외부화 수정본 (2026-08-20 라운드2, 리뷰어=지디 스폰 독립 에이전트, 읽기전용)
§9-3 주장은 대체로 사실(럽버스탬프 아님). F1·F3·F5 «막힘». F2·F4·F6 «부분». 수정이 만든 신규손실 2건 + 깨진 테스트 1건.

## 판정 요약
- **F1 막힘**(치명 해소). main.js:1135-1155 순서 backup→history(최신)→pre-externalize(끝) 실이동. ★mtime비교는 «안» 들어갔으나, main.js:1253-1258이 매 저장마다 backup 갱신 + history 10분간격이라 「backup≥모든 history」 불변식으로 성립. 토스트 정직화 확인(save-load.js:1505-1507).
- **F3 막힘**(주경로). externalizer.js:231-234 updatedAt=now → fileTs>lsTs로 뒤집음. 회전상한2는 「유일 원본」 안 지움(확장자 없는 현행백업은 대상 밖). 경계: 시계역행(NTP)이면 재발 여지(좁음). 부작용(무해): updatedAt 갱신→홈목록 sort 최상단 점프+날짜 오늘 표시(1회성).
- **F5 막힘**. 자동(main.js:1105-1113)·수동(1177-1186) 둘 다 fail-closed, 부재=진행이라 과잉차단 없음. 경미: 수동이 meta손상을 「협업중」으로 거짓안내(settings-modal.js:370).

## ★머지 전 반드시(3건)
1. **(중) 깨진 단위테스트 — 수정자가 기존 테스트를 안 돌렸다.** `node --test tests/unit/externalizer.test.js` = 13중 1 FAIL. :166「되돌리기 현재본=proj_backup.json」(F2수정으로 무효)·:173「재변환===첫변환」(updatedAt 갱신으로 불성립). ⇒ 단언 갱신 + ★전체 스위트 재실행. §9-3 「27/27」은 새 리허설만이다(그건 실측 PASS).
2. **(높음·데이터손실) F4 큐 경로.** 봉인이 타이머·beforeunload는 막지만 `_pendingSaves` 대기열(save-load.js:102·111·122-125)·`_isSavingToFile` in-flight는 안 비운다 → 되돌리기 중 in-flight 저장이 finally에서 큐 드레인→새 IPC가 rollback IPC 뒤 도착→복원 proj.json을 변환본으로 재덮음. pre-externalize는 이미 unlink(externalizer.js:315)→되돌리기지점 영구소멸, UI는 「✓ 되돌림」. → 되돌리기 전 큐 비우기 + isSaving 드레인 대기.
3. **(중, 신규회귀) 되돌리기 실패시 dirty 미복구.** _unseal()이 _suppressAutoSave만 되돌리고 _dirtySinceSave=true 복구 안 함(settings-modal.js:340-347). 봉인때 타이머취소로 LS기록도 없어 실패직전 편집이 DOM에만 존재→Cmd+R시 1305가드 조기return→소실. (앱종료는 onForceSaveBeforeQuit이 살림.)

## 중간(머지 이상적 전, G2 필수)
- **F2 부분**: 전용 proj_pre-rollback.json 이동은 됨(autosave 무접촉 grep확인)·복제 무전파·dryRun 수치 정확. 단 ★«회전 없음» — 변환→되돌리기→재변환→되돌리기면 2차가 1차 보관본 덮음(실측 WORK-A false). 정직성: 「현재상태 보관」이라지만 실제는 디스크 최종저장본(F4로 마지막 ≤1.5s 편집 미보존). ageDays null이면 경고에서 「며칠 전」 줄 통째 빠짐(최악 케이스에 경고 최약).
- **F6 부분(정직성 해결·게이트 장식)**: remaining 게이트를 같은 DATA_URI_RE로 세서 「정규식이 못 보는 base64」는 구조적으로 통과. ★실재현: base64 중간 개행 낀 data URI → 앞절반만 저장(4500중 2250)·뒤는 캔버스에 쓰레기 잔존·결과 ok:true skipped:0=「완료」 토스트 = 이미지 깨져도 「완료」라 말함(원본 pre-externalize에 남아 복구가능). 리뷰 F10 클래스.

## 신규 손실경로 요약
① 단위테스트 깨짐(커밋됨) ② F2 pre-rollback 무회전 ③ 되돌리기 실패 dirty미복구 ④(낮음) 열기만으로 목록정렬/날짜 갱신. 정상경로(수동변환·정상열기·noop·복제)는 깨진 곳 없음 재확인.

## 최종
- **머지(기본 OFF): 조건부 OK** — 위 «반드시 3건» 붙인 뒤. (②③ 없으면 되돌리기가 조용히 무효+복구지점 삭제.)
- **기본 ON(G2): 아직 불가** — F6 절단클래스 실재현 잔존 + 108MB·94.5MB 대형은 표본 밖. 「대형2건 실측 + 절단방지(속성파싱 또는 잔여 base64 길이검증)」 후 재상신.
