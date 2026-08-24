# #16 스크래치패드 ↔ 섹션 연결 — 서브브리프 (착수 전 지디 게이트)

- 작성: 태양 2026-08-25 · worktree web-editor-taeyang-v08 · feature/v0.8-improvements · ⛔착수 = 지디/현빈 승인 후
- 전제: 브리프 §4 3안 중 **A(앵커 사이드카)** 현빈 선호(or A+C), «구현 전 재확인». 이 문서 = A안 상세 + 게이트 요청.

## 0. 사실확인(코드 실측)
- DB=`ScratchPadDB` / store=`scratch` / 키=`scratch-pad-<projectId>-<pageId>`(`_getScratchKey` scratch-pad.js:72). **sectionId 개념 전무.**
- scratch = **사이드 저장**: 프로젝트 열 때 `initScratchPad`/`_loadScratch`로 별도 로드(save-load.js:1634). **section-serialize에 scratch 0건·project.json/export/.gdt 미포함** → sectionId 추가해도 export/왕복 표면 무영향(P0 위험 낮음).
- 섹션 안정 id = `sec.id`(sec_..). y/height = offsetTop/offsetHeight.
- 아이템 생성 `_createItem`(:492~), 저장 `_saveScratch`(:81)/`flushScratchForSwitch`(:111), 로드 `_loadScratch`(:1024).

## 1. A안 = 앵커 사이드카 (설계)
- **데이터모델**: scratch 아이템에 `sectionId`(옵셔널) 1필드 추가. 키 스킴 «불변»(project-page 유지) — 섹션별 서브키 대신 아이템 필드로 필터(마이그레이션·왕복 단순). `sectionId` 없으면 = 기존 «자유배치 플로팅»(하위호환).
- **앵커링 UX**(택1, 게이트에서 확정): ⓐ아이템을 섹션 위로 드래그→그 섹션에 링크 / ⓑ아이템 컨텍스트 «섹션에 고정» / ⓒ섹션 선택 중 «여기 메모» 생성. 권고=ⓐ(드롭=canvas-scratch-drop.js 기존 경로 재사용) + 해제 버튼.
- **렌더/추종**: 앵커된 아이템은 캔버스 우측에 `document.getElementById(sectionId)`의 offsetTop·offsetHeight에 맞춰 배치. 섹션 순서/높이 변하면 재계산 추종 — 훅: 기존 섹션 변경 지점(MutationObserver/레이어 재빌드/저장 debounce)에 «앵커 위치 재계산» 1패스 추가.
- **경계**: 섹션 삭제 시 앵커 고아 → **언앵커(sectionId=null, 플로팅 복귀)** = 노트 보존(데이터손실 0). 숨김/삭제 안 함. 섹션 접힘/비표시(#8 팬텀류)면 사이드카도 숨김.

## 2. ★하위호환·마이그레이션 (P0)
- 기존 저장 scratch = sectionId 필드 부재 → 로드 시 그대로 플로팅(강제 마이그레이션 안 함). **옛 스크래치 회귀 0**이 핵심 게이트.
- 저장/로드 왕복: `_saveScratch`/`_loadScratch`가 아이템 객체를 통째 put/get이면 신필드 자동 생존(확인 필요). export/.gdt = 미포함이라 무관.

## 3. P0 시나리오 (고QA)
ⓐ아이템 섹션 앵커→저장→재로드 sectionId·위치 생존 ⓑ섹션 순서변경→앵커 추종(좌표 재계산) ⓒ섹션 높이변경→추종 ⓓ섹션 삭제→언앵커(노트 보존·크래시0) ⓔ**옛 저장 scratch(무 sectionId) 로드 회귀0**(플로팅 그대로) ⓕ프로젝트/페이지 전환 시 앵커 누수0(flushScratchForSwitch _scratchLoadGen 무효화 경로와 정합) ⓖexport(PNG/HTML/figma)·.gdt 왕복에 scratch 미노출 유지(회귀0).

## 4. 롤백
- sectionId = 추가 옵셔널 필드 → 미사용 시 현행(플로팅) 동일. 유닛 revert = 앵커 렌더/추종 패스 + 드롭 링크 제거. 기존 scratch 인프라 무접촉.

## 5. 게이트 요청(지디/현빈 확정 필요)
1. A 단독 vs A+C(분할 비교뷰 토글) 범위.
2. 앵커링 UX ⓐ/ⓑ/ⓒ 중 택.
3. 섹션 삭제 = 언앵커(권고) vs 노트 삭제.
> 승인 오면 구현→1차 격리 CDP QA→P0 고QA(무손실 실증)→커밋. ⛔dev 미머지.
