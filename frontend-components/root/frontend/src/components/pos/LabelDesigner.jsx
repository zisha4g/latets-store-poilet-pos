import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Printer, Download, AlignLeft, AlignCenter, AlignRight, Eye } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

const LABEL_TEMPLATES = {
  classic: {
    name: 'Classic',
    width: 2.25,
    height: 1.25,
    elements: [
      { id: 'name', type: 'text', x: 81, y: 10, fontSize: 8, fontFamily: 'Arial', fontWeight: 'bold', text: '{name}', align: 'center' },
      { id: 'price', type: 'text', x: 81, y: 28, fontSize: 16, fontFamily: 'Arial', fontWeight: 'bold', text: '${price}', align: 'center' },
      { id: 'barcode', type: 'barcode', x: 81, y: 50, width: 80, height: 20, text: '{sku}', align: 'center' }
    ]
  },
  modern: {
    name: 'Modern',
    width: 2.25,
    height: 1.25,
    elements: [
      { id: 'price', type: 'text', x: 15, y: 18, fontSize: 18, fontFamily: 'Arial', fontWeight: 'bold', text: '${price}', align: 'left' },
      { id: 'name', type: 'text', x: 15, y: 38, fontSize: 7, fontFamily: 'Arial', fontWeight: 'normal', text: '{name}', align: 'left' },
      { id: 'barcode', type: 'barcode', x: 15, y: 50, width: 70, height: 18, text: '{sku}', align: 'left' }
    ]
  },
  minimal: {
    name: 'Minimal',
    width: 2.25,
    height: 1.25,
    elements: [
      { id: 'name', type: 'text', x: 81, y: 30, fontSize: 8, fontFamily: 'Arial', fontWeight: 'normal', text: '{name}', align: 'center' },
      { id: 'price', type: 'text', x: 81, y: 50, fontSize: 14, fontFamily: 'Arial', fontWeight: 'bold', text: '${price}', align: 'center' }
    ]
  },
  retail: {
    name: 'Retail Pro',
    width: 2.25,
    height: 1.25,
    elements: [
      { id: 'name', type: 'text', x: 10, y: 12, fontSize: 8, fontFamily: 'Arial', fontWeight: 'bold', text: '{name}', align: 'left' },
      { id: 'price', type: 'text', x: 152, y: 28, fontSize: 16, fontFamily: 'Arial', fontWeight: 'bold', text: '${price}', align: 'right' },
      { id: 'barcode', type: 'barcode', x: 10, y: 48, width: 80, height: 19, text: '{sku}', align: 'left' }
    ]
  }
};

