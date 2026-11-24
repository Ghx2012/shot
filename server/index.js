import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import {
  acceptFriend, changePassword, createAccount, declineFriend, ensureOwner, getAccount, getAccountLimit,
  listAccounts, publicAccount, publicProfile, recordMatch, removeFriend, requestFriend,
  resetStats, setAccountLimit, setBanned, setAvatar, verifyAccount,
} from './store.js';
import { addLoginLog, listLoginLogs } from './logs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '0.0.0.0';
const MAX_ONLINE = Math.max(2, Number(process.env.MAX_ONLINE || 80));
const MAX_ROOMS = Math.max(1, Number(process.env.MAX_ROOMS || 50));
const MAX_CONNECTIONS = Math.max(MAX_ONLINE, Number(process.env.MAX_CONNECTIONS || 120));
const OWNER_USERNAME = process.env.OWNER_USERNAME || 'ZERO_OWNER';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
if (OWNER_PASSWORD) {
  const owner = ensureOwner(OWNER_USERNAME, OWNER_PASSWORD);
  if (owner.error) console.error('[owner] 初始化失败:', owner.error);
  else console.log(`[owner] 房主账号已就绪: ${owner.account.username}`);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
};

const server = http.createServer((req, res) => {
  let pathname = '/index.html';
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  if (pathname === '/api/status') {
    const teamRooms = [...rooms.values()].filter((room) => room.mode !== 'duel').length;
    const duelRooms = [...rooms.values()].filter((room) => room.mode === 'duel').length;
    const playingRooms = [...rooms.values()].filter((room) => room.status === 'playing');
    const playersInMatch = playingRooms.reduce((sum, room) => sum + room.players.size, 0);
    const memory = process.memoryUsage();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({
      online: presence.size,
      maxOnline: MAX_ONLINE,
      connections: sockets.size,
      maxConnections: MAX_CONNECTIONS,
      rooms: rooms.size,
      maxRooms: MAX_ROOMS,
      teamRooms,
      duelRooms,
      playingRooms: playingRooms.length,
      playersInMatch,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMB: Math.round(memory.rss / 1048576),
      load1m: Number(os.loadavg()[0].toFixed(2)),
      timestamp: Date.now(),
    }));
    return;
  }
  let file = path.join(dist, pathname);
  if (!file.startsWith(dist)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
  try {
    const data = fs.readFileSync(file);
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Client build not found. Run: npm run build');
  }
});

const wss = new WebSocketServer({ server, maxPayload: 8 * 1024 });
const rooms = new Map();
const sockets = new Map();
const presence = new Map();
const tokens = new Map();
// 登录令牌落盘，保证服务端重启后客户端仍能自动登录
const dataDir = process.env.ZP_DATA_DIR || path.join(__dirname, 'data');
const tokenFile = path.join(dataDir, 'tokens.json');
let tokenSaveTimer = null;

function loadTokens() {
  try {
    const raw = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
    for (const [token, session] of Object.entries(raw?.tokens || {})) {
      const accountId = String(session?.accountId || '');
      const issuedAt = Number(session?.issuedAt);
      if (accountId && Number.isFinite(issuedAt)) tokens.set(token, { accountId, issuedAt });
    }
  } catch {
    // 首次运行或文件损坏时从空令牌表开始
  }
}

function writeTokens() {
  tokenSaveTimer = null;
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const payload = JSON.stringify({ tokens: Object.fromEntries(tokens) });
    const temp = `${tokenFile}.tmp`;
    fs.writeFileSync(temp, payload, { mode: 0o600 });
    fs.renameSync(temp, tokenFile);
  } catch (error) {
    console.error('[auth] 保存登录令牌失败:', error.message);
  }
}

function saveTokens() {
  if (tokenSaveTimer) return;
  tokenSaveTimer = setTimeout(writeTokens, 200);
}

function flushTokens() {
  if (tokenSaveTimer) clearTimeout(tokenSaveTimer);
  writeTokens();
}

loadTokens();
process.on('exit', flushTokens);
const duelQueue = [];
let nextPlayerId = 1;

const TEAM_SIZE = 5;
const TEAM_SCORE_LIMIT = 50;
const TEAM_MATCH_MS = 8 * 60 * 1000;
const DUEL_SCORE_LIMIT = 10;
const DUEL_MATCH_MS = 5 * 60 * 1000;
const RESPAWN_MS = 3000;
const INVITE_MS = 60 * 1000;

function cleanName(value) {
  return String(value || '干员').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14) || '干员';
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function teamCount(room, team) {
  let count = 0;
  for (const player of room.players.values()) if (player.team === team) count++;
  return count;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    team: player.team,
    form: player.form === 'female' ? 'female' : 'male',
    ready: player.ready,
    host: player.id === player.room.hostId,
    kills: player.kills,
    deaths: player.deaths,
    hp: player.hp,
    alive: player.alive,
  };
}

function publicRoom(room) {
  return {
    id: room.id,
    mode: room.mode,
    status: room.status,
    hostId: room.hostId,
    capacity: room.capacity,
    scoreLimit: room.scoreLimit,
    scores: { ...room.scores },
    players: [...room.players.values()].map(publicPlayer),
    timeLeft: room.status === 'playing' ? Math.max(0, room.endsAt - Date.now()) : 0,
  };
}

