/**
 * 라이선스 인증 서비스 — 상페마법사 웹에디터
 * DB: client_db / web_editor_license / web_editor
 * 키 형식: WE-XXXXXX
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'client_db';
const COL_LICENSE = 'web_editor_license';
const COL_USER = 'web_editor';
const KEY_PREFIX = 'WE-';
const MAX_IPS = 5;

let client = null;

async function getClient() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client;
}

function getDb() {
  return client.db(DB_NAME);
}

/**
 * 공인 IP 조회
 */
async function getPublicIp() {
  try {
    const https = require('https');
    return await new Promise((resolve, reject) => {
      const req = https.get('https://api.ipify.org', (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data.trim()));
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  } catch {
    return null;
  }
}

/**
 * 현재 IP로 등록된 유저 조회
 */
async function findUserByIp(ip) {
  try {
    await getClient();
    const user = await getDb().collection(COL_USER).findOne({ 'allowedIps.ip': ip });
    if (!user) return { found: false };

    const license = await getDb().collection(COL_LICENSE).findOne({ licenseKey: user.licenseKey });
    if (!license) return { found: false };
    if (!license.active) return { found: false, reason: 'inactive' };
    if (license.expiresAt && license.expiresAt < new Date()) return { found: false, reason: 'expired' };

    await getDb().collection(COL_USER).updateOne(
      { licenseKey: user.licenseKey },
      { $set: { lastAccessAt: new Date() } }
    );

    return {
      found: true,
      user: {
        licenseKey: user.licenseKey,
        userId: user.userId,
        plan: license.plan,
        allowedIps: user.allowedIps,
      },
    };
  } catch (e) {
    return { found: false, error: e.message };
  }
}

/**
 * 라이선스 키 유효성 확인 + 새 IP 등록
 */
async function registerLicense(licenseKey, ip, userId = '') {
  try {
    await getClient();

    const license = await getDb().collection(COL_LICENSE).findOne({ licenseKey });
    if (!license) return { success: false, reason: 'invalid_key' };
    if (!license.active) return { success: false, reason: 'inactive' };
    if (license.expiresAt && license.expiresAt < new Date()) return { success: false, reason: 'expired' };

    const RESERVED_IDS = ['root', 'admin', 'manager'];
    if (userId && RESERVED_IDS.includes(userId.toLowerCase())) {
      return { success: false, reason: 'userId_reserved' };
    }

    if (userId) {
      const takenBy = await getDb().collection(COL_USER).findOne({ userId, licenseKey: { $ne: licenseKey } });
      if (takenBy) return { success: false, reason: 'userId_taken' };
    }

    const existing = await getDb().collection(COL_USER).findOne({ licenseKey });

    if (existing) {
      const alreadyRegistered = existing.allowedIps.some(e => e.ip === ip);
      if (alreadyRegistered) {
        await getDb().collection(COL_USER).updateOne(
          { licenseKey },
          { $set: { lastAccessAt: new Date() } }
        );
        return {
          success: true,
          user: { licenseKey, userId: existing.userId, plan: license.plan, allowedIps: existing.allowedIps },
        };
      }

      if (existing.allowedIps.length >= MAX_IPS) {
        return {
          success: false,
          reason: 'ip_limit',
          allowedIps: existing.allowedIps,
          userId: existing.userId,
        };
      }

      const newIpEntry = { ip, alias: '', registeredAt: new Date() };
      await getDb().collection(COL_USER).updateOne(
        { licenseKey },
        {
          $push: { allowedIps: newIpEntry },
          $set: { lastAccessAt: new Date(), ...(userId && { userId }) },
        }
      );
      return {
        success: true,
        user: { licenseKey, userId: userId || existing.userId, plan: license.plan, allowedIps: existing.allowedIps.concat(newIpEntry) },
      };
    }

    const newUser = {
      licenseKey,
      userId,
      allowedIps: [{ ip, alias: '', registeredAt: new Date() }],
      lastAccessAt: new Date(),
    };
    await getDb().collection(COL_USER).insertOne(newUser);
    return {
      success: true,
      user: { licenseKey, userId, plan: license.plan, allowedIps: newUser.allowedIps },
      isNew: true,
    };
  } catch (e) {
    return { success: false, reason: 'error', error: e.message };
  }
}

/**
 * IP 삭제 (기기 한도 초과 시)
 */
async function removeIp(licenseKey, ip) {
  try {
    await getClient();
    await getDb().collection(COL_USER).updateOne(
      { licenseKey },
      { $pull: { allowedIps: { ip } } }
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 라이선스 키 신규 발급 (관리자 전용)
 */
async function createLicenseKey(plan, memo = '', expiresAt = null) {
  try {
    await getClient();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let licenseKey;
    let attempts = 0;
    do {
      const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      licenseKey = `${KEY_PREFIX}${rand}`;
      const exists = await getDb().collection(COL_LICENSE).findOne({ licenseKey });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) return { success: false, reason: 'generate_failed' };

    await getDb().collection(COL_LICENSE).insertOne({
      licenseKey,
      plan,
      active: true,
      memo,
      expiresAt: expiresAt ?? null,
      createdAt: new Date(),
    });

    return { success: true, licenseKey };
  } catch (e) {
    return { success: false, reason: 'error', error: e.message };
  }
}

/**
 * 발급 키 목록 조회 (관리자 전용)
 */
async function listLicenseKeys() {
  try {
    await getClient();
    const list = await getDb().collection(COL_LICENSE)
      .find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();
    return { success: true, list };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * IP 별칭 수정
 */
async function updateIpAlias(licenseKey, ip, alias) {
  try {
    await getClient();
    await getDb().collection(COL_USER).updateOne(
      { licenseKey, 'allowedIps.ip': ip },
      { $set: { 'allowedIps.$.alias': alias } }
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 사용자명 변경
 */
async function updateUserName(licenseKey, userName) {
  try {
    await getClient();
    await getDb().collection(COL_USER).updateOne(
      { licenseKey },
      { $set: { userName } }
    );
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  getPublicIp,
  findUserByIp,
  registerLicense,
  removeIp,
  updateIpAlias,
  updateUserName,
  createLicenseKey,
  listLicenseKeys,
};
