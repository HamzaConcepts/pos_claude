'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface CurrencyContextType {
  currency: string
  setCurrency: (currency: string) => void
  formatCurrency: (amount: number, decimals?: number) => string
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<string>('PKR')

  // Fetch currency from store settings on mount
  useEffect(() => {
    const fetchCurrency = async () => {
      const storeId = sessionStorage.getItem('store_id')
      if (!storeId) return

      try {
        const response = await fetch(`/api/store-info?store_id=${storeId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data.currency) {
            setCurrencyState(data.data.currency)
          }
        }
      } catch (error) {
        console.error('Error fetching currency:', error)
      }
    }

    fetchCurrency()

    // Listen for currency updates
    const handleCurrencyUpdate = () => {
      fetchCurrency()
    }
    window.addEventListener('currencyUpdated', handleCurrencyUpdate)

    return () => {
      window.removeEventListener('currencyUpdated', handleCurrencyUpdate)
    }
  }, [])

  const setCurrency = (newCurrency: string) => {
    setCurrencyState(newCurrency)
    // Store in sessionStorage for persistence
    sessionStorage.setItem('store_currency', newCurrency)
  }

  const formatCurrency = (amount: number, decimals: number = 0): string => {
    return `${currency} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`
  }

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider')
  }
  return context
}
