/* _longtask — DOM 시험용 longtask 자(시트 207·208 · 지디 261028 «⛔몇 ms 아니라 ★몇 개»).
 *   start(page)  — PerformanceObserver({type:'longtask'}) 를 건다. 콜백이 받은 것 + takeRecords() 를 합쳐 센다
 *                  (⚠️takeRecords 만 보면 0 이다 — 콜백이 이미 가져간 것은 거기 없다 · 하네스 실측 261028).
 *   mark(page, k) — 단계 꼬리표. 그 뒤 시작한(startTime ≥) longtask 는 그 단계 몫이다.
 *   settle(page) — rAF 두 번 · 앞 작업(그리기까지)이 끝났다 = 그 longtask 는 이미 줄에 섰다(고정 대기 0).
 *   count(page)  — 단계별 { n: LT_FLOOR_MS 이상 개수, ms: 전부(로그용) }. ★단언은 n 만 — ms 는 판·부하 따라 반쯤 흔들린다(지디 실측).
 * ★LT_FLOOR_MS = 100 — ★100ms 미만 longtask 는 안 센다(ms 배열엔 남긴다 · 지디 판정 261028 «문턱 100 GO»). 브라우저 문턱 50 그대로 세면 50~74ms 짜리가 런마다 0~5 개 끼어 개수가 흔들렸다
 *   (실측 261028 · 809d7cf5 · 같은 장면 ×3: 50 문턱 끄는 단계 10·6·7 → 100 문턱 5·5·5). ⛔문턱을 낮추지 마라 — 자가 부하를 잰다.
 *   ⚠️못 보는 꼴: 같은 작업 안에서 무거워지기만 하면(한 걸음 300ms → 600ms) 개수는 그대로다 — 개수 자는 «따로 떨어진 작업이 늘었나» 만 본다. */
const LT_FLOOR_MS = 100;

async function start(page) {
  await page.evaluate(() => {
    window.__ltBuf = []; window.__ltMarks = [];
    window.__ltObs = new PerformanceObserver(l => window.__ltBuf.push(...l.getEntries()));
    window.__ltObs.observe({ type: 'longtask' });
  });
}
const settle = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const mark = (page, k) => page.evaluate((k) => window.__ltMarks.push([k, performance.now()]), k);
async function count(page) {
  return page.evaluate((floor) => {
    const all = [...window.__ltBuf, ...window.__ltObs.takeRecords()];
    window.__ltBuf = all;
    const out = {};
    for (const [k] of window.__ltMarks) out[k] = { n: 0, ms: [] };
    for (const e of all) {
      let k = null;
      for (const [m, t] of window.__ltMarks) if (e.startTime >= t) k = m;
      if (k === null) continue;
      const d = Math.round(e.duration);
      out[k].ms.push(d); if (d >= floor) out[k].n++;
    }
    return out;
  }, LT_FLOOR_MS);
}

module.exports = { LT_FLOOR_MS, start, settle, mark, count };
