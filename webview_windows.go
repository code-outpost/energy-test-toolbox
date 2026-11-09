//go:build windows

package main

import (
	"log"

	"github.com/jchv/go-webview2"
)

// runWebView 在 Windows 上使用 Edge WebView2 创建原生窗口（纯 Go，无需 MSVC / CGo）。
// go-webview2 通过 go-winloader 自带 WebView2Loader.dll，运行时依赖系统已安装的 WebView2 运行时。
func runWebView(url string) {
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug: false,
		WindowOptions: webview2.WindowOptions{
			Title:  "能源测试工具箱 v" + appVersion(),
			Width:  1280,
			Height: 800,
			Center: true,
		},
	})
	if w == nil {
		log.Fatal("创建 WebView2 窗口失败（请确认已安装 Microsoft Edge WebView2 运行时）")
	}
	w.Navigate(url)
	w.Run()
}
