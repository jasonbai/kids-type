import GithubIcon from './GithubIcon';
import { APP_VERSION, REPO_URL } from '../lib/repo';

export default function Footer() {
  return (
    <footer className="mt-auto border-t py-4 text-center text-sm text-muted-foreground">
      <p className="flex flex-wrap items-center justify-center gap-1.5 px-4">
        <span>单词打字 v{APP_VERSION}</span>
        <span>·</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
        >
          <GithubIcon className="size-3.5" />
          开源项目（MIT License）
        </a>
        <span>·</span>
        <a
          href="https://www.jasonbai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium transition-colors hover:text-primary"
        >
          作者：尾灯白
        </a>
      </p>
    </footer>
  );
}
