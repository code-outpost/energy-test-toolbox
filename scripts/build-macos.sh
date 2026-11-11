#!/usr/bin/env bash
# 组装 macOS 交付物（WKWebView 原生窗口）。
#
# 用法一（本机 macOS，已装 Xcode CLT）：
#   bash scripts/build-macos.sh
#   直接用当前架构 CGO_ENABLED=1 编译，产出单架构 .app。
#
# 用法二（CI）：传入两个架构的二进制，合成 universal binary：
#   bash scripts/build-macos.sh /path/to/etb-arm64 /path/to/etb-amd64
#
# 产物（dist/）：
#   EnergyTestToolbox-macos-universal.zip    兼容旧链接的 .app 压缩包
#   EnergyTestToolbox-macos-universal.dmg   双击挂载 → 拖到 Applications 的拖拽安装包
#   EnergyTestToolbox-macos-installer.pkg   双击打开系统安装向导，自动装入 /Applications
#   SHA256SUMS-macos.txt                    三份产物的 SHA256（供 publish job 合并）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "本脚本只能在 macOS 上运行（需要 lipo / codesign / hdiutil / pkgbuild）" >&2
  exit 1
fi

VERSION="$(sed -n "s/.*VERSION *= *'\([^']*\)'.*/\1/p" src/version.js | head -1)"
if [ -z "$VERSION" ]; then
  echo "无法从 src/version.js 读取版本号" >&2
  exit 1
fi

APP="EnergyTestToolbox.app"
VOL="EnergyTestToolbox"
ZIP="EnergyTestToolbox-macos-universal.zip"
DMG="EnergyTestToolbox-macos-universal.dmg"
PKG="EnergyTestToolbox-macos-installer.pkg"
IDENT="cn.code-outpost.energytesttoolbox.app"
OUT="dist"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/etb-pkg.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT

rm -rf "$APP"
rm -f "$OUT/$ZIP" "$OUT/$DMG" "$OUT/$PKG" "$OUT/SHA256SUMS-macos.txt"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$OUT"

# ---------- 1. 组装 .app ----------
if [ "$#" -eq 2 ]; then
  echo "合并 universal binary: $1 (arm64) + $2 (amd64)"
  lipo -create -output "$APP/Contents/MacOS/EnergyTestToolbox" "$1" "$2"
else
  echo "本机编译（CGO_ENABLED=1，当前架构）"
  export CGO_ENABLED=1 GOOS=darwin
  export MACOSX_DEPLOYMENT_TARGET=11.0
  go build -trimpath -ldflags "-s -w" -o "$APP/Contents/MacOS/EnergyTestToolbox" .
fi

chmod +x "$APP/Contents/MacOS/EnergyTestToolbox"
cp assets/app.icns "$APP/Contents/Resources/app.icns"
sed "s/__VERSION__/$VERSION/g" assets/Info.plist > "$APP/Contents/Info.plist"

# Ad-hoc 签名：无需开发者证书，避免 Gatekeeper 直接判「已损坏」。
# 未公证应用首次打开仍需「右键 → 打开」或 xattr；PKG 的 postinstall 会自动处理。
if ! codesign --force --deep --sign - "$APP" 2>/dev/null; then
  echo "warning: ad-hoc codesign 失败，继续打包" >&2
fi

# 打包前的硬校验：Finder 双击要求可执行文件有执行位、plist 合法。
test -x "$APP/Contents/MacOS/EnergyTestToolbox" || {
  echo "错误：主可执行文件缺失或没有执行权限" >&2; exit 1;
}
/usr/bin/plutil -lint "$APP/Contents/Info.plist" >/dev/null
lipo -info "$APP/Contents/MacOS/EnergyTestToolbox" || file "$APP/Contents/MacOS/EnergyTestToolbox"

# ---------- 2. zip（兼容旧下载链接） ----------
ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/$ZIP" >/dev/null

