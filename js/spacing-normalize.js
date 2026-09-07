/**
 * Goditor — 갭 «감수 패스»의 렌더러 쪽. (2026-09-07 신설)
 *
 * ★이 파일은 «판단을 하지 않는다». 규격(값·무게·조합)은 전부
 *   main/claude-pm/services/spacing.js «한 곳»에 있고, 여기는 두 가지만 한다:
 *     window.readSpacingSequence(sectionId?) — 섹션의 «세로 시퀀스»를 읽어 준다(읽기 전용)
 *     window.applySpacingOps(plan)           — 받은 «해야 할 일 목록»을 DOM 에 찍는다
 *   ⇒ 규격 사본을 여기 두지 않는다. canvas-state.js 의 PFX 표가 «사본»이라 타입이 늘 때마다
 *     갈라지는데, 같은 병을 하나 더 만들지 않는다.
 *
 * ⓓ 자동/수동 — window.markGapManual(gb) 로 «수동» 도장을 찍는다.
 *   사람이 높이를 정한 갭(data-gap-auto 없음)은 감수가 «안 건드린다». 현빈이 「여긴 37px 이
 *   예뻐」라고 맞춘 걸 되돌리면 도와주는 게 아니라 뺏는 것이다.
 *   ★표식이 «없는» 갭도 수동으로 본다 — 반대로 정하면 기존 프로젝트의 손맞춤이 전부 되돌아간다.
 *
 * No ES modules — plain <script> (canvas-state.js 와 같은 관용구).
 */
