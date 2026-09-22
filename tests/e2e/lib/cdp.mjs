/* cdp.mjs — 검사용 CDP 세션 한 벌.
 *
 * ★한 세션 안에서 끝낸다. 붙을 때마다 새 세션이면 «깨운 상태»(focus emulation / lifecycle)가
 *   사라져 창이 뒤에 있을 때 화면 갱신이 멈추고, 값이 «안 바뀐 것처럼» 보인다.
 * ⛔Page.bringToFront 를 부르지 않는다(포커스 강탈 금지). 대신
 *   Emulation.setFocusEmulationEnabled + Page.setWebLifecycleState 로 «깨우기»만 한다.
 *
 * 입력은 전부 Input.dispatch* — 진짜 입력 경로다. el.click()·dispatchEvent 같은 합성은
 * 쓰지 않는다(트러스트 가드·캡처 리스너를 건너뛰어 «거짓 통과»가 난다).
 */
import WebSocket from 'ws';

export async function findTarget(port, urlPart) {
  const r = await fetch(`http://127.0.0.1:${port}/json`);
  const pages = (await r.json()).filter(p => p.type === 'page');
  if (!urlPart) return pages[0];
  return pages.find(p => (p.url || '').includes(urlPart)) || null;
}

export async function connect(port, urlPart) {
  const t = await findTarget(port, urlPart);
  if (!t) throw new Error(`target not found (port=${port}, url~${urlPart})`);
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.on('message', (raw) => {
    const d = JSON.parse(raw.toString());
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result);
    } else if (d.method) {
      events.push({ method: d.method, params: d.params, at: Date.now() });
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('cdp timeout: ' + method)); } }, 30000);
  });

  const sess = {
    url: t.url,
    events,
    send,
    close: () => ws.close(),

    /** 창이 뒤에 있어도 렌더러가 돌게 «깨운다». 한 세션 안에서만 유효하다. */
    async wake() {
      await send('Page.enable').catch(() => {});
      await send('Runtime.enable').catch(() => {});
      await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
      await send('Page.setWebLifecycleState', { state: 'active' }).catch(() => {});
    },

    async eval(fnBody, { awaitPromise = true } = {}) {
      const r = await send('Runtime.evaluate', {
        expression: `(async () => { ${fnBody} })()`,
        returnByValue: true, awaitPromise,
      });
      if (r.exceptionDetails) {
        throw new Error('eval threw: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      }
      return r.result?.value;
    },

    sleep: (ms) => new Promise(r => setTimeout(r, ms)),

    /** 좌표를 찍기 «전» 그 자리에 무엇이 있는지 확인한다(0×0 유령·빗나간 좌표 방지). */
    hit(x, y) {
      return this.eval(`
        const el = document.elementFromPoint(${x}, ${y});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: el.className && String(el.className).slice(0,90), id: el.id,
                 rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
      `);
    },

    async mouse(type, x, y, { button = 'left', clickCount = 1, modifiers = 0 } = {}) {
      await send('Input.dispatchMouseEvent', { type, x, y, button, clickCount, modifiers, buttons: type === 'mouseReleased' ? 0 : 1 });
    },

    async click(x, y, { modifiers = 0, clickCount = 1 } = {}) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0, modifiers });
      await this.mouse('mousePressed', x, y, { clickCount, modifiers });
      await this.mouse('mouseReleased', x, y, { clickCount, modifiers });
    },

    /** 진짜 더블클릭 — 첫 클릭과 둘째 클릭 사이 간격을 사람 수준(기본 90ms)으로 둔다. */
    async dblclick(x, y, { gapMs = 90 } = {}) {
      await this.click(x, y, { clickCount: 1 });
      await this.sleep(gapMs);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2, buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2, buttons: 0 });
    },

    async key(key, { code, vk, modifiers = 0, text = null } = {}) {
      const base = { key, code: code || key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers };
      await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', ...base, ...(text ? { text, unmodifiedText: text } : {}) });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },

    /** 글자 하나씩 «타이핑»한다 — Input.insertText 는 커밋가드의 타이핑 유예를 안 태워
     *  사람 경로와 다른 결과를 만든다(2026-09-22 QA6 기록). */
    async type(str, { perCharMs = 25 } = {}) {
      /* ★code 는 «영숫자일 때만» 만든다. 구두점에 'Key.' 같은 없는 code 를 실어 보내면
         크로미움이 그 글자를 조용히 «떨어뜨린다» — 실측(2026-09-22, 9531):
         "내용을 입력하세요." 를 쳤는데 마침표가 빠진 "내용을 입력하세요" 가 들어갔고,
         그 한 글자 때문에 「기본 문구와 같은가」 판정이 뒤집혔다. */
      for (const ch of str) {
        const alnum = /^[a-zA-Z0-9]$/.test(ch);
        const code = alnum ? (/[0-9]/.test(ch) ? 'Digit' + ch : 'Key' + ch.toUpperCase()) : undefined;
        const vk = alnum ? ch.toUpperCase().charCodeAt(0) : undefined;
        await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, ...(code ? { code } : {}), text: ch, unmodifiedText: ch, ...(vk ? { windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk } : {}) });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch, ...(code ? { code } : {}), ...(vk ? { windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk } : {}) });
        await this.sleep(perCharMs);
      }
    },

    enter: function () { return this.key('Enter', { code: 'Enter', vk: 13 }); },
    backspace: function () { return this.key('Backspace', { code: 'Backspace', vk: 8 }); },
    /** ⌘+<글자> — modifiers 4 = Meta */
    cmd: function (letter, { shift = false } = {}) {
      return this.key(letter, { code: 'Key' + letter.toUpperCase(), vk: letter.toUpperCase().charCodeAt(0), modifiers: 4 | (shift ? 8 : 0) });
    },
    del: function () { return this.key('Delete', { code: 'Delete', vk: 46 }); },

    /** 칸 «안»의 글자 전체선택. ★맥에서는 ⌘A 만 보내면 편집 명령이 «안» 돈다 —
     *  크로미움이 macOS 단축키를 편집기 명령으로 바꾸는 일은 브라우저 프로세스가 하고,
     *  CDP 로 넣을 땐 `commands` 로 직접 실어 줘야 한다(실측 2026-09-22, 9531:
     *  commands 없이 ⌘A → 선택 0, 이어 친 글자가 «캐럿 자리»에 끼어들어 "1000"+"300"="3000"). */
    selectAllInField: async function () {
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 4, commands: ['selectAll'] });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65, modifiers: 4 });
    },
  };

  await sess.wake();
  return sess;
}

/* ───────────────────────────────────────────────────────────────────────────
   «보이는 안내»를 세는 자 — 요소가 있다/없다로 세지 않는다.
   0×0 유령(과거 토스트 노드가 그대로 남은 자리), opacity 0, 빈 글자를 전부 떨군다.
   ★#editor-toast 는 재사용 노드다 — 한 번 뜨면 DOM 에 영원히 남고 .show 만 토글된다.
     「요소가 있다」로 세면 항상 통과한다.
   ─────────────────────────────────────────────────────────────────────────── */
export const VISIBLE_NOTICE_FN = `
function __visibleNotices(opts) {
  const skipSel = (opts && opts.skip) || '#canvas-wrap, #panel-left, #panel-right, .layer-panel';
  const out = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest(skipSel)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (parseFloat(cs.opacity) < 0.05) continue;
    const txt = (el.innerText || '').trim();
    if (!txt) continue;
    if (el.querySelector('*') && [...el.children].some(c => (c.innerText || '').trim() === txt)) continue; // 같은 글자를 감싼 부모는 한 번만
    out.push({ sel: (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\\s+/).join('.') : '')),
               text: txt.slice(0, 120), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
               opacity: cs.opacity });
  }
  return out;
}`;
