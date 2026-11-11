#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 SmartLogger IEC104 转发协议接口描述.xlsx 抽取四遥点表，生成前端可嵌入数据。

用法：
    python scripts/extract_iec104_points.py [源xlsx路径]

产物：
    src/data/iec104-points.js    -> window.TB_IEC104_POINTS（随 go:embed 打入二进制）

抽取规则（依据文档结构）：
  - sheet2「总体描述」：四遥信息体基地址（十六进制）、字节数配置、转发设备点号分配。
  - sheet3「设备型号描述」：每列一个设备系列，作为设备别名用于搜索。
  - sheet4..43：第 1 行给出「遥测/遥信/遥控/遥调」四个分区的起始列，
                第 2 行是分区内表头（序号/信号名称/单位/精度/范围/状态/命令/备注），
                第 3 行起为点位数据；分区边界为下一个类别的起始列。

点号换算（见 sheet2）：
    全局点号 = 转发设备配置的起始点号 + 表内序号 - 1
    IOA      = 该类基地址 + 全局点号 - 1
即 IOA = base + deviceStart + localNo - 2。

仅使用 Python 标准库（zipfile + ElementTree），无需 openpyxl / pandas。
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_XLSX = os.path.join(ROOT, "SmartLogger V300R024C10SPC275 IEC104转发协议接口描述.xlsx")
OUT_JS = os.path.join(ROOT, "src", "data", "iec104-points.js")

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
CATS = ["遥测", "遥信", "遥控", "遥调"]
CAT_KEY = {"遥测": "yc", "遥信": "yx", "遥控": "yk", "遥调": "yt"}
# 文档明确给出的十六进制信息体基地址（sheet2「1、信息体基地址范围」）
BASES = {"yx": 0x0001, "yc": 0x4001, "yk": 0x6001, "yt": 0x6201}
# 文档给出的类型标识（注意：遥测短浮点在此文档中为 13，非标准 104 的 7）
TI_HUAWEI = {"yx": 1, "yc": 13, "yk": 45, "yt": 50}
TI_STANDARD = {"yx": 1, "yc": 7, "yk": 45, "yt": 50}
CAT_NAMES = {"yc": "遥测", "yx": "遥信", "yk": "遥控", "yt": "遥调"}


def colnum(ref):
    s = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in s:
        n = n * 26 + ord(ch) - 64
    return n - 1


class Book:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.ss = [
            "".join(t.text or "" for t in si.iter(M + "t"))
            for si in ET.fromstring(self.z.read("xl/sharedStrings.xml")).findall(M + "si")
        ]
        wb = ET.fromstring(self.z.read("xl/workbook.xml"))
        self.names = [s.get("name") for s in wb.find(M + "sheets")]
        rels = ET.fromstring(self.z.read("xl/_rels/workbook.xml.rels"))
        rmap = {r.get("Id"): r.get("Target") for r in rels}
        self.targets = []
        for s in wb.find(M + "sheets"):
            tgt = rmap.get(s.get(R + "id"), "").lstrip("/")
            if not tgt.startswith("xl/"):
                tgt = "xl/" + tgt
            self.targets.append(tgt)

    def rows(self, idx):
        root = ET.fromstring(self.z.read(self.targets[idx - 1]))
        out = []
        for row in root.iter(M + "row"):
            cells = {}
            for c in row.findall(M + "c"):
                v = c.find(M + "v")
                isel = c.find(M + "is")
                t = c.get("t")
                if t == "s" and v is not None:
                    val = self.ss[int(v.text)]
                elif t == "inlineStr" and isel is not None:
                    val = "".join(x.text or "" for x in isel.iter(M + "t"))
                elif v is not None:
                    val = v.text
                else:
                    val = ""
                cells[colnum(c.get("r"))] = str(val).replace("\n", " ").strip()
            if cells:
                out.append([cells.get(i, "") for i in range(max(cells) + 1)])
        return out


def cell(row, i):
    return row[i] if i < len(row) else ""


def parse_overview(bk):
    """sheet2：基地址说明、字节数配置、转发设备点号分配。"""
    rows = bk.rows(2)
    bases_desc = {}
    bytes_cfg = {}
    for r in rows[:12]:
        joined = " | ".join(x for x in r if x)
        for cat in CATS:
            m = re.search(r"([0-9A-Fa-f]{4})H\s*--\s*([0-9A-Fa-f]{4})H", joined)
            if r and r[0] == cat and m:
                bases_desc[CAT_KEY[cat]] = {
                    "from": int(m.group(1), 16),
                    "to": int(m.group(2), 16),
                    "hex": m.group(1).upper() + "H--" + m.group(2).upper() + "H",
                }
        if r and r[0] in ("公共地址字节数", "传输原因字节数", "信息体地址字节数"):
            v = next((x for x in r[1:] if x), "")
            if v.isdigit():
                key = {"公共地址字节数": "ca", "传输原因字节数": "cot", "信息体地址字节数": "ioa"}[r[0]]
                bytes_cfg[key] = int(v)
    # 第 15 行起：设备名称 | 从机地址 | 遥信起 | 遥信止 | 遥测起 | 遥测止 | 遥控起 | 遥控止
    devices = []
    for r in rows[14:]:
        if not r or not r[0] or r[0].startswith(("设备名称", "开始", "4、")):
            continue
        nums = [x for x in r[1:8] if str(x).strip().isdigit()]
        if len(nums) < 7:
            continue
        try:
            n = [int(x) for x in nums[:7]]
        except ValueError:
            continue
        devices.append({
            "name": r[0], "slave": n[0],
            "yx": [n[1], n[2]], "yc": [n[3], n[4]], "yk": [n[5], n[6]],
        })
    return bases_desc, bytes_cfg, devices


