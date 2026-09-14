# kids-type · 英语单词 × 键盘指法练习

给 KET/PET 备考阶段孩子的纯前端静态站：练指法的同时按艾宾浩斯曲线记单词。
零后端、零账号，学习进度存在浏览器 localStorage，支持 PWA 离线使用。

## 功能

- **打字练习**：逐字母输入、正误高亮、虚拟键盘按键高亮，配 8 指 8 色的线稿虚拟双手指法指引
- **发音**：Web Speech API 自动朗读单词与例句，音色 / 语速可调
- **词库**：KET 1500 词 + PET 2000 词（CEFR 分级 + 词频排序），每词配 3 条儿童友好英中对照例句
- **三种练习模式**：单词 / 单词+例句成对 / 纯例句
- **错题本**：打错的词自动入册，专项练习连对 2 次移出
- **艾宾浩斯复习**：简化 SM-2 调度，每日自动安排到期复习词
- **今日任务首页**：待复习 + 新词 + 打卡天数（streak）
- **统计面板**：准确率、用时为主，WPM 为辅
- **激励**：连对星星、每日打卡；键盘音效（WebAudio 合成，零音频资产）
- **数据备份**：设置中可导出 / 导入 JSON

## 快速开始

```bash
npm install
npm run dev        # 本地开发
npm test           # Vitest（词库/例句数据校验 + 纯逻辑单测，71 项）
npm run build      # 类型检查 + 产出 dist/
```

## 项目结构

```
kids-type/
├── scripts/
│   ├── build-vocab.mjs           # 词库构建管线（CEFR 词表 + ECDICT → JSON）
│   ├── build-sentences.mjs       # 例句构建管线（→ sentences.json）
│   └── data/                     # 原始词典数据（.gitignore，不入库）
├── src/
│   ├── data/                     # ket.json / pet.json / sentences.json + fingerMap
│   ├── types/                    # Word / SrsRecord / WrongBookEntry / Settings
│   ├── storage/                  # localStorage 封装（版本迁移口子）
│   ├── store/learning.tsx        # Context + Reducer 全局状态（变更即持久化）
│   ├── lib/                      # judge / srs / speech / sound / stats / queue 等纯逻辑
│   ├── hooks/useTypingSession.ts # keydown 监听、判定、推进状态机
│   ├── components/               # 词卡 / 键盘 / 手指引导 / 例句卡 / 设置面板等
│   └── pages/                    # 首页 / 练习 / 复习 / 错题本 / 统计
└── vite.config.ts                # Vite + Tailwind v4 + vite-plugin-pwa
```

## 词库重建（可选）

词库与例句 JSON 均已入库，日常开发无需重新生成。如需更换数据源：

```bash
npm run vocab       # 详见 scripts/build-vocab.mjs 头部说明
npm run sentences   # 详见 scripts/build-sentences.mjs 头部说明
```

## 部署

构建产物为纯静态文件（含 PWA Service Worker），任意静态托管均可：

- **Vercel**：导入仓库，Framework 选 Vite，构建命令 `npm run build`，输出目录 `dist`
- **Netlify**：同理（build: `npm run build`，publish: `dist`）
- PWA 需 HTTPS 才会注册 Service Worker（Vercel / Netlify 默认提供）

## 数据来源与许可

- 词表：开源 [Words-CEFR-Dataset](https://github.com/Maximax67/Words-CEFR-Dataset)（CEFR 分级 + 词频）
- 音标与释义：[ECDICT](https://github.com/skywind3000/ECDICT)（MIT 许可），经 `scripts/build-vocab.mjs` 生成入库
- 例句：本项目原创（AI 辅助生成、人工校验），随仓库以相同许可分发

本项目以 MIT 许可开源，见 [LICENSE](./LICENSE)。
