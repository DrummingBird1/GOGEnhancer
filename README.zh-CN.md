<p align="center">
  <img src="docs/assets/hero-icon.png" width="96" height="96" alt="GOG Enhancer logo" />
</p>

<h1 align="center">GOG Enhancer</h1>

<p align="center">
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/extension/manifest.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FDrummingBird1%2FGOGEnhancer%2Fmain%2Fextension%2Fmanifest.json&query=%24.version&label=version&color=c64fff" alt="version" /></a>
  <img src="https://img.shields.io/badge/manifest-v3-00f0ff" alt="Manifest V3" />
  <a href="https://github.com/DrummingBird1/GOGEnhancer/actions/workflows/test.yml"><img src="https://img.shields.io/github/actions/workflow/status/DrummingBird1/GOGEnhancer/test.yml?branch=main&label=tests&color=7fffa6" alt="tests" /></a>
  <a href="https://github.com/DrummingBird1/GOGEnhancer/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-ff6b9d" alt="MIT license" /></a>
</p>

<p align="center">Chromium-based browsers (Chrome, Edge, Brave, Opera)</p>

<p align="center"><a href="README.md">English</a> · <a href="README.he.md">עברית</a> · <a href="README.ru.md">Русский</a> · <a href="README.pl.md">Polski</a> · <a href="README.de.md">Deutsch</a> · <a href="README.fr.md">Français</a> · <a href="README.es.md">Español</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.pt-BR.md">Português (Brasil)</a></p>

GOG.com 的非官方第三方扩展：实时汇率换算、价格历史、跨商店比价、个人标签、全面的视觉升级、希伯来语 + RTL——不使用 Google 字体，也没有任何统计分析。

> **免责声明：** 这是一款非官方的第三方扩展。它与 GOG sp. z o.o. 和 CD Projekt S.A. 没有关联，也未获其认可或赞助。“GOG”这一名称仅用于说明扩展所适用的商店。

---

## 📂 仓库内容

| 文件 / 文件夹 | 用途 |
|---|---|
| **`extension/`** | **可发布的扩展本体**——`manifest.json` 以及 `background/`、`content/`、`lib/`、`popup/`、`options/`、`onboarding/`、`tags/`、`tour/`、`icons/`。“加载已解压的扩展程序”选的就是它，打包成 zip 的也是它。 |
| **`store/`** | **不属于**扩展的商店素材：`STORE_LISTING.md`（后台所需文案）、`listings/`（商店描述，每种语言一个文件）、`screenshots/`（每种语言十张，由 `e2e/store-screenshots.mjs` 生成）、`brand/`（标志与宣传图）、`release-images/`（每个版本的横幅，见 `CLAUDE.md`）。单独上传，绝不打包进 zip。 |
| **`docs/`** | 扩展的网站，托管在 GitHub Pages——首页、使用指南、隐私政策、更新日志。 |
| `PRIVACY.md` | 隐私政策（也托管在公开地址 `docs/privacy.html`） |
| `README.he.md`、`README.ru.md`、`README.pl.md`、`README.de.md`、`README.fr.md`、`README.es.md`、`README.zh-CN.md`、`README.pt-BR.md` | 本文件的完整译本，每种界面语言一个 |
| `LICENSE` | MIT 许可证 |
| `build.ps1` | 构建脚本——把 `extension/` 打包为 `dist/gog-enhancer-webstore.zip`（`node scripts/build-firefox.mjs` 构建实验性的 Firefox zip） |
| `scripts/`、`e2e/` | 发布脚本（`release.mjs`）、Firefox 构建，以及端到端工具：Playwright 套件（固定页面、真实网站、已登录）、性能预算、结构记录器、截图回归、翻译字符串收集器和商店截图生成器。仅在本地使用，不会随扩展发布。 |
| `dist/` | 构建产物（已加入 gitignore）。由 `build.ps1` 生成 |
| `tests/`、`package.json`、`vitest.config.js`、`eslint.config.js` | 用于纯工具模块的 Vitest 与 ESLint。不包含在扩展 zip 中。 |
| `.github/workflows/` | GitHub Actions：`test.yml` 在推送/PR 时运行 lint 与测试，`release.yml` 在推送 `v*.*.*` 标签时构建 zip 并发布 Release，`canary.yml` 是对真实网站的定时检查 |
| `CLAUDE.md` | 给 AI 编程助手的项目说明 |
| `README.md` | 本文件的英文版 |

