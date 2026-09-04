# DESIGN — R1 (v0.9.1) 「사용자가 버전을 안다」 A1·A2·A3

> 태양 2026-09-04. 브리프 정본 = `~/.claude/skills/지디/handoff/R1-v0.9.1-brief.md`
> worktree `/Users/a1/web-editor-taeyang-r1` · 브랜치 `feature/r1-version-visibility` · base `origin/dev`(8d69afd)

---

## 0. 착수 전 실측 (기억 아님 — 전부 이번 세션에서 잰 값)

| 잰 것 | 값 | 출처 |
|---|---|---|
| 게시된 윈도우 자산(v0.9.0) | `GODITOR-Setup-0.9.0.exe` (176,599,329B) | `gh release view v0.9.0` |
| `latest.yml`(v0.9.0) | `path: GODITOR-Setup-0.9.0.exe` — 자산명과 일치 | 릴리스 다운로드 |
| 로컬 dist 파일명(기본 패턴) | `GODITOR Setup 0.9.0.exe` (**공백**) | `NsisTarget.installerFilenamePattern()` = `${productName} Setup ${version}.${ext}` |
| 로컬→게시 이름 변환 | 공백 → `-` **치환**(`computeSafeArtifactNameIfNeeded`) | `platformPackager.js` |
| 맥 업데이터 캐시 | **353MB** = `pending/GODITOR-0.8.6-arm64-mac.zip` 185MB + `update.zip` 185MB + `update-info.json` | `~/Library/Caches/sangpe-editor-updater` |
| 맥 설치본 버전 | **0.8.6** (= pending 페이로드와 같은 버전 → 이미 «소진»된 파일) | `/Applications/GODITOR.app` Info.plist |
| 윈(win-office) 업데이터 캐시 | `installer.exe` **176MB** + `current.blockmap` 183KB + `pending/` **비어 있음** | ssh `dir /s` |
| 윈 설치 폴더 | `%LOCALAPPDATA%\Programs\sangpe-editor\GODITOR.exe` (2026-08-29 빌드) | ssh `dir` |

### 0-1. ★브리프 수치와 다른 점 — 그대로 적는다
브리프는 「윈 `pending/` 337MB」라 했으나 **오늘 win-office 의 `pending/` 은 0바이트**다.
윈도우에서 176MB 를 물고 있는 건 `pending/` 이 아니라 **캐시 루트의 `installer.exe`** 다.
원인은 코드로 확정했다 → §1-2.

---

## 1. A1 — 「설치 완료 후 pending 삭제」

### 1-1. 파일이 생기고 남는 «정확한» 경로 (electron-updater 6.8.3 소스 실측)

캐시 루트 `cacheDir` = `getAppCacheDir()/<updaterCacheDirName>`
- 윈: `%LOCALAPPDATA%\sangpe-editor-updater` · 맥: `~/Library/Caches/sangpe-editor-updater`
- `updaterCacheDirName` 은 **패키징된 앱의 `resources/app-update.yml`** 에 박힌다(실측: `updaterCacheDirName: sangpe-editor-updater`).

| 파일 | 누가 만드나 | 설치 후 쓸모 |
|---|---|---|
| `pending/<자산명>` (윈 exe 176MB / 맥 zip 185MB) | `AppUpdater.executeDownload` | ❌ **없다(소진)** |
| `pending/update-info.json` | `DownloadedUpdateHelper.setDownloadedFile` | ❌ 위 파일을 가리킬 뿐 |
| `pending/current.blockmap` | `differentialDownloadInstaller` | ❌ 루트로 복사본이 이미 나감 |
| `pending/temp-<자산명>` | 중단된 다운로드 잔재 | ❌ 같은 이름 재시도 때만 회수됨 |
| **루트 `installer.exe`(윈)** | ★**NSIS 설치기 자신**(`installer.nsh:93` `copyFile "$EXEPATH" "$LOCALAPPDATA\...-updater\installer.exe"`) | ✅ **다음 업데이트의 차분 다운로드 기준파일** |
| **루트 `update.zip`(맥)** | `MacUpdater.done` 이 복사 | ✅ 동일(차분 기준) |
| 루트 `current.blockmap` | `executeDownload.done` 이 pending 에서 복사 | ✅ 동일 |