function roomList() {
  return [...rooms.values()]
    .filter((room) => room.mode !== 'duel' && room.status !== 'ended')
    .map((room) => ({
      id: room.id,
      mode: room.mode,
      status: room.status,
      players: room.players.size,
      capacity: room.capacity,
      score: `${room.scores.A}:${room.scores.B}`,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function send(ws, payload) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload));
}

function sendFull(ws) {
  send(ws, { type: 'authError', message: `服务器在线人数已满（${MAX_ONLINE} 人），请稍后再试` });
}

function canTakeMorePlayers(accountId) {
  return presence.size < MAX_ONLINE || presence.has(accountId);
}

function roomsFull() {
  return rooms.size >= MAX_ROOMS;
}

function isOwner(client) {
  return getAccount(client.accountId)?.role === 'owner';
}

function broadcastAll(payload) {
  for (const socket of sockets.values()) send(socket.ws, payload);
}

function adminStatePayload() {
  const online = [...presence.entries()].map(([accountId, socket]) => {
    const account = getAccount(accountId);
    const player = socket.room?.players.get(socket.id);
    return {
      id: accountId,
      username: account?.username || '干员',
      role: account?.role || 'player',
      room: socket.room?.id || '',
      mode: socket.room?.mode || '',
      team: player?.team || '',
    };
  }).sort((a, b) => a.username.localeCompare(b.username));
  const roomStates = [...rooms.values()].map((room) => ({
    id: room.id,
    mode: room.mode,
    status: room.status,
    players: [...room.players.values()].map((player) => ({
      name: player.name,
      team: player.team,
      kills: player.kills,
      deaths: player.deaths,
    })),
  })).sort((a, b) => a.id.localeCompare(b.id));
  return {
    type: 'adminState',
    online,
    rooms: roomStates,
    accounts: listAccounts().sort((a, b) => a.username.localeCompare(b.username)),
    accountLimit: getAccountLimit(),
    loginLogs: listLoginLogs(80),
    stats: {
      online: presence.size,
      maxOnline: MAX_ONLINE,
      rooms: rooms.size,
      maxRooms: MAX_ROOMS,
      connections: sockets.size,
      memoryMB: Math.round(process.memoryUsage().rss / 1048576),
      uptimeSeconds: Math.floor(process.uptime()),
      load1m: Number(os.loadavg()[0].toFixed(2)),
    },
  };
}

function sendAdminState(ws) {
  send(ws, adminStatePayload());
}

function invalidateTokens(accountId) {
  let changed = false;
  for (const [token, session] of tokens) {
    if (session.accountId === accountId) {
      tokens.delete(token);
      changed = true;
    }
  }
  if (changed) saveTokens();
}

function kickAccount(accountId, reason) {
  const target = presence.get(accountId);
  const account = getAccount(accountId);
  invalidateTokens(accountId);
  if (!target) return false;
  if (target.room) leaveRoom(target);
  presence.delete(accountId);
  send(target.ws, { type: 'adminKicked', message: reason });
  if (account) for (const friendId of account.friends) notifySocial(friendId);
  setTimeout(() => target.ws.close(), 150);
  return true;
}

function closeRoomByAdmin(roomId, reason = '房间已被房主关闭') {
  const room = rooms.get(roomId);
  if (!room) return false;
  for (const player of room.players.values()) {
    const client = sockets.get(player.id);
    if (!client) continue;
    client.room = null;
    send(client.ws, { type: 'roomClosed', message: reason, room: room.id });
    notifyPresence(client);
  }
  rooms.delete(room.id);
  broadcastRooms();
  return true;
}

function broadcastRoom(room, payload, exceptId = null) {
  for (const player of room.players.values()) {
    if (player.id === exceptId) continue;
    send(player.ws, payload);
  }
}

function broadcastRooms() {
  const payload = { type: 'rooms', rooms: roomList() };
  for (const socket of sockets.values()) send(socket.ws, payload);
}

function sendRoom(room) {
  const payload = room.status === 'playing'
    ? { type: 'start', room: publicRoom(room) }
    : { type: 'room', room: publicRoom(room) };
  broadcastRoom(room, payload);
}

function chooseTeam(room, requested) {
  const limit = room.mode === 'duel' ? 1 : TEAM_SIZE;
  const want = requested === 'B' ? 'B' : requested === 'A' ? 'A' : null;
  if (want && teamCount(room, want) < limit) return want;
  const a = teamCount(room, 'A');
  const b = teamCount(room, 'B');
  if (a <= b && a < limit) return 'A';
  if (b < limit) return 'B';
  return null;
}

function spawnFor(team) {
  const baseZ = team === 'A' ? 31 : -30;
  return {
    x: (Math.random() - 0.5) * 12,
    y: 0,
    z: baseZ + (Math.random() - 0.5) * 4,
    yaw: team === 'A' ? 0 : Math.PI,
  };
}

function addPlayer(room, client, team) {
  const player = {
    id: client.id,
    accountId: client.accountId,
    name: client.name,
    team,
    form: client.form === 'female' ? 'female' : 'male',
    ready: false,
    ws: client.ws,
    room,
    kills: 0,
    deaths: 0,
    headshots: 0,
    hp: 100,
    alive: true,
    state: null,
    respawnAt: 0,
  };
  room.players.set(client.id, player);
  client.room = room;
  return player;
}

function makeRoom(mode, hostId) {
  return {
    id: makeRoomCode(),
    mode,
    status: 'lobby',
    players: new Map(),
    scores: { A: 0, B: 0 },
    hostId,
    capacity: mode === 'duel' ? 2 : TEAM_SIZE * 2,
    scoreLimit: mode === 'duel' ? DUEL_SCORE_LIMIT : TEAM_SCORE_LIMIT,
    matchMs: mode === 'duel' ? DUEL_MATCH_MS : TEAM_MATCH_MS,
    endsAt: 0,
    recorded: false,
    invite: null,
    queueRoom: false,
  };
}

function socialFor(account) {
  const friendState = (id) => {
    const friend = getAccount(id);
    if (!friend) return null;
    const onlineClient = presence.get(id);
    return {
      ...publicAccount(friend),
      online: !!onlineClient,
      inMatch: !!onlineClient?.room && onlineClient.room.status === 'playing',
      inRoom: !!onlineClient?.room,
    };
  };
  return {
    friends: account.friends.map(friendState).filter(Boolean)
      .sort((a, b) => (b.online - a.online) || a.username.localeCompare(b.username)),
    incoming: account.incoming.map(friendState).filter(Boolean),
    outgoing: account.outgoing.map(friendState).filter(Boolean),
  };
}

function notifySocial(accountId) {
  const account = getAccount(accountId);
  const client = presence.get(accountId);
  if (!account) return;
  if (!client) return;
  send(client.ws, { type: 'social', ...socialFor(account) });
}

function notifyPresence(client) {
  if (!client.accountId) return;
  const account = getAccount(client.accountId);
  if (!account) return;
  notifySocial(account.id);
  for (const friendId of account.friends) notifySocial(friendId);
}

function sendProfile(ws, account, viewerAccount = null) {
  if (!account) return;
  const online = presence.has(account.id);
  const profile = publicProfile(account, online);
  send(ws, {
    type: 'profileData',
    profile,
    isSelf: viewerAccount?.id === account.id,
  });
}

function issueToken(account) {
  for (const [existing, session] of tokens) {
    if (session.accountId === account.id) tokens.delete(existing);
  }
  const token = crypto.randomBytes(24).toString('hex');
  tokens.set(token, { accountId: account.id, issuedAt: Date.now() });
  saveTokens();
  return token;
}

function bindAccount(client, account, token = null) {
  const previous = presence.get(account.id);
  if (previous && previous !== client) {
    send(previous.ws, { type: 'authKick', message: '账号已在其他客户端登录' });
    if (previous.accountId) removeFromQueue(previous.accountId);
    previous.accountId = null;
    if (previous.room) leaveRoom(previous);
    previous.ws.close();
  }
  client.accountId = account.id;
  client.name = account.username;
  presence.set(account.id, client);
  const sessionToken = token || issueToken(account);
  send(client.ws, {
    type: 'authOk',
    token: sessionToken,
    profile: publicProfile(account, true),
    social: socialFor(account),
  });
  notifyPresence(client);
}

function profileFor(accountId) {
  const account = getAccount(accountId);
  if (!account) return null;
  return publicProfile(account, presence.has(accountId));
}

function removeFromQueue(accountId) {
  for (let i = duelQueue.length - 1; i >= 0; i--) {
    if (duelQueue[i] === accountId) duelQueue.splice(i, 1);
  }
}

function leaveRoom(client) {
  removeFromQueue(client.accountId);
  const room = client.room;
  if (!room) return;
  room.players.delete(client.id);
  client.room = null;
  if (room.invite && room.invite.fromId === client.accountId) {
    const target = presence.get(room.invite.accountId);
    if (target) {
      send(target.ws, { type: 'duelInviteCancelled', room: room.id });
      send(target.ws, { type: 'notice', message: `${client.name} 取消了单挑邀请` });
    }
  }
  if (room.players.size === 0) {
    rooms.delete(room.id);
  } else if (room.hostId === client.id) {
    room.hostId = room.players.keys().next().value;
    room.invite = null;
  }
  if (room.players.size) {
    broadcastRoom(room, { type: 'room', room: publicRoom(room) });
  }
  broadcastRooms();
  notifyPresence(client);
}

function notifyMatchResult(room, winner) {
  if (room.recorded) return;
  room.recorded = true;
  const players = [...room.players.values()].map((player) => ({
    accountId: player.accountId,
    name: player.name,
    team: player.team,
    kills: player.kills,
    deaths: player.deaths,
    headshots: player.headshots,
  }));
  const score = `${room.scores.A}:${room.scores.B}`;
  const touched = recordMatch({ mode: room.mode, winner, score, players });
  for (const account of touched) {
    const client = presence.get(account.id);
    if (client) {
      send(client.ws, {
        type: 'profileUpdate',
        profile: publicProfile(account, true),
        social: socialFor(account),
      });
    }
  }
}

function checkMatchEnd(room) {
  if (room.status !== 'playing') return;
  const { A, B } = room.scores;
  const timeUp = Date.now() >= room.endsAt;
  if (A < room.scoreLimit && B < room.scoreLimit && !timeUp) return;
  room.status = 'ended';
  const winner = A === B ? 'draw' : A > B ? 'A' : 'B';
  notifyMatchResult(room, winner);
  broadcastRoom(room, { type: 'matchEnd', winner, scores: { ...room.scores }, mode: room.mode });
  setTimeout(() => {
    if (!rooms.has(room.id)) return;
    room.status = 'lobby';
    room.scores = { A: 0, B: 0 };
    room.recorded = false;
    for (const player of room.players.values()) {
      player.ready = false;
      player.hp = 100;
      player.alive = true;
      player.kills = 0;
      player.deaths = 0;
      player.headshots = 0;
      player.state = null;
    }
    sendRoom(room);
    broadcastRooms();
    for (const member of room.players.values()) notifyPresence(member);
  }, 8000);
}

function startRoom(room) {
  room.status = 'playing';
  room.scores = { A: 0, B: 0 };
  room.recorded = false;
  room.endsAt = Date.now() + room.matchMs;
  for (const member of room.players.values()) {
    member.hp = 100;
    member.alive = true;
    member.kills = 0;
    member.deaths = 0;
    member.headshots = 0;
    member.ready = false;
    member.state = spawnFor(member.team);
    member.respawnAt = 0;
  }
  sendRoom(room);
  broadcastRooms();
  for (const member of room.players.values()) notifyPresence(member);
}

function startDuelBetween(firstClient, secondClient) {
  const room = makeRoom('duel', firstClient.id);
  rooms.set(room.id, room);
  addPlayer(room, firstClient, 'A');
  addPlayer(room, secondClient, 'B');
  room.queueRoom = true;
  startRoom(room);
}

function tryMatchDuel() {
  while (duelQueue.length >= 2) {
    if (roomsFull()) {
      for (const queuedId of duelQueue) {
        const queuedClient = presence.get(queuedId);
        if (queuedClient) {
          send(queuedClient.ws, { type: 'duelSearch', status: 'cancelled' });
          send(queuedClient.ws, { type: 'notice', message: '服务器房间已满，请稍后再试', level: 'error' });
        }
      }
      duelQueue.length = 0;
      return;
    }
    const firstId = duelQueue.shift();
    const secondId = duelQueue.shift();
    const first = presence.get(firstId);
    const second = presence.get(secondId);
    if (!first || !second || first === second || first.room || second.room) {
      if (first && !first.room) {
        duelQueue.unshift(firstId);
        break;
      }
      if (second && !second.room) {
        duelQueue.unshift(secondId);
      }
      continue;
    }
    startDuelBetween(first, second);
  }
}

function cancelDuelRoom(room, reasonAccountId = null) {
  if (!room || !rooms.has(room.id)) return;
  const hostClient = room.players.size ? [...room.players.values()][0] : null;
  if (room.invite) {
    const target = presence.get(room.invite.accountId);
    if (target && target.accountId !== reasonAccountId) {
      send(target.ws, { type: 'duelInviteCancelled', room: room.id });
    }
  }
  for (const player of room.players.values()) {
    const client = sockets.get(player.id);
    if (client) {
      client.room = null;
      send(client.ws, { type: 'left' });
    }
  }
  rooms.delete(room.id);
  if (hostClient) notifyPresence(sockets.get(hostClient.id) || {});
  broadcastRooms();
}

wss.on('connection', (ws, req) => {
  if (sockets.size >= MAX_CONNECTIONS) {
    send(ws, { type: 'authError', message: '服务器连接数已满，请稍后再试' });
    ws.close(1013, 'server busy');
    return;
  }
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = forwarded || String(req.headers['x-real-ip'] || '').trim() || req.socket.remoteAddress || '';
  const ua = String(req.headers['user-agent'] || '');
  const id = `p${nextPlayerId++}`;
  const client = {
    id, ws, room: null, name: '干员', accountId: null, ip, ua,
    lastMessage: Date.now(), messageCount: 0, authAttempts: 0, lastAuthAt: 0,
  };
  sockets.set(id, client);
  send(ws, { type: 'welcome', id, rooms: roomList(), requireAuth: true });

  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - client.lastMessage > 1000) {
      client.lastMessage = now;
      client.messageCount = 0;
    }
    if (++client.messageCount > 120) return;

    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!message || typeof message.type !== 'string') return;

    // 心跳：客户端定时 ping，服务端回 pong，用于测量延迟并清理幽灵连接
    if (message.type === 'ping') {
      send(ws, { type: 'pong', t: message.t });
      return;
    }

    /* ---------- 账号 ---------- */
    if (message.type === 'register' || message.type === 'login') {
      if (now - (client.lastAuthAt || 0) < 400) {
        send(ws, { type: 'authError', message: '操作过于频繁，请稍后再试' });
        return;
      }
      client.lastAuthAt = now;
      const username = String(message.username || '');
      const password = String(message.password || '');
      let result;
      if (message.type === 'register') {
        if (presence.size >= MAX_ONLINE) {
          sendFull(ws);
          return;
        }
        result = createAccount(username, password);
        if (result.error) {
          addLoginLog({ username, ip: client.ip, ua: client.ua, result: 'failed', reason: result.error });
          send(ws, { type: 'authError', message: result.error });
          return;
        }
        addLoginLog({
          username: result.account.username,
          accountId: result.account.id,
          ip: client.ip,
          ua: client.ua,
          result: 'register',
          reason: '注册并登录',
        });
      } else {
        result = { account: verifyAccount(username, password) };
        if (!result.account) {
          client.authAttempts++;
          addLoginLog({ username, ip: client.ip, ua: client.ua, result: 'failed', reason: '账号或密码错误' });
          send(ws, { type: 'authError', message: '账号或密码错误' });
          if (client.authAttempts > 8) ws.close();
          return;
        }
        if (result.account.banned) {
          addLoginLog({
            username: result.account.username,
            accountId: result.account.id,
            ip: client.ip,
            ua: client.ua,
            result: 'banned',
            reason: '封禁账号尝试登录',
          });
          send(ws, { type: 'authError', message: '账号已被房主封禁' });
          return;
        }
        addLoginLog({
          username: result.account.username,
          accountId: result.account.id,
          ip: client.ip,
          ua: client.ua,
          result: 'success',
          reason: '账号密码登录',
        });
        if (!canTakeMorePlayers(result.account.id)) {
          sendFull(ws);
          return;
        }
      }
      client.authAttempts = 0;
      bindAccount(client, result.account);
      return;
    }

    if (message.type === 'auth') {
      const token = String(message.token || '');
      const session = tokens.get(token);
      const account = session ? getAccount(session.accountId) : null;
      if (!account) {
        send(ws, { type: 'authError', message: '登录状态已失效，请重新登录' });
        return;
      }
      if (account.banned) {
        addLoginLog({
          username: account.username,
          accountId: account.id,
          ip: client.ip,
          ua: client.ua,
          result: 'banned',
          reason: '封禁账号自动续登被拒绝',
        });
        send(ws, { type: 'authError', message: '账号已被房主封禁' });
        return;
      }
      addLoginLog({
        username: account.username,
        accountId: account.id,
        ip: client.ip,
        ua: client.ua,
        result: 'session',
        reason: '自动续登',
      });
      if (!canTakeMorePlayers(account.id)) {
        sendFull(ws);
        return;
      }
      bindAccount(client, account, token);
      return;
    }
    if (!client.accountId) {
      send(ws, { type: 'authError', message: '请先登录账号' });
      return;
    }

    const account = getAccount(client.accountId);
    if (!account) {
      send(ws, { type: 'authError', message: '账号不存在' });
      return;
    }

    if (message.type === 'logout') {
      const friends = account.friends.slice();
      if (client.room) leaveRoom(client);
      removeFromQueue(client.accountId);
      invalidateTokens(account.id);
      if (presence.get(client.accountId) === client) presence.delete(client.accountId);
      client.accountId = null;
      client.name = '干员';
      for (const friendId of friends) notifySocial(friendId);
      send(ws, { type: 'authLogout' });
      return;
    }

    if (message.type === 'setAvatar') {
      if (setAvatar(account, message.avatar)) {
        send(ws, { type: 'profileUpdate', profile: publicProfile(account, true), social: socialFor(account) });
        for (const friendId of account.friends) notifySocial(friendId);
      }
      return;
    }

    if (message.type === 'changePassword') {
      const result = changePassword(account, String(message.current || ''), String(message.next || ''));
      if (result.error) {
        send(ws, { type: 'notice', message: result.error, level: 'error' });
        return;
      }
      send(ws, { type: 'notice', message: '密码已更新' });
      send(ws, { type: 'passwordChanged' });
      return;
    }

    if (message.type.startsWith('admin')) {
      if (!isOwner(client)) {
        send(ws, { type: 'notice', message: '没有房主权限', level: 'error' });
        return;
      }
      if (message.type === 'adminState') {
        sendAdminState(ws);
        return;
      }
      if (message.type === 'adminAnnounce') {
        const text = String(message.message || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120);
        if (!text) {
          send(ws, { type: 'notice', message: '公告内容不能为空', level: 'error' });
          return;
        }
        broadcastAll({ type: 'announcement', message: text, from: account.username });
        send(ws, { type: 'notice', message: '全服公告已发送' });
        sendAdminState(ws);
        return;
      }
      if (message.type === 'adminCloseRoom') {
        const ok = closeRoomByAdmin(String(message.room || '').toUpperCase());
        send(ws, { type: 'notice', message: ok ? '房间已关闭' : '房间不存在', level: ok ? '' : 'error' });
        sendAdminState(ws);
        return;
      }
      if (message.type === 'adminSetAccountLimit') {
        const result = setAccountLimit(message.limit);
        if (result.error) {
          send(ws, { type: 'notice', message: result.error, level: 'error' });
          return;
        }
        send(ws, { type: 'notice', message: `账号上限已更新为 ${result.limit}` });
        sendAdminState(ws);
        return;
      }
      const targetId = String(message.id || '');
      const target = getAccount(targetId);
      if (!target) {
        send(ws, { type: 'notice', message: '账号不存在', level: 'error' });
        return;
      }
      if (targetId === client.accountId) {
        send(ws, { type: 'notice', message: '不能对自己执行该操作', level: 'error' });
        return;
      }
      if (message.type === 'adminKick') {
        const ok = kickAccount(targetId, '你已被房主移出服务器');
        send(ws, { type: 'notice', message: ok ? `已踢出 ${target.username}` : '该玩家不在线', level: ok ? '' : 'error' });
      } else if (message.type === 'adminBan') {
        setBanned(target, true);
        kickAccount(targetId, '账号已被房主封禁');
        send(ws, { type: 'notice', message: `已封禁 ${target.username}` });
      } else if (message.type === 'adminUnban') {
        setBanned(target, false);
        send(ws, { type: 'notice', message: `已解封 ${target.username}` });
      } else if (message.type === 'adminResetStats') {
        resetStats(target);
        const online = presence.get(targetId);
        if (online) {
          send(online.ws, {
            type: 'profileUpdate',
            profile: publicProfile(target, true),
            social: socialFor(target),
          });
        }
        send(ws, { type: 'notice', message: `已重置 ${target.username} 的战绩` });
      }
      sendAdminState(ws);
      return;
    }

    if (message.type === 'viewProfile') {
      const targetId = message.id ? String(message.id) : account.id;
      if (targetId !== account.id && !account.friends.includes(targetId)) {
        send(ws, { type: 'notice', message: '只能查看好友的个人主页' });
        return;
      }
      sendProfile(ws, getAccount(targetId), account);
      return;
    }

    /* ---------- 好友 ---------- */
    if (message.type === 'friendRequest') {
      const result = requestFriend(account, message.username);
      if (result.error) {
        send(ws, { type: 'notice', message: result.error, level: 'error' });
        return;
      }
      send(ws, { type: 'notice', message: result.autoAccepted ? '已互相添加为好友' : '好友申请已发送' });
      notifySocial(account.id);
      if (result.target) notifySocial(result.target.id);
      return;
    }

    if (message.type === 'friendAccept' || message.type === 'friendDecline' || message.type === 'friendRemove') {
      const targetId = String(message.id || '');
      const method = message.type === 'friendAccept'
        ? acceptFriend : message.type === 'friendDecline' ? declineFriend : removeFriend;
      const result = method(account, targetId);
      if (result.error) {
        send(ws, { type: 'notice', message: result.error, level: 'error' });
        return;
      }
      notifySocial(account.id);
      if (result.target) notifySocial(result.target.id);
      return;
    }

    /* ---------- 1v1 ---------- */
    if (message.type === 'duelQueue') {
      client.form = message.form === 'female' ? 'female' : 'male';
      if (client.room) {
        send(ws, { type: 'notice', message: '请先离开当前房间', level: 'error' });
        return;
      }
      if (roomsFull()) {
        send(ws, { type: 'notice', message: '服务器房间已满，请稍后再试', level: 'error' });
        return;
      }
      if (duelQueue.includes(client.accountId)) {
        send(ws, { type: 'duelSearch', status: 'queued' });
        return;
      }
      duelQueue.push(client.accountId);
      send(ws, { type: 'duelSearch', status: 'queued', waiting: duelQueue.length });
      tryMatchDuel();
      return;
    }

    if (message.type === 'duelCancel') {
      removeFromQueue(client.accountId);
      send(ws, { type: 'duelSearch', status: 'cancelled' });
      return;
    }

    if (message.type === 'duelChallenge') {
      const targetId = String(message.id || '');
      const targetAccount = getAccount(targetId);
      const targetClient = presence.get(targetId);
      if (!targetAccount || !account.friends.includes(targetId)) {
        send(ws, { type: 'notice', message: '只能挑战好友', level: 'error' });
        return;
      }
      if (!targetClient) {
        send(ws, { type: 'notice', message: '好友当前不在线', level: 'error' });
        return;
      }
      if (client.room) {
        send(ws, { type: 'notice', message: '请先离开当前房间', level: 'error' });
        return;
      }
      if (targetClient.room || duelQueue.includes(targetId)) {
        send(ws, { type: 'notice', message: '好友正在房间或对局中', level: 'error' });
        return;
      }
      if (roomsFull()) {
        send(ws, { type: 'notice', message: '服务器房间已满，请稍后再试', level: 'error' });
        return;
      }
      removeFromQueue(client.accountId);
      const room = makeRoom('duel', client.id);
      room.invite = { accountId: targetId, fromId: client.accountId, expiresAt: now + INVITE_MS };
      rooms.set(room.id, room);
      addPlayer(room, client, 'A');
      send(ws, { type: 'duelWait', room: publicRoom(room), to: publicAccount(targetAccount) });
      send(targetClient.ws, {
        type: 'duelInvite',
        room: room.id,
        from: publicAccount(account),
        expiresIn: Math.round(INVITE_MS / 1000),
      });
      notifyPresence(client);
      return;
    }

    if (message.type === 'duelAccept') {
      client.form = message.form === 'female' ? 'female' : 'male';
      const room = rooms.get(String(message.room || '').toUpperCase());
      if (!room || room.mode !== 'duel' || room.status !== 'lobby' || !room.invite) {
        send(ws, { type: 'notice', message: '邀请已失效', level: 'error' });
        return;
      }
      if (room.invite.accountId !== account.id) {
        send(ws, { type: 'notice', message: '邀请不属于你', level: 'error' });
        return;
      }
      if (client.room || duelQueue.includes(account.id)) {
        send(ws, { type: 'notice', message: '你正在其他对局中', level: 'error' });
        return;
      }
      if (room.players.size >= 2) {
        send(ws, { type: 'notice', message: '房间已满', level: 'error' });
        return;
      }
      const challenger = presence.get(room.invite.fromId);
      room.invite = null;
      addPlayer(room, client, 'B');
      if (challenger) send(challenger.ws, { type: 'duelAccepted', room: room.id });
      startRoom(room);
      return;
    }

    if (message.type === 'duelDecline') {
      const room = rooms.get(String(message.room || '').toUpperCase());
      if (!room || !room.invite || room.invite.accountId !== account.id) return;
      const challenger = presence.get(room.invite.fromId);
      if (challenger) {
        send(challenger.ws, { type: 'duelDeclined', room: room.id, by: publicAccount(account) });
      }
      cancelDuelRoom(room, account.id);
      return;
    }

    if (message.type === 'duelCancelInvite') {
      const room = rooms.get(String(message.room || '').toUpperCase());
      if (!room || room.mode !== 'duel') return;
      if (!room.players.has(client.id)) return;
      cancelDuelRoom(room);
      return;
    }

    /* ---------- 房间 ---------- */
    if (message.type === 'create' || message.type === 'join') {
      if (client.room) leaveRoom(client);
      removeFromQueue(client.accountId);
      client.name = account.username;
      client.form = message.form === 'female' ? 'female' : 'male';
      let room;
      if (message.type === 'create') {
        if (roomsFull()) {
          send(ws, { type: 'error', message: '服务器房间已满，请稍后再试' });
          return;
        }
        const mode = message.mode === 'duel' ? 'duel' : 'team';
        const code = /^[A-Z0-9]{4}$/.test(String(message.room || '').toUpperCase())
          ? String(message.room).toUpperCase()
          : makeRoomCode();
        if (rooms.has(code)) {
          send(ws, { type: 'error', message: '房间代码已存在' });
          return;
        }
        room = makeRoom(mode, id);
        room.id = code;
        rooms.set(code, room);
      } else {
        const code = String(message.room || '').toUpperCase();
        room = rooms.get(code);
        if (!room) {
          send(ws, { type: 'error', message: '房间不存在' });
          return;
        }
        if (room.status === 'ended') {
          send(ws, { type: 'error', message: '对局正在结算' });
          return;
        }
      }
      if (room.players.size >= room.capacity) {
        send(ws, { type: 'error', message: '房间已满' });
        return;
      }
      const team = chooseTeam(room, message.team);
      if (!team) {
        send(ws, { type: 'error', message: '房间已满' });
        return;
      }
      const player = addPlayer(room, client, team);
      if (room.status === 'playing') {
        const spawn = spawnFor(team);
        player.state = spawn;
        send(ws, {
          type: 'start',
          room: publicRoom(room),
          midgame: true,
        });
      } else {
        send(ws, { type: 'joined', room: publicRoom(room), you: id });
        broadcastRoom(room, { type: 'room', room: publicRoom(room) }, id);
        if (room.mode === 'duel' && room.players.size === 2) startRoom(room);
      }
      broadcastRooms();
      notifyPresence(client);
      return;
    }

    if (message.type === 'list') {
      send(ws, { type: 'rooms', rooms: roomList() });
      return;
    }

    if (!client.room) return;
    const room = client.room;
    const player = room.players.get(client.id);
    if (!player) return;

    if (message.type === 'leave') {
      leaveRoom(client);
      send(ws, { type: 'left' });
      return;
    }

    if (message.type === 'team' && room.status === 'lobby') {
      const limit = room.mode === 'duel' ? 1 : TEAM_SIZE;
      const team = message.team === 'B' ? 'B' : 'A';
      if (team !== player.team && teamCount(room, team) < limit) {
        player.team = team;
        player.state = null;
        broadcastRoom(room, { type: 'room', room: publicRoom(room) });
        broadcastRooms();
      }
      return;
    }

    if (message.type === 'ready' && room.status === 'lobby') {
      player.ready = !!message.ready;
      broadcastRoom(room, { type: 'room', room: publicRoom(room) });
      return;
    }

    if (message.type === 'start') {
      if (room.hostId !== player.id || room.status !== 'lobby') return;
      if (teamCount(room, 'A') < 1 || teamCount(room, 'B') < 1) {
        send(ws, { type: 'error', message: '双方各需要至少 1 名玩家' });
        return;
      }
      startRoom(room);
      return;
    }

    if (room.status !== 'playing') return;

    if (message.type === 'state') {
      const s = message.state || {};
      if (typeof s.x !== 'number' || typeof s.z !== 'number') return;
      player.state = {
        x: Math.max(-34, Math.min(34, s.x)),
        y: Math.max(-2, Math.min(4, Number(s.y) || 0)),
        z: Math.max(-40, Math.min(40, s.z)),
        yaw: Number(s.yaw) || 0,
        pitch: Math.max(-1.4, Math.min(1.4, Number(s.pitch) || 0)),
        weapon: String(s.weapon || 'rifle').slice(0, 12),
        melee: !!s.melee,
      };
      return;
    }

    if (message.type === 'hit') {
      const target = room.players.get(message.target);
      if (!target || target.team === player.team || !target.alive) return;
      const damage = Math.max(1, Math.min(180, Number(message.damage) || 10));
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp <= 0) {
        target.alive = false;
        target.deaths++;
        target.respawnAt = Date.now() + RESPAWN_MS;
        player.kills++;
        if (message.headshot) player.headshots++;
        room.scores[player.team]++;
        broadcastRoom(room, {
          type: 'kill',
          killer: player.id,
          victim: target.id,
          killerName: player.name,
          victimName: target.name,
          weapon: String(message.weapon || player.state?.weapon || 'rifle').slice(0, 12),
          headshot: !!message.headshot,
          scores: { ...room.scores },
        });
        send(ws, { type: 'hitConfirm', target: target.id, hp: 0, killed: true });
        checkMatchEnd(room);
      } else {
        send(ws, { type: 'hitConfirm', target: target.id, hp: target.hp, killed: false });
        send(target.ws, { type: 'damaged', hp: target.hp, by: player.id });
      }
      return;
    }

    if (message.type === 'respawn') {
      if (!player.alive || Date.now() < player.respawnAt) return;
      player.alive = true;
      player.hp = 100;
      const spawn = spawnFor(player.team);
      player.state = spawn;
      send(ws, { type: 'respawn', id: player.id, position: spawn });
      return;
    }
  });

  ws.on('close', () => {
    leaveRoom(client);
    removeFromQueue(client.accountId);
    if (client.accountId && presence.get(client.accountId) === client) {
      presence.delete(client.accountId);
      const account = getAccount(client.accountId);
      if (account) for (const friendId of account.friends) notifySocial(friendId);
    }
    sockets.delete(id);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.status !== 'playing') continue;
    for (const player of room.players.values()) {
      if (!player.alive && player.respawnAt && now >= player.respawnAt) {
        player.alive = true;
        player.hp = 100;
        const spawn = spawnFor(player.team);
        player.state = spawn;
        send(player.ws, { type: 'respawn', id: player.id, position: spawn });
      }
    }
  }
}, 500);

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status !== 'playing') continue;
    const players = [...room.players.values()].map((player) => {
      const state = player.state || spawnFor(player.team);
      return {
        id: player.id,
        name: player.name,
        team: player.team,
        form: player.form === 'female' ? 'female' : 'male',
        x: state.x,
        y: state.y,
        z: state.z,
        yaw: state.yaw,
        pitch: state.pitch,
        weapon: state.weapon,
        melee: !!state.melee,
        hp: player.hp,
        alive: player.alive,
        kills: player.kills,
        deaths: player.deaths,
      };
    });
    const payload = {
      type: 'snapshot',
      players,
      scores: { ...room.scores },
      mode: room.mode,
      scoreLimit: room.scoreLimit,
      timeLeft: Math.max(0, room.endsAt - Date.now()),
      status: room.status,
    };
    broadcastRoom(room, payload);
    checkMatchEnd(room);
  }
}, 66);

