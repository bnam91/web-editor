/* export-gate core — 내보내기 픽셀검사의 «순수» 계층.
 *
 * 여기엔 DOM 이 없다. 이유 둘:
 *   ⑴ tests/unit 은 Electron 없이 돈다 — 판정 술어가 DOM 을 만지면 거기서 못 잰다.
 *   ⑵ 비교 루프를 나중에 Worker 로 옮길 때 «같은 파일을 import» 하면 되게 하려고.
 *
 * ★수치는 `~/.claude/skills/goditor-export-qa/scripts/pixdiff.py` 의 «이식»이다.
 *   python 이 «검산 기준»이고 이 파일이 python 에 맞춘다(그 반대 아님).
 *   PLAN-export-gate.md §5 E4 = 같은 입력에서 두 구현의 total/maxCell/bandCount/blobPx 가
 *   «자릿수까지» 같아야 한다. 안 맞으면 이 파일이 틀린 것이다.
 */

/* ── 임계 — «한 곳»에만 적는다. 모달·토스트·콘솔은 판정 결과를 읽기만 한다 ── */
export const TH        = 40;  // 밝기차 임계(pixdiff.py:23)
export const CELL      = 16;  // 국소 격자 한 변(:33)
export const CELL_MAX  = 60;  // 한 칸 밀도 임계(:34) — P0 사용자 노출엔 «안» 쓴다(§2.4)
export const TOTAL_MAX = 1;   // 전역 픽셀 임계(:25)  — P0 사용자 노출엔 «안» 쓴다(§2.4)
export const INK       = 40;  // 잉크 임계(:70)
export const ROWMIN    = 3;   // 글자 있는 행 최소 잉크(:71)

/* ★blob 축 임계 — PLAN §5 E1·E2 가 «숫자»를 내기 전까지 Infinity = «꺼짐».
 *   판정 규칙은 플랜에 미리 박혀 있다: B = 2 × (음성 표본 blobPx 최대), 단 양성대조
 *   M1·M3·M6 이 «전부» ≥ 10 × B 일 때만 이 축을 켠다. 갈리지 않으면 값을 안 바꾸고
 *   「P0 가 못 보는 결함」 목록에 이름을 적는다(봐주는 규칙을 만들지 않는다). */
export let BLOB_MIN = Infinity;
export function _setBlobMin(v) { BLOB_MIN = v; }   // 테스트·실험 전용

/* ── PIL 의 RGB→L ──
 * ⚠️«채널 최대»(three-way.py 방식)가 아니다. Pillow Convert.c 의 정수식 그대로:
 *     L = (R*19595 + G*38470 + B*7471 + 0x8000) >> 16
 *   [실측] 이 식이라서 «파랑만 255 다른 그림»은 L=29 < 40 이라 TOTAL 0 이 된다
 *   — 색상(hue) 축은 이 검사가 «안 보는 축»이다(PLAN §2.4). */
export function pilLuma(r, g, b) {
  return (r * 19595 + g * 38470 + b * 7471 + 32768) >> 16;
}

/** RGBA 버퍼 → PIL 식 L 평면(Uint8Array). alpha 는 «버린다»(PIL convert('RGB') 와 동일). */
export function toLumaPlane(img) {
  const { width: W, height: H, data } = img;
  const out = new Uint8Array(W * H);
  for (let i = 0, p = 0; p < out.length; p++, i += 4) {
    out[p] = pilLuma(data[i], data[i + 1], data[i + 2]);
  }
  return out;
}

/** 두 RGBA 버퍼의 |ΔR|,|ΔG|,|ΔB| 를 PIL L 로 접은 평면. (ImageChops.difference().convert('L')) */
function diffLumaPlane(a, b) {
  const { width: W, height: H } = a;
  const out = new Uint8Array(W * H);
  const da = a.data, db = b.data;
  for (let i = 0, p = 0; p < out.length; p++, i += 4) {
    const dr = Math.abs(da[i]     - db[i]);
    const dg = Math.abs(da[i + 1] - db[i + 1]);
    const dbl= Math.abs(da[i + 2] - db[i + 2]);
    out[p] = pilLuma(dr, dg, dbl);
  }
  return out;
}

