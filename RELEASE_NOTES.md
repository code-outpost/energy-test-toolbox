# 能源测试工具箱 v0.1.0

首个正式版本：**58 个工具 / 10 大分类**，约 8.1 MB 的 Windows 单文件 exe，所有计算与解析都在本地完成，不联网、不上传任何输入数据。

## 本次更新

- **设备联调**：Modbus TCP / 裸 TCP / 串口收发，内置报文模板、自动 CRC 与收发日志（桌面版能力）。
- **批量计算台**：粘贴或导入 CSV，套用公式模板批量计算，导出结果 CSV 报告。
- **个性化**：收藏置顶、最近使用、快捷键（`/`、`Ctrl+K`、`Esc`）、无障碍标签。
- **公式依据**：电力计算与高压电工模块统一标注公式出处、适用边界与参考标准。
- **版本与更新**：顶栏显示版本号，可一键检查 GitHub 最新 Release。
- **分类补齐**：新增 SQL 语句美化 / 建表语句生成 / crontab 生成器，最薄弱分类由 1 个工具提升到 3 个。
- **数值回归测试**：42 条计算类标准答案断言；真实浏览器双主题逐模块探针；跨文档计数一致性纳入 CI。
- **发布链路**：CI 自动构建 + 校验 + 发布，产物附 `SHA256SUMS.txt`；修复浅色主题低对比与 SQL 模块的浏览器端报错。

## 下载与校验

- 下载 `EnergyTestToolbox.exe`，双击即可运行，无需安装。
- 需要系统已安装 **Microsoft Edge WebView2 Runtime**（Windows 10/11 通常自带）。
- 首次运行若出现 Windows SmartScreen 提示，属未签名应用正常现象，可选择「更多信息 → 仍要运行」；请先用 `SHA256SUMS.txt` 核对文件哈希。

完整更新记录见 [CHANGELOG.md](CHANGELOG.md)，功能清单见 [README.md](README.md)，官网：<https://code-outpost.github.io/energy-test-toolbox/>。
