/**
 * 音效层：
 * - 击键音 = 真实机械打字机录音切片（public/sounds/typewriter.ogg）。
 *   来源 BigSoundBank "Typewriter #2"（Hermes Precisa 305，1960 年代瑞士
 *   台式打字机），CC0 公有领域。首次击键时懒加载整段录音并扫描出每次
 *   击键的峰值偏移，之后每次击键随机播放一个 ~80ms 切片，因此每次声音
 *   都略有不同（真实打字机质感）。实现方式移植自 type-review（MIT）。
 * - 反馈音 = WebAudio oscillator 合成：错 = 低沉短音、整词完成 = 上行琶音。
 * - 立体声 pan：按物理键位（event.code）左右轻微偏移，头戴听感更真实。
 * AudioContext 需要用户手势后才能出声，首次手势调用 unlockAudio()。
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let volume = 0.5;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

export function setSoundVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
  if (master && ctx) {
    // setTargetAtTime 平滑变化，避免音量跳变产生"咔"声
    master.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 在用户首次手势（点击/按键）时调用一次，解锁音频 */
export function unlockAudio(): void {
  try {
    ensureCtx();
  } catch {
    // 无音频环境静默降级
  }
}

function tone(freq: number, delaySec: number, durSec: number): void {
  const c = ensureCtx();
  if (!c || !master) return;
  const t0 = c.currentTime + delaySec;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume * 0.25, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.05);
}

/** 答错：低沉短音（不打字机音，保证错误反馈的辨识度） */
export function playWrong(): void {
  if (!enabled) return;
  tone(180, 0, 0.18);
}

/** 整词完成：打字机音 + 上行琶音庆祝 */
export function playComplete(): void {
  if (!enabled) return;
  tone(523, 0, 0.1);
  tone(659, 0.09, 0.1);
  tone(784, 0.18, 0.16);
}

/* ─────────────── 打字机击键音（sprite 切片） ─────────────── */

export type TypeKeyCategory = 'default' | 'space';

const TYPE_SOUND_URL = '/sounds/typewriter.ogg';
/** 切片时长：真实击键约 50-70ms 衰减，空格略长更有"体感" */
const SLICE_MS: Record<TypeKeyCategory, number> = { default: 80, space: 110 };

// 峰值扫描参数（移植自 type-review sound-packs.ts）
const PEAK_THRESHOLD = 0.3; // 判定为一次击键起振的最小振幅
const PEAK_MIN_GAP_MS = 100; // 两个峰的最小间距（避免同一击键采两次）
const PRE_ROLL_SEC = 0.002; // 起振点稍向前回退，让淡入落在上升沿
const FADE_IN_SEC = 0.0015; // 淡入要短，保留瞬态（长了会吃掉"咔"）
const FADE_OUT_SEC = 0.008; // 淡出略长：切片尾部截断的残响比头部明显

/**
 * 扫描解码后的录音，返回每次击键起振的时间点（秒）。
 * 播放时从这些"已知好听"的偏移里随机挑一个，而不是全曲随机——
 * 全曲随机大多落在击键之间的死寂里，听感发闷。
 * 纯函数：线性扫一遍采样，83s 录音约 1ms。
 */
export function findPeakOffsets(data: Float32Array, sampleRate: number): number[] {
  const minGapSamples = Math.max(1, Math.floor((PEAK_MIN_GAP_MS / 1000) * sampleRate));
  const preRollSamples = Math.floor(PRE_ROLL_SEC * sampleRate);
  const offsets: number[] = [];
  let lastPeakIdx = -minGapSamples;
  for (let i = 0; i < data.length; i++) {
    const sample = data[i];
    if (sample === undefined) continue;
    if (Math.abs(sample) >= PEAK_THRESHOLD && i - lastPeakIdx >= minGapSamples) {
      offsets.push(Math.max(0, (i - preRollSamples) / sampleRate));
      lastPeakIdx = i;
    }
  }
  return offsets;
}

