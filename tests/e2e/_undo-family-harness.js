/* ⚠️★[이 계측기의 구멍 · 2026-09-22] 아래 unit() 의 정규화가 «덜» 되어 있다.
 *   끝에서 `.replace(/\s+/g, ' ')` 만 하므로 태그 사이 공백이 «한 칸으로» 남고,
 *   `> <` 와 `><` 가 «다른 글자»가 된다 ⇒ «공백만» 바뀐 재직렬화를 「바뀌었다」로 센다.
 *   ⇒ diff().n · same() 을 쓰는 모든 축이 «두 방향»으로 틀릴 수 있다:
 *     무변화를 못 보고(dead·stuck 거짓 초록) · 없는 변화를 보고(same() 거짓 빨강).
 *   ★순수 정수 tip().pos 를 쓰는 줄(notes[].slot 등)은 이 결함이 안 낀다.
 *   ⛔여기서 «고쳐서» 쓰지 마라 — 고치면 재는 양이 바뀌어 tests/e2e/13-undo-family.spec.js 의
 *     기준선 수와 대조할 수 없게 된다. 다시 쓴 판(wt-eval-undo)이 오면 통째로 갈아라.
 */
/* ══════════════════════════════════════════════════════════════════════════
   _undo-family-harness — 되돌리기(⌘Z) 계열을 «칸»으로 재는 계측기 (브라우저에 얹는 소스)
   ──────────────────────────────────────────────────────────────────────────
   ⛔이 파일은 제품 코드가 아니다. tests/e2e/13-undo-family.spec.js 가 문자열로 읽어
     page.evaluate 로 «앱 안»에 한 번 설치한다(window.__UF).

   ══ 재는 양 ════════════════════════════════════════════════════════════════
   「화면이 바뀌었나」가 아니라 «칸»을 센다. 세 고장이 갈리는 자리가 거기다:
     ㉠ 되돌아갈 «자리»가 없다 — ⌘Z 를 눌러도 칸도 안 줄고 화면도 안 바뀐다
     ㉡ 한 칸에 두 동작   — ⌘Z 한 번이 마디를 «건너뛴다»
     ㉢ 먹통 칸          — 칸은 줄었는데 바뀐 것이 0
   ⛔㉠ 과 ㉢ 은 화면상 둘 다 「⌘Z 했는데 안 바뀐다」로 보이지만 원인이 반대다.
     그래서 ㉠ 은 «칸이 줄었나»(historyPos)로, ㉢ 은 «칸이 줄었는데 바뀐 게 0인가»로 가른다.

   ══ 지문(fingerprint) — «내용»의 정의를 내가 짓지 않는다 ═══════════════════
   앱 자신의 직렬화(window.getSerializedCanvas)를 파싱해서 id 가 달린 요소마다 한 칸을 만든다.
   ⛔살아있는 DOM 을 직접 재면 안 된다 — 실측(2026-09-22)으로 도형 판에서 «글자크기만»
     바꾼 ⌘Z 가 3개로 세어졌고 그 둘은 선택 핸들의 `style=""` 였다(UI 크롬).
   ★미확정 영상(video-pending)은 직렬화 «문자열 밖»에 산다(js/io/section-serialize.js).
     그래서 사이드카 열쇠를 __videoPending 칸으로 같이 싣는다 — 안 그러면 「영상 업로드」가
     지문상 «아무 일도 없었던 것»으로 보인다(T-130).
════════════════════════════════════════════════════════════════════════════ */
(function () {
  const raf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  /* ⚠️정착 창을 깎지 마라 — ResizeObserver 는 rAF «뒤»에 배달된다(js/insert-history.js 규약 ⑤). */
  const settle = async (ms) => { await raf(); await new Promise(r => setTimeout(r, ms || 250)); await raf(); };

  /* 자식 요소는 <x id> 로 바꿔치워, 한 칸이 «자기 것»만 담게 한다.
     ⛔안 그러면 섹션 한 칸이 캔버스 전체를 담아 「바뀐 개수」가 언제나 최대가 된다. */
  function unit(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('[id]').forEach(d => { const ph = c.ownerDocument.createElement('x'); ph.setAttribute('id', d.id); d.replaceWith(ph); });
    c.querySelectorAll('.section-toolbar, .section-hitzone').forEach(n => n.remove());
    /* js/history.js _stripNonEdit 과 «같은 것»만 벗긴다 — 상호작용 플래그지 편집이 아니다. */
    return c.outerHTML.replace(/ draggable="(?:true|false)"/g, '').replace(/--sec-clip:[^;"]*;?/g, '').replace(/\s+/g, ' ').trim();
  }
  function vpKey() {
    /* ⛔직렬화 «직후»에만 읽어야 한다 — getLastVideoPendingSidecar 는 마지막 sweep 결과다. */
    const sc = window.getLastVideoPendingSidecar && window.getLastVideoPendingSidecar();
    if (!sc) return '';
    return Object.keys(sc).sort().map(k => {
      const v = sc[k] || {};
      return k + ':' + String(v.imgSrc || '').length + ':' + v.trimIn + ':' + v.trimOut + ':' + v.playbackRate;
    }).join('|');
  }
  function fp() {
    const html = window.getSerializedCanvas();
    const key  = vpKey();                       // ★순서 고정: 직렬화 → 사이드카
    const doc  = new DOMParser().parseFromString('<div id="__root">' + html + '</div>', 'text/html');
    const m = {};
    doc.querySelectorAll('[id]').forEach(el => {
      if (el.id === '__root') return;
      if (el.closest('.section-toolbar')) return;   // 툴바는 «UI 크롬»이다(js/history.js _CHROME_RE 와 같은 판단)
      m[el.id] = unit(el);
    });
    m.__videoPending = key;
    return m;
  }
  /* «자식 목록만» 달라진 컨테이너는 따로 안 센다 — 자식의 추가/삭제로 이미 한 번 세어졌다. */
  const core = s => String(s).replace(/<x id="[^"]*"><\/x>\s*/g, '');
  function diff(a, b) {
    const ids = new Set(Object.keys(a).concat(Object.keys(b)));
    const added = [], removed = [], changed = [];
    ids.forEach(id => {
      if (!(id in a)) added.push(id);
      else if (!(id in b)) removed.push(id);
      else if (a[id] !== b[id] && core(a[id]) !== core(b[id])) changed.push(id);
    });
    return { n: added.length + removed.length + changed.length, added, removed, changed };
  }
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const tip = () => { const t = window.getHistoryTip(); return { pos: t.pos, len: t.len, seq: t.seq, action: t.action }; };

  /* ★진짜 클릭 — 0×0 유령/가려진 단추를 «통과»로 읽지 않으려고 rect + elementFromPoint 로 먼저 잰다.
     (오늘 다른 검사가 화면 «밖»의 요소를 눌러 고치기 전·후가 똑같이 「안 움직임」으로 나왔다) */
  function realClick(el) {
    if (!el) return 'no-element';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero-size';
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const ok = hit && (hit === el || el.contains(hit) || hit.contains(el));
    if (!ok) return 'covered-by:' + (hit && hit.className);
    for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window }));
    return true;
  }
  function dblClick(el) {
    if (!el) return 'no-element';
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return 'zero-size';
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (const t of ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick'])
      el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window, detail: t === 'dblclick' ? 2 : 1 }));
    return true;
  }
  function setNum(id, v) {
    const el = document.getElementById(id);
    if (!el) return 'no-field:' + id;
    el.focus(); el.value = String(v);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    el.blur();
    return true;
  }
  /* 블럭 하나를 «클릭 경로와 같은 한 벌»로 고른다(패널 표 = js/panel-dispatch.js). */
  async function pick(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    el.classList.add('selected');
    if (window.openPanelForBlock) window.openPanelForBlock(el);
    await settle(200);
    return true;
  }

  /* ⛔복원은 캔버스 innerHTML 을 통째로 갈아치운다 — 잡아 둔 노드는 «떨어진 유령»이 된다
     (rect 0×0). 그래서 어디서든 id 로 «다시» 집는다. */
  const byId = id => document.getElementById(id);

  /* 판 세우기 — 도형(SVG) «있는 판»과 «없는 판» 둘 다 세운다(T-131·T-136 은 도형이 있을 때만 났다). */
  async function board(withShape) {
    document.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection(); await settle(300);
    const sec = document.querySelector('.section-block');
    window.selectSection(sec); await settle(200);
    if (withShape) { window.addShapeBlock('rect'); await settle(450); }
    if (window.deselectAll) window.deselectAll();
    await settle(250);
    window.clearHistory(); await settle(200);
    return sec.id;
  }

  /* ══ 사다리 ══════════════════════════════════════════════════════════════
     동작 K개를 «실경로»로 밟으며 마디(지문)를 적고, 그 뒤 ⌘Z 를 눌러 내려오면서
     마디를 «하나씩» 되밟는지 본다. 세 고장이 여기서 갈린다:
       · 마디를 건너뛰었다            → ㉡ 한 칸에 두 동작
       · 칸은 줄었는데 바뀐 게 0      → ㉢ 먹통 칸
       · 칸도 안 줄고 바뀐 것도 0     → ㉠ 되돌아갈 자리가 없다
     ⛔「검사가 있다」 ≠ 「그 자리를 잰다」 — 각 step.run 은 하네스가 상태를 «만들어 두는» 것이
       아니라 사용자가 누르는 그 입구(단추·숫자칸·업로드 함수)를 그대로 부른다. */
  async function ladder(name, steps) {
    const marks = [{ name: 'start', f: fp(), t: tip() }];
    const notes = [];
    for (const s of steps) {
      const ret = await s.run();
      await settle(s.wait || 350);
      marks.push({ name: s.name, f: fp(), t: tip() });
      const a = marks[marks.length - 2], b = marks[marks.length - 1];
      notes.push({ name: s.name, ret: ret === undefined ? null : ret, changed: diff(a.f, b.f).n, slot: b.t.pos - a.t.pos });
    }
    const undos = [];
    let prev = marks[marks.length - 1].f, prevT = tip();
    for (let i = 0; i < steps.length + 3; i++) {
      window.undo(); await settle(350);
      const now = fp(), t = tip(), d = diff(prev, now);
      let mark = null;
      for (let m = marks.length - 1; m >= 0; m--) if (same(marks[m].f, now)) { mark = m; break; }
      undos.push({
        i, changed: d.n, posBefore: prevT.pos, posAfter: t.pos, len: t.len, action: t.action, mark,
        ids: d.changed.slice(0, 3).concat(d.removed.slice(0, 3).map(x => '-' + x)).concat(d.added.slice(0, 3).map(x => '+' + x)),
      });
      prev = now; prevT = t;
      if (mark === 0) break;
      if (t.pos === 0 && d.n === 0) break;
    }
    const reached = new Set(undos.map(u => u.mark).filter(m => m !== null));
    return {
      name, notes, undos,
      /* ㉢ — 칸은 줄었는데 바뀐 게 0 */
      dead: undos.filter(u => u.posAfter < u.posBefore && u.changed === 0).length,
      /* ㉠ — ⌘Z 를 눌렀는데 칸도 안 줄고 바뀐 것도 0(되돌아갈 자리가 없다) */
      stuck: undos.filter(u => u.posAfter === u.posBefore && u.changed === 0).length,
      /* ㉡ — 마디를 «건너뛰었다»(그 마디로는 영영 못 돌아간다) */
      skipped: marks.map((m, i) => i).filter(i => i > 0 && i < marks.length && !reached.has(i) && i !== marks.length - 1),
      reachedStart: reached.has(0),
      steps: marks.length - 1, undoCount: undos.length,
      /* ★잡음에 안 흔들리는 한 줄 — 「동작 K개를 ⌘Z 몇 번에 다 풀었나」.
         K보다 «적으면» 한 칸이 둘을 먹은 것이고(㉡), «많으면» 빈 칸이 낀 것이다(㉢).
         ⛔지문 일치(skipped)만으로 재지 마라 — 복원 뒤 자동으로 덧씌워지는 껍데기(예: 스텝
           블럭을 감싸는 row_ 래퍼)가 새 id 를 받으면 마디가 «안 맞는 것처럼» 보인다.
           그 잡음은 이 수에는 안 낀다(실측 2026-09-22: L2 에서 +row_ 가 매번 새로 생겼다). */
      undosToStart: reached.has(0) ? undos.length : null,
    };
  }

  window.__UF = { settle, fp, diff, same, tip, unit, realClick, dblClick, setNum, pick, board, ladder, byId };
})();
