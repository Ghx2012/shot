import './style.css';
import { LobbyClient } from './online.js';
import { initI18n, setLang, syncLangButtons } from './i18n.js';

initI18n();

const $ = (id) => document.getElementById(id);
const isTouchDevice = matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
document.body.classList.toggle('touch-mode', isTouchDevice);
let game = null;
let gamePromise = null;

async function ensureGame() {
  if (game) return game;
  if (!gamePromise) {
    gamePromise = import('./game.js').then(({ TacticalGame }) => {
      const instance = new TacticalGame($('game-canvas'));
      instance.setTouchMode(isTouchDevice);
      instance.applySettings(settings);
      instance.setOperativeForm(operativeForm);
      game = instance;
      return instance;
    }).catch((error) => {
      gamePromise = null;
      console.error('作战环境初始化失败', error);
      throw error;
    });
  }
  return gamePromise;
}

function warmGame() {
  ensureGame().catch(() => {});
}

function requestImmersiveMode() {
  if (!isTouchDevice) return;
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    if (screen.orientation?.lock) screen.orientation.lock('landscape').catch(() => {});
  } catch {
    // 部分移动端浏览器不支持全屏或方向锁定
  }
}

/* ---------- settings ---------- */
const SETTINGS_KEY = 'zero-protocol-settings';
const defaultQuality = isTouchDevice ? (Math.min(screen.width, screen.height) >= 700 ? 'medium' : 'low') : 'high';
const defaultSettings = { sensitivity: 1, touchSensitivity: 1, fov: 73, volume: 65, quality: defaultQuality };
const settings = { ...defaultSettings };
try {
  const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  Object.entries(saved).forEach(([key, value]) => {
    if (key in settings && value !== null && value !== undefined) settings[key] = value;
  });
} catch {
  // 本地设置损坏时使用默认值
}

function syncQualityButtons() {
  document.querySelectorAll('[data-quality]').forEach((button) => {
    button.classList.toggle('active', button.dataset.quality === settings.quality);
  });
}

function syncSettingsUI() {
  $('setting-sensitivity').value = settings.sensitivity;
  $('setting-sensitivity-value').textContent = Number(settings.sensitivity).toFixed(2);
  $('setting-touch-sensitivity').value = settings.touchSensitivity;
  $('setting-touch-sensitivity-value').textContent = Number(settings.touchSensitivity).toFixed(2);
  $('setting-fov').value = settings.fov;
  $('setting-fov-value').textContent = `${settings.fov}°`;
  $('setting-volume').value = settings.volume;
  $('setting-volume-value').textContent = settings.volume;
  syncQualityButtons();
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 隐私模式下忽略存储失败
  }
}

function applySettings(persist = true) {
  game?.applySettings(settings);
  syncSettingsUI();
  if (persist) saveSettings();
}

function openSettings() {
  syncSettingsUI();
  $('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  $('settings-modal').classList.add('hidden');
}

$('open-settings').addEventListener('click', openSettings);
$('pause-settings').addEventListener('click', openSettings);
$('settings-done').addEventListener('click', closeSettings);
$('settings-reset').addEventListener('click', () => {
  Object.assign(settings, defaultSettings);
  applySettings();
});
$('setting-sensitivity').addEventListener('input', (event) => {
  settings.sensitivity = Number(event.target.value);
  $('setting-sensitivity-value').textContent = settings.sensitivity.toFixed(2);
  game?.applySettings(settings);
  saveSettings();
});
$('setting-touch-sensitivity').addEventListener('input', (event) => {
  settings.touchSensitivity = Number(event.target.value);
  $('setting-touch-sensitivity-value').textContent = settings.touchSensitivity.toFixed(2);
  game?.applySettings(settings);
  saveSettings();
});
$('setting-fov').addEventListener('input', (event) => {
  settings.fov = Number(event.target.value);
  $('setting-fov-value').textContent = `${settings.fov}°`;
  game?.applySettings(settings);
  saveSettings();
});
$('setting-volume').addEventListener('input', (event) => {
  settings.volume = Number(event.target.value);
  $('setting-volume-value').textContent = settings.volume;
  game?.applySettings(settings);
  saveSettings();
});
document.querySelectorAll('[data-quality]').forEach((button) => {
  button.addEventListener('click', () => {
    settings.quality = button.dataset.quality;
    syncQualityButtons();
    game?.applySettings(settings);
    saveSettings();
  });
});
document.querySelectorAll('[data-lang]').forEach((button) => {
  button.addEventListener('click', () => {
    setLang(button.dataset.lang);
    syncLangButtons();
  });
});
syncLangButtons();
addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && !$('settings-modal').classList.contains('hidden')) closeSettings();
});
applySettings(false);

$('deploy-button').addEventListener('click', handleDeploy);
$('resume-button').addEventListener('click', async () => {
  requestImmersiveMode();
  const activeGame = await ensureGame().catch(() => null);
  activeGame?.resume();
});
$('restart-button').addEventListener('click', handleRestart);
$('quit-button').addEventListener('click', handleQuit);
$('next-round').addEventListener('click', handleNextRound);
$('close-buy').addEventListener('click', () => game?.closeBuyMenu());
$('buy-done').addEventListener('click', () => game?.closeBuyMenu());
document.querySelectorAll('[data-buy-weapon]').forEach((button) => {
  button.addEventListener('click', () => game?.buyWeapon(button.dataset.buyWeapon));
});

const buyCards = [...document.querySelectorAll('[data-buy-weapon]')];
const buyCategories = [...document.querySelectorAll('[data-buy-category]')];

function selectBuyCategory(category) {
  buyCategories.forEach((button) => {
    button.classList.toggle('active', button.dataset.buyCategory === category);
  });
  let visible = 0;
  buyCards.forEach((card) => {
    const show = card.dataset.category === category;
    card.classList.toggle('hidden', !show);
    if (show) visible++;
  });
  document.querySelector('#buy-menu .buy-grid').classList.toggle('single-card', visible <= 1);
}

buyCategories.forEach((button) => {
  button.addEventListener('click', () => selectBuyCategory(button.dataset.buyCategory));
});

document.querySelector('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  if (!game) return;
  if (game.state !== 'menu') {
    if (game.mode === 'online') {
      lobby.leave();
      lobbyRoom = null;
    }
    game.quitToMenu();
  }
});

