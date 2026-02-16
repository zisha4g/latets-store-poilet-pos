import React from 'react';
import { convertNumberToWords } from '@/utils/numberToWords';

const CheckPrintPreview = React.forwardRef(({ checkDetails }, ref) => {
  if (!checkDetails) return null;

  const {
    payee_name,
    payee_address,
    amount,
    check_date,
    memo,
    check_number
  } = checkDetails;

  const amountInWords = convertNumberToWords(amount);
  const formattedDate = new Date(check_date).toLocaleDateString('en-US');
  const formattedAmount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(amount);

  return (
    <div ref={ref} className="p-4 font-mono text-xs text-black bg-white">
      <div className="w-[7in] h-[3.5in] border border-dashed border-gray-400 p-2 flex flex-col">
        {/* Top part of the check */}
        <div className="flex justify-between items-start">
          <div className="w-1/2">
            <p className="font-bold">Your Company Name</p>
            <p>123 Main Street</p>
            <p>Anytown, USA 12345</p>
          </div>
          <div className="text-right">
            <p>Check No: {check_number || '___'}</p>
            <p>Date: {formattedDate}</p>
          </div>
        </div>

        {/* Middle part of the check */}
        <div className="flex-grow flex items-center">
          <div className="w-full">
            <div className="flex items-center">
              <span className="w-1/6">Pay to the order of:</span>
              <div className="flex-grow border-b border-black ml-2 pb-1">
                {payee_name}
              </div>
            </div>
            <div className="flex items-center mt-2">
              <div className="flex-grow border-b border-black pb-1">
                {amountInWords} Dollars
              </div>
              <div className="border border-black p-1 ml-2 w-1/5 text-center">
                ${formattedAmount}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom part of the check */}
        <div className="flex justify-between items-end">
          <div className="w-1/2">
            <p>Your Bank Name</p>
            <p>Bank Address</p>
            <div className="flex items-center mt-2">
              <span>Memo:</span>
              <div className="flex-grow border-b border-black ml-2 pb-1">
                {memo}
              </div>
            </div>
          </div>
          <div className="w-1/3 border-t border-black text-center pt-1">
            Signature
          </div>
        </div>
        <div className="text-center mt-2 font-serif">
          <p>&#x2446;123456789&#x2446; &#x2447;987654321&#x2447; {check_number || '0000'}</p>
        </div>
      </div>
    </div>
  );
});

export default CheckPrintPreview;