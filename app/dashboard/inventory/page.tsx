'use client'

import React, { useEffect, useState } from 'react'
import { Search, Plus, Edit, Trash2, AlertTriangle, Package, History } from 'lucide-react'
import type { ProductWithBackwardCompatibility } from '@/lib/types'
import ProductModal from '@/components/ProductModal'
import RestockModal from '@/components/RestockModal'
import RestockHistoryModal from '@/components/RestockHistoryModal'
import { getStoreId } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function InventoryPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [filteredProducts, setFilteredProducts] = useState<ProductWithBackwardCompatibility[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [showLowStock, setShowLowStock] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<ProductWithBackwardCompatibility | null>(null)
  const [editingProduct, setEditingProduct] = useState<ProductWithBackwardCompatibility | null>(null)
  const [error, setError] = useState('')
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, categoryFilter, showLowStock])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      
      const storeId = getStoreId()
      if (!storeId) {
        setError('No store ID found. Please login again.')
        router.push('/login')
        return
      }

      const response = await fetch(`/api/products?store_id=${storeId}`)
      const result = await response.json()

      if (result.success) {
        setProducts(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to fetch products')
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/products/categories')
      const result = await response.json()

      if (result.success) {
        setCategories(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch categories')
    }
  }

  const filterProducts = () => {
    let filtered = [...products]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter((p) => p.category === categoryFilter)
    }

    // Low stock filter
    if (showLowStock) {
      filtered = filtered.filter((p) => p.stock_quantity <= p.low_stock_threshold)
    }

    setFilteredProducts(filtered)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return

    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        fetchProducts()
      } else {
        alert(result.error)
      }
    } catch (err) {
      alert('Failed to delete product')
    }
  }

  const handleEdit = (product: ProductWithBackwardCompatibility) => {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  const handleAddNew = () => {
    setEditingProduct(null)
    setIsModalOpen(true)
  }

  const handleModalClose = (refresh: boolean) => {
    setIsModalOpen(false)
    setEditingProduct(null)
    if (refresh) {
      fetchProducts()
    }
  }

  const handleRestockModalClose = (refresh: boolean) => {
    setIsRestockModalOpen(false)
    if (refresh) {
      fetchProducts()
    }
  }

  const handleViewHistory = (product: ProductWithBackwardCompatibility) => {
    setSelectedProductForHistory(product)
    setIsHistoryModalOpen(true)
  }

  const handleHistoryModalClose = () => {
    setIsHistoryModalOpen(false)
    setSelectedProductForHistory(null)
  }

  const isLowStock = (product: ProductWithBackwardCompatibility) => {
    return product.stock_quantity <= product.low_stock_threshold
  }

  const toggleProductExpand = (productId: number) => {
    setExpandedProductId(expandedProductId === productId ? null : productId)
  }

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setImportError('Please select a CSV file')
      return
    }

    setImporting(true)
    setImportError('')
    setImportSuccess('')

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        setImportError('CSV file is empty or invalid')
        setImporting(false)
        return
      }

      // Parse CSV (skip header row)
      const products = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Split by comma but handle quoted values
        const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
        
        if (values.length < 3) {
          console.warn(`Skipping invalid line ${i + 1}: insufficient fields`)
          continue
        }

        const [name, description, category, price, cost_price, stock_quantity, low_stock_threshold] = values

        // Validate required fields
        if (!name || !price || !cost_price) {
          console.warn(`Skipping line ${i + 1}: missing required fields`)
          continue
        }

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
        setImportError('No valid products found in CSV file')
        setImporting(false)
        return
      }

      // Get store ID
      const storeId = getStoreId()
      if (!storeId) {
        setImportError('No store ID found. Please login again.')
        setImporting(false)
        router.push('/login')
        return
      }

      // Send to API
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products, store_id: storeId })
      })

      const result = await response.json()

      if (result.success) {
        setImportSuccess(`Successfully imported ${result.data.count} products`)
        fetchProducts()
        // Clear success message after 5 seconds
        setTimeout(() => setImportSuccess(''), 5000)
      } else {
        setImportError(result.error || 'Failed to import products')
      }
    } catch (err) {
      setImportError('Error reading CSV file')
      console.error('Import error:', err)
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Loading products...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <div className="flex gap-3">
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
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            <Plus size={20} />
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-status-error text-white rounded">
          {error}
        </div>
      )}

      {importError && (
        <div className="mb-4 p-4 bg-status-error text-white rounded flex items-center justify-between">
          <span>{importError}</span>
          <button onClick={() => setImportError('')} className="text-white hover:text-gray-200">
            ✕
          </button>
        </div>
      )}

      {importSuccess && (
        <div className="mb-4 p-4 bg-green-600 text-white rounded flex items-center justify-between">
          <span>{importSuccess}</span>
          <button onClick={() => setImportSuccess('')} className="text-white hover:text-gray-200">
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded border-2 border-black mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary" size={20} />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border-2 border-black rounded focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border-2 border-black rounded focus:outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border-2 border-black rounded cursor-pointer hover:bg-bg-secondary">
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={(e) => setShowLowStock(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Low Stock Only</span>
          </label>

          <div className="text-sm flex items-center justify-end text-text-secondary">
            {filteredProducts.length} of {products.length} products
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
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Cost</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-center hidden md:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-text-secondary">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product, index) => {
                  const isExpanded = expandedProductId === product.id
                  return (
                    <React.Fragment key={product.id}>
                      <tr
                        onClick={() => toggleProductExpand(product.id)}
                        className={`
                          cursor-pointer transition-all duration-200
                          ${isExpanded ? 'border-l-4 border-l-black' : ''}
                          ${index % 2 === 0 ? 'bg-white' : 'bg-bg-secondary'}
                          hover:bg-gray-100
                        `}
                      >
                        <td className="px-4 py-3 font-mono text-sm">{product.sku}</td>
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3 hidden md:table-cell">{product.category || '-'}</td>
                        <td className="px-4 py-3 text-right">${product.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">${product.cost_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {product.stock_quantity}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {isLowStock(product) ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-status-warning text-white text-xs rounded">
                              <AlertTriangle size={14} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="text-text-secondary text-sm">In Stock</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          <span className="text-text-secondary text-xs">
                            {isExpanded ? '▼ Click to collapse' : '▶ Click to expand'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50 border-l-4 border-l-black animate-fadeIn">
                          <td colSpan={8} className="px-4 py-4">
                            {/* Mobile-only info */}
                            <div className="md:hidden mb-4 pb-4 border-b-2 border-gray-300">
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-text-secondary">Category:</span>
                                  <span className="ml-2 font-medium">{product.category || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-text-secondary">Cost:</span>
                                  <span className="ml-2 font-medium">${product.cost_price.toFixed(2)}</span>
                                </div>
                                <div>
                                  <span className="text-text-secondary">Status:</span>
                                  <span className="ml-2">
                                    {isLowStock(product) ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-status-warning text-white text-xs rounded">
                                        <AlertTriangle size={12} />
                                        Low Stock
                                      </span>
                                    ) : (
                                      <span className="text-text-secondary text-sm">In Stock</span>
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
                              <div className="flex-1 w-full">
                                <h4 className="font-bold text-lg mb-2">Description</h4>
                                <p className="text-text-secondary mb-4">
                                  {product.description || 'No description available'}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-text-secondary">Created:</span>
                                    <span className="ml-2 font-medium">
                                      {new Date(product.created_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-secondary">Last Updated:</span>
                                    <span className="ml-2 font-medium">
                                      {new Date(product.updated_at).toLocaleDateString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-secondary">Profit Margin:</span>
                                    <span className="ml-2 font-medium">
                                      ${(product.price - product.cost_price).toFixed(2)} (
                                      {((product.price - product.cost_price) / product.cost_price * 100).toFixed(1)}%)
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-text-secondary">Stock Value:</span>
                                    <span className="ml-2 font-medium">
                                      ${(product.stock_quantity * product.cost_price).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex md:flex-col gap-2 w-full md:w-auto md:min-w-[120px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleViewHistory(product)
                                  }}
                                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-black rounded hover:bg-gray-100 transition-colors"
                                >
                                  <History size={18} />
                                  <span>History</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEdit(product)
                                  }}
                                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
                                >
                                  <Edit size={18} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDelete(product.id)
                                  }}
                                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border-2 border-black rounded hover:bg-red-50 transition-colors text-status-error"
                                >
                                  <Trash2 size={18} />
                                  <span>Delete</span>
                                </button>
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

      {isModalOpen && (
        <ProductModal
          product={editingProduct}
          onClose={handleModalClose}
        />
      )}

      {isRestockModalOpen && (
        <RestockModal
          onClose={handleRestockModalClose}
        />
      )}

      {isHistoryModalOpen && selectedProductForHistory && (
        <RestockHistoryModal
          productId={selectedProductForHistory.id}
          productName={selectedProductForHistory.name}
          onClose={handleHistoryModalClose}
        />
      )}
    </div>
  )
}
