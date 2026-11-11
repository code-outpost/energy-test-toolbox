package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// 将前端 src/ 目录整体嵌入二进制，运行时由内部 HTTP 服务供给 WebView 加载。
//
//go:embed all:src
var assets embed.FS

// 端口必须尽量固定：Web 存储（localStorage）按 origin = scheme + host + port 分区，
// 若每次启动都取随机端口，收藏、最近使用、结果中转站与测试记录会全部「看似丢失」。
// 因此优先复用上次端口，再退到首选端口及少量备用端口，最后才交给系统随机分配。
const preferredPort = 39017

var serverPort int

func portFilePath() string { return filepath.Join(appDataDir(), "port.txt") }

func readSavedPort() int {
	b, err := os.ReadFile(portFilePath())
	if err != nil {
		return 0
	}
	n, err := strconv.Atoi(strings.TrimSpace(string(b)))
	if err != nil || n < 1024 || n > 65535 {
		return 0
	}
	return n
}

func savePort(p int) {
	_ = os.WriteFile(portFilePath(), []byte(strconv.Itoa(p)), 0o600)
}

// listenLocal 依次尝试「上次端口 → 首选端口 → 备用端口 → 系统随机端口」。
// 端口被其它程序占用时仍要能启动，但会在「设置与备份」里显示真实端口，
// 用户可据此判断是否需要用备份文件恢复数据。
func listenLocal() (net.Listener, int, error) {
	seen := map[int]bool{}
	var candidates []int
	add := func(p int) {
		if p > 0 && !seen[p] {
			seen[p] = true
			candidates = append(candidates, p)
		}
	}
	add(readSavedPort())
	add(preferredPort)
	for i := 1; i <= 8; i++ {
		add(preferredPort + i)
	}
	candidates = append(candidates, 0) // 0 = 让系统分配随机端口（最后兜底）

	var errs []string
	for _, p := range candidates {
		addr := "127.0.0.1:0"
		if p != 0 {
			addr = net.JoinHostPort("127.0.0.1", strconv.Itoa(p))
		}
		ln, err := net.Listen("tcp", addr)
		if err != nil {
			errs = append(errs, err.Error())
			continue
		}
		port := ln.Addr().(*net.TCPAddr).Port
		savePort(port)
		return ln, port, nil
	}
	return nil, 0, fmt.Errorf("无法监听本机端口: %s", strings.Join(errs, "; "))
}

// startServer 在固定端口启动一个仅监听 127.0.0.1 的静态文件服务，返回访问地址。
func startServer() (string, error) {
	sub, err := fs.Sub(assets, "src")
	if err != nil {
		return "", err
	}
	ln, port, err := listenLocal()
	if err != nil {
		return "", err
	}
	serverPort = port
	mux := http.NewServeMux()
	registerAppAPI(mux)    // /api/app/* 平台信息 / 优雅退出
	registerDeviceAPI(mux) // /api/device/* 仅本机可访问
	registerPointsAPI(mux) // /api/points/xlsx 本机点表导入（纯内存解析）
	registerUpdateAPI(mux) // /api/update/* 仅用户主动检查更新时联网
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
	// 单实例：双开会产生两个随机端口、两份互不相通的收藏与记录，
	// 因此第二个进程只把已有窗口切到前台后退出。
	first, release := acquireSingleInstance()
	if !first {
		return
	}
	if release != nil {
		defer release()
	}

	url, err := startServer()
	if err != nil {
		log.Fatalf("启动内置服务失败: %v", err)
	}
	fmt.Println("serving at", url)
	waitReady(url)
	runWebView(url)
}
