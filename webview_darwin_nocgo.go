//go:build darwin && !cgo

package main

// 纯 Go 兜底形态：当没有 Xcode / CGo（例如从 Windows 交叉编译 darwin）时，
// 无法链接 WebKit，就退化为「本地服务 + 独立浏览器窗口」。
// 这是可交付的降级路径，不作为 Release 的默认形态（默认走 WKWebView 原生窗口）。

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const appWindowMode = "browser"

var appBrowsers = []string{
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
	"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
	"~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
}

func runWebView(url string) {
	if err := openAppWindow(url); err != nil {
		log.Printf("打开浏览器窗口失败: %v", err)
		fmt.Println("请在浏览器手动打开:", url)
	}
	fmt.Println("能源测试工具箱已在本地运行；关闭浏览器窗口不会结束服务。")
	fmt.Println("请在应用内「设置与备份」点击「退出应用」，或在终端按 Ctrl+C 结束。")
	<-quitCh
}

// openAppWindow 优先用 Chromium 系浏览器的 --app 模式得到无地址栏独立窗口；
// 都没有时退回系统默认浏览器（Safari）的普通标签页。
func openAppWindow(url string) error {
	home, _ := os.UserHomeDir()
	for _, p := range appBrowsers {
		if strings.HasPrefix(p, "~/") {
			p = filepath.Join(home, p[2:])
		}
		if st, err := os.Stat(p); err == nil && !st.IsDir() {
			return exec.Command(p, "--app="+url, "--window-size=1280,800",
				"--no-first-run", "--no-default-browser-check").Start()
		}
	}
	return exec.Command("open", url).Start()
}
