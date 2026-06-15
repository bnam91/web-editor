---
project: web-editor (GODITOR 상페마법사)
type: vanilla-electron
entry: index.html (renderer) / main.js (main)
cdp_port: 9334
results_dir: .review/results
active_dimensions:
  - async
  - race
  - memory
  - state
  - apierr
  - "null"
  - integrity
  - branch
  - type
  - rerender        # vanilla: 수동 render/rebind 폭주
  - doc
  - structure
  - test            # 중앙 처리: 테스트 인프라 0 (2026-06-11 확인)
  - deps            # 중앙 처리: npm audit (2026-06-11: high 3 / moderate 4)
# a11y: 비활성 — 내부 운영 툴, 상호작용 품질은 qa-squad QA-UX가 커버
guard_doc: /Users/a1/.claude/skills/webeditor-regression-guard/skill.md
notion_db:
---

# web-editor (GODITOR) 코드리뷰 명세

## 아키텍처 한 줄
바닐라 JS ES모듈 + Electron(main.js 4.1k줄) · 전역 상태 window.state/전역함수 320+ · 영속 3계층(파일 proj.json ←IPC, localStorage 캐시, 메모리 탭캐시) · MutationObserver→debounce 1.5s autosave · 수동 rebindAll/buildLayerPanel 재렌더.

## 위험 핫스팟 (RUN 에이전트 출발점)
| 영역/파일 | 주의 차원 | 왜 |
|---|---|---|
| js/io/save-load.js (1.5k줄) | race, async, integrity | 저장 경로 3개(debounce/flushSave/beforeunload) + 탭캐시 + LS/파일 중재 로직 |
| js/tab-system.js, branch-system.js, commit-system.js | race, integrity | _suppressAutoSave 분산 관리, 탭/브랜치 전환 직렬화 |
| js/history.js + editor.js (2.2k줄) | state, integrity | innerHTML 스냅샷 복원 — JS 프로퍼티(_name 등) 유실 가능 |
| js/block-factory.js (4.6k줄) | null, branch, structure | 단일 거대 팩토리, 타입별 분기 다수 |
| js/block-drag.js (2k줄+), section-drag.js | memory, state | 문서 레벨 리스너, 드래그 중 상태 플래그 |
| js/props/ (47파일) | memory, rerender, null | innerHTML 교체+리스너 재부착 패턴 반복 |
| js/panels/ | rerender, null | buildLayerPanel 전체 재구성 |
| js/io/export-*.js, figma-publish.js | async, apierr | 외부 IO, try-finally(catch 없음) 패턴 이력 |
| js/ai-image-gen.js, ai-section-fill.js, ai-ext/ | apierr, async | 타임아웃 없음(qa-squad 의심 항목), 버튼 복구 |
| js/claude-pm/ | apierr, memory, structure | 터미널 스폰(bypass 권한), 프로세스 라이프사이클 |
| js/scratch-pad.js, image-handling.js | memory, null | base64/blob, revokeObjectURL 부재 의심 |
| main.js, preload.js, services/ | apierr, async, integrity | IPC 짝 일치, before-quit flush, 라이선스/AI 서비스 |
| CLAUDE.md, AGENTS.md, docs/, .qa/ | doc | AGENTS.md .Codex 경로 오류 등 기확인 항목 외 추가 탐색 |

## 모듈 분할 (owns — 이번 RUN은 whole-repo라 참고용, 다음 PROFILE에서 modules/*.md 분리 예정)
io-save: js/io/save-load.js, js/tab-system.js, js/branch-system.js, js/commit-system.js
history-core: js/history.js, js/editor.js
blocks: js/block-factory.js, js/blocks/**
drag: js/block-drag.js, js/section-drag.js, js/drag-utils.js
props: js/props/** · panels: js/panels/**
export-io: js/io/export-*.js, js/io/figma-publish.js, js/io/import-figma-json.js
ai: js/ai-*.js, js/ai-ext/** · claude-pm: js/claude-pm/**
scratch: js/scratch-pad.js, js/image-handling.js, js/overlay-handles.js
main-process: main.js, preload.js, services/**
※ 스코프 제외(커버리지 구멍으로 보고): claude-talk-to-figma-mcp/, figma-plugin/, figma-renderer/, dist/, build/, node_modules/

## 알려진 의도된 패턴 (오탐 방지 — 버그로 올리지 말 것)
1. `DBG-xx` 주석 = 의도적 제거/수정 기록 (부활 금지 tombstone)
2. `_suppressAutoSave` 15곳 분산 set/unset = MutationObserver 경쟁 방지 설계 패턴 (qa-squad 실측에서 플래그 전이 정상 확인됨)
3. push-before 히스토리 + **2026-06-11 undo 진입 시 ensureHistoryCheckpoint tip 적재 추가** (DEF-01 수정)
4. MUT-01: 동일값 dataset 쓰기 생략 (Observer 재귀 루프 방지)
5. S11: 빈 캔버스 저장 거부 가드 (데이터 보호)
6. BUG-44: beforeunload 동기 저장 + **2026-06-11 dirty 게이트(_dirtySinceSave) 추가** (DEF-03 수정)
7. R-07: 구 배너 블록 tombstone — 단 banner-block.js(addBannerBlock)는 **살아있는 메뉴 경로** (죽은 코드로 오판 금지, 2026-06-11 실측 작동 확인)
8. `window.saveProject()` = 커밋 모달 트리거 (이름과 달리 저장 함수 아님)
9. window.* 전역 320+ 노출 = 의도된 모듈 간 통신 스타일 — 개별 노출을 버그로 올리지 말고 structure 차원에서 총평만
10. flushSave의 _isSavingToFile 락 우회 = 주석에 의도 명시("락 문제 방지") — qa-squad 실측 race 미발생
11. autoSaveObserver의 코스메틱 mutation 필터(section-toolbar/#canvas attr) = 2026-06-11 DEF-03 수정분
12. props 패널 innerHTML 전체 교체+리스너 재부착 = 알려진 설계(성능 이슈로는 기록됨) — memory 차원은 "진짜 누수"(detached 참조 유지)만
13. 빈 `catch {}` 중 localStorage/JSON.parse 가드 목적인 것 (단 IO/IPC 실패 무피드백은 발견 대상)

## 금일(2026-06-11) 수정분 — 부작용 점검 대상
history.js(undo tip), block-drag.js(isCard 분기), editor.js(캡처 화이트리스트 .card-block), panels/layer-panel.js(.col 하강), io/save-load.js(dirty 플래그+게이트+observer 필터), tab-system.js(hasUnsavedChanges 게이트), io/export-image.js(실패 집계), props/prop-page.js(내보내기 토스트), main.js(will-download — 재시작 전 미활성)

## 변경 이력
- 2026-06-11: 최초 생성 (debug-squad v4 PROFILE, qa-squad 풀런 직후. modules/*.md 분리는 다음 PROFILE 패스로)
