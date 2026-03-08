import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";

type Shape =
  | "circle"
  | "square"
  | "rounded-square"
  | "hexagon"
  | "diamond"
  | "triangle"
  | "shield"
  | "star"
  | "blob";

type StylePreset =
  | "minimal"
  | "flat"
  | "gradient"
  | "neon"
  | "glass"
  | "retro"
  | "pixel"
  | "outlined"
  | "solid"
  | "shadowed"
  | "three-d";

type PatternPreset = "none" | "grid" | "dots" | "diagonal" | "waves" | "checker" | "noise";
type Mode = "monogram" | "icon" | "combo" | "image";
type FontKey = "sans" | "serif" | "mono" | "display" | "slab" | "rounded";
type AnimationPreset = "none" | "pulse" | "spin" | "blink" | "wave";
type ImageCrop = "square" | "circle" | "rounded";
type ThemeMode = "dark" | "light";
type IconKey =
  | "code"
  | "rocket"
  | "lightning"
  | "gear"
  | "terminal"
  | "database"
  | "cloud"
  | "shield"
  | "flame"
  | "cube";

interface BuilderConfig {
  mode: Mode;
  text: string;
  primaryIcon: IconKey;
  overlayIcon: IconKey;
  badgeIcon: IconKey;
  shape: Shape;
  style: StylePreset;
  pattern: PatternPreset;
  font: FontKey;
  animation: AnimationPreset;
  baseColor: string;
  backgroundColor: string;
  accentColor: string;
  foregroundColor: string;
  borderColor: string;
  borderWidth: number;
  shadow: number;
  overlayEnabled: boolean;
  badgeEnabled: boolean;
  optimizeContrast: boolean;
  autoCrop: boolean;
  imageCrop: ImageCrop;
  removeBackground: boolean;
  removeThreshold: number;
  pixelateImage: boolean;
  imageScale: number;
}

interface GeneratedPalette {
  backgroundColor: string;
  accentColor: string;
  foregroundColor: string;
  borderColor: string;
  dark: string;
  light: string;
}

const svgCache = new Map<string, string>();
const pngCache = new Map<string, Promise<Blob>>();
const icoCache = new Map<string, Promise<Blob>>();

const sizeOptions = [16, 32, 48, 64, 128, 150, 180, 192, 256, 512] as const;
const packagePngSizes = [16, 32, 48, 64, 128, 150, 180, 192, 256, 512] as const;

const defaultConfig: BuilderConfig = {
  mode: "monogram",
  text: "FF",
  primaryIcon: "rocket",
  overlayIcon: "code",
  badgeIcon: "lightning",
  shape: "rounded-square",
  style: "gradient",
  pattern: "grid",
  font: "display",
  animation: "none",
  baseColor: "#4f46e5",
  backgroundColor: "#4f46e5",
  accentColor: "#06b6d4",
  foregroundColor: "#ffffff",
  borderColor: "#c7d2fe",
  borderWidth: 2,
  shadow: 18,
  overlayEnabled: true,
  badgeEnabled: true,
  optimizeContrast: true,
  autoCrop: true,
  imageCrop: "rounded",
  removeBackground: false,
  removeThreshold: 44,
  pixelateImage: false,
  imageScale: 90,
};

const shapeLabels: Record<Shape, string> = {
  circle: "Circle",
  square: "Square",
  "rounded-square": "Rounded square",
  hexagon: "Hexagon",
  diamond: "Diamond",
  triangle: "Triangle",
  shield: "Shield",
  star: "Star",
  blob: "Blob",
};

const styleLabels: Record<StylePreset, string> = {
  minimal: "Minimal",
  flat: "Flat",
  gradient: "Gradient",
  neon: "Neon",
  glass: "Glass",
  retro: "Retro",
  pixel: "Pixel",
  outlined: "Outlined",
  solid: "Solid",
  shadowed: "Shadowed",
  "three-d": "3D illusion",
};

const patternLabels: Record<PatternPreset, string> = {
  none: "None",
  grid: "Grid",
  dots: "Dots",
  diagonal: "Diagonal lines",
  waves: "Waves",
  checker: "Checkerboard",
  noise: "Noise",
};

const animationLabels: Record<AnimationPreset, string> = {
  none: "Static",
  pulse: "Pulse",
  spin: "Spin",
  blink: "Blink",
  wave: "Wave",
};

const fontStacks: Record<FontKey, string> = {
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "'DM Serif Display', Georgia, Cambria, 'Times New Roman', serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
  display: "'Space Grotesk', 'Avenir Next', 'Segoe UI', Inter, system-ui, sans-serif",
  slab: "'Rockwell', 'Roboto Slab', Georgia, serif",
  rounded: "'Nunito', 'Trebuchet MS', 'Avenir Next Rounded', sans-serif",
};

const fontLabels: Record<FontKey, string> = {
  sans: "Sans",
  serif: "Serif",
  mono: "Mono",
  display: "Display",
  slab: "Slab",
  rounded: "Rounded",
};

const modeLabels: Record<Mode, string> = {
  monogram: "Monogram",
  icon: "Icon",
  combo: "Combo",
  image: "Upload",
};

const cropLabels: Record<ImageCrop, string> = {
  square: "Square crop",
  circle: "Circle crop",
  rounded: "Rounded crop",
};

const iconLabels: Record<IconKey, string> = {
  code: "Code",
  rocket: "Rocket",
  lightning: "Lightning",
  gear: "Gear",
  terminal: "Terminal",
  database: "Database",
  cloud: "Cloud",
  shield: "Shield",
  flame: "Flame",
  cube: "Cube",
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeHex(hex: string) {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 3) {
    return `#${cleaned
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }
  return `#${cleaned.slice(0, 6).padEnd(6, "0")}`;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex).replace("#", "");
  const numeric = Number.parseInt(normalized, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  const r1 = r / 255;
  const g1 = g / 255;
  const b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  if (delta !== 0) {
    switch (max) {
      case r1:
        h = 60 * (((g1 - b1) / delta) % 6);
        break;
      case g1:
        h = 60 * ((b1 - r1) / delta + 2);
        break;
      default:
        h = 60 * ((r1 - g1) / delta + 4);
        break;
    }
  }

  return {
    h: (h + 360) % 360,
    s: s * 100,
    l: l * 100,
  };
}

function hslToRgb(h: number, s: number, l: number) {
  const s1 = clamp(s, 0, 100) / 100;
  const l1 = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l1 - 1)) * s1;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l1 - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function hslToHex(h: number, s: number, l: number) {
  const { r, g, b } = hslToRgb((h + 360) % 360, s, l);
  return rgbToHex(r, g, b);
}

function shiftHex(hex: string, amount: number) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + amount, g + amount, b + amount);
}

function shiftHsl(hex: string, hShift: number, sShift: number, lShift: number) {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return hslToHex(h + hShift, clamp(s + sShift, 0, 100), clamp(l + lShift, 0, 100));
}

