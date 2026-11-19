/* jpg-fit.js — t13C-04 ④ 유튜브 썸네일 JPG 2MB 지킴(현빈 Q7 권장안 «품질 자동 내림» · 261119 · 태양)
 * ★순수 — import 0 · DOM 0 (단위가 가짜 encode 로 잰다: tests/unit/yt-thumb-jpg-fit.test.mjs).
 * ★한도 = 2,000,000 바이트(유튜브 «2MB» — 2·1024² 보다 좁은 쪽으로 잡는다).
 * ★쓰는 자리 = js/io/export-image.js 의 1280(유튜브)·JPG 내보내기 한 곳. 다른 폭·꼴은 0.95 고정 그대로. */
export const YT_JPG_LIMIT = 2000000;
export const JPG_QUALITY_STEPS = Object.freeze([0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5]);

/** encode(q) → Promise<{size}|null>. 첫 품질부터 내려가며 한도 안이 나오면 멈춘다(한도 안이면 첫 품질 그대로 · 재인코딩 0).
 *  끝까지 넘으면 마지막(가장 작은) 것 + over:true. encode 가 null 이면 그대로 돌려준다(부르는 쪽이 toBlob 실패로 던진다). */
export async function fitUnderBytes(encode, limit, steps = JPG_QUALITY_STEPS) {
  let blob = null, quality = steps[0], tries = 0;
  for (quality of steps) {
    blob = await encode(quality); tries++;
    if (!blob || blob.size <= limit) return { blob, quality, tries, over: false };
  }
  return { blob, quality, tries, over: true };
}
