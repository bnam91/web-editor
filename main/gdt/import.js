/* import.js — .gdt 불러오기 (GDT-SPEC v1 §7·§9)
 *
 * ★§6: images/의 «원본 바이트를 그대로 base64로 되돌린다». 재인코딩 없음.
 *   base64 decode→encode가 바이트 동일임을 실측했으므로(138/138) 원복된 proj.json은
 *   원본과 «바이트 동일»해진다 ⇒ L3(캔버스 전체 md5) 만점이 성립한다.
 *   그래서 project.json도 JSON.parse→stringify로 «재직렬화하지 않는다» — 키 순서·이스케이프가
 *   바뀌는 순간 L3는 영원히 못 맞춘다. 문자열 구간 치환만 한다.
 *
 * ★§7: 폴더명 · proj.json의 id · proj_meta.json의 id 를 «셋 다» 같은 값으로 쓴다.
 *   id 출처가 둘(캐시 히트=폴더명 / 폴백=내부 id)이라 하나라도 어긋나면
 *   «저장 한 번»에 id가 조용히 바뀐다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const { verifyGdt, FORMAT_VERSION } = require('./export');

/* ── 엔트리명 안전성 (§9) ──
 * 경로 탈출·비ASCII를 거부한다. 정상 .gdt의 엔트리명은 전부 ASCII다(§1).
 */
const SAFE_ENTRY = /^(manifest\.json|project\.json|images\/[A-Za-z0-9._-]{1,64})$/;
function isSafeEntry(name) {
  if (!SAFE_ENTRY.test(name)) return false;
  if (name.includes('..') || name.includes('\\')) return false;
  return true;
}

/* ── 새 프로젝트 id 발급 (§7) ──
 * ★반드시 /^proj_\d+$/ — 어기면 파일은 생겼는데 목록에 «안 뜬다».
 * ★manifest.project.sourceId 는 절대 쓰지 않는다(형식 보장이 없다 — 실측 "tmp").
 */
function allocateProjectId(projectsDir) {
  let n = Date.now();
  for (let i = 0; i < 10000; i++) {
    const id = `proj_${n + i}`;
    if (!fs.existsSync(path.join(projectsDir, id)) && !fs.existsSync(path.join(projectsDir, `${id}.json`))) {
      return id;
    }
  }
  throw new Error('새 프로젝트 id 발급 실패');
}

/* ── project.json의 top-level id 치환 ──
 * 앱은 항상 JSON.stringify(project, null, 2)로 쓴다 ⇒ top-level 키는 «2칸 들여쓰기»다.
 * 중첩 id(들여쓰기가 더 깊거나 canvas 문자열 안)와 구분된다.
 * ★못 찾으면 «거부»한다 — top-level id가 없으면 목록에서 아예 빠지므로(main.js:804)
 *   조용히 안 보이는 프로젝트를 만드느니 실패로 알린다.
 */
function replaceTopLevelId(buf, newId) {
  const NEEDLE = Buffer.from('\n  "id": "');
  const at = buf.indexOf(NEEDLE);
  if (at === -1) return null;
  const valStart = at + NEEDLE.length;
  const valEnd = buf.indexOf(0x22 /* " */, valStart);
  if (valEnd === -1) return null;
  return Buffer.concat([buf.subarray(0, valStart), Buffer.from(newId), buf.subarray(valEnd)]);
}

/* ── gdt://images/… → data:<mime>;base64,… 원복 (스트리밍 쓰기) ──
 * project.json 자체는 작다(실측 0.13~0.51MB)라 메모리에 올려도 되지만, «출력»은 80~108MB다.
 * 이미지는 한 장씩 읽어 인코딩해 흘려보낸다 ⇒ 상주 메모리는 「가장 큰 이미지 하나」뿐.
 */
