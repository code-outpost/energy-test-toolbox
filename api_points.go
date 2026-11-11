package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"path"
	"regexp"
	"strconv"
	"strings"
)

// /api/points/xlsx：把用户提供的 IEC104 转发点表（.xlsx）解析成结构化四遥点位。
// 只用 Go 标准库（archive/zip + encoding/xml），Windows / macOS 两端行为完全一致。
// 服务仅监听 127.0.0.1；解析全程在内存完成，不写盘、不联网、不执行任何外部命令。

const maxPointBookBytes = 24 << 20 // 上传点表上限 24 MiB

var (
	reCellRef = regexp.MustCompile(`^([A-Z]+)`)
	reBaseHex = regexp.MustCompile(`([0-9A-Fa-f]{4})H\s*--\s*([0-9A-Fa-f]{4})H`)
	reSheetN  = regexp.MustCompile(`^sheet(\d+)\.xml$`)
)

type pointCell struct {
	Ref  string `xml:"r,attr"`
	Type string `xml:"t,attr"`
	V    string `xml:"v"`
	IS   struct {
		T []string `xml:"t"`
		R []struct {
			T []string `xml:"t"`
		} `xml:"r"`
	} `xml:"is"`
}

type pointRow struct {
	Cells []pointCell `xml:"c"`
}

type pointSheetXML struct {
	Rows []pointRow `xml:"sheetData>row"`
}

type pointSST struct {
	Items []struct {
		T []string `xml:"t"`
		R []struct {
			T []string `xml:"t"`
		} `xml:"r"`
	} `xml:"si"`
}

type pointRel struct {
	ID     string `xml:"Id,attr"`
	Target string `xml:"Target,attr"`
}

type pointRels struct {
	Rels []pointRel `xml:"Relationship"`
}

type pointWorkbook struct {
	Sheets []struct {
		Name string `xml:"name,attr"`
		ID   string `xml:"http://schemas.openxmlformats.org/officeDocument/2006/relationships id,attr"`
	} `xml:"sheets>sheet"`
}

// pointEntry 与前端 src/data/iec104-points.js 的短键保持一致，便于直接替换数据集。
type pointEntry struct {
	N int    `json:"n"`
	S string `json:"s"`
	U string `json:"u,omitempty"`
	P string `json:"p,omitempty"`
	G string `json:"g,omitempty"`
	X string `json:"x,omitempty"`
	R string `json:"r,omitempty"`
}

type pointDevice struct {
	Name  string                  `json:"name"`
	Sheet int                     `json:"sheet"`
	G     map[string][]pointEntry `json:"g"`
}

type pointSlave struct {
	Name  string `json:"name"`
	Slave int    `json:"slave"`
	YX    [2]int `json:"yx"`
	YC    [2]int `json:"yc"`
	YK    [2]int `json:"yk"`
}

type pointBaseDesc struct {
	From int    `json:"from"`
	To   int    `json:"to"`
	Hex  string `json:"hex"`
}

func registerPointsAPI(mux *http.ServeMux) {
	mux.HandleFunc("/api/points/xlsx", handlePointsXLSX)
}

func writePointsJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// 仅接受同源（本机页面）或无 Origin 的请求，避免外部页面借用本机 API 读取点表。
func pointsLocalOrigin(r *http.Request) bool {
	o := r.Header.Get("Origin")
	if o == "" {
		return true
	}
	return strings.HasPrefix(o, "http://127.0.0.1:") || strings.HasPrefix(o, "http://localhost:") ||
		strings.HasPrefix(o, "http://[::1]:")
}

func handlePointsXLSX(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writePointsJSON(w, http.StatusMethodNotAllowed, map[string]any{"ok": false, "error": "仅支持 POST"})
		return
	}
	if !pointsLocalOrigin(r) {
		writePointsJSON(w, http.StatusForbidden, map[string]any{"ok": false, "error": "拒绝跨源请求"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxPointBookBytes)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		writePointsJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": "读取点表失败或文件过大：" + err.Error()})
		return
	}
	res, err := parsePointBook(data)
	if err != nil {
		writePointsJSON(w, http.StatusBadRequest, map[string]any{"ok": false, "error": err.Error()})
		return
	}
	writePointsJSON(w, http.StatusOK, res)
}

func colIndex(ref string) int {
	m := reCellRef.FindStringSubmatch(ref)
	if m == nil {
		return -1
	}
	n := 0
	for _, c := range m[1] {
		n = n*26 + int(c-'A') + 1
	}
	return n - 1
}

func cellText(c pointCell, sst []string) string {
	switch c.Type {
	case "s":
		i, err := strconv.Atoi(strings.TrimSpace(c.V))
		if err == nil && i >= 0 && i < len(sst) {
			return sst[i]
		}
		return ""
	case "inlineStr":
		var b strings.Builder
		for _, t := range c.IS.T {
			b.WriteString(t)
		}
		for _, rr := range c.IS.R {
			for _, t := range rr.T {
				b.WriteString(t)
			}
		}
		return b.String()
	default:
		return c.V
	}
}

