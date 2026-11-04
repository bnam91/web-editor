/* qa-clipboard.js — 격리 QA 앱(GODITOR_QA_HIDDEN=1)의 클립보드를 앱 안 메모리로 돌린다. 일반 앱은 이 파일을 안 부른다(main.js 첫 ▼QA_HIDDEN 블록).
 * 왜: 레인의 ⌘C·⌘D 가 그 맥의 진짜 클립보드를 덮었다(인텔·아이맥 2회).
 * 두 길을 다 막는다 — ⑴메인 clipboard.* (쓰기 다리) ⑵렌더러 copy/cut/paste 이벤트(글 칸 복사·execCommand·메뉴 역할은 메인을 안 거치고 OS 로 간다).
 * 붙여넣기 처리기는 e.clipboardData 를 읽으므로, 진짜 이벤트를 멈추고 메모리 값을 실은 사본 이벤트를 같은 자리에 쏜다.
 * shortcut: 값은 글자 하나·그림 하나만(HTML·RTF 없음) — 메인 호출이 writeText·writeImage 뿐이라서, 늘면 tests/unit/main-qa-clipboard 표가 빨개진다. */
const RENDERER_JS = `(() => {
  if (window.__qaClipDoor) return;
  window.__qaClipDoor = true;
  const editable = (el) => !!el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  const selected = () => {
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return a.value.substring(a.selectionStart, a.selectionEnd);
    return String(window.getSelection());
  };
  const imageFile = (url) => {
    const [head, body] = url.split(',');
    return new File([Uint8Array.from(atob(body), (c) => c.charCodeAt(0))], 'image.png', { type: head.slice(5).split(';')[0] });
  };
  window.addEventListener('paste', (e) => {
    if (!e.isTrusted) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const c = window.__qaClip || {}, dt = new DataTransfer();
    if (c.text) dt.setData('text/plain', c.text);
    if (c.image) dt.items.add(imageFile(c.image));
    const go = e.target.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }));
    if (go && c.text && editable(document.activeElement)) document.execCommand('insertText', false, c.text);
  }, true);
  for (const type of ['copy', 'cut']) window.addEventListener(type, (e) => {
    if (!e.isTrusted) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const dt = new DataTransfer();
    const go = e.target.dispatchEvent(new ClipboardEvent(type, { bubbles: true, cancelable: true, clipboardData: dt }));
    const text = go ? selected() : dt.getData('text/plain');
    if (text) window.electronAPI?.clipboardWriteText?.(text);
    if (go && text && type === 'cut' && editable(document.activeElement)) document.execCommand('delete');
  }, true);
})();`;

function install({ clipboard, nativeImage, webContents, app }) {
  const mem = { text: '', image: null };
  const pushJs = () => `window.__qaClip = ${JSON.stringify({ text: mem.text, image: mem.image ? mem.image.toDataURL() : null })};`;
  const push = () => webContents.getAllWebContents().forEach((wc) => wc.executeJavaScript(pushJs()).catch(() => {}));
  const stubs = {
    writeText: (t) => { mem.text = String(t); mem.image = null; push(); },
    readText: () => mem.text,
    writeImage: (img) => { mem.image = img; mem.text = ''; push(); },
    readImage: () => mem.image || nativeImage.createEmpty(),
  };
  for (const [k, fn] of Object.entries(stubs)) {
    clipboard[k] = fn;
    if (clipboard[k] !== fn) throw new Error(`qa-clipboard: clipboard.${k} 를 못 갈았다 — 진짜 클립보드가 덮인다`);
  }
  app.on('web-contents-created', (_e, wc) => {
    wc.on('dom-ready', () => wc.executeJavaScript(RENDERER_JS + pushJs()).catch(() => {}));
  });
  return mem;
}

module.exports = { install, RENDERER_JS };
