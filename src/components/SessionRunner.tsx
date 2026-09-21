import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, PartyPopper, RotateCcw, Rocket, Star, TriangleAlert } from 'lucide-react';
import type { PracticeMode } from '../types';
import { type SessionItem, itemUnit } from '../lib/session-items';
import { speak } from '../lib/speech';
import { calcAccuracy, formatElapsed } from '../lib/stats';
import { hintFor } from '../data/fingerMap';
import { useLearning } from '../store/learning';
import type { SessionSummary, WordResult } from '../hooks/useTypingSession';
import { useTypingSession } from '../hooks/useTypingSession';
import WordCard from './WordCard';
import SentenceCard from './SentenceCard';
import TypingArea from './TypingArea';
import SentenceTypingArea from './SentenceTypingArea';
import VirtualKeyboard from './VirtualKeyboard';
import FingerGuide from './FingerGuide';
import ModeSwitcher from './ModeSwitcher';
import StatPanel from './StatPanel';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
  /** 会话标题（空态与摘要文案用） */
  title: string;
  items: SessionItem[];
  /** 当前练习模式（切换即写设置并重建条目） */
  mode: PracticeMode;
  /** WordCard / SentenceCard 角标（复习 / 错词） */
  badge?: string;
  onResult: (r: WordResult) => void;
  /** 摘要页"下一批"按钮：重建队列（如取下一组新词） */
  onRebuild?: () => void;
}

