'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Search, Plus, Edit, Trash2, AlertTriangle, Package, History, ChevronDown, ChevronUp } from 'lucide-react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'
import AddStockModal from '@/components/AddStockModal'
import ProductModal from '@/components/ProductModal'
import RestockModal from '@/components/RestockModal'
import RestockHistoryModal from '@/components/RestockHistoryModal'
import BatchEditModal from '@/components/BatchEditModal'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function InventoryPage() {
  const router = useRouter()
  
  // State
  const [products, setProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showLowStock, setShowLowStock] = useState(false)
  
  // Modals
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false)
  
  // Selected items
  const [editingProduct, setEditingProduct] = useState<ProductWithBackwardCompatibility | null>(null)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductWithBackwardCompatibility | null>(null)
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)
  const [editingBatch, setEditingBatch] = useState<any | null>(null)
  
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
  }, [products, searchTerm, categoryFilter, showLowStock])

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
        const categoryNames = result.data.map((cat: any) => cat.name)
        setCategories(categoryNames)
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
      filtered = filtered.filter(p => (p as any).category_name === categoryFilter)
    }

    // Filter low stock items
    if (showLowStock) {
      filtered = filtered.filter(p => p.stock_quantity <= p.low_stock_threshold)
    }

    setFilteredProducts(filtered)
  }, [products, searchTerm, categoryFilter, showLowStock])

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
        <div className="text-xl">Loading inventory...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 rounded hover:bg-gray-100 transition-colors cursor-pointer">
            <Package size={20} />
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
            className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 rounded hover:bg-gray-100 transition-colors"
          >
            <Package size={20} />
            Restock
          </button>
          
          <button
            onClick={() => setIsAddStockModalOpen(true)}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      {/* Import Feedback */}
      {importFeedback && (
        <div className={`mb-4 p-4 rounded flex items-center justify-between ${
          importFeedback.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>
          <span>{importFeedback.message}</span>
          <button onClick={() => setImportFeedback(null)} className="text-white hover:text-gray-200">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded border-2 border-black mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border-2 border-black rounded focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Low Stock Filter */}
          <label className="flex items-center gap-2 px-3 py-2 border-2 border-black rounded cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Low Stock Only</span>
          </label>

          {/* Count */}
          <div className="flex items-center justify-end text-sm text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded border-2 border-black overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-black text-white">
              <tr>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Min Price</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Selling Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
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
                          transition-all duration-200
                          ${isExpanded ? 'border-l-4 border-l-black bg-gray-50' : ''}
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                          hover:bg-gray-100
                        `}
                      >
                        <td className="px-4 py-3 font-mono text-sm">{product.sku}</td>
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          {(product as any).category_name ? (
                            <div>
                              <div className="font-medium text-sm">{(product as any).category_name}</div>
                              {(product as any).subcategory_name && (
                                <div className="text-xs text-gray-500">{(product as any).subcategory_name}</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          <span className="font-medium">
                            ${(product.aggregated_stock?.aggregated_lowest_negotiable || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden lg:table-cell">
                          {product.aggregated_stock?.aggregated_selling_price ? (
                            <span className="font-medium text-green-600">
                              ${product.aggregated_stock.aggregated_selling_price.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${isLowStock(product) ? 'text-red-600' : ''}`}>
                            {product.stock_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {isLowStock(product) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded">
                              <AlertTriangle size={14} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="text-green-600 text-sm font-medium">In Stock</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => toggleExpanded(product.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(product)
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Edit"
                            >
                              <Edit size={18} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(product.id)
                              }}
                              className="p-1 hover:bg-red-100 rounded text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr className="bg-gray-50 border-l-4 border-l-black">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Column - Details */}
                              <div>
                                <h4 className="font-bold text-lg mb-3">Product Details</h4>
                                
                                <div className="space-y-2 text-sm">
                                  <div>
                                    <span className="text-gray-600">Description:</span>
                                    <p className="mt-1">{product.description || 'No description available'}</p>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                      <span className="text-gray-600">Cost Price:</span>
                                      <p className="font-medium">${(product.aggregated_stock?.aggregated_cost_price || 0).toFixed(2)}</p>
                                    </div>
                                    
                                    {profitMargin && (
                                      <div>
                                        <span className="text-gray-600">Profit Margin:</span>
                                        <p className="font-medium text-green-600">
                                          ${profitMargin.profit.toFixed(2)} ({profitMargin.margin.toFixed(1)}%)
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div>
                                      <span className="text-gray-600">Stock Value:</span>
                                      <p className="font-medium">${stockValue.toFixed(2)}</p>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-600">Low Stock Alert:</span>
                                      <p className="font-medium">{product.low_stock_threshold} units</p>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-600">Created:</span>
                                      <p>{new Date(product.created_at).toLocaleDateString()}</p>
                                    </div>
                                    
                                    <div>
                                      <span className="text-gray-600">Updated:</span>
                                      <p>{new Date(product.updated_at).toLocaleDateString()}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column - Restock History & Actions */}
                              <div>
                                {/* Restock History */}
                                {(product as any).batches && (product as any).batches.length > 0 && (
                                  <div className="mb-4">
                                    <h5 className="font-bold mb-2">Restock History ({(product as any).batches.length})</h5>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                      {(product as any).batches
                                        .sort((a: any, b: any) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())
                                        .map((batch: any, index: number) => (
                                          <div key={batch.id} className="p-3 bg-white rounded border border-gray-200 text-sm">
                                            <div className="flex justify-between items-start mb-2">
                                              <div>
                                                <div className="font-medium">
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
                                                <Edit size={16} />
                                              </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                              <div>
                                                <span className="text-gray-600">Date:</span>
                                                <div className="font-medium">
                                                  {new Date(batch.purchase_date).toLocaleDateString()}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Quantity:</span>
                                                <div className="font-medium">
                                                  {batch.quantity_remaining} / {batch.quantity_purchased}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Cost Price:</span>
                                                <div className="font-medium">
                                                  ${batch.cost_price.toFixed(2)}
                                                </div>
                                              </div>
                                              <div>
                                                <span className="text-gray-600">Target Price:</span>
                                                <div className="font-medium">
                                                  ${(batch.selling_price || 0).toFixed(2)}
                                                </div>
                                              </div>
                                            </div>
                                            {batch.is_depleted && (
                                              <div className="mt-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
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
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-black rounded hover:bg-gray-100 transition-colors"
                                  >
                                    <History size={18} />
                                    <span>View History</span>
                                  </button>
                                  <button
                                    onClick={() => handleEdit(product)}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                                  >
                                    <Edit size={18} />
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
