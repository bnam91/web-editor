# proj.json 소비자 명부 (E168 · 2026-10-06 lane-drag · 태양/지디)

`proj.json` 을 «읽는» main 쪽 자리와, 깨진 파일일 때 공용 폴백 `readProjectWithFallback`(main.js)을 지나는지.
코드독해(ebe16949 = dev 0f572e2a 와 같은 줄) · 줄 번호는 그때 것. 셈은 «≥13» — 아래 «미확인» 셋은 몸통을 안 읽었다.

| 자리 | 하는 일 | 깨진 proj.json 일 때 | 공용 폴백 |
|---|---|---|---|
| `projects:load` | 열기 | 백업·히스토리에서 · 자가치유 · 알림(시각·성패) | ✅ 이번 판 (heal:true) |
| `_listItemFor` (목록 `_listProjectsImpl`) | 카드 | 옛 판: 카드 사라짐 → 이번 판: 백업에서 읽은 카드 + 배지 | ✅ 이번 판 (heal:false · 읽기만) |
| `_openProjectImpl` (MCP open_project) | 열기 | 렌더러가 `projects:load` 로 연다 | ✅ 간접 |
| `projects:history-diff-payload` | 버전 비교 | `current_corrupt` 를 말한다 | ✗ (그대로 둠 · 말은 함) |
| `_renameProjectImpl` | 이름 바꾸기 (IPC·MCP) | 던진다 | ✗ 다음 판 |
| `_duplicateProjectImpl` | 복제 | 던진다 (sourceData 없을 때) | ✗ 다음 판 |
| `main/claude-pm/mcp-server.js` `_readProjectFile` | MCP read_project 등 | 던진다 | ✗ 다음 판 |
| `projects:history-restore` | 버전 되돌리기 | `current_unreadable` 로 거절 · 안 씀 (실앱 측정 wbit ⒝) | ✗ 다음 판 (손실 아님) |
| `recovery:restore` | 비상 복구 | 새 사본 · 원본 안 씀 · 사본 이름이 원본 것 못 씀 (실앱 측정 wbit ⒞) | ✗ 다음 판 (손실 아님) |
| `projects:history-open-copy` | 사본 이름 바탕 | 스냅샷 이름으로 대체 | — 이름만 |
| `main/trash.js` | 휴지통 이름 | id 로 대체 | — 이름만 |
| `main/gdt/export.js` `transformProjectJson` | .gdt 내보내기 | 미확인 | 미확인 |
| `main/project-store/externalizer.js` · `snapshot-store.js` | 상태·스냅샷 | `readJsonOrNull` → null 처리(각자) | 미확인 |

쓰기 길(`_saveProjectImpl` · `projects:save-sync`)의 «직전 판 읽기»는 롤링 백업 검사 `_rollBackup`(E169)이 맡는다 — 이 명부의 셈 밖.

게이트: `readProjectWithFallback` 을 꺾으면(«proj.json 만 읽기») 이번 판에 묶은 소비자 수만큼(로드 · 목록 = 2) 빨개진다 —
`tests/unit/project-list-fallback-e168.test.js` P1.
