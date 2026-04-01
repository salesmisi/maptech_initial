import { useState, useEffect } from 'react';
import { Loader, AlertCircle } from 'lucide-react';

interface CustomModulePageProps {
  routePath: string;
}

interface CustomModuleData {
  id: number;
  title: string;
  description: string | null;
  component_config: Record<string, any> | null;
  route_path: string;
  icon_name: string;
}

export function CustomModulePage({ routePath }: CustomModulePageProps) {
  const [module, setModule] = useState<CustomModuleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadModule();
  }, [routePath]);

  const loadModule = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/custom-modules/ui-components', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to load custom module');
      }

      const data = await response.json();
      const foundModule = data.find((m: any) => m.route_path === routePath);

      if (!foundModule) {
        throw new Error('Custom module not found');
      }

      setModule(foundModule);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !module) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Module</h2>
        <p className="text-gray-600 dark:text-gray-400">{error || 'Module not found'}</p>
      </div>
    );
  }

  // Check if custom page content is provided
  const hasCustomContent = module.component_config?.pageContent && module.component_config.pageContent.trim() !== '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{module.title}</h1>
        {module.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-400">{module.description}</p>
        )}
      </div>

      {hasCustomContent ? (
        /* Render custom HTML content */
        <div
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 custom-module-content"
          dangerouslySetInnerHTML={{ __html: module.component_config.pageContent }}
        />
      ) : (
        /* Default placeholder UI */
        <>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
            <AlertCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Custom Module UI
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            This is a placeholder for the custom module <strong>{module.title}</strong>.
            You can extend this component to render specific UI based on the module configuration.
          </p>
          {module.component_config && Object.keys(module.component_config).length > 0 && (
            <div className="mt-6 text-left max-w-lg mx-auto">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Module Configuration:
              </h4>
              <pre className="bg-gray-50 dark:bg-slate-700 p-4 rounded-lg text-xs overflow-auto">
                {JSON.stringify(module.component_config, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
          💡 Development Note
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          To customize this page, edit the <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">CustomModulePage</code> component
          and add conditional rendering based on the <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded">routePath</code> or
          <code className="bg-blue-100 dark:bg-blue-900/50 px-1 py-0.5 rounded ml-1">component_config</code>.
        </p>
      </div>
        </>
      )}
    </div>
  );
}
