# operator-allow — 배포판 운영자(admin) 허가 발급

배포판(패키징) 고디터에서 `admin` 인자로 운영자 모드(라이선스 게이트 통과, PM·터미널 IPC)를 쓰려면
`userData/operator.allow` 에 **운영자 개인키로 서명된** 허가 파일이 있어야 한다.
판정 코드는 `services/operator-allow.js`, 배선은 `main.js isAdminAuthorized()` 에 있다.

- dev(`electron . admin`)는 예전처럼 인자만으로 통과한다. 이 문서는 배포판에만 해당한다.
- 옛 방식(`GODITOR_ADMIN_TOKEN` 의 sha256 == `admin.allow`)은 0919 3라운드부터 **읽지 않는다**.
- 이 허가는 개발자 도구와 CDP 를 **열지 않는다**. 그건 관리자 계정 또는 관리자코드(devtools-gate)의 일이다.

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
4. `GODITOR admin` 으로 실행. 안 먹으면 로그의 `[admin] 배포판 운영자 허가 거부 — operator.allow: <why>` 를 본다.
   why: `no_file · bad_json · incomplete · unknown_kid · bad_sig · bad_payload · expired · not_yet · ttl_too_long · machine_mismatch · no_machine`

## 한계 (정직하게)

- asar 를 풀어 코드를 고쳐 다시 묶는 공격은 못 막는다(entitlement 와 같은 한계).
- 오프라인에서 시계를 되돌려 exp 를 넘기는 것도 못 막는다. 31일 상한이 피해 폭을 묶는다.
- 기기 묶기는 유출된 파일을 다른 PC 에서 그대로 쓰는 것을 막는 데까지다. VM 복제·UUID 스푸핑에는 약하다.