const LabelDesigner = ({ isOpen, onClose, selectedProducts, quantities = {}, labelType = 'roll', fieldsToPrint = { name: true, price: true, sku: true } }) => {
  const [template, setTemplate] = useState('classic');
  const [elements, setElements] = useState(LABEL_TEMPLATES.classic.elements);
  const [selectedElement, setSelectedElement] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [previewProduct, setPreviewProduct] = useState(null);
  const canvasRef = useRef(null);
  const labelWidth = LABEL_TEMPLATES[template].width * 72; // Convert inches to points
  const labelHeight = LABEL_TEMPLATES[template].height * 72;

  useEffect(() => {
    if (selectedProducts && selectedProducts.length > 0) {
      setPreviewProduct(selectedProducts[0]);
    }
  }, [selectedProducts]);

  useEffect(() => {
    // Filter elements based on fieldsToPrint
    const templateElements = LABEL_TEMPLATES[template].elements;
    const filteredElements = templateElements.filter(element => {
      if (element.id === 'name' && !fieldsToPrint.name) return false;
      if (element.id === 'price' && !fieldsToPrint.price) return false;
      if (element.id === 'barcode' && !fieldsToPrint.sku) return false;
      return true;
    });
    setElements(filteredElements);
    setSelectedElement(null);
  }, [template, fieldsToPrint]);

  useEffect(() => {
    drawPreview();
  }, [elements, previewProduct, template]);

  const replaceTokens = (text, product) => {
    if (!product) return text;
    return text
      .replace('{name}', product.name || '')
      .replace('{price}', (product.price || 0).toFixed(2))
      .replace('{sku}', product.sku || '');
  };

  const drawPreview = () => {
    const canvas = canvasRef.current;
    if (!canvas || !previewProduct) return;

    const ctx = canvas.getContext('2d');
    const scale = 3; // High DPI for crisp rendering
    canvas.width = labelWidth * scale;
    canvas.height = labelHeight * scale;
    canvas.style.width = `${labelWidth * 2}px`;
    canvas.style.height = `${labelHeight * 2}px`;
    ctx.scale(scale, scale);

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, labelWidth, labelHeight);

    // Border
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, labelWidth, labelHeight);

    elements.forEach(element => {
      if (element.type === 'text') {
        const text = replaceTokens(element.text, previewProduct);
        ctx.font = `${element.fontWeight} ${element.fontSize}px ${element.fontFamily}`;
        ctx.fillStyle = '#000000';
        ctx.textBaseline = 'top';
        
        // Text wrapping for long text
        const maxWidth = labelWidth - 20; // 10pt margin on each side
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        words.forEach(word => {
          const testLine = currentLine + (currentLine ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        });
        if (currentLine) lines.push(currentLine);
        
        // Draw each line
        lines.forEach((line, i) => {
          const yPos = element.y + (i * (element.fontSize + 2));
          if (element.align === 'center') {
            ctx.textAlign = 'center';
            ctx.fillText(line, element.x, yPos);
          } else if (element.align === 'right') {
            ctx.textAlign = 'right';
            ctx.fillText(line, element.x, yPos);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(line, element.x, yPos);
          }
        });

        // Highlight selected element
        if (selectedElement?.id === element.id) {
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 2;
          const metrics = ctx.measureText(text);
          const textHeight = element.fontSize * lines.length + 2 * (lines.length - 1);
          ctx.strokeRect(
            element.align === 'center' ? element.x - maxWidth / 2 - 2 : element.x - 2,
            element.y - 2,
            maxWidth + 4,
            textHeight + 4
          );
        }
      } else if (element.type === 'barcode') {
        const barcodeText = replaceTokens(element.text, previewProduct);
        if (barcodeText) {
          try {
            const tempCanvas = document.createElement('canvas');
            JsBarcode(tempCanvas, barcodeText, {
              format: "CODE128",
              width: 1.5,
              height: element.height,
              displayValue: true,
              fontSize: 12,
              margin: 0,
              textMargin: 2,
              font: "monospace",
            });
            ctx.drawImage(tempCanvas, element.x - (element.align === 'center' ? element.width / 2 : 0), element.y, element.width, element.height + 14);

            if (selectedElement?.id === element.id) {
              ctx.strokeStyle = '#3b82f6';
              ctx.lineWidth = 2;
              ctx.strokeRect(element.x - (element.align === 'center' ? element.width / 2 : 0) - 2, element.y - 2, element.width + 4, element.height + 18);
            }
          } catch (e) {
            console.error('Barcode error:', e);
          }
        }
      }
    });
  };

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * labelWidth;
    const y = ((e.clientY - rect.top) / rect.height) * labelHeight;

    // Find clicked element
    const clicked = elements.find(el => {
      if (el.type === 'text') {
        const ctx = canvas.getContext('2d');
        ctx.font = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
        const text = replaceTokens(el.text, previewProduct);
        const metrics = ctx.measureText(text);
        const textX = el.align === 'center' ? el.x - metrics.width / 2 : el.x;
        return x >= textX && x <= textX + metrics.width && y >= el.y && y <= el.y + el.fontSize;
      } else if (el.type === 'barcode') {
        return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height + 10;
      }
      return false;
    });

    setSelectedElement(clicked || null);
  };

  const handleMouseDown = (e) => {
    if (!selectedElement) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * labelWidth;
    const y = ((e.clientY - rect.top) / rect.height) * labelHeight;
    setDragging({ elementId: selectedElement.id, offsetX: x - selectedElement.x, offsetY: y - selectedElement.y });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * labelWidth;
    const y = ((e.clientY - rect.top) / rect.height) * labelHeight;

    setElements(elements.map(el => 
      el.id === dragging.elementId
        ? { ...el, x: Math.max(0, Math.min(labelWidth, x - dragging.offsetX)), y: Math.max(0, Math.min(labelHeight, y - dragging.offsetY)) }
        : el
    ));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const updateSelectedElement = (updates) => {
    if (!selectedElement) return;
    setElements(elements.map(el => el.id === selectedElement.id ? { ...el, ...updates } : el));
    setSelectedElement({ ...selectedElement, ...updates });
  };

  const generatePDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'pt',
      format: [labelWidth, labelHeight],
    });

    let isFirstPage = true;
    selectedProducts.forEach(product => {
      const qty = quantities[product.id] || 1;
      for (let i = 0; i < qty; i++) {
        if (!isFirstPage) {
          doc.addPage([labelWidth, labelHeight], 'landscape');
        }

        elements.forEach(element => {
          if (element.type === 'text') {
            const text = replaceTokens(element.text, product);
            doc.setFont(element.fontFamily.toLowerCase(), element.fontWeight);
            doc.setFontSize(element.fontSize);
            
            // Text wrapping for PDF
            const maxWidth = labelWidth - 20;
            const lines = doc.splitTextToSize(text, maxWidth);
            
            lines.forEach((line, index) => {
              const yPos = element.y + element.fontSize * 0.8 + (index * (element.fontSize + 2));
              doc.text(line, element.x, yPos, { align: element.align });
            });
          } else if (element.type === 'barcode') {
            const barcodeText = replaceTokens(element.text, product);
            if (barcodeText) {
              try {
                const tempCanvas = document.createElement('canvas');
                JsBarcode(tempCanvas, barcodeText, {
                  format: "CODE128",
                  width: 1.5,
                  height: element.height,
                  displayValue: true,
                  fontSize: 12,
                  margin: 0,
                  textMargin: 2,
                  font: "monospace",
                });
                const barcodeDataUrl = tempCanvas.toDataURL('image/jpeg', 1.0);
                const xPos = element.align === 'center' ? element.x - element.width / 2 : element.x;
                doc.addImage(barcodeDataUrl, 'JPEG', xPos, element.y, element.width, element.height + 14);
              } catch (e) {
                console.error('Barcode error:', e);
              }
            }
          }
        });

        isFirstPage = false;
      }
    });

    doc.save('product-labels.pdf');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl">Label Designer - {selectedProducts?.length || 0} Products</DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Preview */}
          <div className="flex-1 p-6 flex flex-col items-center justify-center bg-gray-50 border-r overflow-auto">
            <div className="mb-4 text-sm text-gray-600">
              Click elements to select • Drag to move • Use controls to edit
            </div>
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="border-2 border-gray-300 rounded shadow-lg cursor-move bg-white"
            />
            {previewProduct && (
              <div className="mt-4 text-sm text-gray-600">
                Previewing: <span className="font-semibold">{previewProduct.name}</span>
              </div>
            )}
          </div>

          {/* Right Panel - Controls */}
          <div className="w-80 p-6 overflow-auto">
            <Tabs defaultValue="template">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="template">Template</TabsTrigger>
                <TabsTrigger value="edit">Edit</TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-4">
                <div>
                  <Label>Select Template</Label>
                  <Select value={template} onValueChange={setTemplate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LABEL_TEMPLATES).map(([key, tmpl]) => (
                        <SelectItem key={key} value={key}>{tmpl.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Preview Product</Label>
                  <Select
                    value={previewProduct?.id}
                    onValueChange={id => setPreviewProduct(selectedProducts.find(p => p.id === id))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProducts?.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Card className="p-4 bg-blue-50">
                  <h4 className="font-semibold mb-2 text-sm">Template Info</h4>
                  <p className="text-xs text-gray-600">
                    Size: {LABEL_TEMPLATES[template].width}" × {LABEL_TEMPLATES[template].height}"
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Elements: {elements.length}
                  </p>
                </Card>
              </TabsContent>

              <TabsContent value="edit" className="space-y-4">
                {selectedElement ? (
                  <>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm font-semibold mb-1">Selected: {selectedElement.id}</p>
                      <p className="text-xs text-gray-600">Type: {selectedElement.type}</p>
                    </div>

                    {selectedElement.type === 'text' && (
                      <>
                        <div>
                          <Label>Font Size</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[selectedElement.fontSize]}
                              onValueChange={([value]) => updateSelectedElement({ fontSize: value })}
                              min={6}
                              max={36}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm w-8">{selectedElement.fontSize}</span>
                          </div>
                        </div>

                        <div>
                          <Label>Font Family</Label>
                          <Select
                            value={selectedElement.fontFamily}
                            onValueChange={value => updateSelectedElement({ fontFamily: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Helvetica">Helvetica</SelectItem>
                              <SelectItem value="Times">Times</SelectItem>
                              <SelectItem value="Courier">Courier</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Font Weight</Label>
                          <Select
                            value={selectedElement.fontWeight}
                            onValueChange={value => updateSelectedElement({ fontWeight: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Alignment</Label>
                          <div className="flex gap-2">
                            <Button
                              variant={selectedElement.align === 'left' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={() => updateSelectedElement({ align: 'left' })}
                            >
                              <AlignLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={selectedElement.align === 'center' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={() => updateSelectedElement({ align: 'center' })}
                            >
                              <AlignCenter className="w-4 h-4" />
                            </Button>
                            <Button
                              variant={selectedElement.align === 'right' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1"
                              onClick={() => updateSelectedElement({ align: 'right' })}
                            >
                              <AlignRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">X Position</Label>
                            <Input
                              type="number"
                              value={Math.round(selectedElement.x)}
                              onChange={e => updateSelectedElement({ x: parseInt(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Y Position</Label>
                            <Input
                              type="number"
                              value={Math.round(selectedElement.y)}
                              onChange={e => updateSelectedElement({ y: parseInt(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedElement.type === 'barcode' && (
                      <>
                        <div>
                          <Label>Barcode Width</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[selectedElement.width]}
                              onValueChange={([value]) => updateSelectedElement({ width: value })}
                              min={40}
                              max={120}
                              step={5}
                              className="flex-1"
                            />
                            <span className="text-sm w-8">{selectedElement.width}</span>
                          </div>
                        </div>

                        <div>
                          <Label>Barcode Height</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[selectedElement.height]}
                              onValueChange={([value]) => updateSelectedElement({ height: value })}
                              min={15}
                              max={40}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm w-8">{selectedElement.height}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">X Position</Label>
                            <Input
                              type="number"
                              value={Math.round(selectedElement.x)}
                              onChange={e => updateSelectedElement({ x: parseInt(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Y Position</Label>
                            <Input
                              type="number"
                              value={Math.round(selectedElement.y)}
                              onChange={e => updateSelectedElement({ y: parseInt(e.target.value) || 0 })}
                              className="h-8"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <Card className="p-4 text-center text-sm text-gray-500">
                    <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>Click an element on the label to edit it</p>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex items-center justify-between bg-white">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generatePDF}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={() => { generatePDF(); onClose(); }}>
              <Printer className="w-4 h-4 mr-2" />
              Print Labels
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LabelDesigner;