const infoContent = {
  guide: `
    <div class="eyebrow"><span></span> FIELD MANUAL</div>
    <h2>行动指南</h2>
    <p>你是守序者小队的突破干员。潜入黑潮工业港，在 A 点按住 E 安置量子核心，随后守住目标直到核心过载。清除全部敌人也可以直接赢得本轮。</p>
    <h3>基础操作</h3>
    <div class="guide-grid">
      <div><span>移动 / 跳跃</span><span><kbd>WASD</kbd> <kbd>SPACE</kbd></span></div>
      <div><span>静步 / 蹲下</span><span><kbd>SHIFT</kbd> <kbd>C</kbd></span></div>
      <div><span>射击 / 开镜</span><span><kbd>左键</kbd> <kbd>右键</kbd></span></div>
      <div><span>更换弹匣</span><kbd>R</kbd></div>
      <div><span>主武器 / 手枪 / 近战</span><kbd>1 / 2 / 3</kbd></div>
      <div><span>购买武器 / 检视</span><span><kbd>B</kbd> <kbd>F</kbd></span></div>
      <div><span>安置量子核心</span><kbd>按住 E</kbd></div>
    </div>
    <h3>战术提示</h3>
    <p>每回合开始拥有 20 秒购买时间，按 B 可采购主武器。击杀奖励 $200，胜负均有回合资金奖励。按 3 切换爪刃，左键近战攻击；按 F 可检视当前武器。购买 AX-9 苍穹后按住右键开镜，开镜时按住 SHIFT 可稳定呼吸。移动会扩大准星，持续开火会产生后坐力并自动回复一部分，头部命中可造成致命伤害。</p>
    <h3>手机 / 平板操作</h3>
    <p>触屏设备会自动显示虚拟摇杆与动作按钮：左侧摇杆移动，右侧空白处滑动瞄准，右下角开火，上方按钮开镜。跳跃、下蹲、换弹、切枪、手雷与按住 E 安置核心都在右侧按钮区，购买、切换视角和暂停位于右上角。建议横屏并开启全屏，以获得更宽的视野与更精准的触控。</p>
    <h3>手柄支持</h3>
    <p>通过蓝牙或 USB 连接手柄后会自动识别（推荐 Xbox 布局）：左摇杆移动，右摇杆瞄准，RT 开火，LT 开镜，A 跳跃，B 下蹲，X 换弹，Y 切枪，LB 手雷，RB 按住安置核心。十字键上打开购买、下切换视角、左右切换武器，Start 暂停或继续。部分手柄支持开火震动反馈。</p>
    <h3>账号与社交</h3>
    <p>首次进入需要通过作战账号登录或注册。点击右上角个人主页可查看战绩、胜率与历史对局，并可添加好友、接受好友申请。好友在线时可发起 1V1 单挑邀请；主菜单的 1V1 单挑模式支持快速匹配，也可以创建单挑房间并把 4 位邀请码发给好友，让对方输入加入。1V1 对局先到 10 杀获胜，阵亡后 3 秒重生，对局记录会写入双方个人主页。</p>
  `,
  loadout: `
    <div class="eyebrow"><span></span> WEAPON LOADOUT</div>
    <h2>武器配置</h2>
    <p>标准突破配置已自动装备。行动中可通过数字键或鼠标滚轮切换武器。</p>
    <div class="weapon-card active"><strong>VX-27 战术步枪</strong><span>主武器 / 1</span><p>30 发全自动步枪。稳定、高射速，适合中距离短点射与持续火力压制。</p></div>
    <div class="weapon-card active"><strong>P-12 战术手枪</strong><span>副武器 / 2</span><p>12 发半自动手枪。单发伤害较高，适合作为主武器换弹时的应急选择。</p></div>
    <div class="weapon-card active"><strong>K-7 爪刃</strong><span>近战武器 / 3</span><p>弧形爪刃配指环握柄，左键挥砍；按 F 可播放专属检视动画。</p></div>
    <h3>作战装备</h3>
    <p>轻型战术护甲可吸收部分伤害；量子核心需要在目标区域持续安置 3 秒，过载倒计时为 40 秒。</p>
  `,
};

function openInfo(type) {
  $('info-content').innerHTML = infoContent[type];
  $('info-modal').classList.remove('hidden');
}

$('open-guide').addEventListener('click', () => openInfo('guide'));
$('open-loadout').addEventListener('click', () => openInfo('loadout'));
$('close-info').addEventListener('click', () => $('info-modal').classList.add('hidden'));
$('info-modal').addEventListener('click', (event) => {
  if (event.target === $('info-modal')) $('info-modal').classList.add('hidden');
});
addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && !$('info-modal').classList.contains('hidden')) {
    $('info-modal').classList.add('hidden');
  }
});

/* ---------- modes ---------- */
const modeConfig = {
  bomb: { label: '开始行动', small: 'DEPLOY', status: '本地作战环境已就绪' },
  brawl: { label: '进入乱斗', small: 'BRAWL', status: '无限复活 · 无限弹药 · 全武器解锁' },
  online: { label: '进入联机大厅', small: 'MULTIPLAYER', status: '5V5 联机 · 房间大厅' },
  duel: { label: '进入 1V1', small: 'DUEL', status: '1V1 快速匹配 · 好友挑战' },
};
let selectedMode = 'bomb';

function selectMode(mode) {
  if (!modeConfig[mode]) return;
  selectedMode = mode;
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  $('deploy-button').querySelector('span').textContent = modeConfig[mode].label;
  $('deploy-button').querySelector('small').textContent = modeConfig[mode].small;
  $('menu-status-text').textContent = modeConfig[mode].status;
}

document.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => selectMode(button.dataset.mode));
});

async function handleDeploy() {
  requestImmersiveMode();
  if (selectedMode === 'online') {
    openLobby();
    return;
  }
  if (selectedMode === 'duel') {
    openDuelMenu();
    return;
  }
  $('menu-status-text').textContent = '正在建立作战环境…';
  const activeGame = await ensureGame().catch(() => null);
  if (!activeGame) {
    $('menu-status-text').textContent = '作战环境初始化失败，请刷新重试';
    return;
  }
  selectMode(selectedMode);
  if (selectedMode === 'brawl') {
    activeGame.startBrawl();
    return;
  }
  activeGame.startRound();
}

async function handleNextRound() {
  const activeGame = await ensureGame().catch(() => null);
  if (!activeGame) return;
  if (activeGame.mode === 'online') {
    activeGame.returnToLobby();
    $('main-menu').classList.add('hidden');
    $('lobby-menu').classList.remove('hidden');
    renderLobby();
    return;
  }
  activeGame.nextRound();
}

async function handleRestart() {
  const activeGame = await ensureGame().catch(() => null);
  if (!activeGame) return;
  if (activeGame.mode === 'brawl') activeGame.startBrawl();
  else if (activeGame.mode !== 'online') activeGame.startRound();
}

async function handleQuit() {
  const activeGame = await ensureGame().catch(() => null);
  if (!activeGame) return;
  if (activeGame.mode === 'online') {
    lobby.leave();
    lobbyRoom = null;
  }
  activeGame.quitToMenu();
  renderLobby();
}

/* ---------- online lobby ---------- */
const lobby = new LobbyClient();
let lobbyRoom = null;
let selfId = null;

const TOKEN_KEY = 'zero-protocol-token';
const AVATAR_COLORS = ['#c8ff52', '#5ee6d8', '#ffb45c', '#ff7a5c', '#9fb6ff', '#d7a8ff', '#8fe0a0', '#ffd166'];
const accountState = {
  profile: null,
  token: localStorage.getItem(TOKEN_KEY) || '',
  social: { friends: [], incoming: [], outgoing: [] },
  viewing: null,
  queued: false,
  waitTimer: null,
  waitUntil: 0,
  duelWaitRoom: '',
  duelInviteRoom: '',
  reconnectTimer: null,
  authTab: 'login',
};

function nickname() {
  return (accountState.profile?.username || $('lobby-name').value || '干员').trim().slice(0, 14) || '干员';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
}

function setLobbyStatus(text, online = false) {
  $('lobby-status').textContent = text;
  $('lobby-status').closest('.lobby-connection').classList.toggle('online', online);
}

function lobbyMessage(text) {
  $('lobby-message').textContent = text;
}

function renderRooms(rooms = []) {
  const list = $('lobby-room-list');
  list.innerHTML = '';
  if (!rooms.length) {
    list.innerHTML = '<div class="empty">暂无房间，创建第一个房间</div>';
    return;
  }
  rooms.forEach((room) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lobby-room';
    button.innerHTML = `<span class="room-code">${room.id}</span><span class="room-meta">${room.players}/${room.capacity}</span><span class="room-state">${room.status === 'playing' ? '对战中' : '等待中'}</span>`;
    button.addEventListener('click', () => joinRoom(room.id));
    list.appendChild(button);
  });
}

