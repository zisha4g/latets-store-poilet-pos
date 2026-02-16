import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Plus, Trash2, Upload, X, Edit, Save, Check, ChevronsUpDown } from 'lucide-react';
import CurrencyInput from '../ui/CurrencyInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const CategoryCombobox = ({ categories, value, onSelect, onAddNew, disabled }) => {
    const [open, setOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const selectedCategory = categories.find(cat => cat.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedCategory ? selectedCategory.name : "Select a category..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput 
                        placeholder="Search or create category..." 
                        value={newCategoryName}
                        onValueChange={setNewCategoryName}
                    />
                    <CommandList>
                        <CommandEmpty>
                            <Button className="w-full" variant="outline" onClick={() => onAddNew(newCategoryName).then(() => setOpen(false))}>
                                <Plus className="mr-2 h-4 w-4" /> Create "{newCategoryName}"
                            </Button>
                        </CommandEmpty>
                        <CommandGroup>
                            {categories.map((category) => (
                                <CommandItem
                                    key={category.id}
                                    value={category.name}
                                    onSelect={() => {
                                        onSelect(category.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === category.id ? "opacity-100" : "opacity-0")} />
                                    {category.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const ProductDetailModal = ({ product, categories, isOpen, onClose, onSave, onDelete, handlers, initialMode = 'view', addToLibraryCheckbox = false, addToLibrary = true, setAddToLibrary = null }) => {
  const [editedProduct, setEditedProduct] = useState(product);
  const [isEditing, setIsEditing] = useState(initialMode === 'edit');
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setEditedProduct(product);
    setImagePreview(product?.image_url || null);
    setIsEditing(initialMode === 'edit' || !product?.id);
  }, [product, initialMode]);

  if (!product) return null;

  const handleSave = () => {
    onSave(editedProduct);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this product? This action cannot be undone.")) {
        onDelete(product.id);
        onClose();
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedProduct(prev => ({ ...prev, [name]: value }));
  };
  
  const handlePriceChange = (field, price) => {
    setEditedProduct(prev => ({ ...prev, [field]: price }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" });
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageUrl = event.target.result;
        setImagePreview(imageUrl);
        setEditedProduct(prev => ({ ...prev, image_url: imageUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview(null);
    setEditedProduct(prev => ({ ...prev, image_url: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDetailsChange = (index, key, value) => {
    const newDetails = { ...(editedProduct.details || {}) };
    const oldKey = Object.keys(newDetails)[index];
    if (oldKey !== key) {
      delete newDetails[oldKey];
    }
    newDetails[key] = value;
    setEditedProduct(prev => ({ ...prev, details: newDetails }));
  };

  const handleAddField = () => {
    const newDetails = { ...(editedProduct.details || {}), ['New Field']: '' };
    setEditedProduct(prev => ({ ...prev, details: newDetails }));
  };

  const handleDeleteField = (key) => {
    const newDetails = { ...(editedProduct.details || {}) };
    delete newDetails[key];
    setEditedProduct(prev => ({ ...prev, details: newDetails }));
  };

  const handleAddNewCategory = async (newCategoryName) => {
    if (!newCategoryName.trim()) return;
    try {
      const newCategory = await handlers.categories.add({ name: newCategoryName });
      setEditedProduct(prev => ({ ...prev, category_id: newCategory.id }));
      toast({ title: "Category Added", description: `"${newCategoryName}" has been added and selected.` });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-2xl lg:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{product.id ? (isEditing ? 'Edit Product' : 'Product Details') : 'Add New Product'}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Make changes to your product here. Click save when you're done." : `Viewing details for ${product.name}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name</Label>
              <Input id="name" name="name" value={editedProduct.name || ''} onChange={handleChange} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input id="brand" name="brand" value={editedProduct.brand || ''} onChange={handleChange} disabled={!isEditing} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex items-center space-x-4">
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Product preview" className="w-24 h-24 object-cover rounded-lg border" />
                  {isEditing && (
                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 w-6 h-6" onClick={removeImage}>
                      <X className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="w-24 h-24 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              {isEditing && (
                <div>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload Image
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  <p className="text-xs text-muted-foreground mt-1">Max 5MB, JPG/PNG</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" value={editedProduct.description || ''} onChange={handleChange} disabled={!isEditing} />
          </div>
          
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Selling Price</Label>
              <CurrencyInput value={editedProduct.price} onChange={(val) => handlePriceChange('price', val)} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price</Label>
              <CurrencyInput value={editedProduct.cost_price || 0} onChange={(val) => handlePriceChange('cost_price', val)} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input id="stock" name="stock" type="number" value={editedProduct.stock || ''} onChange={handleChange} placeholder="0" disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" name="barcode" value={editedProduct.barcode || ''} onChange={handleChange} disabled={!isEditing} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" value={editedProduct.sku || ''} onChange={handleChange} disabled={!isEditing} />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="category_id">Category</Label>
             <CategoryCombobox
                categories={categories}
                value={editedProduct.category_id}
                onSelect={(catId) => setEditedProduct(p => ({...p, category_id: catId}))}
                onAddNew={handleAddNewCategory}
                disabled={!isEditing}
            />
          </div>
          
          <div>
            <Label>Additional Details</Label>
            <div className="space-y-2 mt-2">
              {Object.entries(editedProduct.details || {}).map(([key, value], index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input placeholder="Field Name (e.g., Color)" value={key} onChange={(e) => handleDetailsChange(index, e.target.value, value)} disabled={!isEditing} />
                  <Input placeholder="Field Value (e.g., White)" value={value} onChange={(e) => handleDetailsChange(index, key, e.target.value)} disabled={!isEditing} />
                  {isEditing && <Button variant="ghost" size="icon" onClick={() => handleDeleteField(key)}><Trash2 className="w-4 h-4 text-red-500" /></Button>}
                </div>
              ))}
            </div>
            {isEditing && <Button variant="outline" size="sm" className="mt-2" onClick={handleAddField}><Plus className="w-4 h-4 mr-2" /> Add Field</Button>}
          </div>

          {addToLibraryCheckbox && (
            <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <input
                type="checkbox"
                id="addToLibrary"
                checked={addToLibrary}
                onChange={(e) => setAddToLibrary?.(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="addToLibrary" className="cursor-pointer text-sm font-medium">
                Add to product library (saves to database)
              </label>
              <span className="text-xs text-gray-500 ml-auto">
                {addToLibrary ? "Will be saved" : "One-time use only"}
              </span>
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          <div>
            {product.id && isEditing && <Button type="button" variant="destructive" onClick={handleDelete}>Delete Product</Button>}
          </div>
          <div className="flex space-x-2">
            {isEditing ? (
              <>
                <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                <Button type="button" onClick={handleSave}><Save className="w-4 h-4 mr-2" />Save</Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                <Button type="button" onClick={() => setIsEditing(true)}><Edit className="w-4 h-4 mr-2" />Edit</Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailModal;