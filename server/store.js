import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir = process.env.ZP_DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const file = path.join(dir, 'accounts.json');

// 账号总量上限，默认 10000，可通过环境变量或管理面板调整
const DEFAULT_MAX_ACCOUNTS = Math.max(1, Number(process.env.MAX_ACCOUNTS || 10000) || 10000);
const HARD_MAX_ACCOUNTS = 1000000;

function normalizeLimit(value) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 1) return null;
  return Math.min(HARD_MAX_ACCOUNTS, number);
}

const state = { seq: 1, accounts: {}, maxAccounts: DEFAULT_MAX_ACCOUNTS };
let saveTimer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw && raw.accounts && typeof raw.accounts === 'object') {
      state.seq = Number(raw.seq) || 1;
      state.accounts = raw.accounts;
      state.maxAccounts = normalizeLimit(raw.maxAccounts) ?? DEFAULT_MAX_ACCOUNTS;
      for (const account of Object.values(state.accounts)) {
        account.friends ||= [];
        account.incoming ||= [];
        account.outgoing ||= [];
        account.history ||= [];
        account.stats ||= { matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0 };
        account.avatar = Number.isInteger(account.avatar) ? account.avatar : 0;
        account.role = account.role === 'owner' ? 'owner' : 'player';
        account.banned = !!account.banned;
        // 统一按规范化后的名称建立唯一键，避免大小写/全角差异注册出重复账号
        account.key = String(account.username || '').normalize('NFKC').trim().toLowerCase();
      }
    }
  } catch {
    // 首次运行或数据损坏时从空库开始
  }
}