---

## ✨ 功能概览

### 架构
- **统一的存储层**——偏好设置放在 `storage.sync`（轻量，跨设备同步），较大的数据（标签、历史、缓存）放在 `storage.local`。两种配额都不会超出。
- **设置版本管理与迁移**——从 v1 升级时，标签和笔记会自动从 sync 迁移到 local。
- **只用系统字体**——不依赖 Google 字体，没有远程代码，没有统计分析。
- **唯一的网络层**（`lib/net.js`）——扩展发出的每个请求都经过它：五个主机的白名单、不带 Cookie、不带 Referer、有超时，并在本地记录“主机 + 路径”（绝不记录查询参数），可在高级设置页面查看。如果权限或主机变动而隐私文档没有相应更新，测试会让构建失败。
- **唯一的网站适配器**（`content/gog-dom.js`）——对 gog.com 页面标记的每一次查找（卡片、价格、标题、面板位置）都会尝试多种策略，因此网站改版时功能是平稳降级，而不是悄悄失效。高级设置中的“检查此页面”会显示哪些查找仍然有效。
- **聚焦的 `MutationObserver`**，作用于页面内容并带防抖；过滤掉页眉的噪声，也能发现被替换的 `<main>`。
- **每个功能独立运行**——网站改动后如果某个查找失效，只会关闭那一个功能，其余照常工作；“检查此页面”会列出哪些失败了。
- **只从你打开的页面中学习**——游戏拥有状态、评分、语言和价格信息都读取自你自己访问的页面，并保存在本地。扩展不会为此额外请求任何内容。

### 功能
- 💱 **24 种货币的实时汇率**——谢克尔、欧元、英镑、兹罗提、卢布、雷亚尔、日元、人民币等，每 12 小时自动从 `api.frankfurter.dev` 获取。可手动编辑。
- 📈 **价格追踪**——每次访问游戏页面都会记录一个快照。游戏页面上的统计面板显示当前价、历史最低价和平均价，并给出“值得等一等吗？”的判断。
- 🔍 **在 IsThereAnyDeal 比价**——游戏页面上的按钮会在 Steam / Epic / Humble / Fanatical 上搜索同一游戏。
- 🏷️ **完整的标签仪表板**——独立页面，支持搜索、筛选、每个标签的计数和 CSV 导出。已有标签可自动补全。
- 🔔 **愿望单促销提醒与优惠**——工具栏图标上的徽章统计愿望单中正在打折的游戏；弹出窗口显示你追踪的降幅最大的三个价格。
- 🛡️ **DRM-free 横幅**——带盾牌图标和渐变“GOG+”标签的实心横幅。
- 🎨 **卡片视觉升级**——因游戏而异：“Good Old Game”带有淡淡的 CRT 效果和金色光晕；Cyberpunk/Witcher 系列带有青色/洋红色霓虹底光。
- 🪟 **美化的提示框**——取代浏览器默认的提示，支持标题、丰富内容和自动定位。
- 📋 **动态模组列表**——每 24 小时自动从 `gog.com/en/mods` 抓取。
- 🌍 **自动识别页面货币**——如果 GOG 已经显示欧元（欧盟用户），扩展不会重复换算。
- 🎯 **规范的 RTL**——使用 `inline-start`/`end` 而不是 `left`/`right`，价格使用 `unicode-bidi: isolate`。
- ⌨️ **键盘快捷键**——`Alt+G` 打开弹出窗口，`Alt+Shift+G` 开关扩展，`Alt+Shift+H` 切换希伯来语；`Ctrl/Cmd+K` 打开命令面板处理其他一切。
- 🧙 **首次使用向导**——4 个步骤（货币、地区、功能、主题），首次安装时自动打开。
- ☁️ **通过你选择的文件夹跨设备同步**（Dropbox、OneDrive、Google Drive、Syncthing……）——按记录合并标签、笔记、状态、购买、提醒和价格历史，可选加密。中间没有我们的任何服务。支持 Chrome / Edge / Brave。
- 🔎 **地址栏搜索游戏库**——输入 `gog` + Tab，然后输入游戏名、`tag:rpg` 或 `status:backlog`。
- 🎨 **Native 主题**——取用 gog.com 自己的颜色和字体，让新增的界面融入网站的任何外观。
- ⌨️ **键盘导航**（可选）——`J`/`K` 在列表中的游戏间移动，`T` 为当前游戏添加标签。
- 📅 **日历文件（`.ics`）**，用于退款期限和愿望单游戏的发售日期，以及标签仪表板中的 📝 **Markdown / Obsidian / CSV 导出**——全部在你的设备上生成。
- 🌍 **九种界面语言**——标签仪表板、高级设置、弹出窗口、首次使用向导以及扩展在 gog.com 上的自有文字，支持英语、希伯来语（从右到左）、俄语、波兰语、德语、法语、西班牙语、简体中文和巴西葡萄牙语。你自己写的内容（标签名、笔记）永远不会被翻译。
- 🔒 **隐私仪表板**在高级设置中——列出扩展联系过的每个地址、它在你设备上保存的内容及大小、Chrome 授予它的额外网站访问权限，并可一键清除。
- 🩺 **故障报告**——当某个功能在网站改动后失效时，弹出窗口提供一键报告，不含网址和个人数据（“在 GitHub 上报告”只是打开一个已填好内容的页面）。
- 🖥️ **游戏页面上的系统检查**——将游戏的内存需求与浏览器报告的内存比较（浏览器看不到你的 CPU 和 GPU）。在高级设置中填写你的电脑配置后，游戏的内存和可用磁盘空间需求会据此比较；操作系统、处理器和显卡显示在需求旁边，但不做判断——仅为估算。

