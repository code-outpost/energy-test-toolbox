# 能源测试工具箱 v0.4.0

把两条电力协议线从「能解析」补成「能算点、能组包、能联调」：**63 个工具 / 10 大分类**，Windows 单文件 exe 与 macOS 通用 `.app` 双平台同版本发布、功能完全一致。常规功能完全离线、不上传任何输入数据；仅在你主动点「⟳ 更新」时访问 GitHub。

## 本次更新

### IEC 104 四遥点位计算器（新增）

- 内置 SmartLogger V300R024C10SPC275《IEC104 转发协议接口描述》整理的 **40 张设备表 / 5561 条四遥点位**，支持按信号名、单位、状态描述、备注与设备型号别名全文检索，可按四遥类别与设备表过滤。
- 点号 ⇄ 信息体地址正反算：`全局点号 = 转发设备起始点号 + 表内序号 − 1`、`IOA = 类基地址 + 全局点号 − 1`；给出十进制、十六进制、IOA 三字节小端与所属转发设备。
- 四遥 ASDU 组包：遥测短浮点、单点遥信、单点遥控、短浮点遥调，可配置公共地址、传送原因、品质 / 命令位，输出完整 I 帧 HEX 与逐字段解释；可一键送入「IEC 104」解析器或「设备联调」。
- **点表导入**：桌面版选择 `.xlsx` 即由本机 `/api/points/xlsx` 解析（Go 标准库、纯内存、Windows / macOS 一致）；网页预览支持 CSV / TSV / JSON（兼容 xlsx 另存的四遥分区布局与扁平表头）。导入结果本机持久化，可导出 CSV 或恢复内置点表。

### MODBUS TCP / RTU 报文发送计算（完善）

- 从「只解析」扩为完整链路：请求组包 → MBAP 长度 / CRC16 → 预期响应长度 → 响应解码 → 工程值换算 → 送入设备联调。
- 功能码覆盖 01 / 02 / 03 / 04 / 05 / 06 / 0F / 10；写入值按 uint16 / int16 / uint32 / int32 / float32 / ASCII 与 4 种字节序编码，支持 `工程值 = 原码 × 系数 + 偏移` 反算；响应支持寄存器、线圈位串、异常码解释。
- 设备联调补 05 / 06 / 0F / 10 写操作模板，并自动接收计算工具生成的报文。

### 协议联动修复

- 修正 MODBUS TCP 的 MBAP 长度校验：应为 `UID + FUNC + DATA`，旧版会误判所有合法响应帧。
- 修正 IEC 104 的 S 帧被强行解析 ASDU（误报「ASDU 过短」）、U 帧 STARTDT / STOPDT / TESTFR 的 act/con 解码错误；补 TI=13 短浮点解析。
- 官网下载区改为 **Windows / macOS 双平台卡片**，两个按钮均指向本版 Release 附件，并附系统要求与 macOS 未公证处理说明。

### 质量

新增 `test.iec104points.mjs`（84 断言）、`test.modbus.mjs`（68 断言）、`api_points_test.go`（真实 xlsx 解析 / 跨源与坏输入拒绝 5 组），全部接入 CI。全套回归：63/63 模块、20/20 交互、55/55 数值、38/38 量纲、27/27 总线、48/48 设置、84/84 点位、68/68 MODBUS、双主题浏览器探针 63×2、语法 70 文件 0 失败、Go 单测全通过。

## 升级说明

- Windows 直接覆盖旧 exe，macOS 用新版 `.app` 覆盖 `/Applications` 中的旧版即可；收藏、记录与自定义点表都留在本机，无需迁移。
- 若从 v0.2.x 及更早版本升级，请先用旧版在「设置与备份」导出 JSON，再用新版导入恢复（v0.3.0 起更换了固定数据目录与服务端口）。
- 「.xlsx 点表导入」与真实串口 / TCP 收发仅在桌面版可用；浏览器直接打开 `src/index.html` 时可导入 CSV / TSV / JSON 并构造报文，但不发送。

## 下载与校验

| 平台 | 附件 | 运行要求 |
| --- | --- | --- |
| Windows | `EnergyTestToolbox.exe` | Windows 10/11，需 Microsoft Edge WebView2 Runtime（系统通常自带），双击即可、无需安装 |
| macOS | `EnergyTestToolbox-macos-universal.zip` | macOS 11+，Intel / Apple Silicon 通用；解压后把 `EnergyTestToolbox.app` 拖进「应用程序」 |

- `SHA256SUMS.txt` 同时列出两个平台附件的哈希，应用内「设置与备份 → 检查更新 → 下载并校验」会自动挑本平台那一行。
- Windows 首次运行若出现 SmartScreen 提示，选择「更多信息 → 仍要运行」。macOS 包已 ad-hoc 签名但**未公证**：若提示「无法验证开发者」，请右键 `.app` → 打开，或执行 `xattr -dr com.apple.quarantine /Applications/EnergyTestToolbox.app`。

⚠️ **点表边界**：内置点表依据文档中的示例转发配置，基地址为遥信 `0001H` / 遥测 `4001H` / 遥控 `6001H` / 遥调 `6201H`；现场配置可能不同。遥测类型标识在文档中为 **TI=13**，标准 IEC 104 为 **TI=7**，组包前请按主站实际规约选择。点表为事实性点位清单整理，仅供现场核对，仓库不分发原始厂商文档，正式工程以设备随附点表为准。串口 / TCP 真机联调仍未现场验收。

完整更新记录见 [CHANGELOG.md](CHANGELOG.md)，功能清单见 [README.md](README.md)，官网：<https://code-outpost.github.io/energy-test-toolbox/>。