/** 通用打字会话 UI：新词练习 / 复习 / 错词专项共用 */
export default function SessionRunner({ title, items, mode, badge, onResult, onRebuild }: Props) {
  const { state, dispatch } = useLearning();
  const { rate, voiceURI, wordIntervalMs, showHandGuide, showKeyboard } = state.settings;
  /** 用户点击开始后，将焦点移到练习区域。 */
  const [startedOnce, setStartedOnce] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  /** 连对激励：连对每满 5 条 +1 ⭐（立即入账，中途退出不丢） */
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const starsRef = useRef(0);

  const handleResult = (r: WordResult) => {
    onResult(r);
    if (r.correct) {
      comboRef.current += 1;
      if (comboRef.current % 5 === 0) {
        starsRef.current += 1;
        dispatch({ type: 'ADD_STARS', count: 1 });
      }
    } else {
      comboRef.current = 0;
    }
    setCombo(comboRef.current);
  };

  const finishSession = (s: SessionSummary) => {
    setSummary(s);
  };

  const resetSession = (fn?: () => void) => {
    starsRef.current = 0;
    comboRef.current = 0;
    setCombo(0);
    setSummary(null);
    setStartedOnce(false);
    fn?.();
  };

  // 引用稳定：speakOptions 若每帧新建，"新条目自动朗读" effect 会在计时器每次刷新时重读
  const speakOptions = useMemo(() => ({ rate, voiceURI }), [rate, voiceURI]);

  const {
    current,
    index,
    total,
    phase,
    inputLen,
    wrongIndex,
    wrongChar,
    capsLockOn,
    correctKeys,
    wrongKeys,
    elapsedSec,
    restart,
    skip,
    beginSession,
  } = useTypingSession({
    items,
    inputRef,
    wordIntervalMs,
    speakOptions,
    onWordResult: handleResult,
    onSessionComplete: finishSession,
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const keyRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    setStartedOnce(false);
    setSummary(null);
    setCombo(0);
    comboRef.current = 0;
    starsRef.current = 0;
  }, [items]);
  useEffect(() => { if (startedOnce) inputRef.current?.focus(); }, [startedOnce]);
  const showStartScreen = !startedOnce && phase !== 'done';
  const processed = phase === 'done' ? total : index + (phase === 'celebrating' ? 1 : 0);
  // 高亮/提示用目标字符统一小写：键盘键帽是小写，例句句首可能大写（如 I）
  const rawNext = phase === 'ready' || phase === 'typing' ? (current?.text[inputLen] ?? null) : null;
  const nextChar = rawNext === null ? null : rawNext.toLowerCase();
  const hint = nextChar ? hintFor(nextChar) : undefined;
  const unit = itemUnit(mode);
  const isSentence = current?.kind === 'sentence';

  if (items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-16">
        <Card className="px-6 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <PartyPopper className="size-6 text-muted-foreground" />
          </span>
          <p className="mt-4 text-lg font-semibold">今日没有{title}任务</p>
          <p className="mt-1 text-sm text-muted-foreground">休息一下，或去看看别的练习</p>
          <span className="mt-6 inline-flex">
            <Link
              to="/"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-8 text-base font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
            >
              回首页，看看今天练什么
            </Link>
          </span>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col gap-3 px-4 py-3">
      {/* 大写锁定提示 */}
      {capsLockOn && (
        <p className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-warn/10 soft:bg-warn-soft px-4 py-2 text-center text-sm font-medium text-warn">
          <TriangleAlert className="size-4 shrink-0" />
          大写锁定（CapsLock）已开启，请关闭后再继续
        </p>
      )}

      {showStartScreen ? (
        <Card className="my-8 items-center gap-5 px-5 py-10 text-center">
          <h1 className="text-2xl font-bold">准备好了吗？</h1>
          <p className="text-base leading-8">先听单词 → 看亮起的键 → 用提示的手指按下去。</p>
          <ModeSwitcher mode={mode} onChange={(m) => dispatch({ type: 'SETTINGS', patch: { practiceMode: m } })} />
          <Button size="lg" onClick={() => { beginSession(); setStartedOnce(true); }}><Rocket />开始{title}</Button>
          <p className="text-sm text-muted-foreground">使用实体键盘，按错也没关系。</p>
        </Card>
      ) : phase === 'done' && summary ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <Card className="px-6 py-10 text-center">
          {summary.completedWords > 0 && <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-correct/10 soft:bg-correct-soft">
            <PartyPopper className="size-6 text-correct" />
          </span>}
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{summary.completedWords > 0 ? '这一组练完啦' : '这一组先放一放'}</h2>
          <p className="mt-2 text-muted-foreground">{summary.completedWords > 0 ? `认真练完了 ${summary.completedWords} 项，休息一下吧。` : '这次还没有练完题目，准备好后再来。'}</p>
          {starsRef.current > 0 && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-lg font-bold text-warn">
              <Star className="size-5 fill-current" />
              获得 {starsRef.current} 颗星星！
            </p>
          )}
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/60 px-2 py-4">
              <div className="text-sm font-medium text-muted-foreground">一次全对</div>
              <div className="mt-1 text-2xl font-bold text-correct">
                {summary.correctWords}/{summary.totalWords}
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 px-2 py-4">
              <div className="text-sm font-medium text-muted-foreground">按键准确率</div>
              <div className="mt-1 text-2xl font-bold">{correctKeys + wrongKeys > 0 ? `${calcAccuracy(correctKeys, wrongKeys)}%` : '—'}</div>
            </div>
            <div className="rounded-lg bg-muted/60 px-2 py-4">
              <div className="text-sm font-medium text-muted-foreground">用时</div>
              <div className="mt-1 font-mono text-2xl font-bold">{formatElapsed(elapsedSec)}</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/" className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-6 py-3 text-primary-foreground">休息一下，回首页</Link>
            {onRebuild && (
              <Button size="lg" variant="secondary" onClick={() => resetSession(onRebuild)}>
                再练一组
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => resetSession(restart)}>
              <RotateCcw />
              重练本组
            </Button>

          </div>
          </Card>
        </div>
      ) : (
        current && (
          <>
            {/* 顶栏：题目进度和跳过，详细统计默认收起。 */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                {title} · 第 {index + 1} / {total} {unit}
                {combo >= 2 && (
                  <span className="inline-flex animate-celebrate items-center gap-1 rounded-md bg-warn/10 soft:bg-warn-soft px-2 py-0.5 text-sm font-bold text-warn">
                    <Flame className="size-3 fill-current" />
                    连对 {combo}
                  </span>
                )}
              </span>
              <div role="progressbar" aria-label="已处理题目" aria-valuemin={0} aria-valuemax={total} aria-valuenow={processed} className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-correct transition-all duration-300"
                  style={{ width: `${(processed / total) * 100}%` }}
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => { skip(); inputRef.current?.focus(); }} disabled={phase === 'celebrating'}
              >
                先跳过
              </Button>
            </div>

            {total > items.length && <p role="status" className="text-sm text-review">再巩固一下：新增 {total - items.length} 项</p>}
            <section aria-label="练习详情" className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <h2 className="font-medium">练习详情</h2>
              <StatPanel elapsedSec={elapsedSec} correctKeys={correctKeys} wrongKeys={wrongKeys} />
            </section>

            {/* 中部：卡片 + 打字区 + 键盘作为一个分组整体居中 */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
              {isSentence && current.sentence ? (
                <SentenceCard
                  word={current.word}
                  sentence={current.sentence}
                  celebrating={phase === 'celebrating'}
                  badge={badge}
                  onSpeak={() => speak(current.text, speakOptions)}
                />
              ) : (
                <WordCard
                  word={current.word}
                  celebrating={phase === 'celebrating'}
                  badge={badge}
                  onSpeak={() => speak(current.word.word, speakOptions)}
                />
              )}

              <div ref={inputRef} tabIndex={0} role="group" aria-label="打字练习区" aria-describedby="typing-help"
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onClick={() => inputRef.current?.focus()}
                className="w-full cursor-text space-y-3 rounded-xl p-3">
                <p className="text-center text-sm text-muted-foreground">{focused ? '可以开始打字啦' : '点击这里，或用 Tab 回到这里继续打字'}</p>
                {isSentence ? (
                  <SentenceTypingArea
                    sentence={current.text}
                    nextIndex={inputLen}
                    wrongIndex={wrongIndex}
                  />
                ) : (
                  <TypingArea word={current.text} nextIndex={inputLen} wrongIndex={wrongIndex} />
                )}
                {hint && nextChar ? (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: `var(--finger-guide, ${hint.color})` }} />
                    用<b className="text-foreground">{hint.label}</b>
                    按{' '}
                    <b className="font-mono uppercase text-foreground">
                      {nextChar === ' ' ? '空格' : nextChar}
                    </b>{' '}
                    键
                  </p>
                ) : (
                  <p className="text-center text-sm text-correct">✨ 太棒了！</p>
                )}
                <p id="typing-help" className="text-center text-sm text-muted-foreground">按错不用删除，按对的键就能继续</p>
                {wrongIndex !== null && <p role="status" className="rounded-lg border-2 border-target p-2 text-center text-target">试试{showKeyboard ? '亮起的 ' : '实体键盘上的 '}{nextChar === ' ' ? '空格' : nextChar?.toUpperCase()} 键</p>}
              </div>

              {showKeyboard && <p className="text-center text-sm text-muted-foreground">键位提示图 · 请按实体键盘上的按键</p>}
              {/* 保留指法图空间 */}
              {showKeyboard && (
                <section
                  ref={boardRef}
                  className={`relative w-full shrink-0 rounded-xl border bg-card px-2 pt-3 shadow-sm ${showHandGuide ? 'pb-32' : 'pb-3'}`}
                >
                  <VirtualKeyboard targetChar={nextChar} wrongChar={wrongChar} keyRefs={keyRefs} />
                  {showHandGuide && (
                    <FingerGuide
                      containerRef={boardRef}
                      keyRefs={keyRefs}
                      targetChar={nextChar}
                      wrongChar={wrongChar}
                    />
                  )}
                </section>
              )}
            </div>
          </>
        )
      )}

    </main>
  );
}