#### 优惠与价格（v4）
- 💸 **“这个折扣是真的吗？”**——把原价与 GOG 自己的 30 天最低价以及你追踪的历史对比；⏳ **优惠倒计时**显示在游戏页面、卡片和摘要中。
- **每小时游戏时间的价格**、同时显示**多种货币的价格**、每款游戏的**促销规律**、2–3 款游戏的**对比图表**、**“我省了多少”**汇总，以及各国**增值税预设**（DE、FR、ES、IT、NL、RU）。

#### 愿望单与目录（v4）
- 💖 **智能愿望单**——按折扣 / 与最低价的距离 / 换算后的价格 / 添加日期排序，“接近最低价”和“即将结束”筛选，实时总计，按标签或状态分组，导出为 CSV / Markdown / `.ics`。
- 🗂️ **目录工具**——网格上方的工具栏：淡化或隐藏你已拥有的游戏，**不感兴趣**（可恢复），对本页做本地排序，紧凑 / 列表密度，保存的筛选预设，批量标签与追踪，并排对比。
- ♾️ **无限滚动**（可选，默认关闭）——滚动到目录页末尾时，下一页会添加在下方，数据来自 GOG 自己的目录 API（`catalog.gog.com`，与网站发出的是同一个调用）。

#### 游戏页面与游戏库（v4）
- 🎮 **语言检查**、**自上次访问以来的变化**、评论筛选、**你已拥有的类似游戏**、**合集里到底有什么**（从合集页面本身读取，或每个游戏页面向 GOG 的产品 API 查询一次——只发送数字 ID），并在与你已拥有的游戏重叠时提醒，另有指向 Steam / IsThereAnyDeal / PCGamingWiki / HowLongToBeat / SteamDB 的“在……中打开”链接，以及 `W` / `N` / `A` 快捷键。
- 📚 **边浏览边了解你的游戏库**（来自网站自己的“IN LIBRARY”标签），这支持隐藏已拥有的游戏、真实的游戏库统计、加权的待玩轮盘、每月“要通关的游戏数”目标，以及可保存为 PNG 的 **Wrapped / 收藏家卡片**。
- 📝 **笔记版本历史**、**Obsidian 库**导出（`.zip`），以及面向 **Notion、Google 表格和 Trello** 的 CSV / 逐行导出。
- 🏆 **36 项成就**，分三个等级（少数隐藏），你的浏览**连续天数**，以及三个**每月挑战**——全部在本地。
- ♿ **可用键盘操作的仪表板**——跳转到内容的链接、用 `Alt`+`↑`/`↓` 重新排列标签、保持焦点的菜单和对话框，以及为读屏软件朗读的变更提示。

