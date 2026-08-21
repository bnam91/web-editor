# 설계: 기존 프로젝트 base64 «일괄 외부화» — 현행고디터

브랜치 `feature/asset-batch-externalize` · worktree `/Users/a1/web-editor-taeyang` · base dev `1ec78f0`
작성 태양 2026-08-20 · 검토 지디 · **1차 게이트 승인(지디, 2026-08-20)** · 기본 ON 전환은 리허설 §9 채운 뒤 지디 경유 현빈 G2

> **지디 결정(2026-08-20)**: ①설계 승인 ②A(.gdt)·B(Figma) 포함 — 단 U5/U6는 «별도 커밋»(필요시 분리 가능) ③C = ⓑ 채택: 협업 등록 프로젝트는 자동변환 제외·토스트만. 근본해결(서버 에셋 제공자)은 신규 웹고디터 P2로 이관(이 브랜치 범위 아님). 머지 금지 유지.

## 0. 한 줄
v0.8.0에 들어간 이미지 외부화(`goya-asset://`, content-hash)는 «신규 이미지만» 자동이고 기존 base64는 수동 버튼뿐이다. 이 설계는 **변환기를 main 프로세스(파일 수준)로 옮겨 «프로젝트 열 때» 백업 후 일괄 변환**할 수 있게 하되, **기본은 OFF**로 두고, 되돌리기 경로와 리허설을 갖춘다.

## 1. 실측 (2026-08-20, 읽기만 · `~/Library/Application Support/GODITOR/projects`)
| 항목 | 값 |
|---|---|
| 프로젝트 수 | 67 (proj.json 기준) |
| 레거시(base64 내장) | **37개** |
| proj.json 합계 | 997MB (최대 108MB) |
| base64 참조 | 1,257건 → 고유 이미지 **478장 · 304MB** (중복 2.6배: data-* 속성 + 인라인 style url() 이중 저장) |
| 이미 goya-asset 참조 | 216건 (new-only 자동 외부화가 실제로 동작 중) |
| proj_history | 2.2GB (base64 그대로 — 건드리지 않음) |
| 디스크 여유 | 44GB |
- 예상 효과: 최대 파일 108MB → 수 MB. 디스크는 **+304MB**(에셋)만 증가(원본은 rename이라 복사 0).
- 변환 시간은 미측정 → 리허설 항목.

## 2. 현재 구조와 «왜 renderer 경로로 일괄변환하면 안 되나»
- 현 변환기 `optimizeProjectImages()`(js/io/asset-externalize.js)는 **DOM 직렬화 → 이미지당 IPC → 저장**. 디스크만 바뀌고 DOM엔 base64가 남아 **새로고침 필수**(settings-modal.js b8-2 주석: 안 하면 다음 autosave가 base64를 다시 써서 되돌림 — 실측된 함정).
- 열 때 이 경로를 타면: 100MB 로드 → DOM 주입 → 변환 → 저장 → 다시 로드. 두 번 읽고, 변환 중 autosave·탭캐시(`_cache`)·beforeunload 동기저장과 경합한다.
- `_doSaveProjectToFile`는 저장마다 `loadProject`로 디스크 전체를 다시 읽는다(108MB면 매 autosave마다) — 변환이 끝나면 이 비용도 같이 사라진다.

## 3. 설계 — 변환기는 main, «1구현 · 3트리거»
### 3-1. 신규 모듈 `main/project-store/externalizer.js` (main.js 비대화 금지 · 웹 이관 이음새)
`externalizeProjectFile(projectsDir, projectId, opts) → {ok, before, after, images, reused, skippedUris, backupPath, ms}`
1. `proj.json` 읽기 → JSON.parse (v2 `pages[].canvas` / v1 `canvas` 둘 다).
2. 고유 base64 URI 수집 — 정규식은 asset-externalize.js의 `DATA_URI_RE`와 **동일**(`data:image/…;base64,[A-Za-z0-9+/]+=*`; 비base64 SVG 제외).
3. 각 URI → 디코드 → sha256 앞 16hex → `assets/<hash>.<ext>` (**`assets:saveCanvasImage`와 같은 규약**, 있으면 skip=dedup). 이 저장 로직을 main.js에서 함수로 뽑아 둘이 공유(`_saveCanvasImageBytes`).
4. 치환(긴 URI부터, `split/join`) → 새 JSON 문자열.
5. **검증(전부 통과해야 쓴다)**: 섹션 수 동일(`section-block` 카운트) · 페이지 수 동일 · 잔존 base64 = 저장 실패분만 · 참조한 에셋 파일 전부 존재·size>0 · 새 JSON 재파싱 성공.
6. **원본 보존**: `proj.json` → `proj_pre-externalize.json` **rename**(디스크 0 추가). 이미 있으면 덮지 않는다(=최초 원본 영구 보존). ⚠️ 롤링 `proj_backup.json`은 다음 autosave가 1.5초 뒤 덮어쓰므로 되돌리기 지점으로 못 쓴다 — 그래서 별도 파일.
7. `_atomicWriteFileSync(proj.json)` → `_refreshListMeta` → `proj_meta.json`에 `externalized:{at, before, after, images, backup}` 마커.
8. 실패 시 **어느 단계든 proj.json 무변경**. 만들어진 에셋은 남겨도 무해(해시라 재실행 시 재사용).
- 멱등: base64 0건이면 즉시 `{ok:true, noop:true}`.
- `projects:load` GAP-004 폴백 체인 **맨 끝**에 `proj_pre-externalize.json` 추가(최후 보루).

