#!/usr/bin/env bash
# snapshot-projects-dir.sh
# ─────────────────────────────────────────────────────────────────────────
# Goditor PROJECTS_DIR(=Application Support/GODITOR/projects)을
# 검증용 사본으로 안전 복제한다.
#
# 사용:
#   ./scripts/snapshot-projects-dir.sh                     # 기본 위치($TMPDIR)로 사본
#   ./scripts/snapshot-projects-dir.sh /tmp/my-snapshot    # 지정 위치로 사본
#
# ⚠️ 사본은 PROJECTS_DIR 전체다(현재 4.5G). 실행 전 디스크 여유를 확인할 것.
#
# 동작:
#   1) 원본 위치를 확인하고 존재/디렉터리/쓰기 가능성 출력
#   2) rsync -a (preserve metadata, no delete) 로 사본 디렉터리 생성
#   3) 사본의 entry 수와 디스크 용량을 요약
#
# 안전:
#   - 원본을 절대 수정하지 않는다 (rsync는 source-only read).
#   - 사본 디렉터리가 이미 존재하면 빈 디렉터리일 때만 진행, 그 외 abort.
#   - --delete / --remove-source-files 절대 사용 안 함.
# ─────────────────────────────────────────────────────────────────────────

set -euo pipefail

# app.name='GODITOR'(main.js)이 userData 경로를 결정한다. 구 'Goya Design Editor'
# 폴더는 main.js의 _migrateUserDataDir가 'GODITOR'로 rename해 더 이상 존재하지 않는다.
SRC="${HOME}/Library/Application Support/GODITOR/projects"
# 기본 사본 위치 — ★홈 루트에 두지 않는다.
# 이 사본은 PROJECTS_DIR 전체(현재 4.5G)라, 기본값이 ${HOME}이면 인자 없이 한 번 돌리는
# 것만으로 홈 루트에 수 GB짜리 부산물이 쌓인다(홈루트 부산물 금지 규칙 위반).
# TMPDIR = macOS 사용자 전용 임시 디렉터리(/var/folders/…/T/). 레포 밖이라 git을 더럽히지
# 않고, OS가 주기적으로 정리하므로 잊고 남겨도 영구 적재되지 않는다. 홈과 같은 볼륨이라
# 용량 여유 조건도 동일하다. launchd/cron 등 TMPDIR이 없는 환경은 /tmp로 폴백.
SCRATCH="${TMPDIR:-/tmp}"
SCRATCH="${SCRATCH%/}"
DEFAULT_DST="${SCRATCH}/web-editor-projects-snapshot-$(date +%Y%m%d-%H%M%S)"
DST="${1:-$DEFAULT_DST}"

echo "[snapshot] source: $SRC"
echo "[snapshot] target: $DST"

if [[ ! -d "$SRC" ]]; then
  echo "[snapshot] ERROR: PROJECTS_DIR이 존재하지 않음 — Goditor를 한 번이라도 실행했는지 확인" >&2
  exit 1
fi

if [[ -e "$DST" ]]; then
  if [[ -d "$DST" ]] && [[ -z "$(ls -A "$DST" 2>/dev/null)" ]]; then
    echo "[snapshot] target 디렉터리 이미 비어있는 채로 존재 — 그대로 사용"
  else
    echo "[snapshot] ERROR: target($DST)이 이미 존재하고 비어있지 않음" >&2
    echo "[snapshot]        실수로 데이터 덮어쓰지 않도록 abort. 다른 경로를 지정하세요." >&2
    exit 2
  fi
fi

mkdir -p "$DST"

echo "[snapshot] rsync 시작…"
rsync -a --human-readable "$SRC/" "$DST/"

ENTRY_COUNT=$(find "$DST" -maxdepth 1 -mindepth 1 | wc -l | tr -d ' ')
DU_SIZE=$(du -sh "$DST" 2>/dev/null | awk '{print $1}')

echo "[snapshot] 완료"
echo "[snapshot]   entry: $ENTRY_COUNT"
echo "[snapshot]   size : $DU_SIZE"
echo ""
echo "[snapshot] 다음 단계 (예시):"
echo "  node scripts/verify-bundle-migration.mjs --dry-run-from \"$DST\""
echo "  node scripts/verify-bundle-migration.mjs --regression-checks \"$DST\""
echo "  node scripts/verify-bundle-migration.mjs --kill-9-simulation \"$DST\""
