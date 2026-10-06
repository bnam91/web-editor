/* ═══════════════════════════════════════════════════════════════════════════
   collab/index.js — 원격 동시협업의 main 프로세스 쪽 전부.
   ───────────────────────────────────────────────────────────────────────────
   main.js 에는 require + init() 두 줄만 남긴다. 협업이 커져도 main.js 가 안 붓게.

   ★설계 확정사항(정찰로 굳은 것 — 바꾸려면 근거부터)
     - 동기화 단위 = **섹션 1개**. 캔버스가 HTML 문자열이라 CRDT 를 못 얹는다.
     - 충돌 = seq 기반 last-writer-wins, 충돌 시 **keep-both**(서버가 둘 다 보관).
     - 인증 = 기존 auth.json 의 sessionToken. 렌더러엔 «절대» 넘기지 않는다.
     - actorId 는 렌더러(localStorage)가 정본이다. 블록 ID 에 박히는 값과 «같은 값»이어야
       하므로(js/drag-utils.js getActorId) 여기서 새로 만들지 않고 «받아서» 쓴다.
       ⇒ 두 곳이 각자 만들면 「내가 만든 블록」을 내가 못 알아본다.

   ★이 파일이 하지 않는 것
     - 폴링 루프를 돌리지 않는다. «언제 부를지»는 렌더러(에디터)가 안다 —
       사용자가 편집 중인지(USER_BUSY), 어느 섹션을 잡고 있는지는 렌더러 사정이다.
       main 은 부르면 답한다. 타이머를 여기 두면 창이 닫혀도 트래픽이 남는다.
═══════════════════════════════════════════════════════════════════════════ */

const { request } = require('./transport');

/** main.js 가 주입한다 — 이 모듈은 파일 경로·auth 파일 형식을 몰라야 한다. */
let _deps = {
  /** @returns {{email:string, sessionToken:string}|null} */
  readAuth: () => null,
  /** @returns {object} proj_meta.json 내용(없으면 {}) */
  readMeta: (_id) => ({}),
  /** proj_meta.json 을 read-merge-write */
  writeMeta: (_id, _patch) => {},
};

/** 서버가 «대답»했는지 / «말을 안 했는지» 를 가르는 공통 처리.
 *  reason 'offline' 은 재시도하면 되는 것이고, 나머지는 사용자에게 보여줄 답이다. */
async function call(pathname, body) {
  const auth = _deps.readAuth();
  if (!auth || !auth.sessionToken) return { ok: false, reason: 'not_signed_in' };
  let r;
  try {
    r = await request(pathname, { ...body, sessionToken: auth.sessionToken });
  } catch (_) {
    // 조용한 까닭 아님 — 'offline' 으로 «말한다»(호출부가 reason 문장으로 띄운다). 네트워크 실패·타임아웃만 throw 된다(transport.js).
    return { ok: false, reason: 'offline' };
  }
  if (!r.json || typeof r.json !== 'object') {
    // 서버가 HTML 을 준 경우. 404 면 «그 엔드포인트가 아직 배포 안 된 것»이다 —
    // 「멤버가 아니다」와 구분해야 한다(앱만 먼저 나가고 서버가 안 따라온 상태가 실제로 있었다).
    if (r.status === 404) return { ok: false, reason: 'not_deployed' };
    return { ok: false, reason: 'bad_response', status: r.status };
  }
  if (r.status === 401) return { ok: false, reason: r.json.reason || 'invalid_session' };
  /* ★D3(2026-10-06): 서버 라우터(api/collab/[action].js)는 모르는 경로에도 «JSON» 404
   *   {reason:'unknown_action'} 를 준다 — 그래서 위 HTML 갈래로는 「미배포」가 더는 안 잡히고
   *   「접근 권한 없음」이라는 «거짓 문장»이 됐다. 그 이름은 «경로가 없다»는 뜻이므로 not_deployed 다. */
  if (r.status === 404) return { ok: false, reason: r.json.reason === 'unknown_action' ? 'not_deployed' : 'not_a_member' };  // 서버가 존재를 안 알려준다
  /* ★D2: 413 의 본문(sectionId·bytes·limit — 서버 sectionTooLarge)을 «버리지 않는다».
   *   reason 만 too_large 로 맞추고 나머지는 그대로 싣는다 — 무엇이 몇 바이트였는지 말할 재료다. */
  if (r.status === 413) return { ...r.json, ok: false, reason: 'too_large', serverReason: r.json.reason || r.json.error || '', message: r.json.message || '' };
  if (r.status >= 500)  return { ok: false, reason: 'server', status: r.status };
  /* ★D1: 위에서 안 갈린 4xx(400 invalid_body · 429 …)는 서버가 reason 대신 error 를 주기도 한다.
   *   그대로 넘기면 앱은 reason 이 없어 'unknown' 으로 뭉갠다 ⇒ 서버가 준 이름(error)을 reason 으로 싣는다.
   *   ⛔모르는 이름을 지어내지 않는다 — 서버 값이 없으면 'http_<status>' (숫자는 사실이다). */
  if (r.status >= 400 && !r.json.reason) return { ...r.json, ok: false, reason: r.json.error || `http_${r.status}`, status: r.status };
  return { ...r.json, status: r.status };
}

/* ── 프로젝트 ↔ collabRef 연결 ─────────────────────────────────────────────
 * collabRef 는 proj_meta.json 에 산다. marketRef 와 «같은 자리·같은 꼴»이다 —
 * 목록 렌더가 이미 그 필드를 읽어 배지를 그리는 길이 나 있어서, 새 길을 안 낸다.
 */