#### 同步、通知与外观（v4）
- 🔄 **自动文件夹同步**（每 30 分钟一次，打开仪表板时也会同步；前提是浏览器仍记得文件夹权限且文件未用口令加密）、冲突列表，以及保存在文件夹里的带日期备份（最多每天一次，在打开仪表板时生成）。
- 🔔 **免打扰时段与免打扰的星期几**、**每天一条汇总**模式、阈值、**按标签提醒**、可选的**促销季雷达**、更丰富的每周摘要（可保存为网页）、可保存为 PNG 的愿望单卡片，以及可选的**发往你自己地址的 webhook**（见权限表）。
- 🎨 **折叠 / 停靠 / 重新排序**游戏面板、**安静模式**、一键**朴素外观**、色觉友好调色板、文字缩放、设置配置文件，以及更新后的简短**导览**。

### 视觉升级模块
通过弹出窗口中的“Design injection”开关启用。开启后：
- 各处价格使用等宽字体（`ui-monospace` / Cascadia / JetBrains）和等宽数字。
- 随年代变化的卡片：经典游戏带扫描线，赛博朋克时代的游戏带霓虹光晕。
- 细腻的层次感与阴影、环境渐变背景、悬停时的微交互。
- “Good Old Game”标签用金属质感的金色渐变取代平淡的紫色。
- 带闪烁动画的骨架加载占位，而不是裸露的 `{{ product.title }}` 占位符。
- 整洁的布局：隐藏往年已过期的促销。
- 十一种主题（Neon、Classic GOG、CRT Green、Sunset、Light、AMOLED、Amber、High contrast、Custom、Auto、Native）——Auto 跟随系统的浅色/深色偏好，Native 跟随 gog.com 自己的外观。

### 坦诚的隐私
- **只有五个域名**（外加你自己可能填写的那个 webhook 地址，且仅在你开启时）会收到网络请求——每个请求都列在高级设置（隐私与透明度）中：
  1. `www.gog.com`——读取页面内容并注入界面，以及每天一次的公开模组列表。
  2. `api.frankfurter.dev`——汇率（无需 API 密钥，无跟踪）。
  3. `www.cheapshark.com`——游戏页面上可选的比价表（免费，无需密钥；可在弹出窗口中关闭）。
  4. `api.gog.com`——GOG 自己的产品 API，每个游戏页面询问一次合集包含哪些游戏（只发送数字 ID；默认开启，可在*目录、愿望单与游戏库*下关闭）。
  5. `catalog.gog.com`——GOG 自己的目录 API，仅在你开启无限滚动时使用（默认关闭）。

  后两项不在权限表中，因为它们是在页面内按 GOG 自己的跨源规则调用的——和网站发出的是同样的调用——所以 Chrome 在安装时不会为它们显示额外警告。
- **文件夹同步自身不发出任何网络请求**——它只读写你所选文件夹中的一个文件；上传由你自己的云盘客户端完成。
- **Webhook 是可选的，并且属于你**——安装时不会请求任何内容。如果你在高级设置中填写自己的 `https://` 地址，浏览器会就这唯一的来源征求你一次许可；只会向它发送通知文字，且该地址不会通过导出或同步离开你的设备。
- **零统计分析、零 gtag、零 Google 字体。**
- **标签、笔记和历史保存在你的设备上**，位于 `chrome.storage.local`。不会外传。
- **开源**——每一行代码都在这个仓库里。

