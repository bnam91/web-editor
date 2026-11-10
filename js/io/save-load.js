import { canvasEl, state, PAGE_LABELS } from '../globals.js';   /* ★canvasWrap 은 뺐다 — 깔때기만 쓴다(직접 대입 재유입 방지) */
import { syncFrameBgVars, frameBgSize } from '../frame-bg.js';   /* ★프레임 배경 ★먹이는 한 자리(2026-10-10 ③) */
import { externalizeProjectData, adoptForeignAssets, applyAdoptedAssets, stopAdoptingForQuit, recordExternalizeBaseline } from './asset-externalize.js';
import { buildProjForSave } from './proj-merge.js';   /* ★저장 병합은 «한 벌»(T-232 ⓑ) */
import { liftSvgTransformsForH2C } from './h2c-prep.js';   /* ★svg 의 CSS transform 을 감싸는 쪽으로 — h2c 는 svg 쪽을 안 그린다 */
import { clearPendingForReload, isDrainSettled } from './save-reload-seal.js';
import { initLazySections, refreshLazyObservation } from './lazy-sections.js';
import { _resumeDragSave } from '../section-drag.js';   // [H6] 드래그 억제는 «켠 쪽»이 닫는다
import { NOTE_BG_FOLDER_ID, NOTE_BG_FOLDER_NAME, NOTE_BG_PATTERNS } from '../data/note-bg-patterns.js';
import { seedPaperTexturesOnce } from '../data/paper-textures.js';   /* 1013t2A4 종이 텍스처 8장 — «한 번만» 시드 · 보호 안 함 */
import { applyFrameTransform } from '../frame-geometry.js';
import { checkerBg } from '../checker-tokens.js';
import { applyCanvasBackground, syncSectionCheckerTextTone } from '../canvas-contrast.js';   /* 캔버스 배경은 «이 문 하나»로만 칠한다(검사 B1) · T6 섹션 안 글자 밝기 */
import { neutralizeRedactForH2C, neutralizeTextGradForH2C, neutralizeObjectFitForH2C, stripEditorOnlyForCapture, neutralizeEmptyImageCheckerForCapture, withGuideOff, neutralizeBoxReflectForH2C, restRuntimeForArtifact } from './capture-safety.js';
import { prepareGoyaAssetsForClone } from './goya-asset-inline.js';   /* 썸네일 클론에서 goya-asset 을 data: 로 (T-149) */
import { ejectShapeFrameIntruders } from '../shape-frame.js';
import { warnPendingVideoLossIf } from './pending-video-warn.js';   /* T-032: 미확정 영상 알림 단일 진실원 */
// 탭 함수는 tab-system.js에서 window.* 노출 (saveTabState, renderTabBar, switchTab 등)

/* ══════════════════════════════════════
   저장 / 불러오기
══════════════════════════════════════ */
// DBG-REFRESH: SAVE_KEY는 프로젝트별로 분리 — 탭 전환 시 다른 프로젝트 데이터 오염 방지
// 전역 키('web-editor-autosave')는 더 이상 사용하지 않음
const SAVE_KEY_PREFIX = 'web-editor-autosave';
const PROJECTS_KEY = 'sangpe-projects';

/* GAP-006/RCE: 비신뢰 프로젝트 HTML 소독.
   마켓플레이스/파일에서 받은 프로젝트의 canvas HTML이 DOM에 들어올 때 실행 가능한
   벡터(on* 이벤트 핸들러·<script>·javascript: URL)를 제거한다. 정상 디자인 콘텐츠
   (div/text/img/svg/style)는 그대로 보존 — 합법 블록엔 on 핸들러나 script가 없음.
   <template>로 파싱해 inert(스크립트 미실행·이미지 미로드) 상태에서 정리 후 반환. */
function sanitizeCanvasHtml(html) {
  if (!html || typeof html !== 'string') return html || '';
  let tpl;
  try {
    tpl = document.createElement('template');
    tpl.innerHTML = html;
  } catch (_) { return html; }
  const root = tpl.content;
  // 1) <script> 제거
  root.querySelectorAll('script').forEach(el => el.remove());
  // 2) on* 이벤트 핸들러 속성 + javascript: URL 제거
  let stripped = 0;
  root.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const val = (attr.value || '').replace(/\s+/g, '').toLowerCase();
      if (name.startsWith('on')) { el.removeAttribute(attr.name); stripped++; continue; }
      if ((name === 'href' || name === 'src' || name === 'xlink:href' || name === 'formaction' || name === 'action')
          && val.startsWith('javascript:')) { el.removeAttribute(attr.name); stripped++; }
    }
  });
  if (stripped) console.warn(`[sanitize] 비신뢰 canvas에서 위험 속성/요소 ${stripped}건 제거`);
  return root.firstChild ? tpl.innerHTML : '';
}
if (typeof window !== 'undefined') window.sanitizeCanvasHtml = sanitizeCanvasHtml;

/* ★C③(2026-10-09) «열 때»도 런타임 UI 상태를 벗긴다. 세 가지가 이 한 자리로 모인다.
   ⑴ ★이미 샌 저장물은 ★열어도 안 나았다. serializeCleanRoot 는 «클론»에만 도는 계약이라
     라이브 DOM 은 그 세션 내내 마커를 쥔다 ⇒ 저장 쪽(section-serialize.js 목록)만 고치면
     ★«새로 저장한 파일»만 낫고 현빈의 기존 프로젝트는 그대로다(= 「신규만 적용」 빚).
     실측된 결과: `multi-selected` 가 남으면 상자선택의 섹션 길(js/scratch-pad.js — 「이미
     multi-selected 면 건너뛴다」)이 그 섹션을 ★그 세션 내내 건너뛴다. 자동저장이 돌아도
     세척은 «클론»으로만 가므로 라이브는 안 고쳐진다.
   ⑵ ★이 세 자리가 ★갈려 있었다 — switchPage 쪽은 `img-editing`·`sec-bg-editing` 을 «손으로»
     벗겼고 나머지 둘은 ★안 벗겼다. 손 명부가 셋으로 갈린 꼴이다(어느 문으로 열었나에 따라
     남는 마커가 달랐다).
   ⑶ ⇒ 목록을 ★베끼지 않는다. js/io/section-serialize.js 의 ★단일 진실원
     (window.runtimeMarkers)에서 ★파생한다 — 거기 목록이 늘면 여기도 자동으로 늘어난다.
     ⛔여기에 클래스 이름을 ★손으로 적지 마라. 그러면 넷째 명부가 된다.
   ⛔sanitizeCanvasHtml 에 ★합치지 마라 — 그건 «비신뢰 입력»의 보안 세척(script·on*·javascript:)
     이고 이건 «우리 UI 상태» 세척이다. 까닭이 다르면 자리도 다르다(한쪽을 끄고 싶은 날이 온다).
   ★로드 계약은 위 serializeCleanRoot 호출과 ★같다 — section-serialize.js 는 플레인 스크립트라
     모듈(이 파일)보다 «먼저» 돈다. 그래서 폴백을 ★안 둔다(없으면 저장 경로가 이미 죽어 있다). */
function stripLoadedRuntimeState(root) {
  if (!root) return;
  root.querySelectorAll('.text-block-label, .asset-block-label').forEach(el => el.remove());
  root.querySelectorAll('[class]').forEach(window.runtimeMarkers.stripRuntimeMarkers);
}

/** 현재 activeProjectId 기준 localStorage 키 반환 */
function getSaveKey() {
  return activeProjectId ? `${SAVE_KEY_PREFIX}__${activeProjectId}` : SAVE_KEY_PREFIX;
}
function getSaveTsKey() {
  return getSaveKey() + '_ts';
}
/* localStorage 본이 «어느 파일 판에서 이어졌나» — 그 파일이 아직 디스크에 있을 때만 localStorage 가 파일을 이길 자격이 있다(열 때 판정).
   파일이 밖에서 바뀌면(사본·백업·되돌리기) 값이 달라 파일이 이긴다. 충돌로 저장이 끊기면 같아서 복구가 산다.
   쓰는 곳: 파일 쓰기는 preload.js 한 자리 · 여기는 열 때뿐. 시험: tests/dom/ls-file-base.dom.spec.js */
const _lsBaseKey = (id) => `web-editor-ls-base__${id}`;
const LS_PENDING_PREFIX = 'web-editor-ls-pending__';   // 옛 파일을 되돌린 뒤 사본을 못 남긴 새 LS 본 — <id>__<시각> (LS-NEWER-THAN-FILE-DELETED-ON-OLD-FILE-RESTORE-01)
/* 복구한 본이 파일과 다른가. 그림 주소는 저장 때 data → goya 로 바뀌니 글자로 비교하지 않는다:
   둘 다 data·둘 다 goya 면 글자 그대로(다른 그림이면 다르다), 한쪽만 data 면 내용 해시로 — goya 파일명이 sha256 앞 16자다(main/project-store/externalizer.js).
   해시를 못 내면(웹·비보안 문맥) 같다고 본다 — 무편집 쓰기(DEF-03)가 복구 유실보다 잦다. */
const _IMG_URL_RE = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]+=*|goya-asset:\/\/[^"'()\s&\\]+/gi;
async function _sameImage(a, b) {
  if (a === b) return true;
  const aData = a.startsWith('data:');
  if (aData === b.startsWith('data:')) return false;
  const [data, goya] = aData ? [a, b] : [b, a];
  if (!globalThis.crypto?.subtle) return true;
  const bytes = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), c => c.charCodeAt(0));
  const hex = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
  return goya.split('/').pop().split('.')[0] === hex.slice(0, 16);
}
window._sameImage = _sameImage;   // 마켓 머지 스크래치도 같은 뜻으로 견준다(js/market.js)
async function _lsDiffersFromFile(ls, file) {
  /* 복구분은 캔버스만이 아니다. 없는 필드 · 빈 값은 같게 본다(옛 파일에 없는 필드로 무편집 쓰기가 나지 않게). */
  const core = (d) => JSON.stringify({
    pages: (d?.pages || []).map(p => ({ id: p?.id, name: p?.name, pageSettings: p?.pageSettings, canvas: String(p?.canvas || '') })),
    checklistItems: d?.checklistItems, checklistSections: d?.checklistSections, assetsTree: d?.assetsTree, imageGallery: d?.imageGallery,
  }, (_k, v) => (v == null || (typeof v === 'object' && !Object.keys(v).length) ? undefined : v));
  const a = core(ls), b = core(file);
  if (a === b) return false;
  if (a.replace(_IMG_URL_RE, '§') !== b.replace(_IMG_URL_RE, '§')) return true;
  const ua = a.match(_IMG_URL_RE) || [], ub = b.match(_IMG_URL_RE) || [];
  for (let i = 0; i < ua.length; i++) if (!(await _sameImage(ua[i], ub[i]))) return true;
  return false;
}
let _lastOpenFallback = null;   // 이번 열기가 깨진 proj.json 대신 백업·이력을 읽은 프로젝트 id
let autoSaveTimer = null;
const AUTOSAVE_MAX_WAIT_MS = 5000;   // ★J354 — 앱 실측: 40초 연속 편집 쓰기 간격 5.6~6초 · 잃는 작업 최대 4.6초 · longtask 최대 75ms(글 55개 판)
let _autoSaveBurstAt = 0;
let _autoSaveBurstHeld = false;   // ★250C — 미룸이 타이머를 지웠어도 그 기다림은 이어진다(아니면 짧은 제스처 반복이 상한을 매번 되돌린다)
let currentFileName = null; // 현재 세션의 저장 파일명 (null = 최초 저장 전)

/* ── 프로젝트 관리 ── */
const _urlParams = new URLSearchParams(window.location.search);
let activeProjectId = _urlParams.get('project');

const IS_ELECTRON = !!window.electronAPI?.isElectron;

/* ── 탭 상태 ── */
const MAX_TABS = 5;
const TAB_STATE_KEY = 'web-editor-open-tabs';
// [{ id, name, _cache }]  — _cache: 탭 메모리 스냅샷 (즉각 전환용)
let openTabs = [];

/* ── 탭 함수는 tab-system.js에서 관리 (분리됨, 2025-03-31) ── */

/* ── 썸네일 생성 (첫 섹션 캡처 → base64, 200px 너비 축소) ── */
async function captureThumbnail() {
  /* ★E157 공용 대기(whenGridRatiosSettled · grid-block.js) — 칸 배경 비율이 서고 그 그리드가 다시 그려진 «뒤»에 찍는다(틀린 행 높이가 산출물로 굳지 않게).
     반환 none(기다릴 것 없음) / settled / cap(상한 — 함수가 수·주소를 찍음). ⛔그 결과로 막지 않는다 — 찍기는 그대로 간다. */
  await window.whenGridRatiosSettled?.();
  try {
    const firstSec = canvasEl?.querySelector('.section-block');
    if (!firstSec || typeof html2canvas === 'undefined') return null;

    const clone = firstSec.cloneNode(true);
    /* ★내보내기 클론과 «같은 명부»로 걷는다 — js/io/capture-safety.js stripEditorOnlyForCapture.
       예전엔 여기서 ⑴.section-label ⑵.section-toolbar ⑶루트의 .selected «셋»만 걷었다.
       그래서 저장할 때 편집 중이던 것이 프로젝트 목록 썸네일에 그대로 박혔다 — 펜 어노테이션,
       admin QA 블록, 편집 전용 임시 DOM(.sec-bg-proxy/.img-edit-hint/.img-boundary),
       「내용을 입력하세요」 안내문구, 자식 블록의 .selected/.img-editing/.row-active 테두리.
       (2026-09-21 최종통합 QA medium, 실측 EXPORT-D: 주석 200px·편집전용프록시 100px 이 찍힘) */
    stripEditorOnlyForCapture(clone);
    /* ★★움직이는 파티클을 ★«쉬는 꼴»로 — ★★썸네일은 ★사람이 ★「지금 이 모습」을 ★고른 것이 ★아니다.
       ★저절로 찍혀 ★`_meta.json` 에 박히고 ★프로젝트 목록 카드에 ★뜬다
       ⇒ ★★안 되돌리면 ★★«내가 ★안 건드렸는데 ★카드 그림이 ★바뀐다»가 ★사용자 체감이 된다.
       ★실측(2026-10-09 · 실앱 9406 · 제품의 saveProjectToFile 길):
         ★멈춘 판 ×3 ⇒ 썸네일 ★a84564fc/3547 ★셋 다 ★같다(★바닥 0)
         ★도는 판 ×3 ⇒ ★d23afaea/3723 · ★49546356/3695 · ★89b515b8/4023 ★전부 ★다르다
       ★★`stripEditorOnlyForCapture` ★바로 뒤다 — ★뒤의 `neutralizeBoxReflectForH2C` 가
         ★거울상을 ★또 뜨므로 ★먼저 되돌려야 ★거울도 ★쉬는 값을 ★베낀다. */
    restRuntimeForArtifact(clone);
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;';
    document.body.appendChild(clone);
    neutralizeRedactForH2C(clone); // html2canvas는 backdrop-filter 미지원 → 가림막 원본노출 방지(안전실패)
    neutralizeTextGradForH2C(clone); // html2canvas는 background-clip:text 미지원 → 글자 그라데이션은 첫 스탑 단색으로(0918r2 textgrad)
    await neutralizeObjectFitForH2C(clone); // html2canvas는 object-fit 미지원 → 상자에 «늘려» 그린다. 상자 크기대로 미리 잘라 끼운다(썸네일이 화면과 다른 그림이 되던 자리)
    /* 빈 이미지 칸의 체크무늬는 «편집용 무늬»다 — 프로젝트 목록 썸네일에 박히면 내보내기와 똑같이 새는 것.
       ★여기엔 컴포넌트 재렌더(renderComponentsInClone)가 «없다» — banner02/canvas-block 을 다시
         안 그리므로 이 자리(append 뒤)에서 한 번 부르면 충분하다. */
    neutralizeEmptyImageCheckerForCapture(clone);
    // 모자이크 redact(js/effects/redact-mosaic.js)는 cloneNode에 캔버스 비트맵이 안 딸려오므로
    // clone에 라이브 캔버스를 구워 넣는다 — 실패 시 함수 내부에서 불투명 회색 안전실패.
    if (window.finalizeMosaicForClone) { try { await window.finalizeMosaicForClone(firstSec, clone); } catch (_) {} }

    /* ★goya-asset 을 «클론에서만» data: 로 푼다 (T-149, 2026-09-22).
       까닭 — html2canvas 1.4.1 은 이미지를 «자기가 다시» 로드한다(vendor CacheStorage.loadImage).
         useCORS:true  → crossOrigin="anonymous" 를 달아 로드 → goya-asset:// 는 CORS 헤더가 없어 onerror
         useCORS:false → 로드 조건이 전부 거짓 → 읽지도 않는다
       ⇒ 그 에셋으로 만든 섹션은 카드 그림에서 «통째로» 빠진다.
       ⛔★그런데 빠져도 섹션 배경색이 «불투명»하게 찍혀서, 아래 «빈 그림» 판정(길이)에
         «안 걸린다» ⇒ 실패가 «성공»으로 보고된다. T-087 이 고친 병과 «다른 병»이고
         그 검사로는 이 축이 안 잡힌다 — 판정이 「비었는가」가 아니라 «밑그림 색이 있는가»여야 한다.
       ★뿌리는 T-071 이 모자이크에서 찾은 것과 같다. 부품도 그때 만든 것을 그대로 쓴다.
       ⛔라이브 DOM 은 안 건드린다(clone 에만 적용) — 저장본이 base64 로 부풀면 안 된다.
       ⛔실패해도 캡처를 멈추지 않는다 — 여기서 던지면 «그림이 아예 없는» 쪽이 되고,
         그건 지금보다 나쁘다. 못 푼 자리만 빠지고 나머지는 그대로 찍힌다. */
    try {
      const _goya = await prepareGoyaAssetsForClone(clone);
      if (_goya.unresolved.length) {
        console.warn('[thumb] goya-asset 을 못 읽어 카드 그림에서 빠진다:', _goya.unresolved);
      }
      await _goya.applyAndSettle(clone);   /* ★apply 만 하면 느린 기계에서 옛 goya-asset 을 찍는다 — goya-asset-inline.js applyAndSettle 주석 (2026-10-02) */
    } catch (e) { console.warn('[thumb] goya-asset 클론 준비 실패:', e); }

    const bgColor = firstSec.style.background || firstSec.style.backgroundColor || '#ffffff';
    /* ★반사(-webkit-box-reflect)를 ★클론에서 «그릴 수 있는 꼴»로 바꾼다 (C 버그 ② · 2026-10-08).
       html2canvas 1.4.1 은 그 속성을 ★모른다(vendor 전수 0건) ⇒ 지금까지 카드 그림에서 반사가 ★통째로 빠졌다.
       ★PNG 와 ★다른 자리다 — PNG 는 주 경로가 CDP 네이티브라 브라우저가 반사를 그려 준다(그래서
         tests/dom/effects-reflection R4 가 h2c 쪽을 「의도됨」으로 고정했다. ★그 「의도됨」은 ★대체 경로 이야기다).
         ★썸네일엔 ★대체가 ★없다 ⇒ 여기서는 ★고친다.
       ★자리 — ★모든 레이아웃 손질이 ★끝난 «뒤»여야 한다(거울 자리를 offsetTop/offsetHeight 로 읽는다).
       ⛔capture 공용 길(export-image)의 ★기본값으로 옮기지 마라 — PNG 는 그대로 둔다(라이브 캔버스 인자와 ★같은 규약).
       ⛔실패해도 찍기를 멈추지 않는다 — 반사 하나 때문에 그림을 ★아예 잃는 쪽이 더 나쁘다. */
    try { neutralizeBoxReflectForH2C(clone, bgColor); } catch (e) { console.warn('[thumb] 반사 대체 실패:', e); }
    /* ★svg 에 닿는 CSS transform 을 «감싸는 span»으로 올린다 — html2canvas 는 svg 쪽 것을 ★안 그린다
       (월계수 오른 잎 거울이 ★썸네일에서 사라지던 자리 · 현빈 2026-10-09). ★까닭·실측은 h2c-prep.js 머리말.
       ⛔클론이 ★document 에 ★붙은 «뒤»라야 한다 — detached 면 computed transform 이 ★빈 문자열이다. */
    try { liftSvgTransformsForH2C(clone); } catch (e) { console.warn('[thumb] svg transform 올리기 실패:', e); }
    /* ★L1(2026-10-04) — 편집 보조(그리드 가이드·패딩 비주얼)는 «캡처 동안» 끈다 — PNG(exportSection)와 «같은 함수» withGuideOff(capture-safety.js).
       지금까지 썸네일에 안 샌 것은 html2canvas 가 반복 그라데이션을 못 그려서일 뿐이었다(tests/dom/l1-guide-align L1-X). */
    /* ⚠️바로 아래 html2canvas 호출의 글자 꼴(await · 첫 인자 clone)을 지킨다 — tests/dom/thumb-goya-asset H4 가 그 글자를 «찍는 자리» 닻으로 쓴다(goya 풀기가 그 앞인지 본다).
       ⛔이 주석에 그 닻 글자를 그대로 적지 마라 — H4 는 주석을 안 거르고 «첫» 자리를 닻으로 잡는다(닻이 주석에 걸리면 진짜 호출을 안 잰다).
       ★꼴을 바꾸면 H4 가 «빨개진다»(전제 단언 + H5 음성대조가 있는 단단한 시험) — 다음 사람은 «왜 빨간지»를 모른다. 어색해 보여도 고치지 마라.
       0.9.7: H4 가 재려는 것(「푸는 자리가 찍는 자리보다 앞인가」)을 «실행 시점»에 잰다 — 호출 순서를 기록해 html2canvas «전»에 불렸나를 런타임으로(명부 E75 · 2026-10-04 지디). */
    /* ★라이브 캔버스(#canvas)는 «안 베낀다»(2026-10-07 지디 ㉠) — html2canvas 는 찍을 클론 하나가 아니라 «문서 전체»를 복제한다.
       썸네일은 첫 섹션 클론(body 에 붙은 것)만 쓰는데, 복제·레이아웃 비용은 캔버스의 «모든» 섹션 몫이었다
       (실측 20 섹션 × 입자 320: 썸네일 한 번 12.7~34.5 s · 메인스레드 최장 막힘 11.3~31.3 s · 판 2866df63 ×3 — 섹션 20 × 빈 것은 0.4~0.5 s).
       ⛔이 술어는 «이 호출부의 인자»다 — capture 공용 길(capture-safety · export-image)의 기본값으로 옮기지 마라(내보내기 PNG 는 그대로).
       ★165·168(J159C) — #canvas 만 빼도 문서 나머지(#main 패널 등 1.5만 요소)를 복제하는 값이 남았다: 합성 저장본 앱 번갈아 ×3 h2c 10.5~11.6 s → 0.61~0.70 s · 그림 해시 같음.
       그래서 body 바로 밑은 찍을 클론만 남긴다 — ⛔STYLE·LINK 는 남긴다(body 에 든 규칙이 클론 꼴을 정한다 · TS5). */
    const _skipOutsideClone = (el) => el === canvasEl || (el.parentElement === document.body && el !== clone && el.tagName !== 'STYLE' && el.tagName !== 'LINK');
    const canvas = await withGuideOff(async () => await html2canvas(clone, { scale: 1, useCORS: true, backgroundColor: bgColor, logging: false, ignoreElements: _skipOutsideClone }));
    document.body.removeChild(clone);

    /* 200px 너비로 축소 — ★«빈 그림»이면 null 이다. 그럴듯한 6자를 돌려주지 않는다 (T-87).
       toDataURL 은 높이 0 캔버스에서 «예외를 안 던지고» "data:,"(6자)를 돌려주고, 그 truthy 한
       6자가 _meta.json 에 «썸네일이 있다»로 박혀 카드를 빈 칸으로 만들었다(try/catch 로는 안 보인다).
       줄이기와 판정은 js/io/image-data-url.js «한 곳»에서 한다 — 카드를 그리는 쪽과 같은 함수다.
       (index.html 이 그 classic script 를 이 모듈보다 «먼저» 싣는다 —
        tests/unit/image-data-url.test.mjs 가 그 배선까지 잠근다.) */
    return window.makeThumbDataUrl(canvas);
  } catch { return null; }
}

/* ── 프로젝트 파일 저장 (Electron: projects/{id}.json, 브라우저: localStorage) ── */
// DBG-11: 저장 중 대기열 패턴 — 동시 저장 race condition 방지
let _isSavingToFile = false;
// H5: 프로젝트별 대기 큐 — 단일 슬롯이면 in-flight 중 2건+ 큐잉 시 중간 프로젝트 저장이
// 덮여 영구 드롭(빠른 연속 탭전환 시 중간 프로젝트 디스크 미반영). targetId별로 최신값 coalesce.
const _pendingSaves = new Map(); // targetId → { snapshot, opts }
// DEF-03: 마지막 저장 완료 이후 변경이 있었는지 — 무편집 방문/언로드가 파일을 재기록(updatedAt 오염)하지 않도록 게이트
let _dirtySinceSave = false;
/* ★345 — dirty·자동저장 타이머·진행 중 저장이 «어느 프로젝트의 것인가». 셋 다 전역 하나라, A 를 편집하고 곧바로 B→C 로 지나가면
   A 의 것을 B 의 것으로 읽어 무편집 B 를 다시 썼다(앱 실측 · ~/gd-lane/imac-gd-L1/345b). ⛔null(모름)은 지금 프로젝트의 것으로 센다 —
   거짓 «없음»은 편집을 잃고 거짓 «있음»은 한 번 더 쓸 뿐이다. 판정은 _hasOwnUnsaved 한 곳. */
let _dirtyOwnerId = null;
let _autoSaveTimerOwnerId = null;
let _savingOwnerId = null;
let _savingEntry = null;   // 앱이 끝날 때 아직 파일에 안 닿았을 수 있는 본(_flushUnfinishedSavesSync)
let _savingSuperseded = false;   // 그 본보다 새롭거나 같은 본이 동기로 들어갔다 — 준비 중인 저장은 안 보낸다
function _hasOwnUnsaved() {
  const mine = (owner) => owner === null || owner === activeProjectId;
  /* ★250C — 저장 진행 중에 손잡이를 쥐고 고치면 그 저장이 끝나며 dirty 를 지운다. 미룸에 기억된 예약(_autoSavePending)을 안 보면 쥔 채 ⌘R 에서 편집을 잃었다(앱 재현). */
  return (_dirtySinceSave && mine(_dirtyOwnerId)) || (_autoSavePending && mine(_dirtyOwnerId)) || (!!autoSaveTimer && mine(_autoSaveTimerOwnerId)) || (_isSavingToFile && mine(_savingOwnerId));
}
/* ★[H4] «마지막으로 끝난» 저장의 결과 — targetId → { at, result }.
   큐잉된 호출(undefined 반환)은 자기 결과를 못 본다. 종료 경로가 「큐가 빠졌으니 저장됐겠지」로
   때우면 «가짜 성공»이 된다 — 실측으로 그 일이 났다(2026-09-06 deny-write 실기: 저장이
   EACCES 로 실패했는데 종료 로그가 「저장 확인됨(saved)」). ⇒ 추측하지 말고 «결과를 읽는다».
   ⛔saveProjectToFile 의 반환 계약(큐잉=undefined)은 그대로 둔다 — 바꾸면 다른 호출측이
     드레인이 끝날 때까지 매달린다(행 위험). 여기 «기록»만 남기고, 볼 사람이 보게 한다. */
const _lastSaveResult = new Map();
/* ★FAILED-SAVE-TAB-SWITCH-THEN-QUIT-ORPHAN-LS-01 — 마지막 저장이 실패한 id. 다음 부팅 고아 정리가 이 id 의 LS 본을 안 지운다(그 본이 유일한 사본일 수 있다 ·
   기획 id 는 목록에 없어 지웠다 · DOM 재기 LS 319→0). 빠지는 길 셋: 저장 성공 · 프로젝트 지움 · 그 LS 본이 없어짐(부팅 때 걷는다).
   목록이 깨졌거나 비었으면 없는 것으로 친다 — 보호 없음 = 옛 동작. */
const FAILED_SAVE_IDS_KEY = 'web-editor-failed-save-ids';
function _failedSaveIds() {
  try { const v = JSON.parse(localStorage.getItem(FAILED_SAVE_IDS_KEY)); return Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : []; } catch (_) { return []; }
}
function _setFailedSaveIds(ids) {
  try { if (ids.length) localStorage.setItem(FAILED_SAVE_IDS_KEY, JSON.stringify(ids)); else localStorage.removeItem(FAILED_SAVE_IDS_KEY); } catch (_) {}
}
function _noteFailedSave(id, failed) {
  if (!id) return;
  const cur = _failedSaveIds();
  if (failed === cur.includes(id)) return;
  _setFailedSaveIds(failed ? [...cur, id] : cur.filter(x => x !== id));
}
window.forgetFailedSave = (id) => _noteFailedSave(id, false);   // 프로젝트를 지웠다 — 보호할 본이 아니다
const _listedAtBoot = new Set();   // 부팅 때 목록에 있던 id — 고아 정리 대상이 아니라 LS 본이 지켜진다 · 종료 때 사본을 또 만들어 5칸을 쓰지 않는다(리뷰 2-3)
const RECORDED_THIS_SESSION_KEY = 'web-editor-failed-recorded-session';   // sessionStorage — 이 앱 실행 안에서 남긴 사본 id. ⌘R·갤러리 왕복 부팅이 그 사본으로 보호를 풀어 옆 탭이 말없이 빠지지 않게(리뷰 2-2)
const _flushedFailed = new Map();   // id → 이 문서에서 이미 내린 옆 탭 실패 본(그 캐시) — 종료 답 뒤 beforeunload 가 또 내리면 비상 사본이 둘 · 본이 바뀌면 다시 내린다(리뷰)

/* ★[W-3-b] 「이 저장은 «실패»로 끝났나」 — 이 파일의 «단 하나의» 판정.
   ⛔`ok === false` 만 보면 «보호성 스킵»(빈 캔버스)까지 실패로 센다 ⇒ 새 프로젝트가 영원히
     dirty 로 남아 탭 전환마다 헛저장하고 공지까지 막힌다. 스킵은 실패가 아니다.
   ★이 규칙은 «내가 새로 정한 게» 아니다 — 자동저장 인디케이터가 이미
     `r.ok === false && !r.skipped` 로 쓰고 있었다. 그걸 여기 한 곳으로 모아 «같은 값»을 쓰게 한다. */
/* main 이 거절한 까닭을 사람 말로 — 까닭이 여럿이다(저장 버튼·flushSave 도 같은 글). */
function _saveRefusedText(r) {
  if (r?.reason === 'page_count_reduced') return '⚠️ 저장 거부: 페이지 수 감소 감지 — 데이터 보호됨';
  if (r?.reason === 'unreadable_not_preserved') return '⚠️ 저장 거부: 깨진 원본을 옆에 둘 수 없어 덮지 않았습니다 — 디스크 공간·폴더 권한을 확인해 주세요';
  return '⚠️ 저장 거부: ' + (r?.reason || '알 수 없는 오류');
}
window.saveRefusedText = _saveRefusedText;
function _isSaveFailure(r) { return !!(r && r.ok === false && r.skipped !== true); }
/* 폴더 없는 동안 남은 본으로 연 탭의 저장이면 표시를 붙인다 — 그사이 폴더가 돌아왔으면 main 이 덮지 않고 거절한다(folder_returned · MISSING-FOLDER-RETURNS-WHILE-VIEWING-OVERWRITES-01). */
function _markGoneBase(p, id, captured) { if (captured ?? openTabs.find(t => t.id === id)?._goneCopy) p._goneBase = true; return p; }   // captured = 저장이 들어올 때 잡은 값 — 닫는 탭은 보낼 때 이미 목록에 없다(V4)

/** 그 프로젝트의 «마지막으로 끝난» 저장이 실패였나. dirty 와 «따로» 묻는다. */
/* 닫을 때 저장할 게 있나. 되돌리기 봉인 중이면 없다: 저장 실패 기록이 남은 채 새로고침하면 동기 저장이 복원본을 덮는다. */
function _isReloadSealed(projectId) { return !!_reloadSealTok && (!_reloadSealId || projectId === _reloadSealId); }
function _unloadSaveNeeded(projectId) {
  if (_isReloadSealed(projectId)) return false;
  return _hasOwnUnsaved() || _lastSaveFailed(projectId);
}
function _lastSaveFailed(projectId) {
  const e = projectId ? _lastSaveResult.get(projectId) : null;
  return _isSaveFailure(e && e.result) || !!(e && !e.result);   // 기록은 있는데 결과가 없다 = 저장이 던졌다(썸네일 앞 대기 등) — _settleBigLs 도 실패로 친다
}

/* 문서가 끝난다 — 줄에 선 저장과 준비(loadProject) 중인 저장은 더 안 돈다. 닫은 탭의 저장이면 캐시도 LS 도 없어 그 편집을 잃었다(앱: 줄의 본이 종료·창 닫기 뒤 파일에 없음).
   이미 보낸 저장은 메인이 받자마자 동기로 쓰니 이 뒤에 못 온다. 준비 중인 저장은 앱이 몇 초 더 사는 동안(실패 대화상자) 깨어나 옛 본으로 덮을 수 있어 표시로 막는다.
   쓴 것과 못 쓴 것을 돌려준다 — 종료 답이 그대로 말한다. */