/**
 * 打字机 sprite 状态：整段录音的 AudioBuffer + 预扫描的峰值偏移。
 * buffer 为 null 表示尚未加载完成（懒加载：第一次击键才开始 fetch）。
 */
const sprite: { buffer: AudioBuffer | null; peaks: number[]; loading: boolean } = {
  buffer: null,
  peaks: [],
  loading: false,
};
/** 加载完成前最近一次击键（解码完成后补一声，避免第一键无声） */
let pendingKey: { category: TypeKeyCategory; pan: number } | null = null;

function loadSprite(): void {
  const c = ensureCtx();
  if (!c || sprite.loading) return;
  sprite.loading = true;
  fetch(TYPE_SOUND_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((bytes) => c.decodeAudioData(bytes))
    .then((buf) => {
      sprite.buffer = buf;
      sprite.peaks = findPeakOffsets(buf.getChannelData(0), buf.sampleRate);
      // 补放加载完成前的那一次击键
      if (pendingKey) {
        const { category, pan } = pendingKey;
        pendingKey = null;
        playSlice(category, pan);
      }
    })
    .catch(() => {
      // 加载/解码失败（离线首访、老 Safari 不支持 Ogg 等）→ 击键静音，不影响反馈音
    });
}

function playSlice(category: TypeKeyCategory, pan: number): void {
  const c = ctx;
  const buffer = sprite.buffer;
  if (!c || !master || !buffer) return;
  const sliceSec = Math.min(SLICE_MS[category] / 1000, buffer.duration);
  const peaks = sprite.peaks;
  const offset =
    peaks.length > 0
      ? (peaks[Math.floor(Math.random() * peaks.length)] ?? 0)
      : Math.random() * Math.max(0, buffer.duration - sliceSec);

  // pan≠0 时插入 StereoPanner（物理键位左右偏移）
  let dest: AudioNode = master;
  if (pan !== 0 && typeof c.createStereoPanner === 'function') {
    const panner = c.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), c.currentTime);
    panner.connect(master);
    dest = panner;
  }

  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  const now = c.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + FADE_IN_SEC);
  gain.gain.setValueAtTime(1, now + Math.max(0, sliceSec - FADE_OUT_SEC));
  gain.gain.linearRampToValueAtTime(0, now + sliceSec);
  src.connect(gain).connect(dest);
  src.start(now, offset, sliceSec);
}

/**
 * 每次有效击键打一声打字机音。
 * @param category 普通键 / 空格（空格切片更长，更有"体感"）
 * @param pan 物理键位对应的立体声偏移（panForCode(e.code)）
 */
export function playTypeKey(category: TypeKeyCategory, pan = 0): void {
  if (!enabled) return;
  ensureCtx();
  if (!sprite.buffer) {
    pendingKey = { category, pan };
    loadSprite();
    return;
  }
  playSlice(category, pan);
}

/* ─────────── 物理键位 → 立体声 pan（移植自 type-review，MIT） ─────────── */

/** pan 幅度：头戴"能察觉、不夸张" */
const HAND_PAN_AMOUNT = 0.3;

/** QWERTY 左手物理键位（含中列 5/T/G/B 与左侧功能键），按 event.code */
const LEFT_CODES: ReadonlySet<string> = new Set([
  'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Tab',
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'CapsLock',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'ShiftLeft',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'Escape',
]);

/** QWERTY 右手物理键位（含中列 6/Y/H/N 与右侧键） */
const RIGHT_CODES: ReadonlySet<string> = new Set([
  'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace',
  'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash',
  'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter',
  'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight',
]);

/**
 * 物理键码 → 立体声 pan（[-1,+1]）。左手键偏左、右手键偏右，
 * 空格（双手拇指）与未知键位居中。按 event.code（物理位置）而非
 * event.key（产字符），对任何键位布局都正确。
 */
export function panForCode(code: string): number {
  if (LEFT_CODES.has(code)) return -HAND_PAN_AMOUNT;
  if (RIGHT_CODES.has(code)) return HAND_PAN_AMOUNT;
  return 0;
}
