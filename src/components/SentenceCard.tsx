import { Volume2 } from 'lucide-react';
import type { Sentence, Word } from '../types';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
  word: Word;
  sentence: Sentence;
  /** 整句打完的庆祝态：整句变绿 */
  celebrating: boolean;
  badge?: string;
  onSpeak: () => void;
}

/** 例句卡：小号主题词（音标+释义）在上，大号例句在下，附中文翻译 */
export default function SentenceCard({ word, sentence, celebrating, badge, onSpeak }: Props) {
  // 高亮例句中的主题词（句子由生成规范保证含原形整词）
  const parts = sentence.en.split(new RegExp(`\\b(${word.word})\\b`, 'g'));

  return (
    <Card className="relative w-full select-none px-6 py-4 text-center">
      {badge && (
        <span className="absolute left-4 top-4 rounded-md bg-review/10 soft:bg-review-soft px-2.5 py-1 text-sm font-semibold text-review">
          {badge}
        </span>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        <span className="break-all text-lg font-bold tracking-wide text-foreground">{word.word}</span>
        <span className="font-mono">{word.phonetic}</span>
        <span className="hidden max-w-56 truncate sm:inline">{word.meaning}</span>
        <Button variant="ghost" size="icon" onClick={onSpeak} aria-label="再听一遍" title="再听一遍">
          <Volume2 className="size-4" />
        </Button>
      </div>

      <p
        className={cn(
          'mt-2 text-2xl font-extrabold leading-snug text-balance md:text-3xl',
          celebrating ? 'animate-celebrate text-correct' : 'text-foreground',
        )}
      >
        {parts.map((part, i) =>
          part === word.word ? (
            <span key={i} className="text-review underline decoration-2 underline-offset-4">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>

      <p className="mt-1.5 text-base text-muted-foreground">{sentence.cn}</p>
    </Card>
  );
}
