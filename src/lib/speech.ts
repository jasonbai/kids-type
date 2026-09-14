/**
 * Web Speech API 封装。两个已知的坑都在这里处理：
 * 1) getVoices() 首次调用返回空数组 → 监听 voiceschanged 后刷新缓存
 * 2) Safari/Chrome 要求用户手势之后才允许发声 → 页面首个手势调用 unlock()
 */

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): void {
  if (!supported) return;
  cachedVoices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

if (supported) {
  refreshVoices();
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

/** 音色挑选优先级：家长试听选定的 > 常见美音 > 任意英语音色 */
const PREFERRED = /samantha|google us english|aria|jenny|zira|moira|karen|serena/i;

export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (supported && cachedVoices.length === 0) refreshVoices();
  return cachedVoices;
}

export function findVoice(voiceURI: string | null): SpeechSynthesisVoice | undefined {
  const voices = listEnglishVoices();
  if (voiceURI) {
    const picked = voices.find((v) => v.voiceURI === voiceURI);
    if (picked) return picked;
  }
  return voices.find((v) => PREFERRED.test(v.name)) ?? voices[0];
}

/** 在用户首次手势（如点击"开始练习"）时调用一次，解锁自动朗读 */
export function unlockSpeech(): void {
  if (!supported) return;
  const u = new SpeechSynthesisUtterance('');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export interface SpeakOptions {
  rate?: number;
  voiceURI?: string | null;
}

/** 延迟入队用的定时器句柄（连点喇叭时取消上一个，防叠音） */
let speakTimer: number | undefined;
/** 持有最近一次 utterance：Chromium 会在 utterance 被 GC 时静默取消朗读 */
let lastUtterance: SpeechSynthesisUtterance | null = null;

export function speak(text: string, opts: SpeakOptions = {}): void {
  if (!supported || !text) return;
  const synth = window.speechSynthesis;

  const build = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = opts.rate ?? 1;
    const voice = findVoice(opts.voiceURI ?? null);
    if (voice) u.voice = voice;
    return u;
  };

  if (speakTimer !== undefined) {
    window.clearTimeout(speakTimer);
    speakTimer = undefined;
  }

  if (synth.speaking || synth.pending) {
    // Chromium 的 cancel 与同一 tick 内的 speak 会连新 utterance 一起丢弃，
    // 必须先 cancel、隔一拍再入队（否则点喇叭/试听音色全部静音）
    synth.cancel();
    speakTimer = window.setTimeout(() => {
      speakTimer = undefined;
      lastUtterance = build();
      synth.speak(lastUtterance);
    }, 60);
  } else {
    lastUtterance = build();
    synth.speak(lastUtterance);
  }
}
