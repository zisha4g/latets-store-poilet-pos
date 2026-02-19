import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import InventoryAlerts from './InventoryAlerts';
import { Plus, Edit, Search, LayoutGrid, Download, Upload, Image, Trash2, Printer, Edit2, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import ProductDetailModal from './ProductDetailModal';
import CategoriesManager from './CategoriesManager';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { Checkbox } from '@/components/ui/checkbox';
import BulkEditModal from './BulkEditModal';
import LabelDesigner from './LabelDesigner';
import PrintLabelsModal from './PrintLabelsModal';
import { useResponsive } from '@/lib/responsive';
import InventoryExcelMode from './InventoryExcelMode';

const InventoryView = ({ products, categories, handlers, sales = [], searchQuery, onSearchQueryChange, filterMode, onFilterModeChange }) => {
  const { isMobile } = useResponsive();
  const [isEditMode, setIsEditMode] = useState(false);
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [importReviewData, setImportReviewData] = useState({ newItems: [], updatedItems: [], duplicates: [] });

  // Pre-compute sold count per product from sales data
  const soldCountMap = useMemo(() => {
    const map = {};
    (sales || []).forEach(sale => {
      (sale.items || []).forEach(item => {
        const pid = item.product_id || item.id;
        if (pid) map[pid] = (map[pid] || 0) + (item.quantity || 0);
      });
    });
    return map;
  }, [sales]);

  // Allow parent to control search/filter, fallback to local state if not provided
  const [searchTermLocal, setSearchTermLocal] = useState('');
  const effectiveSearchTerm = (typeof searchQuery === 'string') ? searchQuery : searchTermLocal;
  const setSearchTerm = onSearchQueryChange || setSearchTermLocal;

  const [filterModeLocal, setFilterModeLocal] = useState('all');
  const effectiveFilterMode = filterMode || filterModeLocal;
  const setEffectiveFilterMode = onFilterModeChange || setFilterModeLocal;

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productModalMode, setProductModalMode] = useState('view');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isPrintLabelsModalOpen, setIsPrintLabelsModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => { searchInputRef.current?.focus(); }, []);

  useHotkeys([
    ['f2', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }],
    ['mod+f', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }],
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
    setSelectedProductIds(checked ? new Set(filteredProducts.map(p => p.id)) : new Set());
  };

  const handleSelectOne = (productId, e) => {
    e.stopPropagation();
    const s = new Set(selectedProductIds);
    s.has(productId) ? s.delete(productId) : s.add(productId);
    setSelectedProductIds(s);
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

  const handleRowClick = (product, e) => {
    if (e.target.closest('.checkbox-cell') || e.target.closest('[data-radix-checkbox-root]') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) return;
    setSelectedProduct(product);
    setProductModalMode('view');
  };

  const handleAddProductClick = () => {
    setSelectedProduct({ name: '', price: null, cost_price: null, stock: null, barcode: '', sku: '', category_id: null, description: '', brand: '', details: {}, image_url: null });
    setProductModalMode('edit');
  };

  const handleDownloadTemplate = () => {
    const templateData = [{ name: 'Sample T-Shirt', price: 19.99, cost_price: 12.00, stock: 100, barcode: '1234567890123', sku: 'TSH-001', category_name: 'Apparel', description: 'A cool t-shirt', brand: 'POS Inc.' }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.writeFile(workbook, "ProductUploadTemplate.xlsx");
    setExportPopoverOpen(false);
    toast({ title: "Template Downloaded", description: "ProductUploadTemplate.xlsx has been downloaded." });
  };

  const handleExportItemsExcel = () => {
    const exportData = products.map(p => ({
      name: p.name || '',
      price: p.price || 0,
      cost_price: p.cost_price || 0,
      stock: p.stock || 0,
      barcode: p.barcode || '',
      sku: p.sku || '',
      category_name: categories.find(c => c.id === p.category_id)?.name || '',
      description: p.description || '',
      brand: p.brand || '',
      sold: soldCountMap[p.id] || 0,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExportPopoverOpen(false);
    toast({ title: "Export Successful", description: `${products.length} products exported to Excel.` });
  };

  const handleExportItemsPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Inventory Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);
    doc.text(`Total Products: ${products.length}`, 14, 34);
    const headers = [['Product', 'Category', 'Cost', 'Price', 'Margin', 'Stock', 'Sold', 'Barcode', 'SKU']];
    const rows = products.map(p => {
      const cat = categories.find(c => c.id === p.category_id)?.name || 'N/A';
      const margin = p.price && p.cost_price ? ((p.price - p.cost_price) / p.price * 100).toFixed(1) + '%' : '-';
      return [p.name, cat, `$${(p.cost_price || 0).toFixed(2)}`, `$${(p.price || 0).toFixed(2)}`, margin, p.stock || 0, soldCountMap[p.id] || 0, p.barcode || '', p.sku || ''];
    });
    doc.autoTable({ head: headers, body: rows, startY: 40, styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] } });
    doc.save(`Inventory_${new Date().toISOString().slice(0, 10)}.pdf`);
    setExportPopoverOpen(false);
    toast({ title: "Export Successful", description: `${products.length} products exported to PDF.` });
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

        const parsed = json.map(row => {
          const category_id = categoryMap[row.category_name?.toLowerCase()] || null;
          if (!category_id && row.category_name) toast({ title: "Warning", description: `Category "${row.category_name}" not found for product "${row.name}".`, variant: "destructive" });
          return { name: row.name, price: parseFloat(row.price) || 0, cost_price: parseFloat(row.cost_price) || 0, stock: parseInt(row.stock, 10) || 0, barcode: row.barcode?.toString() || null, sku: row.sku?.toString() || null, category_id, description: row.description || null, brand: row.brand || null, details: row.details || {} };
        });

        // Smart matching: barcode > SKU > exact name
        const newItems = [];
        const updatedItems = [];
        const duplicates = [];

        for (const item of parsed) {
          const matchByBarcode = item.barcode ? products.find(p => p.barcode && p.barcode === item.barcode) : null;
          const matchBySku = !matchByBarcode && item.sku ? products.find(p => p.sku && p.sku === item.sku) : null;
          const matchByName = !matchByBarcode && !matchBySku && item.name ? products.find(p => p.name?.toLowerCase() === item.name?.toLowerCase()) : null;
          const match = matchByBarcode || matchBySku || matchByName;

          if (match) {
            // Check if anything actually changed
            const hasChanges = ['name', 'price', 'cost_price', 'stock', 'barcode', 'sku', 'category_id', 'description', 'brand']
              .some(key => item[key] != null && String(item[key]) !== String(match[key] ?? ''));
            if (hasChanges) {
              updatedItems.push({ ...item, id: match.id, _matchedBy: matchByBarcode ? 'barcode' : matchBySku ? 'sku' : 'name', _existingName: match.name });
            }
          } else {
            // Check if there's a fuzzy/partial match that might be a duplicate
            const possibleDup = item.name ? products.find(p => p.name?.toLowerCase().includes(item.name?.toLowerCase()) || item.name?.toLowerCase().includes(p.name?.toLowerCase())) : null;
            if (possibleDup) {
              duplicates.push({ ...item, _possibleMatch: possibleDup, _createAsNew: false });
            } else {
              newItems.push(item);
            }
          }
        }

        if (updatedItems.length === 0 && duplicates.length === 0 && newItems.length === 0) {
          toast({ title: "No Changes", description: "All items in the file match your current inventory." });
          return;
        }

        if (duplicates.length > 0) {
          // Show review dialog for potential duplicates
          setImportReviewData({ newItems, updatedItems, duplicates });
          setImportReviewOpen(true);
        } else {
          // No duplicates — process immediately
          await processImport(newItems, updatedItems, []);
        }
      } catch (error) {
        toast({ title: "Upload Failed", description: "Please check the file format or content.", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = null;
  };

  const processImport = async (newItems, updatedItems, duplicatesToCreate) => {
    let created = 0, updated = 0;
    try {
      for (const item of updatedItems) {
        const { _matchedBy, _existingName, ...updateData } = item;
        await handlers.products.update(updateData);
        updated++;
      }
      for (const item of [...newItems, ...duplicatesToCreate]) {
        const { _possibleMatch, _createAsNew, ...addData } = item;
        await handlers.products.add(addData);
        created++;
      }
      toast({ title: "Import Complete", description: `${created} new items created, ${updated} existing items updated.` });
    } catch (error) {
      toast({ title: "Import Error", description: error.message, variant: "destructive" });
    }
  };

  /* ── Excel Mode ── */
  if (isEditMode) {
    return (
      <InventoryExcelMode
        products={products}
        categories={categories}
        handlers={handlers}
        sales={sales}
        onExit={() => setIsEditMode(false)}
      />
    );
  }

  /* ── render product row (normal view only) ── */
  const renderProductRow = (product) => {
    const profitMargin = product.price && product.cost_price ? ((product.price - product.cost_price) / product.price * 100).toFixed(1) : 0;
    const isSelected = selectedProductIds.has(product.id);

    return (
      <tr key={product.id} onClick={(e) => handleRowClick(product, e)} className="hover:bg-secondary cursor-pointer" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleRowClick(product, e)}>
        <td className="px-4 py-3" />
        <td className="px-4 py-3 checkbox-cell" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={(checked) => handleSelectOne(product.id, { stopPropagation: () => {} })} aria-label={`Select product ${product.name}`} />
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
          <div className="flex items-center space-x-3">
            {product.image_url ? <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded-lg" /> : <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center"><Image className="w-5 h-5 text-muted-foreground" /></div>}
            <span>{product.name}</span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{categories.find(c => c.id === product.category_id)?.name || 'N/A'}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">${(product.cost_price || 0).toFixed(2)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">${(product.price || 0).toFixed(2)}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
          <span className={`font-medium ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-yellow-600' : 'text-red-600'}`}>{profitMargin > 0 ? `${profitMargin}%` : '-'}</span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.stock}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground text-center">{soldCountMap[product.id] || 0}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.barcode}</td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{product.sku}</td>
      </tr>
    );
  };

  return (
    <>
      <motion.div
        key="inventory"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full flex flex-col relative p-4 sm:p-6"
      >
        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 mb-4 sm:mb-6">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input ref={searchInputRef} type="text" placeholder="Search products by name, barcode, or SKU..." value={effectiveSearchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setIsEditMode(true)} className="flex-1 sm:flex-none">
              <Edit className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Excel Mode</span>
            </Button>
            <Button onClick={() => setCategoryManagerOpen(true)} variant="outline" className="flex-1 sm:flex-none">
              <LayoutGrid className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Categories</span>
            </Button>
            <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Export</span> <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <button onClick={handleDownloadTemplate} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors text-left">
                  <Download className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Blank Template</p>
                    <p className="text-xs text-muted-foreground">Download template to fill in</p>
                  </div>
                </button>
                <button onClick={handleExportItemsExcel} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors text-left">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="font-medium">Export to Excel</p>
                    <p className="text-xs text-muted-foreground">All items as .xlsx spreadsheet</p>
                  </div>
                </button>
                <button onClick={handleExportItemsPdf} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-secondary transition-colors text-left">
                  <FileText className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="font-medium">Export to PDF</p>
                    <p className="text-xs text-muted-foreground">Inventory report as .pdf</p>
                  </div>
                </button>
              </PopoverContent>
            </Popover>
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
        <div className="hidden md:flex md:flex-col flex-grow overflow-hidden bg-card shadow-md rounded-t-xl">
          <div className="overflow-auto flex-grow">
            <table className="w-full">
              <thead className="bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3" />
                  <th className="px-4 py-3">
                    <Checkbox checked={selectedProductIds.size > 0 && selectedProductIds.size === filteredProducts.length} onCheckedChange={handleSelectAll} aria-label="Select all" />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Selling Price</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Margin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Barcode</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">SKU</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProducts.map((product) => renderProductRow(product))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden flex flex-col flex-grow overflow-hidden bg-card shadow-md rounded-t-xl">
          <div className="overflow-auto flex-grow p-3">
            <div className="space-y-3">
              {filteredProducts.map(product => {
                const profitMargin = product.price && product.cost_price ? ((product.price - product.cost_price) / product.price * 100).toFixed(1) : 0;
                const isSelected = selectedProductIds.has(product.id);
                const category = categories.find(c => c.id === product.category_id);

                return (
                  <motion.div
                    key={product.id}
                    className={`bg-card rounded-lg shadow p-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                    onClick={(e) => handleRowClick(product, e)}
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
                          <h3 className="font-semibold text-base truncate">{product.name}</h3>
                          {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Price</p>
                        <p className="font-semibold">${(product.price || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Cost</p>
                        <p className="font-semibold">${(product.cost_price || 0).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Stock</p>
                        <p className="font-semibold">{product.stock}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Sold</p>
                        <p className="font-semibold">{soldCountMap[product.id] || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Margin</p>
                        <p className={`font-semibold ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {profitMargin > 0 ? `${profitMargin}%` : '-'}
                        </p>
                      </div>
                    </div>

                    {(product.barcode || product.sku) && (
                      <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Barcode</p>
                          <p className="text-xs">{product.barcode || '-'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">SKU</p>
                          <p className="text-xs">{product.sku || '-'}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category Tabs */}
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

      {/* Import Review Dialog — duplicate detection */}
      <Dialog open={importReviewOpen} onOpenChange={setImportReviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Import</DialogTitle>
            <DialogDescription>
              {importReviewData.updatedItems.length > 0 && <span className="block">{importReviewData.updatedItems.length} existing item(s) will be updated.</span>}
              {importReviewData.newItems.length > 0 && <span className="block">{importReviewData.newItems.length} new item(s) will be created.</span>}
              {importReviewData.duplicates.length > 0 && <span className="block">{importReviewData.duplicates.length} potential duplicate(s) found — choose what to do:</span>}
            </DialogDescription>
          </DialogHeader>
          {importReviewData.duplicates.length > 0 && (
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {importReviewData.duplicates.map((dup, idx) => (
                <div key={idx} className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Importing: <span className="text-foreground">{dup.name}</span></p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Similar to existing: <span className="font-medium">{dup._possibleMatch?.name}</span>
                        {dup._possibleMatch?.barcode && <span> (Barcode: {dup._possibleMatch.barcode})</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant={dup._createAsNew ? "default" : "outline"} onClick={() => {
                        setImportReviewData(prev => ({
                          ...prev,
                          duplicates: prev.duplicates.map((d, i) => i === idx ? { ...d, _createAsNew: true } : d)
                        }));
                      }}>Create New</Button>
                      <Button size="sm" variant={!dup._createAsNew ? "default" : "outline"} onClick={() => {
                        setImportReviewData(prev => ({
                          ...prev,
                          duplicates: prev.duplicates.map((d, i) => i === idx ? { ...d, _createAsNew: false } : d)
                        }));
                      }}>Skip</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setImportReviewOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              const duplicatesToCreate = importReviewData.duplicates.filter(d => d._createAsNew);
              await processImport(importReviewData.newItems, importReviewData.updatedItems, duplicatesToCreate);
              setImportReviewOpen(false);
              setImportReviewData({ newItems: [], updatedItems: [], duplicates: [] });
            }}>
              Confirm Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InventoryView;