function flush() {
  saveTimer = null;
  try {
    fs.mkdirSync(dir, { recursive: true });
    const temp = `${file}.tmp`;
    fs.writeFileSync(temp, JSON.stringify({ seq: state.seq, maxAccounts: state.maxAccounts, accounts: state.accounts }));
    fs.renameSync(temp, file);
  } catch (error) {
    console.error('[store] 保存账号数据失败:', error.message);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(flush, 200);
}

function cleanUsername(value) {
  return String(value || '').normalize('NFKC').trim().slice(0, 16);
}

export function validCredentials(username, password) {
  if (!/^[\p{L}\p{N}_-]{2,16}$/u.test(username)) return '账号需为 2-16 位字母、数字、下划线或中文';
  if (typeof password !== 'string' || password.length < 6 || password.length > 64) return '密码需为 6-64 位';
  return null;
}

function findByName(username) {
  const key = cleanUsername(username).toLowerCase();
  return Object.values(state.accounts).find((account) => account.key === key) || null;
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function createAccount(username, password) {
  const name = cleanUsername(username);
  const error = validCredentials(name, password);
  if (error) return { error };
  if (findByName(name)) return { error: '该账号已被注册' };
  if (Object.keys(state.accounts).length >= state.maxAccounts) {
    return { error: `服务器账号已满（上限 ${state.maxAccounts} 个）` };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const account = {
    id: `u${state.seq++}`,
    username: name,
    key: name.toLowerCase(),
    salt,
    hash: hashPassword(password, salt),
    avatar: Object.keys(state.accounts).length % 8,
    createdAt: new Date().toISOString(),
    stats: { matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0 },
    history: [],
    friends: [],
    incoming: [],
    outgoing: [],
    role: 'player',
    banned: false,
  };
  state.accounts[account.id] = account;
  scheduleSave();
  return { account };
}

export function getAccountLimit() {
  return state.maxAccounts;
}

export function setAccountLimit(value) {
  const limit = normalizeLimit(value);
  if (limit === null) return { error: '账号上限需为 1-1000000 的整数' };
  if (limit === state.maxAccounts) return { limit };
  state.maxAccounts = limit;
  scheduleSave();
  return { limit };
}

export function verifyAccount(username, password) {
  const account = findByName(cleanUsername(username));
  if (!account) return null;
  const hash = hashPassword(String(password || ''), account.salt);
  const expected = Buffer.from(account.hash, 'hex');
  const actual = Buffer.from(hash, 'hex');
  if (expected.length !== actual.length) return null;
  return crypto.timingSafeEqual(expected, actual) ? account : null;
}

export function getAccount(id) {
  return state.accounts[id] || null;
}

export function publicAccount(account) {
  if (!account) return null;
  return { id: account.id, username: account.username, avatar: account.avatar, role: account.role };
}

export function publicProfile(account, online = false) {
  if (!account) return null;
  const stats = account.stats;
  return {
    id: account.id,
    username: account.username,
    avatar: account.avatar,
    role: account.role,
    createdAt: account.createdAt,
    online,
    stats: { ...stats },
    friendCount: account.friends.length,
    winRate: stats.matches ? Math.round((stats.wins / stats.matches) * 100) : 0,
    kd: stats.deaths ? Number((stats.kills / stats.deaths).toFixed(2)) : stats.kills,
    history: account.history.slice(0, 10),
  };
}

export function ensureOwner(username, password) {
  const name = cleanUsername(username);
  const existing = findByName(name);
  if (existing) {
    existing.role = 'owner';
    existing.banned = false;
    scheduleSave();
    return { account: existing };
  }
  const result = createAccount(name, password);
  if (result.error) return result;
  result.account.role = 'owner';
  scheduleSave();
  return result;
}

export function listAccounts() {
  return Object.values(state.accounts).map((account) => ({
    id: account.id,
    username: account.username,
    avatar: account.avatar,
    role: account.role,
    banned: account.banned,
    matches: account.stats.matches,
    wins: account.stats.wins,
    createdAt: account.createdAt,
  }));
}

export function setBanned(account, banned) {
  account.banned = !!banned;
  scheduleSave();
}

export function resetStats(account) {
  account.stats = { matches: 0, wins: 0, kills: 0, deaths: 0, headshots: 0 };
  account.history = [];
  scheduleSave();
}

function passwordMatches(account, password) {
  const hash = hashPassword(String(password || ''), account.salt);
  const expected = Buffer.from(account.hash, 'hex');
  const actual = Buffer.from(hash, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function changePassword(account, currentPassword, nextPassword) {
  if (!passwordMatches(account, currentPassword)) return { error: '当前密码不正确' };
  const error = validCredentials(account.username, nextPassword);
  if (error) return { error };
  account.salt = crypto.randomBytes(16).toString('hex');
  account.hash = hashPassword(nextPassword, account.salt);
  scheduleSave();
  return { ok: true };
}

export function setAvatar(account, avatar) {
  const value = Number(avatar);
  if (!Number.isInteger(value) || value < 0 || value > 7) return false;
  account.avatar = value;
  scheduleSave();
  return true;
}

export function requestFriend(account, username) {
  const target = findByName(cleanUsername(username));
  if (!target) return { error: '未找到该账号' };
  if (target.id === account.id) return { error: '不能添加自己为好友' };
  if (account.friends.includes(target.id)) return { error: '你们已经是好友' };
  if (account.outgoing.includes(target.id)) return { error: '好友申请已发送' };
  if (account.incoming.includes(target.id)) {
    acceptFriend(account, target.id);
    return { target, autoAccepted: true };
  }
  account.outgoing.push(target.id);
  target.incoming.push(account.id);
  scheduleSave();
  return { target };
}

export function acceptFriend(account, id) {
  const target = getAccount(id);
  if (!target || !account.incoming.includes(id)) return { error: '申请不存在' };
  account.incoming = account.incoming.filter((friendId) => friendId !== id);
  target.outgoing = target.outgoing.filter((friendId) => friendId !== account.id);
  if (!account.friends.includes(id)) account.friends.push(id);
  if (!target.friends.includes(account.id)) target.friends.push(account.id);
  scheduleSave();
  return { target };
}

export function declineFriend(account, id) {
  const target = getAccount(id);
  account.incoming = account.incoming.filter((friendId) => friendId !== id);
  if (target) target.outgoing = target.outgoing.filter((friendId) => friendId !== account.id);
  scheduleSave();
  return { target };
}

export function removeFriend(account, id) {
  const target = getAccount(id);
  account.friends = account.friends.filter((friendId) => friendId !== id);
  if (target) target.friends = target.friends.filter((friendId) => friendId !== account.id);
  scheduleSave();
  return { target };
}

export function recordMatch({ mode, winner, score, players }) {
  const now = new Date().toISOString();
  const touched = [];
  const names = players.map((player) => player.name);
  for (const player of players) {
    const account = getAccount(player.accountId);
    if (!account) continue;
    const result = winner === 'draw' ? 'draw' : winner === player.team ? 'win' : 'loss';
    account.stats.matches++;
    account.stats.kills += player.kills;
    account.stats.deaths += player.deaths;
    account.stats.headshots += player.headshots || 0;
    if (result === 'win') account.stats.wins++;
    account.history.unshift({
      mode,
      result,
      kills: player.kills,
      deaths: player.deaths,
      score: score || '',
      opponent: mode === 'duel'
        ? names.find((name) => name !== player.name) || '对手'
        : '团队死斗',
      at: now,
    });
    account.history = account.history.slice(0, 12);
    touched.push(account);
  }
  if (touched.length) scheduleSave();
  return touched;
}

load();

export function flushNow() {
  if (saveTimer) clearTimeout(saveTimer);
  flush();
}

process.on('exit', flushNow);
process.on('SIGINT', () => {
  flushNow();
  process.exit(0);
});
process.on('SIGTERM', () => {
  flushNow();
  process.exit(0);
});
