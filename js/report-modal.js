/* ══════════════════════════════════════════════════════════════════════════
   report-modal.js — 버그·피드백 신고 창
   ──────────────────────────────────────────────────────────────────────────
   ★모달 «꼴»은 새로 만들지 않는다 — settings-modal-* 을 그대로 쓴다(PLAN §7⑴).
   ★캡처는 기본 «끔» (PLAN §2⑶). 캔버스엔 고객사 상세페이지가 떠 있다.
   ★「함께 보내지는 것」은 접어두되 «지우지 않는다» (PLAN §8).
   ★C-c: 보낼 게 하나도 없으면 payload 에 images «키 자체»를 안 넣는다(빈 배열도 아님).
   ★A-f: 열 때마다 상태를 «전부» 초기화한다. 첨부는 취소하면 남지 않는다.
   ⛔토스트는 여기서 만들지 않는다 — 기존 showToast() 를 부르기만 한다(자리는 G3 소관).
══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  var MAX_TEXT   = 5000;   // 서버 LIMITS.TEXT
  var MAX_IMAGES = 4;      // 서버 LIMITS.IMAGES (캡처 포함)
  var LONG_EDGE  = 1280;   // 1280px 축소 → 장당 약 70KB (현빈 확정)
  var JPEG_Q     = 0.72;

  var TYPES = [
    { key: 'bug',  label: '버그' },
    { key: 'idea', label: '개선 제안' },
    { key: 'etc',  label: '그 밖에' },
  ];

  var state = null;   // 열려 있는 동안만 존재. 닫으면 null — «남지 않는다»가 A-f 다.

  function api() { return (w.electronAPI && w.electronAPI.report) || null; }
  function toast(msg) {
    if (typeof w.showToast === 'function') { try { w.showToast(msg); return; } catch (_) {} }
    // showToast 가 아직 안 올라온 화면이어도 사용자는 결과를 알아야 한다
    try { w.alert(msg); } catch (_) {}
  }

  /* ── 이미지 축소 — 긴 변 1280px, JPEG. 첨부와 캡처 «둘 다» 이 길을 지난다 ── */
  function shrinkToJpeg(srcDataUrl) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var wpx = img.naturalWidth || img.width;
          var hpx = img.naturalHeight || img.height;
          if (!wpx || !hpx) return reject(new Error('이미지 크기를 읽을 수 없습니다'));
          var scale = Math.min(1, LONG_EDGE / Math.max(wpx, hpx));
          var cw = Math.max(1, Math.round(wpx * scale));
          var ch = Math.max(1, Math.round(hpx * scale));
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var ctx = cv.getContext('2d');
          ctx.fillStyle = '#ffffff';           // JPEG 은 알파가 없다 — 안 깔면 투명부가 검게 나온다
          ctx.fillRect(0, 0, cw, ch);
          ctx.drawImage(img, 0, 0, cw, ch);
          resolve({ dataUrl: cv.toDataURL('image/jpeg', JPEG_Q), w: cw, h: ch });
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('이미지를 열 수 없습니다')); };
      img.src = srcDataUrl;
    });
  }

  function approxKB(dataUrl) {
    var i = dataUrl.indexOf(',');
    var b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
    return Math.round(b64.length * 0.75 / 1024);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── 모달 껍데기 ─────────────────────────────────────────────────────── */
  function ensureModal() {
    var el = document.getElementById('report-modal');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'report-modal';
    el.className = 'settings-modal-overlay';
    el.style.display = 'none';
    el.innerHTML =
      '<div class="settings-modal-shell" role="dialog" aria-modal="true" aria-label="버그·피드백 보내기">' +
        '<div class="settings-modal-header">' +
          '<div class="settings-modal-title">버그·피드백 보내기</div>' +
          '<button class="settings-modal-close" id="report-close" title="닫기 (Esc)">×</button>' +
        '</div>' +
        '<div class="report-body">' +
          '<span class="report-label">무엇인가요</span>' +
          '<div class="report-seg" id="report-seg" role="group" aria-label="신고 유형">' +
            TYPES.map(function (t, i) {
              return '<button type="button" data-type="' + t.key + '" aria-pressed="' + (i === 0) + '">' + t.label + '</button>';
            }).join('') +
          '</div>' +
          '<span class="report-label">겪으신 일을 적어주세요</span>' +
          '<textarea class="report-area" id="report-text" maxlength="' + MAX_TEXT + '" ' +
            'placeholder="예) 섹션을 복제하면 이미지가 사라져요. 두 번째 섹션에서만 그렇습니다."></textarea>' +
          '<span class="report-count" id="report-count">0 / ' + MAX_TEXT + '</span>' +

          '<span class="report-label">이미지 (선택)</span>' +
          '<div class="report-attach" id="report-attach">' +
            '<button class="report-attach-add" type="button" id="report-attach-add">＋ 이미지 첨부</button>' +
            // ★단축키만 있으면 아무도 모른다 — 붙여넣기·끌어놓기가 «된다»는 걸 여기서 말한다
            '<span class="report-attach-hint">붙여넣기(⌘V)나 끌어놓기로도 됩니다</span>' +
          '</div>' +
          '<input type="file" id="report-file" accept="image/png,image/jpeg,image/webp" multiple hidden>' +

          '<label class="report-check" for="report-capture">' +
            '<input type="checkbox" id="report-capture">' +
            '<span>지금 화면도 같이 보내기' +
              '<small>캔버스가 그대로 담깁니다. 고객사 자료가 있다면 끄고 보내세요.</small></span>' +
          '</label>' +
          '<div class="report-shot" id="report-shot"></div>' +

          '<button class="report-disc" type="button" id="report-disc" aria-expanded="false">' +
            '함께 보내지는 것 — 버전·기기·최근 오류 <i>▾</i></button>' +
          '<div class="report-disc-body" id="report-disc-body"></div>' +
        '</div>' +
        '<div class="settings-modal-footer">' +
          '<span class="report-queue-note" id="report-queue-note"></span>' +
          '<button class="settings-btn settings-btn-secondary" id="report-cancel">취소</button>' +
          '<button class="settings-btn settings-btn-primary" id="report-send">보내기</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    // ── 배선 ──
    el.addEventListener('mousedown', function (ev) { if (ev.target === el) close(); });
    el.querySelector('#report-close').addEventListener('click', close);
    el.querySelector('#report-cancel').addEventListener('click', close);

    el.querySelector('#report-seg').addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-type]');
      if (!b || !state) return;
      state.type = b.dataset.type;
      Array.prototype.forEach.call(el.querySelectorAll('#report-seg button'), function (x) {
        x.setAttribute('aria-pressed', String(x === b));
      });
    });

    var ta = el.querySelector('#report-text');
    ta.addEventListener('input', function () {
      if (!state) return;
      state.text = ta.value;
      var c = el.querySelector('#report-count');
      c.textContent = ta.value.length + ' / ' + MAX_TEXT;
      c.classList.toggle('over', ta.value.length >= MAX_TEXT);
    });

    el.querySelector('#report-attach-add').addEventListener('click', function () {
      el.querySelector('#report-file').click();
    });
    el.querySelector('#report-file').addEventListener('change', function (ev) {
      onPickFiles(ev.target.files);
      ev.target.value = '';   // 같은 파일을 다시 고를 수 있게
    });

    /* ── 붙여넣기(⌘V) ────────────────────────────────────────────────────
       버그를 알릴 때 사람은 방금 «찍어둔» 스크린샷을 붙이고 싶어한다.
       지금까지는 파일로 저장했다가 다시 골라야 해서 두 단계가 헛돌았다.
       ★글자를 붙여넣는 건 그대로 둔다 — 클립보드에 «이미지가 있을 때만» 가로챈다.
         본문 입력칸에서 글 붙여넣기가 막히면 그게 더 큰 손해다.
       ★document 에 건다 — 모달 안 어디에 커서가 있든 되게. 열려 있을 때만 동작. */
    document.addEventListener('paste', function (ev) {
      var m = document.getElementById('report-modal');
      if (!m || m.style.display === 'none') return;
      var items = ev.clipboardData && ev.clipboardData.items;
      if (!items) return;
      var files = [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind !== 'file') continue;
        if (!/^image\//.test(items[i].type || '')) continue;
        var f = items[i].getAsFile();
        if (f) files.push(f);
      }
      if (!files.length) return;            // 이미지가 없으면 «건드리지 않는다»(글 붙여넣기 보존)
      ev.preventDefault();
      onPickFiles(files);
    });

    /* ── 끌어놓기 ────────────────────────────────────────────────────────
       ★dragover 에서 preventDefault 를 «해야» drop 이 온다. 안 하면 브라우저가
         그 파일을 창에 열어버려 편집 중이던 신고 내용이 통째로 날아간다. */
    el.addEventListener('dragover', function (ev) {
      if (!ev.dataTransfer || !Array.prototype.some.call(ev.dataTransfer.types || [], function (t) { return t === 'Files'; })) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'copy';
      el.classList.add('report-dropping');
    });
    el.addEventListener('dragleave', function (ev) {
      if (!el.contains(ev.relatedTarget)) el.classList.remove('report-dropping');
    });
    el.addEventListener('drop', function (ev) {
      if (!ev.dataTransfer || !ev.dataTransfer.files || !ev.dataTransfer.files.length) return;
      ev.preventDefault();
      el.classList.remove('report-dropping');
      var imgs = Array.prototype.filter.call(ev.dataTransfer.files, function (f) { return /^image\//.test(f.type || ''); });
      if (!imgs.length) { toast('이미지 파일만 첨부할 수 있습니다'); return; }
      onPickFiles(imgs);
    });

    el.querySelector('#report-capture').addEventListener('change', function (ev) {
      onToggleCapture(ev.target.checked);
    });

    el.querySelector('#report-disc').addEventListener('click', function () {
      var btn = el.querySelector('#report-disc');
      var body = el.querySelector('#report-disc-body');
      var next = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(next));
      body.classList.toggle('on', next);
    });

    el.querySelector('#report-send').addEventListener('click', send);

    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && el.style.display !== 'none') { ev.stopPropagation(); close(); }
    }, true);

    return el;
  }

  /* ── 첨부 ───────────────────────────────────────────────────────────── */
  function attachCount() { return state ? state.attachments.length + (state.capture ? 1 : 0) : 0; }

  function onPickFiles(fileList) {
    if (!state || !fileList || !fileList.length) return;
    var files = Array.prototype.slice.call(fileList);
    var run = files.reduce(function (chain, f) {
      return chain.then(function () {
        if (attachCount() >= MAX_IMAGES) {
          toast('이미지는 최대 ' + MAX_IMAGES + '장까지 보낼 수 있습니다');
          return null;
        }
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () { resolve(String(fr.result || '')); };
          fr.onerror = function () { resolve(''); };
          fr.readAsDataURL(f);
        }).then(function (dataUrl) {
          if (!dataUrl) { toast('「' + (f.name || '이미지') + '」을 읽지 못했습니다'); return; }
          return shrinkToJpeg(dataUrl).then(function (r) {
            if (!state) return;
            // ★클립보드에서 온 파일은 이름이 'image.png' 처럼 뭉뚱그려지거나 비어 있다.
            //   목록에서 「어느 게 뭔지」 구분되게 붙여넣은 것임을 밝힌다.
            var nm = f.name && f.name !== 'image.png' ? f.name : '붙여넣은 이미지';
            state.attachments.push({ name: nm, dataUrl: r.dataUrl, kb: approxKB(r.dataUrl) });
          }).catch(function () { toast('「' + f.name + '」은 이미지가 아닙니다'); });
        });
      });
    }, Promise.resolve());
    run.then(renderAttachments);
  }

  function renderAttachments() {
    var el = document.getElementById('report-modal');
    if (!el || !state) return;
    var box = el.querySelector('#report-attach');
    Array.prototype.forEach.call(box.querySelectorAll('.report-thumb'), function (n) { n.remove(); });
    state.attachments.forEach(function (a, i) {
      var chip = document.createElement('span');
      chip.className = 'report-thumb';
      chip.innerHTML = '<span title="' + esc(a.name) + '">' + esc(a.name) + '</span>' +
        '<small style="color:var(--ui-text-dim)">' + a.kb + 'KB</small>' +
        '<button type="button" aria-label="첨부 제거">✕</button>';
      chip.querySelector('button').addEventListener('click', function () {
        state.attachments.splice(i, 1);
        renderAttachments();
      });
      box.appendChild(chip);
    });
    var add = el.querySelector('#report-attach-add');
    add.disabled = attachCount() >= MAX_IMAGES;
  }

  /* ── 화면 캡처 ──────────────────────────────────────────────────────────
     ★모달을 «감추고» 찍는다 — 안 그러면 신고창이 찍힌 사진을 보내게 된다. */
  function onToggleCapture(on) {
    var el = document.getElementById('report-modal');
    var shot = el.querySelector('#report-shot');
    if (!on) {
      if (state) state.capture = null;
      shot.classList.remove('on');
      shot.innerHTML = '';
      renderAttachments();
      return;
    }
    if (state && state.attachments.length >= MAX_IMAGES) {
      el.querySelector('#report-capture').checked = false;
      toast('이미지는 최대 ' + MAX_IMAGES + '장까지 보낼 수 있습니다');
      return;
    }
    shot.classList.add('on');
    shot.innerHTML = '<em>화면을 담는 중…</em>';
    var a = api();
    if (!a || !a.capture) { shot.innerHTML = '<em>이 환경에서는 화면 캡처를 쓸 수 없습니다</em>'; return; }

    el.style.visibility = 'hidden';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        a.capture().then(function (r) {
          el.style.visibility = '';
          if (!r || !r.ok || !r.dataUrl) {
            shot.innerHTML = '<em>화면을 담지 못했습니다' + (r && r.message ? ' — ' + esc(r.message) : '') + '</em>';
            if (state) state.capture = null;
            return;
          }
          if (!state) return;
          state.capture = { name: 'screen.jpg', dataUrl: r.dataUrl, kb: approxKB(r.dataUrl) };
          shot.innerHTML = '<img alt="보낼 화면 미리보기" src="' + r.dataUrl + '">' +
            '<em>화면 미리보기 · ' + r.w + '×' + r.h + ' · 약 ' + state.capture.kb + 'KB</em>';
          renderAttachments();
        }).catch(function (e) {
          el.style.visibility = '';
          shot.innerHTML = '<em>화면을 담지 못했습니다 — ' + esc(e && e.message) + '</em>';
          if (state) state.capture = null;
        });
      });
    });
  }

  /* ── 「함께 보내지는 것」 ────────────────────────────────────────────── */
  function renderDisclosure() {
    var el = document.getElementById('report-modal');
    if (!el || !state) return;
    var c = state.ctx || {};
    var errs = state.errors || [];
    var acct = state.account;
    var html =
      '<dl>' +
        '<dt>버전</dt><dd>' + esc(c.appVersion || '?') + '</dd>' +
        '<dt>기기</dt><dd>' + esc((c.os || '?') + ' · ' + (c.arch || '?')) + '</dd>' +
        '<dt>화면</dt><dd>' + esc(c.screen || '?') + '</dd>' +
        '<dt>프로젝트</dt><dd>' + esc(c.projectId || '(열린 프로젝트 없음)') + '</dd>' +
        '<dt>계정</dt><dd>' + esc(acct || '로그인하지 않음 — 익명으로 갑니다') + '</dd>' +
      '</dl>' +
      '<h6>최근 오류 ' + errs.length + '건 ' +
        '<span style="font-weight:400">(파일 경로에서 사용자 이름은 지우고 담습니다)</span></h6>';
    if (!errs.length) {
      html += '<p class="report-errs empty" style="margin:0">담긴 오류가 없습니다.</p>';
    } else {
      html += '<ul class="report-errs">' + errs.map(function (e) {
        return '<li>' + esc((e.level || '') + ' · ' + (e.msg || '')) + '</li>';
      }).join('') + '</ul>';
    }
    el.querySelector('#report-disc-body').innerHTML = html;
  }

  /* ── 열기 / 닫기 ────────────────────────────────────────────────────── */
  function open() {
    var el = ensureModal();

    // ★A-f — 열 때마다 «전부» 새로. 첨부·캡처·본문이 지난번 것에서 살아남지 않는다.
    state = {
      type: 'bug',
      text: '',
      attachments: [],
      capture: null,
      errors: (w.ReportBuffer && w.ReportBuffer.list()) || [],
      ctx: {
        screen: (w.screen ? (w.screen.width + '×' + w.screen.height) : ''),
        projectId: w.activeProjectId || '',
      },
      account: '',
      sending: false,
    };

    el.querySelector('#report-text').value = '';
    el.querySelector('#report-count').textContent = '0 / ' + MAX_TEXT;
    el.querySelector('#report-count').classList.remove('over');
    el.querySelector('#report-capture').checked = false;      // ★기본 «끔»
    var shot = el.querySelector('#report-shot');
    shot.classList.remove('on'); shot.innerHTML = '';
    el.querySelector('#report-disc').setAttribute('aria-expanded', 'false');   // ★접힌 채로
    el.querySelector('#report-disc-body').classList.remove('on');
    el.querySelector('#report-queue-note').textContent = '';
    el.querySelector('#report-send').disabled = false;
    el.querySelector('#report-send').textContent = '보내기';
    Array.prototype.forEach.call(el.querySelectorAll('#report-seg button'), function (x, i) {
      x.setAttribute('aria-pressed', String(i === 0));
    });
    renderAttachments();
    renderDisclosure();

    el.style.display = 'flex';
    setTimeout(function () { try { el.querySelector('#report-text').focus(); } catch (_) {} }, 30);

    // 버전·기기·계정·큐 — 비동기로 채운다(열림을 늦추지 않는다)
    var a = api();
    if (a && a.context) {
      a.context().then(function (c) {
        if (!state) return;
        state.ctx.appVersion = c && c.appVersion;
        state.ctx.os = c && c.os;
        state.ctx.arch = c && c.arch;
        if (c && c.queued) {
          el.querySelector('#report-queue-note').textContent = '아직 못 보낸 신고 ' + c.queued + '건';
        }
        renderDisclosure();
      }).catch(function () {});
    }
    if (w.electronAPI && typeof w.electronAPI.getAuthState === 'function') {
      w.electronAPI.getAuthState().then(function (s) {
        if (!state) return;
        state.account = (s && s.signedIn && s.email) ? s.email : '';
        renderDisclosure();
      }).catch(function () {});
    }
  }

  function close() {
    var el = document.getElementById('report-modal');
    if (el) { el.style.display = 'none'; el.style.visibility = ''; }
    state = null;   // ★여기서 첨부가 사라진다(A-f)
  }

  /* ── 보내기 ─────────────────────────────────────────────────────────── */
  function send() {
    if (!state || state.sending) return;
    var el = document.getElementById('report-modal');
    var text = String(state.text || '').trim();
    if (!text) {
      toast('내용을 적어 주세요');
      try { el.querySelector('#report-text').focus(); } catch (_) {}
      return;
    }

    var payload = {
      app: 'goditor',
      type: state.type,
      text: text,
      appVersion: state.ctx.appVersion || '',
      os: state.ctx.os || '',
      arch: state.ctx.arch || '',
      screen: state.ctx.screen || '',
      errors: state.errors,
    };
    if (state.ctx.projectId) payload.projectId = state.ctx.projectId;

    /* ★C-c — 보낼 이미지가 «하나도 없으면» images 키를 아예 넣지 않는다.
       빈 배열도 아니다. 서버는 hasImagesKey 로 「캡처를 요청했는가」를 기록한다. */
    var imgs = [];
    state.attachments.forEach(function (a) {
      imgs.push({ kind: 'attach', name: a.name, mime: 'image/jpeg', data: a.dataUrl });
    });
    if (state.capture) {
      imgs.push({ kind: 'capture', name: state.capture.name, mime: 'image/jpeg', data: state.capture.dataUrl });
    }
    if (imgs.length) payload.images = imgs;

    state.sending = true;
    var btn = el.querySelector('#report-send');
    btn.disabled = true;
    btn.textContent = '보내는 중…';

    var a = api();
    if (!a || !a.submit) {
      state.sending = false; btn.disabled = false; btn.textContent = '보내기';
      toast('이 환경에서는 신고를 보낼 수 없습니다');
      return;
    }

    a.submit(payload).then(function (r) {
      close();
      if (r && r.sent) {
        toast('✅ 보냈습니다. 확인 후 반영하겠습니다');
      } else if (r && r.queued) {
        // 서버가 죽어도 사라지지 않는다(PLAN §2⑸) — 그 사실을 «말한다».
        toast('📮 지금은 서버에 닿지 않아 저장해 뒀습니다. 다음에 자동으로 보냅니다');
      } else {
        toast('⚠️ 보내지 못했습니다' + (r && r.message ? ' — ' + r.message : ''));
      }
    }).catch(function (e) {
      if (state) { state.sending = false; }
      btn.disabled = false; btn.textContent = '보내기';
      toast('⚠️ 보내지 못했습니다 — ' + (e && e.message ? e.message : '알 수 없는 오류'));
    });
  }

  w.openReportModal  = open;
  w.closeReportModal = close;
})(window);
