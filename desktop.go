package main

// 桌面态持久化：数据目录、窗口位置。跨平台部分，Win32 相关实现在 desktop_windows.go。
// 固定目录名（而非跟随 exe 文件名）是刻意的：一旦用户把「能源测试工具箱.exe」
// 改名成 EnergyTestToolbox.exe，若沿用 WebView2 默认目录，收藏与测试记录会分家。

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

const appDirName = "EnergyTestToolbox"

// appDataDir 返回本机应用数据目录，并保证目录存在。
// Windows: %APPDATA%\EnergyTestToolbox；其它系统: os.UserConfigDir() 下同名目录。
func appDataDir() string {
	base := os.Getenv("APPDATA")
	if base == "" {
		base, _ = os.UserConfigDir()
	}
	if base == "" {
		base = os.TempDir()
	}
	dir := filepath.Join(base, appDirName)
	_ = os.MkdirAll(filepath.Join(dir, "updates"), 0o700)
	return dir
}

// webViewDataDir 是 WebView2 的 UserDataFolder，与 exe 文件名彻底解耦。
func webViewDataDir() string {
	dir := filepath.Join(appDataDir(), "WebView2")
	_ = os.MkdirAll(dir, 0o700)
	return dir
}

type windowState struct {
	X         int  `json:"x"`
	Y         int  `json:"y"`
	W         int  `json:"w"`
	H         int  `json:"h"`
	Maximized bool `json:"maximized"`
}

func windowStatePath() string { return filepath.Join(appDataDir(), "window.json") }

var windowStateMu sync.Mutex

func loadWindowState() windowState {
	windowStateMu.Lock()
	defer windowStateMu.Unlock()
	b, err := os.ReadFile(windowStatePath())
	if err != nil {
		return windowState{}
	}
	var s windowState
	if json.Unmarshal(b, &s) != nil {
		return windowState{}
	}
	// 明显异常的窗口尺寸/位置不恢复，避免窗口跑到屏幕外。
	if s.W < 640 || s.H < 480 || s.W > 8192 || s.H > 8192 {
		return windowState{}
	}
	return s
}

func saveWindowState(s windowState) {
	if s.W < 640 || s.H < 480 || s.W > 8192 || s.H > 8192 {
		return
	}
	windowStateMu.Lock()
	defer windowStateMu.Unlock()
	b, err := json.Marshal(s)
	if err != nil {
		return
	}
	_ = os.WriteFile(windowStatePath(), b, 0o600)
}
