'use client'

import Logo from '@/components/Logo'

interface PageLoaderProps {
  message?: string
  fullScreen?: boolean
}

export default function PageLoader({ message = 'Loading...', fullScreen = false }: PageLoaderProps) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'min-h-[400px]'}`}>
      <div className="text-center">
        {/* Logo */}
        <div className="mx-auto mb-4 animate-pulse">
          <Logo size={48} className="text-cyan-500 mx-auto" />
        </div>
        {/* Progress bar */}
        <div className="w-48 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto mb-3">
          <div className="h-full bg-cyan-500 rounded-full" style={{ animation: 'progressBar 1.5s ease-in-out infinite' }} />
        </div>
        {/* Message */}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {message}
        </p>
      </div>
    </div>
  )
}
