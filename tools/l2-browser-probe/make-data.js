/* make-data.js — L2(changeDiff) 실브라우저 검증용 실데이터 추출. READ-ONLY.
 *
 * ★왜 브라우저가 필요한가: changeDiff 는 DOMParser 를 쓴다. node 엔 HTML 파서가 없고
 *   (jsdom/linkedom/parse5 전부 미설치) 미니 DOM 으로 대신하면 «내 미니 DOM»을 검증하는 셈이다.
 *   실 Chromium 파서 + 실 캔버스에서 돌려야 §6-2 가 경고한 «가짜 변경의 벽»이 안 나는지 알 수 있다.
 *
 * 3단계로 쓴다:
 *   1) node tools/l2-browser-probe/make-data.js          → 같은 폴더에 data.js 생성(실프로젝트 사본에서)
 *   2) "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
 *        --user-data-dir=<격리프로필> --allow-file-access-from-files --remote-debugging-port=9333 \
 *        "file://<repo>/tools/l2-browser-probe/probe.html"
 *   3) CDP 로 window.__RESULT 를 읽는다. problems 가 비면 통과.
 *   ⚠️ 끝나면 크롬 kill + 격리 프로필 삭제(내가 띄운 것만).
 *
 * ⛔라이브 userData 는 «읽기»만 한다 — 인덱스는 os.tmpdir() 사본에만 만든다.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const SS = require('../../main/project-store/snapshot-store');
const { mkTmpRoot } = require('../../tests/unit/_tmproot');

const LIVE = path.join(process.env.HOME, 'Library/Application Support/GODITOR/projects');
const OUT = path.join(__dirname, 'data.js');
const MAX_PAIRS = Number(process.argv[2] || 8);
const MAX_PROJ_BYTES = 6 * 1024 * 1024;   // 페이지에 실을 수 있는 크기
const MAX_PAIR_BYTES = 3 * 1024 * 1024;

/* ★임시폴더는 «우산 아래»에서 만든다($TMPDIR/goya-run-<pid>/) — 도구도 예외가 아니다.
 *   os.tmpdir() 에 직접 만들면 죽은-pid 사후회수가 «못 찾는다»(우산 밖이라 스캔 대상이 아니다).
 *   이 도구들이 만드는 픽스처가 수백 MB 라, 새면 남의 세션이 멈춘다(2026-08-28 실사고). */
const scratch = mkTmpRoot('goya-l2-');
const pairs = [];
for (const d of fs.readdirSync(LIVE)) {
  if (pairs.length >= MAX_PAIRS) break;
  const sh = path.join(LIVE, d, 'proj_history'), sp = path.join(LIVE, d, 'proj.json');
  if (!fs.existsSync(sh) || !fs.existsSync(sp)) continue;
  if (fs.statSync(sp).size > MAX_PROJ_BYTES) continue;
  const dst = path.join(scratch, d);
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(sh, path.join(dst, 'proj_history'), { recursive: true });
  fs.copyFileSync(sp, path.join(dst, 'proj.json'));

  let l = SS.listVersions(scratch, d); let g = 0;
  while (l.pendingCount > 0 && g++ < 20) l = SS.listVersions(scratch, d);
  if (!l.ok || !l.entries.length) continue;
  const e = l.entries[0];
  const snap = SS.readVersion(scratch, d, e.ts);
  if (!snap.ok) continue;
  const cur = JSON.parse(fs.readFileSync(path.join(dst, 'proj.json'), 'utf8'));

  // ★양쪽을 «같은 좌표계»로 — main 의 projects:history-diff-payload 와 동일 처리
  const toMap = (data) => {
    const c = SS.canonicalize(scratch, d, data, { write: false });
    const o = {};
    for (const x of SS._internal.canvasStrings(c.data)) o[x.key] = x.html;
    return o;
  };
  const snapCanvas = toMap(snap.data), curCanvas = toMap(cur);
  if (JSON.stringify(snapCanvas).length + JSON.stringify(curCanvas).length > MAX_PAIR_BYTES) continue;

  pairs.push({ id: d, ts: e.ts, canon: e.canon, snapCanvas, curCanvas,
               snapSections: e.counts ? e.counts.sections : null,
               curSections: l.current.counts.sections });
}
fs.rmSync(scratch, { recursive: true, force: true });
fs.writeFileSync(OUT, 'window.__PAIRS=' + JSON.stringify(pairs) + ';');
console.log(`실데이터 쌍 ${pairs.length}개 → ${OUT} (${(fs.statSync(OUT).size / 1048576).toFixed(2)}MB)`);
for (const p of pairs) console.log(`  ${p.id} canon=${p.canon} snap${p.snapSections}/cur${p.curSections}`);