function rgba(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const linear = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string) {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

function readableContrastColor(background: string) {
  const whiteRatio = contrastRatio("#ffffff", background);
  const darkRatio = contrastRatio("#0f172a", background);
  return whiteRatio >= darkRatio ? "#ffffff" : "#0f172a";
}

function ensureReadableForeground(background: string, preferred: string) {
  return contrastRatio(preferred, background) >= 2.8 ? preferred : readableContrastColor(background);
}

function generatePalette(baseColor: string): GeneratedPalette {
  const { r, g, b } = hexToRgb(baseColor);
  const { h, s, l } = rgbToHsl(r, g, b);

  const backgroundColor = hslToHex(h, clamp(s + 8, 42, 96), clamp(l - 10, 18, 58));
  const accentColor = hslToHex(h + 34, clamp(s + 16, 36, 100), clamp(l + 10, 34, 72));
  const light = hslToHex(h - 12, clamp(s - 24, 10, 84), clamp(l + 34, 56, 92));
  const dark = hslToHex(h + 6, clamp(s + 4, 28, 96), clamp(l - 26, 8, 32));
  const borderColor = hslToHex(h, clamp(s - 12, 14, 88), clamp(l + 24, 42, 82));
  const foregroundColor = readableContrastColor(backgroundColor);

  return {
    backgroundColor,
    accentColor,
    foregroundColor,
    borderColor,
    dark,
    light,
  };
}

function buildShapeMarkup(shape: Shape, attrs: string) {
  switch (shape) {
    case "circle":
      return `<circle cx="50" cy="50" r="40" ${attrs} />`;
    case "square":
      return `<rect x="14" y="14" width="72" height="72" ${attrs} />`;
    case "rounded-square":
      return `<rect x="12" y="12" width="76" height="76" rx="22" ${attrs} />`;
    case "hexagon":
      return `<path d="M50 10 L81 28 L81 72 L50 90 L19 72 L19 28 Z" ${attrs} />`;
    case "diamond":
      return `<path d="M50 10 L88 50 L50 90 L12 50 Z" ${attrs} />`;
    case "triangle":
      return `<path d="M50 12 L88 84 L12 84 Z" ${attrs} />`;
    case "shield":
      return `<path d="M50 10 L82 22 V48 C82 67 69 82 50 90 C31 82 18 67 18 48 V22 Z" ${attrs} />`;
    case "star":
      return `<path d="M50 10 L59 36 L87 36 L64 53 L72 81 L50 64 L28 81 L36 53 L13 36 L41 36 Z" ${attrs} />`;
    case "blob":
      return `<path d="M22 31 C24 17 37 8 51 11 C68 7 84 15 88 30 C92 43 83 54 86 68 C89 84 78 94 62 90 C48 96 30 93 19 81 C8 70 11 52 14 40 C16 35 20 36 22 31 Z" ${attrs} />`;
    default:
      return `<rect x="12" y="12" width="76" height="76" rx="22" ${attrs} />`;
  }
}

function buildImageMaskMarkup(crop: ImageCrop) {
  switch (crop) {
    case "circle":
      return `<circle cx="50" cy="50" r="31" />`;
    case "rounded":
      return `<rect x="19" y="19" width="62" height="62" rx="16" />`;
    default:
      return `<rect x="18" y="18" width="64" height="64" rx="6" />`;
  }
}

function placeContent(content: string, scale: number, x = 0, y = 0, rotate = 0) {
  return `<g transform="translate(50 50)"><g transform="translate(${x} ${y}) rotate(${rotate}) scale(${scale})"><g transform="translate(-50 -50)">${content}</g></g></g>`;
}

function renderIconMarkup(icon: IconKey, color: string) {
  const commonStroke = `stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (icon) {
    case "code":
      return `<g ${commonStroke}><path d="M37 31 L20 50 L37 69" /><path d="M63 31 L80 50 L63 69" /><path d="M56 24 L44 76" /></g>`;
    case "rocket":
      return `<g stroke="${color}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"><path d="M49 18 C63 22 76 35 80 49 C67 51 58 59 51 69 C46 76 39 82 29 85 C32 74 30 68 22 59 C29 50 36 45 43 39 C51 31 56 24 49 18 Z" fill="${color}" opacity="0.96" /><circle cx="56" cy="41" r="6" fill="white" opacity="0.9" /><path d="M36 68 L25 79" fill="none" /><path d="M48 78 L44 89" fill="none" /></g>`;
    case "lightning":
      return `<path d="M56 14 L28 53 H47 L42 86 L72 42 H53 Z" fill="${color}" />`;
    case "gear":
      return `<g ${commonStroke}><circle cx="50" cy="50" r="12" /><circle cx="50" cy="50" r="23" /><path d="M50 20 V30" /><path d="M50 70 V80" /><path d="M20 50 H30" /><path d="M70 50 H80" /><path d="M29 29 L36 36" /><path d="M64 64 L71 71" /><path d="M71 29 L64 36" /><path d="M36 64 L29 71" /></g>`;
    case "terminal":
      return `<g ${commonStroke}><rect x="20" y="27" width="60" height="46" rx="8" /><path d="M31 42 L42 50 L31 58" /><path d="M48 58 H67" /></g>`;
    case "database":
      return `<g ${commonStroke}><ellipse cx="50" cy="27" rx="24" ry="10" /><path d="M26 27 V61 C26 67 37 72 50 72 C63 72 74 67 74 61 V27" /><path d="M26 44 C26 50 37 55 50 55 C63 55 74 50 74 44" /><path d="M26 57 C26 63 37 68 50 68 C63 68 74 63 74 57" /></g>`;
    case "cloud":
      return `<path d="M31 69 H69 C77 69 83 63 83 55 C83 47 77 41 69 41 H67 C63 30 53 24 43 24 C31 24 21 34 21 46 C14 48 9 54 9 62 C9 70 15 76 23 76 H31 Z" fill="${color}" opacity="0.95" />`;
    case "shield":
      return `<g ${commonStroke}><path d="M50 16 L76 26 V47 C76 62 66 75 50 83 C34 75 24 62 24 47 V26 Z" fill="${rgba(color, 0.12)}" /><path d="M38 49 L46 57 L63 39" /></g>`;
    case "flame":
      return `<path d="M57 17 C61 29 51 34 58 45 C63 52 67 56 67 65 C67 77 59 86 48 86 C36 86 27 77 27 65 C27 50 36 43 42 35 C47 28 47 19 44 13 C51 15 55 20 57 17 Z" fill="${color}" />`;
    case "cube":
      return `<g ${commonStroke}><path d="M50 17 L74 30 V58 L50 72 L26 58 V30 Z" /><path d="M50 17 V44" /><path d="M74 30 L50 44 L26 30" /><path d="M50 44 V72" /></g>`;
    default:
      return `<g ${commonStroke}><path d="M37 31 L20 50 L37 69" /><path d="M63 31 L80 50 L63 69" /><path d="M56 24 L44 76" /></g>`;
  }
}

function resolveBackgroundFill(config: BuilderConfig) {
  switch (config.style) {
    case "solid":
    case "minimal":
    case "flat":
      return config.backgroundColor;
    case "outlined":
      return rgba(config.backgroundColor, 0.14);
    case "retro":
      return "url(#retroGradient)";
    case "three-d":
      return "url(#threeDGradient)";
    default:
      return "url(#bgGradient)";
  }
}

function renderPatternOverlay(config: BuilderConfig, color: string) {
  const opacity = config.pattern === "noise" ? 0.35 : config.pattern === "checker" ? 0.28 : 0.24;
  switch (config.pattern) {
    case "grid":
      return buildShapeMarkup(config.shape, `fill="url(#gridPattern)" opacity="${opacity}"`);
    case "dots":
      return buildShapeMarkup(config.shape, `fill="url(#dotsPattern)" opacity="${opacity}"`);
    case "diagonal":
      return buildShapeMarkup(config.shape, `fill="url(#diagonalPattern)" opacity="${opacity}"`);
    case "waves":
      return buildShapeMarkup(config.shape, `fill="url(#wavesPattern)" opacity="${opacity}"`);
    case "checker":
      return buildShapeMarkup(config.shape, `fill="url(#checkerPattern)" opacity="${opacity}"`);
    case "noise":
      return buildShapeMarkup(config.shape, `fill="url(#noisePattern)" opacity="${opacity}"`);
    default:
      return buildShapeMarkup(config.shape, `fill="${rgba(color, 0)}" opacity="0"`);
  }
}

function renderStyleOverlay(config: BuilderConfig, foregroundColor: string) {
  switch (config.style) {
    case "gradient":
      return buildShapeMarkup(config.shape, `fill="url(#shineGradient)" opacity="0.26"`);
    case "glass":
      return `<g clip-path="url(#shapeClip)"><ellipse cx="38" cy="26" rx="34" ry="20" fill="url(#glassGloss)" opacity="0.82" /><rect x="12" y="56" width="76" height="30" fill="${rgba("#ffffff", 0.06)}" /></g>${buildShapeMarkup(
        config.shape,
        `fill="none" stroke="${rgba("#ffffff", 0.28)}" stroke-width="1.5"`,
      )}`;
    case "neon":
      return `${buildShapeMarkup(config.shape, `fill="${rgba(config.accentColor, 0.08)}"`)}${buildShapeMarkup(
        config.shape,
        `fill="none" stroke="${rgba(foregroundColor, 0.24)}" stroke-width="1.6"`,
      )}`;
    case "retro":
      return `${buildShapeMarkup(config.shape, `fill="url(#shineGradient)" opacity="0.12"`)}${buildShapeMarkup(
        config.shape,
        `fill="none" stroke="${rgba(shiftHex(config.backgroundColor, 18), 0.55)}" stroke-width="2"`,
      )}`;
    case "pixel":
      return buildShapeMarkup(config.shape, `fill="url(#pixelOverlayPattern)" opacity="0.95"`);
    case "shadowed":
      return buildShapeMarkup(config.shape, `fill="url(#shineGradient)" opacity="0.16"`);
    case "three-d":
      return `<g clip-path="url(#shapeClip)">${buildShapeMarkup(config.shape, `fill="url(#threeDShadow)" opacity="0.55"`)}<path d="M16 72 C34 58 61 58 84 72 V90 H16 Z" fill="${rgba("#000000", 0.18)}" /></g>${buildShapeMarkup(
        config.shape,
        `fill="none" stroke="${rgba("#ffffff", 0.14)}" stroke-width="1.4"`,
      )}`;
    case "outlined":
      return buildShapeMarkup(config.shape, `fill="none" stroke="${rgba(foregroundColor, 0.12)}" stroke-width="1.4"`);
    default:
      return "";
  }
}

function wrapAnimated(content: string, animation: AnimationPreset) {
  switch (animation) {
    case "pulse":
      return `<g transform="translate(50 50)"><g><animateTransform attributeName="transform" type="scale" values="1;0.94;1" dur="1.8s" repeatCount="indefinite" /><g transform="translate(-50 -50)">${content}</g></g></g>`;
    case "spin":
      return `<g transform="translate(50 50)"><g><animateTransform attributeName="transform" type="rotate" values="0;360" dur="6s" repeatCount="indefinite" /><g transform="translate(-50 -50)">${content}</g></g></g>`;
    case "blink":
      return `<g><animate attributeName="opacity" values="1;1;0.35;1" dur="1.6s" repeatCount="indefinite" />${content}</g>`;
    case "wave":
      return `<g transform="translate(50 50)"><g><animateTransform attributeName="transform" type="rotate" values="-6;6;-6" dur="2.2s" repeatCount="indefinite" /><g transform="translate(-50 -50)">${content}</g></g></g>`;
    default:
      return content;
  }
}

function renderMonogram(config: BuilderConfig, foregroundColor: string) {
  const safeText = escapeXml((config.text.trim() || "FF").slice(0, 4).toUpperCase());
  const fontSize = safeText.length === 1 ? 48 : safeText.length === 2 ? 36 : safeText.length === 3 ? 28 : 22;
  const letterSpacing = safeText.length === 1 ? "0" : safeText.length === 2 ? "-1.2" : safeText.length === 3 ? "-0.8" : "-0.5";
  const strokeColor = config.style === "outlined" ? rgba(foregroundColor, 0.14) : rgba("#020617", 0.18);
  return `<text x="50" y="54" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(
    fontStacks[config.font],
  )}" font-size="${fontSize}" font-weight="800" letter-spacing="${letterSpacing}" fill="${foregroundColor}" stroke="${strokeColor}" stroke-width="${
    safeText.length > 2 ? 0.5 : 0.8
  }" paint-order="stroke">${safeText}</text>`;
}

