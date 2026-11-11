package main

// 内置服务端口必须可复用：Web 存储按 origin（含端口）分区，
// 每次随机端口都会让收藏 / 记录「看似丢失」。这里验证重启后端口不变。

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListenLocalReusesPortAcrossRestarts(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("APPDATA", dir)

	ln1, p1, err := listenLocal()
	if err != nil {
		t.Fatalf("首次监听失败: %v", err)
	}
	if p1 < 1024 || p1 > 65535 {
		t.Fatalf("端口不合法: %d", p1)
	}
	_ = ln1.Close()

	ln2, p2, err := listenLocal()
	if err != nil {
		t.Fatalf("重启后监听失败: %v", err)
	}
	defer ln2.Close()
	if p2 != p1 {
		t.Errorf("重启后端口变了（localStorage origin 会变）: %d → %d", p1, p2)
	}
}

func TestAppInfoEndpoint(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("APPDATA", dir)
	serverPort = 39017

	mux := http.NewServeMux()
	registerAppAPI(mux)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest(http.MethodGet,
		"http://127.0.0.1:39017/api/app/info", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("HTTP %d", w.Code)
	}
	var got appInfoResp
	if err := json.NewDecoder(w.Body).Decode(&got); err != nil {
		t.Fatalf("响应不是 JSON: %v", err)
	}
	if !got.OK || got.Port != 39017 || got.Origin != "http://127.0.0.1:39017" {
		t.Errorf("运行环境信息不正确: %+v", got)
	}
	if got.Platform == "" || got.Arch == "" || got.WindowMode == "" || got.DataDir == "" {
		t.Errorf("运行环境字段缺失: %+v", got)
	}
}

func TestAppInfoRejectsCrossOrigin(t *testing.T) {
	mux := http.NewServeMux()
	registerAppAPI(mux)
	r := httptest.NewRequest(http.MethodGet,
		"http://127.0.0.1:39017/api/app/info", nil)
	r.Header.Set("Origin", "http://evil.example.com")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Errorf("跨站请求应被拒绝，实际 HTTP %d", w.Code)
	}
}