function _flushUnfinishedSavesSync() {
  const failed = []; const wrote = new Set();
  if (!IS_ELECTRON || !window.electronAPI?.saveProjectSync) return { failed, wrote };
  const left = new Map(_pendingSaves);
  _pendingSaves.clear();
  if (_isSavingToFile && _savingOwnerId && !left.has(_savingOwnerId) && !_savingSuperseded) left.set(_savingOwnerId, _savingEntry);   // 앞 flush 가 같거나 새 본을 이미 썼다 — 두 번째 flush(종료 답 뒤 beforeunload)가 옛 본으로 덮지 않게
  /* ★FAILED-SAVE-TAB-SWITCH-THEN-QUIT-ORPHAN-LS-01 — 옆 탭의 실패 본을 비상 사본으로 남긴다: 줄엔 없고 LS·탭 캐시에만 있어 종료가 안 봤다(DOM 재기 LS 319→0).
     ⛔파일에는 안 쓴다(지디 결정 ②) — 그 캐시는 실패 뒤 다른 창·MCP·버전 복원으로 새로워진 파일보다 낡을 수 있고, 동기 자리라 파일 판을 못 묻는다.
     권한이 돌아왔어도 파일로는 안 가고 다음 실행 복구 제안으로 간다. 보내기만 한다(invoke) — main 은 받는 즉시 쓰고, 종료 답보다 먼저 닿는다(같은 IPC 줄).
     활성 탭은 부르는 쪽(종료 답·beforeunload)이 쓴다. 같은 본은 한 문서에서 한 번 · 닫을 때 이미 남긴 실패(kept)는 다시 안 남긴다. */
  for (const t of openTabs) {
    if (t.id === activeProjectId || left.has(t.id) || !t._cache || _flushedFailed.get(t.id) === t._cache || _isReloadSealed(t.id) || !_lastSaveFailed(t.id)) continue;
    const last = _lastSaveResult.get(t.id);
    if (last?.kept || (_listedAtBoot.has(t.id) && _failedSaveIds().includes(t.id)) || !window.electronAPI?.recordRefusedSave) continue;   // 목록 id 라도 표지를 못 적었으면(LS 가득) 사본은 남긴다(리뷰 3-5)
    let data = null;
    try { data = JSON.parse(t._cache); } catch (_) {}
    if (!data || !Array.isArray(data.pages)) continue;
    applyAdoptedAssets(data, t.id);
    _flushedFailed.set(t.id, t._cache);
    try { const ss = JSON.parse(sessionStorage.getItem(RECORDED_THIS_SESSION_KEY) || '[]'); if (Array.isArray(ss) && !ss.includes(t.id)) sessionStorage.setItem(RECORDED_THIS_SESSION_KEY, JSON.stringify([...ss, t.id])); } catch (_) {}
    try { window.electronAPI.recordRefusedSave({ ...data, id: t.id, name: t.name || 'Untitled' }, last?.result?.reason || 'save-failed')?.catch?.(() => {}); } catch (_) {}
  }
  const work = [...left];
  for (const [id, entry] of work) {
    const { snapshot, opts } = entry;
    if (_isReloadSealed(id)) continue;
    let reason = null;
    try {
      const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
      applyAdoptedAssets(data, id);   // 탭 전환 본은 라이브 DOM 의 옛 주소다 — 평소엔 저장 줄에서 옮기지만 여기선 그 길을 안 탄다(앱 ×6: 파일이 되돌아가 A 삭제 후 0/2)
      if (!opts?.allowEmpty && _emptySaveBlocked(data, id)) {   // 평소 저장과 같은 보호(_doSaveProjectToFile) — 메인에는 이 검사가 없어 파일이 빈다
        if (id === _savingOwnerId && _isSavingToFile && _savingEntry && entry !== _savingEntry && !_savingSuperseded) work.push([id, _savingEntry]);   // 줄의 빈 본이 막히면 준비 중 본(실내용)이라도 — 둘 다 빠지면 파일이 그 이전 판에 머문다(FLUSH-EMPTY-QUEUE-SKIPS-INFLIGHT-01)
        continue;
      }
      const r = window.electronAPI.saveProjectSync(_markGoneBase({ ...data, id, name: openTabs.find(t => t.id === id)?.name || 'Untitled', updatedAt: new Date().toISOString() }, id, opts?._goneBase));
      if (r?.reason === 'folder_returned' && r.kept) continue;   // 돌아온 폴더를 안 덮고 main 이 그 본을 남겼다 — 실패로 세면 종료가 같은 본을 비상 사본으로 또 쓴다
      if (r && r.ok === false && r.reason !== 'project_deleted') reason = r.reason || 'save-failed';
      if (!reason && r?.reason !== 'project_deleted') { wrote.add(id); if (id === _savingOwnerId) _savingSuperseded = true; }   // 지워진 프로젝트는 안 썼다 — 안 들어간 본을 성공으로 답하면 비상 사본도 없다(휴지통 복원 때 마지막 본을 잃는다)
    } catch (e) { reason = (e && e.message) || 'exception'; }
    if (reason) {
      let _str = typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot);
      try { const _d = JSON.parse(_str); if (applyAdoptedAssets(_d, id)) _str = JSON.stringify(_d); } catch (_) {}   // 줄의 본은 옮기기 전에 찍혔을 수 있다 — 비상 사본·LS 본이 옛 주소로 남으면 그 프로젝트를 지운 뒤 그림이 빠진다(앱: 거절 때 사본에 옛 주소)
      failed.push({ id, reason, snapshot: _str });
      _settleBigLs(id, _str, true, _lsTsOf(id));   // 닫은 탭이면 LS 에도 없고 종료 답은 한 건만 싣는다 — 거절된 본을 LS 에 남긴다
    }
  }
  for (const id of wrote) _noteFailedSave(id, false);
  for (const f of failed) _noteFailedSave(f.id, true);
  if (failed.length) window.electronAPI?.flushLocalStorage?.();
  return { failed, wrote };
}

async function saveProjectToFile(snapshot, opts = {}) {
  const _targetId = opts.projectId || activeProjectId;
  /* ★361 — 안 읽힌 탭으로 나가는 저장은 쓰지 않는다: 그 스냅샷은 앞 프로젝트 내용이다(앱 실측 · ~/gd-lane/imac-gd-L1/361: 첫 로드 중 홈·종료 · 로드 실패 뒤 편집).
     저장 대상 id 와 캔버스가 어긋나면 안 쓰는 쪽이 잃지 않는다. ⛔큐에서 나오는 저장은 통과 — 그 탭이 읽히기 전에 찍은 진짜 스냅샷이다(_fromQueue). */
  if (!opts._fromQueue && window.isTabFirstLoading?.(_targetId)) return { ok: false, skipped: true, reason: 'tab-not-loaded' };
  /* 되돌린 뒤 새로고침 전 탭 전환·홈 이동이 변환본으로 복원본을 덮는다. 다른 프로젝트 저장은 지나간다. */
  if (_isReloadSealed(_targetId)) return { ok: false, skipped: true, reason: 'reload-seal' };
  /* 남은 본 표시는 «지금» 잡는다 — 줄에 서거나 await 하는 사이 탭이 닫히거나(V4) 다시 열려 표시가 걷히면, 남은 본 위의 이 스냅샷이 표시 없이 나가 돌아온 파일을 덮었다. */
  if (_targetId && opts._goneBase === undefined) opts = { ...opts, _goneBase: !!openTabs.find(t => t.id === _targetId)?._goneCopy };
  // 저장 중이면 프로젝트별로 최신 데이터를 큐에 대기 — 같은 프로젝트는 최신값으로 coalesce,
  // 다른 프로젝트는 별도 슬롯을 유지해 어느 프로젝트도 드롭하지 않는다.
  if (_isSavingToFile) {
    let _blankOverQueued = false;   // 막힐 빈 본이 줄의 실내용 본을 밀어내면 빠질 때 둘 다 안 들어간다(FLUSH-EMPTY-QUEUE-SKIPS-INFLIGHT-01) — 실내용 본을 둔다
    if (_targetId && _pendingSaves.has(_targetId) && !opts.allowEmpty) { try { _blankOverQueued = _emptySaveBlocked(typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot, _targetId); } catch (_) {} }
    if (_targetId && !_blankOverQueued) _pendingSaves.set(_targetId, { snapshot, opts: { ...opts, projectId: _targetId } });   // 대상을 지금 박는다 — 빠질 때 활성이 바뀌어 있으면(거절 저장이 탭을 닫음) 이 내용이 옆 프로젝트 파일을 덮었다(앱 3/3)
    return; // 큐잉됨 — 결과는 드레인 시점에 확정(undefined=미확정)
  }
  _isSavingToFile = true;
  _savingOwnerId = _targetId || null;
  _savingEntry = { snapshot, opts };
  const _lsTsAtStart = _lsTsOf(_targetId);
  let _result;
  try {
    _result = await _doSaveProjectToFile(snapshot, opts);
    /* ★[W-3-b] «결과를 보고» 지운다 — 옛 코드는 무조건 지웠다.
       _doSaveProjectToFile 은 EPERM 을 throw 가 아니라 { ok:false, reason:'exception' } «반환»한다
       ⇒ 저장이 실패했는데 「미저장 없음」이 됐고, 그 뒤 beforeunload 가 조기 return 해서
         projects:save-sync 가 «아예 안 불렸다» ⇒ W-3 가드가 입력을 못 받고 그냥 종료했다.
         (윈도우 실기 회귀: 「⚠️ 저장 실패」를 «보고 나서» 닫으면 다이얼로그 0·마커 0·로그 0건.
          편집 «직후»(디바운스 전) 닫기만 살아 있었다 — 사용자가 하는 순서는 앞쪽이다.)
       ★★가드는 옳은 자리에 있었다. 없던 건 «방아쇠»다.
       ★이 한 줄이 window.hasUnsavedChanges() 의 거짓말도 «같이» 고친다 —
         탭 전환의 「변경 없으면 저장 생략」(js/tab-system.js:253)과 공지 억제(js/notice.js:65)가
         같은 값을 본다. 셋이 한 뿌리였다.
       ⚠️폭주 없음: 자동저장 재무장은 «편집»(scheduleAutoSave)만 한다 — dirty 는 재무장의
         입력이 아니다. 실패해도 스스로 다시 쏘지 않는다(검사 W3B-6 이 이걸 잠근다). */
    // 저장을 막은 탭의 편집은 앞 프로젝트 저장이 끝나도 안 남았다 — 미저장 표시를 지키고 «저장됨»을 안 띄운다
    if (!_isSaveFailure(_result) && !window.isTabFirstLoading?.(activeProjectId)) _dirtySinceSave = false;
  } finally {
    if (_targetId) _lastSaveResult.set(_targetId, { at: Date.now(), result: _result });
    /* int-3 합침(TAB-SWITCH × MISSING-FOLDER): 돌아온 폴더를 안 덮고 main 이 그 본을 남긴 것(folder_returned·kept)은 «실패 저장»으로 적지 않는다 —
       적으면 종료가 같은 본을 비상 사본으로 또 쓴다(MISSING 의 flush 갈래 주석과 같은 까닭). */
    const _keptByMain = _result?.reason === 'folder_returned' && !!_result.kept;
    if (_targetId && _result?.reason === 'project_deleted') _noteFailedSave(_targetId, false);
    else if (_targetId && !_result?.skipped) _noteFailedSave(_targetId, !_keptByMain && (!_result || _isSaveFailure(_result)));
    /* 돌아온 폴더를 안 덮고 main 이 그 본을 남겼다 — LS 본(남은 본 위 편집)을 지운다. 두면 다시 열기·다음 부팅의 pickLsOverFile 이 그 본을 골라 표시 없이 돌아온 파일을 덮는다(리뷰 2 ①). */
    if (_keptByMain && _targetId) { try { localStorage.removeItem(`${SAVE_KEY_PREFIX}__${_targetId}`); localStorage.removeItem(`${SAVE_KEY_PREFIX}__${_targetId}_ts`); } catch (_) {} }
    else if (!_result?.skipped) {
      const _failed = !_result || _isSaveFailure(_result);
      _settleBigLs(_targetId, snapshot, _failed, _lsTsAtStart);
      if (!_failed) _markLsFiled(_targetId, _lsTsAtStart);
      /* 저장 도는 중 든 본은 파일에 없는데, 파일 시각이 준비(loadProject) 뒤에 찍혀 그 본보다 새롭다 — 그대로면 죽었을 때 열기가 파일을 고르고 축출도 든 본으로 읽는다 */
      if (!_failed && _targetId && _lsTsOf(_targetId) && _lsTsOf(_targetId) !== _lsTsAtStart) { try { localStorage.setItem(`${SAVE_KEY_PREFIX}__${_targetId}_ts`, String(Date.now() + 1)); } catch (_) {} }
    }
    /* ★331 — 파일이 막히면 localStorage 가 유일한 사본인데 디스크 반영이 늦다(앱: 잠근 채 20초 연속 편집 뒤 10초 안에 kill -9 ⇒ 9/9 전부 잃음 · 40초 뒤 3/3 복구). 실패 때만 바로 내린다. */
    if (_isSaveFailure(_result)) window.electronAPI?.flushLocalStorage?.();
    _isSavingToFile = false;
    _savingEntry = null;
    _savingSuperseded = false;
    // 대기 중인 프로젝트별 저장을 FIFO로 순차 드레인 (드롭 없음)
    if (_pendingSaves.size) {
      const [nextId, nextSave] = _pendingSaves.entries().next().value;
      _pendingSaves.delete(nextId);
      await saveProjectToFile(nextSave.snapshot, { ...nextSave.opts, _fromQueue: true });
    }
  }
  return _result; // GAP-005: 저장 결과 전파(인디케이터 정직성)
}

function _isAllCanvasEmpty(data) {
  // checklistItems가 있으면 canvas가 비어있어도 저장 허용
  if (Array.isArray(data?.checklistItems) && data.checklistItems.length > 0) return false;
  return data?.pages?.length > 0 && data.pages.every(p => !p.canvas || p.canvas.trim() === '');
}

/* S11 은 «탭 전환 중 빈 DOM» 덮어쓰기를 막는다. 사용자가 ⌘Z 로 빈 캔버스에 돌아온 건 그 일이 아니다 — 건너뛰면 다시 열 때 섹션이 살아난다.
   표식은 복원 동기 구간에서만 선다(history.js). 로드·비지 않은 저장에 풀린다. */
let _emptyByRestoreOwner = null;
window.__noteRestoredCanvas = () => { _emptyByRestoreOwner = document.querySelector('#canvas .section-block') ? null : activeProjectId; };
function _emptySaveBlocked(data, projectId) {
  // 표식은 화면이 다시 찼을 때만 풀린다(탭이 바뀌면 applyProjectData 가 먼저 풀어 표식이 있는 동안 화면은 곧 그 주인 것이다) — 옆 프로젝트 본이나 줄에 남은 앞 본을 검사해도 ⌘Z 로 비운 사실은 그대로다(앱: 풀리면 비운 본이 막혀 다시 열 때 섹션이 살아난다)
  if (!_isAllCanvasEmpty(data)) { if (document.querySelector('#canvas .section-block')) _emptyByRestoreOwner = null; return false; }
  return _emptyByRestoreOwner === null || _emptyByRestoreOwner !== projectId;
}

async function _doSaveProjectToFile(snapshot, opts = {}) {
  // opts.projectId: 탭 전환 시 이전 탭 ID로 저장하기 위한 명시적 ID (S10 race condition 방지)
  const targetId = opts.projectId || activeProjectId;
  /* ★340 C — «명시 반환». undefined 는 _isSaveFailure 가 못 잡아 저장을 안 했는데 미저장 표시가 꺼졌다. */
  if (!targetId) return { ok: false, reason: 'no_target' };
  // S4: 손상된 JSON 안전 처리
  let data;
  try {
    data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  } catch {
    console.warn('[save-load] saveProjectToFile: 손상된 snapshot, 저장 취소');
    // ★[1차검수 M5] «명시 반환». 초판은 bare return(=undefined)이라 호출측이 「큐잉」과 구분할 수 없었고,
    //   그래서 버전 되돌리기가 저장 실패를 못 보고 「교체됨」이라고 말했다.
    return { ok: false, reason: 'corrupt_snapshot' };
  }
  // S11: 빈 canvas 저장 방지 — 모든 페이지의 canvas가 비어있으면 기존 파일 데이터 보호
  if (!opts.allowEmpty && _emptySaveBlocked(data, targetId)) {   // allowEmpty: 메뉴 저장은 전부터 이 보호 없이 썼다(그대로 둔다)
    console.warn('[save-load] saveProjectToFile: 모든 페이지 canvas가 비어있어 저장 건너뜀 (기존 데이터 보호)');
    // ★skipped:true — «보호성 스킵»이지 실패가 아니다. 자동저장 인디케이터는 빨갛게 만들지 않되,
    //   「저장했다」고 믿으면 안 되는 호출측(버전 되돌리기)은 이걸 보고 정직하게 알린다.
    return { ok: false, skipped: true, reason: 'empty_canvas_skipped' };
  }
  const thumbnail = opts.skipThumbnail ? null : await captureThumbnail();

  if (IS_ELECTRON) {
    try {
      const existing = await window.electronAPI.loadProject(targetId);
      // pages + pageSettings만 저장 — branches/commits/thumbnail은 _meta.json에서 관리
      // existing 먼저 spread 후 data로 덮어쓰기 — 레거시 필드는 data에 없으면 existing 유지
      /* ★[T-232 ⓑ] 병합은 «한 벌»이다 — js/io/proj-merge.js. ⛔여기에 스프레드를 다시 쓰지 마라:
         이 코드가 commit-system.js 와 두 벌이었고 이미 갈라져 있었다(한쪽만 `_recovered` 를 뺐다). */
      /* 파일이 없으면 이름을 받아 올 데가 탭뿐이다 — 스냅샷엔 이름이 없어 폴더를 다시 만들 때 Untitled 가 됐다(앱 재현). */
      if (!existing && !data.name) data = { ...data, name: openTabs.find(t => t.id === targetId)?.name };
      const proj = buildProjForSave(existing, data, targetId);
      // 이미지 외부화 (정책 게이팅): 기본 autosave는 new-only — 이번 세션 신규 base64만 분리하고
      // 로드 시점에 존재하던 기존 base64는 그대로 둔다(비파괴). 기존 대량변환은 optimizeProjectImages
      // (opts.externalizeAll) 또는 레거시 플래그(GOEDITOR_AUTO_EXTERNALIZE_LEGACY)로만 동작.
      // 실패 시 원본 base64 유지(데이터 손실 없음).
      const _externAll = opts.externalizeAll === true || window.GOEDITOR_AUTO_EXTERNALIZE_LEGACY === true;
      try { await externalizeProjectData(proj, targetId, { all: _externAll }); }
      catch (e) { console.warn('[save-load] 이미지 외부화 건너뜀:', e && e.message); }
      try { await adoptForeignAssets(proj, targetId); }
      catch (e) { console.warn('[save-load] 다른 프로젝트 자산 가져오기 건너뜀:', e && e.message); }
      // #16 이식성: 스크래치패드 전체 페이지를 goya-asset로 외부화 + proj.pages[].scratchpad 매니페스트 기록
      //   (다른 맥에서 하이드레이션 원본). 비파괴·hash 증분·실패 시 원본 유지. proj 객체에 scratchpad 필드 주입.
      try { await window.externalizeScratchpad?.(proj, targetId); }
      catch (e) { console.warn('[save-load] 스크래치 외부화 건너뜀:', e && e.message); }
      if (_savingSuperseded && targetId === _savingOwnerId) return { ok: true, skipped: true, reason: 'flushed' };
      const saveResult = await window.electronAPI.saveProject(_markGoneBase(proj, targetId, opts._goneBase));
      if (saveResult?.reason === 'folder_returned') {   // 남은 본은 main 이 버전 기록에 남겼다 — 안내하고 파일로 다시 연다. 못 남겼으면 화면(과 LS 본)을 그대로 둔다
        { const _t = openTabs.find(t => t.id === targetId); if (_t && !_t._goneCopy) _t._goneCopy = true; }   // -02b 표시 없던 탭(보는 동안 폴더가 빠져 앱이 다시 만든 탭)도 거절되면 남은 본이다 — 다시 열기·줄 선 저장 표시가 같은 길을 탄다
        if (saveResult.kept) Promise.resolve(window.reopenReturnedTab?.(targetId, saveResult.kept)).then((shown) => { if (!shown) window.showStatusToast?.(window.folderReturnedNotice?.(proj.name, false, saveResult.kept)); })   // 닫은 탭(나가며 저장)이면 다시 열 탭이 없다 — 남긴 자리만 알린다
          .catch(e => console.warn('[save-load] 돌아온 폴더 다시 열기 실패:', e && e.message));
        else window.showToast?.(_saveRefusedText(saveResult));
        _setAutosaveIndicator('error');
        return { ok: false, reason: saveResult.reason, kept: saveResult.kept };
      }
      /* ⚰️-01: 성공하면 여기서 _goneCopy 를 걷었다(«폴더를 이 본으로 다시 만들었다»). ★-02(미카사 int-3 실앱 2/2): 그 뒤 원래 폴더가 Finder 대치로 돌아오면
         표시 없는 저장이 그 파일을 덮었다. ⇒ 표시는 파일을 «읽은» 뒤에만 걷는다(switchTab) · 그사이 저장은 표시를 달고 가고, main 이 제가 쓴 파일인지 도장으로 가른다(_goneStamp). */
      // main.js에서 페이지 수 감소 감지 시 { ok: false, reason: 'page_count_reduced' } 반환
      if (saveResult?.reason === 'project_deleted') {   // ★연 채 삭제 — 실패가 아니다. 탭을 닫고 알린다(closeDeletedProjectTab)
        /* 안 기다린다 — 다음 탭에 줄 선 저장이 있으면 그 탭은 저장이 끝나길 기다리고, 줄은 이 저장의 finally 가 빼서 저장이 영영 멈췄다(앱 재현). */
        Promise.resolve(window.closeDeletedProjectTab?.(targetId)).catch(e => console.warn('[save-load] 삭제된 탭 닫기 실패:', e && e.message));
        return { ok: false, skipped: true, reason: saveResult.reason };
      }
      if (saveResult && saveResult.ok === false) {
        console.warn('[save-load] 저장 거부됨:', saveResult.reason, saveResult);
        if (!opts.quietReject) window.showToast?.(_saveRefusedText(saveResult));
        _setAutosaveIndicator('error');   // 거절된 저장이 «저장 중...» 으로 남지 않게
        return { ok: false, reason: saveResult.reason || 'rejected' };
      }
      // thumbnail은 _meta.json에 저장
      if (thumbnail) {
        /* ★«자기 필드만» 보낸다(2026-10-02 meta 경합 f) — 미리 읽지 않는다. 합치기는 main 핸들러({ ...cur, ...metaData }).
           옛 판은 읽은 meta «전체»를 같이 보내 그사이 바뀐 컬러 변수·최근 색 등을 «옛 값»으로 되돌렸다.
           ⛔위 proj.json 저장(saveProject) 줄은 이 변경과 무관하다 — 이 아래 썸네일 meta 줄만. */
        await window.electronAPI.saveProjectMeta(targetId, { thumbnail, updatedAt: new Date().toISOString() });
      }
      return { ok: true }; // GAP-005: 디스크 영속 성공 시에만 ok:true
    } catch (e) {
      console.error('[save-load] Electron 저장 실패:', e);
      window.showToast?.('❌ 저장 실패: ' + (e.message || '알 수 없는 오류'));
      return { ok: false, reason: 'exception', error: e && e.message };
    }
  } else {
    try {
      const listRaw = localStorage.getItem(PROJECTS_KEY) || '[]';
      const list = JSON.parse(listRaw);
      const proj = list.find(p => p.id === targetId);
      if (proj) {
        proj.snapshot = data;
        proj.updatedAt = new Date().toISOString();
        if (thumbnail) proj.thumbnail = thumbnail;
      }
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
      return { ok: true };
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.warn('[save-load] localStorage 용량 초과, 저장 실패');
        window.showToast?.('⚠️ 저장 공간 부족: 이미지를 줄이거나 프로젝트를 분리해 주세요.');
        // 상태와 저장소 불일치 방지 — 저장 실패한 snapshot을 메모리에서도 롤백
        // (이미 proj.snapshot이 변경된 상태이므로 list를 재파싱해 원복)
        try {
          const prevList = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
          const prevProj = prevList.find(p => p.id === targetId);
          if (prevProj) {
            // state.pages는 이미 최신 — UI는 정상, 다음 저장 시 재시도로 해결
          }
        } catch (_) {}
      } else {
        console.error('[save-load] localStorage 저장 오류:', e);
        window.showToast?.('❌ 저장 오류: ' + e.message);
      }
      return { ok: false, reason: e.name === 'QuotaExceededError' ? 'quota' : 'exception', error: e && e.message };
    }
  }
}

function loadProjectsList() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch { return []; }
}

function getProjectName() {
  if (!activeProjectId) return null;
  if (!IS_ELECTRON) {
    const proj = loadProjectsList().find(p => p.id === activeProjectId);
    return proj?.name || null;
  }
  return openTabs.find(t => t.id === activeProjectId)?.name || null;
}

async function setProjectName(name) {
  if (!activeProjectId) return;
  // 탭 이름 업데이트
  const tab = openTabs.find(t => t.id === activeProjectId);
  const oldName = tab ? tab.name : null;
  if (tab) { tab.name = name; window.renderTabBar(); }
  if (IS_ELECTRON) {
    /* ★340 B — 본 프로세스가 한 틱에 읽고 쓴다(main.js projects:rename). ⛔여기서 왕복하지 마라. */
    let r = null;
    try { r = await window.electronAPI.renameProject({ projectId: activeProjectId, name }); }
    catch (e) { r = { ok: false, error: e && e.message }; }
    if (!r || r.ok !== true) {
      if (tab && tab.name === name) { tab.name = oldName; window.renderTabBar(); }
      window.showToast?.(`⚠️ 이름을 바꾸지 못했습니다: ${(r && r.error) || '알 수 없는 오류'}`);
    }
  } else {
    const list = loadProjectsList();
    const proj = list.find(p => p.id === activeProjectId);
    if (proj) { proj.name = name; localStorage.setItem(PROJECTS_KEY, JSON.stringify(list)); }
  }
}

/* ══════════════════════════════════════════════════════════════════
   유휴 썸네일 — 「홈 버튼이 8초 걸린다」(현빈 2026-09-28 보고)의 처방
   ──────────────────────────────────────────────────────────────────
   무엇이 느렸나 (격리 인스턴스 실측, 같은 스냅샷·같은 경로·`skipThumbnail` 하나만 다름):
       저장 «썸네일 없이» :   141 / 16 / 10 ms
       저장 «썸네일 포함» : 7443 / 3782 / 2566 ms
     ⇒ 비용의 99% 가 썸네일이다. 썸네일은 «첫 섹션 하나»만 그리므로 프로젝트 크기와
       무관하다 — 1MB 짜리도 8초였다는 보고와 맞는다.
   ⛔«작게 그리기»는 효과가 없다(실측으로 기각):
       scale 1.0(860x1425) 4524/3757ms · 0.5(430x712) 6022/6559ms · 0.2325(199x331) 4726/3839ms
     픽셀 수가 병목이 아니라 html2canvas 가 DOM 을 훑어 스타일을 복제하는 단계가 비용이다.
   ★그래서 «언제» 찍는지를 옮겼다 — 나가는 길목이 아니라 «편집이 멈춘 뒤» 찍는다.
   ⛔썸네일을 그냥 끄면 안 된다: 자동저장(scheduleAutoSave)·탭전환(tab-system.js)은 이미
     skipThumbnail 이라, goHome 이 «유일하게» 찍는 자리였다. 끄면 목록 그림이 영영 안 는다.
     그래서 끄는 대신 이 스케줄러가 그 책임을 넘겨받는다.
   ════════════════════════════════════════════════════════════════ */
/* ★[0929 실측 정정] 초판은 「편집 멈추고 2초」였다 — 그게 «새 렉»을 만들었다.
     현빈 보고 「9374 계속 좀 느린데」. CPU 프로파일로 갈랐다(같은 앱·같은 프로젝트·10초 관측):
       편집 없음                    «일한» 432ms
       편집 ＋ html2canvas 있음      «일한» 11,968ms   ← 상위가 getPropertyValue/setProperty/adoptNode
       편집 ＋ html2canvas 없음      «일한» 211ms
     ⇒ 홈 버튼에서 «없앤» 비용이 아니라 «옮긴» 비용이었고, 옮긴 자리에서 훨씬 자주 돌았다.
       홈은 나갈 때 한 번이지만 편집은 잠깐 멈출 때마다다.
   ★그래서 «드물게» 만든다 — 세 가지로 막는다:
     ⑴ 유휴 문턱을 8초로(편집 흐름을 덜 끊는다)
     ⑵ 마지막 캡처로부터 최소 3분(가장 큰 몫이다)
     ⑶ 편집이 «있었을 때»만(_thumbDirty)
   ⛔최소 간격에 걸리면 «버리지» 않고 남은 시간 뒤에 다시 본다 — 버리면 편집을 계속하는 동안
     그림이 영영 안 갱신된다(이 기능이 존재하는 까닭이 사라진다). */
const THUMB_IDLE_MS = 8000;
const THUMB_MIN_GAP_MS = 180000;
let _thumbTimer = null;
let _thumbDirty = false;
let _lastThumbAt = 0;
/* ★165 ㉡(지디 21:21) — 캡처가 «도는 중». 실측(fa57bed6 · 수지 사본 · ✕ → ⌘Z): 첫 캡처가 끝나기 전(57.6s)에 둘째가 38.3s 에
     시작해 둘이 겹쳤다 — _lastThumbAt 은 «찍은 뒤»에 적으므로(아래) 도는 동안엔 3분 문이 아직 열려 있다.
   ⛔_lastThumbAt 을 «시작»에 적는 꼴은 안 고른다 — 실패 출구가 셋(null · 탭 바뀜 · IPC 던짐)이라 셋 다 되돌려야 하고,
     «찍은 뒤에 기록한다»(아래 주석)의 까닭을 거스른다. 칸 하나 + finally 가 출구 수와 무관하다. */
let _thumbRunning = false;

/** 편집이 멈추면 썸네일을 한 장 찍어 _meta.json 에 넣는다. 편집이 이어지면 계속 미뤄진다. */
function scheduleIdleThumbnail() {
  if (!IS_ELECTRON) return;
  _thumbDirty = true;
  clearTimeout(_thumbTimer);
  const fire = () => {
    _thumbTimer = null;
    if (!_thumbDirty) return;                       // ⑶ 편집이 없었으면 찍을 것이 없다
    /* ★165 ㉠ — «지금 바쁨»이면 찍지 않고 미룬다(⑵ 와 같은 «버리지 않고 미룬다» 꼴). 실측(fa57bed6): 끌기 «전»에 걸린 8초
       타이머가 끌기 «안»에서 터져 html2canvas 가 마우스 눌린 채 시작됐다 — deferAutoSave 는 autoSaveTimer 만 지우고, 제스처 중
       scheduleAutoSave 는 이 함수 «앞»에서 돌아가 타이머를 밀지도 않는다. 바쁨 = 이미 있는 칸 둘(제스처 유예 · 억제 창) + ㉡ 진행 중. */
    if (_autoSaveDeferred || state._suppressAutoSave || _thumbRunning) {
      _thumbTimer = setTimeout(fire, THUMB_IDLE_MS);
      return;
    }
    const since = Date.now() - _lastThumbAt;
    if (since < THUMB_MIN_GAP_MS) {                 // ⑵ 아직 이르다 — 버리지 않고 미룬다
      _thumbTimer = setTimeout(fire, THUMB_MIN_GAP_MS - since);
      return;
    }
    /* ★requestIdleCallback 으로 시작한다 — 이 캡처는 수 초 CPU 를 먹어서, 사용자가 다시
       입력을 시작한 순간에 걸치면 그대로 버벅임이 된다. 유휴를 못 잡으면 3초 뒤 강행.
       ★165 — 위 바쁨을 «여기서 한 번 더» 본다: fire 와 go 사이(최대 3초)에 제스처가 시작될 수 있다 · 이미 걸린 rIC 는
       clearTimeout 으로 못 지워서 둘이 겹쳐 올 수도 있다. */
    const go = () => {
      if (_autoSaveDeferred || state._suppressAutoSave || _thumbRunning) {
        clearTimeout(_thumbTimer);
        _thumbTimer = setTimeout(fire, THUMB_IDLE_MS);
        return;
      }
      _runIdleThumbnail().catch(() => {});
    };
    if (window.requestIdleCallback) window.requestIdleCallback(go, { timeout: 3000 });
    else go();
  };
  _thumbTimer = setTimeout(fire, THUMB_IDLE_MS);     // ⑴
}

async function _runIdleThumbnail() {
  const targetId = activeProjectId;
  if (!targetId) return;
  _thumbRunning = true;   // ★165 ㉡ — 출구가 몇 개든 finally 가 내린다
  try {
  const thumbnail = await captureThumbnail();
  /* ⛔캡처는 «몇 초» 걸린다 — 그 사이 탭이 바뀌었으면 남의 프로젝트 카드에 내 그림을 박게
     된다. 자동저장이 _saveTargetId 로 같은 사고를 막는 것과 «같은 자»다. */
  if (!thumbnail || activeProjectId !== targetId) return;
  /* ★«자기 필드만» 보낸다(2026-10-02 meta 경합 e) — 미리 읽지 않는다. 합치기는 main 핸들러({ ...cur, ...metaData }).
     옛 판은 읽은 meta «전체»를 같이 보냈다 — 캡처가 «수 초» 걸리는 사이 바뀐 컬러 변수·최근 색이 «옛 값»으로 되돌아갔다. */
  await window.electronAPI.saveProjectMeta(targetId, { thumbnail, updatedAt: new Date().toISOString() });
  /* ★찍은 «뒤»에 기록한다 — 앞에 두면 실패했는데도 3분을 쉬어 그림이 영영 안 는다. */
  _lastThumbAt = Date.now();
  _thumbDirty = false;
  } finally { _thumbRunning = false; }
}
window.scheduleIdleThumbnail = scheduleIdleThumbnail;

/* 프로젝트 목록으로 나가기 전 확인 — 생성 중이 아니면 안 묻는다(현빈 결정 6524). 입구: 홈 단추 · 마지막 탭 닫기. 삭제된 프로젝트 탭은 머물 곳이 없어 안 묻는다. */
let _leaveAccepted = false;   // 나가기로 답했다 — 곧 페이지가 떠난다. 탭 닫기가 묻고 goHome 이 또 묻지 않게
function confirmLeaveWhileGenerating() {
  if (_leaveAccepted || !window.aiGenerationInFlight?.()) return true;
  _leaveAccepted = window.confirm('AI 이미지를 만드는 중입니다. 지금 나가면 결과를 잃습니다. 나갈까요?');
  return _leaveAccepted;
}
window.confirmLeaveWhileGenerating = confirmLeaveWhileGenerating;

async function goHome() {
  if (!confirmLeaveWhileGenerating()) return;
  const curTab = openTabs.find(t => t.id === activeProjectId);
  if (curTab && !window.isTabFirstLoading?.(activeProjectId)) curTab._cache = serializeProject();
  // ★T-012: video-pending(트림 확정 전) 상태로 저장·홈이동하면 원본 영상이 저장에서 빠진다
  // (section-serialize.js — 원본을 영구저장하는 쪽보다 안전하다는 게 결정 사항). 막지는
  // 않되, 사라진다는 사실은 알려준다 — 토스트가 실제로 보이도록 이동을 살짝 늦춘다.
  // ★T-032: 판정·문구는 js/io/pending-video-warn.js 한 곳에서만 온다(사본 금지).
  const warnedPendingVideo = warnPendingVideoLossIf(canvasEl);
  /* ★썸네일을 «기다리지 않는다» — 그 한 줄이 홈 이동의 8초였다(위 스케줄러 주석에 실측).
     그림은 scheduleIdleThumbnail 이 편집 멈춘 뒤 미리 찍어 둔다. 편집 직후 2초 안에 홈을
     누르면 카드 그림이 한 판 낡을 수 있지만, 다음에 열었다 나올 때 갱신된다. */
  await _saveInLine(serializeProject(), activeProjectId, { skipThumbnail: true });
  /* 줄이 빌 때까지 기다린다. 탭을 옮기자마자 나오면 떠난 탭의 저장이 아직 돌고, 목록의 글꼴 대체가 그 파일을 읽고 고쳐 써서
     편집이나 대체를 잃었다(RENDERER-LOAD-SAVE-ROUNDTRIP-FIVE-LEFT-01). */
  const _lineEnd = Date.now() + 60000;
  while ((_isSavingToFile || _pendingSaves.size) && Date.now() < _lineEnd) await new Promise(r => setTimeout(r, 25));
  window.saveTabState();
  if (warnedPendingVideo) await new Promise(r => setTimeout(r, 900));
  window.location.href = 'pages/projects.html';
}

