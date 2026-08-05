# 이미지 외부화 — 현빈 수동 스모크 체크리스트

> 태양이 격리 인스턴스(별도 user-data-dir + 포트 9360, 라이브 9334/9335·파테나 미접촉)에서
> CDP 헤드리스로 자동 검증한 항목 + GUI라 자동화 못 한 잔여 항목 정리.
> 머지 결정은 지디. 이 문서는 머지 전 현빈이 실제 창에서 눈으로 확인할 잔여 체크용.

## ✅ 태양이 이미 자동 검증 완료 (격리 9360, 실 Electron)
- (a) 앱 부팅 OK (격리 user-data-dir, migrator 0 candidate — 클린).
- (b) `goya-asset://` 프로토콜 로딩 OK — Image() 1px 정상 로드 + content-hash dedup 동작 + path-traversal 가드.
- (c) 더미 프로젝트(레거시 base64 1장) 로드→저장→재로드 **이미지 보존**:
  - 기본 저장(new-only) → 레거시 base64 디스크 보존(비파괴) ✓
  - 신규 이미지 추가 후 저장 → 신규만 goya-asset 외부화 + 레거시 보존 ✓
  - `optimizeProjectImages()` → 전부 외부화(disk base64 0) + 섹션 수 보존 + 검증 ok ✓
- (d) export PNG(`exportSection returnDataUrl`) → 45KB 유효 PNG ✓ / export HTML(`exportHTMLFile`) → goya-asset 0건·base64 인라인 3건 **포터블** ✓
- 게이팅 알고리즘 하네스 6/6 통과(레거시 비파괴·신규 자동·optimize 대량·미기록 안전·신규프로젝트).

## ⬜ 현빈 수동 확인 잔여 (GUI/실사용 경로)
1. **실제 이미지 업로드 경로**: 에셋 블록 더블클릭 → 파일 피커로 실제 이미지 업로드 → 저장 → 재로드.
   (태양은 DOM에 base64 주입으로 검증. 실 FileReader 업로드 경로의 신규 자동 외부화 최종 확인.)
   → 기대: proj.json 작게 유지, 재로드 후 이미지 그대로.
2. **"이미지 최적화" 버튼 UI 미연결**: `optimizeProjectImages()`는 함수/콘솔만 노출, **메뉴·버튼 미배치**.
   → 현빈/지디가 어디(파일 메뉴? 프로젝트 설정?)에 배치할지 결정 필요. 임시로 DevTools 콘솔에서
   `await window.optimizeProjectImages()` 호출 가능(반환: before/after/base64Before/base64After/sections).
3. **파테나급(≈85MB) 실프로젝트 최적화 1회**: 대량변환 소요시간·UI 멈춤·결과 크기 체감 확인(별도 사본으로).
4. **export 버튼 실제 다운로드 플로우**: PNG/HTML export를 실제 UI 버튼으로 → 다운로드 다이얼로그 →
   저장된 파일을 **일반 브라우저/뷰어**로 열어 이미지 정상 표시(특히 HTML 포터블) 확인.
5. **레이지 섹션 스크롤 렌더**: 외부화된 이미지가 스크롤로 뷰포트 진입 시 정상 hydrate/표시되는지 눈 확인.
6. **탭 전환(레거시↔신규 프로젝트)**: 베이스라인 per-project 격리 — 레거시 프로젝트 탭에서 저장해도
   레거시 base64 보존되는지(신규 프로젝트 베이스라인이 레거시에 영향 안 주는지) 실사용 확인.
7. **복제(하드링크)**: 프로젝트 복제 후 assets 공유·재매핑 정상(이전 세션 검증됨, 실 UI 재확인 권장).

## 격리 부팅 재현 커맨드 (현빈/지디용)
```bash
cd /Users/a1/web-editor-taeyang
ln -sfn /Users/a1/web-editor/node_modules ./node_modules   # 워크트리에 deps 없을 때만
./node_modules/.bin/electron . \
  --user-data-dir=/tmp/goya-smoke --remote-debugging-port=9360 "--remote-allow-origins=*" --enable-logging admin
# 확인 후: rm ./node_modules (심링크 제거해 워크트리 원상복구)
```
⚠️ 라이브 9334/9335·파테나(proj_1782317294600) 절대 미접촉. 반드시 별도 user-data-dir + 9360 등 비충돌 포트.
