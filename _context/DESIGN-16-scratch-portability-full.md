# #16 스크래치패드 «전체» 이식 — 상세설계 (범위 나 확정·구현 아님·게이트용)

- 작성: 태양 2026-08-25 · 지디/현빈: 스크래치패드 통째로 프로젝트 동반. proj.json base64 인라인 금지(B안 배제). save lazy 외부화.
- 목표: 프로젝트를 다른 맥으로 옮겨도 스크래치패드가 «꽉 차 보이고 편집 가능». P0=데이터손실0·기존 pane 회귀0·export-html strip 유지.

## 0. 실측(근거)
- 스크래치 = IndexedDB `ScratchPadDB`/store `scratch`/키 `scratch-pad-<pid>-<pageId>`(페이지별). 아이템 `{src,x,y,w,id,g}`. src=현재 base64(또는 이미 goya-asset).
- scratch-item DOM = `#canvas-scaler` 자식(=`#canvas`의 형제). serializeCleanRoot는 `canvasEl(#canvas)` 대상 → ★스크래치는 save/export canvas HTML에 «원천 미포함»(오염0 자동).
- `_createItem`은 `img.src`에 goya-asset:// 줘도 Electron protocol로 렌더됨(하이드레이션 지원). `_srcToPngDataUrl`이 goya-asset 재인라인 처리.
- `assetsSaveCanvasImage({projectId,b64,mime})` → `<pid>/assets/<hash>.<ext>` 저장·goya-asset URL 반환.
- .gdt 스캐너(main/gdt/export.js) = project.json «어디서든» goya-asset 토큰 잡아 images/ 번들(구조무관 토큰스캔).
- proj.json = `pages: state.pages` 통째 저장·flushCurrentPage가 page.canvas만 in-place → 페이지 객체 커스텀 필드 자동 보존(P1에서 검증).

## 1. 데이터 3계층 (핵심)
1. **IndexedDB(로컬 라이브)** — 같은 맥에서 빠른 편집. 종전 유지.
2. **프로젝트 asset(실체)** — `<pid>/assets/<hash>.<ext>`(goya-asset). 폴더/.gdt에 «실체 동반».
3. **proj.json 매니페스트** — `page.scratchpad = [{id, src:"goya-asset://…", x, y, w, g}]`. ★base64 아님(URL+좌표만=경량) → 인라인 금지 원칙 부합. 다른 맥 «하이드레이션 원본».

## 2. 저장(save) = 외부화 + 매니페스트 기록 (lazy, externalizeProjectData 패턴 확장)
- 훅: save-load.js 저장 chokepoint(현 `await externalizeProjectData(...)` 옆)에 `await externalizeScratchpad(proj, pid)` 추가.
- 동작: 대상 스크래치 아이템들의 src가 base64면 `assetsSaveCanvasImage`로 asset화→goya-asset URL. IndexedDB src도 URL로 갱신(같은 맥 재로드도 asset 렌더). 각 아이템 메타를 `page.scratchpad`에 기록(dedup=hash).
- ★멀티페이지 범위(열린 결정 D1): (b·권고) proj.pages 전체를 순회해 각 페이지 IndexedDB 키를 읽어 외부화(옮긴 프로젝트가 «모든 페이지» 스크래치 보유). vs (a) 현재 로드된 페이지만+나머지는 방문 시. → 완전 이식은 (b). 비용=저장 시 타 페이지 IDB read(작음).
- 실패 시 원본 base64 유지(손실0).

## 3. 로드 + 하이드레이션 (다른 맥 = IndexedDB 빔)
- 훅: applyProjectData/initScratchPad 경로. _loadScratch 전에 «하이드레이션 게이트».
- 정책(열린 결정 D2·★회귀 핵심): **IndexedDB 우선, 비었을 때만 매니페스트로 하이드레이션**.
  - 해당 (pid,pageId) IndexedDB에 데이터 있음 → 그대로 사용(같은 맥 로컬 편집 보존=회귀0).
  - IndexedDB 비었고 page.scratchpad 있음 → 매니페스트를 IndexedDB에 put(재채움) → _loadScratch가 평소대로 렌더(src=goya-asset, 실체는 폴더 asset). = «스크래치패드 다시 꽉 참·편집 가능».
