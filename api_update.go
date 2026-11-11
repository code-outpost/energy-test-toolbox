package main

// 更新闭环后端：检查 / 下载 / 校验 / 定位。仅在用户主动点「更新」时联网。
// 内置服务只监听 127.0.0.1，但仍按最小权限设计：
//   - 所有外链强制 HTTPS + GitHub 官方域名白名单（含重定向逐跳校验），杜绝本机 API 被当作任意下载代理；
//   - 写盘位置固定在本机应用数据目录，reveal 接口只允许打开该目录下的文件；
//   - 带 Origin 的请求必须来自内置服务自身。
// 浏览器直接打开 src/index.html 时没有这些接口，应用自动回退为「只提示、给链接」。

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"time"
)

const (
	ghLatestAPI = "https://api.github.com/repos/code-outpost/energy-test-toolbox/releases/latest"
	winAsset    = "EnergyTestToolbox.exe"
	macAsset    = "EnergyTestToolbox-macos-universal.dmg"
	sumsAsset   = "SHA256SUMS.txt"
	maxExeBytes = 64 << 20 // 单个更新包上限 64 MiB，异常响应直接拒绝
)

// updateAssetName 让 Windows 与 macOS 各自下载自己的产物，
// 避免 Mac 用户点「下载并校验」却拿到一个 .exe。
func updateAssetName() string {
	if runtime.GOOS == "darwin" {
		return macAsset
	}
	return winAsset
}

func updateAssetExt() string {
	if runtime.GOOS == "darwin" {
		return ".dmg"
	}
	return ".exe"
}

var githubHosts = map[string]bool{
	"api.github.com":                       true,
	"github.com":                           true,
	"objects.githubusercontent.com":        true,
	"release-assets.githubusercontent.com": true,
}

var tagPattern = regexp.MustCompile(`^v?[0-9]+\.[0-9]+\.[0-9]+$`)

func registerUpdateAPI(mux *http.ServeMux) {
	mux.HandleFunc("/api/update/latest", handleUpdateLatest)
	mux.HandleFunc("/api/update/download", handleUpdateDownload)
	mux.HandleFunc("/api/update/reveal", handleUpdateReveal)
}

func writeUpdateJSON(w http.ResponseWriter, code int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func sameOrigin(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	u, err := url.Parse(o)
	return err == nil && strings.EqualFold(u.Host, r.Host) && u.Scheme == "http"
}

func safeURL(raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || !githubHosts[strings.ToLower(u.Hostname())] {
		return "", fmt.Errorf("只允许 HTTPS 的 GitHub 官方域名")
	}
	return raw, nil
}

func updateClient() *http.Client {
	return &http.Client{
		Timeout: 3 * time.Minute,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 8 {
				return fmt.Errorf("重定向次数过多")
			}
			if req.URL.Scheme != "https" || !githubHosts[strings.ToLower(req.URL.Hostname())] {
				return fmt.Errorf("重定向目标不在允许的 GitHub 域名白名单内")
			}
			return nil
		},
	}
}

func getExternal(client *http.Client, raw string, accept string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, raw, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "EnergyTestToolbox/"+appVersion())
	if accept != "" {
		req.Header.Set("Accept", accept)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, maxExeBytes+1))
}

type latestInfo struct {
	OK       bool   `json:"ok"`
	Tag      string `json:"tag"`
	Version  string `json:"version"`
	Asset    string `json:"asset"`
	Platform string `json:"platform"`
	AssetURL string `json:"assetUrl"`
	SumsURL  string `json:"sumsUrl"`
	Error    string `json:"error,omitempty"`
}

func handleUpdateLatest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet || !sameOrigin(r) {
		writeUpdateJSON(w, http.StatusForbidden, latestInfo{Error: "请求来源不被允许"})
		return
	}
	client := updateClient()
	body, err := getExternal(client, ghLatestAPI, "application/vnd.github+json")
	if err != nil {
		writeUpdateJSON(w, http.StatusBadGateway, latestInfo{Error: "检查更新失败：" + err.Error()})
		return
	}
	var data struct {
		TagName string `json:"tag_name"`
		Assets  []struct {
			Name string `json:"name"`
			URL  string `json:"browser_download_url"`
		} `json:"assets"`
	}
	if json.Unmarshal(body, &data) != nil || data.TagName == "" {
		writeUpdateJSON(w, http.StatusBadGateway, latestInfo{Error: "GitHub 返回内容无法解析"})
		return
	}
	asset := updateAssetName()
	info := latestInfo{
		OK: true, Tag: data.TagName, Version: strings.TrimPrefix(data.TagName, "v"),
		Asset: asset, Platform: runtime.GOOS,
	}
	for _, a := range data.Assets {
		switch a.Name {
		case asset:
			info.AssetURL = a.URL
		case sumsAsset:
			info.SumsURL = a.URL
		}
	}
	if info.AssetURL == "" {
		writeUpdateJSON(w, http.StatusBadGateway, latestInfo{Error: "该版本未找到 " + asset + " 附件"})
		return
	}
	writeUpdateJSON(w, http.StatusOK, info)
}

type downloadReq struct {
	Tag     string `json:"tag"`
	URL     string `json:"url"`
	SumsURL string `json:"sumsUrl"`
}