# ---------- 3. DMG：双击挂载 → 拖到 Applications ----------
DMGSRC="$STAGE/dmgroot"
mkdir -p "$DMGSRC"
cp -R "$APP" "$DMGSRC/"
ln -s /Applications "$DMGSRC/Applications"
cp assets/macos-readme.txt "$DMGSRC/README.txt"

# 先建可写镜像再转 UDZO（只读压缩），保证 symlink 与 bundle 的完整权限被保留。
hdiutil create -volname "$VOL" -srcfolder "$DMGSRC" -ov -format UDRW -fs HFS+ "$STAGE/rw.dmg" >/dev/null
hdiutil convert "$STAGE/rw.dmg" -format UDZO -imagekey zlib-level=9 -o "$STAGE/final.dmg" >/dev/null
if [ -f "$STAGE/final.dmg" ]; then
  mv "$STAGE/final.dmg" "$OUT/$DMG"
elif [ -f "$STAGE/final.dmg.dmg" ]; then
  mv "$STAGE/final.dmg.dmg" "$OUT/$DMG"
else
  echo "错误：hdiutil convert 未生成 DMG" >&2; exit 1
fi
hdiutil imageinfo "$OUT/$DMG" >/dev/null

# ---------- 4. PKG：双击 → 系统安装向导 → 自动装到 /Applications ----------
PKGROOT="$STAGE/pkgroot"
SCRIPTS="$STAGE/scripts"
mkdir -p "$PKGROOT" "$SCRIPTS"
cp -R "$APP" "$PKGROOT/"
cp assets/macos-postinstall "$SCRIPTS/postinstall"
chmod +x "$SCRIPTS/postinstall"

pkgbuild --root "$PKGROOT" --install-location /Applications \
  --identifier "$IDENT" --version "$VERSION" --scripts "$SCRIPTS" \
  "$OUT/$PKG" >/dev/null

# 展开 pkg 校验安装位置、标识与 postinstall 是否真的打进去了。
EXP="$STAGE/expanded"
pkgutil --expand "$OUT/$PKG" "$EXP" >/dev/null
test -f "$EXP/PackageInfo" || { echo "错误：PKG 缺少 PackageInfo" >&2; exit 1; }
# pkgutil --expand 把 Scripts 保留为压缩归档（不是目录），--expand-full 才展开成目录。
test -s "$EXP/Scripts" || { echo "错误：PKG 缺少 postinstall 脚本归档" >&2; exit 1; }
if pkgutil --expand-full "$OUT/$PKG" "$STAGE/expanded-full" >/dev/null 2>&1; then
  find "$STAGE/expanded-full" -name postinstall -type f | grep -q . || {
    echo "错误：展开后未找到 postinstall" >&2; exit 1;
  }
  echo "  postinstall 已确认打进 PKG"
fi
python3 -c "import sys,xml.etree.ElementTree as E; r=E.parse(sys.argv[1]).getroot(); assert r.get('install-location')=='/Applications', r.attrib; assert r.get('identifier')=='$IDENT', r.attrib" "$EXP/PackageInfo"
if pkgutil --payload-files "$OUT/$PKG" 2>/dev/null | grep -q "EnergyTestToolbox.app/Contents/MacOS/EnergyTestToolbox"; then
  echo "  PKG payload 含主可执行文件"
else
  echo "  warning: 无法列出 PKG payload（不影响交付）" >&2
fi

# ---------- 5. 三份产物的 SHA256 ----------
{
  for f in "$ZIP" "$DMG" "$PKG"; do
    shasum -a 256 "$OUT/$f" | awk -v n="$f" '{print $1 "  " n}'
  done
} > "$OUT/SHA256SUMS-macos.txt"

echo "版本: v$VERSION"
echo "产物:"
for f in "$ZIP" "$DMG" "$PKG"; do
  printf "  %-46s %10s bytes\n" "$f" "$(stat -f%z "$OUT/$f")"
done
cat "$OUT/SHA256SUMS-macos.txt"
