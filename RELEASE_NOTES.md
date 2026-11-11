# 能源测试工具箱 v0.4.1

**macOS 现在是「双击就能安装」的标准形态了。** 本版把原来只有一个 zip（要自己解压、自己拖进 Applications）补齐为 **DMG 拖拽安装镜像** 与 **PKG 系统安装向导**；PKG 装完双击图标即可打开。功能与工具数不变：**63 个工具 / 10 大分类**，Windows / macOS 双平台同源、常规功能完全离线、不上传任何输入数据。

## 本次更新

### macOS 双击安装（新增）

| 形态 | 操作 | 适合 |
| --- | --- | --- |
| **PKG（推荐）** | 双击 `EnergyTestToolbox-macos-installer.pkg` → 系统安装向导一路「继续」→ 自动装入 `/Applications` | 想要「装完直接双击图标就能用」 |
| **DMG** | 双击 `EnergyTestToolbox-macos-universal.dmg` → 自动挂载 → 把 App 拖到窗口里的 `Applications` 图标 | 习惯经典 macOS 拖拽安装 |
| **ZIP（兼容）** | 解压得 `EnergyTestToolbox.app`，自行拖进「应用程序」 | 脚本化分发 / 旧链接 |

- PKG 的 `postinstall` 由系统安装器以 root 执行：清理 `com.apple.quarantine`、重建 ad-hoc 签名、补主程序执行位。**安装出的 `.app` 不继承下载隔离属性，因此双击即可运行**，无需手动 `xattr` 或右键打开。
- DMG 内含通用 `.app`、`Applications` 快捷方式与中文 `README.txt`；三种形态都是 Intel / Apple Silicon 通用二进制，原生 WKWebView 窗口，无需额外运行时。
- 打包前强制校验主程序执行位、`plutil -lint` Info.plist 与 universal 架构；CI 还会实际挂载 DMG、展开 PKG 校验安装位置与 postinstall，避免交付「双击没反应」的包。

### 更新链路与官网

- 「设置与备份 → 检查更新 → 下载并校验」在 macOS 改为挑 `.dmg`（落盘文件名与哈希清单行同步），Windows 仍为 `.exe`；`SHA256SUMS.txt` 由 2 行扩为 4 行：exe + dmg + pkg + zip。
- 官网 macOS 下载卡片改为 DMG / PKG 双按钮并标注推荐，hero 与特性区同步说明安装方式；旧 `.zip` 仍保留下载。

### 质量

- 新增 `TestMacUpdateAssetIsInstallable`（macOS 更新包必须是可双击安装的 DMG）；`test.settings.mjs` 增补「macOS 不误选 exe / 旧 zip」断言；CI `verify` 增加打包脚本 `bash -n` 与关键步骤静态检查。
- macOS 端新增两个校验步骤：DMG 挂载内容检查、PKG 结构与 payload 检查。全套回归保持全绿。

## 怎么装 / 怎么升级

1. **首次安装**：优先下载 `.pkg` 双击安装，完成后在「应用程序」或 Launchpad 双击图标即可。
2. **从 v0.4.0 升级**：直接安装新版 PKG（会覆盖 `/Applications` 里的旧版）或用 DMG 拖拽覆盖；收藏、最近使用、结果中转站、测试记录与自定义点表都留在本机，无需迁移。
3. **从 v0.2.x 及更早版本升级**：请先用旧版在「设置与备份」导出 JSON，再用新版导入恢复（v0.3.0 起更换了固定数据目录与服务端口）。

> ⚠️ **首次打开提示**：本应用使用临时（ad-hoc）签名、未做 Apple 公证。从网络下载的 **PKG 文件本身**首次可能仍需「右键 → 打开」一次；但由它安装出的 `.app` 不带隔离属性，可直接双击运行。若 DMG / zip 拖出的 `.app` 被拦截，右键 → 打开，或执行：
> `xattr -dr com.apple.quarantine /Applications/EnergyTestToolbox.app`
>
> Windows 首次运行若出现 SmartScreen 提示，选择「更多信息 → 仍要运行」。

## 下载与校验

| 平台 | 附件 | 运行要求 |
| --- | --- | --- |
| Windows | `EnergyTestToolbox.exe` | Windows 10/11，需 Edge WebView2 Runtime（系统通常自带），双击即用 |
| macOS | `EnergyTestToolbox-macos-installer.pkg` | macOS 11+，双击由系统安装向导自动装好（推荐） |
| macOS | `EnergyTestToolbox-macos-universal.dmg` | macOS 11+，双击挂载后拖进 Applications |
| macOS | `EnergyTestToolbox-macos-universal.zip` | macOS 11+，兼容旧链接 / 脚本分发 |

- `SHA256SUMS.txt` 列出以上 4 个附件的哈希，应用内「下载并校验」会自动挑本平台那一行。
- 两个平台的窗口壳不同（Windows 纯 Go WebView2，macOS WKWebView），但嵌入的是同一套前端与本机 API，功能完全一致。

⚠️ **点表边界**：内置 IEC 104 点表依据 SmartLogger 文档中的示例转发配置，基地址为遥信 `0001H` / 遥测 `4001H` / 遥控 `6001H` / 遥调 `6201H`；现场配置可能不同。遥测类型标识在文档中为 **TI=13**，标准 IEC 104 为 **TI=7**，组包前请按主站实际规约选择。点表为事实性点位清单整理，仅供现场核对，仓库不分发原始厂商文档，正式工程以设备随附点表为准。串口 / TCP 真机联调与 macOS 真机 GUI 仍未现场验收。

完整更新记录见 [CHANGELOG.md](CHANGELOG.md)，功能清单见 [README.md](README.md)，官网：<https://code-outpost.github.io/energy-test-toolbox/>。
