/* check-t173.mjs — 그리드의 «저장 뒤»와 «내보낸 그림» 축을 «실앱»에서 잰다 (T-173).
 *
 * tests/dom/grid-save-export-axes.dom.spec.js 가 «앱 없이» 같은 두 축을 자동으로 잰다.
 * 이 파일이 재는 것은 그 그물이 «구조적으로 못 보는» 것들이다:
 *   ㉠ 진짜 저장 길 — window.saveProject() → saveProjectToFile → «이미지 외부화»
 *      (goya-asset:// 로 바뀐다. commit-system 의 saveProjectFile 직통 IPC 는 이 구간을 «안» 지난다)
 *   ㉡ 진짜 다시 열기 — location.reload. ★그리고 «파일»에서 여는 갈래를 따로 잰다:
 *      localStorage 사본이 파일보다 새로우면 앱은 «파일을 안 읽는다»(save-load.js initLoad).
 *      그래서 LS 를 치우고 한 번 더 연다 — 안 그러면 외부화된 저장본을 한 번도 안 지난다.
 *   ㉢ 진짜 내보내기 — window.exportSection(sec,'png',860,{returnDataUrl:true}) = CDP 네이티브 캡처.
 *      (저장창을 안 연다 — export-image.js 가 「QA·외부검산이 쓰는 길」로 적어 둔 그 길이다)
 *   ㉣ 안내문 「줄이면 잘린다 — ⌘Z 복원」이 «지키는 약속»인가 — 저장 «뒤»에도 되는가.
 *
 * ★재는 «양» — 화면은 «계산된 값 전수», 그림은 «픽셀». 「표식이 붙었나」로 재지 않는다.
 * ⚠️색은 «정확일치»로 세지 않는다 — 내보내기가 한두 눈금 움직여 돌려준다
 *   (실측 2026-09-24: #108010→#0f8010 · #208060→#228060 · #ff3366→#ff3266).
 *   정확일치로 세면 «멀쩡한 것»이 0 으로 나와 결함처럼 보인다. 첫 판에서 실제로 그랬다.
 *
 * 실행: node tests/e2e/check-t173.mjs [port]      (저장소 뿌리에서)
 *   ★앱은 미리 «격리 프로필»로 그 포트에 띄워 두어야 한다(이 검사는 앱을 안 띄운다):
 *     GODITOR_MCP_PORT=<9345~9365 밖> npx electron . --remote-debugging-port=<port> \
 *       --remote-allow-origins='*' --user-data-dir=<격리폴더> admin
 *   ★띄운 뒤 <격리폴더>/projects 가 생기는지 확인해라 — 그게 «내 프로필을 쓰고 있다»의 증거다.
 */
import { connect } from './lib/cdp.mjs';
import { freshProject } from './lib/board.mjs';
import { addSection, insertFromMenu, clickEmptyCanvas, clickBlock } from './lib/ui.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 9371);
const TOL = 4;
const R = { card: 'T-173', port: PORT, checks: [] };
const add = (id, quantity, measured, pass, note) => R.checks.push({ id, quantity, measured, pass, note });

const C = {
  cell00: '#101080', cell01: '#108010', cell02: '#801010', cell03: '#808010',
  cell10: '#108080', cell11: '#801080', cell12: '#404080', cell13: '#408040',
  cell20: '#804040', cell21: '#208060', cell22: '#602080', cell23: '#806020',
  badge: '#ff3366', graphBar: '#00c2a8', graphTrack: '#ffd400',
  img: '#0044ff', duoTxt: '#7700cc',
};