/* ── Page Management ── */
function getCurrentPage() {
  return state.pages.find(p => p.id === state.currentPageId) || state.pages[0];
}

/* ★T-031 3차수정(2026-09-15, a1-a3 지적 — 치명): 2차수정은 page.videoPendingSidecar를
 * «page 객체 자신»에 붙였는데, serializeProject()가 JSON.stringify({pages: state.pages})로
 * «그 객체를 그대로» 저장한다 — 원본 영상 dataURL이 매 저장마다 proj.json에 통째로 영구
 * 저장되는, T-012가 막으려던 바로 그 사고가 재발했다(자동저장·탭캐시·커밋/브랜치 스냅샷
 * 전부 포함). page.canvas는 serializeCleanRoot를 거친 "세척된 문자열"이라 안전했지만,
 * videoPendingSidecar는 세척 «밖»의 원본 그 자체라 같은 객체에 둘 수 없다.
 * ⇒ state.pages(저장 대상)에는 «전혀» 안 붙인다. pageId → sidecar 런타임 전용 Map(모듈
 * 스코프, JSON.stringify 대상 밖)에 따로 둔다 — js/history.js가 스냅샷 객체 자신에 붙이는
 * 것과 원리는 같되(그쪽은애초에 historyStack 자체가 메모리 전용이라 안전했다), 여긴
 * page 객체가 저장 대상이라 아예 분리해야 한다. */
const _pageVideoPendingSidecars = new Map(); // pageId -> sidecar. ⛔ state.pages 에 절대 붙이지 않는다.

function flushCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  page.canvas = getSerializedCanvas();
  // ★떠나는 이 페이지의 video-pending 원본을 «런타임 전용 Map»에 남긴다(같은 동기 구간에서
  // 읽어야 한다 — section-serialize.js 참고). 돌아왔을 때(switchPage/deletePage)
  // rebindAll({videoPendingSidecar: _pageVideoPendingSidecars.get(page.id)})로만 되살린다.
  _pageVideoPendingSidecars.set(page.id, window.getLastVideoPendingSidecar?.());
  page.pageSettings = { ...state.pageSettings };
}

async function switchPage(pageId) {
  if (pageId === state.currentPageId) return;
  /* ★[H6] 억제는 «구조»로 연다 — 이 창엔 «던지는» 자리가 여럿이다:
   *   await switchScratchPage(IndexedDB 거부) · rebindAll · buildLayerPanel · showPageProperties.
   *   예전엔 그중 하나만 터져도 억제가 true 로 «남아» 이후 모든 편집이 디스크에 안 남았다.
   *   오류도 표시도 없이 — 사용자는 그걸 앱 닫을 때 안다.
   *   ⛔해제 «시점»은 예전 `= false` 와 같은 자리(finally)다 — 앞당기지도 미루지도 않는다. */
  const _asTok = window.AutoSaveSuppress.begin('page-switch');
  try {
    await window.switchScratchPage?.(pageId);
    flushCurrentPage();
    // D1: 떠나는 페이지(아직 currentPageId가 이전 페이지)의 라이브 히스토리 스택을 보관
    window.stashHistoryFor?.(state.currentPageId);
    // 이미지 편집 모드 리스너 정리 (메모리 누수 방지)
    canvasEl.querySelectorAll('[data-pos-dragging], .pos-dragging').forEach(ab => {
      if (ab._posDragCleanup) { ab._posDragCleanup(); ab._posDragCleanup = null; }
      if (ab._exitPosDrag)    { document.removeEventListener('click', ab._exitPosDrag); ab._exitPosDrag = null; }
      if (ab._exitPosDragEsc) { document.removeEventListener('keydown', ab._exitPosDragEsc); ab._exitPosDragEsc = null; }
      ab._posDragging = false;
      ab.classList.remove('pos-dragging', 'img-editing');
    });
    state.currentPageId = pageId;
    const page = getCurrentPage();
    if (page.pageSettings) Object.assign(state.pageSettings, page.pageSettings);
    canvasEl.innerHTML = sanitizeCanvasHtml(page.canvas || '');
    stripLoadedRuntimeState(canvasEl);
    document.querySelectorAll('.sec-bg-ghost-wrap, .sec-bg-ghost').forEach(el => el.remove());
    canvasEl.querySelectorAll(NON_CONTENT_UI_SELECTOR).forEach(el => el.remove());
    // (마이그레이션은 rebindAll 내부에서 처리)
    // propPanel 클리어 — 이전 페이지의 속성 패널 내용이 잔존하지 않도록
    const propPanel = document.querySelector('#panel-right .panel-body');
    if (propPanel) propPanel.innerHTML = '';
    // ★T-031 3차: page 객체가 아니라 런타임 전용 _pageVideoPendingSidecars Map에서 읽는다
    //   (flushCurrentPage가 이 페이지를 떠날 때 거기 남겨둔 것 — page 객체 자신엔 절대
    //   안 붙인다, 위 정의부 주석 참고 — proj.json에 원본이 실리는 사고 재발 방지).
    rebindAll({ videoPendingSidecar: _pageVideoPendingSidecars.get(page.id) });
    refreshLazyObservation(); // 새 페이지의 section-block을 lazy 관찰 등록 (innerHTML 교체 후)
    applyPageSettings();
    window.fitKeylessFreeFrameGridsOnOpen?.(canvasEl);   // E129 F3 — 페이지 전환도 «열기»다
    window.deselectAll();
    window.showPageProperties();
    window.buildLayerPanel(); // also calls buildFilePageSection
  } finally { window.AutoSaveSuppress.end(_asTok); }
  // D1: 페이지별 히스토리 복원 — 같은 페이지 복귀 시 undo 기록 유지, 처음 방문 페이지는 초기 스냅샷.
  // adopt 헬퍼 미탑재 시(history.js 미패치) 기존 동작(빈 히스토리)로 graceful degrade.
  if (window.adoptHistoryFor) window.adoptHistoryFor(pageId);
  else window.clearHistory?.();
  scheduleAutoSave();
}

function addPage() {
  flushCurrentPage();
  const id = 'page_' + Date.now();
  const n = state.pages.length + 1;
  state.pages.push({ id, name: `Page ${n}`, label: '', pageSettings: { ...state.pageSettings }, canvas: '' });
  switchPage(id);
}

let _pageDeleteBusy = false;   // ★await 중 ✕ 를 또 눌러도 한 번만 지운다
async function deletePage(pageId) {
  if (_pageDeleteBusy) return;
  if (state.pages.length <= 1) { window.showToast('⚠️ 페이지가 1개 이상이어야 합니다.'); return; }
  let idx = state.pages.findIndex(p => p.id === pageId);
  if (idx === -1) return;
  const page = state.pages[idx];
  // 파괴적 액션 가드 (Adobe/Figma 표준): 내용 있는 페이지 삭제는 되돌릴 수 없으므로 확인받는다.
  // 활성 페이지는 라이브 DOM이 진실 소스 — stale page.canvas(flush 전이면 빈 문자열)를 읽으면
  // 미저장 콘텐츠가 confirm 없이 무음 소실된다(deletePage 무보호 데이터유실 버그).
  const isActivePage = pageId === state.currentPageId;
  const canvasHtmlForCheck = isActivePage ? getSerializedCanvas() : (page && page.canvas) || '';
  const hasContent = canvasHtmlForCheck.includes('section-block');
  if (hasContent && !window.confirm(`'${(page && page.name) || '이 페이지'}'를 삭제하시겠습니까?\n페이지의 모든 내용이 영구 삭제되며 되돌릴 수 없습니다.`)) return;
  /* ★PAGE-DELETE-SCRATCH-STAYS-ON-DELETED-PAGE-01 — 스크래치 층도 남을 페이지로 옮긴다(switchPage 와 같은 자리 · 같은 억제).
     안 옮기면 층이 지운 페이지 키에 남아, 그 뒤 넣은 이미지가 지운 키로 저장돼 다시 열면 없다.
     ★상태를 바꾸기 «전»에 기다린다 — 거부되는 곳은 떠나는 쪽 _saveScratch 뿐(_loadScratch 는 스스로 삼킨다)이라,
       거부되면 층도 페이지도 그대로 두고 알린다(아무것도 안 잃는다). */
  if (isActivePage) {
    const target = state.pages[idx + 1] || state.pages[idx - 1];
    const _scratchTok = window.AutoSaveSuppress.begin('page-delete-scratch');
    _pageDeleteBusy = true;
    try {
      await window.switchScratchPage?.(target.id, { quiet: true });   // 실패 알림은 아래 한 번, 공용 알림과 겹치지 않게
    } catch (e) {
      console.warn('[deletePage] 스크래치 저장 실패 — 삭제 취소:', e);
      window.showToast('⚠️ 스크래치 저장에 실패해 페이지를 지우지 않았습니다.');
      return;
    } finally { _pageDeleteBusy = false; window.AutoSaveSuppress.end(_scratchTok); }
    idx = state.pages.findIndex(p => p.id === pageId);   // 기다리는 사이 프로젝트가 바뀌었으면 그 페이지는 없다
    if (idx === -1 || state.pages[idx] !== page) return;   // 같은 id 의 «다른» 페이지(다른 프로젝트의 page_1 등)를 지우지 않는다 · ⌘Z 가 옛 프로젝트 장을 넣지 않게(리뷰 1-2)
  }
  const wasActive = pageId === state.currentPageId;
  /* ★EMPTY-PAGE-DELETE-NO-CONFIRM-NO-UNDO-01 — 확인 없이 지우는 빈 페이지는 ⌘Z 한 번으로 돌아오게 한다(확인창은 안 더한다 · 내용 페이지 갈래는 무변).
     돌아올 본 = 지운 순간 그대로(보던 장이면 라이브 화면 — page.canvas 는 flush 전이라 지우기 전 섹션이 남아 있을 수 있다). 그 장의 이력은 버리지 않고 맡겨 둔다. */
  const _undoable = !hasContent;
  if (_undoable) { if (wasActive) { page.canvas = canvasHtmlForCheck; window.stashHistoryFor?.(pageId); } }
  state.pages.splice(idx, 1);
  // D1: 삭제된 페이지의 히스토리 stash 정리 (메모리 누수 방지) — 되돌릴 수 있는 빈 페이지는 남긴다(돌아오면 그 이력도 같이)
  if (!_undoable) window.dropHistoryFor?.(pageId);
  _pageVideoPendingSidecars.delete(pageId); // 같은 이유로 sidecar도 같이 정리
  if (wasActive) {
    const next = state.pages[Math.min(idx, state.pages.length - 1)];
    /* ★[H6] 억제는 «구조»로 연다 — 아래 rebindAll·applyPageSettings·showPageProperties 중
     *   하나만 던져도 예전엔 억제가 true 로 남아 자동저장이 조용히 멎었다(고착).
     *   ⛔해제 «시점»은 예전 `= false` 와 같은 자리(finally)로 둔다 — 앞당기지 않는다. */
    const _asTok = window.AutoSaveSuppress.begin('page-delete');
    try {
      state.currentPageId = next.id;
      if (next.pageSettings) Object.assign(state.pageSettings, next.pageSettings);
      canvasEl.innerHTML = sanitizeCanvasHtml(next.canvas || '');
      stripLoadedRuntimeState(canvasEl);
      // ★T-031 3차: next 페이지 자신의 sidecar만 쓴다(_pageVideoPendingSidecars Map, 위 switchPage와 같은 이유).
      rebindAll({ videoPendingSidecar: _pageVideoPendingSidecars.get(next.id) });
      applyPageSettings();
      window.fitKeylessFreeFrameGridsOnOpen?.(canvasEl);   // E129 F3 — 페이지 전환도 «열기»다
      window.deselectAll();
      window.showPageProperties();
      /* 빈 페이지 갈래: 남을 페이지의 이력으로 갈아탄다(switchPage 와 같은 짝) — 안 갈아타면 ⌘Z 가 지운 장의 옛 칸을 목록에 없는 id 로 띄웠다(유령) */
      if (_undoable) window.adoptHistoryFor?.(next.id);
    } finally { window.AutoSaveSuppress.end(_asTok); }
  }
  window.buildLayerPanel();
  if (_undoable) {
    /* 남은 페이지 이력에 «페이지 삭제» 한 칸 — 캔버스는 그대로라 되돌릴 것은 목록뿐이다(sideEffects 길 · 섹션 보호·스크래치와 같은 꼴).
       ⛔다시 하기는 그 장을 보고 있으면 안 지운다(지우는 길은 deletePage 의 스크래치 옮기기를 거쳐야 한다) · 마지막 한 장도 안 지운다. */
    const removed = page, at = idx;
    window.pushHistory?.('페이지 삭제', {
      onUndo: () => {
        if (state.pages.some(p => p.id === removed.id)) return;
        state.pages.splice(Math.min(at, state.pages.length), 0, removed);
        window.buildLayerPanel(); scheduleAutoSave();
      },
      onRedo: () => {
        const i = state.pages.findIndex(p => p.id === removed.id);
        if (i === -1 || removed.id === state.currentPageId || state.pages.length <= 1) return;
        if ((removed.canvas || '').includes('section-block')) return;   // 돌아온 뒤 내용이 생겼다 — 지울 때와 같은 잣대로 확인 없이 안 지운다(리뷰 1-1 · 손실)
        state.pages.splice(i, 1);
        window.buildLayerPanel(); scheduleAutoSave();
      },
    });
  }
  scheduleAutoSave();
}

function getSerializedCanvas() {
  // section data-name 속성 동기화 — 값이 이미 같으면 쓰기 생략 (MUT-01: 동일 값 쓰기도 MutationObserver를 트리거해 scheduleAutoSave 재귀 루프 발생)
  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (sec._name && sec.dataset.name !== sec._name) sec.dataset.name = sec._name;
  });
  // 핸들/힌트 등 상태 요소는 직렬화에서 제외
  const clone = canvasEl.cloneNode(true);
  // ★세척 파이프라인은 js/io/section-serialize.js 의 serializeCleanRoot 단일 진실원에 있다
  //   (협업 undo 라이브 가드가 «섹션 1개»에 같은 세척을 적용해야 하므로 코드를 공유 —
  //   목록이 갈리면 오경보가 난다). 여기선 클론에 그대로 적용해 innerHTML 을 반환한다
  //   (연산·순서 동일 → 출력 바이트 동일). 플레인 스크립트라 이 모듈보다 먼저 로드된다.
  window.serializeCleanRoot(clone);
  return clone.innerHTML;
}

/* ★★[P-A1″] «편집이 아닌 것»의 단일 목록 — ★★본체는 ★`js/io/editor-ui-roster.js` 로 ★옮겼다(261023 · R1).
   ★까닭: ★캡처 공용 겹(capture-safety.js)도 ★같은 상수를 ★봐야 하는데, ★이 파일이 ★그 파일을
     ★이미 import 하고 있어(:14) ★거꾸로 걸면 ★순환이다. ⇒ ★잎 모듈로 뺐다.
   ★여기선 ★그대로 ★이어 부른다 — ★이 파일을 import 하던 자리는 ★전과 ★같이 돈다. */
import { NON_CONTENT_UI_SELECTOR } from './editor-ui-roster.js';
import { NON_EDIT_ATTRS, NON_EDIT_CSSVARS, CHROME_SEL } from '../non-edit-roster.js';   // ★167 — 비교(history.js)와 «같은 이름»으로 세대를 본다
export { NON_CONTENT_UI_SELECTOR };
if (typeof window !== 'undefined') window.NON_CONTENT_UI_SELECTOR = NON_CONTENT_UI_SELECTOR;   // ★E148 — ⌘C 글자 뽑기(editor.js)가 «같은 목록»으로 UI 를 걷는다

/** 이 mutation 이 «UI 장식»만 건드렸나 — 그렇다면 편집이 아니다. */
function _isNonContentUiMutation(m) {
  /* ★childList 뿐 아니라 «그 UI 장식 ★안»의 글자·속성 변화도 편집이 아니다.
     까닭은 위 계약 그대로다 — 저장에서 지워지는 것은 정의상 콘텐츠가 아니고, 지워질 것의
     글자가 바뀐 것도 콘텐츠 변화일 수 없다.
     왜 넓혔나(2026-10-07): 섹션 높이 배지(.section-height-badge)는 높이가 바뀔 때마다
     제 `data-h` 를 고친다(attributes — 글자는 CSS ::after 가 그린다). 안 걸러내면
     «블록을 하나 옮길 때마다» 1500ms 뒤 serializeProject 가 또 돌아 자동저장이 두 번 울린다.
     (characterData 쪽도 같은 한 줄이 덮는다 — 장식 «안»이면 무엇이 바뀌든 편집이 아니다.)
     ⇒ 옛 꼴(childList 전용)도 그대로 참이다 — 이 줄은 그 위에 «안쪽»을 더한 것이다. */
  const tgt = m.target?.nodeType === 1 ? m.target : m.target?.parentElement;
  if (tgt?.closest?.(NON_CONTENT_UI_SELECTOR)) return true;
  if (m.type !== 'childList') return false;
  const nodes = [...m.addedNodes, ...m.removedNodes];
  if (!nodes.length) return false;
  return nodes.every(n => n.nodeType === 1 && n.matches?.(NON_CONTENT_UI_SELECTOR));
}

function serializeProject() {
  flushCurrentPage();
  return JSON.stringify({
    version: 2,
    currentPageId: state.currentPageId,
    pages: state.pages,
    checklistItems: window._ckItems || [],
    checklistSections: window._ckSections || [],
    imageGallery: Array.isArray(state.imageGallery) ? state.imageGallery : [],
    assetsTree:   Array.isArray(state.assetsTree)   ? state.assetsTree   : [],
  });
}

/* ★B6 ㉡ 열 때 정리 (현빈 「좌측정렬인데 왼쪽으로 튀어나감」, 2026-10-03; 정렬 단추 쪽은 prop-asset.js applyAlign)
 *  ㉡ = px 폭(전폭 calc 아님) 에셋이 «그 블럭이 든 섹션의 안쪽 좌우 패딩»보다 더 큰 음수 margin 을 갖는 것
 *       — 풀블리드가 심은 음수마진이 «반쪽 세트»로 남아 섹션 가장자리보다 밖으로 나간 꼴.
 *  판정식: |음수 margin| > 그 섹션 section-inner 의 padding(computed). ⛔60·72 같은 고정값을 박지 않는다.
 *  ⛔㉠(|margin| == 패딩, 가장자리에 딱 붙음)은 손대지 않는다 — 사람이 일부러 둔 것일 수 있다.
 *  ⛔㉢ 가운데 정렬도 안 건드린다(양쪽 마진이 상쇄돼 화면이 안 밀린다). 좌·우 정렬만 대상.
 *  실측 ㉡ 8건: proj_1781053673152 · proj_1781053545182 · proj_1781451947664 · proj_1782274786302 ·
 *    proj_1786077501267 의 ab_lns8z1r(sec_brhc463, -72 · 패딩 60) / proj_1783422689095 의 ab_38vkd83(sec_9y6vryg, -72 · 60) /
 *    proj_1791003000001 · proj_1791003000002 의 ab_lns8z1r(태양 실측 사본). 모두 좌정렬.
 *  ★히스토리 밖이다(⌘Z 불가): applyProjectData 의 자동저장 억제 구간 안이라 «저장본을 곧바로 바꾸지 않는다» —
 *    화면(DOM)만 고치고, 사용자가 다음에 저장(편집 → 자동저장)할 때 그 DOM 이 저장본에 반영된다. 고치기만 하고 안 저장하면 파일은 옛 값.
 *  폭·마진 «세트»는 window.applyAssetWidth 가 정본(prop-page.js). */
function healAssetsBeyondSectionEdge(root) {
  try {
    root.querySelectorAll('.section-inner .asset-block').forEach(ab => {
      const align = ab.dataset.align;
      if (align !== 'left' && align !== 'right') return;
      /* ★적대QA(0e) — 「실제로 든 상자」를 따라간다: 에셋 부모부터 .section-block 까지 «모든 조상»의 좌우 패딩을 합한다
           (행 패딩·합친 섹션 상자(.section-merged-part)·섹션 개별 패딩/페이지 padX 가 다 들어간다).
           합이 클수록 정리를 «덜» 한다(보수적) — ㉠(딱 붙음)·행 패딩 안의 음수마진을 ㉡ 로 오인하지 않는다.
         ⛔띄운 에셋(오버레이·자유 프레임 안 absolute)은 left/top 이 기준이라 margin 이 뜻이 다르다 — 대상에서 뺀다. */
      if (ab.dataset.overlay === 'true' || ab.parentElement?.closest('[data-free-layout]')) return;
      const acs = getComputedStyle(ab);
      if (acs.position === 'absolute' || acs.position === 'fixed') return;
      const w = ab.style.width;
      if (!/^\d+(\.\d+)?px$/.test(w)) return;
      const sec = ab.closest('.section-block');
      let padL = 0, padR = 0, contentW = 0;
      for (let el = ab.parentElement; el && el !== sec; el = el.parentElement) {
        const c = getComputedStyle(el);
        padL += parseFloat(c.paddingLeft) || 0; padR += parseFloat(c.paddingRight) || 0;
      }
      const par = ab.parentElement;
      contentW = par ? par.clientWidth - (parseFloat(getComputedStyle(par).paddingLeft) || 0) - (parseFloat(getComputedStyle(par).paddingRight) || 0) : 0;
      if (contentW > 0 && parseFloat(w) > contentW + 0.5) return;   // 콘텐츠 폭을 넘는 폭은 건드리지 않는다
      const negL = -(parseFloat(ab.style.marginLeft) || 0), negR = -(parseFloat(ab.style.marginRight) || 0);
      if (!(negL > padL + 0.5 || negR > padR + 0.5)) return;        // ㉠(딱 붙음)·안쪽은 그대로
      if (window.applyAssetWidth) window.applyAssetWidth(ab, parseFloat(w));
      else { ab.style.marginLeft = ''; ab.style.marginRight = ''; }
    });
  } catch (_) {}
}

function applyProjectData(data) {
  _emptyByRestoreOwner = null;
  /* ★[H6] 여기는 «일부러» 직접 대입으로 둔다(허용목록 — tests/unit/autosave-suppress.test.js).
   *   AutoSaveSuppress 로 바꾸면 이 창이 «부르는 쪽»(탭전환·브랜치전환·커밋복원)의 창에 중첩돼
   *   해제가 한 프레임 밀린다. 그러면 복원 직후 MutationObserver 가 «억제 안에서» 발화해
   *   복원 결과가 자동저장되지 않는다 — 고착이 아니라 «반대 방향» 회귀다.
   *   ⛔바꾸려면 부르는 쪽 셋에 명시적 scheduleAutoSave() 를 같이 넣어야 한다(history.js:223 본보기). */
  // DBG-SEC-LOSS: innerHTML 적용으로 인한 MutationObserver → autoSave 트리거를 봉쇄
  // 적용 도중 사용자 reload/탭전환이 끼어들어 부분 상태가 파일에 저장되는 race 방지
  /* ★정본으로 «연다» — 토큰을 받아야 위 finally 에서 깊이 세기가 맞는다.
     ⛔정본이 없으면(로드 실패) 옛 방식으로 켜되, 아래 finally 가 그 경우도 받는다. */
  const _AS_open = (typeof window !== 'undefined') ? window.AutoSaveSuppress : null;
  const _suppressTok = (_AS_open && typeof _AS_open.begin === 'function')
    ? _AS_open.begin('applyProjectData')
    : null;
  if (!_suppressTok) state._suppressAutoSave = true;
  _loadWindowHistPos = null;
  try {
    if (data.version === 2 && Array.isArray(data.pages)) {
      // S8: pages 빈 배열 방어 — 최소 1페이지 보장
      if (data.pages.length === 0) {
        data.pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { ...state.pageSettings }, canvas: '' }];
      }
      state.pages = data.pages;
      state.currentPageId = data.currentPageId || data.pages[0]?.id;
    } else {
      // v1 backward compat
      const id = 'page_1';
      state.pages = [{ id, name: 'Page 1', label: '', pageSettings: data.pageSettings || { ...state.pageSettings }, canvas: data.canvas || '' }];
      state.currentPageId = id;
    }
    // 정책 게이팅: 로드 시점 base64 베이스라인 기록(비파괴, 읽기만). 저장 시 new-only 모드가
    // 이 베이스라인에 없는 신규 이미지만 외부화하고 기존 base64는 보존하도록 한다.
    // activeProjectId는 호출 시점에 이미 대상 프로젝트로 설정됨(initLoad/탭전환 _setActId/브랜치 전환).
    try { recordExternalizeBaseline(data, activeProjectId); } catch (_) {}
    const page = getCurrentPage();
    if (!page) return; // S8: 여전히 undefined면 안전하게 종료
    if (page.pageSettings) Object.assign(state.pageSettings, page.pageSettings);
    canvasEl.innerHTML = sanitizeCanvasHtml(page.canvas || '');
    stripLoadedRuntimeState(canvasEl);
    rebindAll();
    initLazySections();       // 멱등 — 최초 1회만 IntersectionObserver 생성
    refreshLazyObservation(); // innerHTML 교체 후 새 section-block 관찰 등록
    applyPageSettings();
    window.fitKeylessFreeFrameGridsOnOpen?.(canvasEl);   // E129 F3 — 키 없는 전폭 자유프레임 그리드(«padX 적용 뒤» — grid-block.js 머리말)
    healAssetsBeyondSectionEdge(canvasEl);   // B6 ㉡ — «페이지 padX 가 적용된 뒤»(computed 를 읽으므로) 열 때 정리
    window.deselectAll?.(); // DBG-10: 브랜치 전환 시 이전 선택 상태 클리어
    window._ckItems    = Array.isArray(data.checklistItems)    ? data.checklistItems    : [];
    window._ckSections = Array.isArray(data.checklistSections) ? data.checklistSections : [];
    // AI 이미지 갤러리 복원 — 누락된 프로젝트는 [] 폴백 (마이그레이션 코드 불필요)
    state.imageGallery = Array.isArray(data.imageGallery) ? data.imageGallery : [];
    // Assets 트리 복원 — 빈 트리면 기본 "제품사진" + "favorite" 폴더 자동 생성
    // (U7) favorite 폴더는 favorite:true 플래그로 식별하는 보호 폴더.
    //      빈 트리가 아니어도 favorite 플래그 폴더가 없으면 1회만 멱등 삽입(중복 금지).
    state.assetsTree   = Array.isArray(data.assetsTree)   ? data.assetsTree   : [];
    const _astId = () => 'ast_' + Math.random().toString(36).slice(2, 8);
    if (state.assetsTree.length === 0) {
      state.assetsTree.push({
        id: _astId(),
        type: 'folder',
        name: '제품사진',
        children: [],
      });
    }
    // favorite 폴더 멱등 시드/마이그레이션 — 최상위에 favorite:true 폴더가 없을 때만 삽입
    const _hasFavorite = state.assetsTree.some(n => n && n.type === 'folder' && n.favorite === true);
    if (!_hasFavorite) {
      const favNode = {
        id: _astId(),
        type: 'folder',
        name: 'favorite',
        favorite: true,
        children: [],
        collapsed: false,
      };
      // 제품사진 폴더 바로 다음에 삽입 (없으면 맨 앞)
      const prodIdx = state.assetsTree.findIndex(n => n && n.type === 'folder' && n.name === '제품사진');
      if (prodIdx >= 0) state.assetsTree.splice(prodIdx + 1, 0, favNode);
      else state.assetsTree.unshift(favNode);
    }
    // background(구 Texture) 폴더 멱등 시드/마이그레이션 — 최상위 texture:true 폴더가 고정 보호 폴더
    let _texFolder = state.assetsTree.find(n => n && n.type === 'folder' && n.texture === true);
    if (!_texFolder) {
      _texFolder = {
        id: _astId(),
        type: 'folder',
        name: 'background',
        texture: true,
        children: [],
        collapsed: false,
      };
      // favorite 폴더 바로 다음(없으면 제품사진 다음, 그것도 없으면 맨 앞)에 삽입
      const favIdx = state.assetsTree.findIndex(n => n && n.type === 'folder' && n.favorite === true);
      const prodIdx2 = state.assetsTree.findIndex(n => n && n.type === 'folder' && n.name === '제품사진');
      const insAt = favIdx >= 0 ? favIdx + 1 : (prodIdx2 >= 0 ? prodIdx2 + 1 : 0);
      state.assetsTree.splice(insAt, 0, _texFolder);
    } else if (_texFolder.name === 'Texture') {
      // 기존 프로젝트 마이그레이션 — 구 이름 'Texture' → 'background' (멱등)
      _texFolder.name = 'background';
    }
    // 노트패널 하위폴더 + 배경 패턴 6종 멱등 시드 (안정 id로 재로드 중복 방지)
    seedNoteBgPatterns(_texFolder);
    // 「texture paper」 하위폴더 + 종이 8장 — 프로젝트당 «한 번만»(표식 = background 폴더 seeded[]). 지우면 안 돌아온다.
    seedPaperTexturesOnce(_texFolder);
    window.buildLayerPanel(); // also calls buildFilePageSection
    window.showPageProperties();
    window.renderChecklistPanel?.();
    window.buildAIImageGallery?.();
    window.buildAssetsPanel?.();
    // 프로젝트 로드/탭 전환 후 히스토리 초기화 — 이전 프로젝트/페이지 스냅샷 잔류 방지
    // D1: 페이지간 히스토리(stash Map)도 전부 비워 프로젝트 격리 (프로젝트 B 로드 시 A stash 오염 방지)
    window.resetAllPageHistory?.();
    window.clearHistory?.();
    /* ★T-031 3차 — 같은 이유로 _pageVideoPendingSidecars(pageId 키)도 비운다(a1-a3 지적,
     * 2026-09-15). pageId는 프로젝트마다 고유하지 않다(기본 첫 페이지가 전부 'page_1' —
     * globals.js) — 비우지 않으면 "1페이지에 미확정 영상 남긴 채 2페이지로 이동(Map에
     * 저장) → 탭/브랜치 전환(같은 id를 쓰는 다른 프로젝트 데이터가 얹힘, 그 블록은 빈
     * 상태) → 1페이지로 복귀"에서 전환 전 영상이 엉뚱하게 되살아날 수 있다. */
    _pageVideoPendingSidecars.clear();
    /* ★문서를 «열 때» 없는 글꼴을 알린다(일러스트·피그마와 같은 시점).
       여기가 최초 로드·탭 전환·브랜치 전환이 모두 지나가는 자리다.
       한가할 때 세고(requestIdleCallback) 읽기만 하므로 이 저장 억제 구간과 부딪치지 않는다. */
    window.gdtFontCheckDocument?.();
  } finally {
    /* MutationObserver는 microtask 후 발화 — rAF로 한 프레임 뒤 해제해 잔여 mutation까지 흡수.
       ⛔★2026-09-08 실측 사고: rAF «하나»에만 매달려 있었다.
         브라우저는 창이 «가려지면»(visibilityState:'hidden') rAF 를 아예 안 돌린다 —
         실측: hidden 창에서 3초를 기다려도 «한 번도» 안 돌았고, 억제가 그대로 걸려 있었다.
         ⇒ ⑴자동저장이 «영영» 안 돈다 = 그 창의 편집이 저장되지 않는다(고착이 곧 데이터 손실)
           ⑵open_project 가 「아직 안 열렸다」로 상한 120초를 꽉 채운다(실측 58~92초 관측의 정체)
       ★이 파일은 이미 같은 병을 앓고 그 처방을 적어 뒀다 —
         `_AUTOSAVE_DEFER_MAX_MS`(:1350) 옆 주석: 「고착이 곧 데이터 손실이다 … 재개 경로를 «셋» 둔다」.
         그런데 이쪽 경로엔 그 안전망이 «없었다». 같은 처방을 여기에도 둔다.
       ⇒ rAF 의 «뜻»(한 프레임 뒤 = 잔여 mutation 흡수)은 그대로 두고,
         rAF 가 «안 도는 경우»에만 타이머가 받는다. 둘 중 먼저 오는 쪽이 푼다(한 번만). */
    /* ★★«새 기계를 만들지 않는다» — 이 문제를 위해 만들어진 정본이 이미 있다:
         js/autosave-suppress.js 의 AutoSaveSuppress.endNextFrame().
       그 파일이 갖고 있는 것: ⑴토큰 빗장(tok.released — 한 번만 닫힌다)
         ⑵깊이 세기(겹친 억제 창에서 «뒤엣것이 앞엣것을 풀지» 못한다)
         ⑶고착 감시견 ⑷rAF+타이머 «둘 다» 걸기(2026-09-09 내가 그 파일에서 고친 자리)
       ⛔내가 여기에 «빗장+타이머»를 손으로 또 지으면 그게 두 벌이 된다 —
         그리고 겹친 로드에서 「뒤엣것이 앞엣것을 푸는」 구멍은 «내 빗장으로는 못 막는다»
         (빗장은 호출마다 새로 생기는데 억제 플래그는 하나라서다. 지디가 그 구멍을 확인했다).
       ⇒ 정본을 «쓴다». 없으면(고전 스크립트 로드 실패 등) 옛 동작으로 떨어지되 안전망은 유지한다. */
    const AS = (typeof window !== 'undefined') ? window.AutoSaveSuppress : null;
    _loadWindowHistPos = window.historyPos;   // ★여기부터 스택이 앞으로 가면 편집이다
    _loadWindowInput = false;
    if (AS && typeof AS.endNextFrame === 'function' && _suppressTok) {
      AS.endNextFrame(_suppressTok);
    } else {
      let _released = false;
      const _release = () => {
        if (_released) return;
        _released = true;
        state._suppressAutoSave = false;
      };
      requestAnimationFrame(_release);
      /* ⛔rAF «없을 때» 폴백이 아니라 «안 돌 때» 안전망이다 — 가려진 창에선 rAF 가 있어도 안 돈다. */
      setTimeout(_release, 250);
    }
  }
}

