/* font-substitute.js — 「이 기기에 없는 글꼴」 대체 (GDT-SPEC §7 확장)
 *
 * 지금까지는 «없다고 알려주기만» 했다(토스트). 일러스트레이터·피그마는 파일을 열 때
 *   ① 어디에 몇 군데 쓰였는지 보여주고 ② 대체할 글꼴을 «고르게» 하고 ③ 나중에 다시 열 수 있다.
 * 이 파일이 그 셋을 담당한다.
 *
 * ★classic script다 — gdt-import.js와 같은 이유로 편집기(index.html)와
 *   프로젝트 목록(pages/projects.html) «양쪽»에서 쓰인다. 목록 페이지는 모듈을 안 쓴다.
 *
 * ★대체는 «파괴적이지 않다». 원본 이름을 지우지 않고 폴백 체인에 «끼워 넣는다»:
 *      font-family: 'A2Z', 'Pretendard', sans-serif
 *   →  font-family: 'A2Z', 'Noto Sans KR', 'Pretendard', sans-serif
 *   그래서 A2Z가 «설치된 기계»에서 열면 CSS가 알아서 A2Z를 쓴다 — 되돌리는 코드가 필요 없다.
 *   data-raw-font(원본 표기)는 «절대 건드리지 않는다». 글꼴 피커가 읽는 자리가 거기다.
 */
'use strict';

