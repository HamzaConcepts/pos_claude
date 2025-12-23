import { useState, useEffect } from 'react'

export function useDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const handleDarkModeChange = (e: any) => {
      setIsDarkMode(e.detail.isDarkMode)
    }

    const savedDarkMode = localStorage.getItem('dark_mode')
    if (savedDarkMode) {
      setIsDarkMode(savedDarkMode === 'true')
    }

    window.addEventListener('darkModeChange', handleDarkModeChange)
    return () => window.removeEventListener('darkModeChange', handleDarkModeChange)
  }, [])

  return isDarkMode
}
