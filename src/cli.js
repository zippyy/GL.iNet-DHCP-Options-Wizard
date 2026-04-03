#!/usr/bin/env node

import readline from "node:readline/promises";
import process, { stdin as input, stdout as output } from "node:process";
import { pathToFileURL } from "node:url";

const PRESET_OPTIONS = [
  {
    key: "dns",
    label: "DNS servers",
    code: 6,
    description: "Advertise one or more DNS server IP addresses",
    build: async (rl) => {
      const addresses = await promptIpv4List(
        rl,
        "DNS server IPv4 addresses (comma-separated)"
      );
      return { code: 6, label: "DNS servers", value: addresses.join(",") };
    },
  },
  {
    key: "router",
    label: "Default gateway",
    code: 3,
    description: "Advertise the default router/gateway",
    build: async (rl) => {
      const address = await promptIpv4(rl, "Gateway IPv4 address");
      return { code: 3, label: "Default gateway", value: address };
    },
  },
  {
    key: "domain",
    label: "Domain name",
    code: 15,
    description: "Advertise the local DNS search domain",
    build: async (rl) => {
      const value = await promptWithValidation(
        rl,
        "Domain name",
        isDomainLike,
        "Enter a valid domain-style value, such as example.lan."
      );
      return { code: 15, label: "Domain name", value };
    },
  },
  {
    key: "ntp",
    label: "NTP servers",
    code: 42,
    description: "Advertise one or more NTP server IP addresses",
    build: async (rl) => {
      const addresses = await promptIpv4List(
        rl,
        "NTP server IPv4 addresses (comma-separated)"
      );
      return { code: 42, label: "NTP servers", value: addresses.join(",") };
    },
  },
  {
    key: "tftp",
    label: "TFTP server name",
    code: 66,
    description: "Advertise a TFTP server host or address",
    build: async (rl) => {
      const value = await promptNonEmpty(rl, "TFTP server name or IP");
      return { code: 66, label: "TFTP server name", value };
    },
  },
  {
    key: "bootfile",
    label: "Bootfile name",
    code: 67,
    description: "Advertise a PXE or provisioning boot filename",
    build: async (rl) => {
      const value = await promptNonEmpty(rl, "Bootfile name");
      return { code: 67, label: "Bootfile name", value };
    },
  },
  {
    key: "wpad",
    label: "WPAD URL",
    code: 252,
    description: "Advertise a Web Proxy Auto-Discovery URL",
    build: async (rl) => {
      const value = await promptWithValidation(
        rl,
        "WPAD URL",
        isLikelyUrl,
        "Enter a valid absolute URL, such as http://proxy.lan/wpad.dat."
      );
      return { code: 252, label: "WPAD URL", value };
    },
  },
];

export async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    printBanner();

    const sectionName = await promptWithDefault(
      rl,
      "DHCP section name",
      "lan"
    );
    const clearExisting = await promptYesNo(
      rl,
      "Clear existing dhcp_option entries before applying new ones?",
      true
    );

    const options = [];

    while (true) {
      printMenu(options);
      const choice = await promptMenuChoice(
        rl,
        "Choose an option to add",
        PRESET_OPTIONS.length + 2
      );

      if (choice === PRESET_OPTIONS.length + 1) {
        options.push(await buildCustomOption(rl));
        continue;
      }

      if (choice === PRESET_OPTIONS.length + 2) {
        break;
      }

      const preset = PRESET_OPTIONS[choice - 1];
      options.push(await preset.build(rl));
      output.write(
        `Added DHCP option ${preset.code} (${preset.label}).\n\n`
      );
    }

    if (options.length === 0) {
      output.write("No DHCP options were added. Exiting.\n");
      return;
    }

    const generated = buildOutput(sectionName, options, clearExisting);

    output.write("\nSummary\n");
    output.write(`${"-".repeat(7)}\n`);
    output.write(`DHCP section: ${sectionName}\n`);
    output.write(`Options added: ${options.length}\n`);
    output.write(`Reset existing list: ${clearExisting ? "yes" : "no"}\n\n`);

    output.write("UCI commands\n");
    output.write(`${"-".repeat(12)}\n`);
    output.write(`${generated.uci}\n\n`);

    output.write("/etc/config/dhcp snippet\n");
    output.write(`${"-".repeat(24)}\n`);
    output.write(`${generated.config}\n\n`);

    output.write("Notes\n");
    output.write(`${"-".repeat(5)}\n`);
    output.write(
      "Review custom option values carefully. The wizard generates commands and config text but does not connect to the router.\n"
    );
  } finally {
    rl.close();
  }
}

function printBanner() {
  output.write("GL.iNet DHCP Options Wizard\n");
  output.write("===========================\n");
  output.write(
    "Build OpenWrt/GL.iNet-ready DHCP option entries for /etc/config/dhcp and uci.\n\n"
  );
}

