import { useState, useEffect } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<string[]>('rabbithole_search_history', []);

  const addSearch = (query: string) => {
    setHistory((prev) => {
      const newHistory = [query, ...prev.filter(q => q !== query)].slice(0, 50);
      return newHistory;
    });
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return { history, addSearch, clearHistory };
}

export function useLearningPlanProgress() {
  const [progress, setProgress] = useLocalStorage<Record<string, any>>('rabbithole_plan_progress', {});

  const updateProgress = (planId: string, day: number, completed: boolean) => {
    setProgress((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [day]: { completed, timestamp: new Date().toISOString() }
      }
    }));
  };

  const getPlanProgress = (planId: string) => {
    return progress[planId] || {};
  };

  return { updateProgress, getPlanProgress };
}
