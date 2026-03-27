#!/usr/bin/env python3
"""
Agent-01: 텍스트/Gap/Divider 심층 디버깅
10개 시나리오를 CDP WebSocket으로 실행하고 결과를 JSON으로 저장
"""

import json
import time
import websocket
import datetime
import traceback

WS_URL = "ws://localhost:9334/devtools/page/54988EB5B9CDA8A788E447308AD6B0CA"
RESULT_PATH = "/Users/a1/web-editor/debug/results/01-text-blocks.json"

_cmd_id = 0

def ws_eval(ws, expr, timeout=8):
    global _cmd_id
    _cmd_id += 1
    msg = json.dumps({
        "id": _cmd_id,
        "method": "Runtime.evaluate",
        "params": {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": True
        }
    })
    ws.send(msg)
    deadline = time.time() + timeout
    while time.time() < deadline:
        raw = ws.recv()
        data = json.loads(raw)
        if data.get("id") == _cmd_id:
            result = data.get("result", {})
            exc = result.get("exceptionDetails")
            if exc:
                return {"error": exc.get("text", "exception"), "details": exc}
            val = result.get("result", {})
            return val.get("value", val)
    return {"error": "timeout"}

def run_scenario(ws, sid, title, fn):
    print(f"\n{'='*60}")
    print(f"[{sid}] {title}")
    print('='*60)
    try:
        result = fn(ws)
        status = result.get("status", "pass") if isinstance(result, dict) else "pass"
        bugs = result.get("bugs", []) if isinstance(result, dict) else []
        notes = result.get("notes", "") if isinstance(result, dict) else str(result)
        print(f"  → {status.upper()}: {notes}")
        if bugs:
            for b in bugs:
                print(f"  BUG: {b}")
        return {
            "id": sid, "title": title,
            "status": status, "notes": notes, "bugs": bugs
        }
    except Exception as e:
        tb = traceback.format_exc()
        print(f"  → ERROR: {e}")
        return {
            "id": sid, "title": title,
            "status": "error", "notes": str(e), "bugs": [], "traceback": tb
        }

# ─────────────────────────────────────────────────────────────────────────────
# 헬퍼: 에디터 초기화 (섹션 생성)
# ─────────────────────────────────────────────────────────────────────────────
def setup_section(ws):
    """페이지 리로드 없이 섹션을 추가하고 기존 블록 정리"""
    # 기존 섹션 수 확인
    count = ws_eval(ws, "document.querySelectorAll('.section-block').length")
    if isinstance(count, int) and count > 0:
        # 섹션이 이미 있으면 첫 번째 섹션 사용
        pass
    else:
        ws_eval(ws, "window.addSection && window.addSection()")
        time.sleep(0.5)
    return ws_eval(ws, "document.querySelectorAll('.section-block').length")

