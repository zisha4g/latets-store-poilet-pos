import React, { useState, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import jsPDF from 'jspdf';
import JsBarcode from 'jsbarcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Printer, Edit } from 'lucide-react';
import LabelSheet from './LabelSheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import LabelDesigner from './LabelDesigner';

const PrintLabelsModal = ({ isOpen, onClose, selectedProducts, source = 'po' }) => {
  const [showDesigner, setShowDesigner] = useState(false);
  const [fieldsToPrint, setFieldsToPrint] = useState({
    name: true,
    price: true,
    sku: true,
  });
  const [labelType, setLabelType] = useState('sheet');
  const [quantities, setQuantities] = useState({});
  const componentRef = useRef();

  useEffect(() => {
    if (isOpen) {
      const initialQuantities = {};
      selectedProducts.forEach(p => {
        initialQuantities[p.id] = p.quantity || 1;
      });
      setQuantities(initialQuantities);
    }
  }, [isOpen, selectedProducts]);

  const handleQuantityChange = (productId, value) => {
    const newQuantities = { ...quantities };
    newQuantities[productId] = Math.max(0, parseInt(value, 10) || 0);
    setQuantities(newQuantities);
  };

  const handleSheetPrint = useReactToPrint({
    content: () => componentRef.current,
    onAfterPrint: () => onClose(),
  });

  const generateRollPDF = () => {
    const labelWidth = 2.25 * 72;
    const labelHeight = 1.25 * 72;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [labelWidth, labelHeight],
    });

    const canvas = document.createElement('canvas');
    let isFirstPage = true;

    selectedProducts.forEach(product => {
      const quantityToPrint = quantities[product.id] || 0;
      for (let i = 0; i < quantityToPrint; i++) {
        if (!isFirstPage) {
          doc.addPage([labelWidth, labelHeight], 'landscape');
        }
        
        let yPos = 15;
        const margin = 10;
        const maxWidth = labelWidth - (margin * 2);

        if (fieldsToPrint.name) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          const nameLines = doc.splitTextToSize(product.name, maxWidth);
          doc.text(nameLines, labelWidth / 2, yPos, { align: 'center' });
          yPos += (nameLines.length * 8) + 2;
        }

        if (fieldsToPrint.price) {
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(`$${(product.price || 0).toFixed(2)}`, labelWidth / 2, yPos, { align: 'center' });
          yPos += 12;
        }
        
        if (fieldsToPrint.sku && product.sku) {
          try {
            JsBarcode(canvas, product.sku, {
              format: "CODE128",
              width: 1,
              height: 25,
              displayValue: true,
              fontSize: 8,
              margin: 0,
            });
            const barcodeDataUrl = canvas.toDataURL('image/jpeg', 1.0);
            const barcodeWidth = 60;
            const barcodeHeight = (barcodeWidth / canvas.width) * canvas.height;
            doc.addImage(barcodeDataUrl, 'JPEG', (labelWidth - barcodeWidth) / 2, yPos, barcodeWidth, barcodeHeight);
          } catch (e) {
            console.error("Barcode generation failed:", e);
            doc.setFontSize(6);
            doc.text(`SKU: ${product.sku}`, labelWidth / 2, yPos + 10, { align: 'center' });
          }
        }

        isFirstPage = false;
      }
    });

    doc.save('labels-roll.pdf');
    onClose();
  };

  const handlePrint = () => {
    if (labelType === 'sheet') {
      handleSheetPrint();
    } else {
      generateRollPDF();
    }
  };

  const handleFieldChange = (field) => {
    setFieldsToPrint(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handlePreviewEdit = () => {
    setShowDesigner(true);
  };

  const handleCloseDesigner = () => {
    setShowDesigner(false);
  };

  const handleCloseAll = () => {
    setShowDesigner(false);
    onClose();
  };

  if (showDesigner) {
    return (
      <LabelDesigner
        isOpen={true}
        onClose={handleCloseAll}
        selectedProducts={selectedProducts}
        quantities={quantities}
        labelType={labelType}
        fieldsToPrint={fieldsToPrint}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[96vw] sm:max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Print Product Labels</DialogTitle>
          <DialogDescription>
            Configure and print labels for {selectedProducts.length} selected products.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Label Type</Label>
              <Select value={labelType} onValueChange={setLabelType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sheet">Sheet (A4)</SelectItem>
                  <SelectItem value="roll">Roll (2.25" x 1.25")</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="font-medium mb-2">Fields to include:</p>
              <div className="space-y-2">
                {Object.keys(fieldsToPrint).map((field) => (
                  <div key={field} className="flex items-center space-x-2">
                    <Checkbox id={`field-${field}`} checked={fieldsToPrint[field]} onCheckedChange={() => handleFieldChange(field)} />
                    <Label htmlFor={`field-${field}`} className="capitalize">{field}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {source === 'inventory' && (
            <div>
              <p className="font-medium mb-2">Quantities to Print:</p>
              <ScrollArea className="h-48 border rounded-md p-2">
                <div className="space-y-2">
                  {selectedProducts.map(product => (
                    <div key={product.id} className="flex items-center justify-between">
                      <Label htmlFor={`qty-${product.id}`} className="truncate pr-4">{product.name}</Label>
                      <Input
                        id={`qty-${product.id}`}
                        type="number"
                        value={quantities[product.id] || ''}
                        onChange={(e) => handleQuantityChange(product.id, e.target.value)}
                        className="w-20 h-8"
                        min="0"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={handlePreviewEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Preview & Edit
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print Labels
          </Button>
        </DialogFooter>
      </DialogContent>
      <div style={{ display: 'none' }}>
        <LabelSheet ref={componentRef} products={selectedProducts} fields={fieldsToPrint} quantities={quantities} />
      </div>
    </Dialog>
  );
};

export default PrintLabelsModal;