/* ── 페이지 안에 심는 «화면 재는 자» ─────────────────────────────────── */
const INSTALL = `
window.__t173screen = (block) => {
  if (!block) return { GONE: '1' };
  const out = {};
  const cells = block.querySelectorAll('.grd-cell');
  out['cells.n'] = String(cells.length);
  for (const el of cells) {
    const t = 'c' + el.dataset.r + el.dataset.c, cs = getComputedStyle(el);
    out[t+'.bg']=cs.backgroundColor; out[t+'.pad']=cs.paddingTop+'/'+cs.paddingLeft;
    out[t+'.radius']=cs.borderTopLeftRadius; out[t+'.justify']=cs.justifyContent;
    out[t+'.text']=(el.innerText||'').trim();
    out[t+'.empty']=el.classList.contains('grd-cell-empty')?'1':'0';
    const kids = el.querySelectorAll(':scope > *');
    out[t+'.lines.n']=String(kids.length);
    kids.forEach((ln,i)=>{
      const k=t+'.L'+i, ls=getComputedStyle(ln);
      out[k+'.tag']=ln.tagName; out[k+'.cls']=ln.className||'(none)';
      out[k+'.align']=ls.textAlign; out[k+'.size']=ls.fontSize; out[k+'.weight']=ls.fontWeight;
      out[k+'.color']=ls.color; out[k+'.mt']=ls.marginTop;
      out[k+'.h']=String(Math.round(ln.getBoundingClientRect().height));
      out[k+'.text']=(ln.innerText||'').trim();
      if (ln.tagName==='IMG') {
        /* ⛔src 를 «글자 그대로» 견주지 않는다 — 저장이 base64 를 goya-asset:// 로 바꾸는 것은
           «의도된 외부화»다. 그림이 «실제로 디코드됐나»(naturalWidth)로 재야 축이 맞다. */
        out[k+'.img.natural']=ln.naturalWidth+'x'+ln.naturalHeight;
        out[k+'.img.complete']=String(ln.complete);
        out[k+'.objfit']=ls.objectFit; out[k+'.radius']=ls.borderTopLeftRadius;
        out[k+'.w']=String(Math.round(ln.getBoundingClientRect().width));
      }
      const badge = ln.querySelector(':scope > .grd-badge');
      if (badge) { const bs=getComputedStyle(badge);
        out[k+'.badge.bg']=bs.backgroundColor; out[k+'.badge.pad']=bs.paddingTop+'/'+bs.paddingLeft;
        out[k+'.badge.radius']=bs.borderTopLeftRadius; out[k+'.badge.text']=(badge.innerText||'').trim(); }
      if (ln.classList.contains('grd-nested')) {
        const nc = ln.querySelectorAll(':scope > .grd-nested-col');
        out[k+'.nested.n']=String(nc.length); out[k+'.nested.gap']=ls.columnGap;
        nc.forEach((n,j)=>{ const s2=getComputedStyle(n);
          out[k+'.nested'+j+'.flex']=s2.flexGrow; out[k+'.nested'+j+'.justify']=s2.justifyContent;
          out[k+'.nested'+j+'.text']=(n.innerText||'').trim();
          const f=n.querySelector(':scope > *'); out[k+'.nested'+j+'.color']=f?getComputedStyle(f).color:'(none)'; });
      }
      if (ln.classList.contains('grd-graph')) {
        const it = ln.querySelectorAll(':scope > .grd-graph-item');
        out[k+'.graph.n']=String(it.length);
        it.forEach((g,j)=>{ const tr=g.querySelector(':scope > div:nth-child(2)'), br=tr?tr.querySelector(':scope > div'):null;
          out[k+'.graph'+j+'.text']=(g.innerText||'').trim().replace(/\\s+/g,' ');
          out[k+'.graph'+j+'.track']=tr?getComputedStyle(tr).backgroundColor:'(none)';
          out[k+'.graph'+j+'.bar']=br?getComputedStyle(br).backgroundColor:'(none)';
          out[k+'.graph'+j+'.barw']=br?String(Math.round(br.getBoundingClientRect().width)):'(none)'; });
      }
      if (ln.classList.contains('grd-gap')) out[k+'.gap.h']=ls.height;
    });
  }
  const inner = block.querySelector('.grd-inner');
  if (inner) { const ics=getComputedStyle(inner);
    out['inner.cols']=ics.gridTemplateColumns; out['inner.rows']=ics.gridTemplateRows;
    out['inner.rowGap']=ics.rowGap; out['inner.colGap']=ics.columnGap; }
  else out['inner.MISSING']='1';
  return out;
};
window.__t173diff = (a,b) => {
  const keys=[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].sort(); const d={};
  for (const k of keys) if ((a||{})[k]!==(b||{})[k]) d[k]=String((a||{})[k])+' → '+String((b||{})[k]);
  return d;
};`;

const s = await connect(PORT, '');
const installMeasure = () => s.eval(INSTALL + '\nreturn 1;');

/* ══ 판 ══════════════════════════════════════════════════════════════ */
await freshProject(s);
await s.sleep(1500);
await addSection(s);
await insertFromMenu(s, '컴포넌트 블록 추가', 'Grid');
await s.sleep(600);
const ids = await s.eval(`
  const g = document.querySelector('.grid-block');
  return g ? { grid: g.id, sec: g.closest('.section-block').id } : null;`);
