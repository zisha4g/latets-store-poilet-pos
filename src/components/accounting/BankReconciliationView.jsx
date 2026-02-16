import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import { read, utils } from 'xlsx';
import { toast } from '@/components/ui/use-toast';

const BankReconciliationView = () => {
  const [statementLines, setStatementLines] = useState([]);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = utils.sheet_to_json(worksheet);
        // Basic validation and mapping
        const mappedLines = json.map(row => ({
          date: row.Date,
          description: row.Description,
          amount: parseFloat(row.Amount),
        }));
        setStatementLines(mappedLines);
        toast({ title: 'Success', description: 'Bank statement uploaded successfully.' });
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to parse the file.', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <motion.div
      key="bank-rec"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-6 flex flex-col"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-primary">Bank Reconciliation</h2>
        <Button asChild>
          <label htmlFor="statement-upload">
            <Upload className="w-4 h-4 mr-2" /> Upload Statement (CSV)
            <Input id="statement-upload" type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
          </label>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-6 flex-grow">
        <div className="border rounded-lg p-4 flex flex-col">
          <h3 className="font-bold text-lg mb-4">Bank Statement Transactions</h3>
          <div className="flex-grow overflow-auto">
            {statementLines.length > 0 ? (
              <p>{statementLines.length} transactions loaded.</p>
            ) : (
              <p className="text-muted-foreground">Upload a CSV file to begin.</p>
            )}
          </div>
        </div>
        <div className="border rounded-lg p-4 flex flex-col">
          <h3 className="font-bold text-lg mb-4">NPOS Transactions</h3>
          <div className="flex-grow overflow-auto">
            <p className="text-muted-foreground">Matching transactions will appear here.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BankReconciliationView;