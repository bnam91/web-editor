#!/usr/bin/env node
// memo-analyzer.mjs
// Scans every .section-block's dataset.memo via CDP, classifies system issues
// against a fixed pattern table, and writes a markdown backlog grouped by category.
//
// Usage:
//   node scripts/memo-analyzer.mjs                     # scan + write SECTION_BACKLOG.md
//   node scripts/memo-analyzer.mjs --port=9335         # target a different CDP port
//   node scripts/memo-analyzer.mjs --out=PATH.md       # custom output path
//   node scripts/memo-analyzer.mjs --inject            # only expose window.runMemoAnalyzer()
//   node scripts/memo-analyzer.mjs --title=Goya        # match a specific page title/url
//
// Requires: ws (already in package.json)

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

// ---------- CLI args ----------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    if (!a.startsWith('--')) return [a, true];
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.length ? rest.join('=') : true];
  })
);

const PORT = String(args.port || 9334);
const FALLBACK_PORT = String(args.fallback || 9335);
const OUT_PATH = path.resolve(REPO_ROOT, String(args.out || 'SECTION_BACKLOG.md'));
const TITLE_HINT = String(args.title || 'Goya');
const INJECT_ONLY = !!args.inject;

// ---------- Pattern table ----------
// Each pattern is matched against memo text (case-sensitive, multi-line).
// A single memo may match multiple patterns — each yields its own row.
const PATTERNS = [
  {
    id: 'system:api-missing',
    priority: 'high',
    label: '시스템 API/제어 인터페이스 누락',
    // "X로 제어 가능?" / "X >> mcp로" / "mcp로 ~"
    re: /(제어\s*가능)|(>>\s*mcp)|(mcp\s*로)/i,
  },
  {
    id: 'system:protection-needed',
    priority: 'high',
    label: '보호/잠금 필요 (실수 삭제 방지)',
    re: /삭제\s*하지\s*말\s*것|삭제금지|지우지\s*마/i,
  },
  {
    id: 'system:explicit-fix',
    priority: 'high',
    label: '명시적 FIX 요청',
    re: /FIX[-_\s]?NEEDED/i,
  },
  {
    id: 'system:ui-unclear',
    priority: 'medium',
    label: 'UI 불명확/이유 모호',
    // "왜 X인지 모르겠음", "왜 ~ 됨?", "왜 이러지"
    re: /왜\s+.{0,40}(모르겠|모름|이러|되는지|되지|이지)/,
  },
  {
    id: 'system:automation-missing',
    priority: 'medium',
    label: '자동화 누락 (수동 작업)',
    // "X 자동으로 됐으면", "자동으로 되게", "자동화 했으면"
    re: /자동(으로|화).{0,20}(됐|되|했|하면)/,
  },
  {
    id: 'system:discoverability',
    priority: 'medium',
    label: '발견성/이스터에그/참고자료',
    re: /이스(트|터)에그|참고\s*하기/,
  },
  {
    id: 'content:fill',
    priority: 'medium',
    label: '콘텐츠 미작성/플레이스홀더',
    re: /placeholder|미작성/i,
  },
  {
    id: 'content:cleanup',
    priority: 'low',
    label: '잔재/템플릿 정리 필요',
    re: /(템플릿\s*잔재)|(\S+\s*잔재)/,
  },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// ---------- Browser-side scan source ----------
// Returns a JSON-serializable array of section memos.
// Also exposes window.runMemoAnalyzer() that returns the same shape.
const SCAN_SOURCE = `
  (() => {
    const collect = () => {
      const blocks = Array.from(document.querySelectorAll('.section-block'));
      return blocks.map((el, idx) => {
        const memo = (el.dataset && typeof el.dataset.memo === 'string') ? el.dataset.memo : '';
        return {
          sectionId: el.dataset.sectionId || el.id || ('idx-' + idx),
          idx,
          memo,
        };
      }).filter(r => r.memo && r.memo.trim().length > 0);
    };
    try {
      window.runMemoAnalyzer = collect;
    } catch (_) { /* no-op */ }
    return collect();
  })()
`;

// ---------- Helpers ----------
function escapePipe(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function singleLine(s, max = 80) {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

function classify(records) {
  const rows = [];
  for (const rec of records) {
    for (const p of PATTERNS) {
      // Reset lastIndex defensively (we don't use /g, but be safe)
      if (p.re instanceof RegExp && p.re.test(rec.memo)) {
        rows.push({
          category: p.id,
          priority: p.priority,
          label: p.label,
          sectionId: rec.sectionId,
          idx: rec.idx,
          memo: rec.memo,
          pattern: p.re.toString(),
        });
      }
    }
  }
  return rows;
}

function renderMarkdown(rows, meta) {
  const lines = [];
  lines.push('# Section Backlog (auto-generated)');
  lines.push('');
  lines.push(`Generated: ${meta.generatedAt}`);
  lines.push(`Source: data-memo @ CDP :${meta.port} (page: ${meta.pageTitle || '?'})`);
  lines.push(`Sections scanned: ${meta.totalSections} · with-memo: ${meta.withMemo} · matched rows: ${rows.length}`);
  lines.push('');

  // Summary table
  const byCat = new Map();
  for (const r of rows) {
    if (!byCat.has(r.category)) byCat.set(r.category, []);
    byCat.get(r.category).push(r);
  }

  const sortedCats = [...byCat.keys()].sort((a, b) => {
    const ra = byCat.get(a)[0];
    const rb = byCat.get(b)[0];
    const pd = PRIORITY_ORDER[ra.priority] - PRIORITY_ORDER[rb.priority];
    if (pd !== 0) return pd;
    return a.localeCompare(b);
  });

  lines.push('## Summary');
  lines.push('');
  lines.push('| category | priority | count |');
  lines.push('|---|---|---|');
  for (const cat of sortedCats) {
    const list = byCat.get(cat);
    lines.push(`| ${escapePipe(cat)} | ${list[0].priority} | ${list.length} |`);
  }
  if (sortedCats.length === 0) {
    lines.push('| _(no matches)_ | - | 0 |');
  }
  lines.push('');

  // Per-category groups
  for (const cat of sortedCats) {
    const list = byCat.get(cat);
    const head = list[0];
    lines.push(`## ${cat} — ${head.label} (${head.priority}) · ${list.length}건`);
    lines.push('');
    lines.push('| sectionId | idx | memo (excerpt) | matched pattern |');
    lines.push('|---|---|---|---|');
    for (const r of list) {
      lines.push(
        `| ${escapePipe(r.sectionId)} | ${r.idx} | ${escapePipe(singleLine(r.memo))} | ${escapePipe(r.pattern)} |`
      );
    }
    lines.push('');
  }

  if (rows.length === 0) {
    lines.push('_No matching memos found. Try authoring patterns in PATTERNS table or run again after annotating sections._');
    lines.push('');
  }

  return lines.join('\n');
}

// ---------- CDP plumbing ----------
async function pickTarget(port, titleHint) {
  const res = await fetch(`http://localhost:${port}/json`);
  const pages = await res.json();
  const target =
    pages.find((p) => p.type === 'page' && titleHint && (p.title?.includes(titleHint) || p.url?.includes(titleHint))) ||
    pages.find((p) => p.type === 'page');
  return target;
}

async function connect(port, titleHint) {
  let target = null;
  let chosenPort = port;
  try {
    target = await pickTarget(port, titleHint);
  } catch (e) {
    target = null;
  }
  if (!target && FALLBACK_PORT && FALLBACK_PORT !== port) {
    try {
      target = await pickTarget(FALLBACK_PORT, titleHint);
      if (target) chosenPort = FALLBACK_PORT;
    } catch (_) {}
  }
  if (!target) {
    throw new Error(`No CDP page target found on :${port} (fallback :${FALLBACK_PORT}). Is the editor running?`);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });

  let id = 0;
  const pending = new Map();
  ws.on('message', (msg) => {
    let d;
    try { d = JSON.parse(msg.toString()); } catch { return; }
    if (d.id && pending.has(d.id)) {
      const { resolve, reject } = pending.get(d.id);
      pending.delete(d.id);
      d.error ? reject(d.error) : resolve(d.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });

  return { ws, send, target, port: chosenPort };
}

async function evalInPage(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text || 'Runtime.evaluate failed';
    const desc = result.exceptionDetails.exception?.description || '';
    throw new Error(`${text}\n${desc}`);
  }
  return result.result?.value;
}

// ---------- Main ----------
async function main() {
  const conn = await connect(PORT, TITLE_HINT);
  const { send, target, port: chosenPort } = conn;
  try {
    // Always inject the helper + scan in one shot.
    const records = await evalInPage(send, SCAN_SOURCE);
    if (INJECT_ONLY) {
      console.log(JSON.stringify({
        ok: true,
        injected: true,
        windowFn: 'runMemoAnalyzer',
        port: chosenPort,
        pageTitle: target.title,
        sampleCount: Array.isArray(records) ? records.length : 0,
      }, null, 2));
      return;
    }

    if (!Array.isArray(records)) {
      throw new Error('Scan did not return an array — got: ' + typeof records);
    }

    // Total sections (including empty-memo ones) — separate quick eval for stats
    const totalSections = await evalInPage(
      send,
      `document.querySelectorAll('.section-block').length`
    );

    const rows = classify(records);
    const md = renderMarkdown(rows, {
      generatedAt: new Date().toISOString(),
      port: chosenPort,
      pageTitle: target.title,
      totalSections,
      withMemo: records.length,
    });

    fs.writeFileSync(OUT_PATH, md, 'utf8');

    console.log(JSON.stringify({
      ok: true,
      out: OUT_PATH,
      port: chosenPort,
      pageTitle: target.title,
      totalSections,
      withMemo: records.length,
      matchedRows: rows.length,
      categories: [...new Set(rows.map((r) => r.category))],
    }, null, 2));
  } finally {
    conn.ws.close();
  }
}

main().catch((e) => {
  console.error('memo-analyzer error:', e.message || e);
  process.exit(1);
});