/* ── 잉크 프로파일(pixdiff.py:73-77 `_profile`) ── */
function inkProfile(lum, W, H) {
  // 배경 = «최빈» 밝기. 흰색이라고 가정하지 않는다.
  // ⚠️np.bincount(...).argmax() 는 동률이면 «작은 인덱스»를 준다 → 엄격 부등호로 같은 규칙.
  const hist = new Float64Array(256);
  for (let i = 0; i < lum.length; i++) hist[lum[i]]++;
  let bg = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[bg]) bg = v;

  const ink = new Uint8Array(W * H);
  const rows = new Int32Array(H);
  for (let y = 0, p = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++, p++) {
      if (Math.abs(lum[p] - bg) > INK) { ink[p] = 1; c++; }
    }
    rows[y] = c;
  }
  return { ink, rows };
}

/* pixdiff.py:79-85 `_bands` — rows >= ROWMIN 인 연속 구간 */
function inkBands(rows) {
  const out = []; let y0 = null;
  for (let y = 0; y < rows.length; y++) {
    const v = rows[y] >= ROWMIN;
    if (v && y0 === null) y0 = y;
    else if (!v && y0 !== null) { out.push([y0, y]); y0 = null; }
  }
  if (y0 !== null) out.push([y0, rows.length]);
  return out;
}

/* pixdiff.py:87-89 `_xspan` */
function xspan(ink, W, y0, y1) {
  let lo = -1, hi = -1;
  for (let y = y0; y < y1; y++) {
    const base = y * W;
    for (let x = 0; x < W; x++) {
      if (ink[base + x]) { if (lo < 0 || x < lo) lo = x; if (x > hi) hi = x; }
    }
  }
  return lo < 0 ? [null, null] : [lo, hi];
}

/* ── 구조 층(pixdiff.py:91-125 `structural`) ── */
function structural(expLum, truLum, W, H, out) {
  // ★TOTAL 이 0 이면 구조 위반은 «성립할 수 없다» — 잉크 마스크가 임계 근처에서 갈려
  //   «완전히 같은 그림»에 구조 FAIL 을 붙이던 인공물을 막는 자리다(python 주석 박제).
  if (out.total === 0 && !out.sizeMismatch) {
    out.struct = 'PASS'; out.maxDy = 0; out.maxDx = 0; out.bandCount = 0; out.bandMismatch = false;
    return;
  }
  if (out.sizeMismatch) {
    out.struct = 'FAIL'; out.maxDy = -1; out.maxDx = -1; out.bandCount = -1; out.bandMismatch = false;
    return;
  }
  const e = inkProfile(expLum, W, H);
  const t = inkProfile(truLum, W, H);
  let esum = 0, tsum = 0;
  for (let y = 0; y < H; y++) { esum += e.rows[y]; tsum += t.rows[y]; }
  if (esum === 0 && tsum === 0) {
    // ⚠️잉크 0 = «잴 게 없다». PASS 가 아니라 N/A 다.
    out.struct = 'N/A'; out.maxDy = 0; out.maxDx = 0; out.bandCount = 0; out.bandMismatch = false;
    return;
  }
  const eb = inkBands(e.rows), tb = inkBands(t.rows);
  out.bandCount = eb.length;
  out.truthBandCount = tb.length;
  if (eb.length !== tb.length) {
    out.struct = 'FAIL'; out.maxDy = -1; out.maxDx = -1; out.bandMismatch = true;
    return;
  }
  out.bandMismatch = false;
  let dy = 0, dx = 0;
  for (let i = 0; i < eb.length; i++) {
    const [a0, a1] = eb[i], [b0, b1] = tb[i];
    dy = Math.max(dy, Math.abs(a0 - b0), Math.abs(a1 - b1));
    const ax = xspan(e.ink, W, a0, a1), bx = xspan(t.ink, W, b0, b1);
    if (ax[0] === null || bx[0] === null) continue;
    dx = Math.max(dx, Math.abs(ax[0] - bx[0]), Math.abs(ax[1] - bx[1]));
  }
  out.maxDy = dy; out.maxDx = dx; out.struct = 'PASS';
  // ⛔dx 는 P0 판정에 «안» 쓴다 — 전수 223 중 8건이 dx 1~12 로 뜨는데 원인 미상이다.
  //   값은 남긴다(P1 에서 규명한 뒤 결정).
}

/**
 * export 캔버스 vs truth 캔버스 → metrics. DOM 무의존(순수 배열).
 * @param {{width:number,height:number,data:Uint8ClampedArray|Uint8Array}} exp
 * @param {{width:number,height:number,data:Uint8ClampedArray|Uint8Array}} tru
 */
