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
const targetSecIdx = args.indexOf('--target-section');
const TARGET_SECTION = targetSecIdx !== -1 ? args[targetSecIdx + 1] : null;
const specPath = args.find(a => !a.startsWith('--') && a !== String(PORT) && a !== TARGET_SECTION);
if (!specPath) {
  console.error('usage: node goditor_runner.js <spec.json> [--port 9337] [--target-section sec_xxx]');
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

// 이미지 preset 고정 높이
const PRESET_HEIGHTS = { standard: 780, square: 860, tall: 1032, wide: 575, logo: 64 };

// 블록 높이 추정 (frame layout 내 Y 계산용)
function getBlockHeight(block) {
  if (block.height !== undefined) return block.height;
  switch (block.type) {
    case 'gap':       return block.height || 40;
    case 'image':     return PRESET_HEIGHTS[block.preset || 'standard'];
    case 'text':      return Math.ceil((block.fontSize || 28) * (block.lineCount || 1) * 1.10);
    case 'divider':   return 2;
    case 'icon-circle': return block.size || 80;
    default:          return 0;
  }
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

  // 일반 블록 추가 (stack / sub-section 내부용)
  async function buildBlock(block) {
    switch (block.type) {
      case 'text': {
        const opts = JSON.stringify({
          ...(block.content  !== undefined && { content:  block.content  }),
          ...(block.color    && { color:    block.color    }),
          ...(block.align    && { align:    block.align    }),
          ...(block.fontSize && { fontSize: block.fontSize }),
          ...(block.paddingX !== undefined && { paddingX: block.paddingX }),
        });
        await ev(`window.addTextBlock('${block.style}', ${opts})`);
        break;
      }
      case 'image': {
        const assetOpts = {};
        if (block.paddingX !== undefined) assetOpts.paddingX = block.paddingX;
        if (block.width    !== undefined) assetOpts.width    = block.width;
        if (block.height   !== undefined) assetOpts.height   = block.height;
        const hasOpts = Object.keys(assetOpts).length > 0;
        await ev(`window.addAssetBlock('${block.preset || 'standard'}'${hasOpts ? `, ${JSON.stringify(assetOpts)}` : ''})`);
        // src가 있으면 마지막 추가된 asset-block에 이미지 주입 (loadImageToAsset 방식)
        if (block.src) {
          await ev(`(function(){
            const sec = document.querySelector('.section-block.selected');
            if (!sec) return;
            const abs = sec.querySelectorAll('.asset-block');
            const ab = abs[abs.length - 1];
            if (!ab) return;
            const src = ${JSON.stringify(block.src)};
            ab.classList.add('has-image');
            ab.dataset.imgSrc = src;
            ab.dataset.fit = 'cover';
            const prevOverlay = ab.querySelector('.asset-overlay');
            const prevHTML = prevOverlay ? prevOverlay.innerHTML : '';
            const prevStyle = prevOverlay ? (prevOverlay.getAttribute('style') || '') : '';
            ab.innerHTML = '<img class="asset-img" src="' + src + '" draggable="false" style="object-fit:cover"><button class="asset-overlay-clear" title="이미지 제거">✕</button><div class="asset-overlay"' + (prevStyle ? ' style="' + prevStyle + '"' : '') + '>' + prevHTML + '</div>';
            ab.querySelector('.asset-overlay-clear').addEventListener('click', function(e){
              e.stopPropagation();
              if (window.clearAssetImage) window.clearAssetImage(ab);
            });
          })()`);
        }
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
        await ev(`window.addIconCircleBlock(${JSON.stringify({ size: block.size, bgColor: block.bgColor })})`);
        break;
      case 'label-group':
        await ev(`window.addLabelGroupBlock(${JSON.stringify({ labels: block.labels })})`);
        break;
      case 'table':
        await ev(`window.addTableBlock(${JSON.stringify({ showHeader: block.showHeader, cellAlign: block.cellAlign })})`);
        break;
      case 'card':
        await ev(`window.addCardBlock(${block.count || 2}, ${JSON.stringify({ bgColor: block.bgColor, radius: block.radius })})`);
        break;
      case 'graph':
        await ev(`window.addGraphBlock(${JSON.stringify({ chartType: block.chartType, items: block.items })})`);
        break;
      case 'joker':
        await ev(`window.addJokerBlock(${JSON.stringify({
          label: block.label,
          svg:   block.svg,
          width: block.width,
          height: block.height,
          x: block.x || 0,
          y: block.y || 0,
        })})`);
        break;
      case 'sub-section': {
        // sub-section → addFrameBlock (freeLayout) + 자식 블록 절대좌표 배치
        const ssBg = block.bg || 'transparent';
        const ssH  = block.height || 100;
        const ssW  = block.width  || 860;
        const ssRadius = (typeof block.radius === 'number') ? block.radius : undefined;
        await ev(`window._activeFrame = null`);
        await ev(`window.addFrameBlock({ bg: '${ssBg}'${ssRadius !== undefined ? `, radius: ${ssRadius}` : ''} })`);
        await ev(`(function(){
          const f = window._activeFrame;
          if (!f) return;
          f.style.width    = '${ssW}px';
          f.style.height   = '${ssH}px';
          f.style.minHeight= '${ssH}px';
          f.dataset.height = '${ssH}';
          f.dataset.freeLayout = 'true';
          f.style.position = 'relative';
          f.style.overflow = 'hidden';
          ${ssRadius !== undefined ? `f.style.borderRadius = '${ssRadius}px'; f.dataset.radius = '${ssRadius}';` : ''}
        })()`);
        await delay(200);
        // 카드 frame을 ID로 잡아두고 자식 처리 후 selected를 카드로 복원
        const cardFrameId = await ev(`window._activeFrame?.id || ''`);
        for (const child of (block.children || [])) {
          await buildBlockInFrame(child, child.x || 0, child.y || 0, child.width || ssW);
        }
        await ev(`window.deactivateFrame()`);
        // 다음 row의 gap-block이 카드 안 라벨 옆에 삽입되지 않도록 selected를 카드 자체로 복원
        await ev(`(function(){
          document.querySelectorAll('.selected').forEach(e => {
            if (e.classList.contains('section-block')) return;
            e.classList.remove('selected');
          });
          const card = document.getElementById('${cardFrameId}');
          if (card) card.classList.add('selected');
        })()`);
        await delay(100);
        break;
      }
      default:
        console.warn(`⚠️ 알 수 없는 블록 타입: ${block.type}`);
    }
    await delay(200);
  }

  // 방금 추가된 블록의 실제 DOM 높이를 읽어 반환
  async function getLastBlockHeight(type) {
    if (type === 'text') {
      return await ev(`(function(){
        const f = window._activeFrame;
        if (!f) return 0;
        const tfs = f.querySelectorAll(':scope > .frame-block[data-text-frame]');
        const last = tfs[tfs.length - 1];
        return last ? last.offsetHeight : 0;
      })()`);
    }
    if (type === 'image') {
      return await ev(`(function(){
        const f = window._activeFrame;
        if (!f) return 0;
        const abs = f.querySelectorAll(':scope > .asset-block');
        const last = abs[abs.length - 1];
        return last ? last.offsetHeight : 0;
      })()`);
    }
    return 0;
  }

  // frame layout 내 절대좌표 블록 추가 — 실제 높이 반환
  async function buildBlockInFrame(block, x, y, width) {
    switch (block.type) {
      case 'text': {
        const opts = JSON.stringify({
          ...(block.content   !== undefined && { content:   block.content   }),
          ...(block.color     && { color:     block.color     }),
          ...(block.align     && { align:     block.align     }),
          ...(block.fontSize  && { fontSize:  block.fontSize  }),
          ...(block.paddingX  !== undefined && { paddingX:  block.paddingX  }),
          ...(block.lineCount !== undefined && { lineCount: block.lineCount }),
          x, y, width,
        });
        await ev(`window.addTextBlock('${block.style}', ${opts})`);
        await delay(200);
        return await getLastBlockHeight('text');
      }
      case 'image': {
        // logo preset은 width 고정(200px) — opts.width 전달 시 applyPreset이 덮어쓰므로 제외
        const imgOpts = block.preset === 'logo' ? { x, y } : { x, y, width };
        if (block.height !== undefined) imgOpts.height = block.height;
        await ev(`window.addAssetBlock('${block.preset || 'standard'}', ${JSON.stringify(imgOpts)})`);
        if (block.src) {
          await ev(`(function(){
            const f = window._activeFrame;
            if (!f) return;
            const abs = f.querySelectorAll('.asset-block');
            const ab = abs[abs.length - 1];
            if (!ab) return;
            const src = ${JSON.stringify(block.src)};
            ab.classList.add('has-image');
            ab.dataset.imgSrc = src;
            ab.dataset.fit = 'cover';
            const prevOverlay = ab.querySelector('.asset-overlay');
            const prevHTML = prevOverlay ? prevOverlay.innerHTML : '';
            const prevStyle = prevOverlay ? (prevOverlay.getAttribute('style') || '') : '';
            ab.innerHTML = '<img class="asset-img" src="' + src + '" draggable="false" style="object-fit:cover"><button class="asset-overlay-clear" title="이미지 제거">✕</button><div class="asset-overlay"' + (prevStyle ? ' style="' + prevStyle + '"' : '') + '>' + prevHTML + '</div>';
            ab.querySelector('.asset-overlay-clear').addEventListener('click', function(e){
              e.stopPropagation();
              if (window.clearAssetImage) window.clearAssetImage(ab);
            });
          })()`);
        }
        await delay(200);
        return await getLastBlockHeight('image');
      }
      case 'gap':
        // gap은 y 오프셋만 증가 (DOM 추가 없음)
        return block.height || 0;
      case 'divider':
        await ev(`window.addDividerBlock(${JSON.stringify({ color: block.color, lineStyle: block.lineStyle, weight: block.weight })})`);
        await delay(200);
        return getBlockHeight(block);
      case 'icon-circle':
        await ev(`window.addIconCircleBlock(${JSON.stringify({ size: block.size, bgColor: block.bgColor })})`);
        await delay(200);
        return getBlockHeight(block);
      case 'joker':
        await ev(`window.addJokerBlock(${JSON.stringify({
          label:  block.label,
          svg:    block.svg,
          width:  block.width,
          height: block.height,
          x:      block.x !== undefined ? block.x : x,
          y:      block.y !== undefined ? block.y : y,
        })})`);
        await delay(200);
        return block.height || 0;
      case 'sub-section': {
        // 중첩 sub-section: 부모 freeLayout 안에 자식 freeLayout frame 추가 (재귀)
        const subBg = block.bg || 'transparent';
        const subW  = block.width  || width || 860;
        const subH  = block.height || 100;
        const subRadius = (typeof block.radius === 'number') ? block.radius : undefined;

        // 부모 frame 보관 → 자식 빌드 후 복원
        await ev(`window.__parentFrameStack = (window.__parentFrameStack || []); window.__parentFrameStack.push(window._activeFrame);`);
        await ev(`window.addFrameBlock({ bg: '${subBg}'${subRadius !== undefined ? `, radius: ${subRadius}` : ''} })`);
        await ev(`(function(){
          const f = window._activeFrame;
          if (!f) return;
          f.dataset.bg = '${subBg}';
          f.style.background = '${subBg}';
          f.style.position = 'absolute';
          f.style.left     = '${x}px';
          f.style.top      = '${y}px';
          f.style.width    = '${subW}px';
          f.style.height   = '${subH}px';
          f.style.minHeight= '${subH}px';
          f.style.maxWidth = 'none';
          f.style.margin   = '0';
          f.style.overflow = 'hidden';
          f.dataset.width  = '${subW}';
          f.dataset.height = '${subH}';
          f.dataset.freeLayout = 'true';
          ${subRadius !== undefined ? `f.style.borderRadius = '${subRadius}px'; f.dataset.radius = '${subRadius}';` : ''}
        })()`);
        await delay(150);

        for (const child of (block.children || [])) {
          await buildBlockInFrame(child, child.x || 0, child.y || 0, child.width || subW);
        }

        // 부모 frame 복원 + selected를 부모로 복귀 (다음 자식의 gap이 라벨 옆에 끼지 않도록)
        await ev(`(function(){
          const stk = window.__parentFrameStack;
          const parent = (stk && stk.length) ? stk.pop() : null;
          if (parent) window._activeFrame = parent;
          else window.deactivateFrame?.();
          document.querySelectorAll('.selected').forEach(e => {
            if (e.classList.contains('section-block')) return;
            e.classList.remove('selected');
          });
          if (parent) parent.classList.add('selected');
        })()`);
        await delay(100);
        return subH;
      }
      default:
        console.warn(`⚠️ frame 내부 미지원 블록: ${block.type}`);
        return 0;
    }
  }

  for (const section of spec.sections) {
    const bg       = section.settings?.bg || '';
    const paddingY = section.settings?.paddingY;
    const paddingX = section.settings?.paddingX;
    const addSecOpts = `{ skipDefaultBlock: true${bg ? `, bg: '${bg}'` : ''}${paddingY !== undefined ? `, paddingY: ${paddingY}` : ''}${paddingX !== undefined ? `, paddingX: ${paddingX}` : ''} }`;
    if (TARGET_SECTION) {
      // 기존 섹션 선택 (새 섹션 생성 없이 해당 섹션에 추가) — 고스트 섹션 차단
      const isGhost = await ev(`(function(){
        const sec = document.getElementById('${TARGET_SECTION}');
        if (!sec) return 'not_found';
        if (sec.dataset.ghost) return 'ghost';
        return 'ok';
      })()`);
      if (isGhost === 'not_found') { console.error(`❌ 섹션 없음: ${TARGET_SECTION}`); process.exit(1); }
      if (isGhost === 'ghost')     { console.error(`❌ 고스트 섹션은 타겟으로 지정할 수 없습니다: ${TARGET_SECTION}`); process.exit(1); }
      await ev(`(function(){
        const sec = document.getElementById('${TARGET_SECTION}');
        window.deselectAll?.();
        sec.classList.add('selected');
        window.syncSection?.(sec);
      })()`);
    } else {
      await ev(`window.addSection(${addSecOpts})`);
    }
    await delay(300);

    for (const row of section.rows) {

      if (row.layout === 'frame') {
        // --- frame layout: freeLayout Frame + 절대좌표 배치 ---
        const CANVAS_W  = 860;
        const totalFlex = row.cols.reduce((s, c) => s + (c.flex || 1), 0);
        const frameH    = row.frameHeight || 400;

        // 1. 외부 freeLayout frame 생성 (height는 블록 추가 후 최종 설정)
        await ev(`window._activeFrame = null`);
        await ev(`window.addFrameBlock({})`);
        await ev(`(function(){
          const f = window._activeFrame;
          if (!f) return;
          f.style.width    = '${CANVAS_W}px';
          f.style.margin   = '0 auto';
          f.dataset.freeLayout = 'true';
          f.style.position = 'relative';
          f.style.overflow = 'hidden';
          ${row.bg ? `f.style.backgroundColor = '${row.bg}'; f.dataset.bg = '${row.bg}';` : ''}
          ${row.radius !== undefined ? `f.style.borderRadius = '${row.radius}px'; f.dataset.radius = '${row.radius}';` : ''}
        })()`);
        await delay(200);

        // 2. 각 col을 절대 x 위치에서 블록 추가 (paddingX 반영)
        const padX     = row.paddingX || 0;
        const contentW = CANVAS_W - padX * 2;
        let xOffset = padX;
        for (const col of row.cols) {
          const colFlex = col.flex || 1;
          const colW    = Math.round(contentW * colFlex / totalFlex);
          const colX    = xOffset;
          xOffset += colW;

          let colY = 0;
          for (const block of col.blocks) {
            const actualH = await buildBlockInFrame(block, colX, colY, colW);
            colY += actualH;
          }
        }

        // 3. 블록 추가 완료 후 frameHeight 고정 (addFrameBlock default 520px 덮어쓰기)
        await ev(`(function(){
          const f = window._activeFrame;
          if (!f) return;
          f.style.height    = '${frameH}px';
          f.style.minHeight = '${frameH}px';
          f.dataset.height  = '${frameH}';
        })()`);

        await ev(`window.deactivateFrame()`);
        await delay(100);

      } else if (row.layout === 'sub-section') {
        // --- sub-section layout: fullWidth frame (이중 배경용) ---
        const ssBg = row.bg || 'transparent';
        const ssRadius = row.radius !== undefined ? row.radius : undefined;
        await ev(`window.addFrameBlock({ fullWidth: true, bg: '${ssBg}'${ssRadius !== undefined ? `, radius: ${ssRadius}` : ''} })`);
        await delay(300);
        for (const block of (row.cols?.[0]?.blocks || [])) {
          await buildBlock(block);
        }
        await ev(`window.deactivateFrame()`);
        await delay(100);

      } else if (row.layout === 'flex' && row.cols.length > 1) {
        // --- flex layout: 각 col을 순서대로 블록 추가 ---
        for (const col of row.cols) {
          for (const block of (col.blocks || [])) {
            await buildBlock(block);
          }
        }
      } else {
        // --- stack layout: 블록 직접 추가 ---
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
