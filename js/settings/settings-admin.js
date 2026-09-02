/* ═══════════════════════════════════════════════════════════════════════════
   settings-admin.js — 환경설정 「공지」 탭 (어드민 전용).  Unit D
   ───────────────────────────────────────────────────────────────────────────
   ★진입점은 «환경설정 탭»이다(현빈 확정 2026-09-02 — 계정 메뉴 아님).

   ★어드민이 아니면 탭이 «아예 없다» (PLAN A-e)
     회색 비활성으로 두면 「나는 왜 못 쓰지」가 된다. 개발자·협업 탭이 회색인 건
     «있었다는 걸 알리려는» 의도적 예외지, 권한 기능의 본보기가 아니다.
     ⇒ 없는 사람에게는 그런 탭이 있다는 사실 자체를 안 보인다.

   ★탭은 «열 때» 만든다 — ensureModal() 이 아니라.
     ensureModal 은 모달을 한 번만 짓고 캐시한다. 그런데 role 은 «나중에» 온다
     (로그인 직후·세션 재검증 뒤). 거기서 그렸으면 「로그인했는데 탭이 없다」가 되고,
     반대로 로그아웃해도 탭이 남는다. ⇒ 열 때마다 현재 상태로 맞춘다(syncAdminTab).

   ★★이 파일의 판정은 «보안이 아니다»
     서버(api/_lib/roles.js requireAdmin)가 DB 의 지금 role 로 거부한다. 여기 판정이
     틀려도 사고가 아니라 화면이 어긋난 것뿐이다. ⛔반대로 「여기서 막았으니 됐다」고
     서버 검사를 빼면 그 순간 curl 한 줄에 뚫린다.

   ★새 룩을 만들지 않는다(현빈 상시 지시)
     settings-api-* / settings-btn / settings-section-title 을 그대로 쓴다.
     새 CSS 는 «레이아웃만» — css/settings-admin.css (색·글꼴은 기존 토큰).
═══════════════════════════════════════════════════════════════════════════ */
(function (w, d) {
  'use strict';

  const TAB = 'notice';
  const api = () => (w.electronAPI && w.electronAPI.admin) || null;

  /* ── 어드민 상태 ────────────────────────────────────────────────────────
   * ★세 갈래를 구분해 들고 있는다(main/admin/index.js _fetchRole 와 짝):
   *   isAdmin=true                  → 탭 있음
   *   hasRoleField=true,  isAdmin=false → 일반 사용자
   *   hasRoleField=false            → 구버전 서버(이 패치가 안 실림)
   * 셋 다 «탭 없음»이 되는 건 뒤 둘이지만, 원인을 못 가르면 「왜 안 보이지」를 두 번 조사한다.
   * ⇒ 이유는 콘솔에 한 번 남긴다(사용자 화면엔 아무것도 안 띄운다 — 없는 기능을 설명하지 않는다). */
  let _state = null;         // { ok, isAdmin, hasRoleField, reason }
  let _inflight = null;
  let _loggedWhy = '';
  /* ★검증용 «주입» 자리 — __admin._forceState 로만 채워진다.
   *   판정식이 헛도는지(양성대조) 재려면 상태를 «만들어» 넣어봐야 한다. 넣었더니 탭이 안 나오면
   *   판정식이 헛도는 것이다(오늘 이 팀이 협업 스위치에서 정확히 그걸 밟았다).
   *   ⛔권한과 무관하다 — 서버는 이 값을 모른다. 여기를 admin 으로 채워도 POST 는 403 이다. */
  let _override = null;

  async function fetchState(force) {
    const a = api();
    if (_override) return (_state = _override);
    if (!a) return (_state = { ok: false, isAdmin: false, hasRoleField: false, reason: 'no_bridge' });
    if (_inflight && !force) return _inflight;
    _inflight = (async () => {
      let r = null;
      try { r = await a.state({ force: !!force }); } catch (_) { r = null; }
      _state = r || { ok: false, isAdmin: false, hasRoleField: false, reason: 'ipc_failed' };
      const why = _state.isAdmin ? '' : (_state.hasRoleField ? 'not_admin' : (_state.reason || 'no_role_field'));
      if (why && why !== _loggedWhy) {
        _loggedWhy = why;
        console.log('[admin] 공지 탭 없음 —', why === 'not_admin'
          ? '이 계정은 운영자가 아닙니다(서버가 role:null 로 답했습니다)'
          : why === 'no_role_field'
            ? '서버 응답에 role 필드가 없습니다(이 패치가 안 실린 서버입니다)'
            : why);
      }
      _inflight = null;
      return _state;
    })();
    return _inflight;
  }

  /* ── 탭 주입/제거 ──────────────────────────────────────────────────────── */

  function removeTab(modal) {
    const t = modal.querySelector(`.settings-tab[data-tab="${TAB}"]`);
    const p = modal.querySelector(`.settings-pane[data-pane="${TAB}"]`);
    // 지우는 탭이 «지금 열린 탭»이면 첫 탭으로 되돌린다 — 안 그러면 빈 화면이 남는다.
    const wasActive = t && t.classList.contains('active');
    if (t) t.remove();
    if (p) p.remove();
    if (wasActive) {
      const first = modal.querySelector('.settings-tab:not([disabled])');
      if (first) first.click();
    }
  }

  function insertTab(modal) {
    if (modal.querySelector(`.settings-tab[data-tab="${TAB}"]`)) return;
    const tabs = modal.querySelector('.settings-tabs');
    const content = modal.querySelector('.settings-content');
    if (!tabs || !content) return;

    const btn = d.createElement('button');
    btn.className = 'settings-tab';
    btn.dataset.tab = TAB;
    btn.textContent = '공지';

    const pane = d.createElement('div');
    pane.className = 'settings-pane settings-pane-notice';
    pane.dataset.pane = TAB;
    pane.style.display = 'none';

    /* 자리 = 「개발자」 앞(마지막에서 두 번째). 협업 탭이 있던 자리와 같은 구역이다. */
    const dev = tabs.querySelector('.settings-tab[data-tab="dev"]');
    tabs.insertBefore(btn, dev || null);
    const devPane = content.querySelector('.settings-pane[data-pane="dev"]');
    content.insertBefore(pane, devPane || null);

    /* ★리스너를 «직접» 건다 — ensureModal 의 반복문은 이미 끝난 뒤라 이 버튼을 못 본다.
     *   동작은 그 반복문과 «같아야» 한다(활성 표시 + 다른 pane 숨김 + 진입 시 렌더). */
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.settings-tab').forEach(b => b.classList.toggle('active', b === btn));
      modal.querySelectorAll('.settings-pane').forEach(p => {
        p.style.display = (p.dataset.pane === TAB) ? 'block' : 'none';
      });
      renderNoticePane(pane);
    });
  }

  /** 환경설정을 열 때마다 «지금 상태»로 맞춘다. 비동기라 탭은 한 박자 뒤에 붙는다. */
  function syncAdminTab(modal) {
    if (!modal) return Promise.resolve(false);
    return fetchState(false).then((s) => {
      if (s && s.isAdmin) insertTab(modal); else removeTab(modal);
      return !!(s && s.isAdmin);
    }).catch(() => false);
  }

  /* ── 잔손질 ────────────────────────────────────────────────────────────── */

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /** Date → datetime-local 이 읽는 «현지시각» 문자열. ⛔toISOString 은 UTC 라 9시간이 어긋난다. */
  function toLocalInput(dt) {
    const p = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
  }
  function fromLocalInput(v) {
    if (!v) return null;
    const t = new Date(v);            // datetime-local 은 «현지시각»으로 해석된다(원하는 대로)
    return Number.isNaN(t.getTime()) ? null : t;
  }
  function fmtWhen(iso) {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return '-';
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getMonth() + 1}/${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
  }

  /* 서버 error 코드 → 사람이 «다음에 뭘 할지» 아는 문장. 코드값을 그대로 보여주면 아무것도 못 한다.
   * ★서버가 message 를 줬으면 그걸 «먼저» 쓴다 — 서버가 더 구체적으로 안다. */
  const REASON = {
    not_signed_in: '로그인이 필요합니다.',
    unauthorized: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
    invalid_session: '로그인이 만료됐습니다. 다시 로그인해 주세요.',
    forbidden: '운영자 권한이 없습니다.',
    email_not_verified: '이메일 인증이 끝나지 않은 계정입니다.',
    offline: '서버에 닿지 못했습니다. 인터넷 연결을 확인해 주세요.',
    not_deployed: '서버에 이 기능이 아직 배포되지 않았습니다(주소 두 곳 모두 404).',
    bad_response: '서버가 알 수 없는 응답을 보냈습니다.',
    server: '서버에 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
    payload_too_large: '내용이 너무 깁니다.',
    too_large: '파일이 너무 커서 여기서는 열 수 없습니다.',
    not_found: '찾을 수 없습니다(이미 지워졌을 수 있습니다).',
  };
  const say = (r) => (r && r.message) || REASON[r && r.reason] || (r && r.reason) || '알 수 없는 오류';

  /* ── 「공지」 탭 본문 ───────────────────────────────────────────────────── */

  /* ★렌더 토큰 — 이 pane 도 두 번 연속 그려질 수 있다(협업 탭에서 실제로 사고가 났던 그 구조).
   *   비동기 꼬리가 «옛 렌더»의 DOM 에 리스너를 또 거는 걸 막는다. */
  let _render = 0;

  function renderNoticePane(pane) {
    pane = pane || d.querySelector('.settings-pane-notice');
    if (!pane) return;
    const myRender = ++_render;
    const stale = () => myRender !== _render;

    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    pane.innerHTML = `
      <div class="settings-section-title">공지 보내기</div>
      <div class="settings-help">
        전체 사용자의 앱에 공지가 뜹니다. <b>일반</b>은 위 가운데 토스트로 지나가고,
        <b>긴급</b>은 창을 띄워 「확인」을 눌러야 닫힙니다.
      </div>

      <div class="settings-api-list">
        <div class="settings-api-row">
          <div class="settings-api-label">제목</div>
          <div class="settings-api-input-wrap">
            <input class="settings-api-input settings-admin-text" id="nt-title" maxlength="120" placeholder="점검 안내" spellcheck="false" />
          </div>
        </div>
        <div class="settings-api-row">
          <div class="settings-api-label">본문</div>
          <textarea class="settings-api-input settings-admin-area" id="nt-body" maxlength="4000"
                    placeholder="오늘 밤 2시~3시 서버 점검이 있습니다."></textarea>
        </div>

        <div class="settings-admin-2col">
          <div class="settings-api-row">
            <div class="settings-api-label">등급</div>
            <select class="settings-api-input" id="nt-level">
              <option value="normal">일반 — 토스트로</option>
              <option value="urgent">긴급 — 창을 띄움</option>
            </select>
          </div>
          <div class="settings-api-row">
            <div class="settings-api-label">받을 사람</div>
            <select class="settings-api-input" id="nt-kind">
              <option value="all">모두</option>
              <option value="version">특정 버전만</option>
              <option value="plan">특정 등급만</option>
            </select>
          </div>
        </div>

        <div class="settings-api-row" id="nt-version-box" style="display:none">
          <div class="settings-api-label">버전 지정 — 둘 중 하나만 채우면 됩니다</div>
          <div class="settings-admin-2col">
            <input class="settings-api-input" id="nt-versions" placeholder="이 버전들에만 — 0.8.5, 0.8.4" spellcheck="false" />
            <input class="settings-api-input" id="nt-version-below" placeholder="이 버전 «미만»에만 — 0.8.6" spellcheck="false" />
          </div>
        </div>

        <div class="settings-api-row" id="nt-plan-box" style="display:none">
          <div class="settings-api-label">등급 지정</div>
          <div class="settings-admin-chips" id="nt-plans"></div>
        </div>

        <div class="settings-admin-2col">
          <div class="settings-api-row">
            <div class="settings-api-label">언제부터</div>
            <input class="settings-api-input" id="nt-start" type="datetime-local" value="${toLocalInput(now)}" />
          </div>
          <div class="settings-api-row">
            <div class="settings-api-label">언제까지</div>
            <input class="settings-api-input" id="nt-end" type="datetime-local" value="${toLocalInput(weekLater)}" />
          </div>
        </div>
      </div>

      <!-- ★왜 이 두 칸이 필요한지 «화면에» 적는다. 안 적으면 비워두고 보낸다(현빈 지시). -->
      <div class="settings-help settings-admin-why">
        <b>끝나는 시각이 없으면 공지가 안 죽습니다</b> — 점검이 끝나도 계속 뜨고, 누군가 손으로 꺼야 합니다.
        시작 시각을 «미래»로 두면 예약이 됩니다.<br>
        <b>받을 사람을 안 좁히면</b> 「최신으로 업데이트하세요」가 <b>이미 업데이트한 사람에게도</b> 뜹니다.
      </div>

      <div class="settings-admin-actions">
        <button class="settings-api-test" id="nt-preview">미리보기</button>
        <div style="flex:1"></div>
        <button class="settings-btn settings-btn-primary" id="nt-send">보내기</button>
      </div>
      <div class="settings-api-status" id="nt-status"></div>

      <div class="settings-section-title" style="margin-top:22px">최근 보낸 공지</div>
      <div class="settings-help">잘못 보냈으면 <b>회수</b>하세요 — 지우지 않고 「이제 새로 뜨지 않음」으로 표시합니다.</div>
      <div class="settings-api-list" id="nt-list"><div class="settings-help">불러오는 중…</div></div>

      <div class="settings-section-title" style="margin-top:22px">받은 신고</div>
      <div class="settings-help">
        사용자가 앱에서 보낸 버그·제안입니다. 이 목록이 없으면 신고 기능 전체가 «허공에 말하는 것»이 됩니다.
        <button class="settings-api-test" id="rp-reload" style="margin-left:6px">새로고침</button>
      </div>
      <div class="settings-api-list" id="rp-list"><div class="settings-help">불러오는 중…</div></div>
      <div class="settings-admin-actions"><button class="settings-api-test" id="rp-more" style="display:none">더 보기</button></div>
    `;

    const $ = (id) => pane.querySelector('#' + id);
    const status = $('nt-status');
    const setStatus = (m, cls) => {
      if (stale()) return;
      status.textContent = m;
      status.className = 'settings-api-status' + (cls ? ' ' + cls : '');
    };

    const a = api();
    if (!a) { setStatus('데스크탑 앱에서만 사용할 수 있습니다', 'err'); return; }

    /* ── 대상 입력 ─────────────────────────────────────────────────────── */
    // 등급 값은 서버(users.plan)가 쓰는 «그대로»다. 화면 라벨만 사람 말로 바꾼다.
    const PLANS = [
      ['event_free', '이벤트 무료'], ['beta', '베타'], ['intern', '인턴십'],
      ['pro', 'PRO'], ['pro12', 'PROx12'], ['pro_training', '프로 트레이닝'],
    ];
    $('nt-plans').innerHTML = PLANS.map(([v, label]) =>
      `<label class="settings-admin-chip"><input type="checkbox" value="${v}"> ${esc(label)}</label>`).join('');

    const onKind = () => {
      const k = $('nt-kind').value;
      $('nt-version-box').style.display = k === 'version' ? '' : 'none';
      $('nt-plan-box').style.display = k === 'plan' ? '' : 'none';
    };
    $('nt-kind').addEventListener('change', onKind);
    onKind();

    /** 화면 → 서버가 받는 꼴. 잘못됐으면 { error } 로 «왜»를 돌려준다.
     *  ⚠️서버(_lib/notice-lib.js validateCreate)와 «같은 규칙»을 앞당겨 검사할 뿐이다.
     *    정본은 서버다 — 여기서 통과해도 서버가 거절할 수 있고, 그 말을 그대로 보여준다. */
    function collect() {
      const title = $('nt-title').value.trim();
      const body = $('nt-body').value.trim();
      if (!title) return { error: '제목을 입력하세요.' };
      if (!body) return { error: '본문을 입력하세요.' };

      const kind = $('nt-kind').value;
      const target = { kind };
      if (kind === 'version') {
        const versions = $('nt-versions').value.split(',').map(s => s.trim()).filter(Boolean);
        const versionBelow = $('nt-version-below').value.trim();
        if (!versions.length && !versionBelow) {
          return { error: '버전 대상은 «해당 버전 목록» 또는 «이 버전 미만» 중 하나를 채워야 합니다.' };
        }
        target.versions = versions;
        target.versionBelow = versionBelow;
      } else if (kind === 'plan') {
        const plans = Array.from($('nt-plans').querySelectorAll('input:checked')).map(i => i.value);
        if (!plans.length) return { error: '등급을 하나 이상 고르세요.' };
        target.plans = plans;
      }
      /* ⛔target.apps 는 «비워 둔다» = 모든 앱.
       *   여기에 ['goditor'] 를 박으면, 앱이 app 값을 안 보내는 순간 아무에게도 안 간다
       *   (_lib/notice-lib.js matchesTarget: apps 가 있으면 «반드시» 그 목록에 들어야 한다). */

      const start = fromLocalInput($('nt-start').value);
      const end = fromLocalInput($('nt-end').value);
      if (!start) return { error: '시작 시각이 올바르지 않습니다.' };
      if (!end) return { error: '종료 시각을 정하세요. 기간 없는 공지는 만들 수 없습니다.' };
      if (end.getTime() <= start.getTime()) return { error: '종료 시각이 시작 시각보다 뒤여야 합니다.' };
      if (end.getTime() <= Date.now()) return { error: '이미 지난 기간입니다 — 아무도 못 봅니다. 종료 시각을 앞으로 잡아 주세요.' };

      return {
        payload: {
          title, body, level: $('nt-level').value, target,
          startAt: start.toISOString(), endAt: end.toISOString(),
        },
        summary: `${$('nt-level').value === 'urgent' ? '긴급(창)' : '일반(토스트)'} · `
          + (kind === 'all' ? '모두에게' : kind === 'version' ? '지정한 버전에만' : '지정한 등급에만')
          + ` · ${fmtWhen(start.toISOString())} ~ ${fmtWhen(end.toISOString())}`,
      };
    }

    /* ── 미리보기 (PLAN B-c) ────────────────────────────────────────────
     * ★G3(js/notice.js)의 «표시 함수를 그대로» 쓴다 — 새 룩을 만들지 않는다.
     *   그쪽이 창구(__notice.preview)를 열어두면 그걸 쓰고, 아직이면 같은 클래스로 폴백한다.
     *   ⚠️폴백은 «코드가 두 벌»이라는 뜻이다. 창구가 열리면 이 폴백은 지워야 한다. */
    function preview(n) {
      if (w.__notice && typeof w.__notice.preview === 'function') { w.__notice.preview(n); return 'reused'; }
      fallbackPreview(n);
      return 'fallback';
    }

    function fallbackPreview(n) {
      if (n.level !== 'urgent') {
        const el = d.createElement('div');
        el.className = 'settings-toast notice-toast';
        el.setAttribute('role', 'status');
        const t = d.createElement('span');
        t.className = 'notice-toast-text';
        t.textContent = n.title ? `새 공지 · ${n.title}` : '새 공지가 있습니다';
        el.appendChild(t);
        d.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); }, 3500);
        return;
      }
      const overlay = d.createElement('div');
      overlay.className = 'settings-modal-overlay';
      overlay.style.display = 'flex';
      overlay.style.zIndex = '10001';               // 환경설정 모달 «위»에 떠야 보인다
      overlay.innerHTML = `
        <div class="settings-modal-shell notice-modal-shell" role="dialog" aria-label="공지 미리보기">
          <div class="settings-modal-header">
            <div class="settings-modal-title"></div>
            <button class="settings-modal-close" data-x="1" title="닫기">×</button>
          </div>
          <div class="notice-modal-body"></div>
          <div class="settings-modal-footer">
            <div style="flex:1"></div>
            <button class="settings-btn settings-btn-primary" data-x="1">확인</button>
          </div>
        </div>`;
      // ★본문은 textContent 로만 — 공지 글이 HTML 로 실행되면 안 된다.
      overlay.querySelector('.settings-modal-title').textContent = n.title || '공지';
      overlay.querySelector('.notice-modal-body').textContent = n.body || '';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || (e.target.getAttribute && e.target.getAttribute('data-x'))) overlay.remove();
      });
      d.body.appendChild(overlay);
    }

    $('nt-preview').addEventListener('click', () => {
      const c = collect();
      if (c.error) { setStatus('✗ ' + c.error, 'err'); return; }
      const how = preview({ title: c.payload.title, body: c.payload.body, level: c.payload.level });
      setStatus(how === 'reused'
        ? '실제로 뜨는 그 화면입니다 — 아직 아무에게도 안 보냈습니다.'
        : '미리보기(대체 화면)입니다 — 아직 아무에게도 안 보냈습니다.', 'ok');
    });

    /* ── 보내기 ───────────────────────────────────────────────────────── */
    $('nt-send').addEventListener('click', async () => {
      const c = collect();
      if (c.error) { setStatus('✗ ' + c.error, 'err'); return; }
      /* ⚠️전체 사용자의 화면에 뜨는 일이다 — 한 번 묻는다.
       *   (되돌릴 길은 있다: 아래 「회수」. 그래서 막지 않고 «확인»만 받는다.) */
      if (!confirm(`이 공지를 보냅니다.\n\n${c.summary}\n\n계속할까요?`)) return;

      const btn = $('nt-send');
      btn.disabled = true;
      setStatus('보내는 중…', 'pending');
      const r = await a.noticeCreate(c.payload);
      if (stale()) return;
      btn.disabled = false;
      if (r && r.ok) {
        setStatus('✓ ' + (r.message || '공지를 등록했습니다.'), 'ok');
        $('nt-title').value = ''; $('nt-body').value = '';
        loadNotices();
      } else {
        setStatus('✗ ' + say(r), 'err');
      }
    });

    /* ── 보낸 공지 목록 + 회수 (PLAN B-d) ──────────────────────────────── */
    async function loadNotices() {
      const box = $('nt-list');
      const r = await a.noticeList();
      if (stale() || !box) return;
      if (!r || !r.ok) { box.innerHTML = `<div class="settings-help">불러오지 못했습니다 — ${esc(say(r))}</div>`; return; }
      const rows = r.notices || [];
      if (!rows.length) { box.innerHTML = '<div class="settings-help">보낸 공지가 없습니다.</div>'; return; }
      const nowMs = Date.parse(r.serverNow) || Date.now();
      box.innerHTML = rows.map((n) => {
        const ended = Date.parse(n.endAt) <= nowMs;
        const state = n.revoked ? '회수함' : ended ? '기간 끝' : (Date.parse(n.startAt) > nowMs ? '예약됨' : '뜨는 중');
        return `
          <div class="settings-api-row">
            <div class="settings-api-label">
              <span class="settings-admin-badge${n.revoked || ended ? ' off' : ''}">${state}</span>
              ${n.level === 'urgent' ? '긴급' : '일반'} · ${esc(fmtWhen(n.startAt))} ~ ${esc(fmtWhen(n.endAt))}
            </div>
            <div class="settings-api-input-wrap">
              <input class="settings-api-input" readonly value="${esc(n.title)}" />
              ${n.revoked || ended ? '' : `<button class="settings-api-test" data-revoke="${esc(n.id)}">회수</button>`}
            </div>
          </div>`;
      }).join('');
      box.querySelectorAll('[data-revoke]').forEach((b) => {
        b.addEventListener('click', async () => {
          if (!confirm('이 공지를 회수합니다.\n\n이미 본 사람에게서 사라지지는 않지만, 이제부터 새로 뜨지 않습니다.\n계속할까요?')) return;
          b.disabled = true;
          const rr = await a.noticeRevoke({ noticeId: b.dataset.revoke });
          if (stale()) return;
          setStatus(rr && rr.ok ? '✓ ' + (rr.message || '회수했습니다') : '✗ ' + say(rr), rr && rr.ok ? 'ok' : 'err');
          loadNotices();
        });
      });
    }

    /* ── 받은 신고 (PLAN B-b) ─────────────────────────────────────────── */
    const TYPE_LABEL = { bug: '버그', idea: '제안', suggestion: '제안', etc: '기타', other: '기타' };
    const STATUS_LABEL = { new: '새 것', read: '읽음', done: '처리됨' };
    let _reports = [];
    let _nextBefore = null;

    function reportRow(r) {
      const head = `${esc(fmtWhen(r.createdAt))} · ${esc(TYPE_LABEL[r.type] || r.type || '기타')} · v${esc(r.appVersion || '?')}`;
      const first = String(r.text || '').replace(/\s+/g, ' ').slice(0, 70);
      const nImg = (r.images || []).length;
      return `
        <div class="settings-api-row" data-report="${esc(r.id)}">
          <div class="settings-api-label">
            <span class="settings-admin-badge${r.status && r.status !== 'new' ? ' off' : ''}">${esc(STATUS_LABEL[r.status] || '새 것')}</span>
            ${head}${nImg ? ` · 이미지 ${nImg}` : ''}
          </div>
          <div class="settings-api-input-wrap">
            <input class="settings-api-input" readonly value="${esc(first || '(내용 없음)')}" />
            <button class="settings-api-test" data-open="${esc(r.id)}">펼치기</button>
          </div>
          <div class="settings-admin-detail" data-detail="${esc(r.id)}" style="display:none"></div>
        </div>`;
    }

    function renderDetail(box, r) {
      const kv = (k, v) => (v ? `<div><span>${esc(k)}</span>${esc(v)}</div>` : '');
      box.innerHTML = `
        <pre class="settings-admin-pre">${esc(r.text || '(내용 없음)')}</pre>
        <div class="settings-admin-kv">
          ${kv('보낸이', r.accountEmail || r.email || '익명')}
          ${kv('등급', r.plan)}
          ${kv('버전', r.appVersion)}
          ${kv('OS', [r.os, r.arch].filter(Boolean).join(' '))}
          ${kv('화면', r.screen)}
          ${kv('프로젝트', r.projectId)}
        </div>
        ${(r.errors && r.errors.length)
          ? `<div class="settings-api-label" style="margin-top:8px">앱이 붙인 직전 오류 ${r.errors.length}건</div>
             <pre class="settings-admin-pre">${esc(r.errors.map(e => (typeof e === 'string' ? e : JSON.stringify(e))).join('\n'))}</pre>`
          : '<div class="settings-help" style="margin:8px 0 0">직전 오류 기록이 없습니다.</div>'}
        ${r.imageError ? `<div class="settings-api-status err">이미지 저장 실패: ${esc(r.imageError)}</div>` : ''}
        <div class="settings-admin-actions">
          ${(r.images || []).map((im, i) =>
            `<button class="settings-api-test" data-img="${esc(r.id)}" data-i="${i}">이미지 ${i + 1} 보기 (${Math.round((im.bytes || 0) / 1024)}KB)</button>`).join('')}
          <div style="flex:1"></div>
          <button class="settings-api-test" data-mark="read" data-id="${esc(r.id)}">읽음</button>
          <button class="settings-api-test" data-mark="done" data-id="${esc(r.id)}">처리됨</button>
        </div>
        <div class="settings-admin-imgs"></div>`;

      box.querySelectorAll('[data-img]').forEach((b) => {
        b.addEventListener('click', async () => {
          b.disabled = true; b.textContent = '여는 중…';
          const rr = await a.reportImage({ reportId: b.dataset.img, index: Number(b.dataset.i) });
          if (stale()) return;
          if (!rr || !rr.ok) { b.disabled = false; b.textContent = '열지 못함 — ' + say(rr); return; }
          const img = d.createElement('img');
          img.className = 'settings-admin-img';
          img.src = rr.dataUri;             // ★어드민만 꺼낼 수 있는 바이트다(서버가 헤더 토큰으로 검사)
          img.alt = '신고 이미지';
          box.querySelector('.settings-admin-imgs').appendChild(img);
          b.remove();
        });
      });
      box.querySelectorAll('[data-mark]').forEach((b) => {
        b.addEventListener('click', async () => {
          b.disabled = true;
          const rr = await a.reportStatus({ reportId: b.dataset.id, status: b.dataset.mark });
          if (stale()) return;
          if (rr && rr.ok) { loadReports(); } else { b.disabled = false; setStatus('✗ ' + say(rr), 'err'); }
        });
      });
    }

    function bindReportRows(box) {
      box.querySelectorAll('[data-open]').forEach((b) => {
        b.addEventListener('click', () => {
          const id = b.dataset.open;
          const detail = box.querySelector(`[data-detail="${id}"]`);
          const r = _reports.find(x => x.id === id);
          if (!detail || !r) return;
          const opening = detail.style.display === 'none';
          detail.style.display = opening ? '' : 'none';
          b.textContent = opening ? '접기' : '펼치기';
          if (opening && !detail.dataset.filled) { detail.dataset.filled = '1'; renderDetail(detail, r); }
        });
      });
    }

    async function loadReports(append) {
      const box = $('rp-list');
      const r = await a.reportList(append && _nextBefore ? { before: _nextBefore, limit: 30 } : { limit: 30 });
      if (stale() || !box) return;
      if (!r || !r.ok) { box.innerHTML = `<div class="settings-help">불러오지 못했습니다 — ${esc(say(r))}</div>`; return; }
      _reports = append ? _reports.concat(r.reports || []) : (r.reports || []);
      _nextBefore = r.nextBefore || null;
      box.innerHTML = _reports.length
        ? _reports.map(reportRow).join('')
        : '<div class="settings-help">받은 신고가 없습니다.</div>';
      bindReportRows(box);
      const more = $('rp-more');
      if (more) more.style.display = _nextBefore ? '' : 'none';
    }

    $('rp-reload').addEventListener('click', () => loadReports(false));
    $('rp-more').addEventListener('click', () => loadReports(true));

    loadNotices();
    loadReports(false);
  }

  /* ── 글로벌 ─────────────────────────────────────────────────────────── */
  w.syncAdminTab = syncAdminTab;
  w.renderNoticePane = renderNoticePane;
  // QA·검증용 창구(사용자 화면엔 안 보인다). ★양성대조 때 이 자리로 상태를 «만들어» 넣는다.
  w.__admin = {
    state: () => _state,
    refresh: () => fetchState(true),
    /** 판정식이 헛도는지 재는 용도 — 실제 권한과 무관하다(서버가 거부한다). null 이면 해제. */
    _forceState: (s) => { _override = s; _state = s; _inflight = null; },
  };
})(window, document);
