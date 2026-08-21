# 독립 «3차» 재검증 — 라운드2 수정본 (2026-08-20, 리뷰어=지디 스폰 독립 에이전트, 읽기전용). @ df8d089
§9-4 대체로 사실이나 ②는 아직 «절반». 28/28·리허설 32/32 실측 재확인(리뷰어도 NODE_PATH로 28/28 확인).

## ★머지 전 반드시(2, ②의 잔존) — 각 «두 줄»
1. **구멍1(높음·데이터손실 = ②가 막으려던 그것): 드레인 타임아웃 반환값을 호출측이 버린다.**
   `save-load.js:1812` `return !_isSavingToFile`(false=5s 드레인 타임아웃)인데 유일 호출측 `settings-modal.js:342`가 `try{await …?.();}catch(_){}`로 값 무시. 5s 초과(autosave 1회=loadProject 전량읽기+IPC+변환+전량쓰기, 94.5MB 단독변환만도 1.7s → 대형서 현실적) 시 in-flight 저장 살아있는 채 rollback IPC 나감 → 복원본 재덮음 + `externalizer.js:344` backup 이미 unlink → 복구지점 소멸·UI 「✓」.
   → 조치: 반환 false면 rollback IPC 중단하고 「저장 중이라 되돌리지 못했습니다, 잠시 후 재시도」.
2. **구멍2(중·신규손실): `_pendingSaves.clear()`가 «다른 프로젝트» 대기분까지 버린다.**
   Map은 targetId별. 탭A 편집(디바운스 1.5s내)→탭B 전환(`tab-system.js:248`이 A를 큐 적재, 선행 저장 in-flight)→B에서 되돌리기→clear로 A 폐기→성공 reload로 A의 `_cache` 소멸. A 큐타이머는 `save-load.js:1266` H1가드에서 LS 쓰기 전 return이라 LS도 최신 아님 → A 마지막 ≤1.5s 편집이 파일·LS 양쪽에 없음.
   → 조치: 전체 clear 대신 `activeProjectId`(rollback 대상) 항목만 삭제.

## 머지 전 권장(테스트 공백 — 중요)
3. ★**②③은 단위테스트 0건.** 「리허설 F4 32/32」는 `rehearsals/data-loss-fix-rehearse.js:177-198`의 «새로 쓴 seal() 가짜 모델»만 검사, `save-load.js`를 import 안 함 → 구멍1/2를 원리적으로 못 잡음. → ②③에 «실제 save-load.js import» 단위테스트 추가(구멍1 타임아웃·구멍2 타프로젝트 보존 회귀방지).
4. ③ 부작용(낮음): `resumeAutoSaveAfterAbortedReload`가 dirty 무조건 true → DEF-03(무편집 방문 updatedAt 오염방지) 되돌림+협업 gd:project-saved 발화. → 봉인 직전 값 캡처·복원. 그리고 「성공인데 reload 막힘」(settings-modal.js:345) 시 suppress=true·dirty=false 영구→전 편집 무증상 소실 → 백스톱(3s 뒤 살아있으면 resume).

## 막힘 확인(재작업 불요)
- 필수③ dirty복구: 실패·예외 양쪽서 resume 호출 ✔(부작용은 위 4).
- 필수① 테스트: :166 오히려 강해짐(backup 부재 단언)·:173 updatedAt 제외 deepEqual 정당·신규3케이스 정면검증 ✔.
- 권장 F2 회전: `/^proj_pre-rollback\.\d+\.json$/`만 삭제, 원본3종 무접촉 ✔(경계=시계역행, 낮음).
- ② 데드락 없음·순서 정상(in-flight 완료 후 rollback) ✔.

## G2-scope(머지 후·별건)
- F6 렌더러 new-only 절단 corruption(`asset-externalize.js:66-98`이 절단 매치를 앞절반만 저장·뒤 쓰레기 잔존 — 배치 무관 항상 돎, ★기존 잠복이라 이 브랜치 회귀 아님).
- F6 수동경로 UX(중·신규): 절단분이 skipped 합산→`settings-modal.js:377`이 「외부화 미완료·재시도」+새로고침 안 함 → «절대 완료 안 되는 기능», DOM base64라 다음 autosave가 디스크변환 되돌림. → skipped 사유를 truncated/save-fail 분리.
- noop 회귀(낮음): 절단only가 ok:false→자동경로서 매 오픈 실패 힌트(억제 없음).
- 대형 2건(108/94.5MB) 실측 + 절단 skip 앱 실측.
- 구멍3(낮음): flushSave(save-load.js:1762)·commit saveProjectFile은 봉인 밖(직행 IPC). 모달 중 도달성 낮음.

## 최종
- **머지(기본 OFF): 위 1·2 두 줄 고치면 OK.** 안 고치면 드물게 「되돌리기 조용히 무효+복구지점 소멸」·「타 탭 최근편집 유실」.
- **기본 ON(G2): 1·2 + F6 렌더러 봉합 + 수동 UX 분기 + 대형 실측** 후 재상신.
