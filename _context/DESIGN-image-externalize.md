# 설계: 캔버스 인라인 base64 이미지 외부화 + lazy 렌더 + 복제 최적화

브랜치: `feature/image-externalize` (worktree: `/Users/a1/web-editor-taeyang`, base: dev)
작성: 태양 / 검토대기: 현빈

## 1. 문제 / 실측
- proj.json v2: `{ version:2, currentPageId, pages:[{id,name,label,pageSettings,canvas}], checklistItems, checklistSections, imageGallery, assetsTree, id, name, ... }`
- 거대화의 원인은 **`pages[].canvas` HTML 문자열 안의 인라인 base64**.
- 실측(proj_1780630539284, 85.6MB): canvas[0] len ≈ 85.6MB, `data:image` 26건.
  - base64 carrier 분포: `data-bg-img="data:..."` ×7, `data-img-src="data:..."` ×1, `src="data:..."` ×1, 인라인 `style ... url(data:...)` ×12 (= 위 data-* 속성의 렌더된 형태). 즉 **하나의 논리 이미지가 data-* 속성(직렬화 소스) + 인라인 style url()(렌더 형태) 양쪽에 중복 저장**됨.

## 2. 기존 인프라 (재사용)
- **폴더-per-project 레이아웃 이미 존재**: `PROJECTS_DIR/<id>/{proj.json, proj_backup.json, proj_meta.json, proj_history/, images/, assets/}`.
- **blobPath 규약 이미 존재**: `assets:saveFile/readFile/deleteFile`, `ai:saveImage/readImage/deleteImage` → `assets/ast_xxx.png`, `images/aig_xxx.png` 디스크 저장. 렌더러는 IPC로 dataUrl 받아 표시(assets-panel.js, ai-image-gallery.js). **캔버스 이미지만 base64로 박혀 있음** = 우리가 메울 마지막 구멍.
- **duplicate(`_duplicateProjectImpl`)**: 이미 `images`/`assets` 서브폴더를 `fs.cpSync`로 복사 + `blobPath` 워크리라이트. → 하드링크/공유로 바꿀 지점이 국소적.
- BrowserWindow: `contextIsolation:true, nodeIntegration:false, sandbox:false`, `loadFile`(file:// origin). 커스텀 프로토콜/IntersectionObserver **없음**.
- 직렬화 seam: `getSerializedCanvas()`(clone 정리 후 innerHTML 반환) → `serializeProject()`.
- 복원 seam: `applyProjectData()` → `canvasEl.innerHTML = sanitizeCanvasHtml(page.canvas)` → `rebindAll()`.
- export: **html2canvas가 live DOM 읽음**(export-image.js), export-html은 `clone.innerHTML` 덤프. → 풀해상도 보장하려면 export 시 전 섹션 이미지가 로드된 상태여야 함.

## 3. 저장 포맷 (asset 경로 스킴)
- asset 파일: `PROJECTS_DIR/<id>/assets/<contenthash>.<ext>` (기존 assets 폴더 공유. content hash = sha256(raw bytes) 앞 16hex).
  - dedup: 동일 바이트 → 동일 파일명 → 자동 1회 저장.
- 캔버스 참조: **커스텀 프로토콜 URL** `goya-asset://<projectId>/<filename>`.
  - data-* 속성과 인라인 style url() 모두 이 URL로 치환.
  - 직렬화 시 인라인 `style`의 `url(data:...)`는 **제거**(data-* 속성만 진실원본으로 남기고, 복원 시 style을 재구성) → canvas HTML에서 base64 완전 제거 + 중복 제거.
- proj.json엔 base64 0건, 참조 URL만. 목표 수십 KB.

### 매니페스트(선택)
proj_meta.json(또는 proj.json `assetManifest`)에 `{ hash: {ext, bytes, w, h, refs} }` 기록 — GC(미참조 asset 정리)·export·썸네일에 활용. v1: proj.json에 `assetManifest` 옵셔널 키 추가(하위호환: 없으면 무시).

## 4. 커스텀 프로토콜 (핵심)
main.js:
- `protocol.registerSchemesAsPrivileged([{ scheme:'goya-asset', privileges:{ standard:true, secure:true, supportFetchAPI:true, stream:true, bypassCSP:true } }])` (app ready 이전).
- `app.whenReady` 후 `protocol.handle('goya-asset', req => ...)`: URL → `<projectId>/<filename>` 파싱, `PROJECTS_DIR/<id>/assets/<filename>` path-traversal 가드 후 `net.fetch(pathToFileURL)` 또는 stream 응답. 적절한 Content-Type.
- 이점: 브라우저가 디스크에서 직접 로드/캐시/lazy, JS heap에 base64 없음, html2canvas가 `useCORS`로 읽기 가능(secure+standard).

## 5. 직렬화 시 외부화 (renderer)
`getSerializedCanvas()` 끝(clone 단계)에서 `externalizeAssets(clone, projectId)`:
1. clone 내 모든 `data:image` 수집(속성 `data-img-src`,`data-bg-img`,`src`, 인라인 style url()).
2. 각 base64 → IPC `assets:saveCanvasImage({projectId, b64, mime})`(신규, content-hash dedup, blob 반환) → `goya-asset://<id>/<file>`.
3. 동일 base64는 메모리 맵으로 1회만 IPC.
4. data-* 속성 값을 URL로 치환, 인라인 style의 `url(data:...)`는 제거(복원이 data-*로 재적용).
- 성능: 직렬화는 자주 일어나므로, **이미 `goya-asset://`인 건 skip**. base64 → asset 변환은 (a)이미지 삽입 시점에 즉시 외부화하거나 (b)최초 1회 직렬화 시. 기본: 삽입 시 외부화(아래 9) + 직렬화 안전망.

## 6. 복원/렌더 (renderer)
`applyProjectData()` → innerHTML 주입 후, 신규 `hydrateAssets(canvasEl)`:
- data-* 속성이 `goya-asset://`면 그대로 둠(프로토콜이 로드). 인라인 style url()은 data-* 기준으로 재적용(블록별 기존 렌더 로직과 합치 — block-factory의 `dataset.bgImg`→`style.backgroundImage` 경로 재사용).
- 하위호환: data-*가 `data:image`(구 프로젝트)면 그대로 동작(아무 것도 안 함) → **기존 프로젝트 무손상 로드**.

## 7. 마이그레이션 (하위호환 필수)
- **로드 시 비파괴**: 구 base64 프로젝트는 변환 없이 그대로 렌더(프로토콜/외부화는 신규 저장에만 적용).
- **첫 저장(또는 명시 "최적화" 액션) 시 외부화**: 직렬화 경로가 base64를 만나면 asset으로 추출 → 다음 저장부터 proj.json 축소. 자동/점진적.
- 명시 액션(옵션): 프로젝트 메뉴 "이미지 최적화" → 전 페이지 canvas 외부화 후 1회 저장.
- 롤백: feature 브랜치 미머지. 외부화는 추가 파일 생성형이라 원본 proj.json은 백업(proj_backup.json/history)으로 보존됨.

## 8. Lazy 렌더 (뷰포트 가상화)
- `IntersectionObserver`로 `.section-block` 관찰. 화면 밖 섹션은 이미지 src/bg를 placeholder로 언로드(`goya-asset://` URL은 dataset에 보관, style만 비움), 진입 시 복원.
- 프로토콜 기반이라 브라우저 네이티브 캐시와 결합 — 언로드/리로드 비용 낮음.
- 직렬화는 dataset(원본 URL)에서 하므로 언로드 상태와 무관하게 정확.
- 안전판: export/썸네일/figma publish 전 `materializeAllSections()`로 전 섹션 강제 로드.

## 9. 이미지 삽입 시 즉시 외부화
image-handling.js 등 FileReader/readAsDataURL 경로에서, base64를 DOM에 넣는 대신 IPC로 asset 저장 후 `goya-asset://` 사용(점진 도입; 1차는 직렬화 안전망으로 충분).

## 10. 복제 최적화 (하드링크)
`_duplicateProjectImpl`의 `assets` 복사를 `fs.cpSync` → 하드링크(`fs.linkSync` per file, 동일 볼륨)로. content-hash라 불변 → 공유 안전. 폴백: 링크 실패(크로스볼륨) 시 copy. blobPath/URL은 projectId 포함이므로 워크리라이트 유지(`goya-asset://<oldId>` → `<newId>`).

## 11. 리스크
- html2canvas가 `goya-asset://` 못 읽으면 export 깨짐 → 프로토콜 secure+standard+useCORS로 해결, export 전 materialize + 실패 시 dataURL 폴백.
- 직렬화 비용(매 저장 IPC) → dedup 맵 + 이미 외부화된 건 skip.
- autosave 중 외부화 race → 기존 `_suppressAutoSave`/atomic write 활용.
- 미참조 asset 누적 → 매니페스트 기반 GC(저빈도).

## 12. 테스트 계획
- 더미 프로젝트(파테나/라이브 절대 금지)로: 구 base64 로드 OK / 저장→재로드 라운드트립(이미지 보존) / 복제(하드링크) / export PNG 풀해상도 / autosave 무결성 / before-after 크기.
- 헤드리스/CDP 스모크: 9334 라이브 금지, 별도 포트 또는 worktree 빌드 인스턴스.

## 13. 기능 단위 (Planner→Generator→Evaluator 병렬)
①프로토콜+asset 저장/로드(main+IPC) ②직렬화 외부화+복원 hydrate(renderer) ③마이그레이션/안전망 ④lazy 렌더 ⑤복제 하드링크 ⑥export materialize.
