# GL.iNet DHCP Options Wizard

LuCI plugin and companion CLI tools for building DHCP option entries on GL.iNet routers running OpenWrt.

The LuCI app writes directly to `/etc/config/dhcp` through UCI. The companion CLI tools remain available for shell-driven workflows and generate:

- `uci` commands you can paste into an SSH session on the router
- a `/etc/config/dhcp` snippet you can apply manually

## LuCI Plugin

This branch now includes an OpenWrt/LuCI package scaffold:

- `Makefile`
- `htdocs/luci-static/resources/view/dhcp-options-wizard.js`
- `root/usr/share/luci/menu.d/luci-app-gli-dhcp-options.json`
- `root/usr/share/rpcd/acl.d/luci-app-gli-dhcp-options.json`

The web UI appears under `Network -> DHCP Options Wizard` and edits `list dhcp_option` values for each `config dhcp` section.

To build it inside an OpenWrt buildroot, place this repository in your package feed and compile `luci-app-gli-dhcp-options`.

For direct router install on this branch:

```sh
wget -O- https://raw.githubusercontent.com/zippyy/GL.iNet-DHCP-Options-Wizard/feature/luci-plugin/install-luci.sh | sh
```

That installer places the LuCI view, menu entry, and ACL files directly on the router, then restarts `rpcd` and `uhttpd`.

## Router CLI Install

```bash
wget -O- https://raw.githubusercontent.com/zippyy/GL.iNet-DHCP-Options-Wizard/main/install.sh | sh
```

Then run:

```bash
glinet-dhcp-wizard
```

This installs the POSIX shell version directly on a GL.iNet/OpenWrt router at `/usr/bin/glinet-dhcp-wizard`.

## Workstation Install

If you want to run the Node.js version on a laptop or desktop:

```bash
npm install -g git+https://github.com/zippyy/GL.iNet-DHCP-Options-Wizard.git
```

Then run:

```bash
glinet-dhcp-wizard
```

## Development Run

Requirements:

- Node.js 22 or newer

Run:

```bash
npm start
```

You can also run the CLI entrypoint directly:

```bash
node ./src/cli.js
```

## Supported guided options

- DHCP option `3`: default gateway
- DHCP option `6`: DNS servers
- DHCP option `15`: domain name
- DHCP option `42`: NTP servers
- DHCP option `66`: TFTP server name
- DHCP option `67`: bootfile name
- DHCP option `252`: WPAD URL
- Custom option mode for any other DHCP code/value pair

## Example output

```text
uci -q delete dhcp.lan.dhcp_option
uci add_list dhcp.lan.dhcp_option='6,1.1.1.1,8.8.8.8'
uci add_list dhcp.lan.dhcp_option='42,192.168.8.1'
uci commit dhcp
/etc/init.d/dnsmasq restart
```

## Notes

- On GL.iNet/OpenWrt, these entries map to `list dhcp_option` in `/etc/config/dhcp`.
- Some DHCP options expect specific encoding or payload formats. For those, use the custom option path and provide the exact raw value expected by `dnsmasq`.
- The router install uses the `glinet-dhcp-wizard.sh` shell implementation. The Node CLI in `src/cli.js` remains available for workstation use.