function renderTeam(container, room, team, slots = 5) {
  container.innerHTML = '';
  const players = room.players
    .filter((player) => player.team === team)
    .sort((a, b) => (b.host ? 1 : 0) - (a.host ? 1 : 0));
  for (let index = 0; index < slots; index++) {
    const player = players[index];
    const slot = document.createElement('div');
    slot.className = `lobby-slot${player ? '' : ' empty'}${player && player.id === selfId ? ' you' : ''}`;
    if (player) {
      const tag = player.host ? '房主' : player.ready ? '就绪' : '';
      const female = player.form === 'female';
      const formLabel = female ? '女性形象' : '男性形象';
      slot.innerHTML = `<span class="slot-index">0${index + 1}</span><span class="slot-name"><span class="slot-form ${female ? 'female' : 'male'}" title="${formLabel}" aria-label="${formLabel}">${female ? '♀' : '♂'}</span>${escapeHtml(player.name)}${player.id === selfId ? '（你）' : ''}</span>${tag ? `<span class="slot-tag">${tag}</span>` : ''}`;
    } else {
      slot.innerHTML = `<span class="slot-index">0${index + 1}</span>空余席位`;
    }
    container.appendChild(slot);
  }
}

function renderLobby() {
  const room = lobbyRoom;
  const duel = room?.mode === 'duel';
  $('lobby-title').textContent = duel ? '1V1 单挑房间' : '联机大厅';
  $('lobby-subtitle').textContent = duel
    ? '先到 10 杀获胜 · 无限复活 · 好友再战'
    : '5v5 团队死斗 · 无限复活 · 无限弹药';
  $('lobby-name').value = accountState.profile?.username || '—';
  if (!room) {
    $('lobby-room-id').textContent = '—';
    $('lobby-score').textContent = '0 : 0';
    $('lobby-room-state').textContent = lobby.connected ? '未加入' : '未连接';
    $('lobby-a-count').textContent = '0 / 5';
    $('lobby-b-count').textContent = '0 / 5';
    $('lobby-team-a').innerHTML = '';
    $('lobby-team-b').innerHTML = '';
    $('lobby-ready').textContent = '准备';
    $('lobby-start').disabled = true;
    return;
  }
  const me = room.players.find((player) => player.id === (selfId || lobby.id));
  const slots = duel ? 1 : 5;
  $('lobby-room-id').textContent = room.id;
  $('lobby-score').textContent = `${room.scores.A} : ${room.scores.B}`;
  $('lobby-room-state').textContent = room.status === 'lobby' ? '等待开始' : room.status === 'playing' ? '对战中' : '结算中';
  renderTeam($('lobby-team-a'), room, 'A', slots);
  renderTeam($('lobby-team-b'), room, 'B', slots);
  $('lobby-a-count').textContent = `${room.players.filter((player) => player.team === 'A').length} / ${slots}`;
  $('lobby-b-count').textContent = `${room.players.filter((player) => player.team === 'B').length} / ${slots}`;
  $('lobby-ready').textContent = me?.ready ? '取消准备' : '准备';
  $('lobby-start').disabled = room.status !== 'lobby' || !me?.host;
  $('lobby-team-a').disabled = duel || me?.team === 'A';
  $('lobby-team-b').disabled = duel || me?.team === 'B';
}

function connectLobby() {
  if (lobby.connected) {
    setLobbyStatus('已连接', true);
    if (accountState.profile) lobby.send('list');
    return;
  }
  setLobbyStatus('连接中…');
  lobbyMessage('正在连接联机服务器…');
  lobby.connect(nickname());
}

let connectWaiters = null;
let connectWaitTimer = null;

function whenConnected(action) {
  if (lobby.connected) {
    action();
    return;
  }
  connectLobby();
  // 只保留一个轮询定时器，连点按钮时排队执行，避免重复建房/入房
  if (!connectWaiters) {
    connectWaiters = [];
    let tries = 0;
    connectWaitTimer = setInterval(() => {
      tries++;
      if (lobby.connected) {
        clearInterval(connectWaitTimer);
        connectWaitTimer = null;
        const queue = connectWaiters;
        connectWaiters = null;
        queue.forEach((handler) => handler());
      } else if (tries > 50) {
        clearInterval(connectWaitTimer);
        connectWaitTimer = null;
        connectWaiters = null;
        lobbyMessage('连接超时：请先运行 npm run server');
      }
    }, 100);
  }
  connectWaiters.push(action);
}

function cancelConnectWaiters() {
  if (connectWaitTimer) clearInterval(connectWaitTimer);
  connectWaitTimer = null;
  connectWaiters = null;
}

function createRoom() {
  whenConnected(() => lobby.createRoom(nickname(), 'A'));
}

function joinRoom(code) {
  if (!code) {
    lobbyMessage('请输入 4 位房间代码');
    return;
  }
  whenConnected(() => lobby.joinRoom(String(code).toUpperCase(), nickname(), 'A'));
}

function openLobby() {
  $('main-menu').classList.add('hidden');
  $('lobby-menu').classList.remove('hidden');
  renderLobby();
  if (!lobby.connected) connectLobby();
  else if (accountState.profile) {
    setLobbyStatus('已连接', true);
    lobby.send('list');
  }
}

lobby.on('open', () => {
  setLobbyStatus('已连接', true);
  lobbyMessage('创建房间，或加入列表中的房间');
  renderLobby();
  $('auth-retry').classList.add('hidden');
  updateAuthStatus('已连接作战服务器');
  if (accountState.token) {
    updateAuthStatus('正在校验登录状态…');
    accountState.autoAuthPending = true;
    lobby.authToken(accountState.token);
  } else {
    updateAuthStatus('请输入账号登录或注册新账号');
  }
  if (accountState.profile) lobby.send('list');
});
lobby.on('close', () => {
  setLobbyStatus('连接断开');
  cancelConnectWaiters();
  lobbyRoom = null;
  renderLobby();
  accountState.queued = false;
  $('duel-queue').classList.add('hidden');
  hideDuelWait();
  hideDuelInvite();
  hideDuelMenu();
  hideDuelRoom();
  updateAuthStatus('与作战服务器的连接已断开');
  $('auth-retry').classList.remove('hidden');
  if (!$('lobby-menu').classList.contains('hidden')) lobbyMessage('连接已断开，正在尝试重连');
  if (game?.mode === 'online' && game?.state === 'playing') game.pauseGame();
  if (accountState.profile) toast('与作战服务器的连接已断开，正在重连', 'error');
  scheduleReconnect();
});
lobby.on('latency', (ms) => {
  const el = document.getElementById('online-ping');
  if (!el) return;
  el.textContent = `${ms} ms`;
  el.classList.toggle('warn', ms >= 90 && ms < 160);
  el.classList.toggle('bad', ms >= 160);
});

lobby.on('error', (message) => {
  if (lobby.connected) {
    toast(message.message || '操作失败', 'error');
    lobbyMessage(message.message || '操作失败');
    if ((game?.state ?? 'menu') === 'menu' && !lobbyRoom) {
      hideDuelRoom();
      $('main-menu').classList.remove('hidden');
    }
    return;
  }
  setLobbyStatus('连接异常');
  lobbyMessage(message.message || '联机服务异常');
  updateAuthStatus(message.message || '无法连接作战服务器');
  $('auth-retry').classList.remove('hidden');
});
lobby.on('welcome', (message) => {
  selfId = message.id;
  renderRooms(message.rooms || []);
});
lobby.on('rooms', (message) => renderRooms(message.rooms || []));
lobby.on('joined', (message) => {
  selfId = message.you || selfId;
  lobbyRoom = message.room;
  if (message.room?.mode === 'duel') {
    hideDuelOverlays();
    showDuelRoom(message.room);
    return;
  }
  renderLobby();
  lobbyMessage('已进入房间，选择阵营后由房主开始对战');
  hideDuelOverlays();
  hideDuelMenu();
});
lobby.on('room', (message) => {
  lobbyRoom = message.room;
  if (message.room?.mode === 'duel') {
    showDuelRoom(message.room);
    return;
  }
  renderLobby();
});
lobby.on('start', async (message) => {
  lobbyRoom = message.room;
  const me = message.room.players.find((player) => player.id === (selfId || lobby.id));
  hideAllOverlays();
  const activeGame = await ensureGame().catch(() => null);
  if (!activeGame) {
    toast('作战环境初始化失败，请刷新重试', 'error');
    $('main-menu').classList.remove('hidden');
    return;
  }
  activeGame.startOnlineMatch({
    client: lobby,
    room: message.room,
    selfId: selfId || lobby.id,
    team: me?.team || 'A',
  });
});
let operativeBootTimer = null;
function playOperativeBoot() {
  const panel = document.querySelector('.operative-panel');
  if (!panel) return;
  panel.classList.remove('booting');
  void panel.offsetWidth;
  panel.classList.add('booting');
  clearTimeout(operativeBootTimer);
  operativeBootTimer = setTimeout(() => panel.classList.remove('booting'), 2400);
}

