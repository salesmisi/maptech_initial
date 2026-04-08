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

  // Get buttons from config (with defaults)
  const buttons = module.component_config?.buttons || [
    { label: 'Get Started', url: '', style: 'primary', visible: true },
    { label: 'Learn More', url: '', style: 'secondary', visible: true }
  ];

  // Filter visible buttons
  const visibleButtons = buttons.filter((btn: any) => btn.visible !== false);

  // Generate button HTML for injection
  const generateButtonsHtml = () => {
    if (visibleButtons.length === 0) return '';

    return `<div class="flex gap-3">
      ${visibleButtons.map((btn: any) => {
        const isPrimary = btn.style === 'primary';
        const buttonClass = isPrimary
          ? 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors'
          : 'px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors';

        if (btn.url) {
          return `<a href="${btn.url}" class="${buttonClass}" target="_blank" rel="noopener noreferrer">${btn.label}</a>`;
        }
        return `<button class="${buttonClass}">${btn.label}</button>`;
      }).join('')}
    </div>`;
  };

  // Process page content to replace button placeholder or append buttons
  const processPageContent = (content: string) => {
    const buttonsHtml = generateButtonsHtml();

    // Check if content has button placeholder
    if (content.includes('<!-- BUTTONS_PLACEHOLDER -->')) {
      return content.replace('<!-- BUTTONS_PLACEHOLDER -->', buttonsHtml);
    }

    // If no placeholder, check if content already has buttons (legacy content)
    // Don't add buttons if the content already has them
    if (content.includes('Get Started') || content.includes('Learn More')) {
      // Replace existing button div with configured buttons
      const buttonDivRegex = /<div class="flex gap-3">[\s\S]*?<\/button>\s*<\/div>/;
      if (buttonDivRegex.test(content)) {
        return content.replace(buttonDivRegex, buttonsHtml);
      }
    }

    return content;
  };

  const processedContent = hasCustomContent
    ? processPageContent(module.component_config.pageContent)
    : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{module.title}</h1>
        {module.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-400">{module.description}</p>
        )}
      </div>

      {hasCustomContent ? (
        /* Render custom HTML content with processed buttons */
        <div
          className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 custom-module-content"
          dangerouslySetInnerHTML={{ __html: processedContent }}
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
