# 能源开发测试工具箱 · 设计方案

> 版本：v3.9（v0.2.0 工程化深化：统一量纲层、跨工具结果串联、报表深化、工程校核；61 工具 / 10 分类；macOS 暂 deferred）
> 日期：2026-11-04（2026-11-05 切换为 Go 壳；2026-11-06 交付 exe；2026-11-07 二次修复重新出包；2026-11-08 两栏布局 + 开发常用 / 高压电工 / 科技感主题 + 日常工具；2026-11-09 图标 + GitHub + 官网）
>
> **v3.9（2026-11-10）v0.2.0 工程化深化**
> - **统一量纲层**：新增 `src/utils/units.js`，16 个单位族以 SI 基准统一；P / Q / S 拆为独立族，禁止直接相加，按 S = √(P²+Q²) 合成并给出 cosφ；温度按仿射换算（a·v+b），百分比按 0.01 处理。新增「量纲校验台」工具（换算 / 一致性校验 / 功率三角形 / 常见陷阱）。
> - **跨工具结果串联**：新增 `src/utils/bus.js`（结果总线 + 本机测试记录）。模块可 `publish` 结果、`consume` 引用；右侧「结果中转站」按量纲筛选接收方并自动换算单位。已接通 三相功率 → 功率因数补偿、变压器二次电流 → 载流量校核、批量计算 / 标准数据表 → 量纲校验台。全局 `Enter` 触发当前工具主计算按钮。
> - **报表深化**：批量计算台新增内联 SVG 趋势曲线、Excel (`.xls`) 导出、可打印 PDF 计算书（`@media print` 仅输出报告区，含公式 / 元数据 / 明细 / 趋势 / 签署栏）与本机测试记录（`TB.records`，30 条上限，支持回看 / 恢复 / 导出 / 清空）。新增「测试记录」工具。
> - **工程校核**：注册表新增 `limits` 元数据（输入范围 / 适用边界 / 示例 / 警告），12 个电力与高压模块全覆盖并在右侧面板统一渲染；新增「工程标准数据表」（导线载流量、配变短路阻抗、继保整定系数），所有参考值均带边界声明与 GB/T、DL/T 标准出处。
> - **新模块**：`unit-guard`、`test-records`、`hv-tables`，模块总数 **58 → 61**（10 分类不变；高压电工 6 → 7、综合工具 3 → 5）。
> - **验证**：61/61 模块注册渲染、20/20 交互、55/55 数值、38/38 量纲、27/27 结果总线、boot 0 失败、语法 67 文件 0 失败、双主题浏览器探针 61×2 全通过；`test.units.mjs` / `test.bus.mjs` 新增并接入 CI。
>
> **v3.8（2026-11-09）v0.1.0 正式发布**
> - **发布链路**：重写 `.github/workflows/build.yml`，移除在 macOS 上必然失败的 job（唯一入口 `webview_windows.go` 带 `//go:build windows`）；Windows job 串起「rsrc → build → 全套测试 → SHA256 → Release」，产物名统一为 `EnergyTestToolbox.exe`，官网下载改指 `releases/latest`。补 `LICENSE`(MIT)、`CHANGELOG.md`、`CONTRIBUTING.md`、Issue 模板。
> - **版本体系**：`src/version.js` 为唯一事实来源，应用内顶栏显示版本 + 一键检查更新；Go 端从嵌入的 `version.js` 解析版本并写入窗口标题；`/api/device/ping` 返回版本。
> - **设备联调**：新增 `api_device.go`（仅 127.0.0.1）提供 Modbus TCP / 裸 TCP / 串口 RTU / 串口枚举 API（依赖纯 Go `go.bug.st/serial v1.8.0`，go.mod 升至 1.25.0）；前端 `modules/protocol/device-bridge.js` 含报文模板、自动 CRC16、响应解析与收发日志，纯前端环境自动降级为离线构造。
> - **批量报表**：`modules/misc/batch-calc.js`，7 个工程公式模板 + CSV 粘贴/导入 → 批量计算 → 结果表格 → 导出 CSV 报告。
> - **公式依据**：注册表新增 `refs` 字段，`buildAside` 统一渲染「公式依据与标准」卡片，覆盖 11 个电力计算/高压电工模块 + 2 个电工计算器。
> - **个性化**：收藏置顶、最近使用、快捷键（`/`、`Ctrl+K`、`Esc`）、aria 标签；顶栏版本号与检查更新按钮。
> - **分类补齐**：新增 `device-bridge`、`batch-calc`、`sql-format`、`sql-ddl`、`crontab`，模块总数 **53 → 58**（10 分类不变，最少分类由 1 提升到 3）。
> - **质量**：`check-syntax.mjs`（逐文件语法编译 + `T.util.*` 命名空间误用静态防线，防 app.js 白屏）、`test.formulas.mjs`（42 条数值 golden + refs 元数据）、`check-docs.mjs`（跨文档计数一致性）、`verify_syso.py`（CI 无 exe 时校验 PE 资源对象）、`check-light-theme.mjs`（真实 Chromium 在 dark/light 下逐模块 render + WCAG 对比度检测）、`test.boot.mjs` 改为从 `index.html` 自动解析脚本列表。顺带修复 `dlt645` / `sql` 的 `T.util.copyBtn` 误用、`endian` 的 DataView 方法名错误、浅色主题 `.hint` 低对比（2.75→5.9）。
> - **验证**：58/58 模块注册渲染、20/20 交互、42/42 数值、boot 0 失败、语法 62 文件 0 失败、双主题浏览器探针 58×2 全通过；Go 单文件 exe **7,933,440 字节**（含图标资源），SHA256 随 Release 发布。
>
> **v3.7（2026-11-09）应用图标、开源仓库与官网**
> - **Windows PE 图标**：`scripts/make_icon.py`（零依赖纯 Python）生成 16~256 七尺寸 ICO + 512 PNG，图案为深色 HUD 圆角方板 + 青色霓虹描边 + 发光闪电；`assets/app.manifest` 提供 per-monitor-v2 高 DPI 感知；经 `akavel/rsrc` 编为 `rsrc_windows_amd64.syso`，由 Go 链接器自动并入 exe（无 CGo）。`src/index.html` 同步加 favicon。`scripts/verify_icon.py` 校验 PE 资源目录。
> - **计算器显示强化**：`.calc-display` min-height 92→104px，`.val` 32→38px 且双层青色辉光，解决"结果不醒目"的观感问题。
> - **GitHub 发布**：公开仓库 `code-outpost/energy-test-toolbox`，`main` 分支；新增 `README.md`、`dist/EnergyTestToolbox.exe`（下载直链）、`.gitignore`。
> - **官网**：`docs/index.html` 单文件科技感落地页（10 分类 / 53 工具 / 3 张真实截图 / 架构 / 下载），由 `.github/workflows/pages.yml` 部署至 https://code-outpost.github.io/energy-test-toolbox/ 。
> - 模块计数未变，仍为 **53 个工具 / 10 大分类**；exe 7,806,976 字节。
> 形态：**原生桌面应用**（Go + WebView2，Windows 已出包；macOS 待补）
>
> **v3.6（2026-11-08）科技感视觉重构 + 新增"日常工具"分类（6 个非新能源工具）**
> - **科技感视觉重构（默认深色 HUD / 霓虹）**：`src/assets/css/style.css` 全面重写为设计系统 v5——深色为默认主题（`:root` = 深色，`[data-theme="light"]` 为浅色变体），含：固定层**网格背景 + 双霓虹光晕**（青/紫，缓慢漂移 `gridDrift`）**、玻璃拟态面板**（`backdrop-filter` blur + 半透明）**、**渐变高光顶栏下划线**、**侧边导航激活态左侧渐变光条**、卡片 HUD 四角括号（`.card/.cat-card/.aside-card::before/::after`）、**霓虹发光计算器键帽**（运算符青光、等号渐变发光、显示屏青色数字辉光）。所有既有 class 名保留，布局（两栏 stage）不变。
> - 默认主题改为 dark：`index.html` `<body data-theme="dark">` + `app.js` `savedTheme` 默认 `'dark'`；右上角仍可切回浅色。
> - **新增"日常工具"分类（6 个与新能源无关的通用工具，模块总数 47→53）**：`unit-converter`(长度/质量/面积/体积/速度/时间/数据/温度 实时换算 + 全单位对照表)、`income-tax`(中国年度综合所得个税 7 级累进 + 税后到手)、`mortgage`(等额本息/等额本金月供与总利息)、`bmi`(BMI 中国标准分类 + 理想体重 + 基础代谢)、`geometry`(圆/矩形/三角/梯形/球/圆柱/圆锥/正方体/长方体 周长面积体积)、`random`(随机抽签去重/可重复 + 掷骰子求和)。均为纯本地离线。
> - 验证：`scripts/verify.mjs` **53/53** 通过；`scripts/test.interact.mjs` **20/20** 通过（新增单位换算 1km→1000m、个税 10%、BMI 22.5、几何圆面积 3.1416、随机掷骰总和）。修复测试桩 `dispatchEvent` 使其同时触发 `on<type>` 属性处理器（与浏览器一致）。重新编译 `能源测试工具箱.exe`（7,584,768 bytes），冒烟：首页 200、`data-theme="dark"`、`gridDrift`/`--grad` 等科技感样式、6 个 `modules/daily/` 引用均确认打进二进制。
>
> **v3.5（2026-11-08）新增"高压电工"考证分类 6 工具**
> - **新增"高压电工"分类（6 个工具，模块总数 41→47）**：`hv-transformer`(变压器额定参数/变比/负载电流折算)、`hv-motor`(电动机额定电流精确法 + 380V≈2A/kW 经验 + 启动电流)、`hv-reactance`(感抗/容抗/谐振频率)、`hv-safety`(高压安规安全距离查表 + 安全电压/电流)、`hv-ampacity`(导线载流量口诀估算：10下五/25·35四三界/70·95两倍半 + 穿管八折/高温九折/裸线加一半/铜线升级)、`hv-cheatsheet`(公式速查卡，七类公式 + 口诀汇总)。均为纯本地、离线可用，契合高压电工证考试复习。
> - 复用既有 `.card / .form-grid / .field / .result-box / .formula` 样式；新增 `.formula-list/.formula` 用于速查卡排版。
> - 验证：`scripts/verify.mjs` **47/47** 通过；`scripts/test.interact.mjs` **15/15** 通过（新增变压器 800kVA→1154.7A、安全距离 10kV→0.70m、载流量估算、公式卡非空）。重新编译 `能源测试工具箱.exe`（7,554,048 bytes），冒烟：首页 200，6 新模块与分类/图标均确认打进二进制。
>
> **v3.4（2026-11-08）两栏布局 + 右侧"剩余内容" + 新增"开发常用"6 工具**
> - **布局重构（解决"超出页面要下翻"）**：内容区改为固定高度的**两栏舞台**——左侧主区 + 右侧 `aside` 面板，**整页不再纵向滚动**；只有各栏内部在必要时滚动。右侧面板默认展示模块说明 / 使用提示 / 速查参考 / 通用小贴士；计算器额外把**历史记录移到右侧**，并附"切换计算器"快捷入口。窄窗（<920px）自动折叠为单列。
> - **计算器美化**：`.calc` 强化"设备"质感（渐变面板 + 强阴影 + 深邃显示屏），计算器在主区居中；标准/科学/程序员的历史记录统一在右侧。
> - **新增"开发常用"分类（6 个工具，模块总数 35→41）**：JSON 工具（格式化/压缩/校验/转义）、正则测试器（实时匹配/分组/高亮）、颜色转换（HEX↔RGB↔HSL + 预览）、文本处理（统计/去重/排序/大小写/反转）、Base64/URL 编解码（Unicode 兼容）、密码生成器（可定制 + 熵强度）。均为纯本地、离线可用。
> - **程序员计算器补齐算术键**：此前 UI 只有位运算/逻辑键，缺 `+ − × ÷ =`，无法做普通四则；新增算术键行。
> - 验证：`scripts/verify.mjs` **41/41** 模块注册并渲染通过；`scripts/test.interact.mjs` **10/10** 通过（含标准/科学/程序员历史在右侧 aside、程序员 255+1=256）。重新编译 `能源测试工具箱.exe`（~7.5 MB），冒烟：首页 200，6 个新模块与布局样式均确认打进二进制。
>
> **v3.3（2026-11-06）计算器套件修复 + 重新出包**
> - 修复**标准计算器缺失 `+` 键**的真实缺陷（此前键盘只有 `−` 没有 `+`，无法做加法）；改为 4×5 对称布局：AC / ⌫ / % / ÷ · 7-9 × · 4-6 − · 1-3 + · ± 0 . =。
> - 修复**程序员计算器进制切换崩溃**：HEX 输入 `FF` 后点 `DEC` 会因“先用新进制解析旧 entry”而抛 `超出进制范围`，改为先取 `curVal()` 再切换 base。
> - 交互逻辑测试 `scripts/test.interact.mjs`（Node DOM 桩真实模拟点击/输入）6/6 通过：标准 7+8=15、科学 sin(30°)DEG=0.5、程序员 HEX FF→DEC 255、分数 1/2+1/3=5/6、功率因数 Qc≈42.13 kvar、电缆压降含压降率。模块冒烟 `scripts/verify.mjs` 35/35 通过。
> - 重新编译 `能源测试工具箱.exe`（~7.5 MB）。沙箱内复现出包成功：经 `goproxy.cn` 拉取依赖，Windows Go 1.26.10 压缩包约 71.5MB（< 出网代理 80MB 上限，单请求即可），`CGO_ENABLED=0 GOOS=windows go build -ldflags "-H windowsgui -s -w"`。运行时冒烟：内置 HTTP 服务返回首页 200，且 `+` 键与程序员修复均已确认打进二进制。
>
> **v3.2（2026-11-06）交付 Windows exe**
> - 成功编译 `能源测试工具箱.exe`（~7.2 MB，纯 Go / CGO_ENABLED=0 / GUI 子系统，无 MSVC）。
> - 构建链：Go 1.23.4 触发工具链自动切换至 1.26（go-webview2 传递依赖要求）；依赖仅 `go-webview2` + `go-winloader` + `x/sys`。
> - **移除 `webview_darwin.go`**：上游 `github.com/webview/webview` 已不再是可解析的 Go 包（仅剩 C 库），macOS CGO 绑定无法引入；且 macOS 构建需本机 Xcode。故 macOS 支持**暂 defer**，待改用纯 Go 绑定或系统浏览器兜底方案再加。`go mod tidy` 现已干净通过，一键构建可复现。
> - 运行时冒烟测试通过：exe 启动内置 HTTP 服务，`http://127.0.0.1:随机端口/` 返回首页（含模块脚本/样式），证明前端已通过 `//go:embed all:src` 完整打进二进制。
> - 用户本机出包：`scripts/build-win.ps1`（或 `CGO_ENABLED=0 go build -ldflags "-H windowsgui -s -w" -o 能源测试工具箱.exe .`），需已装 WebView2 运行时（Win10/11 通常自带）。
>
> **v3.1（2026-11-06）UI 重构 + 计算器套件**
> - 界面改为"工具箱"质感：仪表盘首页（分类卡片 + 工具入口）、带图标侧边导航、亮/暗主题、状态栏；去除朴素网页观感。
> - 新增可点击计算器套件（均为按钮式，非纯输入框）：标准计算器、科学计算器（度/弧度切换）、程序员计算器（十六/十/八/二进制 + 位运算 + 64 位位面板）。
> - 新增电力/能源计算器：欧姆定律、三相功率、电阻色环（4/5 环解码 + 可视化色带 + 反推编码）、单位换算（9 类实时双向 + 全量对照）。
> - 共享安全表达式引擎 `engine.js`（无 eval），科学计算器与"表达式计算"复用。
> - 模块总数 28；`scripts/test.mjs` 提供引擎/计算器/导航回归测试，`scripts/verify.mjs` 提供注册渲染校验。

