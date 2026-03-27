# 상페마법사 웹에디터 심층 디버깅

## 실행 환경
- Electron 앱: `--remote-debugging-port=9334`
- CDP 접속: `http://localhost:9334`

## 에이전트 구성
| 에이전트 | 파일 | 담당 |
|---------|------|------|
| Agent-α | scenarios/alpha-figma-standards.md | 피그마 표준 기능 |
| Agent-β | scenarios/beta-state-contamination.md | 상태 오염 |
| Agent-γ | scenarios/gamma-ui-consistency.md | UI 일관성 |
| Agent-δ | scenarios/delta-history-integrity.md | 히스토리 무결성 |
| Agent-01 | scenarios/01-text-blocks.md | 텍스트/Gap/Divider |
| Agent-02 | scenarios/02-asset-circle.md | Asset/Circle 이미지 |
| Agent-03 | scenarios/03-card-table.md | Card/Table |
| Agent-04 | scenarios/04-banner-graph.md | Banner/Graph |
| Agent-05 | scenarios/05-row-col-section.md | Row/Col/Section/Page |
| Agent-06 | scenarios/06-layer-template-branch.md | Layer/Template/Branch |

## 결과 확인
`debug/results/` 폴더의 JSON 파일 확인
