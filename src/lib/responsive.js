import { useEffect, useMemo, useState } from 'react';

const getWidth = () => (typeof window !== 'undefined' ? window.innerWidth : 1024);

export const useResponsive = () => {
  const [width, setWidth] = useState(getWidth());

  useEffect(() => {
    const handleResize = () => setWidth(getWidth());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const state = useMemo(() => {
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    return { width, isMobile, isTablet, isDesktop };
  }, [width]);

  return state;
};
