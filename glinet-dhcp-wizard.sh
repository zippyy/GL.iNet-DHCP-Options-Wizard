#!/bin/sh

set -u

print_banner() {
  echo "GL.iNet DHCP Options Wizard"
  echo "==========================="
  echo "Build OpenWrt/GL.iNet DHCP option entries for /etc/config/dhcp and uci."
  echo
}

prompt_default() {
  label="$1"
  default_value="$2"
  printf "%s [%s]: " "$label" "$default_value"
  read answer
  if [ -z "$answer" ]; then
    echo "$default_value"
  else
    echo "$answer"
  fi
}

prompt_yes_no() {
  label="$1"
  default_value="$2"

  if [ "$default_value" = "y" ]; then
    prompt_suffix="Y/n"
  else
    prompt_suffix="y/N"
  fi

  while true; do
    printf "%s [%s]: " "$label" "$prompt_suffix"
    read answer
    answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

    if [ -z "$answer" ]; then
      echo "$default_value"
      return
    fi

    case "$answer" in
      y|yes)
        echo "y"
        return
        ;;
      n|no)
        echo "n"
        return
        ;;
      *)
        echo "Enter y or n."
        ;;
    esac
  done
}

is_ipv4() {
  value="$1"
  OLD_IFS="$IFS"
  IFS=.
  set -- $value
  IFS="$OLD_IFS"

  [ $# -eq 4 ] || return 1

  for octet in "$1" "$2" "$3" "$4"; do
    case "$octet" in
      ''|*[!0-9]*)
        return 1
        ;;
    esac
    [ "$octet" -ge 0 ] 2>/dev/null || return 1
    [ "$octet" -le 255 ] 2>/dev/null || return 1
  done

  return 0
}

prompt_ipv4() {
  label="$1"
  while true; do
    printf "%s: " "$label"
    read answer
    if is_ipv4 "$answer"; then
      echo "$answer"
      return
    fi
    echo "Enter a valid IPv4 address, such as 192.168.8.1."
  done
}

prompt_non_empty() {
  label="$1"
  while true; do
    printf "%s: " "$label"
    read answer
    if [ -n "$answer" ]; then
      echo "$answer"
      return
    fi
    echo "A value is required."
  done
}

prompt_ipv4_list() {
  label="$1"
  while true; do
    printf "%s: " "$label"
    read answer
    valid="y"
    OLD_IFS="$IFS"
    IFS=,
    set -- $answer
    IFS="$OLD_IFS"

    [ $# -gt 0 ] || valid="n"

    for item in "$@"; do
      trimmed=$(echo "$item" | sed 's/^ *//;s/ *$//')
      if ! is_ipv4 "$trimmed"; then
        valid="n"
        break
      fi
    done

    if [ "$valid" = "y" ]; then
      echo "$answer" | sed 's/, */,/g'
      return
    fi

    echo "Enter one or more comma-separated IPv4 addresses."
  done
}

prompt_menu_choice() {
  max_value="$1"
  while true; do
    printf "Choose an option to add [1-%s]: " "$max_value"
    read answer
    case "$answer" in
      ''|*[!0-9]*)
        echo "Enter a number between 1 and $max_value."
        ;;
      *)
        if [ "$answer" -ge 1 ] && [ "$answer" -le "$max_value" ]; then
          echo "$answer"
          return
        fi
        echo "Enter a number between 1 and $max_value."
        ;;
    esac
  done
}

print_menu() {
  echo "Available DHCP options"
  echo "----------------------"
  echo "1. DNS servers (code 6) - Advertise one or more DNS server IP addresses"
  echo "2. Default gateway (code 3) - Advertise the default router/gateway"
  echo "3. Domain name (code 15) - Advertise the local DNS search domain"
  echo "4. NTP servers (code 42) - Advertise one or more NTP server IP addresses"
  echo "5. TFTP server name (code 66) - Advertise a TFTP server host or address"
  echo "6. Bootfile name (code 67) - Advertise a PXE or provisioning boot filename"
  echo "7. WPAD URL (code 252) - Advertise a Web Proxy Auto-Discovery URL"
  echo "8. Custom option - Enter any DHCP option code and raw value"
  echo "9. Finish"
  echo
}

