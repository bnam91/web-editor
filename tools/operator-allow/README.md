# operator-allow — 배포판 운영자(admin) 허가 발급

배포판(패키징) 고디터에서 `admin` 인자로 운영자 모드(라이선스 게이트 통과, PM·터미널 IPC)를 쓰려면
`userData/operator.allow` 에 **운영자 개인키로 서명된** 허가 파일이 있어야 한다.
판정 코드는 `services/operator-allow.js`, 배선은 `main.js isAdminAuthorized()` 에 있다.

- dev(`electron . admin`)는 예전처럼 인자만으로 통과한다. 이 문서는 배포판에만 해당한다.
- 옛 방식(`GODITOR_ADMIN_TOKEN` 의 sha256 == `admin.allow`)은 0919 3라운드부터 **읽지 않는다**.
- 이 허가는 개발자 도구와 CDP 를 **열지 않는다**. 그건 관리자 계정 또는 관리자코드(devtools-gate)의 일이다.

## ★배포 순서 — 운영자 PC 에 서명 allow 를 «먼저», 앱 배포는 «그다음»

이 변경이 들어간 버전을 배포하면, 배포판에서 옛 방식(`admin.allow` + `GODITOR_ADMIN_TOKEN`)은 그 순간부터 무효다.
순서를 거꾸로 하면 현빈·운영자의 PM·터미널·기획 페이지·라이선스 건너뛰기·MCP 로그인 인정(authed)이
**새 버전으로 업데이트되는 순간 꺼진다.**

1. 실키 연결(아래 「처음 한 번」) — `OPERATOR_PUBLIC_KEYS` 에 `op1` 이 들어간 코드로 빌드해야 한다.
   키가 비어 있는 채로 배포하면 서명 allow 를 깔아도 **어떤 운영자도 켜지지 않는다**(`unknown_kid`).
2. 운영자 기기마다 `machine-id` → `issue` → 그 기기 userData 에 `operator.allow` 를 **먼저** 둔다.
   옛 버전 앱은 이 파일을 읽지 않으니 미리 깔아도 아무 영향이 없다.
3. 그다음 앱을 배포(태그 푸시 → CI)한다.
4. 업데이트된 운영자 기기에서 `GODITOR admin` 으로 한 번 띄워 운영자 경로(프로젝트 진입·터미널)가 되는지 본다.
   안 되면 화면에 「운영자(admin) 모드를 켜지 못했습니다」 안내가 뜬다(사유 포함, 로그에도 같은 줄).
5. 옛 `admin.allow` 파일과 `GODITOR_ADMIN_TOKEN` 은 지워도 된다(남아 있어도 판정에는 안 쓰고, 안내 문구에만 「무효」로 뜬다).

`tools/deploy-gate.js`(로컬 `release:mac/win`)는 운영자 키가 대조 안 됐으면 이 순서를 다시 경고한다.
⚠️CI 릴리스 워크플로(`.github/workflows/release-*.yml`)는 deploy-gate 를 돌리지 않는다 — 태그 푸시 전에 사람이 이 절을 확인한다.

### 릴리스 노트(내부·GitHub)에 넣을 문구

앱 안 「릴리스 노트」 모달(`js/release-note.js`)은 고객용이라 넣지 않는다. GitHub 릴리스 노트/내부 공지에만:

```
운영자(admin) 모드: 이 버전부터 배포판 운영자 허가는 «서명된 operator.allow» 만 인정합니다.
옛 admin.allow·GODITOR_ADMIN_TOKEN 은 무효입니다. 업데이트 «전에» 운영자 PC 마다 새 허가를 먼저 설치하세요
(tools/operator-allow/README.md). 고객(일반 실행)에는 영향이 없습니다.
```

## 파일 형식

`operator.allow` (JSON 한 줄)

```
{"kid":"op1","payload":"<b64url>","sig":"<b64url>"}
```

payload(모두 필수, 하나라도 어긋나면 거부):

| 필드 | 값 |
|---|---|
| typ | `goditor-operator-allow` |
| ver | `1` |
| kid | 바깥 `kid` 와 같아야 함 (`op1`) |
| app | `goditor` |
| machine | `sha256('goditor-operator-v1:' + 플랫폼UUID 대문자)` 64 hex |
| iat, exp | ISO 문자열. `now < exp`, `iat <= now + 5분`, `exp - iat <= 31일` |
| note | 선택, 문자열 |

서명 = Ed25519, 대상은 b64url payload 문자열의 utf8 바이트. entitlement(k1)와 **다른 키**다.

플랫폼 UUID: mac `ioreg -rd1 -c IOPlatformExpertDevice` 의 IOPlatformUUID, win `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`, 그 밖 `/etc/machine-id`.

## 처음 한 번 (실키 연결 — 현빈/대성)

1. 개인키 생성 (레포 밖, 0600):
   ```
   node tools/operator-allow/issue.mjs keygen > /tmp/op1.pub.pem
   ```
   개인키는 `~/.config/secrets/goditor-operator-ed25519.pem` 에 생긴다. 이미 있으면 덮어쓰지 않는다.
