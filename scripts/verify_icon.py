#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""验证 Windows exe 的 PE 资源目录已嵌入图标 / 图标组 / manifest。

同时从 RT_ICON 导出最大图标到 _icon_extracted.png 供人工目视确认。
零第三方依赖；可作为打包后的回归检查。
"""

import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXE = os.path.join(ROOT, "能源测试工具箱.exe")
OUT = os.path.join(ROOT, "_icon_extracted.png")

RT_NAMES = {3: "RT_ICON", 14: "RT_GROUP_ICON", 16: "RT_VERSION", 24: "RT_MANIFEST"}


def main():
    if not os.path.exists(EXE):
        print("✗ 未找到 exe:", EXE)
        return 1
    d = open(EXE, "rb").read()

    pe = struct.unpack_from("<I", d, 0x3C)[0]
    if d[pe:pe + 4] != b"PE\0\0":
        print("✗ 不是有效 PE 文件")
        return 1
    coff = pe + 4
    nsec = struct.unpack_from("<H", d, coff + 2)[0]
    optsz = struct.unpack_from("<H", d, coff + 16)[0]
    opt = coff + 20
    magic = struct.unpack_from("<H", d, opt)[0]
    dd = opt + (96 if magic == 0x10B else 112)  # PE32=96, PE32+=112
    rsrc_rva, rsrc_size = struct.unpack_from("<II", d, dd + 8 * 2)

    secs = []
    for i in range(nsec):
        o = opt + optsz + i * 40
        vsz, va, rsz, rp = struct.unpack_from("<IIII", d, o + 8)
        secs.append((va, vsz, rp, rsz))

    def rva2off(rva):
        for va, vsz, rp, rsz in secs:
            if va <= rva < va + max(vsz, rsz):
                return rp + (rva - va)
        return None

    base = rva2off(rsrc_rva)
    if base is None:
        print("✗ 找不到 .rsrc 节")
        return 1

    def entries(off):
        named, nid = struct.unpack_from("<HH", d, off + 12)
        return [struct.unpack_from("<II", d, off + 16 + i * 8)
                for i in range(named + nid)]

    print("PE 架构     :", "PE32+" if magic == 0x20B else "PE32")
    print(".rsrc 节    : RVA %s, 大小 %d bytes" % (hex(rsrc_rva), rsrc_size))
    print("exe 大小    : %d bytes" % len(d))

    found = {}
    icons = []
    for type_id, off1 in entries(base):
        tid = type_id if type_id < 0x80000000 else None
        if not (off1 & 0x80000000):
            continue
        lvl2 = base + (off1 & 0x7FFFFFFF)
        items = entries(lvl2)
        found[RT_NAMES.get(tid, tid)] = len(items)
        if tid == 3:  # RT_ICON：逐个取出数据
            for _name_id, off2 in items:
                if not (off2 & 0x80000000):
                    continue
                lvl3 = base + (off2 & 0x7FFFFFFF)
                for _lang, off3 in entries(lvl3):
                    de = base + (off3 & 0x7FFFFFFF)
                    data_rva, size = struct.unpack_from("<II", d, de)
                    fo = rva2off(data_rva)
                    if fo is not None:
                        icons.append(d[fo:fo + size])

    for k, v in found.items():
        print("  资源类型 %-16s 条目数 %d" % (str(k), v))

    ok = True
    for need in ("RT_ICON", "RT_GROUP_ICON", "RT_MANIFEST"):
        if need not in found:
            print("✗ 缺少", need)
            ok = False
    if found.get("RT_ICON", 0) < 7:
        print("✗ RT_ICON 数量不足（期望 >= 7）")
        ok = False

    big = max(icons, key=len, default=b"")
    if big.startswith(b"\x89PNG\r\n\x1a\n"):
        open(OUT, "wb").write(big)
        w, h = struct.unpack_from(">II", big, 16)
        print("✓ 已从 PE 导出图标: %s (%dx%d, %d bytes)" %
              (os.path.basename(OUT), w, h, len(big)))
    elif icons:
        print("! 图标为 BMP 格式，共 %d 个（未导出 PNG）" % len(icons))
    else:
        print("✗ 未能读取任何 RT_ICON 数据")
        ok = False

    print("✓ PE 资源验证通过" if ok else "✗ PE 资源验证失败")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