- asset 실체 없음(폴더 미동반 등) → goya-asset 404 → 아이템은 남되 깨진 썸네일(고아 안전·크래시0). 로그.

## 4. 마이그레이션(기존 IndexedDB-only 프로젝트)
- 기존 프로젝트는 page.scratchpad 없음·src=base64. 첫 저장 시 §2가 전부 외부화+매니페스트 생성(비파괴: base64→asset 복사, IndexedDB src 갱신). 이후 이식 가능.
- page.scratchpad 없으면 로드 하이드레이션 no-op(구 프로젝트 회귀0).

## 5. .gdt / 폴더 / export
- .gdt: page.scratchpad의 goya-asset URL을 기존 스캐너가 자동 번들(무편집). 다른 맥 import 시 asset 복원→하이드레이션.
- 폴더 이동: `<pid>/assets/` 동반이면 goya-asset 로드 성공.
- export-html/figma: 스크래치는 원래 canvas 밖이라 미포함(오염0). data-ref-links strip 유지(#16 P1). = 변경 없음.

## 6. 동기화·회귀방지
- save: IndexedDB(라이브)→asset+매니페스트 동기화(단방향 out).
- load: IndexedDB 우선(로컬 최신 보존)·비면 매니페스트 in. ★하이드레이션이 «비었을 때만» = 로컬 편집 덮어쓰기 없음.
- 편집(추가/삭제/이동/리사이즈)=종전 IndexedDB 경로 무변경·다음 save에 동기화.
- ★회귀 방지 집중: (a)같은 맥 로컬 스크래치 손실0(하이드레이션 게이트) (b)src base64→goya-asset 전환 후에도 슬라이스/AI/복사(_srcToPngDataUrl가 goya-asset 처리)·드래그·리사이즈 정상 (c)_scratchLoadGen/flush race와 하이드레이션 순서 정합.

## 7. 열린 결정(지디 게이트)
- D1 멀티페이지 외부화 범위: (b)전체 페이지 권고 vs (a)현재+lazy.
- D2 하이드레이션 정책: «IndexedDB 우선/비면 하이드레이션» 권고(로컬편집 보존). 대안=매니페스트 우선(디스크 진실, but 로컬편집 손실 위험).
- D3 외부화 타이밍: save lazy 권고(채택됨).
- D4 하이드레이션 시 asset 없음(404) UX: 깨진 썸네일 유지 vs 플레이스홀더 vs 그 아이템 스킵.

## 8. P0 시나리오(고QA + fresh agent 적대리뷰)
① 저장→다른 userData(=다른 맥 모사)로 프로젝트 폴더 복사→로드: 스크래치 하이드레이션·썸네일 로드·편집 가능. ② 같은 맥 재로드: 로컬 IndexedDB 보존(하이드레이션 no-op)·편집 손실0. ③ 기존 base64 프로젝트 첫 저장 마이그레이션·재로드 무손실. ④ .gdt export→import 다른 환경: 스크래치 asset 번들·복원. ⑤ 슬라이스/AI/복사/드래그/리사이즈 회귀0(goya-asset src). ⑥ export-html/figma 스크래치·refLinks 미포함 유지. ⑦ 멀티페이지 전 페이지 스크래치 이식. ⑧ asset 404 크래시0.

## 9. 롤백
- externalizeScratchpad/하이드레이션 = 신규 함수. 미설치 시 종전(IndexedDB-only) 동작. page.scratchpad 없으면 로드 no-op. base64→asset은 복사(원본 유지)라 손실 경로 없음.
