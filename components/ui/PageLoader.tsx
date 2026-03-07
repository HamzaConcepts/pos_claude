'use client'

interface PageLoaderProps {
  message?: string
  fullScreen?: boolean
}

export default function PageLoader({ message = 'Loading...', fullScreen = false }: PageLoaderProps) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'min-h-[400px]'}`}>
      <div className="text-center">
        {/* Animated POS icon */}
        <div className="relative mx-auto w-16 h-16 mb-4">
          {/* Outer ring */}
          <div className="absolute inset-0 rounded-full border-[3px] border-gray-200 dark:border-gray-700" />
          {/* Spinning arc */}
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-cyan-500 animate-spin" />
          {/* Inner dot */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse" />
          </div>
        </div>
        {/* Message */}
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {message}
        </p>
        {/* Animated dots */}
        <div className="flex items-center justify-center gap-1 mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