function getRef(projectId) {
  /* ⚠️meta 를 못 읽으면 «연결 없음»으로 답한다 ⇒ 렌더러는 not_linked(조용한 갈래)로 읽는다. 공동작업본인데 동기화가
   *   안 붙는 꼴이 될 수 있어 «조용히» 두지 않고 main 콘솔에 남긴다(렌더러 문장은 별건 — 2026-10-06 명부 밖 발견). */
  try { return _deps.readMeta(projectId).collabRef || null; } catch (e) { console.error('[collab] proj_meta 읽기 실패 — 연결 없음으로 답한다:', projectId, e && e.message); return null; }
}
function setRef(projectId, collabRef) {
  _deps.writeMeta(projectId, { collabRef: collabRef || null });
}

/** 로컬 프로젝트를 «원격으로 올린다». 이미 올라가 있으면 그 collabRef 를 그대로 준다(멱등). */
/* ⚠️★sections 는 «목차»(sectionId+hash)다. 내용은 안 보낸다.
 *   proj.json 은 캔버스에 base64 이미지가 인라인돼 수십 MB 까지 간다(실측 85MB).
 *   Vercel 서버리스 본문 한도(≈4.5MB)로는 통째 업로드가 구조적으로 불가능하다.
 *   ⇒ register 는 «방»만 만들고, 내용은 push 가 섹션 한 개씩 올린다.
 *   ⚰️(2026-10-06 태양 실측 · 위 문장은 그날의 사실) 서버는 이제 Vercel 이 아니라 Cloudflare 뒤 EC2 다. 천장은 «둘»:
 *     핸들러 1,000,000B(api/_lib/util.js readJsonBody · 초과 = invites 400 invalid_body / push·register 413) ← 실효 천장
 *     어댑터 4,500,000B(ec2-server.js · 초과 413) ← Vercel 값을 «흉내»낸다(사라진 게 아니다)
 *     섹션 700,000B(api/_lib/collab.js MAX_SECTION_BYTES) ← 서버 소스 값 · push 로만 걸려 «못 쟀다»(쓰기 금지)
 *     경계는 invites(읽기)·토큰 없이 바이트 단위로 쟀다(1,000,000→401 · 1,000,001→400 · 4,500,000→400 · 4,500,001→413).
 *     ⚠️배포본 == hompage_app 클론 3f5422d 는 «못 쟀다»(healthz sha 는 정적 배포 마커라 api/ 를 증명하지 않는다 · 정황 셋 일치). */
async function register({ projectId, name, actorId }) {
  const existing = getRef(projectId);
  if (existing && existing.collabId) return { ok: true, ...existing, already: true };
  const r = await call('register', { localProjectId: projectId, name, actorId });
  if (r.ok && r.collabId) {
    const auth = _deps.readAuth();
    const ref = {
      collabId: r.collabId,
      seq: r.seq || 0,
      role: 'owner',
      owner: auth ? auth.email : '',
      joinedAt: new Date().toISOString(),
    };
    setRef(projectId, ref);
    return { ok: true, ...ref };
  }
  return r;
}

/** 원격 연결만 끊는다 — ⚠️로컬 프로젝트는 그대로 남는다(지우지 않는다). */
async function leave({ projectId }) {
  const ref = getRef(projectId);
  if (!ref || !ref.collabId) return { ok: false, reason: 'not_linked' };
  const r = await call('leave', { collabId: ref.collabId });
  // 서버가 「멤버 아님」이라고 답해도 로컬 연결은 끊는 게 맞다 —
  // 이미 끊긴 걸 못 지우면 사용자는 영영 유령 배지를 본다.
  if (r.ok || r.reason === 'not_a_member') { setRef(projectId, null); return { ok: true }; }
  return r;
}

const invite   = (p) => call('invite',   p);
const invites  = (p) => call('invites',  p);
const respond  = (p) => call('respond',  p);
const push     = (p) => call('push',     p);
const pull     = (p) => call('pull',     p);

/**
 * @param {object} deps  { readAuth, readMeta, writeMeta }
 * @param {object} ipcMain
 */
function init(ipcMain, deps) {
  _deps = { ..._deps, ...deps };

  ipcMain.handle('collab:register', (_e, p = {}) => register(p));
  ipcMain.handle('collab:leave',    (_e, p = {}) => leave(p));
  ipcMain.handle('collab:invite',   (_e, p = {}) => invite(p));
  ipcMain.handle('collab:invites',  (_e, p = {}) => invites(p));
  ipcMain.handle('collab:respond',  (_e, p = {}) => respond(p));
  ipcMain.handle('collab:push',     (_e, p = {}) => push(p));
  ipcMain.handle('collab:pull',     (_e, p = {}) => pull(p));
  ipcMain.handle('collab:ref',      (_e, p = {}) => ({ ok: true, ref: getRef(p.projectId) }));
  /* ★진도(seq)를 «남긴다». 안 남기면 앱을 껐다 켤 때마다 0 부터 다시 받아
   *   이미 반영한 변경을 통째로 되받는다(느리고, 지운 섹션이 되살아난다).
   *   합쳐 쓰기 — 다른 meta 필드를 날리지 않게 collabRef 만 갈아끼운다. */
  ipcMain.handle('collab:seq', (_e, p = {}) => {
    const ref = getRef(p.projectId);
    if (!ref || !ref.collabId) return { ok: false, reason: 'not_linked' };
    if (typeof p.seq !== 'number' || p.seq <= (ref.seq || 0)) return { ok: true, seq: ref.seq || 0 };
    setRef(p.projectId, { ...ref, seq: p.seq });
    return { ok: true, seq: p.seq };
  });
}

module.exports = { init, register, leave, invite, invites, respond, push, pull, getRef, setRef };
