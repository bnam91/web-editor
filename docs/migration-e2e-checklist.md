# 프로젝트 번들 마이그레이션 — 수동 e2e 검수 체크리스트

머지 후 릴리스 직전 손으로 따라가는 검수 체크리스트.
자동 검증(`scripts/verify-bundle-migration.mjs`)이 끝난 다음 진행한다.

> **중요**: 사용자의 실제 `PROJECTS_DIR`을 가지고 검수하기 전에, 반드시
> 백업(snapshot)을 먼저 떠둔다. 모든 시나리오는 백업 위에서 진행하거나,
> 머지 직전 git stash로 되돌릴 수 있는 상태에서 진행한다.

---

## 0. 사전 준비

| 단계 | 명령 / 행동 | 결과 | 메모 |
|---|---|---|---|
| 0-1 | `./scripts/snapshot-projects-dir.sh ~/web-editor-projects-snapshot-pre-migration` 실행 | ✅ / ❌ | |
| 0-2 | 스냅샷 디렉터리 entry 수 = 원본 entry 수 (du -sh 비교) | ✅ / ❌ | |
| 0-3 | Goditor 앱을 한 번 종료(`Cmd+Q`) — 살아있는 파일핸들 없는지 확인 | ✅ / ❌ | |

---

## 1. 자동 검증 (먼저 실행)

| 단계 | 명령 | 기대 결과 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 1-1 | `node scripts/verify-bundle-migration.mjs --dry-run-from <SNAPSHOT>` | FAIL 0 | | |
| 1-2 | `node scripts/verify-bundle-migration.mjs --regression-checks <SNAPSHOT>` | FAIL 0 | | |
| 1-3 | `node scripts/verify-bundle-migration.mjs --kill-9-simulation <SNAPSHOT>` | FAIL 0 | | |

자동 검증 통과 후에만 아래 수동 e2e로 진행.

---

## 2. 임시 PROJECTS_DIR redirect로 실제 앱 띄우기

> 실제 사용자 데이터를 건드리지 않고 사본 위에서 앱을 띄우는 방법.
> 두 가지 중 택1.

### 옵션 A — 환경변수 redirect (권장, app.js/main.js에 `process.env.GODITOR_PROJECTS_DIR` 지원 필요)
```bash
GODITOR_PROJECTS_DIR="$HOME/web-editor-projects-snapshot-pre-migration" npm run dev
```

### 옵션 B — 원본 임시 이동 + 사본으로 대체 (지원 코드 없을 때)
```bash
# 원본을 잠깐 다른 이름으로 옮기고 사본을 그 자리에 둔다.
SRC="$HOME/Library/Application Support/Goya Design Editor/projects"
mv "$SRC" "${SRC}.original-$(date +%s)"
ln -s "$HOME/web-editor-projects-snapshot-pre-migration" "$SRC"
npm run dev
# 검수 끝나면 반드시 원복 (아래 9-1)
```

> 옵션 B를 쓸 때는 검수 후 9-1 단계에서 반드시 symlink 제거 + 원본 복귀.

---

## 3. 앱 시작 시 마이그레이션 로그

| 단계 | 확인 항목 | 기대 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 3-1 | 콘솔에 `[migrator]` 로그가 보임 | 보임 | | |
| 3-2 | 로그 라인에 `migrated=N, skipped=0, failed=0` (N=프로젝트 수) | 정확 | | |
| 3-3 | `migration-log.json`이 userData 또는 `<PROJECTS_DIR>` 에 생성됨 | 생성 | | |
| 3-4 | 두 번째 앱 재시작 시 `migrated=0, skipped=N` (이미 끝남) | 정확 | | |

---

## 4. 프로젝트 목록 페이지

| 단계 | 확인 항목 | 기대 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 4-1 | 프로젝트 카드 수 = 원본 프로젝트 수 (orphan 제외) | 일치 | | |
| 4-2 | 각 카드의 썸네일이 정상 표시 (이전과 동일) | 정상 | | |
| 4-3 | 각 카드의 이름/날짜가 깨지지 않음 | 정상 | | |
| 4-4 | 정렬 순서(updatedAt 내림차순) 동일 | 동일 | | |