/* ---------- operative form ---------- */
const OPERATIVE_FORM_KEY = 'zero-protocol-operative-form';
const operativePanel = document.querySelector('.operative-panel');
const operativeButtons = [...document.querySelectorAll('[data-operative]')];
let operativeForm = 'male';
let operativeFlashTimer = null;
try {
  const savedForm = localStorage.getItem(OPERATIVE_FORM_KEY);
  if (savedForm === 'male' || savedForm === 'female') operativeForm = savedForm;
} catch {
  // 隐私模式下忽略读取失败
}

function applyOperativeForm(form, animate = false) {
  operativeForm = form === 'female' ? 'female' : 'male';
  operativePanel.dataset.gender = operativeForm;
  lobby.form = operativeForm;
  game?.setOperativeForm(operativeForm);
  operativeButtons.forEach((button) => {
    const active = button.dataset.operative === operativeForm;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  try {
    localStorage.setItem(OPERATIVE_FORM_KEY, operativeForm);
  } catch {
    // 隐私模式下忽略存储失败
  }
  if (!animate) return;
  operativePanel.classList.remove('switch-flash');
  void operativePanel.offsetWidth;
  operativePanel.classList.add('switch-flash');
  clearTimeout(operativeFlashTimer);
  operativeFlashTimer = setTimeout(() => operativePanel.classList.remove('switch-flash'), 700);
}

operativeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.operative !== operativeForm) applyOperativeForm(button.dataset.operative, true);
  });
});
applyOperativeForm(operativeForm);
lobby.on('authOk', (message) => {
  accountState.autoAuthPending = false;
  accountState.profile = message.profile;
  accountState.token = message.token || accountState.token;
  accountState.social = {
    friends: message.social?.friends || [],
    incoming: message.social?.incoming || [],
    outgoing: message.social?.outgoing || [],
  };
  localStorage.setItem(TOKEN_KEY, accountState.token);
  lobby.name = message.profile.username;
  $('lobby-name').value = message.profile.username;
  $('auth-error').textContent = '';
  $('auth-submit').disabled = false;
  $('login-screen').classList.add('hidden');
  $('main-menu').classList.remove('hidden');
  playOperativeBoot();
  $('menu-status-text').textContent = `作战账号 ${message.profile.username} 已接入`;
  updateProfileChip();
  renderFriends();
  lobby.send('list');
  toast(`欢迎回来，${message.profile.username}`);
  ensureGame().catch(() => {});
});
lobby.on('authError', (message) => {
  $('auth-submit').disabled = false;
  if (accountState.autoAuthPending || !accountState.profile) {
    accountState.autoAuthPending = false;
    accountState.token = '';
    accountState.profile = null;
    accountState.social = { friends: [], incoming: [], outgoing: [] };
    localStorage.removeItem(TOKEN_KEY);
    $('auth-error').textContent = message.message || '登录失败';
    showLogin(message.message || '登录失败');
  } else {
    toast(message.message || '登录失败', 'error');
  }
});
lobby.on('authKick', (message) => {
  toast(message.message || '账号已在其他客户端登录', 'error');
  performLogout(false, message.message || '账号已在其他客户端登录');
});
lobby.on('authLogout', () => {
  showLogin('');
  updateAuthStatus('已退出登录');
});
lobby.on('social', (message) => {
  accountState.social = {
    friends: message.friends || [],
    incoming: message.incoming || [],
    outgoing: message.outgoing || [],
  };
  renderFriends();
});
lobby.on('profileData', (message) => {
  if (!message.profile) return;
  const isSelf = message.isSelf || message.profile.id === accountState.profile?.id;
  if (isSelf && accountState.profile) accountState.profile = { ...accountState.profile, ...message.profile };
  renderProfile(message.profile, isSelf);
  if (isSelf) {
    updateProfileChip();
    renderFriends();
  }
});
lobby.on('profileUpdate', (message) => {
  if (!message.profile || !accountState.profile) return;
  accountState.profile = message.profile;
  if (message.social) accountState.social = {
    friends: message.social.friends || [],
    incoming: message.social.incoming || [],
    outgoing: message.social.outgoing || [],
  };
  updateProfileChip();
  renderFriends();
  if (!$('profile-menu').classList.contains('hidden') && !accountState.viewing) {
    renderProfile(accountState.profile, true);
  }
});
lobby.on('notice', (message) => {
  toast(message.message || '', message.level === 'error' ? 'error' : '');
});
lobby.on('duelSearch', (message) => {
  if (message.status === 'queued') {
    accountState.queued = true;
    $('duel-queue').classList.remove('hidden');
    $('duel-queue-status').textContent = '已进入匹配队列，等待其他干员…';
  } else if (message.status === 'cancelled') {
    accountState.queued = false;
    closeDuelQueue(false);
  }
});
lobby.on('duelInvite', (message) => {
  accountState.duelInviteRoom = message.room;
  $('duel-inviter').textContent = message.from?.username || '好友';
  $('duel-invite').classList.remove('hidden');
});
lobby.on('duelInviteCancelled', (message) => {
  if (accountState.duelInviteRoom === message.room) hideDuelInvite();
  toast(message.expired ? '单挑邀请已过期' : '对方取消了单挑邀请');
});
lobby.on('duelWait', (message) => {
  accountState.duelWaitRoom = message.room?.id || '';
  $('duel-wait-name').textContent = message.to?.username || '好友';
  showDuelWait();
});
lobby.on('duelAccepted', () => {
  $('duel-wait-time').textContent = '已接受';
  $('duel-wait').querySelector('h2').textContent = '正在进入战场';
});
lobby.on('duelDeclined', (message) => {
  hideDuelWait();
  toast(`${message.by?.username || '好友'} 拒绝了单挑邀请`);
});
lobby.on('duelInviteExpired', () => {
  hideDuelWait();
  toast('单挑邀请已过期');
});
lobby.on('left', () => {
  hideDuelWait();
  hideDuelInvite();
  if (!$('duel-room').classList.contains('hidden')) {
    hideDuelRoom();
    if ((game?.state ?? 'menu') === 'menu') $('main-menu').classList.remove('hidden');
  }
});
lobby.on('announcement', (message) => {
  toast(`公告：${message.message}`);
  if (game?.state === 'playing') game.announce('SYSTEM', '全服公告', message.message);
});
lobby.on('adminState', (message) => renderAdminState(message));
lobby.on('adminKicked', (message) => {
  toast(message.message || '你已被房主移出服务器', 'error');
  performLogout(false, message.message || '你已被房主移出服务器');
});
lobby.on('roomClosed', (message) => {
  hideDuelOverlays();
  hideDuelMenu();
  hideDuelRoom();
  hideAdminPanel();
  lobbyRoom = null;
  if (game?.mode === 'online' && game?.state !== 'menu') game.returnToLobby();
  $('hud').classList.add('hidden');
  $('main-menu').classList.remove('hidden');
  toast(message.message || '房间已被房主关闭');
});
lobby.on('passwordChanged', () => {
  closePasswordModal();
});
lobby.on('snapshot', (message) => game?.handleOnlineSnapshot?.(message));
lobby.on('kill', (message) => game?.handleOnlineKill?.(message));
lobby.on('damaged', (message) => game?.handleOnlineDamaged?.(message));
lobby.on('hitConfirm', (message) => game?.handleOnlineHitConfirm?.(message));
lobby.on('respawn', (message) => game?.handleOnlineRespawn?.(message));
lobby.on('matchEnd', (message) => game?.handleOnlineMatchEnd?.(message));

