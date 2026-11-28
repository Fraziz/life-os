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
    lightSurface: '#eef0f5',
    darkSurface: '#13151c',
    lightAccent: '#0d0f14',
    darkAccent: '#f8f9fb',
  },
  {
    id: 'ocean',
    label: 'Nordic Ocean',
    mood: 'Analytical clarity',
    lightSurface: '#d6e7f8',
    darkSurface: '#0f2138',
    lightAccent: '#1d4ed8',
    darkAccent: '#60a5fa',
  },
  {
    id: 'sage',
    label: 'Botanical Sage',
    mood: 'Low-stress calm',
    lightSurface: '#d6ece0',
    darkSurface: '#0f241b',
    lightAccent: '#1b6b4a',
    darkAccent: '#52b788',
  },
  {
    id: 'sand',
    label: 'Warm Espresso',
    mood: 'Soft zero-glare paper',
    lightSurface: '#ecdecb',
    darkSurface: '#241a13',
    lightAccent: '#8c4a19',
    darkAccent: '#e09f5a',
  },
  {
    id: 'indigo',
    label: 'Royal Iris',
    mood: 'Deep creative focus',
    lightSurface: '#dddaf7',
    darkSurface: '#171536',
    lightAccent: '#4338ca',
    darkAccent: '#818cf8',
  },
  {
    id: 'teal',
    label: 'Harbor Teal',
    mood: 'Steady momentum',
    lightSurface: '#d1ecec',
    darkSurface: '#0d2428',
    lightAccent: '#0d6e66',
    darkAccent: '#2dd4bf',
  },
  {
    id: 'rose',
    label: 'Dusty Rosewood',
    mood: 'Warm gentle lift',
    lightSurface: '#f2d8e1',
    darkSurface: '#29141d',
    lightAccent: '#a32a50',
    darkAccent: '#f47296',
  },
  {
    id: 'plum',
    label: 'Velvet Plum',
    mood: 'Evening serenity',
    lightSurface: '#e5d8f6',
    darkSurface: '#211433',
    lightAccent: '#6b26c4',
    darkAccent: '#b388ff',
  },
  {
    id: 'olive',
    label: 'Matcha & Moss',
    mood: 'Grounded balance',
    lightSurface: '#e0ead0',
    darkSurface: '#192412',
    lightAccent: '#44611b',
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