type downloadResp struct {
	OK       bool   `json:"ok"`
	Path     string `json:"path"`
	SHA256   string `json:"sha256"`
	Size     int64  `json:"size"`
	Verified bool   `json:"verified"`
	Message  string `json:"message"`
	Error    string `json:"error,omitempty"`
}

// parseSums 从 Release 的多平台哈希清单里挑出当前平台对应那一行。
func parseSums(body []byte, name string) string {
	for _, line := range strings.Split(string(body), "\n") {
		f := strings.Fields(strings.TrimSpace(line))
		if len(f) == 2 && (f[1] == name || f[1] == "*"+name) && len(f[0]) == 64 {
			return strings.ToLower(f[0])
		}
	}
	return ""
}

func handleUpdateDownload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) {
		writeUpdateJSON(w, http.StatusForbidden, downloadResp{Error: "请求来源不被允许"})
		return
	}
	var req downloadReq
	if json.NewDecoder(io.LimitReader(r.Body, 8<<10)).Decode(&req) != nil || !tagPattern.MatchString(req.Tag) {
		writeUpdateJSON(w, http.StatusBadRequest, downloadResp{Error: "版本号不合法"})
		return
	}
	assetURL, err := safeURL(req.URL)
	if err != nil {
		writeUpdateJSON(w, http.StatusBadRequest, downloadResp{Error: err.Error()})
		return
	}
	client := updateClient()

	expected := ""
	if req.SumsURL != "" {
		sumsURL, e := safeURL(req.SumsURL)
		if e == nil {
			if b, e2 := getExternal(client, sumsURL, "text/plain"); e2 == nil {
				expected = parseSums(b, updateAssetName())
			}
		}
	}

	body, err := getExternal(client, assetURL, "application/octet-stream")
	if err != nil {
		writeUpdateJSON(w, http.StatusBadGateway, downloadResp{Error: "下载失败：" + err.Error()})
		return
	}
	if len(body) > maxExeBytes {
		writeUpdateJSON(w, http.StatusBadGateway, downloadResp{Error: "文件超过 64 MiB，已拒绝"})
		return
	}
	sum := sha256.Sum256(body)
	got := hex.EncodeToString(sum[:])
	verified := expected != "" && got == expected

	dir := filepath.Join(appDataDir(), "updates")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		writeUpdateJSON(w, http.StatusInternalServerError, downloadResp{Error: "无法创建下载目录"})
		return
	}
	final := filepath.Join(dir, "EnergyTestToolbox-"+req.Tag+updateAssetExt())
	tmp := final + ".part"
	if os.WriteFile(tmp, body, 0o600) != nil {
		writeUpdateJSON(w, http.StatusInternalServerError, downloadResp{Error: "写入下载文件失败"})
		return
	}
	_ = os.Remove(final)
	if err := os.Rename(tmp, final); err != nil {
		_ = os.Remove(tmp)
		writeUpdateJSON(w, http.StatusInternalServerError, downloadResp{Error: "重命名下载文件失败"})
		return
	}

	msg := "已下载并计算 SHA256"
	switch {
	case expected == "":
		msg = "已下载；Release 未提供 SHA256SUMS.txt，无法自动校验，请自行核对"
	case !verified:
		_ = os.Remove(final)
		writeUpdateJSON(w, http.StatusBadGateway, downloadResp{Error: "SHA256 校验不通过，已删除下载文件"})
		return
	default:
		msg = "SHA256 校验通过，与 Release 的 SHA256SUMS.txt 一致"
	}
	writeUpdateJSON(w, http.StatusOK, downloadResp{
		OK: true, Path: final, SHA256: got, Size: int64(len(body)),
		Verified: verified, Message: msg,
	})
}

func handleUpdateReveal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || !sameOrigin(r) {
		writeUpdateJSON(w, http.StatusForbidden, downloadResp{Error: "请求来源不被允许"})
		return
	}
	var req struct {
		Path string `json:"path"`
	}
	if json.NewDecoder(io.LimitReader(r.Body, 4<<10)).Decode(&req) != nil {
		writeUpdateJSON(w, http.StatusBadRequest, downloadResp{Error: "参数不合法"})
		return
	}
	dir := filepath.Join(appDataDir(), "updates")
	clean := filepath.Clean(req.Path)
	if !strings.HasPrefix(clean, dir+string(os.PathSeparator)) {
		writeUpdateJSON(w, http.StatusBadRequest, downloadResp{Error: "只允许打开应用下载目录内的文件"})
		return
	}
	if st, err := os.Stat(clean); err != nil || st.IsDir() {
		writeUpdateJSON(w, http.StatusNotFound, downloadResp{Error: "文件不存在"})
		return
	}
	// 仅在用户主动点击「打开所在文件夹」时启动系统文件管理器，不自动替换正在运行的 exe。
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", "/select,"+clean)
	case "darwin":
		cmd = exec.Command("open", "-R", clean)
	default:
		cmd = exec.Command("xdg-open", filepath.Dir(clean))
	}
	if err := cmd.Start(); err != nil {
		writeUpdateJSON(w, http.StatusInternalServerError, downloadResp{Error: "打开文件管理器失败：" + err.Error()})
		return
	}
	writeUpdateJSON(w, http.StatusOK, downloadResp{OK: true, Path: clean, Message: "已在文件管理器中定位"})
}
