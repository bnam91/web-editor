/* export.js — .gdt 내보내기 (GDT-SPEC v1 §1~6·8·10)
 *
 * ★핵심: proj.json을 «JSON으로 파싱하지 않는다».
 *   base64 알파벳(A-Za-z0-9+/=)에는 `"`도 `\`도 없다 ⇒ `data:image/…;base64,…`는 JSON 이스케이프와
 *   무관하게 파일 바이트에 그대로 나타난다. 그래서 바이트 스트림에서 그 구간만 찾아 치환하고
 *   나머지 바이트는 손대지 않고 흘려보낸다.
 *   ⇒ §3 「재직렬화 금지」가 «지켜지는» 게 아니라 JSON.stringify가 등장할 자리가 «없다».
 *   ⇒ ASCII 패턴만 찾으므로 한글 UTF-8 멀티바이트를 자를 위험도 없다(멀티바이트 시퀀스에
 *      ASCII 바이트가 못 들어간다).
 *
 * 메모리: 청크(1MB) + 「가장 큰 이미지 하나」만 상주한다. 입력 크기에 비례하지 않는다.
 *
 * ★v0.8.0~ 외부화 프로젝트: 이미지가 `goya-asset://<pid>/<hash>.<ext>` 참조로 바뀌었다. 같은 스캐너가
 *   이 토큰도 잡아 `<projectsDir>/<pid>/assets/` 의 바이트를 images/ 로 동봉한다(아래 GOYA_PREFIX 참조).
 *   .gdt 안에서는 둘 다 `gdt://images/img_NNNN.<ext>` 로 «구분되지 않는다» ⇒ 불러오기 포맷은 그대로다.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const yazl = require('yazl');
const yauzl = require('yauzl');
const { probeImage } = require('./media-probe');
const { LIMITS, makeDeadline, fmtMB } = require('./limits');

const FORMAT_VERSION = 1;
const CHUNK = 1 << 20;                       // 1MB
const MIME_MAX = 40;                         // 'data:image/' 뒤 mime 최대 길이
const MAX_URI_BYTES = 64 * 1024 * 1024;      // 단일 data URI 상한 — carry 무한증식 차단

const PREFIX = Buffer.from('data:image/');
const B64MARK = Buffer.from(';base64,');
const SAFE_TAIL = PREFIX.length + MIME_MAX + B64MARK.length;

// ★§2: `;base64,` 인 것만 외부화한다. 평문(URL인코딩) data URI는 인라인으로 «남긴다».
//   판별하지 않는 게 더 안전하다 — 빼지 않으면 사라질 일이 없다.
const isB64Byte = (b) =>
  (b >= 48 && b <= 57) || (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 43 || b === 47 || b === 61;

const MIME_EXT = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/svg+xml': 'svg',
  'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/bmp': 'bmp',
};
// ★§5: 확장자는 mime을 따라간다. SVG는 텍스트라 확장자가 틀리면 못 연다.
const extForMime = (m) => MIME_EXT[String(m || '').toLowerCase()] || 'png';
// 역방향(확장자 → mime) — goya-asset 파일명은 확장자만 들고 있다(`<hash>.<ext>`, externalizer.extFromMime).
//   MIME_EXT 에서 «파생»시켜 드리프트를 막는다. 여기 없는 확장자는 probeImage 도 못 열므로 동봉하지 않는다.
const EXT_MIME = Object.entries(MIME_EXT).reduce((o, [m, e]) => { if (!o[e]) o[e] = m; return o; }, { jpeg: 'image/jpeg' });

/* ── goya-asset:// 토큰 (v0.8.0~ 외부화 에셋 참조) ──
 * ★캔버스 이미지는 `goya-asset://<projectId>/<hash>.<ext>` 로 참조되고 바이트는
 *   `<projectsDir>/<projectId>/assets/<hash>.<ext>` 에 있다. 스캐너가 이 토큰을 «그대로 통과»시키면
 *   다른 맥에서 불러올 때 에셋이 없어 404 다 — 그래서 base64 와 «똑같이» images/ 로 빼고
 *   자리에 `gdt://images/img_NNNN.<ext>` 를 써넣는다. 불러오기는 바꾸지 않는다(base64 원복 = 구버전 호환).
 * ★토큰 문자 집합은 externalizer 의 GOYA_RE(`[\w.-]`)와 같다. base64 알파벳과 달리 `/` 가 들어가지만
 *   base64 «구간 밖»만 스캔하므로(2중 면역) base64 안의 우연한 일치는 못 긁는다.
 * ★dedup 은 «하지 않는다» — formatVersion 1 의 불변식(refs == images == unique, verifyGdt §11-1ⓐ)이
 *   「출현 하나 = 엔트리 하나」를 전제한다. 같은 에셋이 N번 나오면 엔트리 N개(바이트·sha 동일)다.
 */
