/* ═══════════════════════════════════════════════════════════════════════════
   fixture.mjs — «내가 만든 것»만 부순다.
   ───────────────────────────────────────────────────────────────────────────
   ⛔절대 금지: 현빈 실제 프로젝트(~/Library/Application Support/GODITOR)를 대상으로
     망가뜨리기. 코퍼스도 «복사»해서만 쓴다 — 원본은 읽기 전용으로만 연다.
   ★그리고 원본을 「망가뜨렸다 되돌리기」도 금지다(골 §5.1). 중간에 죽으면 망가진 채
     남는다 — 2026-09-06 에 실제로 그렇게 됐다. 그래서 여기엔 «되돌리기» 함수가 없다.
     사본을 새로 뜨는 것이 유일한 리셋이다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { HarnessError } from './deadline.mjs';

export const CORPUS_DIR = path.join(os.homedir(), 'srv-지디_qa-corpus');
export const CORPUS_LARGE = path.join(CORPUS_DIR, 'proj_large_safebon');
/* ⛔건드리면 안 되는 «원본» userData — 맥과 윈도우는 «다른 자리»에 있다.
   맥만 적어 두면 윈도우에서 이 안전 게이트가 «조용히 무효»가 된다. */
const ORIGINAL_UD = [
  path.join(os.homedir(), 'Library/Application Support/GODITOR'),   // macOS
  path.join(os.homedir(), 'AppData', 'Roaming', 'GODITOR'),         // Windows (%APPDATA%)
];

/**
 * 루트를 뗀 «세그먼트 수». ★플랫폼을 주입할 수 있다 — 윈도우 모양을 «맥에서» 재려면 필요하다.
 *
 * ★왜 바꿨나 (미니4호기 윈도우 실기, 31a7723)
 *   옛 판 `real.split('/').length < 4` 는 `C:\Users\…\Temp\…` 에 `/` 가 «하나도 없어»
 *   언제나 1 → **언제나 던졌다.** 실측: selfcheck 판정기 14건(오탐 6·미탐 8)이 전부 같은
 *   「위험한 경로」 문구로 죽었다 = 판정기가 «하나도 못 돌았다».
 *   ⇒ POSIX 판정은 한 글자도 안 바뀐다: '/a/b/c'=3(허용) · '/a/b'=2(거부) — 옛 식과 동치다.
 */
export function pathDepth(p, P = path) {
  const real = P.resolve(p);
  return real.slice(P.parse(real).root.length).split(/[\\/]+/).filter(Boolean).length;
}
/** 그 경로가 볼륨 루트 자체인가(`/` · `C:\`). */
export function isRootPath(p, P = path) {
  const real = P.resolve(p);
  return real === P.parse(real).root;
}
/** 접두 비교 — ★NTFS 는 대소문자를 안 가린다. 그대로 비교하면 안전 게이트가 새어 나간다. */
function isUnder(real, base) {
  const n = (s) => (process.platform === 'win32' ? s.toLowerCase() : s);
  return n(real).startsWith(n(base));
}

/** ⛔쓰기 대상이 «내 것»인지 매번 확인한다. 이 게이트를 우회하는 경로를 만들지 마라. */
export function assertWritableTarget(p) {
  const real = path.resolve(p);
  if (isRootPath(real) || pathDepth(real) < 3) throw new HarnessError(`위험한 경로: ${real}`);
  for (const ud of ORIGINAL_UD) {
    if (isUnder(real, ud)) throw new HarnessError(`⛔원본 userData 를 쓰려 했다: ${real}`);
  }
  if (isUnder(real, CORPUS_DIR)) throw new HarnessError(`⛔코퍼스 «원본»을 쓰려 했다(복사해서 써라): ${real}`);
  if (isUnder(real, path.join(os.homedir(), 'web-editor-merge'))) throw new HarnessError(`⛔현빈 작업본을 쓰려 했다: ${real}`);
  return real;
}

/** 캔버스 HTML 한 장 — 마커 하나가 «편집 n번째»를 뜻한다. */
const canvasHtml = (n, marker) =>
  `<div class="section" id="sec_h7_${n}" data-h7="${marker}">` +
  `<div class="block text-block"><p>H7 fixture block ${n}</p></div></div>`;

/**
 * 합성 프로젝트를 «내» ud 안에 만든다.
 * @param sections 섹션 수 — 직렬화 시간을 늘려 kill9 창을 벌릴 때 올린다.
 * @param padKb    페이지당 더미 바이트(KB). 저장 시간을 «실측 가능하게» 만드는 손잡이.
 */