(function () {
  'use strict';

  var AUTO_ATTR = 'gapAuto';       // dataset.gapAuto → data-gap-auto
  var AUTO_ON = '1';

  function _sections(sectionId) {
    if (sectionId) {
      var s = document.getElementById(sectionId);
      return (s && s.classList.contains('section-block')) ? [s] : null;
    }
    var root = document.getElementById('canvas') || document;
    return [].slice.call(root.querySelectorAll('.section-block:not([data-ghost])'));
  }

  function _newGapId() {
    if (typeof window.genId === 'function') return window.genId('gb');
    return 'gb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* 갭 하나가 «자동»인가. ⛔표식이 없으면 «수동»이다(위 주석의 이유). */
  function _isAuto(el) { return el.dataset && el.dataset[AUTO_ATTR] === AUTO_ON; }

  /** 갭에 «자동» 도장. 새로 만들어지는 갭이 지나는 자리에서 부른다. */
  function markGapAuto(gb) {
    if (gb && gb.dataset) gb.dataset[AUTO_ATTR] = AUTO_ON;
    return gb;
  }

  /** 갭에서 «자동» 도장을 뗀다 = 이제 사람 것이다. 높이를 사람이 정하는 자리에서 부른다. */
  function markGapManual(gb) {
    if (gb && gb.dataset) delete gb.dataset[AUTO_ATTR];
    return gb;
  }

  /* ── 타입 읽기 ──
   * 우선순위: ⑴.text-block 의 dataset.type(heading/body/caption/label/bullet/liner…)
   *          ⑵그 밖 요소의 dataset.type(icon-circle/joker/grid…)
   *          ⑶클래스에서 «파생»(asset-block → asset, label-group-block → label_group)
   * ★⑶은 «표»가 아니라 «규칙»이다 — 표를 또 만들면 또 갈라진다. 규칙이 못 맞히면
   *   spacing.js 가 「모르는 타입」으로 «말하고» 안전값으로 떨어진다(조용히 안 넘어간다). */
  function _typeOf(el) {
    if (el.dataset && el.dataset.type) return String(el.dataset.type);
    var cls = (el.className && el.className.baseVal !== undefined) ? el.className.baseVal : String(el.className || '');
    var m = cls.split(/\s+/).filter(function (c) { return /-block$/.test(c); })[0];
    if (m) return m.replace(/-block$/, '');
    if (el.classList && el.classList.contains('row')) return 'row';
    return '';
  }

  var BLOCKISH = '.text-block, .asset-block, .table-block, .canvas-block, .grid-block, .graph-block,'
    + ' .step-block, .comparison-block, .mockup-block, .chat-block, .laurel-block, .label-group-block,'
    + ' .icon-circle-block, .icon-text-block, .icon-block, .divider-block, .shape-block, .vector-block,'
    + ' .banner02-block, .bridge-block, .infocard-block, .innercard-block, .joker-block, .frame-block';

  /* .row 는 블록 여럿을 «나란히» 담는 래퍼다. 그 줄의 성격은 자식이 정한다
     (이미지가 하나라도 있으면 그 줄은 덩어리) ⇒ 자식 타입을 같이 실어 보낸다. */
  function _childTypes(el) {
    var kids = [].slice.call(el.querySelectorAll(BLOCKISH));
    if (!kids.length) return null;
    var out = [], seen = {};
    for (var i = 0; i < kids.length && out.length < 8; i++) {
      var t = _typeOf(kids[i]);
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    }
    return out.length ? out : null;
  }

  /* ★흐름에 «안 끼는» 것은 시퀀스가 아니다 — 절대배치(스티커·어노테이션)를 흐름 블록으로 세면
     그 앞뒤에 갭을 넣어 버린다. 눈에 보이는 결과가 실제로 어긋나는 자리다. */
  function _inFlow(el) {
    try {
      var pos = (window.getComputedStyle ? getComputedStyle(el).position : '') || '';
      return pos !== 'absolute' && pos !== 'fixed';
    } catch (_) { return true; }
  }

  function _readOne(section) {
    var inner = section.querySelector('.section-inner');
    if (!inner) return { sectionId: section.id || null, name: section.dataset.name || '', items: [], noInner: true };
    var items = [];
    [].slice.call(inner.children).forEach(function (el) {
      if (!(el instanceof Element)) return;
      if (!_inFlow(el)) return;
      if (el.classList.contains('gap-block')) {
        /* ★«사실»만 싣는다 — 자동/수동 «판정»은 spacing.js 의 isAutoGap 이 한다(판단은 한 곳).
           hasInlineHeight = 「누군가 이 갭의 높이를 정한 적이 있나」의 구조적 대리값이다.
           이 앱에서 갭 높이를 바꾸는 자리는 전부 .style.height 를 쓴다(prop-gap 3 · multisel ·
           updateGapBlock). inline height 가 없으면 CSS 기본값이 보이는 것이고, 그건 아무도
           «고르지 않은» 값이다. */
        var raw = parseInt(el.style.height, 10);
        var hasInline = isFinite(raw);
        items.push({
          id: el.id || null, kind: 'gap',
          height: hasInline ? raw : el.offsetHeight,
          marked: _isAuto(el), hasInlineHeight: hasInline,
        });
        return;
      }
      var t = _typeOf(el);
      /* 자유배치(freeLayout) 프레임 «안»은 자기 좌표계다 — 자식 타입을 끌어오면 안 된다. */
      var free = el.dataset && el.dataset.freeLayout === 'true';
      var kids = (!free && (el.classList.contains('row') || el.classList.contains('frame-block'))) ? _childTypes(el) : null;
      /* 텍스트 프레임은 «껍데기»다 — 안의 text-block 타입이 그 줄의 타입이다. */
      if (el.dataset && el.dataset.textFrame === 'true') {
        var tb = el.querySelector('.text-block');
        if (tb) { t = _typeOf(tb); kids = null; }
      }
      var it = { id: el.id || null, kind: 'block', type: t };
      /* ⛔`kids.length > 1` 로 걸지 마라 — 이미지 «하나»만 든 줄이 childTypes 없이 나가서
         row 가 「모르는 타입」(무게 2)로 떨어졌다. 제목→이미지줄이 M80 이어야 하는데 S40 이
         됐고, 픽스처로만 재던 노드 하네스는 그걸 «못 봤다»(2026-09-07 DOM 검사가 잡았다). */
      if (kids && kids.length) it.childTypes = kids;
      items.push(it);
    });
    return { sectionId: section.id || null, name: section.dataset.name || '', items: items };
  }

  /**
   * window.readSpacingSequence(sectionId?)
   * @returns {{ok:true, sections:Array}} | {{ok:false, code, message}}
   */
  function readSpacingSequence(sectionId) {
    var secs = _sections(sectionId);
    if (secs === null) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sectionId };
    return { ok: true, sections: secs.map(_readOne) };
  }

  /**
   * window.applySpacingOps({ sections: [{ sectionId, ops:[...] }] })
   * ops: {op:'set',id,height} | {op:'remove',id} | {op:'insert',afterId|null,height}
   *
   * ★적용 순서 = remove → set → insert (규약). insert 의 afterId 가 가리키는 것이
   *   remove 로 사라지면 안 되기 때문이다(afterId 는 항상 «블록»이라 지금은 안 겹치지만,
   *   순서를 규약으로 못박아 둔다).
   * ★ops 가 «비면» pushHistory 도 안 부른다 — 되돌리기 이력을 감수가 더럽히지 않는다.
   */
  function applySpacingOps(plan) {
    var secs = (plan && plan.sections) || [];
    var total = 0;
    secs.forEach(function (s) { total += ((s && s.ops) || []).length; });
    if (!total) return { ok: true, applied: 0, inserted: 0, removed: 0, resized: 0, skipped: 'no-ops' };

    /* ★plan.noHistory = 「직전 히스토리 칸이 «우리 감수»이고 그 뒤로 아무 일도 없었다」.
       그러면 칸을 «새로 쌓지 않는다» — 그 칸이 이미 «감수 전» 상태를 들고 있어서,
       되돌리면 어차피 감수 «전»으로 간다. 안 그러면 긴 턴에서 되돌리기 목록이
       「간격 감수」로 도배된다(팀리드 지적). 판정은 main 이 히스토리 꼭대기로 한다. */
    var pushed = false;
    if (!plan.noHistory && typeof window.pushHistory === 'function') {
      window.pushHistory('간격 감수');
      pushed = true;
    }

    var inserted = 0, removed = 0, resized = 0, misses = [];
    secs.forEach(function (s) {
      var section = s.sectionId ? document.getElementById(s.sectionId) : null;
      var inner = section && section.querySelector('.section-inner');
      if (!inner) { misses.push('section ' + s.sectionId + ' 없음'); return; }
      var ops = s.ops || [];

      ops.filter(function (o) { return o.op === 'remove'; }).forEach(function (o) {
        var el = document.getElementById(o.id);
        if (el && el.classList.contains('gap-block')) { el.remove(); removed++; }
        else misses.push('remove 대상 없음: ' + o.id);
      });

      ops.filter(function (o) { return o.op === 'set'; }).forEach(function (o) {
        var el = document.getElementById(o.id);
        if (el && el.classList.contains('gap-block')) {
          el.style.height = o.height + 'px';
          if (el.dataset) el.dataset.height = String(o.height);
          markGapAuto(el);                 // 감수가 정한 값은 «자동»이다
          resized++;
        } else misses.push('set 대상 없음: ' + o.id);
      });

      ops.filter(function (o) { return o.op === 'insert'; }).forEach(function (o) {
        var gb = document.createElement('div');
        gb.className = 'gap-block';
        gb.dataset.type = 'gap';
        gb.id = _newGapId();
        gb.style.height = o.height + 'px';
        gb.dataset.height = String(o.height);
        markGapAuto(gb);
        if (o.afterId == null) inner.insertBefore(gb, inner.firstChild);
        else {
          var ref = document.getElementById(o.afterId);
          if (ref && ref.parentElement === inner) ref.after(gb);
          else { misses.push('insert 기준 없음: ' + o.afterId); inner.appendChild(gb); }
        }
        if (typeof window.bindBlock === 'function') { try { window.bindBlock(gb); } catch (_) {} }
        inserted++;
      });
    });

    if (typeof window.buildLayerPanel === 'function') { try { window.buildLayerPanel(); } catch (_) {} }
    if (typeof window.scheduleAutoSave === 'function') { try { window.scheduleAutoSave(); } catch (_) {} }

    return { ok: true, applied: inserted + removed + resized, inserted: inserted, removed: removed, resized: resized, misses: misses, pushedHistory: pushed };
  }

  window.readSpacingSequence = readSpacingSequence;
  window.applySpacingOps = applySpacingOps;
  window.markGapAuto = markGapAuto;
  window.markGapManual = markGapManual;
})();
