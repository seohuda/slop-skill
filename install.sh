#!/usr/bin/env bash
set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
REPO_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
SKILL_SRC="$REPO_DIR/skills/slop-skill"

TARGET_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
DRY_RUN=false
FORCE=false

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Symlinks skills/slop-skill into the Claude skills directory.

Options:
  --target <dir>   Override target skills directory (default: ${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills})
  --dry-run        Print planned actions without modifying the filesystem
  --force          Replace an existing file, directory, or different symlink at the target path
  -h, --help       Show this help message
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --target)
      if [ "$#" -lt 2 ] || [ -z "$2" ]; then
        echo "Error: --target requires a non-empty directory path." >&2
        exit 1
      fi
      TARGET_DIR="$2"
      shift 2
      ;;
    --target=*)
      TARGET_DIR="${1#*=}"
      if [ -z "$TARGET_DIR" ]; then
        echo "Error: --target requires a non-empty directory path." >&2
        exit 1
      fi
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Error: Unknown option '$1'. Use --help for usage." >&2
      exit 1
      ;;
  esac
done

if [ "$TARGET_DIR" != "/" ]; then
  TARGET_DIR="${TARGET_DIR%/}"
fi

LINK_PATH="$TARGET_DIR/slop-skill"

if [ ! -d "$SKILL_SRC" ]; then
  echo "Error: Skill source directory not found at '$SKILL_SRC'." >&2
  exit 1
fi

resolve_dir() {
  (cd -P "$1" 2>/dev/null && pwd -P) || return 1
}

if [ -e "$LINK_PATH" ] || [ -L "$LINK_PATH" ]; then
  if [ -L "$LINK_PATH" ]; then
    CURRENT_TARGET="$(readlink "$LINK_PATH")"
    RESOLVED_CUR=""
    RESOLVED_SRC=""
    if RESOLVED_CUR="$(resolve_dir "$LINK_PATH")" && RESOLVED_SRC="$(resolve_dir "$SKILL_SRC")"; then
      :
    fi
    if [ "$CURRENT_TARGET" = "$SKILL_SRC" ] || { [ -n "$RESOLVED_CUR" ] && [ "$RESOLVED_CUR" = "$RESOLVED_SRC" ]; }; then
      echo "Already installed: $LINK_PATH -> $SKILL_SRC"
      exit 0
    fi
  fi

  if [ "$FORCE" = false ]; then
    echo "Error: '$LINK_PATH' already exists and does not point to '$SKILL_SRC'." >&2
    echo "Inspect or back up the existing path before replacing it, or re-run with --force." >&2
    exit 1
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "[dry-run] Would remove existing path: $LINK_PATH"
  else
    rm -rf "$LINK_PATH"
  fi
fi

if [ "$DRY_RUN" = true ]; then
  echo "[dry-run] Would ensure directory exists: $TARGET_DIR"
  echo "[dry-run] Would create symlink: $LINK_PATH -> $SKILL_SRC"
  exit 0
fi

mkdir -p "$TARGET_DIR"
ln -s "$SKILL_SRC" "$LINK_PATH"

echo "Installed slop-skill:"
echo "  $LINK_PATH -> $SKILL_SRC"
echo ""
echo "To uninstall, remove the symlink:"
echo "  rm \"$LINK_PATH\""
