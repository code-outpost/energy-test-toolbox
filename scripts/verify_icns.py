#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 macOS .app 图标 assets/app.icns 的结构（跨平台，无需 macOS 工具）。"""
import os
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "assets", "app.icns")

EXPECTED = {b"icp4": 16, b"icp5": 32, b"icp6": 64,
            b"ic07": 128, b"ic08": 256, b"ic09": 512}


def png_size(data):
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n":
        return 0
    return struct.unpack(">II", data[16:24])[0]


def main():
    if not os.path.exists(PATH):
        print("FAIL: 缺少 assets/app.icns，请先运行 python scripts/make_icon.py")
        return 1
    data = open(PATH, "rb").read()
    if data[:4] != b"icns":
        print("FAIL: icns magic 不正确")
        return 1
    total = struct.unpack(">I", data[4:8])[0]
    if total != len(data):
        print("FAIL: icns 长度字段 %d 与实际 %d 不符" % (total, len(data)))
        return 1
    off, found = 8, {}
    while off + 8 <= len(data):
        kind = data[off:off + 4]
        size = struct.unpack(">I", data[off + 4:off + 8])[0]
        if size < 8 or off + size > len(data):
            print("FAIL: 条目 %r 长度异常 (%d)" % (kind, size))
            return 1
        payload = data[off + 8:off + size]
        dim = png_size(payload)
        if dim == 0:
            print("FAIL: 条目 %r 不是 PNG" % kind)
            return 1
        found[kind] = dim
        off += size
    if off != len(data):
        print("FAIL: 条目解析后存在残留字节")
        return 1
    for kind, want in EXPECTED.items():
        if found.get(kind) != want:
            print("FAIL: 缺少 %s (%dx%d)，实际 %r" % (kind.decode(), want, want, found.get(kind)))
            return 1
    print("OK  app.icns: %d 字节，%d 个尺寸 %s"
          % (len(data), len(found), ", ".join("%d" % v for _, v in sorted(found.items(), key=lambda kv: kv[1]))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
