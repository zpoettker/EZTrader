// Color theme, remembered per browser. Applied as a data-theme attribute on
// <html>; the palettes live in globals.css. The root layout runs THEME_SCRIPT
// before first paint so the saved theme never flashes.
export const THEME_KEY = 'eztrader:theme'

export const THEMES = [
  { id: 'graphite', label: 'Graphite', description: 'Dark grey with green accent', swatch: ['#18181b', '#1a1d21', '#22c55e'] },
  { id: 'light', label: 'Light', description: 'Warm cream with green accent', swatch: ['#f6f2ea', '#faf7f1', '#16a34a'] },
  { id: 'classic', label: 'Classic', description: 'Original navy with blue accent', swatch: ['#161b27', '#1a2035', '#3b82f6'] },
] as const

export type Theme = (typeof THEMES)[number]['id']

export const DEFAULT_THEME: Theme = 'graphite'

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`

export function currentTheme(): Theme {
  const t = document.documentElement.getAttribute('data-theme')
  return THEMES.some((x) => x.id === t) ? (t as Theme) : DEFAULT_THEME
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {}
}