⇒ **§0-1 의 의문이 여기서 풀린다.** 윈도우는 NSIS 설치기가 «자기 자신을» 루트에 복사한다.
그래서 win-office 는 루트 176MB + pending 0. 맥은 그런 복사 주체가 없어 **pending 이 그대로 남는다**(오늘 185MB).

### 1-2. 그래서 무엇을 지우고 무엇을 남기나
- **지운다 = `pending/` 안 전부.** 설치가 끝났으면 재사용처가 없다.
  근거: electron-updater 자신도 캐시가 낡으면 `emptyDir(cacheDirForPendingUpdate)` 로 «통째 비운다»
  (`DownloadedUpdateHelper.cleanCacheDirForPendingUpdate`). 우리가 하는 것과 같은 조작이다.
- **남긴다 = 루트 `installer.exe` / `update.zip` / `current.blockmap`.**
  이건 「이전 설치파일」이 아니라 **다음 업데이트의 차분 기준**이다. 지우면 다음 업데이트가
  «전량 다운로드»로 퇴행한다(사용자 대역폭 손해). 브리프의 합격조건도 `pending/` 이다.
  ⇒ 절감: 맥 353MB→168MB, 윈 (pending 이 찰 때) 353MB→176MB.
  ⚠️ **이 판단은 「디스크를 최대한 비운다」가 아니다.** 루트 파일까지 지우길 원하면 별건으로 다시 지시받는다.

### 1-3. ★언제 지우나 — 「설치 완료 후」의 자리가 없다
윈·맥 **둘 다 설치는 «앱이 죽으면서» 일어난다**(윈=NSIS 를 spawn 후 quit, 맥=Squirrel.Mac 이 종료 시 교체).
그래서 `quitAndInstall()` 직후에 지우면 **설치기가 읽을 파일을 지운다** = 업데이트가 깨진다(브리프 ⛔ 그대로).

⇒ 정답 자리 = **다음 실행의 시작**. 그때 「pending 의 페이로드가 지금 도는 버전보다 새것이 아니면 소진된 것」이다.

```
정리한다  ⟺  version(pending) ≤ version(실행 중인 앱)
```

성립하는 경우들(전부 의도한 대로 동작):
- 업데이트 완료 후 첫 실행 → pending=0.9.0, 앱=0.9.1 … 아니다. pending=0.9.1, 앱=0.9.1 → **같음 → 지움** ✅
- 「나중에」 누른 뒤 **정상 종료** → 종료 시 설치 → 다음 실행 앱=신버전 → **지움** ✅
- 「나중에」 누른 뒤 **비정상 종료(설치 안 됨)** → 다음 실행 앱=구버전 < pending → **안 지움** ✅
  (그대로 두면 electron-updater 가 캐시를 재검증해 재다운로드를 건너뛴다)
- 오래된 잔재(0.8.6 페이로드 + 0.9.x 앱) → **지움** ✅ ← 오늘 맥의 실제 상태

### 1-4. 버전을 어디서 읽나 (2단)
1. **정본 = 우리 마커** `pending/goditor-pending.json` — `update-downloaded` 때 `info.version` 을 그대로 적는다.
   전체 semver 비교(프리릴리즈 포함).
2. **폴백 = 파일명 파싱**(마커 이전 버전에서 남은 잔재용). `\d+\.\d+\.\d+` **코어만** 읽는다.
   ⚠️ 함정: `GODITOR-0.9.1-arm64-mac.zip` 을 프리릴리즈로 읽으면 `0.9.1-arm64` 가 된다 → 코어만 읽어 회피.
   ⚠️ 대신 코어만 읽으면 `0.9.1-beta.1` vs `0.9.1-beta.2` 를 구분 못 한다 → **폴백은 보수적으로**:
   `코어(pending) < 코어(앱)` 이거나, 같을 땐 **앱이 프리릴리즈가 아닐 때만** 지운다.
3. 둘 다 못 읽으면 **안 지운다**(보수). 지우지 않은 이유를 로그에 남긴다.

