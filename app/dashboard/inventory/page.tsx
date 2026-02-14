'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { MagnifyingGlassIcon, PlusIcon, PencilSimpleIcon, TrashIcon, WarningIcon, PackageIcon, ClockCounterClockwiseIcon, CaretDownIcon, CaretUpIcon, PrinterIcon } from '@phosphor-icons/react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'
import AddStockModal from '@/components/AddStockModal'
import ProductModal from '@/components/ProductModal'
import RestockModal from '@/components/RestockModal'
import RestockHistoryModal from '@/components/RestockHistoryModal'
import BatchEditModal from '@/components/BatchEditModal'
import PrintLabelsModal from '@/components/PrintLabelsModal'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useDarkMode } from '@/hooks/useDarkMode'
import { useCurrency } from '@/lib/currency-context'

export default function InventoryPage() {
  const router = useRouter()
  const isDarkMode = useDarkMode()
  const { currency, formatCurrency } = useCurrency()
  
  // State
  const [products, setProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [subcategories, setSubcategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [subcategoryFilter, setSubcategoryFilter] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)
  
  // Modals
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false)
  const [isPrintLabelsModalOpen, setIsPrintLabelsModalOpen] = useState(false)
  
  // Selected items
  const [editingProduct, setEditingProduct] = useState<ProductWithBackwardCompatibility | null>(null)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductWithBackwardCompatibility | null>(null)
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)
  const [editingBatch, setEditingBatch] = useState<any | null>(null)
  const [selectedProductForLabels, setSelectedProductForLabels] = useState<ProductWithBackwardCompatibility | null>(null)
  
  // Import
  const [importing, setImporting] = useState(false)
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Fetch data on mount
  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  // Filter products whenever dependencies change
  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, categoryFilter, subcategoryFilter, showLowStock])

  // Fetch products from API
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      const storeId = getStoreId()
      
      if (!storeId) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/products?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setProducts(result.data)
      } else {
        console.error('Failed to fetch products:', result.error)
      }
    } catch (err) {
      console.error('Error fetching products:', err)
    } finally {
      setLoading(false)
    }
  }, [router])

  // Fetch categories for filter dropdown
  const fetchCategories = useCallback(async () => {
    try {
      const storeId = getStoreId()
      if (!storeId) return

      const response = await fetch(`/api/categories?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setCategories(result.data || [])
      }
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }, [])

  // Filter products based on search, category, and low stock
  const filterProducts = useCallback(() => {
    let filtered = [...products]

    // Search by name or SKU
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) || 
        p.sku.toLowerCase().includes(search)
      )
    }

    // Filter by category
    if (categoryFilter) {
      filtered = filtered.filter(p => (p as any).category_id === parseInt(categoryFilter))
    }

    // Filter by subcategory
    if (subcategoryFilter) {
      filtered = filtered.filter(p => (p as any).subcategory_id === parseInt(subcategoryFilter))
    }

    // Filter low stock items
    if (showLowStock) {
      filtered = filtered.filter(p => p.stock_quantity <= p.low_stock_threshold)
    }

    setFilteredProducts(filtered)
  }, [products, searchTerm, categoryFilter, subcategoryFilter, showLowStock])

  // Handle category change and load subcategories
  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value)
    setSubcategoryFilter('') // Reset subcategory when category changes
    
    if (value) {
      const category = categories.find(c => c.id === parseInt(value))
      setSubcategories(category?.subcategories || [])
    } else {
      setSubcategories([])
    }
  }

  // Delete product
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const result = await response.json()

      if (result.success) {
        fetchProducts()
      } else {
        alert(result.error || 'Failed to delete product')
      }
    } catch (err) {
      console.error('Error deleting product:', err)
      alert('Failed to delete product')
    }
  }

  // Edit product
  const handleEdit = (product: ProductWithBackwardCompatibility) => {
    setEditingProduct(product)
    setIsProductModalOpen(true)
  }

  // View restock history
  const handleViewHistory = (product: ProductWithBackwardCompatibility) => {
    setSelectedProductForHistory(product)
    setIsHistoryModalOpen(true)
  }

  // Toggle product expansion
  const toggleExpanded = (productId: number) => {
    setExpandedProductId(expandedProductId === productId ? null : productId)
  }

  // Check if product is low stock
  const isLowStock = (product: ProductWithBackwardCompatibility) => {
    return product.stock_quantity <= product.low_stock_threshold
  }

  // Calculate profit margin
  const calculateProfitMargin = (product: ProductWithBackwardCompatibility) => {
    const sellingPrice = product.aggregated_stock?.aggregated_selling_price
    const costPrice = product.aggregated_stock?.aggregated_cost_price
    
    if (!sellingPrice || !costPrice) return null
    
    const profit = sellingPrice - costPrice
    const margin = (profit / costPrice) * 100
    
    return { profit, margin }
  }

  // Calculate stock value
  const calculateStockValue = (product: ProductWithBackwardCompatibility) => {
    const costPrice = product.aggregated_stock?.aggregated_cost_price || 0
    return product.stock_quantity * costPrice
  }

  // Handle CSV import
  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setImportFeedback({ type: 'error', message: 'Please select a CSV file' })
      return
    }

    setImporting(true)
    setImportFeedback(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setImportFeedback({ type: 'error', message: 'CSV file is empty or invalid' })
        setImporting(false)
        return
      }

      // Parse CSV
      const products = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
        
        if (values.length < 3) continue

        const [name, description, category, price, cost_price, stock_quantity, low_stock_threshold] = values

        if (!name || !price || !cost_price) continue

        products.push({
          name: name.trim(),
          description: description?.trim() || null,
          category: category?.trim() || null,
          price: parseFloat(price),
          cost_price: parseFloat(cost_price),
          stock_quantity: stock_quantity ? parseInt(stock_quantity) : 0,
          low_stock_threshold: low_stock_threshold ? parseInt(low_stock_threshold) : 10
        })
      }

      if (products.length === 0) {
        setImportFeedback({ type: 'error', message: 'No valid products found in CSV' })
        setImporting(false)
        return
      }

      const storeId = getStoreId()
      if (!storeId) {
        setImportFeedback({ type: 'error', message: 'Please login again' })
        setImporting(false)
        router.push('/login')
        return
      }

      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, store_id: storeId })
      })

      const result = await response.json()

      if (result.success) {
        setImportFeedback({ type: 'success', message: `Successfully imported ${result.data.count} products` })
        fetchProducts()
        setTimeout(() => setImportFeedback(null), 5000)
      } else {
        setImportFeedback({ type: 'error', message: result.error || 'Failed to import products' })
      }
    } catch (err) {
      console.error('Import error:', err)
      setImportFeedback({ type: 'error', message: 'Error reading CSV file' })
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mx-auto ${isDarkMode ? 'border-cyan-500' : 'border-black'}`}></div>
          <p className={`mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading inventory...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <h1 className={`text-xl md:text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Inventory Management</h1>
        
        <div className="flex flex-wrap gap-2">
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors cursor-pointer ${
            isDarkMode ? 'bg-gray-700/30 hover:bg-gray-700/50 text-gray-300' : 'bg-white border border-gray-300 hover:bg-gray-50 shadow-sm'
          }`}>
            <PackageIcon size={16} />
            {importing ? 'Importing...' : 'Import CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileImport}
              disabled={importing}
              className="hidden"
            />
          </label>
          
          <button
            onClick={() => setIsRestockModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${isDarkMode ? 'bg-gray-700/30 hover:bg-gray-700/50 text-gray-300' : 'bg-white border border-gray-300 hover:bg-gray-50 shadow-sm'}`}
          >
            <PackageIcon size={16} />
            Restock
          </button>
          
          <button
            onClick={() => setIsAddStockModalOpen(true)}
            className="flex items-center gap-2 bg-cyan-600 text-white px-4 py-2.5 rounded-lg hover:bg-cyan-700 transition-colors font-medium"
          >
            <PlusIcon size={16} />
            Add Product
          </button>
        </div>
      </div>

      {/* Import Feedback */}
      {importFeedback && (
        <div className={`mb-4 p-3 rounded text-sm flex items-center justify-between border ${
          importFeedback.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'
        }`}>
          <span>{importFeedback.message}</span>
          <button onClick={() => setImportFeedback(null)} className="hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className={`p-5 rounded-lg mb-6 ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} size={16} />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-9 pr-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-white placeholder-gray-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={`px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-white' : 'border-gray-300'}`}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Subcategory Filter */}
          <select
            value={subcategoryFilter}
            onChange={(e) => setSubcategoryFilter(e.target.value)}
            disabled={!categoryFilter || subcategories.length === 0}
            className={`px-3 py-2.5 border rounded-lg focus:outline-none focus:border-cyan-600 ${
              !categoryFilter || subcategories.length === 0 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            } ${isDarkMode ? 'bg-[#1a1a1a] border-gray-600 text-white' : 'border-gray-300'}`}
          >
            <option value="">All Subcategories</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>{sub.name}</option>
            ))}
          </select>

          {/* Low Stock Filter */}
          <label className={`flex items-center gap-2 px-3 py-2.5 border rounded-lg cursor-pointer ${isDarkMode ? 'border-gray-600 hover:bg-[#2a2a2a] text-gray-300' : 'border-gray-300 hover:bg-gray-50'}`}>
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Low Stock Only</span>
          </label>

          {/* Count */}
          <div className={`flex items-center justify-end text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-[#0f0f0f] dark-shadow' : 'bg-white shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDarkMode ? 'bg-gray-700/30 text-gray-300' : 'bg-gray-50/50 text-gray-700'}`}>
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right text-sm font-semibold hidden lg:table-cell">Min Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold hidden lg:table-cell">Selling Price</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Stock</th>
                <th className="px-4 py-3 text-center text-sm font-semibold hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, index) => {
                  const isExpanded = expandedProductId === product.id
                  const profitMargin = calculateProfitMargin(product)
                  const stockValue = calculateStockValue(product)
                  
                  return (
                    <React.Fragment key={product.id}>
                      {/* Main Row */}
                      <tr
                        className={`
                          transition-all duration-200 border-b border-gray-100
                          ${isExpanded ? 'border-l-4 border-l-cyan-600 bg-cyan-50' : ''}
                          ${!isExpanded && 'hover:bg-gray-50'}
                        `}
                      >
                        <td className="px-3 py-3 font-mono text-xs text-gray-700">{product.sku}</td>
                        <td className="px-3 py-3 font-medium text-sm text-gray-900">{product.name}</td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          {(product as any).category_name ? (
                            <div>
                              <div className="font-medium text-xs text-gray-900">{(product as any).category_name}</div>
                              {(product as any).subcategory_name && (
                                <div className="text-xs text-gray-600">{(product as any).subcategory_name}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell">
                          <span className="font-medium text-sm text-gray-900">
                            {formatCurrency(product.aggregated_stock?.aggregated_lowest_negotiable || 0, 2)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right hidden lg:table-cell">
                          {product.aggregated_stock?.aggregated_selling_price ? (
                            <span className="font-medium text-green-600 text-sm">
                              {formatCurrency(product.aggregated_stock.aggregated_selling_price, 2)}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <span className={`font-medium text-sm ${isLowStock(product) ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          {isLowStock(product) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded font-medium">
                              <WarningIcon size={12} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs font-medium">In Stock</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleExpanded(product.id)}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProductForLabels(product)
                                setIsPrintLabelsModalOpen(true)
                              }}
                              className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                              title="Print Labels"
                            >
                              <PrinterIcon size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(product)
                              }}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title="Edit"
                            >
                              <PencilSimpleIcon size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(product.id)
                              }}
                              className="p-1 hover:bg-red-100 rounded text-red-600 transition-colors"
                              title="Delete"
                            >
                              <TrashIcon size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-cyan-50 border-l-4 border-l-cyan-600 border-b border-gray-100">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                              {/* Left Column - Details */}
                              <div>
                                <h4 className="font-bold text-base text-gray-900 mb-3">Product Details</h4>
                                
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600 text-xs">Description:</span>
                                    <p className="mt-1 text-gray-900">{product.description || 'No description available'}</p>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div>
                                      <span className="text-gray-600 text-xs">Cost Price:</span>
                                      <p className="font-medium text-sm text-gray-900">{formatCurrency(product.aggregated_stock?.aggregated_cost_price || 0, 2)}</p>
                                    </div>
                                    
                                    {profitMargin && (
                                      <div>
                                        <span className="text-gray-600 text-xs">Profit Margin:</span>
                                        <p className="font-medium text-green-600 text-sm">
                                          {formatCurrency(profitMargin.profit, 2)} ({profitMargin.margin.toFixed(1)}%)
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <span className="text-gray-600 text-xs">Stock Value:</span>
                                      <p className="font-medium text-sm text-gray-900">{formatCurrency(stockValue, 2)}</p>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-600 text-xs">Low Stock Alert:</span>
                                      <p className="font-medium text-sm text-gray-900">{product.low_stock_threshold} units</p>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-600 text-xs">Created:</span>
                                      <p className="text-sm text-gray-900">{new Date(product.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-600 text-xs">Updated:</span>
                                      <p className="text-sm text-gray-900">{new Date(product.updated_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column - Restock History & Actions */}
                              <div>
                                {/* Restock History */}
                                {(product as any).batches && (product as any).batches.length > 0 && (
                                  <div className="mb-4">
                                    <h5 className="font-bold text-sm text-gray-900 mb-2">Restock History ({(product as any).batches.length})</h5>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                      {(product as any).batches
                                        .sort((a: any, b: any) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())
                                        .map((batch: any, index: number) => (
                                          <div key={batch.id} className={`p-3 rounded border text-sm ${isDarkMode ? 'bg-gray-800/30 border-gray-700' : 'bg-white border-gray-200'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                              <div>
                                                <div className="font-medium text-sm text-gray-900">
                                                  {index === 0 ? 'Initial Stock' : `Restock #${index}`}
                                                </div>
                                                <div className="text-xs text-gray-500 font-mono">
                                                  {batch.batch_number || 'N/A'}
                                                </div>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  setEditingBatch(batch)
                                                  setIsBatchEditModalOpen(true)
                                                }}
                                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                                title="Edit prices"
                                              >
                                                <PencilSimpleIcon size={14} />
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-600">Date:</span>
                                                <div className="font-medium text-gray-900">
                                                  {new Date(batch.purchase_date).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Quantity:</span>
                                                <div className="font-medium text-gray-900">
                                                  {batch.quantity_remaining} / {batch.quantity_purchased}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Cost Price:</span>
                                                <div className="font-medium text-gray-900">
                                                  {formatCurrency(batch.cost_price, 2)}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Target Price:</span>
                                                <div className="font-medium text-gray-900">
                                                  {formatCurrency(batch.selling_price || 0, 2)}
                                                </div>
                                              </div>
                                            </div>
                                            {batch.is_depleted && (
                                              <div className="mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                                                Depleted
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2">
                                  <button
                                    onClick={() => handleViewHistory(product)}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 border rounded hover:bg-opacity-80 transition-colors text-sm ${isDarkMode ? 'bg-gray-700/30 border-gray-600 text-gray-300 hover:bg-gray-700/50' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                                  >
                                    <ClockCounterClockwiseIcon size={16} />
                                    <span>View History</span>
                                  </button>
                                  <button
                                    onClick={() => handleEdit(product)}
                                    className="flex items-center justify-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors text-sm"
                                  >
                                    <PencilSimpleIcon size={16} />
                                    <span>Edit Product</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isAddStockModalOpen && (
        <AddStockModal
          onClose={(refresh) => {
            setIsAddStockModalOpen(false)
            if (refresh) fetchProducts()
          }}
        />
      )}

      {isProductModalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={(refresh) => {
            setIsProductModalOpen(false)
            setEditingProduct(null)
            if (refresh) fetchProducts()
          }}
        />
      )}

      {isRestockModalOpen && (
        <RestockModal
          onClose={(refresh) => {
            setIsRestockModalOpen(false)
            if (refresh) fetchProducts()
          }}
        />
      )}

      {isHistoryModalOpen && selectedProductForHistory && (
        <RestockHistoryModal
          productId={selectedProductForHistory.id}
          productName={selectedProductForHistory.name}
          onClose={() => {
            setIsHistoryModalOpen(false)
            setSelectedProductForHistory(null)
          }}
        />
      )}

      {isPrintLabelsModalOpen && selectedProductForLabels && (
        <PrintLabelsModal
          product={selectedProductForLabels}
          onClose={() => {
            setIsPrintLabelsModalOpen(false)
            setSelectedProductForLabels(null)
          }}
        />
      )}

      {isBatchEditModalOpen && editingBatch && (
        <BatchEditModal
          batch={editingBatch}
          onClose={(refresh) => {
            setIsBatchEditModalOpen(false)
            setEditingBatch(null)
            if (refresh) fetchProducts()
          }}
        />
      )}
    </div>
  )
}