export function compareRGBA(exp, tru) {
  const out = {
    expSize: [exp.width, exp.height], truthSize: [tru.width, tru.height],
    sizeMismatch: exp.width !== tru.width || exp.height !== tru.height,
    total: 0, maxCell: 0, maxCellAt: null, blobPx: 0, bands: [],
    struct: 'PASS', bandCount: 0, truthBandCount: 0, bandMismatch: false, maxDy: 0, maxDx: 0,
    measured: true,
  };
  if (out.sizeMismatch) {
    // ⚠️python 은 여기서 LANCZOS 리사이즈 후 밴드 국소화를 «계속» 한다(어디가 밀렸는지 보려고).
    //   브라우저에는 그 리샘플러가 없다 — 흉내 내면 «다른 숫자»를 같은 이름으로 부르게 된다.
    //   ⇒ 크기가 다르면 픽셀 수치를 «안 잰다»(null). 판정에는 sizeMismatch 하나로 충분하다.
    //   (E4 검산은 크기가 «같은» 쌍에서만 수치를 대조한다 — IMPL 문서에 명시.)
    out.total = null; out.maxCell = null; out.blobPx = null;
    out.struct = 'FAIL'; out.maxDy = -1; out.maxDx = -1; out.bandCount = -1;
    return out;
  }
  const W = exp.width, H = exp.height;
  const d = diffLumaPlane(exp, tru);

  // ── 전역 TOTAL — x 를 «전부» 센다 ──
  let total = 0;
  const rowDiff = new Int32Array(H);
  for (let y = 0, p = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++, p++) if (d[p] > TH) c++;
    rowDiff[y] = c; total += c;
  }
  out.total = total;

  // ── blobPx: 3×3 침식 후 남는 픽셀 «면»만 남기는 축(pixdiff.py:147-158) ──
  if (H > 2 && W > 2) {
    let blob = 0;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (d[y * W + x] <= TH) continue;
        let all = true;
        for (let dy = -1; dy <= 1 && all; dy++) {
          const base = (y + dy) * W;
          for (let dx = -1; dx <= 1; dx++) {
            if (d[base + x + dx] <= TH) { all = false; break; }
          }
        }
        if (all) blob++;
      }
    }
    out.blobPx = blob;
  }

  // ── 국소 — 16×16 격자, CELL/2 만큼 어긋내 «네 번» 훑고 최대 ──
  //   고정 격자 하나면 결함이 칸 경계에 걸칠 때 밀도가 네 칸으로 쪼개져 빠져나간다.
  const HALF = CELL >> 1;
  let best = 0, bestAt = null;
  for (const oy of [0, HALF]) {
    for (const ox of [0, HALF]) {
      for (let gy = -oy; gy < H; gy += CELL) {
        const y0 = Math.max(0, gy), y1 = Math.min(gy + CELL, H);
        if (y0 >= y1) continue;
        for (let gx = -ox; gx < W; gx += CELL) {
          const x0 = Math.max(0, gx), x1 = Math.min(gx + CELL, W);
          if (x0 >= x1) continue;
          let c = 0;
          for (let y = y0; y < y1; y++) {
            const base = y * W;
            for (let x = x0; x < x1; x++) if (d[base + x] > TH) c++;
          }
          if (c > best) { best = c; bestAt = [x0, y0]; }
        }
      }
    }
  }
  out.maxCell = best; out.maxCellAt = bestAt;

  // ── 밴드 국소화(보고용, pixdiff.py:176-190) ──
  const bands = []; let inb = false, by0 = 0;
  for (let y = 0; y < H; y++) {
    const c = rowDiff[y];
    if (c > 6 && !inb) { inb = true; by0 = y; }
    else if (c <= 6 && inb) {
      inb = false;
      if (y - by0 > 2) { let s = 0; for (let k = by0; k < y; k++) s += rowDiff[k]; bands.push([by0, y, s]); }
    }
  }
  if (inb) { let s = 0; for (let k = by0; k < H; k++) s += rowDiff[k]; bands.push([by0, H, s]); }
  bands.sort((a, b) => b[2] - a[2]);
  for (const [y0, y1, tot] of bands.slice(0, 8)) {
    let x0 = null, x1 = null;
    for (let y = y0; y < Math.min(y1, y0 + 20); y++) {
      const base = y * W;
      for (let x = 0; x < W; x += 3) {
        if (d[base + x] > TH) { if (x0 === null || x < x0) x0 = x; if (x1 === null || x > x1) x1 = x; }
      }
    }
    out.bands.push({ y0, y1, diff: tot, x0, x1 });
  }

  structural(toLumaPlane(exp), toLumaPlane(tru), W, H, out);
  return out;
}

