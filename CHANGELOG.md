# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。应用内「关于 / 检查更新」与官网展示的版本号以 `src/version.js` 为唯一来源。

## [v0.3.0] — 2026-11-11

桌面化闭环 + **macOS 原生版**，共 **62 个工具 / 10 大分类**（在 v0.2.0 基础上，综合工具 5 → 6）。功能层面不再堆计算工具，转向把已有能力补成可长期使用的双平台桌面应用。

### 新增
- **「设置与备份」入口**：主题三态、本机数据整体导出 / 恢复、版本更新下载与校验统一收进一个可搜索的模块。
- **固定用户数据目录**：WebView2 `UserDataFolder` 指向 `%APPDATA%\EnergyTestToolbox\WebView2`。修复此前按 exe 文件名建目录、改名即「丢收藏 / 丢测试记录」的问题。
- **全局备份 / 恢复**：导出全部 `tb_` 前缀数据为带应用标识与 schema 的 JSON；导入校验标识 / schema / 键前缀 / 值类型 / 4 MB 上限，覆盖恢复后自动刷新。
- **单实例与窗口记忆**：`CreateMutexW` 阻止双开（原双开会起两个随机端口、两份数据），第二个实例聚焦已有窗口；窗口宽高与位置持久化，重启原样恢复。
- **更新闭环**：本机后端提供最新版本查询、附件下载、`SHA256SUMS.txt` 校验与文件定位；外链强制 HTTPS + GitHub 域名白名单（含重定向逐跳校验），校验失败立即删除，**不静默自替换 exe**。仅主动检查更新时联网。
- **主题跟随系统与无障碍**：主题扩为「跟随系统 / 深色 / 浅色」并实时响应系统偏好；补齐 `:focus-visible` 键盘焦点环与 `prefers-reduced-motion` 动效降级。
- **macOS 原生窗口**：`webview_darwin.go` 用 `webview_go` + 系统 WKWebView；CI 用 Intel / Apple Silicon 两个 runner 分别编译后 `lipo` 成 universal `EnergyTestToolbox.app`（固定 bundle id、6 尺寸 icns、ad-hoc 签名）。`flock` 文件锁单实例，`webview_darwin_nocgo.go` 提供无 Xcode 环境的纯 Go 降级形态。
- **固定服务端口（数据可靠性修正）**：内置服务由随机端口改为复用上次端口（默认 `39017`）。此前 `localStorage` 按 origin（含端口）分区，每次启动都换 origin，收藏 / 最近使用 / 中转站 / 测试记录会「看似丢失」；固定目录只解决了一半。新增 `/api/app/info` 在「运行环境」显示真实平台、数据目录、端口与窗口形态，`/api/app/quit` 供降级形态优雅退出。

### 工程化
- 新增 `desktop.go` / `desktop_windows.go` / `desktop_darwin.go` / `desktop_other.go` / `api_app.go` / `api_update.go`，`main.go` 接入单实例、固定端口与本机 API；`webview_windows.go` 固定 `DataPath` 并恢复窗口几何。
- 新增 `webview_darwin.go` / `webview_darwin_nocgo.go`、`assets/Info.plist` / `app.icns`、`scripts/build-macos.sh` / `verify_icns.py`；`go.mod` 引入 `webview_go`（仅 darwin && cgo 参与编译，Windows 仍零 CGo）。
- `build.yml` 重构为 verify → Windows / macOS 双架构构建 → macOS 打包 → 统一发布；`SHA256SUMS.txt` 改为同时列出 exe 与 macOS zip，`api_update.go` 按平台挑对应那一行。
- `test.settings.mjs` 扩到 48 条（新增运行环境 / macOS 资产选择 / 退出按钮）；Go 单测 11 组（新增端口复用、环境接口、跨站拒绝）；CI 纳入 darwin 双架构纯 Go 编译与 icns 结构校验。
- 全套回归：62/62 模块、20/20 交互、55/55 数值、38/38 量纲、27/27 总线、48/48 设置、boot 0 失败、语法 68 文件 0 失败、双主题浏览器探针 62×2、Go 11 组。

> ⚠️ 升级提示：新版使用固定数据目录**与固定端口**，旧版数据仍在 `%APPDATA%\<旧 exe 文件名>` 的旧 profile / 旧随机端口对应的 origin 下；请先用旧版导出备份，再在新版「设置与备份」导入恢复。macOS 包未公证，首次打开请右键 → 打开或清除 quarantine 属性。

---

## [v0.2.0] — 2026-11-10

工程化深化版本，共 **61 个工具 / 10 大分类**（计算器 10、协议报文解析 10、高压电工 7、日常工具 6、开发常用 6、电力计算 5、通用编解码 5、Linux 命令 4、SQL 辅助 3、综合工具 5）。

