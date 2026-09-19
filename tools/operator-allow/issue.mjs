#!/usr/bin/env node
/* 배포판 운영자 허가(operator.allow) 발급 CLI — 0919 3라운드 adminsig.
 *
 *   node tools/operator-allow/issue.mjs keygen [--key <path>]
 *   node tools/operator-allow/issue.mjs machine-id
 *   node tools/operator-allow/issue.mjs issue (--machine <64hex> | --this-machine) [--days N] [--note <s>] [--out <path>] [--key <path>]
 *
 * ★개인키 기본 위치 = ~/.config/secrets/goditor-operator-ed25519.pem (레포·앱 밖, 0600).
 * ⛔개인키가 git 레포 안에 있거나 group/other 권한이 열려 있으면 «거부»한다.
 * ⛔개인키·발급한 allow 파일은 커밋 금지(.gitignore: *.allow, goditor-operator-*.pem).
 * 이 폴더(tools/)는 build.files 의 `!tools` 로 앱 번들에 안 들어간다.
 * 자세한 절차 = 같은 폴더 README.md.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const OA = require(path.join(REPO, 'services', 'operator-allow.js'));

const KID = 'op1';
const DEFAULT_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function die(msg, code = 2) { process.stderr.write(`⛔ ${msg}\n`); process.exit(code); }

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--this-machine') out.thisMachine = true;
    else if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) die(`--${k} 에 값이 없습니다`);
      out[k] = v; i++;
    } else out._.push(a);
  }
  return out;
}

function defaultKeyPath() { return path.join(os.homedir(), '.config', 'secrets', 'goditor-operator-ed25519.pem'); }

function realish(p) {
  // 파일이 아직 없을 수 있다 → 존재하는 가장 가까운 조상을 realpath 로 풀고 나머지를 붙인다
  let cur = path.resolve(p); const rest = [];
  while (!fs.existsSync(cur)) { rest.unshift(path.basename(cur)); const up = path.dirname(cur); if (up === cur) break; cur = up; }
  try { cur = fs.realpathSync(cur); } catch (_) {}
  return path.join(cur, ...rest);
}

function gitTop(dir) {
  try {
    return fs.realpathSync(execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch (_) { return null; }
}

function inside(child, parent) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** 개인키 경로 규칙 — 레포(이 도구의 레포 + 그 경로가 속한 git 레포) 밖이어야 한다. */
function assertKeyPathOutsideRepo(keyPath, label = '개인키') {
  const kp = realish(keyPath);
  let repoReal = REPO; try { repoReal = fs.realpathSync(REPO); } catch (_) {}
  if (inside(kp, repoReal)) die(`${label} 경로가 레포 안입니다: ${kp}`);
  let probe = path.dirname(kp);
  while (!fs.existsSync(probe)) { const up = path.dirname(probe); if (up === probe) break; probe = up; }
  const top = gitTop(probe);
  if (top && inside(kp, top)) die(`${label} 경로가 git 레포(${top}) 안입니다: ${kp}`);
  return kp;
}

function readPrivateKey(keyPath) {
  const kp = assertKeyPathOutsideRepo(keyPath);
  let st;
  try { st = fs.statSync(kp); } catch (_) { die(`개인키가 없습니다: ${kp} (먼저 keygen)`); }
  if (process.platform === 'win32') {
    // NTFS 는 mode 비트가 권한을 말해 주지 않는다 — 검사하는 척하지 않고 «못 봤다»고 알린다.
    process.stderr.write('⚠️ 윈도우에서는 개인키 파일 권한(ACL)을 검사하지 않습니다 — 본인 계정만 읽을 수 있는지 직접 확인하세요.\n');
  } else if ((st.mode & 0o077) !== 0) {
    die(`개인키 권한이 group/other 에 열려 있습니다(${(st.mode & 0o777).toString(8)}) — chmod 600 ${kp}`);
  }
  const key = crypto.createPrivateKey(fs.readFileSync(kp, 'utf8'));
  if (key.asymmetricKeyType !== 'ed25519') die('개인키가 Ed25519 가 아닙니다');
  return key;
}

