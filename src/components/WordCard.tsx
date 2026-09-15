import { Volume2 } from 'lucide-react';
import type { Word } from '../types';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface Props {
  word: Word;
  /** 整词打完的庆祝态：单词变绿 + 弹跳 */
  celebrating: boolean;
  /** 左上角角标（"复习" / "错词"） */
  badge?: string;
  onSpeak: () => void;
}

/** 紧凑词卡：单词本体由打字格子展示，这里只保留中号单词 + 音标释义 + 发音按钮 */
export default function WordCard({ word, celebrating, badge, onSpeak }: Props) {
  return (
    <Card className="relative w-full select-none px-6 py-5 text-center">
      {badge && (
        <span className="absolute left-4 top-4 rounded-md bg-review/10 px-2.5 py-1 text-xs font-semibold text-review">
          {badge}
        </span>
      )}
      <div className="flex items-center justify-center gap-2">
        <div
          className={[
            'text-5xl font-extrabold tracking-[0.15em] transition-colors',
            celebrating ? 'animate-celebrate text-correct' : 'text-foreground',
          ].join(' ')}
        >
          {word.word}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onSpeak}
          aria-label="再听一遍"
          title="再听一遍"
        >
          <Volume2 className="size-5" />
        </Button>
      </div>
      {/* 自定义词表可能没有音标/释义：两者都缺省时整行隐藏 */}
      {(word.phonetic || word.meaning) && (
        <div className="mt-1.5 text-base text-muted-foreground">
          {word.phonetic && <span className="font-mono">{word.phonetic}</span>}
          {word.phonetic && word.meaning && <span className="mx-2 opacity-50">·</span>}
          {word.meaning}
        </div>
      )}
    </Card>
  );
}
