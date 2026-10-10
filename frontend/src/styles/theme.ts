export const THEMES = [
  { id: 'blue', name: '블루', color: '#2563eb', rgb: '37 99 235', hover: '#1d4ed8', soft: '#eff6ff', border: '#93c5fd' },
  { id: 'teal', name: '틸', color: '#0d9488', rgb: '13 148 136', hover: '#0f766e', soft: '#f0fdfa', border: '#5eead4' },
  { id: 'violet', name: '바이올렛', color: '#7c3aed', rgb: '124 58 237', hover: '#6d28d9', soft: '#f5f3ff', border: '#c4b5fd' },
  { id: 'rose', name: '로즈', color: '#e11d48', rgb: '225 29 72', hover: '#be123c', soft: '#fff1f2', border: '#fda4af' },
  { id: 'orange', name: '오렌지', color: '#ea580c', rgb: '234 88 12', hover: '#c2410c', soft: '#fff7ed', border: '#fdba74' },
] as const;

export type CustomThemeColor = `#${string}`;
export type ThemeId = typeof THEMES[number]['id'] | CustomThemeColor;

export const PIN_COLORS = [
  { id: 'orange', name: '오렌지', color: '#f97316' },
  { id: 'red', name: '레드', color: '#dc2626' },
  { id: 'magenta', name: '마젠타', color: '#c026d3' },
  { id: 'green', name: '그린', color: '#15803d' },
  { id: 'black', name: '블랙', color: '#171717' },
] as const;

export type CustomPinColor = `#${string}`;
export type PinColorId = typeof PIN_COLORS[number]['id'] | CustomPinColor;

const THEME_STORAGE_KEY = 'whateat_theme';
const CUSTOM_THEME_STORAGE_KEY = 'whateat_custom_theme_color';
const PIN_COLOR_STORAGE_KEY = 'whateat_pin_color';
const CUSTOM_PIN_COLOR_STORAGE_KEY = 'whateat_custom_pin_color';
const DEFAULT_THEME: ThemeId = 'blue';
const DEFAULT_CUSTOM_THEME: CustomThemeColor = '#2563eb';
const DEFAULT_PIN_COLOR: PinColorId = 'orange';
const DEFAULT_CUSTOM_PIN_COLOR: CustomPinColor = '#f97316';

export function getSavedTheme(): ThemeId {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && isCustomTheme(saved)) return saved;
    return THEMES.find((theme) => theme.id === saved)?.id ?? DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function isCustomTheme(value: string): value is CustomThemeColor {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function getSavedCustomThemeColor(): CustomThemeColor {
  try {
    const saved = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    return saved && isCustomTheme(saved) ? saved : DEFAULT_CUSTOM_THEME;
  } catch {
    return DEFAULT_CUSTOM_THEME;
  }
}

function getRgb(color: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

function mixColor(color: string, target: number, ratio: number): string {
  return '#' + getRgb(color)
    .map((channel) => Math.round(channel + (target - channel) * ratio).toString(16).padStart(2, '0'))
    .join('');
}

function getLuminance(color: string): number {
  const channels = getRgb(color).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getContrast(first: string, second: string): number {
  const firstLuminance = getLuminance(first);
  const secondLuminance = getLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function createCustomTheme(color: CustomThemeColor) {
  const soft = mixColor(color, 255, 0.92);
  let hover = mixColor(color, 0, 0.18);

  for (let step = 0; step < 30 && getContrast(hover, soft) < 4.5; step += 1) {
    hover = mixColor(hover, 0, 0.1);
  }

  return {
    color,
    rgb: getRgb(color).join(' '),
    hover,
    soft,
    border: mixColor(color, 255, 0.55),
  };
}

export function applyTheme(themeId: ThemeId): void {
  const custom = isCustomTheme(themeId);
  const theme = custom
    ? createCustomTheme(themeId)
    : THEMES.find((item) => item.id === themeId) ?? THEMES[0];
  const onAccent = custom && getContrast(theme.color, '#171717') > getContrast(theme.color, '#ffffff')
    ? '#171717'
    : '#ffffff';
  const properties = {
    '--color-accent': theme.color,
    '--color-accent-rgb': theme.rgb,
    '--color-accent-hover': theme.hover,
    '--color-accent-soft': theme.soft,
    '--color-accent-border': theme.border,
    '--color-on-accent': onAccent,
  };

  for (const [property, value] of Object.entries(properties)) {
    document.documentElement.style.setProperty(property, value);
  }
}

export function saveTheme(themeId: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
    if (isCustomTheme(themeId)) {
      window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, themeId);
    }
  } catch {}
}

export function getSavedPinColor(): PinColorId {
  try {
    const saved = window.localStorage.getItem(PIN_COLOR_STORAGE_KEY);
    if (saved && isCustomPinColor(saved)) return saved;
    return PIN_COLORS.find((pin) => pin.id === saved)?.id ?? DEFAULT_PIN_COLOR;
  } catch {
    return DEFAULT_PIN_COLOR;
  }
}

export function isCustomPinColor(value: string): value is CustomPinColor {
  return isCustomTheme(value);
}

export function getSavedCustomPinColor(): CustomPinColor {
  try {
    const saved = window.localStorage.getItem(CUSTOM_PIN_COLOR_STORAGE_KEY);
    return saved && isCustomPinColor(saved) ? saved : DEFAULT_CUSTOM_PIN_COLOR;
  } catch {
    return DEFAULT_CUSTOM_PIN_COLOR;
  }
}

export function applyPinColor(pinColorId: PinColorId): void {
  const color = isCustomPinColor(pinColorId)
    ? pinColorId
    : (PIN_COLORS.find((item) => item.id === pinColorId) ?? PIN_COLORS[0]).color;
  document.documentElement.style.setProperty('--color-restaurant-pin', color);
}

export function savePinColor(pinColorId: PinColorId): void {
  try {
    window.localStorage.setItem(PIN_COLOR_STORAGE_KEY, pinColorId);
    if (isCustomPinColor(pinColorId)) {
      window.localStorage.setItem(CUSTOM_PIN_COLOR_STORAGE_KEY, pinColorId);
    }
  } catch {}
}
