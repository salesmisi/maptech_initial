import { ArrowLeft } from 'lucide-react';
import { PdfToPptxConverter } from '../../components/PdfToPptxConverter';

interface Props {
  onBack?: () => void;
}

export function FileConverterPage({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center gap-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              File Converter
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Convert files between different formats
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="py-8">
        <PdfToPptxConverter />
      </div>
    </div>
  );
}

export default FileConverterPage;
