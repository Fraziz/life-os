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
    lightSurface: '#f4f6fa',
    darkSurface: '#141720',
    lightAccent: '#0f172a',
    darkAccent: '#f8f9fb',
  },
  {
    id: 'ocean',
    label: 'Nordic Ocean',
    mood: 'Analytical clarity',
    lightSurface: '#e6f1fc',
    darkSurface: '#12243b',
    lightAccent: '#1d4ed8',
    darkAccent: '#60a5fa',
  },
  {
    id: 'sage',
    label: 'Botanical Sage',
    mood: 'Low-stress calm',
    lightSurface: '#e6f5ec',
    darkSurface: '#12291f',
    lightAccent: '#1b6b4a',
    darkAccent: '#52b788',
  },
  {
    id: 'sand',
    label: 'Warm Espresso',
    mood: 'Soft zero-glare paper',
    lightSurface: '#f6ede1',
    darkSurface: '#281d15',
    lightAccent: '#8c4a19',
    darkAccent: '#e09f5a',
  },
  {
    id: 'indigo',
    label: 'Royal Iris',
    mood: 'Deep creative focus',
    lightSurface: '#eceafd',
    darkSurface: '#1a183b',
    lightAccent: '#4338ca',
    darkAccent: '#818cf8',
  },
  {
    id: 'teal',
    label: 'Harbor Teal',
    mood: 'Steady momentum',
    lightSurface: '#e3f5f5',
    darkSurface: '#10292e',
    lightAccent: '#0d6e66',
    darkAccent: '#2dd4bf',
  },
  {
    id: 'rose',
    label: 'Dusty Rosewood',
    mood: 'Warm gentle lift',
    lightSurface: '#fae9ef',
    darkSurface: '#2e1821',
    lightAccent: '#a32a50',
    darkAccent: '#f47296',
  },
  {
    id: 'plum',
    label: 'Velvet Plum',
    mood: 'Evening serenity',
    lightSurface: '#f1e8fc',
    darkSurface: '#24173b',
    lightAccent: '#6b26c4',
    darkAccent: '#b388ff',
  },
  {
    id: 'olive',
    label: 'Matcha & Moss',
    mood: 'Grounded balance',
    lightSurface: '#edf5e1',
    darkSurface: '#1c2914',
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
