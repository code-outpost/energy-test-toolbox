# ⚡ 能源测试工具箱

> 面向电力 / 新能源开发测试的一站式桌面工具集 —— **63 个工具 · 10 大分类 · Windows / macOS 双平台 · 完全离线**

[官网](https://code-outpost.github.io/energy-test-toolbox/) · [下载 Windows 版](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox.exe) · [下载 macOS DMG](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox-macos-universal.dmg) · [下载 macOS PKG](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox-macos-installer.pkg) · [Releases](https://github.com/code-outpost/energy-test-toolbox/releases)

把日常要查的公式、要算的参数、要解的报文，全部收进一个桌面窗口。从标准计算器到 IEC 104 / MODBUS 报文解析，从高压电工考证公式到 JSON / 正则，打开即用。

---

## 下载与运行

| 平台 | 下载 | 系统要求 / 形态 |
| --- | --- | --- |
| Windows | [EnergyTestToolbox.exe](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox.exe) | Windows 10 / 11，需 [Edge WebView2 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)（系统通常已自带）；绿色单文件，约 9 MB |
| macOS（推荐） | [EnergyTestToolbox-macos-installer.pkg](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox-macos-installer.pkg) | **双击 → 系统安装向导 → 自动装入 `/Applications`**；安装程序会清理隔离属性并重建签名，装完双击图标即可打开 |
| macOS（拖拽） | [EnergyTestToolbox-macos-universal.dmg](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox-macos-universal.dmg) | 双击挂载，把 `EnergyTestToolbox.app` 拖到窗口里的 `Applications` 图标 |
| macOS（旧格式） | [EnergyTestToolbox-macos-universal.zip](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox-macos-universal.zip) | 解压得 `.app`，供脚本化分发 / 兼容旧链接；Intel / Apple Silicon 通用，原生 WKWebView 窗口 |

| 项目 | 说明 |
| --- | --- |
| 成品文件 | 仓库根目录 `能源测试工具箱.exe`，`dist/EnergyTestToolbox.exe` 为其同步镜像；两者与 Release 附件的 SHA256 完全一致 |
| 联网 | 常规功能零外网请求，所有前端资源已嵌入二进制；仅主动点「⟳ 更新」时访问 GitHub |
| 校验 | 每次 Release 的 `SHA256SUMS.txt` 列出 Windows exe 与 macOS 的 dmg / pkg / zip 共 4 行哈希，应用内「下载并校验」会自动挑本平台那一行（macOS 为 dmg） |

WebView2Loader.dll 已内嵌；Windows 若窗口无法打开请安装 WebView2 运行时。macOS 包使用 ad-hoc 签名、未做 Apple 公证：**PKG 安装通常无需额外操作**；若 DMG / zip 首次打开提示「无法验证开发者」或「已损坏」，请**右键 → 打开**，或执行：

```bash
xattr -dr com.apple.quarantine /Applications/EnergyTestToolbox.app
```

两个平台共用同一套前端与本机 API（`//go:embed all:src`），功能完全一致；数据目录分别为 `%APPDATA%\EnergyTestToolbox` 与 `~/Library/Application Support/EnergyTestToolbox`，内置服务固定复用端口 `39017`，避免因随机端口导致 Web 存储换 origin 丢数据。

---

## 功能一览（63 个工具 / 10 大分类）

| 分类 | 工具数 | 代表功能 |
| --- | ---: | --- |
| 计算器 | 10 | 标准 / 科学 / 程序员计算器、日期、分数、欧姆定律、三相功率、电阻色环、单位换算、表达式计算 |
| 协议报文解析 | 11 | IEC 104 / 101 / 103、MODBUS、GOOSE、SV、DL/T 645、DNP3、CDT、MMS / MQTT / OPC UA、设备联调，以及 **IEC 104 四遥点位计算器** |
| 高压电工 | 7 | 变压器变比、电动机额定电流、感抗容抗与谐振、安全距离、载流量口诀、公式速查、工程标准数据表 |
| 日常工具 | 6 | 通用单位换算、个税、房贷月供、BMI、几何计算、随机抽签 |
| 开发常用 | 6 | JSON 格式化、正则测试、颜色转换、文本处理、Base64 / URL、密码生成 |
| 电力计算 | 5 | 功率因数补偿、电缆压降与载流量、光伏阵列、蓄电池容量、电费估算 |
| 通用编解码 | 5 | 进制转换、编码转换、时间戳、字节序互换、校验和 / CRC |
| Linux 命令 | 4 | chmod 权限计算器、命令速查、命令解析、crontab 生成器 |
| SQL 辅助 | 3 | SQL 语句辅助、格式化美化、建表语句生成 |
| 综合工具 | 6 | HEX 差异 / Dump、表达式计算、批量计算台、量纲校验台、测试记录、设置与备份 |

### v0.4.1 macOS 双击安装包（DMG + PKG）

- **DMG 拖拽安装镜像**：`hdiutil` 生成只读压缩 UDZO 镜像，内含通用 `.app`、`Applications` 快捷方式与中文安装说明；双击自动挂载，拖进去即完成安装。CI 会实际挂载镜像校验 `.app` 可执行位与快捷方式。
- **PKG 双击安装器**：`pkgbuild` 组件包，安装位置固定 `/Applications`，带 `postinstall` 脚本清理 `com.apple.quarantine` 并重建 ad-hoc 签名；双击后一路「继续」即由系统安装向导装好，**装完直接双击图标可用**。CI 展开包校验 `PackageInfo`、payload 主程序与脚本。
- **更新下载按平台切换**：macOS 的「检查更新 → 下载并校验」改为挑 `.dmg`（落盘扩展名同步），Windows 仍为 `.exe`；`SHA256SUMS.txt` 合并为 4 行多平台清单。
- **官网**：macOS 下载卡片提供 DMG / PKG 双按钮，标注 PKG 推荐与首次打开处理说明；旧 `.zip` 仍保留下载。

> ⚠️ 未做 Apple Developer ID 签名 / 公证是分发成本限制，不是功能缺陷：从网络下载的 **PKG 本身**首次可能仍需右键 → 打开一次，但安装出的 `.app` 不带隔离属性，可直接双击运行。

### v0.4.0 双协议深化（IEC 104 点位 + MODBUS 发送计算）

- **IEC 104 四遥点位计算器**：内置 SmartLogger V300R024C10SPC275《IEC104 转发协议接口描述》整理的 **40 张设备表 / 5561 条点位**，支持全文秒搜（信号名、单位、状态、备注、设备型号别名）、点号 ⇄ 信息体地址 IOA 正反算、所属转发设备反查、四遥 ASDU 组包（短浮点遥测 / 单点遥信 / 单点遥控 / 短浮点遥调）。
- **点表导入**：桌面版经本机 `/api/points/xlsx` 直接导入 `.xlsx` 原表（Go 标准库 `archive/zip` + `encoding/xml` 解析，Windows / macOS 行为一致）；网页预览支持 CSV / TSV / JSON 点表（兼容 xlsx 另存的四遥分区布局与扁平表头），导入结果本机持久化，可导出为 CSV 或一键恢复内置点表。
- **MODBUS TCP / RTU 报文发送计算**：请求组包覆盖 01 / 02 / 03 / 04 / 05 / 06 / 0F / 10，自动计算 MBAP 长度或追加 CRC16；写入值按 uint16 / int16 / uint32 / int32 / float32 / ASCII + 4 种字节序 + 系数 / 偏移反算原码；响应解码支持寄存器、线圈位串、异常码与工程值换算，并可一键送入「设备联调」实际收发。
- **协议联动修复**：修正 MODBUS TCP 长度字段校验（应为 UID + FUNC + DATA，旧版会误判所有合法帧）、IEC 104 S 帧误报「ASDU 过短」、U 帧 STARTDT / STOPDT / TESTFR 解码错误；补 TI=13 解析，让新组包的 SmartLogger 报文可直接粘进「IEC 104」解析器。
- **官网**：下载区改为 Windows / macOS 双平台卡片，两个按钮都指向 latest Release 附件，并附系统要求与未公证处理说明。

> ⚠️ 点表依据文档中的四遥基地址（遥信 `0001H` / 遥测 `4001H` / 遥控 `6001H` / 遥调 `6201H`）与示例转发设备配置，现场配置可能不同。遥测类型标识在文档中为 **TI=13**，标准 IEC 104 为 **TI=7**，组包前请按主站实际规约选择。点表为事实性点位清单整理，仅供现场核对；正式工程以设备厂商随附文档为准，仓库不分发原始厂商文档。

### v0.3.0 桌面化闭环

- **固定数据目录**：WebView2 的 `UserDataFolder` 显式指向 `%APPDATA%\EnergyTestToolbox\WebView2`。此前库默认按 exe 文件名建目录，`能源测试工具箱.exe` 与 `EnergyTestToolbox.exe` 两份数据会分家，改名即「丢收藏」。
- **全局备份 / 恢复**：新增「设置与备份」入口，一键导出全部本机数据（收藏、最近使用、各工具历史、结果中转站、测试记录）为 JSON，导入时校验应用标识 / schema / 键前缀 / 体积，覆盖恢复后自动刷新。
- **单实例与窗口记忆**：`CreateMutexW` 阻止双开（双开原本会产生两个随机端口、两份互不相通的数据）；第二个实例只把已有窗口切到前台。窗口宽高与位置每 2 秒采样保存，重启原样恢复。
- **更新闭环**：顶栏检查更新改为优先走本机后端；桌面版可一键下载 Release 附件、按 `SHA256SUMS.txt` 校验哈希、定位到文件。外链强制 HTTPS + GitHub 域名白名单（含重定向逐跳校验），仅主动检查更新时联网；校验不通过立即删除下载文件，**不自动替换正在运行的 exe**。
- **主题与无障碍**：主题支持「跟随系统 / 深色 / 浅色」三态并实时响应系统偏好变化；补齐 `:focus-visible` 键盘焦点环，尊重 `prefers-reduced-motion`。
- **macOS 原生版**：新增 `webview_darwin.go`（`webview_go` + 系统 WKWebView），GitHub Actions 用 Intel / Apple Silicon 两个 runner 分别编译后 `lipo` 成通用二进制，打包 `EnergyTestToolbox.app` 并 ad-hoc 签名；`flock` 文件锁实现单实例，多尺寸 `app.icns` 图标与固定 `CFBundleIdentifier`。Windows 侧仍是纯 Go、无 CGo，不受影响。
- **固定服务端口**：内置服务优先复用上次端口（默认 `39017`）。此前每次启动随机端口，而 `localStorage` 按 origin（含端口）分区，收藏 / 记录会「看似丢失」；现在「设置与备份 → 运行环境」可查看真实平台、数据目录、端口与窗口形态。
- **质量**：`test.settings.mjs` 扩展到 48 条（含 macOS 平台资产选择、运行环境、退出按钮），DOM 桩补齐 `Storage.length / key / removeItem / clear`；Go 层新增端口复用 / 环境接口 / 跨站拒绝断言；全套回归 63 模块、双主题探针 63×2。

> ⚠️ 升级提示：v0.3.0 首次启动会使用新的固定数据目录与固定端口。旧数据仍在 `%APPDATA%\<旧文件名>` 的旧 WebView2 profile、以及旧随机端口对应的 origin 下 —— 请先用旧版导出备份，再在新版「设置与备份」里导入恢复。macOS 版首次运行前请先看上面的签名说明。

### v0.2.0 工程化能力

- **统一量纲层**（`src/utils/units.js`）：16 个单位族、SI 基准换算、仿射温标（°C / °F / K）；专门拦截 kW / kvar / kVA 混加，按 S = √(P²+Q²) 合成并给出 cosφ。
- **跨工具结果串联**（`src/utils/bus.js`）：右侧「结果中转站」支持「发布 → 引用填入」，按量纲自动匹配目标字段并换算单位；`Enter` 直接触发当前工具的计算。
- **报表深化**：批量计算台新增内联 SVG 趋势曲线、Excel (`.xls`) 导出、可打印 PDF 计算书（含公式 / 明细 / 趋势 / 签署栏）与本机测试记录留痕（可回看 / 恢复 / 导出）。
- **工程校核**：12 个电力 / 高压模块统一标注输入范围、适用边界、示例与警告；新增「工程标准数据表」（载流量 / 短路阻抗 / 继保系数，带严格边界声明与标准出处）。

界面采用**固定高度双栏布局**：左侧主体操作，右侧面板承载说明 / 历史 / 速查，整页不纵向滚动；窄窗口自动折叠为单列。默认跟随系统深浅色（可手动锁定深色 / 浅色），HUD 科技感主题；顶栏支持全局搜索与「设置与备份」入口。

---

## 从源码构建

### 环境

- Go 1.25+（`go.mod` 声明 1.25.0，本地已验证 Go 1.26.10）
- Windows：**无需** CGo、MSVC、Node 或任何前端构建工具
- macOS：需要 Xcode Command Line Tools（`xcode-select --install`），窗口走系统 WKWebView（CGo）
- `go.mod` 依赖：`go-webview2`（纯 Go / Windows）、`webview_go`（CGo / macOS）、`go.bug.st/serial`（跨平台串口）

### 构建命令

```bash
# Windows 可执行文件（推荐）
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
  go build -trimpath -ldflags "-H windowsgui -s -w" -o EnergyTestToolbox.exe .

# macOS（必须在 Mac 上执行）：一次产出 zip / dmg / pkg 与三行哈希
bash scripts/build-macos.sh
# CI 传入双架构二进制合成通用包：
# bash scripts/build-macos.sh /path/to/etb-arm64 /path/to/etb-amd64

# 国内网络可加代理
export GOPROXY=https://goproxy.cn,direct
```

Windows PE 图标资源已随仓库提供（`rsrc_windows_amd64.syso`），Go 链接器会自动把它并入 exe，无需额外步骤。macOS 的 `.app` 由 `scripts/build-macos.sh` 组装（Info.plist + `app.icns` + Mach-O 可执行文件 + ad-hoc 签名），再由同一脚本产出 DMG（`hdiutil`）、PKG（`pkgbuild` + `assets/macos-postinstall`）与兼容用 zip；CI 传入两个架构的二进制时先用 `lipo` 合成通用二进制。

### 重新生成图标

```bash
python scripts/make_icon.py                 # 生成 app.ico / app.icns / favicon.ico / icon-512.png
rsrc -ico assets/app.ico -manifest assets/app.manifest -o rsrc_windows_amd64.syso
python scripts/verify_icon.py              # 校验 exe 的 PE 资源目录含图标
python scripts/verify_icns.py              # 校验 macOS 图标的 6 个尺寸与结构
```

图标为深色 HUD 圆角方板 + 青色霓虹描边 + 发光闪电，与应用视觉一致；同时作为网页 favicon（`src/assets/favicon.ico`）随 `//go:embed all:src` 嵌入。

---

## 项目结构

```
.
├── main.go                    内置 127.0.0.1 静态服务 + go:embed + 固定端口 + 单实例
├── webview_windows.go         WebView2 原生窗口（固定 DataPath / 窗口几何恢复）
├── webview_darwin.go          macOS WKWebView 原生窗口（darwin && cgo）
├── webview_darwin_nocgo.go    macOS 纯 Go 兜底（darwin && !cgo，独立浏览器窗口）
├── desktop.go                 数据目录 / 窗口状态（跨平台）
├── desktop_windows.go         Win32 互斥体 / 窗口几何
├── desktop_darwin.go          flock 文件锁 / 激活已有实例
├── desktop_other.go           其它平台占位
├── api_app.go                 运行环境信息 / 优雅退出本机 API
├── api_device.go              设备联调本机 API
├── api_update.go              更新查询 / 下载 / SHA256 校验 / 定位（按平台挑附件）
├── rsrc_windows_amd64.syso    PE 图标 / manifest 资源
├── api_points.go               /api/points/xlsx 本机点表导入（Go 标准库解析）
├── assets/                    图标、Info.plist 与 macOS 安装资源（app.ico / app.icns / Info.plist / macos-postinstall / macos-readme.txt）
├── scripts/build-macos.sh     macOS 打包（lipo / codesign / ditto / hdiutil / pkgbuild）
├── scripts/extract_iec104_points.py   从 SmartLogger 点表抽取前端数据
├── src/
│   ├── index.html             静态顶栏 + 脚本入口
│   ├── app.js                 路由、分类渲染、主题、搜索
│   ├── assets/css/style.css   深色 HUD / 霓虹主题（v5）
│   ├── utils/modules.js       声明式模块注册表 + SVG 构建器
│   ├── utils/units.js         统一量纲层
│   ├── utils/bus.js           结果总线 + 本机测试记录
│   ├── data/iec104-points.js  内置 IEC104 四遥点表（40 表 / 5561 点）
│   └── modules/               63 个工具模块（按分类分目录）
├── docs/                      官网静态站（GitHub Pages 发布）
│   ├── index.html
│   └── assets/                图标与 6 张真实应用截图
├── scripts/                   构建与测试脚本
├── dist/                      Release 产物同步镜像 exe（CI 自动回写）
└── .github/workflows/         构建 + Pages 部署流水线
```

新增工具只需在 `src/modules/` 写一个 `TB.register({ id, name, category, desc, render })` 模块，并在 `src/index.html` 引入脚本、`src/app.js` 补充分类 / 图标即可。

---

## 测试

| 脚本 | 作用 | 当前结果 |
| --- | --- | --- |
| `node scripts/verify.mjs` | 全模块注册 + 渲染 | 63 / 63 通过 |
| `node scripts/test.interact.mjs` | 模拟点击 / 输入的交互逻辑 | 20 / 20 通过 |
| `node scripts/test.boot.mjs` | 按 index.html 顺序加载**含 app.js** 的全部脚本，验证应用启动渲染 | 0 失败 |
| `node scripts/test.formulas.mjs` | 计算类模块的数值标准答案（golden case） | 55 / 55 通过 |
| `node scripts/check-syntax.mjs` | 全脚本语法 + `T.util.*` 命名空间误用静态防线 | 0 失败 |
| `node scripts/check-docs.mjs` | 模块计数 / 版本号 / 脚本引入的跨文档一致性 | 通过 |
| `node scripts/check-light-theme.mjs` | 真实 Chromium 逐模块渲染 dark + light，检测文字对比度 | 63×2 全通过 |
| `node scripts/test.units.mjs` | 量纲层：换算 / 仿射温标 / 功率三角形 / 混用拦截 | 38 / 38 通过 |
| `node scripts/test.bus.mjs` | 结果总线：发布 / 引用 / 单位换算 / 端到端串联 / 测试记录 | 27 / 27 通过 |
| `node scripts/test.settings.mjs` | 主题三态 / 备份导出与覆盖恢复 / 运行环境 / macOS 只选 DMG 更新包 / 更新下载校验闭环 | 51 / 51 通过 |
| `node scripts/test.iec104points.mjs` | 四遥点表 / 点号与 IOA 正反算 / 全文检索 / ASDU 组包 / CSV 点表导入 | 84 / 84 通过 |
| `node scripts/test.modbus.mjs` | MODBUS 组包 / CRC / MBAP / 编解码 / 工程值 / IEC104 解析器联动修复 | 68 / 68 通过 |
| `python scripts/verify_syso.py` | 校验已提交的 PE 资源对象（CI 无 exe 时用） | 通过 |
| `python scripts/verify_icns.py` | 校验 macOS `app.icns` 的 6 个尺寸与条目结构 | 通过 |
| `bash -n scripts/build-macos.sh` | macOS 打包脚本（DMG / PKG）与 postinstall 的 bash 语法，CI verify 同步执行 | 通过 |
| `python scripts/verify_icon.py` | 校验 exe 的 PE 资源含 RT_ICON / RT_GROUP_ICON / RT_MANIFEST | 通过 |
| `GOOS=darwin CGO_ENABLED=0 go build` | 纯 Go 兜底路径在 arm64 / amd64 均可编译（CI verify 中执行） | 2 / 2 通过 |
| `go test ./...` | Go 层：白名单 / 多平台哈希清单 / 同源校验 / 端口复用 / 环境接口 / 窗口状态 / 单实例互斥体 | 11 组通过（Windows；Linux CI 9 组） |

> ⚠️ 任何 `app.js` 改动都必须先跑 `test.boot.mjs`；历史曾因测试未覆盖 app.js 而漏掉入口级语法错误。
> `check-light-theme.mjs` 在真实浏览器里逐个调用模块 `render()`，能抓到 DOM 桩测漏掉的 `T.util.copyBtn` 一类错误；未安装 Chrome 时自动跳过。

---

## 官网

官网源码在 `docs/index.html`（单文件、零外部依赖），由 `.github/workflows/pages.yml` 自动部署到 GitHub Pages：

- 访问地址：https://code-outpost.github.io/energy-test-toolbox/
- 首次使用请在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
- 之后每次向 `main` 推送 `docs/` 变更即自动发布

---

## 技术栈

| 层 | 选型 |
| --- | --- |
| 桌面壳（Windows） | Go + [go-webview2](https://github.com/jchv/go-webview2)，纯 Go、无 CGo，系统 Edge WebView2 渲染 |
| 桌面壳（macOS） | Go + [webview_go](https://github.com/webview/webview_go)，CGo 调用系统 WKWebView，universal `.app` |
| 资源嵌入 | `go:embed all:src` + 内置 127.0.0.1 HTTP 服务（固定端口 39017） |
| 前端 | 原生 HTML / CSS / JS，声明式模块注册，hash 路由；双平台零改动复用 |
| 图标 | Python 生成多尺寸 ICO（→ rsrc PE 资源）与 ICNS（→ `.app`） |
| CI | GitHub Actions：Ubuntu 全量测试 + Windows 构建 + macOS 双架构构建 / 打包 + 统一发布 + Pages |

---

## 说明

- Windows 与 macOS 功能完全一致；差异仅在窗口壳与打包形态。macOS 由 CI 的 macOS runner 编译（本机 Windows 无法编译 CGo 的 WKWebView 绑定），纯 Go 版 macOS 二进制可作为无 Xcode 环境的降级形态。
- macOS 版未做 Apple 开发者签名 / 公证：推荐用 PKG 安装（安装后 `.app` 不带隔离属性，可直接双击）；DMG / zip 首次打开可能需右键 → 打开。串口与 TCP 真实设备联调仍建议现场复验。
- 设计文档见 [`design.md`](design.md)，与本文档的模块计数保持一致（63 个工具 / 10 个分类）。
- 所有计算均在本地完成，不上传任何输入数据。
- 版本号以 [`src/version.js`](src/version.js) 为唯一来源（当前 `v0.4.1`），应用内「⟳ 更新」可检查 GitHub 最新版本，桌面版还能在「设置与备份」里下载并校验更新包。
- 每次 Release 附带 `SHA256SUMS.txt`，下载后建议核对哈希；未签名 exe 首次运行可能触发 Windows SmartScreen 提示。
- 许可证：[MIT](LICENSE) · 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md) · 更新日志：[CHANGELOG.md](CHANGELOG.md) · 问题反馈：[Issues](https://github.com/code-outpost/energy-test-toolbox/issues)