$('lobby-connect').addEventListener('click', connectLobby);
$('lobby-refresh').addEventListener('click', () => {
  if (!lobby.connected) connectLobby();
  else lobby.send('list');
});
$('lobby-create').addEventListener('click', createRoom);
$('lobby-join').addEventListener('click', () => joinRoom($('lobby-code').value.trim()));
$('lobby-code').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') joinRoom($('lobby-code').value.trim());
});
$('lobby-team-a').addEventListener('click', () => lobby.setTeam('A'));
$('lobby-team-b').addEventListener('click', () => lobby.setTeam('B'));
$('lobby-ready').addEventListener('click', () => {
  const me = lobbyRoom?.players.find((player) => player.id === (selfId || lobby.id));
  lobby.setReady(!me?.ready);
});
$('lobby-start').addEventListener('click', () => lobby.start());
$('close-lobby').addEventListener('click', () => {
  if (lobby.room) lobby.leave();
  lobbyRoom = null;
  $('lobby-menu').classList.add('hidden');
  $('main-menu').classList.remove('hidden');
  renderLobby();
});
$('lobby-name').addEventListener('change', () => {
  lobby.name = nickname();
});

/* ---------- account / login ---------- */
function avatarOf(profile) {
  return Math.max(0, Math.min(7, Number(profile?.avatar) || 0));
}

function avatarLetter(profile) {
  return (profile?.username || 'P').trim().charAt(0).toUpperCase() || 'P';
}

function countryFlag(code) {
  const value = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(value) || value === 'UN') return '🌐';
  return String.fromCodePoint(...[...value].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));
}

function countryText(code) {
  const value = String(code || '').toUpperCase();
  return /^[A-Z]{2}$/.test(value) && value !== 'UN' ? `${countryFlag(value)} ${value}` : '🌐 --';
}

function paintAvatar(element, profile) {
  if (!element) return;
  element.textContent = avatarLetter(profile);
  element.style.background = AVATAR_COLORS[avatarOf(profile)];
  element.style.color = '#0b100b';
}

function updateProfileChip() {
  const profile = accountState.profile;
  if (!profile) {
    $('profile-name').textContent = '未登录';
    $('profile-rank').textContent = '特勤干员';
    $('profile-avatar').textContent = '--';
    return;
  }
  $('profile-name').textContent = profile.username;
  $('profile-rank').textContent = profile.stats?.matches ? `胜率 ${profile.winRate}%` : '新晋干员';
  $('profile-avatar').textContent = String(avatarOf(profile) + 1).padStart(2, '0');
  $('profile-avatar').style.color = AVATAR_COLORS[avatarOf(profile)];
}

function updateAuthStatus(text) {
  const element = $('auth-status');
  if (element) element.textContent = text;
}

let toastTimer = null;
function toast(message, level = '') {
  if (!message) return;
  const element = $('social-toast');
  element.textContent = message;
  element.className = `social-toast${level === 'error' ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.add('hidden'), 2800);
}

function showLogin(message = '') {
  $('login-screen').classList.remove('hidden');
  $('main-menu').classList.add('hidden');
  $('hud').classList.add('hidden');
  ['lobby-menu', 'profile-menu', 'admin-panel', 'password-modal', 'duel-menu', 'duel-room', 'duel-queue', 'duel-wait', 'duel-invite', 'round-end', 'buy-menu', 'pause-menu']
    .forEach((id) => $(id)?.classList.add('hidden'));
  $('auth-password').value = '';
  $('auth-submit').disabled = false;
  setAuthTab('login');
  if (message) $('auth-error').textContent = message;
  if (game && game.state !== 'menu') game.quitToMenu();
}

function scheduleReconnect() {
  if (accountState.reconnectTimer || !accountState.profile) return;
  accountState.reconnectTimer = setTimeout(() => {
    accountState.reconnectTimer = null;
    if (!lobby.connected) lobby.connect(nickname());
  }, 3000);
}

function performLogout(notify = true, reason = '') {
  if (accountState.reconnectTimer) {
    clearTimeout(accountState.reconnectTimer);
    accountState.reconnectTimer = null;
  }
  if (notify && lobby.connected) lobby.logoutAccount();
  localStorage.removeItem(TOKEN_KEY);
  accountState.profile = null;
  accountState.token = '';
  accountState.social = { friends: [], incoming: [], outgoing: [] };
  accountState.viewing = null;
  accountState.queued = false;
  hideDuelOverlays();
  hideDuelMenu();
  hideDuelRoom();
  hideAdminPanel();
  closePasswordModal();
  updateProfileChip();
  if (notify) setTimeout(() => lobby.disconnect(), 80);
  else lobby.disconnect();
  showLogin(reason);
  updateAuthStatus('已退出登录');
}

function setAuthTab(tab) {
  accountState.authTab = tab === 'register' ? 'register' : 'login';
  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.authTab === accountState.authTab);
  });
  const register = accountState.authTab === 'register';
  $('auth-submit').querySelector('span').textContent = register ? '注册并进入' : '登录并进入';
  $('auth-submit').querySelector('small').textContent = register ? 'CREATE' : 'ACCESS';
  $('auth-password').autocomplete = register ? 'new-password' : 'current-password';
  $('auth-error').textContent = '';
}

$('auth-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const username = $('auth-username').value.trim();
  const password = $('auth-password').value;
  $('auth-error').textContent = '';
  if (username.length < 2) {
    $('auth-error').textContent = '账号至少需要 2 个字符';
    return;
  }
  if (password.length < 6) {
    $('auth-error').textContent = '密码至少需要 6 位';
    return;
  }
  if (!lobby.connected) {
    updateAuthStatus('正在重新连接作战服务器…');
    lobby.connect(username);
    $('auth-error').textContent = '服务器未连接，正在重试';
    return;
  }
  $('auth-submit').disabled = true;
  updateAuthStatus(accountState.authTab === 'register' ? '正在创建干员档案…' : '正在验证作战身份…');
  if (accountState.authTab === 'register') lobby.registerAccount(username, password);
  else lobby.loginAccount(username, password);
});
document.querySelectorAll('[data-auth-tab]').forEach((button) => {
  button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
});
$('auth-retry').addEventListener('click', () => {
  $('auth-retry').classList.add('hidden');
  $('auth-error').textContent = '';
  updateAuthStatus('正在连接作战服务器…');
  if (lobby.connected) lobby.authToken(accountState.token);
  else lobby.connect(nickname());
});

/* ---------- profile / friends ---------- */
function friendRow(friend, type) {
  const row = document.createElement('div');
  row.className = 'friend-row';
  const avatar = document.createElement('span');
  avatar.className = 'friend-avatar';
  paintAvatar(avatar, friend);
  row.appendChild(avatar);

  const meta = document.createElement('div');
  meta.className = 'friend-meta';
  const name = document.createElement('strong');
  name.textContent = friend.username;
  const flag = document.createElement('em');
  flag.className = 'friend-country';
  flag.textContent = countryFlag(friend.country);
  flag.title = friend.country || '';
  name.append(' ', flag);
  const status = document.createElement('small');
  if (type === 'incoming') {
    status.textContent = '请求添加你为好友';
  } else if (type === 'outgoing') {
    status.textContent = '等待对方接受';
  } else {
    status.textContent = friend.online ? (friend.inMatch ? '对局中' : friend.inRoom ? '房间中' : '在线') : '离线';
    if (friend.online && !friend.inRoom) status.classList.add('online');
  }
  meta.append(name, status);
  row.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'friend-actions';
  const button = (label, primary, handler) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (primary) element.classList.add('primary');
    element.addEventListener('click', handler);
    actions.appendChild(element);
    return element;
  };
  if (type === 'incoming') {
    button('接受', true, () => lobby.acceptFriend(friend.id));
    button('拒绝', false, () => lobby.declineFriend(friend.id));
  } else if (type === 'outgoing') {
    const pending = document.createElement('span');
    pending.className = 'friend-pending';
    pending.textContent = '待验证';
    actions.appendChild(pending);
  } else {
    if (friend.online && !friend.inRoom) {
      button('单挑', true, () => lobby.challengeFriend(friend.id));
    } else {
      button(friend.online ? (friend.inMatch ? '对局中' : '房间中') : '离线', false, () => {}).disabled = true;
    }
    button('查看', false, () => lobby.viewProfile(friend.id));
    button('删除', false, () => lobby.removeFriend(friend.id));
  }
  row.appendChild(actions);
  return row;
}

function renderFriends() {
  const { friends, incoming, outgoing } = accountState.social;
  const requests = $('friend-requests');
  requests.innerHTML = '';
  [...incoming.map((friend) => ['incoming', friend]), ...outgoing.map((friend) => ['outgoing', friend])]
    .forEach(([type, friend]) => requests.appendChild(friendRow(friend, type)));
  const list = $('friend-list');
  list.innerHTML = '';
  if (!friends.length) {
    const empty = document.createElement('div');
    empty.className = 'friend-empty';
    empty.textContent = '暂无好友，输入账号发送好友申请';
    list.appendChild(empty);
  } else {
    friends.forEach((friend) => list.appendChild(friendRow(friend, 'friend')));
  }
  $('friend-count').textContent = friends.length;
  if (!accountState.viewing) $('profile-friend-count').textContent = `好友 ${friends.length} 人`;
  $('open-profile').textContent = incoming.length ? `个人主页 (${incoming.length})` : '个人主页';
  $('profile-chip').classList.toggle('has-requests', incoming.length > 0);
}

function renderHistory(history = []) {
  const list = $('history-list');
  list.innerHTML = '';
  if (!history.length) {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = '还没有对局记录，完成一场联机或单挑后这里会显示战绩';
    list.appendChild(empty);
    return;
  }
  for (const entry of history) {
    const row = document.createElement('div');
    row.className = 'history-row';
    const result = document.createElement('span');
    result.className = `history-result ${entry.result}`;
    result.textContent = entry.result === 'win' ? '胜利' : entry.result === 'loss' ? '失败' : '平局';
    const meta = document.createElement('div');
    meta.className = 'history-meta';
    const title = document.createElement('strong');
    title.textContent = `${entry.mode === 'duel' ? '1V1 单挑' : '团队死斗'} · ${entry.opponent || '对手'}`;
    const detail = document.createElement('small');
    const date = new Date(entry.at);
    detail.textContent = `${entry.score || ''} · ${Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN')}`;
    meta.append(title, detail);
    const kd = document.createElement('span');
    kd.className = 'history-kd';
    kd.textContent = `${entry.kills} / ${entry.deaths}`;
    row.append(result, meta, kd);
    list.appendChild(row);
  }
}