if (!ids) { console.log(JSON.stringify({ ...R, fatal: 'Grid 블럭이 안 들어갔다' }, null, 2)); s.close(); process.exit(1); }

const built = await s.eval(`
  const C = ${JSON.stringify(C)};
  const _c = document.createElement('canvas'); _c.width = 160; _c.height = 120;
  const _x = _c.getContext('2d'); _x.fillStyle = C.img; _x.fillRect(0,0,160,120);
  /* ★외부화(goya-asset://)가 «실제로» 걸리게 압축 안 되는 잡음을 구석에만 섞는다 —
     색 세기는 왼쪽 위 단색 구역으로 한다. */
  const _im = _x.getImageData(120, 90, 40, 30);
  for (let i=0;i<_im.data.length;i+=4){ _im.data[i]=(i*37)%256; _im.data[i+1]=(i*91)%256; _im.data[i+2]=(i*13)%256; _im.data[i+3]=255; }
  _x.putImageData(_im, 120, 90);
  const IMGSRC = _c.toDataURL('image/png');
  const cells = [
    [ { bg:C.cell00, padding:12, radius:8,  align:'left',
        lines:[{type:'label',text:'L0'},{type:'h1',text:'H1'}] },
      { bg:C.cell01, padding:16, radius:14, align:'center', valign:'middle',
        lines:[{type:'h2',text:'H2'},{type:'h3',text:'H3'}] },
      { bg:C.cell02, padding:8,  radius:0,  align:'right', valign:'bottom',
        lines:[{type:'body',text:'BODY'},{type:'caption',text:'CAP'}] },
      { bg:C.cell03, padding:20, radius:24, align:'center',
        lines:[{type:'body',text:'BADGE',bg:C.badge,padV:10,padH:18,radius:6}] } ],
    [ { bg:C.cell10, padding:10, radius:6,
        lines:[{type:'image',imgSrc:IMGSRC,height:60,radius:4,widthPct:80,align:'center'}] },
      { bg:C.cell11, padding:10, radius:6,
        lines:[{type:'gap',height:30},{type:'body',text:'AFTERGAP'}] },
      { bg:C.cell12, padding:10, radius:6,
        lines:[{type:'duo',gap:12,valign:'middle',cols:[
          {width:1,lines:[{type:'body',text:'N-A',color:C.duoTxt}]},
          {width:2,lines:[{type:'caption',text:'N-B'}]}]}] },
      { bg:C.cell13, padding:10, radius:6,
        lines:[{type:'graph',barColor:C.graphBar,trackColor:C.graphTrack,
                items:[{label:'G1',value:70},{label:'G2',value:40}]}] } ],
    [ { bg:C.cell20, padding:4,  radius:2,  align:'left',   valign:'top',    lines:[{type:'body',text:'A-L'}] },
      { bg:C.cell21, padding:28, radius:30, align:'center', valign:'middle', lines:[{type:'body',text:'A-C'}] },
      { bg:C.cell22, padding:0,  radius:0,  align:'right',  valign:'bottom', lines:[{type:'body',text:'A-R',marginTop:9}] },
      { bg:C.cell23, padding:6,  radius:10, lines:[] } ],
  ];
  const ID = ${JSON.stringify(ids.grid)};
  const ops = [
    window.updateGridBlock(ID, { cols: [{width:1},{width:1},{width:1},{width:1}] }),
    /* ★행 높이는 'auto' «와» px 를 섞는다 — px 최소높이(minmax)도 저장 포맷의 한 칸이다. */
    window.updateGridBlock(ID, { rows: [{height:'auto'},{height:200},{height:'auto'}] }),
    window.updateGridBlock(ID, { rowGap: 14, colGap: 18 }),
    window.updateGridBlock(ID, { cells }),
  ].map(r => ({ ok: !!(r && r.ok), code: r && r.code, message: r && r.message }));
  return { ops, imgLen: IMGSRC.length };`);
if (!built.ops.every(o => o.ok)) {
  console.log(JSON.stringify({ ...R, fatal: '판 깔기 실패', built }, null, 2)); s.close(); process.exit(1);
}
await installMeasure();
await clickEmptyCanvas(s);
await s.sleep(400);

