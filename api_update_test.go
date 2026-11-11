package main

// Go 层安全与持久化边界回归：更新白名单、哈希清单解析、同源校验、窗口状态往返。
// 前端 test.settings.mjs 覆盖的是 UI 流程，这里覆盖后端不暴露给 UI 的约束。

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestParseSums(t *testing.T) {
	want := "83ba95404952aa10bf3f334bdb61388ace9addc2d513d17ee5c5c19e97efd2cd"
	macHash := "1122334455667788990011223344556677889900112233445566778899001122"
	body := "deadbeef  SHA256SUMS.txt\n" + want + "  EnergyTestToolbox.exe\n" +
		macHash + "  EnergyTestToolbox-macos-universal.zip\n"
	if got := parseSums([]byte(body), winAsset); got != want {
		t.Fatalf("解析 Windows 行失败: got %q want %q", got, want)
	}
	if got := parseSums([]byte(body), macAsset); got != macHash {
		t.Fatalf("解析 macOS 行失败: got %q want %q", got, macHash)
	}
	if got := parseSums([]byte("not-a-hash  EnergyTestToolbox.exe\n"), winAsset); got != "" {
		t.Fatalf("非法哈希不应被接受: %q", got)
	}
	if got := parseSums([]byte(want+"  *EnergyTestToolbox.exe\n"), winAsset); got != want {
		t.Fatalf("应兼容二进制模式标记 *: %q", got)
	}
}

func TestUpdateAssetPerPlatform(t *testing.T) {
	// 当前测试跑在 windows/linux：都应当拿到 Windows exe，绝不能误拿 macOS 包。
	if got := updateAssetName(); got != winAsset {
		t.Errorf("非 macOS 平台应下载 %s，实际 %s", winAsset, got)
	}
	if got := updateAssetExt(); got != ".exe" {
		t.Errorf("非 macOS 平台扩展名应为 .exe，实际 %s", got)
	}
	if winAsset == macAsset || macAsset != "EnergyTestToolbox-macos-universal.zip" {
		t.Error("两个平台的产物名必须不同，且 macOS 名要与打包脚本一致")
	}
}

func TestSafeURL(t *testing.T) {
	ok := []string{
		"https://api.github.com/repos/x/y/releases/latest",
		"https://github.com/x/y/releases/download/v1/EnergyTestToolbox.exe",
		"https://objects.githubusercontent.com/github-production-release-asset/abc",
		"https://release-assets.githubusercontent.com/abc",
	}
	for _, u := range ok {
		if _, err := safeURL(u); err != nil {
			t.Errorf("白名单域名被误拒: %s (%v)", u, err)
		}
	}
	bad := []string{
		"http://github.com/x/y",
		"https://evil.example.com/EnergyTestToolbox.exe",
		"https://github.com.evil.com/x",
		"file:///C:/Windows/System32/cmd.exe",
		"",
	}
	for _, u := range bad {
		if _, err := safeURL(u); err == nil {
			t.Errorf("危险地址未被拒绝: %s", u)
		}
	}
}

func TestSameOrigin(t *testing.T) {
	r := httptest.NewRequest("POST", "http://127.0.0.1:45678/api/update/download", nil)
	if !sameOrigin(r) {
		t.Error("无 Origin 的本机请求应放行")
	}
	r.Header.Set("Origin", "http://127.0.0.1:45678")
	if !sameOrigin(r) {
		t.Error("同源请求应放行")
	}
	r.Header.Set("Origin", "http://evil.example.com")
	if sameOrigin(r) {
		t.Error("跨站 Origin 必须拒绝")
	}
}

func TestUpdateClientRejectsUnsafeRedirect(t *testing.T) {
	c := updateClient()
	req, _ := http.NewRequest("GET", "https://github.com/x", nil)
	if err := c.CheckRedirect(req, nil); err != nil {
		t.Errorf("合法重定向被误拒: %v", err)
	}
	evil, _ := http.NewRequest("GET", "http://evil.example.com/x", nil)
	if err := c.CheckRedirect(evil, nil); err == nil {
		t.Error("非白名单重定向必须拒绝")
	}
}

func TestWindowStateRoundTrip(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("APPDATA", dir)
	in := windowState{X: 120, Y: 80, W: 1440, H: 900, Maximized: true}
	saveWindowState(in)
	got := loadWindowState()
	if got != in {
		t.Fatalf("窗口状态往返不一致: got %+v want %+v", got, in)
	}
	if !strings.HasSuffix(windowStatePath(), "window.json") {
		t.Fatal("窗口状态文件名不正确")
	}
	// 异常尺寸不应写入，也不应恢复。
	saveWindowState(windowState{X: 1, Y: 1, W: 10, H: 10})
	if loadWindowState() != in {
		t.Error("异常尺寸覆盖了有效状态")
	}
}
