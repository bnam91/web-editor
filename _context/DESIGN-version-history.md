# DESIGN — 버전/백업 히스토리 (goditor)

> 브랜치 `feature/version-history` @ dev(225031f) · worktree `/Users/a1/web-editor-verhist`
> 작성 태양 · 2026-08-27 · **구현 전 게이트 문서** (지디 GO 후 착수)

---

## §0. 한 문단 요약

백엔드는 이미 «저장할 때마다 직전 버전을 통째 복사»해 `proj_history/<epoch>.json` 에 5개까지
쌓고 있다. 그런데 **렌더러 노출이 0** 이라 사용자는 그 데이터를 볼 창구가 없고, 스냅샷 1개가
**39MB** 라 5개 이상 못 쌓아 실효 보관기간이 **50분**밖에 안 된다.

이 설계는 두 가지를 바꾼다.
1. **스냅샷을 쓰는 순간에만 base64 를 에셋으로 빼낸다** → 스냅샷 1개 39.59MB → **0.238MB**.
   전체 히스토리 저장소 실측 **2,511MB → 107MB (4.3%, 23배)**. 같은 용량으로 20배 더 보관.
2. **손실 중심(loss-oriented) 버전 목록** — "v1↔v2 가 뭐가 다른가"가 아니라
   **«내가 잃은 그것이 아직 살아 있는 버전이 어느 것인가»** 에 답하는 UI.

---

## §1. 이 기능의 용도 — 설계를 지배하는 한 문장

> 현빈: 「날라간 작업 복구할 때 **«주로 언제로 돌리지»** 등의 백업 복구용으로 쓰일 것」

⇒ 사용자는 **사고 직후**에 이 창을 연다. 한가하게 버전을 감상하지 않는다.
⇒ 창을 연 지 **5초 안에** "몇 시 몇 분 버전이 내 것이다"를 골라야 한다.
⇒ 그래서 목록 한 줄에 **시각 · 섹션 수 · 블록 수 · 이미지 수 · 용량** 을 숫자로 박고,
   각 줄에 **«이 버전엔 있는데 지금은 없는 섹션»** 을 앞세운다.

**설계 원칙 3개**
- **P-1 정직**: 못 하는 건 못 한다고 표시한다(옛 형식 스냅샷의 비교 생략 등). 추정치를 사실처럼 보이지 않는다.
- **P-2 비파괴**: 이 기능은 «데이터 복구» 도구다. **이 기능이 데이터를 잃게 만들면 최악이다.**
  파괴적 경로(되돌리기·덮어쓰기·프룬)는 반드시 «직전 상태 스냅샷»을 먼저 박고 나서 실행한다.
- **P-3 즉시성**: 목록은 **파일을 한 개도 읽지 않고** 뜬다(사이드카 인덱스). 39MB 파싱을 사고 직후에 시키지 않는다.

---

## §2. 실측 — 이 설계의 사실 기반

전부 이 브랜치에서 내가 직접 잰 값이다. 근거 없는 가정은 §2-5 에 «미검증»으로 분리했다.

### 2-1. 현행 스냅샷 파이프라인 (코드 실측)
| 사실 | 위치 |
|---|---|
| 저장 시 `prevPath → proj_backup.json` 통째 복사(롤링 1개) | `main.js:1258` |
| 저장 시 `prevPath → proj_history/<now>.json` 복사 | `main.js:1263~1280` |
| **10분 간격 게이트** — 직전 슬롯과 10분 미만이면 스냅샷 안 만듦 | `main.js:1271` |
| **5슬롯 롤링** — 6번째면 가장 오래된 것 unlink | `main.js:1276~1280` |
| `projects:save-sync`(beforeunload)는 **히스토리 슬롯을 안 만든다** (롤링 백업만) | `main.js:1307` |
| 손상 시 폴백 체인 `proj.json → proj_backup → proj_history(최신순) → proj_pre-externalize` + 자가치유 재기록 | `main.js:1131~1166` |
| **preload 에 history API 없음 · IPC 채널 없음** (노출 0) | `preload.js` 전수 |

⇒ **실효 보관기간 = 10분 × 5 = 50분.** 「어제 그거」는 구조적으로 복구 불가다.
⇒ 새로고침·탭닫기(가장 사고가 잦은 순간)에는 슬롯이 아예 안 남는다.

### 2-2. 용량 (디스크 실측, 2026-08-27)
```
projects 전체         6,525 MB
proj_history 합계     2,511 MB   ← 전체의 38.5%
히스토리 보유 프로젝트    61개 / 스냅샷 217개
```

### 2-3. ★스냅샷 시점 외부화의 효과 (실측 — 이 설계의 핵심 근거)
비파괴 계측 스크립트로 실제 스냅샷을 메모리에서 외부화해 재측정했다.

`proj_1787026440333` (히스토리 5슬롯 + 현재본):
```
1787634347738.json  before=39.59MB  after=0.238MB  imgs=7  new=7  reused=0  newAssetBytes=2.51MB
1787723499501.json  before=39.59MB  after=0.238MB  imgs=7  new=0  reused=7  newAssetBytes=0.00MB
1787725931511.json  before=39.59MB  after=0.238MB  imgs=7  new=0  reused=7  newAssetBytes=0.00MB
1787726836033.json  before=39.59MB  after=0.238MB  imgs=7  new=0  reused=7  newAssetBytes=0.00MB
1787727439495.json  before=39.59MB  after=0.238MB  imgs=7  new=0  reused=7  newAssetBytes=0.00MB
proj.json           before=39.59MB  after=0.238MB  imgs=7  new=0  reused=7  newAssetBytes=0.00MB
──────────────────────────────────────────────────────────────────────
합계 JSON 237.5MB → 1.43MB · 고유 에셋 7개/2.5MB · 신방식 총합 3.9MB (61배)
```

