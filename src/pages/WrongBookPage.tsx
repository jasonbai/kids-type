import { useMemo, useState } from 'react';
import { BookX, Sparkles } from 'lucide-react';
import { WORD_BY_ID } from '../data/vocab';
import { buildItems } from '../lib/session-items';
import { activeWrongBook, useLearning } from '../store/learning';
import SessionRunner from '../components/SessionRunner';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import type { Word } from '../types';

const PRACTICE_LIMIT = 20;

/** 错题本：未移出的错词列表 + 专项练习（连对 2 次自动移出） */
export default function WrongBookPage() {
  const { state, dispatch } = useLearning();
  const mode = state.settings.practiceMode;
  const entries = activeWrongBook(state);
  const [practiceWords, setPracticeWords] = useState<Word[] | null>(null);

  const pickWords = () =>
    activeWrongBook(state)
      .map((e) => WORD_BY_ID.get(e.wordId))
      .filter((w): w is Word => Boolean(w))
      .slice(0, PRACTICE_LIMIT);

  // 引用稳定：store 更新不会重置会话
  const items = useMemo(
    () => (practiceWords ? buildItems(practiceWords, mode) : []),
    [practiceWords, mode],
  );

  if (practiceWords) {
    return (
      <SessionRunner
        title="错词专项练习"
        badge="错词"
        items={items}
        mode={mode}
        onResult={(r) => dispatch({ type: 'RESULT', result: r })}
        onRebuild={() => setPracticeWords(pickWords())}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <BookX className="size-5 text-wrong" />
          错题本
        </h1>
        {entries.length > 0 && (
          <Button onClick={() => setPracticeWords(pickWords())}>
            开始专项练习（前 {Math.min(entries.length, PRACTICE_LIMIT)} 词）
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-6 text-muted-foreground" />
          </span>
          <p className="mt-4 font-semibold">错题本是空的</p>
          <p className="mt-1 text-sm text-muted-foreground">打错的词会自动出现在这里</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {entries.map((e) => {
            const w = WORD_BY_ID.get(e.wordId);
            return (
              <li key={e.wordId}>
                <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xl font-bold">{e.wordId}</span>
                      <span className="text-sm text-muted-foreground">{w?.phonetic}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">{w?.meaning}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {e.wrongLetters.map((l) => (
                      <span
                        key={l}
                        className="rounded-md bg-wrong/10 px-2 py-0.5 font-mono text-sm font-bold uppercase text-wrong"
                        title="常错字母"
                      >
                        {l}
                      </span>
                    ))}
                    <Badge variant="secondary">错 {e.wrongCount} 次</Badge>
                    <span className="rounded-md bg-review/10 px-2 py-0.5 text-xs font-medium text-review">
                      连对 {e.clearStreak}/2
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