(function () {
  const API = () => window.electronAPI;
  const LS_PREFIX = 'goditor_font_sub_';

  /* ── 이름 정규화 ── */
  const norm = (s) => String(s || '').replace(/["']/g, '').trim().toLowerCase();

  // 폰트가 아닌 토큰 — main/gdt/export.js FontCollector.result()와 «같은 목록»이어야 한다.
  // 여기서 빠지면 generic(sans-serif)이 「없는 글꼴」로 거짓 경보를 낸다.
  const NOT_A_FONT = new Set([
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
    '-apple-system', 'blinkmacsystemfont', '-webkit-body', '-moz-fixed',
    'inherit', 'initial', 'unset', 'revert', 'none',
  ]);

  function _decodeEntities(s) {
    return s.replace(/&quot;|&#0*34;/g, '"').replace(/&apos;|&#0*39;/g, "'").replace(/&amp;/g, '&');
  }

  /* ★정규식은 «호출할 때마다 새로» 만든다.
   *   /g 정규식은 lastIndex를 들고 다녀서, 바깥 루프(태그)와 안쪽 루프(선언)가 같은 객체를 쓰면
   *   중간에 끊길 때 다음 호출이 엉뚱한 위치에서 시작한다(찾기 힘든 유실 버그). */
  const TAG_RE   = () => /<[a-zA-Z][^>]*>/g;
  // 선언은 `;`(다음 속성) · `"`(속성 끝) · `}`(룰 끝)에서 끝난다.
  // ★`&quot;`는 «값의 일부»다 — 통째로 먹지 않으면 그 안의 `;`이 선언 끝으로 오인돼
  //   진짜 이름이 통째로 누락된다(export.js가 겪은 것과 같은 함정).
  const DECL_RE  = () => /font-family\s*:\s*((?:&quot;|&#0*34;|&apos;|&#0*39;|[^;}"])+)/g;
  const RAW_RE   = () => /data-raw-font\s*=\s*"([^"]{1,300})"/g;

  /** 선언 값을 «원문 토큰» 배열로 쪼갠다(출력 때 원문을 그대로 되쓰기 위해). */
  function _tokens(decl) {
    return String(decl).split(',').map(t => t.trim()).filter(t => t.length);
  }
  function _familiesOf(decl) {
    return _tokens(decl)
      .map(t => t.replace(/["']/g, '').trim())
      .filter(t => t && !/[&;<>={}]/.test(t) && t.length <= 64);
  }

  /* ── 스캔: 어떤 글꼴이 «어디에 몇 군데» ────────────────────────────────
   * 반환: Map<정규화이름, {family, elements, decls, raws, pages:{[name]:n}, samples:[]}>
   *   elements = 그 글꼴을 쓰는 요소(여는 태그) 수  ← 사용자에게 보여주는 「몇 곳」
   *   decls    = `font-family:` 선언 수
   *   raws     = `data-raw-font` 속성 수
   * (검증 오라클: 두장군 A2Z = elements 17 · decls 17 · raws 17 → 출현 34)
   */
  function scanHtml(html, pageName, acc) {
    const out = acc || new Map();
    if (!html) return out;
    const tagRe = TAG_RE();
    let m;
    while ((m = tagRe.exec(html)) !== null) {
      const raw = m[0];
      // ★빠른 탈출 — 100MB짜리 캔버스에서 태그마다 엔티티를 푸는 건 감당이 안 된다.
      if (raw.indexOf('font-family') === -1 && raw.indexOf('data-raw-font') === -1) continue;
      const tag = _decodeEntities(raw);

      const hitsDecl = new Set(), hitsRaw = new Set();
      let d;
      const declRe = DECL_RE();
      while ((d = declRe.exec(tag)) !== null) _familiesOf(d[1]).forEach(f => hitsDecl.add(f));
      const rawRe = RAW_RE();
      while ((d = rawRe.exec(tag)) !== null) _familiesOf(d[1]).forEach(f => hitsRaw.add(f));

      const all = new Set([...hitsDecl, ...hitsRaw]);
      for (const fam of all) {
        const k = norm(fam);
        if (NOT_A_FONT.has(k)) continue;
        let e = out.get(k);
        if (!e) { e = { family: fam, elements: 0, decls: 0, raws: 0, pages: {}, samples: [] }; out.set(k, e); }
        e.elements++;
        if (hitsDecl.has(fam)) e.decls++;
        if (hitsRaw.has(fam)) e.raws++;
        e.pages[pageName] = (e.pages[pageName] || 0) + 1;
        // 「어디에」 — 태그 바로 뒤 텍스트를 조금 떠서 보여준다(있으면).
        if (e.samples.length < 3) {
          const s = _snippet(html, m.index + raw.length);
          if (s && !e.samples.includes(s)) e.samples.push(s);
        }
      }
    }
    return out;
  }

  function _snippet(html, from) {
    // ★잘린 꼬리 태그(`<span style`)를 «먼저» 버린다 — 안 버리면 미리보기에 마크업이 새어 나온다.
    const chunk = html.slice(from, from + 200).replace(/<[^>]*$/, '');
    const text = _decodeEntities(chunk.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > 16 ? text.slice(0, 16) + '…' : text;
  }

  /** 프로젝트 데이터(v1/v2) 전체를 훑는다. */
  function scanProject(data) {
    const acc = new Map();
    const pages = (data && data.version === 2 && Array.isArray(data.pages))
      ? data.pages
      : [{ name: 'Page 1', canvas: (data && data.canvas) || '' }];
    pages.forEach((p, i) => scanHtml(p.canvas || '', p.name || `Page ${i + 1}`, acc));
    return acc;
  }

  /* ── 다시쓰기: 대체 글꼴을 «체인에 끼운다» ──────────────────────────────
   * plan: Map<정규화이름, { insert: '대체글꼴'|null, drop: '직전에 끼웠던 글꼴'|null }>
   * ★drop은 «우리가 끼운 것»으로 기록된 경우에만 넘어온다 — 원래 체인에 있던 이름을
   *   지우면 사용자가 고른 폴백이 사라진다(예: 거의 모든 체인에 있는 Pretendard).
   */
  function rewriteHtml(html, plan) {
    if (!html) return { html, changed: 0 };
    let changed = 0;
    const out = html.replace(DECL_RE(), (full, val) => {
      const toks = _tokens(val);
      const next = [];
      let touched = false;
      for (let i = 0; i < toks.length; i++) {
        const tk = toks[i];
        next.push(tk);
        const p = plan.get(norm(_decodeEntities(tk)));
        if (!p) continue;
        // ① 직전에 끼운 대체 글꼴을 걷어낸다(바로 뒤 한 개만)
        if (p.drop && toks[i + 1] && norm(_decodeEntities(toks[i + 1])) === norm(p.drop)) {
          i++; touched = true;
        }
        // ② 새 대체 글꼴을 바로 뒤에 끼운다 (이미 그 자리에 있으면 그대로 둔다 — 멱등)
        if (p.insert) {
          const after = toks[i + 1];
          if (!after || norm(_decodeEntities(after)) !== norm(p.insert)) {
            next.push(`'${String(p.insert).replace(/['\\]/g, '')}'`);
            touched = true;
          }
        }
      }
      if (!touched) return full;
      changed++;
      return `font-family: ${next.join(', ')}`;
    });
    return { html: out, changed };
  }

  /** 프로젝트 데이터에 계획을 적용한다(pages[].canvas만 고친다 — data-raw-font는 불변). */
  function rewriteProject(data, plan) {
    let changed = 0;
    if (data && data.version === 2 && Array.isArray(data.pages)) {
      for (const p of data.pages) {
        const r = rewriteHtml(p.canvas || '', plan);
        p.canvas = r.html; changed += r.changed;
      }
    } else if (data) {
      const r = rewriteHtml(data.canvas || '', plan);
      data.canvas = r.html; changed += r.changed;
    }
    return changed;
  }

  /* ── 기록(닫아도 남는다) ──────────────────────────────────────────────
   * { families:[이름…], subs:{ 정규화이름: {sub, inserted} }, name, at }
   *   families = 이 프로젝트가 쓰는 글꼴 전부(카드 배지를 «디스크 로드 없이» 계산하려고 들고 있다)
   */
  const report = {
    get(projectId) {
      try { return JSON.parse(localStorage.getItem(LS_PREFIX + projectId) || 'null'); }
      catch (_) { return null; }
    },
    set(projectId, r) {
      try { localStorage.setItem(LS_PREFIX + projectId, JSON.stringify(r)); } catch (_) {}
    },
    clear(projectId) {
      try { localStorage.removeItem(LS_PREFIX + projectId); } catch (_) {}
    },
    /** 카드 배지용 — 없는 글꼴 현황. 디스크를 읽지 않는다(목록이 느려지면 안 된다).
     *  ★대체를 «끝냈어도» 0으로 지우지 않는다 — 그러면 고른 글꼴을 바꿀 길이 사라진다.
     *    해결분은 substituted로 따로 센다(배지 톤이 달라진다). */
    state(projectId) {
      const r = report.get(projectId);
      if (!r || !Array.isArray(r.families)) return { unresolved: 0, substituted: 0 };
      const missing = missingOf(r.families);
      let unresolved = 0, substituted = 0;
      for (const f of missing) {
        if (r.subs && r.subs[norm(f)] && r.subs[norm(f)].sub) substituted++;
        else unresolved++;
      }
      return { unresolved, substituted };
    },
    unresolved(projectId) { return report.state(projectId).unresolved; },
  };

  /* ── 대체 후보 목록 ──────────────────────────────────────────────────
   * ★queryLocalFonts()는 «창이 보일 때»만 된다(SecurityError: Page needs to be visible) —
   *   불러오기 직후처럼 창이 가려진 순간엔 빈 배열이 온다. 그래서 둘로 간다:
   *     ① 설치 목록 API — 되면 전부 준다. 셀렉트를 «건드릴 때» 한 번 더 시도한다(그땐 확실히 보인다).
   *     ② 폭 측정 프로브 — 권한이 없어도 되는 흔한 글꼴들. API가 막혀도 목록이 비지 않는다.
   */
  let _localFonts = null;
  async function _queryInstalled() {
    if (_localFonts && _localFonts.length) return _localFonts;
    try {
      if (!window.queryLocalFonts) return (_localFonts = []);
      const fonts = await window.queryLocalFonts();
      _localFonts = [...new Set(fonts.map(f => f.family))].sort((a, b) => a.localeCompare(b, 'ko'));
    } catch (_) { _localFonts = _localFonts || []; }   // 권한 거부·창 가려짐·미지원
    return _localFonts;
  }

  // ②의 프로브 대상 — 맥/윈도우에 흔한 한글·영문 글꼴. 「있는 것만」 남긴다.
  const PROBE = [
    'Apple SD Gothic Neo', 'AppleGothic', 'AppleMyungjo', 'Apple SD 산돌고딕 Neo', 'Nanum Gothic', 'NanumGothic',
    'Nanum Myeongjo', 'NanumMyeongjo', 'Nanum Square', 'NanumSquare', 'NanumBarunGothic', 'Malgun Gothic', '맑은 고딕',
    'Gulim', '굴림', 'Dotum', '돋움', 'Batang', '바탕', 'Gungsuh', '궁서', 'Spoqa Han Sans Neo',
    'Arial', 'Helvetica', 'Helvetica Neue', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana', 'Tahoma',
    'Trebuchet MS', 'Segoe UI', 'Roboto', 'Menlo', 'Consolas',
  ];
  let _probed = null;
  function _probeFonts() {
    if (_probed) return _probed;
    if (!window.gdtMissingFonts) return (_probed = []);
    const { missing, unknown } = window.gdtMissingFonts(PROBE);
    const bad = new Set([...missing, ...unknown].map(norm));
    _probed = PROBE.filter(f => !bad.has(norm(f)));
    return _probed;
  }

  async function _installedFonts() {
    const api = await _queryInstalled();
    const seen = new Set(api.map(norm));
    const extra = _probeFonts().filter(f => !seen.has(norm(f)));
    return [...api, ...extra].sort((a, b) => a.localeCompare(b, 'ko'));
  }

  // 앱이 «항상 갖고 있는» 글꼴 — Pretendard는 번들(@font-face), 나머지는 편집기가 로드하는 웹폰트.
  // ★설치 여부로 거르지 않는다: 목록 페이지는 이 폰트들의 CSS를 안 불러와서 「없음」으로 나온다.
  const BUNDLED = ['Pretendard', 'Noto Sans KR', 'Noto Serif KR', 'Inter', 'Space Grotesk', 'Playfair Display'];
  const BUNDLED_KEYS = new Set(BUNDLED.map(norm));

  /* ★「없는 글꼴」 판정의 정본 —  gdtMissingFonts()에서 «앱이 주는 글꼴»을 뺀다.
   *   안 빼면 프로젝트 목록 페이지(편집기용 폰트 CSS를 안 물고 있다)에서 Inter·Noto가
   *   전부 「없는 글꼴」로 뜬다. 실측: Inter로 대체하자마자 그 Inter가 「없음 17곳」으로 잡혔다.
   *   이 글꼴들은 «기기에 설치돼 있냐»의 문제가 아니라 앱이 함께 배포하는 자산이다. */
  function missingOf(families) {
    if (!window.gdtMissingFonts) return [];
    return window.gdtMissingFonts(families).missing.filter(f => !BUNDLED_KEYS.has(norm(f)));
  }

  /* ── 모달 ─────────────────────────────────────────────────────────── */
  let _open = false;

  function _el(id) { return document.getElementById(id); }

  function _ensureModal() {
    let ov = _el('fsub-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'fsub-overlay';
    ov.className = 'settings-modal-overlay';
    ov.innerHTML = `
      <div class="settings-modal-shell fsub-shell">
        <div class="settings-modal-header">
          <div class="settings-modal-title">이 기기에 없는 글꼴</div>
          <button class="settings-modal-close" id="fsub-close" title="닫기">×</button>
        </div>
        <div class="settings-modal-body fsub-body">
          <div class="fsub-intro" id="fsub-intro"></div>
          <div class="fsub-list" id="fsub-list"></div>
        </div>
        <div class="settings-modal-footer">
          <div class="fsub-status" id="fsub-status"></div>
          <div class="fsub-spacer"></div>
          <button class="settings-btn settings-btn-secondary" id="fsub-later">나중에</button>
          <button class="settings-btn settings-btn-primary" id="fsub-apply">대체 적용</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    return ov;
  }

  function _closeModal() {
    const ov = _el('fsub-overlay');
    if (ov) ov.style.display = 'none';
    _open = false;
  }

  function _optionsHtml(installed, docFonts, current) {
    const opt = (v, label) =>
      `<option value="${_esc(v)}"${norm(v) === norm(current) ? ' selected' : ''}>${_esc(label || v)}</option>`;
    // 같은 글꼴이 두 그룹에 겹쳐 나오지 않게 앞 그룹이 이긴다(문서 글꼴 Pretendard = 앱 기본 Pretendard)
    const seen = new Set();
    const group = (label, list) => {
      const items = list.filter(f => f && !seen.has(norm(f)) && seen.add(norm(f)));
      return items.length ? `<optgroup label="${label}">${items.map(f => opt(f)).join('')}</optgroup>` : '';
    };
    let html = `<option value=""${current ? '' : ' selected'}>대체 안 함</option>`;
    html += group('앱 기본 글꼴', BUNDLED);
    html += group('이 문서의 다른 글꼴', docFonts);
    html += group('이 기기에 설치된 글꼴', installed);
    // 예전에 고른 글꼴이 어느 그룹에도 없으면(설치 목록 권한 거부 등) 그래도 살려둔다
    html += group('이전 선택', current ? [current] : []);
    return html;
  }

  /**
   * 「없는 글꼴」 대화상자를 연다.
   * @param {{projectId:string, projectName?:string, seedFonts?:string[], silentIfNone?:boolean}} o
   * @returns {Promise<{shown:boolean, missing:number}>}
   */
  async function openFontSubstitute(o = {}) {
    const projectId = o.projectId;
    if (!projectId) return { shown: false, missing: 0 };
    // ★이미 떠 있으면 두 번째를 겹쳐 띄우지 않는다(.gdt 여러 개를 한 번에 열었을 때).
    //   기록은 남으니 목록 카드의 「글꼴」 배지로 다시 열 수 있다.
    if (_open) { await _record(projectId, o); return { shown: false, missing: -1 }; }

    const api = API();
    if (!api || !api.loadProject) return { shown: false, missing: 0 };
    let data = null;
    try { data = await api.loadProject(projectId); } catch (_) {}
    if (!data) return { shown: false, missing: 0 };

    const scan = scanProject(data);
    // manifest가 준 목록(§7의 판정 근거)도 합친다 — 문서에서 못 찾아도 알려는 준다.
    for (const f of o.seedFonts || []) {
      const k = norm(f);
      if (!k || NOT_A_FONT.has(k) || scan.has(k)) continue;
      scan.set(k, { family: f, elements: 0, decls: 0, raws: 0, pages: {}, samples: [] });
    }

    const families = [...scan.values()].map(e => e.family);
    const missing = missingOf(families);
    const prev = report.get(projectId) || {};
    const subs = prev.subs || {};

    report.set(projectId, {
      name: o.projectName || data.name || '', families, subs, at: Date.now(),
    });

    if (!missing.length) {
      if (!o.silentIfNone) window.showToast?.('✅ 없는 글꼴이 없습니다');
      return { shown: false, missing: 0 };
    }

    const rows = missing
      .map(f => scan.get(norm(f)))
      .filter(Boolean)
      .sort((a, b) => b.elements - a.elements);

    const docFonts = [...scan.values()]
      .map(e => e.family)
      .filter(f => !missing.some(m => norm(m) === norm(f)))
      .sort((a, b) => a.localeCompare(b, 'ko'));
    const installed = await _installedFonts();

    const ov = _ensureModal();
    _el('fsub-intro').innerHTML =
      `「<b>${_esc(o.projectName || data.name || '프로젝트')}</b>」에 쓰인 글꼴 <b>${rows.length}개</b>가 이 기기에 없습니다. ` +
      `대체할 글꼴을 고르면 그 글꼴로 보입니다. ` +
      `<span class="fsub-dim">원본 글꼴 이름은 그대로 남아, 그 글꼴이 있는 기기에서 열면 원래대로 보입니다. 「대체 안 함」으로 두어도 됩니다.</span>`;

    _el('fsub-list').innerHTML = rows.map(r => {
      const cur = (subs[norm(r.family)] || {}).sub || '';
      const where = _whereText(r);
      const total = r.decls + r.raws;
      return `
        <div class="fsub-row" data-family="${_esc(r.family)}">
          <div class="fsub-name">
            <span class="fsub-family" title="${_esc(r.family)}">${_esc(r.family)}</span>
            <span class="fsub-count" title="글꼴 지정 ${r.decls}곳 · 원본 이름 표기 ${r.raws}곳 = 출현 ${total}회">${r.elements}곳</span>
          </div>
          <div class="fsub-where">${where}</div>
          <div class="fsub-pick">
            <select class="ds-font-select fsub-select">${_optionsHtml(installed, docFonts, cur)}</select>
          </div>
        </div>`;
    }).join('');

    _el('fsub-status').textContent = '';
    ov.style.display = 'flex';
    _open = true;

    /* ★셀렉트를 «펼치는 순간» 설치 글꼴을 한 번 더 물어본다 — 그때는 창이 확실히 보이므로
     *   불러오기 직후(창이 가려져 SecurityError)에 못 받아온 목록이 여기서 채워진다.
     *   고른 값은 그대로 살린다. 한 번 성공하면 다시 묻지 않는다. */
    let _refilled = false;
    const refill = async () => {
      if (_refilled || (_localFonts && _localFonts.length)) return;
      const list = await _queryInstalled();
      if (!list.length) return;
      _refilled = true;
      const full = await _installedFonts();
      ov.querySelectorAll('.fsub-row').forEach(row => {
        const sel = row.querySelector('.fsub-select');
        sel.innerHTML = _optionsHtml(full, docFonts, sel.value);
      });
    };
    ov.querySelectorAll('.fsub-select').forEach(sel => {
      sel.addEventListener('pointerdown', refill, { once: true });
      sel.addEventListener('focus', refill, { once: true });
    });

    _el('fsub-close').onclick = () => _closeModal();
    _el('fsub-later').onclick = () => _closeModal();
    ov.onmousedown = (e) => { if (e.target === ov) _closeModal(); };

    _el('fsub-apply').onclick = async () => {
      const btn = _el('fsub-apply');
      btn.disabled = true;
      _el('fsub-status').textContent = '적용 중…';
      try {
        const picks = [...ov.querySelectorAll('.fsub-row')].map(row => ({
          family: row.dataset.family,
          sub: row.querySelector('.fsub-select').value || null,
        }));
        const n = await applySubstitutions(projectId, picks);
        _el('fsub-status').textContent = n ? `${n}곳에 적용했습니다` : '바뀐 곳이 없습니다';
        window.showToast?.(n ? `✅ 대체 글꼴을 ${n}곳에 적용했습니다` : 'ℹ️ 바뀐 곳이 없습니다');
        setTimeout(() => { _closeModal(); window.__gdtOnImported?.(); }, 700);
      } catch (e) {
        console.error('[fsub] 적용 실패:', e);
        _el('fsub-status').textContent = '적용에 실패했습니다';
      } finally {
        btn.disabled = false;
      }
    };

    return { shown: true, missing: rows.length };
  }

  function _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _whereText(r) {
    if (!r.elements) return '<span class="fsub-dim">문서에서 쓰인 곳을 찾지 못했습니다(파일 목록에만 있음)</span>';
    const pages = Object.entries(r.pages).map(([n, c]) => `${_esc(n)} ${c}곳`).join(' · ');
    const ex = r.samples.length ? ` · 예: ${r.samples.map(s => `「${_esc(s)}」`).join(' ')}` : '';
    return `${pages}${ex}`;
  }

  /** 기록만 갱신(모달을 못 띄우는 경우). */
  async function _record(projectId, o) {
    const api = API();
    if (!api || !api.loadProject) return;
    try {
      const data = await api.loadProject(projectId);
      if (!data) return;
      const scan = scanProject(data);
      for (const f of o.seedFonts || []) {
        const k = norm(f);
        if (k && !NOT_A_FONT.has(k) && !scan.has(k)) scan.set(k, { family: f });
      }
      const prev = report.get(projectId) || {};
      report.set(projectId, {
        name: o.projectName || data.name || '',
        families: [...scan.values()].map(e => e.family),
        subs: prev.subs || {}, at: Date.now(),
      });
    } catch (_) {}
  }

  /**
   * 고른 대체 글꼴을 프로젝트 파일에 적용한다.
   * @param {string} projectId
   * @param {{family:string, sub:string|null}[]} picks
   * @returns {Promise<number>} 바뀐 선언 수
   */
  async function applySubstitutions(projectId, picks) {
    const api = API();
    const data = await api.loadProject(projectId);
    if (!data) throw new Error('프로젝트를 읽을 수 없습니다');

    const prev = report.get(projectId) || {};
    const subs = { ...(prev.subs || {}) };

    const plan = new Map();
    for (const p of picks) {
      const k = norm(p.family);
      const before = subs[k] || {};
      // 직전에 «우리가 끼운» 글꼴만 걷어낸다. 원래 체인에 있던 이름은 건드리지 않는다.
      const drop = (before.inserted && before.sub && norm(before.sub) !== norm(p.sub || '')) ? before.sub : null;
      if (!p.sub && !drop) { continue; }              // 대체 안 함 → 그대로 (정당한 선택)
      plan.set(k, { insert: p.sub || null, drop });
    }
    if (!plan.size) return 0;

    const changed = rewriteProject(data, plan);

    if (changed) {
      data.updatedAt = new Date().toISOString();
      const res = await api.saveProject(data);
      if (res && res.ok === false) throw new Error(res.error || 'save_failed');
    }

    for (const p of picks) {
      const k = norm(p.family);
      if (p.sub) subs[k] = { sub: p.sub, inserted: true };
      else delete subs[k];
    }
    // ★families는 «고친 뒤»의 문서에서 다시 뽑는다 — 예전 목록을 재활용하면 대체로 끼웠다가
    //   되돌린 글꼴 이름이 목록에 남는다(배지 계산이 실제 문서와 어긋난다).
    report.set(projectId, {
      name: prev.name || data.name || '',
      families: [...scanProject(data).values()].map(e => e.family),
      subs, at: Date.now(),
    });
    return changed;
  }

  /* ── 공개 ── */
  window.openFontSubstitute = openFontSubstitute;
  window.gdtFontReport      = report;
  window.gdtFontScan        = scanProject;      // 검증·자동화용
  window.gdtFontRewriteHtml = rewriteHtml;      // 검증·자동화용
})();
