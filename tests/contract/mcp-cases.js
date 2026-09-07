/* mcp-cases.js — F3 «도구 전수» 케이스표. (2026-09-07 신설, U0)
 *
 * ★이 파일이 «체크인된 정본»인 이유 — 계측기가 자기 자신을 재지 않게 하려고.
 *   기대 배선(sinks)을 «테스트 시점에 소스에서 다시 뽑으면», 배선을 지웠을 때 기대도 같이
 *   사라져 초록이 난다. 실제로 하루 7건 나던 병이다.
 *   ⇒ 「이 도구는 브리지의 이 메서드를 부른다」를 여기에 «값으로» 박아 둔다.
 *      registerTool 줄·invoker 키·<script> 배선을 지우면 여기 기대와 어긋나 «빨강»이다.
 *
 * ★sinks 는 «추정이 아니라 실측»이다 — 하네스로 84개를 전수 호출해 실제 호출된
 *   브리지 메서드를 그대로 옮겼다(2026-09-07 @6dc2385). historyTip(부기)은 뺐다.
 *
 * 필드:
 *   args         — 그 도구가 «성공»하는 최소 인자(F6 픽스처의 blockId/sectionId 사용)
 *   sinks        — 반드시 «각각 한 번 이상» 불려야 하는 브리지 메서드.
 *                  [] = 디스크/순수 계산 도구라 배선이 «없는 게 옳다»
 *   setup        — 이 케이스 전에 먼저 돌릴 호출
 *   expectReject — 이 도구는 «거절»이 정상이다(구형/폐기)
 *   noOkKey      — 응답에 ok 키가 «없는» 현행 계약(고치면 여기도 고쳐라)
 *
 * ⛔도구를 추가하면 여기 줄도 «같이» 늘려라. 안 늘리면 F3-0 커버리지 게이트가 빨강이다.
 */
'use strict';

