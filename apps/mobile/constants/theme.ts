import { Platform, type ViewStyle } from 'react-native';

// HerStop brand palette — monochrome with soft pink accent
const accent = '#7c5556';
const accentDark = '#C9A5A6';

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#FAFAFA',
    card: '#FFFFFF',
    tint: accent,
    tintLight: '#f5c2e7',
    icon: '#6E6E73',
    tabIconDefault: '#AEAEB2',
    tabIconSelected: accent,
    surface: '#F2F2F7',
    surfaceAlt: '#EEEEF0',
    border: '#EDEDF0',
    secondaryText: '#8A8A8E',
  },
  dark: {
    text: '#F2F2F7',
    background: '#000000',
    card: '#1C1C1E',
    tint: accentDark,
    tintLight: '#3D2829',
    icon: '#8E8E93',
    tabIconDefault: '#636366',
    tabIconSelected: accentDark,
    surface: '#1C1C1E',
    surfaceAlt: '#2C2C2E',
    border: '#38383A',
    secondaryText: '#8E8E93',
  },
};

// Typography — tight tracking, premium hierarchy
export const Typography = {
  display:  { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.8, lineHeight: 40 },
  title:    { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.6, lineHeight: 32 },
  heading:  { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.4, lineHeight: 25 },
  subhead:  { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2, lineHeight: 22 },
  body:     { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.2, lineHeight: 22 },
  bodyMed:  { fontSize: 15, fontWeight: '500' as const, letterSpacing: -0.2, lineHeight: 22 },
  caption:  { fontSize: 13, fontWeight: '400' as const, letterSpacing: -0.1, lineHeight: 18 },
  small:    { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.2,  lineHeight: 14 },
  label:    { fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.3,  lineHeight: 16 },
};

// Spacing scale (4-pt grid)
export const Spacing = {
  xs:  4,
  sm:  8,
  smd: 12,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
  screen: 20,
};

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

// Elevation shadows — set both iOS + Android properties; each platform ignores the other's
const shadow = (offset: number, opacity: number, radius: number, elevation: number): ViewStyle => ({
  shadowColor: '#000',
  shadowOffset: { width: 0, height: offset },
  shadowOpacity: opacity,
  shadowRadius: radius,
  elevation,
});

export const Shadows = {
  sm: shadow(1, 0.04, 3, 1),
  md: shadow(2, 0.08, 8, 3),
  lg: shadow(4, 0.12, 16, 6),
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