---

## 1. 背景与目标

面向**电力 / 新能源开发测试**场景的桌面工具合集，用于日常开发调试中的编解码、协议报文分析、SQL 辅助、Linux 运维等重复性脑力劳动。

**核心目标**
- 是一个**装在电脑上的桌面程序**：原生窗口、系统菜单、可固定到任务栏 / 程序坞、可离线、可分发给同事。
- 纯离线、本地运行，**协议字段与 SQL 不离开本机**（电力调试敏感场景的刚需）。
- 模块化、可扩展：新增工具低成本接入，不破坏既有结构。
- 输入即出、原始字节 ↔ 字段解释对照，降低协议学习与上手成本。

**市面参考工具（仅作功能对标，未参考任何自有工具）**
- 协议调试：ARIEC60870（IEC101/103/104 原始帧解释器 + Smart Findings + PDF 报告）、qtester104（QT 跨平台、质量标志）、Modbus Poll / QModMaster / Modscan（RTU/TCP 寄存器读写 + 原始 hex 总线监视）、Wireshark（GOOSE/SV/MMS/104 解码、stNum/sqNum 追踪）。
- 进制 / 编码：DevKitLab（任意 2–36 进制 + 位视图 + 二补码 + 大端小端并排预览）、IoT Protocol Toolbox（纯前端、可扩展导航、零依赖、HEX/ASCII/Base64/时间戳/JSON）。
- SQL：sql-formatter（开源、多方言、客户端）、SQLFluff（lint+格式化+CI）、ExtendsClass（方言校验 + 报错定位）。
- 综合报文：TraceEagle（抓包+解密+调试+诊断一体化、多通道时间线）、Wireshark（最全解析）。

