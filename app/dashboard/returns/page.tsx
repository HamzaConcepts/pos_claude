'use client'

import { useState } from 'react'
import { ArrowUUpLeft, Users, Truck } from '@phosphor-icons/react'
import CustomerReturnsTab from './components/CustomerReturnsTab'
import SupplierReturnsTab from './components/SupplierReturnsTab'

export default function ReturnsPage() {
  const [activeTab, setActiveTab] = useState<'customer' | 'supplier'>('customer')

  return (
    <div className="animate-fadeIn p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <ArrowUUpLeft weight="bold" className="text-blue-600 dark:text-blue-400" />
          Returns Management
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Process customer returns (refunds/exchanges) and supplier returns (stock callbacks).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-8 max-w-md">
        <button
          onClick={() => setActiveTab('customer')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'customer'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Users weight={activeTab === 'customer' ? 'fill' : 'regular'} size={18} />
          Customer Returns
        </button>
        <button
          onClick={() => setActiveTab('supplier')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'supplier'
              ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Truck weight={activeTab === 'supplier' ? 'fill' : 'regular'} size={18} />
          Supplier Returns
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden min-h-[500px]">
        {activeTab === 'customer' ? (
          <div className="p-4 sm:p-6">
            <CustomerReturnsTab />
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <SupplierReturnsTab />
          </div>
        )}
      </div>
    </div>
  )
}
