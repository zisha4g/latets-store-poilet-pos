import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import InventoryAlerts from './InventoryAlerts';
import { Plus, Edit, Save, Search, Minus, LayoutGrid, Download, Upload, Image, Trash2, Printer, Edit2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import ProductDetailModal from './ProductDetailModal';
import CurrencyInput from '../ui/CurrencyInput';
import CategoriesManager from './CategoriesManager';
import * as XLSX from 'xlsx';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { Checkbox } from '@/components/ui/checkbox';
import BulkEditModal from './BulkEditModal';
import LabelDesigner from './LabelDesigner';
import PrintLabelsModal from './PrintLabelsModal';
import { useResponsive } from '@/lib/responsive';

const EDITABLE_COLUMNS = ['name', 'category_id', 'cost_price', 'price', 'stock', 'barcode', 'sku'];

const InventoryView = ({ products, categories, handlers, searchQuery, onSearchQueryChange, filterMode, onFilterModeChange }) => {
  const { isMobile } = useResponsive();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedProducts, setEditedProducts] = useState({});
  // Allow parent to control search/filter, fallback to local state if not provided
  const [searchTermLocal, setSearchTermLocal] = useState('');
  const effectiveSearchTerm = (typeof searchQuery === 'string') ? searchQuery : searchTermLocal;
  const setSearchTerm = onSearchQueryChange || setSearchTermLocal;

  const [filterModeLocal, setFilterModeLocal] = useState('all'); // 'all' | 'low' | 'out'
  const effectiveFilterMode = filterMode || filterModeLocal;
  const setEffectiveFilterMode = onFilterModeChange || setFilterModeLocal;
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productModalMode, setProductModalMode] = useState('view');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isPrintLabelsModalOpen, setIsPrintLabelsModalOpen] = useState(false);
  const [newRowData, setNewRowData] = useState({
    name: '',
    category_id: '',
    cost_price: 0,
    price: 0,
    stock: 0,
    barcode: '',
    sku: '',
  });
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const editInputRefs = useRef({});

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useHotkeys([
    ['ctrl+s', (e) => { if (isEditMode) { e.preventDefault(); handleSaveChanges(); } }],
    ['f2', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }],
    ['mod+f', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }]
  ]);

  const filteredProducts = useMemo(() => {
    const term = (effectiveSearchTerm || '').toLowerCase();
    return products
      .filter(p => activeCategory === 'all' || p.category_id === activeCategory)
      .filter(p => {
        if (effectiveFilterMode === 'low') return (p.stock ?? 0) < 10;
        if (effectiveFilterMode === 'out') return (p.stock ?? 0) === 0;
        return true;
      })
      .filter(p => 
        p.name?.toLowerCase().includes(term) || 
        p.barcode?.includes(effectiveSearchTerm || '') || 
        p.sku?.toLowerCase().includes(term)
      );
  }, [products, effectiveSearchTerm, effectiveFilterMode, activeCategory]);

  useEffect(() => {
    setSelectedProductIds(new Set());
  }, [effectiveSearchTerm, effectiveFilterMode, activeCategory]);

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(filteredProducts.map(p => p.id));
      setSelectedProductIds(allIds);
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const handleSelectOne = (productId, e) => {
    e.stopPropagation();
    const newSelection = new Set(selectedProductIds);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProductIds(newSelection);
  };

  const handleBulkDelete = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedProductIds.size} products? This action cannot be undone.`)) {
      try {
        await handlers.products.batchDelete(Array.from(selectedProductIds));
        toast({ title: "Success", description: `${selectedProductIds.size} products deleted.` });
        setSelectedProductIds(new Set());
      } catch (error) {
        toast({ title: "Error Deleting", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleInputChange = (productId, field, value) => {
    const numericFields = ['price', 'cost_price', 'stock'];
    let processedValue = value;
    if (numericFields.includes(field)) {
      processedValue = value === '' ? null : parseFloat(value);
      if (isNaN(processedValue)) processedValue = null;
    }

    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...(products.find(p => p.id === productId) || {}),
        ...(prev[productId] || {}),
        [field]: processedValue,
      },
    }));
  };

  const handleCellKeyDown = (e, rowIndex, colIndex) => {
    const { key } = e;
    if (!['Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
    e.preventDefault();
    let nextRow = rowIndex, nextCol = colIndex;
    if (key === 'Enter' || key === 'ArrowDown') nextRow = Math.min(rowIndex + 1, filteredProducts.length - 1);
    else if (key === 'ArrowUp') nextRow = Math.max(rowIndex - 1, 0);
    else if (key === 'ArrowRight') nextCol = Math.min(colIndex + 1, EDITABLE_COLUMNS.length - 1);
    else if (key === 'ArrowLeft') nextCol = Math.max(colIndex - 1, 0);
    if (nextRow === rowIndex && nextCol === colIndex) return;
    const nextProduct = filteredProducts[nextRow];
    if (!nextProduct) return;
    const nextField = EDITABLE_COLUMNS[nextCol];
    const nextInputKey = `${nextProduct.id}-${nextField}`;
    setTimeout(() => {
      const nextInput = editInputRefs.current[nextInputKey];
      if (nextInput) {
        nextInput.focus();
        if (typeof nextInput.select === 'function') nextInput.select();
      }
    }, 10);
  };

  const handleSaveChanges = async () => {
    const productsToUpdate = Object.values(editedProducts).filter(p => JSON.stringify(products.find(op => op.id === p.id)) !== JSON.stringify(p));
    if (productsToUpdate.length === 0) {
      toast({ title: "No Changes", description: "No products were modified." });
      setIsEditMode(false);
      return;
    }
    try {
      await handlers.products.batchUpdate(productsToUpdate);
      toast({ title: "Success", description: "All changes have been saved." });
      setEditedProducts({});
      setIsEditMode(false);
    } catch (error) {
      toast({ title: "Error Saving", description: error.message, variant: "destructive" });
    }
  };

  const handleRowClick = (product, e) => {
    if (e.target.closest('.checkbox-cell') || e.target.closest('[data-radix-checkbox-root]') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    if (!isEditMode) {
      setSelectedProduct(product);
      setProductModalMode('view');
    }
  };
  
  const handleAddProductClick = () => {
    setSelectedProduct({ name: '', price: null, cost_price: null, stock: null, barcode: '', sku: '', category_id: null, description: '', brand: '', details: {}, image_url: null });
    setProductModalMode('edit');
  };

  const handleAddNewRow = async (newProductData) => {
    try {
      const productToAdd = {
        name: newProductData.name || '',
        price: parseFloat(newProductData.price) || 0,
        cost_price: parseFloat(newProductData.cost_price) || 0,
        stock: parseInt(newProductData.stock) || 0,
        barcode: newProductData.barcode || '',
        sku: newProductData.sku || '',
        category_id: newProductData.category_id || null,
        description: newProductData.description || '',
        brand: newProductData.brand || '',
        details: {},
      };

      // Validate required fields
      if (!productToAdd.name.trim()) {
        toast({ title: "Error", description: "Product name is required", variant: "destructive" });
        return false;
      }

      await handlers.products.add(productToAdd);
      toast({ title: "Success", description: `${productToAdd.name} has been added` });
      
      // Clear the new row data
      setNewRowData({
        name: '',
        category_id: '',
        cost_price: 0,
        price: 0,
        stock: 0,
        barcode: '',
        sku: '',
      });
      
      return true;
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [{ name: 'Sample T-Shirt', price: 19.99, cost_price: 12.00, stock: 100, barcode: '1234567890123', sku: 'TSH-001', category_name: 'Apparel', description: 'A cool t-shirt', brand: 'POS Inc.' }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, "ProductUploadTemplate.xlsx");
    toast({ title: "Template Downloaded", description: "ProductUploadTemplate.xlsx has been downloaded." });
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        const categoryMap = categories.reduce((acc, cat) => { acc[cat.name.toLowerCase()] = cat.id; return acc; }, {});
        const productsToUpload = json.map(row => {
          const category_id = categoryMap[row.category_name?.toLowerCase()] || null;
          if (!category_id && row.category_name) toast({ title: "Warning", description: `Category "${row.category_name}" not found for product "${row.name}". It will be added without a category.`, variant: "destructive" });
          return { name: row.name, price: parseFloat(row.price) || 0, cost_price: parseFloat(row.cost_price) || 0, stock: parseInt(row.stock, 10) || 0, barcode: row.barcode?.toString() || null, sku: row.sku?.toString() || null, category_id, description: row.description || null, brand: row.brand || null, details: row.details || {} };
        });
        for (const product of productsToUpload) { await handlers.products.add(product); }
        toast({ title: "Upload Successful", description: `${productsToUpload.length} products have been uploaded.` });
      } catch (error) {
        toast({ title: "Upload Failed", description: "Please check the file format or content.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  };

  const renderProductRow = (product, rowIndex) => {
    const edited = editedProducts[product.id] || product;
    const profitMargin = edited.price && edited.cost_price ? ((edited.price - edited.cost_price) / edited.price * 100).toFixed(1) : 0;
    const isSelected = selectedProductIds.has(product.id);

    return (
      <tr key={product.id} onClick={(e) => handleRowClick(product, e)} className={`${isEditMode ? '' : 'hover:bg-secondary cursor-pointer'} ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''}`} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleRowClick(product, e)}>
        <td className="px-4 py-2 checkbox-cell" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={isSelected} 
            onCheckedChange={(checked) => handleSelectOne(product.id, { stopPropagation: () => {} })} 
            aria-label={`Select product ${product.name}`} 
          />
        </td>
        {isEditMode ? (
          <>
            <td className="px-2 py-1 align-middle"><div className="flex items-center space-x-2"><Input ref={el => editInputRefs.current[`${product.id}-name`] = el} value={edited.name || ''} onChange={e => handleInputChange(product.id, 'name', e.target.value)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 0)} /></div></td>
            <td className="px-2 py-1 align-middle"><select ref={el => editInputRefs.current[`${product.id}-category_id`] = el} value={edited.category_id || ''} onChange={e => handleInputChange(product.id, 'category_id', e.target.value)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 1)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="">None</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
            <td className="px-2 py-1 align-middle"><CurrencyInput ref={el => editInputRefs.current[`${product.id}-cost_price`] = el} value={edited.cost_price} onChange={val => handleInputChange(product.id, 'cost_price', val)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 2)} /></td>
            <td className="px-2 py-1 align-middle"><CurrencyInput ref={el => editInputRefs.current[`${product.id}-price`] = el} value={edited.price} onChange={val => handleInputChange(product.id, 'price', val)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 3)} /></td>
            <td className="px-6 py-4 text-center align-middle text-sm"><span className={`font-medium ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-yellow-600' : 'text-red-600'}`}>{profitMargin > 0 ? `${profitMargin}%` : '-'}</span></td>
            <td className="px-2 py-1 align-middle"><div className="flex items-center space-x-2"><Button size="icon" variant="outline" onClick={() => handleInputChange(product.id, 'stock', Math.max(0, (edited.stock || 0) - 1))}><Minus className="w-4 h-4" /></Button><Input ref={el => editInputRefs.current[`${product.id}-stock`] = el} type="number" className="w-16 text-center" value={edited.stock || ''} onChange={e => handleInputChange(product.id, 'stock', e.target.value)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 4)} placeholder="0" /><Button size="icon" variant="outline" onClick={() => handleInputChange(product.id, 'stock', (edited.stock || 0) + 1)}><Plus className="w-4 h-4" /></Button></div></td>
            <td className="px-2 py-1 align-middle"><Input ref={el => editInputRefs.current[`${product.id}-barcode`] = el} value={edited.barcode || ''} onChange={e => handleInputChange(product.id, 'barcode', e.target.value)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 5)} /></td>
            <td className="px-2 py-1 align-middle"><Input ref={el => editInputRefs.current[`${product.id}-sku`] = el} value={edited.sku || ''} onChange={e => handleInputChange(product.id, 'sku', e.target.value)} onKeyDown={e => handleCellKeyDown(e, rowIndex, 6)} /></td>
          </>
        ) : (
          <>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium"><div className="flex items-center space-x-3">{product.image_url ? <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded-lg" /> : <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center"><Image className="w-5 h-5 text-muted-foreground" /></div>}<span>{product.name}</span></div></td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{categories.find(c => c.id === product.category_id)?.name || 'N/A'}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">${(product.cost_price || 0).toFixed(2)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">${(product.price || 0).toFixed(2)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-center"><span className={`font-medium ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-yellow-600' : 'text-red-600'}`}>{profitMargin > 0 ? `${profitMargin}%` : '-'}</span></td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.stock}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.barcode}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.sku}</td>
          </>
        )}
      </tr>
    );
  };

  return (
    <>
      <motion.div key="inventory" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-full p-4 sm:p-6 flex flex-col relative">
        {/* Action Bar - Responsive */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 mb-4 sm:mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input ref={searchInputRef} type="text" placeholder="Search products by name, barcode, or SKU..." value={effectiveSearchTerm} onChange={(e) => {
              // When user types, keep current filter mode as-is
              setSearchTerm(e.target.value);
            }} className="w-full pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {isEditMode ? 
              <Button onClick={handleSaveChanges} className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none">
                <Save className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Save Changes</span>
              </Button> 
              : 
              <Button onClick={() => setIsEditMode(true)} className="flex-1 sm:flex-none">
                <Edit className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Edit Mode</span>
              </Button>
            }
            <Button onClick={() => setCategoryManagerOpen(true)} variant="outline" className="flex-1 sm:flex-none">
              <LayoutGrid className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Categories</span>
            </Button>
            <Button onClick={handleDownloadTemplate} variant="outline" className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button onClick={() => fileInputRef.current.click()} variant="outline" className="flex-1 sm:flex-none">
              <Upload className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Import</span>
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
            <Button onClick={handleAddProductClick} className="flex-1 sm:flex-none">
              <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Item</span>
            </Button>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:flex md:flex-col flex-grow bg-card shadow-md overflow-hidden rounded-t-xl">
          <div className="overflow-auto flex-grow">
            <table className="w-full">
              <thead className="bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3"><Checkbox checked={selectedProductIds.size > 0 && selectedProductIds.size === filteredProducts.length} onCheckedChange={handleSelectAll} aria-label="Select all" /></th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Selling Price</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Barcode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product, index) => renderProductRow(product, index))}
                {isEditMode && (
                  <tr className="bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 border-t-2 border-green-300">
                    <td className="px-4 py-3 text-center">
                      <Plus className="w-5 h-5 text-green-600 mx-auto" />
                    </td>
                    <td className="px-2 py-3">
                      <input 
                        type="text" 
                        placeholder="Product name" 
                        className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-800"
                        value={newRowData.name}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <select 
                        className="w-full px-2 py-1 border rounded bg-white dark:bg-gray-800"
                        value={activeCategory !== 'all' ? activeCategory : (newRowData.category_id || '')}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, category_id: e.target.value }))}
                      >
                        <option value="">None</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-3">
                      <CurrencyInput 
                        value={newRowData.cost_price} 
                        onChange={(val) => setNewRowData(prev => ({ ...prev, cost_price: val }))}
                        placeholder="Cost"
                      />
                    </td>
                    <td className="px-2 py-3">
                      <CurrencyInput 
                        value={newRowData.price} 
                        onChange={(val) => setNewRowData(prev => ({ ...prev, price: val }))}
                        placeholder="Price"
                      />
                    </td>
                    <td className="px-6 py-3 text-center">-</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center space-x-2">
                        <Input 
                          type="number" 
                          className="w-16 text-center" 
                          placeholder="0"
                          value={newRowData.stock}
                          onChange={(e) => setNewRowData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <Input 
                        type="text" 
                        placeholder="Barcode"
                        value={newRowData.barcode}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, barcode: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <Input 
                        type="text" 
                        placeholder="SKU"
                        value={newRowData.sku}
                        onChange={(e) => setNewRowData(prev => ({ ...prev, sku: e.target.value }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        onClick={async () => {
                          const success = await handleAddNewRow(newRowData);
                          if (success) {
                            // Auto-focus to name field for quick bulk adding
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col flex-grow overflow-hidden bg-card shadow-md rounded-t-xl">
          <div className="overflow-auto flex-grow p-3">
            <div className="space-y-3">
          {filteredProducts.map(product => {
            const edited = editedProducts[product.id] || product;
            const profitMargin = edited.price && edited.cost_price ? ((edited.price - edited.cost_price) / edited.price * 100).toFixed(1) : 0;
            const isSelected = selectedProductIds.has(product.id);
            const category = categories.find(c => c.id === product.category_id);

            return (
              <motion.div 
                key={product.id}
                className={`bg-card rounded-lg shadow p-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                onClick={(e) => !isEditMode && handleRowClick(product, e)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <Checkbox 
                      checked={isSelected} 
                      onCheckedChange={(checked) => handleSelectOne(product.id, { stopPropagation: () => {} })} 
                      onClick={(e) => e.stopPropagation()}
                    />
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />
                    ) : (
                      <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {isEditMode ? (
                        <Input 
                          value={edited.name || ''} 
                          onChange={e => handleInputChange(product.id, 'name', e.target.value)} 
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold mb-1"
                        />
                      ) : (
                        <h3 className="font-semibold text-base truncate">{product.name}</h3>
                      )}
                      {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Price</p>
                    {isEditMode ? (
                      <CurrencyInput 
                        value={edited.price} 
                        onChange={val => handleInputChange(product.id, 'price', val)} 
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm"
                      />
                    ) : (
                      <p className="font-semibold">${(product.price || 0).toFixed(2)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Cost</p>
                    {isEditMode ? (
                      <CurrencyInput 
                        value={edited.cost_price} 
                        onChange={val => handleInputChange(product.id, 'cost_price', val)} 
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm"
                      />
                    ) : (
                      <p className="font-semibold">${(product.cost_price || 0).toFixed(2)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Stock</p>
                    {isEditMode ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleInputChange(product.id, 'stock', Math.max(0, (edited.stock || 0) - 1))}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input 
                          type="number" 
                          className="w-14 text-center text-sm h-7" 
                          value={edited.stock || ''} 
                          onChange={e => handleInputChange(product.id, 'stock', e.target.value)} 
                        />
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleInputChange(product.id, 'stock', (edited.stock || 0) + 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="font-semibold">{product.stock}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Margin</p>
                    <p className={`font-semibold ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {profitMargin > 0 ? `${profitMargin}%` : '-'}
                    </p>
                  </div>
                </div>

                {(product.barcode || product.sku || isEditMode) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Barcode</p>
                      {isEditMode ? (
                        <Input 
                          value={edited.barcode || ''} 
                          onChange={e => handleInputChange(product.id, 'barcode', e.target.value)} 
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Barcode"
                          className="text-sm h-8"
                        />
                      ) : (
                        <p className="text-xs">{product.barcode || '-'}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">SKU</p>
                      {isEditMode ? (
                        <Input 
                          value={edited.sku || ''} 
                          onChange={e => handleInputChange(product.id, 'sku', e.target.value)} 
                          onClick={(e) => e.stopPropagation()}
                          placeholder="SKU"
                          className="text-sm h-8"
                        />
                      ) : (
                        <p className="text-xs">{product.sku || '-'}</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
            </div>
          </div>
        </div>

        {/* Category Tabs - Shown on both desktop and mobile */}
        <div className="p-3 border-t border-border bg-card rounded-b-xl shadow-md">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex-wrap h-auto w-full justify-start">
              <TabsTrigger value="all">All Items</TabsTrigger>
              {categories.map(cat => (<TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>))}
            </TabsList>
          </Tabs>
        </div>

        {selectedProduct && <ProductDetailModal isOpen={!!selectedProduct} onClose={() => setSelectedProduct(null)} product={selectedProduct} categories={categories} handlers={handlers} initialMode={productModalMode} onSave={async (p) => { try { if (p.id) { await handlers.products.update(p); } else { await handlers.products.add(p); } } catch (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); } }} onDelete={handlers.products.delete} />}
        <AnimatePresence>
          {selectedProductIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-6 right-6 z-20 left-6 md:left-auto"
            >
              <div className="p-3 bg-card rounded-xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 border">
                <span className="text-sm font-medium px-2 text-center sm:text-left">{selectedProductIds.size} selected</span>
                <Button variant="outline" size="sm" onClick={() => setIsBulkEditModalOpen(true)} className="flex-1 sm:flex-none">
                  <Edit2 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Bulk Edit</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsPrintLabelsModalOpen(true)} className="flex-1 sm:flex-none">
                  <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Print Labels</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="flex-1 sm:flex-none">
                  <Trash2 className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <Dialog open={isCategoryManagerOpen} onOpenChange={setCategoryManagerOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Add, edit, or delete your product categories here.</DialogDescription>
          </DialogHeader>
          <CategoriesManager categories={categories} handlers={handlers} />
        </DialogContent>
      </Dialog>
      <BulkEditModal isOpen={isBulkEditModalOpen} onClose={() => setIsBulkEditModalOpen(false)} selectedIds={selectedProductIds} handlers={handlers} categories={categories} />
      <PrintLabelsModal isOpen={isPrintLabelsModalOpen} onClose={() => setIsPrintLabelsModalOpen(false)} selectedProducts={products.filter(p => selectedProductIds.has(p.id))} source="inventory" />
    </>
  );
};

export default InventoryView;