### 3-2. 트리거
| 트리거 | 조건 | 동작 |
|---|---|---|
| ① 열 때 (`projects:load`) | `settings.autoExternalizeOnOpen === true` **이고** 파일에 base64 있음 | 변환 → 변환된 JSON 반환 + `_externalized` 필드(렌더러 토스트용, serialize 미포함 — `_recovered`와 같은 패턴). 렌더러는 처음부터 goya-asset DOM → 베이스라인 0 → **새로고침 불필요·경합 없음** |
| ② 수동 (`projects:externalize` IPC) | 설정>성능 버튼 | 렌더러: `_suppressAutoSave` + 저장 flush → IPC → 성공 시 reload(기존 버튼과 동일 UX). 기존 `optimizeProjectImages`는 이 IPC를 부르도록 교체(변환 구현 1개) |
| ③ 되돌리기 (`projects:externalize-rollback` IPC) | 설정>성능 «변환 되돌리기»(마커 있을 때만 표시) | 현재 proj.json → proj_backup.json, `proj_pre-externalize.json` → proj.json 복원 → meta 마커 제거 → reload. 에셋 파일은 남김(다른 참조 가능) |

### 3-3. 정책 (지디 지시: 기본 OFF 유지)
- settings `autoExternalizeOnOpen: false` (DEFAULT_SETTINGS에 추가, readSettings 병합 규칙 그대로).
- OFF: 아무것도 변환 안 함. 레거시 대형(proj.json ≥ 20MB & base64>0)을 열면 **프로젝트당 1회** 안내 토스트(“이미지 N장 내장 · 설정>성능에서 최적화 가능”) — localStorage 키로 1회 제한.
- ON(설정>성능 토글 「프로젝트 열 때 이미지 자동 최적화(베타)」): 위 ①. 로딩 오버레이 문구 «이미지 최적화 중…».
- **기본값 ON 전환 = 리허설 통과 후 현빈 G2 별도 상신**(이 브랜치 범위 아님).

## 4. ★발견된 잠복 구멍 3개 — 일괄변환이 «보편화»시킨다 (결정 필요)
셋 다 **오늘도 신규 이미지에서 이미 발생 가능**(new-only 자동 외부화가 켜져 있으므로). 일괄변환하면 37개 레거시 전부에 해당된다.
| # | 경로 | 실측 | 수정안 | 크기 |
|---|---|---|---|---|
| A | **.gdt 내보내기** `main/gdt/export.js` | 스캐너가 `data:image/…;base64,`만 외부화. `goya-asset://` URL은 그대로 통과 → 다른 맥에서 import 시 이미지 404 | 스캐너에 `goya-asset://<pid>/<file>` 토큰 추가 → `assets/`에서 읽어 `images/`로 동봉, import는 현행대로 base64 복원(구버전 호환) | 中 (export.js 스트리밍 스캐너 확장 + 왕복검증 기존 인프라 재사용) |
| B | **Figma 내보내기** `js/io/export-figma-json.js` + `figma-renderer/sangpe_to_figma.mjs:832` | `imgSrc.startsWith('data:')`만 base64, 아니면 `'url'` 타입으로 플러그인에 전달 → goya-asset URL은 피그마가 못 받음 | export 직전 goya-asset → `assetsReadAsDataUri`로 재인라인(export-html의 `inlineGoyaAssets` 재사용) | 小 |
| C | **협업** `js/collab/sync.js:120` | 섹션 `outerHTML`을 그대로 푸시 → 상대 디스크엔 그 에셋이 없음 → 깨진 이미지 | 근본 = 서버 에셋 업로드(= 웹고디터 P2 «에셋 제공자»와 같은 문제). 단기 선택지: ⓐ푸시 시 base64 재인라인(용량↑, 폴링 한계) ⓑ협업 중 프로젝트는 자동변환 제외 ⓒ보류 | **결정 필요** |
- 결정(지디): **A·B 포함(각각 별도 커밋 U5/U6)**. **C = ⓑ**: 협업 등록 프로젝트는 ① 자동변환 제외·토스트 안내. 근본해결은 웹고디터 P2.
  - 구현 보완: 수동 버튼도 협업 프로젝트면 한 번 막고(`reason:'collab'`), 경고 확인 후 `force`로만 진행(상대 화면에 이미지가 안 보일 수 있음을 사용자가 읽게).
