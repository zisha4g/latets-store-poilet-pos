import { themes as allThemes } from '@/constants/themes';

export const themes = allThemes;

export const applyTheme = (themeName) => {
  const theme = themes.find(t => t.name === themeName) || themes[0];
  const root = document.documentElement;
  
  const otherThemes = themes.filter(t => t.name !== themeName);
  otherThemes.forEach(t => {
    if (t.class) root.classList.remove(t.class);
  });

  if (theme.class) {
    root.classList.add(theme.class);
  }

  Object.keys(theme.colors).forEach(key => {
    root.style.setProperty(key, theme.colors[key]);
  });
};