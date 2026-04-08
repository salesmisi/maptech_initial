import React from 'react';
import { DashboardModule } from '../types';
import { CalendarModule } from './CalendarModule';
import { EventsModule } from './EventsModule';

// Module Registry - Add new modules here
export const moduleRegistry: Record<string, DashboardModule> = {
  calendar: {
    id: 'calendar',
    type: 'calendar',
    title: 'Calendar & Events',
    component: CalendarModule,
    icon: 'Calendar',
    description: 'A calendar view with event tracking',
    defaultSettings: {
      events: [],
    },
  },
  events: {
    id: 'events',
    type: 'events',
    title: 'Events List',
    component: EventsModule,
    icon: 'List',
    description: 'Manage and view upcoming events',
    defaultSettings: {
      events: [],
    },
  },
};

export function getModuleComponent(type: string) {
  return moduleRegistry[type]?.component;
}

export function getAvailableModules(): DashboardModule[] {
  return Object.values(moduleRegistry);
}