def parse_aliases(bk):
    """sheet3：每列一个设备系列，收集型号别名。"""
    rows = bk.rows(3)
    head = rows[0] if rows else []
    out = {}
    for i, name in enumerate(head):
        if not name:
            continue
        models = []
        for r in rows[1:]:
            v = cell(r, i)
            if v and v not in models:
                models.append(v)
        if models:
            out[name] = models
    return out


def parse_device(bk, idx):
    """解析单张设备表：按第 1 行四遥分区、第 2 行表头抽点位。"""
    rows = bk.rows(idx)
    if len(rows) < 2:
        return None
    head = rows[0]
    marks = [(c, head[c]) for c in range(len(head)) if head[c] in CATS]
    if not marks:
        return None
    hdr = rows[1]
    width = max([len(r) for r in rows] + [len(hdr)])
    groups = {}
    for k, (start, cat) in enumerate(marks):
        end = marks[k + 1][0] if k + 1 < len(marks) else width
        # 分区内表头 → 列号
        fields = {}
        for c in range(start, min(end, len(hdr))):
            label = hdr[c] if c < len(hdr) else ""
            if not label:
                continue
            for token, key in (
                ("序号", "no"), ("信号名称", "name"), ("单位", "unit"),
                ("精度", "prec"), ("范围", "range"), ("状态", "state"),
                ("命令", "cmd"), ("备注", "remark"),
            ):
                if token in label and key not in fields:
                    fields[key] = c
        if "no" not in fields or "name" not in fields:
            continue
        points = []
        for r in rows[2:]:
            no_raw = cell(r, fields["no"])
            name = cell(r, fields["name"])
            if not name or not re.fullmatch(r"\d+", no_raw):
                continue
            no = int(no_raw)
            if no < 1 or no > 100000:
                continue
            def g(key, limit=None):
                if key not in fields:
                    return ""
                v = cell(r, fields[key]).strip()
                return v[:limit] if limit else v
            points.append({
                "n": no,
                "s": name[:120],
                "u": g("unit", 20),
                "p": g("prec", 24),
                "g": g("range", 60),
                "x": g("state", 120) or g("cmd", 120),
                "r": g("remark", 180),
            })
        # 去重（同一张表可能有重复序号）
        seen, uniq = set(), []
        for p in points:
            key = (p["n"], p["s"])
            if key in seen:
                continue
            seen.add(key)
            uniq.append(p)
        groups[CAT_KEY[cat]] = sorted(uniq, key=lambda p: p["n"])
    return groups if groups else None


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    if not os.path.isfile(path):
        print("找不到点表文件：%s" % path, file=sys.stderr)
        return 1
    bk = Book(path)
    bases_desc, bytes_cfg, devices = parse_overview(bk)
    aliases = parse_aliases(bk)
    print("sheet 总数：%d" % len(bk.names))
    print("基地址说明：%s" % json.dumps(bases_desc, ensure_ascii=False))
    print("字节数配置：%s" % json.dumps(bytes_cfg, ensure_ascii=False))
    print("转发设备配置：%d 条" % len(devices))
    for d in devices:
        print("   %-28s slave=%s yx=%s yc=%s yk=%s" % (d["name"][:28], d["slave"], d["yx"], d["yc"], d["yk"]))
    print("设备型号别名：%d 组 / %d 个型号" % (len(aliases), sum(len(v) for v in aliases.values())))

    devs, total = [], 0
    for idx in range(4, len(bk.names) + 1):
        groups = parse_device(bk, idx)
        if not groups:
            continue
        counts = {k: len(v) for k, v in groups.items()}
        total += sum(counts.values())
        devs.append({"id": "d%d" % idx, "name": bk.names[idx - 1], "sheet": idx,
                     "models": aliases.get(bk.names[idx - 1], []), "g": groups})
        print("  sheet%-2d %-38s 遥测%-4d 遥信%-4d 遥控%-4d 遥调%-4d" % (
            idx, bk.names[idx - 1][:38], counts.get("yc", 0), counts.get("yx", 0),
            counts.get("yk", 0), counts.get("yt", 0)))
    print("设备表 %d 张，点位合计 %d 条" % (len(devs), total))

    for key in BASES:
        assert BASES[key] == bases_desc.get(key, {}).get("from", BASES[key]), \
            "基地址与文档不一致：%s" % key
    assert bytes_cfg.get("ioa") == 3, "信息体地址字节数应为 3"
    assert devices, "未解析到转发设备配置"

    data = {
        "meta": {
            "source": "SmartLogger V300R024C10SPC275 IEC104转发协议接口描述",
            "vendor": "Huawei",
            "note": "点表为事实性点位清单整理，仅供现场点号核对；正式工程请以设备厂商随附文档为准。",
            "sheets": len(devs),
            "points": total,
        },
        "bases": BASES,
        "basesDesc": bases_desc,
        "byteCfg": bytes_cfg,
        "ti": {"huawei": TI_HUAWEI, "standard": TI_STANDARD},
        "catNames": CAT_NAMES,
        "catOrder": ["yx", "yc", "yk", "yt"],
        "slaves": devices,
        "devices": devs,
    }
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(OUT_JS, "w", encoding="utf-8") as f:
        f.write("// 由 scripts/extract_iec104_points.py 从 SmartLogger IEC104 点表自动生成，请勿手工编辑。\n")
        f.write("// 来源：%s\n" % data["meta"]["source"])
        f.write("// %s\n" % data["meta"]["note"])
        f.write("window.TB_IEC104_POINTS = %s;\n" % payload)
    print("\n已生成 %s (%d 字节)" % (os.path.relpath(OUT_JS, ROOT).replace("\\", "/"), os.path.getsize(OUT_JS)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