**전체 스윕(217 스냅샷 전수):**
```
현행 JSON 합계   : 2,511.1 MB
외부화 후 JSON   :    36.3 MB
고유 에셋(dedup) :   117개 /  71.1 MB
신방식 총합      :   107.3 MB   ← 현행의 4.3% (23배)
```

★ 두 가지가 이 표에서 증명된다.
- **canvas 가 곧 전부다** — 39.59MB 중 39.35MB(99.4%)가 인라인 base64.
  (지디의 「canvas 만 담으면 작아진다는 건 틀렸다」가 맞다. 줄여주는 건 «담는 범위»가 아니라 «외부화»다.)
- **★에셋 dedup 은 공짜다** — 첫 스냅샷만 2.51MB 를 내고 나머지 4개는 **0 바이트**.
  같은 이미지를 여러 버전이 공유하므로, **보관 개수를 늘려도 에셋 비용은 거의 안 는다.**

### 2-4. ★에셋 파일명 = 콘텐츠 해시 — **확인 완료(사실)**
`main/project-store/externalizer.js:107~117` `saveImageBytes()`:
```js
const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
const filename = `${hash}.${extFromMime(mime)}`;
if (!fs.existsSync(full)) { atomicWrite(full, buf); reused = false; }
```
⇒ 같은 바이트 = 같은 파일명 = **존재하면 안 쓴다.** 스냅샷 간 중복제거가 문자 그대로 공짜다.
⇒ 부수효과: 같은 이미지의 base64 형태와 goya-asset 형태를 **같은 토큰으로 정규화**할 수 있다(§6-2 에서 씀).

### 2-5. 미검증 / 가정
- 스윕의 「외부화 후 JSON」은 raw 정규식 기반 **추정치**(치환 후 URI 60자 가정). 개별 프로젝트 정밀 측정(2-3)과 방향은 일치.
- 117개 고유 에셋 중 일부는 이미 각 프로젝트 `assets/` 에 존재할 수 있다(그만큼 실제 추가 바이트는 더 적다).

---

## §3. 핵심 결정 (D1~D12)

### D1. 스냅샷은 «쓰는 순간에만» 외부화한다. 원본 proj.json 은 안 건드린다
`externalizer.js` 의 수집·해싱·치환 로직을 **순수 함수로 재사용**하되, `externalizeProjectFile()`
(파일을 rename/덮어쓰는 함수)은 **한 줄도 안 바꾼다**. 새 함수를 뽑는다:

```js
// main/project-store/snapshot-store.js
canonicalize(projectsDir, projectId, data, { write })
//  → { data: <새 객체, canvas 만 치환>, images, reused, skipped, bytesWritten }
```
- `write:true` → base64 를 `assets/<hash>.<ext>` 로 실제 저장(있으면 재사용) 후 URL 치환. (스냅샷 기록용)
- `write:false` → 저장 없이 **해시만 계산**해 같은 토큰으로 치환. (비교용 정규화, §6-2)
- **입력 객체를 변형하지 않는다**(shallow clone + pages 새 배열). 저장 직전 객체를 오염시키면 그대로 디스크에 나간다.

### D2. 스냅샷 대상 = «직전 파일»이 아니라 «지금 저장되는 객체»
현행은 `fs.copyFileSync(prevPath, newSlot)` — 39MB 디스크 복사.
새 방식은 `_saveProjectImpl` 이 **이미 메모리에 들고 있는 `project` 객체**를 스냅샷으로 쓴다.
- 재파싱 0 · 39MB 디스크 읽기 0 → **저장이 오히려 빨라진다**(39MB 복사 → 0.24MB 쓰기).
- 의미도 더 낫다: 「이 시각의 상태」가 「이 저장 직전의 상태」보다 버전 목록에 자연스럽다.
- ⛔ 롤링 `proj_backup.json` 의 «직전 파일 복사» 의미는 **그대로 둔다** — 손상 폴백의 1차 후보라
  의미를 바꾸면 GAP-004 계약이 흔들린다.

### D3. 파일명은 `<epoch>.json` 그대로 유지한다
`main.js:1138~1142` 의 손상 폴백이 `parseInt(파일명)` 으로 최신순 정렬한다.
접미사를 붙이면 그 정렬이 조용히 깨진다. **레이아웃 변경 없음 = 폴백 체인 무손상.**
부가정보(reason/pinned/집계)는 전부 사이드카 인덱스에 둔다.

### D4. 사이드카 인덱스 `proj_history/index.json` — 목록은 파일을 0개 읽는다
```jsonc
{
  "v": 1,
  "projectId": "proj_1787026440333",
  "current": {                       // ★현재 proj.json 의 지문 — 매 저장마다 갱신
    "ts": 1787727439495, "bytes": 41500000,
    "counts": { "pages": 2, "sections": 21, "blocks": 187, "images": 7 },
    "secs": [ { "k": "page_1::sec_j68xxfk", "n": "세이프본 무릎보호대" }, … ]
  },
  "entries": [
    {
      "ts": 1787634347738, "file": "1787634347738.json",
      "reason": "auto" | "pre-restore" | "pre-externalize" | "unload",
      "pinned": false,
      "canon": 1,                    // 1=정규형(외부화) · 0=레거시 base64 스냅샷
      "bytes": 243712,
      "name": "세이프본 무릎보호대",
      "counts": { "pages": 2, "sections": 24, "blocks": 203, "images": 7 },
      "secs": [ { "k": "page_1::sec_j68xxfk", "n": "세이프본 무릎보호대" }, … ],
      "assets": ["0633437eefdd157d.png", "1629b11e66d9e803.png"]   // ★GC 제외 근거(§8-1)
    }
  ]
}
```
- `secs`(섹션 id + 이름)만으로 **모든 버전의 «사라진 섹션»을 파일 읽기 0회로 계산**한다. 이게 §6 의 심장.
- 24 섹션 기준 엔트리당 ~1.5KB. 34 엔트리 = ~50KB. 무시 가능.
- 인덱스가 없거나 깨졌으면 **지연 재빌드**(파일 스캔 1회) 후 원자적 기록. 인덱스는 **파생 데이터**라
  잃어도 손실이 아니다 — 항상 재계산 가능해야 한다(불변식).