const GOYA_PREFIX = Buffer.from('goya-asset://');
const GOYA_SEG_MAX = 64;                     // pid·파일명 각각의 상한 — 넘으면 토큰이 아니다(carry 무한증식 차단)
const isSegByte = (b) =>
  (b >= 48 && b <= 57) || (b >= 65 && b <= 90) || (b >= 97 && b <= 122) || b === 95 || b === 46 || b === 45;

/* ── 아카이브 엔트리 이름의 «정본» ──
 * ★이름을 «만드는» 쪽에서 패턴도 함께 정한다. 불러오기가 따로 하드코딩하면 둘이 어긋나고,
 *   어긋나는 순간 «정상 파일이 안 열린다»(허용목록에서 가장 위험한 실패 모드).
 *   확장자 목록은 MIME_EXT 에서 «파생»시켜 드리프트를 원천 차단한다.
 *   `jpeg` 는 우리가 쓰지 않지만 읽을 땐 받아준다(만드는 건 엄격, 읽는 건 관대).
 */
const ENTRY_EXTS = [...new Set([...Object.values(MIME_EXT), 'jpeg'])].sort();
const ENTRY_NAME_RE = new RegExp(`^(manifest\\.json|project\\.json|images/img_\\d{4,8}\\.(?:${ENTRY_EXTS.join('|')}))$`);

// ★§4-1: 맨 문자열 검색 금지 — base64 안의 우연한 일치를 긁는다(A2Z: 맨 276회 vs 진짜 17회).
//   공백·하이픈·콜론은 base64 알파벳에 없으므로 컨텍스트가 붙으면 안전하다.
//   덧붙여 이 스캐너는 base64 «구간 밖»만 본다(2중 면역).
// ★따옴표를 «배제하면 안 된다» — 폰트 피커가 만드는 값은 전부 인용형이다
//   (`'A2Z', 'Pretendard', sans-serif`). 배제하면 픽커로 고른 폰트가 통째로 누락된다.
//   선언은 `;`(다음 속성) · `}`(룰 끝) · `\`(JSON 안 style 속성의 닫는 따옴표)에서 끝난다.
const FONT_CSS_RE = /font-family:\s*([^;}\\]{1,200})/g;
const FONT_RAW_RE = /data-raw-font=\\?"([^\\"]{1,200})/g;
const FONT_OVERLAP = 256;                    // 청크 경계에서 패턴이 잘리는 것 방지

