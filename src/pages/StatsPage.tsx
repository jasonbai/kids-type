import { useMemo } from 'react';
import { BarChart3, Flame, Star } from 'lucide-react';
import { KET_WORDS, PET_WORDS } from '../data/vocab';
import { todayKey } from '../lib/dateKey';
import {
  calcAccuracy,
  calendarGridKeys,
  formatDuration,
  lastNDayKeys,
  shortDateLabel,
} from '../lib/stats';
import { isDue } from '../lib/srs';
import { useLearning } from '../store/learning';
import { Card } from '../components/ui/card';

export default function StatsPage() {
  const { state } = useLearning();
  const { records, logs, meta } = state;

  const today = todayKey();

  const totals = useMemo(() => {
    const wordsTyped = logs.reduce((a, l) => a + l.wordsTyped, 0);
    const correct = logs.reduce((a, l) => a + l.correctCount, 0);
    const wrong = logs.reduce((a, l) => a + l.wrongCount, 0);
    const seconds = logs.reduce((a, l) => a + l.totalSeconds, 0);
    return { wordsTyped, accuracy: calcAccuracy(correct, wrong), wrong, seconds };
  }, [logs]);

  const week = useMemo(() => {
    const byDate = new Map(logs.map((l) => [l.date, l]));
    const days = lastNDayKeys(7).map((key) => ({
      key,
      words: byDate.get(key)?.wordsTyped ?? 0,
    }));
    return { days, max: Math.max(1, ...days.map((d) => d.words)) };
  }, [logs]);

  const calendar = useMemo(() => {
    const done = new Set(logs.filter((l) => l.wordsTyped > 0).map((l) => l.date));
    return calendarGridKeys(4).map((key) => ({ key, done: done.has(key), future: key > today }));
  }, [logs, today]);

  const mastery = useMemo(() => {
    const all = Object.values(records);
    const status = {
      due: all.filter((r) => isDue(r, today)).length,
      learning: all.filter((r) => !isDue(r, today) && r.reps === 1).length,
      strong: all.filter((r) => !isDue(r, today) && r.reps >= 2).length,
    };
    return {
      KET: { learned: KET_WORDS.filter((w) => records[w.id]).length, total: KET_WORDS.length },
      PET: { learned: PET_WORDS.filter((w) => records[w.id]).length, total: PET_WORDS.length },
      status,
      learnedTotal: all.length,
    };
  }, [records, today]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <BarChart3 className="size-5 text-target" />
        学习统计
      </h1>

      {/* 总览 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="px-3 py-4 text-center">
          <div className="text-xs font-medium text-muted-foreground">累计练习</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">
            {totals.wordsTyped} <span className="text-xs font-medium text-muted-foreground">词</span>
          </div>
        </Card>
        <Card className="px-3 py-4 text-center">
          <div className="text-xs font-medium text-muted-foreground">总用时</div>
          <div className="mt-1 text-lg font-bold tracking-tight">{formatDuration(totals.seconds)}</div>
        </Card>
        <Card className="px-3 py-4 text-center">
          <div className="text-xs font-medium text-muted-foreground">平均准确率</div>
          <div
            className={`mt-1 text-2xl font-bold tracking-tight ${totals.accuracy >= 90 ? 'text-correct' : 'text-warn'}`}
          >
            {totals.accuracy}%
          </div>
        </Card>
        <Card className="px-3 py-4 text-center">
          <div className="text-xs font-medium text-muted-foreground">星星</div>
          <div className="mt-1 flex items-center justify-center gap-1 text-2xl font-bold tracking-tight text-warn">
            <Star className="size-4 fill-current" />
            {meta.totalStars}
          </div>
        </Card>
      </section>

      {/* 近 7 天柱状图 */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">近 7 天练习词数</h2>
        <div className="mt-4 flex h-40 items-end gap-2 sm:gap-4">
          {week.days.map((d) => {
            const isToday = d.key === today;
            return (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">{d.words || ''}</span>
                <div
                  title={`${d.key}：${d.words} 词`}
                  className={[
                    'w-full max-w-10 rounded-t-lg transition-all',
                    d.words === 0 ? 'bg-muted' : isToday ? 'bg-target' : 'bg-target/55',
                  ].join(' ')}
                  style={{ height: `${Math.max(4, (d.words / week.max) * 100)}%` }}
                />
                <span className={`text-xs ${isToday ? 'font-bold text-target' : 'text-muted-foreground'}`}>
                  {shortDateLabel(d.key)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 打卡日历 */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">打卡日历（近 4 周）</h2>
          <span className="inline-flex items-center gap-1 rounded-md bg-warn/10 px-2.5 py-1 text-xs font-bold text-warn">
            <Flame className="size-3.5 fill-current" />
            连续 {meta.streakDays} 天
          </span>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground/60">
              {d}
            </div>
          ))}
          {calendar.map((c) => (
            <div
              key={c.key}
              title={c.key}
              className={[
                'flex aspect-square items-center justify-center rounded-lg text-xs',
                c.future
                  ? 'opacity-0'
                  : c.done
                    ? 'bg-correct/15 font-bold text-correct'
                    : 'bg-muted text-muted-foreground/60',
                c.key === today ? 'ring-2 ring-target ring-offset-1 ring-offset-card' : '',
              ].join(' ')}
            >
              {Number(c.key.slice(-2))}
            </div>
          ))}
        </div>
      </Card>

      {/* 词库掌握度 */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-muted-foreground">词库掌握度</h2>
        <div className="mt-4 space-y-4">
          {(['KET', 'PET'] as const).map((lv) => {
            const { learned, total } = mastery[lv];
            const pct = Math.round((learned / total) * 100);
            return (
              <div key={lv}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-medium">{lv} 词库</span>
                  <span className="font-mono text-muted-foreground">
                    {learned} / {total}（{pct}%）
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-correct/70 to-correct transition-all duration-500"
                    style={{ width: `${Math.max(learned > 0 ? 2 : 0, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-wrong/5 px-2 py-3">
            <div className="text-xs font-medium text-muted-foreground">今日待复习</div>
            <div className="mt-0.5 text-xl font-bold text-wrong">{mastery.status.due}</div>
          </div>
          <div className="rounded-lg bg-target/5 px-2 py-3">
            <div className="text-xs font-medium text-muted-foreground">学习中</div>
            <div className="mt-0.5 text-xl font-bold text-target">{mastery.status.learning}</div>
          </div>
          <div className="rounded-lg bg-correct/5 px-2 py-3">
            <div className="text-xs font-medium text-muted-foreground">巩固中</div>
            <div className="mt-0.5 text-xl font-bold text-correct">{mastery.status.strong}</div>
          </div>
        </div>
      </Card>
    </main>
  );
}
