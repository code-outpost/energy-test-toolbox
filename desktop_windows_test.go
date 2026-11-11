//go:build windows

package main

// 单实例 Win32 路径的最小回归：不需要启动 GUI 窗口，
// 只验证 CreateMutexW 的首次 / 重复 / 释放后行为，以及 EnumWindows 回调可安全执行。

import "testing"

func TestSingleInstanceMutex(t *testing.T) {
	first, release := acquireSingleInstance()
	if !first {
		t.Fatal("第一个实例应获得互斥体（若系统残留同名互斥体请检查是否有正在运行的应用）")
	}
	if release == nil {
		t.Fatal("首个实例必须返回释放函数")
	}

	second, secondRelease := acquireSingleInstance()
	if second {
		t.Fatal("同一进程内的第二个实例必须被拦截")
	}
	if secondRelease != nil {
		t.Fatal("被拦截的实例不应返回释放函数")
	}

	release() // 关闭句柄后互斥体消失

	third, release3 := acquireSingleInstance()
	if !third {
		t.Fatal("释放之后应能重新获得互斥体")
	}
	if release3 != nil {
		release3()
	}
}

func TestFocusExistingWindowIsSafe(t *testing.T) {
	// 没有本应用窗口时也应正常返回，不 panic、不阻塞。
	focusExistingWindow()
}