setInterval(() => {
  // 45 秒没有任何上行数据的连接视为断网/幽灵连接，主动断开以释放房间席位
  const now = Date.now();
  for (const client of sockets.values()) {
    if (now - client.lastMessage < 45000) continue;
    try {
      client.ws.terminate();
    } catch {
      // 忽略已关闭的连接
    }
  }
}, 10000);

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.invite || room.status !== 'lobby') continue;
    if (room.invite.expiresAt > now) continue;
    const target = presence.get(room.invite.accountId);
    if (target) send(target.ws, { type: 'duelInviteCancelled', room: room.id, expired: true });
    const host = [...room.players.values()][0];
    if (host) {
      const hostClient = sockets.get(host.id);
      if (hostClient) {
        hostClient.room = null;
        send(host.ws, { type: 'duelInviteExpired', room: room.id });
      }
    }
    rooms.delete(room.id);
    if (host) {
      const hostClient = sockets.get(host.id);
      if (hostClient) notifyPresence(hostClient);
    }
  }
  const tokenCutoff = now - 30 * 24 * 60 * 60 * 1000;
  let expired = false;
  for (const [token, session] of tokens) {
    if (session.issuedAt < tokenCutoff) {
      tokens.delete(token);
      expired = true;
    }
  }
  if (expired) saveTokens();
}, 5000);

setInterval(() => {
  const playing = [...rooms.values()].filter((room) => room.status === 'playing').length;
  const memory = Math.round(process.memoryUsage().rss / 1048576);
  console.log(`[stats] online=${presence.size}/${MAX_ONLINE} rooms=${rooms.size}/${MAX_ROOMS} playing=${playing} connections=${sockets.size} mem=${memory}MB load=${os.loadavg()[0].toFixed(2)}`);
}, 30000);

server.listen(port, host, () => {
  console.log(`ZERO PROTOCOL server: http://${host}:${port}`);
  console.log(`limits: online=${MAX_ONLINE} rooms=${MAX_ROOMS} connections=${MAX_CONNECTIONS}`);
  console.log('WebSocket + account/social/1v1 ready. Build the client with npm run build before serving.');
});
