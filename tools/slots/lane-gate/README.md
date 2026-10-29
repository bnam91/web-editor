# tools/slots/lane-gate — 레인 문턱 자(착수·런마다 부른다)

- 옮긴 곳(261029 · 지디 266 «아이맥 임시 문턱 자를 tools/slots/ 로 옮기고 그 사본을 지워라» · 임자 S7):
  옛 자리 `~/taeyang-098/reports/S7-handoff-imac-gate/`(Intel · 버전관리 밖) → 이 폴더. 그 위의 뿌리는 S7 `~/taeyang-098/S7-FIX/t250/s7-250-slot.sh`(＋rss-guard.sh).
- ⚠️지디가 «그 파일 머리에 박은 «옮길 곳»» 글은 이 커밋 때 ★못 읽었다(이 판 20e734fc · srv 홈 · Intel 사본 어디에도 없음 — 아이맥 쪽일 공산). 그 글이 이 폴더 이름·꼴과 다르면 그 글을 따른다.

| 파일 | 무엇 |
|---|---|
| lane-gate.sh | 문턱(pressure free ≥50 · load1 ≤ LOADMAX 기본 6 · swap 1분 ≤100MB · 다른 앱 ≤ MAX_OTHERS 1) · `GATE_ONLY=1` 재기만 · `FIRE=1` 발동 시험 · rc 0 통과 / 3 문턱 밑 |
| rss-guard.sh | 지킴 — RSS 하나 > thresh.mb · swap +1000MB · pressure < 30% → 내림(rc 9) · pid 0 = 미측 |
| guard-run.sh | 지킴 아래 런: `zsh tools/slots/lane-gate/guard-run.sh <PAT> <태그> <로그폴더> -- <명령>` |
| hdr.sh | 머리 줄(다른 레인 런 · 다른 앱 · load · free+inactive · swap) · 제 레인 = LANE_TAG |
| thresh.mb | 지킴 상한(MB) 3000 |
| fresh.cjs | 새 프로젝트(projects.html → #btn-new) · PW_PATH · LANE_CDP · TREE env 필수 |

## 쓰는 법
- 재기만: `LANE_TAG=<태그> GATE_ONLY=1 zsh tools/slots/lane-gate/lane-gate.sh` → rc 0 통과 · rc 3 문턱 밑(안 띄움 · 대기)
- 다른 슬롯에서: `SLOT_GATE="LANE_TAG=<태그> GATE_ONLY=1 zsh tools/slots/lane-gate/lane-gate.sh" bash tools/slots/<슬롯>.sh`
- 앱 띄우기(FIRE): `LANE_CDP`·`LANE_MCP`(레인 제 대역 · 아이맥 L1 9700~9709 … L6 9750~9759 · Intel 태양 레인 9610~9629 · mcintel-gd-L1 9630~9639 · L2 9640~9649) · `TREE` · `APPLANE`(기본 `$HOME/taeyang-098/applane.sh`)
- 산출: `SLOT_OUT`(기본 `$HOME/.gd-work/lane-gate-out/<태그>`) — 레포 안에 안 쓴다.

## 바꾼 값(뿌리 s7-250-slot.sh 대비 · 지디 11:3x ⒜~⒠)
⒜ LOADMAX 6 ⒝ 띠 → LANE_CDP/LANE_MCP ⒞ 경로 → 이 폴더·$HOME · 산출 레포 밖 ⒟ 지킴 pressure <30(원 25) ⒠ playwright → PW_PATH. 250 성능 런 칸은 안 실음(GATE_ONLY·FIRE 만 · 그 밖엔 rc 2).

## ⬜ 안 된 것
- `applane.sh`(Intel 태양 도구 · 레포 밖)는 띠 9610~9629 만 받는다 ⇒ 다른 대역으로 띄우려면 그 대역을 받는 applane 이 `APPLANE` 로 있어야 한다.
