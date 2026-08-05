#!/usr/bin/env node
/* GAP-006 CSP 코드모드: 인라인 <script> 외부화 + on* 핸들러 → addEventListener.
   strict CSP(script-src 'self')에서 앱 자체 코드가 깨지지 않게 변환.
   재실행 가능(이미 변환된 파일은 on* 핸들러가 없어 no-op). */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// 페이지별: [html경로, 외부파일 디렉터리 기준(상대 prefix)]
const PAGES = [
  { html: 'index.html',          rel: '' },
  { html: 'pages/projects.html', rel: '../' },
  { html: 'pages/license.html',  rel: '../' },
  { html: 'pages/planning.html', rel: '../' },
];

const EVENTS = ['click','change','input','keydown','keyup','submit','load','error',
                'mouseover','mousedown','mouseup','dblclick','focus','blur','contextmenu','wheel'];
// 이벤트 → 고유 data 속성명(한 엘리먼트에 복수 이벤트 공존 가능하게 분리)
const ATTR = e => 'data-csp-' + e;

const decodeEntities = s => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'");

let GID = 0; // 전역 고유 id

function processFile({ html, rel }) {
  const file = path.join(ROOT, html);
  let src = fs.readFileSync(file, 'utf8');
  const base = path.basename(html, '.html');
  const outDir = path.join(ROOT, 'js', 'csp');
  fs.mkdirSync(outDir, { recursive: true });

  // ── 1) 인라인 <script>(src 없는) 외부화 ──
  let inlineN = 0;
  const inlineFiles = [];
  src = src.replace(/<script(\b[^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs, body) => {
    if (/\bsrc\s*=/.test(attrs)) return m;            // 외부 스크립트는 그대로
    if (!body.trim()) return m;                        // 빈 스크립트 스킵
    inlineN++;
    const fn = `${base}-inline-${inlineN}.js`;
    fs.writeFileSync(path.join(outDir, fn), body.replace(/^\n/, ''));
    inlineFiles.push(fn);
    const typeAttr = /type\s*=\s*["']module["']/i.test(attrs) ? ' type="module"' : '';
    return `<script${typeAttr} src="${rel}js/csp/${fn}"></script>`;
  });

  // ── 2) on* 핸들러 추출 → data 속성 + 바인딩 레코드 ──
  const records = [];
  const evtAlt = EVENTS.join('|');
  // 큰/작은따옴표 양쪽 지원: on<evt>="..."  또는  on<evt>='...'
  const reD = new RegExp(`\\son(${evtAlt})\\s*=\\s*"([^"]*)"`, 'gi');
  const reS = new RegExp(`\\son(${evtAlt})\\s*=\\s*'([^']*)'`, 'gi');
  const repl = (full, evt, codeRaw) => {
    const id = ++GID;
    const code = decodeEntities(codeRaw).trim();
    records.push({ id, event: evt.toLowerCase(), code });
    return ` ${ATTR(evt.toLowerCase())}="${id}"`;
  };
  src = src.replace(reD, repl).replace(reS, repl);

  // ── 3) 핸들러 바인딩 외부 파일 생성 ──
  let handlerFile = null;
  if (records.length) {
    handlerFile = `${base}-handlers.js`;
    const lines = records.map(r =>
      `  bind('${ATTR(r.event)}', ${r.id}, '${r.event}', function(event){ ${r.code} });`
    );
    const js = `/* GAP-006 자동생성: ${html}의 인라인 on* 핸들러 → addEventListener.
   원본 핸들러 코드를 그대로 함수 본문으로 이관(this=엘리먼트, event 전달). 수정 시 scripts/csp-mod.cjs 재실행. */
(function () {
  function bind(attr, id, type, fn) {
    var el = document.querySelector('[' + attr + '="' + id + '"]');
    if (el) el.addEventListener(type, fn);
  }
  function init() {
${lines.join('\n')}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
`;
    fs.writeFileSync(path.join(outDir, handlerFile), js);
    // 핸들러 바인딩 파일을 </body> 직전에 로드(모든 글로벌 함수 정의 이후, 클릭 시점 resolve)
    const tag = `<script src="${rel}js/csp/${handlerFile}"></script>\n</body>`;
    src = src.replace(/<\/body>/i, tag);
  }

  fs.writeFileSync(file, src);
  return { html, inlineN, handlers: records.length, handlerFile, inlineFiles };
}

const results = PAGES.map(processFile);
console.log(JSON.stringify(results, null, 2));
console.log('총 핸들러 변환:', results.reduce((s, r) => s + r.handlers, 0));