function thisMachine() {
  const raw = OA.rawMachineUuid({ platform: process.platform, execFileSync, readFileSync: fs.readFileSync });
  const id = OA.machineIdFrom(raw);
  if (!id) die('이 기기의 UUID 를 읽지 못했습니다', 3);
  return id;
}

function cmdKeygen(args) {
  const kp = assertKeyPathOutsideRepo(args.key || defaultKeyPath());
  if (fs.existsSync(kp)) die(`이미 있습니다(덮어쓰지 않음): ${kp}`);
  fs.mkdirSync(path.dirname(kp), { recursive: true, mode: 0o700 });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(kp, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  fs.chmodSync(kp, 0o600);
  process.stderr.write(`개인키 저장: ${kp} (0600). 아래 공개키를 services/operator-allow.js OPERATOR_PUBLIC_KEYS.${KID} 에 넣으세요.\n`);
  process.stdout.write(publicKey.export({ type: 'spki', format: 'pem' }));
}

function cmdIssue(args) {
  let machine;
  if (args.thisMachine && args.machine) die('--machine 과 --this-machine 중 하나만');
  if (args.thisMachine) machine = thisMachine();
  else if (args.machine) machine = String(args.machine).trim().toLowerCase();
  else die('--machine <64hex> 또는 --this-machine 이 필요합니다');
  if (!/^[0-9a-f]{64}$/.test(machine)) die('--machine 은 64자리 hex(대상 기기에서 `machine-id` 출력값)');

  const days = args.days === undefined ? DEFAULT_DAYS : Number(args.days);
  if (!Number.isInteger(days) || days < 1) die('--days 는 1 이상의 정수');
  if (days > OA.CONSTANTS.MAX_TTL_DAYS) die(`--days 는 ${OA.CONSTANTS.MAX_TTL_DAYS} 이하(앱이 그보다 긴 허가는 거부한다)`);

  const key = readPrivateKey(args.key || defaultKeyPath());
  const now = Date.now();
  const payload = {
    typ: OA.TYP, ver: OA.VER, kid: KID, app: OA.APP_ID, machine,
    iat: new Date(now).toISOString(),
    exp: new Date(now + days * DAY_MS).toISOString(),
  };
  if (args.note !== undefined) payload.note = String(args.note);
  const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.sign(null, Buffer.from(b64, 'utf8'), key).toString('base64url');
  const text = JSON.stringify({ kid: KID, payload: b64, sig }) + '\n';

  // 자기검증 — 방금 만든 키의 공개키로(앱 상수가 아직 비어 있어도 형식·서명이 맞는지는 여기서 본다)
  const pub = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' });
  const v = OA.checkOperatorAllow({ fileText: text, keys: { [KID]: pub }, machineId: machine, now });
  if (!v.ok) die(`자기검증 실패: ${v.why}`, 4);
  const appKey = OA.OPERATOR_PUBLIC_KEYS[KID];
  if (!appKey) process.stderr.write('⚠️ 앱의 OPERATOR_PUBLIC_KEYS 가 비어 있습니다 — 이 파일은 배포판에서 아직 «안 먹습니다».\n');
  else if (appKey.trim() !== String(pub).trim()) process.stderr.write('⚠️ 이 개인키의 공개키가 앱 상수 op1 과 다릅니다 — 배포판에서 bad_sig 로 거부됩니다.\n');

  if (args.out) {
    assertKeyPathOutsideRepo(args.out, 'allow 파일'); // allow 파일도 레포 안에 떨구지 않는다
    fs.writeFileSync(args.out, text, { mode: 0o600 });
    process.stderr.write(`발급: ${args.out} (exp ${payload.exp}). 대상 기기의 userData/operator.allow 로 복사.\n`);
  } else {
    process.stdout.write(text);
  }
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (cmd === 'keygen') cmdKeygen(args);
else if (cmd === 'machine-id') process.stdout.write(thisMachine() + '\n');
else if (cmd === 'issue') cmdIssue(args);
else die('사용법: issue.mjs keygen [--key p] | machine-id | issue (--machine hex|--this-machine) [--days N] [--note s] [--out p] [--key p]', 1);
