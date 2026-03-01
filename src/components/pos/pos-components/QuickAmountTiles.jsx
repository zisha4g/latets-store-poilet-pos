import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, DollarSign } from 'lucide-react';

const DEFAULT_TILES = [
  { label: '$0.25', amount: 0.25 },
  { label: '$0.50', amount: 0.50 },
  { label: '$1', amount: 1 },
  { label: '$2', amount: 2 },
  { label: '$5', amount: 5 },
  { label: '$10', amount: 10 },
  { label: '$20', amount: 20 },
  { label: '$50', amount: 50 },
];

const QuickAmountTiles = ({ onAddAmount, settings, touch = false }) => {
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  // Get user-configured tiles or use defaults
  const tiles = settings?.quickAmountTiles?.value || DEFAULT_TILES;

  const handleAddCustom = () => {
    const price = parseFloat(customPrice);
    if (isNaN(price) || price <= 0) return;
    onAddAmount({
      name: customName.trim() || `Custom $${price.toFixed(2)}`,
      price,
      isCustom: true,
    });
    setCustomName('');
    setCustomPrice('');
  };

  const handleTileClick = (tile) => {
    onAddAmount({
      name: tile.label || `$${tile.amount.toFixed(2)}`,
      price: tile.amount,
      isCustom: true,
    });
  };

  const btnBase = touch
    ? 'h-14 text-lg font-bold rounded-xl active:scale-95 touch-manipulation transition-transform'
    : 'h-10 text-sm font-semibold rounded-lg';

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Quick Amount Tiles */}
      <div className="flex-1">
        <p className={`text-muted-foreground mb-1.5 ${touch ? 'text-sm' : 'text-xs'}`}>Quick Add</p>
        <div className={`grid ${touch ? 'grid-cols-3 gap-2' : 'grid-cols-4 gap-1.5'}`}>
          {tiles.map((tile, idx) => (
            <button
              key={idx}
              onClick={() => handleTileClick(tile)}
              className={`${btnBase} border bg-card hover:bg-secondary active:bg-secondary/80 flex items-center justify-center`}
            >
              {tile.label || `$${tile.amount.toFixed(2)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Amount */}
      <div className="border-t pt-2">
        <p className={`text-muted-foreground mb-1.5 ${touch ? 'text-sm' : 'text-xs'}`}>Custom Amount</p>
        <div className={`flex gap-1.5 ${touch ? '' : ''}`}>
          <Input
            placeholder="Name (optional)"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            className={touch ? 'h-12 text-base flex-1' : 'h-9 text-sm flex-1'}
          />
          <div className="relative">
            <DollarSign className={`absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground ${touch ? 'w-5 h-5' : 'w-4 h-4'}`} />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={customPrice}
              onChange={e => setCustomPrice(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCustom()}
              className={`${touch ? 'h-12 text-base pl-8 w-28' : 'h-9 text-sm pl-7 w-24'}`}
            />
          </div>
          <Button
            onClick={handleAddCustom}
            disabled={!customPrice || isNaN(parseFloat(customPrice)) || parseFloat(customPrice) <= 0}
            className={touch ? 'h-12 px-4 rounded-xl font-bold' : 'h-9 px-3'}
          >
            <Plus className={touch ? 'w-5 h-5' : 'w-4 h-4'} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export { DEFAULT_TILES };
export default QuickAmountTiles;