function _splitFontList(decl) {
  return String(decl).split(',')
    .map(s => s.replace(/["']/g, '').trim())
    // 엔티티 잔재·마크업 파편·빈 토큰은 폰트가 아니다(거짓 경보 차단)
    .filter(s => s && !/[&;<>={}]/.test(s) && s.length <= 64);
}

// ★캔버스 HTML에는 «HTML 엔티티로 인용된» 선언이 섞인다: `font-family: &quot;Noto Serif KR&quot;`.
//   안 풀면 `&quot;` 의 세미콜론이 선언 끝으로 오인돼 ①`&quot` 라는 «없는 폰트»가 목록에 실리고
//   ②진짜 이름 `Noto Serif KR` 은 통째로 «누락»된다. 실측: 끌리젠_카피 4곳.
function _decodeEntities(s) {
  return s.replace(/&quot;|&#0*34;/g, '"').replace(/&apos;|&#0*39;/g, "'").replace(/&amp;/g, '&');
}

/* ── 폰트 수집기 ── */
class FontCollector {
  constructor() { this.families = new Set(); this._tail = ''; }
  feed(text) {
    // 직전 꼬리를 앞에 붙여 경계에서 잘린 패턴을 살린다. Set이라 중복 계수는 무해하다.
    const s = _decodeEntities(this._tail + text);
    let m;
    FONT_CSS_RE.lastIndex = 0;
    while ((m = FONT_CSS_RE.exec(s)) !== null) _splitFontList(m[1]).forEach(f => this.families.add(f));
    FONT_RAW_RE.lastIndex = 0;
    while ((m = FONT_RAW_RE.exec(s)) !== null) _splitFontList(m[1]).forEach(f => this.families.add(f));
    this._tail = s.slice(-FONT_OVERLAP);
  }
  // ★값은 «캔버스가 쓴 CSS 이름 그대로». 단 «폰트가 아닌 것»은 뺀다 —
  //   generic(sans-serif…)과 시스템 UI 키워드(-apple-system…)는 설치 폰트명이 아니라
  //   브라우저에 대한 지시자다. 목록에 넣으면 불러올 때 「없는 폰트」로 «거짓 경보»가 난다
  //   (실측: 두장군2호기의 `font-family: Pretendard, -apple-system, sans-serif` 3곳에서 유입).
  result() {
    const NOT_A_FONT = new Set([
      'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
      'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded',
      '-apple-system', 'blinkmacsystemfont', '-webkit-body', '-moz-fixed',
      'inherit', 'initial', 'unset', 'revert', 'none',
    ]);
    return [...this.families].filter(f => !NOT_A_FONT.has(f.toLowerCase())).sort((a, b) => a.localeCompare(b));
  }
}

/* ── 1단계: proj.json 스트리밍 변환 ──
 * base64 data URI 와 goya-asset:// 참조를 스테이징 디렉터리의 파일로 빼고, 자리에 gdt://images/… 를 써넣는다.
 * @param {string|null} projectsDir  goya-asset 해석 루트(`<projectsDir>/<pid>/assets/`). 없으면 goya 토큰은 전부 누락 처리.
 * @param {number}      chunkSize    읽기 청크(기본 1MB). 테스트가 청크 경계를 강제할 때만 바꾼다.
 * @returns {Promise<{images, fonts, projectJsonPath, bytesIn, inlineRetained, goyaAssets, missingAssets}>}
 */
function transformProjectJson({ srcPath, stageDir, onProgress, projectsDir = null, chunkSize = CHUNK }) {
  return new Promise((resolve, reject) => {
    const imagesDir = path.join(stageDir, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    const outPath = path.join(stageDir, 'project.json');
    const out = fs.createWriteStream(outPath);
    const fonts = new FontCollector();

    const totalBytes = fs.statSync(srcPath).size;
    const images = [];
    const missingAssets = [];                  // goya 토큰 중 동봉 못 한 것 — ★조용히 삼키지 않고 호출측에 올린다
    let bytesIn = 0, order = 0, inlinePlain = 0, maxUri = 0, goyaAssets = 0;
    let carry = Buffer.alloc(0);
    let failed = null;
    const projectsRoot = projectsDir ? path.resolve(projectsDir) : null;

    // 평문(URL인코딩) data URI 계수 — 「인라인으로 남았다」를 manifest에 적기 위한 것뿐이다.
    const PLAIN_RE = /data:image\/[a-zA-Z0-9.+-]+,/g;
    const countPlain = (text) => { PLAIN_RE.lastIndex = 0; while (PLAIN_RE.exec(text) !== null) inlinePlain++; };

    const emitText = (buf) => {
      if (!buf.length) return;
      out.write(buf);
      const t = buf.toString('latin1');
      fonts.feed(t);
      countPlain(t);
    };

    // 원본 바이트 → images/img_NNNN.<ext> 엔트리. base64·goya 두 경로가 «같은» 엔트리 규약을 쓴다.
    const writeImageBytes = (mime, bin, extra) => {
      order += 1;
      const ext = extForMime(mime);
      const entry = `images/img_${String(order).padStart(4, '0')}.${ext}`;
      fs.writeFileSync(path.join(stageDir, entry), bin);
      images.push({
        entry, mime: String(mime).toLowerCase(),
        sha256: crypto.createHash('sha256').update(bin).digest('hex'),   // ★§4-2 원본 바이너리 기준
        bytes: bin.length, order, ...(extra || {}),
      });
      return Buffer.from(`gdt://${entry}`);
    };

    const writeImage = (mime, b64buf) => {
      // ★§6: base64를 디코드한 «원본 바이트를 그대로» 쓴다. 재인코딩·재압축 없음.
      const bin = Buffer.from(b64buf.toString('latin1'), 'base64');
      maxUri = Math.max(maxUri, b64buf.length);
      return writeImageBytes(mime, bin);
    };

    /* goya-asset://<pid>/<file> → 에셋 파일을 읽어 엔트리로. 못 읽으면 null(토큰은 그대로 남기고 missingAssets 에 기록).
     * ★경로 탈출 가드 — pid·file 은 스캐너가 [\w.-] 만 통과시키지만 `..` 도 그 집합이다.
     *   resolve 후 «assets 루트 안»인지, assets 루트가 «projectsDir 안»인지 둘 다 본다. 심볼릭 링크도 realpath 로 거른다. */
    const stageGoyaAsset = (pid, file) => {
      const url = `goya-asset://${pid}/${file}`;
      const miss = (reason) => { missingAssets.push({ url, reason }); return null; };
      if (!projectsRoot) return miss('no_projects_dir');
      const dot = file.lastIndexOf('.');
      const mime = dot > 0 ? EXT_MIME[file.slice(dot + 1).toLowerCase()] : null;
      if (!mime) return miss('unsupported_ext');
      const assetsRoot = path.resolve(projectsRoot, pid, 'assets');
      const full = path.resolve(assetsRoot, file);
      if (!assetsRoot.startsWith(projectsRoot + path.sep) || !full.startsWith(assetsRoot + path.sep)) return miss('unsafe_path');
      let bin;
      try {
        const real = fs.realpathSync(full);
        if (!real.startsWith(fs.realpathSync(assetsRoot) + path.sep)) return miss('unsafe_path');
        bin = fs.readFileSync(real);
      } catch (e) {
        return miss(e && e.code === 'ENOENT' ? 'not_found' : 'read_failed');
      }
      if (!bin.length) return miss('empty');
      goyaAssets += 1;
      return writeImageBytes(mime, bin, { goya: `${pid}/${file}` });
    };

    /* goya 토큰 파싱 — i 는 GOYA_PREFIX 위치. 세그먼트는 [\w.-]{1,64} 둘을 `/` 로 잇는다.
     * @returns {{end, pid, file}|'carry'|null}  null = 토큰이 아니다(그대로 둔다), 'carry' = 경계에 걸렸다 */
    const parseGoya = (buf, i, isLast) => {
      const p = i + GOYA_PREFIX.length;
      let q = p;
      while (q < buf.length && q - p <= GOYA_SEG_MAX && isSegByte(buf[q])) q++;
      if (q === buf.length && !isLast) return 'carry';
      if (q === p || q - p > GOYA_SEG_MAX || buf[q] !== 0x2f /* / */) return null;
      const r = q + 1;
      let s = r;
      while (s < buf.length && s - r <= GOYA_SEG_MAX && isSegByte(buf[s])) s++;
      if (s === buf.length && !isLast) return 'carry';
      if (s === r || s - r > GOYA_SEG_MAX) return null;
      return { end: s, pid: buf.toString('latin1', p, q), file: buf.toString('latin1', r, s) };
    };

    // 확정 구간은 내보내고 미확정 꼬리를 돌려준다.
    const transform = (buf, isLast) => {
      let pos = 0, scan = 0;
      // 두 토큰의 다음 위치를 각각 기억한다 — 매 반복마다 둘 다 다시 찾으면 버퍼 길이 × 매치 수로 는다.
      let ib = -2, ig = -2;
      while (true) {
        if (ib !== -1 && ib < scan) ib = buf.indexOf(PREFIX, scan);
        if (ig !== -1 && ig < scan) ig = buf.indexOf(GOYA_PREFIX, scan);
        if (ib === -1 && ig === -1) break;

        // ── goya-asset:// 가 더 앞이면 그것부터 (위치 순서대로 처리해야 pos/scan 이 단조 증가한다)
        if (ig !== -1 && (ib === -1 || ig < ib)) {
          const g = parseGoya(buf, ig, isLast);
          if (g === 'carry') break;                       // 토큰이 청크 경계를 넘음 → carry
          if (g === null) { scan = ig + GOYA_PREFIX.length; continue; }   // 토큰 아님 → 그대로 둔다
          const rep = stageGoyaAsset(g.pid, g.file);
          emitText(buf.subarray(pos, ig));
          out.write(rep || buf.subarray(ig, g.end));     // 누락이면 토큰을 «그대로» 남긴다
          pos = g.end; scan = g.end;
          continue;
        }

        const i = ib;
        const j = buf.indexOf(B64MARK, i);
        if (j === -1 || j - i > MIME_MAX) {
          // 경계가 아직 안 보이면 carry로 넘긴다. 아니면 평문 URI라 «그대로 둔다».
          if (j === -1 && !isLast && buf.length - i < SAFE_TAIL) break;
          scan = i + PREFIX.length;
          continue;
        }
        let k = j + B64MARK.length;
        while (k < buf.length && isB64Byte(buf[k])) k++;
        if (k === buf.length && !isLast) {
          if (buf.length - i > MAX_URI_BYTES) { failed = new Error(`단일 data URI가 상한(${MAX_URI_BYTES}B)을 넘었습니다`); return Buffer.alloc(0); }
          break; // base64가 청크 경계를 넘음 → carry
        }
        emitText(buf.subarray(pos, i));
        out.write(writeImage(buf.toString('latin1', i + 5, j), buf.subarray(j + B64MARK.length, k)));
        pos = k; scan = k;
      }
      if (isLast) { emitText(buf.subarray(pos)); return Buffer.alloc(0); }
      // 매치 후보가 없으면 SAFE_TAIL만 남긴다(carry 무한증식 방지)
      const keep = Math.min(buf.length - pos, Math.max(SAFE_TAIL, buf.length - Math.max(pos, scan) + SAFE_TAIL));
      const cut = buf.length - keep;
      if (cut > pos) { emitText(buf.subarray(pos, cut)); return buf.subarray(cut); }
      return buf.subarray(pos);
    };

    const rs = fs.createReadStream(srcPath, { highWaterMark: chunkSize });
    rs.on('error', reject);
    out.on('error', reject);
    rs.on('data', (chunk) => {
      if (failed) return;
      bytesIn += chunk.length;
      const buf = carry.length ? Buffer.concat([carry, chunk]) : chunk;
      carry = transform(buf, false);
      if (failed) { rs.destroy(); return; }
      if (onProgress) onProgress({ phase: 'scan', bytesDone: bytesIn, bytesTotal: totalBytes });
    });
    rs.on('close', () => {
      if (failed) { out.destroy(); reject(failed); return; }
    });
    rs.on('end', () => {
      transform(carry, true);
      if (failed) { out.destroy(); reject(failed); return; }
      out.end(() => resolve({
        images, fonts: fonts.result(), projectJsonPath: outPath,
        bytesIn, inlineRetained: { plainDataUri: inlinePlain, goyaAssetMissing: missingAssets.length }, maxUriBytes: maxUri,
        goyaAssets, missingAssets,
      }));
    });
  });
}

/* ── 2단계: zip 패킹 ──
 * 이미지는 STORE(이미 압축된 포맷 — 실측 DEFLATE 이득 0.5%에 7배 시간), 텍스트만 DEFLATE.
 * yazl은 파일 경로로 스트리밍하므로 60MB를 메모리에 올리지 않는다.
 */
function packZip({ stageDir, manifest, images, outPath, onProgress }) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const ws = fs.createWriteStream(outPath);
    ws.on('error', reject);
    ws.on('close', () => resolve());
    zip.outputStream.on('error', reject);
    zip.outputStream.pipe(ws);

    zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), 'manifest.json', { compress: true });
    zip.addFile(path.join(stageDir, 'project.json'), 'project.json', { compress: true });
    let done = 0;
    for (const img of images) {
      zip.addFile(path.join(stageDir, img.entry), img.entry, { compress: false });
      done += 1;
      if (onProgress) onProgress({ phase: 'zip', entriesDone: done, entriesTotal: images.length });
    }
    zip.end();
  });
}

