//go:build windows

package main

// Windows 原生窗口能力：单实例（避免双开产生两个随机端口）、窗口位置记忆。
// 仅使用 syscall 调用 Win32 API，保持纯 Go、无 CGo。

import (
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

const (
	appWindowMode     = "native"
	mutexName         = "EnergyTestToolbox_SingleInstance_Mutex"
	windowTitlePrefix = "能源测试工具箱"
	errorAlreadyExist = 183 // ERROR_ALREADY_EXISTS
	swRestore         = 9
	swpNoSize         = 0x0001
	swpNoZOrder       = 0x0004
	swpNoActivate     = 0x0010
)

var (
	kernel32                = syscall.NewLazyDLL("kernel32.dll")
	user32                  = syscall.NewLazyDLL("user32.dll")
	procCreateMutexW        = kernel32.NewProc("CreateMutexW")
	procCloseHandle         = kernel32.NewProc("CloseHandle")
	procEnumWindows         = user32.NewProc("EnumWindows")
	procGetWindowTextW      = user32.NewProc("GetWindowTextW")
	procIsWindowVisible     = user32.NewProc("IsWindowVisible")
	procShowWindow          = user32.NewProc("ShowWindow")
	procSetForegroundWindow = user32.NewProc("SetForegroundWindow")
	procGetWindowRect       = user32.NewProc("GetWindowRect")
	procSetWindowPos        = user32.NewProc("SetWindowPos")
	procIsIconic            = user32.NewProc("IsIconic")
	procIsZoomed            = user32.NewProc("IsZoomed")
)

type winRect struct{ Left, Top, Right, Bottom int32 }

// acquireSingleInstance 返回 (true, release) 表示本次是首个实例。
// 返回 (false, nil) 表示已有实例在运行、且已尝试把那个窗口切到前台，调用方应直接退出。
// 互斥体创建失败时一律放行，绝不因为辅助能力异常而阻止用户启动。
func acquireSingleInstance() (bool, func()) {
	name, err := syscall.UTF16PtrFromString(mutexName)
	if err != nil {
		return true, func() {}
	}
	h, _, callErr := procCreateMutexW.Call(0, 0, uintptr(unsafe.Pointer(name)))
	if h == 0 {
		return true, func() {}
	}
	if callErr == syscall.Errno(errorAlreadyExist) {
		focusExistingWindow()
		_, _, _ = procCloseHandle.Call(h)
		return false, nil
	}
	return true, func() { _, _, _ = procCloseHandle.Call(h) }
}

// focusExistingWindow 枚举顶层窗口，按标题前缀定位本应用的另一个实例。
func focusExistingWindow() {
	var found uintptr
	cb := syscall.NewCallback(func(hwnd uintptr, _ uintptr) uintptr {
		if found != 0 {
			return 0
		}
		vis, _, _ := procIsWindowVisible.Call(hwnd)
		if vis == 0 {
			return 1
		}
		buf := make([]uint16, 256)
		_, _, _ = procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
		if strings.HasPrefix(syscall.UTF16ToString(buf), windowTitlePrefix) {
			found = hwnd
			return 0
		}
		return 1
	})
	_, _, _ = procEnumWindows.Call(cb, 0)
	if found != 0 {
		_, _, _ = procShowWindow.Call(found, swRestore)
		_, _, _ = procSetForegroundWindow.Call(found)
	}
}

func readWindowRect(hwnd uintptr) (windowState, bool) {
	if hwnd == 0 {
		return windowState{}, false
	}
	var r winRect
	ok, _, _ := procGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&r)))
	if ok == 0 {
		return windowState{}, false
	}
	iconic, _, _ := procIsIconic.Call(hwnd)
	if iconic != 0 { // 最小化时的坐标无意义
		return windowState{}, false
	}
	zoomed, _, _ := procIsZoomed.Call(hwnd)
	return windowState{
		X: int(r.Left), Y: int(r.Top),
		W: int(r.Right - r.Left), H: int(r.Bottom - r.Top),
		Maximized: zoomed != 0,
	}, true
}

// applyWindowPos 只改位置，不改尺寸/层级/焦点；尺寸由 WindowOptions 在创窗时设置。
func applyWindowPos(hwnd uintptr, s windowState) {
	if hwnd == 0 || (s.X == 0 && s.Y == 0) {
		return
	}
	_, _, _ = procSetWindowPos.Call(hwnd, 0, uintptr(s.X), uintptr(s.Y), 0, 0,
		swpNoSize|swpNoZOrder|swpNoActivate)
}

// trackWindow 周期性采样窗口几何，写入本机配置。窗口关闭时 Run() 返回，
// 再做一次 best-effort 采样；即使此时窗口已销毁，最后一次有效采样也足够。
func trackWindow(hwnd uintptr) (stop func()) {
	done := make(chan struct{})
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		t := time.NewTicker(2 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				if s, ok := readWindowRect(hwnd); ok {
					saveWindowState(s)
				}
			case <-done:
				return
			}
		}
	}()
	return func() {
		close(done)
		wg.Wait()
		if s, ok := readWindowRect(hwnd); ok {
			saveWindowState(s)
		}
	}
}