/* ★계측기 — 판이 «서로 다른» 열두 칸을 만들었나. 안 그러면 아래 초록은 헛것이다. */
const before = await s.eval(`return window.__t173screen(document.getElementById(${JSON.stringify(ids.grid)}));`);
const tags = ['00','01','02','03','10','11','12','13','20','21','22','23'];
const bgs = tags.map(t => before['c'+t+'.bg']);
add('T-173/instrument', '★계측기 — 열두 칸이 «서로 다른» 배경을 갖는가 + 잰 값 개수',
  { cellsN: before['cells.n'], distinctBg: new Set(bgs).size, keys: Object.keys(before).length, imgLen: built.imgLen },
  before['cells.n'] === '12' && new Set(bgs).size === 12 && Object.keys(before).length > 200,
  `칸 ${before['cells.n']}개 · 서로 다른 배경 ${new Set(bgs).size} · 잰 값 ${Object.keys(before).length}개`);

/* ══ 내보낸 그림의 «픽셀» ═══════════════════════════════════════════════ */
const countPx = (secId) => s.eval(`
  const sec = document.getElementById(${JSON.stringify(secId)});
  if (!sec) return { error: 'section 없음' };
  const url = await window.exportSection(sec, 'png', 860, { returnDataUrl: true });
  if (!url || !String(url).startsWith('data:image')) return { error: '내보내기가 그림을 안 돌려줬다: ' + String(url).slice(0,60) };
  const img = new Image(); img.src = url; await img.decode();
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0,0,cv.width,cv.height).data;
  const want = ${JSON.stringify(C)}, TOL = ${TOL};
  const hex = h => [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const keys = Object.keys(want), tgt = keys.map(k=>hex(want[k]));
  const clash = [];
  for (let a=0;a<tgt.length;a++) for (let b=a+1;b<tgt.length;b++) {
    const dist = Math.max(Math.abs(tgt[a][0]-tgt[b][0]),Math.abs(tgt[a][1]-tgt[b][1]),Math.abs(tgt[a][2]-tgt[b][2]));
    if (dist <= 2*TOL) clash.push(keys[a]+'~'+keys[b]+'('+dist+')');
  }
  const n = {}; keys.forEach(k=>n[k]=0); let nonwhite = 0;
  for (let i=0;i<d.length;i+=4) {
    const r=d[i],g=d[i+1],b=d[i+2];
    if (!(r>250&&g>250&&b>250)) nonwhite++;
    for (let j=0;j<tgt.length;j++) if (Math.abs(r-tgt[j][0])<=TOL&&Math.abs(g-tgt[j][1])<=TOL&&Math.abs(b-tgt[j][2])<=TOL) { n[keys[j]]++; break; }
  }
  return { w: img.width, h: img.height, nonwhite, clash, px: n };`);

const pxBefore = await countPx(ids.sec);
const MIN = { img: 500, badge: 300, graphBar: 200, graphTrack: 200, duoTxt: 20 };
const missingCells = pxBefore.error ? null : tags.filter(t => pxBefore.px['cell'+t] < 200);
const missingParts = pxBefore.error ? null : Object.keys(MIN).filter(k => pxBefore.px[k] < MIN[k]);
add('T-173/export-has-everything',
  '㉢ 내보낸 그림에 «칸 배경 12 ＋ 그림·뱃지·그래프 막대/트랙·중첩 글자색»이 나오는가 (목표색 ±4 화소 수)',
  pxBefore,
  !pxBefore.error && (pxBefore.clash || []).length === 0 && missingCells.length === 0 && missingParts.length === 0,
  pxBefore.error || `${pxBefore.w}×${pxBefore.h} · 빠진 칸 ${JSON.stringify(missingCells)} · 빠진 부품 ${JSON.stringify(missingParts)}`);

/* ══ ㉠㉡ 저장 → 다시 열기 ════════════════════════════════════════════ */
const dsOf = () => s.eval(`
  const g = document.getElementById(${JSON.stringify(ids.grid)});
  if (!g) return null;
  return { cols: g.dataset.cols, rows: g.dataset.rows, cells: g.dataset.cells,
           gap: g.dataset.gap, rowGap: g.dataset.rowGap, colGap: g.dataset.colGap };`);
const saveNow = () => s.eval(`
  const done = new Promise(res => window.addEventListener('gd:project-saved', () => res('event'), { once: true }));
  await window.saveProject();
  return await Promise.race([done, new Promise(r => setTimeout(() => r('timeout'), 20000))]);`);

