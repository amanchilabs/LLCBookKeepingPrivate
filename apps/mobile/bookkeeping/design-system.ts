export const designTokens = {
  color: {
    canvas: '#F7F5F0',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F3EF',
    navy: '#14243B',
    muted: '#526174',
    emerald: '#087A55',
    emeraldDark: '#07583F',
    emeraldTint: '#E7F3EC',
    sage: '#DCE9DF',
    border: '#D9E0DC',
    error: '#B42318',
    warning: '#8A5A00',
    info: '#285D8F',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { control: 12, card: 16, pill: 999 },
  type: { caption: 13, label: 14, body: 16, section: 20, title: 30 },
} as const;

export function minimumTouchTarget(platform: string): number {
  return platform === 'ios' ? 44 : 48;
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(parseHexColor(foreground));
  const backgroundLuminance = relativeLuminance(parseHexColor(background));
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseHexColor(color: string): [number, number, number] {
  const normalized = color.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) throw new Error(`Expected a six-digit hex color, received ${color}.`);
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const linear = [red, green, blue].map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
