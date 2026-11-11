# 能源测试工具箱 v0.3.0

桌面化闭环 + **macOS 原生版**：**62 个工具 / 10 大分类**，Windows 单文件 exe 与 macOS 通用 `.app` 双平台同版本发布。常规功能完全离线、不上传任何输入数据；仅在你主动点「⟳ 更新」时访问 GitHub。

这一版不再堆计算工具，而是把已有能力补成能长期使用的桌面应用：数据不再因为改名或随机端口而丢失、可整体备份迁移、不会双开、更新可校验、主题跟随系统，并首次提供 macOS 版。

## 本次更新

- **修复数据分家（重要）**：WebView2 用户数据目录此前默认按 exe 文件名创建，`能源测试工具箱.exe` 与 `EnergyTestToolbox.exe` 会各存一份收藏 / 历史 / 测试记录，改名就像「数据消失」。现在固定为 `%APPDATA%\EnergyTestToolbox\WebView2`，与文件名彻底解耦。
- **修复随机端口导致的 Web 存储丢失（重要）**：内置服务此前每次启动都用随机端口，而 `localStorage` 按 origin（含端口）分区，等于每次换一份数据。现在优先复用上次端口（默认 `39017`），并在「设置与备份 → 运行环境」显示真实平台、数据目录、端口与窗口形态。
- **macOS 原生窗口**：改用维护中的 `webview_go` + 系统 WKWebView（历史卡点是已废弃的 `webview/webview` 不可解析）。CI 在 Intel / Apple Silicon runner 上分别编译后 `lipo` 成 universal `EnergyTestToolbox.app`，含固定 bundle id、6 尺寸 icns 与 ad-hoc 签名；`flock` 文件锁实现单实例。Windows 侧仍是纯 Go、无 CGo。
- **全局备份 / 恢复**：新增「设置与备份」入口，一键导出收藏、最近使用、各工具历史、结果中转站与测试记录为 JSON；导入时校验应用标识、schema、键前缀与体积，覆盖恢复后自动刷新。换机、重装前请先导出。
- **单实例与窗口记忆**：双开不再产生两个端口与两份数据，第二个实例只把已有窗口切到前台；Windows 窗口大小与位置重启后原样恢复。
- **更新闭环（双平台）**：桌面版可下载**本平台**的新版安装包并按 Release 的 `SHA256SUMS.txt` 逐字节校验、定位到文件。外链强制 HTTPS + GitHub 域名白名单（重定向逐跳校验），校验失败立即删除下载文件；**不会自动替换正在运行的应用**，由你关闭程序后手动覆盖。
- **主题与无障碍**：主题支持「跟随系统 / 深色 / 浅色」并实时响应系统偏好；补齐键盘 `:focus-visible` 焦点环，尊重系统「减少动态效果」。
- **质量**：`test.settings.mjs` 48 条断言、Go 单测 11 组；全套回归 62/62 模块、20/20 交互、55/55 数值、38/38 量纲、27/27 总线、双主题浏览器探针 62×2、darwin 双架构纯 Go 编译全通过。

## 升级说明

- Windows 直接覆盖旧 exe 即可，无需卸载；macOS 用新版 `.app` 覆盖 `/Applications` 中的旧版即可。
- ⚠️ **首次升级请先看这里**：新版改用固定的数据目录与固定端口，旧版数据仍留在 `%APPDATA%\<旧 exe 文件名>` 的旧 profile / 旧随机端口对应的 origin 下。建议先用旧版在「设置与备份」导出一份 JSON，升级后用新版导入恢复。
- 「设备联调」的真实串口 / TCP 收发、以及更新包的下载与校验仅桌面版可用；浏览器打开 `src/index.html` 时只构造报文、检查更新仅提示下载链接。

## 下载与校验

| 平台 | 附件 | 运行要求 |
| --- | --- | --- |
| Windows | `EnergyTestToolbox.exe` | Windows 10/11，需 Microsoft Edge WebView2 Runtime（系统通常自带），双击即可、无需安装 |
| macOS | `EnergyTestToolbox-macos-universal.zip` | macOS 11+，Intel / Apple Silicon 通用；解压后把 `EnergyTestToolbox.app` 拖进「应用程序」 |

- `SHA256SUMS.txt` 同时列出两个平台附件的哈希，应用内「设置与备份 → 检查更新 → 下载并校验」会自动挑本平台那一行。
- Windows 首次运行若出现 SmartScreen 提示，选择「更多信息 → 仍要运行」。macOS 包已 ad-hoc 签名但**未公证**：若提示「无法验证开发者」，请右键 `.app` → 打开，或执行 `xattr -dr com.apple.quarantine /Applications/EnergyTestToolbox.app`。
- 本版仍未做真实设备联调验收：串口 / TCP 收发与 WebView 窗口建议在现场复验一次。

完整更新记录见 [CHANGELOG.md](CHANGELOG.md)，功能清单见 [README.md](README.md)，官网：<https://code-outpost.github.io/energy-test-toolbox/>。
