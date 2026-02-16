import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2 } from 'lucide-react';
import CurrencyInput from '../ui/CurrencyInput';

const JournalEntryModal = ({ isOpen, onClose, onSave, entry, accounts }) => {
  const [formData, setFormData] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: '',
    lines: [
      { account_id: '', type: 'debit', amount: 0 },
      { account_id: '', type: 'credit', amount: 0 },
    ],
  });

  useEffect(() => {
    if (entry) {
      setFormData(entry);
    }
  }, [entry]);

  const handleHeaderChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...formData.lines];
    newLines[index][field] = value;
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { account_id: '', type: 'debit', amount: 0 }],
    }));
  };

  const removeLine = (index) => {
    const newLines = formData.lines.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, lines: newLines }));
  };

  const totals = formData.lines.reduce(
    (acc, line) => {
      if (line.type === 'debit') acc.debits += Number(line.amount) || 0;
      if (line.type === 'credit') acc.credits += Number(line.amount) || 0;
      return acc;
    },
    { debits: 0, credits: 0 }
  );

  const isBalanced = totals.debits === totals.credits && totals.debits > 0;

  const handleSubmit = () => {
    if (!isBalanced) {
      alert('Debits must equal credits and cannot be zero.');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{entry ? 'Edit Journal Entry' : 'New Journal Entry'}</DialogTitle>
          <DialogDescription>Create a manual journal entry. Debits must equal credits.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="entry_date">Date</Label>
              <Input id="entry_date" type="date" value={formData.entry_date} onChange={(e) => handleHeaderChange('entry_date', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={formData.description} onChange={(e) => handleHeaderChange('description', e.target.value)} placeholder="Entry description" />
            </div>
          </div>

          <div className="border rounded-lg mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-left">Account</th>
                  <th className="p-2 text-right">Debits</th>
                  <th className="p-2 text-right">Credits</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {formData.lines.map((line, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">
                      <Select value={line.account_id} onValueChange={(val) => handleLineChange(index, 'account_id', val)}>
                        <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                        <SelectContent>
                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2">
                      {line.type === 'debit' ? (
                        <CurrencyInput value={line.amount} onChange={(val) => handleLineChange(index, 'amount', val)} />
                      ) : <div className="text-right">-</div>}
                    </td>
                    <td className="p-2">
                      {line.type === 'credit' ? (
                        <CurrencyInput value={line.amount} onChange={(val) => handleLineChange(index, 'amount', val)} />
                      ) : <div className="text-right">-</div>}
                    </td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="icon" onClick={() => removeLine(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/50 font-bold">
                  <td className="p-2 text-right">Totals</td>
                  <td className="p-2 text-right">${totals.debits.toFixed(2)}</td>
                  <td className="p-2 text-right">${totals.credits.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            <div className="p-2">
              <Button variant="outline" size="sm" onClick={addLine}><Plus className="h-4 w-4 mr-2" />Add Line</Button>
            </div>
          </div>
          {!isBalanced && <p className="text-destructive text-sm text-center">Debits and credits are not balanced.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!isBalanced}>Save Entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default JournalEntryModal;