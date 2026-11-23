/* text-scale-tool — t13A-08 K 텍스트 스케일 모드(현빈 지시 0.9.13_t13A · 설계 = 지디 handoff/RESEARCH-t13A-08-text-scale-tool.md).
 *   Figma Scale(K) 처럼 «통째 비례»: 글자 + 자간·패딩·외곽선 두께·그림자까지 같은 k(지금 오버레이 모서리는 글자·아이콘만).
 *   손잡이·k 식·맞은편 코너 고정·히스토리 = overlay-handles.js 텍스트 모서리 «그 함수»(사본 0) — posEl._textScale 이 켜져 있으면
 *     ⑴ 흐름 텍스트에도 손잡이를 주고 ⑵ 흐름이면 폭·위치는 안 쓴다(부모가 정함) ⑶ textScaleSnapshot 으로 나머지를 같은 k 로.
 *   켜기 = 맨 K(그리드·laurel 아이콘 게이트 «뒤») · 끄기 = K 다시 · Esc · V(tool-modes 명부) · 선택이 바뀌거나 글자 편집에 들어가면 저절로.
 *   ⛔모드 표식은 dataset 이 아니라 요소 속성(_textScale) — 저장·직렬화·⌘Z 표본에 0. */
import { posElOf } from './overlay-float.js';
import { readStrokeState, applyStroke } from './props/prop-text-wireup-stroke.js';
import { readShadowState, writeTextShadow } from './props/prop-text-wireup-shadow.js';

const SEL = '.text-block.selected, .speech-bubble-block.selected, .icon-text-block.selected';
const PADS = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
let _blk = null, _pos = null, _raf = 0;

const _editing = (b) => b.classList.contains('editing') || !!b.querySelector('[contenteditable="true"]');

export function textScaleExit() {
  if (!_blk) return false;
  if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
  if (_pos) delete _pos._textScale;   // 흐름 텍스트 손잡이는 overlay-handles 의 rAF 가드가 다음 프레임에 걷는다
  const blk = _blk;
  _blk = _pos = null;
  /* t13F-02(현빈 261122) — K 동안의 손잡이(옛 모서리 + 상자 «변» 넷)만 남고 보통 꼴(모서리+변 여덟)로 안 돌아왔다(Esc 뒤 = 변 넷뿐).
     아직 골라져 있으면 보통 손잡이를 다시 그린다(선택이 바뀌어 끈 경우는 새 선택이 제 손잡이를 그린다). */
  if (blk?.isConnected && blk.classList.contains('selected')) window.showHandlesFor?.(blk);
  return true;
}

export function textScaleToggle() {
  if (_blk) return textScaleExit();   // ★K 재입력 = 끄기(현빈 결정 ① 추천안) — «아니오»면 이 한 줄만 뺀다
  const sel = document.querySelectorAll(SEL);
  if (sel.length !== 1 || _editing(sel[0])) return false;
  _blk = sel[0];
  _pos = posElOf(_blk) || _blk;
  _pos._textScale = true;
  window.showHandlesFor?.(_blk);
  const watch = () => {
    if (!_blk) return;
    if (!_blk.isConnected || !_blk.classList.contains('selected') || _editing(_blk)) { textScaleExit(); return; }
    _raf = requestAnimationFrame(watch);
  };
  _raf = requestAnimationFrame(watch);
  return true;
}

/** 마우스다운 때 값을 떠 두고 apply(k) 를 돌려준다(매 프레임 «시작 값 × k» — 누적 곱 표류 0).
 *  shortcut: 패딩은 인라인으로 «정해 둔» 값만 키운다(CSS 기본 패딩은 그대로) — 기본 패딩도 비례가 필요하면 그때 computed 로. */
export function textScaleSnapshot(posEl) {
  const cells = [...posEl.querySelectorAll('[class^="tb-"], .itb-text')]
    .filter((el) => el.namespaceURI !== 'http://www.w3.org/2000/svg');
  const blocks = posEl.matches(SEL.replace(/\.selected/g, '')) ? [posEl]
    : [...posEl.querySelectorAll('.text-block, .speech-bubble-block, .icon-text-block')];
  const ls = cells.filter((el) => /px$/.test(el.style.letterSpacing)).map((el) => ({ el, v: parseFloat(el.style.letterSpacing) }));
  const pad = blocks.flatMap((el) => PADS.filter((p) => /px$/.test(el.style[p])).map((p) => ({ el, p, v: parseFloat(el.style[p]) })));
  const stroke = cells.map((el) => ({ el, s: readStrokeState(el) })).filter((x) => x.s.on);
  const shadow = cells.map((el) => ({ el, s: readShadowState(el) })).filter((x) => x.s.enabled);
  return (k) => {
    ls.forEach(({ el, v }) => { el.style.letterSpacing = (v * k).toFixed(2) + 'px'; });
    pad.forEach(({ el, p, v }) => { el.style[p] = Math.round(v * k) + 'px'; });
    stroke.forEach(({ el, s }) => applyStroke(el, { ...s, width: s.width * k }));
    shadow.forEach(({ el, s }) => writeTextShadow(el, { ...s, x: Math.round(s.x * k), y: Math.round(s.y * k), blur: Math.round(s.blur * k) }));
  };
}

window.textScaleToggle = textScaleToggle;
window.textScaleExit = textScaleExit;
window.textScaleSnapshot = textScaleSnapshot;
window.registerToolModeExit?.('textScale', textScaleExit);