### 1-5. 실행 위치·안전장치
- `setupAutoUpdater()` 안, **`checkForUpdatesAndNotify()` «앞»에서 await**. (뒤에 두면 갓 받은 pending 과 경합)
- 프로세스당 1회(`_ran` 가드).
- 캐시 디렉터리가 없으면 무동작. 예외는 전부 삼키지 않고 warn 로그로 올린다(조용한 실패 금지).
- 개발(비패키징) 실행은 `app-update.yml` 이 없어 `updaterCacheDirName` 을 못 읽는다 →
  **이름을 못 읽으면 무동작**(`app.getName()` 로 «추측»해서 엉뚱한 디렉터리를 지우지 않는다).

---

## 2. A2 — 「윈도우 산출물 파일명에 버전」

### 2-1. ★전제 정정 (지디 확인 완료)
버전은 **이미 들어 있다** — 릴리스 자산·드라이브 배포본·`latest.yml` 세 표면 전부 `GODITOR-Setup-0.9.0.exe`.
버전이 «없는» 윈도우 표면은 ⑴설치 폴더명(현빈이 후보에서 내림 ⛔) ⑵설치된 `GODITOR.exe`(넣으면 바로가기·`.gdt`
파일연결·제자리교체가 깨진다) 둘뿐이라 **「무엇을 고칠지」가 미확정**이다 → 현빈 회신 대기, **A2 는 완료로 닫지 않는다.**

### 2-2. 그래도 하는 것 = 이름을 «우연»에서 떼어낸다
지금 게시명이 맞는 건 electron-builder 가 **공백을 대시로 치환**해 주기 때문이다(우연). 그 치환이 바뀌거나
누가 `productName`/`artifactName` 을 건드리면 **게시명이 바뀌고 그 순간 구버전의 자동업데이트가 끊긴다.**

⇒ `build.win.artifactName` 을 **명시**한다:
```
"artifactName": "${productName}-Setup-${version}.${ext}"   →  GODITOR-Setup-0.9.1.exe
```
- 로컬 dist = 게시명 = `latest.yml` **3자 동일**(치환 경유 없음).
- 게시명은 **현행과 글자 하나 안 바뀐다** → 0.9.0 사용자 피드 무영향.
- `latest.yml` 은 같은 설정에서 나온다(`createBlockmap(installerPath, …, safeArtifactName)`)
  — 안전한 이름이면 `safeArtifactName=null` 이라 basename 이 그대로 쓰인다. **실측으로 확인한다**(§4).
- ⚠️ 남는 리스크: 사용자 지정 패턴은 **arch 접미사를 자동으로 안 붙인다**. 지금 win 타깃은 x64 «하나»라
  충돌이 없지만, **arm64 를 추가하는 날 두 산출물이 같은 이름이 된다.** 그때 `-${arch}` 를 넣어야 한다
  (그건 게시명 변경이므로 그 시점의 릴리스 노트/게이트 사안).

### 2-3. ★합격조건 = 「빌드됐다」가 아니라 「업데이트가 태워진다」
`0.9.0 → 0.9.1` 을 **실제로** 완주시킨다. ⛔GitHub 릴리스 게시는 안 한다(현빈 게이트) →
**로컬 generic 피드**(`http://<mini05>:8099/`)로 태운다. 대상 기계 = **mini05**(예비 윈도우, 현빈 실사용 PC 아님).

---

## 3. A3 — 「윈도우 탑바에 버전 표시」

- 현재 버전 표시는 **좌측 패널 로고 옆** `#logo-version-badge`(「BETA v0.9.1」)에만 있다(`js/editor.js:2172`).
  프로젝트 목록 화면(`pages/projects.html:930`)에도 같은 배지가 있다. **탑바에는 없다.**
- ⇒ `#topbar` 우측 배지 무리에 `#topbar-version-badge` 를 추가한다.
  **공용 클래스 `.tb-badge` 재사용**(룩어라이크 CSS 신작 금지 — 팀 규약). 인접 배지(`fsub`·`collab`·`mcp`)와 동일 어휘.
- 맥 충돌 없음: 신호등 여백은 탑바 **좌측**(`body.is-mac`)이고 이 배지는 **우측 무리**라 레이아웃이 안 밀린다.
- 좌측 로고 배지는 **그대로 둔다**(제거하면 프로젝트 목록 화면과 어휘가 어긋난다).
- 실패 시 «빈 배지»로 두지 않는다 — 값을 못 얻으면 배지를 아예 숨긴다(기존 로고 배지 주석의 규율과 동일 취지).

---

