/**
 * 键盘音效：WebAudio oscillator 合成，零音频资产文件。
 * 对 = 上行双音、错 = 低沉短音、整词完成 = 上行琶音。
 * AudioContext 需要用户手势后才能出声，首次手势调用 unlockAudio()。
 */

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.5;

export function setSoundEnabled(v: boolean): void {
  enabled = v;
}

export function setSoundVolume(v: number): void {
  volume = Math.min(1, Math.max(0, v));
}

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
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
  if (!c) return;
  const t0 = c.currentTime + delaySec;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume * 0.25, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durSec);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durSec + 0.05);
}

/** 答对：短促上行双音 */
export function playCorrect(): void {
  if (!enabled) return;
  tone(660, 0, 0.09);
  tone(880, 0.07, 0.12);
}

/** 答错：低沉短音 */
export function playWrong(): void {
  if (!enabled) return;
  tone(180, 0, 0.18);
}

/** 整词完成：上行琶音 */
export function playComplete(): void {
  if (!enabled) return;
  tone(523, 0, 0.1);
  tone(659, 0.09, 0.1);
  tone(784, 0.18, 0.16);
}
