'use strict';
'require view';
'require form';
'require uci';

var optionDescriptions = {
	dns_servers: _('One or more DNS servers advertised as DHCP option 6.'),
	default_gateway: _('Default gateway advertised as DHCP option 3.'),
	domain_name: _('Search domain advertised as DHCP option 15.'),
	ntp_servers: _('One or more NTP servers advertised as DHCP option 42.'),
	tftp_server: _('TFTP host or address advertised as DHCP option 66.'),
	bootfile_name: _('Boot file name advertised as DHCP option 67.'),
	wpad_url: _('WPAD URL advertised as DHCP option 252.'),
	custom_options: _('Raw code,value entries passed directly to dnsmasq/OpenWrt.')
};

function normalizeList(value) {
	if (Array.isArray(value))
		return value.filter(function(entry) { return entry != null && String(entry).trim() !== ''; }).map(String);

	if (value == null || value === '')
		return [];

	return [ String(value) ];
}

function splitCsv(value) {
	return String(value || '')
		.split(',')
		.map(function(entry) { return entry.trim(); })
		.filter(function(entry) { return entry !== ''; });
}

function parseDhcpOptions(sectionId) {
	var parsed = {
		dns_servers: [],
		default_gateway: '',
		domain_name: '',
		ntp_servers: [],
		tftp_server: '',
		bootfile_name: '',
		wpad_url: '',
		custom_options: []
	};

	normalizeList(uci.get('dhcp', sectionId, 'dhcp_option')).forEach(function(entry) {
		var idx = entry.indexOf(',');
		var code, payload;

		if (idx <= 0) {
			parsed.custom_options.push(entry);
			return;
		}

		code = entry.substring(0, idx).trim();
		payload = entry.substring(idx + 1).trim();

		switch (code) {
		case '3':
			if (parsed.default_gateway === '')
				parsed.default_gateway = payload;
			else
				parsed.custom_options.push(entry);
			break;

		case '6':
			parsed.dns_servers = parsed.dns_servers.concat(splitCsv(payload));
			break;

		case '15':
			if (parsed.domain_name === '')
				parsed.domain_name = payload;
			else
				parsed.custom_options.push(entry);
			break;

		case '42':
			parsed.ntp_servers = parsed.ntp_servers.concat(splitCsv(payload));
			break;

		case '66':
			if (parsed.tftp_server === '')
				parsed.tftp_server = payload;
			else
				parsed.custom_options.push(entry);
			break;

		case '67':
			if (parsed.bootfile_name === '')
				parsed.bootfile_name = payload;
			else
				parsed.custom_options.push(entry);
			break;

		case '252':
			if (parsed.wpad_url === '')
				parsed.wpad_url = payload;
			else
				parsed.custom_options.push(entry);
			break;

		default:
			parsed.custom_options.push(entry);
		}
	});

	return parsed;
}

function findOptionInstance(map, sectionId, optionName) {
	var matches = map.lookupOption(optionName, sectionId);
	return matches && matches.length ? matches[0] : null;
}

function getFormValue(map, sectionId, optionName) {
	var option = findOptionInstance(map, sectionId, optionName);
	return option ? option.formvalue(sectionId) : null;
}

function normalizeFormList(value, fallback) {
	if (Array.isArray(value))
		return value.map(function(entry) { return String(entry).trim(); }).filter(Boolean);

	if (value == null)
		return fallback;

	if (typeof(value) === 'string')
		return splitCsv(value);

	return fallback;
}

function normalizeRawOptionList(value, fallback) {
	if (Array.isArray(value))
		return value.map(function(entry) { return String(entry).trim(); }).filter(Boolean);

	if (value == null)
		return fallback;

	if (typeof(value) === 'string') {
		value = value.trim();
		return value !== '' ? [ value ] : [];
	}

	return fallback;
}

function normalizeFormString(value, fallback) {
	if (value == null)
		return fallback;

	return String(value).trim();
}

function rebuildDhcpOptionList(map, sectionId) {
	var existing = parseDhcpOptions(sectionId);
	var dns = normalizeFormList(getFormValue(map, sectionId, 'dns_servers'), existing.dns_servers);
	var gateway = normalizeFormString(getFormValue(map, sectionId, 'default_gateway'), existing.default_gateway);
	var domain = normalizeFormString(getFormValue(map, sectionId, 'domain_name'), existing.domain_name);
	var ntp = normalizeFormList(getFormValue(map, sectionId, 'ntp_servers'), existing.ntp_servers);
	var tftp = normalizeFormString(getFormValue(map, sectionId, 'tftp_server'), existing.tftp_server);
	var bootfile = normalizeFormString(getFormValue(map, sectionId, 'bootfile_name'), existing.bootfile_name);
	var wpad = normalizeFormString(getFormValue(map, sectionId, 'wpad_url'), existing.wpad_url);
	var custom = normalizeRawOptionList(getFormValue(map, sectionId, 'custom_options'), existing.custom_options);
	var list = [];

	if (dns.length)
		list.push('6,' + dns.join(','));

	if (gateway !== '')
		list.push('3,' + gateway);

	if (domain !== '')
		list.push('15,' + domain);

	if (ntp.length)
		list.push('42,' + ntp.join(','));

	if (tftp !== '')
		list.push('66,' + tftp);

	if (bootfile !== '')
		list.push('67,' + bootfile);

	if (wpad !== '')
		list.push('252,' + wpad);

	custom.forEach(function(entry) {
		if (entry !== '')
			list.push(entry);
	});

	if (list.length)
		uci.set('dhcp', sectionId, 'dhcp_option', list);
	else
		uci.unset('dhcp', sectionId, 'dhcp_option');
}