/* ── 3단계: 왕복 검증 ──
 * 「저장했다」와 「열린다」는 다르다. 쓴 파일을 «새로 열어» 실제로 파싱·대조한다.
 */
function verifyGdt(gdtPath) {
  return new Promise((resolve) => {
    let zfRef = null;
    const done = (r) => { try { zfRef && zfRef.close(); } catch (_) {} resolve(r); };
    const fail = (code, detail) => done({ ok: false, code, detail });
    // ★autoClose:false — 엔트리 열거가 끝나면 yauzl이 파일을 닫아버려서, 그 뒤 본문을 읽으려면
    //   'closed'로 실패한다. 검증은 «열거 후에» 본문을 읽으므로 수동 close가 필요하다.
    yauzl.open(gdtPath, { lazyEntries: true, autoClose: false }, (err, zf) => {
      if (err) return fail('zip_open_failed', err.message);
      zfRef = zf;
      const entries = new Map();
      let emitted = 0, badName = null, dupName = null;
      zf.on('error', (e) => fail('zip_read_failed', e.message));
      zf.on('entry', (entry) => {
        emitted += 1;
        // ★이름 허용목록 — 검증 단계에서도 본다. 불러오기만 막으면 「검증은 통과인데
        //   열리진 않는」 상태가 되고, 그건 원인을 못 찾는 실패다.
        if (!ENTRY_NAME_RE.test(entry.fileName) && !badName) badName = entry.fileName;
        // ★zip 은 같은 이름을 여러 번 담을 수 있다. Map 은 조용히 마지막 것만 남긴다 —
        //   그래서 «방출 횟수»와 «고유 개수»를 따로 세야 중복을 알 수 있다.
        if (entries.has(entry.fileName) && !dupName) dupName = entry.fileName;
        entries.set(entry.fileName, entry);
        zf.readEntry();
      });
      zf.on('end', async () => {
        const deadline = makeDeadline();
        try {
          // ★엔트리를 통째 Buffer 로 올린다 ⇒ 압축 폭탄이 디스크가 아니라 RSS 를 친다.
          //   압축 해제 «전»에 uncompressedSize 로 거르고, 스트리밍 중에도 누적 검사한다
          //   (헤더의 크기는 «남이 쓴 값»이라 그것만 믿으면 안 된다).
          const readEntry = (name, cap = LIMITS.SINGLE_ENTRY_BYTES) => new Promise((res, rej) => {
            const e = entries.get(name);
            if (!e) return rej(new Error(`entry_missing:${name}`));
            if (e.uncompressedSize > cap) return rej(new Error(`entry_too_large:${name}:${fmtMB(e.uncompressedSize)}`));
            zf.openReadStream(e, (er, rs) => {
              if (er) return rej(er);
              const bufs = [];
              let n = 0;
              rs.on('data', (d) => {
                n += d.length;
                if (n > cap) { rs.destroy(); rej(new Error(`entry_too_large:${name}`)); return; }
                bufs.push(d);
              });
              rs.on('error', rej);
              rs.on('end', () => res(Buffer.concat(bufs)));
            });
          });

          // 구조 상한 — 파싱 전에 본다
          if (badName) return fail('unsafe_entry', badName);
          if (dupName || emitted !== entries.size) return fail('duplicate_entry', dupName || `${emitted}개 중 고유 ${entries.size}개`);
          if (entries.size > LIMITS.ENTRY_COUNT) return fail('too_many_entries', String(entries.size));
          let totalUncompressed = 0;
          for (const [name, e] of entries) {
            const sz = e.uncompressedSize || 0;
            // ★모든 엔트리에 단일 상한을 건다 — 우리가 «읽는» 엔트리만 보면
            //   manifest 에 없는 엔트리에 폭탄을 숨길 수 있다(실측으로 실제 통과했다).
            if (sz > LIMITS.SINGLE_ENTRY_BYTES) return fail('entry_too_large', `${name}:${fmtMB(sz)}`);
            totalUncompressed += sz;
          }
          if (totalUncompressed > LIMITS.TOTAL_UNCOMPRESSED) return fail('archive_too_large', fmtMB(totalUncompressed));

          if (!entries.has('manifest.json')) return fail('manifest_missing');
          if (!entries.has('project.json')) return fail('project_json_missing');

          const manifest = JSON.parse((await readEntry('manifest.json')).toString('utf8'));
          if (manifest.formatVersion > FORMAT_VERSION) return fail('format_version_future', String(manifest.formatVersion));
          if ((manifest.images || []).length > LIMITS.IMAGE_COUNT) return fail('too_many_images', String(manifest.images.length));

          /* ★§11-2 폰트 목록 — 여기가 «경계»다.
           *   이 값은 그대로 렌더러로 넘어가 ①화면에 그려지고 ②사용자의 «선택지»가 되고
           *   ③고른 값이 프로젝트 파일에 글자로 써진다. 남이 준 값이 우리 문서의 문법이 되는 길이라
           *   개수·길이·타입을 여기서 끊는다. ★자르지 않고 «거부»한다 — 부분 복원 금지 원칙.
           *   (문자열 아닌 값은 우리 내보내기가 만들지 않는다. 형식이 바뀌면 formatVersion 이 막는다.) */
          const fonts = manifest.fonts;
          if (fonts != null && !Array.isArray(fonts)) return fail('fonts_malformed', `타입 ${typeof fonts}`);
          if ((fonts || []).length > LIMITS.FONT_COUNT) return fail('too_many_fonts', String(fonts.length));
          for (const f of fonts || []) {
            if (typeof f !== 'string') return fail('fonts_malformed', `항목 타입 ${f === null ? 'null' : typeof f}`);
            if (f.length > LIMITS.FONT_NAME_CHARS) return fail('font_name_too_long', `${f.length}자`);
          }

          // ★manifest.images 에 «같은 entry 를 여러 번» 나열하는 우회를 직접 막는다.
          //   두장 2차 실증: 이미지 1개를 1000번 나열하면 「원복 수 == images.length」가
          //   성립해 개수 검사를 «통과의 열쇠»로 바꿔버린다(82KB → 101MB, 1,233배).
          //   ⇒ 개수 검사는 방어가 아니다. entry 는 «유일»해야 한다.
          const imgEntries = (manifest.images || []).map(i => i && i.entry);
          if (new Set(imgEntries).size !== imgEntries.length) {
            return fail('duplicate_manifest_entry', `${imgEntries.length}개 중 고유 ${new Set(imgEntries).size}개`);
          }

          // project.json 은 외부화 후 작다(실측 0.13~0.51MB). 그래서 풀파싱하되,
          // ★공격자는 1GB 로 만들 수 있으므로 «크기 상한을 걸고» 읽는다.
          const projRaw = (await readEntry('project.json', LIMITS.PROJECT_JSON_BYTES)).toString('utf8');
          let proj;
          try { proj = JSON.parse(projRaw); } catch (e) { return fail('project_json_unparsable', e.message); }

          // 참조 ↔ 엔트리 대조: project.json이 가리키는 gdt:// 가 전부 실존해야 한다
          const refs = [...projRaw.matchAll(/gdt:\/\/(images\/[A-Za-z0-9._-]+)/g)].map(m => m[1]);
          // ★★§11-1 참조 증폭: 여기서 «고유»만 보던 게 구멍이었다. 이미지 1장 + 참조 10만 개면
          //   고유는 1개라 통과하고, 불러오기가 10만 번 원복해 수 GB 를 쓴다.
          //   실측 재현: 4,042B 입력 → 디스크에 63,507,495B (15,712배). ⇒ «전체» 개수를 본다.
          if (refs.length > LIMITS.REF_TOTAL) return fail('too_many_references', String(refs.length));

          // ★★§11-1ⓐ 증폭의 «근본» 방어: formatVersion 1 의 내보내기는 base64 출현 «하나»마다
          //   엔트리를 «하나» 만든다(dedup 없음) ⇒ 정상 파일은 항상
          //       refs 개수 == manifest.images 개수 == 고유 참조 개수
          //   가 성립한다(실측: 46/46/46 · 54/54/54 · 38/38/38 · 0/0/0 · 46/46/46).
          //   증폭 공격은 이 등식을 반드시 깬다(이미지 1 : 참조 N). 크기와 무관하게 잡힌다.
          //   ⇒ 기존의 「원복 수 불일치」 검사를 «쓰기 전»으로 끌어올린 것이기도 하다.
          const nImages = (manifest.images || []).length;
          const nUnique = new Set(refs).size;
          if (refs.length !== nImages || nUnique !== refs.length) {
            return fail('reference_count_mismatch', `refs=${refs.length} unique=${nUnique} images=${nImages}`);
          }
          // 원복 시 출력 예상치도 미리 막는다(base64 는 4/3 로 부푼다)
          const bytesByEntry = new Map([...entries].map(([k, e]) => [k, e.uncompressedSize || 0]));
          let projectedOut = projRaw.length;
          for (const r of refs) projectedOut += Math.ceil((bytesByEntry.get(r) || 0) * 4 / 3);
          if (projectedOut > LIMITS.OUTPUT_BYTES) return fail('output_too_large', fmtMB(projectedOut));

          const missing = [...new Set(refs)].filter(r => !entries.has(r));
          if (missing.length) return fail('referenced_image_missing', missing.slice(0, 5).join(','));

          // ★엔트리 화이트리스트: 정상 .gdt 는 manifest.json + project.json + manifest 의 이미지가 «전부»다.
          //   그 밖의 엔트리는 «밀반입»이다 — 실측에서 manifest 에 없는 200MB 폭탄이 이 검사가 없어 통과했다.
          //   isSafeEntry(불러오기)와 같은 화이트리스트 원칙을 검증 단계에도 세운다.
          const allowed = new Set(['manifest.json', 'project.json', ...(manifest.images || []).map(i => i.entry)]);
          const stowaways = [...entries.keys()].filter(n => !allowed.has(n));
          if (stowaways.length) return fail('unexpected_entry', stowaways.slice(0, 5).join(','));

          // 남은 base64가 있으면 외부화가 덜 된 것 — 단, 평문 URI는 «남는 게 정상»이다(§2)
          const leftoverB64 = (projRaw.match(/data:image\/[a-zA-Z0-9.+-]+;base64,/g) || []).length;
          if (leftoverB64 > 0) return fail('base64_left_in_project_json', String(leftoverB64));

          // 이미지 전량: sha256 대조 + ★래스터/SVG 분리 디코드 검사(§5)
          const badHash = [], badDecode = [];
          for (const img of manifest.images) {
            deadline.check('verify:images');
            if (!entries.has(img.entry)) return fail('manifest_image_missing', img.entry);
            const buf = await readEntry(img.entry);
            if (crypto.createHash('sha256').update(buf).digest('hex') !== img.sha256) badHash.push(img.entry);
            const p = probeImage(buf, img.mime);
            if (!p.ok) badDecode.push(`${img.entry}:${p.error}`);
          }
          if (badHash.length) return fail('sha256_mismatch', badHash.slice(0, 5).join(','));
          if (badDecode.length) return fail('image_decode_failed', badDecode.slice(0, 5).join(','));

          done({
            ok: true,
            entries: entries.size,
            images: manifest.images.length,
            refs: refs.length,
            uniqueRefs: new Set(refs).size,
            pages: Array.isArray(proj.pages) ? proj.pages.length : 0,
            fonts: manifest.fonts,
            projectJsonBytes: Buffer.byteLength(projRaw),
          });
        } catch (e) {
          const msg = (e && e.message) || String(e);
          // 상한 위반은 «전용 코드»로 올린다 — 사용자 문구가 달라야 하고, 원인을 뭉개면 안 된다.
          if (/^entry_too_large/.test(msg)) return fail('entry_too_large', msg.split(':').slice(1).join(':'));
          if (e && e.code === 'timeout') return fail('timeout', e.detail);
          fail('verify_exception', msg);
        }
      });
      zf.readEntry();
    });
  });
}

