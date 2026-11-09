# ⚡ 能源测试工具箱

> 面向电力 / 新能源开发测试的一站式桌面工具集 —— **58 个工具 · 10 大分类 · 单文件 exe · 完全离线**

[官网](https://code-outpost.github.io/energy-test-toolbox/) · [下载 Windows 版](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox.exe) · [Releases](https://github.com/code-outpost/energy-test-toolbox/releases) · [问题反馈](https://github.com/code-outpost/energy-test-toolbox/issues)

把日常要查的公式、要算的参数、要解的报文，全部收进一个桌面窗口。从标准计算器到 IEC 104 / MODBUS 报文解析，从高压电工考证公式到 JSON / 正则，打开即用。

---

## 下载与运行

| 项目 | 说明 |
| --- | --- |
| 直接下载 | [EnergyTestToolbox.exe](https://github.com/code-outpost/energy-test-toolbox/releases/latest/download/EnergyTestToolbox.exe)（仓库 `dist/` 目录，双击即可） |
| 成品文件 | 仓库根目录 `能源测试工具箱.exe`（与 `dist/` 内为同一产物，仅文件名不同） |
| 系统要求 | Windows 10 / 11，需 Microsoft Edge WebView2 运行时（系统通常已自带） |
| 安装 | 免安装、绿色单文件，约 7.8 MB，无需额外 DLL |
| 联网 | 运行时零外网请求，所有前端资源已嵌入二进制 |

WebView2Loader.dll 已内嵌；若窗口无法打开，请安装 [WebView2 运行时](https://developer.microsoft.com/microsoft-edge/webview2/)。

---

## 功能一览（58 个工具 / 10 大分类）

| 分类 | 工具数 | 代表功能 |
| --- | ---: | --- |
| 计算器 | 10 | 标准 / 科学 / 程序员计算器、日期、分数、欧姆定律、三相功率、电阻色环、单位换算、表达式计算 |
| 协议报文解析 | 9 | IEC 104 / 101 / 103、MODBUS、GOOSE、SV 采样值、DL/T 645、DNP3、CDT、MMS / MQTT / OPC UA |
| 高压电工 | 6 | 变压器变比、电动机额定电流、感抗容抗与谐振、安全距离、载流量口诀、考证公式速查卡 |
| 日常工具 | 6 | 通用单位换算、个税、房贷月供、BMI、几何计算、随机抽签 |
| 开发常用 | 6 | JSON 格式化、正则测试、颜色转换、文本处理、Base64 / URL、密码生成 |
| 电力计算 | 5 | 功率因数补偿、电缆压降与载流量、光伏阵列、蓄电池容量、电费估算 |
| 通用编解码 | 5 | 进制转换、编码转换、时间戳、字节序互换、校验和 / CRC |
| Linux 命令 | 3 | chmod 权限计算器、常用命令速查等 |
| 综合工具 | 2 | 跨场景补充工具 |
| SQL 辅助 | 1 | SQL 语句辅助 |

界面采用**固定高度双栏布局**：左侧主体操作，右侧面板承载说明 / 历史 / 速查，整页不纵向滚动；窄窗口自动折叠为单列。默认深色科技感主题，可一键切换浅色；顶栏支持全局搜索。

---

## 从源码构建

### 环境

- Go 1.23+（CI 使用 1.23，本地已验证 Go 1.26.10）
- **无需** CGo、MSVC、Node 或任何前端构建工具
- `go.mod` 依赖：`github.com/jchv/go-webview2`（纯 Go）

### 构建命令

```bash
# Windows 可执行文件（推荐）
CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
  go build -trimpath -ldflags "-H windowsgui -s -w" -o EnergyTestToolbox.exe .

# 国内网络可加代理
export GOPROXY=https://goproxy.cn,direct
```

Windows PE 图标资源已随仓库提供（`rsrc_windows_amd64.syso`），Go 链接器会自动把它并入 exe，无需额外步骤。

### 重新生成图标

```bash
python scripts/make_icon.py                 # 生成 app.ico / favicon.ico / icon-512.png
rsrc -ico assets/app.ico -manifest assets/app.manifest -o rsrc_windows_amd64.syso
python scripts/verify_icon.py              # 校验 exe 的 PE 资源目录含图标
```

图标为深色 HUD 圆角方板 + 青色霓虹描边 + 发光闪电，与应用视觉一致；同时作为网页 favicon（`src/assets/favicon.ico`）随 `//go:embed all:src` 嵌入。

---

## 项目结构

```
.
├── main.go                    内置 127.0.0.1 静态服务 + go:embed
├── webview_windows.go         WebView2 原生窗口
├── rsrc_windows_amd64.syso    PE 图标 / manifest 资源
├── assets/                    图标源文件（app.ico、app.manifest）
├── src/
│   ├── index.html             静态顶栏 + 脚本入口
│   ├── app.js                 路由、分类渲染、主题、搜索
│   ├── assets/css/style.css   深色 HUD / 霓虹主题（v5）
│   ├── utils/modules.js       声明式模块注册表
│   └── modules/               58 个工具模块（按分类分目录）
├── docs/                      官网静态站（GitHub Pages 发布）
│   ├── index.html
│   └── assets/                图标与 3 张真实应用截图
├── scripts/                   构建与测试脚本
├── dist/                      官网下载直链用 exe
└── .github/workflows/         构建 + Pages 部署流水线
```

新增工具只需在 `src/modules/` 写一个 `TB.register({ id, name, category, desc, render })` 模块，并在 `src/index.html` 引入脚本、`src/app.js` 补充分类 / 图标即可。

---

## 测试

| 脚本 | 作用 | 当前结果 |
| --- | --- | --- |
| `node scripts/verify.mjs` | 全模块注册 + 渲染 | 58 / 58 通过 |
| `node scripts/test.interact.mjs` | 模拟点击 / 输入的交互逻辑 | 20 / 20 通过 |
| `node scripts/test.boot.mjs` | 按 index.html 顺序加载**含 app.js** 的全部脚本，验证应用启动渲染 | 0 失败 |
| `node scripts/test.formulas.mjs` | 计算类模块的数值标准答案（golden case） | 42 / 42 通过 |
| `node scripts/check-syntax.mjs` | 全脚本语法 + `T.util.*` 命名空间误用静态防线 | 0 失败 |
| `node scripts/check-docs.mjs` | 模块计数 / 版本号 / 脚本引入的跨文档一致性 | 通过 |
| `node scripts/check-light-theme.mjs` | 真实 Chromium 逐模块渲染 dark + light，检测文字对比度 | 58×2 全通过 |
| `python scripts/verify_syso.py` | 校验已提交的 PE 资源对象（CI 无 exe 时用） | 通过 |
| `python scripts/verify_icon.py` | 校验 exe 的 PE 资源含 RT_ICON / RT_GROUP_ICON / RT_MANIFEST | 通过 |

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
| 桌面壳 | Go + [go-webview2](https://github.com/jchv/go-webview2)（纯 Go，无 CGo） |
| 资源嵌入 | `go:embed all:src` + 内置 127.0.0.1 HTTP 服务 |
| 前端 | 原生 HTML / CSS / JS，声明式模块注册，hash 路由 |
| 图标 | Python 生成多尺寸 ICO → rsrc 编译为 PE 资源 |
| CI | GitHub Actions（Ubuntu 全量测试 + Windows 构建/发布 + Pages 部署） |

---

## 说明

- macOS 版本（`webview` / CGo）暂缓，当前交付以 Windows 为主；唯一 WebView 入口带 `//go:build windows`，CI 只构建 Windows。
- 设计文档见 [`design.md`](design.md)，与本文档的模块计数保持一致（58 个工具 / 10 个分类）。
- 所有计算均在本地完成，不上传任何输入数据。
- 版本号以 [`src/version.js`](src/version.js) 为唯一来源（当前 `v0.1.0`），应用内「⟳ 更新」可检查 GitHub 最新版本。
- 每次 Release 附带 `SHA256SUMS.txt`，下载后建议核对哈希；未签名 exe 首次运行可能触发 Windows SmartScreen 提示。
- 许可证：[MIT](LICENSE) · 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md) · 更新日志：[CHANGELOG.md](CHANGELOG.md) · 问题反馈：[Issues](https://github.com/code-outpost/energy-test-toolbox/issues)