/* ── 사용자에게 보이는 «유일한» 판정 술어 ──
 * 모달·토스트·콘솔·신고 버퍼는 이 함수가 돌려준 객체를 «읽기만» 한다.
 * 임계값을 다른 곳에 다시 적지 않는다. A안(막기)으로 바꿀 때도 이 술어는 안 바뀐다 —
 * 바뀌는 건 «호출자가 결과를 언제 쓰느냐» 하나다(export-image.js 의 triggerDownload 자리).
 *
 * @param {object|null} m   compareRGBA 결과(없으면 null)
 * @param {object} ctx      { native, format, imgTimedOut, captureError, repro }
 * @returns {{tier:'same'|'minor'|'mismatch'|'unmeasured', reasons:string[]}}
 */
export function judgeExportDiff(m, ctx) {
  const c = ctx || {};
  // ⑴ «못 쟀다» 가 먼저다 — 못 잰 것을 「정상」으로도 「문제」로도 말하지 않는다.
  if (c.native === false)          return { tier: 'unmeasured', reasons: ['notNative'] };
  // ⛔GIF 는 팔레트 256색 양자화가 «정상»이다 — 캔버스와 다른 게 당연해서 이 판정기의 축이 아니다.
  if (c.format === 'gif' || c.format === 'gif-anim') return { tier: 'unmeasured', reasons: ['gif'] };
  if (c.captureError)              return { tier: 'unmeasured', reasons: ['captureError'] };
  if (c.imgTimedOut)               return { tier: 'unmeasured', reasons: ['imgTimeout'] };
  if (c.repro === 'unstable')      return { tier: 'unmeasured', reasons: ['unstable'] };
  if (!m || m.measured !== true)   return { tier: 'unmeasured', reasons: ['noMetrics'] };
  if (m.struct === 'N/A')          return { tier: 'unmeasured', reasons: ['noInk'] };

  /* ⑵ 사용자에게 «문제»라고 말하는 축 — 오탐이 «수치로» 0 인 것만.
   *
   * ★P0 에서 이 축은 «하나»다: 크기 불일치.  [실측 2026-09-05, IMPL-export-gate.md ①]
   *   · sizeMismatch — 음성 82행 오탐 0 · 양성 M4(아래 40px 잘림) 8/8 검출.
   *
   * ⛔`bandCount`(줄 밴드 개수)는 «뺐다». 플랜 §5 에 미리 박아 둔 규칙
   *   「음성에서 bandCount 불일치가 1건이라도 나오면 그 축도 뺀다」에 걸렸다 —
   *   코퍼스 sec_84a7j_wc4zr06 @780 이 밴드 17 vs 16 으로 «완전 재현»(5/5, truth 안정)되는
   *   오탐이었다. 재검사로도 안 걸러진다. 결과를 보고 규칙을 고치지 않았다.
   *   값은 계속 «재서 로그에 남긴다» — P1 에서 원인을 잡은 뒤 다시 볼 축이다.
   *
   * ⛔`blobPx`(3×3 침식)도 «안 켰다». 규칙은 B = 2 × 음성최대 이고 양성 M1·M3·M6 이
   *   각각 ≥ 10×B 여야 켠다였는데, 음성최대 578 ⇒ B=1156 ⇒ 필요치 11,560 에 대해
   *   실측은 M1 최대 52 · M6 0 · M3 재현 불가였다. 축이 «안 갈렸다».
   *   ⇒ BLOB_MIN 은 Infinity 로 둔다. 값만 남긴다.
   */
  const reasons = [];
  if (m.sizeMismatch) reasons.push('sizeMismatch');
  if (typeof m.blobPx === 'number' && m.blobPx >= BLOB_MIN) reasons.push('blob');
  if (reasons.length) return { tier: 'mismatch', reasons };

  // ⑶ 미세 픽셀차 — P0 는 사용자에게 «문제»라고 말하지 않는다.
  //   근거: 기준선 22행 중 2행(banner02 힌팅)이 TOTAL 3960·19972 인데 «같은 그림»이다.
  //   그대로 노출하면 banner02 를 쓰는 모든 클라이언트에게 「실패」가 뜬다.
  //   ⚠️그래서 «자간 1px 급 결함»은 여기 섞여 사용자에게 정상으로 보인다(PLAN §2.4 · IMPL ⑥).
  if (m.total > 0) return { tier: 'minor', reasons: [] };
  return { tier: 'same', reasons: [] };
}