// 노트패널 하위폴더 + 배경 패턴 6종 멱등 시드.
// 각 노드는 안정 id(ast_notebg_01~06)와 인라인 src(data URI)로 시드되어
// 재로드 시 중복 생성되지 않는다(blobPath 없음 → assetsGetDataUrl 인라인 폴백이 처리).
function seedNoteBgPatterns(bgFolder) {
  if (!bgFolder) return;
  if (!Array.isArray(bgFolder.children)) bgFolder.children = [];
  let noteFolder = bgFolder.children.find(n => n && n.type === 'folder' && n.id === NOTE_BG_FOLDER_ID);
  if (!noteFolder) {
    noteFolder = { id: NOTE_BG_FOLDER_ID, type: 'folder', name: NOTE_BG_FOLDER_NAME, locked: true, children: [], collapsed: false };
    bgFolder.children.push(noteFolder);
  }
  noteFolder.locked = true; // 마이그레이션: 기존 프로젝트의 노트패널도 보호 폴더로 승격(멱등)
  if (!Array.isArray(noteFolder.children)) noteFolder.children = [];
  for (const p of NOTE_BG_PATTERNS) {
    const existing = noteFolder.children.find(n => n && n.id === p.id);
    if (existing) {
      // 마이그레이션(멱등): 기존 시드 노드에 썸네일/소스 최신화 (구 시드엔 thumbSrc 없음 → 썸네일 빈네모 해소)
      existing.src = p.src;
      existing.thumbSrc = p.thumbSrc;
      existing.mime = 'image/svg+xml';
      if (!existing.name) existing.name = p.name;
      continue;
    }
    noteFolder.children.push({
      id: p.id,
      type: 'image',
      name: p.name,
      src: p.src,
      thumbSrc: p.thumbSrc,
      mime: 'image/svg+xml',
      addedAt: new Date().toISOString(),
    });
  }
}

function _bgRgba(ps) {
  const h = (ps.bg || '#000000').replace('#','');
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  const a = Math.max(0, Math.min(1, (ps.bgAlpha ?? 100) / 100));
  return `rgba(${r},${g},${b},${a})`;
}

/* ★T-054(2026-09-16, 작업목록매니저 코드감사 발견) — ps.bgGradient(JSON {type,angle,stops},
   prop-page.js goya-cp:gradient 핸들러가 씀)는 저장 파일엔 그대로 남는데, 페이지를 다시 열면
   여기(_bgRgba)만 불려 항상 «솔리드»로 칠해졌다. 그라데이션이 있으면 그걸 우선한다 —
   window.GradientModel.toCss(model)가 gradient-model.js(ES 모듈, 이 시점엔 이미 로드완료)의
   같은 직렬화 규약을 쓴다(prop-page.js가 goya-cp:gradient 로 받는 것과 동일 포맷). */
function _bgCss(ps) {
  if (ps.bgGradient) {
    try {
      const model = JSON.parse(ps.bgGradient);
      const css = window.GradientModel?.toCss?.(model);
      if (css) return css;
    } catch (_) { /* 깨진 JSON — 솔리드로 폴백 */ }
  }
  return _bgRgba(ps);
}

function applyPageSettings() {
  applyCanvasBackground(_bgCss(state.pageSettings));
  window.seedPageBgGradientPicker?.();   // T-054 후속 — 재오픈 씨앗도 캔버스 칠과 같은 타이밍에 갱신
  canvasEl.style.gap = state.pageSettings.gap + 'px';
  canvasEl.style.setProperty('--page-pady', state.pageSettings.padY + 'px');
  // padX: 섹션 물리적 padding 방식으로 적용 (섹션 개별 override 제외)
  window.applyPagePadX?.(state.pageSettings.padX);
}

function migrateColsFromDOM(canvasEl) {
  // ★duo-block → grid-block 셸 승격 (2026-09-05 개명, 구버전 저장 호환) — id 는 안 바꾼다.
  //   아래 sub-section-block → frame-block 과 «같은 층·같은 패턴»이다.
  window.migrateGridIdentity?.(canvasEl);
  // sub-section-block → frame-block 리네임 (구버전 저장 호환)
  canvasEl.querySelectorAll('.sub-section-block').forEach(el => {
    el.classList.replace('sub-section-block', 'frame-block');
  });
  // sub-section-inner / frame-inner → 제거 (래퍼 제거, 자식을 frame-block 직속으로)
  canvasEl.querySelectorAll('.sub-section-inner, .frame-inner').forEach(inner => {
    const parent = inner.parentElement;
    if (!parent) return;
    [...inner.childNodes].forEach(child => parent.appendChild(child));
    inner.remove();
  });
  // 인라인 핸들 제거 — 핸들은 이제 #ss-handles-overlay에서 렌더링
  canvasEl.querySelectorAll('.frame-block > .ss-resize-handle').forEach(h => h.remove());

  // Stack row: col wrapper 제거, 자식 블록을 row 직속으로 이동
  canvasEl.querySelectorAll('.row[data-layout="stack"] > .col').forEach(col => {
    const row = col.parentElement;
    // col의 배경색이 있으면 row로 승계
    if (col.style.backgroundColor) row.style.backgroundColor = col.style.backgroundColor;
    [...col.childNodes].forEach(child => {
      if (child.classList?.contains('col-placeholder')) return; // placeholder 제거
      row.appendChild(child);
    });
    col.remove();
  });
  // Flex/Grid row: col → NewGrid 변환 (deprecated, 2026-06-08 봉인)
  // NewGrid Frame(ss_*) 블록은 사용자 정책상 안 씀 (UI 노출 0, 플로팅 패널 숨김).
  // proj.json load 시 multi-col row를 자동 grid 변환하던 코드 비활성화.
  // 단일 col은 stack 정리만 유지(grid 생성 없음).
  canvasEl.querySelectorAll('.row[data-layout="flex"], .row[data-layout="grid"]').forEach(row => {
    if (row.dataset.cardGrid) return;
    const cols = [...row.querySelectorAll(':scope > .col')];
    if (cols.length === 1) {
      // 단일 col → stack 정리
      if (cols[0].style.backgroundColor) row.style.backgroundColor = cols[0].style.backgroundColor;
      [...cols[0].childNodes].forEach(child => {
        if (child.classList?.contains('col-placeholder')) return;
        row.appendChild(child);
      });
      cols[0].remove();
      row.dataset.layout = 'stack';
    }
    // multi-col(cols.length >= 2)은 .row + .col 그대로 보존 (NewGrid 변환 X)
  });

  // row[data-layout="stack"] > text-block → frame-block[data-text-frame] > text-block
  // col 제거 후 실행해야 row 직속 text-block을 올바르게 감지함
  canvasEl.querySelectorAll('.row[data-layout="stack"] > .text-block').forEach(tb => {
    const row = tb.parentElement;
    if (row.closest('.asset-overlay')) return; // overlay-tb는 제외
    const tf = document.createElement('div');
    tf.className = 'frame-block';
    tf.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    tf.dataset.textFrame = 'true';
    tf.dataset.bg = 'transparent';
    tf.style.cssText = 'background:transparent;width:100%;box-sizing:border-box;';
    if (row.dataset.paddingX) {
      tf.dataset.paddingX   = row.dataset.paddingX;
      tf.style.paddingLeft  = row.dataset.paddingX + 'px';
      tf.style.paddingRight = row.dataset.paddingX + 'px';
    }
    row.before(tf);
    tf.appendChild(tb);
    if ([...row.childNodes].every(n => n.nodeType === Node.TEXT_NODE && !n.textContent.trim())) {
      row.remove();
    }
  });

  // freeLayout frame-block 직속 text-block → frame-block[data-text-frame] > text-block
  // absolute 위치/크기를 text-frame으로 이전, text-block은 flow 자식으로
  canvasEl.querySelectorAll('.frame-block[data-free-layout="true"] > .text-block, .frame-block[data-freeLayout="true"] > .text-block').forEach(tb => {
    const tf = document.createElement('div');
    tf.className = 'frame-block';
    tf.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    tf.dataset.textFrame = 'true';
    tf.dataset.bg = 'transparent';
    // 절대 위치/크기를 text-frame으로 이전
    const pos = tb.style.cssText; // e.g. "position: absolute; left: 0px; top: 20px; width: 100%;"
    tf.style.cssText = pos + ';box-sizing:border-box;';
    tb.style.cssText = ''; // text-block에서 절대 위치 제거
    // dataset.width도 이전
    if (tb.dataset.width) {
      tf.dataset.width = tb.dataset.width;
      delete tb.dataset.width;
    }
    tb.before(tf);
    tf.appendChild(tb);
  });

  // ★도형 래퍼 안에 들어간 블록을 «래퍼 바로 뒤(같은 부모)»로 꺼낸다(현빈 확정 0918 A안).
  //   반드시 맨 끝 — .frame-inner 해체·text-frame 래핑이 끝나 «이동 단위»가 완성된 뒤여야 한다.
  //   멱등(오염 없으면 DOM 무변이) — rebindAll 이 로드·undo/redo 양쪽에서 불러도 dirty 를 만들지 않는다.
  //   강제 저장은 안 한다(다음 자연 저장에 반영, 그 전엔 매 로드 같은 결과).
  ejectShapeFrameIntruders(canvasEl);
}

/* ★CLONE-RERENDER-01 — «다시 그릴 종류» 한 벌(정본). 소비자 4:
 *   rebindAll(아래 · 로드·undo) · _bindVariantClone(js/section-variation.js · A/B 사본) ·
 *   _bindInsertedTree(js/panels/template-system.js · 템플릿 넣기) · _bindPastedEl(js/editor.js · 붙여넣기).
 * 왜 한 벌인가 — 네 자리가 «다시 그릴 종류»를 손으로 따로 적어 서로 달랐다(rebindAll 21 · 변형 sticker 1 ·
 *   템플릿 3 · 붙여넣기 11). 바인더(칸 누르기·dblclick 편집·끌기)를 render 안에서 거는 종류는 «안 그리면» 사본에서 죽는다
 *   (W2D-01b radial 칸 · 실측 핀 002d9725 명부 18 — reports/S5-CLONE-RERENDER-01.md).
 * ⛔소비자에 render 줄을 다시 따로 적지 마라 — 두 번 그려진다(이 표에 없는 종류만 거기서 따로).
 * ⛔바인드(bindBlock · bind*Select)는 여기서 안 한다 — 소비자마다 순서가 다르다(그 몫은 그 자리).
 * 조건 셋은 rebindAll 에서 옮긴 그대로다: graph 는 «방사형일 때만»(다른 유형은 저장본 그대로 — 바이트 무변 · 의도) ·
 *   말풍선은 dataset.lines 가 «있을 때만»(옛 말풍선은 저장된 DOM 그대로) · bridge 는 그린 뒤 full-bleed 를 다시 맞춘다. */
const RERENDER_KINDS = [
  ['sticker-block',       (b) => { window.renderStickerBlock?.(b); }],
  ['gradient-block',      (b) => { window.renderGradientBlock?.(b); }],
  ['laurel-block',        (b) => { window.renderLaurelBlock?.(b); }],
  /* 쿠폰: 저장본 HTML 은 «그때의 그림»이다 — 배경 SVG·글자 자리·글자 크기가 전부 dataset ＋ 폭 비율에서 다시 나온다.
     ⛔재렌더를 빼면 로드 뒤 «옛 폭으로 그린 그림»이 새 dataset 과 어긋난다(laurel/zoom 과 같은 패턴). V4 변이가 이 줄을 잰다. */
  ['coupon-block',        (b) => { window.renderCouponBlock?.(b); }],
  ['quote-block',         (b) => { window.renderQuoteBlock?.(b); }],
  /* 프로토 Z6 — 방사형 블럭(A)은 dataset 에서 통째로 다시 그린다(칸 누르기 _bindCellHit 도 여기서 걸린다). */
  ['radial-block',        (b) => { window.renderRadialBlock?.(b); }],
  /* 그래프(B)는 «방사형 유형일 때만» 다시 그린다(다른 유형은 저장본 그대로 — 바이트 무변). 별건 GRAPH-RELOAD-BIND-01. */
  ['graph-block',         (b) => { if (b.dataset.chartType === 'radial') window.renderGraph?.(b); }],
  /* zoom(확대블럭): 저장본은 SVG 스냅샷이라 «그림은 맞지만» 이동·a·b 핸들 드래그 위임이 없다(renderZoomBlock 안에서 건다). */
  ['zoom-block',          (b) => { window.renderZoomBlock?.(b); }],
  // bridge: data-bridge-*로 path 재생성 + 항상 full-bleed 재적용 (지금 섹션 패딩 반영)
  ['bridge-block',        (b) => { window.renderBridgeBlock?.(b); window.applyBridgeFullBleed?.(b); }],
  // grid/infocard/innercard: dataset 모델로 재렌더 (직렬 HTML은 스냅샷일 뿐 — dataset이 진실)
  ['grid-block',          (b) => { window.renderGridBlock?.(b); }],
  ['infocard-block',      (b) => { window.renderInfoCardBlock?.(b); }],
  ['innercard-block',     (b) => { window.renderInnerCardBlock?.(b); }],
  // modal: dataset 이 진실 — 재렌더가 아이콘 슬롯 클릭·프로필 × 를 «슬롯 노드에 직접» 다시 건다
  ['modal-block',         (b) => { window.renderModalBlock?.(b); }],
  // chat-block: 저장본 innerHTML은 정적이라 dblclick 편집 핸들러가 없음 → 재렌더로 위임 바인딩
  ['chat-block',          (b) => { window.renderChatBlock?.(b); }],
  /* ★BT2 말풍선 «줄» — dataset.lines 가 진실. ⛔속성이 «있을 때만» 부른다:
     옛 말풍선(줄 없음)은 이 줄을 «안 지난다» = 저장된 DOM 그대로(tests/dom/bt2-safety T1b, 설계 조건 ㈎). */
  ['speech-bubble-block', (b) => { if (b.dataset.lines !== undefined) window.lnRenderBubble?.(b); }],
  // banner02/comparison: scale-to-fit ResizeObserver + 줄 dblclick 편집(줄 노드에 직접) 재바인딩
  ['banner02-block',      (b) => { window.renderBanner02?.(b); }],
  ['comparison-block',    (b) => { window.renderComparison?.(b); }],
  // canvas-block(cvb): 더블클릭 인라인 편집(_bindCvbDblEdit) 위임 바인딩
  ['canvas-block',        (b) => { window.renderCanvas?.(b); }],
  /* qa-block(admin QA): dataset이 진실 — 저장본 innerHTML은 스냅샷일 뿐(id 칩도 지금 id 로).
     ⚠️체크박스/피드백/접기 클릭 위임(bindQABlockEvents)은 재렌더가 «아니라» bindBlock 이 건다(js/block-drag.js:672 · _qaBound). */
  ['qa-block',            (b) => { window.renderQABlock?.(b); }],
  // step-block: data-* → DOM 복원 + 제목·설명 dblclick 편집(_stbDblBound)
  ['step-block',          (b) => { window.renderStepBlock?.(b); }],
];
const RERENDER_SEL = RERENDER_KINDS.map(([c]) => '.' + c).join(', ');
/** 블럭 «하나»를 제 종류대로 다시 그린다 — 표에 없는 종류면 아무것도 안 한다.
 *  맞는 종류를 «전부» 부른다(옛 rebindAll 의 if 줄들과 같은 뜻 — 클래스가 둘인 블럭이 있어도 줄이 빠지지 않게). */
function rerenderBlock(b) {
  if (!b?.classList) return;
  for (const [cls, fn] of RERENDER_KINDS) { if (b.classList.contains(cls)) fn(b); }
}
/** root «안»(root 자신 포함)의 다시 그릴 블럭을 문서 순서대로 다시 그린다 — 사본·템플릿·붙여넣기 문이 부른다. */
function rerenderTree(root) {
  if (!root) return;
  const list = [...(root.matches?.(RERENDER_SEL) ? [root] : []), ...(root.querySelectorAll?.(RERENDER_SEL) || [])];
  list.forEach(rerenderBlock);
}

