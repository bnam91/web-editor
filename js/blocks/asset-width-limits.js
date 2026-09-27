/* asset-width-limits.js — 에셋(이미지) 블럭 «폭»의 하한. 단 하나의 자리. (2026-09-20 신설)
 *
 * ★현빈 결정 2026-09-20 (T-075 ㉠): 「이미지 블럭 폭 하한을 패널에서도 60 으로 낮춘다」
 *   스크래치패드는 아이템을 60px 까지 줄인다(scratch-pad.js 의 fMin = Math.max(60/startW, …)).
 *   그 크기 그대로 섹션에 들어온 블럭이(canvas-scratch-drop.applyScratchWidth) 우측패널을
 *   한 번 거쳤다고 100 으로 «조용히» 커지면 안 된다.
 *
 * ⚠️왜 파일까지 만드나 — gap-limits.js 와 «같은 이유»다. 60 이 될 자리가 셋이었다:
 *   ⑴ 패널 폭 슬라이더 min          (props/prop-asset.js)
 *   ⑵ 패널 폭 숫자칸 min + 커밋 clamp (props/prop-asset.js)
 *   ⑶ 모서리 핸들 드래그 clamp 4곳   (overlay-handles.js _onAssetResizeHandleMouseDown)
 *   하나만 고치면 «다른 하나»가 조용히 막는다 — 패널은 60 까지 내려가는데 핸들을 1px 만
 *   움직이면 다시 100 으로 올라앉는 식으로. 그게 이 결함의 원래 모양이다.
 *
 * ⛔여기 값은 «에셋 블럭 폭» 전용이다. 아래 100 들과 헷갈리지 마라 — 다른 것이다:
 *   · js/props/prop-mockup.js:110 · js/blocks/mockup-block.js — 목업 폭 하한 100 (현빈: 별개)
 *   · js/blocks/canvas-block.js   — 카드 이미지 확대율 100%(= 배율이지 px 가 아니다)
 *   · js/blocks/banner02-block.js — font-weight 100 (글꼴 굵기)
 *   · overlay-handles.js:1373~ 캔버스 블럭 폭 하한 100 (별개 블럭)
 *
 * ⛔«상한»은 여기 안 둔다. 에셋의 860 은 최대폭이 아니라 «풀블리드 문턱»이다
 *   (applyW: v >= 860 이면 width 를 지우고 applyAssetFullBleed 로 넘긴다).
 *   숫자 하나로 보이지만 뜻이 둘이라, 여기로 옮기면 「상한을 900 으로」 같은 변경이
 *   풀블리드 문턱까지 같이 끌고 간다.
 *
 * ⛔min-width CSS 를 새로 만들지 않는다 — 최소값은 이미 «내용»이다(modal-block.js:79 과 같은 규율).
 *   두면 «두 개의 최소값»이 생겨 어느 쪽이 이겼는지 못 읽는다.
 */
export const ASSET_W_MIN = 60;

if (typeof window !== 'undefined') { window.ASSET_W_MIN = ASSET_W_MIN; }
