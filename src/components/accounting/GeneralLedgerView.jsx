import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import JournalEntryModal from './JournalEntryModal';
import { toast } from '@/components/ui/use-toast';

const GeneralLedgerView = ({ data, handlers }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  const { journalEntries, chartOfAccounts } = data;

  const handleSaveEntry = async (entryData) => {
    try {
      // In a real app, this would be a handler to save the journal entry and its lines.
      toast({ title: 'Success', description: 'Journal entry saved.' });
      setIsModalOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <motion.div
        key="gl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="h-full p-6 flex flex-col"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-primary">General Ledger</h2>
          <Button onClick={() => { setSelectedEntry(null); setIsModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New Journal Entry
          </Button>
        </div>
        <div className="flex-grow overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {(journalEntries || []).map(entry => (
                <tr key={entry.id} className="hover:bg-muted/50">
                  <td className="p-3">{new Date(entry.entry_date).toLocaleDateString()}</td>
                  <td className="p-3">{entry.description}</td>
                  <td className="p-3">
                    {/* Details would be shown here */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(journalEntries || []).length === 0 && (
            <div className="text-center p-8 text-muted-foreground">
              No journal entries found.
            </div>
          )}
        </div>
      </motion.div>
      {isModalOpen && (
        <JournalEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveEntry}
          entry={selectedEntry}
          accounts={chartOfAccounts}
        />
      )}
    </>
  );
};

export default GeneralLedgerView;