function rebindAll(opts = {}) {
  migrateColsFromDOM(canvasEl);
  // 구버전 마이그레이션: .asset-img-clip 래퍼 없는 경우 추가 (undo/redo 복원 후에도 항상 실행)
  canvasEl.querySelectorAll('.asset-block.has-image > .asset-img').forEach(img => {
    const clip = document.createElement('div');
    clip.className = 'asset-img-clip';
    img.parentNode.insertBefore(clip, img);
    clip.appendChild(img);
  });
  // 스크래치→섹션 변환의 인라인 aspect-ratio를 px height로 잠금 — 핸들 resize 시 너비 흔들림 방지
  canvasEl.querySelectorAll('.asset-block').forEach(ab => {
    const ar = ab.style.aspectRatio;
    if (!ar) return;
    const m = ar.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (m) {
      const nw = parseFloat(m[1]), nh = parseFloat(m[2]);
      const w = ab.offsetWidth;
      if (w > 0 && nw > 0 && nh > 0) ab.style.height = (w * (nh / nw)) + 'px';
    }
    ab.style.aspectRatio = '';
  });
  // undo/redo 복원 중(_historyPaused) 또는 «협업 수신 적용 중»(opts.preserveHistory)에는 clearHistory 금지 —
  // 호출 시 히스토리 스택 전체 초기화되어 1스텝만 undo 가능해지는 버그.
  // ★C7(치명②): 원격패치 applyPatch(sync.js)가 rebindAll을 _historyPaused=false로 부르면 여기서
  // clearHistory가 실행돼 로컬 커맨드 undo 이력이 통째로 사라진다(len 12→1 재현). 협업 수신은
  // undo/redo 복원과 «다른 이유»로 스택을 보존해야 하므로 별도 플래그로 가드(_historyPaused 오버로드 회피).
  if (!window._historyPaused && !opts.preserveHistory) window.clearHistory?.();
  // undo/redo 복원 후 색상 조정 SVG 필터 재적용
  // (data-adj-* 속성은 HTML에 포함되어 복원되지만 SVG 필터 매트릭스는 별도 DOM이므로 재동기화 필요)
  // ★대상 술어는 image-color-adjust.js 의 ADJ_DIRTY_SEL 하나만 쓴다(에셋 img + 카드 배경이미지 div).
  //   여기에 셀렉터를 복사해 두면 대상이 늘 때마다 «이 줄만 안 따라와» 조용히 복원이 빠진다.
  if (window.restoreImgColorAdjust && window.ADJ_DIRTY_SEL) {
    canvasEl.querySelectorAll(window.ADJ_DIRTY_SEL)
      .forEach(img => window.restoreImgColorAdjust(img));
  }
  /* ★에셋 블러(1012t1 C1) — 스냅샷의 인라인 filter 를 «호스트 상태»로 다시 합성한다(색보정 복원과 같은 자리).
     색보정 없는 그림도 블러 몫이 상태와 어긋나지 않게 — writeImgFilter 한 자리를 탄다. */
  if (window.recomposeImageRedact) {
    canvasEl.querySelectorAll('.asset-block').forEach(ab => window.recomposeImageRedact(ab));
  }
  // asset-overlay 오염 정리: contenteditable 제거 + 직접 텍스트 노드 제거
  canvasEl.querySelectorAll('.asset-overlay').forEach(overlay => {
    overlay.removeAttribute('contenteditable');
    [...overlay.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).forEach(n => n.remove());
  });
  /* ★T-031: video-pending(트림 확정 전 영상)은 js/io/section-serialize.js 의 T-012 안전장치가
   *   세척된 문자열(undo 스냅샷·페이지 canvas)에서 "빈 업로드대기"로 되돌린다. rebindAll 은
   *   undo/redo 복원(history.js) · 페이지 전환(switchPage/deletePage) · 프로젝트 로드
   *   (applyProjectData) · 협업 패치 적용까지 «canvasEl.innerHTML 을 새로 앉힌 뒤» 공통으로
   *   거치는 단일 지점이다 — 여기 한 곳에서 부르면 그 모든 복원 경로가 한 번에 커버된다
   *   (경로마다 따로 심으면 하나를 빠뜨리는 날 그 경로만 샌다, 2026-09-15 지적).
   *   ★2차수정(a1-a3 지적): opts.videoPendingSidecar «없이» 부르면(협업 패치·프로젝트 로드처럼
   *   「이 복원이 어느 스냅샷/페이지인지」모르거나 진짜 파일 리로드인 호출) 아무것도 되살리지
   *   않는다 — «실패 시 안전»(fail-closed) 쪽으로 기본값을 바꿨다. 예전 전역 캐시는 누가 부르든
   *   "id 가 한 번이라도 video-pending 이었으면" 되살려 협업 중 남의 화면·프로젝트 재로드에서도
   *   부활할 수 있었다. undo/redo·페이지전환처럼 「이 시점에 실제로 video-pending 이었나」를
   *   아는 호출자만 자기 스냅샷/페이지의 sidecar를 opts로 넘겨 명시적으로 되살린다. */
  window.reattachVideoPendingBlocks?.(canvasEl, opts.videoPendingSidecar);

  canvasEl.querySelectorAll('.section-block').forEach(sec => {
    if (!sec.id) sec.id = 'sec_' + Math.random().toString(36).slice(2, 9);
    if (sec.dataset.name) sec._name = sec.dataset.name;
    // 템플릿 프리뷰 잔여 인라인 스타일 무조건 초기화 (scale/transform-origin/position/left/pointer-events 등)
    sec.style.transform       = '';
    sec.style.transformOrigin = '';
    sec.style.position        = '';
    sec.style.left            = '';
    sec.style.pointerEvents   = '';
    sec.style.userSelect      = '';
    // 섹션 배경색 복원
    if (sec.dataset.bg && !sec.style.backgroundColor) {
      sec.style.backgroundColor = sec.dataset.bg;
    }
    /* ★1013t2E1 — 색 자리에 그라데이션이 들어 있으면 위 줄은 무효 대입이다(backgroundColor 는 그라데이션을 못 받는다).
       인라인 style 이 같이 저장돼 보통은 그대로 살아 오지만, dataset 이 정본이라 «인라인이 빠진» 길(템플릿·붙여넣기)에서도 다시 세운다.
       ⛔그림이 있으면 건드리지 않는다 — 합성은 prop-section.js _applySectionBg 한 자리의 몫이다(아래 「배경 이미지 복원」). */
    if (!sec.dataset.bgImg && !sec.style.backgroundImage && window.isSectionGradient?.(sec.dataset.bg)) {
      sec.style.backgroundImage = sec.dataset.bg;
    }
    /* ★★prev-06 메시 — ★인라인이 ★빠진 길(템플릿·붙여넣기·이 아래 마이그레이션)에서도 ★다시 세운다.
       ★정본은 ★`dataset.bgMesh` 한 칸이고 ★그리기는 `prop-section.js _applySectionBg` ★한 자리다.
       ⛔여기서 CSS 를 ★조립하지 ★마라 — ★명부가 둘이 된다. */
    if (sec.dataset.bgMesh) window.applySectionBg?.(sec);
    // section-inner paddingX 복원
    const secInner = sec.querySelector('.section-inner');
    if (secInner && secInner.dataset.paddingX !== undefined && secInner.dataset.paddingX !== '') {
      secInner.style.paddingLeft  = secInner.dataset.paddingX + 'px';
      secInner.style.paddingRight = secInner.dataset.paddingX + 'px';
      // usePadx 복원: 개별 asset-block의 패딩 제외 설정
      const px = parseInt(secInner.dataset.paddingX) || 0;
      if (px > 0) {
        secInner.querySelectorAll('.asset-block').forEach(ab => {
          if (ab.dataset.usePadx !== 'true') return;
          /* ★자손 전수라 «합쳐 넣은 몸» 안까지 들어간다. 그 안 블록의 기준 여백은
             위 섹션이 아니라 «그 상자»의 것이다 — 섞으면 재로드 후에만 좌우가 어긋나
             (편집 중엔 멀쩡해서 왕복 검사로도 안 잡힌다) .section-inner{overflow-x:clip}에 잘린다. */
          const part = ab.closest('.section-merged-part');
          const own = part ? (parseInt(part.dataset.padX) || parseFloat(part.style.paddingLeft) || 0) : px;
          ab.style.marginLeft  = -own + 'px';
          ab.style.marginRight = -own + 'px';
          ab.style.width = `calc(100% + ${own * 2}px)`;
        });
      }
    }
    /* ★체크 배경(빈 이미지 자리) 복원 — 현빈 2026-09-28.
       ⛔«클래스가 살아 돌아온다»에 기대지 않는다. 저장본을 거쳐 오는 길에 클래스를 걷는
         자리가 여럿이고(클린 클론·배송본), 그러면 새로고침 한 번에 조용히 꺼진다.
       ⇒ 정본은 dataset 이고, 클래스는 «여기서 다시 세운다». 무늬 값은 CSS 한 자리(.sec-bg-empty). */
    sec.classList.toggle('sec-bg-empty', sec.dataset.bgImgEmpty === '1' && !sec.dataset.bgImg);
    sec.querySelectorAll('.frame-block[data-bg-img-empty="1"]').forEach(f => f.classList.toggle('sec-bg-empty', !f.dataset.bgImg));   // 프레임도 같은 정본(FRAME-BG-CHECKER-OPTIONS-01)
    /* ★T6 — 체커 톤이 dark 로 저장돼 있으면 섹션 «안» 글자 밝기를 다시 맞춘다(현빈 2026-10-07).
       ★여기가 두 호출 자리 중 하나다(다른 하나 = 토글 js/props/prop-section.js).
       ⛔클래스가 «살아 돌아온다»에 기대지 않는다 — 바로 위 주석이 같은 말을 한다. 다시 세운다. */
    syncSectionCheckerTextTone(sec);
    // 배경 이미지 복원
    if (sec.dataset.bgImg && !sec.style.backgroundImage) {
      sec.style.backgroundImage = `url(${sec.dataset.bgImg})`;
      sec.style.backgroundSize = sec.dataset.bgSize || 'cover';
      sec.style.backgroundPosition = sec.dataset.bgPos || 'center';
      sec.style.backgroundRepeat = 'no-repeat';
    }
    if (!sec._secClickBound) {
      sec._secClickBound = true;
      sec.addEventListener('click', e => {
        e.stopPropagation();
        window.selectSectionWithModifier(sec, e);
        const row = e.target.closest('.row');
        // row 빈 여백 클릭은 row-active 제외 — 섹션 선택만 (fix(section-select), 판정=editor.js isRowMarginClick)
        if (row && !window.isRowMarginClick?.(row, e) && !e.target.closest('.text-block, .asset-block, .gap-block, .col-placeholder, .icon-circle-block, .table-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .label-group-block, .icon-text-block, .canvas-block')) {
          document.querySelectorAll('.row.row-active').forEach(r => r.classList.remove('row-active'));
          row.classList.add('row-active');
          if (window.syncLayerRow) window.syncLayerRow(row);
        }
      });
    }
    bindSectionDelete(sec);
    bindSectionOrder(sec);
    bindSectionDropZone(sec);
    // bindSectionHitzone은 hz.cloneNode(true)로 label을 교체하므로
    // 반드시 bindSectionHitzone 이후에 bindSectionDrag를 호출해야 함 (FIX-SD-01)
    if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
    bindSectionDrag(sec);
    // ⎇ 버튼 없으면 추가, 있으면 onclick 재바인딩 (직렬화 시 프로퍼티가 유실되므로 항상 재설정)
    const toolbar = sec.querySelector('.section-toolbar');
    if (toolbar) {
      /* C21: 구버전 ↑↓✕ + 데드 ⎇(st-branch-btn) 일괄 제거 — 살릴 버튼만 보존
         (AB/memo/AI-fill ＋ ★🔒 보호).
         ★🔒 를 명부에 더한 까닭(2026-09-22 실측) — 이 줄이 st-protected-btn 까지 지웠다.
           rebindAll 은 restoreSnapshot(js/history.js:225)도 부르므로 «⌘Z 한 번»에 🔒 가
           사라졌고, 다시 심는 곳이 _hydrateAllSectionsForProtection(init ＋ +1500ms) 뿐이라
           «페이지를 다시 열기 전까지» 안 돌아왔다.
         ⛔보호 자체는 안 풀린다(dataset.protected 에 산다) — 사라지는 건 «표시»와
           «보호를 끄는 유일한 입구»다. 그래서 «안전한 방향»으로 틀리지만, 앱이
           「🔒 버튼으로 보호 해제 후 삭제하세요」(js/editor.js:3085)라고 «없는 버튼»을 가리킨다.
         ★«지웠다가 다시 심기»가 아니라 «안 지우기»를 골랐다 — 다시 심으면 툴바 DOM 이
           복원 때마다 또 바뀌어 T-136(섹션 툴바가 «내용»으로 읽히는 건)을 키운다. */
      toolbar.querySelectorAll('.st-btn:not(.st-ab-btn):not(.st-memo-btn):not(.st-ai-fill-btn):not(.st-protected-btn)').forEach(el => el.remove());
      // variation 툴바 버튼 복원
      if (window.bindVariationToolbarBtn) window.bindVariationToolbarBtn(sec);
      // 섹션 메모 버튼 복원 — sanitizeCanvasHtml이 on* 속성을 제거하므로 로드 후 onclick 재바인딩 필요
      // (없으면 버튼은 보이나 클릭 무반응 = 섹션 메모 패널 안 열림 회귀)
      if (window._ensureMemoButton) window._ensureMemoButton(sec);
      /* ★🔒 도 «같은 까닭»으로 다시 걸어야 한다 (T-139 ③, 2026-09-22 검수 실측).
         위 :not(.st-protected-btn) 은 단추가 «지워지지 않게»만 했다. 그런데 sanitizeCanvasHtml 은
         on* 을 걷어내므로, 페이지를 한 번만 옮겨도 🔒 가 «보이는데 죽은 단추»가 된다.
         실측(포트 9652): 새로고침 직후 onclick=YYnn → Page1 로 한 번 전환 → 모든 섹션이 Ynnn
           (protected 만 소실). 1·3·6초 기다려도 안 돌아옴.
           실클릭 짝대조 — 왕복한 섹션 🔒 팝오버 0개 / 같은 툴바 📝 는 열림 / 갓 만든 섹션 🔒 도 열림.
         ⛔피해가 «표시»가 아니다 — 🔒·is-on·data-protected 가 그대로 보이는데 눌러도 안 열려서
           **보호를 끌 방법이 없다**. 그리고 앱은 「🔒 버튼으로 보호 해제 후 삭제하세요」라고
           바로 그 죽은 단추를 가리킨다.
         ★2026-09-22 의 앞선 고침(5c15aa4)은 «만들 때»와 «hydrate»만 덮었다 —
           rebindAll 을 지나는 길(페이지 전환·복원)이 빠져 있었다. 반만 선 고침이었다.
         ⛔이 호출이 툴바 DOM 을 «더» 흔들지 않는다 — _ensureProtectionButton 은 자리가 이미
           맞으면 안 옮기고(요소 기준 비교), 하는 일은 걷힌 onclick 을 «되돌려 놓는» 것뿐이다.
           ⇒ 복원 뒤 DOM 이 복원 «전»에 더 가까워진다(T-136 을 키우지 않는다). */
      if (window._ensureProtectionButton) window._ensureProtectionButton(sec);
    }
  });
  // row ID 복원 + paddingX 복원
  canvasEl.querySelectorAll('.row').forEach(row => {
    if (!row.id) row.id = 'row_' + Math.random().toString(36).slice(2, 9);
    if (row.dataset.paddingX !== undefined && row.dataset.paddingX !== '') {
      row.style.paddingLeft  = row.dataset.paddingX + 'px';
      row.style.paddingRight = row.dataset.paddingX + 'px';
    }
  });

  // 저장 시 제거된 contenteditable 속성 복원 (텍스트 블록 내부 편집 가능 요소)
  // + placeholder 여부 판단 (data-is-placeholder가 없으면 내용과 비교해서 설정)
  const _phTextMap = {
    'tb-h1':'제목을 입력하세요', 'tb-h2':'소제목을 입력하세요', 'tb-h3':'소항목을 입력하세요',
    'tb-body':'본문 내용을 입력하세요.', 'tb-caption':'캡션을 입력하세요', 'tb-label':'Label',
    'tb-bullet':'항목을 입력하세요', 'tb-liner':'곡선 텍스트'
  };
  // 말풍선 SVG 말꼬리 마이그레이션 (구버전 저장 파일 대응)
  canvasEl.querySelectorAll('.speech-bubble-block').forEach(sb => {
    const tail = sb.dataset.tail || 'left';
    const correctSVG = window.getBubbleTailSVG ? window.getBubbleTailSVG(tail)
      : `<svg class="tb-bubble-tail" viewBox="0 0 18 16" xmlns="http://www.w3.org/2000/svg" width="18" height="16"><path d="M18 0 C14 4 7 8 0 16 C5 9 10 4 18 0Z"/></svg>`;
    const existingTail = sb.querySelector('.tb-bubble-tail');
    if (!existingTail) {
      sb.insertAdjacentHTML('beforeend', correctSVG);
    } else {
      // 이전 path 또는 center용 대칭 path가 필요한 경우 교체
      const p = existingTail.querySelector('path');
      const d = p?.getAttribute('d') || '';
      const needsUpdate = d.includes('10.78')
        || (tail === 'center' && !d.startsWith('M0 0'))
        || ((tail === 'left' || tail === 'right') && d.startsWith('M0 0 L18 0'));
      if (needsUpdate) {
        const tmp = document.createElement('div');
        tmp.innerHTML = correctSVG;
        existingTail.replaceWith(tmp.firstElementChild);
      }
    }
    // 구버전: --bubble-bg가 contentEl에 설정된 경우 → speech-bubble-block으로 이전
    const bubbleEl = sb.querySelector('.tb-bubble');
    if (bubbleEl) {
      const oldVar = bubbleEl.style.getPropertyValue('--bubble-bg');
      if (oldVar) {
        sb.style.setProperty('--bubble-bg', oldVar);
        bubbleEl.style.removeProperty('--bubble-bg');
      }
    }
  });

  /* ★아이콘+텍스트 — 바로 아래 `.text-block` 갈래가 이 블럭을 «못 잡는다».
     .icon-text-block 은 .text-block 이 아니고, 본문 칸도 `.itb-text`(접두사 itb-)라
     그 inner 목록에 없다. 스냅샷은 contenteditable 을 «전부» 떼므로
     (js/io/section-serialize.js «편집 상태 속성 제거») 이 블럭만 되붙임을 못 받고,
     그 칸을 읽는 쪽이 조용히 포기한다 — js/props/prop-text.js showTextProperties 는
     `[contenteditable]` 이 없으면 console.warn 뒤 return 한다.
     실측(2026-09-20 실앱 9505·줌 40%): 아이콘+텍스트를 넣고 ⌘Z 한 번 →
       .itb-text 의 contenteditable = null, 다시 클릭해도 우측 패널이 «안 열린다»
       (오버레이를 켠 뒤였다면 토글을 못 찾아 끄지도 못한다).
     ⚠️placeholder·bullet·blank 보정은 tb-* 전용 규약이라 여기로 «안» 베낀다
       (.itb-text 는 평문 한 칸이다). 여기서 되살리는 건 편집가능 표식 하나뿐이다.
     ⚠️이 되붙임을 지우면 tests/unit/icon-text-contenteditable-restore.test.mjs 가 잡는다. */
  canvasEl.querySelectorAll('.icon-text-block').forEach(itb => {
    const inner = itb.querySelector(':scope > .itb-text');
    if (inner && !inner.hasAttribute('contenteditable')) {
      inner.setAttribute('contenteditable', 'false');
    }
  });

  canvasEl.querySelectorAll('.text-block').forEach(tb => {
    const inner = tb.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bubble,.tb-bullet,.tb-liner');
    if (!inner) return;
    if (!inner.hasAttribute('contenteditable')) {
      inner.setAttribute('contenteditable', 'false');
    }
    // placeholder 속성 보정: data-placeholder 없으면 클래스로 추정
    if (!inner.dataset.placeholder) {
      const cls = [...inner.classList].find(c => _phTextMap[c]);
      if (cls) inner.dataset.placeholder = _phTextMap[cls];
    }
    // bullet 변형: <ul>이 비어있으면 빈 <li> 하나는 보장
    if (inner.classList.contains('tb-bullet')) {
      if (!inner.querySelector('li')) {
        inner.innerHTML = `<li>${inner.dataset.placeholder || ''}</li>`;
        inner.dataset.isPlaceholder = 'true';
      }
      return;
    }
    // 의도적 빈 줄(data-blank) 블록은 placeholder 복원/플래그 보정에서 제외 — 빈 상태 유지
    // (EMPTY) 로드 경로엔 런타임 Enter 신호가 없으므로 has-breaks 헬퍼로 승격하면
    // "전부삭제 leftover <br>"까지 빈줄로 오판해 회귀가 저장본에 고착된다.
    // → 이미 blur에서 박힌 data-blank='true'만 존중(U5 방식). 그 외 빈 블록은 placeholder 복원.
    let blank = inner.dataset.blank === 'true' || tb.dataset.blank === 'true';
    // data-is-placeholder 보정: 저장된 내용이 placeholder 텍스트와 같거나 비어있으면 placeholder 상태로 표시
    if (!blank && inner.dataset.isPlaceholder !== 'true') {
      const ph = inner.dataset.placeholder;
      const txt = inner.textContent.trim();
      if (ph && (txt === '' || txt === ph.trim())) {
        if (txt === '') inner.innerHTML = ph; // 비어있으면 placeholder 텍스트 복원
        inner.dataset.isPlaceholder = 'true';
      }
    } else if (!blank) {
      // C2/D2: 역방향 보정 — 플래그가 잘못 켜졌는데 실제 글자가 들어있으면 끈다
      // (block-drag.js:496 자가보정과 동일 기준). 라운드트립으로 잘못된 플래그를 자가치유해
      // 유형변경/직렬화 시 글자손실 재발을 막는다.
      const txt2 = inner.textContent.trim();
      const ph2 = inner.dataset.placeholder;
      if (txt2 !== '' && txt2 !== (ph2 || '').trim()) delete inner.dataset.isPlaceholder;
    }
  });

  // shape-block 구버전 인라인 width/height 제거 — CSS 100%로 frame 추종
  canvasEl.querySelectorAll('.shape-block').forEach(b => {
    b.style.width = '';
    b.style.height = '';
    const svg = b.querySelector('svg');
    if (svg) {
      svg.style.width = ''; svg.style.height = '';
      // preserveAspectRatio="none" — frame 크기에 맞게 SVG 변형
      svg.setAttribute('preserveAspectRatio', 'none');
    }
    // rectangle/ellipse: 구버전 4% 안전 inset(x=4 y=4 w=92 h=92) → stroke-기반 동적 inset으로 마이그레이션
    // refreshShapeInnerSVG가 strokeWidth=0이면 풀폭, >0이면 절반만 inset 적용
    window.refreshShapeInnerSVG?.(b);
    // shape frame inline height 제거 — frame-block 직속 shape-block, height는 frame-block이 관리
    const parentFrame = b.closest('.frame-block');
    if (parentFrame) parentFrame.style.height = parentFrame.dataset.height ? `${parentFrame.dataset.height}px` : '';
  });

  // ★프라이버시(2026-09-15): 모자이크 redact는 "캡처된 적 있는 이 런타임 인스턴스"만
  // 안전하다(isMosaicCaptured, WeakSet 기반 — 저장 HTML엔 비트맵이 안 담긴다). 즉 프로젝트를
  // 새로 열면(undo/redo 복원, 협업 수신 포함) 모든 모자이크 캔버스가 "한 번도 캡처 안 된"
  // 상태로 시작한다 — CSS 안전배경(#4a4a4a)이 1차 방어선이지만, 사용자가 실제 모자이크를
  // 보려면 어차피 첫 캡처가 필요하므로 그 노출/대기 창을 최소화하도록 여기서 즉시(사용자
  // 행동 없이) 일괄 캡처한다. captureMosaicSnapshot은 실패해도 조용히 무시 — 안전배경이
  // 계속 바닥을 지킨다.
  // ★0919 QA: 즉시 한 번으로 끝내지 않는다 — 이미지가 뜬 뒤 시도 + 실패 시 몇 번 물러나며 재시도(redact-mosaic.js).
  if (typeof window.captureMosaicsAfterLoad === 'function') {
    try { window.captureMosaicsAfterLoad(canvasEl); } catch (_) {}
  } else {
    canvasEl.querySelectorAll('.shape-block.shape-redact[data-shape-redact-mode="mosaic"]').forEach(b => {
      if (!window.isMosaicCaptured?.(b)) {
        try { window.captureMosaicSnapshot?.(b); } catch (_) {}
      }
    });
  }

  // ── annotation-block 복원 (펜툴 Phase 2: 폴리라인 + 스타일 props) ──
  canvasEl.querySelectorAll('.annotation-block').forEach(block => {
    if (!block.id) block.id = 'ant_' + Math.random().toString(36).slice(2, 9);
    /* ★1013t1A3-pre — props 는 annotPropsFromDataset «한 벌»로 읽는다(js/blocks/annotation-block.js).
       예전엔 여기서 손으로 열 줄을 읽으며 labelMode·이미지 셋·테두리 스타일/두께 여섯을 빠뜨려
       리로드·⌘Z 복원마다 라벨이 기본값으로 다시 그려졌다(대시 → solid 실측). */
    const props = window.annotPropsFromDataset(block);

    // 팩토리 결과를 그대로 사용 — innerHTML/dataset 통째 재구성
    const fresh = window.makeAnnotationBlock(props);
    block.innerHTML = fresh.innerHTML;
    // dataset 동기화 (id는 유지) — 팩토리가 쓴 키 전부(표는 annotation-block.js 한 곳)
    block.dataset.type = 'annotation';
    for (const k of window.ANNOT_DATA_KEYS) {
      if (fresh.dataset[k] !== undefined) block.dataset[k] = fresh.dataset[k];
    }

    block.style.position = 'absolute';
    block.style.left = '0'; block.style.top = '0';
    block.style.width = '100%'; block.style.height = '100%';
    // pointerEvents는 자식(label/handle)에서 개별 활성화 — 블록 자체는 통과
    block.style.pointerEvents = 'none';

    window.bindAnnotationSelect?.(block);
  });

  // sticker-block 복원 (플로팅 오버레이)
  canvasEl.querySelectorAll('.sticker-block').forEach(block => {
    if (!block.id) block.id = 'stk_' + Math.random().toString(36).slice(2, 8);
    rerenderBlock(block);   // ★CLONE-RERENDER-01 — 그리기는 한 벌(RERENDER_KINDS)에서
    window.bindStickerSelect?.(block);
  });

  // gradient-block 복원 (플로팅 오버레이, sticker 패턴)
  // legacy row > .gradient-block 구조는 migrateLegacyGradientBlocks가 섹션 직속으로 끌어올림
  window.migrateLegacyGradientBlocks?.(canvasEl);
  canvasEl.querySelectorAll('.gradient-block').forEach(block => {
    if (!block.id) block.id = 'grad_' + Math.random().toString(36).slice(2, 8);
    rerenderBlock(block);   // ★CLONE-RERENDER-01 — 그리기는 한 벌(RERENDER_KINDS)에서
    window.bindGradientSelect?.(block);
  });

  canvasEl.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .card-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .modal-block, .icon-text-block, .shape-block, .joker-block, .canvas-block, .banner02-block, .comparison-block, .icon-block, .mockup-block, .step-block, .vector-block, .chat-block, .laurel-block, .zoom-block, .qa-block, .coupon-block, .quote-block, .radial-block').forEach(b => { // bind-list:REBIND_ALL
    if (!b.id) {
      const prefix = b.classList.contains('text-block') ? 'tb'
        : b.classList.contains('asset-block') ? 'ab'
        : b.classList.contains('gap-block') ? 'gb'
        : b.classList.contains('icon-circle-block') ? 'icb'
        : b.classList.contains('label-group-block') ? 'lg'
        : b.classList.contains('canvas-block') ? 'cvb'
        : b.classList.contains('banner02-block') ? 'bn2'
        : b.classList.contains('comparison-block') ? 'cmp'
        : b.classList.contains('graph-block') ? 'grb'
        : b.classList.contains('icon-text-block') ? 'itb'
        : b.classList.contains('icon-block') ? 'icn'
        : b.classList.contains('mockup-block') ? 'mkp'
        : b.classList.contains('step-block') ? 'stb'
        : b.classList.contains('vector-block') ? 'vb'
        : b.classList.contains('chat-block') ? 'chb'
        : b.classList.contains('laurel-block') ? 'lrb'
        : b.classList.contains('zoom-block') ? 'zmb'
        : b.classList.contains('divider-block') ? 'dvd'
        : b.classList.contains('bridge-block') ? 'brg'
        : b.classList.contains('grid-block') ? 'grd'   /* ★'grid' 아니다 — GRID_ID_PREFIXES=['grd_','duo_'] 와 같은 토큰이어야 한다(적대검수 C1) */
        : b.classList.contains('infocard-block') ? 'ifc'
        : b.classList.contains('innercard-block') ? 'icd'
        : b.classList.contains('coupon-block') ? 'cpn'   /* ★쿠폰 — genId('cpn') 과 ★같은 토큰이어야 한다(js/blocks/coupon-block.js) */
        : b.classList.contains('radial-block') ? 'rdl'  /* 프로토 Z6-A — genId('rdl') 과 같은 토큰(js/blocks/radial-block.js) */
        : b.classList.contains('quote-block') ? 'qt'     /* ★인용구 — genId('qt') 과 ★같은 토큰이어야 한다(js/blocks/quote-block.js) */
        : b.classList.contains('qa-block') ? 'qa' : 'tbl';
      b.id = prefix + '_' + Math.random().toString(36).slice(2, 9);
    }
    /* ★CLONE-RERENDER-01 — 종류별 다시 그리기는 한 벌(위 RERENDER_KINDS)로 옮겼다(laurel · coupon · quote · radial ·
       graph(방사형만) · zoom · bridge(+full-bleed) · grid · infocard · innercard · modal · chat · speech-bubble(lines 있을 때만) ·
       banner02 · comparison · canvas · qa · step). ⛔여기 if 줄을 다시 적지 마라 — 두 번 그려진다.
       ★step 은 예전엔 아래 «step-block 로드 후» 구간에서 따로 그렸다 — 이제 여기서 한 번(그 구간은 지웠다). */
    rerenderBlock(b);
    window.bindBlock(b);
  });

  // group-block 라벨 복원
  canvasEl.querySelectorAll('.group-block').forEach(g => {
    if (!g.querySelector(':scope > .group-block-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'group-block-label';
      lbl.textContent = g.dataset.name || 'Group';
      g.prepend(lbl);
    }
    bindGroupDrag(g);
  });
  // frame-block 클릭/드롭 핸들러 재연결 (저장/로드 후 누락 방지)
  canvasEl.querySelectorAll('.frame-block').forEach(ss => {
    if (!ss.id) ss.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    ss._subSecBound = false; // rebind 강제
    window.bindFrameDropZone?.(ss);
    // 배경 이미지 복원
    if (ss.dataset.bgImg && !ss.style.backgroundImage) {
      ss.style.backgroundImage = `url(${ss.dataset.bgImg})`;
      ss.style.backgroundSize = frameBgSize(ss);   /* ★2026-10-10 ③ — ★:1161(섹션)은 dataset 을 읽는데 ★여기만 상수였다 */
      ss.style.backgroundPosition = ss.dataset.bgPos || 'center';
    } else if (ss.dataset.bgPos && ss.style.backgroundImage) {
      ss.style.backgroundPosition = ss.dataset.bgPos;
    }
    // 보더 복원
    const bw = parseInt(ss.dataset.borderWidth) || 0;
    if (bw > 0) {
      ss.style.border = `${bw}px ${ss.dataset.borderStyle || 'solid'} ${ss.dataset.borderColor || '#888888'}`;
    }
    // 배경색 복원
    if (ss.dataset.bg && !ss.style.backgroundColor) ss.style.backgroundColor = ss.dataset.bg;
    // 배경 투명도(bgOpacity) 복원 (I2) — 위 배경색/이미지 복원 직후 분기.
    // has-bg-opacity면 본체 배경을 비우고 ::before용 CSS변수로만 그린다.
    if (ss.dataset.bgOpacity !== undefined) {
      // I2-F3: invalid 저장본(NaN/범위초과) 클램프 후 사용.
      let o = parseFloat(ss.dataset.bgOpacity);
      if (!Number.isFinite(o) || o < 0 || o > 1) o = 1;
      ss.style.setProperty('--frame-bg-opacity', String(o));
      const active = o < 1;
      ss.classList.toggle('has-bg-opacity', active);
      /* ★★2026-10-10 (현빈 ③) — ★이 몸통이 ★★세 벌 중 ★셋째였다(prop-frame · block-factory · 여기).
         ★★셋 다 ★«크기»를 ★안 보냈다 ⇒ ★저장본을 ★다시 열면 ★크기가 ★언제나 ★cover 로 ★돌아갔다.
         ⇒ ★공용 한 자리에 ★위임한다(파일명은 수입 줄). ★★클래스 토글은 ★이 자리 몫으로 ★남긴다 —
           ★공용 함수는 ★★«has-bg-opacity 가 ★이미 붙은» 프레임만 ★먹인다(그 전제를 ★스스로 검사한다). */
      if (active) syncFrameBgVars(ss);
    }
    // 코너 반경 복원
    if (ss.dataset.radius) ss.style.borderRadius = ss.dataset.radius + 'px';
    // explicit height 복원 — justify-content 정렬 작동을 위해 필요
    // dataset.height 없으면 minHeight 폴백 (레거시 요소 대응)
    // ★0919 QA: ⌘G(wrapSelectedBlocksInFrame)가 style 높이만 쓰고 makeFrameBlock 기본값 dataset.height='520' 을
    //   남기던 저장본 치유 — 기본값 '520' 인데 저장된 style 높이가 다르면 style 이 진짜(다른 크기 변경 경로는 둘 다 쓴다).
    if (ss.dataset.height === '520') {
      const _styleH = parseInt(ss.style.height);
      if (_styleH > 0 && _styleH !== 520 && /px$/.test(ss.style.height)) ss.dataset.height = String(_styleH);
    }
    const _ssH = parseInt(ss.dataset.height) || parseInt(ss.style.minHeight) || 0;
    if (_ssH) ss.style.height = _ssH + 'px';
    /* ★도형 프레임은 minHeight 도 «세트로» 복원한다 (2026-09-21 최종통합 QA medium ③ 후속)
       .frame-block 엔 CSS 바닥이 있다 — css/editor-blocks.css `.frame-block { min-height: 60px }`.
       위 줄은 height 만 되돌려서, 60 아래로 줄여 둔 도형을 다시 열면 style.height 는 30 인데
       화면은 60 이 된다(패널 H 칸 = 30, 실제 = 60). 새로 고친 회전 경로가 다시 그런 저장본을
       만들지는 않지만, ⛔이미 저장된 프로젝트는 그 상태 그대로 남아 있다 — 여는 순간 치유한다.
       사정거리 = «도형을 품은 프레임»만. 보통 프레임(하위 섹션)의 60px 바닥은 그대로 둔다
       (거긴 addShapeBlock 의 min-height 계약이 없고, 바닥이 의도다).
       같은 «세트 규약»의 다른 자리 — js/block-drag.js _onShapeHandleMouseDown ·
       js/overlay-handles.js _onFrameHandleMouseDown · js/props/prop-shape.js applySize·_relockFrameMinHeight.
       회귀: tests/dom/shape-rotate-minheight.dom.spec.js L* */
    if (_ssH && ss.querySelector(':scope > .shape-block')) ss.style.minHeight = _ssH + 'px';
    // 자식 정렬 복원 (frame-block 직속)
    if (ss.dataset.alignItems)     ss.style.alignItems     = ss.dataset.alignItems;
    if (ss.dataset.justifyContent) ss.style.justifyContent = ss.dataset.justifyContent;
    if (ss.dataset.gap)            ss.style.gap            = ss.dataset.gap + 'px';
    // 위치 / 회전 / 반전 복원
    // SSOT = js/frame-geometry.js. identity:'skip'(기본) = «이 경로의 기존 규약»
    // — 항등이면 아무것도 안 한다(저장본의 transform 잔재를 건드리면 스태킹 컨텍스트가 바뀐다).
    // 회전 AABB 세로 마진 보정은 여기서 재계산된다(회전 0 프레임엔 no-op → outerHTML 무변경).
    applyFrameTransform(ss);
  });

  // table-block 로드 후 dataset 복원 (showHeader, cellAlign, fontSize, cellPad, rowH, outerWidth)
  canvasEl.querySelectorAll('.table-block').forEach(block => {
    const thead = block.querySelector('thead');
    if (block.dataset.showHeader === 'false' && thead) {
      thead.style.display = 'none';
    }
    const cellAlign = block.dataset.cellAlign;
    if (cellAlign) {
      block.querySelectorAll('th, td').forEach(cell => { cell.style.textAlign = cellAlign; });
    }
    const fontSize = parseInt(block.dataset.fontSize);
    if (fontSize) {
      const table = block.querySelector('.tb-table');
      if (table) table.style.fontSize = fontSize + 'px';
    }
    // 헤더 전용 글자크기 복원 (CSS variable, 0/미설정 = 본문 상속)
    const headerSize = parseInt(block.dataset.headerSize);
    if (headerSize > 0) {
      block.style.setProperty('--tbl-header-size', headerSize + 'px');
    }
    const cellPad = parseInt(block.dataset.cellPad);
    if (!isNaN(cellPad)) {
      block.querySelectorAll('th, td').forEach(cell => { cell.style.padding = cellPad + 'px 16px'; });
    }
    // 행 높이 복원
    const rowH = parseInt(block.dataset.rowH);
    if (rowH > 0) {
      block.querySelectorAll('tr').forEach(tr => { tr.style.height = rowH + 'px'; });
    }
    // 외곽선 두께 복원 (CSS variable)
    const outerW = parseInt(block.dataset.outerWidth);
    if (outerW > 0) {
      block.style.setProperty('--tbl-outer-w', outerW + 'px');
    }
    // 테이블 좌우 패딩 복원
    const tablePadX = parseInt(block.dataset.tablePadX);
    if (!isNaN(tablePadX) && tablePadX > 0) {
      block.style.paddingLeft  = tablePadX + 'px';
      block.style.paddingRight = tablePadX + 'px';
    }
    // 선 색 / 헤더 배경색 / 글자색 / 폰트 복원 (CSS variable)
    if (block.dataset.lineColor) {
      block.style.setProperty('--tbl-line-color', block.dataset.lineColor);
    }
    if (block.dataset.headerBg) {
      block.style.setProperty('--tbl-header-bg', block.dataset.headerBg);
    }
    if (block.dataset.textColor) {
      block.style.setProperty('--tbl-text-color', block.dataset.textColor);
    }
    if (block.dataset.fontFamily) {
      block.style.setProperty('--tbl-font-family', block.dataset.fontFamily);
    }
    // showVLines / showHLines / showOuterX / showOuterY 는 CSS attribute selector로 자동 적용 (별도 처리 불필요)
  });

  // mockup-block 로드 후 화면 이미지 복원
  canvasEl.querySelectorAll('.mockup-block').forEach(block => {
    const imgSrc = block.dataset.imgSrc;
    if (imgSrc) {
      const screen = block.querySelector('.mkp-screen');
      if (screen) {
        screen.style.background = `url('${imgSrc}') top center / cover no-repeat, ${checkerBg('big')}`;
        screen.innerHTML = '';
      }
    }
    // 그림자 복원
    const shadow = block.dataset.shadow || 'soft';
    const shadows = { none:'none', soft:'0 20px 60px rgba(0,0,0,0.25)', strong:'0 30px 80px rgba(0,0,0,0.55)' };
    block.style.filter = shadow === 'none' ? '' : `drop-shadow(${shadows[shadow]})`;
    // 숨겨진 소스 섹션 복원
    const secId = block.dataset.sourceSec;
    if (secId) {
      const sec = document.getElementById(secId);
      if (sec && sec.dataset.mockupHidden === 'true') sec.style.display = 'none';
    }
    // 가로 중앙정렬 재계산 (콘텐츠폭 초과 시 대칭 블리드 음수마진 재적용)
    window.centerMockupBlock?.(block);
  });

  // step-block 재렌더링은 위 블럭 구간의 rerenderBlock 이 한다(★CLONE-RERENDER-01 — 여기 따로 부르면 두 번 그려진다).

  // 가로 중앙정렬 지연 재계산 — 로드 직후엔 canvas-scaler/zoom 레이아웃이
  // 아직 확정 안 돼 parent.clientWidth가 잘못 측정될 수 있음(저장된 stale 음수마진
  // 유지 버그). 레이아웃 settle 후 1프레임 뒤 다시 한 번 재계산해 보정한다.
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      canvasEl.querySelectorAll('.mockup-block').forEach(block => {
        window.centerMockupBlock?.(block);
      });
    });
  }

  /* ★★★2026-10-24 — ★효과 ★명부를 ★★여기서 ★부른다(★`watchAllFx`).
     ★★★왜(★실측 · ★★현빈 신고 「★자유변형 ★손잡이가 ★안 ★뜬다」의 ★★참 ★까닭):
       ★`js/effects-registry.js:136` 이 ★★`window.addEventListener('load', …)` ★한 번만 ★부른다.
       ★★★그런데 ★프로젝트 ★복원은 ★그 `load` ★★«뒤»에 ★비동기로 ★온다
       ⇒ ★★그때 ★캔버스는 ★★비어 ★있고 ★★★`watchAllFx` 가 ★★0 건을 ★돌고 ★끝난다.
       ★★앱에서 ★잰 값(261024 · ★9401) : ★`selected: true` · `data-tf-corners` ★있음 ·
         ★★그런데 ★`ftStateOf(tb)` = ★★`null` · ★손잡이 ★★0 · `.tfh-fx` ★★0
         ⇒ ★★손으로 ★`watchAllFxFreeTransform(document)` 를 ★부르니 ★★`ret 1` ·
           ★상태 ★OK · ★손잡이 ★★12 · fx ★1 ⇒ ★★★코드는 ★맞고 ★★«부르는 자»가 ★없었다.
     ★★여기가 ★자리인 까닭 : ★`rebindAll` 은 ★★복원의 ★★정본 한 자리다 —
       ★페이지 ★열기(:553) · ★페이지 ★전환(:605) · ★undo/redo(:751) ★★전부 ★이것을 ★지난다.
     ⛔import 하지 않는다(★이 파일은 ★io 층) — ★`window.X?.()` 관용구.
     ★재는 자 = `tests/dom/text-ft-handles-u3.dom.spec.js` ★H7 */
  window.watchAllFx?.(canvasEl || document);
}

const LAST_COMMIT_KEY = 'goya-last-commit';

/* ── localStorage 용량 관리 ── */

/**
 * 활성 프로젝트 ID 목록에 없는 고아 autosave 키 정리.
 * 삭제된 프로젝트 또는 파일이 더 최신인 프로젝트의 autosave 키를 제거한다.
 * @param {string[]} activeProjectIds - 현재 존재하는 프로젝트 ID 배열
 */
function cleanStaleAutosaveKeys(activeProjectIds) {
  const prefix = SAVE_KEY_PREFIX + '__';
  const activeSet = new Set(activeProjectIds);
  Object.keys(localStorage)
    .filter(k => k.startsWith(prefix) && !k.endsWith('_ts'))
    .forEach(k => {
      const pid = k.slice(prefix.length);
      if (!activeSet.has(pid)) {
        localStorage.removeItem(k);
        localStorage.removeItem(k + '_ts');
        localStorage.removeItem('web-editor-ls-root__' + pid);
        console.log('[save-load] 고아 autosave 키 정리:', k);
      }
    });
  /* 옛 파일 복원 뒤 못 남긴 보류 본 — 남김 목록 밖(지운 프로젝트 등)의 것만 걷는다. 안 걷으면 영구 삭제한 프로젝트 본이 공간을 영영 잡는다(리뷰 2-4). */
  Object.keys(localStorage).filter(k => k.startsWith(LS_PENDING_PREFIX)).forEach(k => {
    if (!activeSet.has(k.slice(LS_PENDING_PREFIX.length).replace(/__\d+$/, ''))) localStorage.removeItem(k);
  });
}

/**
 * localStorage.setItem 래퍼 — QuotaExceededError 발생 시 오래된 autosave 키를
 * 하나씩 제거하며 최대 5회 재시도한다.
 * @param {string} key
 * @param {string} value
 * @returns {boolean} 저장 성공 여부
 */
const LS_SNAPSHOT_MAX = 2 * 1024 * 1024;
/* 2MB 넘는 본은 파일 저장 결과를 보고 정한다. 저장 전에 앞 본을 지우면 저장 실패 + 충돌에 복구길이 없었다(앱 3/3).
   BUG-44(낡은 본이 파일을 덮음): 성공하면 지운다. 그 사이의 앞 본은 파일보다 낡아 열 때 못 이긴다(_pickLsOverFile).
   실패 때만 큰 본을 쓴다 — 평소 수십MB 쓰기가 BUG-44 때 뺀 쿼터 반복이라서. 넘치면 파일에 든 본만 비키고, 그래도 안 들어가면 앞 본을 두고 말한다.
   실패면 작은 본도 쓴다 — 탭을 닫는 저장은 자동저장을 안 거쳐 LS 가 낡고 캐시도 없어, 다시 열면 옛 판이 멀쩡히 열렸다(앱 재현). */
function _settleBigLs(id, snap, failed, lsTsAtStart) {
  if (!IS_ELECTRON || !id || typeof snap !== 'string' || (!failed && snap.length <= LS_SNAPSHOT_MAX)) return;
  const key = `${SAVE_KEY_PREFIX}__${id}`;
  try {
    if (localStorage.getItem(key + '_ts') !== lsTsAtStart) return;   // 저장 도는 중 더 새 본이 들어왔다(사진 지우기 등으로 작아진 경우) — 그 본이 답이다
    if (!failed) { localStorage.removeItem(key); localStorage.removeItem(key + '_ts'); return; }
    for (;;) {
      try { localStorage.setItem(key, snap); localStorage.setItem(key + '_ts', String(Date.now())); return; }
      catch (e) {
        if (e.name !== 'QuotaExceededError' && e.name !== 'NS_ERROR_DOM_QUOTA_REACHED') throw e;
        if (_evictFiledLs(key)) continue;
        /* 남은 것이 다른 프로젝트 복구본뿐 — 그 편집을 지워 이 편집을 살리지 않는다. 앱이 죽으면 이번 편집은 잃으니 지금 말한다(L3 12/27). */
        window.showToast?.('⚠️ 복구본을 남길 공간이 없습니다 — 저장이 막힌 채 앱이 죽으면 이번 편집을 잃습니다. 다른 프로젝트의 복구본은 지우지 않았습니다.');
        return;
      }
    }
  } catch (e) { console.warn('[save-load] 큰 복구본 못 씀, 앞 본 유지:', e && e.name); }
}
/* 이 _ts 까지의 본은 파일에 들어갔다 — 축출이 복구본으로 치지 않게. 표시(base)는 «연 파일의 판»이라 저장해도 안 바뀌어, 평소 편집한 본이 전부 복구본으로 읽혔다(리뷰). */
const _lsTsOf = (id) => (id ? localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}_ts`) : null);
const _lsFiledKey = (id) => `web-editor-ls-filed__${id}`;
function _markLsFiled(id, ts) {
  if (!IS_ELECTRON || !id || !ts || localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}_ts`) !== ts) return;
  try { localStorage.setItem(_lsFiledKey(id), ts); } catch (_) {}
}
/* 쿼터가 찼을 때 하나 지운다 — 파일에 든 본부터, 그 안에서 오래된 것부터. 파일에 안 든 본은 다른 프로젝트의 하나뿐인 복구본이라 안 지운다(앱 3/3: 잃고도 지금 본이 안 들어갔다). 표시 없는 옛 본은 든 것으로 친다. */
function _evictFiledLs(keepKey) {
  const prefix = SAVE_KEY_PREFIX + '__';
  const candidates = Object.keys(localStorage).filter(k => k.startsWith(prefix) && !k.endsWith('_ts') && k !== keepKey);
  const _tsOf = (k) => parseInt(localStorage.getItem(k + '_ts') || '0');
  /* 0 파일에 든 본 · 1 표시 없는 옛 본 · 2 복구본(안 지운다). 옛 본은 들었는지 몰라 든 본 다음에 비킨다 — 아예 안 지우면 옛 본으로 꽉 찬 LS 를 영영 못 푼다. */
  const _rank = (k) => {
    const _id = k.slice(prefix.length); const base = localStorage.getItem(_lsBaseKey(_id));
    if (_tsOf(k) <= Number(localStorage.getItem(_lsFiledKey(_id)))) return 0;
    if (!base) return 1;
    return _tsOf(k) > (Number(base) || Date.parse(base)) ? 2 : 0;
  };
  const oldest = candidates.sort((a, b) => (_rank(a) - _rank(b)) || (_tsOf(a) - _tsOf(b)))[0];
  if (!oldest || _rank(oldest) === 2) { console.warn('[save-load] QuotaExceededError: 지울 수 있는 본이 없다'); return null; }
  localStorage.removeItem(oldest);
  localStorage.removeItem(oldest + '_ts');
  localStorage.removeItem(_lsFiledKey(oldest.slice(prefix.length)));
  return oldest;
}
function safeLocalStorageSet(key, value) {
  // Electron에서 대용량 스냅샷(2MB↑)은 파일로 이미 저장되므로 localStorage 생략
  // (base64 이미지 포함 시 수십MB까지 커져 QuotaExceededError 반복 유발)
  if (IS_ELECTRON && value && value.length > LS_SNAPSHOT_MAX) {
    console.log('[save-load] 스냅샷 크기 초과, localStorage 건너뜀:', Math.round(value.length / 1024) + 'KB');
    return false; // localStorage에 새 데이터 없음 → caller가 lsTs 갱신하지 않도록 false 반환 · 앞 본 처리는 _settleBigLs
  }
  const prefix = SAVE_KEY_PREFIX + '__';
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      if (e.name !== 'QuotaExceededError' && e.name !== 'NS_ERROR_DOM_QUOTA_REACHED') throw e;
      const oldest = _evictFiledLs(key);
      if (!oldest) {
        window.showToast?.('⚠️ 저장 공간이 부족합니다. 오래된 프로젝트를 삭제해 주세요.');
        return false;
      }
      console.warn('[save-load] QuotaExceededError: 오래된 autosave 키 삭제 후 재시도 -', oldest);
      window.showToast?.('⚠️ 저장 공간이 부족해 오래된 자동저장을 정리했습니다.');
    }
  }
  return false;
}

/* ★E169(2026-10-06 lane-drag · 지디) 손상 복구 알림 글 — «백업이 있었나»가 아니라 «디스크 파일을 고쳤나»(_healed)로 고른다.
   옛 글 하나(«…복구했습니다»)는 자가치유가 실패해 디스크에 성한 판이 없을 때도 떠서 사용자를 안심시켰다(실앱 ro 판).
   ⛔«무엇을 하라» 조언은 안 붙인다(디스크 비우기가 유일한 길이라는 증거 없음). 시험: tests/unit/recovery-heal-toast-e169.test.js */
