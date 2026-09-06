/* ═══════════════════════════════════════════════════════════════════════════
   judge/pii.mjs — 기록물이 «새는지» 표본 세 종으로 잰다.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 «세 종»인가 (골 §5.7 · feedback_measured_axis_is_not_all_defects)
     한 축의 0건은 결함 0 이 아니다. 홈 경로만 보면 «본문»이 새는 걸 못 본다.
     ⑴ 홈 경로(/Users/<이름> · C:\Users\)  ⑵ 코퍼스 본문 조각 3개  ⑶ goya-asset 파일명
   ⛔보고에 «원문»을 쓰지 않는다 — 나가는 건 sha8 과 길이뿐(골 §8).
   ⚠️커버 범위를 넘어선 문장을 쓰지 마라. 이 자는 «이 세 종»에 대해서만 말한다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fingerprint } from '../lib/fixture.mjs';

function filesUnder(p, out = []) {
  let st; try { st = fs.statSync(p); } catch (_) { return out; }
  if (st.isFile()) { out.push(p); return out; }
  let ents; try { ents = fs.readdirSync(p, { withFileTypes: true }); } catch (_) { return out; }
  for (const e of ents) filesUnder(path.join(p, e.name), out);
  return out;
}

/**
 * @param targets  검사할 파일/폴더 목록(기록 파일·큐 파일 등)
 * @param samples  fixture.piiSamples() 결과
 */
export function judgePii(targets, samples, { maxBytes = 32 * 1024 * 1024 } = {}) {
  const files = targets.flatMap(t => filesUnder(t));
  const axes = [
    ['home', samples.home || []],
    ['corpusText', samples.corpusText || []],
    ['assetName', samples.assetNames || []],
  ];
  const res = {
    judge: 'PII', targets, filesScanned: files.length, hits: [],
    axes: axes.map(([k, v]) => ({ axis: k, sampleCount: v.length,
      samples: v.map(fingerprint) })),          // ⛔원문 아님 — 지문만
    notMeasured: [],
  };
  for (const [axis, list] of axes) {
    if (!list.length) res.notMeasured.push(`${axis}: 표본 0개 — «못 쟀다»(없다가 아니다)`);
  }
  for (const f of files) {
    let txt;
    try {
      if (fs.statSync(f).size > maxBytes) { res.notMeasured.push(`${path.basename(f)}: ${maxBytes}B 초과 — 미검사`); continue; }
      txt = fs.readFileSync(f, 'utf8');
    } catch (_) { continue; }
    for (const [axis, list] of axes) {
      for (const s of list) {
        if (!s) continue;
        if (txt.includes(s)) {
          res.hits.push({ axis, file: f, sample: fingerprint(s),
            at: txt.indexOf(s), context: 'omitted' });  // ⛔주변 문자열도 안 싣는다
        }
      }
    }
  }
  res.coverage = `홈 ${samples.home?.length || 0} · 본문 ${samples.corpusText?.length || 0} · 에셋명 ${samples.assetNames?.length || 0}`;

  /* ★★「못 쟀다」를 「없다」로 읽지 마라 — 이 하네스의 자체검사가 실제로 여기서 나를 잡았다.
     초판은 히트 0 이면 무조건 pass:true 였다. 표본이 0개여도(=아무것도 «안» 찾아본 실행)
     초록이 나왔다. 그게 바로 이 도구가 막으려던 «가짜 초록»이다.
     ⇒ 히트가 있으면 FAIL(우선). 히트가 없는데 «못 잰 축»이 있으면 pass=null(NOT_MEASURED).
       판정을 말하려면 세 축을 «다» 재야 한다(골 §5.7: 한 축의 0건 ≠ 결함 0). */
  if (res.hits.length > 0) { res.pass = false; res.verdict = 'FAIL'; }
  else if (res.notMeasured.length > 0) { res.pass = null; res.verdict = 'NOT_MEASURED'; }
  else { res.pass = true; res.verdict = 'PASS'; }

  res.summary = `PII ${res.verdict} — 파일 ${files.length}개 · 히트 ${res.hits.length}건 (표본: ${res.coverage})` +
    (res.notMeasured.length ? ` · ⚠️못 잰 축 ${res.notMeasured.length}: ${res.notMeasured.join(' / ')}` : '');
  return res;
}
