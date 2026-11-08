# =====================================================================
#  能源测试工具箱 - Windows 桌面程序一键构建（纯 Go，无需 MSVC / VS / CGo）
#  前置：仅需 Go 工具链（https://go.dev/dl ，安装时勾选加入 PATH）
#        本机已装的 WebView2 运行时即可（Win10/11 通常自带）
#  用法：在 PowerShell 中执行  .\scripts\build-win.ps1
#  产物：D:\小工具\能源测试工具箱.exe  （WebVie2Loader.dll 已由 go-webview2 内嵌，无需手动附带）
# =====================================================================
$ErrorActionPreference = 'Stop'
$root = (Split-Path -Parent $MyInvocation.MyCommand.Path) + '\..'
Set-Location $root

# 0. 定位 go 可执行文件（兼容 WorkBuddy 管理的 .buildcache 路径）
$goCmd = $null
if (Get-Command go -ErrorAction SilentlyContinue) {
    $goCmd = 'go'
} else {
    $candidates = @(
        "$env:USERPROFILE\.buildcache\go_extract\go\bin\go.exe",
        "$env:USERPROFILE\go\bin\go.exe",
        'C:\Go\bin\go.exe',
        'D:\go\bin\go.exe'
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { $goCmd = $c; break }
    }
}
if (-not $goCmd) {
    Write-Error "未找到 go 命令。请安装 Go (https://go.dev/dl) 并确保加入 PATH，或放到上述候选目录。"
    exit 1
}
Write-Host "[环境] 使用 go: $goCmd" -ForegroundColor Cyan

# 国内网络加速（如已可访问 proxy.golang.org 可注释此行）
$env:GOPROXY = "https://goproxy.cn,direct"
$env:CGO_ENABLED = "0"

# 1. 拉取依赖
Write-Host "[1/2] 拉取 Go 依赖（go-webview2 等，纯 Go）..." -ForegroundColor Cyan
& $goCmd mod tidy
if ($LASTEXITCODE -ne 0) { Write-Error "依赖拉取失败"; exit 1 }

# 2. 编译 GUI 可执行文件（无控制台窗口）
Write-Host "[2/2] 编译 Windows 可执行文件..." -ForegroundColor Cyan
& $goCmd build -ldflags "-H windowsgui -s -w" -o "能源测试工具箱.exe" .
if (-not (Test-Path "能源测试工具箱.exe")) {
    Write-Error "构建失败"
    exit 1
}

Write-Host "`n[完成] 生成: $root\能源测试工具箱.exe" -ForegroundColor Green
Write-Host "双击即可运行（Edge WebView2 原生窗口，无浏览器边框）。" -ForegroundColor Green
