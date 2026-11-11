//go:build !windows && !darwin

package main

// Linux 等未交付平台：仅保证 go build / go vet / go test 可通过，便于 CI 静态检查。
// 内置服务与设备 API 仍然完整，只是没有桌面窗口。

import "fmt"

const appWindowMode = "headless"

func acquireSingleInstance() (bool, func()) { return true, func() {} }

func applyWindowPos(_ uintptr, _ windowState) {}

func trackWindow(_ uintptr) func() { return func() {} }

func runWebView(url string) {
	fmt.Println("该平台不提供桌面窗口；内置服务地址：", url)
	fmt.Println("可在浏览器打开该地址使用（HTTP 本机接口同样可用）。")
}
