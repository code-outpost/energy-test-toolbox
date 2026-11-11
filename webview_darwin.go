//go:build darwin && cgo

package main

import (
	"log"

	webview "github.com/webview/webview_go"
)

const appWindowMode = "native"

// runWebView 在 macOS 上使用系统自带的 WKWebView 创建原生窗口。
// webview_go 的 darwin 后端通过 ObjC runtime 调用 Cocoa / WebKit（不依赖
// Objective-C++ 语法），链接 -framework WebKit；构建需要 Xcode Command Line
// Tools，因此该产物由 GitHub Actions 的 macOS runner 编译，Windows 侧不交叉编译。
func runWebView(url string) {
	state := loadWindowState()
	w := webview.New(false)
	if w == nil {
		log.Fatal("创建 WKWebView 窗口失败")
	}
	defer w.Destroy()

	w.SetTitle("能源测试工具箱 v" + appVersion())
	width, height := 1280, 800
	if state.W >= 640 && state.H >= 480 {
		width, height = state.W, state.H
	}
	w.SetSize(width, height, webview.HintNone)
	w.Navigate(url)
	// Run() 阻塞到窗口关闭；之后 main 返回，单实例文件锁随之释放。
	w.Run()
}
