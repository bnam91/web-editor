/* ══════════════════════════════════════
   Settings Store — 렌더러 측 캐시 + IPC 브리지
   - 로드 시 window._settings 캐시
   - window.getShortcut(action) → 'KeyG' / 'Meta+KeyG' 형태 spec 반환
   - window._matchShortcut(e, action) → keydown 이벤트 일치 여부
   - window.saveSettings(patch) → main에 저장 + 캐시 갱신 + 이벤트 디스패치
   ══════════════════════════════════════ */
(function () {
  /* ★[M61] 이 앱의 «주 수식어»(primary modifier). 맥 = Meta(⌘) · 그 밖 = Control.
     ⛔`navigator.platform` 은 폐기 예정이지만 Electron/Chromium 에선 여전히 정확하고,
       `userAgentData` 는 «비보안 문맥·구버전»에서 없다. 둘 다 보고, 없으면 Meta 로 떨어진다
       — 기존 동작이 맥 기준이므로 «모르면 옛 동작»이 안전한 기본값이다. */
  const _isMac = (() => {
    try {
      const uaP = navigator.userAgentData && navigator.userAgentData.platform;
      if (uaP) return /mac/i.test(uaP);
      return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || '');
    } catch (_) { return true; }
  })();
  const PRIMARY = _isMac ? 'Meta' : 'Ctrl';

  const FALLBACK = {
    apiKeys: { openai: '', gemini: '', anthropic: '' },
    shortcuts: {
      addGap:      'KeyG',
      addText:     'KeyT',
      addAsset:    'KeyA',
      addSection:  'KeyS',
      pinToggle:   'Backquote',
      /* ★[M61] 「주 수식어」는 플랫폼을 따른다 — 맥 ⌘ / 윈도우·리눅스 Ctrl.
         현빈 2026-09-06: 「일반적으로 어도비 일러스트 이런쪽에서는 문제없이 해당 단축키 썼을텐데」
         ⇒ 맞다. 윈도우 표준은 Ctrl+Shift+G(일러스트·피그마 전부)이고
           «우리가 정할 값이 아니라 맞춰야 할 값»이다.
         ⛔여기가 'Meta+' 로 «하드코딩»돼 있어 윈도우에서 그룹 해제가 «절대» 안 잡혔다
           (_matchShortcut 이 `!!e.metaKey === parsed.meta` 로 «정확히» 일치시킨다).
         ⚠️그룹·프레임감싸기는 save-load.js 의 capture 핸들러가 `e.metaKey || e.ctrlKey` 로
           «따로» 받아줘서 윈도우에서도 됐다 — 그래서 «해제만» 고장 난 것처럼 보였다.
           ⇒ 증상은 하나였지만 원인은 이 세 줄 «전부»다. */
      groupBlocks: PRIMARY + '+KeyG',
      ungroup:     PRIMARY + '+Shift+KeyG',
      wrapInFrame: PRIMARY + '+Alt+KeyG',
    },
    autoExternalizeOnOpen: false, // [externalize] 열 때 레거시 base64 일괄 외부화(기본 OFF)
    easterEggs: {
      fkeyHotkeys:      true,
      jokerBlock:       true,
      highlightBMode:   true,
      penMode:          true,
      hideGapLayers:    true,
      freeLayoutAnalyze: true,
    },
  };

  // 초기 로드 — settings:ready 이벤트로 알림
  (async function init() {
    try {
      const s = (window.electronAPI && window.electronAPI.getSettings)
        ? await window.electronAPI.getSettings()
        : null;
      window._settings = s || JSON.parse(JSON.stringify(FALLBACK));
    } catch (e) {
      console.warn('[settings-store] 초기 로드 실패, fallback 사용:', e.message);
      window._settings = JSON.parse(JSON.stringify(FALLBACK));
    }
    window.dispatchEvent(new CustomEvent('settings:ready', { detail: window._settings }));
  })();

  /* ★[M61] 「주 수식어」를 «읽는 자리»에서 플랫폼에 맞게 교정한다.
     ⛔여기서 하는 이유 — 기본값이 «두 벌»이다:
        렌더러 FALLBACK(이 파일)  ·  ★main.js:99 DEFAULT_SETTINGS(진짜 정본)
       그리고 사용자 저장본(auth/settings)에도 «옛 Meta 값이 이미 박혀» 있다.
       ⇒ 기본값만 고치면 «저장본이 있는 기존 사용자»는 그대로 안 고쳐진다.
         읽는 자리에서 교정하면 저장본·메인·구버전이 «전부» 산다.
     ★사용자가 «직접 지정»한 것은 안 건드린다 — 교정은 「주 수식어 하나만 있는」 조합에 한한다.
       (Meta 와 Ctrl 을 «같이» 쓰는 조합은 사용자 의도이므로 그대로 둔다.)
     ⚠️맥에선 아무것도 안 바꾼다 — PRIMARY 가 'Meta' 라 치환이 항등이다. */
  function _toPlatform(spec) {
    if (!spec || _isMac) return spec;
    if (/Meta/.test(spec) && /Ctrl/.test(spec)) return spec;   // 둘 다 = 사용자 의도
    return spec.replace(/Meta/g, 'Ctrl');
  }
  window.getShortcut = function (action) {
    const raw = (window._settings && window._settings.shortcuts && window._settings.shortcuts[action]) || null;
    return _toPlatform(raw);
  };

  // 이스터에그(숨은 기능) on/off 확인 — 기본값 true(기존 동작 보존), 명시적 false일 때만 비활성
  window.isEasterEggEnabled = function (key) {
    const e = window._settings && window._settings.easterEggs;
    return e ? e[key] !== false : true;
  };

  window.saveSettings = async function (patch) {
    if (!window.electronAPI || !window.electronAPI.setSettings) {
      throw new Error('electronAPI.setSettings 없음 (Electron 환경 아님)');
    }
    const next = await window.electronAPI.setSettings(patch);
    window._settings = next;
    window.dispatchEvent(new CustomEvent('settings:changed', { detail: next }));
    return next;
  };

  // 단축키 spec 파싱: 'Meta+Shift+KeyG' → { code, meta, shift, alt, ctrl }
  function parseSpec(spec) {
    if (!spec || typeof spec !== 'string') return null;
    const parts = spec.split('+').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return null;
    const code = parts[parts.length - 1];
    const mods = { meta: false, shift: false, alt: false, ctrl: false };
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (p === 'Meta')  mods.meta  = true;
      else if (p === 'Shift') mods.shift = true;
      else if (p === 'Alt')   mods.alt   = true;
      else if (p === 'Ctrl')  mods.ctrl  = true;
    }
    return { code, ...mods };
  }
  window._parseShortcutSpec = parseSpec;

  // KeyboardEvent → spec 문자열 (단축키 캡처용)
  window._eventToShortcutSpec = function (e) {
    if (!e || !e.code) return null;
    // Modifier 단독 키는 무시
    const modOnly = ['MetaLeft','MetaRight','ShiftLeft','ShiftRight','AltLeft','AltRight','ControlLeft','ControlRight'];
    if (modOnly.includes(e.code)) return null;
    const parts = [];
    if (e.metaKey)  parts.push('Meta');
    if (e.ctrlKey)  parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey)   parts.push('Alt');
    parts.push(e.code);
    return parts.join('+');
  };

  window._matchShortcut = function (e, action) {
    const spec = window.getShortcut(action);
    if (!spec) return false;
    const parsed = parseSpec(spec);
    if (!parsed) return false;
    return e.code === parsed.code
      && !!e.metaKey  === parsed.meta
      && !!e.shiftKey === parsed.shift
      && !!e.altKey   === parsed.alt
      && !!e.ctrlKey  === parsed.ctrl;
  };

  /* 사람이 읽는 라벨 — UI 표시용
     ★[M61] 윈도우에서 «맥 기호»를 보여주면 «거짓 표시»다. 현빈 제보의 절반이 이것이었다:
       「설정 화면엔 ⌘⇧G 로 표시된다 — 윈도우 사용자에겐 거짓 표시」.
       ⇒ 맥이면 기호(⌘⇧⌥⌃), 그 밖이면 «윈도우 표기»(Ctrl+Shift+Alt)로 쓴다.
     ⚠️`Ctrl` 을 맥에서 «⌃»로 쓰는 건 맞다 — 맥의 Control 키다. 윈도우에선 그 기호가 안 통한다. */
  const _sym = _isMac
    ? [[/Meta/g, '⌘'], [/Shift/g, '⇧'], [/Alt/g, '⌥'], [/Ctrl/g, '⌃']]
    : [[/Meta/g, 'Win'], [/Shift/g, 'Shift'], [/Alt/g, 'Alt'], [/Ctrl/g, 'Ctrl']];
  window._shortcutLabel = function (spec) {
    if (!spec) return '(없음)';
    /* ⛔수식어만 갈아끼우고 «나머지 치환은 공통»으로 흐르게 한다.
       처음엔 윈도우 분기에서 바로 return 했다가 Digit·Backquote·BracketLeft… 치환을
       «통째로 건너뛰는» 것을 발견했다(라벨이 'Ctrl+Digit1' 처럼 나온다). */
    let spec2 = spec;
    for (const [re, to] of _sym) spec2 = spec2.replace(re, to);
    return spec2
      .replace(/Key([A-Z])/g, '$1')
      .replace(/Digit(\d)/g, '$1')
      .replace(/Backquote/g, '`')
      .replace(/BracketLeft/g, '[')
      .replace(/BracketRight/g, ']')
      .replace(/Comma/g, ',')
      .replace(/Period/g, '.')
      .replace(/Slash/g, '/')
      .replace(/Semicolon/g, ';')
      .replace(/Quote/g, "'")
      .replace(/Minus/g, '-')
      .replace(/Equal/g, '=')
      .replace(/Enter/g, '↵')
      .replace(/Space/g, '␣')
      .replace(/Tab/g, '⇥')
      .replace(/Escape/g, 'Esc')
      /* ★[M61] 맥은 기호를 «붙여» 쓴다(⌘⇧G). 윈도우는 «+ 로 잇는» 게 표기 관례다(Ctrl+Shift+G).
         ⛔이 줄이 무조건 + 를 지워서 윈도우 라벨이 「CtrlShiftG」로 나왔다 — 실측으로 잡았다. */
      .replace(/\+/g, _isMac ? '' : '+');
  };

  // 시스템 단축키 (변경 금지)
  window._SYSTEM_SHORTCUTS_BLOCKED = new Set([
    'Meta+KeyS', 'Meta+Shift+KeyS',
    'Meta+KeyZ', 'Meta+Shift+KeyZ',
    'Meta+KeyC', 'Meta+KeyV', 'Meta+KeyX',
    'Meta+KeyD', 'Meta+KeyA',
    'Meta+Comma', // Cmd+, 는 환경설정 열기 전용
  ]);
})();
