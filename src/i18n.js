// 轻量界面本地化：以中文原文为 key，切换语言时翻译现有 DOM，并持续翻译运行时新写入的文本
const LANG_KEY = 'zero-protocol-lang';
const ZH = 'zh';
const EN = 'en';

const DICT = {
  'ZERO PROTOCOL // 零界协议': 'ZERO PROTOCOL // ZERO BOUNDARY',
  '零 界 协 议 / OPERATIVE NETWORK': 'ZERO BOUNDARY / OPERATIVE NETWORK',
  '接入你的': 'LINK YOUR',
  '作战身份': 'COMBAT IDENTITY',
  '登录后进入黑潮工业港，记录每一场战绩，添加战友并随时发起 1V1 单挑。': 'Enter Blacktide Industrial Port, track every match, add allies and start 1v1 duels anytime.',
  '个人主页': 'PROFILE',
  '战绩 / 胜率 / 历史对局': 'Stats / Win rate / Match history',
  '好友系统': 'FRIENDS',
  '在线状态 / 添加 / 邀请': 'Status / Add / Invite',
  '1V1 单挑': '1V1 DUEL',
  '快速匹配 / 好友挑战': 'Quick match / Friend challenge',
  '作战终端登录': 'COMBAT TERMINAL LOGIN',
  '使用作战账号接入，或注册新的干员身份。': 'Sign in with a combat account or register a new operative.',
  '登录': 'SIGN IN',
  '注册账号': 'REGISTER',
  '作战账号': 'COMBAT ID',
  '接入密码': 'ACCESS CODE',
  '登录并进入': 'SIGN IN & ENTER',
  '重新连接服务器': 'RECONNECT SERVER',
  '正在连接作战服务器…': 'Connecting to combat server…',
  '账号数据保存在作战服务器，用于好友、个人主页与 1V1 单挑。': 'Account data is stored on the combat server for friends, profile and 1v1 duels.',
  '零 界 协 议': 'ZERO BOUNDARY',
  '作战终端': 'TERMINAL',
  '武器配置': 'ARMORY',
  '行动指南': 'FIELD MANUAL',
  '设置': 'SETTINGS',
  '特勤干员': 'OPERATIVE',
  '未登录': 'OFFLINE',
  '突破边界': 'BREAK THE BOUNDARY',
  '终结协议': 'TERMINATION PROTOCOL',
  '潜入黑潮工业设施，突破敌方防线并引爆量子核心。': 'Infiltrate the Blacktide industrial facility, breach enemy lines and detonate the quantum core.',
  '每一次压枪、每一个脚步，都将决定行动结局。': 'Every burst and every footstep decides the outcome.',
  '爆破训练': 'DEMOLITION TRAINING',
  '核心爆破': 'CORE BREACH',
  '单机 · 5 名 AI': 'SOLO · 5 AI',
  '无限乱斗': 'UNLIMITED BRAWL',
  '团队死斗': 'TEAM DEATHMATCH',
  '4 名敌人 · 随机刷新': '4 enemies · random spawns',
  '5V5 联机': '5V5 ONLINE',
  '在线对战': 'ONLINE MATCH',
  '房间大厅 · 实时同步': 'Room lobby · real-time sync',
  '决斗竞技': 'DUEL ARENA',
  '快速匹配 · 邀请码建房': 'Quick match · invite rooms',
  '开始行动': 'START OPERATION',
  '本地作战环境已就绪': 'LOCAL COMBAT ENVIRONMENT READY',
  '建议佩戴耳机': 'HEADPHONES RECOMMENDED',
  '突击 / 突破': 'ASSAULT / BREACH',
  '男': 'MALE',
  '女': 'FEMALE',
  '先锋干员': 'VANGUARD OPERATIVE',
  '凤 凰': 'PHOENIX',
  '主武器': 'PRIMARY',
  'VX-27 战术步枪': 'VX-27 TACTICAL RIFLE',
  '作战技能': 'COMBAT SKILL',
  '突破 / 核心安置': 'BREACH / CORE PLANT',
  '作战区域 / 01': 'OPERATION AREA / 01',
  '黑潮工业港': 'BLACKTIDE INDUSTRIAL PORT',
  '移动': 'MOVE',
  '静步': 'WALK',
  '第三人称': 'THIRD PERSON',
  '安置核心': 'PLANT CORE',
  '换弹': 'RELOAD',
  '守序者': 'ORDER',
  '核心安置阶段': 'CORE PLANT PHASE',
  '失控者': 'ROGUE',
  '当前目标': 'OBJECTIVE',
  '前往 A 点安置量子核心': 'Plant the quantum core at site A',
  '战术地图': 'TACTICAL MAP',
  '按住安置量子核心': 'HOLD TO PLANT QUANTUM CORE',
  '生命值': 'HEALTH',
  '全自动': 'FULL AUTO',
  '枪管温度': 'BARREL HEAT',
  '破片手雷': 'FRAG GRENADE',
  '击杀恢复': 'KILL HEAL',
  '医疗包': 'MEDKIT',
  '+30 生命值': '+30 HEALTH',
  '购买武器': 'BUY WEAPONS',
  '购买': 'BUY',
  '切换武器': 'SWITCH WEAPON',
  '快速切枪': 'QUICK SWAP',
  '检视': 'INSPECT',
  '手雷': 'GRENADE',
  '右键': 'RMB',
  '开镜': 'ADS',
  '暂停': 'PAUSE',
  '行动开始': 'OPERATION START',
  '突破防线，安置量子核心': 'Breach the defense and plant the quantum core',
  '核心已安置': 'CORE PLANTED',
  '手柄已连接': 'CONTROLLER CONNECTED',
  '等待重生': 'AWAITING RESPAWN',
  '正在返回战场': 'RETURNING TO BATTLE',
  '视角': 'VIEW',
  '切枪': 'SWAP',
  '跳': 'JUMP',
  '蹲': 'CROUCH',
  '开火': 'FIRE',
  '建议横屏游玩': 'LANDSCAPE RECOMMENDED',
  'AX-9 苍穹 · 6.5×': 'AX-9 SKYFALL · 6.5×',
  '按住 SHIFT 稳定呼吸': 'HOLD SHIFT TO STEADY BREATH',
  '行动暂停': 'OPERATION PAUSED',
  '作战计时已暂停，准备好后返回战场。': 'Match timer paused. Return when ready.',
  '继续行动': 'RESUME',
  '重新开始本轮': 'RESTART ROUND',
  '游戏设置': 'SETTINGS',
  '返回作战终端': 'RETURN TO TERMINAL',
  'WASD 移动': 'WASD to move',
  '鼠标 瞄准': 'Mouse to aim',
  '左键 攻击': 'LMB to fire',
  'B 购买武器': 'B to buy weapons',
  'Q 快速切枪': 'Q to quick swap',
  'F 检视武器': 'F to inspect',
  'G 投掷手雷': 'G to throw grenade',
  'V 第三人称': 'V for third person',
  'E 安置核心': 'E to plant core',
  '左侧摇杆移动 · 右侧滑动瞄准': 'Left stick to move · right side to aim',
  '右下角开火与开镜 · 右侧按钮跳跃 / 下蹲 / 换弹 / 切枪': 'Fire and ADS at bottom right · jump / crouch / reload / swap on the right',
  '右上角可购买装备、切换视角或暂停': 'Buy gear, change view or pause at top right',
  '支持蓝牙 / USB 手柄，连接后自动识别': 'Bluetooth / USB controllers are detected automatically',
  '调整操作与画质，设置会自动保存到本地。': 'Adjust controls and quality. Settings are saved locally.',
  '鼠标 / 手柄灵敏度': 'MOUSE / CONTROLLER SENSITIVITY',
  '键鼠与手柄转向速度': 'Turning speed for mouse and controller',
  '触屏灵敏度': 'TOUCH SENSITIVITY',
  '触屏滑动转向速度': 'Turning speed for touch',
  '视野 FOV': 'FIELD OF VIEW',
  '数值越大视野越广': 'Higher values widen the view',
  '主音量': 'MASTER VOLUME',
  '枪声、脚步与提示音': 'Gunfire, footsteps and alerts',
  '渲染质量': 'RENDER QUALITY',
  '流畅模式会降低内部分辨率以提升帧率': 'Performance mode lowers internal resolution for higher frame rate',
  '流畅': 'PERFORMANCE',
  '均衡': 'BALANCED',
  '高清': 'HIGH',
  '恢复默认': 'RESET DEFAULTS',
  '完成': 'APPLY',
  '作战装备采购': 'COMBAT PROCUREMENT',
  '购买阶段内选择主武器，购买后立即装备': 'Pick a primary during the buy phase. It is equipped immediately.',
  '可用资金': 'AVAILABLE FUNDS',
  '击杀 +$200 / 胜利 +$3000': 'Kill +$200 / Victory +$3000',
  '副武器': 'SIDEARM',
  '近战': 'MELEE',
  '当前配置': 'CURRENT LOADOUT',
  'K-7 爪刃 · 已拥有': 'K-7 TALON · OWNED',
  '战场内检视武器': 'Inspect weapon in battle',
  '购买阶段结束后无法再次采购': 'No more purchases after the buy phase',
  '冲锋枪 / SMG': 'SUBMACHINE GUN / SMG',
  'VX-9 蜂刺': 'VX-9 STINGER',
  '极高射速与机动性，适合近距离快速突破。': 'Extreme fire rate and mobility for close-range breaches.',
  '伤害': 'DAMAGE',
  '射速': 'FIRE RATE',
  '控制': 'CONTROL',
  '霰弹枪 / SHOTGUN': 'SHOTGUN',
  'B-12 重锤': 'B-12 SLEDGE',
  '一次发射 8 枚弹丸，近距离拥有强大爆发力。': 'Fires 8 pellets with devastating close-range burst damage.',
  '泵动式': 'PUMP ACTION',
  '步枪 / RIFLE': 'RIFLE',
  '稳定精准的全自动步枪，适应各类交战距离。': 'A stable, accurate full-auto rifle for any engagement range.',
  '精确射手 / MARKSMAN': 'MARKSMAN',
  'SR-8 裁决': 'SR-8 VERDICT',
  '2.5× 瞄准镜半自动射手步枪，远距离两发致敌，兼顾持续火力。': '2.5× semi-auto marksman rifle. Two shots at range with sustained fire.',
  '半自动 · 可开镜': 'SEMI-AUTO · ADS',
  '轻型狙击 / SCOUT': 'SCOUT',
  'S-45 游隼': 'S-45 FALCON',
  '轻量栓动狙击，4.5× 瞄准镜与折叠脚架，移动速度更快。': 'Lightweight bolt-action sniper with 4.5× scope and folding bipod for faster movement.',
  '栓动 · 可开镜': 'BOLT ACTION · ADS',
  '半自动狙击 / AUTO SNIPER': 'AUTO SNIPER',
  'V-8 猎隼': 'V-8 HARRIER',
  '3.5× 半自动狙击，10 发扩容弹匣，适合连续压制远距离目标。': '3.5× semi-auto sniper with a 10-round extended mag for sustained long-range pressure.',
  '步枪 / SCOPED RIFLE': 'SCOPED RIFLE',
  'AR-5 鹰眼': 'AR-5 HAWKEYE',
  '2× 紧凑瞄具全自动步枪，在开镜精度与持续火力之间取得平衡。': '2× compact optic full-auto rifle balancing ADS accuracy and sustained fire.',
  '全自动 · 可开镜': 'FULL AUTO · ADS',
  '轻机枪 / LMG': 'LMG',
  'MG-7 碾骨': 'MG-7 BONECRUSHER',
  '60 发弹鼓持续压制，适合封锁通道和掩护核心安置。': '60-round drum for suppressive fire, ideal for locking down lanes and covering the core plant.',
  '狙击枪 / SNIPER': 'SNIPER',
  'M-90 长夜': 'M-90 LONG NIGHT',
  '3.5× 瞄准镜栓动狙击，单发致命，开镜后精准度极高。': '3.5× bolt-action sniper. One-shot lethal with pinpoint ADS accuracy.',
  '狙击枪 / SCOPED SNIPER': 'SCOPED SNIPER',
  'AX-9 苍穹': 'AX-9 SKYFALL',
  '6.5× 可变倍率瞄准镜，按住右键开镜，稳定蓄力后一击致命。': '6.5× variable scope. Hold RMB to ADS and steady your aim for a one-shot kill.',
  '副武器 / SIDEARM': 'SIDEARM',
  '已拥有': 'OWNED',
  'P-12 战术手枪': 'P-12 TACTICAL PISTOL',
  '12 发半自动副武器，主武器换弹时的可靠应急选择。': '12-round semi-auto sidearm, a reliable backup while reloading.',
  '半自动': 'SEMI-AUTO',
  'D-5 蝰蛇': 'D-5 VIPER',
  '7 发重型半自动手枪，单发威力极高，配有补偿器与微型红点。': '7-round heavy semi-auto pistol with high per-shot damage, compensator and micro red dot.',
  '近战 / MELEE': 'MELEE',
  'K-7 爪刃': 'K-7 TALON',
  '弧形爪刃配指环握柄，挥砍距离 2.35 米，无声且致命。': 'Curved talon blade with ring grip. 2.35m reach, silent and lethal.',
  '近战武器': 'MELEE WEAPON',
  '选择一件武器进行采购': 'Select a weapon to purchase',
  '完成配置': 'CONFIRM LOADOUT',
  '返回战场': 'RETURN TO BATTLE',
  '联机大厅': 'ONLINE LOBBY',
  '5v5 团队死斗 · 无限复活 · 无限弹药': '5v5 Team Deathmatch · infinite respawns · unlimited ammo',
  '未连接': 'DISCONNECTED',
  '作战代号': 'CALLSIGN',
  '连接服务器': 'CONNECT',
  '创建房间': 'CREATE ROOM',
  '房间列表': 'ROOM LIST',
  '刷新': 'REFRESH',
  '加入': 'JOIN',
  '运行 npm run server 后连接服务器': 'Run npm run server, then connect',
  '当前房间': 'CURRENT ROOM',
  '比分': 'SCORE',
  '状态': 'STATUS',
  '未加入': 'NOT JOINED',
  '加入守序者': 'JOIN ORDER',
  '加入失控者': 'JOIN ROGUE',
  '准备': 'READY',
  '开始对战': 'START MATCH',
  '战绩、好友与作战记录': 'Stats, friends and combat records',
  '管理面板': 'ADMIN PANEL',
  '修改密码': 'CHANGE PASSWORD',
  '退出登录': 'SIGN OUT',
  '离线': 'OFFLINE',
  '对局': 'MATCHES',
  '胜场': 'WINS',
  '胜率': 'WIN RATE',
  '击杀': 'KILLS',
  '阵亡': 'DEATHS',
  '正在查看': 'VIEWING',
  '的主页': "'s PROFILE",
  '返回我的主页': 'BACK TO MY PROFILE',
  '好友': 'FRIENDS',
  '战绩记录': 'MATCH HISTORY',
  '发送申请': 'SEND REQUEST',
  '好友列表': 'FRIEND LIST',
  '正在搜索对手': 'SEARCHING FOR OPPONENT',
  '我': 'ME',
  '搜索中…': 'SEARCHING…',
  '保持在线，匹配成功后自动进入战场。': 'Stay online. You will enter the match automatically.',
  '取消匹配': 'CANCEL SEARCH',
  '等待好友接受': 'WAITING FOR FRIEND',
  '已向': 'INVITE SENT TO',
  '发送 1V1 邀请。': ' for a 1v1 duel.',
  '取消邀请': 'CANCEL INVITE',
  '收到单挑邀请': 'DUEL INVITE',
  '邀请你进行 1V1 单挑。': ' challenges you to a 1v1 duel.',
  '接受挑战': 'ACCEPT',
  '拒绝': 'DECLINE',
  '单挑模式': 'DUEL MODE',
  '快速匹配随机对手，或创建房间把邀请码发给好友。': 'Quick match a random opponent, or create a room and share the code with a friend.',
  '快速匹配': 'QUICK MATCH',
  '或': 'OR',
  '创建单挑房间': 'CREATE DUEL ROOM',
  '返回主菜单': 'BACK TO MENU',
  '1V1 单挑房间': '1V1 DUEL ROOM',
  '将邀请码发给好友，对方在 1V1 中输入即可加入。': 'Send the invite code to a friend. They can join from the 1v1 menu.',
  '邀请码': 'INVITE CODE',
  '复制': 'COPY',
  '等待对手加入…': 'WAITING FOR OPPONENT…',
  '解散房间': 'DISBAND ROOM',
  '服务器管理': 'SERVER ADMIN',
  '在线玩家、房间与账号管理': 'Online players, rooms and account management',
  '账号上限': 'ACCOUNT LIMIT',
  '保存上限': 'SAVE LIMIT',
  '已注册': 'REGISTERED',
  '个 · 范围 1-1000000 · 降低上限不会删除已有账号': 'accounts · range 1-1000000 · lowering the limit never deletes accounts',
  '在线玩家': 'ONLINE PLAYERS',
  '房间': 'ROOMS',
  '账号管理': 'ACCOUNT MANAGEMENT',
  '登录日志': 'LOGIN LOGS',
  '发送公告': 'SEND ANNOUNCEMENT',
  '当前密码': 'CURRENT PASSWORD',
  '新密码': 'NEW PASSWORD',
  '确认新密码': 'CONFIRM NEW PASSWORD',
  '取消': 'CANCEL',
  '更新密码': 'UPDATE PASSWORD',
  '行动成功': 'OPERATION SUCCESS',
  '敌方作战单位已全部清除': 'All hostile combat units eliminated',
  '命中率': 'ACCURACY',
  '回合比分': 'ROUND SCORE',
  '下一轮行动': 'NEXT OPERATION',
  '正在唤醒 PHOENIX 作战单元': 'REVIVING PHOENIX COMBAT UNIT',
  '界面语言': 'LANGUAGE',
  '切换后立即生效': 'Applies immediately',
  '换弹中…': 'RELOADING…',
  '检视武器': 'INSPECTING',
  '枪管过热 · 冷却中': 'OVERHEATED · COOLING',
  '干员': 'OPERATIVE',
  '购买阶段已结束': 'BUY PHASE ENDED',
  '下一轮开始后可再次购买武器': 'You can buy again at the start of the next round',
  '按 B 购买装备，突破防线并安置核心': 'Press B to buy gear, breach the line and plant the core',
  '无限乱斗 · 全武器免费': 'Unlimited brawl · all weapons free',
  '4 名敌人随机刷新 · 无限复活 · 无限弹药': '4 random enemies · infinite respawns · unlimited ammo',
  '第三人称视角': 'THIRD-PERSON VIEW',
  '第一人称视角': 'FIRST-PERSON VIEW',
  'V 切回第一人称': 'V to switch back to first person',
  'V 切换第三人称': 'V to switch to third person',
  '手柄已断开': 'CONTROLLER DISCONNECTED',
  '已切换回触屏 / 键鼠操作': 'Reverted to touch / keyboard controls',
  '左摇杆移动 · 右摇杆瞄准 · RT 开火 / LT 开镜': 'Left stick move · right stick aim · RT fire / LT ADS',
  '守住目标，等待核心过载': 'Hold the objective until the core overloads',
  '连接断开': 'CONNECTION LOST',
  '连接超时：请先运行 npm run server': 'Connection timed out. Run npm run server first.',
  '已连接': 'CONNECTED',
  '连接中…': 'CONNECTING…',
  '正在连接联机服务器…': 'Connecting to online server…',
  '请输入 4 位房间代码': 'Enter a 4-digit room code',
  '创建房间，或加入列表中的房间': 'Create a room or join one from the list',
  '已连接作战服务器': 'COMBAT SERVER CONNECTED',
  '正在校验登录状态…': 'Verifying session…',
  '请输入账号登录或注册新账号': 'Sign in or register a new account',
  '与作战服务器的连接已断开': 'CONNECTION TO COMBAT SERVER LOST',
  '连接已断开，正在尝试重连': 'Connection lost. Reconnecting…',
  '操作失败': 'OPERATION FAILED',
  '连接异常': 'CONNECTION ERROR',
  '联机服务异常': 'ONLINE SERVICE ERROR',
  '无法连接作战服务器': 'CANNOT REACH COMBAT SERVER',
  '已进入房间，选择阵营后由房主开始对战': 'Joined the room. Pick a team; the host starts the match.',
  '已退出登录': 'SIGNED OUT',
  '正在重新连接作战服务器…': 'Reconnecting to combat server…',
  '正在创建干员档案…': 'Creating operative profile…',
  '正在验证作战身份…': 'Verifying combat identity…',
  '房间已满': 'ROOM FULL',
  '服务器房间已满，请稍后再试': 'Server rooms are full. Try again later.',
  '公告内容不能为空': 'Announcement cannot be empty',
  '全服公告已发送': 'Server announcement sent',
  '房间已关闭': 'Room closed',
  '房间不存在': 'Room not found',
  // 输入框占位符与无障碍标签
  '2-16 位账号': '2-16 character ID',
  '至少 6 位': 'At least 6 characters',
  '房间代码': 'Room code',
  '输入 4 位邀请码': 'Enter 4-digit invite code',
  '输入全服公告内容': 'Enter server announcement',
  '输入账号添加好友': 'Enter account ID to add friend',
  '打开个人主页': 'Open profile',
  '干员形象切换': 'Switch operative appearance',
  '关闭': 'Close',
  '关闭个人主页': 'Close profile',
  '关闭购买菜单': 'Close buy menu',
  '关闭管理面板': 'Close admin panel',
  '关闭联机大厅': 'Close online lobby',
  '零界协议首页': 'Zero Boundary home',
  '模式选择': 'Mode selection',
  '移动摇杆': 'Movement stick',
  '游戏界面': 'Game interface',
  '主菜单': 'Main menu',
  // 对局内动态文案
  '全解锁': 'ALL UNLOCKED',
  '乱斗': 'BRAWL',
  '对手': 'OPPONENT',
  '未知': 'UNKNOWN',
  '你': 'YOU',
  '正在安置量子核心…': 'PLANTING QUANTUM CORE…',
  '返回单挑房间': 'BACK TO DUEL ROOM',
  '返回联机大厅': 'BACK TO ONLINE LOBBY',
  '再来一局': 'PLAY AGAIN',
  '单挑': 'DUEL',
  '单挑对决': 'DUEL SHOWDOWN',
  '5V5 团队死斗': '5V5 TEAM DEATHMATCH',
  '无限复活 · 无限弹药 · 注意队友与敌人颜色': 'Infinite respawns · unlimited ammo · watch team colors',
  '对局平局': 'DRAW',
  '对局胜利': 'VICTORY',
  '对局失败': 'DEFEAT',
  '行动失败': 'OPERATION FAILED',
  '已装备': 'EQUIPPED',
  '乱斗模式全武器解锁，可随时更换装备': 'All weapons unlocked in brawl. Swap gear anytime.',
  '◇ 爆头': '◇ HEADSHOT',
  '枪管过热': 'OVERHEATED',
  '枪管高温': 'BARREL HOT',
  '未知武器': 'UNKNOWN WEAPON',
  '高射速全自动': 'HIGH-ROF FULL AUTO',
  '8 弹丸泵动式': '8-PELLET PUMP ACTION',
  '3.5× 栓动狙击': '3.5× BOLT-ACTION SNIPER',
  '4.5× 轻型栓动': '4.5× LIGHT BOLT-ACTION',
  '3.5× 半自动狙击': '3.5× SEMI-AUTO SNIPER',
  '2× 全自动步枪': '2× FULL-AUTO RIFLE',
  '6.5× 栓动狙击': '6.5× BOLT-ACTION SNIPER',
  '2.5× 精确半自动': '2.5× PRECISION SEMI-AUTO',
  '轻机枪 · 全自动': 'LMG · FULL AUTO',
  '重型半自动': 'HEAVY SEMI-AUTO',
  '删除选中': 'DELETE SELECTED',
  '暂无登录日志': 'NO LOGIN LOGS',
  '没有可删除的日志': 'NO LOGS TO DELETE',
};