2. `/tmp/op1.pub.pem` 내용을 `services/operator-allow.js` 의 `OPERATOR_PUBLIC_KEYS` 에 `op1` 로 넣는다.
3. 같은 파일 `OPERATOR_KEY_PROVENANCE` 를 `'verified-YYYY-MM-DD'` 로 바꾼다(개인키에서 유도한 공개키와 상수가 같은지 확인한 날).
   `tools/deploy-gate.js` 는 이 값이 아니면 **경고만** 한다(키가 없으면 운영자 없음으로 안전하게 동작하므로 막지 않는다).
4. 개인키 백업은 레포 밖에. ⛔커밋 금지(`.gitignore`: `*.allow`, `goditor-operator-*.pem`).

`OPERATOR_PUBLIC_KEYS` 가 비어 있으면 배포판 운영자 모드는 **항상 꺼져 있다**.

## 발급 (운영자 기기마다)

1. 대상 기기에서 기기 해시를 뽑는다 (레포 체크아웃이 있는 경우):
   ```
   node tools/operator-allow/issue.mjs machine-id
   ```
2. 개인키가 있는 기기에서 발급:
   ```
   node tools/operator-allow/issue.mjs issue --machine <64hex> --days 7 --note "홍길동 윈도우 운영PC" --out ~/Desktop/operator.allow
   ```
   같은 기기면 `--this-machine`. `--days` 기본 7, 최대 31. `--out` 을 빼면 stdout.
   개인키가 레포 안이거나 권한이 group/other 에 열려 있으면 거부한다.
3. 대상 기기의 userData 에 `operator.allow` 로 둔다.
   - mac: `~/Library/Application Support/GODITOR/operator.allow`
   - win: `%APPDATA%\GODITOR\operator.allow`
4. `GODITOR admin` 으로 실행. 안 먹으면 화면에 「운영자 권한이 없는 실행입니다」 안내가 한 번 뜨고(화면엔 사유 «코드»만 —
   `(코드: expired)` 처럼. 파일명·경로·변수명은 화면에 안 적는다: 누구나 보는 화면이 우회 지도가 되지 않게),
   로그에 `[admin] 배포판 운영자 허가 거부 — operator.allow: <why>` 가 상세와 함께 남는다. 옛 파일·토큰이 있으면 로그에 「무효」라고 함께 적힌다.
   파일은 BOM 이 붙어 있어도 된다(PowerShell 5 `Out-File -Encoding UTF8` 대응).
   why: `no_file · bad_json · incomplete · unknown_kid · bad_sig · bad_payload · expired · not_yet · ttl_too_long · machine_mismatch · no_machine`

## 한계 (정직하게)

- asar 를 풀어 코드를 고쳐 다시 묶는 공격은 못 막는다(entitlement 와 같은 한계).
- 오프라인에서 시계를 되돌려 exp 를 넘기는 것도 못 막는다. 31일 상한이 피해 폭을 묶는다.
- 기기 묶기는 유출된 파일을 다른 PC 에서 그대로 쓰는 것을 막는 데까지다. VM 복제·UUID 스푸핑에는 약하다.
- **폐기(revoke) 수단이 없다.** 한 번 발급한 operator.allow 는 exp 까지(최대 31일) 유효하다 — 서버에 묻지 않는
  오프라인 판정이라 「이 파일 취소」를 앱에 알릴 길이 없다. 그리고 세션 중에 부여된 접근(`_editorAccessGranted`,
  메모된 기기 ID)은 파일을 지워도 앱을 끌 때까지 유지된다. 유출되면 할 수 있는 조치는 «공개키(kid) 교체 후 재배포»
  뿐이다(OPERATOR_PUBLIC_KEYS 에서 그 kid 를 빼고 새 kid 로 재발급 → 그 버전 이후로만 옛 파일이 무효). 그래서 `--days` 를 짧게.
- **배포판 판정(0920 pkgguard).** 「배포판인가」는 `app.isPackaged`(실행파일 이름) «또는» «app.asar 안에서 로드됨»으로
  본다(main.js `_isPackagedBuild` · services/authService.js `packagedVerdict`). 스톡 Electron 으로 `app.asar admin` 을
  띄우거나 윈도우에서 GODITOR.exe 를 electron.exe 로 복사해도 배포판으로 판정돼 이 서명 파일이 필요하다.
  ★배포 순서: 운영자 PC 에 서명 operator.allow 를 «먼저» 깔고 앱을 배포한다. 「스톡 Electron + asar + admin」으로
  운영자 모드를 쓰던 경로가 있었다면 이번부터 막힌다(의도 — 릴리스 노트에 적는다).
- **남는 우회 ① asar 를 풀어 폴더로 실행.** `asar extract` 후 스톡 electron 으로 그 «폴더»를 띄우면 코드를 한 줄도
  안 고쳐도 dev 로 판정된다(asar 경로도, 앱 바이너리 이름도 없다). 보강안(미적용 — 결정 대기): electron-builder
  `build.extraMetadata` 로 package.json 에 배포 표지를 넣고 판정에 포함 → 우회에 «파일 수정»이 필요해진다.
- **남는 우회 ② 퓨즈 없는 스톡 Electron.** `NODE_OPTIONS=--require x.js`·`--inspect-brk` 는 main.js 보다 «먼저» 돈다 —
  앱 코드로는 원리상 못 막는다. 부팅 차단(`debugLaunchViolations`)은 순진한 시도에 대한 문턱일 뿐이다.
  **이 로컬 게이트들은 문턱을 올릴 뿐이고, 라이선스의 최종 판정은 서버다.**
