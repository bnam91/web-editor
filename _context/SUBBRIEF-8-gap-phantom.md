# #8 갭병합 보정 — 팬텀 블록 처리 결정 (서브브리프)

- 작성: 태양 2026-08-25 · 커밋 95617bc · feature/v0.8-improvements(dev 미머지)
- 발단: 현빈 실데이터·지디 실측 — 두 선택 갭 사이 «높이0·빈» frame-block(offsetHeight=0·textContent='')이 «보이지 않게» 끼어, 기존 인덱스차=1 인접판정이 이를 «사이»로 세서 ⌘M 병합 거부. 화면상 두 갭은 붙어보임.

## 판정 규칙
- **팬텀(건너뛰기 대상)** `_isPhantom(el)` = 비(非)gap-block AND `offsetHeight === 0` (display:none 포함). 두 갭 사이 형제가 «전부 팬텀»이면 인접으로 간주.
  - `=== 0` 엄격: 지디 실케이스가 정확히 0. 1~2px 얇은 «실» 요소(divider 등)를 오인 스킵하지 않기 위해 임계값 안 둠.
  - 미선택 gap-block은 팬텀에서 제외 → 여전히 경계(의도적 갭 넘어 병합 안 함).

## 빈 프레임 처리 결정 (지디 위임 → 태양 판단)
- **빈 0높이 팬텀 = 흡수 제거** `_isEmptyPhantom` = 팬텀 AND textContent 공백 AND `img,svg,canvas,video,input,textarea,select` 없음. (지디 권장 = 빈 0높이면 흡수 제거.)
- **내용 있는 비표시 팬텀(display:none + 내용) = 보존.** 데이터 손실 방지 — 병합은 하되 그 블록은 span에 남김. (드문 케이스지만 안전 기본값.)
- 높이 합산은 갭 offsetHeight만(팬텀은 0이라 무영향). head 갭에 몰고 나머지 런 갭 제거.

## 검증 (격리 9365, ⌘M keydown 디스패치)
- A) 빈0높이프레임 사이 → gaps 2→1·head 40+60=100px·팬텀 흡수제거·선택유지 ✓
- B) display:none+내용 → 병합되되 팬텀 보존 ✓
- C) 실블록 50px 사이 → 병합 거부(gaps 2 유지, 과병합 방지) ✓
- 콘솔 에러 0.

## 잔여/후속
- .gdt/export 재직렬화 영향 없음(순수 라이브 DOM 병합, autosave가 결과 DOM 저장). buildLayerPanel 재빌드로 레이어 정합.
- 회귀: 팬텀 없는 «직접 인접» 병합은 between=[] → every()=true로 기존과 동일 동작(회귀0).
