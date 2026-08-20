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
### 9-2. 최종 (U5·U6 후 새 사본으로 전체 재실행) — _(대기)_
