# GL.iNet DHCP Options Wizard

Interactive CLI wizard for building DHCP option entries that can be applied on GL.iNet routers running OpenWrt.

The tool does not connect to your router. It collects inputs, validates common DHCP option payloads, and generates:

- `uci` commands you can paste into an SSH session on the router
- a `/etc/config/dhcp` snippet you can apply manually

## Requirements

- Node.js 22 or newer

## Run

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
