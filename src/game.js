import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
function stickDeadzone(value) {
  const abs = Math.abs(value || 0);
  if (abs < 0.16) return 0;
  return Math.sign(value) * Math.pow((abs - 0.16) / 0.84, 1.35);
}
const PATROL_POINTS = [
  [0, 28], [-4, 24], [7, 27], [-4, 14], [6, 12], [-4, 2],
  [12, 0], [-12, 0], [0, -12], [4, -20], [-4, -30], [12, -33],
  [-14, -33], [24, 27], [-24, 27],
];
const BRAWL_SPAWN_POINTS = [
  [-24, 27], [24, 27], [-12, 0], [12, 0], [-14, -33], [12, -33],
  [-4, 14], [7, 27], [-4, -30], [4, -20], [22, -8], [-22, -8],
];
const MINIMAP_PICKUP_COLORS = { medkit: '#7dff9a', armor: '#6ec8ff', ammo: '#ffc24a', grenade: '#ff9a4a' };

const EXTERNAL_WEAPON_MODELS = {
  rifle: {
    file: 'AR_1', scale: 0.45, base: [0.38, -0.36, -0.7], accent: 0xc8ff52, tint: 0x46565a,
    hands: { right: [0.002, -0.06, -0.03], left: [0.005, 0.005, -0.23] },
    muzzle: [0.38, -0.267, -1.144],
  },
  smg: {
    file: 'SMG_1', scale: 0.44, base: [0.38, -0.35, -0.65], accent: 0x6de0ff, tint: 0x3c4a55,
    hands: { right: [0.002, -0.06, -0.03], left: [0.005, 0.0, -0.2] },
    muzzle: [0.38, -0.24, -0.945],
  },
  shotgun: {
    file: 'AR_4', scale: 0.44, base: [0.38, -0.36, -0.68], accent: 0xffa54a, tint: 0x5a4a3a,
    hands: { right: [0.002, -0.07, -0.1], left: [0.005, -0.005, -0.17] },
    muzzle: [0.38, -0.265, -1.074],
  },
  sniper: {
    file: 'Sniper_1', scale: 0.4, base: [0.38, -0.36, -0.7], accent: 0x9fb6ff, tint: 0x3c4658,
    hands: { right: [0.002, -0.06, -0.06], left: [0.005, 0.0, -0.25] },
    muzzle: [0.38, -0.286, -1.312],
  },
  scout: {
    file: 'Sniper_1', scale: 0.4, base: [0.38, -0.36, -0.7], accent: 0xffb45c, tint: 0xc9b79a,
    hands: { right: [0.002, -0.06, -0.06], left: [0.005, 0.0, -0.25] },
    muzzle: [0.38, -0.286, -1.36], module: 'scout',
  },
  autoSniper: {
    file: 'Sniper_2', scale: 0.38, base: [0.38, -0.36, -0.7], accent: 0xff7a5c, tint: 0x53604b,
    hands: { right: [0.002, -0.06, -0.065], left: [0.005, 0.0, -0.28] },
    muzzle: [0.38, -0.25, -1.318], module: 'autoSniper',
  },
  scopedRifle: {
    file: 'AR_1', scale: 0.45, base: [0.38, -0.36, -0.7], accent: 0x5ce1ff, tint: 0x334249,
    hands: { right: [0.002, -0.06, -0.03], left: [0.005, 0.005, -0.23] },
    muzzle: [0.38, -0.267, -1.144], module: 'scopedRifle',
  },
  scopedSniper: {
    file: 'Sniper_3', scale: 0.4, base: [0.38, -0.36, -0.7], accent: 0xd7a8ff, tint: 0x4a4258,
    hands: { right: [0.002, -0.06, -0.06], left: [0.005, 0.0, -0.25] },
    muzzle: [0.38, -0.29, -1.34],
  },
  dmr: {
    file: 'Sniper_2', scale: 0.38, base: [0.38, -0.36, -0.7], accent: 0xffd166, tint: 0x55503e,
    hands: { right: [0.002, -0.06, -0.065], left: [0.005, 0.0, -0.28] },
    muzzle: [0.38, -0.25, -1.318],
  },
  lmg: {
    file: 'AR_3', scale: 0.44, base: [0.38, -0.34, -0.68], accent: 0xff7a5c, tint: 0x4f3f3a,
    hands: { right: [0.002, -0.07, -0.07], left: [0.005, -0.005, -0.23] },
    muzzle: [0.38, -0.229, -1.044],
  },
  pistol: {
    file: 'Pistol_1', scale: 0.5, base: [0.35, -0.22, -0.62], accent: 0xa8ffcb, tint: 0x46524a,
    hands: { pistol: true, right: [-0.004, -0.045, 0.035], left: [-0.055, -0.075, 0.05] },
    muzzle: [0.35, -0.082, -1.028],
  },
  heavy: {
    file: 'Pistol_3', scale: 0.55, base: [0.35, -0.225, -0.62], accent: 0xff6b8a, tint: 0x4e3a40,
    hands: { pistol: true, right: [-0.004, -0.05, 0.035], left: [-0.055, -0.08, 0.05] },
    muzzle: [0.35, -0.145, -0.944],
  },
};

const MUZZLE_POSITIONS = {
  rifle: [0.38, -0.267, -1.144], smg: [0.38, -0.24, -0.945], shotgun: [0.38, -0.265, -1.074],
  sniper: [0.38, -0.286, -1.312], scout: [0.38, -0.286, -1.34],
  autoSniper: [0.38, -0.25, -1.318], scopedRifle: [0.38, -0.267, -1.144],
  scopedSniper: [0.38, -0.29, -1.34],
  dmr: [0.38, -0.25, -1.318], lmg: [0.38, -0.229, -1.044],
  pistol: [0.35, -0.082, -1.028], heavy: [0.35, -0.145, -0.944],
};
const MUZZLE_SCALES = {
  rifle: 0.42, smg: 0.34, shotgun: 0.66, sniper: 0.56, scopedSniper: 0.58,
  scout: 0.58, autoSniper: 0.54, scopedRifle: 0.44,
  dmr: 0.5, lmg: 0.54, pistol: 0.3, heavy: 0.34,
};

const INSPECT_PROFILES = {
  rifle: { duration: 2.75, lift: 0.13, push: 0.17, pull: 0.46, yaw: 0.3, pitch: 0.17, roll: 0.14, breathe: 0.008 },
  smg: { duration: 2.5, lift: 0.14, push: 0.19, pull: 0.44, yaw: 0.36, pitch: 0.18, roll: 0.16, breathe: 0.01 },
  shotgun: { duration: 2.85, lift: 0.13, push: 0.17, pull: 0.5, yaw: 0.28, pitch: 0.2, roll: 0.14, breathe: 0.007 },
  sniper: { duration: 3.0, lift: 0.12, push: 0.15, pull: 0.6, yaw: 0.26, pitch: 0.14, roll: 0.12, breathe: 0.006 },
  scout: { duration: 2.8, lift: 0.13, push: 0.17, pull: 0.55, yaw: 0.3, pitch: 0.15, roll: 0.13, breathe: 0.008 },
  autoSniper: { duration: 2.9, lift: 0.12, push: 0.16, pull: 0.56, yaw: 0.28, pitch: 0.15, roll: 0.12, breathe: 0.007 },
  scopedRifle: { duration: 2.7, lift: 0.13, push: 0.17, pull: 0.45, yaw: 0.3, pitch: 0.16, roll: 0.13, breathe: 0.008 },
  scopedSniper: { duration: 3.1, lift: 0.12, push: 0.15, pull: 0.62, yaw: 0.26, pitch: 0.14, roll: 0.12, breathe: 0.006 },
  dmr: { duration: 2.95, lift: 0.12, push: 0.16, pull: 0.58, yaw: 0.27, pitch: 0.15, roll: 0.12, breathe: 0.006 },
  lmg: { duration: 3.0, lift: 0.12, push: 0.17, pull: 0.58, yaw: 0.28, pitch: 0.18, roll: 0.15, breathe: 0.007 },
  pistol: { duration: 2.5, lift: 0.16, push: 0.21, pull: 0.2, yaw: 0.5, pitch: 0.26, roll: 0.24, breathe: 0.012 },
  heavy: { duration: 2.6, lift: 0.16, push: 0.21, pull: 0.2, yaw: 0.46, pitch: 0.24, roll: 0.22, breathe: 0.011 },
  knife: { duration: 3.15, lift: 0.19, push: 0.24, pull: 0.26, yaw: 0.46, pitch: 0.34, roll: 0.95, breathe: 0.018 },
};

// 武器后坐弹簧冲量与镜头震动强度，参考 CS2 的枪械手感分层
const GUN_KICK_PROFILES = {
  rifle: { pos: 1.05, rot: 0.9, roll: 0.55, shake: 0.45 },
  smg: { pos: 0.78, rot: 0.66, roll: 0.4, shake: 0.3 },
  shotgun: { pos: 2.7, rot: 2.25, roll: 1.45, shake: 1.55, pump: true },
  sniper: { pos: 2.05, rot: 1.85, roll: 1.2, shake: 1.25, bolt: true },
  scout: { pos: 1.8, rot: 1.65, roll: 1.05, shake: 1.05, bolt: true },
  autoSniper: { pos: 1.65, rot: 1.45, roll: 1.0, shake: 0.95 },
  scopedRifle: { pos: 1.0, rot: 0.82, roll: 0.5, shake: 0.4 },
  scopedSniper: { pos: 2.15, rot: 1.95, roll: 1.25, shake: 1.35, bolt: true },
  dmr: { pos: 1.5, rot: 1.3, roll: 0.9, shake: 0.8 },
  lmg: { pos: 1.18, rot: 0.92, roll: 0.62, shake: 0.55 },
  pistol: { pos: 0.95, rot: 0.9, roll: 0.55, shake: 0.35 },
  heavy: { pos: 1.55, rot: 1.2, roll: 0.8, shake: 0.7 },
  knife: { pos: 0, rot: 0, roll: 0, shake: 0 },
};

// 连发时横向后坐的固定节奏，模仿 CS2 可记忆的喷射轨迹
const SPRAY_PATTERNS = {
  rifle: [0, 0.14, -0.18, 0.24, -0.3, 0.34, -0.3, 0.4, -0.44, 0.42, -0.36, 0.3, -0.22, 0.12, 0],
  smg: [0.08, -0.13, 0.19, -0.24, 0.28, -0.3, 0.26, -0.2, 0.14, -0.06],
  lmg: [0.06, -0.1, 0.16, -0.2, 0.24, -0.27, 0.3, -0.33, 0.28, -0.22, 0.16, -0.1],
  scopedRifle: [0, 0.1, -0.14, 0.18, -0.22, 0.25, -0.24, 0.2, -0.15, 0.08],
  dmr: [0.08, -0.12, 0.16, -0.2, 0.22, -0.2],
  pistol: [0.06, -0.09, 0.12, -0.14, 0.16],
  heavy: [0.1, -0.14, 0.19, -0.22, 0.24],
  shotgun: [0.04, -0.06],
};

const GUN_KICK_STIFFNESS = 150;
const GUN_KICK_DAMPING = 19;

class CombatAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = 0.65;
    this.noiseBuffers = new Map();
  }

  init() {
    if (this.context) {
      this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.context.destination);
  }

  setVolume(value) {
    this.volume = clamp(value, 0, 1);
    if (this.master) this.master.gain.value = this.volume;
  }

  // 复用噪声缓冲，避免每次开枪都重新生成随机采样与分配 AudioBuffer
  noiseBuffer(duration) {
    const key = Math.max(1, Math.round(duration * 50));
    let variants = this.noiseBuffers.get(key);
    if (!variants) {
      if (this.noiseBuffers.size > 32) this.noiseBuffers.clear();
      variants = [];
      this.noiseBuffers.set(key, variants);
    }
    if (variants.length < 3) {
      const ctx = this.context;
      const length = Math.max(1, Math.floor(ctx.sampleRate * (key / 50)));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.18));
      variants.push(buffer);
    }
    return variants[Math.floor(Math.random() * variants.length)];
  }

  noise(duration, volume, cutoff = 1800) {
    if (!this.context) return;
    const ctx = this.context;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(duration);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
  }

  tone(frequency, duration, volume = 0.08, type = 'sine', endFrequency = null) {
    if (!this.context) return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }

  thunder() {
    if (!this.context) return;
    const ctx = this.context;
    const duration = 2.4;
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 170;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start();
    this.tone(42, 1.6, 0.05, 'sine', 27);
  }

  overheat() {
    this.noise(1.1, 0.06, 2600);
    this.tone(196, 0.16, 0.05, 'square', 92);
    setTimeout(() => this.noise(0.7, 0.035, 1500), 180);
  }

  explosion() {
    this.noise(0.7, 0.34, 820);
    this.tone(58, 0.6, 0.2, 'sine', 24);
    setTimeout(() => this.noise(0.35, 0.1, 380), 90);
  }

  pickup() {
    this.tone(620, 0.06, 0.06, 'sine', 880);
    setTimeout(() => this.tone(940, 0.09, 0.05, 'sine', 1180), 55);
  }

  grenadeBounce() {
    this.tone(280, 0.05, 0.035, 'triangle', 150);
  }

  gun(enemy = false, pistol = false) {
    this.noise(pistol ? 0.11 : 0.085, enemy ? 0.07 : 0.2, pistol ? 1500 : 2400);
    this.tone(pistol ? 115 : 82, 0.09, enemy ? 0.025 : 0.09, 'square', 38);
  }

  hit(kill = false) {
    this.tone(kill ? 920 : 660, 0.055, 0.075, 'sine', kill ? 420 : 520);
    if (kill) setTimeout(() => this.tone(1100, 0.08, 0.06), 55);
  }

  reload() {
    this.noise(0.035, 0.08, 900);
    this.tone(180, 0.035, 0.04, 'square', 100);
  }

  beep(urgent = false) {
    this.tone(urgent ? 1040 : 760, 0.08, 0.08, 'square');
  }

  empty() {
    this.tone(260, 0.035, 0.035, 'square', 170);
  }

  step(volume = 0.03, crouched = false) {
    this.noise(0.055, volume, crouched ? 380 : 620);
    this.tone(crouched ? 92 : 74, 0.05, volume * 0.55, 'sine', 46);
  }

  jump() {
    this.noise(0.07, 0.016, 900);
  }

  land(force = 1) {
    this.noise(0.11, 0.055 * force, 340);
    this.tone(64, 0.12, 0.032 * force, 'sine', 38);
  }

  magOut() {
    this.noise(0.035, 0.05, 900);
    this.tone(150, 0.03, 0.025, 'square', 90);
  }

  magIn() {
    this.noise(0.045, 0.065, 700);
    this.tone(112, 0.05, 0.032, 'square', 64);
  }

  bolt() {
    this.noise(0.03, 0.05, 1600);
    setTimeout(() => {
      this.noise(0.04, 0.055, 1200);
      this.tone(280, 0.035, 0.028, 'square', 170);
    }, 90);
  }

  pump() {
    this.noise(0.045, 0.06, 780);
    setTimeout(() => {
      this.noise(0.06, 0.08, 600);
      this.tone(118, 0.05, 0.03, 'square', 68);
    }, 130);
  }
}

export class TacticalGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.audio = new CombatAudio();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.state = 'menu';
    this.mode = 'bomb';
    this.tdm = false;
    this.unlimitedAmmo = false;
    this.online = null;
    this.onlineId = null;
    this.onlineTeam = 'A';
    this.operativeForm = 'male';
    this.femaleClips = new Map();
    this.onlineRoom = null;
    this.duelMode = false;
    this.remotePlayers = new Map();
    this.onlineScore = { A: 0, B: 0 };
    this.stateSendTimer = 0;
    this.deaths = 0;
    this.landingDip = 0;
    this.healBuffUntil = 0;
    this.thirdPerson = false;
    this.playerAvatar = null;
    this.scoped = false;
    this.baseFov = 73;
    this.scopeSway = new THREE.Vector2();
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.lastShotAt = -10;
    this.stepDistance = 0;
    this.lastCrosshairGap = -1;
    this.sensitivity = 1;
    this.touchSensitivity = 1;
    this.quality = 'high';
    this.maxPixelRatio = Math.min(devicePixelRatio, this.pixelRatioCap());
    this.currentPixelRatio = this.maxPixelRatio;
    this.qualityTimer = 0;
    this.frameTimeAccum = 0;
    this.frameTimeCount = 0;
    this.qualityStableTimer = 0;
    this.keys = {};
    this.mouseDown = false;
    this.touchMode = false;
    this.touchState = { moveX: 0, moveY: 0, crouch: false, firing: false, interact: false };
    this.touchLookId = null;
    this.touchMoveId = null;
    this.gamepad = {
      connected: false, index: null, pad: null, prev: [],
      moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      fire: false, scope: false, interact: false, crouch: false,
    };
    this.gamepadBadgeTimer = null;
    this.mouseSway = new THREE.Vector2();
    this.viewSway = new THREE.Vector2();
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.landingRoll = 0;
    this.cameraShake = 0;
    this.cameraShakePitch = 0;
    this.cameraShakeYaw = 0;
    this.gunKick = { pos: 0, posVel: 0, rot: 0, rotVel: 0, roll: 0, rollVel: 0 };
    this.sprayIndex = 0;
    this.boltCycle = 0;
    this.pumpCycle = 0;
    this.grenadeThrow = 0;
    this.grenadeThrowAt = 0;
    this.drawCycle = 0;
    this.meleeDir = 1;
    this.meleeStab = false;
    this.deathAt = 0;
    this.deathRoll = 0;
    this.plantingActive = false;
    this.plantRig = null;
    this.plantRigVisible = false;
    this.plantCore = null;
    this.solids = [];
    this.colliders = [];
    this.enemies = [];
    this.effects = [];
    // 特效描述符池，避免每次开枪/命中都新建临时对象
    this.effectPool = [];
    this.casings = [];
    this.casingRaycaster = null;
    this.casingBrassMat = null;
    this.casingShellMat = null;
    this.casingRight = new THREE.Vector3();
    this.casingUp = new THREE.Vector3();
    this.casingForward = new THREE.Vector3();
    this.casingOrigin = new THREE.Vector3();
    this.casingDown = new THREE.Vector3(0, -1, 0);
    this.casingGroundY = 0.012;
    this.casingGroundAt = -10;
    this.casingGroundOrigin = new THREE.Vector3(1e6, 0, 0);
    this.environmentAnimations = [];
    this.bulletHoleMesh = null;
    this.bulletHoleDummy = null;
    this.bulletHoleCursor = 0;
    this.grenades = 2;
    this.nextGrenade = 0;
    this.grenadeProjectiles = [];
    this.grenadeEffects = [];
    this.pickups = [];
    this.pickupToastTimer = null;
    this.round = 1;
    this.score = { friendly: 0, enemy: 0 };
    this.site = new THREE.Vector3(0, 0, -25);
    this.player = {
      position: new THREE.Vector3(0, 0, 31),
      velocity: new THREE.Vector3(),
      verticalVelocity: 0,
      health: 100,
      armor: 50,
      grounded: true,
      eyeHeight: 1.65,
      crouched: false,
      speed: 0,
      dead: false,
      respawnAt: 0,
      team: 'A',
      lean: 0,
    };
    this.weaponConfigs = {
      rifle: { name: 'VX-27', mode: '全自动', price: 2700, magSize: 30, ammo: 30, reserve: 90, reserveMax: 90, damage: 28, headDamage: 110, rate: 0.092, reload: 2.05, spread: 0.0035, recoil: 0.012, auto: true, heatPerShot: 3.4, coolRate: 13, speed: 1, switchTime: 0.46 },
      smg: { name: 'VX-9 蜂刺', mode: '高射速全自动', price: 1600, magSize: 30, ammo: 30, reserve: 90, reserveMax: 90, damage: 22, headDamage: 72, rate: 0.064, reload: 1.8, spread: 0.005, recoil: 0.008, auto: true, heatPerShot: 2.7, coolRate: 15, speed: 1.04, switchTime: 0.4 },
      shotgun: { name: 'B-12 重锤', mode: '8 弹丸泵动式', price: 1800, magSize: 7, ammo: 7, reserve: 28, reserveMax: 28, damage: 17, headDamage: 23, rate: 0.82, reload: 2.35, shellReload: true, shellTime: 0.34, spread: 0.038, recoil: 0.052, pellets: 8, heatPerShot: 9.5, coolRate: 13, speed: 0.97, switchTime: 0.52 },
      sniper: { name: 'M-90 长夜', mode: '3.5× 栓动狙击', price: 4500, magSize: 5, ammo: 5, reserve: 15, reserveMax: 15, damage: 125, headDamage: 220, rate: 1.18, reload: 2.8, spread: 0.0005, recoil: 0.058, recoilPitch: 0.03, scoped: true, scopeFov: 28, scopeZoom: '3.5×', heatPerShot: 16, coolRate: 15, speed: 0.92, switchTime: 0.62 },
      scout: { name: 'S-45 游隼', mode: '4.5× 轻型栓动', price: 3000, magSize: 6, ammo: 6, reserve: 24, reserveMax: 24, damage: 92, headDamage: 200, rate: 0.95, reload: 2.2, spread: 0.0007, recoil: 0.045, recoilPitch: 0.022, scoped: true, scopeFov: 26, scopeZoom: '4.5×', heatPerShot: 14, coolRate: 16, speed: 1.06, switchTime: 0.56 },
      autoSniper: { name: 'V-8 猎隼', mode: '3.5× 半自动狙击', price: 4200, magSize: 10, ammo: 10, reserve: 40, reserveMax: 40, damage: 82, headDamage: 185, rate: 0.38, reload: 2.6, spread: 0.0012, recoil: 0.036, recoilPitch: 0.018, scoped: true, scopeFov: 30, scopeZoom: '3.5×', heatPerShot: 10, coolRate: 14, speed: 0.94, switchTime: 0.56 },
      scopedRifle: { name: 'AR-5 鹰眼', mode: '2× 全自动步枪', price: 3400, magSize: 25, ammo: 25, reserve: 75, reserveMax: 75, damage: 31, headDamage: 105, rate: 0.1, reload: 2.15, spread: 0.0038, recoil: 0.014, auto: true, scoped: true, scopeFov: 38, scopeZoom: '2×', heatPerShot: 3.6, coolRate: 13, speed: 1, switchTime: 0.48 },
      scopedSniper: { name: 'AX-9 苍穹', mode: '6.5× 栓动狙击', price: 4750, magSize: 5, ammo: 5, reserve: 15, reserveMax: 15, damage: 135, headDamage: 245, rate: 1.3, reload: 3.0, spread: 0.02, recoil: 0.07, recoilPitch: 0.028, scoped: true, scopeFov: 22, scopeZoom: '6.5×', heatPerShot: 17, coolRate: 15, speed: 0.88, switchTime: 0.68 },
      dmr: { name: 'SR-8 裁决', mode: '2.5× 精确半自动', price: 3200, magSize: 12, ammo: 12, reserve: 36, reserveMax: 36, damage: 62, headDamage: 160, rate: 0.32, reload: 2.3, spread: 0.0009, recoil: 0.032, scoped: true, scopeFov: 34, scopeZoom: '2.5×', heatPerShot: 8, coolRate: 14, speed: 0.97, switchTime: 0.54 },
      lmg: { name: 'MG-7 碾骨', mode: '轻机枪 · 全自动', price: 3900, magSize: 60, ammo: 60, reserve: 120, reserveMax: 120, damage: 30, headDamage: 90, rate: 0.082, reload: 3.4, spread: 0.0065, recoil: 0.016, auto: true, heatPerShot: 3, coolRate: 11, speed: 0.9, switchTime: 0.7 },
      pistol: { name: 'P-12', mode: '半自动', price: 0, magSize: 12, ammo: 12, reserve: 48, reserveMax: 48, damage: 36, headDamage: 120, rate: 0.23, reload: 1.45, spread: 0.0025, recoil: 0.021, heatPerShot: 7, coolRate: 18, speed: 1.05, switchTime: 0.32 },
      heavy: { name: 'D-5 蝰蛇', mode: '重型半自动', price: 700, magSize: 7, ammo: 7, reserve: 21, reserveMax: 21, damage: 68, headDamage: 165, rate: 0.42, reload: 1.7, spread: 0.0018, recoil: 0.042, heatPerShot: 11, coolRate: 15, speed: 1.0, switchTime: 0.38 },
      knife: { name: 'K-7 爪刃', mode: '近战武器', magSize: 0, ammo: 0, reserve: 0, reserveMax: 0, damage: 65, headDamage: 90, rate: 0.52, reload: 0, spread: 0, recoil: 0, melee: true, speed: 1.08, switchTime: 0.3 },
    };
    Object.values(this.weaponConfigs).forEach((weapon) => {
      weapon.heat = 0;
      weapon.overheated = false;
      weapon.lastShotAt = -10;
    });
    this.primaryWeapon = 'rifle';
    this.secondaryWeapon = 'pistol';
    this.currentWeapon = 'rifle';
    this.lastWeapon = null;
    this.credits = 5000;
    this.buyTime = 20;
    this.nextShot = 0;
    this.reloading = false;
    this.reloadStart = 0;
    this.weaponKick = 0;
    this.bloom = 0;
    this.inspecting = false;
    this.inspectStart = 0;
    this.switchStart = -10;
    this.switchFrom = null;
    this.switchDuration = 0;
    this.wallRaycaster = new THREE.Raycaster();
    this.wallDistance = Infinity;
    this.wallCheckTimer = 0;
    this.wallPush = 0;
    this.pendingInspect = false;
    this.meleeSwing = 0;
    this.lastPistolShot = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x6f8582);
    this.scene.fog = new THREE.FogExp2(0x6f8582, 0.0088);
    this.camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, 0.045, 180);
    this.camera.rotation.order = 'YXZ';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(this.maxPixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environmentTexture = this.makeEnvironmentTexture();
    this.scene.environment = pmrem.fromEquirectangular(environmentTexture).texture;
    this.scene.environmentIntensity = 0.62;
    environmentTexture.dispose();
    pmrem.dispose();

    this.controls = new PointerLockControls(this.camera, document.body);
    this.raycaster = new THREE.Raycaster();
    this.scratch = {
      a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(),
      d: new THREE.Vector3(), e: new THREE.Vector3(), f: new THREE.Vector3(),
      g: new THREE.Vector3(), h: new THREE.Vector3(),
    };
    this.tpHead = new THREE.Vector3();
    this.tpDirection = new THREE.Vector3();
    this.tpRight = new THREE.Vector3();
    this.tpDesired = new THREE.Vector3();
    this.tpBack = new THREE.Vector3();
    this.inspectEuler = new THREE.Euler();
    this.inspectRotation = { x: 0, y: 0, z: 0 };
    this.gamepadNow = [];
    this.inspectPivot = new THREE.Vector3(0, -0.12, 0.34);
    this.inspectRotated = new THREE.Vector3();
    this.grenadePrev = new THREE.Vector3();
    this.grenadeStep = new THREE.Vector3();
    this.grenadeDir = new THREE.Vector3();
    this.grenadeNormal = new THREE.Vector3();
    this.jumpBuffer = 0;
    this.coyoteTimer = 0;
    this.shadowTick = 0;
    this.shadowHalfRate = false;
    this.prewarmTimer = null;
    this.crosshairUiTimer = 0;
    this.shotTargets = [];
    this.bulletHoleGeometry = new THREE.CircleGeometry(0.03, 8);
    this.bulletHoleMaterial = new THREE.MeshBasicMaterial({
      color: 0x151918, transparent: true, opacity: 0.82, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.sparkTexture = this.makeGlowTexture();
    this.buildSky();
    this.setupPostProcessing();
    const skinTextures = this.makeSkinTextures();
    const fabricTexture = this.makeFabricTexture();
    this.fabricTexture = fabricTexture;
    this.camoTexture = this.makeCamoTexture();
    this.fpMaterials = {
      glove: new THREE.MeshStandardMaterial({
        color: 0x2c3633, roughness: 0.92, metalness: 0.04,
        bumpMap: fabricTexture, bumpScale: 0.0018,
      }),
      pad: new THREE.MeshStandardMaterial({
        color: 0x3a4641, roughness: 0.62, metalness: 0.14,
        bumpMap: fabricTexture, bumpScale: 0.0012,
      }),
      skin: new THREE.MeshPhysicalMaterial({
        map: skinTextures.color, normalMap: skinTextures.normal,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: skinTextures.roughness, roughness: 0.88, metalness: 0,
        clearcoat: 0.06, clearcoatRoughness: 0.7,
        sheen: 0.26, sheenColor: new THREE.Color(0xff9d7a), sheenRoughness: 0.88,
        emissive: new THREE.Color(0x2a0d07), emissiveIntensity: 0.14,
        envMapIntensity: 0.7, vertexColors: true,
      }),
      skinDark: new THREE.MeshStandardMaterial({
        color: 0x6b4837, roughness: 0.92,
        normalMap: skinTextures.normal, normalScale: new THREE.Vector2(0.3, 0.3),
      }),
      skinTip: new THREE.MeshPhysicalMaterial({
        map: skinTextures.color, color: 0xffc8b4,
        normalMap: skinTextures.normal, normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: skinTextures.roughness, roughness: 0.9, metalness: 0,
        sheen: 0.36, sheenColor: new THREE.Color(0xff8a66), sheenRoughness: 0.85,
        emissive: new THREE.Color(0x2d0b06), emissiveIntensity: 0.18,
        envMapIntensity: 0.7, vertexColors: true,
      }),
      nail: new THREE.MeshStandardMaterial({ color: 0xb99b86, roughness: 0.62, metalness: 0 }),
      sleeve: new THREE.MeshStandardMaterial({
        color: 0x262e2b, roughness: 0.96,
        bumpMap: fabricTexture, bumpScale: 0.002,
      }),
      cuff: new THREE.MeshStandardMaterial({
        color: 0x1b2220, roughness: 0.9,
        bumpMap: fabricTexture, bumpScale: 0.002,
      }),
      strap: new THREE.MeshStandardMaterial({ color: 0x9ece42, emissive: 0x3f5c12, emissiveIntensity: 0.3, roughness: 0.6 }),
      device: new THREE.MeshStandardMaterial({ color: 0x111817, roughness: 0.48, metalness: 0.6 }),
      screen: new THREE.MeshStandardMaterial({ color: 0xc8ff52, emissive: 0xc8ff52, emissiveIntensity: 1.1, roughness: 0.25, metalness: 0.35 }),
    };
    this.buildWorld();
    this.buildColliderGrid();
    this.buildWeapons();
    this.bindEvents();
    this.setMenuCamera();
    this.character = { ready: false, template: null, clips: {}, failed: false };
    this.loadCharacterModel();
    this.schedulePrewarm(1600);
    this.renderer.setAnimationLoop(() => this.animate());
  }

  loadExternalWeaponModels() {
    if (this.weaponModelsLoading) return;
    this.weaponModelsLoading = true;
    const loader = new GLTFLoader();

    Object.entries(EXTERNAL_WEAPON_MODELS).forEach(([name, config]) => {
      loader.load(`${import.meta.env.BASE_URL}models/guns/${config.file}.gltf`, (gltf) => {
        const holder = new THREE.Group();
        const gun = gltf.scene;
        const accentColor = new THREE.Color(config.accent || 0x3a1604);
        const tintColor = new THREE.Color(config.tint || 0x46565a);
        gun.rotation.y = Math.PI / 2;
        gun.scale.setScalar(config.scale);
        gun.traverse((node) => {
          if (!node.isMesh) return;
          node.frustumCulled = false;
          node.castShadow = false;
          node.receiveShadow = false;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => {
            if (!material) return;
            material.envMapIntensity = 1.1;
            if (material.name === 'Main') {
              material.color.lerp(tintColor, 0.55);
              material.emissive.copy(accentColor);
              material.emissiveIntensity = 0.22;
              material.metalness = 0.15;
              material.roughness = 0.4;
            } else if (material.name === 'White') {
              material.color.lerp(tintColor, 0.2);
              material.emissive.copy(accentColor);
              material.emissiveIntensity = 0.06;
              material.metalness = 0.25;
              material.roughness = 0.45;
            } else {
              material.color.lerp(tintColor, 0.3);
              material.emissive.copy(accentColor);
              material.emissiveIntensity = 0.08;
              material.metalness = 0.55;
              material.roughness = 0.46;
            }
            material.needsUpdate = true;
          });
        });
        holder.add(gun);

        const hands = config.hands;
        const [rx, ry, rz] = hands.right;
        const [lx, ly, lz] = hands.left;
        if (hands.pistol) {
          this.placeFPSArm(holder, 'right', 0.88, [rx, ry, rz], [0, 1, -0.16], [-1, 0, 0]);
          this.placeFPSArm(holder, 'left', 0.82, [lx, ly, lz], [0, 1, -0.16], [1, 0.2, 0]);
        } else {
          this.placeFPSArm(holder, 'right', 0.88, [rx, ry, rz], [0, 1, -0.2], [-1, 0, 0]);
          this.placeFPSArm(holder, 'left', 0.82, [lx, ly, lz], [0, 0.2, -1], [0.18, 1, 0.22]);
        }

        const moduleAccent = new THREE.MeshStandardMaterial({ color: config.accent || 0xc8ff52, emissive: config.accent || 0xc8ff52, emissiveIntensity: 0.5, roughness: 0.35, metalness: 0.55 });
        const moduleDark = new THREE.MeshStandardMaterial({ color: 0x121a1b, roughness: 0.4, metalness: 0.82 });
        const moduleBox = (w, h, d, x, y, z, material = moduleDark) => {
          const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), material);
          mesh.position.set(x, y, z);
          holder.add(mesh);
          return mesh;
        };
        const modulePipe = (radius, length, x, y, z, material = moduleDark) => {
          const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), material);
          mesh.rotation.x = Math.PI / 2;
          mesh.position.set(x, y, z);
          holder.add(mesh);
          return mesh;
        };
        if (config.module === 'scout') {
          modulePipe(0.014, 0.26, 0, 0.075, -0.79);
          modulePipe(0.021, 0.09, 0, 0.075, -0.94);
          moduleBox(0.065, 0.016, 0.08, 0, 0.09, -0.94);
          const legL = moduleBox(0.012, 0.2, 0.012, -0.055, 0.0, -0.72);
          legL.rotation.z = 0.4;
          const legR = moduleBox(0.012, 0.2, 0.012, 0.055, 0.0, -0.72);
          legR.rotation.z = -0.4;
          moduleBox(0.02, 0.012, 0.18, 0.07, 0.03, -0.55, moduleAccent);
        } else if (config.module === 'autoSniper') {
          moduleBox(0.07, 0.16, 0.11, 0, -0.2, -0.38);
          moduleBox(0.075, 0.02, 0.115, 0, -0.285, -0.375, moduleAccent);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 8, 20), moduleDark);
          ring.position.set(0, 0.18, -0.28);
          holder.add(ring);
          moduleBox(0.02, 0.02, 0.16, 0.075, 0.02, -0.45, moduleAccent);
        } else if (config.module === 'scopedRifle') {
          modulePipe(0.026, 0.2, 0, 0.19, -0.28);
          modulePipe(0.033, 0.05, 0, 0.19, -0.39);
          modulePipe(0.029, 0.045, 0, 0.19, -0.17);
          const moduleLens = new THREE.Mesh(
            new THREE.CircleGeometry(0.022, 16),
            new THREE.MeshStandardMaterial({ color: 0x0a1b1f, emissive: 0x2b7c8c, emissiveIntensity: 0.5, roughness: 0.12, metalness: 0.6 }),
          );
          moduleLens.position.set(0, 0.19, -0.146);
          holder.add(moduleLens);
          moduleBox(0.035, 0.035, 0.1, 0.06, 0.0, -0.62);
          const laser = new THREE.Mesh(new THREE.CircleGeometry(0.01, 12), moduleAccent);
          laser.position.set(0.06, 0.0, -0.675);
          holder.add(laser);
          moduleBox(0.02, 0.012, 0.12, 0.07, 0.03, -0.35, moduleAccent);
        }

        holder.position.set(...config.base);
        this.weaponBasePositions[name] = new THREE.Vector3(...config.base);
        const previous = this.weaponModels[name];
        if (previous) this.camera.remove(previous);
        this.weaponModels[name] = holder;
        holder.visible = this.state !== 'menu' && this.currentWeapon === name;
        this.camera.add(holder);
        this.schedulePrewarm(800);
        if (this.currentWeapon === name && this.state !== 'menu') {
          Object.entries(this.weaponModels).forEach(([id, model]) => { model.visible = id === name; });
          this.updateWeaponUI();
        }
      }, undefined, () => {
        // 外部模型加载失败时继续使用程序化枪械
      });
    });
  }

  createFPSArm(side = 'right', scale = 1, options = {}) {
    const mats = this.fpMaterials;
    const s = side === 'right' ? 1 : -1;
    const arm = new THREE.Group();
    arm.name = `fpsArm-${side}`;
    const hand = new THREE.Group();
    // 以拳心（手指环抱的中心）作为手臂原点，方便对齐各武器握把
    hand.position.z = 0.068;
    arm.add(hand);

    const add = (parent, size, position, material, rotation = [0, 0, 0], radius = 0.008) => {
      const mesh = new THREE.Mesh(
        new RoundedBoxGeometry(...size, 2, Math.min(radius, Math.min(...size) * 0.3)),
        material,
      );
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      parent.add(mesh);
      return mesh;
    };
    const capsule = (parent, radius, length, position, rotation = [0, 0, 0], material = mats.skin) => {
      const geometry = new THREE.CapsuleGeometry(radius, Math.max(0.001, length - radius * 1.4), 4, 10);
      const positions = geometry.attributes.position;
      const colors = new Float32Array(positions.count * 3);
      const half = length * 0.5;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const end = Math.min(1, Math.max(0, Math.abs(y) / half - 0.62) / 0.38);
        const inner = Math.max(0, (x * -s) / radius);
        const shade = 1 - Math.min(0.32, end * end * 0.24 + inner * 0.1);
        colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = shade;
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      parent.add(mesh);
      return mesh;
    };

    // 手掌：深色半指手套覆盖手背与掌心，手指与拇指外露
    add(hand, [0.05, 0.094, 0.112], [s * 0.034, 0, 0.006], mats.glove, [0, 0, 0], 0.018);
    add(hand, [0.018, 0.066, 0.084], [s * 0.006, -0.003, -0.003], mats.pad, [0, 0, 0], 0.008);
    add(hand, [0.012, 0.072, 0.09], [s * 0.061, 0.002, 0.012], mats.pad, [0, 0, 0], 0.006);
    add(hand, [0.032, 0.026, 0.036], [s * 0.022, 0.048, -0.028], mats.glove, [0, 0, 0], 0.011);

    // 四指：三段指骨，关节逐级弯曲形成握拳
    const fingerRows = [
      { y: 0.033, r: 0.0106, lengths: [0.034, 0.025, 0.019], curls: [0.3, 0.45, 0.4] },
      { y: 0.011, r: 0.011, lengths: [0.037, 0.027, 0.02], curls: [0.55, 0.8, 0.65] },
      { y: -0.012, r: 0.0104, lengths: [0.035, 0.025, 0.019], curls: [0.6, 0.86, 0.68] },
      { y: -0.034, r: 0.0094, lengths: [0.029, 0.021, 0.017], curls: [0.66, 0.92, 0.7] },
    ];
    fingerRows.forEach(({ y, r, lengths, curls }, index) => {
      add(hand, [0.038, 0.021, 0.03], [s * 0.03, y, -0.052], mats.pad, [0, 0, -s * (index - 1.5) * 0.012], 0.007);
      const root = new THREE.Group();
      root.position.set(s * 0.025, y, -0.043);
      root.rotation.y = s * curls[0];
      hand.add(root);
      let parent = root;
      lengths.forEach((length, i) => {
        const segmentRadius = r * (1 - i * 0.12);
        capsule(parent, segmentRadius, length, [0, 0, -length / 2], [Math.PI / 2, 0, 0], i === 2 ? mats.skinTip : mats.skin);
        if (i === 0) {
          const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.34, r * 1.3, 0.014, 10), mats.glove);
          ring.rotation.x = Math.PI / 2;
          ring.position.z = -0.004;
          parent.add(ring);
        }
        if (i === 2) {
          const nail = new THREE.Mesh(new RoundedBoxGeometry(0.0036, 0.012, 0.014, 2, 0.0015), mats.nail);
          nail.position.set(s * r * 0.98, 0, -length * 0.55);
          nail.rotation.z = -s * 0.12;
          parent.add(nail);
        }
        if (i < 2) {
          const joint = new THREE.Group();
          joint.position.z = -length;
          joint.rotation.y = s * curls[i + 1];
          const crease = new THREE.Mesh(new THREE.CylinderGeometry(segmentRadius * 0.96, segmentRadius * 0.96, 0.005, 10), mats.skinDark);
          crease.rotation.x = Math.PI / 2;
          joint.add(crease);
          parent.add(joint);
          parent = joint;
        }
      });
    });

    // 拇指：两段，压在握把上方
    const thumb = new THREE.Group();
    thumb.position.set(s * 0.014, 0.05, -0.016);
    thumb.rotation.set(-0.18, s * 0.82, s * 0.2);
    hand.add(thumb);
    capsule(thumb, 0.0118, 0.04, [0, 0, -0.019], [Math.PI / 2, 0, 0]);
    const thumbJoint = new THREE.Group();
    thumbJoint.position.z = -0.037;
    thumbJoint.rotation.set(0.08, s * 0.5, 0);
    thumb.add(thumbJoint);
    capsule(thumbJoint, 0.0102, 0.03, [0, 0, -0.014], [Math.PI / 2, 0, 0], mats.skinTip);
    const thumbNail = new THREE.Mesh(new RoundedBoxGeometry(0.0034, 0.011, 0.012, 2, 0.0015), mats.nail);
    thumbNail.position.set(s * 0.0095, 0, -0.018);
    thumbNail.rotation.z = -s * 0.15;
    thumbJoint.add(thumbNail);

    // 手腕与袖口
    add(hand, [0.05, 0.062, 0.05], [s * 0.028, -0.002, 0.07], mats.glove, [0, 0, 0], 0.016);
    if (s < 0) {
      const device = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.018, 0.034, 2, 0.006), mats.device);
      device.position.set(s * 0.028, 0.056, 0.024);
      hand.add(device);
      const screen = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.005, 0.022, 2, 0.002), mats.screen);
      screen.position.set(s * 0.028, 0.066, 0.024);
      hand.add(screen);
      const knucklePlate = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.012, 0.024, 2, 0.004), mats.pad);
      knucklePlate.position.set(s * 0.032, 0.052, -0.042);
      hand.add(knucklePlate);
    }
    if (options.sleeve !== false) {
      const wrist = new THREE.Vector3(s * 0.03, -0.004, 0.146);
      const elbow = new THREE.Vector3(...(options.elbow || [s * 0.3, -0.36, 0.568]));
      const dir = elbow.sub(wrist);
      const length = dir.length();
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, length, 12, 1), mats.sleeve);
      sleeve.name = 'fpsSleeve';
      sleeve.position.copy(wrist).addScaledVector(dir, 0.5);
      sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      arm.add(sleeve);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.07, 12), mats.cuff);
      cuff.name = 'fpsCuff';
      cuff.position.copy(wrist).addScaledVector(dir.clone().normalize(), 0.022);
      cuff.quaternion.copy(sleeve.quaternion);
      arm.add(cuff);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.054, 0.03, 12), mats.strap);
      band.name = 'fpsBand';
      band.position.copy(wrist).addScaledVector(dir, 0.7);
      band.quaternion.copy(sleeve.quaternion);
      arm.add(band);
    }

    arm.scale.setScalar(scale);
    arm.userData.hand = hand;
    return arm;
  }

  placeFPSArm(parent, side, scale, position, axis, palm, options = {}) {
    const arm = this.createFPSArm(side, scale, options);
    const s = side === 'right' ? 1 : -1;
    const yAxis = new THREE.Vector3(...axis).normalize();
    const xAxis = new THREE.Vector3(...palm).multiplyScalar(-s).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    xAxis.crossVectors(yAxis, zAxis).normalize();
    arm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis));
    if (options.roll) arm.rotateY(options.roll);
    arm.position.set(...position);
    parent.add(arm);
    return arm;
  }

  loadCharacterModel() {
    const finish = () => setTimeout(() => $('loading-screen').classList.add('done'), 250);
    const fallback = setTimeout(finish, 9000);
    new GLTFLoader().load('/models/UAL2_Standard.glb', (gltf) => {
      clearTimeout(fallback);
      gltf.scene.traverse((node) => {
        if (node.isMesh || node.isSkinnedMesh) {
          node.frustumCulled = false;
          if (node.isSkinnedMesh) {
            node.computeBoundingSphere?.();
            if (node.boundingSphere) node.boundingSphere.radius *= 1.5;
          }
        }
      });
      this.character.template = gltf.scene;
      gltf.animations.forEach((clip) => { this.character.clips[clip.name] = clip; });
      this.character.ready = true;
      this.upgradeBoxEnemies();
      this.upgradeBoxRemotes();
      this.schedulePrewarm(400);
      // 干员模型（加载遮罩等待的主资源）就绪后再拉取枪械模型，避免并发抢占带宽
      this.loadExternalWeaponModels();
      finish();
    }, undefined, () => {
      clearTimeout(fallback);
      this.character.failed = true;
      this.loadExternalWeaponModels();
      finish();
    });
  }

  makeTexture(type = 'concrete') {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    let seed = type === 'floor' ? 9301 : type === 'metal' ? 4409 : type === 'container' ? 7817 : type === 'hazard' ? 3371 : type === 'grate' ? 1123 : type === 'windows' ? 6607 : 5501;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const stained = (count, alpha) => {
      for (let i = 0; i < count; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const radius = 12 + rand() * 74;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        const dark = rand() > 0.4;
        gradient.addColorStop(0, dark ? `rgba(18,24,23,${alpha})` : `rgba(215,220,210,${alpha * 0.45})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const speckle = (count, spread, alpha, light = false) => {
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = light ? `rgba(225,228,218,${alpha})` : `rgba(22,27,26,${alpha})`;
        ctx.fillRect(rand() * size, rand() * size, 1 + rand() * spread, 1 + rand() * spread);
      }
    };
    const crack = (count, alpha) => {
      ctx.strokeStyle = `rgba(16,21,20,${alpha})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        let x = rand() * size;
        let y = rand() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) {
          x += (rand() - 0.5) * 34;
          y += (rand() - 0.5) * 34;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    if (type === 'hazard') {
      ctx.fillStyle = '#141716';
      ctx.fillRect(0, 0, size, size);
      for (let x = -size; x < size * 2; x += 96) {
        ctx.fillStyle = '#d7a72e';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 48, 0);
        ctx.lineTo(x + 48 - size, size);
        ctx.lineTo(x - size, size);
        ctx.closePath();
        ctx.fill();
      }
      speckle(800, 2, 0.16);
      stained(12, 0.32);
    } else if (type === 'windows') {
      ctx.fillStyle = '#101719';
      ctx.fillRect(0, 0, size, size);
      for (let y = 14; y < size - 10; y += 34) {
        for (let x = 12; x < size - 10; x += 30) {
          const lit = rand();
          if (lit > 0.62) {
            ctx.fillStyle = lit > 0.88 ? 'rgba(206,231,214,.92)' : lit > 0.76 ? 'rgba(255,206,138,.8)' : 'rgba(116,160,158,.5)';
          } else {
            ctx.fillStyle = `rgba(20,30,31,${0.5 + rand() * 0.4})`;
          }
          ctx.fillRect(x, y, 16, 20);
          ctx.fillStyle = 'rgba(6,10,11,.55)';
          ctx.fillRect(x + 7, y, 1.5, 20);
        }
      }
      ctx.fillStyle = 'rgba(8,12,13,.55)';
      for (let y = 0; y < size; y += 34) ctx.fillRect(0, y + 32, size, 3);
    } else if (type === 'grate') {
      ctx.fillStyle = '#3e4a45';
      ctx.fillRect(0, 0, size, size);
      for (let y = 10; y < size; y += 26) {
        for (let x = 8; x < size; x += 20) {
          ctx.fillStyle = 'rgba(4,8,8,.92)';
          ctx.fillRect(x, y, 12, 14);
          ctx.fillStyle = 'rgba(195,208,198,.3)';
          ctx.fillRect(x, y, 12, 1.5);
          ctx.fillStyle = 'rgba(150,166,156,.12)';
          ctx.fillRect(x + 12, y, 8, 14);
        }
      }
      speckle(300, 2, 0.18);
    } else {
      const base = type === 'floor' ? 63 : type === 'metal' ? 84 : type === 'container' ? 92 : 119;
      ctx.fillStyle = `rgb(${base},${base + 2},${base})`;
      ctx.fillRect(0, 0, size, size);
      const image = ctx.getImageData(0, 0, size, size);
      const noiseScale = type === 'metal' ? 11 : type === 'floor' ? 17 : 21;
      for (let i = 0; i < image.data.length; i += 4) {
        const noise = (rand() - 0.5) * noiseScale;
        image.data[i] = clamp(image.data[i] + noise, 0, 255);
        image.data[i + 1] = clamp(image.data[i + 1] + noise, 0, 255);
        image.data[i + 2] = clamp(image.data[i + 2] + noise * 0.9, 0, 255);
      }
      ctx.putImageData(image, 0, 0);

      if (type === 'metal') {
        ctx.globalAlpha = 0.16;
        for (let y = 0; y < size; y += 2) {
          ctx.fillStyle = rand() > 0.5 ? '#d7ded8' : '#1b2424';
          ctx.fillRect(0, y, size, 1);
        }
        ctx.globalAlpha = 1;
        for (let y = 0; y <= size; y += 128) {
          ctx.fillStyle = 'rgba(12,17,17,.72)'; ctx.fillRect(0, y, size, 3);
          ctx.fillStyle = 'rgba(190,199,191,.25)'; ctx.fillRect(0, y + 3, size, 1);
          for (let x = 16; x < size; x += 32) {
            ctx.fillStyle = 'rgba(18,23,23,.8)';
            ctx.beginPath(); ctx.arc(x, y + 10, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(200,208,198,.22)';
            ctx.beginPath(); ctx.arc(x - 0.6, y + 9.4, 1, 0, Math.PI * 2); ctx.fill();
          }
        }
        for (let i = 0; i < 18; i++) {
          const x = rand() * size;
          const y = rand() * size;
          const gradient = ctx.createLinearGradient(x, y, x, y - 60);
          gradient.addColorStop(0, 'rgba(142,94,52,.42)');
          gradient.addColorStop(1, 'rgba(142,94,52,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y - 60, 3 + rand() * 6, 60);
        }
        stained(14, 0.4);
      } else if (type === 'container') {
        for (let x = 0; x < size; x += 24) {
          ctx.fillStyle = 'rgba(20,25,24,.55)'; ctx.fillRect(x, 0, 5, size);
          ctx.fillStyle = 'rgba(220,226,214,.16)'; ctx.fillRect(x + 5, 0, 3, size);
          ctx.fillStyle = 'rgba(8,11,11,.22)'; ctx.fillRect(x + 19, 0, 2, size);
        }
        ctx.fillStyle = 'rgba(10,14,14,.38)';
        ctx.fillRect(0, 0, size, 12); ctx.fillRect(0, size - 16, size, 16);
        for (let i = 0; i < 26; i++) {
          const x = rand() * size;
          const y = size * (0.35 + rand() * 0.6);
          const gradient = ctx.createLinearGradient(x, y, x, y - 90);
          gradient.addColorStop(0, 'rgba(126,72,39,.4)');
          gradient.addColorStop(1, 'rgba(126,72,39,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, y - 90, 2 + rand() * 7, 90);
        }
        stained(18, 0.35);
      } else if (type === 'floor') {
        speckle(2600, 2, 0.22);
        speckle(700, 1, 0.18, true);
        ctx.strokeStyle = 'rgba(14,19,19,.62)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
        ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(170,180,170,.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(4, 4, size - 8, size - 8);
        for (let i = 0; i < 6; i++) {
          ctx.strokeStyle = `rgba(12,17,17,${0.1 + rand() * 0.12})`;
          ctx.lineWidth = 10 + rand() * 22;
          ctx.beginPath();
          ctx.moveTo(rand() * size, 0);
          ctx.lineTo(rand() * size, size);
          ctx.stroke();
        }
        crack(10, 0.32);
        stained(18, 0.34);
      } else {
        for (let i = 0; i < 10; i++) {
          const x = rand() * size;
          const y = rand() * size;
          ctx.fillStyle = 'rgba(32,38,36,.1)';
          ctx.beginPath(); ctx.arc(x, y, 8 + rand() * 26, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(22,28,27,.42)';
        ctx.lineWidth = 2;
        for (let y = 0; y <= size; y += 128) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        }
        for (let x = 0; x <= size; x += 256) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
        }
        for (let x = 64; x < size; x += 128) {
          for (let y = 64; y < size; y += 128) {
            ctx.fillStyle = 'rgba(16,21,20,.24)';
            ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
          }
        }
        crack(7, 0.22);
        stained(14, 0.28);
        speckle(500, 2, 0.14);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeSignTexture(title, subtitle, accent = '#c8ff52') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(8,13,13,.94)';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 8, 160);
    ctx.strokeStyle = 'rgba(210,225,214,.24)';
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 12, 482, 136);
    ctx.fillStyle = accent;
    ctx.font = '700 44px Inter, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 36, 72);
    ctx.fillStyle = 'rgba(214,226,216,.7)';
    ctx.font = '500 18px Inter, Arial, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText(subtitle, 38, 108);
    ctx.fillStyle = 'rgba(200,255,82,.55)';
    ctx.font = '700 15px Inter, Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ZP // 07', 480, 132);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeScreenTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#061210';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = 'rgba(126,220,198,.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 256; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke(); }
    for (let y = 0; y < 128; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(126,220,198,.9)';
    ctx.font = '700 15px monospace';
    ctx.fillText('SYS // 07', 12, 20);
    ctx.fillStyle = 'rgba(200,255,82,.8)';
    ctx.fillText('ONLINE', 190, 20);
    ctx.strokeStyle = '#9ff0d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < 256; x += 4) {
      const y = 62 + Math.sin(x * 0.13) * 13 + Math.sin(x * 0.037) * 7;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const height = 6 + Math.abs(Math.sin(i * 1.7)) * 24;
      ctx.fillStyle = i % 4 === 0 ? 'rgba(200,255,82,.6)' : 'rgba(126,220,198,.4)';
      ctx.fillRect(14 + i * 17, 112 - height, 9, height);
    }
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 256, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeFogTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 16 + Math.random() * 52;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(216,228,220,${0.04 + Math.random() * 0.09})`);
      gradient.addColorStop(1, 'rgba(216,228,220,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeBannerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d1414';
    ctx.fillRect(0, 0, 256, 512);
    ctx.strokeStyle = 'rgba(200,255,82,.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 228, 484);
    ctx.fillStyle = 'rgba(200,255,82,.85)';
    ctx.font = '800 96px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ZP', 128, 150);
    ctx.fillStyle = 'rgba(210,225,214,.7)';
    ctx.font = '700 20px Inter, Arial, sans-serif';
    ctx.save();
    ctx.translate(128, 340);
    ctx.rotate(Math.PI / 2);
    ctx.fillText('ZERO PROTOCOL', 0, 0);
    ctx.restore();
    ctx.fillStyle = 'rgba(200,255,82,.2)';
    ctx.fillRect(28, 430, 200, 4);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(6,10,10,${Math.random() * 0.16})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 512, 2 + Math.random() * 8, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeBurnTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const x = size / 2 + (Math.random() - 0.5) * 110;
      const y = size / 2 + (Math.random() - 0.5) * 110;
      const radius = 18 + Math.random() * 52;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(8,7,6,${0.18 + Math.random() * 0.3})`);
      gradient.addColorStop(0.7, `rgba(14,12,9,${0.1 + Math.random() * 0.14})`);
      gradient.addColorStop(1, 'rgba(10,9,7,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeLightningTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 512);
    ctx.strokeStyle = 'rgba(232,244,255,.95)';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(160,205,255,.9)';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    let x = 64;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 26) {
      x += (Math.random() - 0.5) * 42;
      x = clamp(x, 14, 114);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let branch = 0; branch < 3; branch++) {
      let bx = 40 + Math.random() * 48;
      let by = 120 + Math.random() * 240;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      for (let i = 0; i < 5; i++) {
        bx += (Math.random() - 0.5) * 38;
        by += 16 + Math.random() * 26;
        ctx.lineTo(bx, by);
      }
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeEnvironmentTexture() {
    // 与场景一致的全景环境：风暴天空、地平线暖光与城市灯光
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const sky = ctx.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#25383c');
    sky.addColorStop(0.34, '#4d6668');
    sky.addColorStop(0.47, '#8ba09b');
    sky.addColorStop(0.52, '#5a6a66');
    sky.addColorStop(0.62, '#2a3532');
    sky.addColorStop(1, '#0d1211');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1024, 512);
    const warm = ctx.createRadialGradient(268, 244, 0, 268, 244, 330);
    warm.addColorStop(0, 'rgba(255,205,150,.5)');
    warm.addColorStop(0.45, 'rgba(236,166,110,.16)');
    warm.addColorStop(1, 'rgba(236,166,110,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, 1024, 512);
    const cool = ctx.createRadialGradient(756, 236, 0, 756, 236, 260);
    cool.addColorStop(0, 'rgba(126,214,208,.28)');
    cool.addColorStop(1, 'rgba(126,214,208,0)');
    ctx.fillStyle = cool;
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * 1024;
      const y = 250 + Math.random() * 26;
      const brightness = 0.25 + Math.random() * 0.6;
      ctx.fillStyle = Math.random() > 0.25
        ? `rgba(255,206,142,${brightness})`
        : `rgba(130,228,214,${brightness * 0.8})`;
      ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeNormalTexture(source, strength = 1.5) {
    // 从现有程序化贴图的明度生成法线贴图，为表面增加真实起伏
    const image = source.image;
    const width = image.width;
    const height = image.height;
    const pixels = image.getContext('2d').getImageData(0, 0, width, height).data;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const output = ctx.createImageData(width, height);
    const luminance = (x, y) => {
      const xi = (x + width) % width;
      const yi = (y + height) % height;
      const index = (yi * width + xi) * 4;
      return (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 255;
    };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = (luminance(x - 1, y) - luminance(x + 1, y)) * strength;
        const dy = (luminance(x, y + 1) - luminance(x, y - 1)) * strength;
        const length = Math.hypot(dx, dy, 1);
        const index = (y * width + x) * 4;
        output.data[index] = (dx / length * 0.5 + 0.5) * 255;
        output.data[index + 1] = (dy / length * 0.5 + 0.5) * 255;
        output.data[index + 2] = (1 / length * 0.5 + 0.5) * 255;
        output.data[index + 3] = 255;
      }
    }
    ctx.putImageData(output, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeWetnessTexture() {
    // 湿滑地面的粗糙度分布：积水处更光滑、干燥处更粗糙
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#efefef';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const radius = 18 + Math.random() * 95;
      const wet = ctx.createRadialGradient(x, y, 0, x, y, radius);
      wet.addColorStop(0, 'rgba(62,62,62,.85)');
      wet.addColorStop(0.6, 'rgba(104,104,104,.45)');
      wet.addColorStop(1, 'rgba(140,140,140,0)');
      ctx.fillStyle = wet;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const length = 30 + Math.random() * 150;
      const angle = Math.random() * Math.PI * 2;
      ctx.strokeStyle = 'rgba(88,88,88,.28)';
      ctx.lineWidth = 2 + Math.random() * 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    return texture;
  }

  makeFlameTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    // 由下至上收窄的火焰轮廓
    const streaks = [
      [64, 104, 42, 'rgba(255,236,180,.95)'],
      [62, 82, 34, 'rgba(255,186,86,.9)'],
      [66, 60, 24, 'rgba(255,132,48,.7)'],
      [60, 40, 15, 'rgba(238,92,28,.42)'],
    ];
    for (const [x, y, radius, color] of streaks) {
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.6, color.replace(/[\d.]+\)$/, '0.35)'));
      gradient.addColorStop(1, 'rgba(220,60,10,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeBeamTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.12, 'rgba(255,255,255,.5)');
    gradient.addColorStop(0.38, 'rgba(255,255,255,.32)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,.1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeRunoffTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.random() * 12;
      ctx.strokeStyle = `rgba(198,228,226,${0.14 + Math.random() * 0.22})`;
      ctx.lineWidth = 0.6 + Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      for (let y = 0; y <= 128; y += 8) {
        ctx.lineTo(x + Math.sin(y * 0.2 + i) * 1.6, y);
      }
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeOilStainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 9; i++) {
      const x = 50 + Math.random() * 156;
      const y = 50 + Math.random() * 156;
      const radius = 22 + Math.random() * 62;
      const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
      stain.addColorStop(0, 'rgba(8,11,10,.55)');
      stain.addColorStop(0.55, 'rgba(8,11,10,.3)');
      stain.addColorStop(1, 'rgba(8,11,10,0)');
      ctx.fillStyle = stain;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeSkidTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    for (const offset of [38, 90]) {
      for (let x = 8; x < 512; x += 5) {
        const y = offset + Math.sin(x * 0.018) * 7;
        ctx.strokeStyle = `rgba(9,12,11,${0.16 + Math.random() * 0.16})`;
        ctx.lineWidth = 2 + Math.random() * 2.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 4, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 34; i++) {
      const x = 40 + Math.random() * 432;
      const y = 60 + Math.random() * 140;
      const radius = 28 + Math.random() * 70;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(205,220,220,${0.06 + Math.random() * 0.1})`);
      gradient.addColorStop(1, 'rgba(205,220,220,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  makeBillboardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#071110';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(94,230,216,.6)';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.fillStyle = 'rgba(200,255,82,.9)';
    ctx.font = '800 62px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KUROTIDE', 256, 116);
    ctx.fillStyle = 'rgba(94,230,216,.75)';
    ctx.font = '700 24px Inter, Arial, sans-serif';
    ctx.fillText('黑潮工业港  //  ZONE 07', 256, 156);
    ctx.fillStyle = 'rgba(200,255,82,.35)';
    ctx.fillRect(86, 188, 340, 3);
    ctx.fillStyle = 'rgba(210,225,214,.45)';
    ctx.font = '600 16px monospace';
    ctx.fillText('CONTAINMENT  ·  CARGO  ·  RESEARCH', 256, 220);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 512, 1);
    const gradient = ctx.createLinearGradient(0, 0, 512, 0);
    gradient.addColorStop(0, 'rgba(94,230,216,.18)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(200,255,82,.12)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeSiteDecalTexture() {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    ctx.translate(center, center);
    ctx.strokeStyle = 'rgba(200,255,82,.82)';
    ctx.lineWidth = 16;
    for (let i = 0; i < 24; i++) {
      if (i % 2 === 0) continue;
      const start = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, 445, start, start + (Math.PI * 2) / 24 * 0.74);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(200,255,82,.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 390, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(200,255,82,.72)';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate((i / 4) * Math.PI * 2);
      ctx.beginPath();
      ctx.moveTo(0, -330);
      ctx.lineTo(-48, -250);
      ctx.lineTo(-16, -250);
      ctx.lineTo(-16, -200);
      ctx.lineTo(16, -200);
      ctx.lineTo(16, -250);
      ctx.lineTo(48, -250);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(200,255,82,.5)';
    ctx.font = '700 44px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SITE A  //  CONTAINMENT', 0, 120);
    ctx.font = '700 18px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(200,255,82,.32)';
    ctx.fillText('AUTHORIZED PERSONNEL ONLY', 0, 155);
    ctx.fillStyle = 'rgba(200,255,82,.1)';
    ctx.font = '700 330px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 0, 18);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeSkinTextures() {
    const size = 512;
    let seed = 20261120;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const finish = (canvas, srgb) => {
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.anisotropy = maxAnisotropy;
      if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    };

    // 颜色：底色 + 大块血色不均 + 雀斑 + 细纹
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = size;
    const colorCtx = colorCanvas.getContext('2d');
    colorCtx.fillStyle = '#80563f';
    colorCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 150; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const radius = 12 + rand() * 58;
      const gradient = colorCtx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, rand() > 0.48 ? 'rgba(168,92,66,.22)' : 'rgba(78,44,33,.2)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      colorCtx.fillStyle = gradient;
      colorCtx.beginPath();
      colorCtx.arc(x, y, radius, 0, Math.PI * 2);
      colorCtx.fill();
    }
    const colorImage = colorCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < colorImage.data.length; i += 4) {
      const noise = (rand() - 0.5) * 20;
      colorImage.data[i] = clamp(colorImage.data[i] + noise, 0, 255);
      colorImage.data[i + 1] = clamp(colorImage.data[i + 1] + noise * 0.9, 0, 255);
      colorImage.data[i + 2] = clamp(colorImage.data[i + 2] + noise * 0.8, 0, 255);
    }
    colorCtx.putImageData(colorImage, 0, 0);
    for (let i = 0; i < 1200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const radius = 0.4 + rand() * 1.5;
      colorCtx.fillStyle = rand() > 0.42 ? 'rgba(70,39,30,.28)' : 'rgba(224,168,136,.16)';
      colorCtx.beginPath();
      colorCtx.arc(x, y, radius, 0, Math.PI * 2);
      colorCtx.fill();
    }
    colorCtx.lineWidth = 0.8;
    for (let i = 0; i < 120; i++) {
      const x = rand() * size;
      const y = rand() * size;
      colorCtx.strokeStyle = rand() > 0.5 ? 'rgba(86,50,38,.16)' : 'rgba(204,148,120,.1)';
      colorCtx.beginPath();
      colorCtx.moveTo(x, y);
      colorCtx.quadraticCurveTo(x + (rand() - 0.5) * 36, y + (rand() - 0.5) * 28, x + (rand() - 0.5) * 62, y + (rand() - 0.5) * 46);
      colorCtx.stroke();
    }
    // 指关节横向褶皱（胶囊 UV 会映射成环绕手指的褶痕）
    for (const [band, strength] of [[0.18, 0.24], [0.46, 0.3], [0.72, 0.26], [0.9, 0.2]]) {
      const wave = (offset, color, width) => {
        colorCtx.strokeStyle = color;
        colorCtx.lineWidth = width;
        colorCtx.beginPath();
        for (let x = 0; x <= size; x += 6) {
          const y = band * size + offset + Math.sin(x * 0.045 + band * 12) * 3.5 + (rand() - 0.5) * 2.5;
          if (x === 0) colorCtx.moveTo(x, y);
          else colorCtx.lineTo(x, y);
        }
        colorCtx.stroke();
      };
      wave(0, `rgba(62,34,25,${strength})`, 3);
      wave(3.5, 'rgba(226,174,146,.13)', 1.4);
    }

    // 凹凸：毛孔、粗糙颗粒与细纹
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = bumpCanvas.height = size;
    const bumpCtx = bumpCanvas.getContext('2d');
    bumpCtx.fillStyle = '#808080';
    bumpCtx.fillRect(0, 0, size, size);
    const bumpImage = bumpCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < bumpImage.data.length; i += 4) {
      const noise = 128 + (rand() - 0.5) * 26;
      bumpImage.data[i] = bumpImage.data[i + 1] = bumpImage.data[i + 2] = noise;
    }
    bumpCtx.putImageData(bumpImage, 0, 0);
    for (let i = 0; i < 4200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const radius = 0.35 + rand() * 1.4;
      bumpCtx.fillStyle = rand() > 0.3 ? 'rgba(40,40,40,.26)' : 'rgba(210,210,210,.18)';
      bumpCtx.beginPath();
      bumpCtx.arc(x, y, radius, 0, Math.PI * 2);
      bumpCtx.fill();
    }
    bumpCtx.lineWidth = 1.1;
    bumpCtx.strokeStyle = 'rgba(38,38,38,.32)';
    for (let i = 0; i < 90; i++) {
      const x = rand() * size;
      const y = rand() * size;
      bumpCtx.beginPath();
      bumpCtx.moveTo(x, y);
      bumpCtx.quadraticCurveTo(x + (rand() - 0.5) * 45, y + (rand() - 0.5) * 32, x + (rand() - 0.5) * 80, y + (rand() - 0.5) * 55);
      bumpCtx.stroke();
    }
    // 与颜色图对应的关节褶皱高度
    for (const [band, strength] of [[0.18, 0.5], [0.46, 0.62], [0.72, 0.55], [0.9, 0.42]]) {
      const drawBand = (offset, color, width) => {
        bumpCtx.strokeStyle = color;
        bumpCtx.lineWidth = width;
        bumpCtx.beginPath();
        for (let x = 0; x <= size; x += 6) {
          const y = band * size + offset + Math.sin(x * 0.045 + band * 12) * 3.5 + (rand() - 0.5) * 2.5;
          if (x === 0) bumpCtx.moveTo(x, y);
          else bumpCtx.lineTo(x, y);
        }
        bumpCtx.stroke();
      };
      drawBand(0, `rgba(20,20,20,${strength})`, 4);
      drawBand(4.5, 'rgba(235,235,235,.3)', 1.6);
    }

    // 粗糙度：油光区域更光滑，干燥区域更粗糙
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = roughCanvas.height = size;
    const roughCtx = roughCanvas.getContext('2d');
    roughCtx.fillStyle = '#b4b4b4';
    roughCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 80; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const radius = 16 + rand() * 60;
      const gradient = roughCtx.createRadialGradient(x, y, 0, x, y, radius);
      const smooth = rand() > 0.45;
      gradient.addColorStop(0, smooth ? 'rgba(128,128,128,.25)' : 'rgba(214,214,214,.18)');
      gradient.addColorStop(1, 'rgba(180,180,180,0)');
      roughCtx.fillStyle = gradient;
      roughCtx.beginPath();
      roughCtx.arc(x, y, radius, 0, Math.PI * 2);
      roughCtx.fill();
    }
    const roughImage = roughCtx.getImageData(0, 0, size, size);
    for (let i = 0; i < roughImage.data.length; i += 4) {
      const noise = (rand() - 0.5) * 34;
      const value = clamp(180 + noise, 0, 255);
      roughImage.data[i] = roughImage.data[i + 1] = roughImage.data[i + 2] = value;
    }
    roughCtx.putImageData(roughImage, 0, 0);

    // 法线：由毛孔高度图生成，光照下能看出皮肤凹凸
    const heightImage = bumpCtx.getImageData(0, 0, size, size).data;
    const normalCanvas = document.createElement('canvas');
    normalCanvas.width = normalCanvas.height = size;
    const normalCtx = normalCanvas.getContext('2d');
    const normalImage = normalCtx.createImageData(size, size);
    const strength = 3.4;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const left = heightImage[(y * size + ((x - 1 + size) % size)) * 4] / 255;
        const right = heightImage[(y * size + ((x + 1) % size)) * 4] / 255;
        const up = heightImage[(((y - 1 + size) % size) * size + x) * 4] / 255;
        const down = heightImage[(((y + 1) % size) * size + x) * 4] / 255;
        const nx = (left - right) * strength;
        const ny = (down - up) * strength;
        const length = Math.hypot(nx, ny, 1) || 1;
        const index = (y * size + x) * 4;
        normalImage.data[index] = (nx / length * 0.5 + 0.5) * 255;
        normalImage.data[index + 1] = (ny / length * 0.5 + 0.5) * 255;
        normalImage.data[index + 2] = (1 / length * 0.5 + 0.5) * 255;
        normalImage.data[index + 3] = 255;
      }
    }
    normalCtx.putImageData(normalImage, 0, 0);

    return {
      color: finish(colorCanvas, true),
      normal: finish(normalCanvas, false),
      roughness: finish(roughCanvas, false),
    };
  }

  makeFabricTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    ctx.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 4) {
      ctx.strokeStyle = i % 8 === 0 ? 'rgba(40,40,40,.34)' : 'rgba(210,210,210,.26)';
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - size, size);
      ctx.stroke();
    }
    const image = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 22;
      const value = clamp(image.data[i] + noise, 0, 255);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeCamoTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9aa095';
    ctx.fillRect(0, 0, size, size);
    const shades = ['#5d635c', '#767d72', '#b4b9ad', '#858c80', '#4c524c'];
    for (let i = 0; i < 70; i++) {
      ctx.save();
      ctx.translate(Math.random() * size, Math.random() * size);
      ctx.rotate(Math.random() * Math.PI);
      ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)];
      ctx.globalAlpha = 0.55 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8 + Math.random() * 26, 5 + Math.random() * 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    const image = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 18;
      const value = clamp(image.data[i] + noise, 0, 255);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.4, 1.4);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    return texture;
  }

  makeGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  buildSky() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#0f1b20');
    gradient.addColorStop(0.28, '#2b4146');
    gradient.addColorStop(0.44, '#556d6d');
    gradient.addColorStop(0.54, '#849a94');
    gradient.addColorStop(0.6, '#93a69f');
    gradient.addColorStop(0.68, '#5e7270');
    gradient.addColorStop(0.82, '#3c4b4d');
    gradient.addColorStop(1, '#283335');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    // 烘焙风暴云带，让天空不再是纯渐变
    for (let i = 0; i < 46; i++) {
      const x = Math.random() * 512;
      const y = 60 + Math.random() * 190;
      const radiusX = 55 + Math.random() * 130;
      const radiusY = 12 + Math.random() * 34;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, radiusX);
      const dark = Math.random() > 0.3;
      cloud.addColorStop(0, dark ? `rgba(18,29,32,${0.1 + Math.random() * 0.18})` : `rgba(176,192,188,${0.05 + Math.random() * 0.08})`);
      cloud.addColorStop(0.72, dark ? 'rgba(18,29,32,.05)' : 'rgba(176,192,188,.02)');
      cloud.addColorStop(1, 'rgba(18,29,32,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, radiusY / radiusX);
      ctx.translate(-x, -y);
      ctx.fillStyle = cloud;
      ctx.beginPath();
      ctx.arc(x, y, radiusX, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // 地平线暖光与远处城市光晕
    const horizon = ctx.createLinearGradient(0, 246, 0, 340);
    horizon.addColorStop(0, 'rgba(255,206,150,0)');
    horizon.addColorStop(0.45, 'rgba(255,198,138,.14)');
    horizon.addColorStop(1, 'rgba(255,198,138,0)');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, 246, 512, 94);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(150, 32, 20),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    this.camera.add(sky);
    this.environmentAnimations.push((time) => {
      sky.rotation.y = time * 0.0035;
    });

    const sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xffd2a0, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sun.position.set(-80, 70, -115);
    sun.scale.setScalar(27);
    sun.renderOrder = -9;
    this.camera.add(sun);
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.currentPixelRatio);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // 屏幕空间环境光遮蔽：强化物体接触阴影与缝隙暗部
    this.gtaoPass = new GTAOPass(this.scene, this.camera, innerWidth, innerHeight);
    // AO 是低频效果，按半分辨率计算再放大合成，GPU 开销约降到四分之一，画质差异很小
    const gtaoSetSize = this.gtaoPass.setSize.bind(this.gtaoPass);
    this.gtaoPass.setSize = (width, height) => gtaoSetSize(
      Math.max(1, Math.round(width * 0.5)),
      Math.max(1, Math.round(height * 0.5)),
    );
    this.gtaoPass.output = GTAOPass.OUTPUT.Default;
    this.gtaoPass.blendIntensity = 0.65;
    this.gtaoPass.updateGtaoMaterial({
      radius: 0.55, distanceExponent: 1.2, thickness: 1, scale: 1,
      samples: 8, screenSpaceRadius: false,
    });
    this.gtaoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 3, rings: 1, samples: 8 });
    // 精灵、粒子与不写深度的发光面不参与 AO 法线缓冲
    // 缓存需要隐藏的对象，避免每帧遍历整个场景图
    this.gtaoEffectCache = [];
    this.gtaoFrameHidden = [];
    this.gtaoCacheTimer = 0;
    const gtaoRender = this.gtaoPass.render.bind(this.gtaoPass);
    this.gtaoPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      this.gtaoCacheTimer -= deltaTime || 0.016;
      if (this.gtaoCacheTimer <= 0) {
        this.gtaoCacheTimer = 0.5;
        this.gtaoEffectCache.length = 0;
        this.scene.traverse((object) => {
          if (object.isSprite || object.isPoints || object.isLine
            || (object.isMesh && object.material && object.material.depthWrite === false)) {
            this.gtaoEffectCache.push(object);
          }
        });
      }
      const hidden = this.gtaoFrameHidden;
      hidden.length = 0;
      for (const object of this.gtaoEffectCache) {
        if (object.visible) {
          object.visible = false;
          hidden.push(object);
        }
      }
      gtaoRender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
      for (const object of hidden) object.visible = true;
    };
    this.composer.addPass(this.gtaoPass);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.35, 1.05);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
    // 电影化调色：暗部偏青、亮部偏暖，叠加轻微暗角与胶片颗粒
    this.gradePass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.24 },
        uGrain: { value: 0.014 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uVignette;
        uniform float uGrain;
        varying vec2 vUv;
        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          vec3 cool = color.rgb * vec3(0.94, 1.01, 1.05);
          vec3 warm = color.rgb * vec3(1.04, 1.0, 0.95);
          color.rgb = mix(cool, warm, smoothstep(0.25, 0.85, luma));
          color.rgb = mix(color.rgb, color.rgb * color.rgb * (3.0 - 2.0 * color.rgb), 0.12);
          float vignette = 1.0 - smoothstep(0.35, 0.86, length(vUv - 0.5) * 1.3) * uVignette;
          color.rgb *= vignette;
          float grain = hash(vUv * vec2(1733.0, 977.0) + fract(uTime) * 37.0) - 0.5;
          color.rgb += grain * uGrain;
          gl_FragColor = color;
        }
      `,
    });
    this.composer.addPass(this.gradePass);
    // SMAA 抗锯齿，弥补后期管线丢失的 MSAA
    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);
    this.composer.setSize(innerWidth, innerHeight);
    this.syncBloomResolution();
    this.usePost = true;
  }

  syncBloomResolution() {
    if (!this.bloomPass) return;
    const scale = 0.5;
    this.bloomPass.setSize(
      Math.max(1, Math.round(innerWidth * this.currentPixelRatio * scale)),
      Math.max(1, Math.round(innerHeight * this.currentPixelRatio * scale)),
    );
  }

  schedulePrewarm(delay = 800) {
    if (this.state !== 'menu') return;
    if (this.prewarmTimer) clearTimeout(this.prewarmTimer);
    this.prewarmTimer = setTimeout(() => {
      this.prewarmTimer = null;
      this.prewarmRenderPipeline();
    }, delay);
  }

  // 在菜单阶段预编译武器、特效与角色材质，避免首次开枪/切枪/爆炸时着色器编译卡顿
  prewarmRenderPipeline() {
    if (!this.renderer || this.state !== 'menu') return;
    const restore = [];
    const show = (object) => {
      if (object && !object.visible) {
        object.visible = true;
        restore.push(object);
      }
    };
    Object.values(this.weaponModels).forEach(show);
    show(this.muzzleFlash);
    show(this.heatSteam);
    this.ensureTracerPool().forEach(show);
    this.ensureCasings().forEach((casing) => show(casing.mesh));
    this.ensureBulletHoles();
    if (this.bulletHoleMesh) {
      const count = this.bulletHoleMesh.count;
      this.bulletHoleMesh.count = Math.max(1, count);
      show(this.bulletHoleMesh);
      restore.push({ custom: () => { this.bulletHoleMesh.count = count; } });
    }
    if (this.character.ready && !this.playerAvatar) {
      const avatar = this.buildPlayerAvatar();
      if (avatar) {
        avatar.group.visible = false;
        show(avatar.group);
      }
    }
    show(this.ensurePlantRig());

    const temp = new THREE.Group();
    temp.position.set(0, -40, 0);
    const disposables = [];
    const grenadeGeometry = new THREE.SphereGeometry(0.095, 12, 10);
    const grenadeMaterial = new THREE.MeshStandardMaterial({ color: 0x2e3b2f, roughness: 0.48, metalness: 0.55 });
    temp.add(new THREE.Mesh(grenadeGeometry, grenadeMaterial));
    disposables.push(grenadeGeometry, grenadeMaterial);
    const additiveSprite = new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xffb35c, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    temp.add(new THREE.Sprite(additiveSprite));
    disposables.push(additiveSprite);
    const smokeSprite = new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0x4a5450, transparent: true, opacity: 0, depthWrite: false,
    });
    temp.add(new THREE.Sprite(smokeSprite));
    disposables.push(smokeSprite);
    const ringGeometry = new THREE.RingGeometry(0.35, 0.55, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb35c, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    temp.add(new THREE.Mesh(ringGeometry, ringMaterial));
    disposables.push(ringGeometry, ringMaterial);
    this.scene.add(temp);
    this.renderer.compile(this.scene, this.camera);
    this.scene.remove(temp);
    for (const item of disposables) item.dispose();
    for (const entry of restore) {
      if (entry.custom) entry.custom();
      else entry.visible = false;
    }
  }

  buildWorld() {
    const hemi = new THREE.HemisphereLight(0xc2dcda, 0x2b3732, 2.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd8ae, 4.6);
    sun.position.set(-24, 42, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 44;
    sun.shadow.camera.bottom = -44;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 115;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.sunLight = sun;
    this.hemiLight = hemi;
    this.baseSunIntensity = 4.6;
    this.baseHemiIntensity = 2.9;
    this.lightningNext = 6 + Math.random() * 5;
    this.lightningActive = 0;
    this.lightningSeed = 0;
    this.wakeLock = null;
    this.idleFrameAccum = 0;
    this.scene.fog = new THREE.FogExp2(0x5c7272, 0.0095);
    // 常驻事件光源：手雷爆炸与核心警示灯共用，避免动态增删灯光触发材质重编译
    this.bombLight = new THREE.PointLight(0xffa04a, 0, 18, 2);
    this.bombLight.position.set(0, 1, 0);
    this.scene.add(this.bombLight);
    this.explosionLightLife = 0;

    const clone = (texture, repeatX, repeatY) => {
      const copy = texture.clone();
      copy.needsUpdate = true;
      copy.repeat.set(repeatX, repeatY);
      return copy;
    };
    const concreteTexture = this.makeTexture('concrete');
    const floorTexture = this.makeTexture('floor');
    const metalTexture = this.makeTexture('metal');
    const containerTexture = this.makeTexture('container');
    const hazardTexture = this.makeTexture('hazard');
    const grateTexture = this.makeTexture('grate');
    const concreteNormal = this.makeNormalTexture(concreteTexture, 1.8);
    const floorNormal = this.makeNormalTexture(floorTexture, 1.4);
    const metalNormal = this.makeNormalTexture(metalTexture, 1.1);
    const containerNormal = this.makeNormalTexture(containerTexture, 1.8);
    const grateNormal = this.makeNormalTexture(grateTexture, 2.0);
    const wetness = this.makeWetnessTexture();
    wetness.repeat.set(3, 4);
    // 积水表面的细波纹，供清漆层法线使用
    const rippleCanvas = document.createElement('canvas');
    rippleCanvas.width = rippleCanvas.height = 256;
    const rippleCtx = rippleCanvas.getContext('2d');
    rippleCtx.fillStyle = '#808080';
    rippleCtx.fillRect(0, 0, 256, 256);
    for (let c = 0; c < 4; c++) {
      const cx = 40 + Math.random() * 176;
      const cy = 40 + Math.random() * 176;
      for (let radius = 6; radius < 82; radius += 7 + Math.random() * 3) {
        const strength = 1 - radius / 92;
        rippleCtx.strokeStyle = `rgba(255,255,255,${0.24 * strength})`;
        rippleCtx.lineWidth = 1.6;
        rippleCtx.beginPath();
        rippleCtx.arc(cx, cy, radius, 0, Math.PI * 2);
        rippleCtx.stroke();
        rippleCtx.strokeStyle = `rgba(0,0,0,${0.18 * strength})`;
        rippleCtx.beginPath();
        rippleCtx.arc(cx, cy, radius + 2.2, 0, Math.PI * 2);
        rippleCtx.stroke();
      }
    }
    const rippleSource = new THREE.CanvasTexture(rippleCanvas);
    const puddleNormal = this.makeNormalTexture(rippleSource, 1.6);
    rippleSource.dispose();
    puddleNormal.repeat.set(1.4, 1.4);
    this.environmentAnimations.push((time) => {
      puddleNormal.offset.y = (time * 0.012) % 1;
      puddleNormal.offset.x = Math.sin(time * 0.18) * 0.04;
    });
    const normalOf = (texture, repeatX, repeatY) => {
      const copy = clone(texture, repeatX, repeatY);
      copy.colorSpace = THREE.NoColorSpace;
      return copy;
    };
    const makeMat = (options) => new THREE.MeshStandardMaterial(options);
    this.materials = {
      concrete: makeMat({ map: clone(concreteTexture, 2, 1), normalMap: normalOf(concreteNormal, 2, 1), normalScale: new THREE.Vector2(0.55, 0.55), color: 0x9ca59f, roughness: 0.94, metalness: 0.02 }),
      concreteDark: makeMat({ map: clone(concreteTexture, 2, 1), normalMap: normalOf(concreteNormal, 2, 1), normalScale: new THREE.Vector2(0.5, 0.5), color: 0x56635f, roughness: 0.95, metalness: 0.02 }),
      concreteTrim: makeMat({ map: clone(concreteTexture, 1, 1), normalMap: normalOf(concreteNormal, 1, 1), normalScale: new THREE.Vector2(0.38, 0.38), color: 0x7b877f, roughness: 0.9, metalness: 0.05 }),
      floor: makeMat({
        map: clone(floorTexture, 20, 24),
        normalMap: normalOf(floorNormal, 20, 24), normalScale: new THREE.Vector2(0.42, 0.42),
        roughnessMap: wetness, roughness: 0.85, metalness: 0.16, envMapIntensity: 1.2,
        color: 0x929b93,
      }),
      walkway: makeMat({ map: clone(grateTexture, 2, 22), normalMap: normalOf(grateNormal, 2, 22), normalScale: new THREE.Vector2(0.7, 0.7), color: 0xa4b2a8, roughness: 0.55, metalness: 0.55 }),
      metal: makeMat({ map: clone(metalTexture, 2, 1), normalMap: normalOf(metalNormal, 2, 1), normalScale: new THREE.Vector2(0.32, 0.32), color: 0x677576, roughness: 0.5, metalness: 0.68 }),
      metalDark: makeMat({ map: clone(metalTexture, 2, 1), normalMap: normalOf(metalNormal, 2, 1), normalScale: new THREE.Vector2(0.28, 0.28), color: 0x394746, roughness: 0.58, metalness: 0.62 }),
      metalBright: makeMat({ map: clone(metalTexture, 1, 1), normalMap: normalOf(metalNormal, 1, 1), normalScale: new THREE.Vector2(0.24, 0.24), color: 0x879492, roughness: 0.4, metalness: 0.74 }),
      crate: makeMat({ map: clone(containerTexture, 1, 1), normalMap: normalOf(containerNormal, 1, 1), normalScale: new THREE.Vector2(0.6, 0.6), color: 0x6f8377, roughness: 0.66, metalness: 0.32 }),
      crateDark: makeMat({ color: 0x202b28, roughness: 0.6, metalness: 0.5 }),
      containerRed: makeMat({ map: clone(containerTexture, 1, 1), normalMap: normalOf(containerNormal, 1, 1), normalScale: new THREE.Vector2(0.66, 0.66), color: 0xa8614a, roughness: 0.7, metalness: 0.32 }),
      containerTeal: makeMat({ map: clone(containerTexture, 1, 1), normalMap: normalOf(containerNormal, 1, 1), normalScale: new THREE.Vector2(0.66, 0.66), color: 0x557a72, roughness: 0.7, metalness: 0.32 }),
      containerTan: makeMat({ map: clone(containerTexture, 1, 1), normalMap: normalOf(containerNormal, 1, 1), normalScale: new THREE.Vector2(0.66, 0.66), color: 0x9c855c, roughness: 0.72, metalness: 0.26 }),
      hazard: makeMat({ map: hazardTexture, color: 0xffffff, roughness: 0.78, metalness: 0.12 }),
      window: makeMat({ color: 0x0a201e, emissive: 0x64c5ae, emissiveIntensity: 1.4, roughness: 0.12, metalness: 0.45 }),
      lime: makeMat({ color: 0x9ece42, emissive: 0x5c8b19, emissiveIntensity: 0.45, roughness: 0.55 }),
      limeDim: makeMat({ color: 0x6c8c33, roughness: 0.7 }),
      lamp: makeMat({ color: 0xffcf8a, emissive: 0xffb45c, emissiveIntensity: 2.4, roughness: 0.4 }),
      rubber: makeMat({ color: 0x141a19, roughness: 0.96 }),
      puddle: new THREE.MeshPhysicalMaterial({
        color: 0x162624, roughness: 0.06, metalness: 0.18,
        clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.7,
        clearcoatNormalMap: puddleNormal, clearcoatNormalScale: new THREE.Vector2(0.32, 0.32),
        transparent: true, opacity: 0.68,
      }),
      skyline: makeMat({ color: 0x2c3e42, roughness: 1 }),
    };

    const detail = (mesh) => {
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      // 装饰几何均为静态，只计算一次世界矩阵
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      return mesh;
    };
    const dbox = (x, y, z, width, height, depth, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.position.set(x, y, z);
      return detail(mesh);
    };
    const dcyl = (x, y, z, radius, length, axis, material, segments = 10) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
      if (axis === 'x') mesh.rotation.z = Math.PI / 2;
      else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, y, z);
      return detail(mesh);
    };
    const addSign = (title, subtitle, x, y, z, width, height, rotationY, accent = '#c8ff52') => {
      const texture = this.makeSignTexture(title, subtitle, accent);
      const material = new THREE.MeshStandardMaterial({
        map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.24,
        roughness: 0.66, metalness: 0.08,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotationY;
      return detail(mesh);
    };

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 82), this.materials.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const walkway = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 52), this.materials.walkway);
    walkway.rotation.x = -Math.PI / 2;
    walkway.position.set(0, 0.012, 5);
    walkway.receiveShadow = true;
    walkway.raycast = () => {};
    this.scene.add(walkway);
    dbox(-1.16, 0.016, 5, 0.07, 0.01, 52, this.materials.limeDim);
    dbox(1.16, 0.016, 5, 0.07, 0.01, 52, this.materials.limeDim);
    for (const x of [-8.5, 8.5]) {
      for (let z = 28; z > -14; z -= 4.2) dbox(x, 0.014, z, 0.14, 0.006, 1.7, this.materials.limeDim);
    }
    for (const [x, z, sx, sz] of [[-12, 18, 2.2, 1.0], [11, 24, 1.8, 0.9], [-20, -2, 2.6, 1.2], [16, -16, 2.0, 1.0], [4, -32, 2.4, 1.1]]) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24), this.materials.puddle);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(sx, sz, 1);
      puddle.position.set(x, 0.017, z);
      puddle.raycast = () => {};
      this.scene.add(puddle);
    }
    for (const [x, z] of [[0, 10], [-12, -8], [12, 2]]) {
      const grate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), this.materials.walkway);
      grate.rotation.x = -Math.PI / 2;
      grate.position.set(x, 0.018, z);
      grate.raycast = () => {};
      this.scene.add(grate);
    }

    this.addBox(0, 0, -39, 66, 7, 1, this.materials.concreteDark);
    this.addBox(0, 0, 39, 66, 7, 1, this.materials.concreteDark);
    this.addBox(-33, 0, 0, 1, 7, 78, this.materials.concreteDark);
    this.addBox(33, 0, 0, 1, 7, 78, this.materials.concreteDark);

    // 外围墙细节：基座、金属上沿、立柱、灯带和管线
    const wallSides = [
      { side: 'north', x: 0, z: -38.45, length: 66 },
      { side: 'south', x: 0, z: 38.45, length: 66 },
      { side: 'west', x: -32.45, z: 0, length: 78 },
      { side: 'east', x: 32.45, z: 0, length: 78 },
    ];
    wallSides.forEach(({ side, x, z, length }) => {
      const alongX = side === 'north' || side === 'south';
      const dir = side === 'north' || side === 'west' ? 1 : -1;
      const panelX = alongX ? x : x + dir * 0.06;
      const panelZ = alongX ? z + dir * 0.06 : z;
      dbox(panelX, 0.55, panelZ, alongX ? length : 0.12, 1.1, alongX ? 0.12 : length, this.materials.concreteDark);
      dbox(panelX, 5.75, panelZ, alongX ? length : 0.12, 1.0, alongX ? 0.12 : length, this.materials.metalDark);
      dbox(panelX, 4.55, panelZ, alongX ? length : 0.1, 0.16, alongX ? 0.1 : length, this.materials.metal);
      for (let offset = -length / 2 + 4; offset < length / 2 - 2; offset += 8) {
        const px = alongX ? offset : panelX;
        const pz = alongX ? panelZ : offset;
        dbox(px, 3.2, pz, alongX ? 0.42 : 0.55, 6.3, alongX ? 0.55 : 0.42, this.materials.concreteTrim);
      }
      for (let offset = -length / 2 + 8; offset < length / 2; offset += 14) {
        const px = alongX ? offset : panelX;
        const pz = alongX ? panelZ : offset;
        const lampX = alongX ? px : x + dir * 0.34;
        const lampZ = alongX ? z + dir * 0.34 : pz;
        dbox(lampX, 4.7, lampZ, alongX ? 0.7 : 0.5, 0.3, alongX ? 0.5 : 0.7, this.materials.metalDark);
        dbox(lampX, 4.5, lampZ, alongX ? 0.5 : 0.1, 0.08, alongX ? 0.1 : 0.5, this.materials.lamp);
      }
      dcyl(
        alongX ? x : x + dir * 0.2,
        4.0,
        alongX ? z + dir * 0.2 : z,
        0.09,
        length * 0.9,
        alongX ? 'x' : 'z',
        this.materials.metalDark,
        8,
      );
    });
    addSign('ZERO PROTOCOL', 'SECTOR 07 / TRANSIT HALL', 0, 4.55, 38.36, 7.6, 2.4, Math.PI);
    addSign('RESEARCH ANNEX', 'AUTHORIZED PERSONNEL ONLY', -32.36, 4.35, 8, 6.4, 2.0, Math.PI / 2);
    addSign('SECURITY GRID', 'SURVEILLANCE ACTIVE', 32.36, 4.35, -8, 6.4, 2.0, -Math.PI / 2);
    addSign('CONTAINMENT', 'SITE A / LEVEL 03', 0, 5.55, -38.36, 6.4, 2.0, 0, '#ffcf8a');

    // 四座主建筑：在保持原有碰撞体与动线的前提下重做立面
    const compound = (cx, cz, width, height, depth, config) => {
      this.addBox(cx, 0, cz, width, height, depth, config.material || this.materials.concrete);
      this.addBox(cx, 0, cz, width + 0.24, 0.34, depth + 0.24, this.materials.metalDark, false);
      this.addBox(cx, 1.05, cz, width + 0.14, 0.14, depth + 0.14, this.materials.metalDark, false);
      this.addBox(cx, height * 0.58, cz, width + 0.16, 0.18, depth + 0.16, this.materials.metalDark, false);

      const faceInfo = (side) => {
        const horizontal = side === 'east' || side === 'west';
        const signMul = side === 'east' || side === 'south' ? 1 : -1;
        const faceX = cx + (side === 'east' ? width / 2 : side === 'west' ? -width / 2 : 0);
        const faceZ = cz + (side === 'south' ? depth / 2 : side === 'north' ? -depth / 2 : 0);
        return {
          horizontal, signMul, faceX, faceZ,
          span: horizontal ? depth : width,
          rotY: side === 'east' ? Math.PI / 2 : side === 'west' ? -Math.PI / 2 : side === 'south' ? 0 : Math.PI,
        };
      };
      const facadeBox = (side, offset, y, thickness, boxHeight, length, material, protrude = 0.06) => {
        const f = faceInfo(side);
        if (f.horizontal) {
          return dbox(f.faceX + f.signMul * (thickness / 2 + protrude * 0.2), y, cz + offset, thickness, boxHeight, length, material);
        }
        return dbox(cx + offset, y, f.faceZ + f.signMul * (thickness / 2 + protrude * 0.2), length, boxHeight, thickness, material);
      };
      const facadeSign = (side, offset, y, signWidth, signHeight, title, subtitle, accent) => {
        const f = faceInfo(side);
        if (f.horizontal) {
          return addSign(title, subtitle, f.faceX + f.signMul * 0.09, y, cz + offset, signWidth, signHeight, f.rotY, accent);
        }
        return addSign(title, subtitle, cx + offset, y, f.faceZ + f.signMul * 0.09, signWidth, signHeight, f.rotY, accent);
      };

      const decorateFace = (side, full) => {
        const f = faceInfo(side);
        for (let offset = -f.span / 2 + 0.9; offset < f.span / 2 - 0.6; offset += 3.0) {
          facadeBox(side, offset, (height - 0.6) / 2 + 0.3, 0.22, height - 0.6, 0.3, this.materials.metalDark, 0.05);
        }
        if (!full) {
          facadeBox(side, 0, height - 0.85, 0.2, 0.14, f.span * 0.82, this.materials.metal, 0.14);
          const winCenter = -f.span * 0.06;
          facadeBox(side, winCenter, height * 0.64, 0.1, 0.78, f.span * 0.5, this.materials.metalDark, 0.03);
          facadeBox(side, winCenter, height * 0.64, 0.07, 0.54, f.span * 0.46, this.materials.window, 0.7);
          for (const mullion of [-0.17, 0.17]) {
            facadeBox(side, winCenter + f.span * mullion, height * 0.64, 0.09, 0.56, 0.07, this.materials.metalDark, 0.75);
          }
          for (const lampOffset of [-f.span * 0.3, f.span * 0.32]) {
            facadeBox(side, lampOffset, height - 1.0, 0.34, 0.26, 0.5, this.materials.metalDark, 0.06);
            facadeBox(side, lampOffset, height - 1.16, 0.12, 0.07, 0.36, this.materials.lamp, 0.1);
          }
          return;
        }
        const windowOffset = f.span * 0.16;
        facadeBox(side, windowOffset, height * 0.66, 0.1, 0.86, f.span * 0.66, this.materials.metalDark, 0.03);
        facadeBox(side, windowOffset, height * 0.66, 0.07, 0.62, f.span * 0.6, this.materials.window, 0.7);
        for (const mullion of [-0.22, 0, 0.22]) {
          facadeBox(side, windowOffset + f.span * mullion, height * 0.66, 0.09, 0.64, 0.07, this.materials.metalDark, 0.75);
        }
        const doorOffset = -f.span * 0.27;
        facadeBox(side, doorOffset, 1.32, 0.13, 2.64, 1.9, this.materials.metalDark, 0.03);
        facadeBox(side, doorOffset, 1.22, 0.11, 2.3, 1.58, this.materials.metal, 0.6);
        facadeBox(side, doorOffset + 0.83, 1.22, 0.09, 2.2, 0.09, this.materials.lime, 0.95);
        facadeBox(side, doorOffset, 2.85, 0.85, 0.14, 2.5, this.materials.metalDark, 0.1);
        facadeBox(side, doorOffset, 2.64, 0.12, 0.08, 1.3, this.materials.lamp, 0.7);
        facadeSign(side, doorOffset, 3.2, 1.7, 0.52, config.label, config.code, config.accent);
        for (const lampOffset of [-f.span * 0.3, f.span * 0.34]) {
          facadeBox(side, lampOffset, height - 1.0, 0.34, 0.26, 0.5, this.materials.metalDark, 0.06);
          facadeBox(side, lampOffset, height - 1.16, 0.12, 0.07, 0.36, this.materials.lamp, 0.1);
        }
        for (const ventOffset of [f.span * 0.36, f.span * 0.43]) {
          facadeBox(side, ventOffset, height - 1.9, 0.08, 0.56, 0.82, this.materials.metalDark, 0.04);
        }
        facadeBox(side, -f.span * 0.1, height - 0.55, 0.18, 0.14, f.span * 0.64, this.materials.metal, 0.12);
        dcyl(
          f.horizontal ? f.faceX + f.signMul * 0.15 : cx - width * 0.32,
          height - 0.55,
          f.horizontal ? cz - depth * 0.3 : f.faceZ + f.signMul * 0.15,
          0.09,
          f.span * 0.62,
          f.horizontal ? 'z' : 'x',
          this.materials.metalDark,
          8,
        );
        const pipeX = f.horizontal ? f.faceX + f.signMul * 0.12 : cx - width * 0.42;
        const pipeZ = f.horizontal ? cz - depth * 0.42 : f.faceZ + f.signMul * 0.12;
        dcyl(pipeX, height / 2 + 0.2, pipeZ, 0.1, height - 0.7, 'y', this.materials.metalDark, 8);
        for (let cy = 1.2; cy < height - 0.6; cy += 1.5) {
          dbox(pipeX, cy, pipeZ, 0.26, 0.08, 0.26, this.materials.metal);
        }
      };
      decorateFace(config.mainFace, true);
      decorateFace(config.secondaryFace, false);

      const parapetY = height + 0.25;
      dbox(cx, parapetY, cz - depth / 2 + 0.09, width + 0.36, 0.5, 0.18, this.materials.concreteTrim);
      dbox(cx, parapetY, cz + depth / 2 - 0.09, width + 0.36, 0.5, 0.18, this.materials.concreteTrim);
      dbox(cx - width / 2 + 0.09, parapetY, cz, 0.18, 0.5, depth + 0.36, this.materials.concreteTrim);
      dbox(cx + width / 2 - 0.09, parapetY, cz, 0.18, 0.5, depth + 0.36, this.materials.concreteTrim);
      dbox(cx, height + 0.55, cz - depth / 2 + 0.09, width + 0.42, 0.06, 0.24, this.materials.metalBright);
      dbox(cx, height + 0.55, cz + depth / 2 - 0.09, width + 0.42, 0.06, 0.24, this.materials.metalBright);

      const unitX = cx - width * 0.24;
      const unitZ = cz + depth * 0.12;
      dbox(unitX, height + 0.95, unitZ, 2.5, 1.3, 1.9, this.materials.metalDark);
      dbox(unitX, height + 1.35, unitZ + 0.96, 2.1, 0.5, 0.06, this.materials.metal);
      dbox(unitX, height + 1.08, unitZ + 0.98, 1.8, 0.18, 0.05, this.materials.rubber);
      dcyl(unitX, height + 1.64, unitZ, 0.52, 0.1, 'y', this.materials.metal, 16);
      dbox(cx + width * 0.25, height + 0.8, cz - depth * 0.18, 1.6, 1.0, 1.3, this.materials.metal);
      dbox(cx + width * 0.25, height + 1.28, cz - depth * 0.18, 1.4, 0.12, 1.1, this.materials.metalDark);
      dcyl(cx + width * 0.42, height + 2.0, cz - depth * 0.42, 0.05, 3.6, 'y', this.materials.metalBright, 6);
      dbox(cx + width * 0.42, height + 3.0, cz - depth * 0.42, 0.9, 0.05, 0.05, this.materials.metalBright);
      const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff5d52 });
      const antennaBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), beaconMaterial);
      antennaBeacon.position.set(cx + width * 0.42, height + 3.55, cz - depth * 0.42);
      antennaBeacon.raycast = () => {};
      this.scene.add(antennaBeacon);
      this.environmentAnimations.push((time) => {
        const pulse = Math.max(0, Math.sin(time * 2.2 + cx * 0.35));
        beaconMaterial.color.setRGB(0.25 + pulse * 0.75, 0.05 + pulse * 0.1, 0.04 + pulse * 0.05);
      });
      dbox(cx + width * 0.42, height + 3.25, cz - depth * 0.42, 0.6, 0.04, 0.04, this.materials.metalBright);
      dcyl(cx, height + 0.62, cz - depth * 0.36, 0.11, width * 0.62, 'x', this.materials.metal, 8);
    };

    compound(-23, 7, 16, 6, 24, {
      mainFace: 'east', secondaryFace: 'south',
      label: 'RESEARCH ANNEX', code: 'C-01 / LAB', accent: '#c8ff52',
    });
    compound(23, 11, 15, 5.2, 19, {
      mainFace: 'west', secondaryFace: 'south',
      label: 'SECURITY HUB', code: 'D-02 / GRID', accent: '#8fd3ff',
    });
    compound(-25, -24, 13, 5.5, 13, {
      mainFace: 'east', secondaryFace: 'south',
      label: 'COOLANT PLANT', code: 'B-03 / PUMPS', accent: '#8fd3ff',
    });
    compound(25, -26, 12, 6.5, 16, {
      mainFace: 'west', secondaryFace: 'south',
      label: 'CONTAINMENT LAB', code: 'A-04 / SITE', accent: '#c8ff52',
    });

    // 低矮掩体与检查站
    const lowWall = (x, z, width, height, depth, material, label) => {
      this.addBox(x, 0, z, width, height, depth, material);
      dbox(x, height + 0.06, z, width + 0.18, 0.12, depth + 0.18, this.materials.metalDark);
      dbox(x, height - 0.18, z, width + 0.03, 0.24, depth + 0.03, this.materials.hazard);
      dbox(x - width * 0.32, height + 0.18, z, 0.5, 0.16, Math.min(0.6, depth + 0.3), this.materials.lamp);
      if (label) addSign(label, 'CHECKPOINT // HOLD', x, height + 0.65, z + depth / 2 + 0.03, Math.min(2.2, width * 0.8), 0.6, 0, '#ffcf8a');
    };
    lowWall(-11, 19, 8, 3.2, 3, this.materials.concrete, 'CHECKPOINT 02');
    lowWall(12, 21, 7, 2.8, 2.5, this.materials.metal, null);
    lowWall(-10, -6, 5, 3.4, 7, this.materials.concreteDark, 'PUMP CONTROL');
    lowWall(12, -7, 6, 2.8, 4, this.materials.metalDark, null);
    lowWall(0, 7, 4.5, 2.2, 2, this.materials.concreteTrim, null);

    // A 点上方龙门架与吊灯
    this.addBox(-13, 0, -25, 0.7, 6.4, 0.7, this.materials.metalDark);
    this.addBox(13, 0, -25, 0.7, 6.4, 0.7, this.materials.metalDark);
    dbox(0, 6.45, -25, 27, 0.35, 2.0, this.materials.metal);
    for (const sideZ of [-26.02, -23.98]) {
      dbox(0, 6.9, sideZ, 27, 0.08, 0.08, this.materials.metalBright);
      dbox(0, 7.25, sideZ, 27, 0.06, 0.06, this.materials.metalBright);
      for (let x = -12; x <= 12; x += 3) dbox(x, 7.05, sideZ, 0.07, 0.7, 0.07, this.materials.metalBright);
    }
    for (const x of [-9, 0, 9]) {
      dbox(x, 6.15, -25, 0.55, 0.22, 0.55, this.materials.metalDark);
      dbox(x, 6.02, -25, 0.42, 0.06, 0.42, this.materials.lamp);
    }
    addSign('CONTAINMENT A', 'OVERWATCH // LEVEL 03', 0, 5.05, -24.4, 4.6, 1.15, 0, '#c8ff52');

    // 跨场线缆
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x1a2221, roughness: 0.9, metalness: 0.2 });
    for (const [z, sag, y] of [[22, 1.0, 6.4], [-4, 0.8, 7.2], [-33, 0.6, 7.4]]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-32, y, z),
        new THREE.Vector3(-10, y - sag * 0.35, z + 1.2),
        new THREE.Vector3(0, y - sag, z),
        new THREE.Vector3(12, y - sag * 0.45, z - 1.1),
        new THREE.Vector3(32, y, z),
      ]);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.025, 4, false), cableMat);
      cable.raycast = () => {};
      this.scene.add(cable);
    }

    // 新增掩体
    this.addContainer(-18, 25.5, 2.4, 6.4, 2.6, this.materials.containerRed);
    this.addContainer(18, 25.5, 2.4, 6.0, 2.6, this.materials.containerTeal);
    this.addContainer(-18.5, -13, 2.4, 5.6, 2.4, this.materials.containerTan);
    this.addContainer(19.5, -13, 2.4, 5.6, 2.4, this.materials.containerRed);
    this.addContainer(-8, -17.5, 5.5, 2.2, 2.2, this.materials.containerTeal);

    this.addBarrier(-6.8, 16.2, 2.4, 0.9, 0.6);
    this.addBarrier(6.8, 16.2, 2.4, 0.9, 0.6);
    this.addBarrier(-6.2, -2.5, 2.4, 0.9, 0.6);
    this.addBarrier(6.8, -2.5, 2.4, 0.9, 0.6);

    // 原有掩体，位置做了少量避让
    this.addCrate(-6.5, -23, 2.5, 2.2, 2.5);
    this.addCrate(7, -28, 3, 2.6, 2.4);
    this.addCrate(9, -18, 2.2, 1.7, 2.2);
    this.addCrate(-13.2, 7, 2.2, 2, 2.2);
    this.addCrate(13, 27, 2.2, 1.7, 2.2);
    this.addCrate(-2, 19, 2, 1.35, 2);
    this.addCrate(2, 20.2, 2, 1.35, 2);
    this.addCrate(-14.5, -22.5, 2.4, 2.3, 2.4);

    const lampPivot = new THREE.Group();
    lampPivot.position.set(0, 6.35, -4);
    this.scene.add(lampPivot);
    const lampCable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 6), this.materials.metalDark);
    lampCable.position.y = -0.5;
    lampPivot.add(lampCable);
    const lampHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.22, 0.24, 12), this.materials.metalDark);
    lampHousing.position.y = -1.0;
    lampPivot.add(lampHousing);
    const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), this.materials.lamp);
    lampBulb.position.y = -1.13;
    lampBulb.raycast = () => {};
    lampPivot.add(lampBulb);
    const lampCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 1.8, 3.5, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffcf9a, transparent: true, opacity: 0.045, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    lampCone.position.y = -2.9;
    lampCone.raycast = () => {};
    lampPivot.add(lampCone);
    const laneSpot = new THREE.SpotLight(0xffc98c, 50, 16, Math.PI / 5, 0.6, 1.6);
    laneSpot.position.y = -1.13;
    laneSpot.castShadow = true;
    laneSpot.shadow.mapSize.set(512, 512);
    laneSpot.shadow.camera.near = 0.4;
    laneSpot.shadow.camera.far = 18;
    laneSpot.shadow.bias = -0.0006;
    laneSpot.shadow.normalBias = 0.02;
    lampPivot.add(laneSpot);
    const laneTarget = new THREE.Object3D();
    laneTarget.position.set(0, -7, 0);
    lampPivot.add(laneTarget);
    laneSpot.target = laneTarget;
    this.laneSpot = laneSpot;
    this.environmentAnimations.push((time) => {
      lampPivot.rotation.z = Math.sin(time * 0.8) * 0.12;
      lampPivot.rotation.x = Math.cos(time * 0.6) * 0.06;
    });

    this.buildAmbientDetails();
    this.buildWeatherAndProps();
    this.buildWetReflections();
    this.buildIncidentDetails();
    this.buildAtmosphereExtras();
    this.buildPickups();
    this.buildDynamicSetPieces();
    this.buildNeonAccents();
    this.buildSite();
    this.buildSkyline();
    this.buildDust();
    // 体积很小的静物不参与阴影投射，减少阴影 pass 的 draw call
    this.scene.traverse((object) => {
      if (!object.isMesh || !object.castShadow || !object.geometry) return;
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const radius = object.geometry.boundingSphere?.radius || 0;
      const scale = Math.max(object.scale.x, object.scale.y, object.scale.z);
      if (radius * scale < 0.3) object.castShadow = false;
    });
    this.batchStaticMeshes();
  }

  // 将手动静态化的静物按材质合并，显著减少主渲染与阴影 pass 的绘制调用
  batchStaticMeshes() {
    const solidSet = new Set(this.solids);
    const groups = new Map();
    this.scene.updateMatrixWorld(true);
    this.scene.traverse((object) => {
      if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh) return;
      if (object.matrixAutoUpdate !== false) return;
      // 只合并叶子网格，避免移除父级时带走未参与合批的灯光或动态子对象
      if (object.children.length) return;
      if (!object.geometry || Object.keys(object.geometry.morphAttributes || {}).length) return;
      if (!object.material || Array.isArray(object.material)) return;
      if (object.material.transparent || object.material.depthWrite === false) return;
      if (object.renderOrder !== 0) return;
      for (let parent = object.parent; parent && parent !== this.scene; parent = parent.parent) {
        if (parent === this.camera) return;
      }
      const attributes = Object.keys(object.geometry.attributes).sort().join(',');
      const key = [
        object.material.uuid, attributes, object.geometry.index ? 1 : 0,
        object.castShadow ? 1 : 0, object.receiveShadow ? 1 : 0,
      ].join('|');
      let batch = groups.get(key);
      if (!batch) {
        batch = [];
        groups.set(key, batch);
      }
      batch.push(object);
    });

    const removeList = [];
    for (const batch of groups.values()) {
      if (batch.length < 2) continue;
      const pieces = batch.map((mesh) => {
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        return geometry;
      });
      const merged = mergeGeometries(pieces, false);
      for (const geometry of pieces) geometry.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, batch[0].material);
      mesh.castShadow = batch[0].castShadow;
      mesh.receiveShadow = batch[0].receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.raycast = () => {};
      this.scene.add(mesh);
      removeList.push(...batch);
    }
    for (const mesh of removeList) {
      if (!mesh.parent) continue;
      if (solidSet.has(mesh)) {
        // 碰撞体仍需参与射线检测（弹孔、视线、地面投影），隐藏渲染但保留在场景中
        mesh.visible = false;
        mesh.castShadow = false;
      } else {
        mesh.parent.remove(mesh);
      }
    }
  }

  addBox(x, y, z, width, height, depth, material, collision = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y + height / 2, z);
    mesh.castShadow = height > 0.2;
    mesh.receiveShadow = true;
    // 静态场景几何：矩阵只计算一次，避免每帧重复更新
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.scene.add(mesh);
    if (collision) {
      this.solids.push(mesh);
      this.colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
    }
    return mesh;
  }

  addCrate(x, z, width, height, depth) {
    const crate = this.addBox(x, 0, z, width, height, depth, this.materials.crate);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(crate.geometry), new THREE.LineBasicMaterial({ color: 0x9aa99c, transparent: true, opacity: 0.45 }));
    // 描边只用于视觉；参与弹道检测会因线条射线默认阈值形成一圈 1 米厚的隐形碰撞
    edges.raycast = () => {};
    crate.add(edges);
    const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.025, 0.16, depth + 0.025), this.materials.crateDark);
    band.raycast = () => {};
    crate.add(band);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(width * 0.38, 0.012, depth + 0.03), this.materials.lime);
    stripe.position.y = height / 2 + 0.01;
    stripe.raycast = () => {};
    crate.add(stripe);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.075, height, 0.075), this.materials.metalDark);
      post.position.set(sx * (width / 2 - 0.037), 0, sz * (depth / 2 - 0.037));
      post.castShadow = true;
      post.raycast = () => {};
      crate.add(post);
    }
    const lid = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.055, depth + 0.03), this.materials.metalDark);
    lid.position.y = height / 2 - 0.035;
    lid.raycast = () => {};
    crate.add(lid);
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.3), this.materials.metal);
      handle.position.set(side * (width / 2 + 0.01), 0.12, 0);
      handle.raycast = () => {};
      crate.add(handle);
    }
    crate.traverse((child) => {
      if (child === crate) return;
      child.matrixAutoUpdate = false;
      child.updateMatrix();
    });
  }

  addContainer(x, z, width, depth, height, material) {
    const body = this.addBox(x, 0, z, width, height, depth, material);
    const addPart = (geometry, partMaterial, px, py, pz, rx = 0, ry = 0, rz = 0, shadow = false) => {
      const part = new THREE.Mesh(geometry, partMaterial);
      part.position.set(px, py, pz);
      part.rotation.set(rx, ry, rz);
      part.castShadow = shadow;
      part.receiveShadow = true;
      part.raycast = () => {};
      body.add(part);
      return part;
    };
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      addPart(new THREE.BoxGeometry(0.1, height, 0.1), this.materials.metalDark, sx * (width / 2 - 0.05), 0, sz * (depth / 2 - 0.05), 0, 0, 0, true);
    }
    for (const py of [-height / 2 + 0.05, height / 2 - 0.05]) {
      addPart(new THREE.BoxGeometry(width + 0.05, 0.1, 0.1), this.materials.metalDark, 0, py, depth / 2 - 0.05);
      addPart(new THREE.BoxGeometry(width + 0.05, 0.1, 0.1), this.materials.metalDark, 0, py, -depth / 2 + 0.05);
      addPart(new THREE.BoxGeometry(0.1, 0.1, depth + 0.05), this.materials.metalDark, width / 2 - 0.05, py, 0);
      addPart(new THREE.BoxGeometry(0.1, 0.1, depth + 0.05), this.materials.metalDark, -width / 2 + 0.05, py, 0);
    }
    addPart(new THREE.BoxGeometry(width + 0.02, 0.2, depth + 0.02), this.materials.hazard, 0, -height / 2 + 0.16);
    for (const side of [-1, 1]) {
      addPart(new THREE.BoxGeometry(width * 0.46, height * 0.84, 0.05), this.materials.metal, side * width * 0.245, 0, depth / 2 + 0.025);
      addPart(new THREE.BoxGeometry(0.04, 0.48, 0.07), this.materials.metalBright, side * 0.08, 0, depth / 2 + 0.065);
    }
    if (!this.containerSignMaterial) {
      const texture = this.makeSignTexture('CARGO', 'ZP // HANDLE WITH CARE', '#c8ff52');
      this.containerSignMaterial = new THREE.MeshStandardMaterial({
        map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.3,
        roughness: 0.72, metalness: 0.1,
      });
    }
    for (const side of [-1, 1]) {
      const placard = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.52), this.containerSignMaterial);
      placard.position.set(side * (width / 2 + 0.035), height * 0.12, 0);
      placard.rotation.y = side * Math.PI / 2;
      placard.raycast = () => {};
      body.add(placard);
    }
    for (const side of [-1, 1]) {
      addPart(new THREE.BoxGeometry(0.05, 0.46, 0.72), this.materials.crateDark, side * (width / 2 + 0.02), -height * 0.16, -depth * 0.22);
    }
    body.traverse((child) => {
      if (child === body) return;
      child.matrixAutoUpdate = false;
      child.updateMatrix();
    });
  }

  addBarrier(x, z, width, height, depth) {
    this.addBox(x, 0, z, width, 0.35, depth, this.materials.concreteTrim);
    const upperHeight = height - 0.35;
    const upper = new THREE.Mesh(new THREE.BoxGeometry(width, upperHeight, depth * 0.62), this.materials.concrete);
    upper.position.set(x, 0.35 + upperHeight / 2, z);
    upper.castShadow = true;
    upper.receiveShadow = true;
    upper.raycast = () => {};
    // 静态装饰：标为静态后可参与合批，减少绘制调用
    upper.matrixAutoUpdate = false;
    upper.updateMatrix();
    this.scene.add(upper);
    const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.03, 0.2, depth * 0.62 + 0.03), this.materials.hazard);
    band.position.set(x, height - 0.18, z);
    band.receiveShadow = true;
    band.raycast = () => {};
    band.matrixAutoUpdate = false;
    band.updateMatrix();
    this.scene.add(band);
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, depth + 0.12), this.materials.metalDark);
      foot.position.set(x + side * (width / 2 - 0.2), 0.06, z);
      foot.raycast = () => {};
      foot.matrixAutoUpdate = false;
      foot.updateMatrix();
      this.scene.add(foot);
    }
  }

  buildAmbientDetails() {
    const add = (mesh, shadow = false) => {
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      return mesh;
    };
    const barrel = (x, z, material) => {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.95, 14), material);
      body.position.set(x, 0.475, z);
      body.castShadow = true;
      body.receiveShadow = true;
      body.matrixAutoUpdate = false;
      body.updateMatrix();
      this.scene.add(body);
      this.solids.push(body);
      this.colliders.push({ minX: x - 0.34, maxX: x + 0.34, minZ: z - 0.34, maxZ: z + 0.34 });
      // 桶箍与桶盖只做视觉，标为静态后可被合批，避免为每个细节单独出一次绘制
      for (const y of [-0.235, 0.235]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.352, 0.055, 14), this.materials.metalDark);
        ring.position.y = y;
        ring.raycast = () => {};
        ring.matrixAutoUpdate = false;
        ring.updateMatrix();
        body.add(ring);
      }
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.03, 14), this.materials.metalDark);
      lid.position.y = 0.48;
      lid.raycast = () => {};
      lid.matrixAutoUpdate = false;
      lid.updateMatrix();
      body.add(lid);
    };
    barrel(-14.4, 3.8, this.materials.containerRed);
    barrel(-14.4, 4.65, this.materials.containerTeal);
    barrel(14.8, 6.2, this.materials.containerTan);
    barrel(-17.9, -22.3, this.materials.containerTeal);
    barrel(17.9, -10.5, this.materials.containerRed);

    const coneOrange = new THREE.MeshStandardMaterial({ color: 0xd46a34, roughness: 0.72 });
    const coneWhite = new THREE.MeshStandardMaterial({ color: 0xd8d5c6, roughness: 0.6 });
    const trafficCone = (x, z, rot) => {
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.52), this.materials.rubber);
      base.position.set(x, 0.03, z);
      base.rotation.y = rot;
      add(base);
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.62, 12), coneOrange);
      body.position.set(x, 0.4, z);
      body.rotation.y = rot;
      add(body, true);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.145, 0.175, 0.1, 12), coneWhite);
      band.position.set(x, 0.4, z);
      add(band);
    };
    trafficCone(-14.4, 22.2, 0.3);
    trafficCone(-7.5, 22.0, -0.4);
    trafficCone(5.5, 17.7, 0.8);
    trafficCone(8.1, 17.5, -0.2);

    const palletMaterial = new THREE.MeshStandardMaterial({ color: 0x6d563d, roughness: 0.92 });
    const pallet = (x, z, rot) => {
      const group = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 0.16), palletMaterial);
        slat.position.set(0, 0.12, -0.4 + i * 0.24);
        group.add(slat);
      }
      for (const zOffset of [-0.42, 0.42]) {
        const beam = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.09, 0.1), palletMaterial);
        beam.position.set(0, 0.05, zOffset);
        group.add(beam);
      }
      group.position.set(x, 0, z);
      group.rotation.y = rot;
      group.traverse((mesh) => {
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.raycast = () => {};
        }
      });
      this.scene.add(group);
    };
    pallet(-15.9, 26.8, 0.25);
    pallet(15.8, 24.3, -0.5);

    const reel = (x, z) => {
      const group = new THREE.Group();
      const discGeometry = new THREE.CylinderGeometry(0.62, 0.62, 0.08, 18);
      for (const xOffset of [-0.3, 0.3]) {
        const disc = new THREE.Mesh(discGeometry, this.materials.metal);
        disc.rotation.z = Math.PI / 2;
        disc.position.x = xOffset;
        group.add(disc);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.58, 12), this.materials.metal);
      hub.rotation.z = Math.PI / 2;
      group.add(hub);
      const cable = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.07, 6, 18), this.materials.rubber);
      cable.rotation.y = Math.PI / 2;
      cable.position.x = 0.34;
      group.add(cable);
      group.position.set(x, 0.62, z);
      group.traverse((mesh) => {
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.raycast = () => {};
        }
      });
      this.scene.add(group);
    };
    reel(14.9, 14.2);

    const screenTexture = this.makeScreenTexture();
    const monitor = (x, y, z, rotY, seed) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.64, 0.08), this.materials.metalDark);
      frame.position.set(x, y, z);
      frame.rotation.y = rotY;
      add(frame);
      const texture = screenTexture.clone();
      texture.needsUpdate = true;
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.52), material);
      screen.position.set(x + Math.sin(rotY) * 0.055, y, z + Math.cos(rotY) * 0.055);
      screen.rotation.y = rotY;
      add(screen);
      const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), this.materials.metal);
      conduit.position.set(x, y - 0.7, z);
      add(conduit);
      this.environmentAnimations.push((time) => {
        texture.offset.x = (time * 0.016 + seed) % 1;
        const dropout = Math.sin(time * 19.3 + seed * 9) > 0.965 ? 0.35 : 1;
        const pulse = 0.86 + Math.sin(time * 3.1 + seed * 4) * 0.06;
        material.color.setScalar(dropout * pulse);
      });
    };
    monitor(-14.86, 2.0, 3.8, Math.PI / 2, 0.2);
    monitor(15.44, 2.0, 8.8, -Math.PI / 2, 0.6);

    const fan = (x, y, z, direction = 1) => {
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.24, 18), this.materials.metalDark);
      housing.rotation.z = Math.PI / 2;
      housing.position.set(x, y, z);
      add(housing);
      const blades = new THREE.Group();
      blades.position.set(x + 0.13 * direction, y, z);
      for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.66, 0.15), this.materials.metalBright);
        blade.position.y = 0.33;
        blade.rotation.x = i * Math.PI / 2 + 0.2;
        blades.add(blade);
      }
      blades.traverse((mesh) => {
        if (mesh.isMesh) {
          mesh.castShadow = false;
          mesh.receiveShadow = true;
          mesh.raycast = () => {};
        }
      });
      this.scene.add(blades);
      for (const yOffset of [-0.42, 0, 0.42]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 1.5), this.materials.metalDark);
        bar.position.set(x + 0.27 * direction, y + yOffset, z);
        add(bar);
      }
      this.environmentAnimations.push((time, dt) => { blades.rotation.x -= dt * 6.5; });
    };
    fan(15.36, 4.5, 12.5, -1);

    const steam = (x, y, z, dx, dz) => {
      const puffs = [];
      for (let i = 0; i < 3; i++) {
        const material = new THREE.SpriteMaterial({
          map: this.sparkTexture, color: 0xd4e0da, transparent: true, opacity: 0, depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, y, z);
        sprite.scale.setScalar(0.4);
        sprite.raycast = () => {};
        this.scene.add(sprite);
        puffs.push({ sprite, phase: i / 3 });
      }
      this.environmentAnimations.push((time) => {
        for (const { sprite, phase } of puffs) {
          const t = (time * 0.13 + phase) % 1;
          sprite.position.set(x + dx * t, y + t * 2.2, z + dz * t);
          sprite.scale.setScalar(0.45 + t * 1.4);
          sprite.material.opacity = Math.sin(t * Math.PI) * 0.15;
        }
      });
    };
    steam(-14.5, 2.0, 5.4, 0.8, 0.15);
    steam(-25, 5.9, -19, 0.2, 0.4);
    steam(15.0, 1.5, 15.2, -0.8, -0.1);
    // 屋顶机组排出的蒸汽
    steam(-26.8, 7.4, 9.9, 0.25, 0.35);
    steam(19.4, 6.4, 13.3, -0.3, 0.12);
    steam(22.1, 7.7, -24.1, 0.15, 0.25);
    const vent = (x, y, z, rotY) => {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.08), this.materials.metalDark);
      frame.position.set(x, y, z);
      frame.rotation.y = rotY;
      add(frame);
      for (let i = 0; i < 3; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.05, 0.05), this.materials.metal);
        slat.position.set(x + Math.sin(rotY) * 0.06, y - 0.2 + i * 0.2, z + Math.cos(rotY) * 0.06);
        slat.rotation.y = rotY;
        add(slat);
      }
    };
    vent(-14.94, 2.0, 5.4, Math.PI / 2);
    vent(15.44, 1.5, 15.2, -Math.PI / 2);

    const addLightCone = (x, y, z, height, top, bottom, opacity) => {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffcf9a, transparent: true, opacity, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      });
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, 16, 1, true), material);
      cone.position.set(x, y - height / 2, z);
      cone.raycast = () => {};
      this.scene.add(cone);
    };
    for (const x of [-9, 0, 9]) addLightCone(x, 5.98, -25, 5.7, 0.18, 1.35, 0.03);

    const workX = 6.0;
    const workZ = 18.2;
    const workGlow = new THREE.MeshStandardMaterial({
      color: 0xffcf8a, emissive: 0xffb45c, emissiveIntensity: 2.2, roughness: 0.4,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 12), this.materials.metalDark);
    base.position.set(workX, 0.05, workZ);
    add(base, true);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 8), this.materials.metal);
    pole.position.set(workX, 0.95, workZ);
    add(pole, true);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.28), this.materials.metalDark);
    head.position.set(workX, 1.88, workZ);
    head.rotation.y = -0.5;
    add(head, true);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.04), workGlow);
    lens.position.set(workX + Math.sin(-0.5) * 0.16, 1.88, workZ + Math.cos(-0.5) * 0.16);
    lens.rotation.y = -0.5;
    add(lens);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 12), this.materials.metal);
    handle.position.set(workX, 2.1, workZ);
    handle.rotation.x = Math.PI / 2;
    add(handle);
    const workLight = new THREE.PointLight(0xffc07a, 12, 11, 2);
    workLight.position.set(workX, 1.9, workZ);
    this.scene.add(workLight);
    addLightCone(workX, 1.86, workZ, 1.8, 0.1, 1.5, 0.05);
    this.environmentAnimations.push((time) => {
      const dropout = Math.sin(time * 12.7 + 2.1) > 0.94 ? 0.35 : 1;
      const glow = 0.9 + Math.sin(time * 2.3) * 0.08;
      workLight.intensity = 12 * glow * dropout;
      workGlow.emissiveIntensity = 2.2 * glow * dropout;
    });

    const tubeGlow = new THREE.MeshStandardMaterial({
      color: 0xd9efe8, emissive: 0xd9efe8, emissiveIntensity: 2.0, roughness: 0.35,
    });
    const tube = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.1), tubeGlow);
    tube.position.set(-4.5, 5.98, -23.92);
    add(tube);
    for (const x of [-5.5, -3.5]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.16), this.materials.metalDark);
      bracket.position.set(x, 6.08, -23.92);
      add(bracket);
    }
    this.environmentAnimations.push((time) => {
      const power = Math.sin(time * 23 + 1.4) > -0.15 ? 1 : 0.12;
      tubeGlow.emissiveIntensity = 0.5 + 1.6 * power * (0.75 + Math.sin(time * 31) * 0.25);
    });

    const paperMaterial = new THREE.MeshStandardMaterial({ color: 0x7e867d, roughness: 0.95, side: THREE.DoubleSide });
    for (const [x, z, rot] of [[-7.5, 22, 0.4], [9, 9, -0.8], [-3, -14, 1.1], [13, 18, 0.2]]) {
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26), paperMaterial);
      paper.rotation.x = -Math.PI / 2;
      paper.rotation.z = rot;
      paper.position.set(x, 0.02, z);
      paper.raycast = () => {};
      this.scene.add(paper);
    }

    const rotor = new THREE.Group();
    rotor.position.set(25, 7.35, -26);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), this.materials.metalDark);
    mast.position.set(25, 6.9, -26);
    add(mast, true);
    const rotorHead = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.36, 0.5), this.materials.metalDark);
    rotorHead.position.y = 0.1;
    rotor.add(rotorHead);
    const rotorGlow = new THREE.MeshStandardMaterial({
      color: 0xffbf74, emissive: 0xff9a3c, emissiveIntensity: 2.4, roughness: 0.4,
    });
    const rotorLens = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.2, 0.05), rotorGlow);
    rotorLens.position.set(0, 0.1, 0.26);
    rotor.add(rotorLens);
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 10, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffa54a, transparent: true, opacity: 0.055, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }),
    );
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0, 0.1, 5);
    beam.raycast = () => {};
    rotor.add(beam);
    // 真实扫射聚光灯，让旋转探照灯真正照亮场地
    const searchSpot = new THREE.SpotLight(0xffb266, 46, 40, Math.PI / 9, 0.6, 1.15);
    searchSpot.position.set(0, 0.1, 0.24);
    searchSpot.castShadow = false;
    const searchTarget = new THREE.Object3D();
    searchTarget.position.set(0, -9, 16);
    rotor.add(searchSpot);
    rotor.add(searchTarget);
    searchSpot.target = searchTarget;
    this.scene.add(rotor);
    this.environmentAnimations.push((time, dt) => {
      rotor.rotation.y += dt * 0.32;
      rotorGlow.emissiveIntensity = 2.0 + Math.sin(time * 4.2) * 0.4;
    });
  }

  buildWeatherAndProps() {
    const add = (mesh, shadow = false) => {
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      return mesh;
    };

    const rainCount = 900;
    const rainPositions = new Float32Array(rainCount * 6);
    const rainSpeeds = new Float32Array(rainCount);
    for (let i = 0; i < rainCount; i++) {
      const x = (Math.random() - 0.5) * 66;
      const y = 4 + Math.random() * 12;
      const z = (Math.random() - 0.5) * 78;
      const length = 0.3 + Math.random() * 0.35;
      const offset = i * 6;
      rainPositions[offset] = x;
      rainPositions[offset + 1] = y;
      rainPositions[offset + 2] = z;
      rainPositions[offset + 3] = x + 0.07;
      rainPositions[offset + 4] = y - length;
      rainPositions[offset + 5] = z + 0.025;
      rainSpeeds[i] = 9 + Math.random() * 5;
    }
    const rainGeometry = new THREE.BufferGeometry();
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rain = new THREE.LineSegments(
      rainGeometry,
      new THREE.LineBasicMaterial({ color: 0xb6d4d0, transparent: true, opacity: 0.24, depthWrite: false }),
    );
    rain.frustumCulled = false;
    rain.raycast = () => {};
    this.scene.add(rain);
    let rainAccum = 0;
    this.environmentAnimations.push((time, dt) => {
      // 雨丝顶点更新限制在 30Hz：视觉几乎无差别，但可省掉一半 CPU 循环与显存上传
      rainAccum += dt;
      if (rainAccum < 1 / 30) return;
      const step = rainAccum;
      rainAccum = 0;
      const array = rainGeometry.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        const offset = i * 6;
        const fall = rainSpeeds[i] * step;
        array[offset + 1] -= fall;
        array[offset + 4] -= fall;
        if (array[offset + 4] < 0.05) {
          const x = (Math.random() - 0.5) * 66;
          const z = (Math.random() - 0.5) * 78;
          const y = 10 + Math.random() * 7;
          const length = 0.3 + Math.random() * 0.35;
          array[offset] = x;
          array[offset + 1] = y;
          array[offset + 2] = z;
          array[offset + 3] = x + 0.07;
          array[offset + 4] = y - length;
          array[offset + 5] = z + 0.025;
        }
      }
      rainGeometry.attributes.position.needsUpdate = true;
    });

    const rippleSpots = [[-12, 18, 2.2, 1.0], [11, 24, 1.8, 0.9], [-20, -2, 2.6, 1.2], [4, -32, 2.4, 1.1]];
    rippleSpots.forEach(([x, z, scaleX, scaleZ], index) => {
      for (let ripple = 0; ripple < 2; ripple++) {
        const material = new THREE.MeshBasicMaterial({
          color: 0xbcd6d0, transparent: true, opacity: 0, depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.84, 1, 24), material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.026, z);
        ring.raycast = () => {};
        this.scene.add(ring);
        this.environmentAnimations.push((time) => {
          const phase = (time * 0.52 + ripple * 0.5 + index * 0.21) % 1;
          const grow = 0.15 + phase * 1.15;
          ring.scale.set(scaleX * grow, scaleZ * grow, 1);
          material.opacity = Math.sin(phase * Math.PI) * 0.28;
        });
      }
    });

    const fogTexture = this.makeFogTexture();
    for (const [x, z, rotation, scale] of [[0, 6, 0.2, 1], [-20, -2, -0.4, 0.9], [18, -10, 0.6, 0.85], [0, -30, 0.1, 1.1]]) {
      const texture = fogTexture.clone();
      texture.needsUpdate = true;
      texture.repeat.set(2, 2);
      const material = new THREE.MeshBasicMaterial({
        map: texture, color: 0xa9bfb9, transparent: true, opacity: 0.28, depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(38 * scale, 28 * scale), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rotation;
      mesh.position.set(x, 0.4, z);
      mesh.raycast = () => {};
      this.scene.add(mesh);
      this.environmentAnimations.push((time) => {
        texture.offset.x = time * 0.006 + x * 0.01;
        texture.offset.y = time * 0.003;
      });
    }

    const bannerTexture = this.makeBannerTexture();
    for (const [x, phase] of [[-7.2, 0.4], [7.2, 2.1]]) {
      const geometry = new THREE.PlaneGeometry(1.5, 3, 6, 14);
      const material = new THREE.MeshStandardMaterial({
        map: bannerTexture, side: THREE.DoubleSide, roughness: 0.92, metalness: 0.03,
      });
      const banner = new THREE.Mesh(geometry, material);
      banner.position.set(x, 4.75, -24.02);
      banner.receiveShadow = true;
      banner.raycast = () => {};
      this.scene.add(banner);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.7, 6), this.materials.metalDark);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(x, 6.3, -24.02);
      add(rod);
      for (const side of [-1, 1]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.05), this.materials.metalDark);
        strap.position.set(x + side * 0.6, 6.42, -24.02);
        add(strap);
      }
      const basePositions = new Float32Array(geometry.attributes.position.array);
      this.environmentAnimations.push((time) => {
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const bx = basePositions[i * 3];
          const by = basePositions[i * 3 + 1];
          const hang = (1.5 - by) / 3;
          positions.setZ(i, (
            Math.sin(time * 1.8 + by * 2.4 + phase) * 0.09
            + Math.sin(time * 1.1 + bx * 4 + phase) * 0.03
          ) * hang);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();
      });
    }

    const pathGeometry = new THREE.BoxGeometry(0.16, 0.03, 0.16);
    const pathMaterial = new THREE.MeshBasicMaterial({ color: 0xc8ff52 });
    const pathLights = new THREE.InstancedMesh(pathGeometry, pathMaterial, 24);
    const matrix = new THREE.Matrix4();
    let pathCount = 0;
    for (const x of [-1.28, 1.28]) {
      for (let z = 27; z >= -17; z -= 4) {
        matrix.makeTranslation(x, 0.04, z);
        pathLights.setMatrixAt(pathCount++, matrix);
      }
    }
    pathLights.count = pathCount;
    pathLights.instanceMatrix.needsUpdate = true;
    pathLights.raycast = () => {};
    this.scene.add(pathLights);

    for (const [x, z, phase] of [[-18, 28.4, 0.2], [18, 28.2, 1.1]]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.22), this.materials.metalDark);
      housing.position.set(x, 2.66, z);
      add(housing);
      const material = new THREE.MeshBasicMaterial({ color: 0xffb04a });
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), material);
      light.position.set(x, 2.78, z);
      add(light);
      this.environmentAnimations.push((time) => {
        const pulse = Math.sin(time * 2.6 + phase) * 0.5 + 0.5;
        material.color.setRGB(1, 0.35 + pulse * 0.4, 0.08 + pulse * 0.1);
      });
    }

    const sandMaterial = new THREE.MeshStandardMaterial({ color: 0x6f674b, roughness: 0.98 });
    const bagGeometry = new THREE.SphereGeometry(0.42, 10, 7);
    const addBag = (x, y, z, rotation) => {
      const bag = new THREE.Mesh(bagGeometry, sandMaterial);
      bag.scale.set(1.15, 0.5, 0.82);
      bag.position.set(x, y, z);
      bag.rotation.y = rotation;
      bag.castShadow = true;
      bag.receiveShadow = true;
      this.scene.add(bag);
      this.solids.push(bag);
    };
    for (let i = 0; i < 5; i++) addBag(-13.2 + i * 1.1, 0.18, 20.9, (Math.random() - 0.5) * 0.25);
    for (let i = 0; i < 4; i++) addBag(-12.65 + i * 1.1, 0.45, 20.86, (Math.random() - 0.5) * 0.25);
    this.colliders.push({ minX: -13.85, maxX: -8.15, minZ: 20.45, maxZ: 21.35 });

    const smallCrate = (x, z, width, height, depth) => {
      const crate = this.addBox(x, 0, z, width, height, depth, this.materials.crate);
      const band = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.06, depth + 0.02), this.materials.hazard);
      band.raycast = () => {};
      crate.add(band);
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.04), this.materials.metalBright);
      latch.position.set(0, 0.08, depth / 2 + 0.02);
      latch.raycast = () => {};
      crate.add(latch);
    };
    smallCrate(-14.5, 2.1, 0.8, 0.45, 0.55);
    smallCrate(15.1, 3.4, 0.75, 0.5, 0.5);

    const extinguisher = (x, z) => {
      const redMaterial = new THREE.MeshStandardMaterial({ color: 0xa52f2a, roughness: 0.55, metalness: 0.35 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.48, 10), redMaterial);
      body.position.set(x, 1.05, z);
      add(body, true);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8), this.materials.metalDark);
      top.position.set(x, 1.32, z);
      add(top);
      const hose = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 5, 10), this.materials.rubber);
      hose.rotation.x = Math.PI / 2;
      hose.position.set(x, 1.2, z + 0.06);
      add(hose);
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), this.materials.metalDark);
      bracket.position.set(x, 1.3, z);
      add(bracket);
    };
    extinguisher(-14.8, 2.6);
    extinguisher(15.3, 4.0);

    const panel = (x, y, z, rotationY) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), this.materials.metalDark);
      box.position.set(x, y, z);
      box.rotation.y = rotationY;
      add(box);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.02), this.materials.hazard);
      stripe.position.set(x + Math.sin(rotationY) * 0.06, y + 0.22, z + Math.cos(rotationY) * 0.06);
      stripe.rotation.y = rotationY;
      add(stripe);
      const conduit = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.06), this.materials.metal);
      conduit.position.set(x, y - 0.75, z);
      add(conduit);
    };
    panel(-14.9, 2.2, -1.8, Math.PI / 2);
    panel(15.4, 2.2, 11.0, -Math.PI / 2);

    const valve = (x, y, z, rotationY) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 14), this.materials.containerRed);
      wheel.position.set(x, y, z);
      wheel.rotation.y = rotationY;
      add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 8), this.materials.metal);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(x, y, z);
      add(hub);
    };
    valve(-14.84, 1.35, 6.25, Math.PI / 2);
    valve(15.4, 1.2, 14.1, -Math.PI / 2);

    const burnTexture = this.makeBurnTexture();
    for (const [x, z, rotation, scale] of [[7, -21, 0.4, 1], [-11, -11, -1.2, 0.8]]) {
      const material = new THREE.MeshBasicMaterial({
        map: burnTexture, transparent: true, opacity: 0.85, depthWrite: false,
      });
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * scale, 2.0 * scale), material);
      decal.rotation.x = -Math.PI / 2;
      decal.rotation.z = rotation;
      decal.position.set(x, 0.021, z);
      decal.raycast = () => {};
      this.scene.add(decal);
    }

    const emberCount = 90;
    const emberPositions = new Float32Array(emberCount * 3);
    const emberSpeeds = new Float32Array(emberCount);
    const emberSeeds = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      emberPositions[i * 3] = (Math.random() - 0.5) * 14;
      emberPositions[i * 3 + 1] = 0.3 + Math.random() * 4.2;
      emberPositions[i * 3 + 2] = -25 + (Math.random() - 0.5) * 14;
      emberSpeeds[i] = 0.25 + Math.random() * 0.55;
      emberSeeds[i] = Math.random() * 10;
    }
    const emberGeometry = new THREE.BufferGeometry();
    emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    const embers = new THREE.Points(
      emberGeometry,
      new THREE.PointsMaterial({
        map: this.sparkTexture, color: 0xffb45c, size: 0.07, transparent: true,
        opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      }),
    );
    embers.frustumCulled = false;
    embers.raycast = () => {};
    this.scene.add(embers);
    this.environmentAnimations.push((time, dt) => {
      const array = emberGeometry.attributes.position.array;
      for (let i = 0; i < emberCount; i++) {
        const offset = i * 3;
        array[offset + 1] += emberSpeeds[i] * dt;
        array[offset] += Math.sin(time * 0.7 + emberSeeds[i]) * dt * 0.06;
        array[offset + 2] += Math.cos(time * 0.5 + emberSeeds[i]) * dt * 0.05;
        if (array[offset + 1] > 4.8) {
          array[offset] = (Math.random() - 0.5) * 14;
          array[offset + 1] = 0.2;
          array[offset + 2] = -25 + (Math.random() - 0.5) * 14;
        }
      }
      emberGeometry.attributes.position.needsUpdate = true;
    });

    // 雨滴落地溅起的水花圆环
    const splashCount = 14;
    const splashes = [];
    const splashGeometry = new THREE.RingGeometry(0.14, 0.22, 12);
    for (let i = 0; i < splashCount; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xd2e6df, transparent: true, opacity: 0, depthWrite: false,
      });
      const ring = new THREE.Mesh(splashGeometry, material);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set((Math.random() - 0.5) * 34, 0.028, (Math.random() - 0.5) * 62);
      ring.raycast = () => {};
      this.scene.add(ring);
      splashes.push({ ring, material, t: Math.random(), speed: 1.2 + Math.random() * 1.5 });
    }
    this.environmentAnimations.push((time, dt) => {
      for (const splash of splashes) {
        splash.t += dt * splash.speed;
        if (splash.t >= 1) {
          splash.t -= 1;
          splash.ring.position.set((Math.random() - 0.5) * 34, 0.028, (Math.random() - 0.5) * 62);
        }
        const grow = 0.5 + splash.t * 2.2;
        splash.ring.scale.set(grow, grow, grow);
        splash.material.opacity = Math.sin(splash.t * Math.PI) * 0.3;
      }
    });

    // 低垂的风暴云层，缓慢绕场漂移
    const cloudTexture = this.makeCloudTexture();
    const clouds = [];
    for (let i = 0; i < 7; i++) {
      const material = new THREE.SpriteMaterial({
        map: cloudTexture, color: 0x93a9a6, transparent: true,
        opacity: 0.24 + Math.random() * 0.14, depthWrite: false, fog: false,
      });
      const cloud = new THREE.Sprite(material);
      const angle = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 48 + Math.random() * 26;
      cloud.position.set(Math.cos(angle) * radius, 39 + Math.random() * 12, Math.sin(angle) * radius);
      cloud.scale.set(46 + Math.random() * 28, 17 + Math.random() * 9, 1);
      cloud.raycast = () => {};
      this.scene.add(cloud);
      clouds.push({ cloud, angle, radius, speed: 0.008 + Math.random() * 0.012 });
    }
    this.environmentAnimations.push((time) => {
      for (const entry of clouds) {
        const angle = entry.angle + time * entry.speed;
        entry.cloud.position.x = Math.cos(angle) * entry.radius;
        entry.cloud.position.z = Math.sin(angle) * entry.radius;
      }
    });

    // 远处外墙上的霓虹广告牌
    const billboardTexture = this.makeBillboardTexture();
    const billboard = new THREE.Group();
    billboard.position.set(-39, 18, -14);
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(0.6, 10.6, 20.6), this.materials.metalDark);
    billboard.add(boardFrame);
    const boardScreenMaterial = new THREE.MeshBasicMaterial({
      map: billboardTexture, transparent: true, opacity: 1, fog: false,
    });
    const boardScreen = new THREE.Mesh(new THREE.PlaneGeometry(19.6, 9.6), boardScreenMaterial);
    boardScreen.rotation.y = Math.PI / 2;
    boardScreen.position.x = 0.32;
    billboard.add(boardScreen);
    const boardGlowMaterial = new THREE.MeshBasicMaterial({
      color: 0x5ee6d8, transparent: true, opacity: 0.16, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    const boardGlow = new THREE.Mesh(new THREE.PlaneGeometry(21.4, 11.4), boardGlowMaterial);
    boardGlow.rotation.y = Math.PI / 2;
    boardGlow.position.x = 0.3;
    billboard.add(boardGlow);
    for (const z of [-7.2, 7.2]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 13, 8), this.materials.metalDark);
      column.position.set(-0.2, -11.5, z);
      billboard.add(column);
    }
    billboard.traverse((child) => { child.raycast = () => {}; });
    this.scene.add(billboard);
    this.environmentAnimations.push((time) => {
      const flicker = Math.sin(time * 7.1) * 0.5 + 0.5;
      const dropout = Math.sin(time * 0.63 + 1.7) > 0.986 ? 0.45 : 1;
      boardScreenMaterial.opacity = (0.83 + flicker * 0.17) * dropout;
      boardGlowMaterial.opacity = (0.12 + flicker * 0.08) * dropout;
    });

    const lightningSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.makeLightningTexture(), color: 0xe8f2ff, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    lightningSprite.scale.set(22, 80, 1);
    lightningSprite.visible = false;
    lightningSprite.raycast = () => {};
    this.scene.add(lightningSprite);
    this.lightningSprite = lightningSprite;
  }

  buildWetReflections() {
    // 湿地面上被拉长的灯光倒影
    const reflections = [];
    const addPool = (x, z, width, length, color, opacity, phase = 0) => {
      const material = new THREE.MeshBasicMaterial({
        map: this.sparkTexture, color, transparent: true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.024, z);
      pool.renderOrder = 1;
      pool.raycast = () => {};
      this.scene.add(pool);
      reflections.push({ material, opacity, phase });
    };
    // A 点龙门架灯具
    for (const x of [-9, 0, 9]) addPool(x, -22.2, 1.7, 7.2, 0xffb45c, 0.1, x * 0.3);
    // 中央吊灯
    addPool(0, -1.4, 1.9, 7.5, 0xffb45c, 0.09, 1.4);
    // 作业灯与泛光灯塔
    addPool(6, 19.9, 1.3, 4.6, 0xffc070, 0.075, 2.2);
    for (const x of [-13, 13]) addPool(x, -22.4, 1.1, 4.2, 0xffd0a0, 0.06, x * 0.2);
    // 集装箱底部暖光
    for (const [x, z, depth] of [[-18, 25.5, 6.4], [18, 25.5, 6.0], [-18.5, -13, 5.6], [19.5, -13, 5.6], [-8, -17.5, 2.2]]) {
      addPool(x, z + depth / 2 + 0.9, Math.min(3, depth * 0.5), 2.6, 0xffa54a, 0.055, z * 0.2);
    }
    // 建筑角部霓虹的青色反光
    for (const [x, z] of [[-15.1, 19.2], [15.5, 4.4], [-18.4, -17.4], [19.1, -17.9]]) {
      addPool(x, z + 0.8, 0.9, 3.4, 0x5ee6d8, 0.055, x);
    }
    this.environmentAnimations.push((time) => {
      for (const reflection of reflections) {
        reflection.material.opacity = reflection.opacity * (0.86 + Math.sin(time * 1.7 + reflection.phase) * 0.14);
      }
    });
  }

  buildIncidentDetails() {
    const addDeco = (mesh, shadow = false) => {
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      return mesh;
    };

    /* ---------- 燃烧桶 ---------- */
    const fireX = -14.3;
    const fireZ = 30.4;
    const fireMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2b24, roughness: 0.78, metalness: 0.5 });
    const fireBody = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 16), fireMaterial);
    fireBody.position.set(fireX, 0.475, fireZ);
    fireBody.castShadow = true;
    fireBody.receiveShadow = true;
    this.scene.add(fireBody);
    this.solids.push(fireBody);
    this.colliders.push({ minX: fireX - 0.34, maxX: fireX + 0.34, minZ: fireZ - 0.34, maxZ: fireZ + 0.34 });
    for (const y of [-0.24, 0.22]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.334, 0.334, 0.05, 16), this.materials.metalDark);
      ring.position.y = y;
      ring.raycast = () => {};
      fireBody.add(ring);
    }
    const ash = new THREE.Mesh(new THREE.CircleGeometry(0.27, 16), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.55 }));
    ash.rotation.x = -Math.PI / 2;
    ash.position.y = 0.49;
    ash.raycast = () => {};
    fireBody.add(ash);
    const flameTexture = this.makeFlameTexture();
    const flames = [];
    for (let i = 0; i < 3; i++) {
      const material = new THREE.SpriteMaterial({
        map: flameTexture, color: i === 0 ? 0xfff0c0 : 0xffa04c, transparent: true,
        opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const flame = new THREE.Sprite(material);
      flame.position.set(fireX, 1.12 + i * 0.17, fireZ);
      flame.scale.set(0.62 - i * 0.09, 0.95 + i * 0.14, 1);
      flame.raycast = () => {};
      this.scene.add(flame);
      flames.push(flame);
    }
    const smokePuffs = [];
    for (let i = 0; i < 4; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.sparkTexture, color: 0x323a37, transparent: true, opacity: 0, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(fireX, 1.4, fireZ);
      sprite.scale.setScalar(0.6);
      sprite.raycast = () => {};
      this.scene.add(sprite);
      smokePuffs.push({ sprite, phase: i / 4 });
    }
    const emberCount = 18;
    const emberPositions = new Float32Array(emberCount * 3);
    const emberSpeeds = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
      emberPositions[i * 3] = fireX + (Math.random() - 0.5) * 0.35;
      emberPositions[i * 3 + 1] = 1 + Math.random() * 1.4;
      emberPositions[i * 3 + 2] = fireZ + (Math.random() - 0.5) * 0.35;
      emberSpeeds[i] = 0.5 + Math.random() * 0.8;
    }
    const emberGeometry = new THREE.BufferGeometry();
    emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
    const fireEmbers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({
      map: this.sparkTexture, color: 0xffb45c, size: 0.055, transparent: true,
      opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    fireEmbers.frustumCulled = false;
    fireEmbers.raycast = () => {};
    this.scene.add(fireEmbers);
    const fireLight = new THREE.PointLight(0xff8a3a, 15, 12, 2);
    fireLight.position.set(fireX, 1.55, fireZ);
    this.scene.add(fireLight);
    const fireGlowMaterial = new THREE.MeshBasicMaterial({
      map: this.sparkTexture, color: 0xff8a3a, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const fireGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), fireGlowMaterial);
    fireGlow.rotation.x = -Math.PI / 2;
    fireGlow.position.set(fireX, 0.026, fireZ);
    fireGlow.renderOrder = 1;
    fireGlow.raycast = () => {};
    this.scene.add(fireGlow);
    this.environmentAnimations.push((time, dt) => {
      const flicker = 0.8 + Math.sin(time * 11.7) * 0.1 + Math.sin(time * 19.3 + 2.1) * 0.07;
      fireLight.intensity = 15 * flicker;
      fireGlowMaterial.opacity = 0.1 + 0.06 * flicker;
      for (let i = 0; i < flames.length; i++) {
        const flame = flames[i];
        const wobble = Math.sin(time * 8.4 + i * 1.9) * 0.12;
        flame.scale.x = (0.62 - i * 0.09) * (1 + wobble);
        flame.scale.y = (0.95 + i * 0.14) * (1 - wobble * 0.6);
        flame.position.x = fireX + Math.sin(time * 3.1 + i) * 0.045;
        flame.material.opacity = 0.7 + Math.sin(time * 13 + i * 2.3) * 0.18;
      }
      for (const { sprite, phase } of smokePuffs) {
        const t = (time * 0.24 + phase) % 1;
        sprite.position.set(
          fireX + t * 0.5 + Math.sin(time * 0.8 + phase * 6) * 0.12,
          1.25 + t * 3.4,
          fireZ + t * 0.22,
        );
        sprite.scale.setScalar(0.55 + t * 1.7);
        sprite.material.opacity = Math.sin(t * Math.PI) * 0.2;
      }
      const array = emberGeometry.attributes.position.array;
      for (let i = 0; i < emberCount; i++) {
        const offset = i * 3;
        array[offset + 1] += emberSpeeds[i] * dt;
        array[offset] += Math.sin(time * 2.5 + i) * dt * 0.12;
        array[offset + 2] += Math.cos(time * 2.2 + i) * dt * 0.1;
        if (array[offset + 1] > 3.0) {
          array[offset] = fireX + (Math.random() - 0.5) * 0.35;
          array[offset + 1] = 1.0;
          array[offset + 2] = fireZ + (Math.random() - 0.5) * 0.35;
        }
      }
      emberGeometry.attributes.position.needsUpdate = true;
    });

    /* ---------- 检查站旋转警示灯 ---------- */
    const beacon = (x, z, baseY, phase) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.85, 8), this.materials.metalDark);
      pole.position.set(x, baseY + 0.425, z);
      addDeco(pole, true);
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3), this.materials.metalDark);
      housing.position.set(x, baseY + 0.88, z);
      addDeco(housing);
      const domeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffb15a, emissive: 0xff8a2a, emissiveIntensity: 2, roughness: 0.35, metalness: 0.1,
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMaterial);
      dome.position.set(x, baseY + 0.92, z);
      addDeco(dome);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.sparkTexture, color: 0xffb266, transparent: true, opacity: 0.25,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.position.set(x, baseY + 0.95, z);
      glow.scale.setScalar(1.1);
      glow.raycast = () => {};
      this.scene.add(glow);
      const beamGroup = new THREE.Group();
      beamGroup.position.set(x, baseY + 0.95, z);
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0xffab50, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.FrontSide,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.05, 4.4, 16, 1, true), beamMaterial);
      beam.rotation.x = -Math.PI / 2;
      beam.position.z = 2.2;
      beam.raycast = () => {};
      beamGroup.add(beam);
      const warningLight = new THREE.SpotLight(0xffa54a, 38, 15, Math.PI / 7, 0.55, 1.4);
      warningLight.position.set(0, 0, 0);
      const warningTarget = new THREE.Object3D();
      warningTarget.position.set(0, -1.2, 6);
      beamGroup.add(warningLight);
      beamGroup.add(warningTarget);
      warningLight.target = warningTarget;
      this.scene.add(beamGroup);
      this.environmentAnimations.push((time) => {
        beamGroup.rotation.y = time * 1.6 + phase;
        const pulse = Math.max(0, Math.sin(time * 4 + phase));
        domeMaterial.emissiveIntensity = 0.7 + pulse * 2.4;
        glow.material.opacity = 0.12 + pulse * 0.32;
        beamMaterial.opacity = 0.015 + pulse * 0.055;
        warningLight.intensity = 14 + pulse * 30;
      });
    };
    beacon(-8.2, 19, 3.2, 0.2);
    beacon(14.5, 21, 2.8, 2.4);

    /* ---------- 地面痕迹与散落物 ---------- */
    const oilMaterial = new THREE.MeshBasicMaterial({
      map: this.makeOilStainTexture(), transparent: true, opacity: 0.72,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    for (const [x, z, scale, rotation] of [
      [-7.5, 25, 2.2, 0.4], [9.5, 14.5, 1.7, -1.1], [-3.5, -19.5, 2.0, 2.2],
      [16.4, 3.5, 1.5, 0.8], [-15.5, -8.5, 1.8, -0.5],
    ]) {
      const stain = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale * 0.7), oilMaterial);
      stain.rotation.x = -Math.PI / 2;
      stain.rotation.z = rotation;
      stain.position.set(x, 0.023, z);
      stain.raycast = () => {};
      this.scene.add(stain);
    }
    const skidMaterial = new THREE.MeshBasicMaterial({
      map: this.makeSkidTexture(), transparent: true, opacity: 0.7,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    });
    for (const [x, z, rotation] of [[-4.5, 23.5, 0.5], [8.0, 9.0, -0.65]]) {
      const skid = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.8), skidMaterial);
      skid.rotation.x = -Math.PI / 2;
      skid.rotation.z = rotation;
      skid.position.set(x, 0.024, z);
      skid.raycast = () => {};
      this.scene.add(skid);
    }

    const dummy = new THREE.Object3D();
    const casingGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.052, 6);
    casingGeometry.rotateX(Math.PI / 2);
    const casingMaterial = new THREE.MeshStandardMaterial({
      color: 0x8f7438, roughness: 0.38, metalness: 0.78,
      emissive: 0x2a1c08, emissiveIntensity: 0.06,
    });
    const casings = new THREE.InstancedMesh(casingGeometry, casingMaterial, 42);
    const casingClusters = [[-7.4, -27.8, 4.2], [9.4, -23.4, 3.4], [1.5, 23.8, 3.0]];
    for (let i = 0; i < 42; i++) {
      const [clusterX, clusterZ, spread] = casingClusters[i % casingClusters.length];
      dummy.position.set(
        clusterX + (Math.random() - 0.5) * spread,
        0.013 + Math.random() * 0.004,
        clusterZ + (Math.random() - 0.5) * spread,
      );
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.setScalar(0.85 + Math.random() * 0.4);
      dummy.updateMatrix();
      casings.setMatrixAt(i, dummy.matrix);
    }
    casings.instanceMatrix.needsUpdate = true;
    casings.receiveShadow = true;
    casings.raycast = () => {};
    this.scene.add(casings);

    const rubbleGeometry = new THREE.DodecahedronGeometry(0.13, 0);
    const rubbleMaterial = new THREE.MeshStandardMaterial({ color: 0x6f766e, roughness: 0.97, metalness: 0.02 });
    const rubble = new THREE.InstancedMesh(rubbleGeometry, rubbleMaterial, 22);
    for (let i = 0; i < 22; i++) {
      const side = i % 4;
      let x = 0;
      let z = 0;
      if (side === 0) { x = -30.5 + Math.random() * 1.8; z = -34 + Math.random() * 68; }
      else if (side === 1) { x = 30.5 - Math.random() * 1.8; z = -34 + Math.random() * 68; }
      else if (side === 2) { x = -30 + Math.random() * 60; z = -36.8 + Math.random() * 1.6; }
      else { x = -30 + Math.random() * 60; z = 36.8 - Math.random() * 1.6; }
      dummy.position.set(x, 0.035, z);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.scale.set(0.5 + Math.random() * 1.2, 0.35 + Math.random() * 0.6, 0.5 + Math.random() * 1.2);
      dummy.updateMatrix();
      rubble.setMatrixAt(i, dummy.matrix);
    }
    rubble.instanceMatrix.needsUpdate = true;
    rubble.receiveShadow = true;
    rubble.raycast = () => {};
    this.scene.add(rubble);

    for (const [x, z, scale] of [[-14.1, 12.5, 1], [14.1, 8.6, 0.85], [-16.2, -6.2, 0.7]]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.36 * scale, 0.045, 6, 22), this.materials.rubber);
      coil.rotation.x = -Math.PI / 2;
      coil.rotation.z = Math.random() * Math.PI;
      coil.position.set(x, 0.055, z);
      addDeco(coil);
    }

    /* ---------- 远处城市探照灯 ---------- */
    const shaftTexture = this.makeBeamTexture();
    const cityBeam = (x, y, z, tilt, phase, color) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.z = tilt;
      const material = new THREE.MeshBasicMaterial({
        map: shaftTexture, color, transparent: true, opacity: 0.1,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 0.3, 78, 18, 1, true), material);
      beam.position.y = 39;
      beam.raycast = () => {};
      group.add(beam);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.sparkTexture, color, transparent: true, opacity: 0.18,
        blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
      }));
      glow.scale.setScalar(4.5);
      glow.position.y = 0.5;
      glow.raycast = () => {};
      group.add(glow);
      this.scene.add(group);
      this.environmentAnimations.push((time) => {
        group.rotation.y = time * 0.06 + phase;
        material.opacity = 0.075 + Math.sin(time * 0.35 + phase) * 0.02;
      });
    };
    cityBeam(58, 12, 42, 0.22, 0.4, 0xcfe8e2);
    cityBeam(-62, 16, -10, -0.2, 2.2, 0xbfe0ff);
    cityBeam(47, 14, -58, 0.16, 4.1, 0xd6f0e4);
  }

  buildAtmosphereExtras() {
    const addDeco = (mesh, shadow = false) => {
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      return mesh;
    };

    /* ---------- 巡检无人机 ---------- */
    const drone = new THREE.Group();
    const droneBody = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.13, 0.46), this.materials.metalDark);
    drone.add(droneBody);
    const droneTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), this.materials.metal);
    droneTop.position.y = 0.09;
    drone.add(droneTop);
    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), this.materials.metalBright);
    gimbal.position.set(0, -0.09, 0.12);
    drone.add(gimbal);
    const rotorGroups = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.055), this.materials.metalDark);
        arm.position.set(sx * 0.27, 0.015, sz * 0.27);
        arm.rotation.y = Math.atan2(-sz, sx) * 0.72;
        drone.add(arm);
        const rotor = new THREE.Group();
        rotor.position.set(sx * 0.36, 0.06, sz * 0.36);
        for (let blade = 0; blade < 2; blade++) {
          const bladeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.008, 0.032), this.materials.metalBright);
          bladeMesh.rotation.y = blade * Math.PI / 2;
          rotor.add(bladeMesh);
        }
        drone.add(rotor);
        rotorGroups.push(rotor);
      }
    }
    const ledRedMaterial = new THREE.MeshBasicMaterial({ color: 0xff4a3c });
    const ledGreenMaterial = new THREE.MeshBasicMaterial({ color: 0x8dffa2 });
    const redLed = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), ledRedMaterial);
    redLed.position.set(0, 0.05, 0.27);
    drone.add(redLed);
    const greenLed = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), ledGreenMaterial);
    greenLed.position.set(0, 0.05, -0.27);
    drone.add(greenLed);
    const redGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xff5446, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    redGlow.scale.setScalar(0.6);
    redGlow.position.copy(redLed.position);
    drone.add(redGlow);
    const greenGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0x8dffa2, transparent: true, opacity: 0.25,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    greenGlow.scale.setScalar(0.5);
    greenGlow.position.copy(greenLed.position);
    drone.add(greenGlow);
    const scanMaterial = new THREE.MeshBasicMaterial({
      color: 0x9fe8dc, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const scanCone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 14, 1, true), scanMaterial);
    scanCone.position.y = -1.7;
    scanCone.raycast = () => {};
    drone.add(scanCone);
    drone.traverse((child) => { child.raycast = () => {}; });
    this.scene.add(drone);
    this.environmentAnimations.push((time, dt) => {
      const angle = time * 0.13;
      const x = Math.cos(angle) * 15;
      const z = -5 + Math.sin(angle) * 11;
      drone.position.set(x, 8.6 + Math.sin(time * 0.7) * 0.45, z);
      const tangentX = -Math.sin(angle) * 15;
      const tangentZ = Math.cos(angle) * 11;
      drone.rotation.y = Math.atan2(-tangentX, -tangentZ);
      drone.rotation.z = Math.sin(time * 0.9) * 0.05;
      drone.rotation.x = Math.cos(time * 0.8) * 0.04;
      for (const rotor of rotorGroups) rotor.rotation.y += dt * 38;
      const redOn = Math.sin(time * 5.4) > 0;
      ledRedMaterial.color.setRGB(redOn ? 1 : 0.22, redOn ? 0.22 : 0.05, redOn ? 0.16 : 0.04);
      redGlow.material.opacity = redOn ? 0.45 : 0.06;
      const greenOn = Math.sin(time * 5.4 + Math.PI) > 0;
      ledGreenMaterial.color.setRGB(greenOn ? 0.42 : 0.08, greenOn ? 1 : 0.2, greenOn ? 0.5 : 0.1);
      greenGlow.material.opacity = greenOn ? 0.32 : 0.05;
      scanMaterial.opacity = 0.025 + Math.sin(time * 1.3) * 0.012;
    });

    /* ---------- 配电箱电弧 ---------- */
    const sparkCount = 18;
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkVelocities = new Float32Array(sparkCount * 3);
    const sparkLives = new Float32Array(sparkCount);
    for (let i = 0; i < sparkCount; i++) sparkPositions[i * 3 + 1] = -50;
    const sparkGeometry = new THREE.BufferGeometry();
    sparkGeometry.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
    const sparkMaterial = new THREE.PointsMaterial({
      map: this.sparkTexture, color: 0xcfe8ff, size: 0.07, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const panelSparks = new THREE.Points(sparkGeometry, sparkMaterial);
    panelSparks.frustumCulled = false;
    panelSparks.raycast = () => {};
    this.scene.add(panelSparks);
    const sparkEmitter = new THREE.Vector3(15.16, 2.45, 11.0);
    const sparkFlash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xd8f0ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    sparkFlash.position.copy(sparkEmitter);
    sparkFlash.scale.setScalar(1.6);
    sparkFlash.raycast = () => {};
    this.scene.add(sparkFlash);
    let sparkBurst = 0;
    let sparkNext = 1.5 + Math.random() * 2;
    this.environmentAnimations.push((time, dt) => {
      if (time > sparkNext) {
        sparkNext = time + 2.4 + Math.random() * 4;
        sparkBurst = 0.65;
        for (let i = 0; i < sparkCount; i++) {
          const offset = i * 3;
          sparkPositions[offset] = sparkEmitter.x - Math.random() * 0.12;
          sparkPositions[offset + 1] = sparkEmitter.y + (Math.random() - 0.5) * 0.2;
          sparkPositions[offset + 2] = sparkEmitter.z + (Math.random() - 0.5) * 0.2;
          sparkVelocities[offset] = -(0.8 + Math.random() * 2.2);
          sparkVelocities[offset + 1] = 0.6 + Math.random() * 1.8;
          sparkVelocities[offset + 2] = (Math.random() - 0.5) * 2;
          sparkLives[i] = 0.3 + Math.random() * 0.45;
        }
      }
      if (sparkBurst > 0) {
        sparkBurst -= dt;
        for (let i = 0; i < sparkCount; i++) {
          if (sparkLives[i] <= 0) continue;
          const offset = i * 3;
          sparkLives[i] -= dt;
          sparkVelocities[offset + 1] -= 9.8 * dt;
          sparkPositions[offset] += sparkVelocities[offset] * dt;
          sparkPositions[offset + 1] += sparkVelocities[offset + 1] * dt;
          sparkPositions[offset + 2] += sparkVelocities[offset + 2] * dt;
          if (sparkLives[i] <= 0 || sparkPositions[offset + 1] < 0.03) {
            sparkPositions[offset + 1] = -50;
          }
        }
        sparkMaterial.opacity = clamp(sparkBurst / 0.65, 0, 1);
        sparkFlash.material.opacity = 0.2 + Math.random() * 0.4;
      } else {
        sparkMaterial.opacity = 0;
        sparkFlash.material.opacity = 0;
      }
      sparkGeometry.attributes.position.needsUpdate = true;
    });

    /* ---------- 检查站故障荧光灯 ---------- */
    const tubeMaterial = new THREE.MeshBasicMaterial({ color: 0xdffdf4 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.9, 8), tubeMaterial);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(-11, 2.96, 20.64);
    addDeco(tube);
    const tubeHousing = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.16), this.materials.metalDark);
    tubeHousing.position.set(-11, 3.05, 20.62);
    addDeco(tubeHousing);
    for (const x of [-11.42, -10.58]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.22), this.materials.metalDark);
      bracket.position.set(x, 3.1, 20.6);
      addDeco(bracket);
    }
    const tubeLight = new THREE.PointLight(0xc8f0e8, 5.5, 6.5, 2);
    tubeLight.position.set(-11, 2.8, 21.1);
    this.scene.add(tubeLight);
    this.environmentAnimations.push((time) => {
      const pattern = Math.sin(time * 13.7) * Math.sin(time * 4.3 + 1.2) + Math.sin(time * 1.7) * 0.4;
      const on = pattern > -0.72 ? 1 : 0.08;
      tubeMaterial.color.setRGB(0.82 * on, 0.98 * on, 0.94 * on);
      tubeLight.intensity = 5.2 * on;
    });

    /* ---------- 检修井蒸汽 ---------- */
    const manhole = (x, z, phase) => {
      const cover = new THREE.Mesh(new THREE.CircleGeometry(0.48, 24), this.materials.metalDark);
      cover.rotation.x = -Math.PI / 2;
      cover.position.set(x, 0.02, z);
      addDeco(cover);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 6, 24), this.materials.metal);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.03, z);
      addDeco(ring);
      const puffs = [];
      for (let i = 0; i < 3; i++) {
        const material = new THREE.SpriteMaterial({
          map: this.sparkTexture, color: 0xb8c8c4, transparent: true, opacity: 0, depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.set(x, 0.2, z);
        sprite.scale.setScalar(0.4);
        sprite.raycast = () => {};
        this.scene.add(sprite);
        puffs.push({ sprite, phase: i / 3 });
      }
      this.environmentAnimations.push((time) => {
        for (const { sprite, phase: puffPhase } of puffs) {
          const t = (time * 0.11 + puffPhase + phase) % 1;
          sprite.position.set(
            x + Math.sin(time * 0.5 + puffPhase * 5) * 0.25,
            0.15 + t * 2.3,
            z + Math.cos(time * 0.4 + puffPhase * 3) * 0.2,
          );
          sprite.scale.setScalar(0.35 + t * 1.5);
          sprite.material.opacity = Math.sin(t * Math.PI) * 0.13;
        }
      });
    };
    manhole(7.5, 6.5, 0.2);
    manhole(-14.5, -14.5, 1.3);

    /* ---------- 墙面监控摄像头 ---------- */
    const cameraUnit = (x, y, z, dir, phase) => {
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.2), this.materials.metalDark);
      mount.position.set(x, y, z);
      addDeco(mount);
      const head = new THREE.Group();
      head.position.set(x + dir * 0.18, y, z);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.17), this.materials.metalDark);
      body.position.x = dir * 0.08;
      head.add(body);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.09, 10),
        new THREE.MeshStandardMaterial({ color: 0x0a1211, emissive: 0x24544d, emissiveIntensity: 0.4, roughness: 0.2, metalness: 0.6 }),
      );
      lens.rotation.z = Math.PI / 2;
      lens.position.x = dir * 0.24;
      head.add(lens);
      const ledMaterial = new THREE.MeshBasicMaterial({ color: 0xff4a3c });
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), ledMaterial);
      led.position.set(dir * 0.2, 0.09, 0);
      head.add(led);
      head.traverse((child) => { child.raycast = () => {}; });
      this.scene.add(head);
      this.environmentAnimations.push((time) => {
        head.rotation.y = dir * (Math.sin(time * 0.45 + phase) * 0.4);
        const blink = Math.sin(time * 3.2 + phase) > 0.55;
        ledMaterial.color.setRGB(blink ? 1 : 0.2, blink ? 0.2 : 0.05, blink ? 0.14 : 0.04);
      });
    };
    cameraUnit(-14.94, 4.2, 16, 1, 0.2);
    cameraUnit(15.44, 3.9, 5.0, -1, 1.7);
    cameraUnit(-18.44, 4.0, -19.0, 1, 3.1);
    cameraUnit(18.94, 4.2, -20.0, -1, 4.6);

    /* ---------- 屋檐雨水流 ---------- */
    const runoff = (x, z, height, rotationY, phase) => {
      const texture = this.makeRunoffTexture();
      texture.repeat.set(1, 1.4);
      const material = new THREE.MeshBasicMaterial({
        map: texture, color: 0xbfd8d5, transparent: true, opacity: 0.55,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.24, height - 0.2), material);
      sheet.position.set(x, (height - 0.2) / 2 + 0.05, z);
      sheet.rotation.y = rotationY;
      sheet.raycast = () => {};
      this.scene.add(sheet);
      const splashes = [];
      for (let i = 0; i < 2; i++) {
        const splashMaterial = new THREE.MeshBasicMaterial({
          color: 0xcfe4e0, transparent: true, opacity: 0, depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.15, 12), splashMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(x, 0.03, z);
        ring.raycast = () => {};
        this.scene.add(ring);
        splashes.push({ ring, material: splashMaterial, offset: i * 0.5 });
      }
      this.environmentAnimations.push((time, dt) => {
        texture.offset.y -= dt * 1.8;
        for (const splash of splashes) {
          const t = (time * 0.8 + splash.offset + phase) % 1;
          const grow = 0.6 + t * 1.4;
          splash.ring.scale.set(grow, grow, grow);
          splash.material.opacity = Math.sin(t * Math.PI) * 0.3;
        }
      });
    };
    runoff(-14.94, -4.8, 6, Math.PI / 2, 0);
    runoff(15.44, 5.0, 5.2, -Math.PI / 2, 0.4);
    runoff(-18.44, -18.2, 5.5, Math.PI / 2, 0.7);

    /* ---------- 地面荧光棒 ---------- */
    for (const [x, z, color, rotation] of [
      [-6.6, 22.4, 0xc8ff52, 0.4],
      [10.6, -3.2, 0x5ee6d8, -0.9],
      [-12.8, -10.4, 0xffa54a, 1.6],
    ]) {
      const stick = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 0.18, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      stick.rotation.z = Math.PI / 2;
      stick.rotation.y = rotation;
      stick.position.set(x, 0.032, z);
      addDeco(stick);
      const glowMaterial = new THREE.MeshBasicMaterial({
        map: this.sparkTexture, color, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), glowMaterial);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, 0.027, z);
      glow.renderOrder = 1;
      glow.raycast = () => {};
      this.scene.add(glow);
      this.environmentAnimations.push((time) => {
        glowMaterial.opacity = 0.22 + Math.sin(time * 2.2 + x) * 0.07;
      });
    }
  }

  buildPickups() {
    const definitions = [
      { type: 'medkit', x: 0, z: 21.5 },
      { type: 'medkit', x: -9, z: -21 },
      { type: 'armor', x: 12.5, z: 14.5 },
      { type: 'armor', x: -12.5, z: 8 },
      { type: 'ammo', x: 0, z: 2 },
      { type: 'ammo', x: 9, z: -20 },
      { type: 'grenade', x: 6, z: 24 },
      { type: 'grenade', x: -5, z: -13 },
    ];
    const palettes = {
      medkit: { color: 0x7dff9a, glow: 0x5ee68c },
      armor: { color: 0x6ec8ff, glow: 0x4aa8e8 },
      ammo: { color: 0xffc24a, glow: 0xffa63a },
      grenade: { color: 0xff7a4a, glow: 0xff5a32 },
    };
    for (const definition of definitions) {
      const palette = palettes[definition.type];
      const group = new THREE.Group();
      group.position.set(definition.x, 0, definition.z);
      const visual = new THREE.Group();
      visual.position.y = 0.34;
      group.add(visual);
      if (definition.type === 'medkit') {
        const caseMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.22, 0.3),
          new THREE.MeshStandardMaterial({ color: 0xd8ddd5, roughness: 0.6 }),
        );
        visual.add(caseMesh);
        const crossMaterial = new THREE.MeshStandardMaterial({ color: 0xd94d44, emissive: 0x5a1512, emissiveIntensity: 0.35, roughness: 0.5 });
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.075), crossMaterial);
        crossH.position.y = 0.13;
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 0.22), crossMaterial);
        crossV.position.y = 0.13;
        visual.add(crossH, crossV);
      } else if (definition.type === 'armor') {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, 0.4, 0.09),
          new THREE.MeshStandardMaterial({ color: 0x3f6772, emissive: 0x1b4c57, emissiveIntensity: 0.35, roughness: 0.45, metalness: 0.5 }),
        );
        plate.rotation.y = Math.PI / 4;
        visual.add(plate);
        const trim = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.05, 0.11),
          new THREE.MeshStandardMaterial({ color: 0x74d6e8, emissive: 0x2f97aa, emissiveIntensity: 0.8, roughness: 0.4 }),
        );
        trim.rotation.y = Math.PI / 4;
        trim.position.y = 0.14;
        visual.add(trim);
      } else if (definition.type === 'ammo') {
        const crate = new THREE.Mesh(
          new THREE.BoxGeometry(0.44, 0.24, 0.3),
          new THREE.MeshStandardMaterial({ color: 0x4c5840, roughness: 0.7, metalness: 0.25 }),
        );
        visual.add(crate);
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, 0.06, 0.32),
          new THREE.MeshStandardMaterial({ color: 0x9a854e, roughness: 0.55, metalness: 0.45 }),
        );
        band.position.y = 0.08;
        visual.add(band);
      } else {
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0x2e3b2f, roughness: 0.48, metalness: 0.55 }),
        );
        visual.add(shell);
        const cap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.08, 10),
          new THREE.MeshStandardMaterial({ color: 0x8a9178, roughness: 0.6 }),
        );
        cap.position.y = 0.14;
        visual.add(cap);
      }
      visual.traverse((child) => { child.raycast = () => {}; });
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: palette.color, transparent: true, opacity: 0.3,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.032;
      ring.raycast = () => {};
      group.add(ring);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.sparkTexture, color: palette.glow, transparent: true, opacity: 0.26,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.setScalar(1.05);
      glow.position.y = 0.34;
      glow.raycast = () => {};
      group.add(glow);
      this.scene.add(group);
      this.pickups.push({
        ...definition, group, visual, ring, ringMaterial, glow,
        active: true, respawnAt: 0, phase: Math.random() * Math.PI * 2,
      });
    }
    this.updateEquipmentUI();
  }

  updateEquipmentUI() {
    const count = $('grenade-count');
    if (!count) return;
    count.textContent = this.grenades;
    count.classList.toggle('empty', this.grenades <= 0);
  }

  resetEquipment() {
    this.grenades = 2;
    Object.values(this.weaponConfigs).forEach((weapon) => {
      weapon.heat = 0;
      weapon.overheated = false;
      weapon.lastShotAt = -10;
    });
    this.updateEquipmentUI();
  }

  clearGrenades() {
    for (const projectile of this.grenadeProjectiles) {
      this.scene.remove(projectile.group);
      projectile.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this.grenadeProjectiles = [];
    for (const effect of this.grenadeEffects) {
      this.scene.remove(effect.flash, effect.ring);
      effect.flash.material.dispose();
      effect.ring.geometry.dispose();
      effect.ring.material.dispose();
      effect.smoke.forEach((puff) => {
        this.scene.remove(puff.sprite);
        puff.sprite.material.dispose();
      });
    }
    this.grenadeEffects = [];
    if (this.bombLight) {
      this.bombLight.intensity = 0;
      this.bombLight.color.setHex(0xffa04a);
      this.bombLight.distance = 18;
    }
    this.explosionLightLife = 0;
  }

  resetPickups() {
    for (const pickup of this.pickups) {
      pickup.active = true;
      pickup.group.visible = true;
      pickup.respawnAt = 0;
    }
  }

  showPickupToast(title, desc) {
    const toast = $('pickup-toast');
    if (!toast) return;
    $('pickup-title').textContent = title;
    $('pickup-desc').textContent = desc;
    toast.classList.remove('hidden', 'show');
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(this.pickupToastTimer);
    this.pickupToastTimer = setTimeout(() => toast.classList.add('hidden'), 1700);
  }

  updatePickups(dt) {
    for (const pickup of this.pickups) {
      if (!pickup.active) {
        if (this.time >= pickup.respawnAt) {
          pickup.active = true;
          pickup.group.visible = true;
        }
        continue;
      }
      pickup.visual.position.y = 0.34 + Math.sin(this.time * 2.1 + pickup.phase) * 0.06;
      pickup.visual.rotation.y += dt * 1.1;
      const pulse = 0.5 + Math.sin(this.time * 2.6 + pickup.phase) * 0.5;
      pickup.ring.scale.setScalar(1 + pulse * 0.14);
      pickup.ringMaterial.opacity = 0.16 + pulse * 0.18;
      pickup.glow.material.opacity = 0.16 + pulse * 0.16;
      const dx = this.player.position.x - pickup.x;
      const dz = this.player.position.z - pickup.z;
      if (dx * dx + dz * dz < 2.1 && !this.player.dead && this.state === 'playing') {
        if (this.applyPickup(pickup)) {
          pickup.active = false;
          pickup.group.visible = false;
          pickup.respawnAt = this.time + 26;
          this.audio.pickup();
        }
      }
    }
  }

  applyPickup(pickup) {
    const weapon = this.weaponConfigs[this.currentWeapon];
    switch (pickup.type) {
      case 'medkit':
        if (this.player.health >= 100) return false;
        this.player.health = Math.min(100, this.player.health + 30);
        this.updateVitalsUI();
        this.showPickupToast('医疗包', '+30 生命值');
        return true;
      case 'armor':
        if (this.player.armor >= 100) return false;
        this.player.armor = Math.min(100, this.player.armor + 30);
        this.updateVitalsUI();
        this.showPickupToast('护甲板', '+30 护甲');
        return true;
      case 'ammo':
        if (this.unlimitedAmmo || weapon.melee || weapon.reserve >= weapon.reserveMax) return false;
        weapon.reserve = Math.min(weapon.reserveMax, weapon.reserve + weapon.magSize);
        this.updateWeaponUI();
        this.showPickupToast('弹药箱', `+${weapon.magSize} 发备弹`);
        return true;
      case 'grenade':
        if (this.grenades >= 3) return false;
        this.grenades = Math.min(3, this.grenades + 1);
        this.updateEquipmentUI();
        this.showPickupToast('破片手雷', '+1 枚');
        return true;
      default:
        return false;
    }
  }

  throwGrenade() {
    if (this.state !== 'playing' || this.player.dead || this.reloading || this.plantingActive) return;
    if (this.grenades <= 0 || this.time < this.nextGrenade || this.grenadeThrowAt) return;
    if (this.scoped) this.setScoped(false);
    this.grenades--;
    this.nextGrenade = this.time + 0.85;
    this.grenadeThrow = 1;
    this.grenadeThrowAt = this.time + 0.18;
    this.inspecting = false;
    this.audio.noise(0.08, 0.025, 900);
    this.updateEquipmentUI();
  }

  releaseGrenade() {
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x2e3b2f, roughness: 0.48, metalness: 0.55 }),
    );
    group.add(shell);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.07, 8), this.materials.metalBright);
    cap.position.y = 0.1;
    group.add(cap);
    const led = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xff5a3c, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    led.scale.setScalar(0.16);
    led.position.y = 0.16;
    group.add(led);
    group.traverse((child) => { child.raycast = () => {}; });
    group.position.copy(this.camera.position).addScaledVector(direction, 0.5);
    group.position.y -= 0.1;
    this.scene.add(group);
    this.grenadeProjectiles.push({
      group, led,
      velocity: direction.clone().multiplyScalar(15).add(new THREE.Vector3(0, 3.1, 0)),
      fuse: 2.15,
    });
    this.audio.noise(0.12, 0.04, 800);
  }

  updateGrenades(dt) {
    for (let i = this.grenadeProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.grenadeProjectiles[i];
      projectile.fuse -= dt;
      projectile.led.material.opacity = Math.sin(this.time * 18) > 0 ? 0.9 : 0.15;
      projectile.velocity.y -= 18 * dt;
      const previous = this.grenadePrev.copy(projectile.group.position);
      const step = this.grenadeStep.copy(projectile.velocity).multiplyScalar(dt);
      const distance = step.length();
      let collided = false;
      if (distance > 0.0005) {
        this.raycaster.set(previous, this.grenadeDir.copy(step).normalize());
        this.raycaster.far = distance + 0.1;
        const hit = this.raycaster.intersectObjects(this.solids, false)[0];
        if (hit) {
          const normal = this.grenadeNormal;
          if (hit.face) normal.copy(hit.face.normal);
          else normal.set(0, 1, 0);
          projectile.group.position.copy(hit.point).addScaledVector(normal, 0.11);
          projectile.velocity.reflect(normal).multiplyScalar(0.45);
          if (normal.y > 0.4) projectile.velocity.y = Math.abs(projectile.velocity.y) * 0.15;
          if (projectile.velocity.length() > 1.4) this.audio.grenadeBounce();
          collided = true;
        }
      }
      if (!collided) projectile.group.position.add(step);
      if (projectile.group.position.y < 0.1) {
        projectile.group.position.y = 0.1;
        if (projectile.velocity.y < -1.2) this.audio.grenadeBounce();
        projectile.velocity.y = Math.abs(projectile.velocity.y) * 0.35;
        projectile.velocity.x *= 0.7;
        projectile.velocity.z *= 0.7;
      }
      projectile.group.rotation.x += dt * 6;
      projectile.group.rotation.z += dt * 4;
      if (projectile.fuse <= 0) {
        this.explodeGrenade(projectile.group.position);
        this.scene.remove(projectile.group);
        projectile.group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.grenadeProjectiles.splice(i, 1);
      }
    }

    for (let i = this.grenadeEffects.length - 1; i >= 0; i--) {
      const effect = this.grenadeEffects[i];
      effect.life += dt;
      const t = effect.life;
      effect.flash.scale.setScalar(1 + t * 9);
      effect.flash.material.opacity = 0.9 * clamp(1 - t / 0.5, 0, 1);
      effect.ring.scale.setScalar(1 + t * 9);
      effect.ring.material.opacity = 0.5 * clamp(1 - t / 0.7, 0, 1);
      for (const puff of effect.smoke) {
        puff.sprite.position.addScaledVector(puff.dir, dt);
        puff.dir.multiplyScalar(1 - dt * 0.8);
        puff.sprite.position.y += dt * 0.5;
        puff.sprite.scale.setScalar(0.8 + t * 2.4);
        puff.sprite.material.opacity = 0.3 * clamp(1 - t / 1.5, 0, 1);
      }
      if (t > 1.7) {
        this.scene.remove(effect.flash, effect.ring);
        effect.flash.material.dispose();
        effect.ring.geometry.dispose();
        effect.ring.material.dispose();
        effect.smoke.forEach((puff) => {
          this.scene.remove(puff.sprite);
          puff.sprite.material.dispose();
        });
        this.grenadeEffects.splice(i, 1);
      }
    }
    if (this.explosionLightLife > 0) {
      this.explosionLightLife = Math.max(0, this.explosionLightLife - dt);
      this.bombLight.intensity = 130 * clamp(this.explosionLightLife / 0.5, 0, 1);
    }
  }

  explodeGrenade(position) {
    const origin = position.clone();
    origin.y = Math.max(origin.y, 0.3);
    const radius = 5.8;
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.group.position.x - origin.x;
      const dz = enemy.group.position.z - origin.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > radius) continue;
      const damage = 150 * Math.pow(1 - distance / radius, 1.2);
      this.damageEnemy(enemy, damage, false, true, '破片手雷');
    }
    this.audio.explosion();
    const blastX = this.player.position.x - origin.x;
    const blastZ = this.player.position.z - origin.z;
    const blastDistance = Math.sqrt(blastX * blastX + blastZ * blastZ);
    if (blastDistance < 14) {
      const blast = Math.pow(1 - blastDistance / 14, 1.5);
      this.cameraShake = Math.max(this.cameraShake, blast * 1.9);
      this.landingDip = Math.max(this.landingDip, blast * 0.55);
    }
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xffb35c, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.position.copy(origin);
    flash.position.y += 0.35;
    flash.scale.setScalar(1);
    flash.raycast = () => {};
    this.scene.add(flash);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb35c, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 32), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(origin);
    ring.position.y = 0.07;
    ring.raycast = () => {};
    this.scene.add(ring);
    if (this.bombLight) {
      this.bombLight.position.copy(origin);
      this.bombLight.position.y += 0.7;
      this.bombLight.color.setHex(0xffa04a);
      this.bombLight.distance = 18;
      this.bombLight.intensity = 130;
      this.explosionLightLife = 0.5;
    }
    const smoke = [];
    for (let i = 0; i < 6; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.sparkTexture, color: 0x4a5450, transparent: true, opacity: 0.3, depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(origin);
      sprite.position.y += 0.25;
      sprite.scale.setScalar(0.8);
      sprite.raycast = () => {};
      this.scene.add(sprite);
      smoke.push({
        sprite,
        dir: new THREE.Vector3((Math.random() - 0.5) * 1.8, 0.7 + Math.random() * 1.3, (Math.random() - 0.5) * 1.8),
      });
    }
    this.grenadeEffects.push({ flash, ring, smoke, life: 0 });
  }

  buildDynamicSetPieces() {
    /* ---------- 龙门架行车与吊钩 ---------- */
    const trolley = new THREE.Group();
    const trolleyBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.3, 1.05), this.materials.metalDark);
    trolley.add(trolleyBody);
    const trolleyTrim = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 1.15), this.materials.metal);
    trolleyTrim.position.y = 0.17;
    trolley.add(trolleyTrim);
    const craneBeaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a3c });
    const craneBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), craneBeaconMaterial);
    craneBeacon.position.set(0.55, 0.28, 0);
    trolley.add(craneBeacon);
    const craneBeaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xff5446, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    craneBeaconGlow.scale.setScalar(0.55);
    craneBeaconGlow.position.copy(craneBeacon.position);
    trolley.add(craneBeaconGlow);
    trolley.position.set(0, 7.15, -25);
    trolley.traverse((child) => { child.raycast = () => {}; });
    this.scene.add(trolley);
    const craneCable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), this.materials.metalDark);
    craneCable.raycast = () => {};
    this.scene.add(craneCable);
    const hookGroup = new THREE.Group();
    const hookBlock = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.34), this.materials.metalDark);
    hookGroup.add(hookBlock);
    const hookRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12, Math.PI), this.materials.metalBright);
    hookRing.rotation.x = Math.PI / 2;
    hookRing.position.y = -0.24;
    hookGroup.add(hookRing);
    const hangingCrate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.62), this.materials.crate);
    hangingCrate.position.y = -0.86;
    hookGroup.add(hangingCrate);
    hookGroup.traverse((child) => { child.raycast = () => {}; });
    this.scene.add(hookGroup);
    this.environmentAnimations.push((time) => {
      const x = Math.sin(time * 0.17) * 9;
      trolley.position.x = x;
      const sway = Math.sin(time * 0.9) * 0.25;
      const hookY = 4.25 + Math.sin(time * 0.55 + 1) * 0.45;
      hookGroup.position.set(x + sway, hookY, -25);
      hookGroup.rotation.z = -sway * 0.3;
      const length = 7 - hookY;
      craneCable.position.set(x + sway * 0.5, 7 - length / 2, -25);
      craneCable.scale.y = length;
      const blink = Math.sin(time * 6.2) > 0.4;
      craneBeaconMaterial.color.setRGB(blink ? 1 : 0.2, blink ? 0.18 : 0.03, blink ? 0.1 : 0.02);
      craneBeaconGlow.material.opacity = blink ? 0.5 : 0.05;
    });

    /* ---------- 风摆帆布 ---------- */
    const tarps = [];
    const makeTarp = (x, y, z, width, height, rotationY) => {
      const geometry = new THREE.PlaneGeometry(width, height, 8, 6);
      geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
      const material = new THREE.MeshStandardMaterial({
        color: 0x3a4135, roughness: 1, metalness: 0.02, side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rotationY;
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.array.length; i += 3) {
        const px = positions.array[i];
        const py = positions.array[i + 1];
        const weight = (height / 2 - py) / height;
        positions.array[i + 2] += (
          Math.sin(px * 4.2 + py * 0.9) * 0.07 + Math.sin(px * 8.5) * 0.02
        ) * weight;
      }
      geometry.computeVertexNormals();
      for (let i = 0; i < 3; i++) {
        const grommet = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.011, 5, 8), this.materials.metalBright);
        grommet.position.set(-width / 2 + 0.1 + i * (width - 0.2) / 2, height / 2 - 0.06, 0.02);
        grommet.raycast = () => {};
        mesh.add(grommet);
      }
      this.scene.add(mesh);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width * 1.04, 6), this.materials.metalDark);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = rotationY;
      rail.position.set(x, y + height / 2, z);
      rail.raycast = () => {};
      this.scene.add(rail);
      tarps.push({ geometry, base: Float32Array.from(geometry.attributes.position.array), height });
    };
    makeTarp(-8.2, 1.95, 20.56, 2.2, 2.3, 0);
    makeTarp(-16.73, 1.7, 24.4, 3.0, 2.2, Math.PI / 2);
    this.environmentAnimations.push((time) => {
      for (const tarp of tarps) {
        const position = tarp.geometry.attributes.position;
        const array = position.array;
        for (let i = 0; i < array.length; i += 3) {
          const x = tarp.base[i];
          const y = tarp.base[i + 1];
          const weight = (tarp.height / 2 - y) / tarp.height;
          array[i + 2] = tarp.base[i + 2] + (
            Math.sin(time * 1.7 + x * 2.2 + y * 1.4) * 0.16
            + Math.sin(time * 2.9 + x * 4.5) * 0.05
          ) * weight;
        }
        position.needsUpdate = true;
        tarp.geometry.computeVertexNormals();
      }
    });

    /* ---------- 闪烁应急标牌 ---------- */
    const signTexture = this.makeSignTexture('EVAC ROUTE', 'SECTOR 07 // EMERGENCY EXIT', '#ff6652');
    const signMaterial = new THREE.MeshBasicMaterial({ map: signTexture, transparent: true, opacity: 0.9 });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), signMaterial);
    signMesh.position.set(15.38, 4.25, 16.8);
    signMesh.rotation.y = -Math.PI / 2;
    signMesh.raycast = () => {};
    this.scene.add(signMesh);
    const signBacking = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 3.55), this.materials.metalDark);
    signBacking.position.set(15.46, 4.25, 16.8);
    signBacking.raycast = () => {};
    this.scene.add(signBacking);
    const signLight = new THREE.PointLight(0xff6a50, 3, 5.5, 2);
    signLight.position.set(14.9, 4.2, 16.8);
    this.scene.add(signLight);
    this.environmentAnimations.push((time) => {
      const pattern = Math.sin(time * 9.3) * Math.sin(time * 2.7 + 0.8) + Math.sin(time * 0.9) * 0.6;
      const on = pattern > -0.55 ? 1 : 0.12;
      signMaterial.opacity = 0.35 + on * 0.6;
      signLight.intensity = 4 * on;
    });

    /* ---------- 高架列车 ---------- */
    const rail = new THREE.Mesh(new THREE.BoxGeometry(190, 0.5, 1.4), this.materials.metalDark);
    rail.position.set(0, 9.2, -48);
    rail.raycast = () => {};
    rail.matrixAutoUpdate = false;
    rail.updateMatrix();
    this.scene.add(rail);
    for (let x = -84; x <= 84; x += 24) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.5, 0.8), this.materials.concreteDark);
      pier.position.set(x, 4.75, -48);
      pier.raycast = () => {};
      pier.matrixAutoUpdate = false;
      pier.updateMatrix();
      this.scene.add(pier);
    }
    const train = new THREE.Group();
    const trainBody = new THREE.Mesh(
      new THREE.BoxGeometry(26, 2.4, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x2c3a3c, roughness: 0.62, metalness: 0.48 }),
    );
    train.add(trainBody);
    const trainRoof = new THREE.Mesh(
      new THREE.BoxGeometry(25.4, 0.18, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1b2526, roughness: 0.7, metalness: 0.4 }),
    );
    trainRoof.position.y = 1.28;
    train.add(trainRoof);
    const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xffdca4 });
    for (let i = 0; i < 10; i++) {
      const windowMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.55, 0.06), windowMaterial);
      windowMesh.position.set(-11.7 + i * 2.6, 0.3, 1.33);
      train.add(windowMesh);
    }
    const headlightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2d0 });
    const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), headlightMaterial);
    headlight.position.set(13.05, -0.35, 1.1);
    train.add(headlight);
    const headlightGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xfff0c8, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    headlightGlow.scale.setScalar(2.4);
    headlightGlow.position.copy(headlight.position);
    train.add(headlightGlow);
    const tailLightMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
    const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), tailLightMaterial);
    tailLight.position.set(-13.05, -0.35, 1.1);
    train.add(tailLight);
    train.position.set(-60, 10.8, -48);
    train.traverse((child) => { child.raycast = () => {}; });
    this.scene.add(train);
    this.environmentAnimations.push((time) => {
      train.position.x = -95 + ((time * 7 + 40) % 190);
      train.position.y = 10.8 + Math.sin(time * 2) * 0.015;
      headlightGlow.material.opacity = 0.45 + Math.sin(time * 8) * 0.1;
      tailLightMaterial.color.setRGB(0.9 + Math.sin(time * 4) * 0.1, 0.12, 0.1);
    });

    /* ---------- 灯下飞虫 ---------- */
    const mothCenters = [
      [-9, 6.05, -25], [0, 6.05, -25], [9, 6.05, -25],
      [-11, 2.95, 19.8], [-14.3, 1.4, 30.4],
    ];
    const mothsPerLight = 7;
    const mothCount = mothCenters.length * mothsPerLight;
    const mothPositions = new Float32Array(mothCount * 3);
    const mothData = [];
    let mothIndex = 0;
    for (const [cx, cy, cz] of mothCenters) {
      for (let i = 0; i < mothsPerLight; i++) {
        mothData.push({
          cx, cy, cz,
          phase: Math.random() * Math.PI * 2,
          speed: 0.7 + Math.random() * 1.6,
          radius: 0.25 + Math.random() * 0.55,
          wobble: Math.random() * Math.PI * 2,
        });
        mothPositions[mothIndex * 3] = cx;
        mothPositions[mothIndex * 3 + 1] = cy;
        mothPositions[mothIndex * 3 + 2] = cz;
        mothIndex++;
      }
    }
    const mothGeometry = new THREE.BufferGeometry();
    mothGeometry.setAttribute('position', new THREE.BufferAttribute(mothPositions, 3));
    const moths = new THREE.Points(mothGeometry, new THREE.PointsMaterial({
      map: this.sparkTexture, color: 0xffe3b0, size: 0.045, transparent: true,
      opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    moths.frustumCulled = false;
    moths.raycast = () => {};
    this.scene.add(moths);
    this.environmentAnimations.push((time) => {
      const array = mothGeometry.attributes.position.array;
      for (let i = 0; i < mothCount; i++) {
        const moth = mothData[i];
        const angle = time * moth.speed + moth.phase;
        array[i * 3] = moth.cx + Math.cos(angle) * moth.radius + Math.sin(time * 1.7 + moth.wobble) * 0.12;
        array[i * 3 + 1] = moth.cy + Math.sin(time * 0.9 + moth.wobble) * 0.3;
        array[i * 3 + 2] = moth.cz + Math.sin(angle) * moth.radius + Math.cos(time * 1.3 + moth.wobble) * 0.12;
      }
      mothGeometry.attributes.position.needsUpdate = true;
    });
  }

  buildNeonAccents() {
    const tealMaterial = new THREE.MeshBasicMaterial({ color: 0x5ee6d8 });
    const amberMaterial = new THREE.MeshBasicMaterial({ color: 0xffa54a });
    const glowBox = (material, x, y, z, width, height, depth) => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      strip.position.set(x, y, z);
      strip.raycast = () => {};
      this.scene.add(strip);
      return strip;
    };

    // 四座主建筑四角的青绿色霓虹边条
    for (const [cx, cz, width, height, depth] of [
      [-23, 7, 16, 6, 24],
      [23, 11, 15, 5.2, 19],
      [-25, -24, 13, 5.5, 13],
      [25, -26, 12, 6.5, 16],
    ]) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          glowBox(
            tealMaterial,
            cx + sx * (width / 2 + 0.16), height * 0.46, cz + sz * (depth / 2 + 0.16),
            0.07, height * 0.7, 0.07,
          );
        }
      }
    }

    // 集装箱底部暖色地灯带
    for (const [x, z, width, depth] of [
      [-18, 25.5, 2.4, 6.4],
      [18, 25.5, 2.4, 6.0],
      [-18.5, -13, 2.4, 5.6],
      [19.5, -13, 2.4, 5.6],
      [-8, -17.5, 5.5, 2.2],
    ]) {
      for (const sz of [-1, 1]) {
        glowBox(amberMaterial, x, 0.06, z + sz * (depth / 2 + 0.035), width * 0.86, 0.05, 0.05);
      }
    }

    // A 点龙门架下方灯带
    for (const sz of [-1, 1]) {
      glowBox(tealMaterial, 0, 6.24, -25 + sz * 0.96, 26, 0.05, 0.05);
    }

    this.environmentAnimations.push((time) => {
      const tealPulse = 0.78 + Math.sin(time * 1.6) * 0.18;
      tealMaterial.color.setRGB(0.22 * tealPulse, 0.9 * tealPulse, 0.84 * tealPulse);
      const amberPulse = 0.82 + Math.sin(time * 2.1 + 1.2) * 0.16;
      amberMaterial.color.setRGB(1.0 * amberPulse, 0.56 * amberPulse, 0.22 * amberPulse);
    });
  }

  buildSite() {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xc8ff52, transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false });
    this.siteRing = new THREE.Mesh(new THREE.RingGeometry(4.25, 4.36, 64), ringMaterial);
    this.siteRing.rotation.x = -Math.PI / 2;
    this.siteRing.position.copy(this.site).add(new THREE.Vector3(0, 0.025, 0));
    this.scene.add(this.siteRing);

    const pad = new THREE.Mesh(new THREE.RingGeometry(4.5, 5.7, 64), this.materials.metal);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(this.site.x, 0.014, this.site.z);
    pad.receiveShadow = true;
    pad.raycast = () => {};
    this.scene.add(pad);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), this.materials.metalBright);
      bolt.position.set(this.site.x + Math.sin(angle) * 4.95, 0.035, this.site.z + Math.cos(angle) * 4.95);
      bolt.raycast = () => {};
      bolt.receiveShadow = true;
      this.scene.add(bolt);
    }

    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 16),
      new THREE.MeshBasicMaterial({
        map: this.makeSiteDecalTexture(), transparent: true, depthWrite: false, opacity: 0.92,
        polygonOffset: true, polygonOffsetFactor: -2,
      }),
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(this.site.x, 0.022, this.site.z);
    decal.renderOrder = 2;
    decal.raycast = () => {};
    this.scene.add(decal);

    for (let i = 0; i < 4; i++) {
      const marker = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.11), ringMaterial);
      marker.rotation.x = -Math.PI / 2;
      marker.rotation.z = i * Math.PI / 2;
      marker.position.set(this.site.x + Math.sin(i * Math.PI / 2) * 3.6, 0.028, this.site.z + Math.cos(i * Math.PI / 2) * 3.6);
      this.scene.add(marker);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(12,18,17,.82)'; ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#c8ff52'; ctx.lineWidth = 7; ctx.strokeRect(10, 10, 236, 236);
    ctx.fillStyle = '#c8ff52'; ctx.font = 'bold 180px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', 128, 140);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
    sign.position.set(0, 3.5, -38.42);
    this.scene.add(sign);

    // 控制台与泛光灯
    for (const side of [-1, 1]) {
      const base = this.addBox(side * 5.9, 0, -28.6, 1.25, 0.86, 0.56, this.materials.metalDark);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.4), new THREE.MeshBasicMaterial({ color: 0xa9f0dc }));
      screen.position.set(0, 0.13, 0.29);
      screen.raycast = () => {};
      base.add(screen);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.14, 0.59), this.materials.hazard);
      trim.position.y = -0.32;
      trim.raycast = () => {};
      base.add(trim);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), this.materials.metalBright);
      antenna.position.set(0.42, 0.66, 0.1);
      antenna.raycast = () => {};
      base.add(antenna);
    }
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i / 4) * Math.PI * 2;
      const px = this.site.x + Math.sin(angle) * 7.2;
      const pz = this.site.z + Math.cos(angle) * 7.2;
      this.addBox(px, 0, pz, 0.18, 3.8, 0.18, this.materials.metalDark);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.3, 0.42), this.materials.metal);
      head.position.set(px, 3.85, pz);
      head.rotation.y = angle + Math.PI;
      head.raycast = () => {};
      this.scene.add(head);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.3), this.materials.lamp);
      glow.position.set(px, 3.7, pz);
      glow.rotation.y = angle + Math.PI;
      glow.raycast = () => {};
      this.scene.add(glow);
    }

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 4.8, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xc8ff52, transparent: true, opacity: 0.045,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    beam.position.set(this.site.x, 2.4, this.site.z);
    beam.raycast = () => {};
    this.scene.add(beam);

    const siteLight = new THREE.PointLight(0xc8ff52, 18, 18, 2);
    siteLight.position.set(0, 4.5, -25);
    this.scene.add(siteLight);
    this.environmentAnimations.push((time) => {
      siteLight.intensity = 17 + Math.sin(time * 1.7) * 1.6;
    });
    for (const [y, radius, speed] of [[1.45, 1.2, 0.9], [2.9, 1.5, -0.6]]) {
      const orbit = new THREE.Group();
      orbit.position.set(this.site.x, y, this.site.z);
      const orbitMaterial = new THREE.MeshBasicMaterial({
        color: 0xc8ff52, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.018, 6, 48), orbitMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.raycast = () => {};
      orbit.add(ring);
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xc8ff52 });
      for (let i = 0; i < 4; i++) {
        const marker = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.08), markerMaterial);
        marker.position.set(Math.sin(i * Math.PI / 2) * radius, 0, Math.cos(i * Math.PI / 2) * radius);
        marker.raycast = () => {};
        orbit.add(marker);
      }
      this.scene.add(orbit);
      this.environmentAnimations.push((time) => {
        orbit.rotation.y = time * speed;
        orbit.position.y = y + Math.sin(time * 1.2 + y) * 0.1;
        orbitMaterial.opacity = 0.22 + Math.sin(time * 2.1 + y) * 0.08;
      });
    }
  }

  buildSkyline() {
    const windowTexture = this.makeTexture('windows');
    const windowMaterials = [1, 2, 3].map((variant) => {
      const texture = windowTexture.clone();
      texture.needsUpdate = true;
      texture.repeat.set(1 + variant * 0.7, 1.6 + variant * 1.2);
      return new THREE.MeshBasicMaterial({
        map: texture, color: variant === 2 ? 0xb9c9c2 : 0x91a39d, fog: true,
      });
    });
    const silhouette = this.materials.skyline;
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
      const radius = 50 + Math.random() * 28;
      const width = 5 + Math.random() * 10;
      const depth = 5 + Math.random() * 10;
      const height = 9 + Math.random() * 28;
      const material = i % 3 === 0 ? windowMaterials[i % 3] : windowMaterials[(i + 1) % 3];
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), Math.random() > 0.34 ? material : silhouette);
      building.position.set(Math.sin(angle) * radius, height / 2 - 1, Math.cos(angle) * radius);
      building.raycast = () => {};
      building.matrixAutoUpdate = false;
      building.updateMatrix();
      this.scene.add(building);
      if (i % 5 === 0) {
        const beaconMaterial = new THREE.MeshBasicMaterial({ color: 0xff5d52 });
        const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), beaconMaterial);
        beacon.position.set(building.position.x, height + 0.2, building.position.z);
        beacon.raycast = () => {};
        beacon.matrixAutoUpdate = false;
        beacon.updateMatrix();
        this.scene.add(beacon);
        const phase = i * 0.9;
        this.environmentAnimations.push((time) => {
          const pulse = Math.max(0, Math.sin(time * 1.7 + phase));
          beaconMaterial.color.setRGB(0.25 + pulse * 0.75, 0.05 + pulse * 0.1, 0.04 + pulse * 0.05);
        });
      }
    }
    const craneMat = new THREE.MeshStandardMaterial({ color: 0x374447, metalness: 0.7, roughness: 0.6 });
    this.addBox(-42, 0, -20, 1.3, 28, 1.3, craneMat, false);
    this.addBox(-31, 27, -20, 24, 0.8, 0.8, craneMat, false);
    this.addBox(-44, 26.6, -20, 8, 0.6, 0.6, craneMat, false);
    this.addBox(-21, 18, -20, 0.12, 18, 0.12, craneMat, false);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 17, 6), craneMat);
    tie.position.set(-36.5, 30.6, -20);
    tie.rotation.z = -0.62;
    tie.raycast = () => {};
    tie.matrixAutoUpdate = false;
    tie.updateMatrix();
    this.scene.add(tie);
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), this.materials.lamp);
    beacon.position.set(-42, 28.4, -20);
    beacon.raycast = () => {};
    beacon.matrixAutoUpdate = false;
    beacon.updateMatrix();
    this.scene.add(beacon);
  }

  buildDust() {
    const count = 520;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 68;
      positions[i * 3 + 1] = Math.random() * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdde8d6, size: 0.04, transparent: true, opacity: 0.34, depthWrite: false }));
    this.scene.add(this.dust);
  }

  buildWeapons() {
    const gunmetal = new THREE.MeshStandardMaterial({ color: 0x46565a, roughness: 0.34, metalness: 0.78 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x8b9a99, roughness: 0.26, metalness: 0.88 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x161d1f, roughness: 0.44, metalness: 0.6 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x232c2b, roughness: 0.74, metalness: 0.12 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x121716, roughness: 0.95 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xb9ef48, emissive: 0x526f16, emissiveIntensity: 0.5, roughness: 0.45 });
    const opticGlass = new THREE.MeshStandardMaterial({ color: 0x08120f, emissive: 0x35521f, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.45 });
    const reticleDot = new THREE.MeshStandardMaterial({ color: 0xd6ff6a, emissive: 0xc8ff52, emissiveIntensity: 1.4, roughness: 0.3 });
    const brass = new THREE.MeshStandardMaterial({ color: 0x9a7b3c, roughness: 0.42, metalness: 0.75 });
    const shellHull = new THREE.MeshStandardMaterial({ color: 0x8e3a2c, roughness: 0.62, metalness: 0.1 });

    const box = (parent, size, position, material = gunmetal) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    const rbox = (parent, size, position, material = polymer, radius = 0.008) => {
      const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 2, Math.min(radius, Math.min(...size) * 0.3)), material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    const pipe = (parent, radius, length, position, material = steel, segments = 12) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    const post = (parent, radius, height, position, material = darkSteel, segments = 12) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    const lens = (parent, radius, position, material = opticGlass) => {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), material);
      mesh.position.set(...position);
      parent.add(mesh);
      return mesh;
    };
    const rail = (parent, length, y, z) => {
      box(parent, [0.072, 0.016, length], [0, y, z], darkSteel);
      const teeth = Math.max(2, Math.round(length / 0.042));
      for (let i = 0; i < teeth; i++) {
        const offset = z + length / 2 - 0.024 - i * (length - 0.048) / Math.max(1, teeth - 1);
        box(parent, [0.086, 0.012, 0.018], [0, y + 0.013, offset], darkSteel);
      }
    };
    const hands = (parent, frontZ, rearZ, rearY = -0.24) => {
      this.placeFPSArm(parent, 'right', 0.82, [0.002, rearY + 0.028, rearZ + 0.028], [0, 1, -0.24], [-1, 0, 0]);
      this.placeFPSArm(parent, 'left', 0.78, [0, -0.048, frontZ + 0.05], [0, 0.22, -1], [0.18, 1, 0.18]);
    };

    // VX-27 突击步枪
    const rifle = new THREE.Group();
    rbox(rifle, [0.128, 0.125, 0.44], [0, 0, 0.06], gunmetal, 0.012);
    rbox(rifle, [0.112, 0.07, 0.4], [0, 0.085, 0.03], darkSteel, 0.01);
    box(rifle, [0.006, 0.05, 0.12], [0.066, 0.04, 0.02], darkSteel);
    box(rifle, [0.02, 0.018, 0.055], [0.072, 0.062, 0.04], steel);
    rail(rifle, 0.47, 0.13, 0.03);
    rbox(rifle, [0.104, 0.09, 0.34], [0, 0.05, -0.42], polymer, 0.01);
    for (let i = 0; i < 4; i++) box(rifle, [0.112, 0.014, 0.045], [0, 0.05, -0.3 - i * 0.075], darkSteel);
    box(rifle, [0.1, 0.018, 0.34], [0, 0.0, -0.42], darkSteel);
    pipe(rifle, 0.019, 0.4, [0, 0.05, -0.78], steel, 10);
    box(rifle, [0.056, 0.08, 0.08], [0, 0.06, -0.62], darkSteel);
    box(rifle, [0.014, 0.062, 0.018], [0, 0.12, -0.62], darkSteel);
    pipe(rifle, 0.012, 0.26, [0, 0.112, -0.6], darkSteel, 8);
    pipe(rifle, 0.027, 0.11, [0, 0.05, -1.03], darkSteel, 10);
    box(rifle, [0.06, 0.014, 0.08], [0, 0.082, -1.03], darkSteel);
    box(rifle, [0.03, 0.05, 0.03], [0, 0.16, 0.23], darkSteel);
    rbox(rifle, [0.05, 0.024, 0.13], [0, 0.15, -0.06], darkSteel, 0.006);
    pipe(rifle, 0.028, 0.11, [0, 0.185, -0.06], darkSteel, 14);
    lens(rifle, 0.021, [0, 0.185, -0.003]);
    lens(rifle, 0.005, [0, 0.185, -0.001], reticleDot);
    rbox(rifle, [0.08, 0.09, 0.16], [0, -0.11, -0.01], gunmetal, 0.006).rotation.x = -0.1;
    rbox(rifle, [0.077, 0.09, 0.15], [0, -0.19, -0.05], gunmetal, 0.006).rotation.x = -0.26;
    rbox(rifle, [0.073, 0.08, 0.13], [0, -0.26, -0.1], darkSteel, 0.006).rotation.x = -0.42;
    box(rifle, [0.086, 0.016, 0.15], [0, -0.065, 0.005], accent).rotation.x = -0.1;
    rbox(rifle, [0.072, 0.22, 0.1], [0, -0.14, 0.18], polymer, 0.01).rotation.x = -0.32;
    box(rifle, [0.078, 0.018, 0.1], [0, -0.245, 0.215], rubber).rotation.x = -0.32;
    box(rifle, [0.018, 0.018, 0.12], [0, -0.085, 0.1], darkSteel);
    box(rifle, [0.018, 0.055, 0.018], [0, -0.105, 0.045], darkSteel);
    box(rifle, [0.01, 0.045, 0.018], [0, -0.095, 0.085], steel);
    pipe(rifle, 0.026, 0.16, [0, 0.02, 0.34], darkSteel, 8);
    rbox(rifle, [0.082, 0.12, 0.2], [0, 0.0, 0.46], polymer, 0.01);
    rbox(rifle, [0.086, 0.045, 0.16], [0, 0.07, 0.44], polymer, 0.008);
    box(rifle, [0.09, 0.15, 0.026], [0, -0.005, 0.57], rubber);
    box(rifle, [0.02, 0.026, 0.07], [0.06, 0.09, 0.15], steel);
    rbox(rifle, [0.042, 0.042, 0.085], [0.052, -0.005, -0.36], polymer, 0.006);
    box(rifle, [0.02, 0.006, 0.05], [0.052, 0.021, -0.36], accent);
    box(rifle, [0.012, 0.04, 0.012], [-0.068, -0.03, 0.4], darkSteel);
    pipe(rifle, 0.012, 0.014, [-0.062, 0.035, 0.12], steel, 8);
    box(rifle, [0.014, 0.012, 0.06], [-0.066, 0.03, 0.16], darkSteel);
    box(rifle, [0.014, 0.03, 0.018], [0.072, -0.025, -0.03], steel);
    box(rifle, [0.01, 0.022, 0.028], [-0.07, 0.012, 0.0], steel);
    hands(rifle, -0.4, 0.16, -0.22);
    rifle.position.set(0.35, -0.31, -0.55);
    rifle.scale.setScalar(0.95);
    this.camera.add(rifle);

    // VX-9 冲锋枪
    const smg = new THREE.Group();
    rbox(smg, [0.11, 0.11, 0.32], [0, 0, 0.04], gunmetal, 0.01);
    rbox(smg, [0.096, 0.05, 0.3], [0, 0.075, 0.02], darkSteel, 0.008);
    rail(smg, 0.36, 0.112, 0.02);
    rbox(smg, [0.09, 0.08, 0.2], [0, 0.045, -0.24], polymer, 0.01);
    for (let i = 0; i < 3; i++) box(smg, [0.096, 0.012, 0.03], [0, 0.045, -0.18 - i * 0.06], darkSteel);
    pipe(smg, 0.017, 0.24, [0, 0.045, -0.44], steel, 10);
    pipe(smg, 0.026, 0.07, [0, 0.045, -0.58], darkSteel, 10);
    box(smg, [0.05, 0.05, 0.05], [0, 0.095, -0.55], darkSteel);
    box(smg, [0.03, 0.024, 0.02], [0, 0.126, -0.55], steel);
    rbox(smg, [0.04, 0.02, 0.1], [0, 0.132, -0.02], darkSteel, 0.005);
    pipe(smg, 0.022, 0.085, [0, 0.16, -0.02], darkSteel, 12);
    lens(smg, 0.016, [0, 0.16, 0.025]);
    lens(smg, 0.004, [0, 0.16, 0.027], reticleDot);
    rbox(smg, [0.045, 0.15, 0.055], [0, -0.1, -0.26], polymer, 0.008).rotation.x = 0.12;
    box(smg, [0.052, 0.02, 0.06], [0, -0.18, -0.25], rubber);
    rbox(smg, [0.07, 0.055, 0.09], [0, -0.055, 0.02], gunmetal, 0.006);
    rbox(smg, [0.06, 0.18, 0.08], [0, -0.145, 0.02], gunmetal, 0.006).rotation.x = -0.06;
    box(smg, [0.064, 0.02, 0.084], [0, -0.235, 0.005], accent);
    rbox(smg, [0.062, 0.18, 0.09], [0, -0.12, 0.14], polymer, 0.01).rotation.x = -0.3;
    box(smg, [0.066, 0.016, 0.09], [0, -0.21, 0.16], rubber).rotation.x = -0.3;
    box(smg, [0.016, 0.016, 0.1], [0, -0.07, 0.08], darkSteel);
    box(smg, [0.016, 0.05, 0.016], [0, -0.09, 0.035], darkSteel);
    pipe(smg, 0.016, 0.03, [-0.042, 0.02, 0.28], darkSteel, 8);
    pipe(smg, 0.016, 0.03, [0.042, 0.02, 0.28], darkSteel, 8);
    box(smg, [0.016, 0.016, 0.24], [-0.04, 0.02, 0.34], steel);
    box(smg, [0.016, 0.016, 0.24], [0.04, 0.02, 0.34], steel);
    box(smg, [0.09, 0.1, 0.02], [0, -0.02, 0.46], darkSteel);
    rbox(smg, [0.085, 0.05, 0.06], [0, 0.04, 0.4], polymer, 0.006);
    box(smg, [0.02, 0.02, 0.06], [0.06, 0.065, 0.12], steel);
    box(smg, [0.014, 0.012, 0.05], [-0.05, -0.025, -0.2], steel);
    hands(smg, -0.24, 0.12, -0.2);
    smg.position.set(0.35, -0.3, -0.5);
    smg.scale.setScalar(0.92);
    this.camera.add(smg);

    // B-12 泵动霰弹枪
    const shotgun = new THREE.Group();
    rbox(shotgun, [0.12, 0.12, 0.36], [0, 0, 0.0], gunmetal, 0.012);
    rbox(shotgun, [0.1, 0.055, 0.32], [0, 0.078, -0.01], darkSteel, 0.008);
    pipe(shotgun, 0.027, 0.82, [0, 0.055, -0.78], steel, 12);
    pipe(shotgun, 0.021, 0.66, [0, -0.015, -0.7], darkSteel, 10);
    box(shotgun, [0.055, 0.045, 0.04], [0, 0.095, -1.14], darkSteel);
    box(shotgun, [0.012, 0.02, 0.02], [0, 0.122, -1.15], accent);
    rbox(shotgun, [0.09, 0.08, 0.24], [0, -0.015, -0.55], polymer, 0.012);
    for (let i = 0; i < 5; i++) box(shotgun, [0.094, 0.012, 0.022], [0, -0.015, -0.45 - i * 0.05], darkSteel);
    rbox(shotgun, [0.02, 0.09, 0.2], [0.066, -0.01, 0.06], darkSteel, 0.006);
    for (let i = 0; i < 4; i++) {
      box(shotgun, [0.024, 0.05, 0.032], [0.074, -0.012, 0.14 - i * 0.048], brass);
      box(shotgun, [0.026, 0.028, 0.032], [0.074, 0.024, 0.14 - i * 0.048], shellHull);
    }
    rbox(shotgun, [0.07, 0.2, 0.1], [0, -0.14, 0.16], polymer, 0.01).rotation.x = -0.28;
    rbox(shotgun, [0.075, 0.06, 0.16], [0, -0.04, 0.26], polymer, 0.008);
    rbox(shotgun, [0.085, 0.13, 0.24], [0, 0.0, 0.42], polymer, 0.01);
    rbox(shotgun, [0.09, 0.06, 0.12], [0, 0.075, 0.4], polymer, 0.008);
    box(shotgun, [0.095, 0.16, 0.03], [0, -0.005, 0.56], rubber);
    box(shotgun, [0.018, 0.018, 0.1], [0, -0.075, 0.06], darkSteel);
    box(shotgun, [0.018, 0.05, 0.018], [0, -0.012, 0.045], darkSteel);
    box(shotgun, [0.012, 0.04, 0.016], [0, -0.06, 0.05], steel);
    box(shotgun, [0.03, 0.022, 0.1], [-0.055, -0.045, 0.01], darkSteel);
    box(shotgun, [0.05, 0.035, 0.05], [0, -0.06, 0.2], darkSteel);
    hands(shotgun, -0.55, 0.14, -0.22);
    shotgun.position.set(0.35, -0.31, -0.58);
    this.camera.add(shotgun);

    // M-90 栓动狙击枪
    const sniper = new THREE.Group();
    rbox(sniper, [0.115, 0.12, 0.44], [0, 0, 0.04], gunmetal, 0.012);
    rbox(sniper, [0.1, 0.05, 0.4], [0, 0.085, 0.02], darkSteel, 0.008);
    rail(sniper, 0.5, 0.12, 0.0);
    rbox(sniper, [0.1, 0.085, 0.36], [0, 0.04, -0.4], polymer, 0.01);
    for (let i = 0; i < 4; i++) box(sniper, [0.108, 0.012, 0.04], [0, 0.04, -0.28 - i * 0.07], darkSteel);
    pipe(sniper, 0.017, 0.62, [0, 0.05, -0.9], steel, 10);
    pipe(sniper, 0.026, 0.16, [0, 0.05, -1.28], darkSteel, 10);
    box(sniper, [0.058, 0.012, 0.08], [0, 0.076, -1.28], darkSteel);
    rbox(sniper, [0.05, 0.028, 0.16], [0, 0.155, 0.02], darkSteel, 0.005);
    box(sniper, [0.05, 0.035, 0.05], [0, 0.185, -0.1], darkSteel);
    box(sniper, [0.05, 0.035, 0.05], [0, 0.185, 0.14], darkSteel);
    pipe(sniper, 0.03, 0.34, [0, 0.225, 0.02], darkSteel, 16);
    pipe(sniper, 0.038, 0.07, [0, 0.225, -0.17], darkSteel, 16);
    pipe(sniper, 0.035, 0.06, [0, 0.225, 0.2], darkSteel, 16);
    lens(sniper, 0.028, [0, 0.225, 0.232]);
    post(sniper, 0.017, 0.045, [0, 0.27, 0.02], darkSteel, 10);
    post(sniper, 0.015, 0.042, [0.048, 0.225, 0.02], darkSteel, 10).rotation.z = Math.PI / 2;
    pipe(sniper, 0.014, 0.16, [0.05, 0.03, 0.1], steel, 8);
    box(sniper, [0.05, 0.02, 0.02], [0.09, 0.02, 0.12], steel);
    const boltKnob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), darkSteel);
    boltKnob.position.set(0.092, 0.02, 0.145);
    sniper.add(boltKnob);
    rbox(sniper, [0.07, 0.12, 0.14], [0, -0.11, 0.0], gunmetal, 0.006).rotation.x = -0.05;
    box(sniper, [0.075, 0.016, 0.145], [0, -0.18, -0.005], accent);
    rbox(sniper, [0.07, 0.21, 0.1], [0, -0.14, 0.18], polymer, 0.01).rotation.x = -0.32;
    box(sniper, [0.016, 0.016, 0.1], [0, -0.08, 0.09], darkSteel);
    box(sniper, [0.016, 0.05, 0.016], [0, -0.1, 0.04], darkSteel);
    rbox(sniper, [0.08, 0.11, 0.24], [0, 0.01, 0.42], polymer, 0.01);
    rbox(sniper, [0.086, 0.05, 0.16], [0, 0.08, 0.44], polymer, 0.008);
    box(sniper, [0.088, 0.035, 0.13], [0, 0.095, 0.46], rubber);
    box(sniper, [0.092, 0.14, 0.03], [0, -0.005, 0.56], rubber);
    box(sniper, [0.012, 0.014, 0.3], [-0.035, -0.035, -0.78], darkSteel);
    box(sniper, [0.012, 0.014, 0.3], [0.035, -0.035, -0.78], darkSteel);
    box(sniper, [0.022, 0.016, 0.05], [-0.035, -0.05, -0.93], rubber);
    box(sniper, [0.022, 0.016, 0.05], [0.035, -0.05, -0.93], rubber);
    hands(sniper, -0.42, 0.16, -0.22);
    sniper.position.set(0.35, -0.31, -0.62);
    this.camera.add(sniper);

    // AX-9 可开镜狙击枪（程序化占位，外部模型加载后替换）
    const scopedSniper = sniper.clone(true);
    scopedSniper.position.set(0.35, -0.31, -0.62);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.34, 12), gunmetal);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.185, -0.06);
    scopedSniper.add(scopeTube);
    const scopeLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.028, 16),
      new THREE.MeshStandardMaterial({ color: 0x3f6b66, emissive: 0x15332f, emissiveIntensity: 0.6, roughness: 0.18, metalness: 0.8 }),
    );
    scopeLens.position.set(0, 0.185, -0.231);
    scopedSniper.add(scopeLens);
    this.camera.add(scopedSniper);

    // SR-8 精确射手步枪
    const dmr = new THREE.Group();
    rbox(dmr, [0.12, 0.12, 0.46], [0, 0, 0.04], gunmetal, 0.012);
    rbox(dmr, [0.105, 0.055, 0.42], [0, 0.082, 0.02], darkSteel, 0.008);
    rail(dmr, 0.54, 0.118, 0.0);
    rbox(dmr, [0.1, 0.09, 0.42], [0, 0.045, -0.48], polymer, 0.01);
    for (let i = 0; i < 5; i++) box(dmr, [0.108, 0.012, 0.05], [0, 0.045, -0.33 - i * 0.075], darkSteel);
    pipe(dmr, 0.017, 0.54, [0, 0.05, -0.96], steel, 10);
    pipe(dmr, 0.024, 0.12, [0, 0.05, -1.28], darkSteel, 10);
    rbox(dmr, [0.045, 0.028, 0.14], [0, 0.15, 0.04], darkSteel, 0.005);
    pipe(dmr, 0.028, 0.3, [0, 0.19, 0.02], darkSteel, 14);
    pipe(dmr, 0.036, 0.07, [0, 0.19, -0.15], darkSteel, 14);
    pipe(dmr, 0.032, 0.06, [0, 0.19, 0.18], darkSteel, 14);
    lens(dmr, 0.026, [0, 0.19, 0.208]);
    post(dmr, 0.016, 0.04, [0, 0.228, 0.02], darkSteel, 10);
    post(dmr, 0.014, 0.038, [0.044, 0.19, 0.02], darkSteel, 10).rotation.z = Math.PI / 2;
    box(dmr, [0.045, 0.03, 0.05], [0, 0.165, -0.12], darkSteel);
    box(dmr, [0.03, 0.05, 0.05], [0, -0.015, -0.72], darkSteel);
    rbox(dmr, [0.075, 0.16, 0.11], [0, -0.14, 0.0], gunmetal, 0.006).rotation.x = -0.06;
    box(dmr, [0.08, 0.016, 0.115], [0, -0.22, -0.01], accent);
    rbox(dmr, [0.07, 0.2, 0.1], [0, -0.13, 0.17], polymer, 0.01).rotation.x = -0.32;
    box(dmr, [0.016, 0.016, 0.1], [0, -0.08, 0.08], darkSteel);
    box(dmr, [0.016, 0.05, 0.016], [0, -0.1, 0.035], darkSteel);
    rbox(dmr, [0.07, 0.1, 0.2], [0, 0.0, 0.4], polymer, 0.008);
    rbox(dmr, [0.08, 0.05, 0.18], [0, 0.075, 0.42], polymer, 0.008);
    box(dmr, [0.09, 0.14, 0.028], [0, 0.0, 0.52], rubber);
    box(dmr, [0.04, 0.04, 0.12], [0.06, 0.06, 0.1], darkSteel);
    box(dmr, [0.012, 0.02, 0.06], [-0.062, 0.0, 0.34], darkSteel);
    hands(dmr, -0.44, 0.15, -0.22);
    dmr.position.set(0.35, -0.31, -0.6);
    dmr.scale.setScalar(0.98);
    this.camera.add(dmr);

    // 武器外观个性化：仅给枪身染色，保留手套与袖口材质
    const tintWeaponGroup = (group, accentColor, tintColor, amount = 0.2) => {
      const accent = new THREE.Color(accentColor);
      const tint = new THREE.Color(tintColor);
      group.traverse((node) => {
        if (!node.isMesh) return;
        let parent = node;
        while (parent && parent !== group) {
          if (parent.name?.startsWith('fpsArm-')) return;
          parent = parent.parent;
        }
        const tintMaterial = (material) => {
          const next = material.clone();
          next.color.lerp(tint, amount);
          if (next.emissive) {
            next.emissive.lerp(accent, 0.28);
            next.emissiveIntensity = Math.max(next.emissiveIntensity || 0, 0.12);
          }
          return next;
        };
        node.material = Array.isArray(node.material)
          ? node.material.map(tintMaterial)
          : tintMaterial(node.material);
      });
    };
    const scoutAccent = new THREE.MeshStandardMaterial({ color: 0xffb45c, emissive: 0x7a3a08, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5 });
    const autoAccent = new THREE.MeshStandardMaterial({ color: 0xff7a5c, emissive: 0x5a1e10, emissiveIntensity: 0.6, roughness: 0.45, metalness: 0.5 });
    const scopeAccent = new THREE.MeshStandardMaterial({ color: 0x5ce1ff, emissive: 0x146a7a, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.5 });

    // S-45 游隼：轻量栓动狙击，长枪管 + 折叠脚架 + 沙色涂装
    const scout = scopedSniper.clone(true);
    tintWeaponGroup(scout, 0xffb45c, 0xc9b79a, 0.26);
    pipe(scout, 0.014, 0.5, [0, 0.05, -1.52], steel, 10);
    pipe(scout, 0.021, 0.1, [0, 0.05, -1.78], darkSteel, 10);
    box(scout, [0.062, 0.016, 0.1], [0, 0.076, -1.78], darkSteel);
    box(scout, [0.086, 0.024, 0.16], [0, 0.086, 0.4], scoutAccent);
    box(scout, [0.09, 0.02, 0.14], [0, -0.175, -0.01], scoutAccent);
    const scoutLegL = box(scout, [0.012, 0.22, 0.012], [-0.055, -0.11, -1.18], darkSteel);
    scoutLegL.rotation.z = 0.42;
    const scoutLegR = box(scout, [0.012, 0.22, 0.012], [0.055, -0.11, -1.18], darkSteel);
    scoutLegR.rotation.z = -0.42;
    const scoutBolt = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), scoutAccent);
    scoutBolt.position.set(-0.098, 0.02, 0.13);
    scout.add(scoutBolt);
    scout.position.set(0.35, -0.31, -0.65);
    scout.scale.setScalar(0.96);
    this.camera.add(scout);

    // V-8 猎隼：半自动狙击，扩容弹匣 + 大型物镜 + 橄榄绿涂装
    const autoSniper = dmr.clone(true);
    tintWeaponGroup(autoSniper, 0xff7a5c, 0x53604b, 0.24);
    rbox(autoSniper, [0.092, 0.2, 0.145], [0, -0.23, 0.02], darkSteel, 0.008).rotation.x = -0.16;
    box(autoSniper, [0.098, 0.022, 0.15], [0, -0.335, 0.035], autoAccent);
    const autoRing = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.009, 8, 24), darkSteel);
    autoRing.position.set(0, 0.19, 0.21);
    autoSniper.add(autoRing);
    const autoGlass = new THREE.Mesh(new THREE.CircleGeometry(0.032, 18), opticGlass);
    autoGlass.position.set(0, 0.19, 0.205);
    autoSniper.add(autoGlass);
    box(autoSniper, [0.02, 0.02, 0.18], [0.07, 0.03, -0.24], autoAccent);
    autoSniper.position.set(0.35, -0.31, -0.62);
    this.camera.add(autoSniper);

    // AR-5 鹰眼：全自动 + 2× 紧凑瞄具，青色涂装
    const scopedRifle = rifle.clone(true);
    tintWeaponGroup(scopedRifle, 0x5ce1ff, 0x334249, 0.22);
    pipe(scopedRifle, 0.026, 0.22, [0, 0.205, -0.03], darkSteel, 14);
    pipe(scopedRifle, 0.034, 0.06, [0, 0.205, -0.15], darkSteel, 14);
    pipe(scopedRifle, 0.03, 0.05, [0, 0.205, 0.08], darkSteel, 14);
    lens(scopedRifle, 0.024, [0, 0.205, 0.11]);
    lens(scopedRifle, 0.006, [0, 0.205, 0.112], reticleDot);
    post(scopedRifle, 0.014, 0.04, [0, 0.252, -0.03], darkSteel, 10);
    post(scopedRifle, 0.013, 0.036, [0.05, 0.205, -0.03], darkSteel, 10).rotation.z = Math.PI / 2;
    box(scopedRifle, [0.02, 0.012, 0.14], [0.07, 0.03, -0.28], scopeAccent);
    rbox(scopedRifle, [0.045, 0.045, 0.1], [0, 0.055, -0.82], darkSteel, 0.006);
    lens(scopedRifle, 0.014, [0, 0.055, -0.872], scopeAccent);
    scopedRifle.position.set(0.35, -0.31, -0.56);
    scopedRifle.scale.setScalar(0.95);
    this.camera.add(scopedRifle);

    // MG-7 轻机枪
    const lmg = new THREE.Group();
    rbox(lmg, [0.13, 0.14, 0.5], [0, 0, 0.04], gunmetal, 0.012);
    rbox(lmg, [0.116, 0.05, 0.46], [0, 0.098, 0.02], darkSteel, 0.008);
    rail(lmg, 0.3, 0.13, 0.1);
    rbox(lmg, [0.116, 0.105, 0.4], [0, 0.03, -0.5], darkSteel, 0.01);
    for (let i = 0; i < 5; i++) box(lmg, [0.122, 0.022, 0.05], [0, 0.03, -0.34 - i * 0.08], polymer);
    pipe(lmg, 0.02, 0.6, [0, 0.04, -0.94], steel, 10);
    pipe(lmg, 0.032, 0.15, [0, 0.04, -1.28], darkSteel, 10);
    box(lmg, [0.07, 0.016, 0.09], [0, 0.072, -1.28], darkSteel);
    box(lmg, [0.03, 0.05, 0.26], [-0.03, 0.15, 0.06], darkSteel);
    box(lmg, [0.03, 0.05, 0.26], [0.03, 0.15, 0.06], darkSteel);
    rbox(lmg, [0.09, 0.025, 0.28], [0, 0.182, 0.06], polymer, 0.006);
    pipe(lmg, 0.12, 0.09, [0, -0.155, -0.02], gunmetal, 20);
    pipe(lmg, 0.075, 0.1, [0, -0.155, -0.02], darkSteel, 16);
    rbox(lmg, [0.08, 0.035, 0.12], [0, -0.045, 0.02], darkSteel, 0.006);
    for (let i = 0; i < 4; i++) box(lmg, [0.02, 0.03, 0.02], [0.074, -0.1 + i * 0.025, 0.02], brass).rotation.z = 0.2;
    rbox(lmg, [0.075, 0.2, 0.11], [0, -0.16, 0.18], polymer, 0.01).rotation.x = -0.3;
    box(lmg, [0.08, 0.018, 0.11], [0, -0.26, 0.21], rubber).rotation.x = -0.3;
    rbox(lmg, [0.09, 0.12, 0.26], [0, 0.0, 0.42], polymer, 0.01);
    rbox(lmg, [0.09, 0.05, 0.18], [0, 0.08, 0.44], polymer, 0.008);
    box(lmg, [0.095, 0.16, 0.03], [0, -0.01, 0.56], rubber);
    box(lmg, [0.014, 0.016, 0.26], [-0.06, -0.06, -0.95], darkSteel);
    box(lmg, [0.014, 0.016, 0.26], [0.06, -0.06, -0.95], darkSteel);
    box(lmg, [0.024, 0.018, 0.05], [-0.06, -0.075, -1.07], rubber);
    box(lmg, [0.024, 0.018, 0.05], [0.06, -0.075, -1.07], rubber);
    hands(lmg, -0.42, 0.16, -0.26);
    lmg.position.set(0.35, -0.25, -0.6);
    this.camera.add(lmg);

    // P-12 战术手枪
    const pistol = new THREE.Group();
    rbox(pistol, [0.054, 0.062, 0.3], [0, 0.028, -0.16], gunmetal, 0.008);
    rbox(pistol, [0.044, 0.024, 0.28], [0, 0.078, -0.16], darkSteel, 0.006);
    for (let i = 0; i < 4; i++) box(pistol, [0.06, 0.04, 0.012], [0, 0.028, -0.01 - i * 0.02], darkSteel);
    pipe(pistol, 0.017, 0.06, [0, 0.033, -0.32], steel, 10);
    box(pistol, [0.012, 0.02, 0.02], [0, 0.096, -0.29], darkSteel);
    box(pistol, [0.007, 0.007, 0.002], [0, 0.1, -0.279], accent);
    box(pistol, [0.03, 0.018, 0.02], [0, 0.096, -0.03], darkSteel);
    box(pistol, [0.006, 0.03, 0.1], [0.028, 0.038, -0.12], darkSteel);
    rbox(pistol, [0.05, 0.04, 0.26], [0, -0.028, -0.14], polymer, 0.007);
    box(pistol, [0.028, 0.01, 0.1], [0, -0.052, -0.24], darkSteel);
    box(pistol, [0.016, 0.016, 0.1], [0, -0.075, -0.07], darkSteel);
    box(pistol, [0.016, 0.05, 0.016], [0, -0.09, -0.02], darkSteel);
    box(pistol, [0.01, 0.04, 0.014], [0, -0.07, -0.05], steel);
    rbox(pistol, [0.056, 0.2, 0.105], [0, -0.13, 0.06], polymer, 0.01).rotation.x = -0.16;
    for (let i = 0; i < 3; i++) box(pistol, [0.06, 0.012, 0.085], [0, -0.09 - i * 0.045, 0.05 + i * 0.007], darkSteel).rotation.x = -0.16;
    box(pistol, [0.06, 0.02, 0.115], [0, -0.23, 0.1], darkSteel).rotation.x = -0.16;
    box(pistol, [0.02, 0.03, 0.03], [0, 0.045, 0.0], steel);
    rbox(pistol, [0.048, 0.018, 0.08], [0, 0.005, 0.015], polymer, 0.006).rotation.x = -0.28;
    box(pistol, [0.008, 0.012, 0.06], [0.028, -0.012, -0.1], darkSteel);
    box(pistol, [0.012, 0.014, 0.018], [0.028, -0.055, 0.0], darkSteel);
    this.placeFPSArm(pistol, 'right', 0.78, [0.002, -0.132, 0.082], [0, 1, -0.16], [-1, 0, 0]);
    this.placeFPSArm(pistol, 'left', 0.74, [-0.05, -0.152, 0.096], [0, 1, -0.16], [1, 0.2, 0]);
    pistol.position.set(0.33, -0.19, -0.57);
    this.camera.add(pistol);

    // D-5 重型手枪
    const heavy = new THREE.Group();
    rbox(heavy, [0.07, 0.075, 0.36], [0, 0.028, -0.18], gunmetal, 0.009);
    rbox(heavy, [0.06, 0.026, 0.34], [0, 0.086, -0.18], darkSteel, 0.006);
    rbox(heavy, [0.048, 0.048, 0.09], [0, 0.045, -0.4], darkSteel, 0.006);
    for (let i = 0; i < 3; i++) box(heavy, [0.052, 0.012, 0.02], [0, 0.07 - i * 0.025, -0.38], steel);
    pipe(heavy, 0.02, 0.05, [0, 0.042, -0.45], steel, 10);
    for (let i = 0; i < 5; i++) box(heavy, [0.076, 0.045, 0.014], [0, 0.028, 0.0 - i * 0.022], darkSteel);
    box(heavy, [0.008, 0.035, 0.12], [0.036, 0.045, -0.13], darkSteel);
    rbox(heavy, [0.036, 0.018, 0.08], [0, 0.115, -0.08], darkSteel, 0.005);
    pipe(heavy, 0.019, 0.06, [0, 0.135, -0.08], darkSteel, 12);
    lens(heavy, 0.014, [0, 0.135, -0.048]);
    lens(heavy, 0.0035, [0, 0.135, -0.046], reticleDot);
    box(heavy, [0.012, 0.024, 0.02], [0, 0.11, -0.34], darkSteel);
    box(heavy, [0.007, 0.007, 0.002], [0, 0.114, -0.329], accent);
    rbox(heavy, [0.062, 0.045, 0.28], [0, -0.028, -0.15], polymer, 0.007);
    box(heavy, [0.032, 0.012, 0.12], [0, -0.055, -0.24], darkSteel);
    box(heavy, [0.018, 0.018, 0.11], [0, -0.08, -0.08], darkSteel);
    box(heavy, [0.018, 0.055, 0.018], [0, -0.095, -0.025], darkSteel);
    box(heavy, [0.011, 0.045, 0.015], [0, -0.075, -0.065], steel);
    rbox(heavy, [0.064, 0.22, 0.115], [0, -0.14, 0.06], polymer, 0.01).rotation.x = -0.16;
    for (let i = 0; i < 3; i++) box(heavy, [0.068, 0.014, 0.095], [0, -0.095 - i * 0.05, 0.05 + i * 0.008], darkSteel).rotation.x = -0.16;
    box(heavy, [0.068, 0.022, 0.125], [0, -0.25, 0.1], darkSteel).rotation.x = -0.16;
    box(heavy, [0.024, 0.035, 0.035], [0, 0.045, 0.0], steel);
    rbox(heavy, [0.056, 0.02, 0.09], [0, 0.002, 0.015], polymer, 0.006).rotation.x = -0.28;
    box(heavy, [0.009, 0.014, 0.07], [0.035, -0.012, -0.1], darkSteel);
    box(heavy, [0.014, 0.016, 0.02], [0.035, -0.055, 0.0], darkSteel);
    this.placeFPSArm(heavy, 'right', 0.82, [0.002, -0.14, 0.086], [0, 1, -0.16], [-1, 0, 0]);
    this.placeFPSArm(heavy, 'left', 0.78, [-0.052, -0.16, 0.1], [0, 1, -0.16], [1, 0.2, 0]);
    heavy.position.set(0.33, -0.195, -0.57);
    this.camera.add(heavy);

    // K-7 爪刃（Karambit）
    const knife = new THREE.Group();
    const bladeMaterial = new THREE.MeshStandardMaterial({ color: 0xc4d1cf, roughness: 0.13, metalness: 0.97 });
    const coatedBlade = new THREE.MeshStandardMaterial({ color: 0x3b4649, roughness: 0.3, metalness: 0.82 });
    const weaponRoot = new THREE.Group();

    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.06, 0.03);
    bladeShape.bezierCurveTo(0.06, 0.16, 0.26, 0.32, 0.43, 0.41);
    bladeShape.bezierCurveTo(0.46, 0.435, 0.47, 0.385, 0.44, 0.34);
    bladeShape.bezierCurveTo(0.32, 0.2, 0.18, 0.05, 0.03, -0.04);
    bladeShape.bezierCurveTo(-0.01, -0.07, -0.05, -0.04, -0.06, 0.03);
    bladeShape.closePath();
    const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.012, bevelEnabled: true, bevelThickness: 0.0026, bevelSize: 0.0026, bevelSegments: 2, curveSegments: 32,
    });
    bladeGeometry.translate(0, 0, -0.006);
    const blade = new THREE.Mesh(bladeGeometry, coatedBlade);
    weaponRoot.add(blade);

    const edgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.44, 0.34, 0),
      new THREE.Vector3(0.36, 0.24, 0),
      new THREE.Vector3(0.26, 0.12, 0),
      new THREE.Vector3(0.16, 0.02, 0),
      new THREE.Vector3(0.06, -0.03, 0),
      new THREE.Vector3(0.0, -0.05, 0),
    ]);
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.TubeGeometry(edgeCurve, 48, 0.0028, 5, false), bladeMaterial);
      edge.position.z = side * 0.0065;
      weaponRoot.add(edge);
    }
    const spineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.055, 0.035, 0),
      new THREE.Vector3(0.04, 0.145, 0),
      new THREE.Vector3(0.18, 0.26, 0),
      new THREE.Vector3(0.32, 0.36, 0),
      new THREE.Vector3(0.42, 0.405, 0),
    ]);
    for (const side of [-1, 1]) {
      const spine = new THREE.Mesh(new THREE.TubeGeometry(spineCurve, 40, 0.0023, 5, false), bladeMaterial);
      spine.position.z = side * 0.0065;
      weaponRoot.add(spine);
    }
    const fullerCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.015, 0.07, 0),
      new THREE.Vector3(0.1, 0.19, 0),
      new THREE.Vector3(0.24, 0.3, 0),
      new THREE.Vector3(0.35, 0.37, 0),
    ]);
    for (const side of [-1, 1]) {
      const fuller = new THREE.Mesh(new THREE.TubeGeometry(fullerCurve, 32, 0.0022, 5, false), darkSteel);
      fuller.position.z = side * 0.0062;
      weaponRoot.add(fuller);
    }
    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x0b1112 });
    for (const [hx, hy] of [[0.11, 0.1], [0.21, 0.2]]) {
      for (const side of [-1, 1]) {
        const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0105, 14), holeMaterial);
        hole.position.set(hx, hy, side * 0.0063);
        hole.rotation.y = side < 0 ? Math.PI : 0;
        weaponRoot.add(hole);
      }
    }
    for (let i = 0; i < 5; i++) {
      box(weaponRoot, [0.018, 0.006, 0.014], [-0.005 + i * 0.032, 0.075 + i * 0.038, 0], steel).rotation.z = 0.85;
    }
    for (let i = 0; i < 4; i++) {
      box(weaponRoot, [0.014, 0.006, 0.014], [0.06 + i * 0.03, -0.015 + i * 0.02, 0], bladeMaterial).rotation.z = -0.85;
    }

    const handleGroup = new THREE.Group();
    handleGroup.position.set(0.02, -0.05, 0);
    handleGroup.rotation.z = -0.85;
    weaponRoot.add(handleGroup);
    rbox(handleGroup, [0.055, 0.085, 0.075], [0.0, 0.0, 0], darkSteel, 0.014);
    rbox(handleGroup, [0.4, 0.072, 0.062], [0.21, 0.0, 0], polymer, 0.014);
    rbox(handleGroup, [0.24, 0.082, 0.076], [0.19, 0.002, 0], polymer, 0.014);
    rbox(handleGroup, [0.22, 0.03, 0.012], [0.21, -0.018, 0.036], rubber, 0.008);
    for (const x of [0.08, 0.16, 0.24]) {
      post(handleGroup, 0.013, 0.066, [x, -0.004, 0], rubber, 10).rotation.x = Math.PI / 2;
    }
    for (const x of [0.05, 0.36]) {
      post(handleGroup, 0.006, 0.068, [x, 0.026, 0], steel, 8).rotation.x = Math.PI / 2;
    }
    box(handleGroup, [0.24, 0.006, 0.006], [0.21, 0.04, 0.032], accent);
    rbox(handleGroup, [0.075, 0.055, 0.06], [0.43, 0.0, 0], darkSteel, 0.01);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 12, 30), darkSteel);
    ring.position.set(0.49, 0.0, 0);
    handleGroup.add(ring);
    const ringInner = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0028, 8, 30), accent);
    ringInner.position.set(0.49, 0.0, 0.006);
    handleGroup.add(ringInner);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), accent);
    bead.position.set(0.542, 0.0, 0.006);
    handleGroup.add(bead);

    // 手随刀身一起检视旋转，保证旋转过程中始终握住刀柄
    this.placeFPSArm(weaponRoot, 'right', 1.3, [0.2, -0.255, 0.025], [-0.66, 0.751, 0], [0, 0, -1], { roll: -1.1 });

    const pivotX = 0.02 + 0.175 * Math.cos(0.85) + 0.005 * Math.sin(0.85);
    const pivotY = -0.05 - 0.175 * Math.sin(0.85) + 0.005 * Math.cos(0.85);
    const spinRoot = new THREE.Group();
    spinRoot.position.set(pivotX, pivotY, 0);
    weaponRoot.position.set(-pivotX, -pivotY, 0);
    spinRoot.add(weaponRoot);
    knife.add(spinRoot);
    this.knifeSpin = spinRoot;

    knife.position.set(0.31, -0.06, -0.55);
    knife.scale.setScalar(0.45);
    knife.rotation.set(-0.08, -0.2, -0.05);
    this.camera.add(knife);

    this.weaponModels = { rifle, smg, shotgun, sniper, scout, autoSniper, scopedRifle, dmr, lmg, pistol, heavy, knife, scopedSniper };
    this.weaponBasePositions = {
      rifle: new THREE.Vector3(0.35, -0.31, -0.55), smg: new THREE.Vector3(0.35, -0.3, -0.5),
      shotgun: new THREE.Vector3(0.35, -0.31, -0.58), sniper: new THREE.Vector3(0.35, -0.31, -0.62),
      scout: new THREE.Vector3(0.35, -0.31, -0.65),
      autoSniper: new THREE.Vector3(0.35, -0.31, -0.62),
      scopedRifle: new THREE.Vector3(0.35, -0.31, -0.56),
      scopedSniper: new THREE.Vector3(0.35, -0.31, -0.62),
      dmr: new THREE.Vector3(0.35, -0.31, -0.6), lmg: new THREE.Vector3(0.35, -0.25, -0.6),
      pistol: new THREE.Vector3(0.33, -0.19, -0.57), heavy: new THREE.Vector3(0.33, -0.195, -0.57),
      knife: new THREE.Vector3(0.31, -0.06, -0.55),
    };
    Object.entries(this.weaponModels).forEach(([name, model]) => { model.visible = name === 'rifle'; });

    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = flashCanvas.height = 128;
    const fctx = flashCanvas.getContext('2d');
    const gradient = fctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,220,1)');
    gradient.addColorStop(0.18, 'rgba(255,220,110,.95)');
    gradient.addColorStop(0.5, 'rgba(255,120,20,.45)');
    gradient.addColorStop(1, 'rgba(255,80,0,0)');
    fctx.fillStyle = gradient; fctx.fillRect(0, 0, 128, 128);
    this.muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(flashCanvas), color: 0xffddaa, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.muzzleFlash.scale.set(0.42, 0.42, 0.42);
    this.muzzleFlash.visible = false;
    this.camera.add(this.muzzleFlash);
    this.muzzleLight = new THREE.PointLight(0xff9a45, 0, 5);
    this.camera.add(this.muzzleLight);
    this.heatSteam = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.sparkTexture, color: 0xc4ccc8, transparent: true, opacity: 0,
      depthWrite: false,
    }));
    this.heatSteam.scale.setScalar(0.35);
    this.heatSteam.visible = false;
    this.camera.add(this.heatSteam);
    const viewLight = new THREE.PointLight(0xe4f2e9, 4.8, 4.5, 2);
    viewLight.position.set(-0.4, 0.5, 0.4);
    this.camera.add(viewLight);
    // 手部专属打光：暖色主光 + 冷色补光 + 侧后方轮廓光
    const handKey = new THREE.PointLight(0xffc79a, 2.0, 1.5, 2);
    handKey.position.set(0.55, 0.15, 0.2);
    this.camera.add(handKey);
    const handFill = new THREE.PointLight(0x8fc8dd, 0.9, 1.8, 2);
    handFill.position.set(-0.45, -0.25, 0.2);
    this.camera.add(handFill);
    const handRim = new THREE.PointLight(0xffedd2, 0.9, 1.4, 2);
    handRim.position.set(-0.45, 0.35, -0.8);
    this.camera.add(handRim);
    this.scene.add(this.camera);
  }

  applySettings(settings = {}) {
    if (Number.isFinite(settings.sensitivity)) this.sensitivity = clamp(settings.sensitivity, 0.3, 2.5);
    if (Number.isFinite(settings.touchSensitivity)) this.touchSensitivity = clamp(settings.touchSensitivity, 0.3, 3);
    if (Number.isFinite(settings.fov)) {
      this.baseFov = clamp(settings.fov, 60, 100);
      if (!this.scoped) {
        this.camera.fov = this.baseFov;
        this.camera.updateProjectionMatrix();
      }
    }
    if (Number.isFinite(settings.volume)) this.audio.setVolume(clamp(settings.volume / 100, 0, 1));
    if (typeof settings.quality === 'string') {
      this.quality = ['low', 'medium', 'high'].includes(settings.quality) ? settings.quality : 'high';
      this.applyQualitySetting();
    }
    this.updatePointerSpeed();
  }

  setOperativeForm(form) {
    const next = form === 'female' ? 'female' : 'male';
    if (next === this.operativeForm) return;
    this.operativeForm = next;
    if (!this.playerAvatar) return;
    // 切换体型会重建干员模型，旧模型的克隆材质需要释放，几何体与模板共享不能销毁
    this.playerAvatar.mixer?.stopAllAction();
    this.playerAvatar.mixer?.uncacheRoot(this.playerAvatar.group);
    this.disposeObject3D(this.playerAvatar.group);
    this.scene.remove(this.playerAvatar.group);
    this.playerAvatar = null;
    this.buildPlayerAvatar();
  }

  // 女性体型通过复制动画并缩放指定骨骼的 scale 轨道实现，避免被动画覆盖
  formClip(name, form) {
    const clip = this.character.clips?.[name];
    if (!clip || form !== 'female') return clip || null;
    let prepared = this.femaleClips.get(name);
    if (prepared) return prepared;
    prepared = clip.clone();
    const multipliers = {
      spine_02: [0.93, 1, 0.97],
      upperarm_l: [0.92, 1, 0.92],
      upperarm_r: [0.92, 1, 0.92],
      lowerarm_l: [0.92, 1, 0.92],
      lowerarm_r: [0.92, 1, 0.92],
      thigh_l: [0.95, 1, 0.95],
      thigh_r: [0.95, 1, 0.95],
      calf_l: [0.94, 1, 0.94],
      calf_r: [0.94, 1, 0.94],
    };
    for (const track of prepared.tracks) {
      const match = /(?:^|\/)([^/]+)\.scale$/.exec(track.name);
      const mult = match && multipliers[match[1]];
      if (!mult) continue;
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] *= mult[0];
        track.values[i + 1] *= mult[1];
        track.values[i + 2] *= mult[2];
      }
    }
    this.femaleClips.set(name, prepared);
    return prepared;
  }

  pixelRatioCap() {
    if (this.quality === 'low') return 1;
    return this.quality === 'medium' ? 1.25 : 1.5;
  }

  applyPixelRatio(ratio) {
    const next = clamp(ratio, 0.65, this.maxPixelRatio);
    if (Math.abs(next - this.currentPixelRatio) < 0.01) return;
    this.currentPixelRatio = next;
    this.renderer.setPixelRatio(next);
    if (this.composer) {
      this.composer.setPixelRatio(next);
      this.composer.setSize(innerWidth, innerHeight);
      this.syncBloomResolution();
    }
  }

  applyQualitySetting() {
    this.maxPixelRatio = Math.min(devicePixelRatio, this.pixelRatioCap());
    this.currentPixelRatio = this.maxPixelRatio;
    this.renderer.setPixelRatio(this.currentPixelRatio);
    if (this.composer) {
      this.composer.setPixelRatio(this.currentPixelRatio);
      this.composer.setSize(innerWidth, innerHeight);
      this.syncBloomResolution();
    }
    if (this.bloomPass) {
      this.bloomPass.strength = this.quality === 'high' ? 0.3 : 0.18;
      this.bloomPass.threshold = this.quality === 'high' ? 1.05 : 1.12;
    }
    if (this.gtaoPass) this.gtaoPass.enabled = this.quality === 'high';
    if (this.smaaPass) this.smaaPass.enabled = this.quality !== 'low';
    this.usePost = this.quality !== 'low';
    const lowQuality = this.quality === 'low';
    // 流畅模式改用更便宜的软阴影采样算法，弱机型阴影开销明显下降
    const shadowType = lowQuality ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (this.renderer.shadowMap.type !== shadowType) {
      this.renderer.shadowMap.type = shadowType;
      // 阴影过滤器变化需要重编译材质着色器
      this.scene.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material) material.needsUpdate = true;
        }
      });
    }
    if (this.sunLight) {
      const shadowSize = lowQuality ? 1024 : 2048;
      if (this.sunLight.shadow.mapSize.x !== shadowSize) {
        this.sunLight.shadow.mapSize.set(shadowSize, shadowSize);
        this.sunLight.shadow.map?.dispose();
        this.sunLight.shadow.map = null;
      }
    }
    if (this.laneSpot) this.laneSpot.castShadow = !lowQuality;
    // 各向异性过滤主要作用于地面等斜视角大面积采样，按画质下调可降低纹理采样开销
    const anisotropy = lowQuality ? 2 : this.quality === 'medium' ? 4 : 8;
    if (this.textureAnisotropy !== anisotropy) {
      this.textureAnisotropy = anisotropy;
      const seenTextures = new Set();
      const textureKeys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'bumpMap', 'alphaMap', 'aoMap'];
      this.scene.traverse((object) => {
        if (!object.isMesh && !object.isSkinnedMesh) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!material) continue;
          for (const key of textureKeys) {
            const texture = material[key];
            if (!texture || seenTextures.has(texture) || texture.anisotropy === anisotropy) continue;
            seenTextures.add(texture);
            texture.anisotropy = anisotropy;
            texture.needsUpdate = true;
          }
        }
      });
    }
    this.qualityTimer = 0;
    this.frameTimeAccum = 0;
    this.frameTimeCount = 0;
    this.qualityStableTimer = 0;
  }

  updatePointerSpeed() {
    const weapon = this.weaponConfigs[this.currentWeapon];
    const zoom = this.scoped && weapon?.scoped ? clamp(weapon.scopeFov / this.baseFov, 0.28, 1) : 1;
    this.controls.pointerSpeed = zoom * this.sensitivity;
  }

  setTouchMode(enabled) {
    this.touchMode = !!enabled;
    document.body.classList.toggle('touch-mode', this.touchMode);
    if (this.touchMode) this.fallbackLook = true;
    else this.releaseWakeLock();
  }

  async requestWakeLock() {
    if (!this.touchMode || this.wakeLock || !navigator.wakeLock?.request) return;
    if (document.visibilityState !== 'visible') return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (this.state !== 'playing') {
        try {
          const result = lock.release?.();
          result?.catch?.(() => {});
        } catch {
          // 忽略释放失败
        }
        return;
      }
      this.wakeLock = lock;
      lock.addEventListener?.('release', () => {
        if (this.wakeLock === lock) this.wakeLock = null;
      });
    } catch {
      // 浏览器不支持或被省电策略拒绝时忽略
    }
  }

  releaseWakeLock() {
    if (!this.wakeLock) return;
    try {
      this.wakeLock.release().catch(() => {});
    } catch {
      // 忽略释放失败
    }
    this.wakeLock = null;
  }

  resetTouchInput() {
    this.touchState.moveX = 0;
    this.touchState.moveY = 0;
    this.touchState.crouch = false;
    this.touchState.firing = false;
    this.touchState.interact = false;
    this.mouseDown = false;
    this.keys.KeyE = false;
    this.touchLookId = null;
    this.touchMoveId = null;
    const knob = $('touch-move-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    $('touch-move')?.classList.remove('active');
    document.querySelectorAll('#touch-controls [data-touch]').forEach((button) => {
      button.classList.remove('pressed');
      if (button.dataset.touch === 'interact' || button.dataset.touch === 'crouch') button.classList.remove('active');
    });
  }

  syncTouchButtons() {
    document.querySelectorAll('#touch-controls [data-touch]').forEach((button) => {
      if (button.dataset.touch === 'scope') button.classList.toggle('active', this.scoped);
      if (button.dataset.touch === 'crouch') button.classList.toggle('active', this.touchState.crouch);
    });
  }

  showGamepadBadge(text = '手柄已连接') {
    const element = $('gamepad-status');
    if (!element) return;
    element.textContent = text;
    element.classList.remove('hidden');
    clearTimeout(this.gamepadBadgeTimer);
    this.gamepadBadgeTimer = setTimeout(() => element.classList.add('hidden'), 5200);
  }

  resetGamepadInput() {
    this.gamepad.moveX = 0;
    this.gamepad.moveY = 0;
    this.gamepad.lookX = 0;
    this.gamepad.lookY = 0;
    this.gamepad.fire = false;
    this.gamepad.scope = false;
    this.gamepad.interact = false;
    this.gamepad.crouch = false;
  }

  nextWeaponName(direction = 1) {
    const weapons = [this.primaryWeapon, this.secondaryWeapon, 'knife'];
    const index = weapons.indexOf(this.currentWeapon);
    return weapons[(index + direction + weapons.length) % weapons.length];
  }

  rumbleGamepad(strong = 0.3, duration = 60) {
    const actuator = this.gamepad.pad?.vibrationActuator;
    if (!actuator?.playEffect) return;
    try {
      const result = actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration,
        weakMagnitude: strong * 0.6,
        strongMagnitude: strong,
      });
      result?.catch?.(() => {});
    } catch {
      // 部分浏览器不支持震动
    }
  }

  pollGamepad(dt) {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    // 未连接手柄时降低轮询频率：getGamepads() 每帧都会生成快照数组，纯键鼠玩家无需承担这份开销
    if (!this.gamepad.connected) {
      this.gamepadPollTimer = (this.gamepadPollTimer || 0) - dt;
      if (this.gamepadPollTimer > 0) return;
      this.gamepadPollTimer = 0.5;
    }
    const pads = navigator.getGamepads();
    let pad = this.gamepad.index !== null ? pads[this.gamepad.index] : null;
    if (!pad || !pad.connected) {
      pad = null;
      for (const candidate of pads) {
        if (candidate?.connected) {
          pad = candidate;
          break;
        }
      }
    }
    if (!pad) {
      if (this.gamepad.connected) {
        this.gamepad.connected = false;
        this.gamepad.index = null;
        this.gamepad.pad = null;
        this.gamepad.prev = [];
        this.resetGamepadInput();
        if (this.state === 'playing') {
          this.announce('CONTROLLER', '手柄已断开', '已切换回触屏 / 键鼠操作');
        }
      }
      return;
    }
    if (!this.gamepad.connected) {
      this.gamepad.connected = true;
      this.gamepad.index = pad.index;
      this.gamepad.pad = pad;
      this.gamepad.prev = [];
      this.gamepad.fire = false;
      this.gamepad.scope = false;
      this.gamepad.crouch = false;
      this.showGamepadBadge('手柄已连接');
      if (this.state === 'playing') {
        this.announce('CONTROLLER', '手柄已连接', '左摇杆移动 · 右摇杆瞄准 · RT 开火 / LT 开镜');
      }
    }
    this.gamepad.pad = pad;
    const axes = pad.axes || [];
    this.gamepad.moveX = stickDeadzone(axes[0]);
    this.gamepad.moveY = -stickDeadzone(axes[1]);
    this.gamepad.lookX = stickDeadzone(axes[2]);
    this.gamepad.lookY = stickDeadzone(axes[3]);
    const now = this.gamepadNow;
    for (let i = 0; i < pad.buttons.length; i++) now[i] = !!pad.buttons[i]?.pressed;
    const edge = (index) => !!now[index] && !this.gamepad.prev[index];
    const playing = this.state === 'playing';
    const scopedHeld = (pad.buttons[6]?.value || 0) > 0.2 || !!now[6];
    const fireHeld = (pad.buttons[7]?.value || 0) > 0.2 || !!now[7];
    const weapon = this.weaponConfigs[this.currentWeapon];

    if (playing) {
      if (scopedHeld && weapon?.scoped && !this.scoped) this.setScoped(true);
      if (!scopedHeld && this.gamepad.scope && this.scoped) this.setScoped(false);
      if (fireHeld && !this.gamepad.fire) {
        this.gamepad.fire = true;
        if (!weapon.auto) this.fireWeapon();
      }
      if (edge(0)) this.jumpBuffer = 0.15;
      if (edge(1)) this.gamepad.crouch = !this.gamepad.crouch;
      if (edge(2)) this.reloadWeapon();
      if (edge(3)) this.switchWeapon(this.nextWeaponName(1));
      if (edge(4)) this.throwGrenade();
      if (edge(12)) this.openBuyMenu();
      if (edge(13)) this.toggleThirdPerson();
      if (edge(14)) this.switchWeapon(this.nextWeaponName(-1));
      if (edge(15)) this.switchWeapon(this.nextWeaponName(1));
      this.gamepad.fire = fireHeld;
      this.gamepad.scope = scopedHeld;
      this.gamepad.interact = !!now[5];
      if (this.gamepad.lookX || this.gamepad.lookY) {
        const lookScale = this.scoped && weapon?.scoped ? Math.max(0.28, this.camera.fov / this.baseFov) : 1;
        const speed = 2.7 * this.sensitivity * lookScale;
        this.camera.rotation.y -= this.gamepad.lookX * speed * dt;
        this.camera.rotation.x = clamp(this.camera.rotation.x - this.gamepad.lookY * speed * 0.78 * dt, -1.45, 1.45);
        this.mouseSway.set(clamp(this.gamepad.lookX * 18, -40, 40), clamp(this.gamepad.lookY * 18, -40, 40));
      }
      if (edge(9)) this.pauseGame();
    } else {
      this.gamepad.fire = false;
      this.gamepad.scope = false;
      this.gamepad.interact = false;
      if ((this.state === 'buying' || this.state === 'paused') && (edge(1) || edge(9))) {
        if (this.state === 'buying') this.closeBuyMenu();
        else this.resume();
      }
    }
    this.gamepad.prev = now;
  }

  bindTouchControls() {
    const look = $('touch-look');
    const stick = $('touch-move');
    const knob = $('touch-move-knob');
    if (!look || !stick || !knob) return;
    const stickRadius = 42;
    let lookX = 0;
    let lookY = 0;

    const updateStick = (x, y) => {
      const rect = stick.getBoundingClientRect();
      let dx = x - (rect.left + rect.width / 2);
      let dy = y - (rect.top + rect.height / 2);
      const dist = Math.hypot(dx, dy);
      if (dist > stickRadius) {
        dx = (dx / dist) * stickRadius;
        dy = (dy / dist) * stickRadius;
      }
      this.touchState.moveX = dx / stickRadius;
      this.touchState.moveY = -dy / stickRadius;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    stick.addEventListener('touchstart', (event) => {
      if (this.state !== 'playing' || this.touchMoveId !== null) return;
      const touch = event.changedTouches[0];
      this.touchMoveId = touch.identifier;
      stick.classList.add('active');
      updateStick(touch.clientX, touch.clientY);
      event.preventDefault();
    }, { passive: false });
    stick.addEventListener('touchmove', (event) => {
      if (this.touchMoveId === null) return;
      for (const touch of event.changedTouches) {
        if (touch.identifier === this.touchMoveId) updateStick(touch.clientX, touch.clientY);
      }
      event.preventDefault();
    }, { passive: false });
    const endStick = (event) => {
      if (this.touchMoveId === null) return;
      for (const touch of event.changedTouches) {
        if (touch.identifier !== this.touchMoveId) continue;
        this.touchMoveId = null;
        this.touchState.moveX = 0;
        this.touchState.moveY = 0;
        knob.style.transform = 'translate(-50%, -50%)';
        stick.classList.remove('active');
        event.preventDefault();
      }
    };
    stick.addEventListener('touchend', endStick, { passive: false });
    stick.addEventListener('touchcancel', endStick, { passive: false });

    look.addEventListener('touchstart', (event) => {
      if (this.state !== 'playing' || this.touchLookId !== null) return;
      const touch = event.changedTouches[0];
      this.touchLookId = touch.identifier;
      lookX = touch.clientX;
      lookY = touch.clientY;
      event.preventDefault();
    }, { passive: false });
    look.addEventListener('touchmove', (event) => {
      if (this.touchLookId === null) return;
      for (const touch of event.changedTouches) {
        if (touch.identifier !== this.touchLookId) continue;
        const dx = touch.clientX - lookX;
        const dy = touch.clientY - lookY;
        lookX = touch.clientX;
        lookY = touch.clientY;
        const weapon = this.weaponConfigs[this.currentWeapon];
        const lookScale = this.scoped && weapon?.scoped ? Math.max(0.28, this.camera.fov / this.baseFov) : 1;
        const rate = 0.0042 * lookScale * this.touchSensitivity;
        this.camera.rotation.y -= dx * rate;
        this.camera.rotation.x = clamp(this.camera.rotation.x - dy * rate, -1.45, 1.45);
        this.mouseSway.set(clamp(dx, -40, 40), clamp(dy, -40, 40));
      }
      event.preventDefault();
    }, { passive: false });
    const endLook = (event) => {
      if (this.touchLookId === null) return;
      for (const touch of event.changedTouches) {
        if (touch.identifier !== this.touchLookId) continue;
        this.touchLookId = null;
        event.preventDefault();
      }
    };
    look.addEventListener('touchend', endLook, { passive: false });
    look.addEventListener('touchcancel', endLook, { passive: false });

    document.querySelectorAll('#touch-controls [data-touch]').forEach((button) => {
      const action = button.dataset.touch;
      button.addEventListener('touchstart', (event) => {
        event.preventDefault();
        button.classList.add('pressed');
        this.touchActionStart(action, button);
      }, { passive: false });
      const release = (event) => {
        event.preventDefault();
        button.classList.remove('pressed');
        this.touchActionEnd(action, button);
      };
      button.addEventListener('touchend', release, { passive: false });
      button.addEventListener('touchcancel', release, { passive: false });
    });
  }

  touchActionStart(action, button) {
    if (action === 'pause') {
      if (this.state === 'buying') this.closeBuyMenu();
      if (this.state === 'playing') this.pauseGame();
      return;
    }
    if (this.state !== 'playing') return;
    const weapon = this.weaponConfigs[this.currentWeapon];
    switch (action) {
      case 'fire':
        this.touchState.firing = true;
        this.mouseDown = true;
        if (!weapon.auto) this.fireWeapon();
        break;
      case 'scope':
        if (weapon?.scoped) this.setScoped(!this.scoped);
        else if (weapon?.melee) this.meleeAttack(weapon, true);
        break;
      case 'jump':
        this.jumpBuffer = 0.15;
        break;
      case 'crouch':
        this.touchState.crouch = !this.touchState.crouch;
        this.syncTouchButtons();
        break;
      case 'reload':
        this.reloadWeapon();
        break;
      case 'weapon': {
        const weapons = [this.primaryWeapon, this.secondaryWeapon, 'knife'];
        const index = weapons.indexOf(this.currentWeapon);
        this.switchWeapon(weapons[(index + 1) % weapons.length]);
        break;
      }
      case 'grenade':
        this.throwGrenade();
        break;
      case 'interact':
        this.keys.KeyE = true;
        this.touchState.interact = true;
        button.classList.add('active');
        break;
      case 'buy':
        this.openBuyMenu();
        break;
      case 'thirdperson':
        this.toggleThirdPerson();
        break;
      default:
        break;
    }
  }

  touchActionEnd(action, button) {
    if (action === 'fire') {
      this.touchState.firing = false;
      this.mouseDown = false;
    }
    if (action === 'interact') {
      this.keys.KeyE = false;
      this.touchState.interact = false;
      button.classList.remove('active');
    }
  }

  bindEvents() {
    // 手柄插拔后立刻恢复高频轮询，避免节流造成识别延迟
    addEventListener('gamepadconnected', () => { this.gamepadPollTimer = 0; });
    addEventListener('gamepaddisconnected', () => { this.gamepadPollTimer = 0; });
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
      this.maxPixelRatio = Math.min(devicePixelRatio, this.pixelRatioCap());
      this.currentPixelRatio = Math.min(this.currentPixelRatio, this.maxPixelRatio);
      this.renderer.setPixelRatio(this.currentPixelRatio);
      this.composer?.setPixelRatio(this.currentPixelRatio);
      this.composer?.setSize(innerWidth, innerHeight);
      this.syncBloomResolution();
    });
    addEventListener('keydown', (event) => {
      this.keys[event.code] = true;
      if (event.code === 'KeyB' && (this.state === 'playing' || this.state === 'buying')) {
        this.state === 'buying' ? this.closeBuyMenu() : this.openBuyMenu();
        return;
      }
      if (event.code === 'Escape' && this.state === 'buying') {
        this.closeBuyMenu();
        return;
      }
      if (event.code === 'Escape' && this.fallbackLook && this.state === 'playing') {
        this.pauseGame();
        return;
      }
      if (this.state !== 'playing') return;
      if (event.code === 'KeyR') this.reloadWeapon();
      if (event.code === 'KeyF') this.inspectWeapon();
      if (event.code === 'KeyG' && !event.repeat) this.throwGrenade();
      if (event.code === 'KeyQ' && !event.repeat) this.switchToLastWeapon();
      if (event.code === 'KeyV' && !event.repeat) this.toggleThirdPerson();
      if (event.code === 'Digit1') this.switchWeapon(this.primaryWeapon);
      if (event.code === 'Digit2') this.switchWeapon(this.secondaryWeapon);
      if (event.code === 'Digit3') this.switchWeapon('knife');
      if (event.code === 'Space' && !event.repeat) {
        this.jumpBuffer = 0.15;
      }
    });
    addEventListener('keyup', (event) => { this.keys[event.code] = false; });
    addEventListener('mousedown', (event) => {
      if (event.button === 0 && (this.controls.isLocked || this.fallbackLook) && this.state === 'playing') {
        this.mouseDown = true;
        if (!this.weaponConfigs[this.currentWeapon].auto) this.fireWeapon();
      }
      if (event.button === 2 && this.state === 'playing') {
        const weapon = this.weaponConfigs[this.currentWeapon];
        if (weapon?.scoped) {
          event.preventDefault();
          this.setScoped(true);
        } else if (weapon?.melee) {
          event.preventDefault();
          this.meleeAttack(weapon, true);
        }
      }
    });
    addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
      if (event.button === 2) this.setScoped(false);
    });
    addEventListener('contextmenu', (event) => event.preventDefault());
    addEventListener('mousemove', (event) => {
      const lookScale = this.scoped ? Math.max(0.28, this.camera.fov / this.baseFov) : 1;
      if (this.controls.isLocked) {
        this.mouseSway.set(clamp(event.movementX, -40, 40), clamp(event.movementY, -40, 40));
      } else if (this.fallbackLook && this.state === 'playing') {
        this.camera.rotation.y -= event.movementX * 0.0022 * lookScale * this.sensitivity;
        this.camera.rotation.x = clamp(this.camera.rotation.x - event.movementY * 0.0022 * lookScale * this.sensitivity, -1.45, 1.45);
        this.mouseSway.set(clamp(event.movementX, -40, 40), clamp(event.movementY, -40, 40));
      }
    });
    addEventListener('wheel', (event) => {
      if (this.state !== 'playing') return;
      const weapons = [this.primaryWeapon, this.secondaryWeapon, 'knife'];
      const index = weapons.indexOf(this.currentWeapon);
      this.switchWeapon(weapons[(index + (event.deltaY > 0 ? 1 : 2)) % weapons.length]);
    }, { passive: true });
    this.controls.addEventListener('lock', () => {
      if (this.state === 'menu' || this.state === 'roundEnd') return;
      this.enterPlaying(false);
    });
    this.controls.addEventListener('error', () => {
      if (this.state === 'starting' || this.state === 'resuming') this.enterPlaying(true);
    });
    this.controls.addEventListener('unlock', () => {
      if (this.state === 'playing') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pauseGame();
    });
    this.bindTouchControls();
  }

  enterPlaying(fallback = false) {
    this.fallbackLook = fallback || !this.controls.isLocked;
    this.state = 'playing';
    $('pause-menu').classList.add('hidden');
    $('buy-menu').classList.add('hidden');
    $('main-menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.syncTouchButtons();
    if (this.gamepad.connected) this.showGamepadBadge('手柄已连接');
    this.idleFrameAccum = 0;
    this.requestWakeLock();
    this.clock.getDelta();
  }

  pauseGame() {
    this.state = 'paused';
    this.resetScopeView();
    this.mouseDown = false;
    this.resetTouchInput();
    this.resetGamepadInput();
    this.releaseWakeLock();
    this.inspecting = false;
    this.switchFrom = null;
    this.switchStart = -10;
    this.switchDuration = 0;
    this.pendingInspect = false;
    Object.keys(this.keys).forEach((key) => { this.keys[key] = false; });
    Object.entries(this.weaponModels).forEach(([id, model]) => { model.visible = id === this.currentWeapon; });
    if (this.controls.isLocked) this.controls.unlock();
    $('restart-button').classList.toggle('hidden', this.mode === 'online');
    this.updateWeaponUI();
    $('pause-menu').classList.remove('hidden');
  }

  requestMouseLock() {
    if (this.touchMode) {
      this.enterPlaying(true);
      return;
    }
    try {
      const request = this.controls.lock();
      request?.catch(() => {
        if (this.state === 'starting' || this.state === 'resuming') this.enterPlaying(true);
      });
    } catch {
      this.enterPlaying(true);
      return;
    }
    setTimeout(() => {
      if (this.state === 'starting' || this.state === 'resuming') this.enterPlaying(true);
      if (this.state === 'playing' && !this.controls.isLocked) this.fallbackLook = true;
    }, 250);
  }

  setMenuCamera() {
    this.camera.position.set(15, 8.5, 29);
    this.camera.lookAt(-2, 2.2, -12);
    Object.values(this.weaponModels).forEach((model) => { model.visible = false; });
  }

  startRound() {
    this.mode = 'bomb';
    this.duelMode = false;
    this.tdm = false;
    this.unlimitedAmmo = false;
    this.online = null;
    this.onlineId = null;
    this.onlineRoom = null;
    this.clearRemotePlayers();
    this.setOnlineHUD(false);
    this.audio.init();
    this.lightningActive = 0;
    this.lightningNext = this.time + 3 + Math.random() * 4;
    if (this.sunLight) this.sunLight.intensity = this.baseSunIntensity;
    if (this.hemiLight) this.hemiLight.intensity = this.baseHemiIntensity;
    if (this.lightningSprite) {
      this.lightningSprite.visible = false;
      this.lightningSprite.material.opacity = 0;
    }
    this.resetRound();
    this.state = 'starting';
    $('main-menu').classList.add('hidden');
    $('pause-menu').classList.add('hidden');
    $('round-end').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.requestMouseLock();
  }

  resetRound() {
    this.resetWeaponHeat();
    this.resetMotionState();
    this.resetScopeView();
    this.enemies.forEach((enemy) => this.disposeEnemy(enemy));
    this.enemies = [];
    this.clearEffects();
    this.resetBulletHoles();
    if (this.bomb) { this.scene.remove(this.bomb); this.bomb = null; }
    if (this.bombLight) {
      this.bombLight.intensity = 0;
      this.bombLight.color.setHex(0xffa04a);
      this.bombLight.distance = 18;
    }
    this.player.position.set(0, 0, 31);
    this.player.velocity.set(0, 0, 0);
    this.player.verticalVelocity = 0;
    this.player.health = 100;
    this.player.armor = 50;
    this.player.eyeHeight = 1.65;
    this.camera.position.set(0, 1.65, 31);
    this.camera.rotation.set(0, 0, 0);
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.lastShotAt = -10;
    this.stepDistance = 0;
    Object.values(this.weaponConfigs).forEach((weapon) => {
      weapon.ammo = weapon.magSize;
      weapon.reserve = weapon.reserveMax;
    });
    this.resetEquipment();
    this.clearGrenades();
    this.resetPickups();
    this.currentWeapon = this.primaryWeapon;
    this.lastWeapon = null;
    Object.entries(this.weaponModels).forEach(([name, model]) => { model.visible = name === this.currentWeapon; });
    this.drawCycle = 1;
    this.poseWeaponDraw(this.currentWeapon);
    this.reloading = false;
    this.inspecting = false;
    this.switchFrom = null;
    this.switchStart = -10;
    this.switchDuration = 0;
    this.pendingInspect = false;
    this.meleeSwing = 0;
    this.weaponKick = 0;
    this.bloom = 0;
    this.buyTime = 20;
    this.roundTime = 100;
    this.bombPlanted = false;
    this.plantProgress = 0;
    this.bombBeep = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.deaths = 0;
    this.player.dead = false;
    this.player.respawnAt = 0;
    this.player.lean = 0;
    this.landingDip = 0;
    this.camera.rotation.z = 0;
    this.clearHealBuff();
    this.resetPlayerAvatar();
    this.mouseDown = false;
    this.createEnemies();
    $('kill-feed').innerHTML = '';
    $('bomb-status').classList.add('hidden');
    $('objective-banner').classList.remove('hidden');
    $('objective-banner').querySelector('strong').textContent = '前往 A 点安置量子核心';
    $('interaction').classList.add('hidden');
    $('buy-menu').classList.add('hidden');
    $('buy-phase').classList.remove('hidden');
    $('respawn-overlay').classList.add('hidden');
    $('crosshair').classList.remove('hidden');
    $('friendly-label').textContent = '守序者';
    $('enemy-label').textContent = '失控者';
    $('next-round').querySelector('span').textContent = '下一轮行动';
    $('next-round').querySelector('small').textContent = 'NEXT ROUND';
    $('restart-button').classList.remove('hidden');
    this.updateEconomyUI();
    $('round-label').textContent = `ROUND ${String(this.round).padStart(2, '0')}`;
    this.updateScoreUI();
    this.updateWeaponUI();
    this.updateVitalsUI();
    this.updateEnemyPips();
    this.announce('ROUND START', '行动开始', '按 B 购买装备，突破防线并安置核心');
  }

  openBuyMenu() {
    if (this.state !== 'playing') return;
    this.resetScopeView();
    if (this.buyTime <= 0) {
      this.announce('BUY PHASE ENDED', '购买阶段已结束', '下一轮开始后可再次购买武器');
      return;
    }
    this.state = 'buying';
    this.mouseDown = false;
    this.resetTouchInput();
    this.resetGamepadInput();
    this.inspecting = false;
    this.switchFrom = null;
    this.switchStart = -10;
    this.switchDuration = 0;
    this.pendingInspect = false;
    Object.keys(this.keys).forEach((key) => { this.keys[key] = false; });
    Object.entries(this.weaponModels).forEach(([id, model]) => { model.visible = id === this.currentWeapon; });
    if (this.controls.isLocked) this.controls.unlock();
    this.updateWeaponUI();
    this.updateEconomyUI();
    const subtitle = $('buy-menu').querySelector('.buy-header p');
    if (subtitle) subtitle.textContent = this.tdm ? '乱斗模式全武器解锁，可随时更换装备' : '购买阶段内选择主武器，购买后立即装备';
    const balanceHint = $('buy-menu').querySelector('.buy-balance span');
    if (balanceHint) balanceHint.textContent = this.tdm ? '无限乱斗 · 全武器免费' : '击杀 +$200 / 胜利 +$3000';
    $('buy-menu').classList.remove('hidden');
  }

  closeBuyMenu() {
    if (this.state !== 'buying') return;
    $('buy-menu').classList.add('hidden');
    this.state = 'resuming';
    this.requestMouseLock();
  }

  weaponSlot(name) {
    if (this.weaponConfigs[name]?.melee) return 'melee';
    return name === 'pistol' || name === 'heavy' ? 'secondary' : 'primary';
  }

  buyWeapon(name) {
    const weapon = this.weaponConfigs[name];
    if (this.state !== 'buying' || !weapon) return;
    const slot = this.weaponSlot(name);
    this.switchFrom = null;
    this.switchStart = -10;
    this.switchDuration = 0;
    this.pendingInspect = false;
    if (this.tdm) {
      if (this.currentWeapon === name) {
        $('buy-feedback').textContent = `${weapon.name} 已装备`;
        return;
      }
      if (slot === 'secondary') this.secondaryWeapon = name;
      else if (slot === 'primary') this.primaryWeapon = name;
      this.currentWeapon = name;
      this.reloading = false;
      this.inspecting = false;
      this.switchFrom = null;
      Object.entries(this.weaponModels).forEach(([id, model]) => { model.visible = id === name; });
      this.drawCycle = 1;
      this.poseWeaponDraw(name);
      weapon.ammo = weapon.magSize;
      weapon.reserve = weapon.reserveMax;
      $('buy-feedback').textContent = `已装备 ${weapon.name}`;
      this.audio.tone(620, 0.08, 0.07, 'sine', 880);
      this.updateWeaponUI();
      this.updateEconomyUI();
      return;
    }
    if (!weapon.price) {
      this.currentWeapon = name;
      if (slot === 'secondary') this.secondaryWeapon = name;
      this.reloading = false;
      this.inspecting = false;
      Object.entries(this.weaponModels).forEach(([id, model]) => { model.visible = id === name; });
      this.drawCycle = 1;
      this.poseWeaponDraw(name);
      $('buy-feedback').textContent = `已装备 ${weapon.name}`;
      this.audio.tone(520, 0.06, 0.05, 'sine', 700);
      this.updateWeaponUI();
      this.updateEconomyUI();
      return;
    }
    if ((slot === 'secondary' ? this.secondaryWeapon : this.primaryWeapon) === name) {
      $('buy-feedback').textContent = `${weapon.name} 已装备`;
      return;
    }
    if (this.credits < weapon.price) {
      $('buy-feedback').textContent = `资金不足，还需要 $${weapon.price - this.credits}`;
      this.audio.empty();
      return;
    }
    this.credits -= weapon.price;
    if (slot === 'secondary') this.secondaryWeapon = name;
    else this.primaryWeapon = name;
    this.currentWeapon = name;
    this.reloading = false;
    this.inspecting = false;
    Object.entries(this.weaponModels).forEach(([id, model]) => { model.visible = id === name; });
    this.drawCycle = 1;
    this.poseWeaponDraw(name);
    weapon.ammo = weapon.magSize;
    weapon.reserve = weapon.reserveMax;
    $('buy-feedback').textContent = `已购买并装备 ${weapon.name}`;
    this.audio.tone(620, 0.08, 0.07, 'sine', 880);
    this.updateWeaponUI();
    this.updateEconomyUI();
  }

  updateEconomyUI() {
    if (this.tdm) {
      $('credits-value').textContent = '∞';
      $('buy-credits').textContent = '全解锁';
      $('buy-time').textContent = '乱斗';
      document.querySelectorAll('[data-buy-weapon]').forEach((button) => {
        const name = button.dataset.buyWeapon;
        const slot = this.weaponSlot(name);
        const equipped = slot === 'secondary' ? this.secondaryWeapon === name
          : slot === 'primary' ? this.primaryWeapon === name
            : this.currentWeapon === name;
        button.classList.toggle('equipped', equipped);
        button.classList.remove('unaffordable');
        button.querySelector('.buy-action').textContent = equipped ? '已装备' : '全解锁';
      });
      return;
    }
    $('credits-value').textContent = `$ ${this.credits}`;
    $('buy-credits').textContent = `$ ${this.credits}`;
    $('buy-time').textContent = `${Math.max(0, Math.ceil(this.buyTime))} 秒`;
    document.querySelectorAll('[data-buy-weapon]').forEach((button) => {
      const name = button.dataset.buyWeapon;
      const weapon = this.weaponConfigs[name];
      const owned = !weapon.price;
      const category = button.dataset.category;
      const equipped = category === 'primary' ? this.primaryWeapon === name
        : category === 'secondary' ? this.secondaryWeapon === name
          : this.currentWeapon === name;
      button.classList.toggle('equipped', equipped);
      button.classList.toggle('unaffordable', !owned && this.credits < weapon.price);
      button.querySelector('.buy-action').textContent = owned
        ? (equipped ? '已装备' : '已拥有')
        : (equipped ? '已装备' : `$ ${weapon.price}`);
    });
  }

  resume() {
    this.audio.init();
    this.state = 'resuming';
    this.requestMouseLock();
  }

  quitToMenu() {
    this.state = 'menu';
    this.resetMotionState();
    this.resetScopeView();
    this.resetTouchInput();
    this.resetGamepadInput();
    this.releaseWakeLock();
    this.fallbackLook = false;
    this.mode = 'bomb';
    this.tdm = false;
    this.unlimitedAmmo = false;
    this.player.dead = false;
    this.online = null;
    this.onlineId = null;
    this.onlineRoom = null;
    this.thirdPerson = false;
    if (this.playerAvatar) this.playerAvatar.group.visible = false;
    this.clearHealBuff();
    this.clearRemotePlayers();
    this.setOnlineHUD(false);
    if (this.controls.isLocked) this.controls.unlock();
    $('pause-menu').classList.add('hidden');
    $('buy-menu').classList.add('hidden');
    $('round-end').classList.add('hidden');
    $('respawn-overlay').classList.add('hidden');
    $('crosshair').classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('main-menu').classList.remove('hidden');
    $('friendly-label').textContent = '守序者';
    $('enemy-label').textContent = '失控者';
    this.setMenuCamera();
  }

  disposeObject3D(root) {
    root.traverse((node) => {
      if (!node.isMesh && !node.isSkinnedMesh) return;
      if (node.isSkinnedMesh) node.skeleton?.dispose();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => material?.dispose());
      if (!node.userData.sharedGeometry) node.geometry?.dispose();
    });
  }

  disposeEnemy(enemy) {
    enemy.mixer?.stopAllAction();
    enemy.mixer?.uncacheRoot(enemy.group);
    this.disposeObject3D(enemy.group);
    this.scene.remove(enemy.group);
  }

  // 释放单个远程玩家：模型材质、名字贴图与枪械都是按人克隆的，不释放会在反复进出房间时持续占用显存
  disposeRemotePlayer(remote) {
    if (!remote) return;
    remote.mixer?.stopAllAction();
    remote.mixer?.uncacheRoot(remote.group);
    remote.nameTag?.material?.map?.dispose();
    remote.nameTag?.material?.dispose();
    this.disposeObject3D(remote.group);
    this.scene.remove(remote.group);
  }

  clearRemotePlayers() {
    for (const remote of this.remotePlayers.values()) this.disposeRemotePlayer(remote);
    this.remotePlayers.clear();
  }

  setOnlineHUD(visible, roomId = '', team = 'A') {
    $('online-status').classList.toggle('hidden', !visible);
    if (visible) {
      $('online-room').textContent = roomId;
      $('online-team-label').textContent = team === 'A' ? '守序者' : '失控者';
    }
  }

  playerSpawn(team = 'A') {
    return team === 'B'
      ? { x: (Math.random() - 0.5) * 8, z: -30, yaw: Math.PI }
      : { x: (Math.random() - 0.5) * 8, z: 31, yaw: 0 };
  }

  formatMatchTime(seconds) {
    const value = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  }

  prepareTDM(team = 'A') {
    this.resetWeaponHeat();
    this.resetMotionState();
    this.resetScopeView();
    this.clearRemotePlayers();
    this.enemies.forEach((enemy) => this.disposeEnemy(enemy));
    this.enemies = [];
    this.clearEffects();
    this.resetBulletHoles();
    if (this.bomb) { this.scene.remove(this.bomb); this.bomb = null; }
    if (this.bombLight) {
      this.bombLight.intensity = 0;
      this.bombLight.color.setHex(0xffa04a);
      this.bombLight.distance = 18;
    }
    const spawn = this.playerSpawn(team);
    this.player.team = team;
    this.player.position.set(spawn.x, 0, spawn.z);
    this.player.velocity.set(0, 0, 0);
    this.player.verticalVelocity = 0;
    this.player.health = 100;
    this.player.armor = 50;
    this.player.eyeHeight = 1.65;
    this.player.crouched = false;
    this.player.dead = false;
    this.player.respawnAt = 0;
    this.player.lean = 0;
    this.camera.position.set(spawn.x, 1.65, spawn.z);
    this.camera.rotation.set(0, spawn.yaw, 0);
    this.camera.rotation.z = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.lastShotAt = -10;
    this.stepDistance = 0;
    this.landingDip = 0;
    this.clearHealBuff();
    this.resetPlayerAvatar();
    Object.values(this.weaponConfigs).forEach((weapon) => {
      weapon.ammo = weapon.magSize;
      weapon.reserve = weapon.reserveMax;
    });
    this.resetEquipment();
    this.clearGrenades();
    this.resetPickups();
    this.currentWeapon = this.primaryWeapon;
    this.lastWeapon = null;
    Object.entries(this.weaponModels).forEach(([name, model]) => {
      model.visible = !this.thirdPerson && name === this.currentWeapon;
    });
    this.drawCycle = 1;
    this.poseWeaponDraw(this.currentWeapon);
    this.knifeSpin?.rotation.set(0, 0, 0);
    this.reloading = false;
    this.inspecting = false;
    this.switchFrom = null;
    this.switchStart = -10;
    this.switchDuration = 0;
    this.pendingInspect = false;
    this.meleeSwing = 0;
    this.weaponKick = 0;
    this.bloom = 0;
    this.buyTime = 999;
    this.credits = 9000;
    this.roundTime = this.mode === 'online' ? 480 : 300;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.deaths = 0;
    this.score = { friendly: 0, enemy: 0 };
    this.bombPlanted = false;
    this.plantProgress = 0;
    this.bombBeep = 0;
    this.mouseDown = false;
    $('kill-feed').innerHTML = '';
    $('bomb-status').classList.add('hidden');
    $('objective-banner').classList.add('hidden');
    $('buy-menu').classList.add('hidden');
    $('buy-phase').classList.add('hidden');
    $('interaction').classList.add('hidden');
    $('respawn-overlay').classList.add('hidden');
    $('crosshair').classList.remove('hidden');
    $('friendly-label').textContent = team === 'A' ? '守序者' : '失控者';
    $('enemy-label').textContent = team === 'A' ? '失控者' : '守序者';
    $('round-label').textContent = this.mode === 'online' ? 'ONLINE' : 'BRAWL';
    $('phase-label').textContent = '团队死斗';
    $('round-timer').textContent = this.formatMatchTime(this.roundTime);
    $('round-timer').style.color = '';
    $('enemy-pips').innerHTML = '';
    $('next-round').querySelector('span').textContent = '再来一局';
    $('next-round').querySelector('small').textContent = 'REMATCH';
    this.setOnlineHUD(this.mode === 'online', this.onlineRoom || '', team);
    this.updateScoreUI();
    this.updateWeaponUI();
    this.updateVitalsUI();
    this.updateEconomyUI();
  }

  startBrawl() {
    this.mode = 'brawl';
    this.duelMode = false;
    this.tdm = true;
    this.unlimitedAmmo = true;
    this.online = null;
    this.onlineId = null;
    this.onlineRoom = null;
    this.audio.init();
    this.prepareTDM('A');
    this.createEnemies();
    this.updateEnemyPips();
    this.state = 'starting';
    $('main-menu').classList.add('hidden');
    $('pause-menu').classList.add('hidden');
    $('round-end').classList.add('hidden');
    $('lobby-menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    $('restart-button').classList.remove('hidden');
    this.announce('BRAWL', '无限乱斗', '4 名敌人随机刷新 · 无限复活 · 无限弹药');
    this.requestMouseLock();
  }

  startOnlineMatch({ client, room, selfId, team }) {
    const duel = room.mode === 'duel';
    const opponent = duel ? (room.players || []).find((player) => player.id !== selfId) : null;
    this.mode = 'online';
    this.duelMode = duel;
    this.tdm = true;
    this.unlimitedAmmo = true;
    this.online = client;
    this.onlineId = selfId;
    this.onlineTeam = team;
    this.onlineRoom = room.id;
    this.onlineScoreLimit = room.scoreLimit || (duel ? 10 : 50);
    this.audio.init();
    this.prepareTDM(team);
    this.onlineScore = { ...room.scores };
    this.score = team === 'A'
      ? { friendly: room.scores.A, enemy: room.scores.B }
      : { friendly: room.scores.B, enemy: room.scores.A };
    this.roundTime = room.timeLeft ? room.timeLeft / 1000 : duel ? 300 : 480;
    for (const player of room.players || []) {
      if (player.id === selfId) continue;
      this.createRemotePlayer({
        ...player,
        x: 0,
        z: player.team === 'A' ? 31 : -30,
        yaw: player.team === 'A' ? Math.PI : 0,
      });
    }
    this.setOnlineHUD(true, room.id, team);
    if (duel) {
      $('online-team-label').textContent = '单挑';
      $('friendly-label').textContent = '你';
      $('enemy-label').textContent = opponent?.name || '对手';
      $('round-label').textContent = `DUEL ${room.id}`;
    }
    $('friendly-score').textContent = this.score.friendly;
    $('enemy-score').textContent = this.score.enemy;
    this.state = 'starting';
    $('main-menu').classList.add('hidden');
    $('pause-menu').classList.add('hidden');
    $('round-end').classList.add('hidden');
    $('lobby-menu').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.announce(
      duel ? '1V1 DUEL' : 'ONLINE MATCH',
      duel ? '单挑对决' : '5V5 团队死斗',
      duel ? `先到 ${this.onlineScoreLimit} 杀 · 对手 ${opponent?.name || '未知'}` : '无限复活 · 无限弹药 · 注意队友与敌人颜色',
    );
    this.requestMouseLock();
  }

  returnToLobby() {
    this.state = 'menu';
    this.resetScopeView();
    this.tdm = false;
    this.unlimitedAmmo = false;
    this.duelMode = false;
    this.player.dead = false;
    this.mouseDown = false;
    this.resetTouchInput();
    this.resetGamepadInput();
    this.releaseWakeLock();
    this.fallbackLook = false;
    this.online = null;
    this.onlineId = null;
    this.thirdPerson = false;
    if (this.playerAvatar) this.playerAvatar.group.visible = false;
    this.clearHealBuff();
    this.clearRemotePlayers();
    this.setOnlineHUD(false);
    if (this.controls.isLocked) this.controls.unlock();
    $('hud').classList.add('hidden');
    $('round-end').classList.add('hidden');
    $('pause-menu').classList.add('hidden');
    $('buy-menu').classList.add('hidden');
    $('respawn-overlay').classList.add('hidden');
    $('crosshair').classList.remove('hidden');
    this.resetMotionState();
    this.setMenuCamera();
  }

  updateTDM(dt) {
    this.roundTime = Math.max(0, this.roundTime - dt);
    // 计时器只在显示的秒数变化时写 DOM，避免每帧触发样式重算
    const seconds = Math.max(0, Math.ceil(this.roundTime));
    if (seconds !== this.tdmTimerSeconds) {
      this.tdmTimerSeconds = seconds;
      $('round-timer').textContent = this.formatMatchTime(this.roundTime);
    }
    const timerLow = this.roundTime < 30;
    if (timerLow !== this.tdmTimerLow) {
      this.tdmTimerLow = timerLow;
      $('round-timer').style.color = timerLow ? '#ff5d52' : '';
    }
    if (this.player.dead) {
      const remaining = Math.max(0, this.player.respawnAt - this.time);
      // 只在显示的 0.1 秒变化时写 DOM，避免复活等待期间每帧生成字符串
      const tenths = Math.ceil(remaining * 10);
      if (tenths !== this.respawnTenths) {
        this.respawnTenths = tenths;
        $('respawn-timer').textContent = (tenths / 10).toFixed(1);
      }
      if (this.mode === 'brawl' && remaining <= 0) this.respawnPlayer();
      if (this.mode === 'online' && this.time > this.player.respawnAt + 2.5) this.respawnPlayer();
    }
    if (this.mode === 'brawl') {
      this.updateEnemies(dt);
      if (this.state !== 'playing') return;
      if (this.score.friendly >= 50 || this.score.enemy >= 50 || this.roundTime <= 0) this.endTDMMatch();
    } else {
      this.updateRemotePlayers(dt);
      this.updateOnlineNetwork(dt);
    }
  }

  updateOnlineNetwork(dt) {
    if (!this.online || this.state !== 'playing') return;
    this.stateSendTimer -= dt;
    if (this.stateSendTimer > 0) return;
    this.stateSendTimer = 1 / 15;
    this.online.sendState({
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      yaw: this.camera.rotation.y,
      pitch: this.camera.rotation.x,
      hp: this.player.health,
      alive: !this.player.dead,
      weapon: this.currentWeapon,
      melee: this.meleeSwing > 0.35,
    });
  }

  handleOnlineSnapshot(data) {
    if (this.mode !== 'online' || this.state !== 'playing') return;
    this.onlineScore = data.scores || this.onlineScore;
    this.score = this.onlineTeam === 'A'
      ? { friendly: this.onlineScore.A, enemy: this.onlineScore.B }
      : { friendly: this.onlineScore.B, enemy: this.onlineScore.A };
    this.updateScoreUI();
    this.roundTime = Math.max(0, (data.timeLeft || 0) / 1000);
    const seen = new Set();
    for (const player of data.players || []) {
      if (player.id === this.onlineId) {
        if (player.hp < this.player.health) this.player.health = player.hp;
        if (player.hp <= 0 && !this.player.dead) this.playerDied(null, true);
        this.updateVitalsUI();
        continue;
      }
      seen.add(player.id);
      let remote = this.remotePlayers.get(player.id);
      if (!remote) remote = this.createRemotePlayer(player);
      const wasAlive = remote.alive;
      const previousHp = remote.hp;
      remote.target.set(player.x, player.y || 0, player.z);
      remote.yaw = player.yaw || 0;
      remote.hp = player.hp;
      remote.team = player.team;
      remote.name = player.name;
      remote.weapon = player.weapon;
      remote.melee = !!player.melee;
      if (remote.gun) remote.gun.visible = player.alive && player.weapon !== 'knife';
      if (remote.knife) remote.knife.visible = player.alive && player.weapon === 'knife';
      if (wasAlive && !player.alive) {
        remote.alive = false;
        remote.deathAt = this.time;
        remote.deathPlayed = false;
      } else if (!wasAlive && player.alive) {
        remote.alive = true;
        remote.deathPlayed = false;
        remote.oneShotUntil = 0;
        remote.state = '';
        remote.group.visible = true;
      } else {
        remote.alive = player.alive;
      }
      if (player.alive && player.hp < previousHp && player.hp > 0) remote.hitAt = this.time;
    }
    for (const id of [...this.remotePlayers.keys()]) {
      if (seen.has(id)) continue;
      this.disposeRemotePlayer(this.remotePlayers.get(id));
      this.remotePlayers.delete(id);
    }
  }

  handleOnlineKill(data) {
    if (this.mode !== 'online') return;
    if (data.scores) {
      this.onlineScore = data.scores;
      this.score = this.onlineTeam === 'A'
        ? { friendly: data.scores.A, enemy: data.scores.B }
        : { friendly: data.scores.B, enemy: data.scores.A };
      this.updateScoreUI();
    }
    this.addOnlineKillFeed(data.killerName, data.victimName, data.headshot, data.weapon);
    if (data.killer === this.onlineId) this.audio.hit(true);
    if (data.victim === this.onlineId && !this.player.dead) this.playerDied(null, true, data.killerName);
  }

  handleOnlineDamaged(data) {
    if (this.mode !== 'online' || this.player.dead) return;
    this.player.health = Math.max(0, data.hp);
    this.updateVitalsUI();
    $('damage-vignette').style.opacity = '0.7';
    setTimeout(() => { $('damage-vignette').style.opacity = this.player.health < 30 ? '0.28' : '0'; }, 140);
    if (this.player.health <= 0) this.playerDied(null, true);
  }

  handleOnlineHitConfirm(data) {
    if (this.mode !== 'online') return;
    this.showHitmarker(!!data.killed);
    this.audio.hit(!!data.killed);
    if (data.killed) this.kills++;
  }

  handleOnlineRespawn(data) {
    if (this.mode !== 'online') return;
    if (data.id === this.onlineId) {
      this.respawnPlayer(data.position);
      return;
    }
    const remote = this.remotePlayers.get(data.id);
    if (remote) {
      remote.alive = true;
      remote.hp = 100;
      remote.group.visible = true;
      if (data.position) remote.target.set(data.position.x, data.position.y || 0, data.position.z);
    }
  }

  handleOnlineMatchEnd(data) {
    if (this.mode !== 'online') return;
    this.endTDMMatch(data.winner === 'draw' ? 'draw' : data.winner === this.onlineTeam);
  }

  addOnlineKillFeed(killerName, victimName, headshot, weaponKey) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    const killer = document.createElement('span');
    killer.textContent = killerName || '干员';
    item.appendChild(killer);
    const weapon = document.createElement('span');
    weapon.className = 'kill-weapon';
    weapon.textContent = this.weaponConfigs[weaponKey]?.name || weaponKey || '未知武器';
    item.appendChild(weapon);
    const mark = document.createElement('span');
    mark.className = headshot ? 'headshot' : '';
    mark.textContent = headshot ? ' ◇ 爆头 ' : ' — ';
    item.appendChild(mark);
    const victim = document.createElement('span');
    victim.className = 'enemy-name';
    victim.textContent = victimName || '干员';
    item.appendChild(victim);
    $('kill-feed').prepend(item);
    while ($('kill-feed').children.length > 5) $('kill-feed').lastChild.remove();
    setTimeout(() => item.remove(), 5000);
  }

  createRemoteNameTag(name, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    const drawPanel = (fill, stroke) => {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(4, 10, 312, 52, 6);
      else ctx.rect(4, 10, 312, 52);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    };
    drawPanel('rgba(6, 11, 12, .74)', color);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(28, 36, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 27;
    do {
      ctx.font = `600 ${size}px "Microsoft YaHei", sans-serif`;
      if (ctx.measureText(name).width <= 226) break;
      size--;
    } while (size > 14);
    ctx.fillStyle = '#eef7ef';
    ctx.fillText(name, 178, 36);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fillRect(12, 58, 296, 2);
    ctx.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.55, 0.35, 1);
    sprite.raycast = () => {};
    return sprite;
  }

  createRemoteGun(color) {
    const gun = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x171d1e, roughness: 0.4, metalness: 0.74 });
    const accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.42, metalness: 0.35 });
    const receiver = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.078, 0.4, 2, 0.012), metal);
    receiver.position.z = 0.15;
    const handguard = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.05, 0.22, 2, 0.01), metal);
    handguard.position.set(0, 0.004, 0.35);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.2), metal);
    barrel.position.set(0, 0.018, 0.5);
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.13, 0.06), accent);
    magazine.position.set(0, -0.095, 0.12);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.16), metal);
    stock.position.set(0, -0.012, -0.08);
    const optic = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.042, 0.11, 2, 0.008), metal);
    optic.position.set(0, 0.075, 0.14);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.01), accent);
    lens.position.set(0, 0.075, 0.2);
    [receiver, handguard, barrel, magazine, stock, optic, lens].forEach((part) => {
      part.castShadow = true;
      gun.add(part);
    });
    return gun;
  }

  createAvatarKnife() {
    const knife = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xc6d4d0, roughness: 0.16, metalness: 0.95 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x202826, roughness: 0.8, metalness: 0.2 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.055, 0.32), steel);
    blade.position.set(0, 0.015, 0.24);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.045, 0.12), grip);
    handle.position.set(0, 0, -0.03);
    [blade, handle].forEach((part) => {
      part.castShadow = true;
      knife.add(part);
    });
    knife.visible = false;
    return knife;
  }

  characterPalette(kind) {
    const palettes = {
      player: { main: 0x46524a, joints: 0x242e28, armor: 0x39453f, accent: 0xc8ff52, glow: 0xc8ff52 },
      friendly: { main: 0x424d3b, joints: 0x273522, armor: 0x3c4835, accent: 0x9ece42, glow: 0xc8ff52 },
      hostile: { main: 0x4a302b, joints: 0x35110b, armor: 0x442b27, accent: 0xff5d52, glow: 0xff5d52 },
      ai: { main: 0x402924, joints: 0x3d0f08, armor: 0x3a2825, accent: 0xff4a35, glow: 0xff6a50 },
      ai2: { main: 0x382e29, joints: 0x36120b, armor: 0x342a26, accent: 0xff6a4a, glow: 0xff7a5c },
    };
    return palettes[kind] || palettes.player;
  }

  addMergedGear(bone, specs, material, name = 'gear') {
    if (!bone || !specs.length || !material) return null;
    const sources = specs.map((spec) => {
      let geometry = spec.geometry;
      // 圆角盒为非索引几何，统一转为非索引后合并，避免 mergeGeometries 返回 null
      if (geometry.index) {
        const nonIndexed = geometry.toNonIndexed();
        geometry.dispose();
        geometry = nonIndexed;
      }
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...(spec.position || [0, 0, 0])),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.rotation || [0, 0, 0]))),
        new THREE.Vector3(...(spec.scale || [1, 1, 1])),
      );
      geometry.applyMatrix4(matrix);
      return geometry;
    });
    const merged = mergeGeometries(sources, false);
    sources.forEach((geometry) => geometry.dispose());
    if (!merged) return null;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.raycast = () => {};
    bone.add(mesh);
    return mesh;
  }

  buildCharacterGear(bones, palette, form = 'male') {
    const armor = new THREE.MeshStandardMaterial({
      color: palette.armor,
      roughness: 0.46,
      metalness: 0.52,
      envMapIntensity: 1,
      bumpMap: this.fabricTexture,
      bumpScale: 0.0016,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 0.8,
      roughness: 0.34,
      metalness: 0.42,
    });
    const visor = new THREE.MeshStandardMaterial({
      color: palette.glow,
      emissive: palette.glow,
      emissiveIntensity: 2.6,
      roughness: 0.12,
      metalness: 0.72,
    });
    const head = bones.head;
    if (head) {
      this.addMergedGear(head, [
        { geometry: new RoundedBoxGeometry(0.29, 0.18, 0.3, 3, 0.07), position: [0, 0.125, -0.012] },
        { geometry: new THREE.BoxGeometry(0.305, 0.032, 0.305), position: [0, 0.045, 0] },
        { geometry: new THREE.CylinderGeometry(0.055, 0.06, 0.032, 12), position: [-0.152, 0.06, 0], rotation: [0, 0, Math.PI / 2] },
        { geometry: new THREE.CylinderGeometry(0.055, 0.06, 0.032, 12), position: [0.152, 0.06, 0], rotation: [0, 0, Math.PI / 2] },
        { geometry: new RoundedBoxGeometry(0.23, 0.075, 0.065, 2, 0.02), position: [0, 0.07, 0.112] },
        { geometry: new THREE.BoxGeometry(0.2, 0.08, 0.06), position: [0, 0.02, -0.136], rotation: [-0.28, 0, 0] },
      ], armor, 'characterHelmet');
      this.addMergedGear(head, [
        { geometry: new RoundedBoxGeometry(0.185, 0.038, 0.02, 2, 0.008), position: [0, 0.07, 0.152] },
        { geometry: new THREE.BoxGeometry(0.014, 0.14, 0.014), position: [0.158, 0.185, -0.02] },
        { geometry: new THREE.SphereGeometry(0.021, 8, 6), position: [0.158, 0.258, -0.02] },
      ], visor, 'characterVisor');
    }
    const spine = bones.spine;
    if (spine) {
      const chestWidth = form === 'female' ? 0.315 : 0.35;
      const chestDepth = form === 'female' ? 0.17 : 0.19;
      const pack = form === 'female'
        ? { geometry: new RoundedBoxGeometry(0.2, 0.26, 0.1, 3, 0.034), position: [0, 0.035, -0.112] }
        : { geometry: new RoundedBoxGeometry(0.28, 0.32, 0.15, 3, 0.04), position: [0, 0.02, -0.145] };
      this.addMergedGear(spine, [
        { geometry: new RoundedBoxGeometry(chestWidth, 0.27, chestDepth, 3, 0.055), position: [0, 0.075, 0.03] },
        pack,
        { geometry: new RoundedBoxGeometry(0.085, 0.09, 0.05, 2, 0.018), position: [-0.095, -0.045, 0.14] },
        { geometry: new RoundedBoxGeometry(0.085, 0.09, 0.05, 2, 0.018), position: [0.095, -0.045, 0.14] },
        { geometry: new THREE.CylinderGeometry(0.105, 0.125, 0.07, 14), position: [0, 0.17, 0] },
        { geometry: new THREE.BoxGeometry(0.05, 0.2, 0.022), position: [-0.1, 0.12, 0.13] },
        { geometry: new THREE.BoxGeometry(0.05, 0.2, 0.022), position: [0.1, 0.12, 0.13] },
      ], armor, 'characterArmor');
      this.addMergedGear(spine, [
        { geometry: new RoundedBoxGeometry(0.15, 0.03, 0.02, 2, 0.006), position: [0, 0.115, 0.13] },
        { geometry: new THREE.BoxGeometry(form === 'female' ? 0.15 : 0.2, 0.025, 0.02), position: [0, 0.12, form === 'female' ? -0.168 : -0.228] },
      ], accent, 'characterAccent');
    }
    for (const key of ['upperarm_l', 'upperarm_r']) {
      const bone = bones[key];
      if (!bone) continue;
      const pad = new THREE.SphereGeometry(0.12, 14, 10);
      pad.scale(form === 'female' ? 1.03 : 1.24, form === 'female' ? 0.62 : 0.72, form === 'female' ? 0.96 : 1.12);
      this.addMergedGear(bone, [{ geometry: pad }], armor, 'characterPauldron');
    }
    for (const key of ['calf_l', 'calf_r']) {
      const bone = bones[key];
      if (!bone) continue;
      this.addMergedGear(bone, [
        { geometry: new RoundedBoxGeometry(0.15, 0.12, 0.16, 2, 0.04), position: [0, 0.01, 0.03] },
        { geometry: new RoundedBoxGeometry(0.125, 0.3, 0.1, 2, 0.03), position: [0, 0.18, 0.055] },
      ], armor, 'characterLegArmor');
    }
    if (form === 'female') {
      if (head) {
        const hair = new THREE.MeshStandardMaterial({
          color: palette.joints,
          roughness: 0.64,
          metalness: 0.18,
          envMapIntensity: 0.8,
        });
        this.addMergedGear(head, [
          { geometry: new THREE.SphereGeometry(0.06, 10, 8), position: [0, 0.19, -0.152], scale: [0.95, 1.05, 1] },
          { geometry: new THREE.SphereGeometry(0.057, 10, 8), position: [0, 0.115, -0.228], scale: [0.9, 1.45, 0.9] },
          { geometry: new THREE.SphereGeometry(0.048, 10, 8), position: [0, -0.005, -0.268], scale: [0.85, 1.9, 0.85] },
          { geometry: new THREE.SphereGeometry(0.036, 8, 6), position: [0, -0.145, -0.262], scale: [0.8, 1.7, 0.8] },
          { geometry: new THREE.SphereGeometry(0.022, 8, 6), position: [0, -0.24, -0.245], scale: [0.8, 1.3, 0.8] },
        ], hair, 'characterPonytail');
        this.addMergedGear(head, [
          { geometry: new THREE.CylinderGeometry(0.052, 0.058, 0.036, 10), position: [0, 0.203, -0.158], rotation: [1.25, 0, 0] },
        ], accent, 'characterHairTie');
      }
      if (spine) {
        this.addMergedGear(spine, [
          { geometry: new RoundedBoxGeometry(0.08, 0.18, 0.032, 2, 0.012), position: [-0.112, -0.135, 0.075], rotation: [0, 0, 0.22] },
          { geometry: new RoundedBoxGeometry(0.08, 0.18, 0.032, 2, 0.012), position: [0.112, -0.135, 0.075], rotation: [0, 0, -0.22] },
        ], armor, 'characterHipPlate');
      }
    }
  }

  buildPlayerAvatar() {
    if (this.playerAvatar) return this.playerAvatar;
    if (!this.character.ready) return null;
    const group = new THREE.Group();
    const avatar = {
      group,
      mixer: null,
      actions: {},
      state: '',
      current: null,
      oneShotUntil: 0,
      wasGrounded: true,
      gun: null,
      knife: null,
      tilt: null,
      bones: {},
      plantBlend: 0,
    };
    const model = cloneSkeleton(this.character.template);
    const palette = this.characterPalette('player');
    model.traverse((node) => {
      if (node.isMesh || node.isSkinnedMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.userData.sharedGeometry = true;
        const tint = (material) => {
          const next = material.clone();
          const joints = /joint/i.test(material.name);
          next.color.setHex(joints ? palette.joints : palette.main);
          next.roughness = joints ? 0.52 : 0.86;
          next.metalness = joints ? 0.38 : 0.05;
          next.envMapIntensity = 0.8;
          next.bumpMap = this.fabricTexture;
          next.bumpScale = joints ? 0.0012 : 0.0026;
          if (!joints) next.map = this.camoTexture;
          if (joints) {
            next.emissive = new THREE.Color(palette.accent).multiplyScalar(0.14);
            next.emissiveIntensity = 0.35;
          }
          return next;
        };
        node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
        node.raycast = () => {};
      }
      if (node.isBone && node.name === 'hand_r') avatar.handBone = node;
      if (node.isBone && node.name === 'Head') avatar.headBone = node;
      if (node.isBone && ['spine_03', 'upperarm_l', 'upperarm_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r'].includes(node.name)) {
        avatar.bones[node.name] = node;
      }
    });
    const tilt = new THREE.Group();
    tilt.add(model);
    group.add(tilt);
    avatar.tilt = tilt;
    this.buildCharacterGear({
      head: avatar.headBone,
      spine: avatar.bones.spine_03,
      upperarm_l: avatar.bones.upperarm_l,
      upperarm_r: avatar.bones.upperarm_r,
      calf_l: avatar.bones.calf_l,
      calf_r: avatar.bones.calf_r,
    }, palette, this.operativeForm);
    if (avatar.handBone) {
      avatar.gun = this.createRemoteGun(0xc8ff52);
      avatar.gunBase = avatar.gun.rotation.clone();
      avatar.handBone.add(avatar.gun);
      avatar.knife = this.createAvatarKnife();
      avatar.handBone.add(avatar.knife);
    }
    const mixer = new THREE.AnimationMixer(model);
    avatar.mixer = mixer;
    const make = (name, once = false) => {
      const clip = this.formClip(name, this.operativeForm);
      if (!clip) return null;
      const action = mixer.clipAction(clip);
      if (once) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      return action;
    };
    avatar.actions = {
      idle: make('Idle_No_Loop') || make('Zombie_Idle_Loop'),
      walk: make('Zombie_Walk_Fwd_Loop') || make('Walk_Carry_Loop'),
      jump: make('NinjaJump_Idle_Loop'),
      start: make('NinjaJump_Start', true),
      land: make('NinjaJump_Land', true),
      melee: make('Sword_Regular_A', true),
      stab: make('Melee_Hook', true),
      throw: make('OverhandThrow', true),
      hit: make('Hit_Knockback', true),
      death: make('LayToIdle', true),
    };
    if (avatar.actions.death) {
      avatar.actions.death.setLoop(THREE.LoopOnce, 1);
      avatar.actions.death.clampWhenFinished = true;
    }
    avatar.state = 'idle';
    avatar.current = avatar.actions.idle;
    avatar.current?.play();
    group.rotation.y = this.camera.rotation.y + Math.PI;
    group.visible = this.thirdPerson;
    this.scene.add(group);
    this.playerAvatar = avatar;
    return avatar;
  }

  setAvatarState(avatar, state, fade = 0.2) {
    if (!avatar || avatar.state === state) return;
    const next = avatar.actions[state];
    if (!next) return;
    avatar.current?.fadeOut(fade);
    avatar.state = state;
    avatar.current = next;
    next.reset();
    if (state === 'death') {
      next.time = next.getClip().duration;
      next.timeScale = -1;
      next.fadeIn(0.1).play();
    } else {
      next.timeScale = state === 'land' ? 1.6 : 1;
      next.fadeIn(fade).play();
    }
  }

  updatePlayerAvatar(dt) {
    if (!this.thirdPerson) {
      if (this.playerAvatar) this.playerAvatar.group.visible = false;
      return;
    }
    const avatar = this.buildPlayerAvatar();
    if (!avatar) return;
    avatar.group.visible = true;
    avatar.group.position.copy(this.player.position);
    avatar.plantBlend = lerp(avatar.plantBlend || 0, this.plantingActive && !this.player.dead ? 1 : 0, 1 - Math.exp(-dt * 7));
    const planting = this.plantingActive && !this.player.dead;
    const throwing = this.grenadeThrow > 0.1;
    const aiming = this.mouseDown || this.gamepad.fire || this.time - this.lastShotAt < 0.6 || this.scoped;
    const moving = this.player.speed > 0.4;
    const cameraYaw = this.camera.rotation.y + Math.PI;
    const forwardX = -Math.sin(this.camera.rotation.y);
    const forwardZ = -Math.cos(this.camera.rotation.y);
    const forwardDot = this.player.velocity.x * forwardX + this.player.velocity.z * forwardZ;
    const backpedaling = forwardDot < -0.35 * this.player.speed;
    const targetYaw = moving && !aiming && !backpedaling
      ? Math.atan2(this.player.velocity.x, this.player.velocity.z)
      : cameraYaw;
    avatar.group.rotation.y = this.lerpAngle(avatar.group.rotation.y, targetYaw, 1 - Math.exp(-dt * (moving ? 12 : 8)));
    if (avatar.gun) avatar.gun.visible = this.currentWeapon !== 'knife' && !this.player.dead && !throwing && !planting;
    if (avatar.knife) avatar.knife.visible = this.currentWeapon === 'knife' && !this.player.dead && !throwing && !planting;
    if (avatar.gun && avatar.gunBase) {
      avatar.gun.rotation.x = avatar.gunBase.x + this.gunKick.rot * 2.2;
      avatar.gun.rotation.y = avatar.gunBase.y;
      avatar.gun.rotation.z = avatar.gunBase.z + this.gunKick.roll * 1.6;
    }
    const now = this.time;
    if (this.player.dead) {
      this.setAvatarState(avatar, 'death', 0.1);
      avatar.oneShotUntil = Infinity;
    } else {
      if (avatar.oneShotUntil === Infinity) {
        avatar.oneShotUntil = 0;
        avatar.state = '';
      }
      if (now >= avatar.oneShotUntil) {
        if (this.grenadeThrow > 0.5) {
          this.setAvatarState(avatar, 'throw', 0.07);
          if (avatar.actions.throw) avatar.actions.throw.timeScale = 1.3;
          avatar.oneShotUntil = now + 0.55;
        } else if (this.meleeSwing > 0.55) {
          const meleeState = this.meleeStab ? 'stab' : 'melee';
          this.setAvatarState(avatar, meleeState, 0.08);
          if (avatar.actions[meleeState]) avatar.actions[meleeState].timeScale = this.meleeStab ? 0.95 : 1.15;
          avatar.oneShotUntil = now + (this.meleeStab ? 0.55 : 0.45);
        } else if (!this.player.grounded) {
          this.setAvatarState(avatar, 'jump', 0.18);
          avatar.wasGrounded = false;
        } else if (avatar.wasGrounded === false) {
          this.setAvatarState(avatar, 'land', 0.1);
          avatar.oneShotUntil = now + 0.75;
          avatar.wasGrounded = true;
        } else if (planting) {
          this.setAvatarState(avatar, 'idle', 0.18);
        } else if (this.player.speed > 0.3) {
          this.setAvatarState(avatar, 'walk', 0.2);
          if (avatar.actions.walk) {
            const yaw = avatar.group.rotation.y;
            const along = this.player.velocity.x * Math.sin(yaw) + this.player.velocity.z * Math.cos(yaw);
            const direction = along < -0.25 ? -1 : 1;
            const crouchScale = this.player.crouched ? 0.75 : 1;
            avatar.actions.walk.timeScale = clamp(0.75 + this.player.speed * 0.09, 0.8, 1.5) * direction * crouchScale;
          }
        } else {
          this.setAvatarState(avatar, 'idle', 0.24);
        }
      }
    }
    if (avatar.tilt) {
      const strafe = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
      const speedFactor = clamp(this.player.speed / 5.7, 0, 1);
      const runLean = clamp(forwardDot / 5.7, -1, 1);
      const crouch = clamp((1.65 - this.player.eyeHeight) / 0.53, 0, 1);
      const plant = avatar.plantBlend || 0;
      const leanTarget = this.player.dead ? 0 : -strafe * 0.055 * speedFactor;
      const pitchTarget = this.player.dead ? 0 : (this.player.grounded ? runLean * 0.035 : -0.025) + plant * 0.16;
      avatar.tilt.rotation.z = lerp(avatar.tilt.rotation.z, leanTarget, 1 - Math.exp(-dt * 8));
      avatar.tilt.rotation.x = lerp(avatar.tilt.rotation.x, pitchTarget, 1 - Math.exp(-dt * 7));
      avatar.tilt.position.y = lerp(avatar.tilt.position.y, this.player.dead ? 0 : -this.landingDip * 0.1 - crouch * 0.2 - plant * 0.22, 1 - Math.exp(-dt * 12));
    }
    avatar.mixer.update(dt);
    if (avatar.bones && !this.player.dead) {
      const crouch = clamp((1.65 - this.player.eyeHeight) / 0.53, 0, 1);
      const plant = avatar.plantBlend || 0;
      const bend = Math.max(crouch, plant);
      if (bend > 0.001) {
        const thigh = -0.62 * bend - 0.18 * plant;
        const calf = 1.24 * bend + 0.18 * plant;
        const foot = -0.64 * bend;
        for (const side of 'lr') {
          const thighBone = avatar.bones[`thigh_${side}`];
          const calfBone = avatar.bones[`calf_${side}`];
          const footBone = avatar.bones[`foot_${side}`];
          if (thighBone) thighBone.rotation.x += thigh;
          if (calfBone) calfBone.rotation.x += calf;
          if (footBone) footBone.rotation.x += foot;
        }
      }
    }
  }

  resetPlayerAvatar() {
    if (!this.playerAvatar) return;
    if (this.playerAvatar.tilt) {
      this.playerAvatar.tilt.rotation.set(0, 0, 0);
      this.playerAvatar.tilt.position.set(0, 0, 0);
    }
    this.playerAvatar.oneShotUntil = 0;
    this.playerAvatar.state = '';
    this.playerAvatar.wasGrounded = true;
    this.playerAvatar.plantBlend = 0;
    this.setAvatarState(this.playerAvatar, 'idle', 0.2);
    this.playerAvatar.group.visible = this.thirdPerson;
  }

  positionThirdPersonCamera() {
    const crouch = clamp((1.65 - this.player.eyeHeight) / 0.53, 0, 1);
    const head = this.tpHead.copy(this.player.position);
    head.y += lerp(1.5, 1.02, crouch);
    const direction = this.tpDirection;
    this.camera.getWorldDirection(direction);
    const right = this.tpRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const desired = this.tpDesired.copy(head).addScaledVector(direction, -2.6).addScaledVector(right, 0.42);
    desired.y = Math.max(0.35, desired.y);
    const back = this.tpBack.copy(desired).sub(head);
    const length = back.length();
    back.normalize();
    this.raycaster.set(head, back);
    this.raycaster.far = length;
    const hit = this.raycaster.intersectObjects(this.solids, false)[0];
    if (hit) desired.copy(head).addScaledVector(back, Math.max(0.45, hit.distance - 0.2));
    this.camera.position.copy(desired);
  }

  setScoped(on) {
    if (on) {
      const weapon = this.weaponConfigs[this.currentWeapon];
      if (!weapon?.scoped || this.state !== 'playing' || this.player.dead || this.reloading || this.inspecting || this.plantingActive) return;
      if (this.scoped) return;
      if (this.thirdPerson) {
        this.thirdPerson = false;
        if (this.playerAvatar) this.playerAvatar.group.visible = false;
      }
      this.scoped = true;
      this.updatePointerSpeed();
      this.scopeSway.set(0, 0);
      $('scope-overlay').classList.add('active');
      $('crosshair').classList.add('hidden');
      Object.values(this.weaponModels).forEach((model) => { model.visible = false; });
      this.muzzleFlash.visible = false;
      this.muzzleLight.intensity = 0;
      this.updateWeaponUI();
      this.audio.tone(680, 0.06, 0.035, 'sine', 520);
      this.syncTouchButtons();
    } else {
      if (!this.scoped) return;
      this.clearScope();
      this.audio.tone(320, 0.05, 0.025, 'sine', 460);
    }
  }

  clearScope() {
    if (!this.scoped) return;
    this.scoped = false;
    this.updatePointerSpeed();
    if (this.scopeSway.lengthSq() > 0) {
      this.camera.rotation.x -= this.scopeSway.y;
      this.camera.rotation.y -= this.scopeSway.x;
      this.scopeSway.set(0, 0);
    }
    $('scope-overlay').classList.remove('active');
    this.syncTouchButtons();
    if (!this.player.dead) {
      $('crosshair').classList.remove('hidden');
      if (!this.thirdPerson) {
        const model = this.weaponModels[this.currentWeapon];
        if (model) model.visible = true;
      }
    }
    this.updateWeaponUI();
  }

  updateScope(dt) {
    const weapon = this.weaponConfigs[this.currentWeapon];
    const target = this.scoped && weapon.scoped ? weapon.scopeFov : this.baseFov;
    if (Math.abs(this.camera.fov - target) > 0.01) {
      this.camera.fov = lerp(this.camera.fov, target, 1 - Math.exp(-dt * 16));
      this.camera.updateProjectionMatrix();
    }
  }

  resetScopeView() {
    this.clearScope();
    this.scopeSway.set(0, 0);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  toggleThirdPerson() {
    if (this.state !== 'playing' || this.plantingActive) return;
    if (this.scoped) this.setScoped(false);
    this.thirdPerson = !this.thirdPerson;
    if (this.thirdPerson) this.buildPlayerAvatar();
    if (this.playerAvatar) this.playerAvatar.group.visible = this.thirdPerson;
    Object.entries(this.weaponModels).forEach(([id, model]) => {
      model.visible = !this.thirdPerson && id === this.currentWeapon;
    });
    this.muzzleFlash.visible = false;
    this.muzzleLight.intensity = 0;
    this.announce('CAMERA', this.thirdPerson ? '第三人称视角' : '第一人称视角', this.thirdPerson ? 'V 切回第一人称' : 'V 切换第三人称');
  }

  createRemotePlayer(info) {
    if (this.remotePlayers.has(info.id)) return this.remotePlayers.get(info.id);
    const friendly = info.team === this.onlineTeam;
    const group = new THREE.Group();
    const remote = {
      id: info.id,
      name: info.name || '干员',
      team: info.team || 'B',
      group,
      target: new THREE.Vector3(info.x || 0, info.y || 0, info.z || 0),
      yaw: info.yaw || 0,
      hp: info.hp ?? 100,
      alive: info.alive !== false,
      state: '',
      current: null,
      mixer: null,
      actions: {},
      nameTag: null,
      oneShotUntil: 0,
      wasGrounded: true,
      deathPlayed: false,
      deathAt: 0,
      hitAt: 0,
      melee: false,
      weapon: info.weapon || 'rifle',
      form: info.form === 'female' ? 'female' : 'male',
      gun: null,
      knife: null,
    };
    group.position.copy(remote.target);
    group.rotation.y = remote.yaw + Math.PI;
    group.userData.remote = remote;
    const tag = this.createRemoteNameTag(remote.name, friendly ? '#c8ff52' : '#ff6a50');
    tag.position.y = 2.3;
    remote.nameTag = tag;

    this.attachRemoteCharacter(remote, friendly);
    group.add(tag);
    group.visible = remote.alive;
    this.scene.add(group);
    this.remotePlayers.set(remote.id, remote);
    return remote;
  }

  attachRemoteCharacter(remote, friendly) {
    const group = remote.group;
    const form = remote.form === 'female' ? 'female' : 'male';
    const teamColor = friendly ? 0x9ece42 : 0xc44735;
    const glowColor = friendly ? 0xc8ff52 : 0xff5d52;
    if (this.character.ready) {
      remote.boxModel = false;
      const model = cloneSkeleton(this.character.template);
      const palette = this.characterPalette(friendly ? 'friendly' : 'hostile');
      model.traverse((node) => {
        if (node.isMesh || node.isSkinnedMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
          node.userData.sharedGeometry = true;
          const tint = (material) => {
            const next = material.clone();
            const joints = /joint/i.test(material.name);
            next.color.setHex(joints ? palette.joints : palette.main);
            next.roughness = joints ? 0.52 : 0.86;
            next.metalness = joints ? 0.38 : 0.05;
            next.envMapIntensity = 0.8;
            next.bumpMap = this.fabricTexture;
            next.bumpScale = joints ? 0.0012 : 0.0026;
            if (!joints) next.map = this.camoTexture;
            if (joints) {
              next.emissive = new THREE.Color(palette.accent).multiplyScalar(0.14);
              next.emissiveIntensity = 0.35;
            }
            return next;
          };
          node.material = Array.isArray(node.material) ? node.material.map(tint) : tint(node.material);
          node.userData.remoteId = remote.id;
        }
        if (node.isBone && node.name === 'hand_r') remote.handBone = node;
        if (node.isBone && node.name === 'Head') remote.headBone = node;
        if (node.isBone && ['spine_03', 'upperarm_l', 'upperarm_r', 'calf_l', 'calf_r'].includes(node.name)) {
          remote.bones ||= {};
          remote.bones[node.name] = node;
        }
      });
      group.add(model);
      this.buildCharacterGear({
        head: remote.headBone,
        spine: remote.bones?.spine_03,
        upperarm_l: remote.bones?.upperarm_l,
        upperarm_r: remote.bones?.upperarm_r,
        calf_l: remote.bones?.calf_l,
        calf_r: remote.bones?.calf_r,
      }, palette, form);
      if (remote.handBone) {
        remote.gun = this.createRemoteGun(palette.accent);
        remote.handBone.add(remote.gun);
        remote.knife = this.createAvatarKnife();
        remote.handBone.add(remote.knife);
      }
      const mixer = new THREE.AnimationMixer(model);
      remote.mixer = mixer;
      const make = (name, once = false) => {
        const clip = this.formClip(name, form);
        if (!clip) return null;
        const action = mixer.clipAction(clip);
        if (once) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
        return action;
      };
      remote.actions = {
        idle: make('Idle_No_Loop') || make('Zombie_Idle_Loop'),
        walk: make('Zombie_Walk_Fwd_Loop'),
        jump: make('NinjaJump_Idle_Loop'),
        land: make('NinjaJump_Land', true),
        hit: make('Hit_Knockback', true),
        melee: make('Sword_Regular_A', true),
        death: make('LayToIdle', true),
      };
      if (remote.actions.walk) remote.actions.walk.timeScale = 1;
      remote.state = 'idle';
      remote.current = remote.actions.idle;
      remote.current?.play();
    } else {
      remote.boxModel = true;
      remote.fallbackParts = [];
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.86, 0.38), new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.75, metalness: 0.2 }));
      body.position.y = 1.22;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0x1c2422, roughness: 0.8 }));
      head.position.y = 1.86;
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.05), new THREE.MeshStandardMaterial({ color: glowColor, emissive: glowColor, emissiveIntensity: 1.8 }));
      visor.position.set(0, 1.87, 0.2);
      [body, head, visor].forEach((part) => {
        part.castShadow = true;
        part.userData.remoteId = remote.id;
        group.add(part);
        remote.fallbackParts.push(part);
      });
    }
  }

  upgradeBoxRemotes() {
    if (!this.character.ready) return;
    for (const remote of this.remotePlayers.values()) {
      if (!remote.boxModel) continue;
      for (const part of remote.fallbackParts || []) {
        remote.group.remove(part);
        this.disposeObject3D(part);
      }
      remote.fallbackParts = [];
      remote.boxModel = false;
      remote.mixer = null;
      remote.actions = {};
      remote.state = '';
      remote.current = null;
      remote.headBone = null;
      remote.handBone = null;
      this.attachRemoteCharacter(remote, remote.team === this.onlineTeam);
    }
  }

  updateRemotePlayers(dt) {
    for (const remote of this.remotePlayers.values()) {
      if (!remote.alive) {
        if (!remote.deathPlayed) {
          remote.deathPlayed = true;
          remote.deathAt = this.time;
          remote.group.visible = true;
          if (remote.gun) remote.gun.visible = false;
          if (remote.knife) remote.knife.visible = false;
          this.setAvatarState(remote, 'death', 0.1);
        }
        remote.mixer?.update(dt);
        if (this.time > remote.deathAt + 1.7) remote.group.visible = false;
        continue;
      }
      remote.group.visible = true;
      const dx = remote.target.x - remote.group.position.x;
      const dz = remote.target.z - remote.group.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > 6) {
        remote.group.position.copy(remote.target);
        remote.group.rotation.y = remote.yaw + Math.PI;
      } else {
        remote.group.position.lerp(remote.target, 1 - Math.exp(-dt * 12));
        const desired = remote.yaw + Math.PI;
        const delta = Math.atan2(Math.sin(desired - remote.group.rotation.y), Math.cos(desired - remote.group.rotation.y));
        remote.group.rotation.y += delta * (1 - Math.exp(-dt * 12));
      }
      const now = this.time;
      if (remote.hitAt && now - remote.hitAt < 0.7) {
        this.setAvatarState(remote, 'hit', 0.08);
        remote.oneShotUntil = now + 0.7;
        remote.hitAt = 0;
      } else if (now >= remote.oneShotUntil) {
        if (remote.melee) {
          this.setAvatarState(remote, 'melee', 0.08);
          if (remote.actions.melee) remote.actions.melee.timeScale = 1.15;
          remote.oneShotUntil = now + 0.45;
        } else if (remote.target.y > 0.18) {
          this.setAvatarState(remote, 'jump', 0.18);
          remote.wasGrounded = false;
        } else if (remote.wasGrounded === false) {
          this.setAvatarState(remote, 'land', 0.1);
          remote.oneShotUntil = now + 0.75;
          remote.wasGrounded = true;
        } else if (distance > 0.06) {
          this.setAvatarState(remote, 'walk', 0.2);
          if (remote.actions.walk) remote.actions.walk.timeScale = 1;
        } else {
          this.setAvatarState(remote, 'idle', 0.24);
        }
      }
      remote.mixer?.update(dt);
    }
  }

  playerDied(source, instant = false, killerName = '') {
    if (this.player.dead) return;
    this.resetMotionState();
    this.player.dead = true;
    this.jumpBuffer = 0;
    this.coyoteTimer = 0;
    this.deathAt = this.time;
    this.deathRoll = (Math.random() < 0.5 ? -1 : 1) * (0.22 + Math.random() * 0.14);
    this.resetScopeView();
    this.player.health = 0;
    this.player.velocity.set(0, 0, 0);
    this.player.respawnAt = this.time + 3;
    this.deaths++;
    this.clearHealBuff();
    if (this.mode === 'brawl') {
      this.score.enemy++;
      this.updateScoreUI();
      if (this.score.enemy >= 50) this.endTDMMatch(false);
    }
    this.mouseDown = false;
    this.reloading = false;
    this.inspecting = false;
    this.switchFrom = null;
    Object.values(this.weaponModels).forEach((model) => { model.visible = false; });
    $('crosshair').classList.add('hidden');
    $('respawn-overlay').classList.remove('hidden');
    $('respawn-timer').textContent = '3.0';
    this.respawnTenths = 30;
    $('respawn-killer').textContent = killerName
      ? `被 ${killerName} 击倒`
      : this.mode === 'online' ? '等待服务器复活' : '正在返回战场';
    $('damage-vignette').style.opacity = '0.82';
    setTimeout(() => { $('damage-vignette').style.opacity = '0'; }, 350);
    this.updateVitalsUI();
  }

  respawnPlayer(position = null) {
    const spawn = position || this.playerSpawn(this.mode === 'online' ? this.onlineTeam : 'A');
    this.resetMotionState();
    this.jumpBuffer = 0;
    this.coyoteTimer = 0;
    this.player.dead = false;
    this.player.health = 100;
    this.player.armor = 50;
    this.player.crouched = false;
    this.resetEquipment();
    this.player.position.set(spawn.x, spawn.y || 0, spawn.z);
    this.player.velocity.set(0, 0, 0);
    this.player.verticalVelocity = 0;
    this.player.grounded = true;
    this.player.eyeHeight = 1.65;
    this.player.lean = 0;
    this.landingDip = 0;
    this.camera.position.set(spawn.x, (spawn.y || 0) + 1.65, spawn.z);
    this.camera.rotation.set(0, spawn.yaw ?? 0, 0);
    this.camera.rotation.z = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.lastShotAt = -10;
    this.stepDistance = 0;
    this.reloading = false;
    this.inspecting = false;
    this.switchFrom = null;
    this.switchStart = -10;
    this.switchDuration = 0;
    this.pendingInspect = false;
    this.clearHealBuff();
    this.resetPlayerAvatar();
    Object.entries(this.weaponModels).forEach(([name, model]) => {
      model.visible = !this.thirdPerson && name === this.currentWeapon;
    });
    this.drawCycle = 1;
    this.poseWeaponDraw(this.currentWeapon);
    $('respawn-overlay').classList.add('hidden');
    $('crosshair').classList.remove('hidden');
    $('damage-vignette').style.opacity = '0';
    this.stateSendTimer = 0;
    this.updateVitalsUI();
    this.updateWeaponUI();
    this.audio.tone(520, 0.06, 0.05, 'sine', 760);
  }

  grantKillHeal() {
    if (this.mode === 'online' || this.player.dead) return;
    this.player.health = Math.min(100, this.player.health + 6);
    this.healBuffUntil = this.time + 3;
    $('heal-buff').classList.remove('hidden');
    this.healBuffHidden = false;
    $('heal-buff-time').textContent = '3.0';
    this.healBuffText = '3.0';
    this.updateVitalsUI();
    this.audio.tone(640, 0.09, 0.055, 'sine', 920);
  }

  updateHealBuff(dt) {
    if (this.mode === 'online') {
      if (this.healBuffHidden !== true) {
        $('heal-buff').classList.add('hidden');
        this.healBuffHidden = true;
      }
      return;
    }
    if (this.player.dead || this.healBuffUntil <= 0 || this.time >= this.healBuffUntil) {
      if (this.healBuffHidden !== true) {
        $('heal-buff').classList.add('hidden');
        this.healBuffHidden = true;
      }
      return;
    }
    if (this.healBuffHidden !== false) {
      $('heal-buff').classList.remove('hidden');
      this.healBuffHidden = false;
    }
    this.player.health = Math.min(100, this.player.health + dt * 10);
    const healTime = Math.max(0, this.healBuffUntil - this.time).toFixed(1);
    if (healTime !== this.healBuffText) {
      $('heal-buff-time').textContent = healTime;
      this.healBuffText = healTime;
    }
    this.updateVitalsUI();
  }

  clearHealBuff() {
    this.healBuffUntil = 0;
    $('heal-buff').classList.add('hidden');
    this.healBuffHidden = true;
  }

  endTDMMatch(outcome) {
    if (this.state !== 'playing') return;
    this.state = 'roundEnd';
    this.resetScopeView();
    this.mouseDown = false;
    this.releaseWakeLock();
    this.clearHealBuff();
    const draw = outcome === 'draw' || (outcome === undefined && this.score.friendly === this.score.enemy);
    const victory = outcome === true || (outcome === undefined && this.score.friendly > this.score.enemy);
    if (this.controls.isLocked) this.controls.unlock();
    const card = $('round-end').querySelector('.result-card');
    card.classList.toggle('defeat', !victory && !draw);
    $('result-kicker').textContent = this.duelMode ? 'DUEL COMPLETE' : this.mode === 'online' ? 'MATCH COMPLETE' : 'BRAWL COMPLETE';
    $('result-title').textContent = draw ? '对局平局' : victory ? '对局胜利' : '对局失败';
    $('result-title').style.color = draw ? '#d8e2dc' : victory ? '#c8ff52' : '#ff5d52';
    $('result-reason').textContent = this.duelMode
      ? `1V1 比分 ${this.score.friendly} : ${this.score.enemy}`
      : `团队比分 ${this.score.friendly} : ${this.score.enemy}`;
    $('stat-kills').textContent = this.kills;
    $('stat-accuracy').textContent = `${this.shots ? Math.round((this.hits / this.shots) * 100) : 0}%`;
    $('stat-score').textContent = `${this.score.friendly} : ${this.score.enemy}`;
    $('next-round').querySelector('span').textContent = this.duelMode ? '返回单挑房间' : this.mode === 'online' ? '返回联机大厅' : '再来一局';
    $('next-round').querySelector('small').textContent = this.duelMode ? 'ROOM' : this.mode === 'online' ? 'LOBBY' : 'REMATCH';
    setTimeout(() => { if (this.state === 'roundEnd') $('round-end').classList.remove('hidden'); }, 550);
    if (victory) {
      this.audio.tone(440, 0.3, 0.08, 'sine', 660);
      setTimeout(() => this.audio.tone(660, 0.4, 0.08, 'sine', 880), 250);
    } else {
      this.audio.tone(180, 0.6, 0.09, 'sawtooth', 70);
    }
  }

  createEnemies() {
    let positions;
    if (this.mode === 'brawl') {
      const chosen = [];
      for (let i = 0; i < 4; i++) {
        const point = this.pickBrawlSpawnPoint(null, 14, 8, chosen);
        chosen.push([point.x, point.z]);
      }
      positions = chosen;
    } else {
      positions = [
        [0, -30], [-10, -21], [11, -25], [-15, -10], [17, -13],
      ];
    }
    positions.forEach(([x, z], index) => {
      const group = new THREE.Group();
      const enemy = {
        group, health: 100, alive: true, id: index, spawn: new THREE.Vector3(x, 0, z),
        nextShot: this.time + 1 + Math.random(), seen: false, strafe: Math.random() > 0.5 ? 1 : -1,
        limbs: [], mixer: null, actions: {}, state: '', current: null, oneShotEnd: 0, lastHitAnim: 0, handBone: null, headBone: null,
        respawnAt: 0, patrolTarget: null, patrolWait: 0, patrolStuck: 0, senseTimer: 0, canSee: false,
        form: index % 3 === 1 ? 'female' : 'male',
      };
      if (this.character.ready) this.buildCharacterEnemy(enemy, index);
      else this.buildBoxEnemy(enemy, index);
      group.position.set(x, 0, z);
      group.rotation.y = Math.PI;
      this.scene.add(group);
      this.enemies.push(enemy);
      enemy.patrolTarget = this.pickPatrolPoint(enemy);
    });
  }

  isSpawnBlocked(x, z, margin = 0.8) {
    return this.hasCollision(x - margin, x + margin, z - margin, z + margin);
  }

  pickBrawlSpawnPoint(avoid = null, minPlayerDistance = 14, minEnemyDistance = 6, reserved = []) {
    // 平方距离两趟筛选，避免 filter/hypot 与候选数组分配
    const player = this.player.position;
    const playerDistance2 = minPlayerDistance * minPlayerDistance;
    const enemyDistance2 = minEnemyDistance * minEnemyDistance;
    const isCandidate = ([x, z]) => {
      const pdx = x - player.x;
      const pdz = z - player.z;
      if (pdx * pdx + pdz * pdz < playerDistance2) return false;
      if (this.isSpawnBlocked(x, z)) return false;
      for (const [rx, rz] of reserved) {
        const dx = x - rx;
        const dz = z - rz;
        if (dx * dx + dz * dz < enemyDistance2) return false;
      }
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy === avoid) continue;
        const dx = x - enemy.group.position.x;
        const dz = z - enemy.group.position.z;
        if (dx * dx + dz * dz < enemyDistance2) return false;
      }
      return true;
    };
    let count = 0;
    for (const point of BRAWL_SPAWN_POINTS) if (isCandidate(point)) count++;
    let x = 0;
    let z = 0;
    if (count) {
      let index = Math.floor(Math.random() * count);
      for (const point of BRAWL_SPAWN_POINTS) {
        if (!isCandidate(point)) continue;
        if (index-- === 0) { [x, z] = point; break; }
      }
    } else {
      [x, z] = BRAWL_SPAWN_POINTS[Math.floor(Math.random() * BRAWL_SPAWN_POINTS.length)];
    }
    return new THREE.Vector3(
      x + (Math.random() - 0.5) * 2,
      0,
      z + (Math.random() - 0.5) * 2,
    );
  }

  upgradeBoxEnemies() {
    if (!this.character.ready) return;
    for (const enemy of this.enemies) {
      if (!enemy.boxModel) continue;
      for (const child of [...enemy.group.children]) {
        enemy.group.remove(child);
        this.disposeObject3D(child);
      }
      enemy.limbs = [];
      enemy.mixer = null;
      enemy.actions = {};
      enemy.state = '';
      enemy.current = null;
      enemy.headBone = null;
      enemy.handBone = null;
      enemy.boxModel = false;
      this.buildCharacterEnemy(enemy, enemy.id);
      enemy.group.visible = enemy.alive;
    }
  }

  buildBoxEnemy(enemy, index) {
    enemy.boxModel = true;
    const group = enemy.group;
    const armor = new THREE.MeshStandardMaterial({ color: index % 2 ? 0x472d2b : 0x3a3330, roughness: 0.72, metalness: 0.25 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x202524, roughness: 0.94 });
    const red = new THREE.MeshStandardMaterial({ color: 0xb84439, emissive: 0x6d130d, emissiveIntensity: 0.45, roughness: 0.6 });
    const visor = new THREE.MeshStandardMaterial({ color: 0xff6a50, emissive: 0xff2814, emissiveIntensity: 1.5 });
    const addPart = (geometry, material, xPos, yPos, zPos, zone = 'body') => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(xPos, yPos, zPos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.enemy = enemy;
      mesh.userData.zone = zone;
      group.add(mesh);
      return mesh;
    };
    const leftLeg = addPart(new THREE.BoxGeometry(0.25, 0.85, 0.28), cloth, -0.18, 0.46, 0, 'limb');
    const rightLeg = addPart(new THREE.BoxGeometry(0.25, 0.85, 0.28), cloth, 0.18, 0.46, 0, 'limb');
    enemy.limbs.push(leftLeg, rightLeg);
    addPart(new THREE.BoxGeometry(0.68, 0.72, 0.36), armor, 0, 1.25, 0);
    addPart(new THREE.BoxGeometry(0.54, 0.4, 0.39), cloth, 0, 1.27, -0.01);
    addPart(new THREE.BoxGeometry(0.18, 0.08, 0.025), red, 0, 1.42, 0.21);
    addPart(new THREE.BoxGeometry(0.19, 0.72, 0.23), cloth, -0.44, 1.22, 0, 'limb').rotation.z = -0.15;
    addPart(new THREE.BoxGeometry(0.19, 0.72, 0.23), cloth, 0.44, 1.22, 0, 'limb').rotation.z = 0.15;
    addPart(new THREE.SphereGeometry(0.24, 12, 10), cloth, 0, 1.86, 0, 'head');
    addPart(new THREE.BoxGeometry(0.39, 0.12, 0.1), visor, 0, 1.89, 0.2, 'head');
    addPart(new THREE.BoxGeometry(0.1, 0.1, 0.85), cloth, 0.24, 1.25, 0.38, 'weapon');
  }

  buildCharacterEnemy(enemy, index) {
    enemy.boxModel = false;
    const form = enemy.form === 'female' ? 'female' : 'male';
    const model = cloneSkeleton(this.character.template);
    const palette = this.characterPalette(index % 2 ? 'ai2' : 'ai');
    enemy.bones = {};
    model.traverse((node) => {
      if (node.isMesh || node.isSkinnedMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.userData.enemy = enemy;
        node.userData.sharedGeometry = true;
        const recolor = (material) => {
          const next = material.clone();
          const joints = /joint/i.test(material.name);
          next.color.setHex(joints ? palette.joints : palette.main);
          next.roughness = joints ? 0.5 : 0.88;
          next.metalness = joints ? 0.4 : 0.07;
          next.envMapIntensity = 0.8;
          next.bumpMap = this.fabricTexture;
          next.bumpScale = joints ? 0.0012 : 0.0026;
          if (!joints) next.map = this.camoTexture;
          if (joints) {
            next.emissive = new THREE.Color(palette.accent).multiplyScalar(0.18);
            next.emissiveIntensity = 0.45;
          }
          return next;
        };
        node.material = Array.isArray(node.material) ? node.material.map(recolor) : recolor(node.material);
      }
      if (node.isBone && node.name === 'hand_r') enemy.handBone = node;
      if (node.isBone && node.name === 'Head') enemy.headBone = node;
      if (node.isBone && ['spine_03', 'upperarm_l', 'upperarm_r', 'calf_l', 'calf_r'].includes(node.name)) {
        enemy.bones[node.name] = node;
      }
    });
    enemy.group.add(model);
    this.buildCharacterGear({
      head: enemy.headBone,
      spine: enemy.bones.spine_03,
      upperarm_l: enemy.bones.upperarm_l,
      upperarm_r: enemy.bones.upperarm_r,
      calf_l: enemy.bones.calf_l,
      calf_r: enemy.bones.calf_r,
    }, palette, form);
    if (enemy.handBone) {
      const gun = this.buildEnemyGun(enemy, palette.accent);
      enemy.handBone.add(gun);
    }
    const mixer = new THREE.AnimationMixer(model);
    enemy.mixer = mixer;
    const make = (name, once = false) => {
      const clip = this.formClip(name, form);
      if (!clip) return null;
      const action = mixer.clipAction(clip);
      if (once) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
      return action;
    };
    enemy.actions = {
      idle: make('Zombie_Idle_Loop'),
      walk: make('Zombie_Walk_Fwd_Loop'),
      attack: make('Zombie_Scratch', true),
      hit: make('Hit_Knockback', true),
      death: make('Hit_Knockback', true),
    };
    if (enemy.actions.attack) enemy.actions.attack.timeScale = 2.1;
    if (enemy.actions.walk) enemy.actions.walk.timeScale = 0.92;
    enemy.state = 'idle';
    enemy.current = enemy.actions.idle;
    enemy.current?.play();
  }

  buildEnemyGun(enemy, color = 0xff4a35) {
    const gun = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x15191a, roughness: 0.42, metalness: 0.72 });
    const accent = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.45, metalness: 0.35 });
    const receiver = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.078, 0.4, 2, 0.012), metal);
    receiver.position.z = 0.15;
    const handguard = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.05, 0.22, 2, 0.01), metal);
    handguard.position.set(0, 0.004, 0.35);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.2), metal);
    barrel.position.set(0, 0.018, 0.5);
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.07), accent);
    magazine.position.set(0, -0.1, 0.12);
    magazine.rotation.x = 0.25;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.055, 0.18), metal);
    stock.position.set(0, -0.015, -0.1);
    const optic = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.042, 0.11, 2, 0.008), metal);
    optic.position.set(0, 0.075, 0.14);
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.026, 0.01), accent);
    lens.position.set(0, 0.075, 0.2);
    [receiver, handguard, barrel, magazine, stock, optic, lens].forEach((part) => {
      part.castShadow = true;
      part.userData.enemy = enemy;
      gun.add(part);
    });
    return gun;
  }

  setEnemyState(enemy, state, fade = 0.22) {
    const next = enemy.actions?.[state];
    if (!next || enemy.state === state) return;
    const prev = enemy.current;
    next.reset().fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
    enemy.state = state;
    enemy.current = next;
    enemy.oneShotEnd = this.time + next.getClip().duration / (next.timeScale || 1);
  }

  poseWeaponDraw(name) {
    const model = this.weaponModels[name];
    const base = this.weaponBasePositions[name];
    if (!model || !base) return;
    const isKnife = name === 'knife';
    model.position.set(base.x, base.y - (isKnife ? 0.5 : 0.4), base.z + 0.03);
    model.rotation.set(isKnife ? -1.08 : -0.55, isKnife ? 0.05 : 0, isKnife ? -1.25 : 0.2);
    if (isKnife && this.knifeSpin) this.knifeSpin.rotation.set(0.2, 0, Math.PI * 1.15);
  }

  switchWeapon(name) {
    if (name === this.currentWeapon || this.state !== 'playing' || !this.weaponModels[name] || this.plantingActive) return;
    this.clearScope();
    const from = this.currentWeapon;
    this.lastWeapon = from;
    this.switchFrom = from;
    this.switchStart = this.time;
    const holsterTime = this.weaponConfigs[from]?.switchTime ?? 0.46;
    const drawTime = this.weaponConfigs[name]?.switchTime ?? 0.46;
    this.switchDuration = (holsterTime + drawTime) * 0.5;
    this.wallPush = 0;
    this.pendingInspect = false;
    this.currentWeapon = name;
    this.reloading = false;
    this.inspecting = false;
    this.weaponKick = 0;
    this.meleeSwing = 0;
    this.meleeStab = false;
    this.sprayIndex = 0;
    this.boltCycle = 0;
    this.pumpCycle = 0;
    this.drawCycle = 0;
    this.gunKick.pos = 0;
    this.gunKick.posVel = 0;
    this.gunKick.rot = 0;
    this.gunKick.rotVel = 0;
    this.gunKick.roll = 0;
    this.gunKick.rollVel = 0;
    this.poseWeaponDraw(name);
    Object.entries(this.weaponModels).forEach(([id, model]) => {
      model.visible = !this.thirdPerson && (id === name || id === from);
    });
    this.audio.reload();
    this.updateWeaponUI();
  }

  switchToLastWeapon() {
    if (this.state !== 'playing' || this.player.dead) return;
    const owned = [this.primaryWeapon, this.secondaryWeapon, 'knife'];
    const target = this.lastWeapon && this.lastWeapon !== this.currentWeapon && owned.includes(this.lastWeapon)
      ? this.lastWeapon
      : this.currentWeapon === this.primaryWeapon ? this.secondaryWeapon : this.primaryWeapon;
    if (target && target !== this.currentWeapon) this.switchWeapon(target);
  }

  inspectWeapon() {
    if (this.state !== 'playing' || this.reloading || this.inspecting || this.plantingActive) return;
    this.clearScope();
    if (this.time - this.switchStart < this.switchDuration) {
      if (this.currentWeapon === 'knife') this.pendingInspect = true;
      return;
    }
    this.mouseDown = false;
    this.inspecting = true;
    this.inspectStart = this.time;
    this.audio.tone(330, 0.045, 0.025, 'triangle', 440);
    this.updateWeaponUI();
  }

  reloadWeapon() {
    const weapon = this.weaponConfigs[this.currentWeapon];
    if (weapon.melee || this.reloading || weapon.ammo === weapon.magSize || weapon.reserve <= 0 || this.state !== 'playing' || this.plantingActive) return;
    this.clearScope();
    this.inspecting = false;
    this.reloading = true;
    this.reloadStart = this.time;
    const reloadKey = this.currentWeapon;
    if (weapon.shellReload) {
      this.audio.magOut();
      this.updateWeaponUI();
      return;
    }
    const reloadMs = weapon.reload * 1000;
    const stillReloading = () => this.reloading && this.currentWeapon === reloadKey;
    this.audio.reload();
    this.updateWeaponUI();
    setTimeout(() => { if (stillReloading()) this.audio.magOut(); }, reloadMs * 0.22);
    setTimeout(() => { if (stillReloading()) this.audio.magIn(); }, reloadMs * 0.46);
    setTimeout(() => { if (stillReloading()) this.audio.bolt(); }, reloadMs * 0.72);
  }

  finishReload() {
    const weapon = this.weaponConfigs[this.currentWeapon];
    const needed = weapon.magSize - weapon.ammo;
    const loaded = Math.min(needed, weapon.reserve);
    weapon.ammo += loaded;
    weapon.reserve -= loaded;
    this.reloading = false;
    this.audio.reload();
    this.updateWeaponUI();
  }

  fireWeapon() {
    const weapon = this.weaponConfigs[this.currentWeapon];
    if (this.state !== 'playing' || this.time < this.nextShot) return;
    if (this.player.dead || this.grenadeThrowAt || this.plantingActive) return;
    if (this.reloading) {
      if (!weapon.shellReload || weapon.ammo <= 0) return;
      this.reloading = false;
    }
    if (this.time - this.switchStart < this.switchDuration * 0.72) return;
    if (weapon.melee) { this.meleeAttack(weapon); return; }
    this.inspecting = false;
    if (this.mode === 'brawl') {
      weapon.heat = 0;
      weapon.overheated = false;
    }
    if (weapon.overheated) {
      this.nextShot = this.time + 0.25;
      this.updateWeaponUI();
      return;
    }
    if (!this.unlimitedAmmo && weapon.ammo <= 0) {
      this.nextShot = this.time + 0.25;
      this.audio.empty();
      this.reloadWeapon();
      return;
    }
    if (!this.unlimitedAmmo) weapon.ammo--;
    if (this.time - this.lastShotAt > 0.32) this.sprayIndex = 0;
    if (this.mode !== 'brawl') {
      // 其他模式显著降低积热速度，避免连续交火时频繁过热
      weapon.heat = Math.min(100, (weapon.heat || 0) + (weapon.heatPerShot ?? 3) * 0.3);
      weapon.lastShotAt = this.time;
      if (weapon.heat >= 100 && !weapon.overheated) {
        weapon.overheated = true;
        this.audio.overheat();
      }
    }
    this.shots++;
    this.nextShot = this.time + weapon.rate;
    this.weaponKick = 1;
    if (this.gamepad.fire) this.rumbleGamepad(weapon.recoil > 0.04 ? 0.55 : 0.3, 60);
    this.audio.gun(false, this.currentWeapon === 'pistol' || this.currentWeapon === 'heavy');
    this.spawnCasing(weapon);
    this.muzzleFlash.visible = !this.thirdPerson && !this.scoped;
    this.muzzleLight.intensity = this.thirdPerson || this.scoped ? 0 : 9;
    this.muzzleFlash.position.set(...MUZZLE_POSITIONS[this.currentWeapon]);
    this.muzzleFlash.scale.setScalar(MUZZLE_SCALES[this.currentWeapon] || 0.4);
    this.muzzleFlash.material.rotation = Math.random() * Math.PI;
    this.muzzleLight.position.copy(this.muzzleFlash.position);

    const targets = this.shotTargets;
    targets.length = 0;
    for (const solid of this.solids) targets.push(solid);
    for (const enemy of this.enemies) if (enemy.alive) targets.push(enemy.group);
    if (this.mode === 'online') {
      for (const remote of this.remotePlayers.values()) if (remote.alive) targets.push(remote.group);
    }
    let hitThisShot = false;
    let killedThisShot = false;
    const pellets = weapon.pellets || 1;
    const direction = this.scratch.a;
    const right = this.scratch.b.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = this.scratch.c.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const origin = this.scratch.d.copy(this.camera.position);
    const muzzle = this.scratch.e;
    const end = this.scratch.f;
    const standingStill = this.player.grounded && this.player.speed < 0.25;
    const scopedShot = this.scoped && weapon.scoped;
    const baseSpread = scopedShot
      ? 0
      : (pellets > 1 || !standingStill || weapon.scoped ? weapon.spread : 0);
    const spread = scopedShot
      ? this.player.speed * 0.0005
      : baseSpread + this.bloom + this.player.speed * 0.00065 + (this.player.grounded ? 0 : 0.014);
    for (let pellet = 0; pellet < pellets; pellet++) {
      this.camera.getWorldDirection(direction);
      direction.addScaledVector(right, (Math.random() - 0.5) * spread * 2);
      direction.addScaledVector(up, (Math.random() - 0.5) * spread * 2);
      direction.normalize();
      this.raycaster.set(origin, direction);
      this.raycaster.far = pellets > 1 ? 38 : 110;
      const hit = this.raycaster.intersectObjects(targets, true)[0];
      if (hit) end.copy(hit.point);
      else end.copy(origin).addScaledVector(direction, pellets > 1 ? 38 : 90);
      this.createTracer(muzzle.copy(origin).addScaledVector(direction, 0.8), end, 0xffe0a3, 0.055);
      if (hit) {
        const remoteId = hit.object.userData.remoteId;
        if (remoteId) {
          const remote = this.remotePlayers.get(remoteId);
          if (remote && remote.alive && remote.team !== this.onlineTeam) {
            const zone = this.resolveHitZone(hit, remote);
            const damage = zone === 'head' ? weapon.headDamage : zone === 'limb' ? weapon.damage * 0.78 : weapon.damage;
            this.online?.sendHit(remote.id, damage, zone === 'head', this.currentWeapon);
            this.showHitmarker(false);
            hitThisShot = true;
          }
          continue;
        }
        const enemy = hit.object.userData.enemy;
        if (enemy && enemy.alive) {
          const zone = this.resolveHitZone(hit, enemy);
          const damage = zone === 'head' ? weapon.headDamage : zone === 'limb' ? weapon.damage * 0.78 : weapon.damage;
          this.damageEnemy(enemy, damage, zone === 'head', pellets > 1);
          hitThisShot = true;
          if (!enemy.alive) killedThisShot = true;
        } else {
          this.createImpact(hit.point, hit.face?.normal, hit.object);
        }
      }
    }
    this.bloom = Math.min(0.018, this.bloom + (weapon.auto ? 0.0022 : 0.004));
    const pattern = SPRAY_PATTERNS[this.currentWeapon] || [0];
    const patternValue = pattern[Math.min(this.sprayIndex, pattern.length - 1)];
    const climb = 1 - Math.min(this.sprayIndex, 12) * 0.012;
    const pitchKick = (weapon.recoilPitch ?? weapon.recoil) * (0.85 + Math.random() * 0.3) * climb;
    const yawKick = weapon.recoil * 0.85 * patternValue + (Math.random() - 0.5) * weapon.recoil * 0.18;
    this.camera.rotation.x = clamp(this.camera.rotation.x + pitchKick, -1.45, 1.45);
    this.camera.rotation.y += yawKick;
    this.recoilPitch += pitchKick;
    this.recoilYaw += yawKick;
    const kickProfile = GUN_KICK_PROFILES[this.currentWeapon] || GUN_KICK_PROFILES.rifle;
    this.gunKick.posVel += kickProfile.pos;
    this.gunKick.rotVel += kickProfile.rot;
    this.gunKick.rollVel += patternValue * kickProfile.roll;
    this.cameraShake = Math.max(this.cameraShake, kickProfile.shake);
    if (kickProfile.bolt) {
      this.boltCycle = 1;
      setTimeout(() => this.audio.bolt(), 240);
    }
    if (kickProfile.pump) {
      this.pumpCycle = 1;
      setTimeout(() => this.audio.pump(), 160);
    }
    this.sprayIndex++;
    this.lastShotAt = this.time;
    if (hitThisShot) {
      this.hits++;
      if (pellets > 1) { this.showHitmarker(killedThisShot); this.audio.hit(killedThisShot); }
    }
    this.updateWeaponUI();
    if (!this.unlimitedAmmo && weapon.ammo === 0 && weapon.reserve > 0) setTimeout(() => this.reloadWeapon(), 220);
  }

  meleeAttack(weapon, stab = false) {
    this.nextShot = this.time + (stab ? 0.95 : weapon.rate);
    this.inspecting = false;
    this.meleeStab = stab;
    if (!stab) this.meleeDir = this.meleeDir === 1 ? -1 : 1;
    this.meleeSwing = 1;
    if (stab) {
      this.audio.noise(0.07, 0.06, 1400);
      this.audio.tone(160, 0.07, 0.045, 'square', 80);
    } else {
      this.audio.noise(0.09, 0.07, 1000);
    }
    const bodyDamage = stab ? weapon.damage * 1.7 : weapon.damage;
    const headDamage = stab ? weapon.headDamage * 1.5 : weapon.headDamage;
    const direction = this.meleeDirection || (this.meleeDirection = new THREE.Vector3());
    this.camera.getWorldDirection(direction);
    this.raycaster.set(this.camera.position, direction);
    this.raycaster.far = 2.35;
    const targets = this.shotTargets;
    targets.length = 0;
    for (const solid of this.solids) targets.push(solid);
    for (const enemy of this.enemies) if (enemy.alive) targets.push(enemy.group);
    if (this.mode === 'online') {
      for (const remote of this.remotePlayers.values()) if (remote.alive) targets.push(remote.group);
    }
    const hit = this.raycaster.intersectObjects(targets, true)[0];
    const remoteId = hit?.object.userData.remoteId;
    if (remoteId) {
      const remote = this.remotePlayers.get(remoteId);
      if (remote?.alive && remote.team !== this.onlineTeam) {
        const headshot = this.resolveHitZone(hit, remote) === 'head';
        this.online?.sendHit(remote.id, headshot ? headDamage : bodyDamage, headshot, this.currentWeapon);
        this.showHitmarker(false);
        this.hits++;
      }
      this.shots++;
      return;
    }
    const enemy = hit?.object.userData.enemy;
    if (enemy?.alive) {
      const headshot = this.resolveHitZone(hit, enemy) === 'head';
      this.damageEnemy(enemy, headshot ? headDamage : bodyDamage, headshot);
      this.hits++;
    }
    this.shots++;
  }

  resolveHitZone(hit, enemy) {
    if (hit.object.userData.zone) return hit.object.userData.zone;
    const height = hit.point.y - enemy.group.position.y;
    return height > 1.5 ? 'head' : height < 0.8 ? 'limb' : 'body';
  }

  damageEnemy(enemy, damage, headshot, silent = false, weaponKey = this.currentWeapon) {
    enemy.health -= damage;
    const killed = enemy.health <= 0;
    if (!silent) {
      this.showHitmarker(killed, headshot);
      this.audio.hit(killed);
    }
    if (killed) {
      enemy.alive = false;
      enemy.deathTime = this.time;
      enemy.fallDirection = Math.random() > 0.5 ? 1 : -1;
      if (enemy.mixer) {
        enemy.state = '';
        enemy.current = null;
        this.setEnemyState(enemy, 'death', 0.08);
      }
      this.kills++;
      if (this.mode === 'bomb' || this.mode === 'brawl') this.grantKillHeal();
      if (this.tdm) {
        enemy.respawnAt = this.time + 3;
        this.score.friendly++;
        this.updateScoreUI();
        if (this.score.friendly >= 50) this.endTDMMatch(true);
      } else {
        this.credits = Math.min(9000, this.credits + 200);
        this.updateEconomyUI();
      }
      this.addKillFeed(enemy.id, headshot, weaponKey);
      this.updateEnemyPips();
      if (!this.tdm && this.enemies.every((item) => !item.alive)) setTimeout(() => { if (this.state === 'playing') this.endRound(true, '敌方作战单位已全部清除'); }, 550);
    } else if (enemy.mixer && this.time - enemy.lastHitAnim > 0.34) {
      enemy.lastHitAnim = this.time;
      enemy.state = '';
      this.setEnemyState(enemy, 'hit', 0.08);
    }
    if (!killed) {
      enemy.senseTimer = 0.12;
      enemy.canSee = true;
      enemy.patrolTarget = null;
      enemy.nextShot = Math.max(enemy.nextShot, this.time + 0.35);
    }
  }

  showHitmarker(kill, headshot = false) {
    const marker = $('hitmarker');
    marker.classList.toggle('kill', !!kill);
    marker.classList.toggle('headshot', !!headshot && !kill);
    marker.classList.add('show');
    // 用 Web Animations 重启动画，替代 offsetWidth 强制同步布局
    marker.getAnimations?.().forEach((animation) => {
      animation.cancel();
      animation.play();
    });
  }

  addKillFeed(id, headshot, weaponKey = this.currentWeapon) {
    const item = document.createElement('div');
    item.className = 'kill-item';
    const killer = document.createElement('span');
    killer.textContent = 'PHOENIX_01';
    const weapon = document.createElement('span');
    weapon.className = 'kill-weapon';
    weapon.textContent = this.weaponConfigs[weaponKey]?.name || weaponKey || '未知武器';
    const mark = document.createElement('span');
    mark.className = headshot ? 'headshot' : '';
    mark.textContent = headshot ? '◇ 爆头' : ' — ';
    const victim = document.createElement('span');
    victim.className = 'enemy-name';
    victim.textContent = `失控者_${String(id + 1).padStart(2, '0')}`;
    item.append(killer, weapon, mark, victim);
    $('kill-feed').prepend(item);
    while ($('kill-feed').children.length > 4) $('kill-feed').lastChild.remove();
    setTimeout(() => item.remove(), 5000);
  }

  ensureTracerPool() {
    if (this.tracerPool) return this.tracerPool;
    this.tracerPool = [];
    for (let i = 0; i < 16; i++) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const material = new THREE.LineBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      line.visible = false;
      line.frustumCulled = false;
      line.raycast = () => {};
      this.scene.add(line);
      this.tracerPool.push(line);
    }
    return this.tracerPool;
  }

  // 从池中取出（或新建）特效描述符，持续射击时不再产生短命对象
  pushEffect(object, life, type, size = 0) {
    const entry = this.effectPool.pop() || { object: null, life: 0, maxLife: 0, type: '', size: 0, pooled: true };
    entry.object = object;
    entry.life = life;
    entry.maxLife = life;
    entry.type = type;
    entry.size = size;
    entry.pooled = true;
    this.effects.push(entry);
  }

  createTracer(start, end, color, life = 0.08) {
    this.ensureTracerPool();
    const line = this.tracerPool.find((item) => !item.visible) || this.tracerPool[0];
    const position = line.geometry.attributes.position;
    position.setXYZ(0, start.x, start.y, start.z);
    position.setXYZ(1, end.x, end.y, end.z);
    position.needsUpdate = true;
    line.material.color.setHex(color);
    line.material.opacity = 0.85;
    line.visible = true;
    this.pushEffect(line, life, 'fade');
  }
  ensureBulletHoles() {
    if (this.bulletHoleMesh) return;
    this.bulletHoleMesh = new THREE.InstancedMesh(this.bulletHoleGeometry, this.bulletHoleMaterial, 45);
    this.bulletHoleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bulletHoleMesh.count = 0;
    this.bulletHoleMesh.frustumCulled = false;
    this.bulletHoleMesh.raycast = () => {};
    this.bulletHoleDummy = new THREE.Object3D();
    this.bulletHoleCursor = 0;
    this.scene.add(this.bulletHoleMesh);
  }

  resetBulletHoles() {
    if (!this.bulletHoleMesh) return;
    this.bulletHoleMesh.count = 0;
    this.bulletHoleCursor = 0;
  }

  createImpact(point, normal, object) {
    if (normal) {
      this.ensureBulletHoles();
      // 复用临时向量，避免每次命中都克隆一个 Vector3
      this.impactNormal = this.impactNormal || new THREE.Vector3();
      const worldNormal = this.impactNormal.copy(normal).transformDirection(object.matrixWorld);
      const dummy = this.bulletHoleDummy;
      dummy.position.copy(point).addScaledVector(worldNormal, 0.008);
      dummy.quaternion.setFromUnitVectors(this.scratch.g.set(0, 0, 1), worldNormal);
      dummy.scale.setScalar(0.85 + Math.random() * 0.55);
      dummy.updateMatrix();
      this.bulletHoleMesh.setMatrixAt(this.bulletHoleCursor, dummy.matrix);
      this.bulletHoleMesh.count = Math.min(45, Math.max(this.bulletHoleMesh.count, this.bulletHoleCursor + 1));
      this.bulletHoleMesh.instanceMatrix.needsUpdate = true;
      this.bulletHoleCursor = (this.bulletHoleCursor + 1) % 45;
    }
    this.spawnFlash(point, 0xffb35d, 0.3, 0.09);
  }

  spawnFlash(position, color = 0xffb35d, size = 0.3, life = 0.09) {
    if (!this.impactPool) {
      this.impactPool = [];
      for (let i = 0; i < 24; i++) {
        const material = new THREE.SpriteMaterial({
          map: this.sparkTexture, color: 0xffffff, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        sprite.raycast = () => {};
        this.scene.add(sprite);
        this.impactPool.push(sprite);
      }
    }
    const sprite = this.impactPool.find((item) => !item.visible) || this.impactPool[0];
    sprite.position.copy(position);
    sprite.material.color.setHex(color);
    sprite.material.opacity = 0.9;
    sprite.scale.setScalar(size * 1.3);
    sprite.visible = true;
    this.pushEffect(sprite, life, 'flash', size);
  }

  resetMotionState() {
    if (this.cameraShakePitch || this.cameraShakeYaw) {
      this.camera.rotation.x -= this.cameraShakePitch;
      this.camera.rotation.y -= this.cameraShakeYaw;
    }
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.viewSway.set(0, 0);
    this.mouseSway.set(0, 0);
    this.cameraShake = 0;
    this.cameraShakePitch = 0;
    this.cameraShakeYaw = 0;
    this.gunKick.pos = 0;
    this.gunKick.posVel = 0;
    this.gunKick.rot = 0;
    this.gunKick.rotVel = 0;
    this.gunKick.roll = 0;
    this.gunKick.rollVel = 0;
    this.sprayIndex = 0;
    this.boltCycle = 0;
    this.pumpCycle = 0;
    this.grenadeThrow = 0;
    this.grenadeThrowAt = 0;
    this.drawCycle = 0;
    this.meleeDir = 1;
    this.meleeStab = false;
    this.deathAt = 0;
    this.deathRoll = 0;
    this.plantingActive = false;
    if (this.plantRig) this.plantRig.visible = false;
    this.plantRigVisible = false;
    this.landingRoll = 0;
  }

  lerpAngle(current, target, t) {
    let delta = (target - current) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return current + delta * t;
  }

  applyGroundFriction(dt) {
    // Math.hypot 在 V8 中明显慢于手动开方，这里属于每帧热路径
    const vx = this.player.velocity.x;
    const vz = this.player.velocity.z;
    const speed = Math.sqrt(vx * vx + vz * vz);
    if (speed < 0.001) {
      this.player.velocity.x = 0;
      this.player.velocity.z = 0;
      return;
    }
    const control = Math.max(speed, 1.1);
    const drop = control * 5.6 * dt;
    const scale = Math.max(0, speed - drop) / speed;
    this.player.velocity.x *= scale;
    this.player.velocity.z *= scale;
  }

  accelerateMove(wish, wishSpeed, accel, dt) {
    if (wish.lengthSq() < 1e-6 || wishSpeed <= 0) return;
    const current = this.player.velocity.x * wish.x + this.player.velocity.z * wish.z;
    const add = wishSpeed - current;
    if (add <= 0) return;
    const accelSpeed = Math.min(accel * wishSpeed * dt, add);
    this.player.velocity.x += wish.x * accelSpeed;
    this.player.velocity.z += wish.z * accelSpeed;
  }

  updatePlayer(dt) {
    if (this.cameraShakePitch || this.cameraShakeYaw) {
      this.camera.rotation.x -= this.cameraShakePitch;
      this.camera.rotation.y -= this.cameraShakeYaw;
      this.cameraShakePitch = 0;
      this.cameraShakeYaw = 0;
    }
    if (this.scopeSway.lengthSq() > 0) {
      this.camera.rotation.x -= this.scopeSway.y;
      this.camera.rotation.y -= this.scopeSway.x;
      this.scopeSway.set(0, 0);
    }
    if (!this.player.dead && this.time - this.lastShotAt > 0.2) {
      const ease = 1 - Math.exp(-dt * 7.2);
      const pitch = clamp(this.recoilPitch, -0.16, 0.16) * ease;
      const yaw = clamp(this.recoilYaw, -0.05, 0.05) * ease;
      this.camera.rotation.x -= pitch;
      this.camera.rotation.y -= yaw;
      this.recoilPitch -= pitch;
      this.recoilYaw -= yaw;
    }
    if (this.time - this.lastShotAt > 0.35) this.sprayIndex = 0;
    if (this.player.dead) {
      this.player.velocity.set(0, 0, 0);
      this.player.speed = 0;
      const fall = clamp((this.time - (this.deathAt || this.time)) / 0.9, 0, 1);
      const fallEase = 1 - Math.pow(1 - fall, 3);
      this.player.eyeHeight = lerp(this.player.eyeHeight, 0.26, 1 - Math.exp(-dt * 5.5));
      this.camera.rotation.z = lerp(this.camera.rotation.z, this.deathRoll * fallEase, 1 - Math.exp(-dt * 4));
      this.camera.rotation.x = lerp(this.camera.rotation.x, -0.17 * fallEase, 1 - Math.exp(-dt * 3.2));
      this.camera.position.set(this.player.position.x, this.player.position.y + this.player.eyeHeight, this.player.position.z);
      if (this.thirdPerson) this.positionThirdPersonCamera();
      return;
    }
    // 跳跃缓冲与土狼时间：落地前一瞬或刚离开边缘按下跳跃也能起跳
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyoteTimer = this.player.grounded ? 0.1 : Math.max(0, this.coyoteTimer - dt);
    if (this.jumpBuffer > 0 && (this.player.grounded || this.coyoteTimer > 0) && !this.plantingActive) {
      if (this.scoped) this.setScoped(false);
      this.audio.jump();
      this.player.verticalVelocity = 5.1;
      this.player.grounded = false;
      this.jumpBuffer = 0;
      this.coyoteTimer = 0;
    }
    const forward = this.scratch.g;
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = this.scratch.h.crossVectors(forward, this.camera.up).normalize();
    const wish = this.scratch.a.set(0, 0, 0);
    const joyX = clamp(this.touchState.moveX, -1, 1);
    const joyY = clamp(this.touchState.moveY, -1, 1);
    const padX = clamp(this.gamepad.moveX, -1, 1);
    const padY = clamp(this.gamepad.moveY, -1, 1);
    const moveX = clamp(joyX + padX + (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0), -1, 1);
    const moveY = clamp(joyY + padY + (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0), -1, 1);
    if (Math.abs(moveY) > 0.01) wish.addScaledVector(forward, moveY);
    if (Math.abs(moveX) > 0.01) wish.addScaledVector(right, moveX);
    if (wish.lengthSq() > 0) wish.normalize();
    const strafe = moveX;
    const moveAmount = Math.min(1, Math.sqrt(moveX * moveX + moveY * moveY));
    this.player.crouched = !!this.keys.ControlLeft || !!this.keys.ControlRight || !!this.keys.KeyC || this.touchState.crouch || this.gamepad.crouch;
    const weaponSpeed = this.weaponConfigs[this.currentWeapon]?.speed || 1;
    let targetSpeed = (this.player.crouched ? 2.15 : this.keys.ShiftLeft ? 3.05 : 5.7) * weaponSpeed * moveAmount;
    if (this.scoped) targetSpeed = Math.min(targetSpeed, 2.2);
    if (this.player.grounded) {
      this.applyGroundFriction(dt);
      this.accelerateMove(wish, targetSpeed, 5.8, dt);
    } else {
      this.accelerateMove(wish, Math.min(targetSpeed, 0.75), 11.5, dt);
    }
    this.player.speed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.z ** 2);
    if (this.player.grounded && this.player.speed > 0.6) {
      this.stepDistance += this.player.speed * dt;
      const stride = this.player.crouched ? 1.25 : this.keys.ShiftLeft ? 1.5 : 1.65;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        const volume = this.player.crouched ? 0.012 : this.keys.ShiftLeft ? 0.019 : 0.03;
        this.audio.step(volume, this.player.crouched);
      }
    } else if (!this.player.grounded) {
      this.stepDistance = 0;
    }

    const wasGrounded = this.player.grounded;
    this.moveWithCollision(this.player.position, this.player.velocity.x * dt, 0, 0.4);
    this.moveWithCollision(this.player.position, 0, this.player.velocity.z * dt, 0.4);
    this.player.verticalVelocity -= 14.5 * dt;
    this.player.position.y += this.player.verticalVelocity * dt;
    if (this.player.position.y <= 0) {
      if (!wasGrounded && this.player.verticalVelocity < -2.5) {
        const impact = -this.player.verticalVelocity;
        this.landingDip = clamp(impact / 8.5, 0.18, 1);
        this.landingRoll = (Math.random() - 0.5) * 0.028 * this.landingDip + strafe * 0.006;
        this.cameraShake = Math.max(this.cameraShake, this.landingDip * 0.55);
        this.audio.land(clamp(impact / 8, 0.35, 1));
      }
      this.player.position.y = 0;
      this.player.verticalVelocity = 0;
      this.player.grounded = true;
    }
    this.landingDip = Math.max(0, this.landingDip - dt * 3.8);
    this.landingRoll = lerp(this.landingRoll, 0, 1 - Math.exp(-dt * 7));

    const leanTarget = -strafe * 0.02 * Math.min(this.player.speed / 5.7, 1);
    this.player.lean = lerp(this.player.lean, leanTarget, 1 - Math.exp(-dt * 10));
    const targetEye = this.player.crouched ? 1.12 : 1.65;
    this.player.eyeHeight = lerp(this.player.eyeHeight, targetEye, 1 - Math.exp(-dt * (this.player.crouched ? 16 : 12)));

    const bobInput = this.player.grounded ? Math.min(this.player.speed / 5.7, 1) : 0;
    this.bobAmount = lerp(this.bobAmount, bobInput, 1 - Math.exp(-dt * 8));
    this.bobPhase += dt * (2.6 + this.bobAmount * 2.7) * (this.player.crouched ? 0.85 : 1) * (this.player.grounded ? 1 : 0.25);
    const bobScale = this.bobAmount * (this.player.crouched ? 0.55 : 1) * (this.scoped ? 0.3 : 1);
    const bobY = Math.sin(this.bobPhase * 2) * 0.019 * bobScale;
    const bobSide = Math.cos(this.bobPhase) * 0.0075 * bobScale;
    const bobRoll = Math.cos(this.bobPhase) * 0.0034 * bobScale;
    const eye = this.player.eyeHeight + bobY - this.landingDip * 0.16;
    this.camera.position.set(
      this.player.position.x + right.x * bobSide,
      this.player.position.y + eye,
      this.player.position.z + right.z * bobSide,
    );
    this.camera.rotation.z = this.player.lean + this.landingRoll + bobRoll;
    if (this.thirdPerson) this.positionThirdPersonCamera();
    if (this.scoped && !this.thirdPerson) {
      const holdBreath = !!this.keys.ShiftLeft;
      const moving = this.player.speed > 0.25;
      const amplitude = (holdBreath ? 0.0007 : 0.0024) * (moving ? 1.7 : 1);
      const swayX = Math.sin(this.time * 1.15) * amplitude + Math.sin(this.time * 0.43) * amplitude * 0.45;
      const swayY = Math.cos(this.time * 0.91) * amplitude * 0.75;
      this.scopeSway.set(swayX, swayY);
      this.camera.rotation.y += swayX;
      this.camera.rotation.x += swayY;
    }
    if (this.cameraShake > 0.001) {
      const amp = this.cameraShake * 0.007;
      this.cameraShakePitch = (Math.random() - 0.5) * amp;
      this.cameraShakeYaw = (Math.random() - 0.5) * amp * 0.8;
      this.camera.rotation.x += this.cameraShakePitch;
      this.camera.rotation.y += this.cameraShakeYaw;
      this.cameraShake *= Math.exp(-dt * 10);
    }
  }

  moveWithCollision(position, dx, dz, radius) {
    const nextX = position.x + dx;
    const nextZ = position.z + dz;
    if (Math.abs(nextX) > 31.9 || Math.abs(nextZ) > 37.9) return;
    if (this.hasCollision(nextX - radius, nextX + radius, nextZ - radius, nextZ + radius)) return;
    position.x = nextX;
    position.z = nextZ;
  }

  // 碰撞体在场景构建完成后不再变化，用均匀网格把逐帧全量遍历降为邻域查询
  buildColliderGrid() {
    const cell = 4;
    const originX = -32;
    const originZ = -38;
    const cols = 16;
    const rows = 19;
    const cells = new Array(cols * rows);
    for (let i = 0; i < cells.length; i++) cells[i] = [];
    this.colliders.forEach((box, index) => {
      const cx0 = clamp(Math.floor((box.minX - originX) / cell), 0, cols - 1);
      const cx1 = clamp(Math.floor((box.maxX - originX) / cell), 0, cols - 1);
      const cz0 = clamp(Math.floor((box.minZ - originZ) / cell), 0, rows - 1);
      const cz1 = clamp(Math.floor((box.maxZ - originZ) / cell), 0, rows - 1);
      for (let cz = cz0; cz <= cz1; cz++) {
        for (let cx = cx0; cx <= cx1; cx++) cells[cz * cols + cx].push(index);
      }
    });
    this.colliderGrid = { cell, originX, originZ, cols, rows, cells };
    this.colliderStamp = new Int32Array(this.colliders.length);
    this.colliderStampId = 0;
  }

  hasCollision(minX, maxX, minZ, maxZ) {
    const grid = this.colliderGrid;
    if (!grid) {
      return this.colliders.some((box) => (
        maxX > box.minX && minX < box.maxX && maxZ > box.minZ && minZ < box.maxZ
      ));
    }
    const { cell, originX, originZ, cols, rows, cells } = grid;
    const cx0 = clamp(Math.floor((minX - originX) / cell), 0, cols - 1);
    const cx1 = clamp(Math.floor((maxX - originX) / cell), 0, cols - 1);
    const cz0 = clamp(Math.floor((minZ - originZ) / cell), 0, rows - 1);
    const cz1 = clamp(Math.floor((maxZ - originZ) / cell), 0, rows - 1);
    const stamps = this.colliderStamp;
    const stamp = ++this.colliderStampId;
    for (let cz = cz0; cz <= cz1; cz++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const bucket = cells[cz * cols + cx];
        for (let i = 0; i < bucket.length; i++) {
          const index = bucket[i];
          if (stamps[index] === stamp) continue;
          stamps[index] = stamp;
          const box = this.colliders[index];
          if (maxX > box.minX && minX < box.maxX && maxZ > box.minZ && minZ < box.maxZ) return true;
        }
      }
    }
    return false;
  }

  resetWeaponHeat() {
    for (const weapon of Object.values(this.weaponConfigs)) {
      weapon.heat = 0;
      weapon.overheated = false;
      weapon.lastShotAt = -10;
    }
    this.updateWeaponHeat(0);
  }

  updateWeaponHeat(dt) {
    const weapon = this.weaponConfigs[this.currentWeapon];
    if (!this.heatUI) {
      this.heatUI = {
        row: $('heat-row'), fill: $('heat-fill'), label: $('heat-label'), crosshair: $('crosshair'),
        lastPercent: -1, lastState: '', lastVisibility: '',
      };
    }
    const ui = this.heatUI;
    if (!ui.row) return;
    if (!weapon || weapon.melee || this.mode === 'brawl') {
      if (this.mode === 'brawl' && weapon) {
        weapon.heat = 0;
        weapon.overheated = false;
      }
      if (ui.lastVisibility !== 'hidden') {
        ui.row.style.visibility = 'hidden';
        ui.lastVisibility = 'hidden';
      }
      if (this.heatSteam) this.heatSteam.visible = false;
      if (ui.crosshair) ui.crosshair.classList.remove('heat-warn', 'heat-blocked');
      ui.lastState = '';
      return;
    }
    if (ui.lastVisibility !== 'visible') {
      ui.row.style.visibility = 'visible';
      ui.lastVisibility = 'visible';
    }
    if (this.time - (weapon.lastShotAt ?? -10) > 0.55) {
      weapon.heat = Math.max(0, (weapon.heat || 0) - (weapon.coolRate || 13) * dt);
    }
    if (weapon.overheated && weapon.heat <= 30) {
      weapon.overheated = false;
      this.updateWeaponUI();
    }
    const percent = Math.round(weapon.heat || 0);
    if (percent !== ui.lastPercent && ui.fill) {
      ui.fill.style.width = `${percent}%`;
      ui.lastPercent = percent;
    }
    const state = weapon.overheated ? 'overheated' : (weapon.heat || 0) > 68 ? 'hot' : 'normal';
    if (state !== ui.lastState) {
      ui.row.classList.toggle('overheated', state === 'overheated');
      if (ui.label) {
        ui.label.textContent = state === 'overheated' ? '枪管过热' : state === 'hot' ? '枪管高温' : '枪管温度';
      }
      if (ui.crosshair) {
        ui.crosshair.classList.toggle('heat-warn', state === 'hot');
        ui.crosshair.classList.toggle('heat-blocked', state === 'overheated');
      }
      ui.lastState = state;
    }
    if (this.heatSteam) {
      const muzzle = MUZZLE_POSITIONS[this.currentWeapon] || [0.38, -0.26, -1.1];
      const intensity = weapon.overheated ? 1 : clamp((weapon.heat - 55) / 45, 0, 1);
      this.heatSteam.visible = intensity > 0.02 && !this.thirdPerson && !this.scoped;
      if (this.heatSteam.visible) {
        this.heatSteam.material.opacity = intensity * (0.2 + Math.sin(this.time * 7.5) * 0.05);
        const scale = 0.28 + intensity * 0.4 + Math.sin(this.time * 9.3) * 0.04;
        this.heatSteam.scale.setScalar(scale);
        this.heatSteam.position.set(muzzle[0], muzzle[1] + 0.03, muzzle[2] - 0.05);
      }
    }
  }

  ensurePlantRig() {
    if (this.plantRig) return this.plantRig;
    const rig = new THREE.Group();
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x202a27, roughness: 0.4, metalness: 0.62 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0xc8ff52, emissive: 0x8fdc23, emissiveIntensity: 1.3, roughness: 0.32 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d1312, roughness: 0.6, metalness: 0.4 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.13, 0.19, 3, 0.022), shellMat);
    body.position.set(0, -0.22, -0.5);
    body.rotation.x = -0.42;
    rig.add(body);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.055, 18), glowMat);
    core.position.set(0, -0.158, -0.5);
    rig.add(core);
    const coreCap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.02, 16), dark);
    coreCap.position.set(0, -0.128, -0.5);
    rig.add(coreCap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.006, 8, 30), glowMat);
    ring.position.copy(core.position);
    ring.rotation.x = Math.PI / 2;
    rig.add(ring);
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.02, 0.15, 2, 0.003), glowMat);
      strip.position.set(side * 0.115, -0.2, -0.5);
      strip.rotation.x = -0.42;
      rig.add(strip);
      const grip = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.05, 0.09, 2, 0.008), dark);
      grip.position.set(side * 0.16, -0.27, -0.48);
      rig.add(grip);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 8), shellMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, -0.28, -0.5);
    rig.add(handle);
    this.placeFPSArm(rig, 'right', 0.8, [0.165, -0.26, -0.42], [0, 1, -0.16], [-1, 0, 0]);
    this.placeFPSArm(rig, 'left', 0.78, [-0.165, -0.26, -0.42], [0, 1, -0.16], [1, 0.2, 0]);
    this.plantCore = core;
    rig.visible = false;
    this.camera.add(rig);
    this.plantRig = rig;
    return rig;
  }

  updateWeapon(dt) {
    const weapon = this.weaponConfigs[this.currentWeapon];
    this.updateWeaponHeat(dt);
    if (this.grenadeThrowAt) {
      if (this.player.dead) this.grenadeThrowAt = 0;
      else if (this.time >= this.grenadeThrowAt) {
        this.grenadeThrowAt = 0;
        this.releaseGrenade();
      }
    }
    if (this.state === 'playing' && (this.mouseDown || this.gamepad.fire) && weapon.auto) this.fireWeapon();
    if (this.player.dead) return;
    const planting = this.plantingActive && !this.thirdPerson && !this.scoped;
    if (planting) {
      const rig = this.ensurePlantRig();
      for (const id in this.weaponModels) this.weaponModels[id].visible = false;
      rig.visible = true;
      this.plantRigVisible = true;
      const progress = clamp(this.plantProgress / 3, 0, 1);
      if (this.plantCore) {
        this.plantCore.material.emissiveIntensity = 1.15 + Math.sin(this.time * (4 + progress * 9)) * 0.45;
      }
      rig.position.set(
        Math.sin(this.time * 2.2) * 0.004,
        Math.sin(this.time * 3.1) * 0.005 - progress * 0.018,
        0,
      );
      rig.rotation.z = Math.sin(this.time * 1.7) * 0.008;
      rig.rotation.x = 0.02 + progress * 0.05;
    } else if (this.plantRigVisible) {
      if (this.plantRig) this.plantRig.visible = false;
      this.plantRigVisible = false;
      const current = this.weaponModels[this.currentWeapon];
      if (current) current.visible = !this.thirdPerson && !this.scoped;
    }
    if (this.thirdPerson || this.scoped) {
      for (const id in this.weaponModels) this.weaponModels[id].visible = false;
    }
    const model = this.weaponModels[this.currentWeapon];
    const base = this.weaponBasePositions[this.currentWeapon];
    this.weaponKick = Math.max(0, this.weaponKick - dt * 9);
    this.meleeSwing = Math.max(0, this.meleeSwing - dt * 2.25);
    this.bloom = Math.max(0, this.bloom - dt * 0.05);
    this.boltCycle = Math.max(0, this.boltCycle - dt * 2.4);
    this.pumpCycle = Math.max(0, this.pumpCycle - dt * 3.2);
    this.drawCycle = Math.max(0, this.drawCycle - dt / 0.45);
    const drawTuck = this.drawCycle * this.drawCycle;
    const kick = this.gunKick;
    kick.posVel += (-GUN_KICK_STIFFNESS * kick.pos - GUN_KICK_DAMPING * kick.posVel) * dt;
    kick.pos += kick.posVel * dt;
    kick.rotVel += (-GUN_KICK_STIFFNESS * kick.rot - GUN_KICK_DAMPING * kick.rotVel) * dt;
    kick.rot += kick.rotVel * dt;
    kick.rollVel += (-GUN_KICK_STIFFNESS * kick.roll - GUN_KICK_DAMPING * kick.rollVel) * dt;
    kick.roll += kick.rollVel * dt;

    const rawSwayX = clamp(this.mouseSway.x, -40, 40);
    const rawSwayY = clamp(this.mouseSway.y, -40, 40);
    const swayLerp = 1 - Math.exp(-dt * 11);
    this.viewSway.x = lerp(this.viewSway.x, rawSwayX, swayLerp);
    this.viewSway.y = lerp(this.viewSway.y, rawSwayY, swayLerp);
    const movementSway = clamp(this.player.speed / 5.7, 0, 1)
      * (this.player.crouched ? 0.55 : 1)
      * (this.player.grounded ? 1 : 0.25)
      * (this.scoped ? 0.25 : 1);
    const strafe = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
    const strafeSway = strafe * movementSway;
    const bobX = Math.sin(this.bobPhase) * 0.014 * movementSway;
    const bobY = Math.abs(Math.cos(this.bobPhase * 2)) * 0.011 * movementSway;
    const idleWeight = clamp(1 - movementSway * 0.75, 0.15, 1) * (this.scoped ? 0 : 1);
    const breathX = Math.sin(this.time * 1.15) * 0.0013 * idleWeight;
    const breathY = Math.cos(this.time * 0.82) * 0.0016 * idleWeight;
    const airLift = this.player.grounded ? 0 : clamp(-this.player.verticalVelocity * 0.004, -0.022, 0.026);
    const boltArc = Math.sin(this.boltCycle * Math.PI);
    const pumpArc = Math.sin(this.pumpCycle * Math.PI);
    this.grenadeThrow = Math.max(0, this.grenadeThrow - dt * 3.4);
    const throwArc = Math.sin(this.grenadeThrow * Math.PI);
    const knife = this.currentWeapon === 'knife';
    // 贴墙检测：CS2 风格，枪口顶到墙面时自动收枪下压
    this.wallCheckTimer -= dt;
    if (this.wallCheckTimer <= 0) {
      this.wallCheckTimer = 0.08;
      // 先用碰撞体 XZ 包围盒粗筛，远离任何墙体时跳过射线检测
      const px = this.player.position.x;
      const pz = this.player.position.z;
      let nearWall = Math.abs(px) > 30.8 || Math.abs(pz) > 36.8;
      if (!nearWall) {
        // 网格邻域查询取代全量碰撞体遍历
        nearWall = this.hasCollision(px - 1, px + 1, pz - 1, pz + 1);
      }
      if (nearWall) {
        this.camera.getWorldDirection(this.scratch.h);
        this.wallRaycaster.set(this.camera.position, this.scratch.h);
        this.wallRaycaster.far = 0.95;
        const hits = this.wallRaycaster.intersectObjects(this.solids, false);
        const wall = hits.find((hit) => hit.face && Math.abs(hit.face.normal.y) < 0.6);
        this.wallDistance = wall ? wall.distance : Infinity;
      } else {
        this.wallDistance = Infinity;
      }
    }
    const wallBlockWeight = this.scoped || this.thirdPerson || planting ? 0 : 1;
    const wallTarget = clamp((0.92 - this.wallDistance) / 0.55, 0, 1) * wallBlockWeight;
    this.wallPush = lerp(this.wallPush, wallTarget, 1 - Math.exp(-dt * 15));
    const wallPush = this.wallPush;
    const switchProgress = this.switchFrom ? clamp((this.time - this.switchStart) / this.switchDuration, 0, 1) : 1;
    const switching = !!this.switchFrom && switchProgress < 1;
    const target = this.scratch.g.copy(base);
    const inspectRotation = this.inspectRotation;
    inspectRotation.x = 0;
    inspectRotation.y = 0;
    inspectRotation.z = 0;
    let leftHandRelease = 0;
    let reloadHand = 0;
    let reloadOffsetY = 0;
    let reloadOffsetZ = 0;
    let reloadPitch = 0;
    let reloadYaw = 0;
    let reloadRoll = 0;
    target.x += bobX + breathX - this.viewSway.x * 0.0004 - strafeSway * 0.01;
    target.y += -bobY + breathY + airLift - this.viewSway.y * 0.00028 - this.landingDip * 0.05;
    target.z += kick.pos;
    target.y -= boltArc * 0.045 + pumpArc * 0.02;
    target.z += boltArc * 0.065 + pumpArc * 0.055;
    target.x -= throwArc * 0.1;
    target.y -= throwArc * 0.15;
    target.z += throwArc * 0.02;
    target.y -= drawTuck * 0.4;
    target.z += drawTuck * 0.03;
    target.y -= wallPush * 0.15;
    target.z += wallPush * 0.34;
    target.x += wallPush * 0.02;
    if (this.inspecting) {
      const profile = INSPECT_PROFILES[this.currentWeapon];
      const progress = clamp((this.time - this.inspectStart) / profile.duration, 0, 1);
      const smooth = (from, to, value) => {
        const t = clamp((value - from) / (to - from), 0, 1);
        return t * t * (3 - 2 * t);
      };
      const raise = smooth(0, 0.16, progress);
      const lower = smooth(0.84, 1, progress);
      const hold = raise * (1 - lower);
      const sweep = smooth(0.12, 0.82, progress);
      const breathe = Math.sin(sweep * Math.PI);
      const yawWave = Math.sin(sweep * Math.PI * 2);
      const rollWave = Math.sin(sweep * Math.PI * 2);
      const pitchWave = Math.sin(sweep * Math.PI);
      leftHandRelease = Math.sin(smooth(0.1, 0.8, progress) * Math.PI) * hold;

      target.x -= hold * profile.push;
      target.y += hold * profile.lift + breathe * hold * profile.breathe;
      target.z += breathe * hold * 0.012 - hold * profile.pull;

      if (knife) {
        const liftTilt = Math.sin(smooth(0.14, 0.86, progress) * Math.PI);
        inspectRotation.x = hold * 0.04;
        inspectRotation.y = hold * 0.05;
        inspectRotation.z = hold * 0.02;
        target.z += hold * Math.sin(Math.PI * smooth(0.18, 0.8, progress)) * 0.04;
        target.y += hold * liftTilt * 0.015;
        if (this.knifeSpin) {
          const spin = smooth(0.18, 0.8, progress);
          const settle = Math.sin(smooth(0.8, 0.96, progress) * Math.PI) * 0.16;
          this.knifeSpin.rotation.z = spin * Math.PI * 2 - settle;
          this.knifeSpin.rotation.x = Math.sin(spin * Math.PI) * 0.2;
          this.knifeSpin.rotation.y = Math.sin(spin * Math.PI * 2) * 0.08;
        }
      } else {
        inspectRotation.x = (pitchWave * 0.7 + yawWave * 0.3) * hold * profile.pitch;
        inspectRotation.y = yawWave * hold * profile.yaw;
        inspectRotation.z = rollWave * hold * profile.roll + breathe * hold * profile.roll * 0.25;
      }
      const inspectPivot = this.inspectPivot;
      const rotatedPivot = this.inspectRotated.copy(inspectPivot).applyEuler(
        this.inspectEuler.set(inspectRotation.x, inspectRotation.y, inspectRotation.z),
      );
      target.x += inspectPivot.x - rotatedPivot.x;
      target.y += inspectPivot.y - rotatedPivot.y;
      target.z += inspectPivot.z - rotatedPivot.z;
      if (progress >= 1) { this.inspecting = false; this.updateWeaponUI(); }
    } else if (this.knifeSpin && !switching) {
      this.knifeSpin.rotation.set(0, 0, 0);
    }
    let switchRotX = 0;
    let switchRotY = 0;
    let switchRotZ = 0;
    if (switching) {
      const drawT = clamp((switchProgress - 0.22) / 0.78, 0, 1);
      const drawEase = 1 - Math.pow(1 - drawT, 3);
      const tucked = 1 - drawEase;
      target.y -= tucked * (knife ? 0.5 : 0.4);
      target.z += tucked * 0.03;
      switchRotX = -tucked * (knife ? 1.0 : 0.55);
      switchRotY = tucked * (knife ? 0.25 : 0);
      switchRotZ = tucked * (knife ? -1.2 : 0.2);
      if (knife && this.knifeSpin) {
        this.knifeSpin.rotation.z = tucked * Math.PI * 1.15;
        this.knifeSpin.rotation.x = tucked * 0.2;
        this.knifeSpin.rotation.y = 0;
      }
      const oldModel = this.weaponModels[this.switchFrom];
      if (oldModel) {
        const oldTarget = this.weaponBasePositions[this.switchFrom].clone();
        const holsterT = clamp(switchProgress / 0.32, 0, 1);
        const holsterEase = holsterT * holsterT;
        oldTarget.y -= holsterEase * 0.42;
        oldTarget.z -= holsterEase * 0.03;
        oldModel.position.lerp(oldTarget, 1 - Math.exp(-dt * 26));
        oldModel.rotation.x = lerp(oldModel.rotation.x, holsterEase * 0.55, 1 - Math.exp(-dt * 22));
        oldModel.rotation.y = lerp(oldModel.rotation.y, 0, 1 - Math.exp(-dt * 22));
        oldModel.rotation.z = lerp(oldModel.rotation.z, -holsterEase * 0.35, 1 - Math.exp(-dt * 22));
        if (holsterT >= 1) oldModel.visible = false;
      }
    } else if (this.switchFrom) {
      const oldModel = this.weaponModels[this.switchFrom];
      if (oldModel) oldModel.visible = false;
      this.switchFrom = null;
      if (this.pendingInspect && this.currentWeapon === 'knife') {
        this.pendingInspect = false;
        this.inspecting = true;
        this.inspectStart = this.time;
        this.audio.tone(330, 0.045, 0.025, 'triangle', 440);
        this.updateWeaponUI();
      }
    }
    if (this.reloading) {
      const reloadDuration = weapon.shellReload ? weapon.shellTime : weapon.reload;
      const progress = clamp((this.time - this.reloadStart) / reloadDuration, 0, 1);
      const smooth = (from, to, value) => {
        const t = clamp((value - from) / (to - from), 0, 1);
        return t * t * (3 - 2 * t);
      };
      if (weapon.shellReload) {
        const tilt = smooth(0, 0.25, progress) * (1 - smooth(0.75, 1, progress));
        const insert = Math.sin(progress * Math.PI);
        reloadHand = clamp(insert * 0.75, 0, 1);
        reloadOffsetY = -tilt * 0.08;
        reloadOffsetZ = insert * 0.01;
        reloadPitch = -tilt * 0.08;
        reloadYaw = -tilt * 0.05;
        reloadRoll = tilt * 0.14 + insert * 0.05;
      } else {
        const bump = (center, width) => Math.exp(-Math.pow((progress - center) / width, 2));
        const tilt = smooth(0, 0.16, progress) * (1 - smooth(0.84, 1, progress));
        const magOut = bump(0.36, 0.07);
        const magIn = bump(0.5, 0.065);
        const rack = bump(0.72, 0.05);
        reloadHand = clamp(tilt * 0.35 + magOut * 0.35 + magIn * 0.5, 0, 1);
        reloadOffsetY = -tilt * 0.22 - magOut * 0.02;
        reloadOffsetZ = magOut * 0.022 + magIn * 0.018 + rack * 0.055;
        reloadPitch = -tilt * 0.18 - rack * 0.16;
        reloadYaw = -tilt * 0.12 + magOut * 0.03;
        reloadRoll = tilt * 0.52 + magIn * 0.08;
      }
    }
    const tracking = (this.inspecting ? 1.45 : 1) * (switching ? 1.5 : 1);
    model.position.lerp(target, 1 - Math.exp(-dt * 18));
    model.rotation.x = lerp(model.rotation.x, (knife ? -0.08 : 0) + inspectRotation.x + switchRotX + this.gunKick.rot + boltArc * 0.3 + pumpArc * 0.12 + this.viewSway.y * 0.00045 - throwArc * 0.3 - drawTuck * 0.55 + wallPush * 0.5, 1 - Math.exp(-dt * 15 * tracking));
    model.rotation.y = lerp(model.rotation.y, (knife ? -0.2 : 0) + inspectRotation.y + switchRotY - this.viewSway.x * 0.00055 - pumpArc * 0.06 + throwArc * 0.12 + strafeSway * 0.025 + wallPush * 0.07, 1 - Math.exp(-dt * 12 * tracking));
    model.rotation.z = lerp(model.rotation.z, (knife ? -0.05 : 0) + inspectRotation.z + switchRotZ + this.gunKick.roll - bobX * 1.2 - this.viewSway.x * 0.00035 + boltArc * 0.35 - pumpArc * 0.2 + throwArc * 0.28 + drawTuck * 0.2 + wallPush * 0.1, 1 - Math.exp(-dt * 10 * tracking));
    if (model.userData.leftArm === undefined) {
      model.userData.leftArm = model.children.find((child) => child.name === 'fpsArm-left') || null;
    }
    const leftArm = knife ? null : model.userData.leftArm;
    if (leftArm) {
      if (!leftArm.userData.inspectRest) {
        leftArm.userData.inspectRest = {
          position: leftArm.position.clone(),
          rotation: leftArm.rotation.clone(),
        };
      }
      const rest = leftArm.userData.inspectRest;
      leftArm.position.copy(rest.position);
      leftArm.rotation.copy(rest.rotation);
      if (leftHandRelease > 0.001) {
        const releaseScale = this.currentWeapon === 'pistol' || this.currentWeapon === 'heavy' ? 0.6 : 1;
        leftArm.position.x -= leftHandRelease * 0.06 * releaseScale;
        leftArm.position.y -= leftHandRelease * 0.07 * releaseScale;
        leftArm.position.z += leftHandRelease * 0.13 * releaseScale;
        leftArm.rotation.z += leftHandRelease * 0.2 * releaseScale;
        leftArm.rotation.x -= leftHandRelease * 0.12 * releaseScale;
      }
      if (reloadHand > 0.001) {
        const handScale = this.currentWeapon === 'pistol' || this.currentWeapon === 'heavy' ? 0.55 : 1;
        leftArm.position.x += reloadHand * 0.018 * handScale;
        leftArm.position.y -= reloadHand * 0.075 * handScale;
        leftArm.position.z += reloadHand * 0.05 * handScale;
        leftArm.rotation.x += reloadHand * 0.42 * handScale;
        leftArm.rotation.z += reloadHand * 0.1 * handScale;
      }
      if (throwArc > 0.001) {
        leftArm.position.x -= throwArc * 0.04;
        leftArm.position.y += throwArc * 0.07;
        leftArm.position.z -= throwArc * 0.18;
        leftArm.rotation.x -= throwArc * 0.75;
        leftArm.rotation.z += throwArc * 0.25;
      }
    }
    if (this.reloading) {
      model.position.y += reloadOffsetY;
      model.position.z += reloadOffsetZ;
      model.rotation.x += reloadPitch;
      model.rotation.y += reloadYaw;
      model.rotation.z += reloadRoll;
      const reloadDuration = weapon.shellReload ? weapon.shellTime : weapon.reload;
      const progress = (this.time - this.reloadStart) / reloadDuration;
      if (weapon.shellReload) {
        if (progress >= 1) {
          if (weapon.ammo < weapon.magSize && weapon.reserve > 0) {
            weapon.ammo++;
            weapon.reserve--;
            this.reloadStart = this.time;
            this.audio.magIn();
            this.updateWeaponUI();
          }
          if (weapon.ammo >= weapon.magSize || weapon.reserve <= 0) {
            this.reloading = false;
            this.audio.pump();
            this.updateWeaponUI();
          }
        }
      } else if (progress >= 1) {
        this.finishReload();
      }
    }
    if (this.meleeSwing > 0) {
      const arc = Math.sin((1 - this.meleeSwing) * Math.PI);
      const dir = this.meleeDir || 1;
      if (this.meleeStab) {
        model.position.z -= arc * 0.48;
        model.position.y += arc * 0.06;
        model.rotation.x -= arc * 0.35;
        model.rotation.z -= arc * 0.15;
        model.rotation.y += arc * 0.05;
      } else {
        model.position.x -= arc * 0.3 * dir;
        model.position.z -= arc * 0.25;
        model.rotation.z -= arc * 1.35 * dir;
        model.rotation.x -= arc * 0.7;
        model.rotation.y += arc * 0.18 * dir;
      }
    }
    this.mouseSway.multiplyScalar(Math.exp(-dt * 12));
    this.muzzleFlash.visible = !knife && !this.thirdPerson && !this.scoped && this.weaponKick > 0.76;
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 180);
    const baseGap = this.currentWeapon === 'shotgun' ? 9 : 4;
    const gap = baseGap + this.bloom * 650 + this.player.speed * 0.85 + (this.player.grounded ? 0 : 4);
    // 缓存准星与换弹进度节点，避免每帧重复查询
    if (!this.crosshairEl) {
      this.crosshairEl = $('crosshair');
      this.reloadTrackEl = $('reload-track');
      this.reloadFillEl = $('reload-fill');
    }
    this.crosshairUiTimer = Math.max(0, this.crosshairUiTimer - dt);
    if (this.crosshairUiTimer <= 0 && Math.abs(gap - this.lastCrosshairGap) > 0.4) {
      this.lastCrosshairGap = gap;
      this.crosshairUiTimer = 0.05;
      this.crosshairEl.style.setProperty('--gap', `${gap}px`);
    }
    const crosshairOpacity = knife ? '0.45' : '1';
    if (this.crosshairEl.style.opacity !== crosshairOpacity) this.crosshairEl.style.opacity = crosshairOpacity;
    const reloadTrack = this.reloadTrackEl;
    const showReload = this.reloading && !weapon.melee;
    if (showReload !== reloadTrack.classList.contains('active')) reloadTrack.classList.toggle('active', showReload);
    if (showReload) {
      const reloadDuration = weapon.shellReload ? weapon.shellTime : weapon.reload;
      const progress = clamp((this.time - this.reloadStart) / reloadDuration, 0, 1);
      this.reloadFillEl.style.transform = `scaleX(${progress.toFixed(3)})`;
    }
  }

  pickPatrolPoint(enemy) {
    // 只统计满足距离条件的巡逻点，避免 filter + hypot + 新向量带来的临时分配
    const position = enemy.group.position;
    let count = 0;
    for (const [x, z] of PATROL_POINTS) {
      const dx = x - position.x;
      const dz = z - position.z;
      if (dx * dx + dz * dz > 25) count++;
    }
    let x = 0;
    let z = 0;
    if (count) {
      let index = Math.floor(Math.random() * count);
      for (const [px, pz] of PATROL_POINTS) {
        const dx = px - position.x;
        const dz = pz - position.z;
        if (dx * dx + dz * dz <= 25) continue;
        if (index-- === 0) { x = px; z = pz; break; }
      }
    } else {
      [x, z] = PATROL_POINTS[Math.floor(Math.random() * PATROL_POINTS.length)];
    }
    return (enemy.patrolTarget || (enemy.patrolTarget = new THREE.Vector3())).set(x, 0, z);
  }

  updateEnemies(dt) {
    const playerHead = this.camera.position;
    const toPlayer = this.scratch.a;
    const eye = this.scratch.b;
    const sightDir = this.scratch.c;
    const move = this.scratch.d;
    const side = this.scratch.e;
    const separation = this.scratch.f;
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        if (enemy.mixer) enemy.mixer.update(dt);
        const t = clamp((this.time - enemy.deathTime) * 2.4, 0, 1);
        enemy.group.rotation.z = lerp(enemy.group.rotation.z, enemy.fallDirection * 1.45, t * 0.12);
        enemy.group.position.y = lerp(enemy.group.position.y, -0.25, t * 0.08);
        if (this.tdm && this.time >= enemy.respawnAt) this.respawnEnemy(enemy);
        continue;
      }
      toPlayer.subVectors(this.player.position, enemy.group.position);
      toPlayer.y = 0;
      const distance = toPlayer.length();
      // 远处敌人动画降到约 20Hz，近处保持满帧，减少骨骼矩阵计算
      if (enemy.mixer) {
        if (distance > 25) {
          enemy.animAccum = (enemy.animAccum || 0) + dt;
          if (enemy.animAccum >= 0.05) {
            enemy.mixer.update(enemy.animAccum);
            enemy.animAccum = 0;
          }
        } else {
          if (enemy.animAccum) {
            enemy.mixer.update(enemy.animAccum);
            enemy.animAccum = 0;
          }
          enemy.mixer.update(dt);
        }
      }
      enemy.senseTimer -= dt;
      if (enemy.senseTimer <= 0) {
        // 距离越远感知频率越低：远端射线检测对行为影响很小
        enemy.senseTimer = distance > 22
          ? 0.22 + Math.random() * 0.12
          : 0.1 + Math.random() * 0.06;
        // 超出感知距离直接判为不可见，省掉一次全场景射线
        if (distance >= 36) {
          enemy.canSee = false;
        } else {
          eye.copy(enemy.group.position);
          eye.y = 1.65;
          sightDir.copy(playerHead).sub(eye);
          const sightDistance = sightDir.length();
          sightDir.normalize();
          this.raycaster.set(eye, sightDir);
          this.raycaster.far = sightDistance;
          enemy.canSee = sightDistance < 36 && !this.raycaster.intersectObjects(this.solids, false)[0];
        }
      }
      const visible = enemy.canSee && distance < 36;
      separation.set(0, 0, 0);
      for (const other of this.enemies) {
        if (other === enemy || !other.alive) continue;
        const dx = enemy.group.position.x - other.group.position.x;
        const dz = enemy.group.position.z - other.group.position.z;
        const d2 = dx * dx + dz * dz;
        if (d2 > 0.0001 && d2 < 2.25) {
          const inv = 1 / Math.sqrt(d2);
          separation.x += dx * inv;
          separation.z += dz * inv;
        }
      }
      let moved = false;
      if (visible) {
        if (!enemy.seen) {
          enemy.nextShot = this.time + 0.45 + Math.random() * 0.5;
          enemy.seen = true;
        }
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        let delta = targetYaw - enemy.group.rotation.y;
        delta = Math.atan2(Math.sin(delta), Math.cos(delta));
        enemy.group.rotation.y += delta * (1 - Math.exp(-dt * 9));
        if (enemy.limbs.length) {
          const walkPhase = this.time * 5 + enemy.id;
          enemy.limbs[0].rotation.x = Math.sin(walkPhase) * 0.12;
          enemy.limbs[1].rotation.x = -Math.sin(walkPhase) * 0.12;
        }
        const position = enemy.group.position;
        const beforeX = position.x;
        const beforeZ = position.z;
        if (distance > 15 && distance < 34) {
          move.copy(toPlayer).normalize().multiplyScalar(dt * 0.75);
          move.x += separation.x * dt * 0.7;
          move.z += separation.z * dt * 0.7;
          this.moveWithCollision(position, move.x, 0, 0.38);
          this.moveWithCollision(position, 0, move.z, 0.38);
          moved = (position.x - beforeX) ** 2 + (position.z - beforeZ) ** 2 > 0.0000001;
        } else if (distance < 24) {
          side.set(toPlayer.z, 0, -toPlayer.x).normalize().multiplyScalar(enemy.strafe * dt * 0.48);
          side.x += separation.x * dt * 0.5;
          side.z += separation.z * dt * 0.5;
          this.moveWithCollision(position, side.x, side.z, 0.38);
          moved = (position.x - beforeX) ** 2 + (position.z - beforeZ) ** 2 > 0.0000001;
          if (!moved) enemy.strafe *= -1;
        }
        if (this.time >= enemy.nextShot) {
          this.enemyFire(enemy, eye, distance);
          enemy.nextShot = this.time + 0.62 + Math.random() * 0.62;
        }
      } else {
        enemy.seen = false;
        if (!enemy.patrolTarget) enemy.patrolTarget = this.pickPatrolPoint(enemy);
        enemy.patrolWait = Math.max(0, (enemy.patrolWait || 0) - dt);
        move.copy(enemy.patrolTarget).sub(enemy.group.position);
        move.y = 0;
        const targetDistance = move.length();
        if (enemy.patrolWait > 0) {
          moved = false;
        } else if (targetDistance < 1.3) {
          enemy.patrolWait = 0.8 + Math.random() * 2.2;
          enemy.patrolTarget = this.pickPatrolPoint(enemy);
          moved = false;
        } else {
          move.normalize();
          move.x += separation.x * 0.5;
          move.z += separation.z * 0.5;
          const position = enemy.group.position;
          const beforeX = position.x;
          const beforeZ = position.z;
          this.moveWithCollision(position, move.x * dt * 1.15, 0, 0.38);
          this.moveWithCollision(position, 0, move.z * dt * 1.15, 0.38);
          moved = (position.x - beforeX) ** 2 + (position.z - beforeZ) ** 2 > 0.0000001;
          const targetYaw = Math.atan2(move.x, move.z);
          let delta = targetYaw - enemy.group.rotation.y;
          delta = Math.atan2(Math.sin(delta), Math.cos(delta));
          enemy.group.rotation.y += delta * (1 - Math.exp(-dt * 5));
          if (!moved) {
            enemy.patrolStuck = (enemy.patrolStuck || 0) + dt;
            if (enemy.patrolStuck > 0.5) {
              enemy.patrolTarget = this.pickPatrolPoint(enemy);
              enemy.patrolWait = 0.3;
              enemy.patrolStuck = 0;
            }
          } else {
            enemy.patrolStuck = 0;
          }
          if (enemy.limbs.length) {
            const walkPhase = this.time * 5 + enemy.id;
            const swing = moved ? 0.32 : 0.08;
            enemy.limbs[0].rotation.x = Math.sin(walkPhase) * swing;
            enemy.limbs[1].rotation.x = -Math.sin(walkPhase) * swing;
          }
        }
      }
      this.updateEnemyAnimation(enemy, moved);
    }
  }

  respawnEnemy(enemy) {
    let spawnX = enemy.spawn.x;
    let spawnZ = enemy.spawn.z;
    if (this.mode === 'brawl') {
      const point = this.pickBrawlSpawnPoint(enemy, 14, 6);
      spawnX = point.x;
      spawnZ = point.z;
    } else {
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = enemy.spawn.x + (Math.random() - 0.5) * 4;
        const z = enemy.spawn.z + (Math.random() - 0.5) * 4;
        if (!this.isSpawnBlocked(x, z, 0.5)) {
          spawnX = x;
          spawnZ = z;
          break;
        }
      }
    }
    enemy.group.position.set(spawnX, 0, spawnZ);
    enemy.group.rotation.set(0, Math.PI, 0);
    enemy.group.visible = true;
    enemy.health = 100;
    enemy.alive = true;
    enemy.seen = false;
    enemy.nextShot = this.time + 0.8;
    enemy.state = '';
    enemy.current = null;
    enemy.patrolWait = 0.6;
    enemy.patrolStuck = 0;
    enemy.senseTimer = 0;
    enemy.canSee = false;
    enemy.patrolTarget = this.pickPatrolPoint(enemy);
    enemy.mixer?.stopAllAction();
    this.setEnemyState(enemy, 'idle', 0.15);
    this.updateEnemyPips();
  }

  updateEnemyAnimation(enemy, moved) {
    if (!enemy.mixer) return;
    if (enemy.state === 'attack' || enemy.state === 'hit') {
      if (this.time < enemy.oneShotEnd) return;
      enemy.state = '';
    }
    this.setEnemyState(enemy, moved ? 'walk' : 'idle', 0.26);
  }

  enemyFire(enemy, origin, distance) {
    this.audio.gun(true);
    if (enemy.mixer) {
      enemy.state = '';
      this.setEnemyState(enemy, 'attack', 0.12);
    }
    const accuracy = clamp(0.68 - distance * 0.011 - this.player.speed * 0.025, 0.16, 0.64);
    const hit = Math.random() < accuracy;
    // 复用临时向量，避免每次开火分配
    const target = this.enemyTarget || (this.enemyTarget = new THREE.Vector3());
    target.copy(this.camera.position);
    if (!hit) {
      target.x += (Math.random() - 0.5) * 4;
      target.y += (Math.random() - 0.5) * 3;
      target.z += (Math.random() - 0.5) * 4;
    }
    const muzzle = this.enemyMuzzle || (this.enemyMuzzle = new THREE.Vector3());
    if (enemy.handBone) {
      enemy.handBone.getWorldPosition(muzzle);
    } else {
      muzzle.copy(enemy.group.position).add(this.enemyMuzzleOffset || (this.enemyMuzzleOffset = new THREE.Vector3(0.22, 1.3, 0)));
    }
    this.createTracer(muzzle, target, 0xff694f, 0.09);
    if (hit) this.damagePlayer(8 + Math.random() * 8, enemy.group.position);
  }

  damagePlayer(amount, source) {
    if (this.state !== 'playing' || this.player.dead) return;
    this.cameraShake = Math.max(this.cameraShake, clamp(amount / 45, 0.25, 1.1));
    const absorbed = Math.min(this.player.armor, amount * 0.45);
    this.player.armor -= absorbed;
    this.player.health = Math.max(0, this.player.health - (amount - absorbed * 0.45));
    $('damage-vignette').style.opacity = '0.85';
    setTimeout(() => { $('damage-vignette').style.opacity = this.player.health < 30 ? '0.28' : '0'; }, 130);
    const direction = $('damage-direction');
    const toSource = this.damageSource || (this.damageSource = new THREE.Vector3());
    toSource.copy(source).sub(this.player.position);
    const sourceAngle = Math.atan2(toSource.x, toSource.z);
    direction.style.transform = `translateX(-50%) rotate(${sourceAngle - this.camera.rotation.y}rad)`;
    direction.style.opacity = '1';
    setTimeout(() => { direction.style.opacity = '0'; }, 350);
    toSource.normalize();
    const right = this.damageRight || (this.damageRight = new THREE.Vector3());
    right.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const lateral = toSource.dot(right);
    const punchPitch = clamp(amount * 0.0011, 0.004, 0.022);
    const punchYaw = clamp(lateral * amount * 0.0007, -0.018, 0.018);
    this.camera.rotation.x = clamp(this.camera.rotation.x + punchPitch, -1.45, 1.45);
    this.camera.rotation.y += punchYaw;
    this.recoilPitch += punchPitch;
    this.recoilYaw += punchYaw;
    this.gunKick.rotVel += 0.5;
    this.gunKick.posVel += 0.35;
    this.updateVitalsUI();
    if (this.player.health <= 0) {
      if (this.tdm) this.playerDied(source);
      else this.endRound(false, '你已在行动中阵亡');
    }
  }

  updateObjective(dt) {
    this.plantingActive = false;
    // 交互提示节点与进度条按需更新，避免贴近核心时每帧写 DOM
    if (!this.plantUI) {
      this.plantUI = {
        wrap: $('interaction'), fill: $('interaction-progress'), text: $('interaction-text'), percent: -1,
      };
    }
    const plantUI = this.plantUI;
    const distance = this.player.position.distanceTo(this.site);
    if (!this.bombPlanted) {
      const canPlant = distance < 4.25;
      if (canPlant !== this.interactionVisible) {
        plantUI.wrap.classList.toggle('hidden', !canPlant);
        this.interactionVisible = canPlant;
      }
      if (canPlant) {
        const interactHeld = !!this.keys.KeyE || this.gamepad.interact;
        if (interactHeld) {
          this.plantProgress += dt;
          if (Math.floor(this.plantProgress * 4) !== Math.floor((this.plantProgress - dt) * 4)) this.audio.tone(520 + this.plantProgress * 120, 0.03, 0.025, 'square');
        } else {
          this.plantProgress = Math.max(0, this.plantProgress - dt * 1.5);
        }
        this.plantingActive = !this.player.dead && interactHeld && this.plantProgress > 0.02;
        const percent = Math.round(clamp(this.plantProgress / 3, 0, 1) * 100);
        if (percent !== plantUI.percent) {
          plantUI.percent = percent;
          plantUI.fill.style.width = `${percent}%`;
        }
        const planting = interactHeld;
        if (planting !== this.plantingHeld) {
          plantUI.text.textContent = planting ? '正在安置量子核心…' : '按住安置量子核心';
          this.plantingHeld = planting;
        }
        if (this.plantProgress >= 3) this.plantBomb();
      } else {
        this.plantProgress = 0;
        if (this.plantingHeld) {
          this.plantingHeld = false;
          plantUI.text.textContent = '按住安置量子核心';
        }
        if (plantUI.percent !== 0) {
          plantUI.percent = 0;
          plantUI.fill.style.width = '0%';
        }
      }
    } else {
      this.bombBeep -= dt;
      if (this.bombBeep <= 0) {
        this.audio.beep(this.roundTime < 10);
        this.bombBeep = clamp(this.roundTime / 35, 0.16, 1);
        if (this.bomb) {
          const light = this.bomb.userData.light;
          light.color.setHex(0xff3b28);
          light.distance = 6;
          light.intensity = 15;
        }
      }
      if (this.bomb) this.bomb.userData.light.intensity = Math.max(0, this.bomb.userData.light.intensity - dt * 45);
      const bombTimer = Math.max(0, this.roundTime).toFixed(1);
      if (bombTimer !== this.hudBombTimer) {
        $('bomb-timer').textContent = bombTimer;
        this.hudBombTimer = bombTimer;
      }
    }
  }

  plantBomb() {
    this.bombPlanted = true;
    this.roundTime = 40;
    this.plantProgress = 0;
    this.keys.KeyE = false;
    $('interaction').classList.add('hidden');
    this.interactionVisible = false;
    this.plantingHeld = false;
    $('objective-banner').classList.add('hidden');
    $('bomb-status').classList.remove('hidden');
    this.bomb = new THREE.Group();
    const caseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.45), new THREE.MeshStandardMaterial({ color: 0x252d2a, metalness: 0.65, roughness: 0.4 }));
    caseMesh.castShadow = true;
    this.bomb.add(caseMesh);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.08), new THREE.MeshBasicMaterial({ color: 0xff4d38 }));
    strip.position.y = 0.105;
    this.bomb.add(strip);
    this.bomb.position.copy(this.site).add(new THREE.Vector3(0, 0.12, 0));
    this.bombLight.position.copy(this.bomb.position);
    this.bombLight.position.y += 0.3;
    this.bombLight.color.setHex(0xff3b28);
    this.bombLight.distance = 6;
    this.bombLight.intensity = 15;
    this.bomb.userData.light = this.bombLight;
    this.scene.add(this.bomb);
    this.announce('CORE ARMED', '核心已安置', '守住目标，等待核心过载');
  }

  updateEnvironment(dt) {
    if (this.dust) this.dust.rotation.y += dt * 0.004;
    if (this.siteRing) this.siteRing.material.opacity = 0.52 + Math.sin(this.time * 2) * 0.16;
    for (const update of this.environmentAnimations) update(this.time, dt);
    if (!this.sunLight || !this.hemiLight) return;
    if (this.lightningActive > 0) {
      this.lightningActive = Math.max(0, this.lightningActive - dt);
      const progress = 1 - this.lightningActive / 0.55;
      const pulse = Math.pow(Math.max(0, Math.sin(progress * Math.PI * 2.6 + this.lightningSeed)), 2);
      this.sunLight.intensity = this.baseSunIntensity + pulse * 8;
      this.hemiLight.intensity = this.baseHemiIntensity + pulse * 2.5;
      if (this.lightningSprite) this.lightningSprite.material.opacity = pulse * 0.75;
      if (this.lightningActive === 0) {
        this.sunLight.intensity = this.baseSunIntensity;
        this.hemiLight.intensity = this.baseHemiIntensity;
        if (this.lightningSprite) {
          this.lightningSprite.material.opacity = 0;
          this.lightningSprite.visible = false;
        }
      }
    } else if (this.time > this.lightningNext) {
      this.lightningActive = 0.55;
      this.lightningSeed = Math.random() * 2;
      this.lightningNext = this.time + 18 + Math.random() * 16;
      if (this.lightningSprite) {
        const angle = Math.PI + (Math.random() - 0.5) * 1.7;
        this.lightningSprite.position.set(Math.sin(angle) * 88, 37, Math.cos(angle) * 88);
        this.lightningSprite.material.rotation = (Math.random() - 0.5) * 0.5;
        this.lightningSprite.visible = true;
      }
      if (this.audio?.context) {
        setTimeout(() => this.audio.thunder(), 220 + Math.random() * 650);
      }
    }
  }

  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.life -= dt;
      if (effect.type === 'fade') {
        effect.object.material.opacity = Math.max(0, effect.life / effect.maxLife);
      } else if (effect.type === 'flash') {
        const alpha = Math.max(0, effect.life / effect.maxLife);
        effect.object.material.opacity = alpha * 0.9;
        effect.object.scale.setScalar(effect.size * (1.3 - alpha * 0.3));
      }
      if (effect.life <= 0) {
        if (effect.pooled) {
          effect.object.visible = false;
        } else {
          this.scene.remove(effect.object);
          if (effect.type === 'flash') {
            effect.object.material?.dispose();
          } else {
            effect.object.geometry?.dispose();
            effect.object.material?.dispose();
          }
        }
        // 倒序遍历时用尾部交换代替 splice，避免每次移除都搬移整个数组
        const last = this.effects.pop();
        if (i < this.effects.length) this.effects[i] = last;
        if (effect.pooled && this.effectPool.length < 64) this.effectPool.push(effect);
      }
    }
    this.updateCasings(dt);
  }

  ensureCasings() {
    if (this.casings.length) return this.casings;
    const geometry = new THREE.CylinderGeometry(0.011, 0.011, 0.05, 6);
    geometry.rotateX(Math.PI / 2);
    this.casingBrassMat = new THREE.MeshStandardMaterial({ color: 0xb08a45, roughness: 0.34, metalness: 0.82 });
    this.casingShellMat = new THREE.MeshStandardMaterial({ color: 0x9b3a2c, roughness: 0.55, metalness: 0.15 });
    this.casingRaycaster = new THREE.Raycaster();
    for (let i = 0; i < 26; i++) {
      const mesh = new THREE.Mesh(geometry, this.casingBrassMat);
      mesh.visible = false;
      mesh.raycast = () => {};
      this.scene.add(mesh);
      this.casings.push({
        mesh,
        active: false,
        life: 0,
        bounces: 0,
        groundY: 0.012,
        velocity: new THREE.Vector3(),
        spin: new THREE.Vector3(),
      });
    }
    return this.casings;
  }

  spawnCasing(weapon) {
    if (this.scoped || this.player.dead) return;
    const pool = this.ensureCasings();
    let item = pool.find((entry) => !entry.active);
    if (!item) item = pool.reduce((oldest, entry) => (entry.life < oldest.life ? entry : oldest), pool[0]);
    const shell = !!weapon.shellReload;
    item.mesh.material = shell ? this.casingShellMat : this.casingBrassMat;
    item.mesh.scale.setScalar(shell ? 1.35 : 1);
    const right = this.casingRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = this.casingUp.set(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const forward = this.casingForward.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const origin = this.casingOrigin.copy(this.camera.position)
      .addScaledVector(right, 0.22)
      .addScaledVector(up, -0.14)
      .addScaledVector(forward, 0.52);
    item.mesh.position.copy(origin);
    item.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    item.velocity.copy(right).multiplyScalar(1.1 + Math.random() * 1.2)
      .addScaledVector(up, 0.9 + Math.random() * 0.8)
      .addScaledVector(forward, 0.15 + Math.random() * 0.2)
      .addScaledVector(this.player.velocity, 0.35);
    item.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    item.life = 2.6;
    item.bounces = 0;
    item.active = true;
    // 地面高度不必每发都做全场景射线检测，移动后或间隔超时才刷新
    if (this.time - this.casingGroundAt > 0.35 || origin.distanceToSquared(this.casingGroundOrigin) > 0.8) {
      this.casingRaycaster.set(origin, this.casingDown);
      this.casingRaycaster.far = 4;
      const ground = this.casingRaycaster.intersectObjects(this.solids, false)[0];
      this.casingGroundY = ground ? ground.point.y + 0.012 : 0.012;
      this.casingGroundOrigin.copy(origin);
      this.casingGroundAt = this.time;
    }
    item.groundY = this.casingGroundY;
    item.mesh.visible = true;
  }

  updateCasings(dt) {
    for (const item of this.casings) {
      if (!item.active) continue;
      item.life -= dt;
      if (item.life <= 0) {
        item.active = false;
        item.mesh.visible = false;
        continue;
      }
      item.velocity.y -= 9.8 * dt;
      item.mesh.position.addScaledVector(item.velocity, dt);
      item.mesh.rotation.x += item.spin.x * dt;
      item.mesh.rotation.y += item.spin.y * dt;
      item.mesh.rotation.z += item.spin.z * dt;
      if (item.mesh.position.y <= item.groundY) {
        item.mesh.position.y = item.groundY;
        if (Math.abs(item.velocity.y) > 0.4) {
          item.velocity.y *= -0.32;
          item.velocity.x *= 0.66;
          item.velocity.z *= 0.66;
          item.spin.multiplyScalar(0.55);
          item.bounces++;
        } else {
          item.velocity.set(0, 0, 0);
          item.spin.set(0, 0, 0);
        }
      }
    }
  }

  clearEffects() {
    for (const item of this.casings) {
      item.active = false;
      item.mesh.visible = false;
    }
    for (const effect of this.effects) {
      if (effect.pooled) {
        effect.object.visible = false;
        if (this.effectPool.length < 64) this.effectPool.push(effect);
        continue;
      }
      this.scene.remove(effect.object);
      if (effect.type === 'flash') {
        effect.object.material?.dispose();
      } else {
        effect.object.geometry?.dispose();
        effect.object.material?.dispose();
      }
    }
    this.effects = [];
  }

  updateRound(dt) {
    this.roundTime -= dt;
    if (this.buyTime > 0) {
      const previousSecond = Math.ceil(this.buyTime);
      this.buyTime = Math.max(0, this.buyTime - dt);
      if (Math.ceil(this.buyTime) !== previousSecond) this.updateEconomyUI();
      if (this.buyTime === 0) $('buy-phase').classList.add('hidden');
    }
    const seconds = Math.max(0, Math.ceil(this.roundTime));
    if (seconds !== this.hudTimerSeconds) {
      $('round-timer').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
      this.hudTimerSeconds = seconds;
    }
    const timerLow = this.roundTime < 15;
    if (timerLow !== this.hudTimerLow) {
      $('round-timer').style.color = timerLow ? '#ff5d52' : '';
      this.hudTimerLow = timerLow;
    }
    const phase = this.bombPlanted ? '核心过载阶段' : '核心安置阶段';
    if (phase !== this.hudPhase) {
      $('phase-label').textContent = phase;
      this.hudPhase = phase;
    }
    if (this.roundTime <= 0) this.endRound(this.bombPlanted, this.bombPlanted ? '量子核心已成功引爆' : '行动时间耗尽，核心未能安置');
  }

  endRound(victory, reason) {
    if (this.state !== 'playing') return;
    this.state = 'roundEnd';
    this.resetScopeView();
    this.mouseDown = false;
    this.releaseWakeLock();
    const roundReward = victory ? 3000 : 1900;
    this.credits = Math.min(9000, this.credits + roundReward);
    this.updateEconomyUI();
    if (victory) this.score.friendly++; else this.score.enemy++;
    this.updateScoreUI();
    if (this.controls.isLocked) this.controls.unlock();
    const card = $('round-end').querySelector('.result-card');
    card.classList.toggle('defeat', !victory);
    $('result-kicker').textContent = victory ? 'OPERATION COMPLETE' : 'OPERATION FAILED';
    $('result-title').textContent = victory ? '行动成功' : '行动失败';
    $('result-title').style.color = victory ? '#c8ff52' : '#ff5d52';
    $('result-reason').textContent = `${reason} · 回合奖励 $${roundReward}`;
    $('stat-kills').textContent = this.kills;
    $('stat-accuracy').textContent = `${this.shots ? Math.round((this.hits / this.shots) * 100) : 0}%`;
    $('stat-score').textContent = `${this.score.friendly} : ${this.score.enemy}`;
    setTimeout(() => { if (this.state === 'roundEnd') $('round-end').classList.remove('hidden'); }, 650);
    if (victory) {
      this.audio.tone(440, 0.3, 0.08, 'sine', 660);
      setTimeout(() => this.audio.tone(660, 0.4, 0.08, 'sine', 880), 250);
    } else {
      this.audio.tone(180, 0.6, 0.09, 'sawtooth', 70);
    }
  }

  nextRound() {
    if (this.mode === 'brawl') {
      this.startBrawl();
      return;
    }
    if (this.mode === 'online') {
      this.returnToLobby();
      return;
    }
    this.round++;
    this.startRound();
  }

  announce(kicker, title, subtitle) {
    const element = $('announcement');
    element.classList.add('hidden');
    void element.offsetWidth;
    $('announcement-kicker').textContent = kicker;
    $('announcement-title').textContent = title;
    $('announcement-subtitle').textContent = subtitle;
    element.classList.remove('hidden');
    element.style.animation = 'none';
    void element.offsetWidth;
    element.style.animation = '';
    setTimeout(() => element.classList.add('hidden'), 3100);
  }

  weaponUIDom() {
    if (this.weaponUiDom) return this.weaponUiDom;
    // 每发子弹都会刷新武器 UI，缓存节点避免反复 getElementById/querySelector
    this.weaponUiDom = {
      scopeCaption: $('scope-caption-name'),
      name: $('weapon-name'),
      mode: $('fire-mode'),
      heatRow: $('heat-row'),
      scopeHint: $('scope-hint'),
      touchScope: document.querySelector('#touch-controls [data-touch="scope"]'),
      ammo: $('ammo-value'),
      reserve: $('reserve-value'),
      ammoSep: document.querySelector('.ammo > span'),
      ticks: $('ammo-ticks'),
      last: { name: '', mode: '', ammo: '', reserve: '', caption: '', low: null, sep: null, scopeHint: null, touchScope: null },
    };
    return this.weaponUiDom;
  }

  updateWeaponUI() {
    const weapon = this.weaponConfigs[this.currentWeapon];
    const ui = this.weaponUIDom();
    const last = ui.last;
    const caption = `${weapon.name} · ${weapon.scopeZoom || '1×'}`;
    if (ui.scopeCaption && caption !== last.caption) {
      ui.scopeCaption.textContent = caption;
      last.caption = caption;
    }
    const name = this.reloading ? '换弹中…' : weapon.name;
    if (name !== last.name) {
      ui.name.textContent = name;
      last.name = name;
    }
    const mode = weapon.overheated
      ? '枪管过热 · 冷却中'
      : this.inspecting ? '检视武器' : this.scoped && weapon.scoped ? `开镜 · ${weapon.scopeZoom || '瞄准'}` : weapon.mode;
    if (mode !== last.mode) {
      ui.mode.textContent = mode;
      last.mode = mode;
    }
    if (ui.heatRow) this.updateWeaponHeat(0);
    const scoped = !!weapon.scoped;
    if (scoped !== last.scopeHint) {
      ui.scopeHint.classList.toggle('hidden', !scoped);
      last.scopeHint = scoped;
    }
    if (ui.touchScope && scoped !== last.touchScope) {
      ui.touchScope.classList.toggle('hidden', !scoped);
      last.touchScope = scoped;
    }
    const unlimited = this.unlimitedAmmo && !weapon.melee;
    const ammoText = weapon.melee ? '—' : unlimited ? '∞' : String(weapon.ammo).padStart(2, '0');
    if (ammoText !== last.ammo) {
      ui.ammo.textContent = ammoText;
      last.ammo = ammoText;
    }
    const low = !weapon.melee && !unlimited && weapon.ammo <= Math.max(1, Math.floor(weapon.magSize * 0.2));
    if (low !== last.low) {
      ui.ammo.classList.toggle('low', low);
      last.low = low;
    }
    const reserveText = weapon.melee ? '近战' : unlimited ? '∞' : String(weapon.reserve);
    if (reserveText !== last.reserve) {
      ui.reserve.textContent = reserveText;
      last.reserve = reserveText;
    }
    const sepHidden = !!weapon.melee;
    if (sepHidden !== last.sep) {
      ui.ammoSep.style.visibility = sepHidden ? 'hidden' : 'visible';
      last.sep = sepHidden;
    }
    const ticks = ui.ticks;
    if (ticks.dataset.mag !== String(weapon.magSize)) {
      ticks.dataset.mag = String(weapon.magSize);
      ticks.innerHTML = '';
      ticks.classList.toggle('dense', weapon.magSize > 30);
      for (let i = 0; i < weapon.magSize; i++) ticks.appendChild(document.createElement('i'));
    }
    const children = ticks.children;
    for (let i = 0; i < children.length; i++) {
      const empty = !unlimited && i >= weapon.ammo;
      if (children[i].classList.contains('empty') !== empty) children[i].classList.toggle('empty', empty);
    }
  }

  updateVitalsUI() {
    if (!this.vitalsUI) {
      this.vitalsUI = {
        healthEl: $('health-value'), barEl: $('health-bar'), armorEl: $('armor-value'),
        vignetteEl: $('damage-vignette'),
        health: -1, armor: -1, low: null, lowClass: null,
      };
    }
    const ui = this.vitalsUI;
    const health = Math.ceil(this.player.health);
    const armor = Math.ceil(this.player.armor);
    if (health !== ui.health) {
      if (ui.healthEl) ui.healthEl.textContent = health;
      if (ui.barEl) ui.barEl.style.width = `${health}%`;
      ui.health = health;
    }
    if (armor !== ui.armor) {
      if (ui.armorEl) ui.armorEl.textContent = armor;
      ui.armor = armor;
    }
    const low = this.player.health < 30;
    if (low !== ui.low) {
      if (ui.barEl) ui.barEl.style.background = low ? '#ff5d52' : '';
      ui.low = low;
    }
    const lowClass = !this.player.dead && this.player.health > 0 && this.player.health < 30;
    if (lowClass !== ui.lowClass) {
      if (ui.vignetteEl) ui.vignetteEl.classList.toggle('low-health', lowClass);
      ui.lowClass = lowClass;
    }
  }

  updateScoreUI() {
    const friendly = this.score.friendly;
    const enemy = this.score.enemy;
    if (!this.scoreUI) {
      this.scoreUI = { friendlyEl: $('friendly-score'), enemyEl: $('enemy-score'), friendly: -1, enemy: -1 };
    }
    const ui = this.scoreUI;
    // 在线模式每个快照都会调用，比分未变时跳过 DOM 写入
    if (friendly !== ui.friendly) {
      ui.friendly = friendly;
      if (ui.friendlyEl) ui.friendlyEl.textContent = friendly;
    }
    if (enemy !== ui.enemy) {
      ui.enemy = enemy;
      if (ui.enemyEl) ui.enemyEl.textContent = enemy;
    }
  }

  updateEnemyPips() {
    const pips = $('enemy-pips');
    pips.innerHTML = '';
    this.enemies.forEach((enemy) => {
      const pip = document.createElement('i');
      if (!enemy.alive) pip.className = 'dead';
      pips.appendChild(pip);
    });
  }

  buildMinimapBase() {
    const canvas = document.createElement('canvas');
    canvas.width = 220;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const mapX = (x) => ((x + 33) / 66) * width;
    const mapY = (z) => ((z + 39) / 78) * height;
    ctx.fillStyle = 'rgba(8,15,15,.88)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(160,190,175,.055)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 22) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(140,160,150,.2)';
    ctx.strokeStyle = 'rgba(170,190,180,.25)';
    this.colliders.forEach((box) => {
      const x = mapX(box.minX);
      const y = mapY(box.minZ);
      const w = mapX(box.maxX) - x;
      const h = mapY(box.maxZ) - y;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    });
    this.minimapBase = canvas;
  }

  updateMinimap() {
    if (!this.minimapBase) this.buildMinimapBase();
    if (!this.minimapCanvas) {
      this.minimapCanvas = $('minimap');
      this.minimapCtx = this.minimapCanvas.getContext('2d');
      this.minimapCone = this.minimapCtx.createRadialGradient(0, 0, 3, 0, 0, 46);
      this.minimapCone.addColorStop(0, 'rgba(200,255,82,.26)');
      this.minimapCone.addColorStop(1, 'rgba(200,255,82,0)');
      // 玩家光点改用缓存的径向渐变，避免每帧 canvas shadowBlur 的软件模糊开销
      this.minimapGlow = this.minimapCtx.createRadialGradient(0, 0, 2, 0, 0, 13);
      this.minimapGlow.addColorStop(0, 'rgba(200,255,82,.5)');
      this.minimapGlow.addColorStop(1, 'rgba(200,255,82,0)');
      this.minimapScaleX = this.minimapCanvas.width / 66;
      this.minimapScaleY = this.minimapCanvas.height / 78;
      this.minimapDirection = new THREE.Vector3();
    }
    const canvas = this.minimapCanvas;
    const ctx = this.minimapCtx;
    const scaleX = this.minimapScaleX;
    const scaleY = this.minimapScaleY;
    const mapX = (x) => (x + 33) * scaleX;
    const mapY = (z) => (z + 39) * scaleY;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.minimapBase, 0, 0);
    ctx.strokeStyle = '#c8ff52';
    ctx.lineWidth = 1.5;
    const sitePulse = 14 + Math.sin(this.time * 2.6) * 2.5;
    ctx.beginPath(); ctx.arc(mapX(this.site.x), mapY(this.site.z), sitePulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#c8ff52'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; ctx.fillText('A', mapX(this.site.x), mapY(this.site.z) + 5);
    this.enemies.forEach((enemy) => {
      if (!enemy.alive) return;
      ctx.fillStyle = '#ff5d52';
      ctx.beginPath(); ctx.arc(mapX(enemy.group.position.x), mapY(enemy.group.position.z), 3, 0, Math.PI * 2); ctx.fill();
    });
    const pickupColors = MINIMAP_PICKUP_COLORS;
    this.pickups.forEach((pickup) => {
      if (!pickup.active) return;
      ctx.fillStyle = pickupColors[pickup.type] || '#c8ff52';
      ctx.fillRect(mapX(pickup.x) - 2, mapY(pickup.z) - 2, 4, 4);
    });
    if (this.mode === 'online') {
      this.remotePlayers.forEach((remote) => {
        if (!remote.alive) return;
        ctx.fillStyle = remote.team === this.onlineTeam ? '#8fd3a8' : '#ff5d52';
        ctx.beginPath(); ctx.arc(mapX(remote.group.position.x), mapY(remote.group.position.z), 3, 0, Math.PI * 2); ctx.fill();
      });
    }
    const px = mapX(this.player.position.x), py = mapY(this.player.position.z);
    this.camera.getWorldDirection(this.minimapDirection);
    const angle = Math.atan2(this.minimapDirection.x, -this.minimapDirection.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = this.minimapCone;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 46, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(px, py); ctx.rotate(angle);
    ctx.fillStyle = this.minimapGlow;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c8ff52';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,255,82,.35)'; ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2); ctx.stroke();
  }

  adjustQuality(dt) {
    if (this.state !== 'playing') return;
    this.frameTimeAccum += dt;
    this.frameTimeCount++;
    this.qualityTimer += dt;
    if (this.qualityTimer < 1.3) return;
    const avg = this.frameTimeAccum / Math.max(1, this.frameTimeCount);
    this.qualityTimer = 0;
    this.frameTimeAccum = 0;
    this.frameTimeCount = 0;
    // 流畅模式只做动态分辨率，弱机型可继续降到 0.7 倍
    if (this.quality === 'low') {
      if (avg > 0.027) {
        const minRatio = 0.7;
        if (this.currentPixelRatio > minRatio + 0.01) {
          const step = avg > 0.04 ? 0.15 : 0.1;
          this.applyPixelRatio(Math.max(minRatio, this.currentPixelRatio - step));
        }
        this.qualityStableTimer = 0;
      } else if (avg < 0.0165) {
        this.qualityStableTimer += 1.3;
        if (this.qualityStableTimer >= 3.9 && this.currentPixelRatio < this.maxPixelRatio - 0.01) {
          this.qualityStableTimer = 0;
          this.applyPixelRatio(Math.min(this.maxPixelRatio, this.currentPixelRatio + 0.05));
        }
      } else {
        this.qualityStableTimer = 0;
      }
      return;
    }
    // 持续掉帧时逐级降低渲染成本：先降分辨率，再关 AO / SMAA
    if (avg > 0.027) {
      this.qualityStableTimer = 0;
      const minRatio = 0.65;
      if (this.currentPixelRatio > minRatio + 0.01) {
        const step = avg > 0.04 ? 0.35 : 0.2;
        this.applyPixelRatio(Math.max(minRatio, this.currentPixelRatio - step));
      } else if (this.gtaoPass?.enabled) {
        this.gtaoPass.enabled = false;
      } else if (this.smaaPass?.enabled) {
        this.smaaPass.enabled = false;
      } else if (this.bloomPass?.enabled) {
        this.bloomPass.enabled = false;
      }
      return;
    }
    // 持续流畅 3 秒以上后缓慢恢复画质
    if (avg < 0.0145) {
      this.qualityStableTimer += 1.3;
      if (this.qualityStableTimer < 3.9) return;
      this.qualityStableTimer = 0;
      if (this.bloomPass && !this.bloomPass.enabled) {
        this.bloomPass.enabled = true;
        return;
      }
      if (this.smaaPass && !this.smaaPass.enabled) {
        this.smaaPass.enabled = true;
        return;
      }
      if (this.quality === 'high' && this.gtaoPass && !this.gtaoPass.enabled) {
        this.gtaoPass.enabled = true;
        return;
      }
      if (this.currentPixelRatio < this.maxPixelRatio - 0.01) {
        this.applyPixelRatio(Math.min(this.maxPixelRatio, this.currentPixelRatio + 0.1));
      }
      return;
    }
    this.qualityStableTimer = 0;
  }

  animate() {
    const rawDt = this.clock.getDelta();
    if (document.hidden) return;
    // 登录页覆盖全屏时暂停 3D 渲染，减少手机发热与耗电
    if (!(this.loginScreen || (this.loginScreen = $('login-screen'))).classList.contains('hidden')) return;
    // 暂停时画面基本静止，降帧渲染进一步省电
    if (this.state !== 'playing') {
      this.idleFrameAccum += rawDt;
      const idleInterval = this.state === 'paused' ? 1 / 15
        : this.touchMode ? 1 / 20 : 1 / 30;
      if (this.idleFrameAccum < idleInterval) return;
      this.idleFrameAccum = 0;
    } else {
      this.idleFrameAccum = 0;
    }
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;
    this.pollGamepad(dt);
    this.updateEnvironment(dt);
    // 画质采样使用真实帧时间，避免低帧率时被 dt 上限拖延
    this.adjustQuality(Math.min(rawDt, 0.25));
    if (this.state === 'playing') {
      this.updatePlayer(dt);
      this.updatePlayerAvatar(dt);
      this.updateHealBuff(dt);
      this.updateScope(dt);
      this.updateWeapon(dt);
      this.updateGrenades(dt);
      this.updatePickups(dt);
      if (this.mode === 'bomb') {
        this.updateEnemies(dt);
        this.updateObjective(dt);
        this.updateEffects(dt);
        this.updateRound(dt);
      } else {
        this.updateTDM(dt);
        this.updateEffects(dt);
      }
      this.minimapUpdate = (this.minimapUpdate || 0) - dt;
      if (this.minimapUpdate <= 0) { this.updateMinimap(); this.minimapUpdate = 0.1; }
    } else {
      this.updateEffects(dt);
    }
    // 降质后阴影改为隔帧更新，进一步削峰；满血画质仍保持每帧更新
    this.shadowHalfRate = this.quality !== 'high'
      || this.currentPixelRatio < this.maxPixelRatio - 0.01
      || !this.gtaoPass?.enabled;
    if (this.shadowHalfRate) {
      this.shadowTick = (this.shadowTick + 1) % 2;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.shadowMap.needsUpdate = this.shadowTick === 0;
    } else {
      this.renderer.shadowMap.autoUpdate = true;
    }
    if (this.usePost) {
      if (this.gradePass) this.gradePass.uniforms.uTime.value = this.time;
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
  }
}
