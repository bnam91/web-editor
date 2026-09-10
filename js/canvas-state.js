/**
 * Goditor Claude PM — get_canvas_state renderer (window-exposed)
 *
 * READ-ONLY canvas inspection for the PM. Returns every section on the active
 * page with EVERY block in it (blockId, type, + a bounded summary) so the PM can
 * resolve "the price text" / "that photo" → a concrete blockId before mutating.
 *
 * ★2026-09-06 — 여태 «.text-block 만» 훑었다. 그래서 이미지(ab_)·표(tbl_)·갭(gb_)이
 *   응답에 «아예 없었고», 새 세션에서 「이 사진 갈아끼워줘」가 깨졌다(id 를 얻을 길이 없다).
 *   유일한 우회 read_project(includeFull) 는 이미지 base64 를 통째로 게워내 못 쓴다.
 * ⛔★그래서 이 파일의 규칙은 하나다 — **«지목할 수 있을 만큼»만 내보낸다.**
 *   내보내는 것: blockId · type · 짧은 요약(이미지=파일명/치수, 표=헤더+행수, 갭=높이…)
 *   ⛔내보내지 «않는» 것: imgSrc·dataURL·표 셀 전문·SVG 원문. 고치려던 병을 다시 만들지 않는다.
 *   ⇒ 요약 함수는 «원본 src 를 인자로 받지 않는다» — 구조적으로 샐 수 없게 갈라 뒀다.
 *
 * No ES modules — exposed as window.getCanvasState (loaded via <script> in index.html).
 * Reads the DOM directly; does NOT define getBlockById/selectBlock/editTextBlock
 * (owned by another team) and performs NO mutation.
 */
