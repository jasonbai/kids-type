import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, BookX, Flame, Sprout } from 'lucide-react';
import { LEVEL_LABELS, allWords, poolFor } from '../data/vocab';
import { buildDailyQueue } from '../lib/queue';
import { todayKey } from '../lib/dateKey';
import { activeWrongBook, useLearning } from '../store/learning';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
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

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-8">
      {/* 打卡横幅 */}
      <section className="flex items-center justify-between rounded-xl bg-primary px-6 py-5 text-primary-foreground shadow-sm">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-primary-foreground/70 soft:text-primary-foreground">
            <Flame className="size-4 fill-current" />
            连续打卡
          </div>
          <div className="mt-1 text-3xl font-extrabold tracking-tight">{meta.streakDays} 天</div>
        </div>
        <div className="text-right text-sm text-primary-foreground/70 soft:text-primary-foreground">
          {todayLog ? (
            <>
              今日已练 <b className="text-lg text-primary-foreground">{todayLog.wordsTyped}</b> 词
              <br />
              用时 {Math.round(todayLog.totalSeconds / 60)} 分钟 · ⭐ {meta.totalStars}
            </>
          ) : (
            <>
              今天还没开始练习哦
              <br />
              累计 ⭐ {meta.totalStars}
            </>
          )}
        </div>
      </section>

      {/* 今日任务卡片 */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link to="/review" className="group">
          <Card className="h-full gap-0 p-6 transition-colors hover:border-review/50 hover:shadow-md">
            <span className="flex size-10 items-center justify-center rounded-lg bg-review/10 soft:bg-review-soft text-review">
              <BookOpen className="size-5" />
            </span>
            <div className="mt-3 text-lg font-semibold">复习到期词</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {queue.dueWords.length > 0
                ? `${queue.dueWords.length} 个单词到了复习时间`
                : '暂时没有到期的词'}
            </div>
            <span className="mt-4 inline-flex">
              <Button variant={queue.dueWords.length > 0 ? 'default' : 'secondary'}>
                {queue.dueWords.length > 0 ? '开始复习' : '去看看'}
                <ArrowRight />
              </Button>
            </span>
          </Card>
        </Link>

        <Link to="/practice" className="group">
          <Card className="h-full gap-0 p-6 transition-colors hover:border-primary/40 hover:shadow-md">
            <span className="flex size-10 items-center justify-center rounded-lg bg-target/10 soft:bg-target-soft text-target">
              <Sprout className="size-5" />
            </span>
            <div className="mt-3 flex items-center text-lg font-semibold">
              学新词
              <Badge variant="secondary" className="ms-2">
                {LEVEL_LABELS[settings.currentLevel]}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {queue.newWords.length === 0
                ? '这个词库的新词已经全部学完啦'
                : learnedToday === 0
                  ? `今日 ${Math.min(dailyNew, queue.newWords.length)} 个新词等你来`
                  : learnedToday < dailyNew
                    ? `今日已学 ${learnedToday}/${dailyNew} 个，继续加油`
                    : `今日已学 ${learnedToday} 个新词，可继续加练 ✨`}
            </div>
            <span className="mt-4 inline-flex">
              <Button variant={queue.newWords.length === 0 ? 'secondary' : 'default'}>
                {queue.newWords.length === 0 ? '去看看' : learnedToday >= dailyNew ? '继续加练' : '开始练习'}
                <ArrowRight />
              </Button>
            </span>
          </Card>
        </Link>
      </section>

      {/* 错题本 */}
      <Link to="/wrong">
        <Card className="flex items-center justify-between px-6 py-5 transition-colors hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-wrong/10 soft:bg-wrong-soft text-wrong">
              <BookX className="size-5" />
            </span>
            <div>
              <div className="font-semibold">错题本</div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {wrongCount > 0 ? `${wrongCount} 个词需要加强` : '没有错词，继续保持！'}
              </div>
            </div>
          </div>
          <span className="text-2xl font-bold text-muted-foreground/50">{wrongCount}</span>
        </Card>
      </Link>

      <p className="pb-6 text-center text-xs text-muted-foreground">
        打错的词会自动进错题本，并按艾宾浩斯曲线在后续几天反复出现
      </p>
    </main>
  );
}
