import { useMemo, useRef, useState } from 'react';
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
  const { rate, voiceURI, wordIntervalMs, showHandGuide } = state.settings;
  /** 首次"开始练习"引导是否已关闭（点击或按键均可开始） */
  const [startedOnce, setStartedOnce] = useState(false);
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
    wordIntervalMs,
    speakOptions,
    onWordResult: handleResult,
    onSessionComplete: finishSession,
  });

  const boardRef = useRef<HTMLDivElement>(null);
  const keyRefs = useRef(new Map<string, HTMLButtonElement>());

  const showStartOverlay = phase === 'ready' && !startedOnce;
  // 高亮/提示用目标字符统一小写：键盘键帽是小写，例句句首可能大写（如 I）
  const rawNext = phase === 'ready' || phase === 'typing' ? (current?.text[inputLen] ?? null) : null;
  const nextChar = rawNext === null ? null : rawNext.toLowerCase();
  const hint = nextChar ? hintFor(nextChar) : undefined;
  const unit = itemUnit(mode);
  const isSentence = current?.kind === 'sentence';

  if (items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-16">
        <Card className="px-6 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <PartyPopper className="size-6 text-muted-foreground" />
          </span>
          <p className="mt-4 text-lg font-semibold">今日没有{title}任务</p>
          <p className="mt-1 text-sm text-muted-foreground">休息一下，或去看看别的练习</p>
          <span className="mt-6 inline-flex">
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-xs transition hover:bg-primary/90"
            >
              回到今日任务
            </Link>
          </span>
        </Card>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-3">
      {/* 大写锁定提示 */}
      {capsLockOn && (
        <p className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-warn/10 px-4 py-2 text-center text-sm font-medium text-warn">
          <TriangleAlert className="size-4 shrink-0" />
          大写锁定（CapsLock）已开启，请关闭后再继续
        </p>
      )}

      {phase === 'done' && summary ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <Card className="px-6 py-10 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-correct/10">
            <PartyPopper className="size-6 text-correct" />
          </span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight">{title}完成！</h2>
          {starsRef.current > 0 && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-lg font-bold text-warn">
              <Star className="size-5 fill-current" />
              获得 {starsRef.current} 颗星星！
            </p>
          )}
          <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/60 px-2 py-4">
              <div className="text-xs font-medium text-muted-foreground">正确{unit}数</div>
              <div className="mt-1 text-2xl font-bold text-correct">
                {summary.correctWords}/{summary.totalWords}
              </div>
            </div>
            <div className="rounded-lg bg-muted/60 px-2 py-4">
              <div className="text-xs font-medium text-muted-foreground">按键准确率</div>
              <div className="mt-1 text-2xl font-bold">{calcAccuracy(correctKeys, wrongKeys)}%</div>
            </div>
            <div className="rounded-lg bg-muted/60 px-2 py-4">
              <div className="text-xs font-medium text-muted-foreground">用时</div>
              <div className="mt-1 font-mono text-2xl font-bold">{formatElapsed(elapsedSec)}</div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {onRebuild && (
              <Button size="lg" onClick={() => resetSession(onRebuild)}>
                下一批 →
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => resetSession(restart)}>
              <RotateCcw />
              重练本组
            </Button>
            <Link
              to="/"
              className="rounded-md px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              回到今日任务
            </Link>
          </div>
          </Card>
        </div>
      ) : (
        current && (
          <>
            {/* 顶栏：标题进度 + 模式切换 + 实时统计 + 跳过 */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-2">
                {title} · 第 {index + 1} / {total} {unit}
                {combo >= 2 && (
                  <span className="inline-flex animate-celebrate items-center gap-1 rounded-md bg-warn/10 px-2 py-0.5 text-xs font-bold text-warn">
                    <Flame className="size-3 fill-current" />
                    连对 {combo}
                  </span>
                )}
              </span>
              <ModeSwitcher
                mode={mode}
                onChange={(m) => dispatch({ type: 'SETTINGS', patch: { practiceMode: m } })}
              />
              <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-correct transition-all duration-300"
                  style={{ width: `${((index + 1) / total) * 100}%` }}
                />
              </div>
              <StatPanel elapsedSec={elapsedSec} correctKeys={correctKeys} wrongKeys={wrongKeys} />
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground"
                onClick={skip}
              >
                跳过 →
              </Button>
            </div>

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

              <section className="space-y-2.5">
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
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: hint.color }} />
                    用<b style={{ color: hint.color }}>{hint.label}</b>
                    按{' '}
                    <b className="font-mono uppercase text-foreground">
                      {nextChar === ' ' ? '空格' : nextChar}
                    </b>{' '}
                    键
                  </p>
                ) : (
                  <p className="text-center text-sm text-correct">✨ 太棒了！</p>
                )}
              </section>

              <section
                ref={boardRef}
                className="relative w-full shrink-0 rounded-xl border bg-card px-4 pb-32 pt-3 shadow-sm"
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
            </div>
          </>
        )
      )}

      {/* 开始遮罩盖住整个练习区（卡片 + 键盘），而非仅键盘 */}
      {showStartOverlay && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/85 backdrop-blur-sm">
          <p className="text-lg font-semibold">准备好了吗？</p>
          <Button
            size="lg"
            className="px-10 text-lg font-bold"
            onClick={() => {
              beginSession();
              setStartedOnce(true);
            }}
          >
            <Rocket />
            开始{title}
          </Button>
          <p className="text-sm text-muted-foreground">点击开始，或直接按任意字母键</p>
        </div>
      )}
    </main>
  );
}
