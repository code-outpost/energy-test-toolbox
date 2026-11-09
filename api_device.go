package main

// 设备联调后端：仅监听 127.0.0.1 的本地 API，供 WebView 内的「设备联调」模块调用。
// 支持 Modbus TCP 主站、裸 TCP 透传、串口 RTU 收发与串口枚举。
// 所有连接都由本机主动发起，不经过任何外部服务器。

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"go.bug.st/serial"
)

type devReq struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Unit     int    `json:"unit"`
	Func     int    `json:"func"`
	Addr     int    `json:"addr"`
	Count    int    `json:"count"`
	PortName string `json:"port_name"`
	Baud     int    `json:"baud"`
	Hex      string `json:"hex"`
	Timeout  int    `json:"timeout"`
}

type devResp struct {
	OK        bool     `json:"ok"`
	TX        string   `json:"tx,omitempty"`
	RX        string   `json:"rx,omitempty"`
	Registers []uint16 `json:"registers,omitempty"`
	Ports     []string `json:"ports,omitempty"`
	MS        int64    `json:"ms"`
	Error     string   `json:"error,omitempty"`
	Desktop   bool     `json:"desktop,omitempty"`
	Version   string   `json:"version,omitempty"`
}

// appVersion 从嵌入的 src/version.js 读取版本号，保证前端/后端/文档只有一个事实来源。
func appVersion() string {
	b, err := assets.ReadFile("src/version.js")
	if err != nil {
		return "unknown"
	}
	m := regexp.MustCompile(`VERSION\s*=\s*'([^']+)'`).FindSubmatch(b)
	if len(m) > 1 {
		return string(m[1])
	}
	return "unknown"
}

func timeoutOf(ms int) time.Duration {
	if ms < 100 {
		ms = 2000
	}
	if ms > 30000 {
		ms = 30000
	}
	return time.Duration(ms) * time.Millisecond
}

func parseHexBytes(s string) ([]byte, error) {
	var b strings.Builder
	for _, r := range s {
		if (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F') {
			b.WriteRune(r)
		}
	}
	clean := b.String()
	if clean == "" {
		return nil, fmt.Errorf("报文为空")
	}
	if len(clean)%2 == 1 {
		clean = "0" + clean
	}
	out, err := hex.DecodeString(clean)
	if err != nil {
		return nil, fmt.Errorf("HEX 解析失败: %v", err)
	}
	return out, nil
}

func fmtHex(b []byte) string {
	h := strings.ToUpper(hex.EncodeToString(b))
	var parts []string
	for i := 0; i < len(h); i += 2 {
		parts = append(parts, h[i:i+2])
	}
	return strings.Join(parts, " ")
}

func writeJSON(w http.ResponseWriter, v devResp) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_ = json.NewEncoder(w).Encode(v)
}

func readReq(w http.ResponseWriter, r *http.Request) (devReq, bool) {
	if r.Method != http.MethodPost {
		writeJSON(w, devResp{Error: "仅支持 POST"})
		return devReq{}, false
	}
	var q devReq
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&q); err != nil {
		writeJSON(w, devResp{Error: "请求体解析失败: " + err.Error()})
		return devReq{}, false
	}
	return q, true
}

func tcpExchange(q devReq, frame []byte) ([]byte, int64, error) {
	start := time.Now()
	if q.Host == "" {
		q.Host = "127.0.0.1"
	}
	if q.Port <= 0 {
		q.Port = 502
	}
	d := timeoutOf(q.Timeout)
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(q.Host, fmt.Sprint(q.Port)), d)
	if err != nil {
		return nil, time.Since(start).Milliseconds(), fmt.Errorf("连接失败: %v", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(d))
	if _, err = conn.Write(frame); err != nil {
		return nil, time.Since(start).Milliseconds(), fmt.Errorf("发送失败: %v", err)
	}
	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	ms := time.Since(start).Milliseconds()
	if err != nil {
		return nil, ms, fmt.Errorf("已发送但未收到响应: %v", err)
	}
	return buf[:n], ms, nil
}