const dsBefore = await dsOf();
const saveSignal = await saveNow();
await s.sleep(1500);
await s.send('Page.reload', { ignoreCache: false });
await s.sleep(8000);
await s.wake();
await installMeasure();
const afterLS = await s.eval(`return window.__t173screen(document.getElementById(${JSON.stringify(ids.grid)}));`);
const diffLS = await s.eval(`return window.__t173diff(${JSON.stringify(before)}, ${JSON.stringify(afterLS)});`);
add('T-173/save-reopen',
  '㉡ 저장 → 다시 열기 — 화면 전수(계산된 값)가 그대로인가',
  { saveSignal, keys: Object.keys(before).length, diff: diffLS },
  saveSignal === 'event' && Object.keys(diffLS).length === 0,
  `저장 신호=${saveSignal} · 잰 값 ${Object.keys(before).length}개 중 달라진 것 ${Object.keys(diffLS).length}개`);

/* ★여기서 «한 겹 더» — 위 reload 는 localStorage 를 읽었을 수 있다(파일보다 새로우면 LS 가 이긴다).
   LS 를 치우고 한 번 더 열어야 «저장 파일»(외부화된 판)을 진짜로 지난다. */
const cleared = await s.eval(`
  const id = window.activeProjectId;
  const keys = Object.keys(localStorage).filter(k => k.includes(id));
  keys.forEach(k => localStorage.removeItem(k));
  return keys;`);
await s.send('Page.reload', { ignoreCache: false });
await s.sleep(8000);
await s.wake();
await installMeasure();
const afterFile = await s.eval(`return window.__t173screen(document.getElementById(${JSON.stringify(ids.grid)}));`);
const diffFile = await s.eval(`return window.__t173diff(${JSON.stringify(before)}, ${JSON.stringify(afterFile)});`);
const dsAfter = await dsOf();
const pxAfter = await countPx(ids.sec);
const missingCells2 = pxAfter.error ? null : tags.filter(t => pxAfter.px['cell'+t] < 200);
const missingParts2 = pxAfter.error ? null : Object.keys(MIN).filter(k => pxAfter.px[k] < MIN[k]);
add('T-173/save-reopen-from-file',
  '㉠㉡ «저장 파일»에서 다시 열기(LS 치움) — 화면 전수가 그대로인가',
  { clearedKeys: cleared, diff: diffFile,
    imgSrcKind: { before: /goya-asset:/.test(String(dsBefore && dsBefore.cells)) ? 'goya-asset' : 'base64',
                  after: /goya-asset:/.test(String(dsAfter && dsAfter.cells)) ? 'goya-asset' : 'base64' } },
  Object.keys(diffFile).length === 0,
  `달라진 것 ${Object.keys(diffFile).length}개 — ${JSON.stringify(diffFile).slice(0, 300)}`);
add('T-173/export-after-file-reopen',
  '㉢ «저장 파일»에서 연 뒤 내보낸 그림에도 전부 나오는가',
  pxAfter,
  !pxAfter.error && missingCells2.length === 0 && missingParts2.length === 0,
  pxAfter.error || `${pxAfter.w}×${pxAfter.h} · 빠진 칸 ${JSON.stringify(missingCells2)} · 빠진 부품 ${JSON.stringify(missingParts2)}`);

/* ══ ㉣ 「줄이면 잘린다 — ⌘Z 복원」이 지키는 약속인가 ═══════════════════
   ★«진짜 피커»를 누른다 — updateGridBlock({cols:[…]}) 로 줄이면 열 배열을 통째로 갈아치우는
     것이라 행 0 줄까지 같이 날아간다. 그건 API 의 성질이지 사용자가 겪는 길이 아니다. */
await freshProject(s);
await s.sleep(1500);
await addSection(s);
await insertFromMenu(s, '컴포넌트 블록 추가', 'Grid');
await s.sleep(600);
const ids2 = await s.eval(`const g=document.querySelector('.grid-block');return {grid:g.id, sec:g.closest('.section-block').id};`);

