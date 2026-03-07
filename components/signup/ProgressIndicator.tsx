'use client'

interface ProgressIndicatorProps {
  currentStep: 1 | 2 | 3
  steps?: string[]
}

export default function ProgressIndicator({ 
  currentStep, 
  steps = ['Store Info', 'Manager Account', 'Cashier Setup'] 
}: ProgressIndicatorProps) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="flex items-center justify-center">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  step < currentStep
                    ? 'bg-green-600 text-white'
                    : step === currentStep
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {step < currentStep ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={`text-xs mt-1 hidden sm:block ${
                  step <= currentStep ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'
                }`}
              >
                {steps[step - 1]}
              </span>
            </div>
            
            {/* Connector line */}
            {step < 3 && (
              <div
                className={`w-16 sm:w-24 h-1 mx-2 transition-colors ${
                  step < currentStep ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
