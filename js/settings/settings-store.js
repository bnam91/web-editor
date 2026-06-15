/* ══════════════════════════════════════
   Settings Store — 렌더러 측 캐시 + IPC 브리지
   - 로드 시 window._settings 캐시
   - window.getShortcut(action) → 'KeyG' / 'Meta+KeyG' 형태 spec 반환
   - window._matchShortcut(e, action) → keydown 이벤트 일치 여부
   - window.saveSettings(patch) → main에 저장 + 캐시 갱신 + 이벤트 디스패치
   ══════════════════════════════════════ */
(function () {
  const FALLBACK = {
    apiKeys: { openai: '', gemini: '', anthropic: '' },
    shortcuts: {
      addGap:      'KeyG',
      addText:     'KeyT',
      addAsset:    'KeyA',
      addSection:  'KeyS',
      pinToggle:   'Backquote',
      groupBlocks: 'Meta+KeyG',
      ungroup:     'Meta+Shift+KeyG',
      wrapInFrame: 'Meta+Alt+KeyG',
    },
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

  window.getShortcut = function (action) {
    return (window._settings && window._settings.shortcuts && window._settings.shortcuts[action]) || null;
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

  // 사람이 읽는 라벨 — UI 표시용
  window._shortcutLabel = function (spec) {
    if (!spec) return '(없음)';
    return spec
      .replace(/Meta/g, '⌘')
      .replace(/Shift/g, '⇧')
      .replace(/Alt/g, '⌥')
      .replace(/Ctrl/g, '⌃')
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
      .replace(/\+/g, '');
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