function bindSyntheticOption(option, key) {
	option.uciconfig = 'dhcp';
	option.ucisection = function(sectionId) { return sectionId; };
	option.ucioption = key;
	option.cfgvalue = function(sectionId) {
		return parseDhcpOptions(sectionId)[key];
	};
	option.write = function(sectionId) {
		rebuildDhcpOptionList(this.map, sectionId);
	};
	option.remove = function(sectionId) {
		rebuildDhcpOptionList(this.map, sectionId);
	};
}

function getSectionSummary(sectionId) {
	var details = [];
	var parsed = parseDhcpOptions(sectionId);

	if (parsed.dns_servers.length)
		details.push(_('DNS: %s').format(parsed.dns_servers.join(', ')));

	if (parsed.default_gateway !== '')
		details.push(_('Gateway: %s').format(parsed.default_gateway));

	if (parsed.domain_name !== '')
		details.push(_('Domain: %s').format(parsed.domain_name));

	if (parsed.ntp_servers.length)
		details.push(_('NTP: %s').format(parsed.ntp_servers.join(', ')));

	if (parsed.tftp_server !== '')
		details.push(_('TFTP: %s').format(parsed.tftp_server));

	if (parsed.bootfile_name !== '')
		details.push(_('Bootfile: %s').format(parsed.bootfile_name));

	if (parsed.wpad_url !== '')
		details.push(_('WPAD configured'));

	if (parsed.custom_options.length)
		details.push(_('%d custom option(s)').format(parsed.custom_options.length));

	return details.length ? details.join(' | ') : _('No DHCP options configured yet for this section.');
}

function renderIntro(sections) {
	var cards = [
		E('div', { 'class': 'wizard-stat-card' }, [
			E('span', { 'class': 'wizard-stat-label' }, _('DHCP sections')),
			E('strong', { 'class': 'wizard-stat-value' }, String(sections.length))
		]),
		E('div', { 'class': 'wizard-stat-card' }, [
			E('span', { 'class': 'wizard-stat-label' }, _('Common presets')),
			E('strong', { 'class': 'wizard-stat-value' }, '7')
		]),
		E('div', { 'class': 'wizard-stat-card' }, [
			E('span', { 'class': 'wizard-stat-label' }, _('Advanced mode')),
			E('strong', { 'class': 'wizard-stat-value' }, _('Raw dhcp_option'))
		])
	];

	return E('div', { 'class': 'wizard-shell' }, [
		E('style', {}, [
			'.wizard-shell{margin-bottom:24px;padding:24px;border-radius:18px;background:linear-gradient(135deg,#103a5d 0%,#0f6a8c 52%,#7fd3c7 100%);color:#fff;box-shadow:0 14px 36px rgba(16,58,93,.18)}',
			'.wizard-eyebrow{display:inline-block;margin-bottom:10px;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,.14);font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}',
			'.wizard-shell h2{margin:0 0 8px;font-size:28px;line-height:1.1;color:#fff}',
			'.wizard-shell p{max-width:820px;margin:0;color:rgba(255,255,255,.92);font-size:14px;line-height:1.6}',
			'.wizard-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:20px}',
			'.wizard-stat-card{padding:14px 16px;border-radius:14px;background:rgba(255,255,255,.12);backdrop-filter:blur(4px)}',
			'.wizard-stat-label{display:block;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:rgba(255,255,255,.78)}',
			'.wizard-stat-value{font-size:18px;color:#fff}',
			'.wizard-section-note{margin:0 0 14px;padding:12px 14px;border-radius:12px;background:#f3fbfc;border:1px solid #d0edf0;color:#24566a;line-height:1.5}',
			'.wizard-tip-list{margin:14px 0 0;padding-left:18px;color:rgba(255,255,255,.92)}',
			'.wizard-tip-list li{margin:4px 0}'
		]),
		E('span', { 'class': 'wizard-eyebrow' }, _('GL.iNet / OpenWrt')),
		E('h2', {}, _('DHCP Options Wizard')),
		E('p', {}, _('Shape common DHCP options without hand-editing list dhcp_option lines. Each section below maps friendly fields back into the OpenWrt dhcp config you already use.')),
		E('ul', { 'class': 'wizard-tip-list' }, [
			E('li', {}, _('Use Common Options for the standard DHCP fields most clients expect.')),
			E('li', {}, _('Use Advanced for vendor-specific or binary-style code,value entries.')),
			E('li', {}, _('Saving this page updates /etc/config/dhcp and keeps unknown raw options intact.'))
		]),
		E('div', { 'class': 'wizard-stat-grid' }, cards)
	]);
}

