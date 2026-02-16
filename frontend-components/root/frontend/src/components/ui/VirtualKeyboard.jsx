import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

export function VirtualKeyboard({ theme = 'dark' }) {
  const [shift, setShift] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const themes = {
    dark: {
      bg: 'bg-gray-900',
      border: 'border-blue-600',
      key: 'bg-gray-800 hover:bg-gray-700 text-white border-gray-700',
      special: 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600',
      delete: 'bg-red-600 hover:bg-red-500 text-white border-red-500',
      enter: 'bg-green-600 hover:bg-green-500 text-white border-green-500',
      number: 'bg-blue-700 hover:bg-blue-600 text-white border-blue-600',
      shift: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500',
      caps: 'bg-yellow-500 hover:bg-yellow-400 text-white border-yellow-400',
    },
    light: {
      bg: 'bg-gray-100',
      border: 'border-blue-500',
      key: 'bg-white hover:bg-gray-50 text-gray-900 border-gray-300',
      special: 'bg-gray-200 hover:bg-gray-300 text-gray-900 border-gray-300',
      delete: 'bg-red-500 hover:bg-red-600 text-white border-red-400',
      enter: 'bg-green-500 hover:bg-green-600 text-white border-green-400',
      number: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-400',
      shift: 'bg-blue-500 hover:bg-blue-600 text-white border-blue-400',
      caps: 'bg-yellow-400 hover:bg-yellow-500 text-white border-yellow-300',
    },
    blue: {
      bg: 'bg-blue-900',
      border: 'border-cyan-500',
      key: 'bg-blue-800 hover:bg-blue-700 text-white border-blue-700',
      special: 'bg-blue-700 hover:bg-blue-600 text-white border-blue-600',
      delete: 'bg-red-600 hover:bg-red-500 text-white border-red-500',
      enter: 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500',
      number: 'bg-cyan-700 hover:bg-cyan-600 text-white border-cyan-600',
      shift: 'bg-cyan-600 hover:bg-cyan-500 text-white border-cyan-500',
      caps: 'bg-yellow-500 hover:bg-yellow-400 text-white border-yellow-400',
    },
  };

  const currentTheme = themes[theme] || themes.dark;

  const mainKeys = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  ];

  const numPad = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['0', '.', '00']
  ];

  const handleKeyPress = (key) => {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      const val = (shift || capsLock) ? key.toUpperCase() : key;
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      const newVal = el.value.substring(0, start) + val + el.value.substring(end);
      
      const nativeSetter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, newVal);
      el.selectionStart = el.selectionEnd = start + val.length;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Keep focus on input
      el.focus();
      
      if (shift && !capsLock) setShift(false);
    }
  };

  const handleBackspace = () => {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      const start = el.selectionStart || 0;
      const end = el.selectionEnd || 0;
      if (start === end && start === 0) return;
      
      const newVal = start !== end ? el.value.substring(0, start) + el.value.substring(end) : el.value.substring(0, start - 1) + el.value.substring(start);
      const newPos = start !== end ? start : start - 1;
      
      const nativeSetter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(el, newVal);
      el.selectionStart = el.selectionEnd = newPos;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      el.focus();
    }
  };

  const handleEnter = () => {
    const el = document.activeElement;
    if (el && el.form) {
      const submitBtn = el.form.querySelector('[type="submit"]') || 
                       el.form.querySelector('button:not([type="button"])');
      if (submitBtn) {
        submitBtn.click();
      }
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 ${currentTheme.bg} border-t-4 ${currentTheme.border} shadow-2xl z-40`}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-w-7xl mx-auto p-3">
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex gap-1.5">
              {mainKeys[0].map(k => <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" className={`flex-1 h-12 text-lg font-bold ${currentTheme.key} border-2`}>{shift || capsLock ? k.toUpperCase() : k}</Button>)}
              <Button onMouseDown={(e) => { e.preventDefault(); handleBackspace(); }} variant="secondary" className={`px-8 h-12 font-bold ${currentTheme.delete} border-2`}>⌫</Button>
            </div>
            <div className="flex gap-1.5">
              <div className="w-12" />
              {mainKeys[1].map(k => <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" className={`flex-1 h-12 text-lg font-bold ${currentTheme.key} border-2`}>{shift || capsLock ? k.toUpperCase() : k}</Button>)}
            </div>
            <div className="flex gap-1.5">
              <Button onMouseDown={(e) => { e.preventDefault(); setShift(!shift); setCapsLock(!capsLock); }} variant="secondary" className={`px-6 h-12 font-bold text-xs ${capsLock ? currentTheme.caps : currentTheme.special} border-2`}>⇪</Button>
              {mainKeys[2].map(k => <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" className={`flex-1 h-12 text-lg font-bold ${currentTheme.key} border-2`}>{shift || capsLock ? k.toUpperCase() : k}</Button>)}
              <Button onMouseDown={(e) => { e.preventDefault(); setShift(!shift); }} variant="secondary" className={`px-6 h-12 font-bold text-xs ${shift && !capsLock ? currentTheme.shift : currentTheme.special} border-2`}>⇧</Button>
            </div>
            <div className="flex gap-1.5">
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress(','); }} variant="secondary" className={`px-6 h-12 text-lg font-bold ${currentTheme.key} border-2`}>,</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress('-'); }} variant="secondary" className={`px-6 h-12 text-lg font-bold ${currentTheme.key} border-2`}>-</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress(' '); }} variant="secondary" className={`flex-1 h-12 text-sm font-bold ${currentTheme.special} border-2`}>SPACE</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress('.'); }} variant="secondary" className={`px-6 h-12 text-lg font-bold ${currentTheme.key} border-2`}>.</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress('@'); }} variant="secondary" className={`px-6 h-12 text-lg font-bold ${currentTheme.key} border-2`}>@</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleEnter(); }} variant="secondary" className={`px-10 h-12 font-bold text-sm ${currentTheme.enter} border-2`}>↵ ENTER</Button>
            </div>
          </div>
          <div className="space-y-1.5">
            {numPad.map((row, i) => <div key={i} className="flex gap-1.5">{row.map(k => <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" className={`w-14 h-12 text-xl font-bold ${currentTheme.number} border-2`}>{k}</Button>)}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
