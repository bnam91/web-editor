/* free-image-panel.js — t13A-06(현빈 GO 261119) 무료 이미지(Pixabay) — 중앙 하단 Plugins 패널 → «무료 이미지»
 *   ★키 = 사용자 본인 키 · 처음 열면 «내 키» 화면(가입·키 복사 위치 안내 1장) · 키는 main 이 암호 보관(렌더러엔 ••••끝4 만 · proj.json·내보내기·로그 0)
 *   검색 = main(pixabay:search) · 같은 검색 24시간 캐시(js/util/pixabay.js · 이 맥 localStorage · 키 없음) · 결과에 «Pixabay 제공»
 *   고른 그림 = main 이 받아(pixabay:fetch-image · CORS 회피 · 호스트 검사) data URL → 내장 라이브러리와 같은 넣기 한 벌(insertImageAsAsset — 프로젝트에 저장 · 핫링크 아님)
 *   틀 = library-panel.js 모달과 같은 꼴(어두운 덮개 + 상자 · 칸 = 공용 .panel-tile). 데스크톱 앱 전용(electronAPI.pixabay 없으면 안내만).
 */
import { escHtml } from '../props/_helpers.js';
import { insertImageAsAsset } from './library-panel.js';
import { cleanKey, searchParams, readCache, writeCache, pickHits } from '../util/pixabay.js';

const FONT = 'font-family:Pretendard,-apple-system,sans-serif;';
const API = () => window.electronAPI?.pixabay;
const _ls = () => { try { return window.localStorage; } catch (_) { return { getItem: () => null, setItem: () => {} }; } };
let _modal = null, _hits = [];

const MSG = { rate_limited: '잠시 뒤 다시 — 1분에 100번까지예요(Pixabay 한도)', bad_key: '키가 맞지 않아요 — 다시 넣어 주세요', network: '인터넷 연결을 확인해 주세요', empty_query: '검색어를 넣어 주세요', no_key: '키를 먼저 넣어 주세요' };
const _msg = (r) => MSG[r?.reason] || `검색 실패(${escHtml(String(r?.reason || '알 수 없음'))})`;

