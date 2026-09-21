// @vitest-environment jsdom
import { act, createElement as h } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LearningProvider } from '../store/learning';
import { ThemeProvider } from '../context/theme-provider';
import { KEYS } from '../storage/keys';
import { wordItem, type SessionItem } from '../lib/session-items';
import SessionRunner from './SessionRunner';
import SettingsDialog from './SettingsDialog';
import HomePage from '../pages/HomePage';
import StatsPage from '../pages/StatsPage';

vi.mock('../lib/speech', () => ({ speak: vi.fn(), unlockSpeech: vi.fn(), listEnglishVoices: () => [] }));
vi.mock('../lib/sound', () => ({ panForCode: () => 0, playComplete: vi.fn(), playTypeKey: vi.fn(), playWrong: vi.fn(), unlockAudio: vi.fn(), setSoundEnabled: vi.fn(), setSoundVolume: vi.fn() }));

const word = { id: 'apple', word: 'apple', meaning: '苹果', phonetic: '', levels: ['KET'] as ['KET'] };
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  localStorage.setItem(KEYS.settings, JSON.stringify({ showHandGuide: false }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  // jsdom does not implement native modal behavior. Browser checks cover trapping.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector<HTMLElement>('button')?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });
function render(child: ReturnType<typeof h>) {
  act(() => root.render(h(MemoryRouter, null, h(ThemeProvider, null, h(LearningProvider, null, child)))));
}
function button(text: string) {
  const target = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text));
  if (!target) throw new Error(`Missing button: ${text}`);
  return target;
}
function click(text: string) { act(() => button(text).click()); }
function press(target: Element, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  act(() => { target.dispatchEvent(event); });
  return event;
}
function start(items: SessionItem[] = [wordItem(word)], mode: 'word' | 'mixed' | 'sentence' = 'word') {
  const result = vi.fn();
  render(h(SessionRunner, { title: '测试', items, mode, onResult: result }));
  click('开始测试');
  return { result, input: container.querySelector<HTMLElement>('[aria-label="打字练习区"]')! };
}

describe('child-friendly practice', () => {
  it('starts at zero, hides mode controls, shows details, and preserves Tab/arrow navigation', () => {
    const { input } = start();
    expect(document.activeElement).toBe(input);
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    expect(container.querySelector('[aria-label="练习模式"]')).toBeNull();
    expect(container.querySelector('section[aria-label="练习详情"]')?.textContent).toContain('准确率');
    expect(container.querySelector('details')).toBeNull();
    expect(press(input, 'Tab').defaultPrevented).toBe(false);
    expect(press(input, 'ArrowLeft').defaultPrevented).toBe(false);
  });
  it('ignores typing outside the focused surface and while a modal is open', () => {
    const { input, result } = start();
    const other = document.createElement('input'); container.append(other);
    act(() => other.focus());
    for (const key of 'apple') press(other, key);
    act(() => input.focus());
    const dialog = document.createElement('dialog'); dialog.setAttribute('open', ''); container.append(dialog);
    for (const key of 'apple') press(input, key);
    expect(result).not.toHaveBeenCalled();
    dialog.remove();
    for (const key of 'apple') press(input, key);
    expect(result).toHaveBeenCalledTimes(1);
    expect(result.mock.calls[0][0].correct).toBe(true);
  });
  it('explains mistakes, appends only one retry, and counts processed entries', () => {
    const { input, result } = start();
    press(input, 'z');
    expect(container.textContent).toContain('试试亮起的 A 键');
    for (const key of 'apple') press(input, key);
    expect(result.mock.calls[0][0].correct).toBe(false);
    expect(container.textContent).toContain('再巩固一下：新增 1 项');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuemax')).toBe('2');
    act(() => vi.advanceTimersByTime(800));
    press(input, 'z');
    for (const key of 'apple') press(input, key);
    act(() => vi.advanceTimersByTime(800));
    expect(result).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('认真练完了 2 项');
    expect(container.textContent).toContain('休息一下，回首页');
  });
  it('does not praise an all-skipped session and can restart', () => {
    const { result } = start();
    click('先跳过');
    expect(result).not.toHaveBeenCalled();
    expect(container.textContent).toContain('这一组先放一放');
    expect(container.textContent).not.toContain('100%');
    click('重练本组');
    expect(container.textContent).toContain('准备好了吗');
    click('开始测试');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  });
  it.each(['sentence', 'mixed'] as const)('keeps %s input working including spaces and punctuation', mode => {
    const sentence: SessionItem = { key: 'apple#1', kind: 'sentence', word, text: 'An apple.', sentence: { en: 'An apple.', cn: '一个苹果。' } };
    const { input, result } = start(mode === 'mixed' ? [wordItem(word), sentence] : [sentence], mode);
    if (mode === 'mixed') { for (const key of 'apple') press(input, key); act(() => vi.advanceTimersByTime(800)); }
    for (const key of 'An apple.') press(input, key);
    act(() => vi.advanceTimersByTime(800));
    expect(result.mock.calls.at(-1)?.[0]).toMatchObject({ kind: 'sentence', correct: true });
    expect(container.textContent).toContain('这一组练完啦');
  });
});

describe('settings and empty states', () => {
  it('opens a labelled modal, folds parent tools, and restores the opener on cancel', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const close = vi.fn(() => render(h(SettingsDialog, { open: false, onClose: close })));
    render(h(SettingsDialog, { open: true, onClose: close }));
    const dialog = container.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute('aria-labelledby')).toBe('settings-title');
    expect(container.querySelector('details')?.open).toBe(false);
    act(() => { dialog.dispatchEvent(new Event('cancel')); });
    expect(close).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
  it('shows one recommended new-word action and no empty-review detour', () => {
    render(h(HomePage));
    expect(container.textContent).toContain('开始练习');
    expect(container.textContent).not.toContain('去看看');
    expect(container.querySelectorAll('a.bg-primary')).toHaveLength(1);
    expect(container.querySelector('a.bg-primary')?.getAttribute('href')).toBe('/practice');
  });
  it('prioritizes due words over new words', () => {
    localStorage.setItem(KEYS.records, JSON.stringify({ the: { wordId: 'the', dueDate: '2000-01-01', ease: 2.5, reps: 1, interval: 1, lapses: 0, lastReviewAt: '' } }));
    render(h(HomePage));
    expect(container.querySelector('a.bg-primary')?.getAttribute('href')).toBe('/review');
  });
  it('offers progress when the selected custom vocabulary is exhausted', () => {
    localStorage.setItem(KEYS.customWords, JSON.stringify([{ ...word, levels: ['CUSTOM'] }]));
    localStorage.setItem(KEYS.settings, JSON.stringify({ currentLevel: 'CUSTOM' }));
    localStorage.setItem(KEYS.records, JSON.stringify({ apple: { wordId: 'apple', dueDate: '2999-01-01', ease: 2.5, reps: 1, interval: 1, lapses: 0, lastReviewAt: '' } }));
    render(h(HomePage));
    expect(container.querySelectorAll('a.bg-primary')).toHaveLength(1);
    expect(container.querySelector('a.bg-primary')?.getAttribute('href')).toBe('/stats');
  });
  it('does not claim 100 percent accuracy before any practice', () => {
    render(h(StatsPage));
    expect(container.textContent).not.toContain('100%');
    expect(container.textContent).toContain('练习后显示');
    expect(container.textContent).toContain('词库练习进度');
  });
});
