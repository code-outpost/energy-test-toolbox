#!/usr/bin/env bash
# 组装 macOS .app（WKWebView 原生窗口）。
#
# 用法一（本机 macOS，已装 Xcode CLT）：
#   scripts/build-macos.sh
#   直接用当前架构 CGO_ENABLED=1 编译，产出单架构 .app。
#
# 用法二（CI）：传入两个架构的二进制，合成 universal binary：
#   scripts/build-macos.sh /path/to/etb-arm64 /path/to/etb-amd64
#
# 产物：dist/EnergyTestToolbox-macos-universal.zip
#       dist/SHA256SUMS-macos.txt（供 publish job 合并）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "本脚本只能在 macOS 上运行（需要 lipo / codesign / ditto）" >&2
  exit 1
fi

VERSION="$(sed -n "s/.*VERSION *= *'\([^']*\)'.*/\1/p" src/version.js | head -1)"
if [ -z "$VERSION" ]; then
  echo "无法从 src/version.js 读取版本号" >&2
  exit 1
fi

APP="EnergyTestToolbox.app"
ZIP="EnergyTestToolbox-macos-universal.zip"
OUT="dist"
rm -rf "$APP" "$OUT/$ZIP" "$OUT/SHA256SUMS-macos.txt"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$OUT"

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

# Ad-hoc 签名：无需开发者证书，可避免 Gatekeeper 直接报「已损坏」。
# 未公证应用首次打开仍需「右键 → 打开」或 xattr -dr com.apple.quarantine。
if ! codesign --force --deep --sign - "$APP" 2>/dev/null; then
  echo "warning: ad-hoc codesign 失败，继续打包" >&2
fi

ditto -c -k --sequesterRsrc --keepParent "$APP" "$OUT/$ZIP"
HASH="$(shasum -a 256 "$OUT/$ZIP" | awk '{print $1}')"
printf "%s  %s\n" "$HASH" "$ZIP" > "$OUT/SHA256SUMS-macos.txt"

echo "版本: v$VERSION"
lipo -info "$APP/Contents/MacOS/EnergyTestToolbox" || file "$APP/Contents/MacOS/EnergyTestToolbox"
echo "产物: $OUT/$ZIP"
echo "SHA256: $HASH"