function showProfileTab(tab) {
  document.querySelectorAll('[data-profile-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.profileTab === tab);
  });
  const friends = tab === 'friends';
  $('profile-friends').classList.toggle('hidden', !friends);
  $('profile-history').classList.toggle('hidden', friends);
}

function renderProfile(profile, isSelf) {
  if (!profile) return;
  accountState.viewing = isSelf ? null : profile.id;
  paintAvatar($('profile-avatar-large'), profile);
  $('profile-name-large').textContent = profile.username;
  $('profile-online').textContent = profile.online ? '在线' : '离线';
  $('profile-online').classList.toggle('offline', !profile.online);
  const roleElement = $('profile-role');
  roleElement.textContent = profile.role === 'owner' ? '房主 / OWNER' : '干员 / OPERATIVE';
  roleElement.classList.toggle('owner', profile.role === 'owner');
  const countryElement = $('profile-country');
  countryElement.textContent = countryText(profile.country);
  countryElement.title = profile.region || '';
  $('open-admin').classList.toggle('hidden', !(isSelf && profile.role === 'owner'));
  $('profile-matches').textContent = profile.stats?.matches || 0;
  $('profile-wins').textContent = profile.stats?.wins || 0;
  $('profile-winrate').textContent = `${profile.winRate || 0}%`;
  $('profile-kd').textContent = profile.kd ?? 0;
  $('profile-kills').textContent = profile.stats?.kills || 0;
  $('profile-deaths').textContent = profile.stats?.deaths || 0;
  const created = new Date(profile.createdAt);
  $('profile-joined').textContent = Number.isNaN(created.getTime())
    ? '作战档案已建立'
    : `加入于 ${created.toLocaleDateString('zh-CN')}`;
  $('profile-friend-count').textContent = `好友 ${profile.friendCount || 0} 人`;
  $('profile-title').textContent = isSelf ? '个人主页' : '干员档案';
  $('profile-subtitle').textContent = isSelf ? '战绩、好友与作战记录' : `正在查看 ${profile.username} 的公开档案`;
  $('profile-view-banner').classList.toggle('hidden', isSelf);
  $('viewing-name').textContent = profile.username;
  const picker = $('avatar-picker');
  picker.innerHTML = '';
  picker.classList.toggle('hidden', !isSelf);
  if (isSelf) {
    AVATAR_COLORS.forEach((color, index) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `avatar-swatch${avatarOf(profile) === index ? ' active' : ''}`;
      swatch.style.background = color;
      swatch.title = `徽章 ${index + 1}`;
      swatch.addEventListener('click', () => lobby.setAvatar(index));
      picker.appendChild(swatch);
    });
  }
  document.querySelector('.profile-tabs').classList.toggle('hidden', !isSelf);
  $('profile-friends').classList.toggle('hidden', !isSelf);
  $('profile-history').classList.toggle('hidden', isSelf);
  document.querySelectorAll('[data-profile-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.profileTab === 'friends');
  });
  renderHistory(profile.history || []);
}

function openProfile() {
  if (!accountState.profile) return;
  $('profile-menu').classList.remove('hidden');
  $('main-menu').classList.add('hidden');
  accountState.viewing = null;
  renderProfile(accountState.profile, true);
  renderFriends();
  lobby.viewProfile('');
}

function closeProfile() {
  $('profile-menu')?.classList.add('hidden');
}

function hideAdminPanel() {
  $('admin-panel').classList.add('hidden');
  if (adminRefreshTimer) {
    clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
  }
}

let adminRefreshTimer = null;

function openAdminPanel() {
  if (accountState.profile?.role !== 'owner') return;
  $('admin-panel').classList.remove('hidden');
  lobby.adminState();
  if (adminRefreshTimer) clearInterval(adminRefreshTimer);
  adminRefreshTimer = setInterval(() => {
    if (!$('admin-panel').classList.contains('hidden')) lobby.adminState();
  }, 10000);
}

function adminRow(name, meta, actions) {
  const row = document.createElement('div');
  row.className = 'admin-row';
  const nameElement = document.createElement('span');
  nameElement.className = 'admin-name';
  nameElement.textContent = name;
  const metaElement = document.createElement('span');
  metaElement.className = 'admin-meta';
  metaElement.textContent = meta;
  const actionBox = document.createElement('div');
  actionBox.className = 'admin-actions';
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    if (action.danger) button.classList.add('danger');
    button.addEventListener('click', action.handler);
    actionBox.appendChild(button);
  }
  row.append(nameElement, metaElement, actionBox);
  return row;
}

const selectedLogIds = new Set();

function updateLogDeleteButton() {
  const button = $('admin-log-delete');
  if (!button) return;
  const count = selectedLogIds.size;
  button.disabled = count === 0;
  button.textContent = count ? `删除选中 (${count})` : '删除选中';
}