return view.extend({
	load: function() {
		return uci.load('dhcp');
	},

	render: function() {
		var m, sections;

		m = new form.Map('dhcp', _('DHCP Options Wizard'),
			_('Configure common GL.iNet/OpenWrt DHCP options with a web form. Changes are written back to each DHCP section as list dhcp_option entries.'));

		m.render = function() {
			return Promise.resolve(form.Map.prototype.render.apply(this, arguments)).then(function(node) {
				return E([], [
					renderIntro(sections),
					node
				]);
			});
		};

		sections = uci.sections('dhcp', 'dhcp');

		if (!sections.length) {
			var empty = m.section(form.TypedSection, 'dhcp', _('No DHCP sections found'));
			empty.render = function() {
				return E('div', { 'class': 'cbi-section' }, [
					E('p', _('No config dhcp sections were found in /etc/config/dhcp.'))
				]);
			};

			return m.render();
		}

		sections.forEach(function(cfg) {
			var s, o, summary;

			s = m.section(form.NamedSection, cfg['.name'], 'dhcp', _('Section: %s').format(cfg['.name']));
			s.anonymous = true;
			s.addremove = false;
			s.tab('common', _('Common Options'));
			s.tab('advanced', _('Advanced'));
			s.tab('about', _('Overview'));

			o = s.taboption('about', form.DummyValue, '_summary', _('Section summary'));
			o.rawhtml = true;
			o.cfgvalue = function() {
				summary = getSectionSummary(cfg['.name']);
				return '<div class="wizard-section-note">' + summary + '</div>';
			};

			o = s.taboption('about', form.DummyValue, '_network', _('Current section'));
			o.rawhtml = true;
			o.cfgvalue = function() {
				var interfaceName = cfg.interface || _('not set');
				var range = cfg.start && cfg.limit ? '%s + %s leases'.format(cfg.start, cfg.limit) : _('range not set');
				return '<div class="wizard-section-note"><strong>' + _('Interface') + ':</strong> ' + String(interfaceName) + '<br /><strong>' + _('Lease range') + ':</strong> ' + String(range) + '</div>';
			};

			o = s.taboption('common', form.DynamicList, 'dns_servers', _('DNS servers'));
			o.datatype = 'ip4addr';
			o.placeholder = '1.1.1.1';
			o.description = optionDescriptions.dns_servers;
			bindSyntheticOption(o, 'dns_servers');

			o = s.taboption('common', form.Value, 'default_gateway', _('Default gateway'));
			o.datatype = 'ip4addr';
			o.placeholder = '192.168.8.1';
			o.description = optionDescriptions.default_gateway;
			bindSyntheticOption(o, 'default_gateway');

			o = s.taboption('common', form.Value, 'domain_name', _('Domain name'));
			o.placeholder = 'example.lan';
			o.description = optionDescriptions.domain_name;
			bindSyntheticOption(o, 'domain_name');

			o = s.taboption('common', form.DynamicList, 'ntp_servers', _('NTP servers'));
			o.datatype = 'ip4addr';
			o.placeholder = '192.168.8.1';
			o.description = optionDescriptions.ntp_servers;
			bindSyntheticOption(o, 'ntp_servers');

			o = s.taboption('common', form.Value, 'tftp_server', _('TFTP server name'));
			o.placeholder = '192.168.8.10';
			o.description = optionDescriptions.tftp_server;
			bindSyntheticOption(o, 'tftp_server');

			o = s.taboption('common', form.Value, 'bootfile_name', _('Bootfile name'));
			o.placeholder = 'pxelinux.0';
			o.description = optionDescriptions.bootfile_name;
			bindSyntheticOption(o, 'bootfile_name');

			o = s.taboption('common', form.Value, 'wpad_url', _('WPAD URL'));
			o.placeholder = 'http://proxy.lan/wpad.dat';
			o.description = optionDescriptions.wpad_url;
			o.validate = function(sectionId, value) {
				if (!value)
					return true;

				return /^(https?:\/\/)[^\s]+$/i.test(value) || _('Enter a full http:// or https:// URL.');
			};
			bindSyntheticOption(o, 'wpad_url');

			o = s.taboption('advanced', form.DynamicList, 'custom_options', _('Custom raw options'));
			o.placeholder = '43,01:04:de:ad:be:ef';
			o.description = optionDescriptions.custom_options;
			o.validate = function(sectionId, value) {
				if (!value)
					return true;

				return /^\d{1,3},.+$/.test(value) || _('Use code,value format such as 43,01:04:de:ad:be:ef.');
			};
			bindSyntheticOption(o, 'custom_options');
		});

		return m.render();
	}
});
