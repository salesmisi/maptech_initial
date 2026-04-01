import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ModuleConfig } from '../types';
import { getAvailableModules } from '../modules';

interface CreateModuleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateModule: (config: ModuleConfig) => void;
}

export function CreateModuleDialog({ isOpen, onClose, onCreateModule }: CreateModuleDialogProps) {
  const [selectedType, setSelectedType] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const availableModules = getAvailableModules();

  const handleCreate = () => {
    if (!selectedType) return;

    const moduleTemplate = availableModules.find(m => m.type === selectedType);
    if (!moduleTemplate) return;

    const newModule: ModuleConfig = {
      id: `${selectedType}-${Date.now()}`,
      type: selectedType,
      title: moduleTemplate.title,
      status,
      position: 0,
      icon: moduleTemplate.icon,
      settings: moduleTemplate.defaultSettings || {},
      createdAt: new Date().toISOString(),
      isInSidebar: status === 'published',
    };

    onCreateModule(newModule);
    onClose();
    setSelectedType('');
    setStatus('published');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Create UI Component
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Module Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Module Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="">Select a module type...</option>
              {availableModules.map(module => (
                <option key={module.type} value={module.type}>
                  {module.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select a pre-built module template
            </p>
          </div>

          {/* Selected Module Description */}
          {selectedType && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {availableModules.find(m => m.type === selectedType)?.description}
              </p>
            </div>
          )}

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              UI components must be published to appear in the sidebar
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selectedType}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
