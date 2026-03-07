import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const applyDarkClass = (dark: boolean) => {
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    const handleDarkModeChange = (e: any) => {
      const dark = e.detail.isDarkMode
      setIsDarkMode(dark)
      applyDarkClass(dark)
    }

    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      const dark = savedDarkMode === 'true'
      setIsDarkMode(dark)
      applyDarkClass(dark)
    }

    window.addEventListener('darkModeChange', handleDarkModeChange)
    return () => window.removeEventListener('darkModeChange', handleDarkModeChange)
  }, [])

  return isDarkMode
}