// 带参数的动态文本
const PATTERNS = [
  [/^(.+) 已装备$/, '$1 EQUIPPED'],
  [/^已装备 (.+)$/, 'EQUIPPED $1'],
  [/^已购买并装备 (.+)$/, 'PURCHASED & EQUIPPED $1'],
  [/^资金不足，还需要 \$(\d+)$/, 'INSUFFICIENT FUNDS · NEED $1'],
  [/^被 (.+) 击倒$/, 'DOWNED BY $1'],
  [/^开镜 · (.+)$/, 'ADS · $1'],
  [/^好友 (\d+) 人$/, '$1 FRIENDS'],
  [/^(\d+) 秒$/, '$1s'],
  [/^(.+) 加入了房间$/, '$1 JOINED THE ROOM'],
  [/^(.+) 离开了房间$/, '$1 LEFT THE ROOM'],
  [/^(.+) 击杀了 (.+)$/, '$1 ELIMINATED $2'],
  [/^失控者_(\d+)$/, 'ROGUE_$1'],
  [/^先到 (\d+) 杀 · 对手 (.+)$/, 'First to $1 kills · Opponent $2'],
  [/^(.+) · 回合奖励 \$(\d+)$/, '$1 · ROUND REWARD $2'],
  [/^删除选中 \((\d+)\)$/, 'DELETE SELECTED ($1)'],
  [/^已删除 (\d+) 条登录日志$/, 'DELETED $1 LOGIN LOGS'],
];

