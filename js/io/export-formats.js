/* export-formats.js — ★★내보내기 «꼴»의 ★정본 ★한 자리. (2026-10-25 신설 · t6-01 · 지디)
 *
 * ★왜 생겼나 — ★같은 명부가 ★«둘»이었다. ★경고 주석으로는 ★못 막는 꼴이다 :
 *   ⑴ ★선택지 — `js/props/prop-page.js` 와 `js/props/prop-section.js` 가 ★같은 네 줄을 ★손으로 ★두 번 적었다.
 *   ⑵ ★gif 판정 — `js/io/export-gate.js` 와 `js/io/export-gate-core.js` 가 ★'gif'·'gif-anim' 을 ★두 번 적었다.
 *   ⑶ ★mime/ext — `js/io/export-image.js` 가 ★`fmt === 'jpg' ? … : …` ★삼항 ★둘로 갈랐다.
 *   ⇒ ★★「명부가 둘이면 ★파생시켜 ★하나로」. ★여기가 ★그 하나다.
 *
 * ★★꼴을 ★더할 때 — ★이 배열에만 ★줄을 ★보태라. ★소비자는 ★전부 ★여기서 ★파생한다.
 *   ★잠그는 자 = `tests/unit/export-formats-single-roster.test.mjs`
 *     (★소비자가 ★제 명부를 ★다시 짓지 ★않는지 ★소스로 ★세고, ★변이대조로 ★그 자가 ★돈다는 것도 ★증명한다)
 *
 * ★★`mime`·`ext` 가 ★없는 꼴(gif 둘)은 ★`toBlob` 길을 ★안 탄다 — ★별도 인코더로 간다
 *   (`export-image.js` 의 `isGif` 분기). ⇒ ★그 꼴에 `exportMimeOf` 를 부르면 ★png 로 ★떨어지는데,
 *   ★그 값은 ★쓰이지 ★않는다(부르는 자리가 ★gif 분기 ★밖이다). ⛔그 폴백에 ★기대지 마라.
 */

export const EXPORT_FORMATS = Object.freeze([
  Object.freeze({ id: 'png',      label: 'PNG',              short: 'PNG',  mime: 'image/png',  ext: 'png'  }),
  Object.freeze({ id: 'jpg',      label: 'JPG',              short: 'JPG',  mime: 'image/jpeg', ext: 'jpg'  }),
  /* ★t6-01 (현빈 「우측패널 export 에 png, gif 외에 ★webp 로도 내보내기 가능하게 해줘」 · p10564).
     ★래스터 셋을 ★묶어 두고 GIF 를 ★뒤에 둔다 — ★고르는 사람의 ★머릿속 묶음과 같다.
     ★★⛔원문은 ★「png, gif 외에」라 ★`jpg` 를 ★안 셌다. ★그것은 ★줄임으로 읽었고
       ★jpg 를 ★빼라는 말은 ★어디에도 ★없다 ⇒ ★그대로 둔다. ★틀렸으면 `WEBP-ORDER-OMITS-JPG-01`. */
  Object.freeze({ id: 'webp',     label: 'WebP',             short: 'WebP', mime: 'image/webp', ext: 'webp' }),
  /* ★`short` = ★결과 모달의 ★뱃지에 쓰는 ★짧은 이름 — ★GIF 둘은 ★같은 'GIF' 로 묶인다(★그 자리의 옛 규약 그대로). */
  Object.freeze({ id: 'gif',      label: 'GIF (정적)',       short: 'GIF',  gif: true }),
  Object.freeze({ id: 'gif-anim', label: 'GIF (애니메이션)', short: 'GIF',  gif: true, anim: true }),
]);

/** 꼴 id → 정의. ★모르는 id 는 ★첫 꼴(png)로 떨어진다 — ⛔그 폴백을 ★판정에 쓰지 마라. */
export function exportFormatOf(id) {
  return EXPORT_FORMATS.find(f => f.id === id) || EXPORT_FORMATS[0];
}
/** 이 꼴이 GIF 인코더 길인가(정적·애니 둘 다). */
export function isGifFormat(id) { return !!exportFormatOf(id).gif; }
/** 이 꼴이 ★여러 프레임을 뜨는가(애니메이션). */
export function isAnimFormat(id) { return !!exportFormatOf(id).anim; }
/** `canvas.toBlob` 에 넘길 mime. */
export function exportMimeOf(id) { return exportFormatOf(id).mime || 'image/png'; }
/** 내려받는 파일의 확장자. */
export function exportExtOf(id) { return exportFormatOf(id).ext || 'png'; }
/** 결과 모달 뱃지에 쓰는 ★짧은 이름. ★모르는 id 면 ★그 id 를 ★대문자로(옛 폴백 그대로). */
export function exportShortOf(id) {
  const f = EXPORT_FORMATS.find(x => x.id === id);
  return f ? f.short : String(id || '').toUpperCase();
}

/** 두 패널이 ★같이 쓰는 `<option>` 들. ★`cur` 와 같은 꼴에 `selected`. */
export function exportFormatOptionsHTML(cur) {
  return EXPORT_FORMATS
    .map(f => `<option value="${f.id}"${f.id === cur ? ' selected' : ''}>${f.label}</option>`)
    .join('\n          ');
}

/* ★전역으로도 내준다 — ★까닭 ★둘 :
   ⑴ ★검사가 ★브라우저 쪽에서 ★정본을 ★집어야 한다(tests/dom/t6-01-webp-export ★W3).
   ⑵ ★★`js/export-result-modal.js` 는 ★★ESM 이 ★아니다(import/export 줄 ★0) ⇒ ★import 를 ★못 한다.
      ⇒ ★그 파일은 ★이 전역을 ★쓴다. ★★⛔단 ★«함수 안»에서 읽어라 — ★최상위에서 읽으면
        ★로드 순서에 따라 ★`undefined` 다. ★거기에 ★그 사고를 막는 주석을 ★같이 뒀다.
   ★ESM 인 소비자는 ★전부 ★import 한다(★그쪽이 ★순서가 ★보장된다). */
if (typeof window !== 'undefined') window.EXPORT_FORMATS = EXPORT_FORMATS;