## 4. 검증 계획 (⛔「빌드됐다」는 합격이 아니다)

| # | 무엇 | 어떻게 | 합격선 |
|---|---|---|---|
| V1 | A1 결정함수 | node 단위테스트(양성·음성 대조 짝) | 소진/미소진/판정불가 전 케이스 |
| V2 | A1 맥 실측 | 실제 캐시(353MB, pending=0.8.6 zip, 앱=0.8.6)에 실행 | `pending/` **0바이트**, 루트 `update.zip` **보존** |
| V3 | A2 이름 3자 일치 | mini05 에서 github 설정 그대로 `--publish never` 빌드 | dist 파일명 == `latest.yml` path == `GODITOR-Setup-0.9.1.exe` |
| V4 | ★A2 업데이트 완주 | mini05: 0.9.0 설치 → 로컬 피드 → 0.9.1 자동업데이트 | 앱이 **0.9.1 로 재기동** |
| V5 | A1 윈 실측 | V4 직후 재실행 | `pending/` **0바이트**, 루트 `installer.exe` 보존 |
| V6 | A3 육안 | mini05 화면 캡처(현빈 PC 아님) | 탑바에 `v0.9.1` |

⚠️ 네이티브 업데이트 모달은 CDP 로 안 보인다(브리프) → V4 의 눈은 **화면 캡처**.
⚠️ mini05 는 DERP 경유(≈6MB/s) — 176MB 전송 대신 **mini05 에서 직접 빌드**한다.

---

## 5. 실행 결과 (2026-09-04 · 전부 실측)

### V1 — A1 결정함수 단위테스트 : **PASS 16/16**
`tests/unit/updater-cache.test.js`. 양성/음성 짝 + 부작용 «범위»(호출 전후 디렉터리 스냅샷 대조).

**★변이 스윕(5종)** — 「동작을 없애면 어느 테스트가 빨강이 되나」
| 변이 | 결과 |
|---|---|
| M1 판정불가=보존 제거 | 빨강 2 ✅ |
| M2 폴백 프리릴리즈 보수성 제거 | 빨강 1 ✅ |
| M3 파일명 파서를 전체 semver 로 | **처음엔 초록(=이빨 없음)** → 아래 |
| M4 삭제 범위를 캐시 루트로 확대 | 빨강 3 ✅ |
| M5 캐시 이름 못 읽으면 추측 | 빨강 1 ✅ |

★M3 이 살아남아 **테스트의 구멍을 찾았다.** 처음 변이가 no-op 이었던 것도 같이 드러났다(코어만 돌려주는
함수라 파서를 바꿔도 결과가 같았다). 진짜 위험은 **`decideCleanup` 의 폴백이 전체 semver 를 쓸 때**고,
그때 답이 뒤집히는 자리는 **앱이 프리릴리즈일 때 «하나뿐»**이다
(`0.9.1-arm64-mac` < `0.9.1-beta.1` — 'arm64' < 'beta' → 설치 대기분을 지워버린다).
그 케이스를 테스트에 추가하고 변이를 다시 걸어 **빨강 1** 확인.

### V2 — A1 맥 실측 : **PASS** (실제 캐시 · 실제 코드)
`resolveUpdaterCacheDir(/Applications/GODITOR.app/Contents/Resources/app-update.yml)`
→ `~/Library/Caches/sangpe-editor-updater` (실물 파일에서 이름을 읽음)

| | before | after |
|---|---|---|
| `pending/` | `GODITOR-0.8.6-arm64-mac.zip` 185,225,043 + `update-info.json` 173 | **`[]` · du 0** |
| 루트 `update.zip`(차분 기준) | 185,225,043 | **185,225,043 (무변경)** |
| 캐시 합계 | 353.3MB | **176.6MB** |

음성대조도 같이 쟀다 — 같은 pending 을 앱 0.8.5 로 판정하면 `clean:false`(「설치 대기 중」).

⚠️ **못 한 것**: «포장된 맥 앱이 부팅하며» 이 함수를 부르는 것까지는 안 봤다. 맥 릴리스 빌드는 서명/공증이
필요해 현빈 게이트고, `--dir` 빌드는 `app-update.yml` 을 안 만든다. 그리고 현빈 실사용 맥이라
GUI 앱을 띄우면 포커스를 뺏는다(⛔). **호출 배선은 윈도우 V5 에서 같은 코드로 증명됐고**,
맥 고유 부분(경로 해석)은 V2 가 실물로 증명했다.