---

## 2. 技术架构

| 项 | 选型 | 说明 |
|---|---|---|
| 形态 | **Go + WebView2 原生桌面应用** | Windows 出 `.exe`；macOS 出 `.app` |
| 前端 UI | Web 技术（HTML / CSS / JS） | 声明式模块注册表 + 动态渲染，`go build` 时**整体嵌入二进制** |
| 桌面壳 | **Go**（纯 Go，无 CGo / 无 MSVC） | 内置静态服务器 + 原生窗口；自带 WebView2Loader（go-winloader） |
| 交付物 | **平台原生可执行程序** | 用户不接触任何 HTML 文件，也没有浏览器地址栏 |
| 解析模式 | **仅离线**（粘贴 HEX → 结构化解释） | 不做实时抓包 |
| 离线 | 全部计算在本地完成 | 可完全断网使用 |
| 构建前提 | **仅需 Go 工具链**（无需 MSVC / VS / CGo） | Windows 包甚至可在 Linux 上纯 Go 交叉编译 |

### 2.1 为什么是 Go + WebView2（而不是"网页 / H5"、也不是 Tauri/Rust）

用户要的是桌面程序，不是网站；同时要求能在本机顺利打包，而 Tauri 的 Rust 后端在本机装 MSVC 生成工具反复失败。因此改用 **Go 作为桌面壳**：

