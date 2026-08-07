/* media-probe.js — .gdt 이미지 무결성 검사
 *
 * ★GDT-SPEC §5: «디코더 하나로 하지 마라».
 *   png/jpeg는 래스터 헤더 파싱, svg+xml은 XML 파싱으로 «갈라서» 검사한다.
 *   래스터 디코더로 SVG를 열면 멀쩡한 파일이 전부 「손상」으로 찍힌다(거짓 양성 확정 사례).
 *
 * 래스터는 헤더에서 픽셀 크기를 뽑는다 — 「바이트가 그 형식의 구조를 갖췄고 크기가 읽힌다」까지
 * 보장한다. 전체 픽셀 디코드는 네이티브 의존이 필요해 쓰지 않는다(윈도우 CI 보호).
 */
'use strict';

/* ── 래스터 ── */

function probePng(buf) {
  if (buf.length < 24) return null;
  // 시그니처 + 첫 청크가 IHDR이어야 한다
  if (buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  if (buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function probeJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }        // 마커 동기화
    const m = buf[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    // SOF0~SOF15 (DHT 0xc4 · JPG 0xc8 · DAC 0xcc 제외)가 크기를 들고 있다
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      if (i + 9 > buf.length) return null;
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

function probeGif(buf) {
  if (buf.length < 10 || buf.toString('latin1', 0, 3) !== 'GIF') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function probeWebp(buf) {
  if (buf.length < 30) return null;
  if (buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') return null;
  const fourcc = buf.toString('latin1', 12, 16);
  if (fourcc === 'VP8X') return { width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1 };
  if (fourcc === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (fourcc === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

/* ── SVG (XML) ──
 * 외부 의존 없이 well-formedness를 본다: 태그 균형 + 인용부호 균형 + <svg> 루트 존재.
 * 완전한 XML 검증은 아니지만 «래스터 디코더로 SVG를 여는» 거짓 양성을 없애는 게 목적이고,
 * 잘린 파일·바이트 훼손은 태그 균형에서 잡힌다.
 */
function probeSvg(buf) {
  let text;
  try { text = buf.toString('utf8'); } catch (_) { return null; }
  if (text.indexOf('<svg') === -1) return null;

  // 태그가 아닌 «구조»를 먼저 걷어낸다 — 주석·XML 선언·DOCTYPE·CDATA.
  // 안 걷어내면 아래 스캔이 이것들을 「깨진 마크업」으로 오판한다.
  const stripPaired = (s, open, close) => {
    let out = '', i = 0;
    for (;;) {
      const a = s.indexOf(open, i);
      if (a === -1) { out += s.slice(i); return { text: out, ok: true }; }
      const b = s.indexOf(close, a + open.length);
      if (b === -1) return { text: '', ok: false };     // 닫히지 않음 = 훼손
      out += s.slice(i, a);
      i = b + close.length;
    }
  };
  for (const [o, c] of [['<!--', '-->'], ['<![CDATA[', ']]>'], ['<?', '?>'], ['<!DOCTYPE', '>']]) {
    const r = stripPaired(text, o, c);
    if (!r.ok) return null;
    text = r.text;
  }

  const stack = [];
  // 속성 구간은 «따옴표 안이 아닌 '>'» 를 만나면 끝난다. 자기닫힘 여부는 매치 전체에서 본다
  // — 속성 패턴이 마지막 '/'를 먹어버려 `<line …/>`를 여는 태그로 오판하던 버그가 있었다.
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m, sawSvg = false, last = 0;
  while ((m = re.exec(text)) !== null) {
    // 태그 사이 구간에 '<'가 남아 있으면 깨진 마크업
    if (text.slice(last, m.index).indexOf('<') !== -1) return null;
    last = re.lastIndex;
    const [full, closing, name] = m;
    const selfClose = /\/\s*>$/.test(full);
    if (name.toLowerCase() === 'svg') sawSvg = true;
    if (closing) {
      if (stack.pop() !== name) return null;          // 닫힘 불일치
    } else if (!selfClose) {
      stack.push(name);
    }
  }
  if (text.slice(last).indexOf('<') !== -1) return null; // 꼬리에 미완성 태그
  if (!sawSvg || stack.length !== 0) return null;

  // 크기는 있으면 읽고 없어도(viewBox만 있는 경우) 통과 — SVG는 크기가 선택이다
  const w = /\bwidth\s*=\s*["']([\d.]+)/.exec(text);
  const h = /\bheight\s*=\s*["']([\d.]+)/.exec(text);
  return { width: w ? parseFloat(w[1]) : null, height: h ? parseFloat(h[1]) : null, vector: true };
}

/* ── 디스패처 ──
 * @returns {{ok:true, kind, width, height} | {ok:false, error}}
 */
function probeImage(buf, mime) {
  const m = String(mime || '').toLowerCase();
  if (!buf || buf.length === 0) return { ok: false, error: 'empty' };

  if (m === 'image/svg+xml') {
    const r = probeSvg(buf);
    return r ? { ok: true, kind: 'vector', ...r } : { ok: false, error: 'svg_parse_failed' };
  }

  const raster = m === 'image/png'  ? probePng(buf)
               : (m === 'image/jpeg' || m === 'image/jpg') ? probeJpeg(buf)
               : m === 'image/gif'  ? probeGif(buf)
               : m === 'image/webp' ? probeWebp(buf)
               : undefined;
  if (raster === undefined) return { ok: false, error: `unsupported_mime:${m}` };
  return raster ? { ok: true, kind: 'raster', ...raster } : { ok: false, error: 'raster_header_invalid' };
}

module.exports = { probeImage, probePng, probeJpeg, probeSvg, probeGif, probeWebp };