---

## 🚀 安装

1. 从 [Releases](https://github.com/DrummingBird1/GOGEnhancer/releases) 页面下载 `gog-enhancer-webstore.zip` 并解压到任意位置（如果你克隆了仓库，可直接使用 `extension/` 文件夹）。
2. 打开 Chrome，进入 `chrome://extensions/`。
3. 开启**开发者模式**（右上角）。
4. 点击**加载已解压的扩展程序**，选择解压后的文件夹（或 `extension/`）。
5. 首次使用向导会在新标签页中自动打开。按步骤完成即可。
6. 访问 [gog.com](https://www.gog.com)——扩展已生效。

---

## 🌐 浏览器支持

| 浏览器 | 状态 |
|---|---|
| **Chrome** | ✅ 完全支持——这是主要目标。 |
| **Edge、Brave、Opera**（基于 Chromium） | ✅ 与 Chrome 表现一致——同样的引擎，同样的“加载已解压的扩展程序”步骤。 |
| **Firefox** | ⚠️ 实验性 / 未验证。`node scripts/build-firefox.mjs` 会构建 Firefox 版本（用后台页面代替 service worker、附加组件 ID、“不收集任何数据”声明），通过 `web-ext lint` 检查无错误，并且 zip 会附在每个 GitHub Release 上——但**它从未在真正的 Firefox 中运行过**，而且文件夹同步需要 Firefox 没有的 API。受支持的安装方式是 Chrome 网上应用店页面；Edge 用户可从那里安装同一扩展，或使用“加载已解压的扩展程序”（Edge 加载项暂无商店页面）。 |

---

## ⌨️ 键盘快捷键

| 快捷键 | 操作 |
|---|---|
| `Alt+G` | 打开弹出窗口 |
| `Alt+Shift+G` | 开启/关闭 GOG Enhancer |
| `Alt+Shift+H` | 开启/关闭希伯来语翻译 |
| `Ctrl/Cmd+K`（在 gog.com 上） | 打开命令面板 |
| `J` / `K` / `T`（在游戏列表中，可选） | 上一个/下一个游戏，为当前游戏添加标签 |
| `W` / `N` / `A`（在游戏页面上，可选） | `W` 点击网站的愿望单按钮（切换），`N` 跳到笔记框，`A` 跳到价格提醒框；`?` 列出这些按键 |
| `gog` + `Tab`（地址栏） | 搜索你自己的游戏库 |

快捷键可在 `chrome://extensions/shortcuts` 中修改。

---

## ⚙️ 权限说明

| 权限 | 用途 |
|---|---|
| `storage` | 保存偏好设置、标签和历史 |
| `alarms` | 安排汇率、模组和愿望单的后台刷新 |
| `notifications` | 仅在你开启时使用——退款期限和愿望单优惠的桌面提醒 |
| 主机：`www.gog.com` | 向 GOG 页面注入界面 |
| 主机：`api.frankfurter.dev` | 获取汇率 |
| 无需权限：`www.cheapshark.com` | 游戏页面上可选的跨商店比价——CheapShark 允许跨源读取，因此无需声明主机权限 |
| 可选主机：任意 `https://` 来源 | **安装时绝不授予。** 仅当你在高级设置中填写自己的 webhook 地址时，才在运行时为那一个来源请求；只会向它发送通知文字 |

文件夹同步（你每次通过一次点击授权一个文件夹）和地址栏关键词都不需要权限。

---

## 🛠️ 已知限制

- **对改版的适配已在真实网站上验证，但 gog.com 仍在不断变化**——首页、目录和游戏页面已于 2026-10-02 做过检查并完整走通（未登录）；账户页面（愿望单、游戏库、购物车）需要登录，仅做过结构检查。网站目前混用两代页面标记，所以后续还会有改动。如果 gog.com 更新后有功能失效，请使用*高级设置 → 检查此页面*。
- **文件夹同步按各设备的时钟解决冲突**——每条记录以最后一次修改为准（被覆盖的记录会列在设置页面上），因此时钟严重偏差可能选错胜者。它需要 File System Access API（Chrome、Edge、Brave；Firefox 不行），并且需要不时在设置页面重新授予文件夹访问权限。后台任务无法请求权限或口令，因此缺少其一时会悄悄跳过，直到你打开仪表板。已用本地文件夹测试，未用真正的云盘同步客户端测试。
- **v4 中并非所有内容都能在真实网站上验证**——依赖登录状态的功能（愿望单行、游戏库拥有状态、合集与已有游戏的重叠）是依据录制的页面*结构*以及单元/端到端测试构建的，没有用真实账户演练过。Webhook 没有对真实端点试过，Firefox 也未测试。
- **无限滚动要求 GOG 的目录 API 保持现状**——它只延续能与屏幕上列表对应的列表，使用的是网站自己传给页面的查询。如果 GOG 限制该 API，这个功能只会停止追加；其他功能不受影响。发售日期日历条目只对你打开过页面的游戏存在（愿望单本身只显示年份）。
- **翻译未经审校**——除英语外的八种界面语言没有经过母语者审校；这是个先从希伯来语起步的项目，因此希伯来语受到的关注最多。只在操作之后才出现的文字（部分对话框和错误消息）已覆盖，但任何尚无翻译的新内容会保持英文。
- **尚未实现：**购物车 / 免费赠送检测器、侧边栏和右键菜单（每项都需要新增权限）。
- **模组列表抓取**——依赖 `gog.com/en/mods` 保持相似的结构。如果出现问题，请在高级设置中强制刷新。
- **愿望单徽章计数**——基于访问 `/account/wishlist` 时对 DOM 的实时计数（有效期 24 小时）。如果你最近没访问过，徽章会一直为空，直到下次访问——扩展图标的提示会建议你去访问。
- **退款计时器依赖手动填写的日期**——GOG 没有在任何公开 DOM 中提供购买日期，因此 30 天倒计时取决于你在面板中输入的日期。没有日期，就没有倒计时。
- **类型检测部分是自动的（自 v2.6.0 起）**——Horror/Role-playing/Strategy 读取自游戏页面本身真实的“Genre:”字段，并在首次访问时按 slug 缓存（`gameGenres`）。Sci-fi 和 Indie 仍依靠用正则匹配已知游戏标题——在 GOG 上它们似乎位于更宽泛的“Tags”标签云中而不是“Genre:”，这个结构还没有被完全验证。在某个游戏被访问之前，五个类型分组都会回退到正则匹配。
- **跨货币换算始终以 USD 为中转**——如果 `rates` 中缺少任一货币对的汇率，就不会换算。所有汇率每 12 小时自动从 frankfurter.dev 获取。
- **整个愿望单范围的价格提醒、愿望单优惠和愿望单价值只覆盖你访问过的游戏**——三者都依赖 `priceHistory`，而它只有通过访问游戏自己的页面才会建立。你从未访问过的愿望单游戏没有可比较的数据，因此即使价格下降，也不会出现在提醒、弹出窗口的“愿望单优惠”或“愿望单价值”统计中。

---

## 📜 更新日志

完整的版本历史在 [GitHub Releases 页面](https://github.com/DrummingBird1/GOGEnhancer/releases)（每个版本都有自己的页面和横幅图），也在扩展网站上的[更新日志页面](https://drummingbird1.github.io/GOGEnhancer/changelog.html)。

---

## 🧑‍💻 最初为以色列市场而做

最初是为以色列用户量身定制的（ILS、18% 增值税、希伯来语）——但同样适用于所支持的 24 种货币中的任何一种。每个字段都可编辑。

---

## ☕ 支持

GOG Enhancer 免费、开源、无广告，也不收集数据。如果它为你节省了金钱或时间，并且你想支持后续开发，可以通过以下任一平台成为支持者：

- **[Ko-fi](https://ko-fi.com/idanlights)**
- **[Buy Me a Coffee](https://buymeacoffee.com/solvaris)**
- **[Patreon](https://www.patreon.com/c/Solvaris)**

完全自愿——无论如何，所有功能都对所有人保持免费。
