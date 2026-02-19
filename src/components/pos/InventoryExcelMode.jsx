import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Plus, Save, Search, Minus, LayoutGrid, Download, Upload, Edit2, Copy, Scissors, Clipboard, Loader2, Trash2, Printer, Image, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import CurrencyInput from '../ui/CurrencyInput';
import CategoriesManager from './CategoriesManager';
import BulkEditModal from './BulkEditModal';
import PrintLabelsModal from './PrintLabelsModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { Checkbox } from '@/components/ui/checkbox';
import './InventoryExcelMode.css';

/* ── constants ──────────────────────────────────────────────────────── */
const EDITABLE_COLUMNS = ['name', 'category_id', 'cost_price', 'price', 'stock', 'barcode', 'sku'];
const EXCEL_CELL_INPUT_CLASS = 'excel-cell-input';
const EXCEL_CELL_SELECT_CLASS = 'excel-cell-select';
const DEFAULT_COLUMN_WIDTHS = {
  row: 44, select: 52, name: 320, category: 150, cost_price: 140,
  price: 140, margin: 110, stock: 130, sold: 90, barcode: 190, sku: 130,
};
const COLUMN_TO_FIELD = {
  name: 'name', category: 'category_id', cost_price: 'cost_price',
  price: 'price', stock: 'stock', barcode: 'barcode', sku: 'sku',
};