async function writeRestoredProjJson({ projectJsonBuf, stageDir, mimeByEntry, outPath, onProgress }) {
  const out = fs.createWriteStream(outPath);
  const failed = new Promise((_, rej) => out.on('error', rej));

  // ★백프레셔 — write()가 false면 drain을 기다린다. 안 하면 80~108MB 출력이 통째로
  //   writable 버퍼에 쌓인다(실측: 없을 때 108MB 복원에 peak RSS 327MB).
  const write = (buf) => (out.write(buf) ? Promise.resolve() : new Promise(r => out.once('drain', r)));

  const RE = /gdt:\/\/(images\/[A-Za-z0-9._-]+)/g;
  const text = projectJsonBuf.toString('latin1');   // 바이트 보존(1:1 매핑)
  let pos = 0, m, restored = 0, bytesOut = 0;
  const total = Object.keys(mimeByEntry).length;

  try {
    while ((m = RE.exec(text)) !== null) {
      const entry = m[1];
      const mime = mimeByEntry[entry];
      if (!mime) throw new Error(`manifest에 없는 이미지 참조: ${entry}`);

      const head = Buffer.from(text.slice(pos, m.index), 'latin1');
      await Promise.race([write(head), failed]); bytesOut += head.length;

      // ★원본 바이트를 그대로 base64로 되돌린다(재인코딩·재압축 없음).
      //   한 장씩 읽고 즉시 흘려보내 상주 메모리를 「가장 큰 이미지 하나」로 묶는다.
      const bin = fs.readFileSync(path.join(stageDir, entry));
      const uri = Buffer.from(`data:${mime};base64,${bin.toString('base64')}`, 'latin1');
      await Promise.race([write(uri), failed]); bytesOut += uri.length;

      pos = m.index + m[0].length;
      restored += 1;
      if (onProgress) onProgress({ phase: 'restore', imagesDone: restored, imagesTotal: total });
    }
    const tail = Buffer.from(text.slice(pos), 'latin1');
    await Promise.race([write(tail), failed]); bytesOut += tail.length;
    await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
    return { restored, bytes: bytesOut };
  } catch (e) {
    out.destroy();
    throw e;
  }
}

/* ── 스테이징 디렉터리로 전개 ── */
function extractAll(gdtPath, stageDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(gdtPath, { lazyEntries: true, autoClose: true }, (err, zf) => {
      if (err) return reject(new Error(`zip_open_failed: ${err.message}`));
      const names = [];
      zf.on('error', reject);
      zf.on('entry', (entry) => {
        if (!isSafeEntry(entry.fileName)) return reject(new Error(`unsafe_entry: ${entry.fileName}`));
        const dest = path.join(stageDir, entry.fileName);
        // path traversal 2차 방어 — 정규화 후에도 stageDir 안이어야 한다
        if (!path.resolve(dest).startsWith(path.resolve(stageDir) + path.sep)) {
          return reject(new Error(`unsafe_entry_path: ${entry.fileName}`));
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        zf.openReadStream(entry, (e2, rs) => {
          if (e2) return reject(e2);
          const ws = fs.createWriteStream(dest);
          rs.on('error', reject);
          ws.on('error', reject);
          ws.on('close', () => { names.push(entry.fileName); zf.readEntry(); });
          rs.pipe(ws);
        });
      });
      zf.on('end', () => resolve(names));
      zf.readEntry();
    });
  });
}

/* ── 진입점 ──
 * @returns {{ok:true, projectId, name, fonts, images, bytes} | {ok:false, error, code}}
 *
 * ★부분 복원 금지: 모든 작업을 «임시 디렉터리»에서 끝내고 마지막에 rename 한 번으로 확정한다.
 *   중간에 실패하면 임시 디렉터리를 통째로 지운다 ⇒ 반쯤 들어온 프로젝트가 남을 수 없다.
 */