function renderIconForeground(config: BuilderConfig, foregroundColor: string) {
  return placeContent(renderIconMarkup(config.primaryIcon, foregroundColor), 0.82, 0, 1);
}

function renderComboForeground(config: BuilderConfig, foregroundColor: string) {
  const base = placeContent(renderIconMarkup(config.primaryIcon, foregroundColor), 0.78, -4, 2);
  const overlay = config.overlayEnabled
    ? `<circle cx="72" cy="31" r="14" fill="${rgba(config.backgroundColor, 0.58)}" stroke="${rgba(config.borderColor, 0.84)}" stroke-width="1.8" />${placeContent(
        renderIconMarkup(config.overlayIcon, config.accentColor),
        0.28,
        22,
        -19,
      )}`
    : "";
  const badge = config.badgeEnabled
    ? `<circle cx="73" cy="73" r="13" fill="${config.accentColor}" stroke="${rgba(config.borderColor, 0.94)}" stroke-width="2.2" />${placeContent(
        renderIconMarkup(config.badgeIcon, readableContrastColor(config.accentColor)),
        0.22,
        23,
        23,
      )}`
    : "";

  return `${base}${overlay}${badge}`;
}

function renderImageForeground(config: BuilderConfig, uploadedImageUrl: string | null, foregroundColor: string) {
  if (!uploadedImageUrl) {
    return `${placeContent(renderIconMarkup("cube", foregroundColor), 0.7)}<text x="50" y="82" text-anchor="middle" font-size="8" font-family="${escapeXml(
      fontStacks.mono,
    )}" fill="${rgba(foregroundColor, 0.72)}">UPLOAD</text>`;
  }

  const scale = clamp(config.imageScale, 60, 100) / 100;
  const size = 64 * scale;
  const inset = (100 - size) / 2;
  const href = escapeXml(uploadedImageUrl);
  const outline = buildImageMaskMarkup(config.imageCrop).replace(
    " />",
    ` fill=\"none\" stroke=\"${rgba(foregroundColor, 0.22)}\" stroke-width=\"1.6\" />`,
  );

  return `<g clip-path="url(#imageClip)" image-rendering="${config.pixelateImage ? "pixelated" : "auto"}"><image href="${href}" x="${inset}" y="${inset}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" /></g>${outline}`;
}

function renderForeground(config: BuilderConfig, uploadedImageUrl: string | null, foregroundColor: string) {
  switch (config.mode) {
    case "monogram":
      return renderMonogram(config, foregroundColor);
    case "icon":
      return renderIconForeground(config, foregroundColor);
    case "combo":
      return renderComboForeground(config, foregroundColor);
    case "image":
      return renderImageForeground(config, uploadedImageUrl, foregroundColor);
    default:
      return renderMonogram(config, foregroundColor);
  }
}