(function () {
  'use strict';

  // 활성 페이지는 #canvas 컨테이너에 렌더링됨 (save-load.js의 canvasEl 컨벤션과 동일).
  function _getCanvasRoot() {
    return document.getElementById('canvas') || document;
  }

  /* ★★«안내문구»(고스트 텍스트)를 «본문»과 가른다 (2026-09-08 현빈 지시).
       빈 텍스트 블록의 「소제목을 입력하세요」는 CSS 유령이 아니라 «진짜 DOM 글자»다
       (block-factory.js 가 값으로 넣고 data-is-placeholder='true' 로 표시한다).
       에디터 UI 는 그 표시를 읽는데(block-drag.js 가 「안내문구가 본문으로 굳는 지뢰 방지」를 한다)
       MCP 는 «안 읽어서», 밖에서 보면 안 쓴 블록이 «다 쓴 것»으로 보였다.
     ⛔지우지 «않는다» — 표시한다. AI 가 「여긴 아직 안 썼다」를 «알아야» 채울 수 있다.
       숨기면 「없다」가 되고, 그럼 채워달라고 시킬 수도 없다. */
  function _isPlaceholderText(el) {
    if (!el) return false;
    try {
      var holders = [].slice.call(el.querySelectorAll('[data-placeholder]'));
      if (el.hasAttribute && el.hasAttribute('data-placeholder')) holders.push(el);
      if (!holders.length) return false;
      // «글자가 있는» 홀더 중 하나라도 진짜 본문이면 그 블록은 안내문구가 아니다
      for (var i = 0; i < holders.length; i++) {
        var h = holders[i];
        if (h.dataset.isPlaceholder === 'true') continue;   // 안내문구 — 넘어간다
        if (h.dataset.blank === 'true') continue;           // 의도적 빈 줄 — 글자가 없다
        if (((h.innerText || '').trim())) return false;     // ★진짜 글자를 찾았다
      }
      return true;
    } catch (_) { return false; }
  }

  // 단일 .text-block → { blockId, type, text, color, fontSize, align, placeholder? }
  function _readTextBlock(block) {
    const contentEl = block.querySelector('[class^="tb-"]');
    const type = block.dataset.type || '';
    const text = (contentEl && contentEl.innerText ? contentEl.innerText : '').slice(0, 200);
    // align: label은 block.style.textAlign, 그 외는 contentEl.style.textAlign (applyTextOpts 컨벤션 미러)
    const align = type === 'label'
      ? (block.style.textAlign || '')
      : (contentEl && contentEl.style.textAlign ? contentEl.style.textAlign : '');
    return {
      blockId: block.id || null,
      type,
      text,
      color: (contentEl && contentEl.style.color) ? contentEl.style.color : '',
      fontSize: (contentEl && contentEl.style.fontSize) ? contentEl.style.fontSize : '',
      align,
      // ★«아직 안 쓴 칸»이면 그렇게 말한다 — text 는 그대로 싣는다(무슨 안내문구인지도 정보다)
      ...(_isPlaceholderText(block) ? { placeholder: true } : {}),
    };
  }

  /* ── 블록 id 접두사 → 타입 이름 ──
   * ★정본은 main/claude-pm/mcp-block-tools.js 의 BLOCK_TYPES 다(여기는 «사본»).
   *   이 파일은 plain script 라 import 를 못 해서 표를 복제한다.
   *   ⇒ 거기서 타입이 늘면 여기도 늘려라. 안 늘려도 «빠지지는 않는다» — 아래 unknown 참고. */
  var PFX = {
    tb_: 'text', gb_: 'gap', ab_: 'asset', ss_: 'frame', cvb_: 'canvas', tbl_: 'table',
    cmp_: 'comparison', stb_: 'step', icn_: 'iconify', icb_: 'icon_circle', itb_: 'icon_text',
    dvd_: 'divider', stk_: 'sticker', sb_: 'speech_bubble', chb_: 'chat', lg_: 'label_group',
    lrb_: 'laurel', grb_: 'graph', shp_: 'shape', vb_: 'vector', mkp_: 'mockup', lnr_: 'liner',
    /* ★row_ 는 «블록 도구»엔 없지만 DOM 에는 있다(나란히 배치 래퍼).
       move_block 이 「행은 통째로 움직인다」고 말하는 그것이라, 구조를 알려면 보여야 한다. */
    row_: 'row',
    /* ★정본에 있는데 여기 빠져 있던 것들(2026-09-07 전수 대조로 찾음).
       bn2_ 는 위 거르개까지 겹쳐 «아예 안 나왔고», grad_ 는 type:null 로 «이름 없이» 나왔다. */
    bn2_: 'banner02', grad_: 'gradient',
    /* ★zoom(확대블럭)도 MCP 정본(BLOCK_TYPES)엔 없다 — grid 와 같은 처지라 «읽기 이름»만 준다. */
    zmb_: 'zoom',
    /* ★grid 는 «앱에는 있는데 MCP 정본(BLOCK_TYPES)에 없다» — 만들지도 고치지도 못한다.
       그래도 «읽기»는 이름을 붙여 준다. 「보이는데 못 만진다」가 「안 보인다」보다 낫다. */
    grd_: 'grid',
    /* ★옛 프로젝트의 그리드는 접두가 `duo_` 다(2026 개명 전 — grid-block.js 의 GRID_ID_PREFIXES 참조).
       ⛔이걸 빼면 «옛 프로젝트에서만» 그리드가 이름 없이 나온다 — 새 프로젝트로 시험하면 안 드러난다. */
    duo_: 'grid',
  };
  function _typeOf(id) {
    var best = null;
    for (var k in PFX) if (id.indexOf(k) === 0 && (!best || k.length > best.length)) best = k;
    return best ? PFX[best] : null;
  }

  /* ★요약기 — «원본 src 를 안 받는다». 파생값(파일명·치수·개수)만 만든다.
   *   ⛔여기서 dataURL 이 새는 것을 «구조로» 막는 자리다. */
  /* ★«전문 읽기» — 섹션을 «지목해서» 읽을 때만 쓴다(full=true).
       ⛔왜 필요한가(2026-09-07 실측): 넣은 텍스트 163개 중 «73개만» 읽혔다.
         표는 행 «내용»이 통째로 없고(개수만), 스텝·비교는 `{items:N}` 만 왔다.
         그래서 「이 블록 텍스트를 이걸로 바꿔줘」·「오타 검사해줘」 같은 일을 «시작조차» 못 했다.
       ★읽기의 값은 «그 다음에 행동할 수 있는가»에서 나온다 — 개수만 아는 건 읽은 게 아니다.
       ⇒ 페이지 전체 훑기는 지금처럼 가볍게 두고, «한 섹션»을 지목했을 때만 전문을 준다.
         (섹션 단위라 응답 크기가 자연히 묶인다)
       ⛔여기서도 원본 src·dataURL 은 «절대» 안 싣는다 — 그 경계는 그대로다. */
  function _fullContent(el, type) {
    var txt = function (x) { return ((x && x.innerText) || '').trim().replace(/\s+/g, ' '); };
    try {
      if (type === 'table') {
        var trs = [].slice.call(el.querySelectorAll('tr'));
        var head = [], body = [];
        trs.forEach(function (tr) {
          var th = [].slice.call(tr.querySelectorAll('th')).map(txt);
          var td = [].slice.call(tr.querySelectorAll('td')).map(txt);
          if (th.length) head = th;
          if (td.length) body.push(td);
        });
        return { headers: head, rows: body };            // ★행 «전부»
      }
      if (type === 'step' || type === 'comparison' || type === 'label_group' || type === 'chat') {
        var items = [].slice.call(el.children).map(function (c) {
          var lines = [].slice.call(c.querySelectorAll('*'))
            .filter(function (n) { return n.children.length === 0 && txt(n); })
            .map(txt);
          // 자식 요소가 없으면 자기 텍스트라도
          if (!lines.length && txt(c)) lines = [txt(c)];
          return lines;
        }).filter(function (a) { return a.length; });
        return { items: items };                          // ★칸마다 «줄들»
      }
      if (type === 'canvas' || type === 'card') {
        var cells = [].slice.call(el.querySelectorAll('[class*="cell"], [class*="card"]'))
          .map(txt).filter(Boolean);
        if (!cells.length) { var t0 = txt(el); return t0 ? { text: t0 } : {}; }
        return { cells: cells };                          // ★카드 «전부»
      }
      var t = txt(el);
      if (!t) return {};                                  // ⛔60자로 안 자른다
      return _isPlaceholderText(el) ? { text: t, placeholder: true } : { text: t };
    } catch (_) { return {}; }
  }

  function _summarize(el, type, full) {
    if (full) {
      var f = _fullContent(el, type);
      /* 이미지 계열은 «전문»이라도 파생값이 답이다(원본 src 는 안 싣는다) */
      if (type === 'asset' || type === 'mockup' || type === 'iconify') f = null;
      if (f && Object.keys(f).length) return f;
    }
    try {
      if (type === 'asset' || type === 'mockup' || type === 'iconify') {
        var img = el.querySelector('img');
        var out = {};
        if (img) {
          var src = img.getAttribute('src') || '';
          // ⛔src 자체는 «절대» 싣지 않는다 — 파일명만 뽑는다(dataURL 이면 그 사실만).
          out.image = /^data:/.test(src) ? '(inline data)' : (src.split('/').pop() || '').slice(0, 60);
          if (img.naturalWidth) out.natural = img.naturalWidth + 'x' + img.naturalHeight;
        }
        var n = el.querySelectorAll('img').length;
        if (n > 1) out.images = n;
        return out;
      }
      if (type === 'table') {
        var rows = el.querySelectorAll('tr').length;
        var heads = [].slice.call(el.querySelectorAll('th')).map(function (t) {
          return (t.innerText || '').trim().slice(0, 24);
        }).slice(0, 8);
        return { rows: rows, headers: heads };   // ⛔셀 «전문»은 안 싣는다
      }
      if (type === 'gap') return { height: el.style.height || '' };
      if (type === 'divider') return { style: el.dataset.style || '' };
      if (type === 'comparison' || type === 'step' || type === 'label_group' || type === 'chat') {
        return { items: el.children ? el.children.length : 0 };
      }
      // 그 밖: 사람이 지목할 «한 줄»만
      var t = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      if (!t) return {};
      // ★프레임 안이 «전부» 안내문구면 그 미리보기는 «내용»이 아니다 — 그렇게 표시한다
      return _isPlaceholderText(el) ? { preview: t, placeholder: true } : { preview: t };
    } catch (_) { return {}; }
  }

  // 단일 .section-block → { sectionId, name, blocks: [...] }
  function _readSection(section, full) {
    const blocks = [];
    const seen = Object.create(null);
    /* ★id 를 가진 후손을 «document order» 로 훑는다 — .text-block 만 보던 것이 이 결함의 원인이었다.
       ⛔모르는 접두사도 «버리지 않는다»: type:null 로 실어 보낸다. 조용히 빠지는 게 그 병이었다. */
    section.querySelectorAll('[id]').forEach((el) => {
      const id = el.id || '';
      if (!id || id.indexOf('sec_') === 0 || seen[id]) return;
      const type = _typeOf(id);
      /* ⛔이 거르개가 «숫자가 든 접두»를 통째로 버렸다 — `bn2_`(banner02)가 그래서 «아예 안 나왔다».
         실측(2026-09-07, 끌리젠 사본): 디스크에 bn2_ 3개가 있는데 그 섹션을 읽으면 19블록 중 0개.
         이름이 바뀐 게 아니라 «없는 취급»이었다.
       ★그리고 바로 위 PFX 주석이 「안 늘려도 빠지지는 않는다」고 «약속»하고 있었다 —
         이 한 줄이 그 약속을 안 지킨 것이다. 주석이 코드보다 많은 것을 약속한 자리다.
       ⇒ 접두에 숫자를 허용한다. ⛔블록 «아이디»를 바꾸는 처방은 틀렸다 —
         옛 프로젝트 파일엔 이미 bn2_ 로 저장돼 있어서, 접두를 바꿔도 «옛것은 그대로 안 읽힌다». */
    if (type === null && !/^[a-z][a-z0-9]{1,5}_/.test(id)) return;   // 블록 id 모양이 아닌 것만 거른다
      seen[id] = 1;
      if (el.classList.contains('text-block')) {
        /* ⛔텍스트도 «같은» 부모 정보를 실어야 한다 — 안 그러면 텍스트만 구조를 모른다.
           그리고 텍스트가 프레임 안에 있는 «다수»다(실측 205/246). */
        let pid = null, dep = 0;
        for (let a = el.parentElement; a && a !== section; a = a.parentElement) {
          const aid = a.id || '';
          if (aid && aid !== section.id && _typeOf(aid) !== null) { if (!pid) pid = aid; dep++; }
        }
        blocks.push(Object.assign(_readTextBlock(el), { parentId: pid, depth: dep }));
        return;
      }
      /* ★«어느 블록이 어느 것 안에 있나»를 같이 싣는다 (2026-09-07).
         ⛔없으면 목록이 «평평»해서, 프레임 안에 이미지 3개가 있어도 형제로 보인다.
           실측: 실물 프로젝트의 텍스트 246개 중 205개(83%)가 프레임 «안»에 있다 — 중첩이 정상이다.
           ⇒ 「이 프레임 지워줘」가 무엇을 같이 지우는지, 「이 안에 넣어줘」가 어디인지 알 수가 없었다.
         ★부모는 «블록 id 를 가진 가장 가까운 조상»이다(섹션은 부모로 안 센다 — 그건 컨테이너가 아니라 뿌리다). */
      let parentId = null, depth = 0;
      for (let a = el.parentElement; a && a !== section; a = a.parentElement) {
        const aid = a.id || '';
        if (aid && aid !== section.id && _typeOf(aid) !== null) {
          if (!parentId) parentId = aid;
          depth++;
        }
      }
      blocks.push({ blockId: id, type: type, parentId: parentId, depth: depth,
                    summary: _summarize(el, type, full) });
    });
    /* ★★A/B 베리에이션을 «말한다» (2026-09-08 현빈 지시).
         A안·B안은 «같은 자리의 두 시안»인데, 이걸 안 실어 보내면 밖에서는 «그냥 섹션 두 개»로 보인다.
         ⇒ 「섹션 정리해줘」 같은 일에서 B안을 «중복»으로 알고 지우자고 할 수 있다.
       ⛔숨기지 «않는다» — 표시한다. 안내문구(placeholder)와 같은 원칙이다:
         AI 가 「이건 같은 자리의 다른 안이다」를 알아야 옳게 다룬다.
       데이터 출처 = js/section-variation.js 의 createVariation() 이 심는 셋. */
    const vg = section.dataset.variationGroup || '';
    return {
      sectionId: section.id || null,
      name: section.dataset.name || '',
      ...(vg ? {
        variationGroup: vg,
        variation: section.dataset.variation || '',
        variationActive: section.dataset.variationActive === '1',
      } : {}),
      blocks,
    };
  }

  /**
   * window.getCanvasState(sectionId?)
   * - sectionId 주어지면 해당 섹션만, 없으면 활성 페이지의 모든 .section-block.
   * - { ok:true, sections:[...] } 또는 sectionId 미발견 시 { ok:false, code:'NOT_FOUND', message }.
   */
  function getCanvasState(sectionId, opts) {
    const root = _getCanvasRoot();
    /* ★«한 섹션을 지목»하면 기본이 «전문»이다 — 그때는 내용을 읽으러 온 것이기 때문이다.
       페이지 전체 훑기는 지금처럼 요약(응답이 커지면 못 쓴다). full 로 뒤집을 수 있다. */
    const full = (opts && typeof opts.full === 'boolean') ? opts.full : !!sectionId;

    if (sectionId) {
      const section = document.getElementById(sectionId);
      if (!section || !section.classList.contains('section-block')) {
        return {
          ok: false,
          code: 'NOT_FOUND',
          message: 'section not found: ' + sectionId,
        };
      }
      return { ok: true, full: full, sections: [_readSection(section, full)] };
    }

    const sections = [];
    root.querySelectorAll('.section-block').forEach((section) => {
      sections.push(_readSection(section, full));
    });
    return { ok: true, full: full, sections };
  }

  window.getCanvasState = getCanvasState;
})();
