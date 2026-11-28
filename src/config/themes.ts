import type { ColorThemeId } from '@/types';

export interface ColorThemeDefinition {
  id: ColorThemeId;
  label: string;
  mood: string;
  lightSurface: string;
  darkSurface: string;
  lightAccent: string;
  darkAccent: string;
}

export const COLOR_THEMES: ColorThemeDefinition[] = [
  {
    id: 'slate',
    label: 'Classic Slate',
    mood: 'Crisp studio neutral',
    lightSurface: '#f4f5f8',
    darkSurface: '#13151c',
    lightAccent: '#0d0f14',
    darkAccent: '#f8f9fb',
  },
  {
    id: 'ocean',
    label: 'Nordic Ocean',
    mood: 'Analytical clarity',
    lightSurface: '#eef4fa',
    darkSurface: '#101826',
    lightAccent: '#1d4ed8',
    darkAccent: '#60a5fa',
  },
  {
    id: 'sage',
    label: 'Botanical Sage',
    mood: 'Low-stress calm',
    lightSurface: '#eff5f1',
    darkSurface: '#101a15',
    lightAccent: '#1f6349',
    darkAccent: '#52b788',
  },
  {
    id: 'sand',
    label: 'Warm Espresso',
    mood: 'Soft zero-glare paper',
    lightSurface: '#f6f1ea',
    darkSurface: '#1b1613',
    lightAccent: '#8c4f1f',
    darkAccent: '#e09f5a',
  },
  {
    id: 'indigo',
    label: 'Royal Iris',
    mood: 'Deep creative focus',
    lightSurface: '#f1f0fa',
    darkSurface: '#141326',
    lightAccent: '#4338ca',
    darkAccent: '#818cf8',
  },
  {
    id: 'teal',
    label: 'Harbor Teal',
    mood: 'Steady momentum',
    lightSurface: '#edf5f5',
    darkSurface: '#0f1b1e',
    lightAccent: '#0f6b63',
    darkAccent: '#2dd4bf',
  },
  {
    id: 'rose',
    label: 'Dusty Rosewood',
    mood: 'Warm gentle lift',
    lightSurface: '#f7f0f2',
    darkSurface: '#1d1317',
    lightAccent: '#9d2f52',
    darkAccent: '#f47296',
  },
  {
    id: 'plum',
    label: 'Velvet Plum',
    mood: 'Evening serenity',
    lightSurface: '#f4eff8',
    darkSurface: '#181221',
    lightAccent: '#6429b8',
    darkAccent: '#b388ff',
  },
  {
    id: 'olive',
    label: 'Matcha & Moss',
    mood: 'Grounded balance',
    lightSurface: '#f3f5ec',
    darkSurface: '#151910',
    lightAccent: '#455a20',
    darkAccent: '#a3c962',
  },
];

export const COLOR_THEME_IDS: ColorThemeId[] = COLOR_THEMES.map((t) => t.id);

export function getColorThemeMeta(id?: string): ColorThemeDefinition {
  return COLOR_THEMES.find((t) => t.id === id) || COLOR_THEMES[0];
}

export function getNextColorThemeId(currentId?: string): ColorThemeId {
  const idx = COLOR_THEMES.findIndex((t) => t.id === currentId);
  if (idx === -1) return COLOR_THEMES[1].id;
  return COLOR_THEMES[(idx + 1) % COLOR_THEMES.length].id;
}