- **UI 用 Web 技术写，但跑在原生窗口里**。Windows 用系统自带的 Edge WebView2，macOS 用系统自带的 WKWebView（Web 前端代码在 `go build` 时通过 `//go:embed` **整体嵌入二进制**，运行时磁盘上不存在独立可见的网页文件，也没有地址栏）——外观与交互都是原生桌面应用（类比 VS Code、Discord 的桌面端）。
- **完全不需要 MSVC / Visual Studio / CGo**：Go 自带链接器，本机此前就能用 Go 打出 `.exe`（如 NetScan Pro），与此一致；用户本机已具备该能力。
- go-webview2 通过 **go-winloader 自带内嵌的 `WebView2Loader.dll`**，运行时只需系统已装的 WebView2 运行时（Win10/11 通常预装），无需额外附带任何 DLL 或 SDK。
- 一套纯 JS 的协议解析前端，跨 Windows / macOS **零改动复用**。
- 可选能力：后续如需原生文件对话框、系统托盘、本地存储，可用 Go 标准库 / 系统 API 扩展。

> 一句话：**前端 HTML/CSS/JS 是"应用源码"，不是"给用户打开的网页"**。最终交付物是 `.exe` / `.app` 原生程序。

### 2.2 项目结构

```
D:/小工具/
├── go.mod                 # Go 模块定义
├── main.go                # 桌面壳入口：embed 前端资源 + 内置 HTTP 服务 + 平台分发
├── webview_windows.go     # Windows 窗口（build tag windows，go-webview2 纯 Go）
├── webview_darwin.go      # macOS 窗口（build tag darwin，webview/webview + CGo）
├── package.json           # 脚本：serve（Web 预览）、build（Go 构建）
├── src/                    # 前端 UI 源码（编译时整体嵌入二进制）
│   ├── index.html
│   ├── assets/css/style.css
│   ├── app.js              # 入口：导航 + 路由 + 动态渲染 + 主题
│   ├── utils/modules.js    # 声明式模块注册表 + 共享工具
│   └── modules/            # 各工具模块（纯 JS）
│       ├── encoding/       # 通用编解码
│       ├── protocol/       # 协议报文解析（M2-M5）
│       ├── sql/            # SQL 辅助（M4）
│       ├── linux/          # Linux 命令（M1 起步）
│       └── misc/           # 综合工具（M5）
├── scripts/                # 开发 / 构建辅助（静态服务器、图标生成）
├── .github/workflows/      # 跨平台 CI 自动构建（Win + Mac）
└── design.md
```

