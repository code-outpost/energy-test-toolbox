//go:build darwin

package main

// macOS 单实例：用 flock 文件锁替代 Windows 的 CreateMutexW。
// 进程退出（含崩溃）时内核自动释放锁，不会留下「僵尸锁」把应用锁死。

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
)

func acquireSingleInstance() (bool, func()) {
	path := filepath.Join(appDataDir(), "instance.lock")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		// 数据目录不可写时不要因此拒绝启动，退化为允许多实例。
		return true, func() {}
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		focusExistingWindow()
		return false, nil
	}
	_, _ = f.Seek(0, 0)
	_ = f.Truncate(0)
	_, _ = f.WriteString(strconv.Itoa(os.Getpid()))
	_ = f.Sync()
	return true, func() {
		_ = syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
		_ = f.Close()
		_ = os.Remove(path)
	}
}

// focusExistingWindow 让已在运行的 .app 回到前台；命令行直接运行时 open -a
// 找不到应用会直接失败，忽略即可（第二个实例仍会安静退出）。
func focusExistingWindow() {
	_ = exec.Command("open", "-a", "EnergyTestToolbox").Start()
}

// WKWebView 的窗口由 Cocoa 自行管理 frame，webview_go 未暴露位置接口；
// macOS 版只恢复窗口尺寸（见 webview_darwin.go），不做坐标跟踪。
func applyWindowPos(_ uintptr, _ windowState) {}

func trackWindow(_ uintptr) func() { return func() {} }