# ─────────────────────────────────────────────────────────────────────────────
# 01-01: 텍스트 6종 모두 생성
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_01(ws):
    setup_section(ws)

    # 기존 텍스트 블록 제거 후 새로 생성
    ws_eval(ws, """
    (function() {
        document.querySelectorAll('.text-block').forEach(b => b.remove());
    })()
    """)
    time.sleep(0.3)

    types = ['h1', 'h2', 'h3', 'body', 'caption', 'label']
    bugs = []
    created = []

    for t in types:
        r = ws_eval(ws, f"typeof window.addTextBlock")
        if r == 'undefined':
            bugs.append("window.addTextBlock 함수가 존재하지 않음")
            break

        before = ws_eval(ws, "document.querySelectorAll('.text-block').length")
        ws_eval(ws, f"window.addTextBlock('{t}')")
        time.sleep(0.3)
        after = ws_eval(ws, "document.querySelectorAll('.text-block').length")

        if isinstance(after, int) and isinstance(before, int) and after > before:
            created.append(t)
        else:
            bugs.append(f"addTextBlock('{t}') 후 블록 수 변화 없음 (before={before}, after={after})")

    # 생성된 블록의 타입 클래스 검증
    type_check = ws_eval(ws, """
    (function() {
        const blocks = document.querySelectorAll('.text-block');
        const results = [];
        blocks.forEach(b => {
            const ce = b.querySelector('[contenteditable]');
            if (ce) {
                const cls = ['tb-h1','tb-h2','tb-h3','tb-body','tb-caption','tb-label'].find(c => ce.classList.contains(c));
                results.push(cls || 'UNKNOWN');
            }
        });
        return results;
    })()
    """)

    # addTextBlock 함수 존재 여부
    fn_exists = ws_eval(ws, "typeof window.addTextBlock === 'function'")
    if not fn_exists:
        bugs.append("window.addTextBlock 함수 없음")

    all_ok = len(created) == 6 and not bugs
    return {
        "status": "pass" if all_ok else "fail",
        "notes": f"생성 성공: {created}, 타입클래스: {type_check}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-02: 텍스트 입력 후 스타일 변경
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_02(ws):
    bugs = []

    # H1 블록 선택
    r = ws_eval(ws, """
    (function() {
        const blocks = document.querySelectorAll('.text-block');
        const h1 = Array.from(blocks).find(b => {
            const ce = b.querySelector('[contenteditable]');
            return ce && ce.classList.contains('tb-h1');
        });
        if (!h1) return {ok: false, err: 'H1 블록 없음'};
        h1.click();
        return {ok: true};
    })()
    """)

    if isinstance(r, dict) and not r.get('ok'):
        bugs.append(r.get('err', 'H1 블록 선택 실패'))
        return {"status": "fail", "notes": "H1 블록 없음", "bugs": bugs}

    time.sleep(0.5)

    # 패널에 폰트 크기 input이 있는지 확인
    panel_ok = ws_eval(ws, "!!document.getElementById('txt-size-number')")
    if not panel_ok:
        bugs.append("txt-size-number input이 패널에 없음 (패널 미렌더링 가능성)")
        return {"status": "fail", "notes": "프로퍼티 패널 미렌더링", "bugs": bugs}

    # 폰트 크기 변경 전 값 확인
    before_size = ws_eval(ws, """
    (function() {
        const blocks = document.querySelectorAll('.text-block');
        const h1 = Array.from(blocks).find(b => b.querySelector('.tb-h1'));
        if (!h1) return null;
        const ce = h1.querySelector('[contenteditable]');
        return window.getComputedStyle(ce).fontSize;
    })()
    """)

    # input 값을 60으로 변경
    ws_eval(ws, """
    (function() {
        const inp = document.getElementById('txt-size-number');
        if (!inp) return;
        inp.value = 60;
        inp.dispatchEvent(new Event('input', {bubbles: true}));
    })()
    """)
    time.sleep(0.3)

    after_size = ws_eval(ws, """
    (function() {
        const blocks = document.querySelectorAll('.text-block');
        const h1 = Array.from(blocks).find(b => b.querySelector('.tb-h1'));
        if (!h1) return null;
        const ce = h1.querySelector('[contenteditable]');
        return ce.style.fontSize;
    })()
    """)

    if after_size != '60px':
        bugs.append(f"폰트 크기 변경 DOM 미반영 (before={before_size}, after={after_size})")

    # 빈 텍스트 상태에서 스타일 변경 오류 체크
    err_check = ws_eval(ws, """
    (function() {
        try {
            const blocks = document.querySelectorAll('.text-block');
            const h1 = Array.from(blocks).find(b => b.querySelector('.tb-h1'));
            if (!h1) return {ok: false};
            const ce = h1.querySelector('[contenteditable]');
            const wasContent = ce.innerHTML;
            ce.innerHTML = '';  // 빈 상태
            const inp = document.getElementById('txt-size-number');
            if (inp) { inp.value = 40; inp.dispatchEvent(new Event('input', {bubbles: true})); }
            ce.innerHTML = wasContent;  // 복원
            return {ok: true};
        } catch(e) {
            return {ok: false, err: e.message};
        }
    })()
    """)

    if isinstance(err_check, dict) and not err_check.get('ok'):
        bugs.append(f"빈 텍스트 상태 스타일 변경 오류: {err_check.get('err')}")

    return {
        "status": "pass" if not bugs else "fail",
        "notes": f"폰트크기변경: before={before_size} → after={after_size}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-03: 텍스트 정렬 (left/center/right)
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_03(ws):
    bugs = []

    # H1 블록 선택
    ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (h1) h1.click();
    })()
    """)
    time.sleep(0.4)

    aligns = ['center', 'right', 'left']
    for align in aligns:
        # 정렬 버튼 클릭
        ws_eval(ws, f"""
        (function() {{
            const btn = document.querySelector('.prop-align-btn[data-align="{align}"]');
            if (btn) btn.click();
        }})()
        """)
        time.sleep(0.2)

        # DOM 반영 확인
        dom_align = ws_eval(ws, """
        (function() {
            const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
            if (!h1) return null;
            const ce = h1.querySelector('[contenteditable]');
            return ce ? ce.style.textAlign : null;
        })()
        """)

        if dom_align != align:
            bugs.append(f"정렬 {align} 클릭 후 DOM: {dom_align}")

        # active 버튼 확인
        active_align = ws_eval(ws, """
        (function() {
            const active = document.querySelector('.prop-align-btn.active');
            return active ? active.dataset.align : null;
        })()
        """)

        if active_align != align:
            bugs.append(f"정렬 {align} 후 active버튼: {active_align}")

    return {
        "status": "pass" if not bugs else "fail",
        "notes": f"정렬 left/center/right 테스트 완료",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-04: 텍스트 색상 변경
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_04(ws):
    bugs = []

    # H1 블록 선택
    ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (h1) h1.click();
    })()
    """)
    time.sleep(0.4)

    # color-hex input에 빨간색 입력
    target_color = '#ff0000'
    ws_eval(ws, f"""
    (function() {{
        const hexInput = document.getElementById('txt-color-hex');
        if (!hexInput) return;
        hexInput.value = '{target_color}';
        hexInput.dispatchEvent(new Event('input', {{bubbles: true}}));
    }})()
    """)
    time.sleep(0.3)

    # DOM 반영 확인
    dom_color = ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return null;
        const ce = h1.querySelector('[contenteditable]');
        if (!ce) return null;
        const computed = window.getComputedStyle(ce).color;
        // rgb(255, 0, 0) -> #ff0000
        const m = computed.match(/\d+/g);
        if (!m) return computed;
        return '#' + m.slice(0,3).map(x => parseInt(x).toString(16).padStart(2,'0')).join('');
    })()
    """)

    if dom_color != target_color:
        bugs.append(f"색상변경 DOM 미반영: 기대={target_color}, 실제={dom_color}")

    # color picker 값도 동기화됐는지
    picker_val = ws_eval(ws, "document.getElementById('txt-color') ? document.getElementById('txt-color').value : null")
    if picker_val and picker_val.lower() != target_color:
        bugs.append(f"color picker 값 미동기화: picker={picker_val}")

    return {
        "status": "pass" if not bugs else "fail",
        "notes": f"색상변경: 목표={target_color}, DOM={dom_color}, picker={picker_val}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-05: 극단값 입력
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_05(ws):
    bugs = []

    # 빈 텍스트 저장 테스트
    r = ws_eval(ws, """
    (function() {
        try {
            const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
            if (!h1) return {ok: false, err: 'no h1'};
            const ce = h1.querySelector('[contenteditable]');
            const saved = ce.innerHTML;
            ce.innerHTML = '';
            // savePageData 함수가 있으면 호출
            let saveErr = null;
            if (window.savePageData) {
                try { window.savePageData(); } catch(e) { saveErr = e.message; }
            }
            ce.innerHTML = saved;
            return {ok: !saveErr, err: saveErr};
        } catch(e) {
            return {ok: false, err: e.message};
        }
    })()
    """)

    if isinstance(r, dict) and not r.get('ok'):
        bugs.append(f"빈 텍스트 저장 오류: {r.get('err')}")

    # 1000자 이상 텍스트 레이아웃 깨짐 테스트
    long_text = 'A' * 1000
    r2 = ws_eval(ws, f"""
    (function() {{
        try {{
            const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
            if (!h1) return {{ok: false, err: 'no h1'}};
            const ce = h1.querySelector('[contenteditable]');
            const saved = ce.innerHTML;
            ce.innerHTML = '{long_text}';
            // overflow 확인
            const overflows = ce.scrollWidth > ce.clientWidth;
            const hasXScroll = window.getComputedStyle(ce).overflowX;
            ce.innerHTML = saved;
            return {{ok: true, scrollWidthOverflow: overflows, overflowX: hasXScroll}};
        }} catch(e) {{
            return {{ok: false, err: e.message}};
        }}
    }})()
    """)

    if isinstance(r2, dict):
        if not r2.get('ok'):
            bugs.append(f"1000자 텍스트 입력 오류: {r2.get('err')}")
        # scrollWidth가 clientWidth보다 크면 x축 오버플로우 가능성
        if r2.get('scrollWidthOverflow'):
            bugs.append(f"1000자 입력 시 가로 오버플로우 발생 (overflowX={r2.get('overflowX')})")

    return {
        "status": "pass" if not bugs else "warn",
        "notes": f"빈텍스트={r}, 1000자={r2}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-06: 텍스트 더블클릭 편집 모드
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_06(ws):
    bugs = []

    # H1 블록 더블클릭
    r = ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return {ok: false, err: 'no h1'};
        const ce = h1.querySelector('[contenteditable]');
        // dblclick 이벤트 발생
        h1.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}));
        // contentEditable 상태 확인
        const editableAfter = ce.contentEditable;
        return {ok: true, editable: editableAfter};
    })()
    """)
    time.sleep(0.3)

    if isinstance(r, dict):
        if not r.get('ok'):
            bugs.append(r.get('err', '더블클릭 실패'))
        elif r.get('editable') not in ('true', 'plaintext-only', True):
            bugs.append(f"더블클릭 후 contentEditable 상태: {r.get('editable')} (true 예상)")

    # 편집 모드에서 바깥 클릭 → 편집 종료 확인
    r2 = ws_eval(ws, """
    (function() {
        const canvas = document.getElementById('canvas') || document.querySelector('.canvas');
        if (canvas) canvas.click();
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return {ok: false};
        const ce = h1.querySelector('[contenteditable]');
        return {ok: true, editable: ce.contentEditable};
    })()
    """)
    time.sleep(0.3)

    if isinstance(r2, dict) and r2.get('ok'):
        # 편집 모드가 종료되었는지 (false로 바뀌었거나 inherit)
        ed_val = r2.get('editable')
        if ed_val in ('true', True):
            bugs.append(f"바깥 클릭 후에도 contentEditable={ed_val} (편집 모드 미종료 가능성)")

    # Escape 키 테스트 - 다시 더블클릭 후 Escape
    ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (h1) h1.dispatchEvent(new MouseEvent('dblclick', {bubbles: true}));
    })()
    """)
    time.sleep(0.2)
    ws_eval(ws, """
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}))
    """)
    time.sleep(0.2)

    r3 = ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return null;
        return h1.querySelector('[contenteditable]').contentEditable;
    })()
    """)

    return {
        "status": "pass" if not bugs else "warn",
        "notes": f"더블클릭editable={r}, 바깥클릭={r2}, ESC후={r3}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-07: Gap 블록 크기 조절
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_07(ws):
    bugs = []

    # Gap 블록 추가
    fn_exists = ws_eval(ws, "typeof window.addGapBlock === 'function'")
    if not fn_exists:
        bugs.append("window.addGapBlock 함수 없음")
        return {"status": "fail", "notes": "addGapBlock 없음", "bugs": bugs}

    before = ws_eval(ws, "document.querySelectorAll('.gap-block').length")
    ws_eval(ws, "window.addGapBlock()")
    time.sleep(0.4)
    after = ws_eval(ws, "document.querySelectorAll('.gap-block').length")

    if isinstance(after, int) and isinstance(before, int) and after <= before:
        bugs.append(f"addGapBlock() 후 블록 수 변화 없음 (before={before}, after={after})")
        return {"status": "fail", "notes": "Gap 블록 생성 실패", "bugs": bugs}

    # Gap 블록 클릭 → 패널 확인
    ws_eval(ws, """
    (function() {
        const gap = document.querySelector('.gap-block');
        if (gap) gap.click();
    })()
    """)
    time.sleep(0.4)

    panel_ok = ws_eval(ws, "!!document.getElementById('gap-slider')")
    if not panel_ok:
        bugs.append("gap-slider가 패널에 없음")
        return {"status": "fail", "notes": "Gap 패널 미렌더링", "bugs": bugs}

    # height 변경
    ws_eval(ws, """
    (function() {
        const slider = document.getElementById('gap-slider');
        const num = document.getElementById('gap-number');
        if (slider) { slider.value = 80; slider.dispatchEvent(new Event('input', {bubbles: true})); }
    })()
    """)
    time.sleep(0.3)

    gap_height = ws_eval(ws, """
    (function() {
        const gap = document.querySelector('.gap-block');
        return gap ? gap.style.height : null;
    })()
    """)

    if gap_height != '80px':
        bugs.append(f"Gap height 변경 미반영: {gap_height}")

    return {
        "status": "pass" if not bugs else "fail",
        "notes": f"Gap 생성 (before={before}→after={after}), height={gap_height}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-08: Divider 블록 스타일
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_08(ws):
    bugs = []

    fn_exists = ws_eval(ws, "typeof window.addDividerBlock === 'function'")
    if not fn_exists:
        bugs.append("window.addDividerBlock 함수 없음")
        return {"status": "fail", "notes": "addDividerBlock 없음", "bugs": bugs}

    before = ws_eval(ws, "document.querySelectorAll('.divider-block').length")
    ws_eval(ws, "window.addDividerBlock()")
    time.sleep(0.4)
    after = ws_eval(ws, "document.querySelectorAll('.divider-block').length")

    if isinstance(after, int) and isinstance(before, int) and after <= before:
        bugs.append(f"addDividerBlock() 실패 (before={before}, after={after})")
        return {"status": "fail", "notes": "Divider 생성 실패", "bugs": bugs}

    # Divider 클릭
    ws_eval(ws, """
    (function() {
        const dvd = document.querySelector('.divider-block');
        if (dvd) dvd.click();
    })()
    """)
    time.sleep(0.4)

    panel_ok = ws_eval(ws, "!!document.getElementById('dvd-color')")
    if not panel_ok:
        bugs.append("dvd-color 패널 미렌더링")
        return {"status": "fail", "notes": "Divider 패널 없음", "bugs": bugs}

    # 색상 변경
    ws_eval(ws, """
    (function() {
        const hex = document.getElementById('dvd-hex');
        if (hex) { hex.value = '#ff0000'; hex.dispatchEvent(new Event('input', {bubbles: true})); }
    })()
    """)
    time.sleep(0.2)

    dvd_color = ws_eval(ws, """
    (function() {
        const dvd = document.querySelector('.divider-block');
        return dvd ? dvd.dataset.lineColor : null;
    })()
    """)

    # 두께 변경
    ws_eval(ws, """
    (function() {
        const slider = document.getElementById('dvd-weight-slider');
        if (slider) { slider.value = 4; slider.dispatchEvent(new Event('input', {bubbles: true})); }
    })()
    """)
    time.sleep(0.2)

    dvd_weight = ws_eval(ws, """
    (function() {
        const dvd = document.querySelector('.divider-block');
        return dvd ? dvd.dataset.lineWeight : null;
    })()
    """)

    # 스타일 변경 (dashed)
    ws_eval(ws, """
    (function() {
        const sel = document.getElementById('dvd-style');
        if (sel) { sel.value = 'dashed'; sel.dispatchEvent(new Event('change', {bubbles: true})); }
    })()
    """)
    time.sleep(0.2)

    dvd_style = ws_eval(ws, """
    (function() {
        const dvd = document.querySelector('.divider-block');
        return dvd ? dvd.dataset.lineStyle : null;
    })()
    """)

    if dvd_color != '#ff0000':
        bugs.append(f"Divider 색상 미반영: {dvd_color}")
    if str(dvd_weight) != '4':
        bugs.append(f"Divider 두께 미반영: {dvd_weight}")
    if dvd_style != 'dashed':
        bugs.append(f"Divider 스타일 미반영: {dvd_style}")

    return {
        "status": "pass" if not bugs else "fail",
        "notes": f"색상={dvd_color}, 두께={dvd_weight}, 스타일={dvd_style}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-09: 텍스트 블록 복사 붙여넣기
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_09(ws):
    bugs = []

    # H1 블록 선택
    ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (h1) h1.click();
    })()
    """)
    time.sleep(0.3)

    # 텍스트 내용 미리 설정
    ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return;
        const ce = h1.querySelector('[contenteditable]');
        if (ce) ce.innerHTML = 'TEST_COPY_TEXT';
    })()
    """)
    time.sleep(0.2)

    before_count = ws_eval(ws, "document.querySelectorAll('.text-block').length")

    # Cmd+C (copy) → Cmd+V (paste)
    ws_eval(ws, """
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'c', metaKey: true, bubbles: true, cancelable: true}))
    """)
    time.sleep(0.2)
    ws_eval(ws, """
    document.dispatchEvent(new KeyboardEvent('keydown', {key: 'v', metaKey: true, bubbles: true, cancelable: true}))
    """)
    time.sleep(0.5)

    after_count = ws_eval(ws, "document.querySelectorAll('.text-block').length")

    if isinstance(after_count, int) and isinstance(before_count, int) and after_count <= before_count:
        bugs.append(f"Cmd+C/V 후 블록 수 변화 없음 ({before_count}→{after_count}). 키보드 이벤트 방식 복사 미지원 가능성")

        # window.copyBlock 같은 API가 있는지 확인
        has_copy_fn = ws_eval(ws, "typeof window.copySelectedBlock === 'function' || typeof window.duplicateBlock === 'function'")
        if has_copy_fn:
            bugs[-1] += " (window.copySelectedBlock or duplicateBlock 존재)"

    # 복제된 블록 텍스트 확인
    if isinstance(after_count, int) and isinstance(before_count, int) and after_count > before_count:
        copied_text = ws_eval(ws, """
        (function() {
            const blocks = Array.from(document.querySelectorAll('.text-block')).filter(b => b.querySelector('.tb-h1'));
            if (blocks.length < 2) return null;
            const last = blocks[blocks.length - 1];
            const ce = last.querySelector('[contenteditable]');
            return ce ? ce.innerHTML : null;
        })()
        """)
        if copied_text != 'TEST_COPY_TEXT':
            bugs.append(f"복제 블록 텍스트 불일치: {copied_text}")

    return {
        "status": "pass" if not bugs else "warn",
        "notes": f"블록 수: {before_count}→{after_count}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 01-10: 리스너 중복 등록 테스트
# ─────────────────────────────────────────────────────────────────────────────
def scenario_01_10(ws):
    bugs = []

    # H1 블록을 10번 클릭 선택/해제 반복
    r = ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return {ok: false};
        const canvas = document.getElementById('canvas') || document.querySelector('.canvas-area') || document.body;
        // 10번 반복 클릭 (선택 → 해제 → 선택...)
        for (let i = 0; i < 10; i++) {
            h1.click();
            canvas.click();
        }
        // 마지막에 h1 선택
        h1.click();
        return {ok: true};
    })()
    """)
    time.sleep(1.5)  # 충분한 시간 대기

    # 리스너 중복 확인: propPanel 내 input들의 _listeners 확인은 CDP로 직접 불가
    # 대신 prop-section input의 존재 여부와 prop panel 렌더링 횟수를 추적
    # showTextProperties가 10번 호출되면 innerHTML을 10번 갈아엎고 새 리스너를 붙임
    # → 이 방식은 매번 innerHTML 재생성이므로 리스너 중복 없음 (정상 패턴)

    panel_input = ws_eval(ws, "!!document.querySelector('#txt-size-number')")

    # 패널이 정상 렌더링됐는지 확인
    if not panel_input:
        bugs.append("10번 클릭 후 패널 미렌더링 (패널 상태 이상)")

    # 중복 이벤트 테스트: size input에 값 입력 후 실제로 한 번만 적용되는지
    ws_eval(ws, """
    (function() {
        const inp = document.getElementById('txt-size-number');
        if (inp) { inp.value = 30; inp.dispatchEvent(new Event('input', {bubbles: true})); }
    })()
    """)
    time.sleep(0.3)

    applied_size = ws_eval(ws, """
    (function() {
        const h1 = Array.from(document.querySelectorAll('.text-block')).find(b => b.querySelector('.tb-h1'));
        if (!h1) return null;
        return h1.querySelector('[contenteditable]').style.fontSize;
    })()
    """)

    # 정상적으로 30px 적용됐는지 (중복 리스너면 이상 동작 가능)
    if applied_size != '30px':
        bugs.append(f"10번 클릭 후 크기 변경 결과: {applied_size} (30px 예상)")

    # innerHTML 재생성 방식이므로 리스너 중복 위험은 낮음 - 코드 분석 결과 기록
    analysis = "showTextProperties()는 propPanel.innerHTML을 완전 재생성하므로 리스너 중복 위험 낮음. addEventListener는 매번 새 요소에 붙음."

    return {
        "status": "pass" if not bugs else "fail",
        "notes": f"10번 반복 후 패널={panel_input}, size={applied_size}. {analysis}",
        "bugs": bugs
    }

# ─────────────────────────────────────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'#'*60}")
    print(f"Agent-01: 텍스트/Gap/Divider 심층 디버깅")
    print(f"시작: {datetime.datetime.now().isoformat()}")
    print(f"{'#'*60}")

    ws = websocket.create_connection(WS_URL, timeout=15)
    print(f"CDP 연결 성공: {WS_URL}")

    # 섹션 초기화
    setup_section(ws)
    time.sleep(0.5)

    scenarios_fns = [
        ("01-01", "텍스트 6종 모두 생성", scenario_01_01),
        ("01-02", "텍스트 입력 후 스타일 변경", scenario_01_02),
        ("01-03", "텍스트 정렬 (left/center/right)", scenario_01_03),
        ("01-04", "텍스트 색상 변경", scenario_01_04),
        ("01-05", "극단값 입력 (빈/긴 텍스트)", scenario_01_05),
        ("01-06", "텍스트 더블클릭 편집 모드", scenario_01_06),
        ("01-07", "Gap 블록 크기 조절", scenario_01_07),
        ("01-08", "Divider 블록 스타일", scenario_01_08),
        ("01-09", "텍스트 블록 복사 붙여넣기", scenario_01_09),
        ("01-10", "리스너 중복 등록 테스트", scenario_01_10),
    ]

    results = []
    bugs_total = 0

    for sid, title, fn in scenarios_fns:
        r = run_scenario(ws, sid, title, fn)
        results.append(r)
        bugs_total += len(r.get("bugs", []))
        time.sleep(0.5)

    ws.close()

    # 요약
    print(f"\n{'='*60}")
    print(f"완료: {datetime.datetime.now().isoformat()}")
    print(f"총 버그: {bugs_total}개")
    for r in results:
        emoji = "✓" if r['status'] == 'pass' else ("△" if r['status'] == 'warn' else "✗")
        print(f"  {emoji} [{r['id']}] {r['title']} → {r['status'].upper()}")
        for b in r.get('bugs', []):
            print(f"      BUG: {b}")
    print(f"{'='*60}")

    output = {
        "agent": "Agent-01",
        "part": "텍스트/Gap/Divider",
        "ts": datetime.datetime.now().isoformat(),
        "scenarios": results,
        "bugs_found": bugs_total,
        "fixes_applied": 0
    }

    with open(RESULT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n결과 저장: {RESULT_PATH}")
    return output

if __name__ == "__main__":
    main()
