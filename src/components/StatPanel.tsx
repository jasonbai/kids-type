import { calcAccuracy, calcWpm, formatElapsed } from '../lib/stats';

interface Props {
  elapsedSec: number;
  correctKeys: number;
  wrongKeys: number;
}

/** 实时统计：行内紧凑样式（嵌在练习页顶栏，不占独立一行）；WPM 弱显（儿童打字慢，主显 WPM 易挫败） */
export default function StatPanel({ elapsedSec, correctKeys, wrongKeys }: Props) {
  const accuracy = calcAccuracy(correctKeys, wrongKeys);
  const wpm = calcWpm(correctKeys, elapsedSec);
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
      <span className="text-muted-foreground">
        用时 <b className="font-mono text-foreground">{formatElapsed(elapsedSec)}</b>
      </span>
      <span className="text-muted-foreground">
        准确率{' '}
        <b
          className={
            accuracy >= 90 ? 'text-correct' : accuracy >= 70 ? 'text-warn' : 'text-wrong'
          }
        >
          {correctKeys + wrongKeys > 0 ? `${accuracy}%` : '—'}
        </b>
      </span>
      <span className="text-muted-foreground">
        速度 <b className="font-mono text-foreground">{wpm}</b> WPM
      </span>
    </span>
  );
}
