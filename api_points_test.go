package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

const samplePointBook = "SmartLogger V300R024C10SPC275 IEC104转发协议接口描述.xlsx"

func loadPointBook(t *testing.T) []byte {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(".", samplePointBook))
	if err != nil {
		t.Skipf("样例点表不在工作目录，跳过：%v", err)
	}
	return b
}

func TestParsePointBook(t *testing.T) {
	res, err := parsePointBook(loadPointBook(t))
	if err != nil {
		t.Fatalf("解析真实点表失败: %v", err)
	}
	meta := res["meta"].(map[string]any)
	if meta["sheets"].(int) < 30 {
		t.Fatalf("应识别出 40 张设备表，实际 %v", meta["sheets"])
	}
	if meta["points"].(int) < 5000 {
		t.Fatalf("点位数量明显偏少：%v", meta["points"])
	}
	bases, ok := res["bases"].(map[string]pointBaseDesc)
	if !ok {
		t.Fatal("未解析出信息体基地址")
	}
	for cat, want := range map[string]int{"yx": 0x0001, "yc": 0x4001, "yk": 0x6001, "yt": 0x6201} {
		if got := bases[cat].From; got != want {
			t.Errorf("基地址 %s = 0x%04X，期望 0x%04X", cat, got, want)
		}
	}
	cfg := res["byteCfg"].(map[string]int)
	if cfg["ioa"] != 3 || cfg["ca"] != 2 || cfg["cot"] != 2 {
		t.Errorf("字节数配置解析错误: %v", cfg)
	}
	slaves := res["slaves"].([]pointSlave)
	if len(slaves) < 5 || slaves[0].Name != "SmartLogger" || slaves[0].YC[0] != 1 || slaves[0].YC[1] != 50 {
		t.Errorf("转发设备点号分配解析错误: %+v", slaves)
	}
	devs := res["devices"].([]pointDevice)
	var smartLogger *pointDevice
	for i := range devs {
		if devs[i].Name == "SmartLogger-光储" {
			smartLogger = &devs[i]
			break
		}
	}
	if smartLogger == nil {
		t.Fatal("未识别 SmartLogger-光储 设备表")
	}
	yc := smartLogger.G["yc"]
	if len(yc) < 100 {
		t.Fatalf("SmartLogger-光储 遥测点数偏少: %d", len(yc))
	}
	first := yc[0]
	if first.N != 1 || first.S != "子阵光伏直流总电流" || first.U != "A" {
		t.Errorf("首个遥测点解析错误: %+v", first)
	}
	if got := smartLogger.G["yt"]; len(got) < 10 {
		t.Errorf("SmartLogger-光储 遥调点应被识别，实际 %d", len(got))
	}
}

func TestPointsXLSXHandler(t *testing.T) {
	body := loadPointBook(t)
	r := httptest.NewRequest(http.MethodPost, "/api/points/xlsx", bytes.NewReader(body))
	w := httptest.NewRecorder()
	handlePointsXLSX(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
	}
	var out struct {
		OK   bool `json:"ok"`
		Meta struct {
			Points int `json:"points"`
		} `json:"meta"`
		Devices []pointDevice `json:"devices"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatalf("响应不是合法 JSON: %v", err)
	}
	if !out.OK || out.Meta.Points < 5000 || len(out.Devices) < 30 {
		t.Fatalf("响应内容异常: %+v / devices=%d", out.Meta, len(out.Devices))
	}
}

func TestPointsXLSXRejectsBadInput(t *testing.T) {
	cases := []struct {
		name, method, origin string
		body                 []byte
		want                 int
	}{
		{"GET 不允许", http.MethodGet, "", nil, http.StatusMethodNotAllowed},
		{"跨源拒绝", http.MethodPost, "https://evil.example", []byte("x"), http.StatusForbidden},
		{"非法 xlsx", http.MethodPost, "", []byte("not a zip"), http.StatusBadRequest},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest(c.method, "/api/points/xlsx", bytes.NewReader(c.body))
			if c.origin != "" {
				r.Header.Set("Origin", c.origin)
			}
			w := httptest.NewRecorder()
			handlePointsXLSX(w, r)
			if w.Code != c.want {
				t.Fatalf("HTTP %d，期望 %d：%s", w.Code, c.want, w.Body.String())
			}
		})
	}
}

func TestParseDeviceSheetMinimal(t *testing.T) {
	rows := [][]string{
		{"遥测", "", "", "遥信", "", "", "遥控", "", ""},
		{"序号", "信号名称", "单位", "序号", "信号名称", "状态", "序号", "信号名称", "命令"},
		{"1", "A相电压", "V", "1", "通讯故障", "0：正常 1：故障", "1", "开机", "0：开机"},
		{"2", "B相电压", "V", "2", "告警", "0：正常 1：告警", "", "", ""},
	}
	g := parseDeviceSheet(rows)
	if len(g["yc"]) != 2 || g["yc"][1].S != "B相电压" || g["yc"][1].U != "V" {
		t.Errorf("遥测分区解析错误: %+v", g["yc"])
	}
	if len(g["yx"]) != 2 || g["yx"][0].X != "0：正常 1：故障" {
		t.Errorf("遥信分区解析错误: %+v", g["yx"])
	}
	if len(g["yk"]) != 1 || g["yk"][0].X != "0：开机" {
		t.Errorf("遥控分区解析错误: %+v", g["yk"])
	}
	if _, ok := g["yt"]; ok {
		t.Error("不应凭空生成遥调分区")
	}
}

func TestColIndexAndCellText(t *testing.T) {
	for ref, want := range map[string]int{"A1": 0, "B3": 1, "Z9": 25, "AA1": 26, "AB12": 27} {
		if got := colIndex(ref); got != want {
			t.Errorf("colIndex(%s)=%d，期望 %d", ref, got, want)
		}
	}
	sst := []string{"遥测", "A相电压"}
	if got := cellText(pointCell{Type: "s", V: "1"}, sst); got != "A相电压" {
		t.Errorf("共享字符串解析错误: %q", got)
	}
	if got := cellText(pointCell{Type: "n", V: "42"}, sst); got != "42" {
		t.Errorf("数值单元格解析错误: %q", got)
	}
}
