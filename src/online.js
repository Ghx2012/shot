const defaultUrl = () => {
  // 支持 ?ws=wss://host/ws 手动指定联机地址（静态托管与联机服务分离时使用）
  const override = new URLSearchParams(location.search).get('ws');
  if (override) return override;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const port = location.port;
  // 仅 Vite 开发/预览端口需要连到独立的联机服务；其余端口（含自建部署）一律使用同源 /ws
  const devPorts = ['5173', '5174', '4173', '4174'];
  if (devPorts.includes(port)) {
    return `${protocol}//${location.hostname}:8787`;
  }
  return `${protocol}//${location.host}/ws`;
};

// 登录时附带设备时区与语言，服务端据此记录国籍
function clientLocation() {
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    timezone = '';
  }
  return { timezone, language: navigator.language || '' };
}

export class LobbyClient {
  constructor(url = import.meta.env.VITE_WS_URL || defaultUrl()) {
    this.url = url;
    this.ws = null;
    this.id = null;
    this.room = null;
    this.name = '干员';
    this.connected = false;
    this.handlers = new Map();
    this.manualClose = false;
    this.pingTimer = null;
    this.latency = null;
  }

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event, payload) {
    this.handlers.get(event)?.(payload);
  }

  connect(name = '干员') {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.name = name;
    this.manualClose = false;
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.emit('error', { message: '无法连接到联机服务器' });
      return;
    }
    this.ws.addEventListener('open', () => {
      this.connected = true;
      if (this.pingTimer) clearInterval(this.pingTimer);
      // 心跳既用于测量延迟，也避免服务端把空闲连接当成幽灵连接
      this.pingTimer = setInterval(() => {
        this.send('ping', { t: Date.now() });
      }, 4000);
      this.emit('open');
    });
    this.ws.addEventListener('message', (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!message || typeof message.type !== 'string') return;
      if (message.type === 'pong') {
        const sentAt = Number(message.t);
        if (Number.isFinite(sentAt)) {
          this.latency = Math.max(0, Date.now() - sentAt);
          this.emit('latency', this.latency);
        }
        return;
      }
      if (message.type === 'welcome') this.id = message.id;
      if (message.type === 'joined') {
        this.room = message.room;
        this.id = message.you || this.id;
      }
      if (message.type === 'room' || message.type === 'start') this.room = message.room;
      if (message.type === 'left') this.room = null;
      this.emit(message.type, message);
    });
    this.ws.addEventListener('close', () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = null;
      this.connected = false;
      this.room = null;
      this.latency = null;
      this.emit('close');
    });
    this.ws.addEventListener('error', () => {
      this.emit('error', { message: '联机服务器不可达，请先运行 npm run server' });
    });
  }

  send(type, data = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type, ...data }));
    return true;
  }

  registerAccount(username, password) {
    return this.send('register', { username, password, ...clientLocation() });
  }

  loginAccount(username, password) {
    return this.send('login', { username, password, ...clientLocation() });
  }

  authToken(token) {
    return this.send('auth', { token, ...clientLocation() });
  }

  logoutAccount() {
    return this.send('logout');
  }

  setAvatar(avatar) {
    return this.send('setAvatar', { avatar });
  }

  changePassword(current, next) {
    return this.send('changePassword', { current, next });
  }

  adminState() {
    return this.send('adminState');
  }

  adminKick(id) {
    return this.send('adminKick', { id });
  }

  adminBan(id) {
    return this.send('adminBan', { id });
  }

  adminUnban(id) {
    return this.send('adminUnban', { id });
  }

  adminResetStats(id) {
    return this.send('adminResetStats', { id });
  }

  adminCloseRoom(room) {
    return this.send('adminCloseRoom', { room });
  }

  adminAnnounce(message) {
    return this.send('adminAnnounce', { message });
  }

  adminSetAccountLimit(limit) {
    return this.send('adminSetAccountLimit', { limit });
  }

  adminDeleteLogs(ids) {
    return this.send('adminDeleteLogs', { ids: Array.isArray(ids) ? ids : [] });
  }

  addFriend(username) {
    return this.send('friendRequest', { username });
  }

  acceptFriend(id) {
    return this.send('friendAccept', { id });
  }

  declineFriend(id) {
    return this.send('friendDecline', { id });
  }

  removeFriend(id) {
    return this.send('friendRemove', { id });
  }

  viewProfile(id = '') {
    return this.send('viewProfile', { id });
  }

  queueDuel() {
    return this.send('duelQueue', { form: this.form || 'male' });
  }

  cancelDuelQueue() {
    return this.send('duelCancel');
  }

  challengeFriend(id) {
    return this.send('duelChallenge', { id });
  }

  createDuelRoom() {
    return this.send('create', { mode: 'duel', form: this.form || 'male' });
  }

  joinDuelRoom(room) {
    return this.send('join', { room: String(room || '').toUpperCase(), form: this.form || 'male' });
  }

  acceptDuel(room) {
    return this.send('duelAccept', { room, form: this.form || 'male' });
  }

  declineDuel(room) {
    return this.send('duelDecline', { room });
  }

  cancelDuelInvite(room) {
    return this.send('duelCancelInvite', { room });
  }

  createRoom(name = this.name, team = 'A', room = '') {
    this.name = name;
    return this.send('create', { name, team, room, form: this.form || 'male' });
  }

  joinRoom(room, name = this.name, team = 'A') {
    this.name = name;
    return this.send('join', { room, name, team, form: this.form || 'male' });
  }

  setTeam(team) {
    return this.send('team', { team });
  }

  setReady(ready = true) {
    return this.send('ready', { ready });
  }

  start() {
    return this.send('start');
  }

  leave() {
    this.send('leave');
    this.room = null;
  }

  sendState(state) {
    return this.send('state', { state });
  }

  sendHit(target, damage, headshot = false, weapon = '') {
    return this.send('hit', { target, damage, headshot, weapon });
  }

  sendRespawn() {
    return this.send('respawn');
  }

  disconnect() {
    this.manualClose = true;
    this.ws?.close();
    this.ws = null;
    this.connected = false;
    this.room = null;
  }
}
