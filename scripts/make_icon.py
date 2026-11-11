#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成应用图标（零第三方依赖）。

产物：
  assets/app.ico          多尺寸 Windows 图标（供 PE 资源 / exe）
  assets/app.icns         多尺寸 macOS 图标（供 .app bundle）
  src/assets/favicon.ico   网页 favicon（随 src/ 一起嵌入 exe）
  docs/assets/icon-512.png 官网用大图
  docs/assets/favicon.ico  官网 favicon

设计：深色 HUD 圆角方板 + 青色霓虹描边 + 发光闪电，与应用 v5 视觉一致。
"""

import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]
SS = 3  # 超采样倍数（抗锯齿）

# 闪电轮廓（归一化坐标，y 向下）
BOLT = [
    (0.575, 0.110),
    (0.312, 0.548),
    (0.466, 0.548),
    (0.392, 0.890),
    (0.706, 0.424),
    (0.536, 0.424),
    (0.658, 0.110),
]

EDGES = []
for _i in range(len(BOLT)):
    _ax, _ay = BOLT[_i]
    _bx, _by = BOLT[(_i + 1) % len(BOLT)]
    _vx, _vy = _bx - _ax, _by - _ay
    EDGES.append((_ax, _ay, _vx, _vy, _vx * _vx + _vy * _vy))


def clamp(v, a, b):
    return a if v < a else (b if v > b else v)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))


def sd_roundbox(x, y, hx, hy, r):
    qx = abs(x) - hx + r
    qy = abs(y) - hy + r
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def bolt_sd(x, y):
    """返回 (有符号距离, 绝对距离)。负=在闪电内部。"""
    dmin = 1e9
    inside = False
    for ax, ay, vx, vy, vv in EDGES:
        t = clamp(((x - ax) * vx + (y - ay) * vy) / vv, 0.0, 1.0)
        dx = x - (ax + t * vx)
        dy = y - (ay + t * vy)
        d2 = dx * dx + dy * dy
        if d2 < dmin:
            dmin = d2
        by = ay + vy
        if (ay > y) != (by > y) and vy != 0:
            xint = ax + (y - ay) * vx / vy
            if x < xint:
                inside = not inside
    d = math.sqrt(dmin)
    return (-d if inside else d), d


def render_hi(n):
    """渲染 n×n 高分 RGBA（非预乘）bytearray。"""
    buf = bytearray(n * n * 4)
    pw = 1.0 / n
    inv_pw = 1.0 / pw
    for py in range(n):
        y = (py + 0.5) * pw
        cy = y - 0.5
        row = py * n * 4
        for px in range(n):
            x = (px + 0.5) * pw
            cx = x - 0.5

            dbox = sd_roundbox(cx, cy, 0.470, 0.470, 0.215)
            cover = clamp(0.5 - dbox * inv_pw, 0.0, 1.0)
            if cover <= 0.0:
                continue  # 板外透明

            t = y
            col = (lerp(20, 6, t), lerp(52, 14, t), lerp(92, 32, t))
            rad = math.hypot(cx, cy)
            glow = max(0.0, 1.0 - rad / 0.64) ** 2
            col = (col[0] + 9 * glow, col[1] + 42 * glow, col[2] + 60 * glow)

            # 内侧霓虹描边
            edge = math.exp(-((dbox + 0.016) / 0.013) ** 2)
            col = mix(col, (34, 211, 238), 0.62 * edge)

            ds, d = bolt_sd(x, y)
            bcov = clamp(0.5 - ds * inv_pw, 0.0, 1.0)
            g = clamp((y - 0.10) / 0.80, 0.0, 1.0)
            bolt_col = (lerp(244, 34, g), lerp(255, 214, g), lerp(255, 240, g))
            col = mix(col, bolt_col, bcov)

            # 闪电辉光
            if d < 0.18:
                gl = math.exp(-d / 0.038) * 0.55
                col = (col[0] + 34 * gl, col[1] + 211 * gl, col[2] + 238 * gl)

            # 顶部高光
            hl = max(0.0, 1.0 - y / 0.32) * 0.09
            col = (col[0] + 130 * hl, col[1] + 165 * hl, col[2] + 185 * hl)

            o = row + px * 4
            buf[o] = int(clamp(col[0], 0, 255) + 0.5)
            buf[o + 1] = int(clamp(col[1], 0, 255) + 0.5)
            buf[o + 2] = int(clamp(col[2], 0, 255) + 0.5)
            buf[o + 3] = int(cover * 255 + 0.5)
    return buf


def make_pixels(size):
    """超采样后按预乘 alpha 盒式下采样，得到 size×size RGBA。"""
    n = size * SS
    hi = render_hi(n)
    out = bytearray(size * size * 4)
    inv = 1.0 / (SS * SS)
    for y in range(size):
        for x in range(size):
            ar = ag = ab = aa = 0.0
            for j in range(SS):
                row = (y * SS + j) * n * 4
                for i in range(SS):
                    p = row + (x * SS + i) * 4
                    a = hi[p + 3] / 255.0
                    ar += hi[p] * a
                    ag += hi[p + 1] * a
                    ab += hi[p + 2] * a
                    aa += a
            o = (y * size + x) * 4
            if aa > 0:
                out[o] = int(clamp(ar / aa, 0, 255) + 0.5)
                out[o + 1] = int(clamp(ag / aa, 0, 255) + 0.5)
                out[o + 2] = int(clamp(ab / aa, 0, 255) + 0.5)
            out[o + 3] = int(clamp(aa * inv * 255, 0, 255) + 0.5)
    return out


def png_chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def make_png(size, pixels):
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)  # filter: none
        raw += pixels[y * stride:(y + 1) * stride]
    return (b"\x89PNG\r\n\x1a\n"
            + png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
            + png_chunk(b"IEND", b""))


def make_ico(images):
    """images: [(size, png_bytes), ...]（PNG 压缩 ICO，Vista+ 支持）。"""
    header = struct.pack("<HHH", 0, 1, len(images))
    offset = 6 + 16 * len(images)
    entries, blobs = [], []
    for size, data in images:
        w = 0 if size >= 256 else size
        entries.append(struct.pack("<BBBBHHII", w, w, 0, 0, 1, 32,
                                   len(data), offset))
        blobs.append(data)
        offset += len(data)
    return header + b"".join(entries) + b"".join(blobs)


# macOS .icns 条目类型（PNG 压缩，10.7+ 支持）
ICNS_TYPES = {
    16: b"icp4", 32: b"icp5", 64: b"icp6",
    128: b"ic07", 256: b"ic08", 512: b"ic09",
}


def make_icns(images):
    """images: [(size, png_bytes), ...] → 标准 icns（header + 若干 OSType 条目）。"""
    entries = bytearray()
    for size, data in images:
        kind = ICNS_TYPES.get(size)
        if kind is None:
            continue
        entries += kind + struct.pack(">I", len(data) + 8) + data
    return b"icns" + struct.pack(">I", len(entries) + 8) + bytes(entries)


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    print("  %-42s %7d bytes" % (os.path.relpath(path, ROOT).replace("\\", "/"), len(data)))


def main():
    print("生成图标（科技感深色 HUD + 霓虹闪电）...")
    images = []
    for s in ICO_SIZES:
        images.append((s, make_png(s, make_pixels(s))))
    png512 = make_png(512, make_pixels(512))
    ico = make_ico(images)
    write(os.path.join(ROOT, "assets", "app.ico"), ico)
    write(os.path.join(ROOT, "src", "assets", "favicon.ico"), ico)
    write(os.path.join(ROOT, "docs", "assets", "favicon.ico"), ico)
    write(os.path.join(ROOT, "docs", "assets", "icon-512.png"), png512)
    write(os.path.join(ROOT, "assets", "app.icns"),
          make_icns(images + [(512, png512)]))
    print("完成：%d 个尺寸 (16~256) + 512 PNG + macOS icns" % len(images))


if __name__ == "__main__":
    main()
