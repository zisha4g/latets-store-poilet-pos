import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const FinancialReportsView = ({ data }) => {
  const [reportType, setReportType] = useState(null);

  const generateReport = (type) => {
    // In a real app, this would fetch/calculate data
    setReportType(type);
  };

  const renderReport = () => {
    if (!reportType) {
      return <p className="text-muted-foreground">Select a report to generate.</p>;
    }
    // Placeholder for actual report components
    return (
      <Card>
        <CardHeader>
          <CardTitle>{reportType}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Report data for {reportType} would be displayed here.</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <motion.div
      key="reports"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full p-6 flex flex-col"
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-primary">Financial Reports</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Available Reports</CardTitle>
              <CardDescription>Select a report to view.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => generateReport('Profit & Loss')}>Profit & Loss</Button>
              <Button variant="outline" onClick={() => generateReport('Balance Sheet')}>Balance Sheet</Button>
              <Button variant="outline" onClick={() => generateReport('Cash Flow Statement')}>Cash Flow Statement</Button>
              <Button variant="outline" onClick={() => generateReport('Trial Balance')}>Trial Balance</Button>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-3">
          {renderReport()}
        </div>
      </div>
    </motion.div>
  );
};

export default FinancialReportsView;