function _frame(body) {
  _modal.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:12px;width:640px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;">
        <span style="color:#ddd;font-size:13px;font-weight:600;${FONT}">무료 이미지 · Pixabay</span>
        <button id="fi-close" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:4px;line-height:1;">✕</button>
      </div>${body}
    </div>`;
  _modal.querySelector('#fi-close').addEventListener('click', closeFreeImageModal);
}

/** 키 화면 — 가입·키 복사 위치 안내 1장 + 붙여넣기 칸. note = 위에 띄울 한 줄(키 틀림 등) */
function _keyScreen(note = '') {
  _frame(`
      <div style="padding:14px 18px 18px;display:flex;flex-direction:column;gap:10px;color:#bbb;font-size:12px;${FONT}line-height:1.6;">
        ${note ? `<div id="fi-note" style="color:#f0a040;">${escHtml(note)}</div>` : ''}
        <div>Pixabay 의 무료 사진을 검색해 넣으려면 <b>내 Pixabay 키</b>가 한 번 필요해요.</div>
        <div>① Pixabay 에 가입하고 로그인 <button class="panel-tile" id="fi-open-register" style="height:24px;padding:0 10px;border-radius:6px;font-size:11px;">가입 화면 열기</button></div>
        <div>② API 문서 화면의 «Parameters» 표 «key» 칸에 보이는 내 키를 복사 <button class="panel-tile" id="fi-open-docs" style="height:24px;padding:0 10px;border-radius:6px;font-size:11px;">API 문서 열기</button></div>
        <div>③ 아래에 붙여넣고 저장</div>
        <div style="display:flex;gap:8px;">
          <input id="fi-key" type="password" autocomplete="off" spellcheck="false" placeholder="Pixabay 키 붙여넣기" aria-label="Pixabay 키"
            style="flex:1;background:#0e0e0e;border:1px solid #333;border-radius:6px;color:#ddd;font-size:13px;padding:7px 10px;outline:none;${FONT}">
          <button class="panel-tile" id="fi-key-save" style="height:32px;padding:0 14px;border-radius:6px;font-size:12px;">저장</button>
        </div>
        <div style="color:#777;font-size:11px;">키는 이 맥에만 암호로 보관돼요 — 프로젝트 파일·내보내기·다른 맥으로 안 가요. 언제든 «키 바꾸기»로 지울 수 있어요.</div>
      </div>`);
  _modal.querySelector('#fi-open-register').addEventListener('click', () => API()?.openSite?.('register'));
  _modal.querySelector('#fi-open-docs').addEventListener('click', () => API()?.openSite?.('docs'));
  const inp = _modal.querySelector('#fi-key');
  const save = async () => {
    const k = cleanKey(inp.value);
    inp.value = '';   // ★칸에도 남기지 않는다
    if (!k) { _keyScreen('키 꼴이 아니에요 — 숫자-영문으로 된 키를 그대로 붙여넣어 주세요'); return; }
    const r = await API()?.setKey?.(k);
    if (!r?.ok) { _keyScreen(r?.reason === 'no_encryption' ? '이 맥에서 암호 보관을 못 써서 키를 저장할 수 없어요' : '키를 저장하지 못했어요'); return; }
    _searchScreen(r.masked);
  };
  _modal.querySelector('#fi-key-save').addEventListener('click', save);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  setTimeout(() => inp.focus(), 30);
}

function _searchScreen(masked) {
  _frame(`
      <div style="display:flex;gap:8px;padding:12px 18px 0;">
        <input id="fi-q" type="text" placeholder="사진 검색 (예: 커피, 바다, 꽃)" aria-label="사진 검색"
          style="flex:1;background:#0e0e0e;border:1px solid #333;border-radius:6px;color:#ddd;font-size:13px;padding:7px 10px;outline:none;${FONT}">
        <button class="panel-tile" id="fi-go" style="height:32px;padding:0 14px;border-radius:6px;font-size:12px;">검색</button>
      </div>
      <div id="fi-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;padding:12px 18px;overflow:auto;min-height:160px;">
        <div id="fi-state" style="grid-column:1/-1;color:#666;font-size:12px;text-align:center;padding:40px 0;${FONT}">검색어를 넣어 보세요</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:0 18px 14px;font-size:10px;color:#666;${FONT}">
        <span id="fi-credit">사진 제공: <b>Pixabay</b> (pixabay.com) · Pixabay 라이선스 · 사람·상표가 보이는 사진의 상업 이용은 확인 후 사용하세요</span>
        <span style="margin-left:auto;white-space:nowrap;">키 ${escHtml(masked || '••••')}</span>
        <button class="panel-tile" id="fi-key-change" style="height:22px;padding:0 8px;border-radius:6px;font-size:10px;">키 바꾸기</button>
      </div>`);
  const q = _modal.querySelector('#fi-q');
  const go = () => _search(q.value);
  _modal.querySelector('#fi-go').addEventListener('click', go);
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  _modal.querySelector('#fi-key-change').addEventListener('click', async () => { await API()?.clearKey?.(); _keyScreen(); });
  setTimeout(() => q.focus(), 30);
}

function _state(text) { const g = _modal.querySelector('#fi-grid'); g.innerHTML = `<div id="fi-state" style="grid-column:1/-1;color:#888;font-size:12px;text-align:center;padding:40px 0;${FONT}">${text}</div>`; }

async function _search(raw) {
  const p = searchParams(raw);
  if (!p.q) { _state(MSG.empty_query); return; }
  let data = readCache(_ls(), p);
  if (!data) {
    _state('검색 중…');
    const r = await API()?.search?.(p);
    if (!r?.ok) { if (r?.reason === 'bad_key' || r?.reason === 'no_key') { _keyScreen(_msg(r)); return; } _state(_msg(r)); return; }
    data = r.data;
    writeCache(_ls(), p, data);   // Pixabay 약관 — 같은 요청 24시간 캐시
  }
  _hits = pickHits(data);
  const g = _modal.querySelector('#fi-grid');
  if (!_hits.length) { _state('찾은 사진이 없어요'); return; }
  g.innerHTML = _hits.map((h, i) => `
    <div class="panel-tile fi-item" data-i="${i}" title="${escHtml(h.tags)} · ${escHtml(h.user)} / Pixabay"
      style="border-radius:8px;padding:4px;display:flex;flex-direction:column;gap:3px;cursor:pointer;">
      <img src="${escHtml(h.preview)}" alt="${escHtml(h.tags)}" draggable="false" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:90px;object-fit:cover;border-radius:4px;">
      <span style="font-size:10px;color:#777;${FONT}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(h.user)}</span>
    </div>`).join('');
  g.querySelectorAll('.fi-item').forEach((el) => el.addEventListener('click', () => _pick(_hits[+el.dataset.i])));
}

async function _pick(h) {
  if (!h) return;
  _state('사진 받는 중…');
  const r = await API()?.fetchImage?.(h.large);
  if (!r?.ok || !r.dataUrl) { _state('사진을 받지 못했어요 — 다시 골라 주세요'); return; }
  closeFreeImageModal();
  insertImageAsAsset(r.dataUrl, h.w, h.h);   // 폭 = 섹션 안쪽 상한 · 비율 = 원본(그림은 프로젝트 자산으로 저장 — addAssetBlock data: 갈래)
}

export async function openFreeImageModal() {
  if (!window.animGifVisible?.(true, window.__admin?.state?.() ?? null)) return;   // t13F-01 — 관리자만(입구 단추가 숨어도 전역 함수로 부르는 길까지) · 판정 = feature-flags.js 한 자리
  if (!API()?.status) { window.showToast?.('무료 이미지는 데스크톱 앱에서 써요'); return; }
  if (!_modal) {
    _modal = document.createElement('div');
    _modal.id = 'fi-modal';
    _modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;';
    _modal.addEventListener('click', (e) => { if (e.target === _modal) closeFreeImageModal(); });
    document.body.appendChild(_modal);
  }
  const st = await API().status().catch(() => null);
  if (st?.hasKey) _searchScreen(st.masked); else _keyScreen();
  _modal.style.display = 'flex';
}

export function closeFreeImageModal() { if (_modal) _modal.style.display = 'none'; }

window.openFreeImageModal = openFreeImageModal;
window.closeFreeImageModal = closeFreeImageModal;