async function pick(r, c) {
  await clickBlock(s, ids2.grid);
  await s.sleep(500);
  const p = await s.eval(`
    const cell = document.querySelector('#grd-grid-picker .grid-picker-cell[data-r="${r}"][data-c="${c}"]');
    if (!cell) return { err: '피커 칸 없음' };
    if (cell.classList.contains('grid-picker-cell--off')) return { err: '죽은 칸' };
    const b = cell.getBoundingClientRect();
    const x = Math.round(b.x + b.width/2), y = Math.round(b.y + b.height/2);
    /* ⛔좌표를 «같은 호출 안»에서 읽고 확인한다 — 그 자리에 정말 그 칸이 있나 */
    return { x, y, same: document.elementFromPoint(x,y) === cell };`);
  if (p.err || !p.same) throw new Error('피커 조준 실패 ' + JSON.stringify(p));
  await s.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: 'none', buttons: 0 });
  await s.sleep(120);
  await s.click(p.x, p.y);
  await s.sleep(600);
  return p;
}
const marks = () => s.eval(`
  const g=document.getElementById(${JSON.stringify(ids2.grid)});
  if(!g) return {GONE:true, n:0, t:'(블록 없음)'};
  return { n:g.querySelectorAll('.grd-cell').length,
           t:[...g.querySelectorAll('.grd-cell')].map(e=>(e.innerText||'').trim()).join('|') };`);

let undoResult;
try {
  await pick(3, 4);
  await s.eval(`
    const ID=${JSON.stringify(ids2.grid)};
    const cells=[]; for(let r=0;r<3;r++){const row=[];for(let c=0;c<4;c++)row.push({lines:[{type:'body',text:'M'+r+c}]});cells.push(row);}
    return window.updateGridBlock(ID,{cells}).ok;`);
  await clickEmptyCanvas(s); await s.sleep(300);
  const t0 = await marks();

  await pick(2, 2);                       // ⑴ 줄인다
  const t1 = await marks();
  await clickEmptyCanvas(s); await s.sleep(250);
  await s.cmd('z'); await s.sleep(900);
  const t2 = await marks();

  await pick(1, 2);                       // ⑵ 다시 줄인다 → 저장 → ⌘Z
  const t3 = await marks();
  const sv1 = await saveNow(); await s.sleep(900);
  await clickEmptyCanvas(s); await s.sleep(250);
  await s.cmd('z'); await s.sleep(1100);
  const t4 = await marks();
  const sv2 = await saveNow(); await s.sleep(1000);
  await s.eval(`const id=window.activeProjectId;Object.keys(localStorage).filter(k=>k.includes(id)).forEach(k=>localStorage.removeItem(k));return 1;`);
  await s.send('Page.reload', { ignoreCache: false }); await s.sleep(8000); await s.wake();
  const t5 = await marks();

  undoResult = { t0, t1, t2, t3, t4, t5, sv1, sv2 };
  add('T-173/shrink-undo-works',
    '㉣⑴ 「줄이면 잘린다 — ⌘Z 복원」 — ⌘Z 한 번으로 «화면»이 줄이기 직전으로 돌아오는가',
    { before: t0, shrunk: t1, afterUndo: t2 },
    t1.n < t0.n && t2.n === t0.n && t2.t === t0.t,
    `${t0.n}칸 → (줄임)${t1.n}칸 → (⌘Z)${t2.n}칸 · 글자 복원=${t2.t === t0.t}`);
  add('T-173/shrink-undo-after-save',
    '㉣⑵ ★저장 «뒤»에도 ⌘Z 가 도는가 ＋ 되돌린 것이 저장 파일에 남는가',
    { shrunk: t3, afterUndoPostSave: t4, afterFileReopen: t5, saveSignals: [sv1, sv2] },
    t3.n < t2.n && t4.n === t2.n && t4.t === t2.t && t5.n === t2.n && t5.t === t2.t,
    `(줄임)${t3.n}칸 →저장→ (⌘Z)${t4.n}칸[복원=${t4.t === t2.t}] →저장→파일에서 다시 열기 ${t5.n}칸[남음=${t5.t === t2.t}]`);
} catch (e) {
  add('T-173/shrink-undo-works', '㉣ 줄이기→⌘Z', { error: e.message }, false, '못 쟀다: ' + e.message);
}

R.notGated = {
  oldFormatBeforeT178: '이 검사는 T-178 «이전» 저장본을 안 연다 — 현빈 「기본 저장본은 신경쓰지 마라」. '
    + '그 축의 실측은 보고서에 따로 적었다(행 1 내용 소실 · 행 2 이상은 한 칸 위로 · 행 1 꾸밈이 행 0 에 붙음).',
  htmlExport: '이 검사는 PNG 만 잰다 — HTML 내보내기·전체 섹션 내보내기·GIF 는 안 잰다.',
};
R.pass = R.checks.every(c => c.pass);
console.log(JSON.stringify(R, null, 2));
s.close();
process.exit(R.pass ? 0 : 1);