function _recoveryToastText(proj) {
  const base = proj._recovered === 'history' ? '히스토리'
             : proj._recovered === 'pre-externalize' ? '변환 전 원본(오래된 상태일 수 있음)'
             : '백업';
  // ★E168·E170 ㉢ — 무엇이 남았는지 말한다: 그 판의 저장 시각(그 파일 mtime). 글자는 main _savedAtLabel 이 «한 곳»에서 만든다 — 여기는 싣기만.
  //   꼴: «동사 뒤 괄호» — 카드 배지(pages/projects.html)와 같은 꼴. 없으면 괄호만 빠진다.
  const when = proj._recoveredAtLabel ? ` (${proj._recoveredAtLabel} 저장분)` : '';
  if (proj._healed !== false) return `⚠️ 프로젝트 파일이 손상되어 ${base}에서 복구했습니다${when} — 그 뒤 작업은 없을 수 있습니다`;
  const code = proj._healError;
  const why = code === 'ENOSPC' ? '공간 부족' : (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') ? '권한' : (code || '알 수 없음');
  return `⚠️ 프로젝트 파일이 손상되어 ${base}에서 열었습니다${when}. 디스크의 파일은 아직 고치지 못했습니다(${why}) — 이대로는 저장이 안 될 수 있습니다.`;
}

/* 열 때 localStorage 본을 파일 대신 쓸지 — 부팅과 탭 첫 로드가 같은 판정을 탄다. 쓸 본 또는 null. 시험: tests/dom/ls-file-base.dom.spec.js */
function _pickLsOverFile(proj, id, { unmarkedWins = true } = {}) {
  const lsTs = parseInt(localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}_ts`) || '0');
  const fileTs = new Date(proj.updatedAt || 0).getTime();
  const filePagesCount = proj.version === 2 ? (proj.pages?.length || 0) : (proj.snapshot?.pages?.length || 1);
  // 파일의 섹션 수 합계 — LS가 더 적으면 LS를 신뢰하지 않음 (DBG-SEC-LOSS)
  const _countSecs = (d) => {
    if (!d) return 0;
    if (d.version === 2 && Array.isArray(d.pages)) {
      return d.pages.reduce((s, p) => s + ((p.canvas || '').match(/section-block/g)?.length || 0), 0);
    }
    return ((d.canvas || '').match(/section-block/g)?.length || 0);
  };
  const fileSecCount = _countSecs(proj.version === 2 ? proj : (proj.snapshot || proj));
  // BUG-44: 이미지(asset/card)에 적용된 dataURL/파일경로 개수 — LS에 누락되면 파일 우선
  const _countImgs = (d) => {
    if (!d) return 0;
    if (d.version === 2 && Array.isArray(d.pages)) {
      return d.pages.reduce((s, p) => s + ((p.canvas || '').match(/data-img-src/g)?.length || 0), 0);
    }
    return ((d.canvas || '').match(/data-img-src/g)?.length || 0);
  };
  const fileImgCount = _countImgs(proj.version === 2 ? proj : (proj.snapshot || proj));
  /* 표시 없는 옛 본: 부팅은 옛 규칙 · 탭은 파일(unmarkedWins:false — 복원한 파일을 이기면 안 되고, 탭은 원래 파일을 읽었다).
     깨진 파일 대신 읽은 백업은 판이 다른 게 당연하다. updatedAt 없는 파일은 비교할 판이 없다. */
  const lsBase = localStorage.getItem(_lsBaseKey(id));
  const lsFromThisFile = _lastOpenFallback === id || (lsBase ? (proj.updatedAt == null || lsBase === String(proj.updatedAt)) : unmarkedWins);
  /* ★LS-NEWER-THAN-FILE-DELETED-ON-OLD-FILE-RESTORE-01 — 파일이 이 본의 바탕 판(lsBase)보다 «옛것» 이면 사용자가 옛 판을 되돌려 놓은 것이다.
     그 뒤의 LS 편집을 말없이 걷지 않는다: 비상 사본(다음 실행 복구 제안)으로 먼저 남기고, 남겨졌을 때만 걷고 표지를 옮긴다(되돌린 파일이 이긴다 — 지금과 같다).
     못 남기면 본·표지를 그대로 두고 알린다 — 다음 열기에 다시 한다. 파일이 새것이거나 시각을 못 믿으면(없음·꼴 아님) 지금 동작. */
  let _keepForCopy = false;
  /* 사본을 못 남긴 본 — 자동저장이 안 쓰는 자리(본마다 시각을 붙인 키)에 두고 다음 열기에 다시 남긴다(리뷰 1-2 · 2-2 덮어쓰기 막음). */
  const _pendPrefix = `${LS_PENDING_PREFIX}${id}__`;
  const _record = (data, name) => Promise.resolve().then(() => window.electronAPI.recordRefusedSave({ ...data, id, name: name || data.name || 'Untitled' }, 'ls_newer_than_file'));
  if (window.electronAPI?.recordRefusedSave) {
    for (const k of Object.keys(localStorage).filter(k => k.startsWith(_pendPrefix))) {
      const _p = localStorage.getItem(k);
      let _pd = null; try { _pd = JSON.parse(_p); } catch (_) {}
      if (_pd && Array.isArray(_pd.pages)) _record(_pd, proj.name).then((r) => { if (r?.ok && localStorage.getItem(k) === _p) localStorage.removeItem(k); }, () => {});
    }
  }
  if (lsBase && !lsFromThisFile) {
    const _raw = localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}`);
    const _baseMs = Date.parse(lsBase), _fileMs = proj.updatedAt == null ? NaN : Date.parse(proj.updatedAt);
    let _data = null;
    if (_raw && isFinite(_baseMs) && isFinite(_fileMs) && _fileMs < _baseMs && window.electronAPI?.recordRefusedSave) { try { _data = JSON.parse(_raw); } catch (_) {} }
    if (_data && Array.isArray(_data.pages)) {
      _keepForCopy = true;
      applyAdoptedAssets(_data, id);
      const _fileVer = String(proj.updatedAt);
      const _K = `${SAVE_KEY_PREFIX}__${id}`;
      const _settle = (ok) => {
        if (!ok) {   // 본은 이제 메모리에만 — 다른 판정보다 먼저 보류 자리에(그사이 편집·저장이 끼어도 잃지 않게 · 리뷰 2-1)
          const _same = localStorage.getItem(_K) === _raw, _ts = localStorage.getItem(_K + '_ts');
          if (_same) { localStorage.removeItem(_K); localStorage.removeItem(_K + '_ts'); }   // 같은 크기를 한 번 더 쓰기 전에 자리를 비운다(리뷰 2-6)
          try { localStorage.setItem(_pendPrefix + Date.now(), JSON.stringify(_data)); }
          catch (_) {
            if (_same) { try { localStorage.setItem(_K, _raw); if (_ts) localStorage.setItem(_K + '_ts', _ts); } catch (_) {} }
            window.showToast?.('⚠️ 저장 실패: 되돌려 놓은 파일보다 새 편집을 남기지 못했습니다 — 이 프로젝트를 편집하기 전에 디스크 공간을 확인해 주세요');
            return;
          }
        }
        /* 그사이 저장이 표지를 새 판으로 옮겼으면 손대지 않는다 — 낡은 판으로 되돌리면 다음 열기 판정이 어긋나 LS 를 말없이 걷었다(리뷰 1-1).
           표지가 이미 이 파일 판이면(부팅 이전 저장 등) 끝맺는다 — 안 그러면 남은 본이 다음 열기에 되돌린 파일을 이긴다(리뷰 2-3). */
        const _cur = localStorage.getItem(_lsBaseKey(id));
        if (_cur === lsBase || _cur === _fileVer) {
          if (ok && localStorage.getItem(_K) === _raw) { localStorage.removeItem(_K); localStorage.removeItem(_K + '_ts'); }
          try { localStorage.setItem(_lsBaseKey(id), _fileVer); } catch (_) {}   // 본이 바뀌었으면 그 본은 이 파일에서 이어진 것(리뷰 1-4)
        }
        if (!ok) window.showToast?.('⚠️ 저장 실패: 되돌려 놓은 파일보다 새 편집을 비상 사본으로 남기지 못했습니다 — 다음에 열 때 다시 남깁니다');
      };
      _record(_data, proj.name).then((r) => _settle(!!r?.ok), () => _settle(false));
    } else {   // 걷는다 — 남기면 표시가 이 파일을 따라간 뒤 다음 열기에 이 본이 이긴다(앱: 복원 → 저장 없이 끝 → 다시 열기 3/3)
      localStorage.removeItem(`${SAVE_KEY_PREFIX}__${id}`);
      localStorage.removeItem(`${SAVE_KEY_PREFIX}__${id}_ts`);
    }
  }
  /* 탭이 거절한 표시 없는 본이 남아 있으면 표시를 옮기지 않는다 — 옮기면 그 옛 본이 다음 열기에 자격을 얻는다.
     사본으로 남기는 중인 본도 옮기지 않는다 — 옮기면 사본이 못 남았을 때 다음 열기에 그 본이 되돌린 파일을 덮는다. */
  if (!_keepForCopy && proj.updatedAt != null && (lsBase || unmarkedWins || !localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}`))) { try { localStorage.setItem(_lsBaseKey(id), String(proj.updatedAt)); } catch (_) {} }   // 쿼터 초과가 부팅을 끊어 빈 캔버스로 열렸다(앱 3/3)
  /* 파일보다 «새로운» 본만 이긴다 — 옛 500ms 여유는 탭·홈으로 나간 저장(파일만 씀)보다 20ms 낡은 본을 이기게 해 그 편집을 덮었다(앱 3/3).
     평소 저장은 localStorage 를 먼저 써 본이 늘 조금 낡으니 파일이 이긴다(내용이 같다). 충돌이면 본이 더 새롭다. */
  if (lsTs > fileTs && lsFromThisFile) {
    const lsSaved = localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}`);
    if (lsSaved) {
      try {
        const lsData = JSON.parse(lsSaved);
        const lsPagesCount = lsData.pages?.length || 0;
        const lsSecCount   = _countSecs(lsData);
        const lsImgCount   = _countImgs(lsData);
        // localStorage 페이지/섹션/이미지 수가 파일보다 적으면 파일이 더 완전한 데이터 → 파일 우선
        // (이전엔 페이지 수만 비교 — 섹션/이미지 통째 누락된 LS가 파일을 덮어쓰는 버그가 있었음)
        if (lsPagesCount > 0 && lsPagesCount >= filePagesCount && lsSecCount >= fileSecCount && lsImgCount >= fileImgCount) {
          /* 파일에만 있는 갤러리 항목을 잃지 않는다 — 다른 탭에 있는 동안의 AI 생성이 updatedAt 을 안 올리고 파일에 적재한다(ai-image-gen _appendGalleryToProject).
             거기서 updatedAt 을 올리면 저장 실패 중이던 이 본이 파일에 져서 편집을 잃는다(앱 3/3). */
          if (Array.isArray(proj.imageGallery)) {
            const _lsGal = Array.isArray(lsData.imageGallery) ? lsData.imageGallery : [];
            const _ids = new Set(_lsGal.map(it => it && it.id));
            lsData.imageGallery = [..._lsGal, ...proj.imageGallery.filter(it => it && !_ids.has(it.id))];
          }
          return lsData;
        }
        if (lsSecCount < fileSecCount) {
          console.warn(`[open] LS 섹션 수 부족 (LS:${lsSecCount} < FILE:${fileSecCount}) — 파일 우선 적용`);
        }
        if (lsImgCount < fileImgCount) {
          console.warn(`[open] LS 이미지 수 부족 (LS:${lsImgCount} < FILE:${fileImgCount}) — 파일 우선 적용`);
        }
      } catch {}
    }
  }
  return null;
}
/* 본이 이겼을 때의 뒤처리. 비교는 적용 «전»에 시작한다(applyProjectData 가 본을 고친다) · 못 가리면(atob 실패 등) 다르다고 친다: 복구분을 조용히 빼지 않는다. */
function _prepareLsWin(lsData, proj, id) {
  const differs = _lsDiffersFromFile(lsData, proj).catch(() => true);
  return async (stillHere) => {
    if (!stillHere()) return false;   // 그사이 다른 프로젝트로 갔다 — 그쪽에 저장을 걸지 않는다(탭은 돌아왔을 때 다시 부른다)
    recordExternalizeBaseline(proj, id);   // 기준선은 파일 — 본의 data 그림을 «옛것»으로 치면 복구 저장이 파일에 base64 를 되돌린다(앱 3/3)
    /* 복구한 본이 파일과 다르면 곧 파일로 넣는다 — 안 그러면 이름만 바꾼 뒤 저장 없이 끝날 때 복구분이 사라진다(앱 3/3). 같으면 안 쓴다(DEF-03). */
    if (!(await differs)) return stillHere();
    return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => {   // applyProjectData 의 억제가 한 프레임 뒤 풀린다
      if (!stillHere()) { done(false); return; }
      scheduleAutoSave();
      done(true);
    })));
  };
}
/* 그 프로젝트의 진행·대기 저장이 끝나길 기다린다 — 탭을 닫고 곧바로 다시 열면 낡은 파일을 읽어 본이 이기고, 복구 저장이 대기 중이던 편집을 덮었다(앱 3/3).
   상한을 넘기면 false: 판정할 근거가 없으니 부르는 쪽은 본을 쓰지 않는다. */
async function _waitSavesFor(id, capMs = 15000) {
  const end = Date.now() + capMs;
  while ((_isSavingToFile && (_savingOwnerId === id || _savingOwnerId === null)) || _pendingSaves.has(id)) {
    if (Date.now() > end) return false;
    await new Promise(r => setTimeout(r, 25));
  }
  return true;
}
window.waitSavesFor = _waitSavesFor;
window.pickLsOverFile = _pickLsOverFile;
window.prepareLsWin = _prepareLsWin;

/* ★E170(2026-10-06 lane-drag · 태양/지디 «한 곳») 프로젝트 «열기» 로드의 한 자리 — 부팅 로드 · 탭 첫 로드가 같이 부른다.
   열기 입구 10 곳(카드 · 홈 최근 탭 · 설정 · 협업 수락 · MCP open_project · 탭 바 · 탭 닫기 뒤 · 「+」 최근 · 새 프로젝트)이 이 두 자리로 모인다.
   옛 판: 부팅 로드만 복구 토스트 · 탭 첫 로드는 없음(말없는 복구). ⇒ 토스트(같은 글)와 표식 걷기를 여기 «한 번»만.
   ⛔렌더러에서 electronAPI.loadProject 에 open:true 를 넘기는 «날» 호출을 새로 쓰지 마라 — tests/unit/open-load-notice-e170.test.js 가 «하나»로 잠근다. */
async function loadProjectForOpen(id) {
  const proj = await window.electronAPI.loadProject(id, { open: true });
  if (!proj && await window.electronAPI.projectFolderState?.(id) === 'unknown') {   // 없는 게 아니라 못 읽었다 — 빈 판으로 열지 않고 읽기 실패 길로
    window.LoadInputGate?.noteReadError('폴더를 읽지 못함');
    throw new Error('project-read-failed:folder-unknown');
  }
  /* ★BOOT-CLEANUP-WIPES-CORRUPT-PROJECT-LS-01 — «JSON 은 맞는데 모양 아님» 이면 main 은 _unreadable 대신 null 을 준다 → 빈 판이 편집 가능하게 열려 첫 편집이
     남긴 LS 본·파일을 덮었다(부팅 · 탭을 떠났다 돌아오기 둘 다 · 리뷰 3-1). proj.json 이 있는데 못 읽으면 깨진 것과 같은 실패 길로. */
  if (!proj) {
    const _rs = await window.electronAPI.projectReadState?.(id);
    if (_rs === 'unreadable') {
      window.LoadInputGate?.noteUnreadable();
      throw new Error('project-unreadable');
    }
    /* ★OPEN-NULL-EMPTY-BOARD-EDITABLE-01 — null 인데 proj.json 이 «없음»이 아니다: 그 순간 못 읽었고 그사이 다른 창·MCP 가 성한 파일을 썼거나(ok) 판정을 못 했다(unknown·planning).
       빈 판으로 열면 첫 편집의 저장이 그 성한 파일을 빈 판으로 덮는다(buildProjForSave 는 existing 위에 빈 판 pages 를 얹는다). 같은 읽기 실패 길로 — 다시 열면 읽힌다.
       'none'(proj.json 없음)만 null 로 둔다 — 앱 밖에서 없어진 폴더 길(projectGoneCopy)이 그걸 받는다. 답이 글자가 아니면(옛 판·대역 API) 옛 동작. */
    if (typeof _rs === 'string' && _rs !== 'none') {   // main 은 늘 글자로 답한다 — 답이 없으면(창구 없음·대역) 옛 동작
      window.LoadInputGate?.noteReadError(_rs === 'ok' ? '열 때 파일이 바뀌는 중' : '읽기 상태를 모름');
      throw new Error('project-read-failed:open-null-' + _rs);
    }
  }
  if (proj && proj._unreadable) {   // 읽기 실패와 같은 길로 보낸다 — 확정 error · 안 읽힘 표식 · 저장 거절이 거기 있다(빈 프로젝트로 열면 첫 편집이 깨진 파일을 덮는다)
    window.LoadInputGate?.noteUnreadable(proj.preservedAs);
    throw new Error('project-unreadable');
  }
  if (proj && proj._planning) {   // 같은 실패 길로 — 저장을 막아 파일이 그대로다
    window.LoadInputGate?.noteMessage('⚠️ 기획 프로젝트는 편집기에서 열 수 없습니다 — 파일은 그대로입니다.');
    throw new Error('project-planning');
  }
  if (proj && proj._readError) {   // 못 읽었을 뿐 깨진 게 아니다 — 같은 실패 길로, 말만 다르게
    window.LoadInputGate?.noteReadError(proj._readError);
    throw new Error('project-read-failed:' + proj._readError);
  }
  if (proj) await window.markLsRoot?.(id);
  _lastOpenFallback = proj && proj._recovered ? id : null;
  if (proj && proj._recovered) window.showToast?.(_recoveryToastText(proj));
  if (proj) { delete proj._recovered; delete proj._healed; delete proj._healError; delete proj._recoveredAt; delete proj._recoveredAtLabel; } // 마커는 메모리/저장에 남기지 않음
  return proj;
}
window.loadProjectForOpen = loadProjectForOpen;

let _autoSaveHideTimer = null;
function _setAutosaveIndicator(state) {
  // 로드 실패 탭에서만 — 평소 첫 로드 창 안에 끝난 앞 탭 저장은 진짜 저장됨이다(리뷰: 빨강이 영속으로 남았다)
  if (state === 'saved' && window.isTabFirstLoading?.(activeProjectId) && window.gdtProjectReady?.get?.()?.phase !== 'loading') state = 'error';
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  clearTimeout(_autoSaveHideTimer);
  el.className = state;
  // GAP-005: 저장 실패 시 '저장됨' 거짓표시 금지 — 'error'는 빨강·영속(자동숨김 없음).
  el.textContent = state === 'saving' ? '저장 중...'
                 : state === 'error' ? '⚠️ 저장 실패'
                 : '저장됨';
  el.style.color = state === 'error' ? '#e5484d' : '';
  if (state === 'saved') {
    _autoSaveHideTimer = setTimeout(() => { el.className = ''; el.textContent = ''; el.style.color = ''; }, 2500);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   [P-A2] 제스처 «중»엔 자동저장을 «미룬다» (취소가 아니다)

   왜: 90MB 프로젝트의 `serializeProject()` 는 메인스레드를 **811ms** 멈추고, 이어서
   파일 쓰기 IPC 응답 대기가 **401ms** 더 든다(실측, 진짜 입력). 디바운스 1500ms 뒤에
   발화하므로 «클릭하고 1.5초 안에 팬하면» 그 정지가 팬 도중에 떨어진다 — 그게 「탁」이다.
   ⇒ 미는 동안엔 안 터지게 하고, 손을 떼면 바로 다시 예약한다. (현빈 승인: 저장 표시가
     미는 동안 안 뜨다가 놓으면 뜬다 — 그 «보이는 변화»까지 포함해 승인됨)

   ⛔취소가 아니라 «연기»다. 유예 중에 들어온 예약 요청은 `_autoSavePending` 에 «기억»했다가
   `resumeAutoSave()` 에서 다시 건다. 기존 `_suppressDragSave`(section-drag.js)는 그냥 «버린다» —
   그건 그 창의 편집을 잃을 수 있다. 이쪽은 안 잃는다.

   ⛔고착이 곧 데이터 손실이다. 이 레포는 이미 겪었다(`drag-drop.js:28` 「ESC 취소 시
   _suppressAutoSave 고착 방지」). 그래서 재개 경로를 «셋» 둔다:
     ⑴제스처 정상 종료(mouseup) ⑵창 포커스 상실(blur) ⑶안전망 타임아웃(최대 유예 시간)
   ═══════════════════════════════════════════════════════════════════ */
const _AUTOSAVE_DEFER_MAX_MS = 30000;   // 어떤 경우에도 이보다 오래 미루지 않는다
let _autoSaveDeferred = false;
let _autoSavePending = false;           // 유예 중에 «예약 요청»이 있었나
let _autoSaveDeferGuard = null;

function deferAutoSave() {
  if (_autoSaveDeferred) return;
  _autoSaveDeferred = true;
  // 이미 걸려 있던 타이머는 «해제»하되, 예약이 있었다는 사실은 기억한다.
  if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; _autoSavePending = true; _autoSaveBurstHeld = true; }
  clearTimeout(_autoSaveDeferGuard);
  _autoSaveDeferGuard = setTimeout(() => resumeAutoSave(), _AUTOSAVE_DEFER_MAX_MS);
}

function resumeAutoSave() {
  clearTimeout(_autoSaveDeferGuard); _autoSaveDeferGuard = null;
  if (!_autoSaveDeferred) return;
  _autoSaveDeferred = false;
  if (_autoSavePending) { _autoSavePending = false; scheduleAutoSave(); }
}
window.deferAutoSave = deferAutoSave;
window.resumeAutoSave = resumeAutoSave;
window.__autoSaveDeferState = () => ({ deferred: _autoSaveDeferred, pending: _autoSavePending });
// ⑵창 포커스를 잃으면(다른 앱으로 전환 등) 제스처가 끝난 것으로 본다 — 고착 방지.
window.addEventListener('blur', () => resumeAutoSave());

/* ★S1(2026-10-03, 현빈 승인 · 지디 «저장 대기 중에만»으로 좁힘) — 창이 오래 가려지면 Chromium 이 타이머를 분 단위로 묶어
   자동저장이 10~30분+ 밀렸다(실측: 숨긴 지 10·20·30분 지점 모두 180초 안 저장 0회 · setTimeout(1500) 이 119초 뒤 발화).
   처음엔 창 억제를 «상시» 껐다(4ba5c791) — 숨겨 둔 앱이 %CPU 평균 12.2(켬 0.06)를 상시 먹고, visibilityState 가 visible 로 남아
   visibilitychange 의존 2곳(초대 배지·Option 키 초기화)이 죽었다. ⇒ «저장 대기 중에만» 메인에 억제를 풀어 달라고 한다.
   ⛔되돌림은 반드시 — 이 렌더러 쪽은 모든 끝(성공·실패·건너뜀·예외)에서 false, 메인은 상한 타이머·창 파괴로 한 번 더 되돌린다. */
let _bgHold = false;
function _holdBackground(on) {
  if (_bgHold === on) return;
  _bgHold = on;
  try { window.electronAPI?.setSavePending?.(on); } catch (_) {}
}
window._holdBackgroundForTest = () => _bgHold;   // 시험 전용 읽기(쓰기 없음)

/* ⒡ 끌기 저장 (2026-10-05 lane-esweep · 데이터 손실 · 지디 승인 21:59)
   증상(실앱 실측): 섹션 안 블럭을 끌어 옮기면 화면은 바뀌는데 파일은 그대로 — 4초·20초 뒤에도 무변,
     창을 닫거나 다시 읽으면 옮김이 사라진다. 「상관없는 편집 하나를 하면 그때 같이 저장된다」. E132 도 같은 뿌리.
   뿌리: dragstart 가 억제 창을 연다(section-drag.js _suppressDragSave · layer-panel-items.js 'layer-drag').
     놓기의 DOM 변화는 창 «안»이라 아래 scheduleAutoSave 가 «기억 없이» 버렸고, dragend 는 창만 닫는다(AutoSaveSuppress.end 는 예약 안 함).
     b828e3fa(2026-03-28)부터 · v0.5.0~v0.9.5. 옮긴 뒤 다시 저장을 거는 길은 셋뿐이었다(프레임 dragend · 섹션 drop · ⌘S).
   고침: 억제 «중» 버려지는 편집이 «끌기 창만» 열려 있을 때 생긴 것이면 ⑴ 미저장 표시(_dirtySinceSave)를 세우고
     ⑵ 창이 닫히는 대로 저장을 한 번 건다. ⑴ 덕에 창을 바로 닫아도 beforeunload 동기 저장이 돈다.
   ⛔끌기 아닌 억제(열기·탭/페이지 전환·되돌리기 복원 — 이유 'page-switch' 등, 혹은 이유 없는 날 대입)는 «건드리지 않는다»:
     그 창의 변화는 편집이 아니라 불러오기다(DEF-03 — 무편집 방문이 파일을 다시 쓰지 않게).
   분모 = 끌기 억제 이유 둘 ↔ 여는 길 6(block-drag.js 블럭 단위·프레임 · section-drag.js 라벨·그룹·빈 row → 'section-drag' / 레이어 → 'layer-drag').
   시험: tests/dom/drag-move-autosave.dom.spec.js (깃발을 빼면 D1·D5·D6 빨강). */
const _DRAG_SUPPRESS_REASONS = new Set(['section-drag', 'layer-drag']);
/* ★로드 뒤 창 — applyProjectData 가 끝나도 억제는 한 프레임 뒤에 풀린다(큰 판 0.1~0.8초). 그 창에 넣은 섹션은 화면에 있는데 저장 예약이 안 돼
   5초를 기다려도 디스크에 없었고 ⌘R·창 닫기로 사라졌다(앱 ×3). 창 안 변경에는 로드 자신의 잔여 변이도 섞여 온다(무편집이 다시 쓰이면 안 된다 — DEF-03·345)
   ⇒ «적용이 끝난 뒤 ⌘Z 스택이 앞으로 갔나»로 편집을 가른다. 적용 전(phase loading · 363)은 여기 안 든다.
   글자 치기는 스택을 안 올린다 ⇒ input 이벤트도 편집으로 친다(로드는 input 을 안 낸다).
   shortcut: 스택도 input 도 안 내는 편집은 못 본다, 그런 입력이 이 창에 닿는 값이 나오면 넓혀라. */
let _loadWindowHistPos = null;
let _loadWindowInput = false;
if (typeof document !== 'undefined') document.addEventListener('input', () => { _loadWindowInput = true; }, true);
let _dragEditPending = false;
let _dragEditTimer = null;
let _dragEditTicks = 0;   // 한 에피소드(창 열림 → 닫힘 → 저장)의 폴 횟수 — 시험이 «한정»을 단언한다(S7)
/* ⚠️조건 «다른 파일이면 멈추고 와라» ↔ 실제: 묻지 않고 더 좁은 길(폴링)로 갔다 · 결과는 승인, 판단을 혼자 한 것은 이탈(태양·지디 10-05 23:11).
   ☐0.9.7: AutoSaveSuppress.end() 이벤트(js/autosave-suppress.js — 마지막 창이 닫히는 그 자리)로 옮기고 이 폴링을 걷는다. */
function _noteEditDuringDrag() {
  const AS = (typeof window !== 'undefined') ? window.AutoSaveSuppress : null;
  const holders = (AS && typeof AS.inspect === 'function') ? (AS.inspect().holders || []) : [];
  // pushHistory 가 변이 기록을 먼저 비워 여기가 스택이 오르기 «전»에 불린다 ⇒ 그 일이 끝난 뒤(microtask)에 가른다
  // 창 안 끌기는 끌기 창이 겹쳐 열린다(이유 둘) ⇒ 그 조합도 이 창이다
  if (_loadWindowHistPos !== null && holders.some(h => h.reason === 'applyProjectData')
      && holders.every(h => h.reason === 'applyProjectData' || _DRAG_SUPPRESS_REASONS.has(h.reason))) {
    queueMicrotask(() => { if (_loadWindowHistPos !== null && (_loadWindowInput || window.historyPos !== _loadWindowHistPos)) _keepEditForAutoSave(); });
    return;
  }
  if (!holders.length || !holders.every(h => _DRAG_SUPPRESS_REASONS.has(h.reason))) return;
  _keepEditForAutoSave();
}
function _keepEditForAutoSave() {
  _dirtySinceSave = true;
  _dirtyOwnerId = activeProjectId;
  _dragEditPending = true;
  if (_dragEditTimer) return;
  _dragEditTicks = 0;
  const tick = () => {
    _dragEditTicks++;
    if (state._suppressAutoSave) { _dragEditTimer = setTimeout(tick, 100); return; }
    _dragEditTimer = null;
    if (!_dragEditPending) return;
    _dragEditPending = false;
    scheduleAutoSave();
  };
  _dragEditTimer = setTimeout(tick, 100);
}
/** 시험용 읽기(쓰기 없음) — S7 이 «폴링이 멎는가 · 틱 수 한정»을 단언한다. */
if (typeof window !== 'undefined') window.__dragEditStateForTest = () => ({ armed: !!_dragEditTimer, pending: _dragEditPending, ticks: _dragEditTicks });

function scheduleAutoSave() {
  /* ⒡ 끌기 창 안에서 버려지던 편집 — 위 머리말. ⛔꼴을 «if (state._X) return …» 로 둔다: tests/unit/autosave-overlap.test.js N6 이
     이 꼴로 억제 플래그를 «도출»한다(블록 { … return } 로 바꾸면 도출이 0 이 돼 N7 전수가 거짓 초록이 된다 — 10-05 실측). */
  if (state._suppressAutoSave) return _noteEditDuringDrag();
  // [P-A2] 제스처 중이면 «미룬다» — 버리지 않고 기억해 뒀다가 놓을 때 다시 건다.
  if (_autoSaveDeferred) { _dirtySinceSave = true; _dirtyOwnerId = activeProjectId; _autoSavePending = true; return; }
  // BUG-12: activeProjectId가 없으면 'web-editor-autosave__undefined' 키로 저장되는 버그 방지
  if (!activeProjectId) { console.warn('[save-load] scheduleAutoSave: activeProjectId 없음, 저장 건너뜀'); return; }
  _dirtySinceSave = true;
  _dirtyOwnerId = activeProjectId;
  /* ★J354 — 부를 때마다 타이머를 되걸어, 1.5초보다 촘촘한 연속 편집 중에는 저장이 한 번도 안 났다(앱 0.8·1.2초 간격 40초 쓰기 0 · 비정상 종료 시 40초 전부 잃음).
     연속 편집 중에도 AUTOSAVE_MAX_WAIT_MS 안에 한 번은 쓴다. 기다림의 시작 = 타이머가 비어 있을 때 온 첫 편집. */
  if (!autoSaveTimer && !_autoSaveBurstHeld) _autoSaveBurstAt = Date.now();
  _autoSaveBurstHeld = false;
  const _autoSaveDelay = Math.max(0, Math.min(1500, AUTOSAVE_MAX_WAIT_MS - (Date.now() - _autoSaveBurstAt)));
  clearTimeout(autoSaveTimer);
  _holdBackground(true);   // ★S1 — 타이머를 걸기 «전에» 푼다(숨은 창에서 이 1.5초가 분 단위로 밀리지 않게)
  _setAutosaveIndicator('saving');
  scheduleIdleThumbnail();   // ★편집이 멈춘 뒤 썸네일 — 홈 나갈 때 찍지 않으려면 여기서 찍어둬야 한다
  // debounce 1500ms: Notion ~1s, Figma ~2s 중간값. 데이터 손실·저장 폭주 균형점.
  const _saveTargetId = activeProjectId; // H1: 발화 시점에 탭이 바뀌었는지 비교할 대상 캡처
  _autoSaveTimerOwnerId = _saveTargetId;
  const _armedWhileLoading = !!window.isTabFirstLoading?.(_saveTargetId);
  autoSaveTimer = setTimeout(() => {
    let _handed = false;   // ★S1 — 저장 약속에 넘겼으면 되돌림은 그 finally 몫, 아니면 아래 finally 몫
    try {
    autoSaveTimer = null; // 발화 후 stale id 잔존 방지 — hasUnsavedChanges 판정에 쓰임
    // H1: 타이머 set 이후 탭이 전환됐으면 이 저장은 다른 프로젝트를 오염시킨다 — 건너뛴다.
    // (전환된 탭은 자기 편집 시 자체 타이머를 갖고, 이전 탭은 flushCurrentPage/beforeunload로 보존됨)
    if (activeProjectId !== _saveTargetId) {
      console.warn('[save-load] autoSave skip: 탭 전환 감지 (target=' + _saveTargetId + ' now=' + activeProjectId + ')');
      _setAutosaveIndicator('saved');
      return;
    }
    // ★361 — 안 읽힌 탭(로드 실패 뒤)의 편집은 안 쓴다(saveProjectToFile 머리말 · 여기선 localStorage 도 안 쓴다). «저장됨»이라고 말하지 않는다.
    if (window.isTabFirstLoading?.(_saveTargetId)) {
      // 닫기 전에 걸린 앞 타이머 — 그 편집은 닫을 때 이미 저장으로 나갔다(앱: «읽지 못해»가 잘못 떴다). 읽는 중에 걸린 타이머의 편집은 안 썼으니 그대로 말한다(시험 B2).
      if (!_armedWhileLoading && window.gdtProjectReady?.get?.()?.phase === 'loading') { _setAutosaveIndicator('saved'); return; }
      window.showToast?.('⚠️ 이 프로젝트를 읽지 못해 저장하지 않았습니다 — 탭을 다시 열어 주세요.');
      _setAutosaveIndicator('error');
      return;
    }
    const _snapAt = performance.now();   // 협업이 «이 스냅이 받은 패치보다 먼저 찍혔나»를 가른다(COLLAB-SYNC-OLD-GAPS ㉮ · 읽기만)
    let snap = serializeProject();
    // S11: 빈 canvas 저장 방지 — _suppressAutoSave 해제 직후 빈 상태 덮어쓰기 방지
    try {
      const snapData = JSON.parse(snap);
      if (_emptySaveBlocked(snapData, activeProjectId)) {
        console.warn('[save-load] scheduleAutoSave: 빈 canvas, localStorage 저장 건너뜀');
        _setAutosaveIndicator('saved');
        return;
      }
      if (applyAdoptedAssets(snapData, activeProjectId)) snap = JSON.stringify(snapData);   // 파일 쓰기 전에 렌더러가 죽거나 저장이 거절되면 이 localStorage 본이 다음 열기에 이겨 옛 주소가 파일까지 덮는다(앱 ×6)
    } catch {}
    const saveOk = safeLocalStorageSet(getSaveKey(), snap);
    if (saveOk) localStorage.setItem(getSaveTsKey(), String(Date.now()));
    // GAP-005: 저장 결과를 기다려 인디케이터를 정직하게 갱신.
    // ok:false(EACCES·디스크풀·잠금 등) → '저장 실패'(빨강), 성공/큐잉 → '저장됨'.
    // BL-CDD-08: 파일 저장 대상을 발화 시점 검증된 id로 명시 고정 — saveProjectToFile 내부의
    // "저장 시점 activeProjectId 재읽기"에 의존하지 않는다(비동기 큐잉 중 전환 대비).
    _handed = true;
    Promise.resolve(saveProjectToFile(snap, { skipThumbnail: true, projectId: _saveTargetId })) // 자동저장은 썸네일 캡처 생략
      .then(r => {
        // ★보호성 스킵(빈 캔버스)은 «실패»가 아니다 — 새 프로젝트에서 매번 빨강이 되면 신호가 죽는다.
        //   ★[W-3-b] 판정은 _isSaveFailure 하나로 모았다 — dirty 를 지우는 자리와 «같은 값»이어야
        //     한다. 두 벌이면 「빨강인데 미저장 없음」 같은 어긋남이 또 난다(그게 이번 병이었다).
        _setAutosaveIndicator(_isSaveFailure(r) ? 'error' : 'saved');
        // ★협업 동기화 훅 — 저장이 «끝난 뒤»에만 알린다. 저장 전에 쏘면 내 디스크에도
        //   없는 것을 남에게 주게 된다. 실패했으면 안 쏜다(공유는 저장의 «다음» 단계다).
        //   이벤트로 가른 이유: save-load 가 협업을 몰라도 되게 — 협업이 없으면 아무도 안 듣는다.
        if (!(r && r.ok === false)) {
          try { window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { projectId: _saveTargetId, snap, snapAt: _snapAt } })); } catch (_) {}
        }
      })
      .catch(() => _setAutosaveIndicator('error'))
      .finally(() => { if (!autoSaveTimer) _holdBackground(false); });   // ★S1 — 새 저장이 그새 걸렸으면 그쪽이 되돌린다
    } finally {
      if (!_handed && !autoSaveTimer) _holdBackground(false);   // ★S1 — 건너뜀(탭 전환·빈 캔버스)·예외도 되돌린다
    }
  }, _autoSaveDelay);
}

