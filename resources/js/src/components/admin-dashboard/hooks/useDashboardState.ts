import { useState, useEffect } from 'react';
import { ModuleConfig, DashboardState } from '../types';

const STORAGE_KEY = 'admin_dashboard_state';

const defaultState: DashboardState = {
  modules: [],
  theme: 'light',
  sidebarCollapsed: false,
};

export function useDashboardState() {
  const [state, setState] = useState<DashboardState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load dashboard state:', error);
    }
    return defaultState;
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save dashboard state:', error);
    }
  }, [state]);

  const addModule = (module: ModuleConfig) => {
    setState(prev => ({
      ...prev,
      modules: [...prev.modules, module],
    }));
  };

  const updateModule = (id: string, updates: Partial<ModuleConfig>) => {
    setState(prev => ({
      ...prev,
      modules: prev.modules.map(m => 
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  };

  const removeModule = (id: string) => {
    setState(prev => ({
      ...prev,
      modules: prev.modules.filter(m => m.id !== id),
    }));
  };

  const reorderModules = (modules: ModuleConfig[]) => {
    setState(prev => ({
      ...prev,
      modules: modules.map((m, index) => ({ ...m, position: index })),
    }));
  };

  const toggleTheme = () => {
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light',
    }));
  };

  const toggleSidebar = () => {
    setState(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed,
    }));
  };

  return {
    state,
    addModule,
    updateModule,
    removeModule,
    reorderModules,
    toggleTheme,
    toggleSidebar,
  };
}