add_option() {
  code="$1"
  label="$2"
  value="$3"

  if [ -n "${OPTIONS:-}" ]; then
    OPTIONS="${OPTIONS}
$code|$label|$value"
  else
    OPTIONS="$code|$label|$value"
  fi
}

build_custom_option() {
  while true; do
    printf "Custom DHCP option code: "
    read code
    case "$code" in
      ''|*[!0-9]*)
        echo "Enter an integer between 1 and 254."
        ;;
      *)
        if [ "$code" -ge 1 ] && [ "$code" -le 254 ]; then
          break
        fi
        echo "Enter an integer between 1 and 254."
        ;;
    esac
  done

  value=$(prompt_non_empty "Custom DHCP option value (exact dnsmasq/OpenWrt payload)")
  label=$(prompt_default "Label for this custom entry" "Custom")
  add_option "$code" "$label" "$value"
}

print_summary() {
  section_name="$1"
  clear_existing="$2"

  option_count=$(printf "%s\n" "$OPTIONS" | grep -c .)

  echo
  echo "Summary"
  echo "-------"
  echo "DHCP section: $section_name"
  echo "Options added: $option_count"
  if [ "$clear_existing" = "y" ]; then
    echo "Reset existing list: yes"
  else
    echo "Reset existing list: no"
  fi
  echo
  echo "UCI commands"
  echo "------------"

  if [ "$clear_existing" = "y" ]; then
    echo "uci -q delete dhcp.$section_name.dhcp_option"
  fi

  printf "%s\n" "$OPTIONS" | while IFS='|' read -r code label value; do
    [ -n "$code" ] || continue
    echo "uci add_list dhcp.$section_name.dhcp_option='$code,$value'"
  done

  echo "uci commit dhcp"
  echo "/etc/init.d/dnsmasq restart"
  echo
  echo "/etc/config/dhcp snippet"
  echo "------------------------"
  echo "config dhcp '$section_name'"
  printf "%s\n" "$OPTIONS" | while IFS='|' read -r code label value; do
    [ -n "$code" ] || continue
    printf "\tlist dhcp_option '%s,%s'\n" "$code" "$value"
  done
}

main() {
  OPTIONS=""

  print_banner
  SECTION_NAME=$(prompt_default "DHCP section name" "lan")
  CLEAR_EXISTING=$(prompt_yes_no "Clear existing dhcp_option entries before applying new ones?" "y")

  while true; do
    print_menu
    choice=$(prompt_menu_choice 9)

    case "$choice" in
      1)
        value=$(prompt_ipv4_list "DNS server IPv4 addresses (comma-separated)")
        add_option "6" "DNS servers" "$value"
        echo "Added DHCP option 6 (DNS servers)."
        echo
        ;;
      2)
        value=$(prompt_ipv4 "Gateway IPv4 address")
        add_option "3" "Default gateway" "$value"
        echo "Added DHCP option 3 (Default gateway)."
        echo
        ;;
      3)
        value=$(prompt_non_empty "Domain name")
        add_option "15" "Domain name" "$value"
        echo "Added DHCP option 15 (Domain name)."
        echo
        ;;
      4)
        value=$(prompt_ipv4_list "NTP server IPv4 addresses (comma-separated)")
        add_option "42" "NTP servers" "$value"
        echo "Added DHCP option 42 (NTP servers)."
        echo
        ;;
      5)
        value=$(prompt_non_empty "TFTP server name or IP")
        add_option "66" "TFTP server name" "$value"
        echo "Added DHCP option 66 (TFTP server name)."
        echo
        ;;
      6)
        value=$(prompt_non_empty "Bootfile name")
        add_option "67" "Bootfile name" "$value"
        echo "Added DHCP option 67 (Bootfile name)."
        echo
        ;;
      7)
        value=$(prompt_non_empty "WPAD URL")
        add_option "252" "WPAD URL" "$value"
        echo "Added DHCP option 252 (WPAD URL)."
        echo
        ;;
      8)
        build_custom_option
        echo "Added custom DHCP option."
        echo
        ;;
      9)
        break
        ;;
    esac
  done

  if [ -z "$OPTIONS" ]; then
    echo "No DHCP options were added. Exiting."
    exit 0
  fi

  print_summary "$SECTION_NAME" "$CLEAR_EXISTING"
}

main "$@"