**집계 추출은 전부 «싸구려 정규식»** — JSON.parse 는 하되 DOM 파싱은 안 한다.
```js
SEC_OPEN = /<div class="section-block"[^>]*>/g      // 섹션 여는 태그만
  → id="([^"]*)"  ·  data-name="([^"]*)"            // outerHTML 은 속성값의 " 를 &quot; 로 이스케이프 → [^"]* 안전
BLOCK_ID = / id="[a-z0-9]{1,6}_[a-z0-9]{4,}"/g      // 앱의 genId 규약(sec_/ab_/tb_/gb_…). svg의 id="lnr-grad-1" 같은 건 하이픈 때문에 안 걸린다
IMG      = /goya-asset:\/\//g + /data:image\/[a-z0-9.+-]+;base64,/gi
blocks   = BLOCK_ID 매치수 − 섹션수
```
⚠️ 「블록 수」는 **행(row)·프레임(frame)도 포함하는 «식별자 가진 요소» 수**다. 절대값은 «정확한 블록 개수»가
아니지만 **버전 간 비교에는 일관되므로** 목적(증감 감지)에 충분하다. UI 툴팁에 그렇게 적는다(P-1 정직).

### D5. 보관 정책 — 최근 20 + 하루 1개 × 14일 + 핀
```
keep = pinned(면제)
     ∪ 최근 20개 (간격 게이트 10분 유지)
     ∪ 최근 14일 각 «날짜 버킷»의 마지막 1개
```
- **핀(`pinned:true`)** = `reason ∈ {pre-restore, manual}`. 프룬 면제. 상한 10개(초과 시 오래된 핀부터 해제).
- **프로젝트당 예산 상한 200MB** — 초과 시 «핀 아님 & 오래된 것»부터 추가 프룬(안전판).
- 실측 기준 정규형 스냅샷 34개 ≈ **8MB + 공유 에셋** — 현행 5슬롯(198MB)의 1/25.

### D6. 레거시(무거운) 스냅샷은 **P1 에서 손대지 않는다**
이미 쌓인 217개 2.5GB 는 «사용자 데이터»다. 복구 도구가 사용자 데이터를 지우고 시작하면 안 된다.
- P1: **프룬 면제** + 목록에 그대로 노출(`canon:0` 배지 「옛 형식 · 39MB」). 열기/되돌리기 **정상 동작**.
- P2: 설정>성능에 **「옛 스냅샷 경량화」** 버튼 — 레거시를 정규형으로 1회 변환(검증 통과 시에만 교체).
  변환 성공분만 이후 일반 프룬 대상이 된다. 여기서 2.5GB 중 2.4GB 를 회수한다.
- ⚠️ 「자동으로 조용히 지운다」는 **채택하지 않는다.**

### D7. 진입점 = 프로젝트 «단위»에 붙인다 (⛔환경설정 모달 아님)
현빈 원문의 「톱니바퀴」는 **환경설정 톱니(`index.html:153`)** 라 안 맞는다 — 버전은 프로젝트마다 다르다.
- **갤러리**: `pages/projects.html` 카드의 **4번째 `.card-action` 버튼**(🕐, hover 노출).
  기존 3개(공유/복제/삭제)와 **완전히 같은 클래스·크기**. `renderGrid()` `pages/projects.html:501` 에서 생성.
- **에디터**: 상단바 `.tb-badge#vhist-topbar-badge` — `#fsub-topbar-badge`(`index.html:91`) 와 동일 패턴.
- 두 곳 모두 같은 `window.openVersionHistory({ projectId, projectName })` 를 부른다.

### D8. 열람 = **사본으로 새 프로젝트** (읽기전용 뷰어 아님)
읽기전용 뷰어는 «만져보고 판단»을 못 한다. 사본이면 원본이 안전하면서 자유롭다.
- 새 프로젝트 이름: `<원본명> (v 08-27 14:22)`
- ⚠️ 반드시 `_duplicateProjectImpl`(`main.js:1360`) **의 에셋 처리 경로를 탄다** — 이유는 §8-2.

### D9. 되돌리기 — **되돌리기 «직전» 스냅샷 없이는 구현하지 않는다**
```
restore(ts, mode)
  ① 현재 상태를 reason:'pre-restore', pinned:true 로 «간격 게이트 무시하고» 강제 스냅샷   ← 실패하면 여기서 중단
  ② mode 'copy'(기본)   → §D8 새 프로젝트 생성. 원본 무접촉.
     mode 'inplace'(2차 확인 필요) → §D10 경로로 원본 교체
  ③ 토스트에 «되돌리기 취소» 안내(= pre-restore 스냅샷으로 다시 되돌리면 됨)
```
①이 실패하면 ②를 **절대 실행하지 않는다.** (P-2)

### D10. ★덮어쓰기 되돌리기의 autosave 경합 — 렌더러 경유가 정본
프로젝트가 에디터에 **열려 있는데** main 이 proj.json 을 직접 쓰면,
1.5초 뒤 autosave 가 옛 DOM 으로 **되돌린 것을 되돌린다**(externalizer 헤더가 경고한 그 함정).

**선례가 이미 있다** — `js/commit-system.js:269~272`:
```js
if (window.state) window.state._suppressAutoSave = true;
window.applyProjectData(commit.snapshot);
if (window.state) window.state._suppressAutoSave = false;
```
`window.applyProjectData(data)` 는 탭 전환(`js/tab-system.js:300,325`)·브랜치 전환(`js/branch-system.js:175`)이
쓰는 **정본 «이 데이터를 라이브에 싣는다» 경로**다. 그대로 쓴다.