// 새로고침/탭 닫기 시 항상 localStorage에 flush (autoSaveTimer 여부 무관)
window.addEventListener('beforeunload', () => {
  _flushUnfinishedSavesSync();   // 활성 탭과 무관 — 아래 어느 갈래로 나가도 먼저(실패는 메인이 기록한다)
  // BUG-12: activeProjectId 없으면 undefined 키 오염 방지
  if (!activeProjectId) return;
  // DEF-03: 마지막 저장 이후 변경이 없으면 재기록하지 않음 (무편집 새로고침/방문의 updatedAt·파일 오염 방지)
  /* ★[W-3-b] 벨트 하나 더 — dirty 가 «다른 경로»에서 지워졌더라도, 마지막 저장이 실패로
     끝난 걸 «아는» 상태면 종료 저장을 시도한다. 디스크가 나쁜 줄 «알면서» 그냥 나가지 않는다.
     ⛔이건 위 ②의 대체재가 아니라 «보조»다. 근본은 ②(결과를 보고 dirty 를 지운다).
     ⚠️권한이 복구됐다면 이 시도가 «성공»해서 데이터가 들어간다 — 손해 없는 재시도다. */
  if (!_unloadSaveNeeded(activeProjectId)) return;
  if (window.isTabFirstLoading?.(activeProjectId)) return;   // ★361 — saveProjectToFile 머리말 · 이 길은 그 함수를 안 거친다
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  let snap = serializeProject();
  // S11: 빈 canvas 저장 방지 + snap 파싱은 한 번만
  let snapData;
  try { snapData = JSON.parse(snap); } catch { return; }
  if (_emptySaveBlocked(snapData, activeProjectId)) return;

  // BUG-44: Electron이면 동기 IPC로 파일에 즉시 저장 (autoSave debounce 1.5s 이내 새로고침 시 데이터 손실 방지)
  // localStorage는 보조 캐시이며, 파일 저장이 진실의 원천. 큰 snapshot도 파일에는 무조건 들어가야 함.
  let _unloadFiled = false;
  /* LS 본의 시각은 «파일 저장을 부르기 전»에 잡는다 — 그 저장이 실패하면 main 이 그 자리에서 비상 사본·기록(at)을 쓰는데, 옛 판은 LS 시각을 그 «뒤»에 찍어
     같은 본인데 at < _ts 가 됐다 ⇒ 부팅 정리·갤러리 휴지통의 «사본 ≥ LS 본» 규칙이 같은 편집을 또 남겼다(NEW-TRASH-FROM-GALLERY 적대 리뷰 2). LS 본(snap)은 그 전에 찍힌 것이라 이 시각이 참이다. */
  const _unloadAt = Date.now();
  if (IS_ELECTRON && window.electronAPI?.saveProjectSync) {
    try {
      const proj = {
        ...snapData,
        id: activeProjectId,
        name: openTabs.find(t => t.id === activeProjectId)?.name || 'Untitled',
        updatedAt: new Date().toISOString(),
      };
      if (applyAdoptedAssets(proj, activeProjectId)) snap = JSON.stringify(snapData);   // 아래 localStorage 본도 — 파일보다 새로워 다음 열기에 이기면 옛 주소가 파일까지 되돌린다
      _markGoneBase(proj, activeProjectId);   // 남은 본 표시(proj 에 붙인다) — 호출 글자는 그대로 둔다(tests/unit/unload-save-adopted 가 그 자리를 잰다)
      const result = window.electronAPI.saveProjectSync(proj);
      _unloadFiled = !!result && result.ok !== false;
      if (result?.reason !== 'project_deleted') _noteFailedSave(activeProjectId, !_unloadFiled);
      if (result && result.ok === false) {
        console.warn('[save-load:beforeunload] sync 저장 거부:', result.reason);
      }
    } catch (e) {
      console.error('[save-load:beforeunload] sync 저장 실패:', e);
    }
  }

  const _unloadSaveOk = safeLocalStorageSet(getSaveKey(), snap);
  if (_unloadSaveOk) { localStorage.setItem(getSaveTsKey(), String(_unloadAt)); if (_unloadFiled) _markLsFiled(activeProjectId, localStorage.getItem(getSaveTsKey())); }
  // non-Electron: PROJECTS_KEY snapshot 동기 업데이트 (파싱 결과 재사용)
  if (!IS_ELECTRON && activeProjectId) {
    try {
      const list = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const proj = list.find(p => p.id === activeProjectId);
      if (proj) {
        proj.snapshot = snapData;
        proj.updatedAt = new Date().toISOString();
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
      }
    } catch {}
  }
});

/* ── 종료 시 저장 결과의 «번역» (H4) ───────────────────────────────────────
 * saveProjectToFile 의 반환을 «종료 통지»로 바꾼다.
 * ★이 함수가 왜 따로 있나 — 여기가 H4 가 고친 «판단» 그 자체다. 유닛테스트가
 *   이 원문을 그대로 잘라 돌린다(tests/unit/quit-save-guard.test.mjs).
 * ★규칙: «명시적인 성공»만 성공이다.
 *   · { ok:true }                  → 디스크에 들어갔다.
 *   · { ok:false, skipped:true }   → «보호성 스킵»(빈 캔버스)이다. 실패가 아니다 →
 *                                    골 C4 의 양성대조: 여기서 다이얼로그가 뜨면 안 된다.
 *   · { ok:false, ... }            → 실패다. ★옛 코드는 이걸 «한 건도» 못 봤다
 *                                    (saveProjectToFile 은 던지지 않고 반환한다).
 *   · undefined                    → «큐잉됨 = 미확정». 종료 중엔 그 큐가 안 돈다 →
 *                                    저장됐다고 말하면 안 된다.
 * ────────────────────────────────────────────────────────────────────────── */
function _quitSaveOutcome(result) {
  if (result && result.ok === true) return { ok: true, reason: 'saved' };
  if (result && result.ok === false && result.skipped === true) return { ok: true, reason: result.reason || 'skipped' };
  if (result === undefined || result === null) return { ok: false, reason: 'unconfirmed' };
  return { ok: false, reason: (result && result.reason) || 'save-failed', error: (result && result.error) || null };
}

/** 종료 때 줄에 선 저장을 기다리는 상한(핸들러 시작부터) — 메인 quit 가드 saveWaitMs 3000 보다 작아야 한다(넘으면 메인이 no-response 로 창). */
const QUIT_SAVE_WAIT_MS = 2500;
function _quitSaveResolveQueued(isSaving, pendingHas, last, queuedAt) {
  /* ★★«큐가 빠졌다» ≠ «저장에 성공했다».
     실측(2026-09-06 deny-write 실기): 종료 시점에 다른 저장이 돌고 있어 우리 저장이 큐로 갔고,
     큐가 빠지자 초판이 「저장됨」이라고 답했다 — 그런데 그 저장은 EACCES 로 «실패»했다.
     ⇒ 큐가 빠졌으면 «그 저장의 결과»를 읽는다. 결과가 없거나(기록 없음) 우리가 큐에 넣기 «전»의
       옛 기록이면 그건 성공의 증거가 아니다 → undefined(=미확정) 로 돌려 실패 쪽으로 센다. */
  const drained = !isSaving && !pendingHas;
  if (!drained) return undefined;
  if (!last || !(last.at >= queuedAt)) return undefined;
  return last.result;
}

// 앱 종료 전 강제 저장 (Electron before-quit IPC)
if (IS_ELECTRON) {
  window.electronAPI.onForceSaveBeforeQuit(async () => {
    stopAdoptingForQuit();
    const _quitT0 = Date.now();   // QUIT-FALSE-SAVE-FAILURE-DIALOG-01 — 아래 기다림 상한은 «이 시각부터» 센다(메인 saveWaitMs 3000 안)
    /* ★어느 경로로 새도 «한 번은» 답한다 — 답을 안 하면 메인이 3초를 헛기다린다.
       그리고 실패는 «실패라고» 답한다(옛 코드는 실패도 성공처럼 답했다). */
    let answered = false;
    const answer = (r) => {
      if (answered) return; answered = true;
      const { failed, wrote } = _flushUnfinishedSavesSync();   // 안 읽힌 탭에서 끝내도 닫은 탭의 저장은 남아 있다 · 앱이 곧 끝나 큐가 안 돈다
      const _left = failed[0];
      // 줄에 서 미확정이던 그 본이 방금 들어갔다 — 실패 대화상자는 거짓이다
      if (!_left && r.reason === 'unconfirmed' && wrote.has(r.projectId)) r = { ok: true, reason: 'flushed' };
      if (_left && r.ok) r = { ok: false, reason: _left.reason, projectId: _left.id, projectName: openTabs.find(t => t.id === _left.id)?.name || null, snapshot: _left.snapshot };
      try { window.electronAPI.quitReady(r); } catch (_) {}
    };
    let snap = null;
    let quitId = null, quitName = null;   // snap 의 주인 — 기다리는 사이 탭이 바뀌어도 답은 이 프로젝트를 말한다
    try {
      if (!activeProjectId) { answer({ ok: true, reason: 'no-project' }); return; }
      if (_isReloadSealed(activeProjectId)) { answer({ ok: true, reason: 'reload-seal' }); return; }
      quitId = activeProjectId;   // 기다리는 사이 저장 거절이 탭을 닫으면 활성이 바뀐다
      quitName = getProjectName();
      if (window.isTabFirstLoading?.(activeProjectId)) { answer({ ok: true, reason: 'tab-not-loaded' }); return; }   // ★361 — saveProjectToFile 머리말
      // debounce 타이머 즉시 취소
      if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
      snap = serializeProject();
      let snapData;
      try { snapData = JSON.parse(snap); }
      catch (e) {
        // 우리가 만든 문자열을 우리가 못 읽는다 = 저장이 불가능하다. ★원문이라도 넘겨 사본을 남긴다.
        answer({ ok: false, reason: 'corrupt_snapshot', error: (e && e.message) || null,
                 projectId: activeProjectId, projectName: getProjectName(), snapshot: snap });
        return;
      }
      if (_isAllCanvasEmpty(snapData)) { answer({ ok: true, reason: 'empty_canvas_skipped' }); return; }
      if (applyAdoptedAssets(snapData, quitId)) snap = JSON.stringify(snapData);   // 아래 실패 답의 비상 사본도 새 주소로

      let result;
      try {
        result = await saveProjectToFile(snapData, { skipThumbnail: true });
      } catch (e) {
        console.error('[save-load] force-save-before-quit 저장 실패:', e);
        answer({ ok: false, reason: 'exception', error: (e && e.message) || String(e),
                 projectId: quitId, projectName: quitName, snapshot: snap });
        return;
      }
      /* undefined = «다른 저장이 도는 중이라 큐에 넣었다». 그 큐는 앞 저장이 끝나야 돌므로
         상한을 두고 «짧게» 기다려 본다. 끝나면 정직하게 성공, 못 끝나면 정직하게 미확정.
         ⛔무한 대기 금지 — 메인의 3초 상한을 넘기면 앱이 그냥 죽는다. */
      if (result === undefined) {
        const queuedAt = Date.now();
        /* ★QUIT-FALSE-SAVE-FAILURE-DIALOG-01(0.9.10) — 옛 상한 «줄에 선 뒤 1초»는 짧았다: 앞 저장이 끝나 우리 저장이 «시작은 했는데» 1초 안에 안 끝나면
             답이 unconfirmed(=실패 창, 6초 상한 · 체감 약 7초)였고 쓰기는 곧 끝나 디스크는 최신이었다(거짓 실패 · 동기 flush 가 못 들어가는 때).
           ⇒ 핸들러 시작부터 QUIT_SAVE_WAIT_MS 까지 기다린다 — 메인 saveWaitMs(3000, main/quit/save-guard.js) 안에 답이 가도록 여유 500ms.
           ⛔진짜 실패는 그대로 실패다: 끝난 저장의 결과(_quitSaveResolveQueued)를 읽고, 상한을 넘기면 옛날처럼 미확정(=창). */
        const until = _quitT0 + QUIT_SAVE_WAIT_MS;
        while (Date.now() < until && (_isSavingToFile || _pendingSaves.has(quitId))) {
          await new Promise(r => setTimeout(r, 50));
        }
        result = _quitSaveResolveQueued(_isSavingToFile, _pendingSaves.has(quitId),
                                        _lastSaveResult.get(quitId), queuedAt);
      }
      /* 기다리는 사이 든 편집은 snap 에 없다(타이머가 다시 걸린 것이 표시) — 줄에 올려 answer 의 flush 가 쓴다. 못 쓰면 실패 답의 비상 사본이 이 본이다. */
      if ((autoSaveTimer || _autoSavePending) && activeProjectId === quitId && !window.isTabFirstLoading?.(quitId)) {
        const _late = JSON.parse(serializeProject());
        if (!_isAllCanvasEmpty(_late)) {
          if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
          applyAdoptedAssets(_late, quitId);
          snap = JSON.stringify(_late);
          _pendingSaves.set(quitId, { snapshot: snap, opts: { skipThumbnail: true, projectId: quitId } });
        }
      }
      /* ★QUIT-FALSE-SAVE-FAILURE-DIALOG-01 — 기다림이 자동저장 지연(1.5초)보다 길어져, 기다리는 사이 든 편집은 위 갈래 대신 자동저장이 «줄»에 올렸을 수 있다.
           줄의 본이 이 프로젝트의 가장 새 본이다 — 실패 답의 비상 사본도 그것이어야 한다(first-load-exit-doors-361 E24). */
      { const _q = activeProjectId === quitId ? _pendingSaves.get(quitId) : null;
        if (_q && _q.snapshot) snap = typeof _q.snapshot === 'string' ? _q.snapshot : JSON.stringify(_q.snapshot); }
      const out = _quitSaveOutcome(result);
      answer(out.ok ? { ok: true, reason: out.reason }
                    : { ok: false, reason: out.reason, error: out.error || null,
                        projectId: quitId, projectName: quitName, snapshot: snap });
    } catch (e) {
      console.error('[save-load] force-save-before-quit 처리 실패:', e);
      answer({ ok: false, reason: 'exception', error: (e && e.message) || String(e),
               projectId: quitId || activeProjectId || null, projectName: quitName, snapshot: snap });
    }
  });
}

// 변경 감지 — canvas MutationObserver
// class 속성 변경만 제외 (드래그 UI 상태 토글 spam 방지, DBG-11)
// data-* 속성 변경(prop 패널 값)은 감지해야 하므로 attributes:true 포함
/** ★★움직이는 파티클의 `transform` 쓰기인가 — ★그렇다면 ★«편집»이 아니다 (v1.5 ⑴ · 2026-10-09).
 *
 *  ★★왜 걸러야 하나 — ★실측(DOM 하네스 · 2026-10-09):
 *    ★파티클이 ★움직이는 ★1.5초 동안 ★«의미 있는» mutation 이 ★★21,724건 · ★멈추면 ★★0건.
 *    ⇒ ★안 거르면 ★문서가 ★★«영원히 dirty» 가 되어 ★자동저장이 ★1.5초마다 ★프로젝트를 통째로
 *      ★다시 쓴다(★updatedAt 오염 ＋ ★디스크 churn). ★위 DEF-03 이 ★막으려던 ★바로 그 병이다.
 *  ★★왜 ★«편집이 아닌가»가 ★참인가 — ★그 값은 ★★저장되지 않기 때문이다:
 *    `js/io/section-serialize.js` 의 ★`restParticleMotion` 이 ★세척에서 ★«쉬는 꼴»로 되돌린다.
 *    ⇒ ★★이 파일 ★NON_CONTENT_UI_SELECTOR 머리말의 ★⛔계약과 ★같은 결이다 —
 *      ★「저장에서 ★지워지는 것은 ★정의상 ★콘텐츠가 ★아니다」. ★여기선 ★«지운다»가 아니라 ★«되돌린다»다.
 *    ⇒ ★그 쌍이 ★깨지면(세척이 사라지면) ★tests/dom/fx-particles-anim ★V5 가 ★빨개진다.
 *  ★★좁게 잡는다 — ★`transform` ★하나 · ★`data-fxp` 를 ★쥔 요소 ★하나.
 *    ⛔층 통째(`.sec-fxpart-wrap` 안 전부)를 ★거르지 ★않는다. ★그러면 ★«진짜 다시그리기»
 *      (프리셋·개수를 바꿔 ★층이 ★새로 난 것)까지 ★조용히 ★안 저장된다. */
function _isParticleMotionMutation(m) {
  return m.type === 'attributes'
      && m.attributeName === 'transform'
      && m.target?.nodeType === 1
      && typeof m.target.hasAttribute === 'function'
      && m.target.hasAttribute('data-fxp');
}

/* ★130 싼 게이트 — 캔버스 «세대»(js/history.js pushHistory 가 직렬화 «앞»에서 읽는다). ⛔새 감시자 없음 — 이 감시자 «하나»에 한 칸.
 *   세대가 오르는 변이 = 직렬화를 바꿀 «수 있는» 변이 전부 — 아래 자동저장 판정과 같은 제외(UI 장식·파티클 움직임·lazy 패스·툴바·#canvas 자기 속성)만 뺀다.
 *   ⚠️class 는 자동저장 판정과 «다르게» 본다: 바뀐 토큰이 «전부» 세척이 벗기는 런타임 마커(section-serialize.js isRuntimeMarker)일 때만 뺀다
 *     — 그 밖 class(has-image 등 콘텐츠)는 센다. ⛔모르면 센다(거짓으로 «안 바뀜»이면 이력이 사라진다 · 거짓으로 «바뀜»이면 그냥 느리다). */
let _canvasGen = 0;
let _canvasGenLive = false;
function _classDiffIsRuntimeOnly(m) {
  const rm = window.runtimeMarkers?.isRuntimeMarker; if (typeof rm !== 'function') return false;
  const a = new Set(String(m.oldValue || '').split(/\s+/).filter(Boolean));
  const b = new Set(String(m.target?.getAttribute?.('class') || '').split(/\s+/).filter(Boolean));
  for (const t of a) if (!b.has(t) && !rm(t)) return false;
  for (const t of b) if (!a.has(t) && !rm(t)) return false;
  return true;
}
/* ★167(2026-10-26 · 지디 처방 · F4-GATE-NEVER-FIRES-IN-APP-01) — «비교»(history.js _NON_EDIT_ATTR_RE · _CHROME_RE)가 이미 벗기는 차이는
 *   세대도 안 올린다. ★이름은 js/non-edit-roster.js 한 집 — 정규식 글자와는 tests/unit/non-edit-roster-167.test.mjs 가 바이트째 묶는다.
 *   ⛔문자열(직렬본) 작업 0 — MutationRecord 의 값 둘(oldValue · 지금 값)만 본다. ⛔모르면 센다(정규식보다 넓게 빼지 않는다).
 *   실측 근거: 오버레이 켜기 push 뒤 늦게 오는 style 한 묶음(--sec-clip 45px→111px)이 세대를 +1 → 끌기 시작 표본 게이트 0/7(fa57bed6 ×4). */
const _NON_EDIT_BOOL = new Set([null, 'true', 'false']);   // history.js `draggable="(?:true|false)"` — 값 둘 다 이 안일 때만
function _attrDiffIsNonEdit(m) {
  return NON_EDIT_ATTRS.includes(m.attributeName)
      && _NON_EDIT_BOOL.has(m.oldValue) && _NON_EDIT_BOOL.has(m.target.getAttribute(m.attributeName));
}
/* style 선언 중 NON_EDIT_CSSVARS 를 뺀 나머지가 같으면 «그 변수만» 바뀐 것 */
function _styleDiffIsNonEditOnly(m) {
  /* 선언을 «이름:값»으로 접어 비교 — CSSOM 이 다시 쓴 꼴(`height:120px` → `height: 120px;`)의 공백 차이는 차이가 아니다 */
  const rest = (s) => String(s || '').split(';').map(d => { const i = d.indexOf(':'); return i < 0 ? d.trim() : d.slice(0, i).trim() + ':' + d.slice(i + 1).trim(); })
    .filter(d => d && !NON_EDIT_CSSVARS.some(v => d.startsWith(v + ':'))).join(';');
  return rest(m.oldValue) === rest(m.target.getAttribute('style'));
}
function _isGenNeutral(m) {
  if (m.type === 'attributes' && m.attributeName === 'class') return _classDiffIsRuntimeOnly(m);
  if (_isNonContentUiMutation(m)) return true;
  if (_isParticleMotionMutation(m)) return true;
  if (state._lazyRenderPass && m.type === 'attributes' && (m.attributeName === 'style' || m.attributeName === 'data-lazy-bg')) return true;
  if (m.type === 'attributes' && m.target.nodeType === 1 && (_attrDiffIsNonEdit(m) || (m.attributeName === 'style' && _styleDiffIsNonEditOnly(m)))) return true;
  const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
  if (el && el.closest(CHROME_SEL)) return true;
  if (m.type === 'attributes' && el && el.id === 'canvas') return true;
  return false;
}
function _autoSaveObserverHandle(mutations) {
  for (const m of mutations) if (!_isGenNeutral(m)) { _canvasGen++; break; }   // 같은 꼭대기냐만 본다 — 수가 아니라 «올랐나»
  const meaningful = mutations.some(m => {
    if (m.type === 'attributes' && m.attributeName === 'class') return false;
    // [P-A1″] 저장에서 지워지는 «UI 장식»의 생성/제거는 편집이 아니다 — 같은 목록을 본다.
    if (_isNonContentUiMutation(m)) return false;
    // ★★파티클 «움직임»은 편집이 아니다 (v1.5 ⑴ · 2026-10-09).
    if (_isParticleMotionMutation(m)) return false;
    // lazy 렌더 패스(뷰포트 밖 배경 언로드/복원)가 «자기 mutation 만» 무시하게 한다.
    //   예전엔 lazy-sections 가 _suppressAutoSave 를 통째로 켜서, 그 창에 들어온 «진짜 편집»까지
    //   조용히 버려졌다(저장 예약조차 안 됨). lazy 가 만지는 건 style / data-lazy-bg / class 뿐이라
    //   그 셋만 걸러내면 childList(섹션·블록 추가) 같은 편집은 정상 통과한다.
    if (state._lazyRenderPass && m.type === 'attributes'
        && (m.attributeName === 'style' || m.attributeName === 'data-lazy-bg')) return false;
    // DEF-03: 콘텐츠가 아닌 코스메틱 mutation은 dirty로 치지 않음 —
    // 로드 직후 늦게 도착하는 섹션 툴바 장식·#canvas 자체 attr 변경이
    // 무편집 방문마다 autosave를 유발해 파일을 재기록(updatedAt 오염)하던 문제.
    // (둘 다 직렬화 콘텐츠가 아님: 툴바는 rebind 시 재생성, canvas style은 state.pageSettings가 진실)
    const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
    if (el && el.closest('.section-toolbar')) return false;
    if (m.type === 'attributes' && el && el.id === 'canvas') return false;
    return true;
  });
  if (!meaningful) return;
  scheduleAutoSave();
}
const autoSaveObserver = new MutationObserver(_autoSaveObserverHandle);
/** ★130 — 세대를 «지금» 값으로(대기 중인 변이 기록을 먼저 같은 처리기로 흘린다 — 자동저장 판정도 그대로 받는다). 감시 전이면 null(= 게이트 안 씀). */
window.__canvasGen = () => { if (!_canvasGenLive) return null; const recs = autoSaveObserver.takeRecords(); if (recs.length) _autoSaveObserverHandle(recs); return _canvasGen; };