### V3 — A2 이름 3자 일치 : **PASS** (mini05, github 설정 그대로 `--publish never`)
```
dist\GODITOR-Setup-0.9.1.exe      176,121,793
dist\GODITOR-Setup-0.9.1.exe.blockmap
dist\latest.yml →  url: GODITOR-Setup-0.9.1.exe / path: GODITOR-Setup-0.9.1.exe
```
로컬 파일명 = latest.yml = **v0.9.0 게시명과 같은 형식**(`GODITOR-Setup-0.9.0.exe`).
바뀐 것은 «공백→대시 치환에 의존하지 않는다»는 것뿐이다.

### V4 — ★A2 자동업데이트 완주 : **PASS**
구성: **GitHub 릴리스 v0.9.0 «정품 설치본»**(`GODITOR-Setup-0.9.0.exe` 176,599,329B, exe mtime 03:00:30Z)
→ `resources/app-update.yml` 만 로컬 피드로 교체 → mini05 로컬 HTTP 피드(`127.0.0.1:8099`)가 0.9.1 배포.

피드 서버 실측 로그(= 업데이터가 실제로 무엇을 요청했나):
```
10:18:08 200 latest.yml 343
10:18:08 200 GODITOR-Setup-0.9.1.exe.blockmap 518865
10:18:08 404 GODITOR-Setup-0.9.0.exe.blockmap      ← 차분 실패 → 전량 다운로드 폴백(정상 경로)
10:18:08 200 GODITOR-Setup-0.9.1.exe 526536438
```
결과: `pending/` 에 `temp-GODITOR-Setup-0.9.1.exe` → 완료 후 최종 이름으로 rename + `update-info.json`.
설치 후 **`APP_EXE_VERSION = 0.9.1.0`** (0.9.0.0 → 0.9.1.0).

⚠️ **경계 — 정직하게**: mini05 는 **모니터가 없다**(Electron 로그 `No displays detected`).
그래서 네이티브 업데이트 모달이 «뜨지 않아» 「재시작」 클릭 경로는 이 기계에서 못 눌렀다
(창 열거 0개, graceful `taskkill` 이 "창이 없다"로 거부). ⇒ 설치는 **electron-updater 가
`autoInstallOnAppQuit` 에서 spawn 하는 명령 그대로** 재현해 태웠다: `<pending>\GODITOR-Setup-0.9.1.exe --updated /S`.
안 태운 것은 «모달 버튼 → app.quit()» 배선 하나뿐이고, 그건 이번 변경이 손대지 않은 자리다.

### V5 — A1 윈도우 실측 : **PASS** (3종 대조)
| 케이스 | pending 전 | pending 후 | 판정 |
|---|---|---|---|
| ★실제 업데이트 직후(마커 **없음** = 정품 0.9.0 이 받은 것) | 527,055,774B | **0B** | 파일명 폴백으로 소진 판정 ✅ |
| 음성대조: 0.9.2 페이로드+마커(설치 대기) | 3,145,900B | **3,145,900B (보존)** | ✅ |
| 양성대조: 0.9.1 페이로드+마커(앱과 동일) | 3,145,900B | **0B** | ✅ |
| 양성대조: 0.8.6 페이로드, 마커 **없음**(구버전 잔재) | 3,145,900B | **0B** | ✅ |

전 케이스에서 캐시 루트 `installer.exe:526536438` · `current.blockmap:519167` **무변경**.
★첫 줄이 특히 중요하다 — 실제 0.9.0 사용자는 마커가 «없다»(마커 코드는 0.9.1부터다). 그 경로가 실측으로 돈다.

