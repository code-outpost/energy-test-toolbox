能源测试工具箱 / EnergyTestToolbox
=====================================

【拖拽安装（DMG）】
1. 双击本 DMG 文件，系统会自动挂载并打开一个窗口。
2. 把 "EnergyTestToolbox.app" 拖到窗口里的 "Applications" 图标上。
3. 完成后在 Launchpad 或「应用程序」里双击图标即可使用。
4. 可把 DMG 推出废纸篓，不再需要它。

【双击安装（PKG，推荐）】
直接双击 EnergyTestToolbox-macos-installer.pkg，按系统安装向导一路
「继续」即可自动装入 /Applications；安装程序会自动清理隔离属性并重建签名，
安装完成后双击图标就能打开，无需手动处理。

【首次打开提示】
本应用使用临时（ad-hoc）签名、未做 Apple 公证。若系统提示
「无法打开，因为来自身份不明的开发者」或「已损坏」，任选一种：
  - 在 Finder 里右键点击 App → 打开 → 再点「打开」（只需一次）；
  - 或执行：xattr -dr com.apple.quarantine /Applications/EnergyTestToolbox.app
  - 或到「系统设置 → 隐私与安全性」点「仍要打开」。
PKG 安装方式通常不需要以上步骤。

【系统要求】
macOS 11 或更新版本；Intel 与 Apple Silicon（M 系列）通用。
首次启动会在本机 127.0.0.1 开启一个仅供应用使用的本地服务，
不上传任何数据；日常使用可完全断网。

【数据位置】
收藏、最近使用、结果中转站、测试记录保存在：
~/Library/Application Support/EnergyTestToolbox
升级不会清除，可在「设置与备份」里一键导出 / 导入。

项目主页：https://github.com/code-outpost/energy-test-toolbox
官网下载：https://code-outpost.github.io/energy-test-toolbox/
