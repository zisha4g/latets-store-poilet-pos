import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

const CurrencyInput = React.forwardRef(({ value, onChange, placeholder, ...props }, ref) => {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === null || value === undefined || isNaN(value)) {
        setDisplayValue('');
      } else {
        setDisplayValue(
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(value)
        );
      }
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    if (value === null || value === undefined || isNaN(value)) {
      setDisplayValue('');
    } else {
      setDisplayValue(value.toString());
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value === null || value === undefined || isNaN(value) || value === '') {
      onChange(null);
      setDisplayValue('');
    } else {
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue)) {
        const formattedValue = parseFloat(numericValue.toFixed(2));
        onChange(formattedValue);
        setDisplayValue(
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(formattedValue)
        );
      } else {
         onChange(null);
         setDisplayValue('');
      }
    }
  };

  const handleChange = (e) => {
    let input = e.target.value;
    
    input = input.replace(/[^0-9.]/g, '');
    const parts = input.split('.');
    if (parts.length > 2) {
      input = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts[1] && parts[1].length > 2) {
      input = parts[0] + '.' + parts[1].substring(0, 2);
    }

    setDisplayValue(input);

    const numericValue = parseFloat(input);
    if (!isNaN(numericValue)) {
      onChange(numericValue);
    } else {
      onChange(null);
    }
  };

  return (
    <Input
      ref={ref}
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || '$0.00'}
      {...props}
    />
  );
});

CurrencyInput.displayName = 'CurrencyInput';

export default CurrencyInput;