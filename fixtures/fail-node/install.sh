#!/usr/bin/env bash
# Forge614 node installer — rendered from forge614-ai/standard/templates/install.sh (standard 1.0.0).
# Usage: install.sh [--version X.Y.Z] [--archive path.tar.gz] [--uninstall]
set -eu

NODE_NAME="demo"
REPO="jotredev/forge614-demo"
ASSET_PREFIX="forge614-demo"
FORGE614_HOME="${FORGE614_HOME:-$HOME/.forge614}"
NODE_HOME="$FORGE614_HOME/$NODE_NAME"
BIN_DIR="$NODE_HOME/bin"
LAUNCHER="$BIN_DIR/forge614-$NODE_NAME"

log() { printf '%s\n' "$*" >&2; }
die() { log "error: $*"; exit 1; }

VERSION=""; ARCHIVE=""; UNINSTALL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="$2"; shift 2 ;;
    --archive) ARCHIVE="$2"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

# Migración de instalaciones anteriores al estándar: instalación plana ($BIN_DIR/forge614-<node> como
# binario real, sin prefijo versionado) y bloques PATH marcados en los perfiles de shell. Un nodo alineado
# nunca edita PATH: solo forge614-ai crea el comando global. El perfil se respalda antes de tocarlo.
MARK_BEGIN="# >>> forge614-$NODE_NAME PATH >>>"
MARK_END="# <<< forge614-$NODE_NAME PATH <<<"
remove_path_block() {
  local file="$1"
  [ -f "$file" ] || return 0
  grep -qF "$MARK_BEGIN" "$file" || return 0
  cp "$file" "$file.forge614-backup-$(date +%Y%m%d%H%M%S)"
  awk -v b="$MARK_BEGIN" -v e="$MARK_END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  log "removed legacy PATH block from $file (backup kept next to it)"
}
remove_legacy_path_blocks() {
  local f
  for f in "$HOME/.zshrc" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.profile" "$HOME/.config/fish/conf.d/forge614-$NODE_NAME.fish"; do remove_path_block "$f"; done
  [ -f "$HOME/.config/fish/conf.d/forge614-$NODE_NAME.fish" ] && [ ! -s "$HOME/.config/fish/conf.d/forge614-$NODE_NAME.fish" ] && rm -f "$HOME/.config/fish/conf.d/forge614-$NODE_NAME.fish"
  return 0
}
migrate_legacy_install() {
  if [ -f "$LAUNCHER" ] && [ ! -L "$LAUNCHER" ]; then
    local legacy="$NODE_HOME/legacy-$(date +%Y%m%d%H%M%S)"
    mkdir -p "$legacy" && mv "$LAUNCHER" "$legacy/forge614-$NODE_NAME"
    log "moved flat install to $legacy (kept until the new version verifies)"
  fi
  remove_legacy_path_blocks
}

# Desinstalación simétrica: integraciones primero, luego los bloques PATH que una instalación plana
# anterior pudo dejar en los perfiles, y por último solo el directorio del nodo (nunca ~/.forge614/).
if [ "$UNINSTALL" = "1" ]; then
  if [ -x "$LAUNCHER" ]; then "$LAUNCHER" uninstall --self || die "node refused to uninstall its integrations; nothing removed"; fi
  remove_legacy_path_blocks
  rm -rf "$NODE_HOME"
  log "removed $NODE_HOME"
  exit 0
fi

platform() {
  local os arch
  case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) die "unsupported OS $(uname -s)" ;; esac
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) die "unsupported arch $(uname -m)" ;; esac
  printf '%s-%s' "$os" "$arch"
}

resolve_version() {
  # Sin Node ni Python: la API de releases devuelve "tag_name": "vX.Y.Z"; se extrae con sed.
  curl -fsSL --proto '=https' --tlsv1.2 -H 'Accept: application/vnd.github+json' "https://api.github.com/repos/$REPO/releases/latest" \
    | sed -n 's/.*"tag_name": *"v\([0-9][0-9.]*\)".*/\1/p' | head -n1
}

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PLATFORM="$(platform)"
if [ -z "$ARCHIVE" ]; then
  [ -n "$VERSION" ] || VERSION="$(resolve_version)"
  [ -n "$VERSION" ] || die "could not resolve latest version"
  BASE="https://github.com/$REPO/releases/download/v$VERSION"
  ASSET="$ASSET_PREFIX-$PLATFORM.tar.gz"
  curl -fsSL --proto '=https' --tlsv1.2 -o "$TMP/$ASSET" "$BASE/$ASSET"
  curl -fsSL --proto '=https' --tlsv1.2 -o "$TMP/SHA256SUMS" "$BASE/SHA256SUMS"
  ( cd "$TMP" && grep " $ASSET\$" SHA256SUMS | sha256sum -c - >/dev/null 2>&1 || shasum -a 256 -c <(grep " $ASSET\$" SHA256SUMS) >/dev/null ) || die "checksum mismatch for $ASSET"
  ARCHIVE="$TMP/$ASSET"
else
  [ -n "$VERSION" ] || die "--archive requires --version"
fi

migrate_legacy_install
DEST="$NODE_HOME/$VERSION"
mkdir -p "$DEST" "$BIN_DIR"
tar -xzf "$ARCHIVE" -C "$DEST"
chmod 0755 "$DEST/forge614-$NODE_NAME"
ln -sfn "$DEST/forge614-$NODE_NAME" "$LAUNCHER"
printf '%s\n' "$VERSION" > "$NODE_HOME/.active-version"
"$LAUNCHER" --version >/dev/null || die "installed binary does not run"
log "installed forge614-$NODE_NAME $VERSION at $DEST (launcher: $LAUNCHER)"
