# #16 스크래치패드 이식성 — 설계 검토 (구현 아님·방식 확정용)

- 작성: 태양 2026-08-25 · 발단: 현빈 «세이프본 카피본에 스크래치패드가 비었다, 같이 불러와야지».
- 문제: 스크래치 = IndexedDB `scratch-pad-<pid>-<pageId>` → 프로젝트 폴더/이동/.gdt에 «안 딸려옴». #16 refLinks가 이미지 실체를 참조하는데, 프로젝트를 다른 맥으로 옮기면 IndexedDB가 비어 refLinks 전부 고아 → #16 무의미.
- 목표: «연결된 참고이미지»가 프로젝트와 함께 이동. P0=데이터손실0·기존회귀0·미연결 스크래치는 종전(IndexedDB).

## ★범위 긴장 (지디 확정 필요 — 회신 최우선)
- (가) **연결된 것만 이식** = #16 무결성 목적. 지디 P0("미연결은 IndexedDB 유지")와 정합. 범위 작음.
- (나) **스크래치패드 «전체» 이식** = 현빈 문구 그대로("스크래치패드가 비었다"→ 전부 따라오길). 미연결까지 프로젝트 동반 = 더 큰 변경(저장소 이전 성격).
- ⇒ 아래 A안은 (가). (나)를 원하면 A+«미연결도 프로젝트 폴더 저장» 추가 필요. **현빈 실제 기대가 (가)/(나) 어느 쪽인지부터 확정.**

## A안 (★권고) — 연결 이미지를 프로젝트 asset(goya-asset://)으로 외부화
- 메커니즘: 연결된 스크래치 이미지의 src(base64)를 `assetsSaveCanvasImage({projectId,b64,mime})`로 `<pid>/assets/<hash>.<ext>` 저장 → `goya-asset://` URL. refLinks(data-ref-links)에 그 URL을 durable 참조로 저장(scratchId 병기).
- 이식: ⓐ프로젝트 폴더 = `<pid>/assets/`에 실체 동반(폴더 복사=따라옴) ⓑ저장/로드 = goya-asset 영속 ⓒ.gdt = 기존 goya 스캐너가 refLinks URL 자동 번들(무편집!) ⓓexport-html = refLinks strip 유지(사이드카는 고객 페이지 요소 아님).
- 사이드카 렌더: goya-asset URL 우선(포터블)·로컬은 라이브 scratch-item 폴백.
- 데이터손실0: 외부화=복사(IndexedDB 유지). 타 맥=IndexedDB 비어도 프로젝트 asset로 렌더.
- 재사용도 최고: asset-externalize.js + main/gdt 스캐너 그대로. 신규 표면 최소.
- 타이밍: (권고) save 시 lazy 외부화(externalizeProjectData 패턴 확장 — 링크 UX 즉시성 유지) / 대안 link 시 즉시.
- 세부결정: ①타이밍 ②refLinks 스키마 asset URL 병기("s_1:0:goya-asset://…" or 별도맵) ③렌더 소스 우선순위.

## B안 — 연결 이미지 base64를 project.json에 인라인 동봉
- refLinks 이미지 base64를 page.refImages 등에 저장·로드 복원. 자기완결(폴더 이동 단순).
- ✗단점: proj.json 비대(103MB 탭렉 사태와 동일 병목)·goya 외부화 철학 역행·«중복저장 지양» 위배. 비권장.

## C안 — 스크래치패드 저장소를 프로젝트 폴더로 이전(전체)
- 스크래치 전체를 `<pid>/scratchpad/` 파일로. 프로젝트 완전 동반(=범위(나) 해결).
- ✗단점: 큰 변경·기존 IndexedDB 전면 마이그레이션·미연결 동작 회귀 위험(지디 P0 "미연결 IndexedDB 유지"와 충돌). 범위 과대. (단 범위(나)가 확정이면 C의 «부분»=미연결도 asset화가 필요.)

## 권고
- 범위 (가) 확정 시 → **A안**(연결 이미지 goya-asset 외부화). 기존 인프라 재사용·데이터손실0·회귀0·이식 3경로(폴더/저장/.gdt) 네이티브.
- 범위 (나)면 → A + 미연결 이미지도 프로젝트 asset/폴더로(별도 설계). 먼저 현빈 기대 범위 확정 요청.
- ⛔현 P1-P3 UX·데모 무영향(이식은 저장/외부화 계층). 현빈 데모 피드백 대기 상태 유지.
