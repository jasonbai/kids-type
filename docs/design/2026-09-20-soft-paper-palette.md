# Kids Type：儿童练习场景的柔和配色提案

日期：2026-09-20。本文记录原始调研与设计方案，未进行儿童使用测试。

实施更新：已完成第三套「柔和·纸感」主题。用户本地试用确认后，将其设为首次访问的默认主题；已有浅色、深色或跟随系统选择均保留。构建、100 项现有测试及 16 种首屏初始化检查通过。下文的分阶段建议保留为设计记录。

## 建议

新增第三套「柔和·纸感」主题，采用暖灰绿背景、近纸白卡片、深灰绿正文与局部低饱和提示。适用于有正常室内照明的单词与例句练习。名称描述视觉体验，不使用“防近视”“滤蓝光保护视力”等功效表述。

这是一项待用户验证的设计选择，没有证据能证明这一组 HEX 色值具有医疗护眼效果。主题数量本身也不是视觉舒适度的指标。

## 调研依据与边界

- AAPOS 指出，长时间近距离注视、眨眼减少可能造成疲劳与干涩；建议休息、调节屏幕亮度、避免暗室和眩光。配色不能替代这些措施。可设计每 20 分钟提示远看约 6 米处 20 秒，并鼓励户外活动。[AAPOS：Screen Time and Online Learning](https://aapos.org/glossary/screen-time-and-online-learning)
- 美国儿科学会面向家长的建议强调屏幕休息和合理用眼，也不支持以屏幕蓝光伤眼为由购买特殊产品。因此不将暖色主题等同于防蓝光或预防近视。[AAP：Give Your Child’s Eyes a Screen-Time Break](https://www.healthychildren.org/English/health-issues/conditions/eyes/Pages/What-Too-Much-Screen-Time-Does-to-Your-Childs-Eyes.aspx)
- WCAG 要求普通文字对比度至少 4.5:1，大字至少 3:1。方案对状态文字也按 4.5:1 设计，不以“柔和”为由降低可读性。[W3C：Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- 必要控件边界、状态指示与相邻颜色应达到 3:1；不能仅靠颜色表达信息。这是无障碍底线，不是临床护眼认证。[W3C：Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)、[Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

## 当前产品的具体问题

检查位置：`src/index.css`、`src/data/fingerMap.ts`、`src/components/VirtualKeyboard.tsx`、`TypingArea.tsx`、`SentenceTypingArea.tsx`、`FingerGuide.tsx`。

1. 浅色背景与卡片均为纯白，缺少柔和底色选项；暗色是深蓝黑。这不能直接推导为伤眼，但无法覆盖偏好柔和浅色的用户。
2. 八指颜色以固定 HEX 同时用于键帽文字、边框和引导线。黄色 `#EAB308` 对白底约 1.92:1，青色 `#06B6D4` 约 2.43:1，低于大字的 3:1 门槛；黄色尤其不适合作为白底目标键文字。
3. 浅色正确色 `#16A34A`、提醒色 `#D97706` 对白底约 3.30:1、3.19:1，仅凭“600 色阶”不能保证普通文字达标。具体是否违规还取决于字号和用途。
4. 正确/错误底色使用透明混合，手指轨迹也有透明度。后续必须按实际合成底色测量，不能只核对原始 token。

## 方向比较

| 方向 | 优点 | 取舍 |
| --- | --- | --- |
| 柔和纸感，暖灰绿底 | 中性、适合长文本与键盘练习，容易保持文字清晰 | 推荐；效果仍需实机与使用反馈验证 |
| 米黄阅读底 | 纸张感更明显 | 偏色较明显，不能声称比灰绿更护眼 |
| 深灰暗色优化 | 提供另一种亮度体验 | 保留为用户选择，不作为儿童场景唯一默认 |

## 可直接落地的色值

| 用途 / token | 前景 | 背景 | 对比度 |
| --- | --- | --- | --- |
| 页面 `background` + 正文 `foreground` | `#293B35` | `#F3F5ED` | 10.78:1 |
| 卡片 `card` + 正文 | `#293B35` | `#FAFBF6` | 11.40:1 |
| 次级文字 `muted-foreground` / 页面 | `#59685D` | `#F3F5ED` | 5.36:1 |
| 主按钮 `primary` + `primary-foreground` | `#FAFBF6` | `#356859` | 6.16:1 |
| 正确 `correct` + `correct-bg` | `#356B49` | `#E6EFE3` | 5.32:1 |
| 当前 `target` + `target-bg` | `#315F87` | `#E7EEF3` | 5.75:1 |
| 错误 `wrong` + `wrong-bg` | `#A4443D` | `#F7E9E4` | 5.11:1 |
| 提醒 `warn` + `warn-bg` | `#805D20` | `#F4EDDC` | 5.13:1 |
| 复习 `review` + `review-bg` | `#695384` | `#EEE9F3` | 5.55:1 |
| 必要边界 `input` / 卡片 | `#819080` | `#FAFBF6` | 3.24:1 |

补充映射：`popover = card`；`card-foreground / popover-foreground / secondary-foreground / accent-foreground = foreground`；`secondary / muted = #E8EDDF`；`accent = #E6EFE3`；`border = #D5DDCF`，仅用于装饰分隔；`ring = #315F87`；`destructive = wrong`。焦点环采用不透明色，2px 实线与 2px 间隔，避免沿用全局半透明 outline。

对比度按 WCAG 的 sRGB 相对亮度公式计算，四舍五入至两位。此表只证明这些不透明配色对的对比度，不代表整个页面已经满足 WCAG。

## 场景应用

- 页面、弹窗、键盘统一使用柔和底色；不再出现整块纯白学习卡。保留足够亮度层次，不给全屏添加黄色滤镜。
- 键帽字母统一深色。当前键采用蓝色实线边框、浅蓝背景和底部短线，同时显示“当前：P · 请用右手小指”。八指颜色可保留在辅助小标记，但不能承担唯一提示；手指身份通过文字、位置和连接线表达。示意图展示统一当前键配色方向，未绘制完整手部组件。
- 正确反馈用绿色配合“已完成”或勾号；错误用砖红配合“再试一次”和叉号；例句已输入部分补充进度文字，不能只靠红绿区分。
- 当前字母保持清晰深色，不做循环闪烁；错误反馈局限于当前字符。减少抖动，尊重 `prefers-reduced-motion`。
- 普通说明文字建议 16–18px、行高 1.5；练习字母沿用现有 24–30px 起步并支持放大。字号为产品设计建议，不是儿童医疗标准。保持现有系统中文字体与清晰等宽英文字体，不为此主题另换字体。
- 按钮 hover 用更深主色 `#2C584B`，pressed 用 `#244B40`；键盘 focus 保留清晰蓝环。禁用态使用明确的禁用语义，不能把正常提示文字做成难读的浅灰。
- 空态保持普通正文与明确下一步；加载态显示“正在准备练习”，避免持续闪烁；错误态同时显示文字解释和重试入口。
- 配合屏幕亮度调节与休息提醒。背景色改变不等于设备背光亮度被调低。

## 接入范围与验收

1. `src/index.css` 增加独立主题及状态背景 token，避免把现有 `/10` 透明背景直接等同于本方案色值。
2. `src/context/theme-provider.tsx`、`src/components/ThemeSwitch.tsx` 和 `index.html` 的首屏主题逻辑同步支持新值，保证刷新无主题闪烁，保存已有用户选择。
3. 修改键盘、单词/例句打字区、手指提示的硬编码和状态表达；检查首页、统计、复习、设置弹窗、hover/focus 等所有状态。
4. 新主题先作为可选项。试用验证后再决定是否作为新用户推荐默认，不覆盖老用户选择。
5. 在实际显示器上验证浅色/深色/新主题、键盘操作、文字放大、状态叠加与对比度；让少量孩子在家长陪同下完成短时练习，观察辨认错误、凑近屏幕、眯眼和舒适度反馈。这是可用性验证，不是临床效果试验。

配套文件：`soft-paper-palette.svg` 为矢量示意，`soft-paper-palette.png` 为可直接查看的预览。
