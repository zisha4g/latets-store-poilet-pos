import { useEffect, useCallback } from 'react';

export function useHotkeys(hotkeys, dependencies = []) {
  const memoizedCallback = useCallback((event) => {
    for (const [hotkey, callback] of hotkeys) {
      const lowerHotkey = hotkey.toLowerCase();
      const keys = lowerHotkey.split('+');
      const key = keys.pop();

      if (!key) continue;

      const alt = keys.includes('alt');
      const shift = keys.includes('shift');
      
      const isMac = /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
      
      let ctrl = keys.includes('ctrl');
      let meta = keys.includes('meta');
      
      if (keys.includes('mod')) {
        if (isMac) {
          meta = true;
        } else {
          ctrl = true;
        }
      }

      if (
        alt === event.altKey &&
        shift === event.shiftKey &&
        ctrl === event.ctrlKey &&
        meta === event.metaKey &&
        key === event.key.toLowerCase()
      ) {
        event.preventDefault();
        callback(event);
      }
    }
  }, [hotkeys, ...dependencies]);

  useEffect(() => {
    document.addEventListener('keydown', memoizedCallback);
    return () => {
      document.removeEventListener('keydown', memoizedCallback);
    };
  }, [memoizedCallback]);
}