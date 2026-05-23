const DEFAULT_TAG_BACKGROUND = '#dce7dc';
const DEFAULT_TAG_TEXT = '#2a313c';
const TAG_FALLBACK_PALETTE = ['#678c4f', '#1d4ed8', '#c2410c', '#7c3aed', '#0f766e', '#b45309'];

function hashTagName(value) {
  const normalizedValue = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (!normalizedValue) {
    return 0;
  }

  let hash = 0;

  for (let index = 0; index < normalizedValue.length; index += 1) {
    hash = (hash * 31 + normalizedValue.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function getFallbackTagColor(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return DEFAULT_TAG_BACKGROUND;
  }

  return TAG_FALLBACK_PALETTE[hashTagName(name) % TAG_FALLBACK_PALETTE.length];
}

function normalizeHexColor(value, fallback = DEFAULT_TAG_BACKGROUND) {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmedValue = value.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(trimmedValue) || /^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  return fallback;
}

function hexToRgb(hexColor) {
  const normalizedHex = hexColor.replace('#', '');

  if (normalizedHex.length === 3) {
    const expandedHex = normalizedHex
      .split('')
      .map((character) => character + character)
      .join('');

    return hexToRgb(`#${expandedHex}`);
  }

  if (normalizedHex.length !== 6) {
    return null;
  }

  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return null;
  }

  return { red, green, blue };
}

function getReadableTextColor(hexColor) {
  const rgb = hexToRgb(hexColor);

  if (!rgb) {
    return DEFAULT_TAG_TEXT;
  }

  const luminance = (0.2126 * rgb.red + 0.7152 * rgb.green + 0.0722 * rgb.blue) / 255;

  return luminance > 0.62 ? '#182233' : '#ffffff';
}

export function getTagStyle(color, fallbackBackground = DEFAULT_TAG_BACKGROUND) {
  const backgroundColor = normalizeHexColor(color, fallbackBackground);

  return {
    '--tag-bg': backgroundColor,
    '--tag-text': getReadableTextColor(backgroundColor),
  };
}

export function normalizeTag(tag, index = 0) {
  if (typeof tag === 'string') {
    return {
      id: `${tag}-${index}`,
      name: tag,
      color: getFallbackTagColor(tag),
    };
  }

  if (tag && typeof tag === 'object') {
    const name = tag.name || tag.label || '';

    return {
      id: tag.id ?? `${tag.name || tag.label || 'tag'}-${index}`,
      name,
      color: tag.color || getFallbackTagColor(name),
    };
  }

  return {
    id: `tag-${index}`,
    name: '',
    color: DEFAULT_TAG_BACKGROUND,
  };
}