| D | **PNG export 타이밍** `js/io/export-image.js` | 리허설 실측: 외부화 프로젝트를 연 «직후»(콜드 캐시) 첫 export가 78KB(이미지 누락) → 같은 섹션 재export 3.16MB. base64는 동기라 없던 구멍 | 캡처 전 clone의 `<img>` decode()·inline background-image 프리로드 대기(8s 상한, CDP·html2canvas 둘 다) — `e63f5c4` | 小 (수정 완료·캐시 비우고 즉시 export 2회 정상) |

## 5. 기능 단위 (Planner→Generator→Evaluator)
| 유닛 | 내용 | 의존 |
|---|---|---|
| U1 | `externalizer.js` 모듈 + main.js 저장로직 공유화 + 단위 하네스(더미 json: v2·v1·혼재·실패주입) | — |
| U2 | 트리거 3종(load 분기 · IPC 2개 · preload) + settings 키 + 폴백체인 + meta 마커 | U1 |
| U3 | 설정>성능 UI: 토글 · 버튼 재배선 · 되돌리기 · 상태표시 · 1회 토스트 — **디자인 일관성 검수 게이트**(기존 `settings-btn`/`settings-api-status`/토글 패턴 재사용, 신규 CSS 0) | U2 |
| U4 | 리허설 스크립트(격리 user-data-dir + 9360) + 결과표 | U2 |
| U5 | .gdt goya-asset 동봉 (권고 포함) | — (병렬) |
| U6 | Figma 재인라인 (권고 포함) | — (병렬) |
| U7 | 협업 정책 = ⓑ 확정: `projects:load` 자동변환 분기에서 협업 등록 프로젝트 제외 + 토스트(U2에 흡수) | U2 |

## 6. 리허설 계획 (반드시 통과 · 라이브 무접촉)
- 격리: 레거시 대표 프로젝트 **사본**을 `/tmp/goya-batch-rehearsal/projects/`로 복사 → `electron . --user-data-dir=/tmp/goya-batch-rehearsal --remote-debugging-port=9360`(SMOKE 문서 커맨드). 9334/9335·원본 폴더 미접촉. 정리는 user-data-dir 기준(notes 함정 참조).
- 대상: 108MB(54refs) · 94.5MB · 50.4MB(goya 혼재) · 12.1MB(140refs 소형 다수) · v1 포맷(있으면) · base64 0(noop) = 6개.
- 체크(각 프로젝트):
  1. 디스크 base64 0 · 섹션/페이지 수 동일 · 참조 에셋 전부 존재
  2. 렌더러에서 모든 goya-asset 이미지 실제 로드(`Image()` onload 수 = 참조 수)
  3. 변환 전/후 섹션 1 PNG export 바이트 크기·해시 비교(시각 동일성)
  4. 변환 후 편집 1회 → autosave → 디스크에 base64 재유입 0
  5. **reload 경로**: 수동 변환 → reload 시 beforeunload 동기저장이 base64를 되돌리지 않는지(`_dirtySinceSave` false 경로)
  6. 탭 전환(레거시↔변환) 후 저장 → 변환 유지
  7. 되돌리기 → base64 수·섹션 수 = 원본, 다시 변환 → 동일 결과(멱등)
  8. 복제 → 하드링크 에셋 공유·URL 재매핑
  9. .gdt export→import(새 user-data-dir) 이미지 수 일치 — U5 전엔 **실패가 정상**(증거 확보)
  10. 시간·main 블로킹·메모리(108MB 기준) — 3초 초과면 worker_threads 검토
- 결과표를 이 문서 §9에 추가한 뒤 지디 → 현빈 G2 상신.

