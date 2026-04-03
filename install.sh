#!/bin/sh

set -eu

REPO_URL="https://raw.githubusercontent.com/zippyy/GL.iNet-DHCP-Options-Wizard/main/glinet-dhcp-wizard.sh"
INSTALL_PATH="/usr/bin/glinet-dhcp-wizard"

echo "Installing GL.iNet DHCP Options Wizard to $INSTALL_PATH"

if command -v wget >/dev/null 2>&1; then
  wget -O "$INSTALL_PATH" "$REPO_URL"
elif command -v curl >/dev/null 2>&1; then
  curl -fsSL "$REPO_URL" -o "$INSTALL_PATH"
else
  echo "wget or curl is required to install this tool."
  exit 1
fi

chmod +x "$INSTALL_PATH"

echo
echo "Installed. Run:"
echo "glinet-dhcp-wizard"