| 상황 | 경로 |
|---|---|
| 그 프로젝트가 **안 열려 있음** | main 이 직접 atomic write + `_refreshListMeta` |
| 그 프로젝트가 **열려 있음** | main 은 데이터만 반환 → 렌더러가 `_suppressAutoSave` → `applyProjectData()` → 즉시 저장 |
| **다른 창/인스턴스**에서 열려 있음 | 판별 불가 → 덮어쓰기 거부하고 «새 프로젝트로» 만 허용 (정직) |

「열려 있나」 판정은 `window.__tabs` / `activeProjectId` 로 렌더러가 답한다(main 이 추측하지 않는다).

### D11. diff 는 «손실 중심». 전체 텍스트 diff 는 안 만든다
§6 전체.

### D12. ⛔수동 스냅샷 버튼은 **안 만든다** (현빈 결정)
`reason:'manual'` 값과 핀 로직은 스키마에 **미리 넣어두되 UI 는 안 붙인다.**
나중에 켤 때 데이터 마이그레이션이 없도록만 해둔다.

---

## §4. 파일 레이아웃 (변경 전/후)

```
proj_<id>/
  proj.json                    ← 무변경
  proj_backup.json             ← 무변경 (롤링 1개, 직전 파일 복사)
  proj_meta.json               ← 무변경
  proj_pre-externalize.json    ← 무변경 (외부화 최후보루)
  assets/<sha256_16>.<ext>     ← ★스냅샷이 «여기에 같이» 쌓인다 (콘텐츠 해시라 라이브와 자동 dedup)
  proj_history/
    <epoch>.json               ← ★내용이 정규형(goya-asset)으로 바뀜. 이름·위치는 그대로
    index.json                 ← ★신규 (파생 데이터, 잃어도 재빌드 가능)
```
**새 디렉터리 0개 · 새 파일 1개(index.json) · 기존 파일 의미 변경 0개.**

---

## §5. 모듈 / IPC / preload

### 5-1. 신규 모듈 `main/project-store/snapshot-store.js`
```js
canonicalize(projectsDir, projectId, data, { write })  // §D1
writeSnapshot(projectsDir, projectId, data, { reason, force, now })
   //  → { ok, ts, file, bytes, canon:1, skipped?:'interval' }
   //  force:true 면 10분 게이트 무시(pre-restore 전용)
listVersions(projectsDir, projectId)      // index.json 읽기(없으면 재빌드) → { current, entries }
readVersion(projectsDir, projectId, ts)   // 스냅샷 1개 파싱해 반환
pruneVersions(projectsDir, projectId, { now })   // §D5
rebuildIndex(projectsDir, projectId)
listReferencedAssets(projectsDir, projectId)     // ★§8-1 GC 제외 목록. 지금 안 쓰지만 «미리» 만들어 export 한다
```

### 5-2. `_saveProjectImpl` 변경 (main.js:1246~)
```diff
-       // 직전 슬롯과 10분 이상 차이날 때만 …
-       const newSlot = path.join(histDir, `${now}.json`);
-       fs.copyFileSync(prevPath, newSlot);
-       while (refreshed.length > 5) { … unlink … }
+       // 스냅샷: «지금 저장되는 객체»를 정규형으로 기록 + 사이드카 인덱스 갱신 + 계층 프룬
+       SS.writeSnapshot(PROJECTS_DIR, project.id, project, { reason: 'auto' });
+       SS.pruneVersions(PROJECTS_DIR, project.id);
```
- 전체를 `try/catch` 로 감싼다 — **스냅샷 실패가 저장 실패가 되면 안 된다**(현행도 같은 규율).
- 인덱스의 `current` 지문은 스냅샷 생성 여부와 **무관하게 매 저장마다** 갱신한다(§D4).

### 5-3. `projects:save-sync`(beforeunload) — 스냅샷 추가 (§Q4 로 현빈 확인)
새로고침·탭닫기는 사고가 가장 잦은 순간인데 지금은 슬롯이 안 남는다.
`reason:'unload'` 로 같은 10분 게이트를 적용해 추가한다.
⚠️ 비용: 정규형 프로젝트면 ~10ms, 미외부화 40MB 면 해시 계산 ~200~300ms 만큼 **종료가 느려진다.**
게이트 때문에 10분에 한 번뿐이지만 체감 리스크라 **현빈 확인 후 결정**(§11 Q4). 기본값은 «넣는다».

### 5-4. IPC (main) — 신규 5개
| 채널 | 인자 | 반환 |
|---|---|---|
| `history:list` | `{projectId}` | `{ok, current, entries[], legacyCount, totalBytes}` |
| `history:read` | `{projectId, ts}` | `{ok, data}` |
| `history:diff-payload` | `{projectId, ts}` | `{ok, snapCanvas:{pageId:html}, curCanvas:{...}}` — 둘 다 **정규화 완료**(§6-2) |
| `history:open-copy` | `{projectId, ts, newName?}` | `{ok, newProjectId, newName}` |
| `history:restore` | `{projectId, ts, mode, isOpenInEditor}` | `mode:'inplace'` & 열림 → `{ok, data, preRestoreTs}` (렌더러가 적용) / 아니면 `{ok, preRestoreTs}` |

- `projectId` 는 전부 `_safeSeg`, `ts` 는 **정수만** 허용(`/^\d+$/`) — 경로 조작 차단.
- `history:diff-payload` 는 크기 가드: 어느 쪽이든 8MB 초과면 `{ok:false, reason:'too_large'}`
  → UI 는 「옛 형식이라 상세 비교를 건너뜁니다」. 목록의 숫자·사라진 섹션은 **그래도 나온다**(인덱스 기반).

