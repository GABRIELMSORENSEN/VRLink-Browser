const TRACKER_RULES = [
  /(^|\.)doubleclick\.net$/i,
  /(^|\.)googlesyndication\.com$/i,
  /(^|\.)google-analytics\.com$/i,
  /(^|\.)googletagmanager\.com$/i,
  /(^|\.)facebook\.net$/i,
  /(^|\.)connect\.facebook\.net$/i,
  /(^|\.)scorecardresearch\.com$/i,
  /(^|\.)taboola\.com$/i,
  /(^|\.)outbrain\.com$/i,
  /(^|\.)criteo\.com$/i,
  /(^|\.)adsrvr\.org$/i,
  /(^|\.)hotjar\.com$/i
];

const DIRECT_MEDIA = /\.(mp4|webm|mov|m4v|ogv|m3u8)(?:$|[?#])/i;

function hostFrom(value) {
  try { return new URL(value).hostname; } catch { return ''; }
}

function shouldBlock(value) {
  const host = hostFrom(value);
  return TRACKER_RULES.some((rule) => rule.test(host));
}

function directMediaUrl(value) {
  if (!value || !/^https?:\/\//i.test(value)) return false;
  return DIRECT_MEDIA.test(value);
}

module.exports = { shouldBlock, directMediaUrl, hostFrom };