function renderAdminState(message) {
  const stats = message.stats || {};
  const accountLimit = Math.max(1, Number(message.accountLimit) || 10000);
  const statsBox = $('admin-stats');
  statsBox.innerHTML = '';
  [
    ['在线玩家', `${stats.online ?? 0} / ${stats.maxOnline ?? 80}`],
    ['房间', `${stats.rooms ?? 0} / ${stats.maxRooms ?? 50}`],
    ['内存', `${stats.memoryMB ?? 0} MB`],
    ['1 分钟负载', `${stats.load1m ?? 0}`],
  ].forEach(([label, value]) => {
    const card = document.createElement('div');
    const caption = document.createElement('span');
    caption.textContent = label;
    const number = document.createElement('strong');
    number.textContent = value;
    card.append(caption, number);
    statsBox.appendChild(card);
  });

  const onlineBox = $('admin-online');
  onlineBox.innerHTML = '';
  const online = message.online || [];
  $('admin-online-count').textContent = online.length;
  if (!online.length) {
    onlineBox.innerHTML = '<div class="admin-empty">当前没有在线玩家</div>';
  } else {
    for (const user of online) {
      const actions = [];
      if (user.id !== accountState.profile?.id) {
        actions.push({ label: '踢出', handler: () => lobby.adminKick(user.id) });
        actions.push({ label: '封禁', danger: true, handler: () => lobby.adminBan(user.id) });
      }
      onlineBox.appendChild(adminRow(
        `${user.username}${user.role === 'owner' ? ' · 房主' : ''}`,
        user.room ? `${user.mode === 'duel' ? '1V1' : '5V5'} ${user.room}` : '大厅',
        actions,
      ));
    }
  }

  const roomsBox = $('admin-rooms');
  roomsBox.innerHTML = '';
  const rooms = message.rooms || [];
  $('admin-room-count').textContent = rooms.length;
  if (!rooms.length) {
    roomsBox.innerHTML = '<div class="admin-empty">当前没有房间</div>';
  } else {
    for (const room of rooms) {
      roomsBox.appendChild(adminRow(
        `${room.mode === 'duel' ? '1V1' : '5V5'} · ${room.id}`,
        `${room.status === 'playing' ? '对战中' : '等待中'} · ${room.players.length} 人`,
        [{ label: '关闭', danger: true, handler: () => lobby.adminCloseRoom(room.id) }],
      ));
    }
  }

  const accountsBox = $('admin-accounts');
  accountsBox.innerHTML = '';
  const accounts = message.accounts || [];
  $('admin-account-count').textContent = `${accounts.length} / ${accountLimit}`;
  $('admin-limit-current').textContent = accountLimit;
  $('admin-limit-count').textContent = accounts.length;
  const limitInput = $('admin-limit-input');
  if (limitInput && document.activeElement !== limitInput) limitInput.value = accountLimit;
  const onlineIds = new Set(online.map((user) => user.id));
  for (const account of accounts) {
    const actions = [];
    if (account.id !== accountState.profile?.id) {
      if (onlineIds.has(account.id)) actions.push({ label: '踢出', handler: () => lobby.adminKick(account.id) });
      if (account.banned) actions.push({ label: '解封', handler: () => lobby.adminUnban(account.id) });
      else actions.push({ label: '封禁', danger: true, handler: () => lobby.adminBan(account.id) });
      actions.push({ label: '清战绩', handler: () => lobby.adminResetStats(account.id) });
    }
    accountsBox.appendChild(adminRow(
      `${account.username}${account.role === 'owner' ? ' · 房主' : ''}`,
      `${account.banned ? '已封禁' : onlineIds.has(account.id) ? '在线' : '离线'} · ${account.wins}/${account.matches} 胜`,
      actions,
    ));
  }

  const logBox = $('admin-login-log');
  logBox.innerHTML = '';
  const logs = message.loginLogs || [];
  $('admin-log-count').textContent = logs.length;
  // 只保留当前列表里仍然存在的选中项
  const visibleLogIds = new Set(logs.map((entry) => entry.id).filter(Boolean));
  for (const id of [...selectedLogIds]) {
    if (!visibleLogIds.has(id)) selectedLogIds.delete(id);
  }
  updateLogDeleteButton();
  if (!logs.length) {
    logBox.innerHTML = '<div class="admin-empty">暂无登录日志</div>';
  } else {
    const labels = { success: '登录', register: '注册', session: '续登', failed: '失败', banned: '封禁' };
    for (const entry of logs) {
      const row = document.createElement('div');
      row.className = 'admin-log-row';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.className = 'log-check';
      check.checked = !!entry.id && selectedLogIds.has(entry.id);
      check.disabled = !entry.id;
      check.addEventListener('change', () => {
        if (!entry.id) return;
        if (check.checked) selectedLogIds.add(entry.id);
        else selectedLogIds.delete(entry.id);
        updateLogDeleteButton();
      });
      const time = document.createElement('span');
      const date = new Date(entry.at);
      time.textContent = Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', { hour12: false });
      const user = document.createElement('span');
      user.className = 'log-user';
      user.textContent = entry.username || '—';
      const result = document.createElement('span');
      result.className = `log-result ${entry.result || 'success'}`;
      result.textContent = labels[entry.result] || entry.result || '登录';
      const ip = document.createElement('span');
      ip.className = 'log-ip';
      ip.textContent = entry.ip || '—';
      const reason = document.createElement('span');
      reason.className = 'log-reason';
      reason.textContent = entry.reason || '';
      reason.title = entry.ua || '';
      row.append(check, time, user, result, ip, reason);
      logBox.appendChild(row);
    }
  }
}

function openPasswordModal() {
  $('password-current').value = '';
  $('password-next').value = '';
  $('password-confirm').value = '';
  $('password-error').textContent = '';
  $('password-modal').classList.remove('hidden');
}

function closePasswordModal() {
  $('password-modal').classList.add('hidden');
}

function submitPasswordChange() {
  const current = $('password-current').value;
  const next = $('password-next').value;
  const confirm = $('password-confirm').value;
  $('password-error').textContent = '';
  if (next.length < 6) {
    $('password-error').textContent = '新密码至少需要 6 位';
    return;
  }
  if (next !== confirm) {
    $('password-error').textContent = '两次输入的新密码不一致';
    return;
  }
  if (!lobby.changePassword(current, next)) {
    $('password-error').textContent = '服务器未连接';
  }
}

$('open-admin').addEventListener('click', openAdminPanel);
$('close-admin').addEventListener('click', hideAdminPanel);
$('admin-panel').addEventListener('click', (event) => {
  if (event.target === $('admin-panel')) hideAdminPanel();
});
$('admin-refresh').addEventListener('click', () => lobby.adminState());
$('admin-log-delete').addEventListener('click', () => {
  if (!selectedLogIds.size) return;
  lobby.adminDeleteLogs([...selectedLogIds]);
  selectedLogIds.clear();
  updateLogDeleteButton();
});
function saveAccountLimit() {
  const value = Number($('admin-limit-input').value);
  if (!Number.isInteger(value) || value < 1 || value > 1000000) {
    toast('账号上限需为 1-1000000 的整数', 'error');
    return;
  }
  lobby.adminSetAccountLimit(value);
}
$('admin-limit-save').addEventListener('click', saveAccountLimit);
$('admin-limit-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveAccountLimit();
  }
});
$('admin-announce-send').addEventListener('click', () => {
  const text = $('admin-announce-input').value.trim();
  if (!text) {
    toast('公告内容不能为空', 'error');
    return;
  }
  lobby.adminAnnounce(text);
  $('admin-announce-input').value = '';
});
$('admin-announce-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('admin-announce-send').click();
});
$('open-password').addEventListener('click', openPasswordModal);
$('password-cancel').addEventListener('click', closePasswordModal);
$('password-submit').addEventListener('click', submitPasswordChange);
$('password-modal').addEventListener('click', (event) => {
  if (event.target === $('password-modal')) closePasswordModal();
});

