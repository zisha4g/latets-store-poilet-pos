export const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const loadFromStorage = (key, defaultValue = null) => {
  const storedValue = localStorage.getItem(key);
  if (storedValue) {
    try {
      return JSON.parse(storedValue);
    } catch (error) {
      console.error(`Error parsing localStorage key "${key}":`, error);
      return defaultValue;
    }
  }
  return defaultValue;
};