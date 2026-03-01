import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function VirtualKeyboard({ theme = 'dark', enabled = true }) {
  const [shift, setShift] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [visible, setVisible] = useState(false);
  const lastFocusedRef = useRef(null);

  // Track last focused input so keyboard knows where to type
  useEffect(() => {
    if (!enabled) return;
    const handleFocusIn = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        const skipTypes = ['checkbox', 'radio', 'range', 'file', 'color', 'hidden'];
        if (tag === 'INPUT' && skipTypes.includes(e.target.type)) return;
        lastFocusedRef.current = e.target;
      }
    };
    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [enabled]);

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
      hide: 'bg-gray-700 hover:bg-gray-600 text-gray-300 border-gray-600',
      tab: 'bg-gray-700 hover:bg-gray-600 text-white border-gray-600',
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
      hide: 'bg-gray-300 hover:bg-gray-400 text-gray-700 border-gray-300',
      tab: 'bg-gray-200 hover:bg-gray-300 text-gray-900 border-gray-300',
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
      hide: 'bg-blue-700 hover:bg-blue-600 text-blue-200 border-blue-600',
      tab: 'bg-blue-700 hover:bg-blue-600 text-white border-blue-600',
    },
  };

  const currentTheme = themes[theme] || themes.dark;

  const numberRow = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

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

  const getActiveInput = useCallback(() => {
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return el;
    // Fallback to last focused input
    if (lastFocusedRef.current && document.body.contains(lastFocusedRef.current)) {
      lastFocusedRef.current.focus();
      return lastFocusedRef.current;
    }
    return null;
  }, []);

  const handleKeyPress = useCallback((key) => {
    const el = getActiveInput();
    if (!el) return;
    
    const val = (shift || capsLock) ? key.toUpperCase() : key;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newVal = el.value.substring(0, start) + val + el.value.substring(end);
    
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, newVal);
    el.selectionStart = el.selectionEnd = start + val.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    el.focus();
    if (shift && !capsLock) setShift(false);
  }, [shift, capsLock, getActiveInput]);

  const handleBackspace = useCallback(() => {
    const el = getActiveInput();
    if (!el) return;
    
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    if (start === end && start === 0) return;
    
    const newVal = start !== end 
      ? el.value.substring(0, start) + el.value.substring(end) 
      : el.value.substring(0, start - 1) + el.value.substring(start);
    const newPos = start !== end ? start : start - 1;
    
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, newVal);
    el.selectionStart = el.selectionEnd = newPos;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    el.focus();
  }, [getActiveInput]);

  const handleEnter = useCallback(() => {
    const el = getActiveInput();
    if (!el) return;
    
    // Try to submit the form
    if (el.form) {
      const submitBtn = el.form.querySelector('[type="submit"]') || 
                       el.form.querySelector('button:not([type="button"])');
      if (submitBtn) {
        submitBtn.click();
        return;
      }
    }
    // Also dispatch keydown Enter event for search handlers etc.
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  }, [getActiveInput]);

  const handleTab = useCallback(() => {
    const el = getActiveInput();
    if (!el) return;
    
    // Find the next focusable input/textarea
    const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), textarea:not([disabled])'));
    const currentIndex = inputs.indexOf(el);
    if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
      inputs[currentIndex + 1].focus();
    } else if (inputs.length > 0) {
      inputs[0].focus();
    }
  }, [getActiveInput]);

  const handleHide = useCallback(() => {
    setVisible(false);
  }, []);

  // Toggle body class so main content area shrinks when keyboard is open
  useEffect(() => {
    if (visible) {
      document.body.classList.add('vk-open');
    } else {
      document.body.classList.remove('vk-open');
    }
    return () => document.body.classList.remove('vk-open');
  }, [visible]);

  if (!enabled) return null;

  // Keyboard is closed — show small floating ⌨ button at bottom-right
  if (!visible) {
    return (
      <Button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible(true)}
        className="fixed bottom-4 right-4 z-[60] w-11 h-11 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground text-lg"
        title="Open keyboard"
      >
        ⌨
      </Button>
    );
  }

  // Compact key sizing
  const kh = 'h-7 sm:h-8'; // key height
  const kfont = 'text-xs sm:text-sm'; // key font
  const gap = 'gap-[2px] sm:gap-[3px]'; // gap between keys
  const rowGap = 'space-y-[2px] sm:space-y-[3px]'; // gap between rows

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 ${currentTheme.bg} border-t-2 ${currentTheme.border} shadow-2xl z-[60]`}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-w-6xl mx-auto px-1 sm:px-1.5 py-0.5 sm:py-1">
        <div className={`flex ${gap}`}>
          {/* Main QWERTY section */}
          <div className={`flex-1 ${rowGap}`}>
            {/* Number row + backspace + hide */}
            <div className={`flex ${gap}`}>
              {numberRow.map(k => (
                <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" 
                  className={`flex-1 ${kh} ${kfont} font-bold ${currentTheme.number} border px-0`}>
                  {k}
                </Button>
              ))}
              <Button onMouseDown={(e) => { e.preventDefault(); handleBackspace(); }} variant="secondary" 
                className={`px-2 ${kh} font-bold text-xs ${currentTheme.delete} border`}>
                ⌫
              </Button>
              <Button 
                onMouseDown={(e) => { e.preventDefault(); handleHide(); }} 
                variant="secondary" 
                className={`px-2 ${kh} font-bold text-[10px] ${currentTheme.hide} border`}
                title="Hide keyboard"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            {/* QWERTY row 1 */}
            <div className={`flex ${gap}`}>
              {mainKeys[0].map(k => (
                <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" 
                  className={`flex-1 ${kh} ${kfont} font-bold ${currentTheme.key} border px-0`}>
                  {shift || capsLock ? k.toUpperCase() : k}
                </Button>
              ))}
            </div>
            {/* QWERTY row 2 */}
            <div className={`flex ${gap}`}>
              <Button onMouseDown={(e) => { e.preventDefault(); handleTab(); }} variant="secondary" 
                className={`px-1.5 ${kh} font-bold text-[8px] sm:text-[9px] ${currentTheme.tab} border`}>
                TAB
              </Button>
              {mainKeys[1].map(k => (
                <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" 
                  className={`flex-1 ${kh} ${kfont} font-bold ${currentTheme.key} border px-0`}>
                  {shift || capsLock ? k.toUpperCase() : k}
                </Button>
              ))}
            </div>
            {/* QWERTY row 3 */}
            <div className={`flex ${gap}`}>
              <Button onMouseDown={(e) => { e.preventDefault(); setShift(!shift); setCapsLock(!capsLock); }} variant="secondary" 
                className={`px-1.5 sm:px-2 ${kh} font-bold text-[10px] ${capsLock ? currentTheme.caps : currentTheme.special} border`}>
                ⇪
              </Button>
              {mainKeys[2].map(k => (
                <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" 
                  className={`flex-1 ${kh} ${kfont} font-bold ${currentTheme.key} border px-0`}>
                  {shift || capsLock ? k.toUpperCase() : k}
                </Button>
              ))}
              <Button onMouseDown={(e) => { e.preventDefault(); setShift(!shift); }} variant="secondary" 
                className={`px-1.5 sm:px-2 ${kh} font-bold text-[10px] ${shift && !capsLock ? currentTheme.shift : currentTheme.special} border`}>
                ⇧
              </Button>
            </div>
            {/* Bottom row */}
            <div className={`flex ${gap}`}>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress(' '); }} variant="secondary" 
                className={`flex-1 ${kh} text-[9px] sm:text-[10px] font-bold ${currentTheme.special} border`}>SPACE</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress('.'); }} variant="secondary" 
                className={`px-2 ${kh} ${kfont} font-bold ${currentTheme.key} border`}>.</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress(','); }} variant="secondary" 
                className={`px-2 ${kh} ${kfont} font-bold ${currentTheme.key} border`}>,</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress('-'); }} variant="secondary" 
                className={`px-2 ${kh} ${kfont} font-bold ${currentTheme.key} border`}>-</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleKeyPress('@'); }} variant="secondary" 
                className={`px-2 ${kh} ${kfont} font-bold ${currentTheme.key} border`}>@</Button>
              <Button onMouseDown={(e) => { e.preventDefault(); handleEnter(); }} variant="secondary" 
                className={`px-3 sm:px-5 ${kh} font-bold text-[9px] sm:text-[10px] ${currentTheme.enter} border`}>↵ ENTER</Button>
            </div>
          </div>
          {/* Numpad */}
          <div className={`${rowGap} flex flex-col justify-end`}>
            {numPad.map((row, i) => (
              <div key={i} className={`flex ${gap}`}>
                {row.map(k => (
                  <Button key={k} onMouseDown={(e) => { e.preventDefault(); handleKeyPress(k); }} variant="secondary" 
                    className={`w-9 sm:w-11 ${kh} text-sm sm:text-base font-bold ${currentTheme.number} border px-0`}>
                    {k}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const KEYBOARD_HEIGHT = 175;