// buildModbusFrame 构造 Modbus TCP 的 MBAP + PDU。
func buildModbusFrame(q devReq) []byte {
	f := q.Func
	if f <= 0 {
		f = 3
	}
	if q.Unit <= 0 {
		q.Unit = 1
	}
	pdu := []byte{byte(f), byte(q.Addr >> 8), byte(q.Addr), byte(q.Count >> 8), byte(q.Count)}
	length := len(pdu) + 1
	frame := []byte{0x00, 0x01, 0x00, 0x00, byte(length >> 8), byte(length), byte(q.Unit)}
	return append(frame, pdu...)
}

func parseModbusRegisters(rx []byte, f int) []uint16 {
	var out []uint16
	if len(rx) < 9 || int(rx[7]&0x7F) != f {
		return out
	}
	count := int(rx[8])
	if f == 1 || f == 2 {
		for i := 0; i < count && 9+i < len(rx); i++ {
			out = append(out, uint16(rx[9+i]))
		}
		return out
	}
	for i := 0; i+1 < count && 9+i+1 < len(rx); i += 2 {
		out = append(out, uint16(rx[9+i])<<8|uint16(rx[9+i+1]))
	}
	return out
}

func registerDeviceAPI(mux *http.ServeMux) {
	mux.HandleFunc("/api/device/ping", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, devResp{OK: true, Desktop: true, Version: appVersion()})
	})

	mux.HandleFunc("/api/device/ports", func(w http.ResponseWriter, r *http.Request) {
		ports, err := serial.GetPortsList()
		if err != nil {
			writeJSON(w, devResp{Error: "枚举串口失败: " + err.Error()})
			return
		}
		writeJSON(w, devResp{OK: true, Ports: ports})
	})

	mux.HandleFunc("/api/device/tcp", func(w http.ResponseWriter, r *http.Request) {
		q, ok := readReq(w, r)
		if !ok {
			return
		}
		tx, err := parseHexBytes(q.Hex)
		if err != nil {
			writeJSON(w, devResp{Error: err.Error()})
			return
		}
		rx, ms, err := tcpExchange(q, tx)
		resp := devResp{TX: fmtHex(tx), MS: ms}
		if err != nil {
			resp.Error = err.Error()
		} else {
			resp.OK = true
			resp.RX = fmtHex(rx)
		}
		writeJSON(w, resp)
	})

	mux.HandleFunc("/api/device/modbus", func(w http.ResponseWriter, r *http.Request) {
		q, ok := readReq(w, r)
		if !ok {
			return
		}
		if q.Func <= 0 {
			q.Func = 3
		}
		frame := buildModbusFrame(q)
		rx, ms, err := tcpExchange(q, frame)
		resp := devResp{TX: fmtHex(frame), MS: ms}
		if err != nil {
			resp.Error = err.Error()
		} else {
			resp.OK = true
			resp.RX = fmtHex(rx)
			resp.Registers = parseModbusRegisters(rx, q.Func)
		}
		writeJSON(w, resp)
	})

	mux.HandleFunc("/api/device/serial", func(w http.ResponseWriter, r *http.Request) {
		q, ok := readReq(w, r)
		if !ok {
			return
		}
		tx, err := parseHexBytes(q.Hex)
		if err != nil {
			writeJSON(w, devResp{Error: err.Error()})
			return
		}
		if q.Baud <= 0 {
			q.Baud = 9600
		}
		start := time.Now()
		mode := &serial.Mode{BaudRate: q.Baud, DataBits: 8, Parity: serial.NoParity, StopBits: serial.OneStopBit}
		p, err := serial.Open(q.PortName, mode)
		if err != nil {
			writeJSON(w, devResp{TX: fmtHex(tx), Error: "打开串口失败: " + err.Error(), MS: time.Since(start).Milliseconds()})
			return
		}
		defer p.Close()
		_ = p.SetReadTimeout(timeoutOf(q.Timeout))
		if _, err = p.Write(tx); err != nil {
			writeJSON(w, devResp{TX: fmtHex(tx), Error: "串口发送失败: " + err.Error(), MS: time.Since(start).Milliseconds()})
			return
		}
		buf := make([]byte, 4096)
		n, err := p.Read(buf)
		resp := devResp{TX: fmtHex(tx), MS: time.Since(start).Milliseconds()}
		if err != nil {
			resp.Error = "已发送但未收到响应: " + err.Error()
		} else {
			resp.OK = true
			resp.RX = fmtHex(buf[:n])
		}
		writeJSON(w, resp)
	})
}