## 7. 리스크 · 함정
- **탭 캐시**: 탭 전환은 `targetTab._cache`(JSON 문자열)로 복원한다 → 수동 변환 후 reload 없이 탭을 오가면 base64 DOM이 복원돼 autosave가 되돌릴 수 있다. 대응: 수동 경로는 항상 reload(현행과 동일), 열 때 경로는 `_cache` 자체가 변환본.
- **beforeunload 동기저장**(`projects:save-sync`)은 DOM을 그대로 쓴다 → reload 직전 dirty면 base64가 되돌아온다. 대응: 수동 경로에서 flush 후 `_dirtySinceSave=false` 확인 뒤 reload(리허설 5).
- **협업 중 프로젝트**(§4-C) — 결정 전까지 자동변환 제외.
- **구버전 앱**(0.7.x)은 goya-asset을 모른다 → 변환된 프로젝트를 0.7.x로 열면 이미지 공백. 자동업데이트로 0.8.x 통일 전제. pre-externalize 백업으로 복구 가능(문서화).
- main 블로킹: `projects:load`는 현재 동기 핸들러. 108MB 문자열 + sha256 27MB → 예상 1~3s(로딩 오버레이 중). 측정 후 판단.
- `proj_history`(2.2GB base64)·`proj_backup.json`은 손대지 않는다(자연 교체). 백업 폴백 체인이 base64 본을 돌려줘도 데이터는 보존된다(변환 상태만 잃음 → 다음 열기에 재변환).
- 변환 중 크래시: rename 전이면 원본 무손상, rename 후 write 전 크래시면 `proj.json` 부재 → 폴백 체인(backup/history/**pre-externalize**)이 살린다. write는 atomic.

## 8. 롤백
- 기능 전체: feature 브랜치 미머지. 설정 기본 OFF라 머지돼도 사용자 무영향.
- 프로젝트 단위: §3-2 ③ 되돌리기(UI) 또는 수동 `mv proj_pre-externalize.json proj.json`.

## 9. 리허설 결과
### 9-1. 1차 (2026-08-20, 격리 9360 · 라이브 사본 6개 · U1~U3 커밋 시점) — 35/37 → 정정 후 전항목 PASS
| # | 항목 | 결과 |
|---|---|---|
| 1 | 디스크 base64 0 · 섹션/페이지 수 동일 · 참조 에셋 존재 | PASS — 108MB→0.22MB(섹션 33) · 94.5MB→0.50MB(102) · 50.4MB→0.25MB(46) · 12.1MB→0.49MB(51) |
| 2 | 렌더러에서 goya-asset 전부 로드 | PASS — 16/16 · 11/11 · 11/11 · 15/15 |
| 3 | 변환 전/후 PNG export 동일 | PASS — 섹션1 바이트 동일(46,130B md5 일치) · 섹션2 레거시=재변환 3,162,041B 동일. ★첫 export(콜드)만 78KB → D 발견·수정(`e63f5c4`) 후 캐시 비우고 즉시 export 2회 정상 |
| 4 | 변환 후 편집→autosave→base64 재유입 0 | PASS (4프로젝트) |
| 5 | 수동 변환→reload 시 beforeunload 동기저장 무해 | PASS |
| 6 | 탭 전환(변환본↔변환본, 캐시 복원) 후 저장 → 유지·올바른 탭에 저장 | PASS |
| 7 | 되돌리기 → 변환 전 상태·백업 소비·마커 제거 → 재변환 멱등(에셋 16/16 재사용) | PASS (수동 경로는 flush→변환이라 백업=변환 직전 상태, 원본과 updatedAt만 다름 — 의도) |
| 8 | 복제 → 하드링크 공유·URL 재매핑 | PASS (inode 동일, 구 id 참조 0) |
| 9 | .gdt export→import 이미지 수 일치 | U5 후 기입 |
| 10 | 시간·블로킹 | 108MB 수동 1.6s · 94.5MB 열 때 1.3s · 50MB 0.76s · 12MB 0.26s(main 동기, 로딩 오버레이 중) · RSS 피크 +~600MB 일시 → worker 불필요 |
| + | 정책 OFF 힌트 1회 · 협업 제외+힌트 · 소형 noop · 신규 이미지 자동 외부화 회귀(공유 저장함수) | PASS |
| + | 설정>성능 UI 디자인 일관성(이스터에그 토글과 동일 클래스·신규 CSS 0) | PASS (스크린샷 u3-perf-*.png) |
발견·수정: ⓐ scan이 assetsTree 썸네일(8KB)까지 세어 변환완료본이 «인라인 12개»로 보임 → 캔버스만 집계 ⓑ D(export 타이밍) ⓒ 협업 수동 경로 force 게이트.
### 9-2. 최종 (2026-08-20, U5·U6 포함 `af085ef` 시점 · 사본 리셋 후 전체 재실행 · 격리 9360) — **전항목 PASS**
| 드라이버 | 결과 |
|---|---|
| qa-u4.mjs (S1~S9: OFF 힌트·수동변환·reload·autosave·되돌리기·재변환·ON 자동변환 3종·협업 제외·noop·복제) | **36/36** |
| qa-tabs-shot.mjs (탭 왕복 캐시 복원·올바른 탭 저장·설정 UI 상태/되돌리기 노출/noop) | **8/8** |
| qa-export-cold.mjs (캐시 비우고 열자마자 PNG export ×2) | 2라운드 바이트 동일(3,162,042 / 3,415,158) |
| .gdt 왕복(함수 직접 호출, 사본) | goya 22 동봉·누락 0 → import 후 base64 22 복원·섹션 46=46·참조 에셋 11/11 바이트 동일 |
| Figma 인라인(인앱) | 46섹션 goya 11→0, data URI 11, 10/10 해결 |
| 단위 하네스 | externalizer 13 · gdt-goya 4 · figma-goya 8 = 25/25 |
| 열 때 변환 시간(main 동기) | 94.5MB 1.70s · 50.4MB 0.81s · 12.1MB 0.24s · 108MB 수동 2.8s(첫 실행)/1.4s(재변환) |
| 렌더러 콘솔 오류(uncaught/TypeError/ReferenceError) | 0 |

커밋 순서: `dd3fe61` 설계 → `cbb3157` U1 → `0af1f31` U2 → `0f9d93d` U3 → `e63f5c4` export 타이밍(D) → `b71b005` 협업 force+§9-1 → `9a7e9f7` U6(Figma) → `af085ef` U5(.gdt). 머지 금지 유지.

### 9-3. 데이터손실 수정 사이클 (2026-08-20, 독립 적대적 리뷰 `REVIEW-data-loss-20260820.md` 대응 · 태양)
독립 리뷰가 치명2·높음4·낮음5를 제기. 각 발견을 코드에서 재확인(럽버스탬프 금지)해 트리아지하고, 확정건을 수정.

**트리아지 표**
| # | 심각도 | 판정 | 근거(코드 재확인) | 조치 |
|---|---|---|---|---|
| **F1** | 치명 | **진짜(설계 위반 회귀)** | main.js 폴백 체인이 `backup → pre-externalize → history` 순 — 첫 파싱성공본 채택(mtime 비교 0). DESIGN §3-1은 "체인 **맨 끝**에 pre-externalize"라 명시. pre-externalize는 변환 시점 고정본(안 늙음 아님, **늙음**) → 잘린 backup 뒤에서 한 달 늙은 원본이 최신 history를 이겨 덮어씀. | pre-externalize push를 **history 루프 뒤로** 이동(설계와 일치). `main.js:1127-1153`. 복구 토스트에 pre-externalize=«오래된 상태일 수 있음» 명시(`save-load.js`). |
| **F2** | 치명 | **진짜** | rollbackExternalize가 현재 proj.json(=변환 이후 작업)을 **롤링 proj_backup.json**(다음 autosave가 1.5초 뒤 덮음)에만 남김. 파일 헤더가 스스로 "롤링은 되돌리기 지점 불가"라 적고도 유일 보관처로 씀. | 보관처를 **전용 `proj_pre-rollback.json`**(autosave 무접촉)으로. dryRun 진단(ageDays·섹션 현재→복원)을 반환해 확인창이 «며칠 전·섹션 N→M개 사라짐»을 실수치로 경고. `externalizer.js:259-`, `settings-modal.js`, preload/main 배선. |
| **F3** | 높음 | **진짜(자동경로 한정)** | externalizeProjectFile이 updatedAt 미갱신 → 열 때 자동변환 후 fileTs=마지막 autosave. initLoad의 `lsTs+500>fileTs`가 성립해 base64 남은 LS 스냅샷 우선 → DOM base64 복원 → recordExternalizeBaseline이 base64 베이스라인 → 다음 autosave가 외부화 무효화. 회전본(`proj_pre-externalize.<ts>.json`)도 상한 없이 적립. | 변환 시 **updatedAt=변환시각 갱신**(fileTs>lsTs → 파일 우선). 마커 `at`도 opts.now 일치. 회전본 **상한 2**. `externalizer.js`. |
| **F4** | 높음 | **진짜** | 되돌리기 UI에 flush/autosave 억제 없음. 큐잉된 autoSaveTimer는 발화 콜백이 `_suppressAutoSave`를 **재검사 안 함** → 되돌리기가 파일 복원+백업 unlink 후 큐가 터져 외부화본 재기록(파일 안 되돌아감·복구지점 소멸). | 되돌리기 직전 `cancelPendingAutoSaveForReload()`(타이머 취소+suppress+dirty 해제) 신설·호출. 성공 시 봉인 유지→reload가 리셋, 실패 시 해제. `save-load.js`·`settings-modal.js`. |
| **F5** | 높음 | **진짜(좁음)** | 협업 게이트가 `try{...collabRef...}catch(_){}` — meta 파싱실패 시 collabRef=null→변환 진행(fail-open). meta는 수시 재기록돼 잘릴 수 있음. | **fail-closed** — meta가 «존재하는데 못 읽으면» 보류(부재=정상 비협업은 진행). 자동=`meta_unreadable` 힌트, 수동=collab로 간주(force override 가능). `main.js`·`asset-externalize.js`. |
| **F6** | 높음 | **진짜(데이터손실 아님·정직성)** | skipped>0(일부 저장 실패로 base64 잔존)에도 ok:true→`externalized` 성공 이벤트→토스트가 «완료»로 표시. `remaining`은 계산만 하고 미검사(dead). ※같은 정규식이라 «미수집» 누수는 실제로 불가하나 방어 게이트로 남김. | `remaining`을 **실게이트**로(치환 후 잔존=skippedURI 등장횟수와 정확히 일치, 초과 시 막음). skipped>0이면 자동 토스트가 «N장 변환 실패로 원본 유지» 부분완료 통지. `externalizer.js`·`asset-externalize.js`. (수동 경로는 기존에 이미 skipped>0 경고함.) |
| F7~F11 | 낮음 | 보류(이번 사이클 미착수) | atomicWrite ENOSPC .tmp 누수(상위 catch가 원본계약 지킴)·flat 레이아웃·복제 유령마커·prefix 치환(성립조건 좁음)·에셋 무결성 size>0뿐. | 데이터손실 아님 → 별건. |

**재리허설(실재현) — `_context/rehearsals/data-loss-fix-rehearse.js` · Electron 없이 데이터손실 경로만, 27/27 PASS**
격리 리허설이 「전항목 PASS」로 놓쳤던 이유(격리 user-data-dir라 LS 비었고 수동 flush가 updatedAt 갱신)를 겨냥해 **실재현**으로 보강:
| 시나리오 | 재현 | 결과 |
|---|---|---|
| F1 크래시 창 | proj.json 잘림 + 롤링 backup 잘림(copyFileSync 중 크래시) + 늙은 pre-externalize + 최신 history | **최신 history 복구**(늙은 pre-externalize 아님) ✓ |
| F2 한 달 후 되돌리기 | 변환(opts.now=한달전)→섹션 추가 편집→dryRun 진단(ageDays 31·섹션 3→2)→되돌리기 | 현재작업이 **proj_pre-rollback.json** 보존·원본 복원·백업 소비 ✓ |
| F3 LS 채운 자동경로 | initLoad의 `lsTs+500>fileTs` 판정 복제 | 수정 전=LS(base64) 우선(버그 재현)·**수정 후=파일(goya) 우선** ✓ |
| F3 updatedAt/회전 | 변환 후 updatedAt 갱신·회전본 상한 2 | ✓ |
| F6 부분실패 | 유효+빈(`base64,A`) 혼합 | ok:true·**skipped≥1**·성공분만 치환 ✓ |
| 왕복 | 변환→되돌리기 | 섹션/base64 원상 ✓ |
> ⚠️ F4(렌더러 autosave 봉인)·F5 UI 토스트는 Electron/CDP 필요분 — 모듈·판정 로직 레벨로 검증. 기본 OFF 유지·G2 미상신.

### 9-4. 라운드2 — 독립 «재검증» 대응 (2026-08-20, `REVIEW-2-reverify-20260820.md` · 태양)
재검증이 F1·F3·F5 «막힘» 확인 + F2·F4·F6 «부분»·신규손실 2건·깨진 단위테스트 1건 지적. 머지 전 필수 3건 + 권장 2건 모두 조치.

**머지 전 반드시(3) — 완료**
| # | 지적 | 조치 | 검증 |
|---|---|---|---|
| ① | **깨진 단위테스트**(수정자가 기존 스위트 미실행). `externalizer.test.js:166`(F2로 무효)·`:173`(F3 updatedAt로 불성립) | :166→`proj_pre-rollback.json` 확인+`proj_backup.json` 미접촉 단언, :173→updatedAt 필드만 제외하고 deepEqual. | `node --test` **전체 스위트 28/28**(externalizer 16·figma 8·gdt 4). ★gdt는 `yauzl` 필요 → node_modules 심링크 후 실행(작업 후 제거). |
| ② | **(높음·데이터손실) F4 큐 경로**: 봉인이 타이머·beforeunload는 막지만 `_pendingSaves` 대기열·`_isSavingToFile` in-flight는 안 비워 → 되돌리기 중 저장이 복원본 재덮음, backup 이미 unlink → 복구지점 소멸·UI는 「✓」. | `cancelPendingAutoSaveForReload`를 async로: ⓐ타이머 취소 ⓑ`_pendingSaves.clear()` ⓒ`_isSavingToFile` **드레인 대기**(상한 5s). 되돌리기 핸들러가 rollback IPC 전 `await`. | 리허설 F4 모델(봉인 3경로·드레인·타임아웃) PASS. |
| ③ | **(신규회귀) 되돌리기 실패시 dirty 미복구**: `_unseal`이 suppress만 되돌리고 `_dirtySinceSave`=true 복구 안 함 → 봉인때 타이머취소로 LS도 없어 실패직전 편집이 DOM에만 존재 → Cmd+R 시 1305가드 조기return→소실. | `resumeAutoSaveAfterAbortedReload` 신설(suppress 해제 + dirty 재표시 + `scheduleAutoSave()` 재무장), 실패 경로 `_unseal`이 호출. | 리허설 F4 실패복구 모델 PASS. |

**G2 전 권장(2) — 완료**
| 지적 | 조치 |
|---|---|
| **F2 pre-rollback 무회전**(변환→되돌리기→재변환→되돌리기면 2차가 1차 보관본 덮음)·ageDays null이면 경고 최약 | rollback이 기존 `proj_pre-rollback.json`을 타임스탬프로 **회전**(상한 2). 확인창에 ageDays null이면 「⚠️ 변환 시점 불명 — 이후 모든 편집 사라질 수 있음」 강경고 추가. |
| **F6 절단클래스**(base64 중간 개행→strict 정규식이 앞절반만 잡아 반토막 저장·「완료」 오보) | 매치 직후가 «공백+base64»면 절단으로 판정 → **건드리지 않고** 원본 인라인 유지·skipped 집계(정직 통지). 절단분만 있으면 `all_base64_truncated`로 정직 실패(원본 무손상). ★공유-계약 정규식은 불변(post-match peek만 추가). |

**재검증이 짚은 경미/잔여**
- F5 수동경로가 meta손상을 「협업중」으로 안내(정확히는 불명) — 보수적 차단 유지(force override 가능), 문구는 협업 톤. G2 영향 없음.
- F3 시계역행(NTP) 경계 — 좁은 여지, 미대응. 홈목록 sort 최상단 점프+날짜 오늘(1회성, 무해).
- **★G2(기본 ON) 여전히 불가**: 대형 2건(108MB·94.5MB) 표본 밖 + 절단클래스는 skip으로 «막았»으나 대형 실측 미완. G2 재상신 전 「대형2건 실측 + 절단 skip 실측」 필요.

**커밋(라운드2)**: 단위테스트 갱신 · externalizer(F6 절단 skip·F2 회전) · save-load(F4 async 봉인/드레인+실패복구) · settings-modal(await 봉인·ageDays 강경고·실패 resume) · 리허설 32/32 + 본 §9-4. 머지 금지·기본 OFF 유지.

### 9-5. 라운드3 — «3차» 재검증 대응 (마지막 머지 블로커) (2026-08-20, `REVIEW-3-verify3-20260820.md` · 태양)
3차 재검증이 ③·①·F2 «막힘» 확인 + ②(F4 큐)는 «절반»(구멍 2개, 하나는 ②가 막으려던 그 데이터손실). 필수 2건 + 권장 2건 조치.

**머지 전 반드시(2) — 완료**
| # | 구멍 | 조치 | 검증 |
|---|---|---|---|
| 구멍1 | **(높음·데이터손실)** 드레인 타임아웃 반환값을 호출측이 버림. `save-load.js`가 `!_isSavingToFile` 반환하지만 `settings-modal.js:342`가 값 무시 → 5s 초과(대형 autosave 1회가 넘길 수 있음) 시 in-flight 저장 살아있는 채 rollback IPC 나감 → 복원본 재덮음·backup 이미 unlink. | 되돌리기 핸들러가 반환값 사용 — **false면 rollback IPC 안 내보내고** 「저장 중이라 되돌리지 못했습니다, 잠시 후 재시도」로 중단+`_unseal`. | `save-reload-seal.test.mjs` 구멍1 케이스 + 리허설. |
| 구멍2 | **(중·신규손실)** `_pendingSaves.clear()`가 «다른 프로젝트» 대기분까지 버림. 탭A 편집→탭B 전환(A 큐 적재)→B서 되돌리기→clear로 A 폐기→A 마지막 ≤1.5s 편집이 파일·LS 양쪽에 소실. | 전체 clear 대신 **`activeProjectId`(되돌리기 대상)만 삭제**. 순수 함수 `clearPendingForReload(map, targetId)`로 분리(실코드 테스트 대상). | `save-reload-seal.test.mjs` 구멍2(타 프로젝트 보존) + 통합 케이스. |

**머지 전 권장(2) — 완료**
| 지적 | 조치 |
|---|---|
| **테스트 공백**: ②③은 단위테스트 0건, 리허설 F4는 «손으로 쓴 seal 가짜모델»이라 구멍을 원리적으로 못 잡음 | F4 봉인 결정 2개를 순수 ESM 모듈 `js/io/save-reload-seal.js`로 분리(save-load.js가 실제 import·호출) → **실소스를 그대로 import 하는** 단위테스트 `tests/unit/save-reload-seal.test.mjs`(구멍1·2 회귀방지). ⚠️렌더러는 ESM `.js`(형제 모듈과 동일 로드, 무위험), Node는 package type=commonjs라 직접 import 불가 → 테스트가 «바이트 동일 .mjs 별칭»으로 복사해 import(내용 동일). 리허설 F4 모델도 라운드3 동작으로 교정. |
| ③ `resumeAutoSaveAfterAbortedReload`가 dirty 무조건 true → DEF-03(무편집 방문 오염방지) 되돌림 + 협업 발화 / 「성공인데 reload 막힘」 시 suppress 영구고착 | dirty를 **봉인 직전값으로만 복원**(무편집이면 재저장 안 함). 성공 후 **3s 백스톱** — reload가 실패/차단돼 페이지 살아있으면 `resume` 호출(suppress 고착·편집 무증상 소실 방지). |

**막힘 확인(재작업 불요, 3차 명시)**: 필수③ dirty복구(실패·예외 양쪽 resume ✔)·필수① 테스트(:166 강화·:173 정당·신규3 ✔)·F2 회전(원본3종 무접촉 ✔)·② 데드락 없음·순서 정상 ✔.

**테스트/리허설**: `node --test` 전체 **33/33**(externalizer 16·figma 8·gdt 4·save-reload-seal **5**). 리허설 **33/33**(F4 전체 플로우: 구멍1 중단·구멍2 타프로젝트 보존·③ dirty복원). ⚠️gdt는 `yauzl`(node_modules 심링크 후 실행, 작업 후 제거).

**G2-scope(머지 후·별건, 3차 확인)**: F6 렌더러 new-only 절단 corruption(`asset-externalize.js`, ★기존 잠복·이 브랜치 회귀 아님)·F6 수동경로 UX(절단분 skipped 합산→「재시도」+새로고침 안 함=절대완료 안 됨 → truncated/save-fail 사유 분리)·noop 매오픈 힌트·대형 2건(108/94.5MB) 실측+절단 skip 앱 실측.

**커밋(라운드3)**: save-reload-seal 모듈+save-load 배선(구멍1·2·③) · settings-modal(반환값 사용·백스톱) · 실코드 단위테스트 · 리허설 교정+§9-5. **머지(기본 OFF): 위 2줄로 조건 충족**(지디 diff 검증 후). 머지 금지·기본 OFF 유지.

### 10. G2(기본 ON) 상신 전 남은 것 / 인계
- **현빈 G2 결정 자료** = 이 문서 §9. 기본 ON은 `DEFAULT_SETTINGS.autoExternalizeOnOpen`(main.js)와 settings-store FALLBACK 두 곳만 true로 바꾸면 된다(1커밋).
- ⚠️ 외부 스킬 `goditor-figma-loop/figma_export.py`는 아직 `window.buildFigmaExportJSON`(비인라인)을 CDP로 부른다 → `await window.buildFigmaExportJSONInlined(ids,nodeMap).then(r=>r.json)`으로 교체 필요(지디 소유).
- 협업(C)의 근본해결(서버 에셋 제공자)은 신규 웹고디터 P2.
- 변환된 프로젝트를 0.7.x 앱으로 열면 이미지 공백(goya-asset 미지원) — 자동업데이트로 0.8.x 통일 전제.
- `proj_history`(2.2GB base64)는 건드리지 않았다(자연 교체).
