import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, BookX, Flame, Sprout } from 'lucide-react';
import { LEVEL_LABELS, allWords, poolFor } from '../data/vocab';
import { buildDailyQueue } from '../lib/queue';
import { todayKey } from '../lib/dateKey';
import { activeWrongBook, useLearning } from '../store/learning';
import { Card } from '../components/ui/card';

export default function HomePage() {
  const { state } = useLearning();
  const { records, meta, settings } = state;

  const todayLog = state.logs.find((l) => l.date === todayKey());
  /** 今日已完成的新词数（旧日志无此字段按 0） */
  const learnedToday = todayLog?.newWordsLearned ?? 0;
  const dailyNew = settings.dailyNewWords;

  const queue = useMemo(
    () =>
      buildDailyQueue({
        allVocab: allWords(),
        levelVocab: poolFor(settings.currentLevel),
        records,
        cursor: meta.newWordCursor[settings.currentLevel],
        dailyNew: settings.dailyNewWords,
      }),
    [records, meta.newWordCursor, settings.currentLevel, settings.dailyNewWords],
  );

  const wrongCount = useMemo(() => activeWrongBook(state).length, [state]);

  const hasReview = queue.dueWords.length > 0;
  const hasNew = queue.newWords.length > 0;
  const nextPath = hasReview ? '/review' : hasNew ? '/practice' : wrongCount > 0 ? '/wrong' : '/stats';
  const nextLabel = hasReview ? '复习一下' : hasNew ? '开始练习' : wrongCount > 0 ? '打开错题本' : '看看我的进步';

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8">
      <section className="rounded-xl border bg-card p-6 sm:p-8">
        <p className="text-sm text-muted-foreground">今天练什么 · {LEVEL_LABELS[settings.currentLevel]}</p>
        <h1 className="mt-2 text-3xl font-bold">{hasReview ? '和学过的单词见个面' : hasNew ? '一起练几个单词吧' : '今天的任务都看过啦'}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {hasReview ? `有 ${queue.dueWords.length} 个单词等你复习。慢慢来，按对每一个键。`
            : hasNew ? `这一组有 ${Math.min(dailyNew, queue.newWords.length)} 个新词。听一听，再动手试试。`
            : wrongCount > 0 ? '还可以把需要巩固的单词再练一练。' : '可以休息一下，也可以看看自己的练习记录。'}
        </p>
        <Link to={nextPath} className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground">{nextLabel}<ArrowRight className="size-5" /></Link>
      </section>

      <div className="flex flex-wrap gap-x-6 gap-y-2 px-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><Flame className="size-4" />连续打卡 {meta.streakDays} 天</span>
        <span>累计星星 {meta.totalStars}</span>
        <span>今天已练 {todayLog?.wordsTyped ?? 0} 词</span>
      </div>

      <section aria-label="其他练习" className="grid gap-4 sm:grid-cols-2">
        <Card className="gap-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5 text-review" />复习一下</h2>
          <p className="text-base text-muted-foreground">{hasReview ? `${queue.dueWords.length} 个熟悉的单词等你来` : '今天暂时没有要复习的单词'}</p>
          {hasReview && <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" to="/review">去复习</Link>}
        </Card>
        <Card className="gap-3 p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Sprout className="size-5 text-target" />学新词</h2>
          <p className="text-base text-muted-foreground">{!hasNew ? '这个词库的新词已经练过一遍啦' : learnedToday > 0 ? `今天已学 ${learnedToday} 个新词` : '听一听单词，再跟着键位提示练习'}</p>
          {hasNew && <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" to="/practice">{learnedToday >= dailyNew ? '想练的话，再来一组' : '去学新词'}</Link>}
        </Card>
      </section>
      <Link to="/wrong" className="block rounded-xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><BookX className="size-5 text-review" />错题本</h2>
        <p className="mt-2 text-base text-muted-foreground">{wrongCount > 0 ? `${wrongCount} 个单词需要巩固，按错也没关系` : '暂时没有需要加强的单词'}</p>
      </Link>
      <p className="text-center text-sm text-muted-foreground">练过的单词，以后还会陪你复习</p>
    </main>
  );
}
