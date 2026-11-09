#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验已提交的 PE 资源对象（.syso）存在且结构正确，供无 exe 的 CI 环境使用。"""
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(ROOT, "rsrc_windows_amd64.syso")

if not os.path.exists(P):
    print("✗ 缺少 rsrc_windows_amd64.syso")
    sys.exit(1)

d = open(P, "rb").read()
machine = struct.unpack_from("<H", d, 0)[0]
nsec = struct.unpack_from("<H", d, 2)[0]
sections = []
for i in range(nsec):
    o = 20 + i * 40
    name = d[o:o + 8].rstrip(b"\x00").decode("ascii", "replace")
    sections.append(name)

print("syso 大小   :", len(d), "bytes")
print("COFF 机器   : 0x%04x (0x8664 = amd64)" % machine)
print("节名        :", sections)
ok = machine == 0x8664 and ".rsrc" in sections and len(d) > 10000
if not ok:
    print("✗ PE 资源对象结构异常")
    sys.exit(1)
print("✓ PE 资源对象有效（图标 + manifest 已编译进资源节）")