/* ── 진입점 ──
 * @param {string} srcProjJson   원본 proj.json 경로
 * @param {string} outPath       최종 .gdt 경로
 * @param {object} meta          { name, sourceId, appVersion }
 * @param {function} onProgress  ({phase, ...}) => void
 * @param {string}   projectsDir  goya-asset:// 해석 루트. 없으면 `<projectsDir>/<pid>/proj.json` 배치를 가정해 src 에서 유도한다.
 *
 * ★§8 완료 훅: `<out>.part`에 쓰고 «검증 통과 후에만» rename한다.
 *   ⇒ 최종 경로에 파일이 «존재한다» = 완료됐고 검증도 통과했다. 부분 파일은 관측될 수 없다.
 * ★goya 에셋 누락은 «실패가 아니라 경고»다 — 원본 맥에서도 이미 깨진 참조라 내보내기를 막을 이유가 없다.
 *   대신 result.missingAssets · manifest.missingAssets 에 전부 적어 호출측이 알리게 한다.
 */
async function exportGdt({ srcProjJson, outPath, meta = {}, onProgress = null, tmpDir = null, projectsDir = null, chunkSize = CHUNK }) {
  const t0 = Date.now();
  const stageDir = fs.mkdtempSync(path.join(tmpDir || os.tmpdir(), 'goditor-gdt-'));
  const partPath = outPath + '.part';
  let peakRss = process.memoryUsage().rss;
  const rssTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 50);
  if (!projectsDir) {
    // 디렉터리 레이아웃 `<projectsDir>/<pid>/proj.json` 이면 두 단계 위, flat 레거시 `<projectsDir>/proj_<id>.json` 이면 한 단계 위
    projectsDir = path.basename(srcProjJson) === 'proj.json' ? path.dirname(path.dirname(srcProjJson)) : path.dirname(srcProjJson);
  }

  try {
    const t = await transformProjectJson({ srcPath: srcProjJson, stageDir, onProgress, projectsDir, chunkSize });

    const manifest = {
      formatVersion: FORMAT_VERSION,
      app: { name: 'GODITOR', version: meta.appVersion || '0.0.0' },
      project: {
        name: meta.name || 'Untitled',
        sourceId: meta.sourceId || null,
        exportedAt: new Date().toISOString(),
      },
      fonts: t.fonts,
      images: t.images,
      // ★§2: 평문 data URI는 인라인으로 «남는 게 정상». 안 적으면 검증이 «유실»로 오판한다.
      inlineRetained: t.inlineRetained,
      // goya-asset 중 동봉 못 한 참조(원본 맥에서 에셋 파일이 없던 것). 불러오는 쪽이 「왜 깨졌나」를 파일만 보고 안다.
      missingAssets: t.missingAssets,
    };

    if (onProgress) onProgress({ phase: 'zip', entriesDone: 0, entriesTotal: t.images.length });
    await packZip({ stageDir, manifest, images: t.images, outPath: partPath, onProgress });

    if (onProgress) onProgress({ phase: 'verify' });
    const verify = await verifyGdt(partPath);
    if (!verify.ok) {
      try { fs.unlinkSync(partPath); } catch (_) {}
      return { ok: false, error: `왕복 검증 실패: ${verify.code}${verify.detail ? ` (${verify.detail})` : ''}`, verify };
    }

    fs.renameSync(partPath, outPath);   // ★검증 통과 후에만 최종 이름이 된다
    clearInterval(rssTimer);

    const result = {
      ok: true, path: outPath,
      bytes: fs.statSync(outPath).size,
      sourceBytes: t.bytesIn,
      images: t.images.length,
      goyaAssets: t.goyaAssets,            // images 중 goya-asset:// 에서 동봉한 수
      missingAssets: t.missingAssets,      // [{url, reason}] — 비어 있지 않으면 호출측이 경고해야 한다
      fonts: t.fonts,
      inlineRetained: t.inlineRetained,
      projectJsonBytes: verify.projectJsonBytes,
      elapsedMs: Date.now() - t0,
      peakRssMB: +(peakRss / 1048576).toFixed(1),
      verify,
    };
    if (onProgress) onProgress({ phase: 'done', result });
    return result;
  } catch (e) {
    try { fs.unlinkSync(partPath); } catch (_) {}
    return { ok: false, error: (e && e.message) || String(e) };
  } finally {
    clearInterval(rssTimer);
    try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = { exportGdt, verifyGdt, transformProjectJson, FORMAT_VERSION, extForMime, ENTRY_NAME_RE, ENTRY_EXTS };