### 2.3 前端模块体系（通用，与具体产品无关）

- `utils/modules.js`：导出模块注册表数组，每项含 `id / name / category / icon / group / render(container)`。
- `app.js`：读取注册表 → 左侧按 `category/group` 分类渲染导航 → 右侧按当前选中模块调用其 `render()`。
- 路由：`#/module/<id>` 深链，便于分享与回退。
- 每个模块自包含 DOM 与事件逻辑，零全局污染。

---

## 3. 模块清单

四大类 + Linux 命令模块。

### 3.1 通用编解码（M1）
| 子工具 | 能力 |
|---|---|
| 进制转换 | 2–36 任意进制互转、位视图（点击翻位）、8/16/32/64 位二补码、大端 / 小端字节序并排预览、前缀识别 |
| 编码转换 | HEX↔ASCII、Base64 编解码、URL 编解码 |
| 时间戳 | Unix 时间戳 ↔ 日期（秒 / 毫秒）、时区、实时时钟 |
| 字节序 | 大端 / 小端互换（int16/32/64、float、double） |
| 校验和 | CRC16 / CRC32 / Modbus CRC / LRC 和校验 |

### 3.2 协议报文解析
**核心层（M2-M3，字节帧型，粘贴 HEX 即解析）**
- IEC 60870-5-104：APDU/ASDU 全字段、类型标识库、品质描述词、时标、示例库
- MODBUS RTU/TCP：从站地址、功能码（01/02/03/04/05/06/0F/10）、寄存器值（16/32 位有符号 / 浮点）、异常码、CRC/LRC/MBAP
- GOOSE (IEC61850)：二层帧头（MAC 01:0C:CD、EtherType 0x88B8、VLAN）、PDU（gocbRef/datSet/goID/stNum/sqNum/timeAllowedToLive/Test/ConfRev/数据集值）、stNum/sqNum 事件判定
- SV 采样值：APPID、SVID、采样序列、ASDU 展开
- DL/T645：±33 加解密、字节反转（1997/2007）

