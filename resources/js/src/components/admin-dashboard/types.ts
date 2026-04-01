// Type definitions for the customizable admin dashboard

export interface ModuleConfig {
  id: string;
  type: string;
  title: string;
  status: 'published' | 'draft';
  position: number;
  icon: string;
  settings?: Record<string, any>;
  createdAt: string;
  isInSidebar: boolean;
}

export interface DashboardModule {
  id: string;
  type: string;
  title: string;
  component: React.ComponentType<ModuleProps>;
  icon: string;
  description: string;
  defaultSettings?: Record<string, any>;
}

export interface ModuleProps {
  config: ModuleConfig;
  onUpdate: (config: Partial<ModuleConfig>) => void;
  onRemove: () => void;
  isDragging?: boolean;
}

export interface DashboardState {
  modules: ModuleConfig[];
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
}

export type ModuleType = 'calendar' | 'events' | 'custom';
