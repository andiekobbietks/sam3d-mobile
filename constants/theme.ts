/**
 * React Native Reusables Theme Configuration
 * Mirrors CSS variables from global.css
 */

import { Platform } from "react-native";

export const COLORS = {
  light: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(222.2 84% 4.9%)",
    card: "hsl(0 0% 100%)",
    "card-foreground": "hsl(222.2 84% 4.9%)",
    popover: "hsl(0 0% 100%)",
    "popover-foreground": "hsl(222.2 84% 4.9%)",
    muted: "hsl(210 40% 96%)",
    "muted-foreground": "hsl(215.4 16.3% 46.9%)",
    accent: "hsl(210 40% 96%)",
    "accent-foreground": "hsl(221.2 83.2% 53.3%)",
    destructive: "hsl(0 84.2% 60.2%)",
    "destructive-foreground": "hsl(210 40% 98%)",
    border: "hsl(214.3 31.8% 91.4%)",
    input: "hsl(214.3 31.8% 91.4%)",
    primary: "hsl(221.2 83.2% 53.3%)",
    "primary-foreground": "hsl(210 40% 98%)",
    secondary: "hsl(217.2 32.6% 17.5%)",
    "secondary-foreground": "hsl(210 40% 98%)",
    ring: "hsl(221.2 83.2% 53.3%)",
  },
  dark: {
    background: "hsl(222.2 84% 4.9%)",
    foreground: "hsl(210 40% 98%)",
    card: "hsl(222.2 84% 4.9%)",
    "card-foreground": "hsl(210 40% 98%)",
    popover: "hsl(222.2 84% 4.9%)",
    "popover-foreground": "hsl(210 40% 98%)",
    muted: "hsl(217.2 32.6% 17.5%)",
    "muted-foreground": "hsl(215.4 16.3% 46.9%)",
    accent: "hsl(217.2 32.6% 17.5%)",
    "accent-foreground": "hsl(210 40% 98%)",
    destructive: "hsl(0 84.2% 60.2%)",
    "destructive-foreground": "hsl(210 40% 98%)",
    border: "hsl(217.2 32.6% 17.5%)",
    input: "hsl(217.2 32.6% 17.5%)",
    primary: "hsl(210 40% 98%)",
    "primary-foreground": "hsl(221.2 83.2% 53.3%)",
    secondary: "hsl(217.2 32.6% 17.5%)",
    "secondary-foreground": "hsl(210 40% 98%)",
    ring: "hsl(212.7 26.8% 83.9%)",
  },
};

export const THEME = {
  light: COLORS.light,
  dark: COLORS.dark,
};

export const NAV_THEME = {
  light: {
    background: "#ffffff",
    border: "#e5e7eb",
    card: "#ffffff",
    notification: "#ef4444",
    primary: "#3b82f6",
    secondary: "#1e293b",
    text: "#0f172a",
    tint: "#3b82f6",
    fonts: {
      regular: { fontFamily: "System" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "bold" },
      heavy: { fontFamily: "System", fontWeight: "900" },
    },
  },
  dark: {
    background: "#0f172a",
    border: "#1e293b",
    card: "#1e293b",
    notification: "#ef4444",
    primary: "#f8fafc",
    secondary: "#64748b",
    text: "#f8fafc",
    tint: "#3b82f6",
    fonts: {
      regular: { fontFamily: "System" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "bold" },
      heavy: { fontFamily: "System", fontWeight: "900" },
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "'Menlo', 'Courier New', monospace",
  },
});
