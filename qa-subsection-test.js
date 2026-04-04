const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');

function cdpEval(ws, expression, id) {
  return new Promise((resolve) => {
    const msgId = id;
    const handler = (msg) => {
      const data = JSON.parse(msg);
      if (data.id === msgId) {
        ws.removeListener('message', handler);
        resolve(data.result?.result?.value);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({
      id: msgId,
      method: 'Runtime.evaluate',
      params: { expression, returnByValue: true }
    }));
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

http.get('http://localhost:9335/json', async (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', async () => {
    const target = JSON.parse(d)[0];
    console.log('연결 대상:', target.title);
    console.log('URL:', target.url);

    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let msgId = 1;

    ws.on('open', async () => {
      const results = {
        target: { title: target.title, url: target.url },
        timestamp: new Date().toISOString(),
        tests: [],
        bugs: [],
        summary: {}
      };

      // ========== STEP 0: 현재 상태 확인 ==========
      console.log('\n[STEP 0] 현재 편집기 상태 확인...');
      const state = await cdpEval(ws, `(function(){
        return {
          hasAddSection: typeof window.addSection === 'function',
          hasAddSubSectionBlock: typeof window.addSubSectionBlock === 'function',
          hasAddTextBlock: typeof window.addTextBlock === 'function',
          hasDeselectAll: typeof window.deselectAll === 'function',
          existingSections: document.querySelectorAll('.section-block').length,
          existingSubSections: document.querySelectorAll('.sub-section-block').length,
          activeSubSection: window._activeSubSection ? 'exists' : 'null'
        };
      })()`, msgId++);
      console.log('상태:', JSON.stringify(state, null, 2));
      results.tests.push({ step: 0, name: '현재 편집기 상태', status: state?.hasAddSection ? 'PASS' : 'FAIL', data: state });

      await sleep(200);

      // ========== STEP 1: 섹션 생성 ==========
      console.log('\n[STEP 1] 섹션 생성...');
      const addSectionResult = await cdpEval(ws, `(function(){
        try {
          const before = document.querySelectorAll('.section-block').length;
          window.addSection();
          const after = document.querySelectorAll('.section-block').length;
          return { ok: after > before, before, after };
        } catch(e) {
          return { ok: false, error: e.message };
        }
      })()`, msgId++);
      console.log('섹션 생성:', JSON.stringify(addSectionResult));
      const step1Pass = addSectionResult?.ok === true;
      results.tests.push({ step: 1, name: '섹션 생성 (window.addSection)', status: step1Pass ? 'PASS' : 'FAIL', data: addSectionResult });

      await sleep(400);

      // ========== STEP 2: 서브섹션 추가 ==========
      console.log('\n[STEP 2] 서브섹션 블록 추가...');
      const addSSResult = await cdpEval(ws, `(function(){
        try {
          const before = document.querySelectorAll('.sub-section-block').length;
          window.addSubSectionBlock();
          const after = document.querySelectorAll('.sub-section-block').length;
          const ss = document.querySelector('.sub-section-block');
          const inner = ss ? ss.querySelector('.sub-section-inner') : null;
          return {
            ok: after > before,
            before, after,
            hasInner: !!inner,
            ssClassList: ss ? Array.from(ss.classList) : [],
            innerExists: !!inner
          };
        } catch(e) {
          return { ok: false, error: e.message };
        }
      })()`, msgId++);
      console.log('서브섹션 추가:', JSON.stringify(addSSResult, null, 2));
      const step2Pass = addSSResult?.ok === true && addSSResult?.hasInner === true;
      results.tests.push({ step: 2, name: '서브섹션 추가 (window.addSubSectionBlock)', status: step2Pass ? 'PASS' : 'FAIL', data: addSSResult });

      await sleep(400);

      // ========== STEP 3: 서브섹션 함수 소스 확인 (클릭 핸들러 조건 추출) ==========
      console.log('\n[STEP 3] 서브섹션 클릭 핸들러 소스 분석...');
      const srcResult = await cdpEval(ws, `(function(){
        const src = typeof window.addSubSectionBlock === 'function'
          ? window.addSubSectionBlock.toString()
          : 'NOT_FOUND';
        // 클릭 관련 부분만 추출
        const clickIdx = src.indexOf('click');
        const targetIdx = src.indexOf('e.target');
        const innerIdx = src.indexOf('sub-section-inner');
        return {
          fnLength: src.length,
          hasClickHandler: clickIdx >= 0,
          hasTargetCheck: targetIdx >= 0,
          hasInnerCheck: innerIdx >= 0,
          clickSnippet: clickIdx >= 0 ? src.substring(Math.max(0, clickIdx - 50), clickIdx + 200) : 'not found',
          targetSnippet: targetIdx >= 0 ? src.substring(Math.max(0, targetIdx - 30), targetIdx + 150) : 'not found'
        };
      })()`, msgId++);
      console.log('소스 분석:', JSON.stringify(srcResult, null, 2));
      results.tests.push({ step: 3, name: '서브섹션 클릭 핸들러 소스 분석', status: 'INFO', data: srcResult });

      await sleep(200);

      // ========== STEP 4: ss 테두리 직접 클릭 → selected 확인 ==========
      console.log('\n[STEP 4] 서브섹션 테두리(ss) 클릭 → selected 클래스 확인...');
      const ssBorderClick = await cdpEval(ws, `(function(){
        const ss = document.querySelector('.sub-section-block');
        if (!ss) return { ok: false, error: '서브섹션 없음' };

        // 초기화
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        window._activeSubSection = null;

        const before = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: window._activeSubSection ? 'exists' : 'null'
        };

        // ss 자체를 클릭 (target === ss)
        ss.click();

        const after = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: window._activeSubSection ? window._activeSubSection.className.substring(0, 50) : 'null'
        };

        return { ok: true, before, after, ssClasses: Array.from(ss.classList) };
      })()`, msgId++);
      console.log('ss 테두리 클릭:', JSON.stringify(ssBorderClick, null, 2));
      const step4Pass = ssBorderClick?.after?.ssSelected === true;
      const step4Status = step4Pass ? 'PASS' : 'BUG';
      results.tests.push({ step: 4, name: '서브섹션 테두리 클릭 → selected 클래스', status: step4Status, data: ssBorderClick });
      if (!step4Pass) {
        results.bugs.push({
          id: 'BUG-01', severity: 'HIGH',
          title: 'ss.click() 시 selected 클래스 미추가',
          reproduce: '서브섹션 블록 추가 후 테두리 영역 클릭',
          expected: 'selected 클래스 추가됨',
          actual: 'selected 클래스 미추가',
          fix: '클릭 핸들러에서 ss.classList.add("selected") 확인 필요'
        });
      }

      await sleep(200);

      // ========== STEP 5: inner 직접 클릭 → selected 확인 ==========
      console.log('\n[STEP 5] 서브섹션 inner 클릭 → selected 클래스 확인...');
      const innerClick = await cdpEval(ws, `(function(){
        const ss = document.querySelector('.sub-section-block');
        if (!ss) return { ok: false, error: '서브섹션 없음' };
        const inner = ss.querySelector('.sub-section-inner');
        if (!inner) return { ok: false, error: 'inner 없음' };

        // 초기화
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        window._activeSubSection = null;

        const before = { ssSelected: ss.classList.contains('selected') };

        // inner 클릭 (target === inner, inner.classList.contains('sub-section-inner') === true)
        inner.click();

        const after = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: window._activeSubSection ? 'exists' : 'null'
        };

        return { ok: true, before, after, innerClasses: Array.from(inner.classList) };
      })()`, msgId++);
      console.log('inner 클릭:', JSON.stringify(innerClick, null, 2));
      const step5Pass = innerClick?.after?.ssSelected === true;
      const step5Status = step5Pass ? 'PASS' : 'BUG';
      results.tests.push({ step: 5, name: '서브섹션 inner 클릭 → selected 클래스', status: step5Status, data: innerClick });
      if (!step5Pass) {
        results.bugs.push({
          id: 'BUG-02', severity: 'HIGH',
          title: 'inner.click() 시 selected 클래스 미추가',
          reproduce: '서브섹션 블록의 inner 영역 클릭',
          expected: 'selected 클래스 추가됨',
          actual: 'selected 클래스 미추가',
          fix: "핸들러 조건 `!e.target.classList.contains('sub-section-inner')` 이 true가 되어 early return 발생 가능성 확인"
        });
      }

      await sleep(200);

      // ========== STEP 6: inner 안 자식 요소 클릭 → selected 확인 (핵심 버그 시나리오) ==========
      console.log('\n[STEP 6] inner 안 자식 요소 클릭 → selected 미부여 (핵심 버그)...');
      const innerChildClick = await cdpEval(ws, `(function(){
        const ss = document.querySelector('.sub-section-block');
        if (!ss) return { ok: false, error: '서브섹션 없음' };
        const inner = ss.querySelector('.sub-section-inner');
        if (!inner) return { ok: false, error: 'inner 없음' };

        // 초기화
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        window._activeSubSection = null;

        // inner 내부 실제 자식 요소 확인
        const existingChildren = Array.from(inner.children).map(c => ({ tag: c.tagName, cls: c.className }));

        // 임시 자식 div 생성 (target !== ss && target.classList에 'sub-section-inner' 없음 → 핸들러 리턴되어야)
        const fakeChild = document.createElement('div');
        fakeChild.className = 'qa-test-inner-child';
        fakeChild.style.width = '10px';
        fakeChild.style.height = '10px';
        inner.appendChild(fakeChild);

        const before = { ssSelected: ss.classList.contains('selected') };
        fakeChild.click();
        const after = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: window._activeSubSection ? 'exists' : 'null'
        };

        inner.removeChild(fakeChild);

        // 핸들러 조건대로라면: target !== ss (true) && !target.classList.contains('sub-section-inner') (true) → return → selected 안 붙음
        const bugConfirmed = !after.ssSelected;

        return { ok: true, before, after, existingChildren, bugConfirmed };
      })()`, msgId++);
      console.log('inner 자식 클릭:', JSON.stringify(innerChildClick, null, 2));
      const step6IsBug = innerChildClick?.bugConfirmed === true;
      results.tests.push({
        step: 6,
        name: 'inner 안 자식 요소 클릭 → selected 미부여 버그 확인',
        status: step6IsBug ? 'BUG' : 'PASS',
        data: innerChildClick,
        note: step6IsBug
          ? '핸들러 조건이 inner 안의 모든 자식 요소를 걸러냄 → 서브섹션 안에 블록 추가 시 선택 불가'
          : '자식 요소 클릭도 selected 정상 부여됨'
      });
      if (step6IsBug) {
        results.bugs.push({
          id: 'BUG-03', severity: 'HIGH',
          title: 'inner 안 자식 요소 클릭 시 서브섹션 선택 불가',
          reproduce: '1. 서브섹션 추가 → 2. 서브섹션 안에 텍스트블록 등 추가 → 3. 그 블록 클릭 → 서브섹션 selected 안 됨',
          condition: "if (e.target !== ss && !e.target.classList.contains('sub-section-inner')) return;",
          problem: '이 조건은 inner의 직접 자식만 허용, inner 안의 모든 하위 요소 클릭을 차단함',
          fix: "조건을 다음으로 교체:\nif (!e.target.closest('.sub-section-block') || (e.target !== ss && !e.target.classList.contains('sub-section-inner') && !ss.contains(e.target))) return;\n\n또는 더 간결하게:\nif (e.target !== ss && !ss.contains(e.target)) return;  // 단, drag-select 등 내부 이벤트 충돌 주의"
        });
      }

      await sleep(200);

      // ========== STEP 7: _activeSubSection 설정 여부 ==========
      console.log('\n[STEP 7] _activeSubSection 설정 여부 확인...');
      const activeCheck = await cdpEval(ws, `(function(){
        const ss = document.querySelector('.sub-section-block');
        if (!ss) return { ok: false, error: '서브섹션 없음' };

        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        window._activeSubSection = null;

        ss.click();

        return {
          ok: true,
          ssSelected: ss.classList.contains('selected'),
          activeSubSectionSet: !!window._activeSubSection,
          isSameElement: window._activeSubSection === ss,
          activeClass: window._activeSubSection ? window._activeSubSection.className.substring(0, 60) : 'null'
        };
      })()`, msgId++);
      console.log('_activeSubSection 확인:', JSON.stringify(activeCheck, null, 2));
      const step7Pass = activeCheck?.activeSubSectionSet === true && activeCheck?.isSameElement === true;
      results.tests.push({
        step: 7,
        name: '_activeSubSection 설정 여부',
        status: step7Pass ? 'PASS' : 'BUG',
        data: activeCheck
      });
      if (!step7Pass) {
        results.bugs.push({
          id: 'BUG-04', severity: 'MEDIUM',
          title: '_activeSubSection이 클릭 후에도 설정되지 않음',
          reproduce: '서브섹션 클릭 후 window._activeSubSection 확인',
          expected: 'window._activeSubSection === ss (클릭한 서브섹션 요소)',
          actual: 'window._activeSubSection === null',
          fix: '클릭 핸들러 내 window._activeSubSection = ss; 코드 확인 및 추가'
        });
      }

      await sleep(200);

      // ========== STEP 8: 텍스트 블록 선택 비교 ==========
      console.log('\n[STEP 8] 텍스트 블록 추가 및 선택 비교...');
      const textBlockTest = await cdpEval(ws, `(function(){
        try {
          const beforeCount = document.querySelectorAll('.text-block').length;
          window.addTextBlock('body');
          const textBlocks = document.querySelectorAll('.text-block');
          const added = textBlocks.length > beforeCount;
          if (!added) return { ok: false, error: '텍스트 블록 추가 안 됨', count: textBlocks.length };

          const last = textBlocks[textBlocks.length - 1];
          document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

          const before = { textSelected: last.classList.contains('selected') };
          last.click();
          const after = {
            textSelected: last.classList.contains('selected'),
            classes: Array.from(last.classList)
          };

          return { ok: true, added, before, after, blockCount: textBlocks.length };
        } catch(e) {
          return { ok: false, error: e.message };
        }
      })()`, msgId++);
      console.log('텍스트 블록:', JSON.stringify(textBlockTest, null, 2));
      const step8Pass = textBlockTest?.after?.textSelected === true;
      results.tests.push({
        step: 8,
        name: '텍스트 블록 클릭 → selected 클래스',
        status: step8Pass ? 'PASS' : 'BUG',
        data: textBlockTest
      });

      await sleep(300);

      // ========== STEP 9: 텍스트 선택 후 서브섹션 클릭 → 교차 deselect ==========
      console.log('\n[STEP 9] 텍스트 선택 → 서브섹션 클릭 → 교차 선택 해제...');
      const crossSelect = await cdpEval(ws, `(function(){
        const textBlock = document.querySelector('.text-block');
        const ss = document.querySelector('.sub-section-block');
        if (!textBlock || !ss) return { ok: false, hasText: !!textBlock, hasSS: !!ss };

        // 텍스트 블록 선택
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        textBlock.click();
        const afterTextClick = {
          textSelected: textBlock.classList.contains('selected'),
          ssSelected: ss.classList.contains('selected')
        };

        // 서브섹션 클릭
        ss.click();
        const afterSSClick = {
          textSelected: textBlock.classList.contains('selected'),
          ssSelected: ss.classList.contains('selected')
        };

        return { ok: true, afterTextClick, afterSSClick };
      })()`, msgId++);
      console.log('교차 선택:', JSON.stringify(crossSelect, null, 2));
      // 텍스트가 selected 됐다가 ss 클릭 후 텍스트는 deselect, ss는 selected여야 함
      const crossOk = crossSelect?.afterTextClick?.textSelected === true
        && crossSelect?.afterSSClick?.ssSelected === true
        && crossSelect?.afterSSClick?.textSelected === false;
      const crossPartOk = crossSelect?.afterSSClick?.ssSelected === true;
      results.tests.push({
        step: 9,
        name: '텍스트→서브섹션 교차 선택 (기존 선택 해제)',
        status: crossOk ? 'PASS' : (crossPartOk ? 'PARTIAL' : 'BUG'),
        data: crossSelect,
        note: crossOk ? '정상' : (crossSelect?.afterSSClick?.textSelected === true ? '텍스트 블록 deselect 안 됨' : crossSelect?.afterSSClick?.ssSelected === false ? '서브섹션 selected 안 됨' : '기타')
      });

      await sleep(200);

      // ========== STEP 10: deselectAll 연동 테스트 ==========
      console.log('\n[STEP 10] deselectAll 연동 테스트...');
      const deselectTest = await cdpEval(ws, `(function(){
        const ss = document.querySelector('.sub-section-block');
        if (!ss) return { ok: false, error: '서브섹션 없음' };

        // 서브섹션 선택
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        ss.click();
        const before = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: !!window._activeSubSection
        };

        const deselectAllExists = typeof window.deselectAll === 'function';

        if (deselectAllExists) {
          window.deselectAll();
        } else {
          // 섹션 빈 공간 클릭 시도
          const section = document.querySelector('.section-block');
          if (section) {
            const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
            Object.defineProperty(ev, 'target', { value: section, writable: false });
            section.dispatchEvent(ev);
          }
        }

        const after = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: !!window._activeSubSection,
          deselectAllExists
        };

        return { ok: true, before, after };
      })()`, msgId++);
      console.log('deselectAll 테스트:', JSON.stringify(deselectTest, null, 2));
      const step10Pass = deselectTest?.after?.ssSelected === false;
      results.tests.push({
        step: 10,
        name: 'deselectAll 연동 → selected 해제',
        status: step10Pass ? 'PASS' : 'BUG',
        data: deselectTest,
        note: deselectTest?.after?.deselectAllExists ? 'deselectAll 함수 존재' : 'deselectAll 함수 없음 - 섹션 클릭으로 대체 테스트'
      });
      if (!step10Pass) {
        results.bugs.push({
          id: 'BUG-05', severity: 'MEDIUM',
          title: 'deselectAll 호출 후 서브섹션 selected 클래스 미제거',
          reproduce: '서브섹션 선택 후 window.deselectAll() 호출',
          expected: 'selected 클래스 제거 + _activeSubSection = null',
          actual: 'selected 클래스 유지',
          fix: 'deselectAll 함수에서 .sub-section-block 에서도 selected 클래스 제거 처리 추가'
        });
      }

      await sleep(200);

      // ========== STEP 11: 빈 섹션 클릭 → selected 해제 ==========
      console.log('\n[STEP 11] 빈 섹션 클릭 → 서브섹션 selected 해제...');
      const sectionDeselect = await cdpEval(ws, `(function(){
        const ss = document.querySelector('.sub-section-block');
        const section = ss ? ss.closest('.section-block') : document.querySelector('.section-block');
        if (!ss || !section) return { ok: false, hasSS: !!ss, hasSection: !!section };

        // 서브섹션 선택
        document.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        ss.click();
        const before = { ssSelected: ss.classList.contains('selected') };

        // 섹션 자체에 click 이벤트 발생 (서브섹션 바깥)
        // target을 section으로 설정해서 이벤트 발생
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        section.dispatchEvent(ev);

        const after = {
          ssSelected: ss.classList.contains('selected'),
          activeSubSection: !!window._activeSubSection
        };

        return { ok: true, before, after };
      })()`, msgId++);
      console.log('섹션 클릭 deselect:', JSON.stringify(sectionDeselect, null, 2));
      const step11Pass = sectionDeselect?.after?.ssSelected === false;
      results.tests.push({
        step: 11,
        name: '빈 섹션 클릭 → 서브섹션 selected 해제',
        status: step11Pass ? 'PASS' : 'BUG',
        data: sectionDeselect
      });

      await sleep(200);

      // ========== 종합 요약 ==========
      const passCount = results.tests.filter(t => t.status === 'PASS').length;
      const failCount = results.tests.filter(t => t.status === 'BUG' || t.status === 'FAIL').length;
      const partialCount = results.tests.filter(t => t.status === 'PARTIAL').length;
      const infoCount = results.tests.filter(t => t.status === 'INFO').length;

      results.summary = {
        totalTests: results.tests.length - infoCount,
        pass: passCount,
        fail: failCount,
        partial: partialCount,
        totalBugs: results.bugs.length,
        highSeverityBugs: results.bugs.filter(b => b.severity === 'HIGH').length,
        mediumSeverityBugs: results.bugs.filter(b => b.severity === 'MEDIUM').length,
        verdict: results.bugs.length === 0 ? 'ALL_PASS' : `BUGS_FOUND_${results.bugs.length}`
      };

      console.log('\n\n========== 종합 요약 ==========');
      console.log(JSON.stringify(results.summary, null, 2));
      console.log('\n발견된 버그:');
      results.bugs.forEach(b => {
        console.log(`  [${b.id}][${b.severity}] ${b.title}`);
      });

      // 결과 저장
      fs.writeFileSync(
        '/Users/a1/web-editor/debug/results/qa-explorer-subsection.json',
        JSON.stringify(results, null, 2),
        'utf8'
      );
      console.log('\n결과 저장 완료: /Users/a1/web-editor/debug/results/qa-explorer-subsection.json');

      ws.close();
    });

    ws.on('error', (err) => {
      console.error('WebSocket 에러:', err.message);
    });
  });
});
