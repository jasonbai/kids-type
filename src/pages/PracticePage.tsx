import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Word } from '../types';
import { ALL_WORDS, poolFor } from '../data/vocab';
import { buildDailyQueue } from '../lib/queue';
import { buildItems } from '../lib/session-items';
import { useLearning } from '../store/learning';
import SessionRunner from '../components/SessionRunner';

/** 新词练习：词池按设置中的 currentLevel，词量取今日新词（游标续接） */
export default function PracticePage() {
  const { state, dispatch } = useLearning();
  const { records, meta, settings } = state;
  const mode = settings.practiceMode;

  const build = useCallback(
    () =>
      buildDailyQueue({
        allVocab: ALL_WORDS,
        levelVocab: poolFor(settings.currentLevel),
        records,
        cursor: meta.newWordCursor[settings.currentLevel],
        dailyNew: settings.dailyNewWords,
      }).newWords,
    [records, meta.newWordCursor, settings.currentLevel, settings.dailyNewWords],
  );

  // 会话词表在进入页面时冻结；切词库或"下一批"时重建（避免练习中途被重置）
  const [sessionWords, setSessionWords] = useState<Word[]>(() => build());
  useEffect(() => {
    setSessionWords(build());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.currentLevel]);

  // 引用必须稳定：这样 store 每次 RESULT 触发重渲染时不会重置会话
  const items = useMemo(() => buildItems(sessionWords, mode), [sessionWords, mode]);

  return (
    <SessionRunner
      title="新词练习"
      items={items}
      mode={mode}
      onResult={(r) => dispatch({ type: 'RESULT', result: r })}
      onRebuild={() => setSessionWords(build())}
    />
  );
}
