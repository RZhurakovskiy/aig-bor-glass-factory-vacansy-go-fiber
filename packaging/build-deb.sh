#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
PKG_DIR="$ROOT_DIR/packaging/deb"
OUT_DIR="$ROOT_DIR/packaging/build-deb/out"
PACKAGE_NAME="glass-factory_1.0.0_amd64.deb"

mkdir -p "$DIST_DIR" "$OUT_DIR"

cd "$ROOT_DIR"
GOOS=linux GOARCH=amd64 go build -o "$DIST_DIR/server_app_linux" ./cmd/server

install -m 0755 "$DIST_DIR/server_app_linux" "$PKG_DIR/opt/glass-factory/server_app"

printf '2.0\n' > "$OUT_DIR/debian-binary"
tar -C "$PKG_DIR/DEBIAN" -czf "$OUT_DIR/control.tar.gz" control postinst prerm
tar -C "$PKG_DIR" -czf "$OUT_DIR/data.tar.gz" ./opt ./lib

(
	cd "$OUT_DIR"
	ar rcs "$DIST_DIR/$PACKAGE_NAME" debian-binary control.tar.gz data.tar.gz
)
