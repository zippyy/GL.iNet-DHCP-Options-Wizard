include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-gli-dhcp-options
LUCI_TITLE:=LuCI GL.iNet DHCP Options Wizard
LUCI_DEPENDS:=+luci-base +dnsmasq
LUCI_PKGARCH:=all
PKG_LICENSE:=MIT

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot entrypoint
