/**
 * Goditor Spec Runner
 * Spec v2 JSON 파일을 읽어서 CDP로 에디터에 섹션을 자동 조립한다.
 *
 * 사용법:
 *   node goditor_runner.js /tmp/goditor_spec_{이름}.json [--port 9337]
 */

const WebSocket = require('/Users/a1/web-editor/node_modules/ws');
const http = require('http');
const fs = require('fs');

const args = process.argv.slice(2);
const portIdx = args.indexOf('--port');
const PORT = portIdx !== -1 ? parseInt(args[portIdx + 1]) : 9336;
const specPath = args.find(a => !a.startsWith('--') && a !== String(PORT));
if (!specPath) {
  console.error('usage: node goditor_runner.js <spec.json> [--port 9337]');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

function getWsUrl() {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${PORT}/json`, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const pages = JSON.parse(data);
        const page = pages.find(p => p.type === 'page' && (p.url.includes('web-editor') || p.url.includes('index.html')));
        if (page) resolve(page.webSocketDebuggerUrl);
        else reject(new Error('웹에디터 페이지 없음'));
      });
    }).on('error', reject);
  });
}

(async () => {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  let msgId = 1;
  const pending = new Map();

  function ev(expr) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: expr, returnByValue: true, awaitPromise: true }
      }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('timeout: ' + expr.slice(0, 60)));
        }
      }, 10000);
    });
  }

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result?.result?.value ?? msg.result?.result);
      pending.delete(msg.id);
    }
  });

  await new Promise(r => ws.on('open', r));
  const delay = ms => new Promise(r => setTimeout(r, ms));

  async function buildBlock(block) {
    switch (block.type) {
      case 'text': {
        const opts = JSON.stringify({
          ...(block.content   !== undefined && { content:  block.content  }),
          ...(block.color     && { color:    block.color    }),
          ...(block.align     && { align:    block.align    }),
          ...(block.fontSize  && { fontSize: block.fontSize }),
        });
        await ev(`window.addTextBlock('${block.style}', ${opts})`);
        break;
      }
      case 'image':
        await ev(`window.addAssetBlock('${block.preset || 'standard'}')`);
        break;
      case 'joker':
        await ev(`window.addJokerBlock(${JSON.stringify({
          label: block.label,
          svg: block.svg,
          width: block.width,
          height: block.height,
          x: block.x || 0,
          y: block.y || 0,
        })})`);
        break;
      case 'sub-section': {
        // 서브섹션 추가
        await ev(`window.addSubSectionBlock()`);
        await delay(300);
        // 크기·위치·배경 적용
        await ev(`(function(){
          const ss = document.querySelector('.sub-section-block.selected') || window._activeSubSection;
          if (!ss) return;
          ss.style.width = '${block.width}px';
          ss.dataset.width = '${block.width}';
          ss.style.height = '${block.height}px';
          ss.style.minHeight = '${block.height}px';
          ss.style.padding = '0';
          ss.style.background = '${block.bg || '#f5f5f5'}';
          ss.dataset.bg = '${block.bg || '#f5f5f5'}';
          ss.style.marginLeft = '${block.x || 0}px';
          ss.style.marginRight = 'auto';
        })()`);
        await delay(200);
        // 자식 조커 블록 추가
        for (const child of (block.children || [])) {
          if (child.type === 'joker') {
            await ev(`window.addJokerBlock(${JSON.stringify({
              label: child.label,
              svg: child.svg,
              width: child.width,
              height: child.height,
              x: child.x || 0,
              y: child.y || 0,
            })})`);
            await delay(200);
          }
        }
        // 서브섹션 활성화 해제
        await ev(`window._activeSubSection = null`);
        break;
      }
      case 'gap':
        await ev(`window.addGapBlock(${block.height || 40})`);
        break;
      case 'divider':
        await ev(`window.addDividerBlock(${JSON.stringify({
          color: block.color,
          lineStyle: block.lineStyle,
          weight: block.weight
        })})`);
        break;
      case 'icon-circle':
        await ev(`window.addIconCircleBlock(${JSON.stringify({
          size: block.size,
          bgColor: block.bgColor
        })})`);
        break;
      case 'label-group':
        await ev(`window.addLabelGroupBlock(${JSON.stringify({ labels: block.labels })})`);
        break;
      case 'table':
        await ev(`window.addTableBlock(${JSON.stringify({
          showHeader: block.showHeader,
          cellAlign: block.cellAlign
        })})`);
        break;
      case 'card':
        await ev(`window.addCardBlock(${block.count || 2}, ${JSON.stringify({
          bgColor: block.bgColor,
          radius: block.radius
        })})`);
        break;
      case 'graph':
        await ev(`window.addGraphBlock(${JSON.stringify({
          chartType: block.chartType,
          items: block.items
        })})`);
        break;
      default:
        console.warn(`⚠️ 알 수 없는 블록 타입: ${block.type}`);
    }
    await delay(200);
  }

  for (const section of spec.sections) {
    const bg = section.settings?.bg || '';
    const paddingY = section.settings?.paddingY;
    const paddingX = section.settings?.paddingX;
    const addSecOpts = `{ skipDefaultBlock: true${bg ? `, bg: '${bg}'` : ''}${paddingY !== undefined ? `, paddingY: ${paddingY}` : ''}${paddingX !== undefined ? `, paddingX: ${paddingX}` : ''} }`;
    await ev(`window.addSection(${addSecOpts})`);
    await delay(300);

    for (const row of section.rows) {
      if (row.layout === 'flex' || row.layout === 'grid') {
        await ev(`window.addRowBlock(${row.cols.length})`);
        await delay(200);

        // UI용 초기 min-height 제거 (자동 빌드에서 콘텐츠 기반 높이 사용)
        await ev(`(function(){ const r = document.querySelector('.row.row-active'); if(r) r.style.minHeight = ''; })()`);

        // flex 비율 + vAlign 설정
        const hasFlex  = row.cols.some(c => c.flex && c.flex !== 1);
        const hasVAlign = row.cols.some(c => c.vAlign);
        if (hasFlex || hasVAlign) {
          const setters = row.cols.map((c, i) => {
            const parts = [];
            if (c.flex && c.flex !== 1) {
              parts.push(`cols[${i}].style.flex = '${c.flex}'; cols[${i}].dataset.flex = '${c.flex}';`);
            }
            if (c.vAlign) {
              // col은 flex-direction: column → justify-content으로 수직 정렬
              const jc = c.vAlign === 'center' ? 'center' : c.vAlign === 'end' ? 'flex-end' : 'flex-start';
              parts.push(`cols[${i}].style.justifyContent = '${jc}';`);
            }
            return parts.length ? `if (cols[${i}]) { ${parts.join(' ')} }` : '';
          }).filter(Boolean).join('\n            ');
          if (setters) {
            await ev(`(function() {
              const row = document.querySelector('.row.row-active');
              const cols = [...row.querySelectorAll(':scope > .col')];
              ${setters}
            })()`);
            await delay(100);
          }
        }

        for (let i = 0; i < row.cols.length; i++) {
          await ev(`window.activateCol(document.querySelector('.row.row-active'), ${i})`);
          for (const block of row.cols[i].blocks) {
            await buildBlock(block);
          }
        }
        await ev(`document.querySelectorAll('.col.col-active').forEach(c => c.classList.remove('col-active'))`);

      } else {
        // stack: addRowBlock 없이 바로 추가
        for (const block of row.cols[0].blocks) {
          await buildBlock(block);
        }
      }
    }

    console.log(`✅ 섹션 완료: [${section.label || ''}] ${bg}`);
  }

  await ev(`window.triggerAutoSave()`);
  await delay(500);
  console.log('✅ 전체 빌드 완료');
  ws.close();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
