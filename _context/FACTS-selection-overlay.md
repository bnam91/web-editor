## A. .블록.selected 아웃라인 (28종)
블록                      outline-offset                                방향      z-index 판정
asset-block             calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
banner02-block          var(--ui-sel-outline-offset-out, calc(1px *   바깥      ✅2      ⚠️이웃 위에 얹힌다(고의)
bridge-block            calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
canvas-block            var(--ui-sel-outline-offset-out, calc(1px *   바깥      ✅2      ⚠️이웃 위에 얹힌다(고의)
chat-block              calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
comparison-block        calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
divider-block           calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
frame-block             calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
gap-block               calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
gradient-block          calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
graph-block             calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
grid-block              calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
icon-block              calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
icon-circle-block       0                                             바깥      ✅2      ⚠️이웃 위에 얹힌다(고의)
icon-text-block         calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
infocard-block          calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
innercard-block         calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
joker-block             calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
label-group-block       calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
laurel-block            calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
mockup-block            calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
overlay-tb              0                                             바깥      ⛔없음     ★★결함 — 이웃이 덮는다
shape-block             calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
step-block              calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
sticker-block           calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     
table-block             calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
text-block              calc(-1 * var(--sel-outline-w))               안쪽      ✅2      
vector-block            calc(-1 * var(--sel-outline-w))               안쪽      ⛔없음     

★★ 바깥 아웃라인인데 z-index 없는 블록: ['overlay-tb']
z-index:2 목록 총 17 개

## B. 부모가 대신 그리는 판(:has)
  css/editor-blocks.css:38:/* :not(:has(.selected)) — 자손 중 selected가 있으면 차단하지 않음 (nested frame drill-in 지원) */
  css/editor-blocks.css:39:.frame-block:not(.selected):not([data-text-frame]):not(:has(.selected)) *:not(.shape-block):not(.shape-handle) {
  css/editor-blocks.css:1013:.row:has(.text-block.selected),
  css/editor-blocks.css:1014:.frame-block[data-text-frame="true"]:has(.text-block.selected) {
  css/editor-blocks.css:1022:.frame-block[data-text-frame="true"]:has(.text-block.selected) {
  css/editor-blocks.css:1028:.row:has(.text-block.selected) > .text-block.selected,
  css/editor-blocks.css:1035:.row:has(.speech-bubble-block.selected),
  css/editor-blocks.css:1036:.frame-block[data-text-frame="true"]:has(.speech-bubble-block.selected) {
  css/editor-blocks.css:1040:.row:has(.speech-bubble-block.selected)::after,
  css/editor-blocks.css:1041:.frame-block[data-text-frame="true"]:has(.speech-bubble-block.selected)::after {
  css/editor-blocks.css:1161:.frame-block:has(.shape-block.selected) {
  css/editor-blocks.css:1195:.frame-block[data-text-frame="true"]:has(.text-block.selected) {
  css/editor-blocks.css:1248:   (editor-blocks.css:39 의 pointer-events 차단이 `:not(:has(.selected))` 라 이때 풀린다).

## C. z-index 로 위로 올리는 목록
  1072:/* 선택된 블록이 인접 블록의 outline을 가리지 않도록 z-index로 위로 올림
  1079-     ⇒ z-index 가 «가장 필요한» 둘이 목록에서 빠져 있었다. 실측: 카드 bottom 346 =
  1081-       차지하는데 둘 다 z-index:auto 라 DOM 뒤인 에셋이 그 위에 그려진다.
  1084-.text-block.selected,
  1085-.asset-block.selected,
  1086-.gap-block.selected,
  1087-.label-group-block.selected,
  1088-.icon-circle-block.selected,
  1089-.table-block.selected,
  1090-.graph-block.selected,
  1091-.divider-block.selected,
  1092-.bridge-block.selected,

## D. 오버레이 층에 이미 그려지는 것

## E. 줌 보정 없는 하드코딩 아웃라인(스케일러 안에서 줌에 곱해짐)
  총 42
  css/ai-image.css:291:  outline: 2px dashed var(--ui-accent-primary, #2d6fe8);
  css/editor-extra.css:1800:body.spl-linking .section-block { outline: 2px dashed var(--ui-accent, #4f6bed); outline-offset: 2px; cursor: pointer; }
  css/report-modal.css:224:  outline: 2px dashed var(--ui-accent-primary);
  css/assets-panel.css:54:  outline: 2px dashed var(--ui-accent);
  css/assets-panel.css:84:  outline: 1px solid var(--ui-accent);
  css/assets-panel.css:146:  outline: 1px solid var(--ui-accent);
  css/assets-panel.css:335:  outline: 2px solid var(--ui-accent);
  css/assets-panel.css:339:  outline: 2px solid var(--ui-accent-primary);
  css/assets-panel.css:494:  outline: 2px solid var(--ui-accent-primary, #2d6fe8);
  css/assets-panel.css:505:  outline: 1px solid var(--ui-accent-primary, #2d6fe8);
  css/assets-panel.css:511:  outline: 2px solid var(--ui-accent-primary, #2d6fe8);
  css/color-picker.css:423:  outline: 1px solid var(--ui-accent-primary, #2d6fe8);
캔버스 안쪽 + 줌보정 없음 = 15 곳
  editor-blocks.css    .frame-block.ss-drag-over                                      2px dashed var(--sel-color)
  editor-blocks.css    .icon-circle-block.img-editing                                 2px dashed var(--sel-color) !important
  editor-blocks.css    .asset-block.drag-over                                         2px dashed var(--sel-color) !important
  editor-blocks.css    .asset-block.pos-dragging                                      1px solid var(--sel-color) !important
  editor-blocks.css    .section-block.bg-pos-dragging, .frame-block.bg-pos-dragging   1px solid var(--sel-color) !important
  editor-blocks.css    .icon-circle-block.drag-over .icb-circle                       2px dashed var(--sel-color)
  editor-blocks.css    .table-block .tb-table td.cell-selected, .table-block .tb-ta   2px solid var(--sel-color, #2b8aff)
  editor-blocks.css    .tb-table td[contenteditable="true"], .tb-table th[contented   1px solid var(--sel-color)
  editor-blocks.css    .banner02-block .bn2-line-empty                                1px dashed var(--ui-border-mid)
  editor-blocks.css    .comparison-block .cmp-hd[contenteditable="true"], .comparis   1px solid var(--sel-color)
  editor-blocks.css    .laurel-block:hover                                            1px dashed var(--sel-color)
  editor-blocks.css    .annotation-block.selected .annot-label                        1.5px solid var(--ui-accent-primary)
  editor-layout.css    .section-block[data-protected="true"]                          1px dashed rgba(232, 197, 71, 0.42)
  editor-layout.css    .text-block.editing                                            1.5px dashed var(--sel-color)
  editor-layout.css    .overlay-tb.selected, .asset-overlay .label-group-block.sele   1.5px dashed rgba(255,255,255,0.7) !impo