### V6 — A3 육안 + 실측 : **PASS**
mini05 dev 인스턴스 + CDP 로 에디터(`index.html`)를 열고 측정:
```
BADGE_TEXT    = "v0.9.1"
BADGE_CLASS   = "tb-badge"          (신작 CSS 0 — 공용 클래스 재사용)
BADGE_VISIBLE = display:flex 44x17 @ (1155,13)
```
**디자인 일관성 검수(계산된 스타일 대조)** — 인접 동종 배지와 «전부 동일»:
`font-size 10px · background rgb(42,42,42) · border rgb(58,58,58) · padding 2px 6px · radius 4px`
(fsub / collab / collab-invite / debug-port / mcp-info / mcp-token 6개와 값이 한 글자도 안 다르다.
`figma-bridge-badge` 만 다른데 그건 `.tb-badge--pill` 변형이라 원래 다르다.)
`#topbar` 가로 넘침 없음(`scrollWidth 1424 == clientWidth 1424`). 좌측 로고 배지는 `BETA v0.9.1` 그대로.
스크린샷 `qa/a3-editor.png` — 상단바 우측 `v0.9.1` 이 File 버튼 왼쪽에 보인다.
맥: `.is-mac` 규칙은 `#topbar { padding-left: 80px }` 하나뿐이고(신호등 자리, **좌측**) 이 배지는 우측 무리라 충돌 없음.

---

## 6. 부수 발견 — 보고 대상

### 6-1. ★NSIS 설치기가 «자기 자신»을 캐시 루트에 복사한다 (코드 + 실측 2회)
`installer.nsh:93`. mini05 에서 0.9.0 설치 직후 `installer.exe:176,599,329`(정품 exe와 **바이트 일치**),
0.9.1 설치 직후 `installer.exe:526,536,438` 로 갱신되는 것을 실측했다.
⇒ 「윈도우 pending 337MB」의 실체는 **pending + 이 루트 복사본**이고, 우리가 지우는 건 앞의 절반이다.

### 6-2. ⚠️`-c.npmRebuild=false` + asar 빌드는 mini05 에서 «실행 즉시 exit 1»
- 정품 v0.9.0(asar) 은 mini05 에서 **정상 실행**된다 → 기계 문제 아님.
- 같은 소스의 **`-c.asar=false`** 빌드는 정상 실행된다 → 소스 문제 아님.
- 증상: stdout/stderr 0바이트, 이벤트로그 무기록, SmartAppControl=0, Defender 무탐지.
  asar 를 풀어 `resources/app` 으로 바꿔도 여전히 exit 1(=무결성 fuse 가 exe 에 남아서로 추정).
- ★**대조 실험(이게 결론이다)**: 같은 mini05 에서 `--dir` + asar 로 두 번 빌드했다.
  | 빌드 | 소스 | 실행 |
  |---|---|---|
  | A | **내 R1 브랜치** | exit 1 |
  | B | **미변경 `origin/dev`** (package.json·main.js·index.html·js/editor.js 를 origin/dev 로 되돌리고 `main/updater-cache.js` 제거) | **exit 1 (똑같이 실패)** |
  ⇒ **내 R1 변경과 무관하다** — 빌드 «환경»(VS Build Tools 부재 → `-c.npmRebuild=false`) 쪽 문제다.
⇒ **릴리스 경로에는 영향 없음**(릴리스는 네이티브 리빌드를 하는 기계에서 빌드된다 — 정품 v0.9.0 이 mini05 에서 잘 돈다).
   다만 「VS Build Tools 없는 기계에서는 asar 배포본을 만들 수 없다」는 제약으로 기록해 둔다.
   ⚠️ 근본 원인은 «미규명»이다. 「asar 무결성 fuse」는 정황 추정이고 증명하지 않았다 — 그렇게 적어 둔다.

### 6-3. ⚠️ 사용자 지정 `artifactName` 은 arch 접미사를 «자동으로 안 붙인다»
`platformPackager.expandArtifactNamePattern` 의 `isUserForced` 분기. win 이 x64 하나라 지금은 안전하지만
**arm64 를 추가하는 날 두 산출물이 같은 이름이 된다** → 그때 `-${arch}` 를 넣어야 하고, 그건 게시명 변경이다.

### 6-4. ⚠️ 운영 함정 2개(다음 사람용)
- ssh 로 띄운 프로세스는 **ssh 세션이 끝나면 같이 죽는다**(Start-Process·detached spawn 둘 다).
  피드 서버가 조용히 죽어 「업데이트가 안 걸린다」로 보였다. ⇒ 상주가 필요하면 **`schtasks /IT`**.
- **mini05 는 모니터가 없다** → GUI 창이 아예 안 생긴다. 창 열거 0, graceful taskkill 거부.
  GUI 가 필요한 QA 는 이 기계로 못 한다.
