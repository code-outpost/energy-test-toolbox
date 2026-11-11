package main

// 应用运行时信息：让「设置与备份」能显示真实平台、数据目录与端口，
// 并在纯 Go 兜底形态（没有原生窗口可关）下提供优雅退出。
// 所有接口只监听 127.0.0.1，并复用更新 API 的同源校验。

import (
	"net/http"
	"runtime"
	"sync"
	"time"
)

var (
	quitCh   = make(chan struct{})
	quitOnce sync.Once
)

func registerAppAPI(mux *http.ServeMux) {
	mux.HandleFunc("/api/app/info", handleAppInfo)
	mux.HandleFunc("/api/app/quit", handleAppQuit)
}

type appInfoResp struct {
	OK         bool   `json:"ok"`
	Platform   string `json:"platform"`
	Arch       string `json:"arch"`
	Version    string `json:"version"`
	WindowMode string `json:"windowMode"`
	DataDir    string `json:"dataDir"`
	Port       int    `json:"port"`
	Origin     string `json:"origin"`
	CanQuit    bool   `json:"canQuit"`
	Error      string `json:"error,omitempty"`
}

func handleAppInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || !sameOrigin(r) {
		writeUpdateJSON(w, http.StatusForbidden, appInfoResp{Error: "请求来源不被允许"})
		return
	}
	writeUpdateJSON(w, http.StatusOK, appInfoResp{
		OK:         true,
		Platform:   runtime.GOOS,
		Arch:       runtime.GOARCH,
		Version:    appVersion(),
		WindowMode: appWindowMode,
		DataDir:    appDataDir(),
		Port:       serverPort,
		Origin:     "http://127.0.0.1:" + itoa(serverPort),
		CanQuit:    appWindowMode == "browser",
	})
}

func handleAppQuit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) {
		writeUpdateJSON(w, http.StatusForbidden, appInfoResp{Error: "请求来源不被允许"})
		return
	}
	if appWindowMode != "browser" {
		writeUpdateJSON(w, http.StatusBadRequest, appInfoResp{Error: "当前为原生窗口，请直接关闭窗口"})
		return
	}
	writeUpdateJSON(w, http.StatusOK, appInfoResp{OK: true, WindowMode: appWindowMode})
	quitOnce.Do(func() {
		go func() {
			// 留一点时间让 HTTP 响应先写回，再结束主进程。
			time.Sleep(350 * time.Millisecond)
			close(quitCh)
		}()
	})
}

// itoa 避免为一个整数引入 strconv 到本文件（main.go 已有该依赖，这里保持轻量）。
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