function printMenu(currentOptions) {
  output.write("Available DHCP options\n");
  output.write("----------------------\n");

  PRESET_OPTIONS.forEach((option, index) => {
    output.write(
      `${index + 1}. ${option.label} (code ${option.code}) - ${option.description}\n`
    );
  });

  output.write(
    `${PRESET_OPTIONS.length + 1}. Custom option - Enter any DHCP option code and raw value\n`
  );
  output.write(`${PRESET_OPTIONS.length + 2}. Finish\n`);

  if (currentOptions.length > 0) {
    output.write("\nCurrent selections\n");
    output.write("------------------\n");
    currentOptions.forEach((option, index) => {
      output.write(
        `${index + 1}. code ${option.code} (${option.label}) => ${option.value}\n`
      );
    });
  }

  output.write("\n");
}

async function buildCustomOption(rl) {
  const codeText = await promptWithValidation(
    rl,
    "Custom DHCP option code",
    (value) => isIntegerInRange(value, 1, 254),
    "Enter an integer between 1 and 254."
  );
  const value = await promptNonEmpty(
    rl,
    "Custom DHCP option value (exact dnsmasq/OpenWrt payload)"
  );
  const label = await promptWithDefault(rl, "Label for this custom entry", "Custom");

  return {
    code: Number(codeText),
    label,
    value,
  };
}

export function buildOutput(sectionName, options, clearExisting) {
  const uciLines = [];

  if (clearExisting) {
    uciLines.push(`uci -q delete dhcp.${sectionName}.dhcp_option`);
  }

  for (const option of options) {
    uciLines.push(
      `uci add_list dhcp.${sectionName}.dhcp_option='${escapeSingleQuotes(
        `${option.code},${option.value}`
      )}'`
    );
  }

  uciLines.push("uci commit dhcp");
  uciLines.push("/etc/init.d/dnsmasq restart");

  const configLines = [`config dhcp '${sectionName}'`];
  for (const option of options) {
    configLines.push(`\tlist dhcp_option '${option.code},${option.value}'`);
  }

  return {
    uci: uciLines.join("\n"),
    config: configLines.join("\n"),
  };
}

async function promptMenuChoice(rl, label, maxValue) {
  const value = await promptWithValidation(
    rl,
    `${label} [1-${maxValue}]`,
    (entry) => isIntegerInRange(entry, 1, maxValue),
    `Enter a number between 1 and ${maxValue}.`
  );
  return Number(value);
}

async function promptIpv4(rl, label) {
  return promptWithValidation(
    rl,
    label,
    isIpv4,
    "Enter a valid IPv4 address, such as 192.168.8.1."
  );
}

async function promptIpv4List(rl, label) {
  const raw = await promptWithValidation(
    rl,
    label,
    (value) => {
      const values = splitCommaList(value);
      return values.length > 0 && values.every(isIpv4);
    },
    "Enter one or more comma-separated IPv4 addresses."
  );
  return splitCommaList(raw);
}

async function promptNonEmpty(rl, label) {
  return promptWithValidation(
    rl,
    label,
    (value) => value.trim().length > 0,
    "A value is required."
  );
}

async function promptWithDefault(rl, label, defaultValue) {
  const answer = await rl.question(`${label} [${defaultValue}]: `);
  const trimmed = answer.trim();
  return trimmed === "" ? defaultValue : trimmed;
}

async function promptYesNo(rl, label, defaultValue) {
  const defaultLabel = defaultValue ? "Y/n" : "y/N";
  while (true) {
    const answer = (await rl.question(`${label} [${defaultLabel}]: `))
      .trim()
      .toLowerCase();

    if (answer === "") {
      return defaultValue;
    }

    if (["y", "yes"].includes(answer)) {
      return true;
    }

    if (["n", "no"].includes(answer)) {
      return false;
    }

    output.write("Enter y or n.\n");
  }
}

async function promptWithValidation(rl, label, validate, errorMessage) {
  while (true) {
    const answer = (await rl.question(`${label}: `)).trim();
    if (validate(answer)) {
      return answer;
    }
    output.write(`${errorMessage}\n`);
  }
}

function splitCommaList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isIntegerInRange(value, min, max) {
  if (!/^\d+$/.test(value)) {
    return false;
  }
  const numeric = Number(value);
  return numeric >= min && numeric <= max;
}

export function isIpv4(value) {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const numeric = Number(part);
    return numeric >= 0 && numeric <= 255;
  });
}

function isDomainLike(value) {
  return /^(?=.{1,253}$)(?!-)[A-Za-z0-9.-]+(?<!-)$/.test(value);
}

function isLikelyUrl(value) {
  try {
    const parsed = new URL(value);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function escapeSingleQuotes(value) {
  return value.replace(/'/g, `'\\''`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Wizard failed:", error.message);
    process.exitCode = 1;
  });
}