function hideDuelOverlays() {
  closeDuelQueue(false);
  hideDuelWait();
  hideDuelInvite();
}

function hideDuelMenu() {
  $('duel-menu').classList.add('hidden');
}

function hideDuelRoom() {
  $('duel-room').classList.add('hidden');
}

function showDuelRoom(room) {
  hideDuelOverlays();
  hideDuelMenu();
  lobbyRoom = room;
  $('main-menu').classList.add('hidden');
  $('duel-room-code').textContent = room.id || '—';
  const count = room.players?.length || 1;
  $('duel-room-status').textContent = count >= 2
    ? '对手已加入，正在进入战场…'
    : '等待对手输入邀请码加入…';
  $('duel-room').classList.remove('hidden');
}

function openDuelMenu() {
  if (!accountState.profile) {
    toast('请先登录作战账号', 'error');
    showLogin('请先登录作战账号');
    return;
  }
  if (!lobby.connected) {
    toast('作战服务器未连接', 'error');
    return;
  }
  $('duel-code-input').value = '';
  $('main-menu').classList.add('hidden');
  $('duel-menu').classList.remove('hidden');
}

function createDuelRoomFromMenu() {
  hideDuelMenu();
  if (!lobby.createDuelRoom()) {
    toast('作战服务器未连接', 'error');
    $('main-menu').classList.remove('hidden');
    return;
  }
  toast('正在创建单挑房间…');
}

function joinDuelRoomFromMenu() {
  const code = $('duel-code-input').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(code)) {
    toast('请输入 4 位邀请码', 'error');
    return;
  }
  hideDuelMenu();
  if (!lobby.joinDuelRoom(code)) {
    toast('作战服务器未连接', 'error');
    $('main-menu').classList.remove('hidden');
    return;
  }
  toast(`正在加入房间 ${code}…`);
}

function hideAllOverlays() {
  ['main-menu', 'lobby-menu', 'profile-menu', 'admin-panel', 'password-modal', 'duel-menu', 'duel-room', 'duel-queue', 'duel-wait', 'duel-invite', 'round-end', 'buy-menu', 'pause-menu']
    .forEach((id) => $(id)?.classList.add('hidden'));
  hideDuelOverlays();
  accountState.queued = false;
}

function hideDuelInvite() {
  accountState.duelInviteRoom = '';
  $('duel-invite').classList.add('hidden');
}

function hideDuelWait() {
  accountState.duelWaitRoom = '';
  if (accountState.waitTimer) {
    clearInterval(accountState.waitTimer);
    accountState.waitTimer = null;
  }
  $('duel-wait').classList.add('hidden');
  $('duel-wait').querySelector('h2').textContent = '等待好友接受';
}

function showDuelWait() {
  $('duel-wait').classList.remove('hidden');
  accountState.waitUntil = Date.now() + 60000;
  if (accountState.waitTimer) clearInterval(accountState.waitTimer);
  const tick = () => {
    const left = Math.max(0, Math.ceil((accountState.waitUntil - Date.now()) / 1000));
    $('duel-wait-time').textContent = `${left}`;
    if (left <= 0 && accountState.duelWaitRoom) {
      const room = accountState.duelWaitRoom;
      hideDuelWait();
      lobby.cancelDuelInvite(room);
      toast('单挑邀请已过期');
    }
  };
  tick();
  accountState.waitTimer = setInterval(tick, 500);
}

function closeDuelQueue(sendCancel = true) {
  if (sendCancel && accountState.queued) lobby.cancelDuelQueue();
  accountState.queued = false;
  $('duel-queue').classList.add('hidden');
  if ((game?.state ?? 'menu') === 'menu' && accountState.profile) $('main-menu').classList.remove('hidden');
}

function startDuelMatchmaking() {
  if (!accountState.profile) {
    toast('请先登录作战账号', 'error');
    showLogin('请先登录作战账号');
    return;
  }
  if (!lobby.connected) {
    toast('作战服务器未连接', 'error');
    return;
  }
  $('main-menu').classList.add('hidden');
  $('duel-queue').classList.remove('hidden');
  $('duel-me-name').textContent = accountState.profile.username;
  $('duel-opponent-name').textContent = '搜索中…';
  $('duel-queue-status').textContent = '保持在线，匹配成功后自动进入战场。';
  accountState.queued = true;
  lobby.queueDuel();
}

$('open-profile').addEventListener('click', openProfile);
$('profile-chip').addEventListener('click', openProfile);
$('close-profile').addEventListener('click', () => {
  closeProfile();
  $('main-menu').classList.remove('hidden');
});
$('profile-logout').addEventListener('click', () => performLogout(true));
$('profile-menu').addEventListener('click', (event) => {
  if (event.target === $('profile-menu')) {
    closeProfile();
    $('main-menu').classList.remove('hidden');
  }
});
$('friend-add').addEventListener('click', () => {
  const username = $('friend-name').value.trim();
  if (!username) return;
  lobby.addFriend(username);
  $('friend-name').value = '';
});
$('friend-name').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('friend-add').click();
});
$('back-to-self').addEventListener('click', () => {
  accountState.viewing = null;
  if (accountState.profile) renderProfile(accountState.profile, true);
  renderFriends();
  lobby.viewProfile('');
});
document.querySelectorAll('[data-profile-tab]').forEach((button) => {
  button.addEventListener('click', () => showProfileTab(button.dataset.profileTab));
});

$('duel-cancel').addEventListener('click', () => {
  closeDuelQueue(true);
});
$('duel-quick').addEventListener('click', () => {
  hideDuelMenu();
  startDuelMatchmaking();
});
$('duel-create-room').addEventListener('click', createDuelRoomFromMenu);
$('duel-join-room').addEventListener('click', joinDuelRoomFromMenu);
$('duel-code-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') joinDuelRoomFromMenu();
});
$('duel-menu-close').addEventListener('click', () => {
  hideDuelMenu();
  $('main-menu').classList.remove('hidden');
});
$('duel-menu').addEventListener('click', (event) => {
  if (event.target === $('duel-menu')) {
    hideDuelMenu();
    $('main-menu').classList.remove('hidden');
  }
});
$('duel-room-cancel').addEventListener('click', () => {
  if (lobbyRoom?.mode === 'duel') lobby.leave();
  lobbyRoom = null;
  hideDuelRoom();
  $('main-menu').classList.remove('hidden');
});
$('duel-copy-code').addEventListener('click', async () => {
  const code = $('duel-room-code').textContent;
  if (!code || code === '—') return;
  try {
    await navigator.clipboard.writeText(code);
    toast('邀请码已复制');
  } catch {
    toast(`邀请码：${code}`);
  }
});
$('duel-wait-cancel').addEventListener('click', () => {
  if (accountState.duelWaitRoom) lobby.cancelDuelInvite(accountState.duelWaitRoom);
  hideDuelWait();
  toast('已取消单挑邀请');
});
$('duel-accept').addEventListener('click', () => {
  const room = accountState.duelInviteRoom;
  hideDuelInvite();
  if (room) lobby.acceptDuel(room);
});
$('duel-decline').addEventListener('click', () => {
  const room = accountState.duelInviteRoom;
  hideDuelInvite();
  if (room) lobby.declineDuel(room);
});
$('duel-queue').addEventListener('click', (event) => {
  if (event.target === $('duel-queue')) closeDuelQueue(true);
});
$('duel-invite').addEventListener('click', (event) => {
  if (event.target === $('duel-invite')) {
    const room = accountState.duelInviteRoom;
    hideDuelInvite();
    if (room) lobby.declineDuel(room);
  }
});

updateProfileChip();
setAuthTab('login');
updateAuthStatus('正在连接作战服务器…');
lobby.connect();

selectMode('bomb');

// 先让登录/注册界面可交互，再在后台加载并构建 3D 战场
$('loading-screen').classList.add('done');
setTimeout(() => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => warmGame(), { timeout: 1600 });
  else warmGame();
}, 320);

