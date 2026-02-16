import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';

const CategoriesView = ({ categories, handlers }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    try {
      await handlers.categories.add({ name: newCategoryName });
      toast({ title: "Success", description: `Category "${newCategoryName}" added.` });
      setNewCategoryName('');
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategory.name.trim()) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    try {
      await handlers.categories.update(editingCategory);
      toast({ title: "Success", description: `Category updated to "${editingCategory.name}".` });
      setEditingCategory(null);
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await handlers.categories.delete(id);
      toast({ title: "Success", description: "Category deleted." });
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <motion.div
      key="categories"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-6 overflow-y-auto"
    >
      <h2 className="text-3xl font-bold gradient-text mb-6">Manage Categories</h2>
      
      <div className="bg-card p-6 rounded-xl shadow-lg mb-6">
        <h3 className="text-lg font-semibold mb-4">Add New Category</h3>
        <div className="flex space-x-2">
          <Input
            placeholder="Enter category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <Button onClick={handleAddCategory}><Plus className="w-4 h-4 mr-2" /> Add</Button>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Existing Categories</h3>
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
              {editingCategory?.id === cat.id ? (
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  className="mr-2"
                />
              ) : (
                <span className="font-medium">{cat.name}</span>
              )}
              <div className="flex space-x-2">
                {editingCategory?.id === cat.id ? (
                  <>
                    <Button size="icon" variant="ghost" className="text-green-400 hover:text-green-300" onClick={handleUpdateCategory}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-gray-400 hover:text-gray-300" onClick={() => setEditingCategory(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" className="hover:text-primary" onClick={() => setEditingCategory(cat)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default CategoriesView;