const originalText = new WeakMap();
const originalAttrs = new WeakMap();
const originalTitle = document.title;
const ATTRS = ['placeholder', 'title', 'aria-label'];
let lang = ZH;
let observer = null;
let pending = new Set();
let flushScheduled = false;

function translateValue(text) {
  const value = String(text).trim();
  if (!value) return null;
  const exact = DICT[value];
  if (exact) return exact;
  for (const [pattern, replacement] of PATTERNS) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
  return null;
}

function translateTextNode(node) {
  const raw = node.nodeValue;
  if (!raw || !/[\u4e00-\u9fa5]/.test(raw)) return;
  const trimmed = raw.trim();
  const translated = translateValue(trimmed);
  if (!translated || translated === trimmed) return;
  originalText.set(node, raw);
  const start = raw.indexOf(trimmed);
  const end = start + trimmed.length;
  node.nodeValue = raw.slice(0, start) + translated + raw.slice(end);
}

function translateElementAttrs(element) {
  let stored = originalAttrs.get(element);
  for (const name of ATTRS) {
    const value = element.getAttribute?.(name);
    if (!value || !/[\u4e00-\u9fa5]/.test(value)) continue;
    const translated = translateValue(value);
    if (!translated) continue;
    if (!stored) {
      stored = {};
      originalAttrs.set(element, stored);
    }
    if (!(name in stored)) stored[name] = value;
    element.setAttribute(name, translated);
  }
}

function walk(root, fn) {
  if (root.nodeType === Node.TEXT_NODE) {
    fn(root);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE') return;
  if (root.hasAttribute?.('data-i18n-skip')) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    fn(node);
    node = walker.nextNode();
  }
}

function walkAttrs(root) {
  if (root.nodeType === Node.ELEMENT_NODE) translateElementAttrs(root);
  const elements = root.querySelectorAll?.('[placeholder], [title], [aria-label]') || [];
  elements.forEach(translateElementAttrs);
}

function flush() {
  flushScheduled = false;
  const nodes = pending;
  pending = new Set();
  if (lang !== EN) return;
  for (const node of nodes) {
    if (!node.isConnected) continue;
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      walk(node, translateTextNode);
      walkAttrs(node);
    }
  }
}

function queueMutations(records) {
  for (const record of records) {
    if (record.type === 'characterData') {
      pending.add(record.target);
      continue;
    }
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) pending.add(node);
    }
  }
  if (pending.size && !flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(flush);
  }
}

function translateAll() {
  walk(document.body, translateTextNode);
  walkAttrs(document.body);
  document.title = translateValue(originalTitle) || originalTitle;
}

function restoreAll() {
  walk(document.body, (node) => {
    const original = originalText.get(node);
    if (original !== undefined) node.nodeValue = original;
  });
  document.body.querySelectorAll('[placeholder], [title], [aria-label]').forEach((element) => {
    const stored = originalAttrs.get(element);
    if (!stored) return;
    for (const [name, value] of Object.entries(stored)) element.setAttribute(name, value);
    originalAttrs.delete(element);
  });
  document.title = originalTitle;
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(queueMutations);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true });
}

function stopObserver() {
  if (!observer) return;
  observer.disconnect();
  observer = null;
  pending = new Set();
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = next === EN ? EN : ZH;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 隐私模式下忽略存储失败
  }
  document.documentElement.lang = lang === EN ? 'en' : 'zh-CN';
  if (lang === EN) {
    translateAll();
    startObserver();
  } else {
    stopObserver();
    restoreAll();
  }
}

export function initI18n() {
  let saved = ZH;
  // 支持通过 ?lang=en 直接以英文启动（便于分享与排查）
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl === EN || fromUrl === ZH) {
    saved = fromUrl;
  } else {
    try {
      saved = localStorage.getItem(LANG_KEY) === EN ? EN : ZH;
    } catch {
      saved = ZH;
    }
  }
  lang = saved;
  try {
    if (fromUrl) localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 隐私模式下忽略存储失败
  }
  document.documentElement.lang = lang === EN ? 'en' : 'zh-CN';
  if (lang === EN) {
    translateAll();
    startObserver();
  }
}

export function syncLangButtons(root = document) {
  root.querySelectorAll('[data-lang]').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === lang);
  });
}
