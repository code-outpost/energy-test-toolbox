//go:build windows

package main

import (
	"log"
	"time"

	"github.com/jchv/go-webview2"
)

// runWebView 在 Windows 上使用 Edge WebView2 创建原生窗口（纯 Go，无需 MSVC / CGo）。
// go-webview2 通过 go-winloader 自带 WebView2Loader.dll，运行时依赖系统已安装的 WebView2 运行时。
func runWebView(url string) {
	state := loadWindowState()
	opts := webview2.WebViewOptions{
		Debug: false,
		// 显式固定 UserDataFolder：默认行为是 %APPDATA%/<exe 文件名>，
		// exe 一改名收藏 / 历史 / 测试记录就分家。这里与文件名彻底解耦。
		DataPath: webViewDataDir(),
		WindowOptions: webview2.WindowOptions{
			Title:  "能源测试工具箱 v" + appVersion(),
			Width:  1280,
			Height: 800,
			Center: state.X == 0 && state.Y == 0, // 有记忆位置时不强制居中
		},
	}
	if state.W >= 640 && state.H >= 480 {
		opts.WindowOptions.Width = uint(state.W)
		opts.WindowOptions.Height = uint(state.H)
	}
	w := webview2.NewWithOptions(opts)
	if w == nil {
		log.Fatal("创建 WebView2 窗口失败（请确认已安装 Microsoft Edge WebView2 运行时）")
	}
	hwnd := uintptr(w.Window())
	applyWindowPos(hwnd, state)
	stopTracking := trackWindow(hwnd)
	defer stopTracking()

	w.Navigate(url)
	// 让首个采样周期有机会拿到真实窗口几何后再进入消息循环。
	time.Sleep(20 * time.Millisecond)
	w.Run()
}