**扩展层（M5，已完成·代码）**
- DNP3：新能源场站 SCADA 主力，事件驱动 + 时间戳（链路层控制域 / 应用层功能码·IIN / 对象头 G·V·限定符 / 48 位绝对时间解码）
- IEC 60870-5-101/103：串口远动 / 继电保护（固定帧 / 可变帧识别、链路控制域、可变帧内 ASDU）
- CDT 循环式远动：国内存量老站（同步字 EB90×3、控制字、信息字遥测 / 遥信按位）
- IEC 61850 MMS / MQTT / OPC UA：轻量报文结构 / Payload 解码（MQTT 固定头、OPC UA 二进制头、MMS ASN.1 BER 结构树）

### 3.3 SQL 辅助（M4）
- SQL 格式化 / 美化（多方言：MySQL/PG/SQLServer/SQLite/Oracle）
- 语法校验（报错行列定位）
- 大小写 / 风格转换
- 表结构 / 字段提取
- 查询差异对比

### 3.4 Linux 命令（M1 起步）
| 子工具 | 能力 |
|---|---|
| chmod 权限计算器 | 符号(rwx) ↔ 数字(0-7) ↔ 八进制，含 suid/sgid/sticky 特殊位 |
| 命令速查库 | 分类（文件 / 网络 / 系统 / 进程 / 压缩 / 文本处理 / 权限 / 磁盘 / 包管理）、搜索、语法、示例 |
| 命令解析器 | 粘贴命令，拆解命令名 + 各参数含义（基于速查库 + 通用解析） |
| （预留）运维模板生成 | tar/rsync/scp/ssh/find/curl/grep/sed/awk 模板生成（后续扩展） |