### 5-5. preload
```js
historyList:      ({projectId})           => invoke('history:list', …),
historyRead:      ({projectId, ts})       => invoke('history:read', …),
historyDiffPayload:({projectId, ts})      => invoke('history:diff-payload', …),
historyOpenCopy:  ({projectId, ts, newName}) => invoke('history:open-copy', …),
historyRestore:   ({projectId, ts, mode, isOpenInEditor}) => invoke('history:restore', …),
```
기존 `externalize*` 5줄 바로 아래에 같은 형식으로 붙인다.

### 5-6. 신규 렌더러 파일
```
js/version-history.js       // 모달 · 목록 렌더 · 손실 diff 계산 · 액션 3종
js/version-diff.js          // 순수 함수(§6). market-merge.js 의 normSection/hash 재사용
css/version-history.css     // ★.vhist-* 4개 클래스만 (§7)
```
`index.html` · `pages/projects.html` **양쪽**에 링크한다(진입점이 둘이라서). `font-substitute` 와 같은 규율.

---

## §6. ★손실 중심 diff — 이 기능의 심장

### 6-1. 2단 구조 — 「무엇을 잃었나」는 즉시, 「무엇이 달라졌나」는 요청 시
| 층 | 질문 | 재료 | 비용 | 언제 |
|---|---|---|---|---|
| **L1 손실** | «이 버전엔 있는데 지금은 없는 섹션» | `index.json` 의 `secs` 집합 차 | 파일 읽기 **0**, DOM 파싱 **0** | 목록 뜰 때 **전 버전 전부** |
| **L2 변경** | «같은 섹션의 내용이 얼마나 달라졌나» | 정규화 canvas 2벌 + DOMParser | 스냅샷 1개 파싱 | 사용자가 그 줄을 **펼칠 때만** |

L1 만으로 목적의 90%가 끝난다:
```
14:22   섹션 24 · 블록 203 · 이미지 7 · 0.24MB     ⚠️ 지금은 없는 섹션 3개  [혜택정리] [FAQ] [배송안내]
14:09   섹션 24 · 블록 201 · 이미지 7 · 0.24MB     ⚠️ 지금은 없는 섹션 3개  [혜택정리] [FAQ] [배송안내]
13:47   섹션 21 · 블록 180 · 이미지 7 · 0.23MB     — 사라진 섹션 없음
지금    섹션 21 · 블록 187 · 이미지 7
```
⇒ **「14:09 과 14:22 사이엔 24개였는데 지금 21개」가 한 눈에 보인다. 답은 14:22.**

### 6-2. ★정규화 — 안 하면 diff 가 전부 «변경»으로 뜬다 (숨은 함정)
스냅샷은 정규형(`goya-asset://…`)인데 현재 proj.json 은 아직 base64 일 수 있다(미외부화 프로젝트).
그대로 비교하면 **이미지를 가진 모든 섹션이 「변경」으로 뜬다** — 목록이 통째로 쓸모없어진다.

해법이 §2-4 에서 나온다. **에셋 파일명이 콘텐츠 해시**이므로 양쪽을 같은 토큰으로 접을 수 있다:
```
data:image/png;base64,XXXX  ──sha256(bytes)[0:16]──▶  goya-asset://<pid>/<hash>.png
goya-asset://<pid>/<hash>.png                    ──▶  goya-asset://<pid>/<hash>.png   (그대로)
```
`canonicalize(..., { write:false })` 를 현재 데이터에 적용해 **main 에서 양쪽을 같은 좌표계로** 만든 뒤
렌더러에 넘긴다. 렌더러는 정규형 두 벌만 비교하면 된다. (mtime 키로 캐시 — 모달 열 때 1회)

### 6-3. 판정 규칙
- **섹션 키** = `pageId::sectionId`. (`market-merge.js:41` 과 동일 규약)
  `sec_*` id 는 생성 후 재발급되지 않는다 — `js/io/save-load.js:690` 은 **없을 때만 채운다**. 복제도 보존한다.
  ⚠️ `data-section="N"` 은 레이어패널이 매번 다시 쓰는 **위치 인덱스**다(`js/panels/layer-panel.js:38`). **키로 쓰지 않는다.**
- **섹션 이름** = `data-name` → `.section-label` → `id` 순 (`js/section-search.js:68~74` 규약 그대로).
- **변경 판정(L2)** = `market-merge.js:12 normSection()` + FNV 해시.
  런타임 클래스·`contenteditable`·`.section-toolbar`·`.section-label` 을 벗겨 **가짜 diff 를 막는다**.
  ⚠️ 대가: `normSection` 은 `.annotation-block` 도 벗기므로 **주석만 바뀐 섹션은 「같음」으로 나온다.**
  버전 «목록 스캔»에서는 거짓양성(전부 변경)이 거짓음성(주석 하나 놓침)보다 훨씬 해롭다. 이 교환을 택하고
  L2 상세 패널에 「주석·라벨 변경은 비교에서 제외됩니다」라고 **표시한다**(P-1 정직).
- ⛔ **전체 텍스트 diff 는 만들지 않는다.** 비싸고 안 읽힌다.

### 6-4. `js/version-diff.js` API (순수 함수 · 단위테스트 대상)
```js
lossDiff(entrySecs, currentSecs)
  → { lost:   [{k, n}],   // 그 버전엔 있고 지금은 없다  ← 헤드라인
      gained: [{k, n}],   // 지금만 있다(그 뒤 만든 것)
      keptCount }

changeDiff(snapCanvasMap, curCanvasMap)      // L2, DOMParser 필요
  → { changed:[{k,n}], lost:[{k,n}], gained:[{k,n}], summary:{same,changed,lost,gained} }
```

---

## §7. UI — 디자인 일관성 게이트