/* ── Init (called from editor.js after all scripts loaded) ── */
function initApp() {
  // 이미 백업이 있으면 되돌리기 버튼 활성화
  if (localStorage.getItem(LAST_COMMIT_KEY)) {
    const revertBtn = document.getElementById('revert-btn');
    if (revertBtn) revertBtn.classList.add('has-commit');
  }
  applyCanvasBackground(_bgCss(state.pageSettings));
  canvasEl.style.gap = state.pageSettings.gap + 'px';
  canvasEl.style.setProperty('--page-pady', state.pageSettings.padY + 'px');
  // padX: 섹션 물리적 padding 방식으로 적용
  window.applyPagePadX?.(state.pageSettings.padX);
  // 탭 이름 더블클릭 변경 — 탭바 이벤트 위임
  document.getElementById('tab-bar')?.addEventListener('dblclick', e => {
    const nameEl = e.target.closest('.proj-tab-name');
    if (!nameEl) return;
    const tab = nameEl.closest('.proj-tab');
    if (!tab || tab.dataset.id !== activeProjectId) return;
    if (nameEl.isContentEditable) return;   // ★RG-N5c — 편집 중 다시 더블클릭해도 처리기가 겹쳐 붙지 않게(RG-N5 와 같은 꼴)
    const current = nameEl.textContent;
    nameEl.contentEditable = 'true';
    nameEl.focus();
    document.execCommand('selectAll', false, null);
    nameEl.addEventListener('blur', function commit() {
      nameEl.contentEditable = 'false';
      const newName = nameEl.textContent.trim() || current;
      nameEl.textContent = newName;
      setProjectName(newName);
      nameEl.removeEventListener('blur', commit);
      // ★RG-N5c — 나가는 문은 이것 하나(blur): 떼기를 여기서(선례 line-host.js lnBeginEdit finish · drag-utils.js _graphLabelBeginEdit finish).
      //   예전엔 onKey 가 «첫 키 하나» 뒤 스스로 떨어져, 글자를 친 뒤의 Enter/Escape 가 안 먹었다.
      nameEl.removeEventListener('keydown', onKey);
    }, { once: true });
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      if (e.key === 'Escape') { nameEl.textContent = current; nameEl.blur(); }
    }
    nameEl.addEventListener('keydown', onKey);
  });

  // + 드롭다운 — 바깥 클릭 닫기
  document.addEventListener('click', () => {
    document.getElementById('tab-add-wrap')?.classList.remove('open');
  });

  // 프로젝트 로드 (Electron: 파일, 브라우저: localStorage)
  let _loadSeq = null;   // 열림 «확정» 토큰 — 아래 IIFE가 채우고, 실패 catch도 이걸로 닫는다
  (async function initLoad() {
    // [b7] 로딩 오버레이 = index.html의 정적 #proj-loading-overlay(기본 표시). 에디터 첫 페인트(~+0.4s)에
    //   함께 그려져 무거운 로드 전 구간을 덮는다. JS가 show하는 방식(b4/b6)은 무거운 로드 중 새로 추가한
    //   엘리먼트가 style/layout pass를 못 받아 컴포지터에 안 올라가 실패했다(실측: 105MB서 진입~+13s 미표시).
    //   ▶정적 오버레이라 첫 레이아웃에 포함→첫 프레임에 present, 이후 블로킹 동안 컴포지터가 transform
    //     스피너를 계속 회전. JS는 로드 완료/실패 시 닫기만 한다(정적 오버레이는 기본 표시라 항상 닫아야 함).
    // ★363 — 입력을 막는 동안은 덮개도 둔다. 풀 때 load-input-gate 가 닫는다(적용 뒤 무장까지 큰 판은 수 초).
    const _endLoadingOverlay = () => { if (!window.LoadInputGate?.isOn()) window.hideProjectLoadingOverlay?.(); };
    // BL-CDD-08: initLoad는 무거운 프로젝트에서 수 초를 await하는데, 그 사이 CDP 워커/탭 전환이
    // activeProjectId를 바꾸면 아래 apply가 "예전 프로젝트의 DOM"을 새 활성 프로젝트 위에 그리고,
    // 이어지는 autosave가 그 DOM을 새 프로젝트 파일에 저장해 덮어쓴다(무결성 사고).
    // → 진입 시점 id를 캡처하고, await 이후의 모든 apply/initEmpty는 불일치 시 중단한다.
    const _bootProjectId = activeProjectId;
    /* ★342 — 읽히기 전 캔버스는 비었다. 탭 전환이 빈 캐시를 남기고, 편집이 빈 화면을 파일로 썼다(앱 실측 · ~/gd-lane/imac-gd-L1/342d).
       읽히면 풀고, 못 읽었으면 쥔 채 둔다(_bootUnread) — 그 편집은 안 남지만 파일이 남는다(saveProjectToFile 머리말과 같은 판정). */
    let _bootUnread = false;
    let _bootKeptUnreadable = false;   // 부팅 프로젝트가 깨져(proj.json 있는데 못 읽음) LS 본을 남기기만 했다 — 화면엔 안 올린다(지디 결정 ⒝ · 보여주기는 CORRUPT-PROJECT 몫)
    let _bootNoOwner = false;   // 어느 계정인지 모른다 — 누구 것인지 모르는 LS 본을 화면에 안 올린다
    let _bootGone = null, _bootGoneName = null;   // 이번 부팅 프로젝트의 폴더가 앱 밖에서 없어졌으면 그 값(_projectGoneCopy)
    if (_bootProjectId) window.holdTabFirstLoading?.(_bootProjectId);
    const _bootStale = () => {
      if (activeProjectId === _bootProjectId) return false;
      console.warn(`[initLoad] 부트 대상 변경 감지 (boot=${_bootProjectId} now=${activeProjectId}) — 늦은 apply 중단`);
      return true;
    };
    // 열림 «확정» 신호 — 여기서부터가 로드 구간이고, 아래 terminal 경로들이 settle 로 닫는다.
    //   (main 의 open_project 가 이 확정만 기다린다. project-loading.js 헤더 주석의 실측 참조)
    _loadSeq = window.gdtProjectReady?.begin(_bootProjectId, 'boot');
    let _settleDetail = null;
    async function applyAndFinish(data) {
      if (_bootStale()) { _endLoadingOverlay(); return; }
      try {
        applyProjectData(data);
        // #16 이식성: state.pages(scratchpad 매니페스트 포함)가 세팅된 «후» 스크래치 로드/하이드레이션을
        //   재실행한다. 아래 부트 initScratchPad(초기화 섹션)는 async loadProject보다 «먼저» sync 발화하는
        //   레이스라 매니페스트를 못 봐 다른 맥에서 하이드레이션이 누락된다(계측 확인). _loadScratch는
        //   idempotent(gen 토큰으로 늦은 것이 승리)라 재호출 안전.
        window.initScratchPad?.(activeProjectId, state.currentPageId);
      } catch(e) {
        console.error('[initApp] applyProjectData 실패, initEmpty fallback:', e);
        _bootUnread = true;
        initEmpty('apply-error');
      } finally {
        if (!_bootUnread) window.releaseTabFirstLoading?.(_bootProjectId);
        _endLoadingOverlay();
        // ★확정 — 이 시점의 DOM 이 «그 프로젝트»다. 여기 전에 들어온 편집은 방금 교체돼 사라졌다.
        window.gdtProjectReady?.settle(_loadSeq, _bootUnread ? 'error' : 'ready', _settleDetail || (_bootUnread ? 'unread:applied' : 'applied'));   // 못 읽어 쥔 판(LS 본·적용 실패)은 편집 확정이 아니다 — MCP open_project 가 ok 로 받으면 저장 안 되는 판에 편집한다(③)
      }
    }
    function initEmpty(reason) {
      _endLoadingOverlay(); // 로드 실패/빈 프로젝트 폴백 — 오버레이 닫기
      if (_bootStale()) return; // 다른 프로젝트가 이미 활성 — 그 상태를 빈 페이지로 리셋하면 안 됨
      state.pages = [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { ...state.pageSettings }, canvas: '' }];
      state.currentPageId = 'page_1';
      if (!_bootUnread) window.releaseTabFirstLoading?.(_bootProjectId);
      window.buildLayerPanel();
      window.showPageProperties();
      // 빈 프로젝트/폴백도 «편집 가능»한 terminal 상태다 — 확정한다(무엇으로 닫혔는지는 detail 에).
      _settleDetail = (_bootUnread ? 'unread:' : 'empty:') + (reason || 'no-data');
      /* ★OPEN-NULL-EMPTY-BOARD-EDITABLE-01 ③ — 못 읽은 부팅의 빈 판은 «편집 가능» 확정이 아니다(첫 로드를 쥐어 저장도 안 나간다).
         ready 로 닫으면 MCP open_project 가 ok 로 받아 빈 판에 편집 도구를 쓴다 — 탭 열기 실패(_settleErr)와 같게 error 로 닫는다. */
      window.gdtProjectReady?.settle(_loadSeq, _bootUnread ? 'error' : 'ready', _settleDetail);
    }

    // localStorage에서 이전 탭 상태 즉시 복원 (await 전에 탭바 표시)
    try {
      const saved = JSON.parse(localStorage.getItem(TAB_STATE_KEY));
      if (saved?.tabs?.length) openTabs = saved.tabs.slice();
    } catch {}

    if (activeProjectId) {
      // 현재 프로젝트가 탭 목록에 없으면 즉시 추가
      if (!openTabs.find(t => t.id === activeProjectId)) {
        openTabs.push({ id: activeProjectId, name: 'Untitled' });
      }
      // 탭바 즉시 렌더 (async 완료 전에 탭이 보이도록)
      window.renderTabBar();
      window.saveTabState?.();

      let name = 'Untitled';
      if (IS_ELECTRON) {
        // Electron: 프로젝트 목록 1회 로드 — 탭 정리 + autosave 키 정리 병행
        let allProjects = [];
        try {
          allProjects = await window.electronAPI.listProjects();
          /* 폴더가 앱 밖에서 없어진 탭 — LS 본이 있으면 탭과 본을 남긴다(누르면 그 본으로 연다). 없으면 뺀다. */
          const _listed = new Set(allProjects.map(p => p.id));
          const _root = await window.electronAPI.projectsRootKey?.();
          _bootNoOwner = _root === null && await window.electronAPI.projectFolderState?.('') === 'unknown';
          const _away = window.awayTabs?.() || [];   // 다른 계정으로 갈 때 맡긴 탭 — 이 계정 것이면 돌려받는다
          openTabs.push(..._away.filter(t => _listed.has(t.id) && !openTabs.some(o => o.id === t.id)));
          const _goneTabs = await Promise.all(openTabs.filter(t => !_listed.has(t.id)).map(async t => ({ t, g: await window.projectGoneCopy(t.id) })));
          const _keptIds = _goneTabs.filter(x => x.g?.data || x.g?.state === 'unknown').map(x => x.t.id);   // 못 읽은 것은 없어진 게 아니다 — 탭과 본을 그대로 둔다
          const _bootG = _goneTabs.find(x => x.t.id === _bootProjectId)?.g || null;   // 기다리는 사이 다른 탭으로 갔어도 판정 대상은 부팅한 프로젝트다
          _bootGone = _bootG?.state === 'unknown' ? null : _bootG;
          _bootGoneName = openTabs.find(t => t.id === _bootProjectId)?.name;
          window.setAwayTabs?.([..._away.filter(t => !_listed.has(t.id) && !_goneTabs.some(x => x.t.id === t.id)), ..._goneTabs.filter(x => x.g?.state === 'foreign').map(x => ({ id: x.t.id, name: x.t.name }))]);
          /* 실패 표지 id — LS 본이 있고 폴더가 그대로(목록에만 없음: 기획 등)면 남긴다. 지웠거나(휴지통·없음) 본이 없으면 표지를 걷는다. */
          _listed.forEach(id => _listedAtBoot.add(id));
          const _failedKeep = [];
          /* 지디 결정 ⒝ — 그 id 의 비상 사본이 있으면(다음 실행 복구 제안이 그걸 가진다) 보호를 푼다. 못 물으면(IPC 실패) 보호 유지. */
          let _withCopy = null;
          if (_failedSaveIds().length) {
            try {
              const _p = await window.electronAPI.recovery?.pending?.();
              if (_p && _p.ok === true && Array.isArray(_p.items)) {
                _withCopy = new Map();   // id → 가장 새 사본 시각(ms)
                for (const x of _p.items) if (x && x.kind === 'save-failure' && x.emergencyExists && x.projectId) { const at = Date.parse(x.at) || 0; if (at > (_withCopy.get(x.projectId) || 0)) _withCopy.set(x.projectId, at); }
              }
            } catch (_) {}
          }
          for (const id of _failedSaveIds()) {
            if (_listed.has(id) || localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}`) === null) continue;
            const _owner = window.lsCopyOwner?.(id);
            if (_owner && _owner !== (_root || 'legacy')) { _failedKeep.push(id); continue; }
            let _thisSession = false; try { _thisSession = (JSON.parse(sessionStorage.getItem(RECORDED_THIS_SESSION_KEY) || '[]') || []).includes(id); } catch (_) {}
            if (_withCopy && !_thisSession && (_withCopy.get(id) || 0) >= (parseInt(localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}_ts`) || '0') || Infinity)) continue;   // LS 본보다 새롭거나 같은 사본이 있다 — LS 는 옛 동작(정리)으로 · 사본이 더 낡았거나 LS 시각을 모르면 지킨다   // 다른 계정의 본 — 이 뿌리의 폴더 상태로 걷으면 그 계정으로 돌아왔을 때 지운다(리뷰: X→Y→X)
            const st = await window.electronAPI.projectFolderState?.(id);
            if (st === 'ok' || st === 'unknown') _failedKeep.push(id);   // 못 읽었으면 지운 게 아니다 — 남긴다
          }
          _setFailedSaveIds(_failedSaveIds().filter(id => localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}`) !== null && (_listed.has(id) || _failedKeep.includes(id))));
          /* ★BOOT-CLEANUP-WIPES-CORRUPT-PROJECT-LS-01 — 목록 밖이라도 proj.json 이 있는데 못 읽는(깨짐·후보 0) id 의 LS 본은 남긴다: 성한 마지막 사본일 수 있다.
             부팅 프로젝트 자신도 같다. 못 물으면(창구 없음·던짐) 남긴다. 기획·없음은 지금 규칙 그대로. */
          const _keepSoFar = new Set([..._listed, ..._keptIds, ..._failedKeep, ...(_root ? (window.foreignLsIds?.(_root) || []) : [])]);
          const _askIds = [...new Set([
            ...Object.keys(localStorage).filter(k => k.startsWith(`${SAVE_KEY_PREFIX}__`) && !k.endsWith('_ts')).map(k => k.slice(SAVE_KEY_PREFIX.length + 2)),
            ...Object.keys(localStorage).filter(k => k.startsWith(LS_PENDING_PREFIX)).map(k => k.slice(LS_PENDING_PREFIX.length).replace(/__\d+$/, '')),   // 보류 본만 남은 id 도 묻는다 — 안 물으면 못 읽는 동안 정리가 그 사본을 지웠다(LS-NEWER 리뷰 3-1)
          ])].filter(id => !_keepSoFar.has(id));
          const _states = await Promise.all(_askIds.map(id => Promise.resolve().then(() => window.electronAPI.projectReadState ? window.electronAPI.projectReadState(id) : 'unknown').catch(() => 'unknown')));   // 한꺼번에 묻는다 — 부팅 로드 앞이다(리뷰 1-5)
          const _unreadableKeep = _askIds.filter((id, i) => _states[i] === 'unreadable' || _states[i] === 'unknown');
          _bootKeptUnreadable = _askIds.some((id, i) => id === _bootProjectId && _states[i] === 'unreadable');   // 못 물은(unknown) 것은 숨기지 않는다 — 읽히는 프로젝트일 수 있다(리뷰 2-2)
          if (await window.electronAPI.projectFolderState?.('') !== 'unknown') cleanStaleAutosaveKeys([..._keepSoFar, ..._unreadableKeep]);   // 뿌리를 못 읽으면 목록이 빈 게 당연하다 — 안 지운다
          _goneTabs.filter(x => x.g?.state === 'missing' && !x.g.data && x.t.id !== activeProjectId).forEach(x => window.showStatusToast?.(window.deletedTabNotice?.(x.t.name, false)));
          // 삭제된 프로젝트 탭 정리 (현재 프로젝트는 항상 유지)
          const existingIds = new Set([..._listed, ..._keptIds]);
          existingIds.add(activeProjectId);
          openTabs = openTabs.filter(t => existingIds.has(t.id));
          if (!openTabs.find(t => t.id === activeProjectId)) {
            openTabs.push({ id: activeProjectId, name: 'Untitled' });
          }
        } catch (_) {}
        // proj + meta 병렬 로드 — meta 실패해도 proj는 사용해야 하므로 독립 처리
        let proj = null;
        try { proj = await loadProjectForOpen(activeProjectId); } catch(e) { // {open:true}: 열 때 외부화 정책 대상 · ★E170 복구 알림도 그 안
          console.error('[initLoad] loadProject 실패:', e);
          _bootUnread = true;
        }
        const meta = await window.electronAPI.loadProjectMeta(activeProjectId).catch(() => null);
        // 시맨틱 컬러 변수 복원 (meta.colorVars → localStorage + :root). 비차단.
        window.DesignSystem?.restoreColorVarsFromMeta?.(activeProjectId);
        window.DesignSystem?.restoreColorHistoryFromMeta?.(activeProjectId);   // 최근 쓴 색 — 프로젝트별(meta 에 없으면 빈 목록)
        window.DesignSystem?.restoreTextStyleHistoryFromMeta?.(activeProjectId); // 최근 «효과» — ★같은 자리·같은 규약(meta 에 없으면 빈 목록)
        window.DesignSystem?.restoreQuoteShapesFromMeta?.(activeProjectId);     // 인용구 ★사용자 부호 — ★같은 자리·같은 규약(meta 에 없으면 빈 목록)
        if (proj) {
          // GAP-004: proj.json 손상 복구 통지는 loadProjectForOpen 이 «한 곳»에서 한다(★E170 — 탭 열기 길도 같은 글).
          // 마이그레이션: proj.json에 branches/commits가 남아있으면 meta로 이전
          if (!meta && (proj.branches || proj.commits)) {
            const migratedMeta = {
              ...(proj.branches    ? { branches: proj.branches, currentBranch: proj.currentBranch } : {}),
              ...(proj.commits     ? { commits: proj.commits }     : {}),
              ...(proj.thumbnail   ? { thumbnail: proj.thumbnail } : {}),
              updatedAt: new Date().toISOString(),
            };
            window.electronAPI.saveProjectMeta(activeProjectId, migratedMeta).catch(() => {});
            // proj.json에서 meta 필드 제거하여 경량화
            const cleanProj = { ...proj };
            delete cleanProj.branches; delete cleanProj.currentBranch;
            delete cleanProj.commits; delete cleanProj.thumbnail;
            window.electronAPI.saveProject(cleanProj).catch(() => {});
          }
          name = proj.name || 'Untitled';
        }
        // proj null이어도 탭바는 반드시 렌더 (이름은 Untitled로 유지)
        const tab = openTabs.find(t => t.id === activeProjectId);
        if (tab && (proj || !_bootGone)) tab.name = name;
        window.renderTabBar();
        window.saveTabState?.();
        if (proj) {
          // DBG-REFRESH: 프로젝트별 키로 localStorage 조회 — 다른 프로젝트 데이터 오염 방지
          // localStorage가 파일보다 새로우면 우선 적용 (새로고침 데이터 손실 방지)
          // 단, 파일 페이지 수가 더 많으면 파일 우선 (meta 오류 등으로 인한 1페이지 오염 방지)
          const _lsData = _pickLsOverFile(proj, _bootProjectId);
          if (_lsData) {
            const _afterLs = _prepareLsWin(_lsData, proj, _bootProjectId);
            applyAndFinish(_lsData).then(() => _afterLs(() => !_bootStale()));
            return;
          }
          if (proj.version === 2 && proj.pages) { applyAndFinish(proj); return; }
          // v1 snapshot: 파싱 실패 시 return하지 않고 아래 localStorage fallback으로 진행
          if (proj.snapshot) {
            try {
              applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot);
              return;
            } catch (e) {
              console.error('[initLoad] v1 snapshot 파싱 실패, localStorage fallback:', e);
              _bootUnread = true;
            }
          }
        }
      } else {
        // 브라우저: localStorage 프로젝트 목록으로 고아 autosave 키 정리
        const allList = loadProjectsList();
        cleanStaleAutosaveKeys(allList.map(p => p.id));
        const proj = allList.find(p => p.id === activeProjectId);
        if (proj?.name) {
          name = proj.name;
          const tab = openTabs.find(t => t.id === activeProjectId);
          if (tab) tab.name = name;
        }
        window.renderTabBar();
        window.saveTabState?.();
        if (proj?.snapshot) {
          try {
            applyAndFinish(typeof proj.snapshot === 'string' ? JSON.parse(proj.snapshot) : proj.snapshot);
            return;
          } catch (e) {
            console.error('[initLoad] 브라우저 snapshot 파싱 실패, localStorage fallback:', e);
          }
        }
      }
    } else {
      // URL에 project 없이 열림 (admin mode): 탭 유지하고 렌더만
      window.renderTabBar();
      window.saveTabState?.();
    }
    /* 부팅을 기다리는 사이 다른 탭으로 갔다(앱 재현 3/3) — 없어진 건 부팅한 프로젝트다. 활성 탭을 닫으면 멀쩡한 탭이 닫힌다. 화면은 그 탭 것이니 건드리지 않는다. */
    if (_bootGone && _bootStale()) {
      if (!_bootGone.data) window.closeDeletedProjectTab?.(_bootProjectId, _bootGone.state === 'foreign' ? { notice: window.foreignTabNotice?.(_bootGoneName), keepLs: true } : undefined);
      initEmpty();
      return;
    }
    if (_bootKeptUnreadable) _bootUnread = true;   // 겹침 그물 — 열기가 못 읽음으로 안 던진 드문 꼴(id 가 폴더와 다름 등)에도 첫 로드를 쥔다(리뷰 4-3)
    const saved = _bootNoOwner || _bootKeptUnreadable || (_bootGone && !_bootGone.data) ? null : localStorage.getItem(getSaveKey());   // 앱 휴지통의 프로젝트는 본으로 안 연다
    if (saved) { try { applyAndFinish(JSON.parse(saved)); if (_bootGone) { const _t = openTabs.find(t => t.id === _bootProjectId); if (_t) _t._goneCopy = true; window.showStatusToast?.(window.missingFolderNotice?.(_bootGoneName)); } return; } catch {} }
    initEmpty();
    if (_bootGone) window.closeDeletedProjectTab?.(_bootProjectId, _bootGone.state === 'foreign' ? { notice: window.foreignTabNotice?.(_bootGoneName), keepLs: true } : undefined);   // 열 것이 없다 — 말없는 빈 탭 대신 닫고 알린다
  })().catch(e => {
    // [b7] 페일세이프: initLoad 본문이 예기치 못한 예외로 종료되면 정적 로딩 오버레이가 화면에
    //   영원히 남는다(기본 표시 상태이므로). 모든 정상 경로는 applyAndFinish.finally / initEmpty에서
    //   닫지만, 미처리 예외 시에도 반드시 닫는다.
    console.error('[initLoad] 처리되지 않은 오류 — 로딩 오버레이 강제 종료:', e);
    window.hideProjectLoadingOverlay?.();
    // 대기자(main open_project)를 영원히 매달아 두지 않는다 — «실패»로 정직하게 닫는다.
    window.gdtProjectReady?.settle(_loadSeq, 'error', 'initLoad-threw:' + ((e && e.message) || e));
  });

  // class 변경은 콜백에서 필터링, data-* 등 실제 속성 변경은 감지 (DBG-11 해소)
  autoSaveObserver.observe(canvasEl, { childList: true, subtree: true, characterData: true, attributes: true, attributeOldValue: true });   // ★130 attributeOldValue — class 토큰 차이(런타임 마커만인가)를 보려고
  _canvasGenLive = true;

  // 스크래치패드 초기화
  window.initScratchPad?.(activeProjectId, state.currentPageId);

  // 브랜치 시스템 초기화
  initBranchStore();
  setTimeout(() => window.applyMainLock(getCurrentBranch()), 100);

  // File 탭 섹션 토글
  window.initFileTabToggle();

  // 템플릿 패널 초기 렌더 (파일 로드 후)
  initTemplates().then(() => {
    window.renderTemplatePanel();
    if (window.initTemplateBrowser) window.initTemplateBrowser();
  });

  // Cmd+G 그룹 / Cmd+Option+G 프레임 — capture phase로 브라우저 Find Next 보다 먼저 처리
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyG' && !e.shiftKey) {
      if (e.target.isContentEditable) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.altKey || window._optionKeyHeld || e.key === '©') {
        window.wrapSelectedBlocksInFrame?.();
      } else if (typeof window._scratchHasSelection === 'function' && window._scratchHasSelection()) {
        // 스크래치 다중 선택 상태면 스크래치 그룹 정렬 우선 — editor.js Cmd+G 분기와 동일 우선순위.
        // (이 capture 핸들러가 stopImmediatePropagation으로 이벤트를 삼키므로 여기서 직접 분기해야 함)
        window._scratchGroupAndAlign?.();
      } else {
        groupSelectedBlocks();
      }
    }
  }, true);

  // 초기 스냅샷
  pushHistory();

  /* 캔버스 — 섹션 드래그 드롭 */
  // rAF throttle: getBoundingClientRect()를 매 픽셀마다 호출하지 않도록 (DBG-11)
  let _sectionDragRafId = null;
  canvasEl.addEventListener('dragover', e => {
    if (!sectionDragSrc) return;
    e.preventDefault();
    if (_sectionDragRafId) return;
    const clientY = e.clientY;
    _sectionDragRafId = requestAnimationFrame(() => {
      _sectionDragRafId = null;
      clearSectionIndicators();
      const after = getSectionDragAfterEl(canvasEl, clientY);
      const indicator = document.createElement('div');
      indicator.className = 'section-drop-indicator';
      if (after) canvasEl.insertBefore(indicator, after);
      else canvasEl.appendChild(indicator);
    });
  });
  canvasEl.addEventListener('dragleave', e => {
    if (!sectionDragSrc) return;
    if (!canvasEl.contains(e.relatedTarget)) clearSectionIndicators();
  });
  canvasEl.addEventListener('drop', e => {
    if (!sectionDragSrc) return;
    e.preventDefault();
    window.pushHistory();
    const indicator = canvasEl.querySelector('.section-drop-indicator');
    // variation group이면 같은 그룹의 variant 전체를 묶음 이동 (DRAG-VAR-01)
    const groupId = sectionDragSrc.dataset.variationGroup;
    const toMove = groupId
      ? [...canvasEl.querySelectorAll(`.section-block[data-variation-group="${groupId}"]`)]
          .sort((a, b) => ['A','B','C','D','E'].indexOf(a.dataset.variation) - ['A','B','C','D','E'].indexOf(b.dataset.variation))
      : [sectionDragSrc];
    if (indicator) {
      toMove.forEach(sec => canvasEl.insertBefore(sec, indicator));
    } else {
      toMove.forEach(sec => canvasEl.appendChild(sec));
    }
    clearSectionIndicators();
    window.buildLayerPanel();
    sectionDragSrc = null;
    // FIX-SD-02: drop 시점에 _suppressAutoSave=true (dragend 아직 미발화)
    // MutationObserver가 scheduleAutoSave를 억제하므로 drop 직후 명시적으로 저장 트리거
    /* ★[H6] 예전엔 여기서 플래그에 «직접» false 를 썼다. 그런데 그 억제를 «켠» 것은
     *   section-drag 의 _suppressDragSave 다 — 켠 쪽 모르게 끄면 그쪽 토큰이 열린 채 남고,
     *   뒤늦게 오는 dragend 가 «남의» 억제 창을 닫는다. 켠 쪽에게 닫게 한다. */
    _resumeDragSave();
    scheduleAutoSave();
  });
}

export {
  // 탭 함수: tab-system.js에서 window 노출 처리 (여기서는 저장/불러오기 핵심만)
  cleanStaleAutosaveKeys,
  safeLocalStorageSet,
  saveProjectToFile,
  loadProjectsList,
  getProjectName,
  setProjectName,
  goHome,
  getCurrentPage,
  flushCurrentPage,
  switchPage,
  addPage,
  deletePage,
  getSerializedCanvas,
  serializeProject,
  applyProjectData,
  applyPageSettings,
  rebindAll,
  scheduleAutoSave,
  initApp,
};

// Backward compat — 탭 함수는 tab-system.js에서 window 노출 처리
// (saveTabState, renderTabBar 등 window.* 할당은 tab-system.js에서 수행)
window.saveProjectToFile = saveProjectToFile;
/* ★연 채 삭제 — main 이 휴지통으로 옮기기 전에 부른다. 보는 탭의 밀린 편집 · 옆 탭의 저장 실패분을 내리고 돌던 저장을 기다린다. */
window.flushProjectBeforeTrash = async (id) => {
  const tab = openTabs.find(t => t.id === id);
  if (!tab || window.isTabFirstLoading?.(id)) return;
  const _active = id === activeProjectId;
  /* ★NEW-TRASH-FROM-GALLERY-DROPS-FAILED-EDIT-01 — «보는 탭인데 마지막 저장이 실패»도 아래 옆 탭 갈래(TRASH-FLUSH)로 보낸다.
     옛: 보는 탭이면 판 검사 없이 지금 본으로 다시 썼다 — 밖에서 새로워진 파일을 덮고, 그 쓰기마저 실패하면 사본 없이 휴지통 뒤 LS 를 지워(closeDeletedProjectTab) 편집을 잃었다.
     본만 다르다: 보는 탭 = 지금 캔버스(serializeProject) · 옆 탭 = 탭 캐시. 판정·사본 길은 한 벌 그대로. */
  if (_active && !_lastSaveFailed(id)) {
    if (_hasOwnUnsaved()) {
      if (autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
      await saveProjectToFile(serializeProject(), { skipThumbnail: true, projectId: id });
    }
  } else if (_lastSaveFailed(id) && (_active || tab._cache)) {
    if (_active && autoSaveTimer) { clearTimeout(autoSaveTimer); autoSaveTimer = null; }
    const _body = _active ? serializeProject() : tab._cache;
    /* ★TRASH-FLUSH-STALE-CACHE-OVERWRITES-NEWER-FILE-01 — 실패 뒤 파일이 «밖에서» 새로워졌으면(MCP·버전 복원 등) 그 캐시로 안 덮는다:
       덮인 판이 그대로 휴지통에 들어갔다. 판정 = 지금 파일의 updatedAt 이 이 렌더러가 마지막으로 열거나 쓴 판(ls-base · preload _noteFileVersion)과 다르다.
       판을 모르거나 못 읽으면 밖에서 바뀐 쪽으로 친다. 그때는 비상 사본만(닫기·종료와 같은 길 · 같은 실패는 한 번만).
       안 바뀌었으면 옛 동작대로 다시 써서 편집이 프로젝트와 함께 휴지통에 간다(리뷰 1 ① — 사본만 두면 5칸 비상 사본에서 밀려 지워질 수 있다). 다시 쓰기도 실패하면 사본. */
    let _outside = true;
    try { const f = await window.electronAPI?.loadProject?.(id); const base = localStorage.getItem(`web-editor-ls-base__${id}`); _outside = !f || base == null || String(f.updatedAt) !== base; } catch (_) {}
    let _settled = true;
    if (!_outside) { await saveProjectToFile(_body, { skipThumbnail: true, projectId: id }); _settled = await _waitSavesFor(id, 3000); }
    /* 다시 쓰기가 3초 안에 안 끝났으면(줄 뒤) 기다리지 않고 지금 사본을 남긴다 — main 은 5초만 기다리고 옮긴 뒤엔 줄의 저장이 project_deleted(실패 아님)라 사본이 안 남았다(리뷰 2) */
    if (_outside || !_settled || _lastSaveFailed(id)) await window.keepFailedCopyOnClose(id, tab.name, _body, _settled ? undefined : 0);
  }
  const until = Date.now() + 5000;
  while (Date.now() < until && (_isSavingToFile || _pendingSaves.has(id))) await new Promise(r => setTimeout(r, 25));
};
/* 탭을 닫았다 — 그 프로젝트의 저장이 끝나길 기다려, 실패로 끝났으면 그 본을 main 에 넘겨 마커·비상 사본으로 남긴다.
   까닭: 거절된 본은 LS 에만 있고, 닫은 탭은 종료 flush·beforeunload 가 안 본다. 기획 id 는 목록에 없어 다음 부팅의 고아 정리가 LS 를 지웠다(앱 L1 C17 ×1 · REFUSED-SAVE-THEN-CLOSE-TAB-EDIT-LOST-01).
   거절 사유는 안 가린다 — 실패로 끝난 저장이면 다 남긴다(지워진 프로젝트는 skipped 라 실패가 아니다). 기다림이 상한을 넘으면 끝을 모르니 남긴다(잃는 쪽보다 헛 복구 제안이 낫다). */
window.keepFailedCopyOnClose = async (id, name, cache, waitMs) => {   // waitMs: 기다림 상한(기본 15초) — 0 이면 돌던 저장을 안 기다리고 «모름(unconfirmed)»으로 곧장 남긴다
  if (!IS_ELECTRON || !id || !window.electronAPI?.recordRefusedSave) return false;
  const settled = await _waitSavesFor(id, waitMs ?? 15000);
  const last = _lastSaveResult.get(id);
  if (settled && !_lastSaveFailed(id)) return false;
  if (settled && last?.kept) return false;   // 같은 실패를 이미 남겼다 — 무편집으로 열고 닫기를 되풀이하면 사본이 쌓여 5칸을 나눠 쓰는 남의 사본을 밀어냈다(리뷰)
  let data = null;
  try { data = JSON.parse(cache || localStorage.getItem(`${SAVE_KEY_PREFIX}__${id}`)); } catch (_) {}
  const _warn = () => window.showToast?.('⚠️ 저장 실패: 닫은 탭의 편집을 비상 사본으로 남기지 못했습니다 — 디스크 공간·폴더 권한을 확인해 주세요');
  if (!data || !Array.isArray(data.pages)) { if (settled) _warn(); return false; }   // 실패는 확인됐는데 남길 본이 없다 — 말없이 끝내지 않는다
  applyAdoptedAssets(data, id);   // 줄의 본은 옮기기 전에 찍혔을 수 있다 — 사본이 옛 주소면 그 프로젝트를 지운 뒤 그림이 빠진다(_flushUnfinishedSavesSync 와 같은 까닭)
  const reason = settled ? (_lastSaveResult.get(id)?.result?.reason || 'save-failed') : 'unconfirmed';
  let r = null;
  try { r = await window.electronAPI.recordRefusedSave({ ...data, id, name: name || 'Untitled' }, reason); }
  catch (e) { console.warn('[save-load] 거절된 본을 남기지 못했다:', e && e.message); }
  if (r?.ok) { if (last && settled) last.kept = true; try { const ss = JSON.parse(sessionStorage.getItem('web-editor-failed-recorded-session') || '[]'); if (Array.isArray(ss) && !ss.includes(id)) sessionStorage.setItem('web-editor-failed-recorded-session', JSON.stringify([...ss, id])); } catch (_) {} return true; }   // 같은 실행 안 부팅이 이 사본으로 보호를 안 풀게(리뷰 3-2)
  /* 사본도 못 남겼다(디스크 가득·권한) — 닫은 탭은 종료 때 아무도 안 보니 말없이 잃는다. 닫기는 그대로, 알리기만(지디 결정 ⒜) */
  _warn();
  return false;
};
/* 옆 탭에 저장 안 된 편집이 남았나 — 탭을 닫을 때 알림 문구에 쓴다. */
window.projectSaveUnsettled = (id) => _lastSaveFailed(id) || _pendingSaves.has(id) || (_isSavingToFile && _savingOwnerId === id);
window.projectLastSaveFailed = (id) => _lastSaveFailed(id);   // 읽기만 — 협업이 «미저장 편집을 지키며 상대 패치를 미룰지»를 가른다(COLLAB-SYNC-OLD-GAPS ⑴)
window.isReloadSealedFor = (id) => _isReloadSealed(id);   // 읽기만 — ⌘S 가 «봉인이라 안 썼다»를 «저장됨»으로 말하지 않게(FLUSH-EMPTY · 지디 조건 ③)
window.loadProjectsList = loadProjectsList;
window.getProjectName = getProjectName;
window.setProjectName = setProjectName;
window.goHome = goHome;
window.getCurrentPage = getCurrentPage;
window.flushCurrentPage = flushCurrentPage;
window.switchPage = switchPage;
window.addPage = addPage;
window.deletePage = deletePage;
window.getSerializedCanvas = getSerializedCanvas;
window.serializeProject = serializeProject;
window.applyProjectData = applyProjectData;
window.applyPageSettings = applyPageSettings;
window.rebindAll = rebindAll;
/* ★CLONE-RERENDER-01 — «다시 그릴 종류» 한 벌의 창구. 소비자(section-variation.js · panels/template-system.js · editor.js)는
   이 창구로 부르고, ⛔없으면 ?. 로 건너뛰지 말고 던진다(«안 그림»이 조용히 초록으로 숨지 않게 — 발주 ⒠). */
window.rerenderBlock = rerenderBlock;
window.rerenderTree = rerenderTree;
window.RERENDER_KIND_CLASSES = Object.freeze(RERENDER_KINDS.map(([c]) => c));
window.scheduleAutoSave = scheduleAutoSave;
window.triggerAutoSave = scheduleAutoSave; // alias used by drag-drop.js, prop-layout.js

// 즉시 저장 (디바운스 없이 flush) — commit-system.js 저장하기 버튼 전용
// saveProjectToFile 경로를 우회하고 IPC를 직접 호출해 _isSavingToFile 락 문제 방지
window.flushSave = async function() {
  if (window.isTabFirstLoading?.(activeProjectId)) return;   // ★361 — saveProjectToFile 머리말 · 이 길은 그 함수를 안 탄다
  /* ★FLUSH-EMPTY-QUEUE-SKIPS-INFLIGHT-01 — ⌘S 가 이 문을 부르게 되며(옛: «저장하기» 단추만) 자동저장 타이머 길과 «같은 문»으로 맞춘 넷(적대 리뷰 1):
     ⓓ 되돌림 봉인 중엔 안 쓴다(타이머 길은 봉인 동안 억제돼 안 돌았다 — 여기서 옛 캔버스를 LS 에 새 시각으로 쓰면 다시 읽기가 그 본을 고른다)
     ⓐ LS 는 safeLocalStorageSet(큰 본 건너뜀·자리 비우기) — 날 setItem 은 큰 본에서 던져 «파일 저장까지 못 가» ⌘S 편집을 그대로 잃었다
     ⓑ 저장 «뒤» gd:project-saved(협업 공유 · 타이머 길 :2508 과 같은 꼴) — 안 쏘면 «미저장 없음»인데 공유도 안 돼 상대 패치가 ⌘S 편집을 덮었다
     ⓒ 타이머를 걷었으니 그 «저장 대기» 붙들기(_holdBackground)도 끝에서 푼다(새 타이머가 걸렸으면 그쪽 몫) */
  if (_isReloadSealed(activeProjectId)) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
  try {
    const _snapAt = performance.now();
    let snap = serializeProject();
    let data;
    try {
      data = JSON.parse(snap);
      if (_emptySaveBlocked(data, activeProjectId)) { _setAutosaveIndicator('saved'); return; }   // 타이머 길과 같이 «저장 중…»을 걷는다(FLUSH-SAVE-STATUS-STUCK-SAVING-01 · 타이머를 지웠으니 아무도 안 걷는다)
      if (applyAdoptedAssets(data, activeProjectId)) snap = JSON.stringify(data);   // 자동저장과 같은 까닭
    } catch { _setAutosaveIndicator('error'); return; }
    if (safeLocalStorageSet(getSaveKey(), snap)) localStorage.setItem(getSaveTsKey(), String(Date.now()));
    const _targetId = window.activeProjectId;
    if (window.IS_ELECTRON && _targetId) {
      let r;
      try { r = await _saveInLine(data, _targetId); } catch (_) { _setAutosaveIndicator('error'); return; }
      /* ★FLUSH-SAVE-STATUS-STUCK-SAVING-01(미카사 실앱) — 실패면 상태줄을 «⚠️ 저장 실패»로(타이머 길 _isSaveFailure ? 'error' 와 같음).
         옛: 토스트만 믿고 돌아가 편집 때 건 «저장 중...»이 그대로 남았다 — ⌘S 가 타이머를 지웠으니 아무도 안 걷어 사용자가 실패를 몰랐다. */
      if (r && r.reason === 'save_wait_timeout') return;   // 줄 뒤에서 아직 도는 중 — «저장 중…»이 참이다(빨강을 걸면 나중에 성공해도 안 걷힌다 · 리뷰)
      if (_isSaveFailure(r)) { _setAutosaveIndicator('error'); return; }   // 실패 토스트는 _doSaveProjectToFile 이 띄웠다
      if (r && r.ok === false) { _setAutosaveIndicator('saved'); return; }   // 건너뜀(지운 프로젝트·봉인 등)은 공유 안 함 — 표시는 타이머 길처럼 «저장 중…»을 걷는다(타이머를 지웠으니 아무도 안 걷는다 · 리뷰 3)
    }
    _setAutosaveIndicator('saved');
    try { window.dispatchEvent(new CustomEvent('gd:project-saved', { detail: { projectId: _targetId, snap, snapAt: _snapAt } })); } catch (_) {}
  } finally {
    if (!autoSaveTimer) _holdBackground(false);
  }
};
/* 자동저장과 같은 줄에 서서 저장하고 그 프로젝트의 줄이 빌 때까지 기다린다 — 따로 읽고 쓰면 앞 저장의 옛 본이 뒤 저장을 덮는다(RENDERER-LOAD-SAVE-ROUNDTRIP · 앱 값).
   큐에 들어가면 결과가 undefined 라 드레인 뒤 마지막 결과를 읽는다. 상한을 넘기면 실패로 친다: 저장됐다고 말할 근거가 없다. */
async function _saveInLine(snapshot, id, opts = {}) {
  const r = await saveProjectToFile(snapshot, { ...opts, projectId: id, skipThumbnail: true });
  if (r !== undefined) return r;
  if (!(await _waitSavesFor(id))) return { ok: false, reason: 'save_wait_timeout' };
  return _lastSaveResult.get(id)?.result;
}
window.saveInLine = _saveInLine;
// DEF-03: 탭 전환 등에서 "변경 없으면 저장 생략" 판정용
window.hasUnsavedChanges = _hasOwnUnsaved;
// [externalize] 되돌리기/리로드 직전 «autosave 봉인»(F4) — 아래 세 경로를 비우고, 봉인 동안 그 프로젝트의 새 파일 저장·닫기·종료 저장은 _isReloadSealed 로 막는다:
//   ⓐ 큐잉된 autoSaveTimer(발화 콜백이 _suppressAutoSave를 재검사 안 함) → clearTimeout.
//   ⓑ 대기열 _pendingSaves(in-flight의 finally가 FIFO 드레인) → clear.
//   ⓒ ★in-flight _isSavingToFile(진행 중 저장이 IPC await 중) → 완료까지 «드레인 대기».
// 이 셋을 안 비우면: 되돌리기가 파일 복원+backup unlink 후 in-flight/큐 저장이 도착 → 복원 proj.json을
//   변환본으로 재덮고(=되돌리기 조용히 무효), backup은 이미 소비돼 복구 지점이 영구 소멸한다.
// 되돌리기는 «현재 작업을 의도적으로 버리는» 동작이라 flush 없이 봉인만 한다. async — 호출측이 await.
// 봉인 직전 dirty 값 — 되돌리기 실패/reload 차단 시 «봉인 전 상태»로 정확히 복원(무편집이었으면 재저장 안 함).
let _dirtyBeforeSeal = false;
let _reloadSealTok = null;                               // [H6] 봉인 토큰 — resume 이 «내 것만» 닫는다
let _reloadSealId = null;                                // 봉인한 프로젝트 — 그 파일에 가는 저장만 막는다
window.cancelPendingAutoSaveForReload = async (targetId) => {
  /* ★[H6] 봉인도 토큰으로 — 이 창은 «의도적으로» 함수 밖까지 열려 있다(되돌리기가 끝날 때까지).
   *   그래서 try/finally 로 못 닫는다. 대신 ⑴ resume 이 «내 것만» 닫고
   *   ⑵ 되돌리기가 도중에 죽어 resume 이 영영 안 오면 감시견이 «알린다». */
  if (!_reloadSealTok) _reloadSealTok = window.AutoSaveSuppress.begin('reload-seal');
  _reloadSealId = targetId || null;
  clearTimeout(autoSaveTimer); autoSaveTimer = null;
  _dirtyBeforeSeal = _dirtySinceSave || _autoSavePending;  // 봉인 직전 값 캡처(③ 부작용 방지) · 미룸에 기억된 예약도 편집이다
  _autoSavePending = false;                                // ★250D — 안 지우면 _hasOwnUnsaved 가 «미저장»으로 읽어 beforeunload 가 복원본을 덮는다
  clearPendingForReload(_pendingSaves, targetId);         // ⓑ ★되돌리기 대상만 폐기(타 프로젝트 저장 보존, 구멍2)
  _dirtySinceSave = false;
  // ⓒ in-flight 저장 드레인 대기(상한 5s — 무한대기 방지). 봉인 상태라 새 저장은 큐잉 안 됨.
  const _deadline = Date.now() + 5000;
  while (_isSavingToFile && Date.now() < _deadline) { await new Promise(r => setTimeout(r, 25)); }
  clearPendingForReload(_pendingSaves, targetId);         // 드레인 도중 재적재분 → 대상만 한 번 더
  return isDrainSettled(_isSavingToFile);                 // ★false=드레인 타임아웃 → 호출측이 되돌리기 중단(구멍1)
};
// [externalize] 되돌리기 «실패»·«성공인데 reload 차단» 시 봉인 해제 + 편집 복구(F4 후속·신규회귀 방지) —
//   봉인이 타이머 취소로 LS 기록도 없앴으므로, DOM에만 남은 직전 편집을 다시 dirty로 표시하고 autosave를
//   재무장한다. 안 하면 beforeunload 가드(!_dirtySinceSave && !autoSaveTimer)가 조기 return → Cmd+R 시 소실.
//   ★dirty는 «봉인 직전 값»으로만 복원한다(무조건 true면 무편집 방문도 updatedAt 오염+협업 발화 — ③ 부작용).
window.resumeAutoSaveAfterAbortedReload = () => {
  if (_reloadSealTok) { window.AutoSaveSuppress.end(_reloadSealTok); _reloadSealTok = null; _reloadSealId = null; }
  _dirtySinceSave = _dirtyBeforeSeal;
  if (_dirtyBeforeSeal) { try { scheduleAutoSave(); } catch (_) {} }  // 편집이 있었을 때만 재무장
  _dirtyBeforeSeal = false;
};
window.initApp = initApp;

// branch-system.js, commit-system.js 등 다른 모듈에서 참조하는 변수들 노출
window.IS_ELECTRON = IS_ELECTRON;
// BUG4: _persistBranchesToFile에서 race condition 감지용 — getter로 읽기 전용 노출
Object.defineProperty(window, '_isSavingToFile', {
  get: () => _isSavingToFile,
  configurable: true,
});
Object.defineProperty(window, 'activeProjectId', {
  get: () => activeProjectId,
  set: (v) => { activeProjectId = v; },
  configurable: true,
});
Object.defineProperty(window, 'openTabs', {
  get: () => openTabs,
  set: (v) => { openTabs = v; },
  configurable: true,
});
Object.defineProperty(window, 'currentFileName', {
  get: () => currentFileName,
  set: (v) => { currentFileName = v; },
  configurable: true,
});