/* ── component ──────────────────────────────────────────────────────── */
const InventoryExcelMode = ({ products, categories, handlers, sales = [], onExit }) => {
  /* ── state ── */
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [editedProducts, setEditedProducts] = useState({});
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedColumnKey, setSelectedColumnKey] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);
  const [isCategoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isPrintLabelsModalOpen, setIsPrintLabelsModalOpen] = useState(false);
  const [exportPopoverOpen, setExportPopoverOpen] = useState(false);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [importReviewData, setImportReviewData] = useState({ newItems: [], updatedItems: [], duplicates: [] });
  const [newRowData, setNewRowData] = useState({
    name: '', category_id: '', cost_price: 0, price: 0, stock: 0, barcode: '', sku: '',
  });

  /* ── refs ── */
  const searchInputRef = useRef(null);
  const editInputRefs = useRef({});
  const resizeStateRef = useRef(null);
  const fileInputRef = useRef(null);
  const exitRef = useRef(null);
  const dialogOpenRef = useRef(false);

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

  /* ── body-level side-effects ── */
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('excel-mode-active');

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !dialogOpenRef.current) exitRef.current?.();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('excel-mode-active');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => { searchInputRef.current?.focus(); }, []);

  /* ── column resize ── */
  const getColumnStyle = useCallback((columnKey) => {
    const width = columnWidths[columnKey];
    if (!width) return undefined;
    return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` };
  }, [columnWidths]);

  const stopColumnResize = useCallback(() => {
    resizeStateRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', handleColumnResize);
    window.removeEventListener('mouseup', stopColumnResize);
  }, []);

  const handleColumnResize = useCallback((event) => {
    const state = resizeStateRef.current;
    if (!state) return;
    const delta = event.clientX - state.startX;
    const nextWidth = Math.max(70, state.startWidth + delta);
    setColumnWidths(prev => ({ ...prev, [state.columnKey]: nextWidth }));
  }, []);

  const startColumnResize = useCallback((columnKey, event) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStateRef.current = { columnKey, startX: event.clientX, startWidth: columnWidths[columnKey] || 120 };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleColumnResize);
    window.addEventListener('mouseup', stopColumnResize);
  }, [columnWidths, handleColumnResize, stopColumnResize]);

  useEffect(() => () => stopColumnResize(), [stopColumnResize]);

  /* ── filtered products ── */
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return products
      .filter(p => activeCategory === 'all' || p.category_id === activeCategory)
      .filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.barcode?.includes(searchTerm) ||
        p.sku?.toLowerCase().includes(term)
      );
  }, [products, searchTerm, activeCategory]);

  useEffect(() => {
    setSelectedProductIds(new Set());
    setSelectedCell(null);
    setSelectedRowIndex(null);
    setSelectedColumnKey(null);
  }, [searchTerm, activeCategory]);

  /* ── selection helpers ── */
  const setSelection = useCallback(({ cell = null, rowIndex = null, columnKey = null }) => {
    setSelectedCell(cell);
    setSelectedRowIndex(rowIndex);
    setSelectedColumnKey(columnKey);
  }, []);

  const isCellSelected = useCallback((ri, ck) =>
    selectedCell?.rowIndex === ri && selectedCell?.columnKey === ck,
  [selectedCell]);

  const isColumnSelected = useCallback((ck) => selectedColumnKey === ck, [selectedColumnKey]);
  const isRowSelected = useCallback((ri) => selectedRowIndex === ri, [selectedRowIndex]);

  /* ── cell value helpers ── */
  const getCellValue = useCallback((product, columnKey) => {
    if (!columnKey) return '';
    if (columnKey === 'category') {
      return categories.find(c => c.id === product.category_id)?.name || '';
    }
    if (columnKey === 'margin') {
      const m = product.price && product.cost_price
        ? ((product.price - product.cost_price) / product.price * 100).toFixed(1) : '';
      return m ? `${m}%` : '';
    }
    return product[COLUMN_TO_FIELD[columnKey]] ?? '';
  }, [categories]);

  const handleInputChange = (productId, field, value) => {
    const numericFields = ['price', 'cost_price', 'stock'];
    let v = value;
    if (numericFields.includes(field)) {
      v = value === '' ? null : parseFloat(value);
      if (isNaN(v)) v = null;
    }
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...(products.find(p => p.id === productId) || {}),
        ...(prev[productId] || {}),
        [field]: v,
      },
    }));
  };

  const applyCellValue = useCallback((productId, columnKey, value) => {
    if (!COLUMN_TO_FIELD[columnKey]) return;
    if (columnKey === 'category') {
      const match = categories.find(c => c.name?.toLowerCase() === String(value).toLowerCase());
      handleInputChange(productId, 'category_id', match ? match.id : value || null);
      return;
    }
    handleInputChange(productId, COLUMN_TO_FIELD[columnKey], value);
  }, [categories, handleInputChange]);

  /* ── clipboard ── */
  const handleCopySelection = useCallback(async () => {
    let text = '';
    if (selectedCell) {
      const p = filteredProducts[selectedCell.rowIndex];
      if (p) text = String(getCellValue(p, selectedCell.columnKey));
    } else if (selectedRowIndex !== null) {
      const p = filteredProducts[selectedRowIndex];
      if (p) text = EDITABLE_COLUMNS.map(f => getCellValue(p, f === 'category_id' ? 'category' : f)).join('\t');
    } else if (selectedColumnKey) {
      text = filteredProducts.map(p => getCellValue(p, selectedColumnKey)).join('\n');
    }
    if (text) await navigator.clipboard.writeText(text);
  }, [filteredProducts, getCellValue, selectedCell, selectedColumnKey, selectedRowIndex]);

  const handleCutSelection = useCallback(async () => {
    await handleCopySelection();
    if (selectedCell) {
      const p = filteredProducts[selectedCell.rowIndex];
      if (p) applyCellValue(p.id, selectedCell.columnKey, '');
      return;
    }
    if (selectedRowIndex !== null) {
      const p = filteredProducts[selectedRowIndex];
      if (!p) return;
      EDITABLE_COLUMNS.forEach(f => applyCellValue(p.id, f === 'category_id' ? 'category' : f, ''));
      return;
    }
    if (selectedColumnKey) {
      filteredProducts.forEach(p => applyCellValue(p.id, selectedColumnKey, ''));
    }
  }, [applyCellValue, filteredProducts, handleCopySelection, selectedCell, selectedColumnKey, selectedRowIndex]);

  const handlePasteSelection = useCallback(async () => {
    if (!selectedCell) return;
    const clipboardText = await navigator.clipboard.readText();
    if (!clipboardText) return;
    const rows = clipboardText.split(/\r?\n/).filter(Boolean).map(r => r.split('\t'));
    const startRow = selectedCell.rowIndex;
    const startCol = EDITABLE_COLUMNS.findIndex(f => (f === 'category_id' ? 'category' : f) === selectedCell.columnKey);
    if (startCol === -1) return;
    rows.forEach((vals, rOff) => {
      const p = filteredProducts[startRow + rOff];
      if (!p) return;
      vals.forEach((v, cOff) => {
        const field = EDITABLE_COLUMNS[startCol + cOff];
        if (!field) return;
        applyCellValue(p.id, field === 'category_id' ? 'category' : field, v);
      });
    });
  }, [applyCellValue, filteredProducts, selectedCell]);

  /* ── keyboard shortcuts ── */
  useHotkeys([
    ['ctrl+s', (e) => { e.preventDefault(); handleSaveChanges(); }],
    ['f2', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }],
    ['mod+f', (e) => { e.preventDefault(); searchInputRef.current?.focus(); }],
    ['mod+c', (e) => {
      if (!selectedCell && selectedRowIndex === null && !selectedColumnKey) return;
      e.preventDefault(); handleCopySelection();
    }],
    ['mod+x', (e) => {
      if (!selectedCell && selectedRowIndex === null && !selectedColumnKey) return;
      e.preventDefault(); handleCutSelection();
    }],
    ['mod+v', (e) => {
      if (!selectedCell) return;
      e.preventDefault(); handlePasteSelection();
    }],
  ]);

  /* ── select / bulk ── */
  const handleSelectAll = (checked) => {
    setSelectedProductIds(checked ? new Set(filteredProducts.map(p => p.id)) : new Set());
  };

  const handleSelectOne = (productId) => {
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
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
  };

  /* ── cell navigation ── */
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
      const el = editInputRefs.current[nextInputKey];
      if (el) { el.focus(); if (typeof el.select === 'function') el.select(); }
    }, 10);
  };

  /* ── save ── */
  const handleSaveChanges = async ({ exitAfter = false } = {}) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const toUpdate = Object.values(editedProducts).filter(p => {
        const original = products.find(op => op.id === p.id);
        return !original || JSON.stringify(original) !== JSON.stringify(p);
      });
      if (toUpdate.length === 0) {
        toast({ title: "No Changes", description: "No products were modified." });
        setEditedProducts({});
        if (exitAfter) onExit();
        setIsSaving(false);
        return;
      }
      toast({ title: "Saving...", description: "Your changes are being saved." });
      await handlers.products.batchUpdate(toUpdate);
      toast({ title: "Saved", description: "All changes have been saved." });
      setEditedProducts({});
      if (exitAfter) onExit();
    } catch (error) {
      toast({ title: "Error Saving", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  /* ── add new row ── */
  const handleAddNewRow = async () => {
    try {
      const p = {
        name: newRowData.name || '', price: parseFloat(newRowData.price) || 0,
        cost_price: parseFloat(newRowData.cost_price) || 0, stock: parseInt(newRowData.stock) || 0,
        barcode: newRowData.barcode || '', sku: newRowData.sku || '',
        category_id: newRowData.category_id || null, description: '', brand: '', details: {},
      };
      if (!p.name.trim()) {
        toast({ title: "Error", description: "Product name is required", variant: "destructive" });
        return;
      }
      await handlers.products.add(p);
      toast({ title: "Success", description: `${p.name} has been added` });
      setNewRowData({ name: '', category_id: '', cost_price: 0, price: 0, stock: 0, barcode: '', sku: '' });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  /* ── import / export ── */
  const handleDownloadTemplate = () => {
    const data = [{ name: 'Sample T-Shirt', price: 19.99, cost_price: 12.00, stock: 100, barcode: '1234567890123', sku: 'TSH-001', category_name: 'Apparel', description: 'A cool t-shirt', brand: 'POS Inc.' }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "ProductUploadTemplate.xlsx");
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
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const catMap = categories.reduce((a, c) => { a[c.name.toLowerCase()] = c.id; return a; }, {});

        const parsed = json.map(row => {
          const cid = catMap[row.category_name?.toLowerCase()] || null;
          if (!cid && row.category_name) toast({ title: "Warning", description: `Category "${row.category_name}" not found for "${row.name}".`, variant: "destructive" });
          return { name: row.name, price: parseFloat(row.price) || 0, cost_price: parseFloat(row.cost_price) || 0, stock: parseInt(row.stock, 10) || 0, barcode: row.barcode?.toString() || null, sku: row.sku?.toString() || null, category_id: cid, description: row.description || null, brand: row.brand || null, details: row.details || {} };
        });

        const newItems = [];
        const updatedItems = [];
        const duplicates = [];

        for (const item of parsed) {
          const matchByBarcode = item.barcode ? products.find(p => p.barcode && p.barcode === item.barcode) : null;
          const matchBySku = !matchByBarcode && item.sku ? products.find(p => p.sku && p.sku === item.sku) : null;
          const matchByName = !matchByBarcode && !matchBySku && item.name ? products.find(p => p.name?.toLowerCase() === item.name?.toLowerCase()) : null;
          const match = matchByBarcode || matchBySku || matchByName;

          if (match) {
            const hasChanges = ['name', 'price', 'cost_price', 'stock', 'barcode', 'sku', 'category_id', 'description', 'brand']
              .some(key => item[key] != null && String(item[key]) !== String(match[key] ?? ''));
            if (hasChanges) {
              updatedItems.push({ ...item, id: match.id, _matchedBy: matchByBarcode ? 'barcode' : matchBySku ? 'sku' : 'name', _existingName: match.name });
            }
          } else {
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
          setImportReviewData({ newItems, updatedItems, duplicates });
          setImportReviewOpen(true);
        } else {
          await processImport(newItems, updatedItems, []);
        }
      } catch (error) {
        toast({ title: "Upload Failed", description: "Please check the file format.", variant: "destructive" });
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

  /* ── check for real changes ── */
  const hasActualChanges = useCallback(() => {
    const edited = Object.values(editedProducts);
    if (edited.length === 0) return false;
    return edited.some(ep => {
      const original = products.find(p => p.id === ep.id);
      if (!original) return true;
      return JSON.stringify(original) !== JSON.stringify(ep);
    });
  }, [editedProducts, products]);

  /* ── exit handler ── */
  const handleExitClick = () => {
    if (isSaving) return;
    if (hasActualChanges()) {
      setIsExitConfirmOpen(true);
      return;
    }
    onExit();
  };

  // Keep refs in sync so ESC listener can call the latest version
  exitRef.current = handleExitClick;
  dialogOpenRef.current = isExitConfirmOpen || isCategoryManagerOpen || isBulkEditModalOpen || isPrintLabelsModalOpen || importReviewOpen;

  /* ── render product row ── */
  const renderProductRow = (product, rowIndex) => {
    const edited = editedProducts[product.id] || product;
    const profitMargin = edited.price && edited.cost_price
      ? ((edited.price - edited.cost_price) / edited.price * 100).toFixed(1) : 0;
    const isSelected = selectedProductIds.has(product.id);
    const rowSel = isRowSelected(rowIndex);

    return (
      <tr key={product.id} className={`${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''} ${rowSel ? 'excel-row-selected' : ''}`} tabIndex={0}>
        <td style={getColumnStyle('row')} className={`px-1 py-0.5 ${rowSel ? 'excel-row-selected' : ''}`}>
          <button type="button" className="excel-row-handle" onClick={(e) => { e.stopPropagation(); setSelection({ rowIndex }); }}>
            {rowIndex + 1}
          </button>
        </td>
        <td style={getColumnStyle('select')} className={`px-2 py-2 checkbox-cell ${rowSel ? 'excel-row-selected' : ''}`} onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onCheckedChange={() => handleSelectOne(product.id)} aria-label={`Select ${product.name}`} />
        </td>
        <td style={getColumnStyle('name')} className={`px-1 py-0.5 align-middle ${isColumnSelected('name') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'name') ? 'excel-cell-selected' : ''}`}>
          <div className="flex items-center">
            <Input className={EXCEL_CELL_INPUT_CLASS} ref={el => editInputRefs.current[`${product.id}-name`] = el} value={edited.name || ''} onChange={e => handleInputChange(product.id, 'name', e.target.value)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'name' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 0)} />
          </div>
        </td>
        <td style={getColumnStyle('category')} className={`px-1 py-0.5 align-middle ${isColumnSelected('category') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'category') ? 'excel-cell-selected' : ''}`}>
          <select ref={el => editInputRefs.current[`${product.id}-category_id`] = el} value={edited.category_id || ''} onChange={e => handleInputChange(product.id, 'category_id', e.target.value)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'category' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 1)} className={EXCEL_CELL_SELECT_CLASS}>
            <option value="">None</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </td>
        <td style={getColumnStyle('cost_price')} className={`px-2 py-1 align-middle ${isColumnSelected('cost_price') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'cost_price') ? 'excel-cell-selected' : ''}`}>
          <CurrencyInput className={EXCEL_CELL_INPUT_CLASS} ref={el => editInputRefs.current[`${product.id}-cost_price`] = el} value={edited.cost_price} onChange={val => handleInputChange(product.id, 'cost_price', val)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'cost_price' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 2)} />
        </td>
        <td style={getColumnStyle('price')} className={`px-2 py-1 align-middle ${isColumnSelected('price') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'price') ? 'excel-cell-selected' : ''}`}>
          <CurrencyInput className={EXCEL_CELL_INPUT_CLASS} ref={el => editInputRefs.current[`${product.id}-price`] = el} value={edited.price} onChange={val => handleInputChange(product.id, 'price', val)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'price' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 3)} />
        </td>
        <td style={getColumnStyle('margin')} className={`px-3 py-1 text-center align-middle text-sm ${isColumnSelected('margin') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'margin') ? 'excel-cell-selected' : ''}`} onClick={() => setSelection({ cell: { rowIndex, columnKey: 'margin' } })}>
          <span className={`font-medium ${profitMargin > 30 ? 'text-green-600' : profitMargin > 15 ? 'text-yellow-600' : 'text-red-600'}`}>{profitMargin > 0 ? `${profitMargin}%` : '-'}</span>
        </td>
        <td style={getColumnStyle('stock')} className={`px-1 py-0.5 align-middle ${isColumnSelected('stock') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'stock') ? 'excel-cell-selected' : ''}`}>
          <div className="flex items-center space-x-1">
            <Button size="icon" variant="outline" className="h-7 w-7 rounded-none border-0 bg-transparent" onClick={() => handleInputChange(product.id, 'stock', Math.max(0, (edited.stock || 0) - 1))}><Minus className="w-3.5 h-3.5" /></Button>
            <Input ref={el => editInputRefs.current[`${product.id}-stock`] = el} type="number" className={`${EXCEL_CELL_INPUT_CLASS} w-14 text-center`} value={edited.stock || ''} onChange={e => handleInputChange(product.id, 'stock', e.target.value)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'stock' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 4)} placeholder="0" />
            <Button size="icon" variant="outline" className="h-7 w-7 rounded-none border-0 bg-transparent" onClick={() => handleInputChange(product.id, 'stock', (edited.stock || 0) + 1)}><Plus className="w-3.5 h-3.5" /></Button>
          </div>
        </td>
        <td style={getColumnStyle('sold')} className={`px-3 py-1 text-center align-middle text-sm ${isColumnSelected('sold') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'sold') ? 'excel-cell-selected' : ''}`} onClick={() => setSelection({ cell: { rowIndex, columnKey: 'sold' } })}>
          <span className="font-medium text-muted-foreground">{soldCountMap[product.id] || 0}</span>
        </td>
        <td style={getColumnStyle('barcode')} className={`px-1 py-0.5 align-middle ${isColumnSelected('barcode') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'barcode') ? 'excel-cell-selected' : ''}`}>
          <Input className={EXCEL_CELL_INPUT_CLASS} ref={el => editInputRefs.current[`${product.id}-barcode`] = el} value={edited.barcode || ''} onChange={e => handleInputChange(product.id, 'barcode', e.target.value)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'barcode' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 6)} />
        </td>
        <td style={getColumnStyle('sku')} className={`px-1 py-0.5 align-middle ${isColumnSelected('sku') ? 'excel-col-selected' : ''} ${isCellSelected(rowIndex, 'sku') ? 'excel-cell-selected' : ''}`}>
          <Input className={EXCEL_CELL_INPUT_CLASS} ref={el => editInputRefs.current[`${product.id}-sku`] = el} value={edited.sku || ''} onChange={e => handleInputChange(product.id, 'sku', e.target.value)} onFocus={() => setSelection({ cell: { rowIndex, columnKey: 'sku' } })} onKeyDown={e => handleCellKeyDown(e, rowIndex, 7)} />
        </td>
      </tr>
    );
  };

  /* ── header column config ── */
  const HEADER_COLUMNS = [
    { key: 'name', label: 'Product' },
    { key: 'category', label: 'Category' },
    { key: 'cost_price', label: 'Cost Price' },
    { key: 'price', label: 'Selling Price' },
    { key: 'margin', label: 'Margin', center: true },
    { key: 'stock', label: 'Stock' },
    { key: 'sold', label: 'Sold', center: true },
    { key: 'barcode', label: 'Barcode' },
    { key: 'sku', label: 'SKU' },
  ];

  /* ── JSX ── */
  return (
    <>
      <motion.div
        key="excel-mode"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-0 left-0 z-[9999] h-screen w-screen bg-background overflow-hidden p-0 flex flex-col"
      >
        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 px-3 py-2 mb-0 border-b bg-background">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input ref={searchInputRef} type="text" placeholder="Search products by name, barcode, or SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleSaveChanges()} className="bg-green-500 hover:bg-green-600 text-white flex-1 sm:flex-none" disabled={isSaving}>
              {isSaving
                ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /><span className="hidden sm:inline">Saving...</span></>)
                : (<><Save className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Save Changes</span></>)}
            </Button>
            <Button onClick={handleExitClick} variant="outline" className="flex-1 sm:flex-none" disabled={isSaving}>
              <Edit2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Exit Excel Mode</span>
            </Button>
            <Button onClick={handleCopySelection} variant="outline" className="flex-1 sm:flex-none">
              <Copy className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Copy</span>
            </Button>
            <Button onClick={handleCutSelection} variant="outline" className="flex-1 sm:flex-none">
              <Scissors className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Cut</span>
            </Button>
            <Button onClick={handlePasteSelection} variant="outline" className="flex-1 sm:flex-none">
              <Clipboard className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Paste</span>
            </Button>
            <Button onClick={() => setCategoryManagerOpen(true)} variant="outline" className="flex-1 sm:flex-none">
              <LayoutGrid className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Categories</span>
            </Button>
            <Popover open={exportPopoverOpen} onOpenChange={setExportPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 sm:flex-none">
                  <Download className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Export</span> <ChevronDown className="w-3 h-3 ml-1" />
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
              <Upload className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Import</span>
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls, .csv" />
          </div>
        </div>

        {/* ── Desktop Table ── */}
        <div className="hidden md:flex md:flex-col flex-grow overflow-hidden bg-background rounded-none shadow-none border-0">
          <div className="overflow-auto flex-grow">
            <table className="w-full excel-sheet-table">
              <thead className="bg-secondary sticky top-0 z-10">
                <tr>
                  <th style={getColumnStyle('row')} className="px-2 py-2" />
                  <th style={getColumnStyle('select')} className="px-2 py-2">
                    <div className="relative">
                      <Checkbox checked={selectedProductIds.size > 0 && selectedProductIds.size === filteredProducts.length} onCheckedChange={handleSelectAll} aria-label="Select all" />
                      <div className="excel-col-resizer" onMouseDown={(e) => startColumnResize('select', e)} />
                    </div>
                  </th>
                  {HEADER_COLUMNS.map(col => (
                    <th
                      key={col.key}
                      style={getColumnStyle(col.key)}
                      className={`px-3 py-2 ${col.center ? 'text-center' : 'text-left'} text-[11px] font-medium text-muted-foreground uppercase tracking-wide ${isColumnSelected(col.key) ? 'excel-col-selected' : ''}`}
                      onClick={() => setSelection({ columnKey: col.key })}
                    >
                      <div className="relative">
                        {col.label}
                        <div className="excel-col-resizer" onMouseDown={(e) => startColumnResize(col.key, e)} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product, index) => renderProductRow(product, index))}
              </tbody>
              <tfoot className="excel-add-row">
                <tr className="bg-green-50 dark:bg-green-900/20 border-t-2 border-green-300">
                  <td style={getColumnStyle('row')} className="px-1 py-1" />
                  <td style={getColumnStyle('select')} className="px-1 py-1 text-center">
                    <Button size="sm" onClick={handleAddNewRow} className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  </td>
                  <td style={getColumnStyle('name')} className="px-1 py-1">
                    <input type="text" placeholder="Product name" className={EXCEL_CELL_SELECT_CLASS} value={newRowData.name} onChange={(e) => setNewRowData(prev => ({ ...prev, name: e.target.value }))} />
                  </td>
                  <td style={getColumnStyle('category')} className="px-1 py-1">
                    <select className={EXCEL_CELL_SELECT_CLASS} value={activeCategory !== 'all' ? activeCategory : (newRowData.category_id || '')} onChange={(e) => setNewRowData(prev => ({ ...prev, category_id: e.target.value }))}>
                      <option value="">None</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td style={getColumnStyle('cost_price')} className="px-1 py-1">
                    <CurrencyInput className={EXCEL_CELL_INPUT_CLASS} value={newRowData.cost_price} onChange={(val) => setNewRowData(prev => ({ ...prev, cost_price: val }))} placeholder="Cost" />
                  </td>
                  <td style={getColumnStyle('price')} className="px-1 py-1">
                    <CurrencyInput className={EXCEL_CELL_INPUT_CLASS} value={newRowData.price} onChange={(val) => setNewRowData(prev => ({ ...prev, price: val }))} placeholder="Price" />
                  </td>
                  <td style={getColumnStyle('margin')} className="px-1 py-1 text-center">-</td>
                  <td style={getColumnStyle('stock')} className="px-1 py-1">
                    <Input type="number" className={`${EXCEL_CELL_INPUT_CLASS} w-16 text-center`} placeholder="0" value={newRowData.stock} onChange={(e) => setNewRowData(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))} />
                  </td>
                  <td style={getColumnStyle('sold')} className="px-1 py-1 text-center text-muted-foreground">-</td>
                  <td style={getColumnStyle('barcode')} className="px-1 py-1">
                    <Input type="text" placeholder="Barcode" className={EXCEL_CELL_INPUT_CLASS} value={newRowData.barcode} onChange={(e) => setNewRowData(prev => ({ ...prev, barcode: e.target.value }))} />
                  </td>
                  <td style={getColumnStyle('sku')} className="px-1 py-1">
                    <Input type="text" placeholder="SKU" className={EXCEL_CELL_INPUT_CLASS} value={newRowData.sku} onChange={(e) => setNewRowData(prev => ({ ...prev, sku: e.target.value }))} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Mobile Card View ── */}
        <div className="md:hidden flex flex-col flex-grow overflow-hidden bg-background shadow-none rounded-none">
          <div className="overflow-auto flex-grow p-3">
            <div className="space-y-3">
              {filteredProducts.map(product => {
                const edited = editedProducts[product.id] || product;
                const profitMargin = edited.price && edited.cost_price ? ((edited.price - edited.cost_price) / edited.price * 100).toFixed(1) : 0;
                const isSelected = selectedProductIds.has(product.id);
                const category = categories.find(c => c.id === product.category_id);
                return (
                  <div key={product.id} className={`bg-card rounded-lg shadow p-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox checked={isSelected} onCheckedChange={() => handleSelectOne(product.id)} onClick={(e) => e.stopPropagation()} />
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded-lg" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                            <Image className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Input value={edited.name || ''} onChange={e => handleInputChange(product.id, 'name', e.target.value)} onClick={(e) => e.stopPropagation()} className="font-semibold mb-1" />
                          {category && <p className="text-sm text-muted-foreground">{category.name}</p>}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Price</p>
                        <CurrencyInput value={edited.price} onChange={val => handleInputChange(product.id, 'price', val)} onClick={(e) => e.stopPropagation()} className="text-sm" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Cost</p>
                        <CurrencyInput value={edited.cost_price} onChange={val => handleInputChange(product.id, 'cost_price', val)} onClick={(e) => e.stopPropagation()} className="text-sm" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Stock</p>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleInputChange(product.id, 'stock', Math.max(0, (edited.stock || 0) - 1))}><Minus className="w-3 h-3" /></Button>
                          <Input type="number" className="w-14 text-center text-sm h-7" value={edited.stock || ''} onChange={e => handleInputChange(product.id, 'stock', e.target.value)} />
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleInputChange(product.id, 'stock', (edited.stock || 0) + 1)}><Plus className="w-3 h-3" /></Button>
                        </div>
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
                    <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Barcode</p>
                        <Input value={edited.barcode || ''} onChange={e => handleInputChange(product.id, 'barcode', e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="Barcode" className="text-sm h-8" />
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">SKU</p>
                        <Input value={edited.sku || ''} onChange={e => handleInputChange(product.id, 'sku', e.target.value)} onClick={(e) => e.stopPropagation()} placeholder="SKU" className="text-sm h-8" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Category Tabs ── */}
        <div className="sticky bottom-0 z-20 px-2 py-1 border-t border-border bg-background">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex-wrap h-auto w-full justify-start">
              <TabsTrigger value="all">All Items</TabsTrigger>
              {categories.map(cat => (<TabsTrigger key={cat.id} value={cat.id}>{cat.name}</TabsTrigger>))}
            </TabsList>
          </Tabs>
        </div>

        {/* ── Bulk Operations Bar ── */}
        <AnimatePresence>
          {selectedProductIds.size > 0 && (
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="fixed bottom-6 right-6 z-[10000] left-6 md:left-auto">
              <div className="p-3 bg-card rounded-xl shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 border">
                <span className="text-sm font-medium px-2 text-center sm:text-left">{selectedProductIds.size} selected</span>
                <Button variant="outline" size="sm" onClick={() => setIsBulkEditModalOpen(true)} className="flex-1 sm:flex-none">
                  <Edit2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Bulk Edit</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsPrintLabelsModalOpen(true)} className="flex-1 sm:flex-none">
                  <Printer className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Print Labels</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete} className="flex-1 sm:flex-none">
                  <Trash2 className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">Delete</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Category Manager Dialog ── */}
      <Dialog open={isCategoryManagerOpen} onOpenChange={setCategoryManagerOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Add, edit, or delete your product categories here.</DialogDescription>
          </DialogHeader>
          <CategoriesManager categories={categories} handlers={handlers} />
        </DialogContent>
      </Dialog>

      {/* ── Exit Confirmation Dialog ── */}
      <Dialog open={isExitConfirmOpen} onOpenChange={setIsExitConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exit Excel Mode?</DialogTitle>
            <DialogDescription>You have unsaved changes. What would you like to do?</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsExitConfirmOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button variant="outline" onClick={() => { if (isSaving) return; setEditedProducts({}); setIsExitConfirmOpen(false); onExit(); }} disabled={isSaving}>Discard</Button>
            <Button onClick={async () => { if (isSaving) return; await handleSaveChanges({ exitAfter: true }); setIsExitConfirmOpen(false); }} className="bg-green-600 hover:bg-green-700 text-white" disabled={isSaving}>Save & Exit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Modals ── */}
      <BulkEditModal isOpen={isBulkEditModalOpen} onClose={() => setIsBulkEditModalOpen(false)} selectedIds={selectedProductIds} handlers={handlers} categories={categories} />
      <PrintLabelsModal isOpen={isPrintLabelsModalOpen} onClose={() => setIsPrintLabelsModalOpen(false)} selectedProducts={products.filter(p => selectedProductIds.has(p.id))} source="inventory" />

      {/* ── Import Review Dialog ── */}
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

export default InventoryExcelMode;
