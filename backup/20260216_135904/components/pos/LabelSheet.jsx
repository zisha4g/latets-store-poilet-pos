import React, { useEffect } from 'react';
import JsBarcode from 'jsbarcode';

const LabelSheet = React.forwardRef(({ products, fields, quantities }, ref) => {
  const allLabels = [];
  products.forEach(product => {
    const quantity = quantities ? (quantities[product.id] || 1) : (product.quantity || 1);
    for (let i = 0; i < quantity; i++) {
      allLabels.push(product);
    }
  });

  useEffect(() => {
    allLabels.forEach((product, index) => {
      const barcodeValue = fields.barcode ? product.barcode : product.sku;
      if (barcodeValue) {
        try {
          JsBarcode(`#barcode-${product.id}-${index}`, barcodeValue, {
            format: "CODE128",
            width: 1.5,
            height: 30,
            displayValue: true,
            fontSize: 10,
            margin: 0,
          });
        } catch (e) {
          console.error(`Failed to generate barcode for value: ${barcodeValue}`, e);
        }
      }
    });
  }, [products, fields, quantities]);

  return (
    <div ref={ref} className="p-4">
      <style>{`
        @media print {
          @page { size: A4; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; }
          .label-sheet {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 10px;
            page-break-before: auto;
            page-break-inside: avoid;
          }
          .label-item {
            border: 1px solid #000;
            padding: 10px;
            text-align: center;
            page-break-inside: avoid;
            overflow-wrap: break-word;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          .label-item svg {
            max-width: 100%;
          }
        }
      `}</style>
      <div className="label-sheet">
        {allLabels.map((product, index) => (
          <div key={`${product.id}-${index}`} className="label-item">
            {fields.name && <p style={{ fontWeight: 'bold', fontSize: '12px', margin: '2px 0' }}>{product.name}</p>}
            {fields.price && <p style={{ fontSize: '14px', fontWeight: 'bold', margin: '2px 0' }}>${(product.price || 0).toFixed(2)}</p>}
            {(fields.sku || fields.barcode) && (
              <svg id={`barcode-${product.id}-${index}`}></svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

LabelSheet.displayName = 'LabelSheet';

export default LabelSheet;