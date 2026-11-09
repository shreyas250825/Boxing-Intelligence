/**
 * Theme management hook.
 *
 * Reads/writes the theme (dark | light) to localStorage and applies it
 * as a data-theme attribute on <html>. This approach works with CSS variables
 * without requiring Tailwind's darkMode class config (which would require
 * modifying every component).
 *
 * Defaults to system preference on first visit.
 */
import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'valen-theme'

function getInitialTheme(): Theme {
  // Prevent flash on load: read before first paint
  if (typeof window === 'undefined') return 'dark'
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  // Fall back to system preference
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

// Apply immediately on module load to avoid flash
if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme())
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  const setTheme = (t: Theme) => {
    setThemeState(t)
  }

  return { theme, toggleTheme, setTheme, isDark: theme === 'dark' }
}