### 3.5 综合工具（M5）
- 报文 HEX 字节级 diff
- Hex dump 美化（带 ASCII 列）
- 表达式 / 计算
- 历史记录
- 报告导出（PDF/CSV）

---

## 4. UI / 交互
- 三栏布局：顶部标题栏 + 左侧分类导航 + 右侧工具面板（原生窗口内）。
- 输入即出：多数工具实时计算，无需点击按钮。
- 原始字节 ↔ 字段解释双栏对照（协议类工具）。
- 暗 / 亮主题切换。
- 每工具保留历史 + 一键复制结果。

---

## 5. 里程碑
- **M1（已完成）** Go 原生壳（go-webview2 纯 Go 窗口）+ 前端模块体系（声明式注册表 + 三栏导航 + 主题切换）+ 通用编解码 ×5 + Linux 命令 ×3 + 跨平台构建 / CI 配置
- **M2（已完成·代码）** 协议核心：IEC 60870-5-104（APDU/ASDU 全字段、类型标识库、传送原因、CP56Time2a 时标、品质描述词）+ MODBUS RTU/TCP（功能码/异常码、CRC16、寄存器值多类型解释）
- **M3（已完成·代码）** GOOSE（二层帧 + ASN.1 BER + stNum/sqNum 事件判定）+ SV 采样值（APPID + seqData 通道解释）+ DL/T645（±33 编解码 + 帧构造）
- **M4（已完成·代码）** SQL 工具组：格式化 / 大小写转换 / 表名·字段提取 / 语法检查（多方言）
- **M5（基本完成·代码）** 扩展协议已实现（DNP3 / IEC101-103 / CDT / MMS·MQTT·OPC UA 轻量结构解码）；综合工具已完成（HEX 字节级 diff、Hex dump、安全表达式计算）；报告导出（CSV）与最终打包打磨待收尾

> 当前共 **61 个工具模块**（计算器 10 + 协议报文解析 10 + 高压电工 7 + 日常工具 6 + 开发常用 6 + 电力计算 5 + 通用编解码 5 + Linux 命令 4 + SQL 辅助 3 + 综合工具 5）。所有模块均通过 `scripts/verify.mjs`（DOM 桩）冒烟验证：注册成功且默认样本走通解析渲染；计算类另由 `scripts/test.formulas.mjs` 校验标准答案。

---

## 6. 验证
- 每个解析模块附**已知样本报文 + 字段说明**。
- 用脚本 / 单元测试验证输出正确性（符合"用脚本统计真实数据"的偏好）。
- 桌面应用验证：`npm run dev` 启动原生窗口预览；`npm run build` 产出安装包并实际安装运行。

---

## 7. 构建与分发（重要）

