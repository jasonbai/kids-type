import { useCallback, useMemo, useState } from 'react';
import type { Word } from '../types';
import { allWords, poolFor } from '../data/vocab';
import { buildDailyQueue } from '../lib/queue';
import { buildItems } from '../lib/session-items';
import { useLearning } from '../store/learning';
import SessionRunner from '../components/SessionRunner';

/** 艾宾浩斯复习：今日到期词（不分词库，学过的都复习），带"复习"角标 */
export default function ReviewPage() {
  const { state, dispatch } = useLearning();
  const { records, meta, settings } = state;
  const mode = settings.practiceMode;

  const build = useCallback(
    () =>
      buildDailyQueue({
        allVocab: allWords(),
        levelVocab: poolFor(settings.currentLevel),
        records,
        cursor: meta.newWordCursor[settings.currentLevel],
        dailyNew: settings.dailyNewWords,
      }).dueWords,
    [records, meta.newWordCursor, settings.currentLevel, settings.dailyNewWords],
  );

  const [sessionWords, setSessionWords] = useState<Word[]>(() => build());
  // 引用必须稳定：store 每次 RESULT 触发重渲染时不能重置会话
  const items = useMemo(() => buildItems(sessionWords, mode), [sessionWords, mode]);

  return (
    <SessionRunner
      title="到期复习"
      badge="复习"
      items={items}
      mode={mode}
      onResult={(r) => dispatch({ type: 'RESULT', result: r })}
      onRebuild={() => setSessionWords(build())}
    />
  );
}
