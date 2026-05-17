import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { SECTIONS } from './widgets';

const CustomizeDashboardDialog = ({ open, onOpenChange, grouped, setVisible, move, reset }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize your dashboard</DialogTitle>
          <DialogDescription>
            Show or hide widgets and reorder them within each section. Changes are saved automatically.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          <div className="space-y-6">
            {SECTIONS.map((section) => {
              const items = grouped[section.id] || [];
              if (items.length === 0) return null;
              return (
                <div key={section.id}>
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold">{section.title}</h3>
                    <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                  </div>
                  <div className="space-y-1.5 border rounded-lg p-2">
                    {items.map((widget, idx) => {
                      const Icon = widget.icon;
                      return (
                        <div
                          key={widget.id}
                          className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-secondary/50"
                        >
                          <Checkbox
                            id={`widget-${widget.id}`}
                            checked={widget.visible}
                            onCheckedChange={(checked) => setVisible(widget.id, checked === true)}
                          />
                          <label
                            htmlFor={`widget-${widget.id}`}
                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-sm"
                          >
                            {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                            <span className="truncate">{widget.title}</span>
                          </label>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === 0}
                              onClick={() => move(widget.id, 'up')}
                              title="Move up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={idx === items.length - 1}
                              onClick={() => move(widget.id, 'down')}
                              title="Move down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button variant="ghost" onClick={reset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset to defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomizeDashboardDialog;