### 7.1 本地构建前置
- **Go 工具链 ≥ 1.23**（唯一硬性要求，无需 MSVC / VS / CGo）。本机此前已用 Go 打包过 `.exe`（如 NetScan Pro），即在 `PATH` 或 `~\go\bin`、`~\buildcache\go_extract\go\bin` 下。新机器从 https://go.dev/dl 安装并勾选加入 PATH 即可。
- **Windows**：系统自带的 **WebView2 运行时**（Win10/11 通常预装；已确认本机为 136.x）。go-webview2 通过 go-winloader **自带内嵌 `WebView2Loader.dll`**，无需额外附带任何 DLL 或 SDK。
- **macOS**：Xcode Command Line Tools（`xcode-select --install`），Web 窗口走系统 WebKit（CGO，Mac 自带 clang）。
- **不再需要** Visual Studio / MSVC / Rust / Tauri——这是相对上一版（Tauri/Rust 方案）的最大改动，直接解决"MSVC 安装反复失败、打不出包"的问题。

> **沙箱现已可复现出包（已验证）**：早期认为出网代理会把大文件截断在约 80MB、而 Go 完整包约 145MB 故无法在沙箱装 Go；但实测 **Windows Go 1.26.10 压缩包约 71.5MB（< 80MB 上限，单请求即可下载）**，配合 `GOPROXY=https://goproxy.cn,direct` 拉取依赖，`CGO_ENABLED=0 GOOS=windows go build -ldflags "-H windowsgui -s -w"` 即可在沙箱直接编译出 `能源测试工具箱.exe`（已多次成功）。本机出包仍可用 `scripts/build-win.ps1` 一键完成（需已装 WebView2 运行时）。

### 7.2 构建命令（本机执行，仅需 Go）
**Windows（推荐一键）**：在项目目录 `D:\小工具` 下，用 PowerShell 执行：
```powershell
.\scripts\build-win.ps1
```
脚本会自动定位 Go（兼容 WorkBuddy 的 `~\buildcache\go_extract\go\bin` 路径）、设置 `GOPROXY=https://goproxy.cn,direct`、拉取依赖（go-webview2 等纯 Go）、并以 `CGO_ENABLED=0` 编译出 **`能源测试工具箱.exe`**。双击该 exe 即运行（Edge WebView2 原生窗口，无浏览器边框）。

**macOS（已装 Xcode CLT）**：
```bash
go mod tidy
go build -o EnergyToolbox.app/Contents/MacOS/EnergyToolbox .
```
- 无需任何 MSVC / VS / Rust；`npm` 仅用于开发期 Web 预览（`npm run serve` 起一个本地静态服务器看效果），**构建 exe/app 完全不依赖 Node**。
- 图标：已在 v3.7 落地——`assets/app.ico`（七尺寸）+ `assets/app.manifest` 经 `rsrc` 编为 `rsrc_windows_amd64.syso`，Go 链接器自动嵌入 exe 的 PE 资源；`src/assets/favicon.ico` 随 `//go:embed all:src` 作为窗口页 favicon。重新生成见 `README.md`「重新生成图标」，校验用 `python scripts/verify_icon.py`。

### 7.3 跨平台 CI 自动构建
- `.github/workflows/build.yml`（GitHub Actions）：
  - **Windows 包在 `ubuntu-latest` 上纯 Go 交叉编译**（`CGO_ENABLED=0 GOOS=windows`），**完全不需要 MSVC / Windows 机器 / VS**——这正是相对 Tauri 方案的巨大优势。
  - macOS 包在 `macos-latest` 上构建（CGO，Mac 自带 clang）。
  - 两个 job 分别上传 `EnergyToolbox.exe` 与 `EnergyToolbox.app` 产物。
- 触发方式：推送 `v*` 标签，或在 Actions 页手动 `workflow_dispatch`。

### 7.4 关于"不是纯 HTML"
前端 HTML/CSS/JS 是应用的 UI 源码，经 `go build` 的 `//go:embed` **整体编译进原生二进制**；最终用户拿到的是 `.exe` / `.app` 原生程序，磁盘上不存在独立可见的网页文件，也没有浏览器地址栏。开发期想先看效果可 `npm run serve` 起本地静态服务器（或直接双击 `src/index.html`）预览 UI，但**正式交付物是编译出的原生程序**。
