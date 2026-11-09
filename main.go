package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"time"
)

// 将前端 src/ 目录整体嵌入二进制，运行时由内部 HTTP 服务供给 WebView 加载。
//
//go:embed all:src
var assets embed.FS

// startServer 在内置端口启动一个仅监听 127.0.0.1 的静态文件服务，返回访问地址。
func startServer() (string, error) {
	sub, err := fs.Sub(assets, "src")
	if err != nil {
		return "", err
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	mux := http.NewServeMux()
	registerDeviceAPI(mux) // /api/device/* 仅本机可访问
	mux.Handle("/", http.FileServer(http.FS(sub)))
	srv := &http.Server{Handler: mux}
	go func() {
		_ = srv.Serve(ln)
	}()
	return "http://" + ln.Addr().String() + "/", nil
}

// waitReady 轮询直到内置服务可访问，避免 WebView 在服务器就绪前导航。
func waitReady(url string) {
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func main() {
	url, err := startServer()
	if err != nil {
		log.Fatalf("启动内置服务失败: %v", err)
	}
	fmt.Println("serving at", url)
	waitReady(url)
	runWebView(url)
}