### 7-1. 껍데기는 «신작 0». 선례를 그대로 복제한다
`css/font-substitute.css:1~9` 가 이 규율을 이미 문서화해 뒀다 —
「껍데기·버튼·셀렉트는 기존 공용 클래스 그대로 · 여기 있는 건 새 내용의 «행 배치»뿐 · **룩어라이크를
새로 짓지 않는다** · 색·크기는 전부 `--ui-*` 토큰, 폴백 hex 병기 «않는다»」

| 부분 | 재사용 |
|---|---|
| 오버레이/셸/헤더/타이틀/닫기/바디/푸터 | `.settings-modal-overlay / -shell / -header / -title / -close / -body / -footer` |
| 버튼 | `.settings-btn`, `.settings-btn-primary`, `.settings-btn-secondary` |
| 시간 표기 | `js/commit-system.js:71 _formatTimeAgo(ts)` («방금 전 / 3분 전 / 2시간 전») |
| 배지 | `.fsub-count` 형태(r9 · `--ui-fs-10` · `--ui-fw-semibold`) |
| 토스트 | `window.showToast()` (`js/drag-utils.js:181`) |
| 확인 | 네이티브 `confirm()` — 앱 전역이 그렇다(커스텀 확인 헬퍼는 **없다**) |
| 진입 버튼(갤러리) | `.card-action` — 기존 복제 버튼(`pages/projects.html:528~530`) 마크업 복제 |
| 진입 배지(에디터) | `.tb-badge` — `#fsub-topbar-badge`(`index.html:91`) 패턴 복제 |
| 모달 열림/닫힘 | `display:'flex'|'none'` + 오버레이 클릭 + Esc capture 리스너 (`settings-modal.js:100,472,826`) |

### 7-2. **신작 CSS 는 이 4개뿐** (`css/version-history.css`)
```css
.vhist-shell { width: 660px; max-height: 580px; }
.vhist-body  { flex-direction: column; min-height: 0; overflow-y: auto;
               padding: 14px 18px 18px; gap: 10px; }
.vhist-list  { display: flex; flex-direction: column; gap: 8px; }
.vhist-row   { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 5px 14px;
               align-items: center; padding: 10px 12px;
               background: var(--ui-bg-app); border: 1px solid var(--ui-border);
               border-radius: var(--ui-radius-md); }
```
색·크기·간격 **전부 `--ui-*` 토큰**. hex 리터럴 0개. (`.fsub-row` 와 문자 그대로 같은 구성)

### 7-3. 행 구조
```
┌──────────────────────────────────────────────────────────────────┐
│ 오늘 14:22 · 3시간 전                     [열어보기] [되돌리기]   │
│ 섹션 24 · 블록 203 · 이미지 7 · 0.24MB                            │
│ ⚠️ 지금은 없는 섹션 3   혜택정리 · FAQ · 배송안내      〔펼치기〕 │
└──────────────────────────────────────────────────────────────────┘
```
- **⚠️ 손실 줄이 가장 눈에 띈다** — `--ui-danger` 계열. 손실 0이면 그 줄은 안 그린다(노이즈 제거).
- 맨 위에 **「지금」 행**을 고정으로 그려 비교 기준을 명시한다.
- `canon:0` 레거시는 「옛 형식 · 39MB」 배지(`--ui-text-muted`).
- 〔펼치기〕가 L2(변경 상세)를 지연 로드한다.

### 7-4. 파괴적 동작 표기
- `[되돌리기]` → 메뉴 2개: **「새 프로젝트로 만들기」(기본·비파괴)** / **「지금 프로젝트를 이걸로 교체」(위험)**
- 교체는 `confirm()` + 「되돌리기 직전 상태가 자동으로 버전에 저장됩니다」 문구.
- 완료 토스트: `↩ 14:22 버전으로 교체됨 — 직전 상태는 버전 목록 맨 위에 있어요`

### 7-5. 검수 (완료 조건)
- 더미 스크린샷으로 `.fsub-*` 모달·`.card-action` 3형제와 **두께/색/반경/여백 일치** 눈 확인.
- **computed style 만 믿지 않는다** — `hidden` 속성이 display 클래스에 지는 선례가 있다. 스크린샷으로 판정.
- 정적 캡처로 끝내지 않고 **실제로 눌러본다** — 열기·펼치기·hover·되돌리기까지 인터랙션 검수.

---

## §8. 위험 · 규약 (반드시 못 박는 것)

### 8-1. ★★스냅샷이 참조하는 에셋은 GC 제외 — 이걸 안 지키면 과거 버전이 «조용히» 깨진다
스냅샷은 이미지를 **참조**로 갖는다. 지금은 에셋 GC 가 없어 안전하지만,
누군가 「안 쓰는 이미지 정리」를 만드는 순간 **터진다** — 그것도 조용히(로드는 되고 그림만 빈다).

**규약**
> `assets/` 를 정리하는 코드는 **반드시**
> `snapshot-store.listReferencedAssets(projectsDir, projectId)` 를 호출해 그 집합을 제외해야 한다.
> 이 집합은 `proj.json` + `proj_backup.json` + **모든 `proj_history/*.json`** + `proj_pre-externalize*.json`
> + `proj_pre-rollback*.json` 이 참조하는 `goya-asset://` 파일명 전체다.

**문서만으로는 부족하다.** 세 겹으로 박는다:
1. `listReferencedAssets()` 를 **지금 만들어 export** 한다(호출자가 없어도). 나중에 GC 짜는 사람이 찾게.
2. `snapshot-store.js` 헤더에 「★에셋 GC 를 만들 때 읽을 것」 경고 블록.
3. 단위테스트 `snapshot-store.gc-contract.test.js` — 스냅샷을 만든 뒤 `listReferencedAssets` 가 그 에셋을
   포함하는지 검증. GC 가 생기면 이 테스트가 계약을 지킨다.

