import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, Minus, X } from 'lucide-react';

const CartItem = ({ item, onUpdateQuantity, onToggleTaxable }) => (
  <motion.div layout className="cart-item p-3 flex items-center justify-between">
    <div className="flex-1 mr-2">
      <h4 className="font-medium text-sm truncate">{item.name}</h4>
      <div className="flex items-center space-x-2">
        <span className="font-semibold text-sm text-primary">${(item.price * item.quantity).toFixed(2)}</span>
        <div className="flex items-center space-x-1">
          <input
            type="checkbox"
            id={`taxable-${item.id}`}
            checked={item.taxable !== false}
            onChange={() => onToggleTaxable(item.id)}
            className="h-3 w-3"
          />
          <label htmlFor={`taxable-${item.id}`} className="text-xs text-muted-foreground">
            Taxable
          </label>
        </div>
      </div>
    </div>
    <div className="flex items-center space-x-2">
      <Button size="icon" variant="outline" className="w-7 h-7" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>
        <Minus className="w-4 h-4" />
      </Button>
      <span className="w-8 text-center font-medium">{item.quantity}</span>
      <Button size="icon" variant="outline" className="w-7 h-7" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>
        <Plus className="w-4 h-4" />
      </Button>
      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => onUpdateQuantity(item.id, 0)}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  </motion.div>
);

export default CartItem;