function renderSvg(config: BuilderConfig, uploadedImageUrl: string | null) {
  const imageSignature = uploadedImageUrl ? `${uploadedImageUrl.length}:${uploadedImageUrl.slice(0, 64)}` : "no-image";
  const cacheKey = `${JSON.stringify(config)}|${imageSignature}`;
  const cached = svgCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const foregroundColor = config.optimizeContrast
    ? ensureReadableForeground(config.backgroundColor, config.foregroundColor)
    : config.foregroundColor;
  const borderColor = config.optimizeContrast ? shiftHex(foregroundColor, foregroundColor === "#ffffff" ? -62 : 62) : config.borderColor;
  const borderWidth = config.optimizeContrast ? Math.max(config.borderWidth, 2) : config.borderWidth;
  const backgroundFill = resolveBackgroundFill(config);
  const backgroundFilter =
    config.style === "neon"
      ? "url(#neonGlow)"
      : config.style === "glass"
        ? "url(#softShadow)"
        : config.style === "shadowed" || config.style === "three-d"
          ? "url(#deepShadow)"
          : "url(#baseShadow)";
  const foregroundFilter = config.style === "neon" ? "url(#foregroundGlow)" : "url(#foregroundShadow)";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" role="img" aria-label="Generated favicon" shape-rendering="${
      config.style === "pixel" ? "crispEdges" : "geometricPrecision"
    }">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${config.backgroundColor}" />
          <stop offset="100%" stop-color="${config.accentColor}" />
        </linearGradient>
        <linearGradient id="retroGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${shiftHsl(config.backgroundColor, -10, 4, 4)}" />
          <stop offset="100%" stop-color="${shiftHsl(config.accentColor, 6, 0, 10)}" />
        </linearGradient>
        <linearGradient id="threeDGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${shiftHex(config.backgroundColor, 24)}" />
          <stop offset="45%" stop-color="${config.backgroundColor}" />
          <stop offset="100%" stop-color="${shiftHex(config.accentColor, -18)}" />
        </linearGradient>
        <linearGradient id="threeDShadow" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${rgba("#ffffff", 0.12)}" />
          <stop offset="100%" stop-color="${rgba("#000000", 0.24)}" />
        </linearGradient>
        <linearGradient id="shineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${rgba("#ffffff", 0.36)}" />
          <stop offset="45%" stop-color="${rgba("#ffffff", 0.08)}" />
          <stop offset="100%" stop-color="${rgba("#ffffff", 0)}" />
        </linearGradient>
        <linearGradient id="glassGloss" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${rgba("#ffffff", 0.62)}" />
          <stop offset="100%" stop-color="${rgba("#ffffff", 0)}" />
        </linearGradient>
        <pattern id="gridPattern" width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="transparent" />
          <path d="M0 0 H10 M0 0 V10" stroke="${rgba(foregroundColor, 0.62)}" stroke-width="0.7" />
        </pattern>
        <pattern id="dotsPattern" width="10" height="10" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="${rgba(foregroundColor, 0.9)}" />
          <circle cx="8" cy="7" r="1.2" fill="${rgba(foregroundColor, 0.9)}" />
        </pattern>
        <pattern id="diagonalPattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
          <path d="M0 0 L0 12" stroke="${rgba(foregroundColor, 0.75)}" stroke-width="2" />
        </pattern>
        <pattern id="wavesPattern" width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M0 9 C3 3 6 3 9 9 C12 15 15 15 18 9" fill="none" stroke="${rgba(foregroundColor, 0.82)}" stroke-width="1.2" />
        </pattern>
        <pattern id="checkerPattern" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="${rgba(foregroundColor, 0.92)}" />
          <rect x="6" y="6" width="6" height="6" fill="${rgba(foregroundColor, 0.92)}" />
        </pattern>
        <pattern id="noisePattern" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r="0.9" fill="${rgba(foregroundColor, 0.92)}" />
          <circle cx="7" cy="11" r="0.8" fill="${rgba(foregroundColor, 0.72)}" />
          <circle cx="12" cy="5" r="1" fill="${rgba(foregroundColor, 0.88)}" />
          <circle cx="15" cy="13" r="0.9" fill="${rgba(foregroundColor, 0.7)}" />
          <circle cx="4" cy="15" r="0.7" fill="${rgba(foregroundColor, 0.8)}" />
        </pattern>
        <pattern id="pixelOverlayPattern" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="4" height="4" fill="${rgba(foregroundColor, 0.08)}" />
          <rect x="4" y="4" width="4" height="4" fill="${rgba(foregroundColor, 0.14)}" />
          <rect x="0" y="4" width="2" height="2" fill="${rgba(foregroundColor, 0.16)}" />
        </pattern>
        <clipPath id="shapeClip">${buildShapeMarkup(config.shape, "")}</clipPath>
        <clipPath id="imageClip">${buildImageMaskMarkup(config.imageCrop)}</clipPath>
        <filter id="baseShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="${Math.max(2, Math.round(config.shadow / 7))}" stdDeviation="${Math.max(2, config.shadow / 8)}" flood-color="${rgba(
            config.backgroundColor,
            0.24,
          )}" />
        </filter>
        <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="${Math.max(2, Math.round(config.shadow / 8))}" stdDeviation="${Math.max(3, config.shadow / 6)}" flood-color="${rgba(
            config.backgroundColor,
            0.28,
          )}" />
        </filter>
        <filter id="deepShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="${Math.max(4, Math.round(config.shadow / 4))}" stdDeviation="${Math.max(4, config.shadow / 5)}" flood-color="${rgba(
            config.backgroundColor,
            0.34,
          )}" />
        </filter>
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${rgba(config.accentColor, 0.65)}" />
          <feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="${rgba(config.accentColor, 0.4)}" />
        </filter>
        <filter id="foregroundGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="0" stdDeviation="2.3" flood-color="${rgba(foregroundColor, 0.78)}" />
        </filter>
        <filter id="foregroundShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="${rgba("#020617", 0.22)}" />
        </filter>
      </defs>
      <rect width="100" height="100" fill="transparent" />
      <g filter="${backgroundFilter}">${buildShapeMarkup(config.shape, `fill="${backgroundFill}"`)}</g>
      <g clip-path="url(#shapeClip)">${renderPatternOverlay(config, foregroundColor)}</g>
      <g clip-path="url(#shapeClip)">${renderStyleOverlay(config, foregroundColor)}</g>
      ${
        borderWidth > 0
          ? buildShapeMarkup(
              config.shape,
              `fill="none" stroke="${borderColor}" stroke-width="${
                config.style === "outlined" ? Math.max(borderWidth, 4) : borderWidth
              }" stroke-opacity="0.96"`,
            )
          : ""
      }
      <g filter="${foregroundFilter}">${wrapAnimated(renderForeground(config, uploadedImageUrl, foregroundColor), config.animation)}</g>
    </svg>
  `.trim();

  svgCache.set(cacheKey, svg);
  return svg;
}

async function rasterizeSvg(svg: string, size: number) {
  const key = `${size}:${svg}`;
  const cached = pngCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Canvas is not available in this browser."));
        return;
      }
      context.clearRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("PNG generation failed."));
          return;
        }
        resolve(blob);
      }, "image/png");
    };
    image.onerror = () => reject(new Error("Unable to render SVG into PNG."));
    image.src = svgToDataUrl(svg);
  });

  pngCache.set(key, pending);
  return pending;
}

async function generateIco(svg: string) {
  const key = `ico:${svg}`;
  const cached = icoCache.get(key);
  if (cached) {
    return cached;
  }

  const pending = (async () => {
    const iconSizes = [16, 32, 48, 64];
    const pngs = await Promise.all(
      iconSizes.map(async (size) => ({
        size,
        bytes: new Uint8Array(await (await rasterizeSvg(svg, size)).arrayBuffer()),
      })),
    );

    const headerSize = 6 + pngs.length * 16;
    const output = new Uint8Array(headerSize + pngs.reduce((sum, item) => sum + item.bytes.length, 0));
    const view = new DataView(output.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, pngs.length, true);

    let offset = headerSize;
    pngs.forEach((item, index) => {
      const entryOffset = 6 + index * 16;
      output[entryOffset] = item.size >= 256 ? 0 : item.size;
      output[entryOffset + 1] = item.size >= 256 ? 0 : item.size;
      output[entryOffset + 2] = 0;
      output[entryOffset + 3] = 0;
      view.setUint16(entryOffset + 4, 1, true);
      view.setUint16(entryOffset + 6, 32, true);
      view.setUint32(entryOffset + 8, item.bytes.length, true);
      view.setUint32(entryOffset + 12, offset, true);
      output.set(item.bytes, offset);
      offset += item.bytes.length;
    });

    return new Blob([output], { type: "image/x-icon" });
  })();

  icoCache.set(key, pending);
  return pending;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildManifest(name: string, backgroundColor: string) {
  return JSON.stringify(
    {
      name,
      short_name: name.slice(0, 12),
      theme_color: backgroundColor,
      background_color: "#020617",
      display: "standalone",
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "/mstile-150x150.png", sizes: "150x150", type: "image/png" },
      ],
    },
    null,
    2,
  );
}

function buildBrowserConfig(backgroundColor: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square150x150logo src="/mstile-150x150.png"/>
      <TileColor>${backgroundColor}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
}

function buildHtmlSnippet(backgroundColor: string) {
  return `<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="${backgroundColor}">`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read uploaded file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load uploaded image."));
    image.src = source;
  });
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function drawRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function averageCornerColor(data: Uint8ClampedArray, width: number, height: number) {
  const samples: Array<[number, number]> = [
    [10, 10],
    [width - 11, 10],
    [10, height - 11],
    [width - 11, height - 11],
    [Math.floor(width / 2), 10],
    [10, Math.floor(height / 2)],
  ];

  const result = samples.reduce(
    (acc, [x, y]) => {
      const index = (y * width + x) * 4;
      acc.r += data[index];
      acc.g += data[index + 1];
      acc.b += data[index + 2];
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: result.r / samples.length,
    g: result.g / samples.length,
    b: result.b / samples.length,
  };
}

async function processUploadedImage(source: string, config: BuilderConfig) {
  const image = await loadImage(source);
  const size = 512;
  const workingCanvas = document.createElement("canvas");
  workingCanvas.width = size;
  workingCanvas.height = size;
  const workingContext = workingCanvas.getContext("2d");

  if (!workingContext) {
    throw new Error("Canvas processing is not available.");
  }

  workingContext.clearRect(0, 0, size, size);

  if (config.autoCrop) {
    const sourceSize = Math.min(image.width, image.height);
    const sx = (image.width - sourceSize) / 2;
    const sy = (image.height - sourceSize) / 2;
    workingContext.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
  } else {
    const scale = Math.min(size / image.width, size / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    const dx = (size - width) / 2;
    const dy = (size - height) / 2;
    workingContext.drawImage(image, 0, 0, image.width, image.height, dx, dy, width, height);
  }

  if (config.removeBackground) {
    const imageData = workingContext.getImageData(0, 0, size, size);
    const data = imageData.data;
    const average = averageCornerColor(data, size, size);

    for (let index = 0; index < data.length; index += 4) {
      const distance = colorDistance(data[index], data[index + 1], data[index + 2], average.r, average.g, average.b);
      if (distance < config.removeThreshold) {
        const softness = distance / Math.max(1, config.removeThreshold);
        data[index + 3] = Math.round(data[index + 3] * softness * softness);
      }
    }

    workingContext.putImageData(imageData, 0, 0);
  }

  let sourceCanvas = workingCanvas;

  if (config.pixelateImage) {
    const smallCanvas = document.createElement("canvas");
    smallCanvas.width = 64;
    smallCanvas.height = 64;
    const smallContext = smallCanvas.getContext("2d");
    if (!smallContext) {
      throw new Error("Pixel pipeline unavailable.");
    }
    smallContext.imageSmoothingEnabled = false;
    smallContext.clearRect(0, 0, 64, 64);
    smallContext.drawImage(sourceCanvas, 0, 0, 64, 64);

    const upscaled = document.createElement("canvas");
    upscaled.width = size;
    upscaled.height = size;
    const upscaledContext = upscaled.getContext("2d");
    if (!upscaledContext) {
      throw new Error("Upscale pipeline unavailable.");
    }
    upscaledContext.imageSmoothingEnabled = false;
    upscaledContext.clearRect(0, 0, size, size);
    upscaledContext.drawImage(smallCanvas, 0, 0, 64, 64, 0, 0, size, size);
    sourceCanvas = upscaled;
  }

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = size;
  outputCanvas.height = size;
  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    throw new Error("Output pipeline unavailable.");
  }

  outputContext.clearRect(0, 0, size, size);
  outputContext.save();

  if (config.imageCrop === "circle") {
    outputContext.beginPath();
    outputContext.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    outputContext.closePath();
    outputContext.clip();
  } else if (config.imageCrop === "rounded") {
    drawRoundedRectPath(outputContext, size * 0.11, size * 0.11, size * 0.78, size * 0.78, size * 0.18);
    outputContext.clip();
  } else {
    drawRoundedRectPath(outputContext, size * 0.1, size * 0.1, size * 0.8, size * 0.8, size * 0.04);
    outputContext.clip();
  }

  outputContext.drawImage(sourceCanvas, 0, 0, size, size);
  outputContext.restore();

  return outputCanvas.toDataURL("image/png");
}

export function App() {
  const [config, setConfig] = useState<BuilderConfig>(defaultConfig);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem("ffb-theme");
    return stored === "light" ? "light" : "dark";
  });
  const [downloadSize, setDownloadSize] = useState<number>(512);
  const [busy, setBusy] = useState<string | null>(null);
  const [variationSeed, setVariationSeed] = useState(0);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isDark = theme === "dark";

  const ui = useMemo(
    () => ({
      shell: isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900",
      header: isDark
        ? "border-white/10 bg-slate-950/80"
        : "border-slate-200 bg-white/80",
      card: isDark
        ? "rounded-[1.75rem] border border-white/10 bg-white/5 shadow-2xl shadow-slate-950/35 backdrop-blur-xl"
        : "rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-xl shadow-slate-200/70 backdrop-blur-xl",
      panel: isDark
        ? "rounded-3xl border border-white/10 bg-slate-900/70"
        : "rounded-3xl border border-slate-200 bg-slate-50/90",
      input: isDark
        ? "w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60"
        : "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500",
      muted: isDark ? "text-slate-400" : "text-slate-500",
      text: isDark ? "text-slate-200" : "text-slate-700",
      subtle: isDark ? "text-slate-300" : "text-slate-600",
      toggleOn: isDark
        ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
        : "border-cyan-500/40 bg-cyan-50 text-cyan-700",
      toggleOff: isDark
        ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
      primary: "rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/20 transition hover:scale-[1.01]",
      secondary: isDark
        ? "rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
        : "rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100",
      chip: isDark
        ? "rounded-full border border-white/10 bg-white/5 text-slate-300"
        : "rounded-full border border-slate-200 bg-white text-slate-700",
      checker: isDark
        ? "bg-[linear-gradient(45deg,rgba(255,255,255,0.06)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.06)_75%,transparent_75%,transparent)]"
        : "bg-[linear-gradient(45deg,rgba(15,23,42,0.06)_25%,transparent_25%,transparent_50%,rgba(15,23,42,0.06)_50%,rgba(15,23,42,0.06)_75%,transparent_75%,transparent)]",
      previewBg: isDark ? "bg-slate-950" : "bg-slate-100",
      toast: isDark
        ? "border-cyan-400/25 bg-slate-900/95 text-cyan-100"
        : "border-cyan-300 bg-white/95 text-cyan-700",
    }),
    [isDark],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("ffb-theme", theme);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", theme === "dark" ? "#020617" : "#f8fafc");
  }, [theme]);

  useEffect(() => {
    if (!sourceImageUrl) {
      setProcessedImageUrl(null);
      return;
    }

    let active = true;
    setImageBusy(true);

    processUploadedImage(sourceImageUrl, config)
      .then((result) => {
        if (active) {
          setProcessedImageUrl(result);
        }
      })
      .catch(() => {
        if (active) {
          setNotice("Image processing failed. Please try another image.");
        }
      })
      .finally(() => {
        if (active) {
          setImageBusy(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    sourceImageUrl,
    config.autoCrop,
    config.imageCrop,
    config.removeBackground,
    config.removeThreshold,
    config.pixelateImage,
    config.imageScale,
  ]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timeout = window.setTimeout(() => setNotice(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const palettePreview = useMemo(() => generatePalette(config.baseColor), [config.baseColor]);

  const generated = useMemo(() => {
    const started = performance.now();
    const svg = renderSvg(config, processedImageUrl);
    return {
      svg,
      url: svgToDataUrl(svg),
      timeMs: performance.now() - started,
    };
  }, [config, processedImageUrl]);

  const previewName = useMemo(() => {
    switch (config.mode) {
      case "monogram":
        return `${config.text.trim().toUpperCase() || "FF"} favicon`;
      case "icon":
        return `${iconLabels[config.primaryIcon]} favicon`;
      case "combo":
        return `${iconLabels[config.primaryIcon]} + ${iconLabels[config.overlayIcon]} favicon`;
      case "image":
        return sourceImageUrl ? "Uploaded image favicon" : "Image favicon";
      default:
        return "Free favicon";
    }
  }, [config.mode, config.overlayIcon, config.primaryIcon, config.text, sourceImageUrl]);

  const baseFileName = useMemo(() => {
    const primary =
      config.mode === "monogram"
        ? config.text.trim().toLowerCase() || "favicon"
        : config.mode === "image"
          ? "uploaded-image"
          : config.mode === "combo"
            ? `${config.primaryIcon}-${config.overlayIcon}`
            : config.primaryIcon;
    return slugify(`${primary}-${config.shape}-${config.style}-${config.pattern}`) || "favi-forge";
  }, [config.mode, config.overlayIcon, config.pattern, config.primaryIcon, config.shape, config.style, config.text]);

  const htmlSnippet = useMemo(() => buildHtmlSnippet(config.backgroundColor), [config.backgroundColor]);

  const variations = useMemo(() => {
    const shapes: Shape[] = [config.shape, "circle", "hexagon", "blob", "shield", "diamond", "star", "rounded-square"];
    const styles: StylePreset[] = [config.style, "gradient", "glass", "neon", "pixel", "retro", "outlined", "three-d"];
    const patterns: PatternPreset[] = [config.pattern, "none", "grid", "dots", "waves", "checker", "diagonal", "noise"];
    const offsets = [-24, 12, 18, -8, 26, -14, 8, 22];

    return Array.from({ length: 8 }, (_, index) => {
      const palette = generatePalette(shiftHsl(config.baseColor, index * 12 + variationSeed * 9, 6, index % 2 === 0 ? -4 : 6));
      return {
        ...config,
        shape: shapes[(index + variationSeed) % shapes.length],
        style: styles[(index + variationSeed) % styles.length],
        pattern: patterns[(index + variationSeed) % patterns.length],
        backgroundColor: shiftHex(palette.backgroundColor, offsets[index % offsets.length]),
        accentColor: shiftHex(palette.accentColor, offsets[(index + 2) % offsets.length] * -1),
        foregroundColor: palette.foregroundColor,
        borderColor: palette.borderColor,
      } satisfies BuilderConfig;
    });
  }, [config, variationSeed]);

  useEffect(() => {
    document.title = "FaviForge";

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "FaviForge generates monogram, icon, combo, and image-based favicons with responsive previews and instant SVG, PNG, ICO, and ZIP downloads.",
    );

    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = generated.url;
  }, [generated.url]);

  const updateConfig = <K extends keyof BuilderConfig>(key: K, value: BuilderConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const applyGeneratedPalette = () => {
    const palette = generatePalette(config.baseColor);
    setConfig((current) => ({
      ...current,
      backgroundColor: palette.backgroundColor,
      accentColor: palette.accentColor,
      foregroundColor: palette.foregroundColor,
      borderColor: palette.borderColor,
    }));
    setNotice("Generated a fresh readable palette.");
  };

  const randomizeVariants = () => {
    setVariationSeed((value) => value + 1);
    const palette = generatePalette(shiftHsl(config.baseColor, 30, 8, 3));
    setConfig((current) => ({
      ...current,
      baseColor: shiftHsl(current.baseColor, 24, 8, 3),
      backgroundColor: palette.backgroundColor,
      accentColor: palette.accentColor,
      foregroundColor: palette.foregroundColor,
      borderColor: palette.borderColor,
    }));
  };

  const resetBuilder = () => {
    setConfig(defaultConfig);
    setSourceImageUrl(null);
    setProcessedImageUrl(null);
    setVariationSeed(0);
    setNotice("Builder reset to defaults.");
  };

  const applyQuickPreset = (preset: "developer" | "monogram" | "startup" | "retro") => {
    const palette =
      preset === "developer"
        ? generatePalette("#0ea5e9")
        : preset === "monogram"
          ? generatePalette("#7c3aed")
          : preset === "startup"
            ? generatePalette("#f97316")
            : generatePalette("#22c55e");

    if (preset === "developer") {
      setConfig({
        ...defaultConfig,
        mode: "icon",
        primaryIcon: "terminal",
        shape: "rounded-square",
        style: "glass",
        pattern: "grid",
        font: "mono",
        animation: "none",
        ...palette,
      });
    }

    if (preset === "monogram") {
      setConfig({
        ...defaultConfig,
        mode: "monogram",
        text: "AK",
        shape: "circle",
        style: "gradient",
        pattern: "none",
        font: "display",
        animation: "pulse",
        ...palette,
      });
    }

    if (preset === "startup") {
      setConfig({
        ...defaultConfig,
        mode: "combo",
        primaryIcon: "rocket",
        overlayIcon: "code",
        badgeIcon: "lightning",
        shape: "shield",
        style: "neon",
        pattern: "dots",
        animation: "wave",
        overlayEnabled: true,
        badgeEnabled: true,
        ...palette,
      });
    }

    if (preset === "retro") {
      setConfig({
        ...defaultConfig,
        mode: "icon",
        primaryIcon: "cube",
        shape: "diamond",
        style: "pixel",
        pattern: "checker",
        animation: "none",
        font: "mono",
        ...palette,
      });
    }

    setNotice("Applied quick preset.");
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setSourceImageUrl(dataUrl);
      setConfig((current) => ({ ...current, mode: "image" }));
      setNotice(`Loaded ${file.name} for favicon conversion.`);
    } catch {
      setNotice("Unable to load the uploaded image.");
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const handleDownloadSvg = async () => {
    setBusy("svg");
    try {
      downloadBlob(new Blob([generated.svg], { type: "image/svg+xml;charset=utf-8" }), `${baseFileName}.svg`);
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPng = async () => {
    setBusy("png");
    try {
      const png = await rasterizeSvg(generated.svg, downloadSize);
      downloadBlob(png, `${baseFileName}-${downloadSize}x${downloadSize}.png`);
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadIco = async () => {
    setBusy("ico");
    try {
      const ico = await generateIco(generated.svg);
      downloadBlob(ico, "favicon.ico");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadZip = async () => {
    setBusy("zip");
    try {
      const zip = new JSZip();
      const pngEntries = await Promise.all(
        packagePngSizes.map(async (size) => ({
          size,
          blob: await rasterizeSvg(generated.svg, size),
        })),
      );
      const pngMap = new Map(pngEntries.map((entry) => [entry.size, entry.blob]));
      const faviconIco = await generateIco(generated.svg);
      const appName = previewName.replace(/ favicon$/i, "") || "Free Favicon";

      zip.file("favicon.svg", generated.svg);
      zip.file("favicon.ico", await faviconIco.arrayBuffer());
      zip.file("favicon-16x16.png", await pngMap.get(16)!.arrayBuffer());
      zip.file("favicon-32x32.png", await pngMap.get(32)!.arrayBuffer());
      zip.file("favicon-48x48.png", await pngMap.get(48)!.arrayBuffer());
      zip.file("favicon-64x64.png", await pngMap.get(64)!.arrayBuffer());
      zip.file("favicon-128x128.png", await pngMap.get(128)!.arrayBuffer());
      zip.file("favicon-256x256.png", await pngMap.get(256)!.arrayBuffer());
      zip.file("apple-touch-icon.png", await pngMap.get(180)!.arrayBuffer());
      zip.file("android-chrome-192x192.png", await pngMap.get(192)!.arrayBuffer());
      zip.file("android-chrome-512x512.png", await pngMap.get(512)!.arrayBuffer());
      zip.file("mstile-150x150.png", await pngMap.get(150)!.arrayBuffer());
      zip.file("safari-pinned-tab.svg", generated.svg);
      zip.file("site.webmanifest", buildManifest(appName, config.backgroundColor));
      zip.file("browserconfig.xml", buildBrowserConfig(config.backgroundColor));
      zip.file("favicon-snippet.html", htmlSnippet);
      zip.file(
        "README.txt",
        `Generated with FaviForge\n\nName: ${appName}\nMode: ${modeLabels[config.mode]}\nShape: ${shapeLabels[config.shape]}\nStyle: ${styleLabels[config.style]}\nPattern: ${patternLabels[config.pattern]}\nAnimation: ${animationLabels[config.animation]}\n`,
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${baseFileName}-favicon-package.zip`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cx("min-h-screen", ui.shell)}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className={cx("absolute -left-24 top-0 h-80 w-80 rounded-full blur-3xl", isDark ? "bg-fuchsia-500/10" : "bg-fuchsia-300/20")} />
        <div className={cx("absolute right-0 top-32 h-96 w-96 rounded-full blur-3xl", isDark ? "bg-cyan-400/10" : "bg-cyan-300/25")} />
        <div className={cx("absolute bottom-0 left-1/3 h-72 w-72 rounded-full blur-3xl", isDark ? "bg-indigo-500/10" : "bg-indigo-300/20")} />
      </div>

      {notice ? (
        <div className={cx("fixed right-4 top-4 z-50 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl", ui.toast)}>
          {notice}
        </div>
      ) : null}

      <header className={cx("relative border-b backdrop-blur-xl", ui.header)}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-400 text-lg font-black text-white shadow-lg shadow-indigo-900/30">
              F
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-current sm:text-base">FaviForge</div>
              <div className={cx("truncate text-xs", ui.muted)}>Responsive favicon generator with uploads, presets, and theme switch</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => applyQuickPreset("monogram")} className={ui.secondary}>
              Quick monogram
            </button>
            <button type="button" onClick={resetBuilder} className={ui.secondary}>
              Reset
            </button>
            <div className={cx("flex items-center gap-1 rounded-2xl border p-1", ui.chip)}>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cx("rounded-xl px-3 py-2 text-sm font-medium transition", theme === "light" ? "bg-white text-slate-900 shadow-sm" : "opacity-70")}
              >
                ☀ Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cx(
                  "rounded-xl px-3 py-2 text-sm font-medium transition",
                  theme === "dark" ? (isDark ? "bg-white/10 text-white" : "bg-slate-900 text-white") : "opacity-70",
                )}
              >
                🌙 Dark
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className={cx(ui.card, "self-start p-4 sm:p-6 xl:sticky xl:top-4") }>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Builder controls</h2>
                <p className={cx("mt-1 text-sm", ui.muted)}>Cleaned up for faster editing, smaller screens, and simpler exports.</p>
              </div>
              <span className={cx("rounded-full border px-3 py-1 text-xs", ui.chip)}>{styleLabels[config.style]}</span>
            </div>

            <div className="mt-6 space-y-5">
              <section>
                <div className={cx("mb-2 text-sm font-medium", ui.text)}>Mode</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(modeLabels) as Array<[Mode, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateConfig("mode", value)}
                      className={cx("rounded-2xl border px-3 py-2 text-sm transition", config.mode === value ? ui.toggleOn : ui.toggleOff)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              {config.mode === "monogram" ? (
                <section>
                  <label htmlFor="text-input" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Monogram letters
                  </label>
                  <input
                    id="text-input"
                    value={config.text}
                    maxLength={4}
                    onChange={(event) => updateConfig("text", event.target.value.toUpperCase().slice(0, 4))}
                    className={cx(ui.input, "text-base font-semibold uppercase tracking-wide sm:text-lg")}
                    placeholder="AK"
                  />
                </section>
              ) : null}

              {(config.mode === "icon" || config.mode === "combo") && (
                <section className="space-y-3">
                  <div>
                    <label htmlFor="primary-icon" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                      Primary icon
                    </label>
                    <select
                      id="primary-icon"
                      value={config.primaryIcon}
                      onChange={(event) => updateConfig("primaryIcon", event.target.value as IconKey)}
                      className={ui.input}
                    >
                      {Object.entries(iconLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {config.mode === "combo" && (
                    <>
                      <div>
                        <label htmlFor="overlay-icon" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                          Overlay icon
                        </label>
                        <select
                          id="overlay-icon"
                          value={config.overlayIcon}
                          onChange={(event) => updateConfig("overlayIcon", event.target.value as IconKey)}
                          className={ui.input}
                        >
                          {Object.entries(iconLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="badge-icon" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                          Badge icon
                        </label>
                        <select
                          id="badge-icon"
                          value={config.badgeIcon}
                          onChange={(event) => updateConfig("badgeIcon", event.target.value as IconKey)}
                          className={ui.input}
                        >
                          {Object.entries(iconLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => updateConfig("overlayEnabled", !config.overlayEnabled)}
                          className={cx("rounded-2xl border px-3 py-2 text-sm transition", config.overlayEnabled ? ui.toggleOn : ui.toggleOff)}
                        >
                          {config.overlayEnabled ? "Overlay on" : "Overlay off"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfig("badgeEnabled", !config.badgeEnabled)}
                          className={cx("rounded-2xl border px-3 py-2 text-sm transition", config.badgeEnabled ? ui.toggleOn : ui.toggleOff)}
                        >
                          {config.badgeEnabled ? "Badge on" : "Badge off"}
                        </button>
                      </div>
                    </>
                  )}
                </section>
              )}

              {config.mode === "image" && (
                <section className={cx(ui.panel, "p-4") }>
                  <label htmlFor="image-upload" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Upload image
                  </label>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={cx(
                      "block w-full rounded-2xl border px-4 py-3 text-sm file:mr-4 file:rounded-xl file:border-0 file:px-3 file:py-2",
                      isDark
                        ? "border-white/10 bg-slate-950 text-slate-200 file:bg-cyan-400/10 file:text-cyan-100"
                        : "border-slate-200 bg-white text-slate-700 file:bg-cyan-50 file:text-cyan-700",
                    )}
                  />

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateConfig("autoCrop", !config.autoCrop)}
                      className={cx("rounded-2xl border px-3 py-2 text-sm transition", config.autoCrop ? ui.toggleOn : ui.toggleOff)}
                    >
                      {config.autoCrop ? "Auto crop on" : "Auto crop off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig("removeBackground", !config.removeBackground)}
                      className={cx("rounded-2xl border px-3 py-2 text-sm transition", config.removeBackground ? ui.toggleOn : ui.toggleOff)}
                    >
                      {config.removeBackground ? "BG cleanup on" : "BG cleanup off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateConfig("pixelateImage", !config.pixelateImage)}
                      className={cx("rounded-2xl border px-3 py-2 text-sm transition", config.pixelateImage ? ui.toggleOn : ui.toggleOff)}
                    >
                      {config.pixelateImage ? "Pixel mode on" : "Pixel mode off"}
                    </button>
                    <select
                      value={config.imageCrop}
                      onChange={(event) => updateConfig("imageCrop", event.target.value as ImageCrop)}
                      className={ui.input}
                    >
                      {Object.entries(cropLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4">
                    <div className={cx("mb-2 flex items-center justify-between text-sm font-medium", ui.text)}>
                      <span>Cleanup threshold</span>
                      <span className={ui.muted}>{config.removeThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      value={config.removeThreshold}
                      onChange={(event) => updateConfig("removeThreshold", Number(event.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>

                  <div className="mt-4">
                    <div className={cx("mb-2 flex items-center justify-between text-sm font-medium", ui.text)}>
                      <span>Image scale</span>
                      <span className={ui.muted}>{config.imageScale}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      value={config.imageScale}
                      onChange={(event) => updateConfig("imageScale", Number(event.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </section>
              )}

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <div>
                  <label htmlFor="shape-input" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Shape
                  </label>
                  <select id="shape-input" value={config.shape} onChange={(event) => updateConfig("shape", event.target.value as Shape)} className={ui.input}>
                    {Object.entries(shapeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="style-input" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Style
                  </label>
                  <select id="style-input" value={config.style} onChange={(event) => updateConfig("style", event.target.value as StylePreset)} className={ui.input}>
                    {Object.entries(styleLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pattern-input" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Pattern
                  </label>
                  <select id="pattern-input" value={config.pattern} onChange={(event) => updateConfig("pattern", event.target.value as PatternPreset)} className={ui.input}>
                    {Object.entries(patternLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="animation-input" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Animation
                  </label>
                  <select id="animation-input" value={config.animation} onChange={(event) => updateConfig("animation", event.target.value as AnimationPreset)} className={ui.input}>
                    {Object.entries(animationLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2">
                  <label htmlFor="font-input" className={cx("mb-2 block text-sm font-medium", ui.text)}>
                    Font
                  </label>
                  <select id="font-input" value={config.font} onChange={(event) => updateConfig("font", event.target.value as FontKey)} className={ui.input}>
                    {Object.entries(fontLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className={cx(ui.panel, "p-4") }>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">Automatic palette</div>
                    <div className={cx("text-xs", ui.muted)}>Create readable colors from one base color.</div>
                  </div>
                  <button type="button" onClick={applyGeneratedPalette} className={ui.secondary}>
                    Apply palette
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <input
                    type="color"
                    value={config.baseColor}
                    onChange={(event) => updateConfig("baseColor", event.target.value)}
                    className="h-12 w-14 cursor-pointer rounded-xl border border-black/10 bg-transparent"
                  />
                  <div>
                    <div className={cx("text-sm", ui.text)}>Base color</div>
                    <div className={cx("text-xs", ui.muted)}>{config.baseColor}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[
                    ["BG", palettePreview.backgroundColor],
                    ["Accent", palettePreview.accentColor],
                    ["Dark", palettePreview.dark],
                    ["Light", palettePreview.light],
                    ["Border", palettePreview.borderColor],
                  ].map(([label, color]) => (
                    <div key={label} className={cx(ui.panel, "p-2 text-center") }>
                      <div className="mx-auto h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                      <div className={cx("mt-2 text-[10px] uppercase tracking-[0.2em]", ui.muted)}>{label}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {([
                  ["backgroundColor", "Background"],
                  ["accentColor", "Accent"],
                  ["foregroundColor", "Foreground"],
                  ["borderColor", "Border"],
                ] as const).map(([key, label]) => (
                  <label key={key} className={cx(ui.panel, "block p-3") }>
                    <span className={cx("mb-2 block text-xs font-medium uppercase tracking-[0.2em]", ui.muted)}>{label}</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={config[key]}
                        onChange={(event) => updateConfig(key, event.target.value as BuilderConfig[typeof key])}
                        className="h-10 w-12 cursor-pointer rounded-xl border border-black/10 bg-transparent"
                      />
                      <span className="min-w-0 truncate text-sm">{config[key]}</span>
                    </div>
                  </label>
                ))}
              </section>

              <section>
                <div className={cx("mb-2 flex items-center justify-between text-sm font-medium", ui.text)}>
                  <span>Border width</span>
                  <span className={ui.muted}>{config.borderWidth}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={config.borderWidth}
                  onChange={(event) => updateConfig("borderWidth", Number(event.target.value))}
                  className="w-full accent-cyan-400"
                />
              </section>

              <section>
                <div className={cx("mb-2 flex items-center justify-between text-sm font-medium", ui.text)}>
                  <span>Shadow intensity</span>
                  <span className={ui.muted}>{config.shadow}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={config.shadow}
                  onChange={(event) => updateConfig("shadow", Number(event.target.value))}
                  className="w-full accent-cyan-400"
                />
              </section>

              <button
                type="button"
                onClick={() => updateConfig("optimizeContrast", !config.optimizeContrast)}
                className={cx("w-full rounded-2xl border px-4 py-3 text-sm font-medium transition", config.optimizeContrast ? ui.toggleOn : ui.toggleOff)}
              >
                {config.optimizeContrast ? "Contrast optimizer enabled" : "Enable contrast optimizer"}
              </button>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className={cx(ui.card, "p-5 sm:p-6") }>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className={cx("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm", isDark ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-100" : "border-cyan-200 bg-cyan-50 text-cyan-700")}>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Free • Programmatic • No AI
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">Generate favicons instantly</h1>
                  <p className={cx("mt-3 max-w-2xl text-base leading-7 sm:text-lg", ui.subtle)}>
                    Create responsive favicon packs with letters, icons, combo marks, or uploaded images. Export SVG, PNG, ICO, and a full ZIP in seconds.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[420px]">
                  {[
                    ["Modes", "4"],
                    ["Styles", "11"],
                    ["Sizes", "10"],
                    ["Themes", "2"],
                  ].map(([label, value]) => (
                    <div key={label} className={cx(ui.panel, "p-4 text-center") }>
                      <div className={cx("text-[11px] uppercase tracking-[0.2em]", ui.muted)}>{label}</div>
                      <div className="mt-2 text-2xl font-bold">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={randomizeVariants} className={ui.primary}>
                  Generate more variants
                </button>
                <button type="button" onClick={handleDownloadZip} disabled={busy !== null} className={ui.secondary}>
                  {busy === "zip" ? "Packaging…" : "Download full package"}
                </button>
                <button type="button" onClick={() => copyText(htmlSnippet, "Embed snippet")} className={ui.secondary}>
                  Copy embed snippet
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { title: "Developer", note: "Terminal + glass", action: () => applyQuickPreset("developer") },
                  { title: "Monogram", note: "Display + pulse", action: () => applyQuickPreset("monogram") },
                  { title: "Startup", note: "Rocket + badge", action: () => applyQuickPreset("startup") },
                  { title: "Retro", note: "Pixel + checker", action: () => applyQuickPreset("retro") },
                ].map((item) => (
                  <button key={item.title} type="button" onClick={item.action} className={cx(ui.panel, "p-4 text-left transition hover:-translate-y-0.5") }>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className={cx("mt-1 text-sm", ui.muted)}>{item.note}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className={cx(ui.card, "p-5 sm:p-6") }>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Live preview</h2>
                  <p className={cx("mt-1 text-sm", ui.muted)}>
                    Rendered in {generated.timeMs.toFixed(2)} ms {imageBusy ? "• processing upload" : "• ready"}
                  </p>
                </div>
                <div className={cx("rounded-full border px-3 py-1 text-xs", ui.chip)}>
                  Cached assets: {svgCache.size + pngCache.size + icoCache.size}
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
                <div className={cx("flex items-center justify-center rounded-[2rem] border p-6", isDark ? "border-white/10 bg-slate-900/70" : "border-slate-200 bg-slate-50")}>
                  <div className={cx("grid h-44 w-44 place-items-center rounded-[2rem] bg-[length:22px_22px]", ui.checker)} style={{ boxShadow: `0 20px 80px ${rgba(config.accentColor, 0.18)}` }}>
                    <img src={generated.url} alt={previewName} className="h-28 w-28 rounded-[1.5rem] sm:h-32 sm:w-32" />
                  </div>
                </div>

                <div className="min-w-0 space-y-4">
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {[16, 32, 64, 180, 192, 512].map((size) => (
                      <div key={size} className={cx(ui.panel, "p-3 text-center") }>
                        <div className={cx("text-[11px] uppercase tracking-[0.2em]", ui.muted)}>{size}px</div>
                        <div className={cx("mt-3 flex items-center justify-center rounded-xl p-3", isDark ? "bg-white/5" : "bg-white")}>
                          <img src={generated.url} alt={`${previewName} ${size}px preview`} style={{ width: Math.min(size, 42), height: Math.min(size, 42) }} className="rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className={cx(ui.panel, "p-4") }>
                      <div className="mb-3 text-sm font-semibold">Browser tab</div>
                      <div className={cx("rounded-2xl border p-3", isDark ? "border-white/10 bg-slate-950" : "border-slate-200 bg-white")}>
                        <div className={cx("flex items-center gap-3 rounded-xl px-3 py-2", isDark ? "border border-white/10 bg-white/5" : "border border-slate-200 bg-slate-50")}>
                          <img src={generated.url} alt="Browser tab favicon preview" className="h-4 w-4 rounded-[4px]" />
                          <div className="truncate text-sm">{previewName}</div>
                        </div>
                      </div>
                    </div>

                    <div className={cx(ui.panel, "p-4") }>
                      <div className="mb-3 text-sm font-semibold">Bookmark</div>
                      <div className={cx("rounded-2xl border p-3", isDark ? "border-white/10 bg-slate-950" : "border-slate-200 bg-white")}>
                        <div className={cx("flex items-center gap-3 rounded-xl px-3 py-2", isDark ? "bg-white/5" : "bg-slate-50")}>
                          <img src={generated.url} alt="Bookmark favicon preview" className="h-5 w-5 rounded-md" />
                          <div className="truncate text-sm">{previewName}</div>
                        </div>
                      </div>
                    </div>

                    <div className={cx(ui.panel, "p-4") }>
                      <div className="mb-3 text-sm font-semibold">Mobile home screen</div>
                      <div className={cx("flex min-h-40 items-center justify-center rounded-2xl border p-4", isDark ? "border-white/10 bg-gradient-to-br from-slate-900 to-slate-800" : "border-slate-200 bg-gradient-to-br from-white to-slate-100")}>
                        <div className={cx("rounded-[2rem] border px-6 py-4 shadow-xl", isDark ? "border-white/10 bg-slate-950/80" : "border-slate-200 bg-white")}>
                          <div className="mx-auto h-16 w-16 overflow-hidden rounded-[1.25rem] shadow-lg shadow-slate-500/20">
                            <img src={generated.url} alt="Mobile home screen preview" className="h-full w-full" />
                          </div>
                          <div className={cx("mt-3 text-center text-xs", ui.subtle)}>{previewName.replace(" favicon", "")}</div>
                        </div>
                      </div>
                    </div>

                    <div className={cx(ui.panel, "p-4") }>
                      <div className="mb-3 text-sm font-semibold">Desktop icon</div>
                      <div className={cx("flex min-h-40 items-center justify-center rounded-2xl border p-4", isDark ? "border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%),linear-gradient(180deg,#0f172a,#020617)]" : "border-slate-200 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_55%),linear-gradient(180deg,#ffffff,#f1f5f9)]")}>
                        <div className="space-y-3 text-center">
                          <div className={cx("mx-auto flex items-center justify-center rounded-[1.35rem] shadow-lg", isDark ? "bg-white/5 shadow-slate-950/40" : "bg-white shadow-slate-300/50")} style={{ width: 70, height: 70 }}>
                            <img src={generated.url} alt="Desktop icon preview" className="rounded-2xl" style={{ width: 54, height: 54 }} />
                          </div>
                          <div className={cx("text-xs", ui.subtle)}>{previewName.replace(" favicon", "")}.app</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className={cx(ui.card, "p-5 sm:p-6") }>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">Download</h2>
                    <p className={cx("mt-1 text-sm", ui.muted)}>Export a single asset or the full favicon package.</p>
                  </div>
                  <div className={cx("flex items-center gap-3 rounded-2xl border px-3 py-2", ui.panel)}>
                    <label htmlFor="download-size" className="text-sm">
                      PNG size
                    </label>
                    <select id="download-size" value={downloadSize} onChange={(event) => setDownloadSize(Number(event.target.value))} className={ui.input}>
                      {sizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}×{size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { key: "svg", label: "Download SVG", note: config.animation === "none" ? "Vector source" : "Animated SVG source", action: handleDownloadSvg },
                    { key: "png", label: "Download PNG", note: `${downloadSize}×${downloadSize} raster`, action: handleDownloadPng },
                    { key: "ico", label: "Download ICO", note: "16/32/48/64 bundled", action: handleDownloadIco },
                    { key: "zip", label: "Download ZIP", note: "Manifest + platform icons", action: handleDownloadZip },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.action}
                      disabled={busy !== null}
                      className={cx(ui.panel, "p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60")}
                    >
                      <div className="text-sm font-semibold">{busy === item.key ? "Working…" : item.label}</div>
                      <div className={cx("mt-1 text-sm", ui.muted)}>{item.note}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className={cx(ui.card, "p-5 sm:p-6") }>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">Embed snippet</h2>
                    <p className={cx("mt-1 text-sm", ui.muted)}>Copy the HTML links for your website head.</p>
                  </div>
                  <button type="button" onClick={() => copyText(htmlSnippet, "Snippet")} className={ui.secondary}>
                    Copy
                  </button>
                </div>

                <pre className={cx("mt-5 overflow-x-auto rounded-3xl border p-4 text-xs leading-6", isDark ? "border-white/10 bg-slate-950/90 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700")}>{htmlSnippet}</pre>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className={cx(ui.panel, "p-4") }>
                    <div className="text-sm font-semibold">Package includes</div>
                    <ul className={cx("mt-3 space-y-2 text-sm", ui.subtle)}>
                      <li>• favicon.ico</li>
                      <li>• favicon.svg</li>
                      <li>• PNG sizes from 16 to 512</li>
                      <li>• Apple / Android / Microsoft files</li>
                    </ul>
                  </div>
                  <div className={cx(ui.panel, "p-4") }>
                    <div className="text-sm font-semibold">Responsive features</div>
                    <ul className={cx("mt-3 space-y-2 text-sm", ui.subtle)}>
                      <li>• Mobile-friendly stacked layout</li>
                      <li>• Light and dark themes</li>
                      <li>• Quick presets for faster variants</li>
                      <li>• Real-time preview updates</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className={cx(ui.card, "p-5 sm:p-6") }>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Variant explorer</h2>
                  <p className={cx("mt-1 text-sm", ui.muted)}>Tap a variation to keep editing it.</p>
                </div>
                <span className={cx("rounded-full border px-3 py-1 text-xs", ui.chip)}>Shape • style • palette</span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {variations.map((variant, index) => {
                  const variantSvg = renderSvg(variant, processedImageUrl);
                  const variantUrl = svgToDataUrl(variantSvg);
                  return (
                    <button
                      key={`${variant.shape}-${variant.style}-${variant.pattern}-${index}`}
                      type="button"
                      onClick={() => setConfig(variant)}
                      className={cx(ui.panel, "group p-4 text-left transition hover:-translate-y-0.5")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Variant {index + 1}</div>
                          <div className={cx("text-xs", ui.muted)}>
                            {shapeLabels[variant.shape]} • {styleLabels[variant.style]}
                          </div>
                        </div>
                        <span className={cx("rounded-full border px-2.5 py-1 text-[11px]", ui.chip)}>apply</span>
                      </div>

                      <div className={cx("mt-4 flex items-center justify-center rounded-[1.75rem] bg-[length:18px_18px] p-6", ui.checker)}>
                        <img src={variantUrl} alt={`Variant ${index + 1}`} className="h-20 w-20 rounded-[1.25rem] transition group-hover:scale-105" />
                      </div>

                      <div className={cx("mt-4 flex items-center justify-between text-xs", ui.muted)}>
                        <span>{patternLabels[variant.pattern]}</span>
                        <span>{animationLabels[variant.animation]}</span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: variant.backgroundColor }} />
                        <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: variant.accentColor }} />
                        <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: variant.foregroundColor }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
