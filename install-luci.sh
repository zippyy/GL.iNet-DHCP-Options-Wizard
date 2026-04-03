#!/bin/sh

set -eu

BASE_URL="https://raw.githubusercontent.com/zippyy/GL.iNet-DHCP-Options-Wizard/feature/luci-plugin"
VIEW_PATH="/www/luci-static/resources/view/dhcp-options-wizard.js"
MENU_PATH="/usr/share/luci/menu.d/luci-app-gli-dhcp-options.json"
ACL_PATH="/usr/share/rpcd/acl.d/luci-app-gli-dhcp-options.json"

fetch_to() {
	url="$1"
	path="$2"

	if command -v wget >/dev/null 2>&1; then
		wget -O "$path" "$url"
	elif command -v curl >/dev/null 2>&1; then
		curl -fsSL "$url" -o "$path"
	else
		echo "wget or curl is required to install this LuCI app."
		exit 1
	fi
}

echo "Installing LuCI DHCP Options Wizard"
echo

mkdir -p "$(dirname "$VIEW_PATH")"
mkdir -p "$(dirname "$MENU_PATH")"
mkdir -p "$(dirname "$ACL_PATH")"

fetch_to "$BASE_URL/htdocs/luci-static/resources/view/dhcp-options-wizard.js" "$VIEW_PATH"
fetch_to "$BASE_URL/root/usr/share/luci/menu.d/luci-app-gli-dhcp-options.json" "$MENU_PATH"
fetch_to "$BASE_URL/root/usr/share/rpcd/acl.d/luci-app-gli-dhcp-options.json" "$ACL_PATH"

chmod 0644 "$VIEW_PATH" "$MENU_PATH" "$ACL_PATH"

/etc/init.d/rpcd restart >/dev/null 2>&1 || true
/etc/init.d/uhttpd restart >/dev/null 2>&1 || true

echo "Installed."
echo "Open LuCI and go to Network -> DHCP Options Wizard."