async function importGdt({ gdtPath, projectsDir, onProgress = null }) {
  const t0 = Date.now();
  let peakRss = process.memoryUsage().rss;
  const rssTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 50);

  // 1) ★먼저 «거부 판정». 이 시점까지 디스크에 아무것도 안 쓴다.
  if (onProgress) onProgress({ phase: 'validate' });
  const v = await verifyGdt(gdtPath);
  if (!v.ok) {
    clearInterval(rssTimer);
    return { ok: false, code: v.code, error: `불러올 수 없는 파일입니다: ${v.code}${v.detail ? ` (${v.detail})` : ''}` };
  }

  const tmpName = `.import_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.tmp`;
  const stageDir = path.join(projectsDir, tmpName);

  try {
    fs.mkdirSync(stageDir, { recursive: true });
    if (onProgress) onProgress({ phase: 'extract' });
    await extractAll(gdtPath, stageDir);

    const manifest = JSON.parse(fs.readFileSync(path.join(stageDir, 'manifest.json'), 'utf8'));
    if (manifest.formatVersion > FORMAT_VERSION) throw new Error(`format_version_future: ${manifest.formatVersion}`);
    const mimeByEntry = {};
    for (const img of manifest.images || []) mimeByEntry[img.entry] = img.mime;

    // 2) 새 id 발급 — ★sourceId 를 쓰지 않는다(§7-4)
    const newId = allocateProjectId(projectsDir);

    // 3) project.json 읽기 — 메타는 «읽기만» 하고, 쓰기는 바이트 치환으로 한다
    const projectJsonPath = path.join(stageDir, 'project.json');
    let projBuf = fs.readFileSync(projectJsonPath);
    let meta;
    try { meta = JSON.parse(projBuf.toString('utf8')); }
    catch (e) { throw new Error(`project_json_unparsable: ${e.message}`); }

    const replaced = replaceTopLevelId(projBuf, newId);
    if (!replaced) throw new Error('project_json_missing_top_level_id'); // §7-3: 없으면 목록에서 빠진다
    projBuf = replaced;

    // 4) proj.json 원복 (gdt:// → base64). ★§7 폴더명과 같은 id가 내부에도 박힌 상태.
    if (onProgress) onProgress({ phase: 'restore', imagesDone: 0, imagesTotal: manifest.images.length });
    const projOut = path.join(stageDir, 'proj.json');
    const r = await writeRestoredProjJson({
      projectJsonBuf: projBuf, stageDir, mimeByEntry, outPath: projOut, onProgress,
    });
    if (r.restored !== (manifest.images || []).length) {
      throw new Error(`이미지 원복 수 불일치: ${r.restored} ≠ ${manifest.images.length}`);
    }

    // 5) ★proj_meta.json 을 «반드시» 만든다 (§7-2)
    //    안 만들면 ① id 출처가 폴백으로 흔들리고 ② 첫 목록 로드에서 80~108MB를 통째 풀파싱한다.
    //    ★proj.json 을 «먼저» 쓴 뒤에 만든다 — 목록 캐시는 meta.mtime ≥ proj.mtime 일 때만 신뢰된다.
    const nowIso = new Date().toISOString();
    const metaOut = {
      id: newId,                                   // ★폴더명·내부 id 와 같은 값
      name: meta.name || manifest.project?.name || '가져온 프로젝트',
      type: meta.type || null,
      createdAt: meta.createdAt || nowIso,
      updatedAt: meta.updatedAt || nowIso,
      marketRef: meta.marketRef || null,
      listMetaV: 1,
    };
    fs.writeFileSync(path.join(stageDir, 'proj_meta.json'), JSON.stringify(metaOut, null, 2));

    // 6) 스테이징 정리 — 컨테이너 잔재(project.json·manifest.json·images/)는 프로젝트 폴더에 안 남긴다
    fs.rmSync(path.join(stageDir, 'images'), { recursive: true, force: true });
    fs.rmSync(projectJsonPath, { force: true });
    fs.rmSync(path.join(stageDir, 'manifest.json'), { force: true });

    // 7) ★단 한 번의 rename 으로 확정 (부분 복원 불가)
    const finalDir = path.join(projectsDir, newId);
    fs.renameSync(stageDir, finalDir);

    clearInterval(rssTimer);
    const result = {
      ok: true,
      projectId: newId,
      name: metaOut.name,
      fonts: manifest.fonts || [],
      images: r.restored,
      bytes: fs.statSync(path.join(finalDir, 'proj.json')).size,
      inlineRetained: manifest.inlineRetained || null,
      elapsedMs: Date.now() - t0,
      peakRssMB: +(peakRss / 1048576).toFixed(1),
    };
    if (onProgress) onProgress({ phase: 'done', result });
    return result;
  } catch (e) {
    // ★어떤 실패든 임시 디렉터리를 통째로 지운다 — 반쯤 들어온 프로젝트를 남기지 않는다
    try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (_) {}
    return { ok: false, code: 'import_failed', error: (e && e.message) || String(e) };
  } finally {
    clearInterval(rssTimer);
  }
}

module.exports = { importGdt, allocateProjectId, replaceTopLevelId, isSafeEntry };