---

## 5. 임의 프로젝트 진입 + 캔버스

| 단계 | 확인 항목 | 기대 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 5-1 | 카드 클릭 → 캔버스 로드 (3초 내) | 로드 | | |
| 5-2 | 페이지/섹션 수가 원본과 동일 | 동일 | | |
| 5-3 | 이미지가 깨지지 않음 (assets/images 형제 폴더 그대로) | 정상 | | |
| 5-4 | 프로젝트명 변경 → save 후 `proj_<id>/proj.json` name 갱신 (디스크 직접 확인) | 갱신 | | |
| 5-5 | 5-4 직후 `proj_<id>/claude-pm/project.meta.json` title 동일 (PM 폴더 있을 때) | 동기화 | | |
| 5-6 | 캔버스에 섹션 추가 → save → `proj.json` 크기 증가 | 증가 | | |

---

## 6. 새 프로젝트 생성

| 단계 | 확인 항목 | 기대 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 6-1 | "새 프로젝트" 만들기 → 디스크에 `proj_<신id>/` 디렉터리 생성 | 생성 | | |
| 6-2 | `proj_<신id>/proj.json` 만 존재 (또는 `proj_meta.json`까지) | 신 레이아웃만 | | |
| 6-3 | PROJECTS_DIR 루트에 `proj_<신id>.json` (flat) 안 생김 | 0개 | | |
| 6-4 | 페이지 목록에 신규 프로젝트가 즉시 표시 | 표시 | | |

---

## 7. 프로젝트 삭제

| 단계 | 확인 항목 | 기대 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 7-1 | UI에서 임의 프로젝트 삭제 | 성공 | | |
| 7-2 | 디스크에서 `proj_<id>/` 디렉터리 통째 사라짐 | 사라짐 | | |
| 7-3 | quarantine 안의 동일 ID flat 잔재도 정리됨 (또는 quarantine 정책에 따라 보존) | 정책대로 | | |
| 7-4 | 다른 프로젝트는 영향 없음 | 무영향 | | |

---

## 8. 회귀 — branch / commit / image / asset

| 단계 | 확인 항목 | 기대 | ✅/❌ | 메모 |
|---|---|---|---|---|
| 8-1 | 브랜치 시스템 열기 → 기존 브랜치 목록이 동일하게 보임 | 동일 | | |
| 8-2 | 새 브랜치 추가 → `proj_meta.json.branches` 길이 +1 (디스크 확인) | +1 | | |
| 8-3 | 커밋 시스템에서 새 커밋 → `proj_meta.json.commits` 길이 +1 | +1 | | |
| 8-4 | 다중 백업 슬롯: 짧은 간격 2회 저장 후 `proj_history/` 슬롯 파일 수 보존 (10분 미만 차이면 추가 X) | 정책대로 | | |
| 8-5 | AI 이미지 1장 생성 → `proj_<id>/images/` 생성됨 | 생성 | | |
| 8-6 | Assets 업로드 → `proj_<id>/assets/` 생성됨 | 생성 | | |
| 8-7 | 새로고침(Cmd+R) → save-sync 경로로 저장 → `proj.json` 손실 없음 | 무손실 | | |

---

## 9. 정리 + 원복

| 단계 | 명령 / 행동 | ✅/❌ | 메모 |
|---|---|---|---|
| 9-1 | (옵션 B 사용 시) symlink 제거 후 원본 디렉터리 복귀 | | |
| 9-2 | 마이그레이션 끝난 사본은 보관 또는 명시적 삭제 | | |
| 9-3 | 자동 검증 + 수동 e2e 결과를 PR 코멘트/노션에 첨부 | | |

---

## 발견 사항 / 후속 조치

(검수 중 발견된 이슈를 여기 기록한다 — 빈 칸이면 모두 OK)

- [ ] …

---

## 참조

- 자동 검증: `scripts/verify-bundle-migration.mjs`
- 스냅샷 헬퍼: `scripts/snapshot-projects-dir.sh`
- 마스터 플랜: `/Users/a1/.claude/plans/ticklish-bouncing-axolotl.md` (Verification 섹션)
