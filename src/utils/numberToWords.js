import numToWords from 'num-to-words';

export const convertNumberToWords = (number) => {
  if (typeof number !== 'number' || isNaN(number)) {
    return '';
  }

  const integerPart = Math.floor(number);
  const decimalPart = Math.round((number - integerPart) * 100);

  let words = numToWords(integerPart);
  words = words.charAt(0).toUpperCase() + words.slice(1);

  if (decimalPart > 0) {
    words += ` and ${decimalPart}/100`;
  }

  return words;
};