### 新增
- **统一量纲层**：`src/utils/units.js`（16 个单位族、SI 基准换算、仿射温标）；专门拦截 kW / kvar / kVA 混加，按 S = √(P²+Q²) 合成。新增「量纲校验台」。
- **跨工具结果串联**：`src/utils/bus.js` 结果总线，支持发布 / 引用填入 / 按量纲自动换算；右侧「结果中转站」可把上次结果一键送入其它工具。已接通 三相功率 → 功率因数补偿、变压器二次电流 → 载流量校核等链路。`Enter` 触发当前工具计算。
- **报表深化**：批量计算台新增内联 SVG 趋势曲线、Excel (`.xls`) 导出、可打印 PDF 计算书与本机测试记录留痕；新增「测试记录」工具（回看 / 恢复 / 导出 / 清空）。
- **工程校核**：注册表新增 `limits` 元数据，12 个电力 / 高压模块标注输入范围、适用边界、示例与警告；新增「工程标准数据表」（载流量 / 短路阻抗 / 继保系数，带边界声明与标准出处）。
- **新工具**：`unit-guard`、`test-records`、`hv-tables`（58 → 61）。

### 工程化
- 新增 `test.units.mjs`（38 条量纲断言）与 `test.bus.mjs`（27 条结果总线 / 端到端串联 / 记录断言），接入 CI。
- `test.formulas.mjs` 扩至 55 条；`verify.mjs` / `test.interact.mjs` 补齐共享基础层加载；双主题探针覆盖 61×2。
- README 功能表按真实分类计数修正（旧表停留在 9 / 3 / 2 / 1 等过时数字）。

---

## [v0.1.0] — 2026-11-09

首个正式发布版本，共 **58 个工具 / 10 大分类**（10 分类数量依次为：计算器 10、协议报文解析 10、高压电工 6、日常工具 6、开发常用 6、电力计算 5、通用编解码 5、Linux 命令 4、SQL 辅助 3、综合工具 3）。

### 新增
- **设备联调**：Modbus TCP / 裸 TCP / 串口收发、报文模板、自动 CRC、收发日志（仅桌面版可用，纯前端环境自动降级）。
- **批量计算台**：CSV 粘贴或导入 → 套用公式模板批量计算 → 结果表格 → 导出 CSV 报告。
- **个性化**：收藏置顶、最近使用、全局快捷键（`/`、`Ctrl+K`、`Esc`）、无障碍标签。
- **公式依据**：电力计算与高压电工模块统一在右侧面板标注公式出处、适用边界与参考标准。
- **版本号与更新检查**：顶栏显示版本，一键查询 GitHub 最新 Release。
- 补齐薄弱分类：新增 SQL 语句美化、建表语句生成、crontab 生成器等模块。

### 修复
- 重写 `.github/workflows/build.yml`：移除在 macOS 上必然编译失败的 job（唯一入口带 `//go:build windows`），改为 Windows 构建 + 测试 + 发布一条链路，产物名与官网下载统一。
- 计算器显示屏对比度不足、浅色主题下深色「黑盒」。
- `app.js` 漏逗号导致的白屏，新增入口级启动回归测试防止复发。
- 浅色主题逐模块补齐对比度：`.hint` 在浅色结果卡上由 `#8a93a8` 改为 `#48566e`，对比度 2.75 → 5.9。
- `sql` 模块 `T.util.copyBtn` 命名空间误用（真实浏览器抛 TypeError，DOM 桩测漏网）；`dlt645`、`endian` 同类/相关缺陷一并修复。
- 新增 `check-light-theme.mjs` 真实浏览器双主题探针（58 模块 × 2 主题，逐模块 render + WCAG 对比度）与 `check-syntax.mjs` 静态防线，均接入 CI。

### 工程化
- 首个带 SHA256 校验和的 GitHub Release；官网下载改指 `releases/latest`。
- 全套测试接入 CI：模块注册、交互、入口启动、数值 golden、跨文档一致性、PE 图标资源。
- 新增 `LICENSE`（MIT）、`CONTRIBUTING.md`、Issue 模板、更新日志。

---

## 更早的迭代（未打 tag）

- 2026-11-08：科技感深色 HUD 主题、两栏不翻页布局、计算器 10 工具、高压电工 6 工具、日常工具 6 工具、开发常用 6 工具。
- 2026-11-07：Windows PE 图标 + 高 DPI manifest、网页 favicon。
- 2026-11-06：Go + WebView2 单文件 exe 交付，前端资源 `go:embed` 内嵌。