export function makeProject(userDataDir, id, { sections = 3, padKb = 0, name = 'H7 fixture' } = {}) {
  const projectsDir = path.join(assertWritableTarget(userDataDir), 'projects');
  const dir = path.join(projectsDir, id);
  fs.mkdirSync(path.join(dir, 'proj_history'), { recursive: true });
  let canvas = '';
  for (let i = 0; i < sections; i++) canvas += canvasHtml(i, `H7-BASE-${i}`);
  if (padKb > 0) canvas += `<div style="display:none" id="h7-pad">${'x'.repeat(padKb * 1024)}</div>`;
  const proj = {
    id, name, type: 'detail', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    pageSettings: { width: 860 },
    pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { width: 860 }, canvas }],
  };
  const json = JSON.stringify(proj, null, 2);
  fs.writeFileSync(path.join(dir, 'proj.json'), json);
  fs.writeFileSync(path.join(dir, 'proj_backup.json'), json);
  fs.writeFileSync(path.join(dir, 'proj_history', `v_${Date.now()}.json`), json);
  fs.writeFileSync(path.join(dir, 'proj_meta.json'), JSON.stringify(
    { id, name, type: 'detail', createdAt: proj.createdAt, updatedAt: proj.updatedAt }, null, 2));
  return { id, dir, projectsDir, bytes: Buffer.byteLength(json) };
}

/**
 * ★코퍼스 «사본». 원본은 열지도 않는다 — 복사만 한다(C8: 실데이터로 닫아라).
 * @param withAssets 267MB 전체(assets 포함) 인가, proj*.json 만(약 78MB) 인가.
 */
export function copyCorpus(userDataDir, { src = CORPUS_LARGE, id = 'proj_h7_corpus', withAssets = false } = {}) {
  if (!fs.existsSync(src)) throw new HarnessError(`코퍼스가 없다: ${src}`);
  const projectsDir = path.join(assertWritableTarget(userDataDir), 'projects');
  const dst = path.join(projectsDir, id);
  fs.mkdirSync(dst, { recursive: true });
  const t0 = Date.now();
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (!withAssets && e.isDirectory() && e.name === 'assets') continue;
    if (e.name === 'claude-pm') continue;
    fs.cpSync(path.join(src, e.name), path.join(dst, e.name), { recursive: true });
  }
  // ★사본의 id 를 «사본 이름»으로 바꾼다 — 안 바꾸면 앱이 원본 id 로 저장 경로를 잡는다.
  const pj = path.join(dst, 'proj.json');
  const proj = JSON.parse(fs.readFileSync(pj, 'utf8'));
  proj.id = id;
  fs.writeFileSync(pj, JSON.stringify(proj, null, 2));
  return {
    id, dir: dst, projectsDir, copyMs: Date.now() - t0,
    bytes: fs.statSync(pj).size, sections: countSections(proj),
  };
}

export function countSections(proj) {
  try {
    return (proj.pages || []).reduce((n, p) =>
      n + (String(p.canvas || '').match(/class="[^"]*\bsection\b/g) || []).length, 0);
  } catch (_) { return -1; }
}

/**
 * ★PII 표본 «세 종» 을 만든다 (골 §5.7 — 한 축의 0건 ≠ 결함 0).
 *   ⑴ 홈 경로  ⑵ 코퍼스 본문 조각 3개  ⑶ goya-asset 파일명
 * ⛔코퍼스 조각은 «메모리에만» 산다. 보고서·로그·기록 어디에도 원문을 쓰지 않는다
 *   (골 §8) — 밖으로 나가는 건 sha256 앞 8자와 길이뿐이다.
 */
export function piiSamples(projDir, { textCount = 3 } = {}) {
  const out = { home: [], corpusText: [], assetNames: [], source: path.basename(projDir) };
  out.home = [`/Users/${os.userInfo().username}`, os.homedir(), 'C:\\Users\\'];
  const pj = path.join(projDir, 'proj.json');
  if (!fs.existsSync(pj)) return out;
  // ⚠️39MB 를 통째로 JSON.parse 하지 않는다 — 앞부분을 스트림으로 훑어 표본만 건진다.
  const fd = fs.openSync(pj, 'r');
  const buf = Buffer.alloc(Math.min(8 * 1024 * 1024, fs.statSync(pj).size));
  fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd);
  const head = buf.toString('utf8');
  // ⑵ 본문 조각: 한글이 12자 이상 이어지는 덩어리(=사람이 쓴 글)
  const seen = new Set();
  for (const m of head.matchAll(/[가-힣][가-힣\s0-9]{11,40}[가-힣]/g)) {
    const s = m[0].trim();
    if (s.length < 12 || seen.has(s)) continue;
    seen.add(s); out.corpusText.push(s);
    if (out.corpusText.length >= textCount) break;
  }
  // ⑶ goya-asset 파일명
  const an = new Set();
  for (const m of head.matchAll(/goya-asset:\/\/[^"'\s)]+/g)) {
    const base = m[0].split('/').pop();
    if (base && !an.has(base)) { an.add(base); out.assetNames.push(base); }
    if (out.assetNames.length >= 3) break;
  }
  return out;
}

/** 표본을 보고서에 «안전하게» 적기 위한 지문. ⛔원문 금지. */
export const fingerprint = s =>
  ({ sha8: crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8), len: String(s).length });

/** 격리 ud 를 하나 판다. 이름에 소관을 박는다(goditor-qa §1). */
export function makeUserDataDir(tag) {
  const ud = path.join(os.homedir(), `srv-지디_qa-ud-h7-${tag}`);
  assertWritableTarget(ud);
  fs.rmSync(ud, { recursive: true, force: true });
  fs.mkdirSync(path.join(ud, 'projects'), { recursive: true });
  return ud;
}
