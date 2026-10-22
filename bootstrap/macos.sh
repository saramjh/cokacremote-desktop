#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
ACTION="${1:---probe}"
COMPONENT="${2:-}"
APPROVAL="${3:-}"
REPO="$HOME/MCPWorkspace/cokacremote"
UPSTREAM="https://github.com/kstost/cokacremote.git"

have(){
  case "$1" in
    node) command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 ;;
    git) command -v git >/dev/null 2>&1 ;;
    cloudflared) command -v cloudflared >/dev/null 2>&1 ;;
    cokacremote) [[ -s "$REPO/package.json" && -s "$REPO/dist/src/server.js" ]] ;;
    *) return 1 ;;
  esac
}
json_bool(){ if "$@";then printf true;else printf false;fi; }
have_brew(){ command -v brew >/dev/null 2>&1; }
if [[ "$ACTION" == "--probe" ]];then
  printf '{"platform":"darwin","arch":"%s","packageManager":%s,"components":[' "$(uname -m)" "$(json_bool have_brew)"
  first=true
  for item in node git cloudflared cokacremote;do
    if [[ "$first" == true ]];then first=false;else printf ',';fi
    printf '{"name":"%s","installed":%s}' "$item" "$(json_bool have "$item")"
  done
  printf '],"mode":"read-only inspection"}\n'
  exit 0
fi
[[ "$ACTION" == "--install" ]] || { echo "Unknown operation; use --probe or --install" >&2;exit 2; }
case "$COMPONENT" in node|git|cloudflared|cokacremote);;*) echo "Unsupported component" >&2;exit 2;;esac
[[ "$APPROVAL" == "--approved" ]] || { echo "Not installed: explicit user approval is required" >&2;exit 2; }
if have "$COMPONENT";then printf '{"result":"REUSED","component":"%s"}\n' "$COMPONENT";exit 0;fi
if [[ "$COMPONENT" != cokacremote ]];then
  command -v brew >/dev/null 2>&1 || {
    echo 'Homebrew is not installed. Install and review it manually from https://brew.sh and restart the manager.' >&2;exit 3;
  }
  echo "Installing the user-approved Homebrew formula: $COMPONENT" >&2
  brew install "$COMPONENT"
  have "$COMPONENT" || { echo "Package installed but command not visible; restart the manager and re-probe" >&2;exit 4; }
  printf '{"result":"INSTALLED","component":"%s","requiresReprobe":true}\n' "$COMPONENT"
  exit 0
fi
have git && have node || { echo 'Git, Node.js and npm are required first' >&2;exit 4; }
[[ ! -e "$REPO" ]] || { echo 'Existing cokacremote folder must be reviewed before installation; will not overwrite' >&2;exit 5; }
mkdir -p "$(dirname "$REPO")"
git clone --depth 1 "$UPSTREAM" "$REPO"
(
 cd "$REPO"
 npm ci --no-audit --no-fund
 npm run build
)
have cokacremote || { echo 'Upstream installation did not pass build verification' >&2;exit 6; }
printf '{"result":"INSTALLED","component":"cokacremote","requiresReprobe":true}\n'
