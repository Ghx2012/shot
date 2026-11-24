// 根据登录设备所在时区/语言推断国家或地区代码（不依赖外部 IP 库，局域网环境同样可用）
const TZ_COUNTRY = {
  'Asia/Shanghai': 'CN', 'Asia/Chongqing': 'CN', 'Asia/Urumqi': 'CN', 'Asia/Harbin': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Macau': 'MO', 'Asia/Taipei': 'TW',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Yangon': 'MM', 'Asia/Phnom_Penh': 'KH', 'Asia/Vientiane': 'LA', 'Asia/Colombo': 'LK',
  'Asia/Kathmandu': 'NP', 'Asia/Dhaka': 'BD', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Tehran': 'IR',
  'Asia/Jerusalem': 'IL', 'Asia/Istanbul': 'TR', 'Asia/Almaty': 'KZ', 'Asia/Tashkent': 'UZ',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT', 'Europe/Zurich': 'CH', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Athens': 'GR', 'Europe/Lisbon': 'PT',
  'Europe/Moscow': 'RU', 'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA', 'Europe/Belgrade': 'RS',
  'Europe/Bratislava': 'SK', 'Europe/Ljubljana': 'SI', 'Europe/Zagreb': 'HR', 'Europe/Sofia': 'BG',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US',
  'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA',
  'America/Mexico_City': 'MX', 'America/Sao_Paulo': 'BR', 'America/Argentina/Buenos_Aires': 'AR',
  'America/Santiago': 'CL', 'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Caracas': 'VE',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU',
  'Pacific/Auckland': 'NZ', 'Africa/Cairo': 'EG', 'Africa/Johannesburg': 'ZA', 'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE', 'Africa/Casablanca': 'MA', 'Atlantic/Reykjavik': 'IS',
};

const PREFIX_COUNTRY = [
  ['America/Argentina/', 'AR'], ['America/Indiana/', 'US'], ['America/Kentucky/', 'US'],
  ['America/North_Dakota/', 'US'], ['Australia/', 'AU'], ['Pacific/', 'NZ'], ['Africa/', 'ZA'],
  ['Europe/', 'EU'], ['Asia/', 'AS'], ['America/', 'US'],
];

export function resolveCountry(timezone, language) {
  const tz = String(timezone || '').trim();
  if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
  for (const [prefix, code] of PREFIX_COUNTRY) {
    if (tz.startsWith(prefix)) return code;
  }
  // 时区不可用时退回浏览器语言里的地区，例如 zh-CN / en-US
  const match = /[-_]([A-Za-z]{2})$/.exec(String(language || '').trim());
  if (match) return match[1].toUpperCase();
  return 'UN';
}