// pointRows 把 sheet XML 转成稀疏二维数组；每行按最大出现的非空列号补齐。
func pointRows(zf *zip.File, sst []string) ([][]string, error) {
	f, err := zf.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var sh pointSheetXML
	if err := xml.NewDecoder(io.LimitReader(f, maxPointBookBytes)).Decode(&sh); err != nil {
		return nil, err
	}
	out := make([][]string, 0, len(sh.Rows))
	for _, row := range sh.Rows {
		cells := map[int]string{}
		max := -1
		for _, c := range row.Cells {
			i := colIndex(c.Ref)
			if i < 0 || i > 512 {
				continue
			}
			v := strings.ReplaceAll(strings.TrimSpace(cellText(c, sst)), "\n", " ")
			cells[i] = v
			if v != "" && i > max {
				max = i
			}
		}
		if max < 0 {
			out = append(out, []string{})
			continue
		}
		line := make([]string, max+1)
		for i := 0; i <= max; i++ {
			line[i] = cells[i]
		}
		out = append(out, line)
	}
	return out, nil
}

func at(row []string, i int) string {
	if i >= 0 && i < len(row) {
		return row[i]
	}
	return ""
}

func clip(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

var catKey = map[string]string{"遥测": "yc", "遥信": "yx", "遥控": "yk", "遥调": "yt"}

// parseDeviceSheet 按「第 1 行四遥分区 / 第 2 行表头 / 第 3 行起数据」抽取一张设备表。
func parseDeviceSheet(rows [][]string) map[string][]pointEntry {
	if len(rows) < 2 {
		return nil
	}
	type mark struct {
		col int
		cat string
	}
	var marks []mark
	for i, v := range rows[0] {
		if key, ok := catKey[v]; ok {
			marks = append(marks, mark{i, key})
		}
	}
	if len(marks) == 0 {
		return nil
	}
	hdr := rows[1]
	width := 0
	for _, r := range rows {
		if len(r) > width {
			width = len(r)
		}
	}
	groups := map[string][]pointEntry{}
	for k, m := range marks {
		end := width
		if k+1 < len(marks) {
			end = marks[k+1].col
		}
		fields := map[string]int{}
		for c := m.col; c < end && c < len(hdr); c++ {
			label := hdr[c]
			if label == "" {
				continue
			}
			for token, key := range map[string]string{
				"序号": "n", "信号名称": "s", "单位": "u", "精度": "p",
				"范围": "g", "状态": "x", "命令": "x", "备注": "r",
			} {
				if strings.Contains(label, token) {
					if _, exists := fields[key]; !exists {
						fields[key] = c
					}
				}
			}
		}
		nCol, okN := fields["n"], fields["n"] >= 0
		_, okS := fields["s"]
		if !okN || !okS {
			continue
		}
		_ = nCol
		seen := map[string]bool{}
		list := []pointEntry{}
		for _, row := range rows[2:] {
			noStr := strings.TrimSpace(at(row, fields["n"]))
			name := strings.TrimSpace(at(row, fields["s"]))
			if name == "" || noStr == "" {
				continue
			}
			no, err := strconv.Atoi(noStr)
			if err != nil || no < 1 || no > 100000 {
				continue
			}
			p := pointEntry{N: no, S: clip(name, 120)}
			if c, ok := fields["u"]; ok {
				p.U = clip(at(row, c), 20)
			}
			if c, ok := fields["p"]; ok {
				p.P = clip(at(row, c), 24)
			}
			if c, ok := fields["g"]; ok {
				p.G = clip(at(row, c), 60)
			}
			if c, ok := fields["x"]; ok {
				p.X = clip(at(row, c), 120)
			}
			if c, ok := fields["r"]; ok {
				p.R = clip(at(row, c), 180)
			}
			key := fmt.Sprintf("%d/%s", no, name)
			if seen[key] {
				continue
			}
			seen[key] = true
			list = append(list, p)
		}
		if len(list) > 0 {
			// 按序号排序，保证点号与 IOA 一一对应
			for i := 1; i < len(list); i++ {
				for j := i; j > 0 && list[j].N < list[j-1].N; j-- {
					list[j], list[j-1] = list[j-1], list[j]
				}
			}
			groups[m.cat] = list
		}
	}
	if len(groups) == 0 {
		return nil
	}
	return groups
}

func parseOverview(rows [][]string, bases map[string]pointBaseDesc, bytesCfg map[string]int, slaves *[]pointSlave) {
	for _, row := range rows {
		if len(row) == 0 {
			continue
		}
		first := row[0]
		if key, ok := catKey[first]; ok {
			if m := reBaseHex.FindStringSubmatch(strings.Join(row, " ")); m != nil {
				from, _ := strconv.ParseInt(m[1], 16, 32)
				to, _ := strconv.ParseInt(m[2], 16, 32)
				bases[key] = pointBaseDesc{From: int(from), To: int(to), Hex: strings.ToUpper(m[1]) + "H--" + strings.ToUpper(m[2]) + "H"}
			}
		}
		for label, key := range map[string]string{
			"公共地址字节数": "ca", "传输原因字节数": "cot", "信息体地址字节数": "ioa",
		} {
			if first != label {
				continue
			}
			for _, v := range row[1:] {
				if n, e := strconv.Atoi(strings.TrimSpace(v)); e == nil {
					bytesCfg[key] = n
					break
				}
			}
		}
		isSlaveRow := first == "SmartLogger" || strings.Contains(first, "SUN2000") || strings.Contains(first, "自定义设备")
		if !isSlaveRow {
			continue
		}
		nums := []int{}
		for _, v := range row[1:min(8, len(row))] {
			if n, e := strconv.Atoi(strings.TrimSpace(v)); e == nil {
				nums = append(nums, n)
			}
		}
		if len(nums) >= 7 {
			*slaves = append(*slaves, pointSlave{
				Name: first, Slave: nums[0],
				YX: [2]int{nums[1], nums[2]}, YC: [2]int{nums[3], nums[4]}, YK: [2]int{nums[5], nums[6]},
			})
		}
	}
}

func parsePointBook(data []byte) (map[string]any, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("不是有效的 .xlsx 文件（%v）", err)
	}
	files := map[string]*zip.File{}
	for _, f := range zr.File {
		files[strings.TrimPrefix(f.Name, "/")] = f
	}
	readXML := func(name string, out any) error {
		f := files[name]
		if f == nil {
			return fmt.Errorf("缺少 %s", name)
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		defer rc.Close()
		return xml.NewDecoder(io.LimitReader(rc, maxPointBookBytes)).Decode(out)
	}

	var sstXML pointSST
	_ = readXML("xl/sharedStrings.xml", &sstXML) // 允许无共享字符串表（inlineStr 工作簿）
	sst := make([]string, 0, len(sstXML.Items))
	for _, si := range sstXML.Items {
		var b strings.Builder
		for _, t := range si.T {
			b.WriteString(t)
		}
		for _, rr := range si.R {
			for _, t := range rr.T {
				b.WriteString(t)
			}
		}
		sst = append(sst, b.String())
	}

	var wb pointWorkbook
	if err := readXML("xl/workbook.xml", &wb); err != nil {
		return nil, fmt.Errorf("无法读取工作簿结构：%v", err)
	}
	var rels pointRels
	_ = readXML("xl/_rels/workbook.xml.rels", &rels)
	relMap := map[string]string{}
	for _, r := range rels.Rels {
		relMap[r.ID] = r.Target
	}

	bases := map[string]pointBaseDesc{}
	bytesCfg := map[string]int{}
	slaves := []pointSlave{}
	devices := []pointDevice{}
	total := 0

	for i, sh := range wb.Sheets {
		target := relMap[sh.ID]
		if target == "" {
			target = "xl/worksheets/sheet" + strconv.Itoa(i+1) + ".xml"
		} else {
			target = strings.TrimPrefix(target, "/")
			if !strings.HasPrefix(target, "xl/") {
				target = path.Join("xl", target)
			}
		}
		zf := files[target]
		if zf == nil {
			// 退化：按 sheetN.xml 顺序查找
			for _, f := range zr.File {
				if m := reSheetN.FindStringSubmatch(path.Base(f.Name)); m != nil {
					if n, _ := strconv.Atoi(m[1]); n == i+1 {
						zf = f
						break
					}
				}
			}
		}
		if zf == nil {
			continue
		}
		rows, err := pointRows(zf, sst)
		if err != nil {
			continue
		}
		parseOverview(rows, bases, bytesCfg, &slaves)
		if g := parseDeviceSheet(rows); g != nil {
			cnt := 0
			for _, v := range g {
				cnt += len(v)
			}
			total += cnt
			devices = append(devices, pointDevice{Name: sh.Name, Sheet: i + 1, G: g})
		}
	}
	if len(devices) == 0 {
		return nil, fmt.Errorf("未识别到四遥点位表：请确认第 1 行含「遥测 / 遥信 / 遥控 / 遥调」分区标题")
	}
	res := map[string]any{
		"ok":      true,
		"meta":    map[string]any{"source": "用户导入的点表", "sheets": len(devices), "points": total},
		"devices": devices,
	}
	if len(bases) > 0 {
		res["bases"] = bases
	}
	if len(bytesCfg) > 0 {
		res["byteCfg"] = bytesCfg
	}
	if len(slaves) > 0 {
		res["slaves"] = slaves
	}
	return res, nil
}