const CASES = {
  add_asset_block: { args: {}, sinks: ["addAssetBlock"] },
  add_banner02_block: { args: {}, sinks: ["addBanner02Block"] },
  add_banner_block: { args: {}, sinks: [], expectReject: true },
    // ★MVP 에서 «의도적으로» 제외된 구형 도구 — 거절이 옳다
  add_block: { args: {"type":"text","props":{"text":"hi"}}, sinks: ["addTextBlock"] },
    // ★통합 도구 — type 별로 다른 핸들러로 디스패치(여기선 text)
  add_canvas_block: { args: {}, sinks: ["addCanvasBlock"] },
  add_card_block: { args: {"cards":[{"title":"A","desc":"a"}]}, sinks: ["addCardBlock"] },
  add_chat_block: { args: {}, sinks: ["addChatBlock"] },
  add_checklist_item: { args: {"text":"할 일"}, sinks: ["addChecklistItem"] },
  add_comparison_block: { args: {}, sinks: ["addComparisonBlock"] },
  add_divider_block: { args: {}, sinks: ["addDividerBlock"] },
  add_frame_block: { args: {}, sinks: ["addFrameBlock"] },
  add_gap_block: { args: {}, sinks: ["addGapBlock"] },
  add_gradient_block: { args: {}, sinks: ["addGradientBlock"] },
  add_graph_block: { args: {}, sinks: ["addGraphBlock"] },
  add_icon_circle_block: { args: {}, sinks: ["addIconCircleBlock"] },
  add_icon_text_block: { args: {}, sinks: ["addIconTextBlock"] },
  add_iconify_block: { args: {"name":"ph:house-bold"}, sinks: ["iconify.fetchSvg","addIconifyBlock"] },
    // 아이콘 SVG 를 main 에서 받아(iconify.fetchSvg) 렌더러에 얹는다
  add_label_group_block: { args: {}, sinks: ["addLabelGroupBlock"] },
  add_laurel_block: { args: {}, sinks: ["addLaurelBlock"] },
  add_liner_block: { args: {}, sinks: ["addLinerBlock"] },
  add_mockup_block: { args: {}, sinks: ["addMockupBlock"] },
  add_section: { args: {}, sinks: ["addSection"] },
  add_shape_block: { args: {}, sinks: ["addShapeBlock"] },
  add_speech_bubble_block: { args: {}, sinks: ["addSpeechBubbleBlock"] },
  add_step_block: { args: {"steps":[{"title":"1단계"}]}, sinks: ["addStepBlock"] },
  add_sticker_block: { args: {}, sinks: ["addStickerBlock"] },
  add_table_block: { args: {}, sinks: ["addTableBlock"] },
  add_text_block: { args: {"content":"hello"}, sinks: ["addTextBlock"] },
  add_vector_block: { args: {"svg":"<svg viewBox=\"0 0 24 24\"><path d=\"M0 0h24v24H0z\"/></svg>"}, sinks: ["addVectorBlock"] },
  build_basic_section: { args: {"mainCopy":"메인 카피"}, sinks: ["buildBasicSection"] },
  create_project: { args: {}, sinks: ["projectOps.create"] },
  delete_block: { args: {"blockId":"tb_fx_h1"}, sinks: ["deleteBlock"] },
  delete_checklist_item: { args: {"id":"ck_1"}, sinks: ["deleteChecklistItem"] },
  delete_scratch_item: { args: {"id":"sp_br70mc"}, sinks: ["deleteScratchItem"] },
  delete_section: { args: {"sectionId":"sec_fixt_1"}, sinks: ["deleteSection"] },
  duplicate_project: { args: {}, sinks: ["projectOps.duplicate"] },
  export_sections: { args: {}, sinks: ["exportCollect","exportSections"] },
    // exportCollect(begin/settle/end 객체)와 exportSections(함수) 둘 다 탄다
  get_block_schema: { args: {"type":"text"}, sinks: [] },
    // 순수 스키마 조회 — 배선 없음
  get_canvas_state: { args: {}, sinks: ["getCanvasState"] },
  get_section_memo: { args: {"sectionId":"sec_fixt_1"}, sinks: ["getSectionMemo"] },
  insert_gap_after_block: { args: {"blockId":"tb_fx_h1","height":24}, sinks: ["insertGapAfterBlock"] },
  list_checklist_items: { args: {}, sinks: ["listChecklistItems"] },
  list_memories: { args: {}, sinks: [], noOkKey: true },
    // 디스크 스캔 — 배선 없음. ★응답에 ok 키가 없다(현행 계약)
  list_projects: { args: {}, sinks: ["projectOps.list"] },
  list_scratch_items: { args: {}, sinks: ["listScratchItems"] },
  move_block: { args: {"blockId":"tb_fx_b1","beforeId":"tb_fx_h1"}, sinks: ["moveBlock"] },
  move_section: { args: {"sectionId":"sec_fixt_2","beforeId":"sec_fixt_1"}, sinks: ["moveSection"] },
  open_project: { args: {"projectId":"proj_1"}, sinks: ["projectOps.open"] },
  put_image: { args: {"image":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mP4z8AAAAMBAQD3A0FDAAAAAElFTkSuQmCC"}, sinks: ["scratchAdd","addAssetBlock"] },
    // 보관함(scratchAdd)에 넣고 캔버스(addAssetBlock)에 얹는다 — 둘 다여야 «넣었다»
  read_project: { args: {}, sinks: [] },
    // 디스크(proj.json)를 직접 읽는다 — 브리지 배선이 «없는 게 옳다»
  read_scratch_item: { args: {"id":"sp_br70mc"}, sinks: ["readScratchItem"] },
  read_section: { args: {"sectionId":"sec_fixt_1"}, sinks: ["getCanvasState"] },
  search_iconify: { args: {"query":"house"}, sinks: ["iconify.search"] },
  set_section_memo: { args: {"sectionId":"sec_fixt_1","memo":"메모"}, sinks: ["setSectionMemo"] },
  undo_last_mcp_change: { args: {}, sinks: ["undoOnce"], setup: [["add_section",{}]] },
    // 추적된 편집이 «먼저» 있어야 undoOnce 까지 간다
  update_asset_block: { args: {"blockId":"ab_fx_small_a","borderRadius":24}, sinks: ["updateAssetBlock"] },
  update_banner02_block: { args: {"blockId":"bn2_1","variant":"frame_8"}, sinks: ["updateBanner02Block"] },
  update_block: { args: {"blockId":"tb_fx_h1","props":{"text":"새 제목"}}, sinks: ["editTextBlock"] },
    // ★통합 도구 — blockId 접두사로 디스패치(tb_ → editTextBlock)
  update_canvas_block: { args: {"blockId":"cvb_1","radius":24}, sinks: ["updateCanvasBlock"] },
  update_card_block: { args: {"blockId":"cvb_1","cards":[{"title":"B"}],"title":"x"}, sinks: ["updateCardBlock"] },
  update_chat_block: { args: {"blockId":"chb_1","messages":[{"title":"A","desc":"a","label":"L","text":"t"}]}, sinks: ["updateChatBlock"] },
  update_checklist_item: { args: {"id":"ck_1","done":true}, sinks: ["updateChecklistItem"] },
  update_comparison_block: { args: {"blockId":"cmp_1","layerName":"x"}, sinks: ["updateComparisonBlock"] },
  update_divider_block: { args: {"blockId":"dvd_1","lineStyle":"solid"}, sinks: ["updateDividerBlock"] },
  update_frame_block: { args: {"blockId":"ss_fx_frame_1","bgImage":"x"}, sinks: ["updateFrameBlock"] },
  update_gap_block: { args: {"blockId":"gb_fx_1","height":32}, sinks: ["updateGapBlock"] },
  update_gradient_block: { args: {"blockId":"grad_1","style":"linear"}, sinks: ["updateGradientBlock"] },
  update_graph_block: { args: {"blockId":"grb_1","chartType":"bar-v"}, sinks: ["updateGraphBlock"] },
  update_icon_circle_block: { args: {"blockId":"icb_1","border":"none"}, sinks: ["updateIconCircleBlock"] },
  update_icon_text_block: { args: {"blockId":"itb_1","text":"x"}, sinks: ["updateIconTextBlock"] },
  update_iconify_block: { args: {"blockId":"icn_1","iconName":"ph:house-bold"}, sinks: ["iconify.fetchSvg","updateIconifyBlock"] },
    // 아이콘 교체도 fetchSvg 를 «다시» 탄다
  update_label_group_block: { args: {"blockId":"lg_1","labels":["a"]}, sinks: ["updateLabelGroupBlock"] },
  update_laurel_block: { args: {"blockId":"lrb_1","layerName":"x"}, sinks: ["updateLaurelBlock"] },
  update_liner_block: { args: {"blockId":"lnr_1","preset":"arc-up"}, sinks: ["updateLinerBlock"] },
  update_mockup_block: { args: {"blockId":"mkp_1","deviceKey":"iphone"}, sinks: ["updateMockupBlock"] },
  update_scratch_item: { args: {"id":"sp_br70mc","name":"x","x":24}, sinks: ["updateScratchItem"] },
  update_section: { args: {"sectionId":"sec_fixt_1","bg":"#ffffff"}, sinks: ["updateSection"] },
    // ⚠️2026-09-07 정정(g-mcpmgr): 여기 «성공하는 최소 인자»가 {sectionId, name:"새이름"} 으로
    //   적혀 있었다. 그건 성공한 게 아니라 «아무것도 안 하고 ok» 였다 — name 은 핸들러
    //   구조분해에서 버려지고 bg 가 undefined 라 렌더러가 할 일이 없었는데, 「no fields」 가드가
    //   28개 update_* 중 «이 도구에만» 없어서 통과했다.
    //   ★결함이 픽스처에 «정답»으로 굳어 있었다 — 검사가 결함을 지켜 주고 있었던 것이다.
  update_shape_block: { args: {"blockId":"shp_1","shapeType":"rectangle"}, sinks: ["updateShapeBlock"] },
  update_speech_bubble_block: { args: {"blockId":"sb_1","tail":"left"}, sinks: ["updateSpeechBubbleBlock"] },
  update_step_block: { args: {"blockId":"stb_1","steps":[{"title":"A","desc":"a","label":"L","text":"t"}]}, sinks: ["updateStepBlock"] },
  update_sticker_block: { args: {"blockId":"stk_1","shape":"circle"}, sinks: ["updateStickerBlock"] },
  update_table_block: { args: {"blockId":"tbl_fx_1","headers":["a"]}, sinks: ["updateTableBlock"] },
  update_text_block: { args: {"blockId":"tb_fx_h1","text":"새 제목"}, sinks: ["editTextBlock"] },
    // update_block 의 «별칭»(mcp-block-tools.js 에서 등록) — 같은 핸들러
  update_vector_block: { args: {"blockId":"vb_1","svg":"x"}, sinks: ["updateVectorBlock"] },
};

module.exports = { CASES };