### 8-2. ★「새 프로젝트로」는 `_duplicateProjectImpl` 경로를 타야 한다 — 선례가 이미 틀려 있다
`goya-asset://` URL 은 **프로젝트 id 를 hostname 에 박고 있다**(`main.js:2237~2246` 프로토콜 핸들러).
새 프로젝트를 만들면서 URL 을 안 바꾸면 새 프로젝트가 **원본 폴더를 몰래 참조**한다 — 원본을 지우는 순간 404.

- ✅ `_duplicateProjectImpl`(`main.js:1360`)은 제대로 한다:
  `main.js:1413~1421` URL 접두사 치환 + `main.js:1425~1455` `assets/` **하드링크 복사**(용량 0)·`images/` 실복사.
- ❌ `js/market.js:106~116` 「머지 적용(새 프로젝트로 저장)」은 `saveProject` 를 직접 불러
  **에셋을 전혀 처리하지 않는다.** 지금 이미 조용히 결합돼 있다. (별건 · 보고만 하고 이번 범위 밖)

⇒ **결정**: `_duplicateProjectImpl` 에 `sourceData` 옵션 인자를 더한다(없으면 현행과 완전 동일).
   스냅샷 데이터를 `sourceData` 로 넘겨 **에셋 처리 로직 전부를 그대로 재사용**한다. 복제 로직 재구현 금지.
   ⚠️ 추가로 사본에서는 **`collabRef` 를 반드시 제거**한다 — 안 그러면 두 프로젝트가 같은 협업방을 가리킨다.

### 8-3. 기존 5슬롯 롤링과의 호환
- 파일명·디렉터리 **불변** → `main.js:1138` 손상 폴백 체인 무손상. (D3)
- 레거시 스냅샷(`canon:0`)은 목록·열기·되돌리기 모두 **정상 동작**한다(그냥 무겁고 L2 비교만 생략).
- `index.json` 이 없는 기존 프로젝트 61개는 **최초 목록 열 때 지연 재빌드**(1회 스캔). 인덱스는 파생 데이터.
- 롤백하면(§10) 정규형 스냅샷은 그대로 남고 **구버전 코드도 그걸 읽을 수 있다** — 형식은 그냥 proj.json 이다.

### 8-4. 협업(collabRef) 프로젝트
`_externalizeOnOpen`(`main.js:1188~`)은 협업 프로젝트의 **파일 외부화를 막는다** — 상대 디스크엔 에셋이 없어서다.
**스냅샷 외부화는 그 제약을 안 받는다**: 스냅샷은 로컬 전용이고 동기화 대상이 아니다(`proj_history` 를
읽는 코드는 `main.js` 폴백과 `migrator.js` 뿐 — 전수 확인). 협업 프로젝트도 스냅샷은 경량으로 쌓는다.
⚠️ 단 §8-2 의 `collabRef` 제거는 필수.

### 8-5. 그 밖
- `.gdt` export 는 스냅샷을 포함하지 않는다(현행 유지, `main/gdt/export.js` 는 `assets/` 만 본다).
- 스냅샷 쓰기 실패는 **저장 실패로 번지지 않는다**(전체 try/catch, 현행과 동일 규율).
- `ts` 는 정수 검증, `projectId` 는 `_safeSeg` — 경로 조작 차단.
- 절단된 base64(`externalizer.js:293` [F6] 클래스)는 **건드리지 않고 인라인으로 남긴다** — 기존 규율 그대로.
  그 스냅샷은 그만큼 덜 줄어들 뿐 손상되지 않는다.

---

## §9. 테스트 계획 (실데이터 기준)

### 단위 (`tests/unit/`)
1. `canonicalize` 왕복 — 외부화 후 섹션 수 불변 · base64 잔여 = skip 분과 정확히 일치.
2. `canonicalize({write:false})` 가 **디스크를 안 건드린다**(mtime 불변).
3. `canonicalize` 가 **입력 객체를 변형하지 않는다** (D1 — 이걸 어기면 proj.json 이 오염된다).
4. dedup — 같은 이미지로 스냅샷 2회 → 두 번째 `bytesWritten === 0`.
5. `lossDiff` — 섹션 삭제/추가/이름변경/순서변경 4케이스.
6. `pruneVersions` — 40개 투입 → 최근 20 + 날짜버킷 14 + 핀 보존, 핀은 **절대 안 지워짐**.
7. **GC 계약** — `listReferencedAssets` 가 스냅샷 에셋을 포함(§8-1).
8. 인덱스 손상/부재 → 재빌드 결과가 정상 빌드와 **동일**.
9. `<epoch>.json` 정렬 계약 — 새 스냅샷이 `main.js:1138` 폴백 정렬을 깨지 않음.

### 통합 (실제 프로젝트 사본)
- **⛔ 실 프로젝트 디렉터리 무접촉.** `proj_1787026440333`(39.6MB) 등을 **스크래치패드로 복사**해 테스트.
- 39.6MB 프로젝트에 스냅샷 6회 → 총 용량 237MB→3.9MB 재현(§2-3 이 회귀 기준선).
- 레거시 5슬롯이 있는 프로젝트에서 목록이 뜨고 레거시 열기/되돌리기가 동작.
- 손상 시뮬레이션: proj.json 을 깨뜨리고 `projects:load` → **정규형 스냅샷에서 복구되고 이미지가 살아 있음**.

### 실앱 (격리 인스턴스)
- ★**고디터는 한 번에 하나** — 지금 슬롯이 비었으니 내 인스턴스만 띄운다. 9334/9335 미접촉.
- **더미 프로젝트**로 시나리오 완주: 섹션 3개 만들고 저장 → 10분 우회(테스트 훅)로 스냅샷 → 섹션 2개 삭제 →
  버전 목록에 **「지금은 없는 섹션 2」** 가 뜨는지 → 열어보기(사본 새 프로젝트, **이미지가 보이는지**) →
  되돌리기(교체) → **되돌리기 직전 스냅샷이 목록 맨 위에 핀으로 생겼는지** → 그걸로 다시 되돌리기(취소 성립).
- ⚠️ 「보여드릴 수 있게 해뒀다」 전에 **직접 눌러본다**(정적 스크린샷 금지).
- ⚠️ 디스크 편집과 「앱에서 그 프로젝트 열기」 동시 금지 — autosave 가 덮는다.

---

## §10. 롤백

| 단계 | 되돌리는 법 |
|---|---|
| 코드 | feature 브랜치 revert. **머지 안 함**(현빈 승인 대기) |
| 데이터 | 정규형 스냅샷은 **평범한 proj.json** 이라 구버전 코드도 읽는다. 이미지는 `goya-asset://` 로 뜨고 에셋은 남아 있다 → **깨지지 않는다** |
| index.json | 파생 데이터. 지우면 그만(구버전은 무시) |
| 원본 데이터 | proj.json/backup/pre-externalize **한 바이트도 안 건드린다** → 되돌릴 것 자체가 없다 |

---

## §11. 현빈에게 올릴 질문 (설계에서 갈리는 것만)

**Q1 · 진입점** — 「톱니바퀴」는 현재 **환경설정** 톱니라 프로젝트별 버전과 안 맞습니다.
갤러리 카드의 **4번째 아이콘 버튼(🕐, 복제/삭제 옆)** + 에디터 상단 배지 — 이 두 곳이면 될까요?

**Q2 · 되돌리기 기본값** — 「새 프로젝트로 만들기」를 기본으로, 「지금 프로젝트를 교체」는 2차 확인으로 두려
합니다. 그런데 **용도가 복구**라면 교체가 기본이어야 자연스러울 수도 있습니다. 어느 쪽이 맞습니까?
(어느 쪽이든 되돌리기 직전 상태는 자동으로 버전에 박습니다.)

**Q3 · 옛 스냅샷 2.5GB** — P1 은 손대지 않고 목록에만 노출, P2 에서 「옛 스냅샷 경량화」 버튼으로
2.4GB 를 회수하려 합니다(자동 삭제 없음). 이 순서 괜찮습니까? 아니면 P1 에서 바로 정리할까요?

**Q4 · 새로고침/탭닫기 시점 스냅샷** — 지금은 그 순간 버전이 안 남습니다(사고가 제일 잦은 순간인데도).
넣으면 **10분에 한 번, 종료가 최대 0.3초 느려질 수** 있습니다. 넣을까요? (기본값 «넣는다»)

**Q5 · 보관량** — 최근 20개(10분 간격) + 하루 1개 × 14일 ≈ 프로젝트당 34개.
경량화 덕에 용량은 현행의 1/25 입니다. 더 길게(30일) 갈까요?

---

## §12. 단계 분해

### P1 — 「쓸 수 있는 것」까지
| # | 유닛 | 산출 |
|---|---|---|
| 1 | `snapshot-store.js` — canonicalize / writeSnapshot / index / prune / listReferencedAssets | 신규 모듈 + 단위테스트 9종 |
| 2 | `_saveProjectImpl` 교체 + `save-sync` 스냅샷(Q4) | main.js diff 최소 |
| 3 | IPC 5채널 + preload 5줄 | 노출 |
| 4 | `version-diff.js` — lossDiff / changeDiff | 순수 함수 + 테스트 |
| 5 | `version-history.js` + `version-history.css` + 진입점 2곳 | UI (§7 게이트 통과) |
| 6 | 되돌리기 — 새 프로젝트(기본) / 교체(2차 확인) + **pre-restore 강제 스냅샷** | `_duplicateProjectImpl(sourceData)` |
| 7 | 검증 — 단위 + 통합 + 실앱 인터랙션 + 디자인 대조 | §9 전량 |

의존: 1 → 2 → 3 → (4 ∥ 5) → 6 → 7. 4 와 5 는 병렬.

### P2
계층 보관 튜닝 · 「옛 스냅샷 경량화」 버튼(2.4GB 회수) · L2 변경 상세 고도화

### P3
부분 가져오기 — 섹션 단위로 과거 버전에서 «이것만» 끌어오기

---

## §13. 이 설계가 뒤집은 것 (기록)

1. **「canvas 만 담으면 작아진다」 → 틀림.** canvas 가 곧 전부다(39.59MB 중 99.4%). 줄여주는 건
   담는 범위가 아니라 **외부화**다. (지디가 이미 실측으로 뒤집었고, 내가 재확인)
2. **「에셋 파일명이 콘텐츠 해시로 «보인다»」 → 사실 확정.** `externalizer.js:109`.
   덕분에 dedup 이 공짜일 뿐 아니라, **base64 ↔ goya-asset 을 같은 토큰으로 접어 가짜 diff 를 막을 수 있다**(§6-2).
   이 두 번째 효과가 없었으면 미외부화 프로젝트의 버전 목록은 전부 「변경」으로 떠서 쓸모없었다.
3. **「스냅샷은 직전 파일을 복사한다」 → 바꾼다.** 메모리에 있는 객체를 쓰면 39MB 읽기·복사가 사라진다.
   **저장이 느려지는 게 아니라 빨라진다.**
4. **「diff 를 어디서 하나」 → 2단으로 쪼갠다.** 손실(L1)은 사이드카 인덱스만으로 **파일 0개 읽고**
   전 버전 전부 계산된다. 이게 사고 직후 5초 안에 답이 나오게 하는 유일한 방법이다.
5. **「덮어쓰기 되돌리기」의 진짜 난점은 파일 쓰기가 아니라 autosave 경합이다.**
   선례(`commit-system.js:269` `_suppressAutoSave` + `applyProjectData`)가 이미 있어 새로 발명하지 않는다.
