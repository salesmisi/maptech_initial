import { useState, useRef } from 'react';
import {
  FileText,
  Presentation,
  Upload,
  Download,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  X,
  ArrowRight,
} from 'lucide-react';

interface ConversionResult {
  success: boolean;
  file_name?: string;
  blob?: Blob;
  error?: string;
}

export function PdfToPptxConverter() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File | null) => {
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setResult(null);
      setProgress(0);
      setProgressText('');
    } else if (selectedFile) {
      alert('Please select a PDF file');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const convertFile = async () => {
    if (!file || isConverting) return;

    setIsConverting(true);
    setResult(null);
    setProgress(0);
    setProgressText('Loading PDF...');

    try {
      // Dynamically import libraries
      const pdfjsLib = await import('pdfjs-dist');
      const pptxgen = (await import('pptxgenjs')).default;

      // Set worker source
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      setProgress(10);
      setProgressText('Parsing PDF...');

      // Load PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      setProgress(20);
      setProgressText(`Found ${numPages} pages. Converting...`);

      // Create new PowerPoint
      const pptx = new pptxgen();
      pptx.author = 'PDF Converter';
      pptx.title = file.name.replace('.pdf', '');
      pptx.subject = 'Converted from PDF';

      // Set slide size to 16:9 widescreen (default PowerPoint size)
      pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.333, height: 7.5 });
      pptx.layout = 'LAYOUT_WIDE';

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        setProgress(20 + Math.round((pageNum / numPages) * 60));
        setProgressText(`Converting page ${pageNum} of ${numPages}...`);

        const page = await pdf.getPage(pageNum);

        // Get page dimensions
        const viewport = page.getViewport({ scale: 2 }); // Higher scale for better quality

        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport,
        }).promise;

        // Convert canvas to base64 image
        const imageDataUrl = canvas.toDataURL('image/png', 0.95);

        // Add slide with the image
        const slide = pptx.addSlide();

        // Add image to fill the slide
        slide.addImage({
          data: imageDataUrl,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%',
          sizing: { type: 'contain', w: '100%', h: '100%' },
        });

        // Clean up canvas
        canvas.remove();
      }

      setProgress(85);
      setProgressText('Generating PowerPoint file...');

      // Generate PPTX file
      const pptxBlob = await pptx.write({ outputType: 'blob' }) as Blob;

      setProgress(100);
      setProgressText('Done!');

      const outputFileName = file.name.replace('.pdf', '.pptx');

      setResult({
        success: true,
        file_name: outputFileName,
        blob: pptxBlob,
      });

    } catch (err: any) {
      console.error('Conversion error:', err);
      setResult({
        success: false,
        error: err.message || 'An error occurred during conversion',
      });
    } finally {
      setIsConverting(false);
    }
  };

  const downloadResult = () => {
    if (!result?.blob || !result?.file_name) return;

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetConverter = () => {
    setFile(null);
    setResult(null);
    setProgress(0);
    setProgressText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center gap-4 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <FileText className="h-8 w-8 text-red-500" />
          </div>
          <ArrowRight className="h-6 w-6 text-slate-400" />
          <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <Presentation className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
          PDF to PowerPoint Converter
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Convert your PDF documents to PowerPoint presentations
        </p>
      </div>

      {/* Upload Area */}
      {!result?.success && !isConverting && (
        <div
          className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
            dragOver
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : file
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {file ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-4 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
                <FileText className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                {file.name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {formatFileSize(file.size)}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  resetConverter();
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
                <Upload className="h-10 w-10 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">
                Drop your PDF here
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                or click to browse files
              </p>
            </div>
          )}
        </div>
      )}

      {/* Progress */}
      {isConverting && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="text-center mb-4">
            <RefreshCw className="h-10 w-10 animate-spin text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Converting...
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {progressText}
            </p>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
            {progress}%
          </p>
        </div>
      )}

      {/* Convert Button */}
      {file && !result?.success && !isConverting && (
        <div className="mt-6 text-center">
          <button
            onClick={convertFile}
            disabled={isConverting}
            className="inline-flex items-center px-8 py-3 rounded-xl font-semibold text-white transition-all bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-lg hover:shadow-xl"
          >
            <Presentation className="h-5 w-5 mr-2" />
            Convert to PowerPoint
          </button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`mt-6 p-6 rounded-xl ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          {result.success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center p-3 bg-green-100 dark:bg-green-900/40 rounded-full mb-4">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-2">
                Conversion Successful!
              </h3>
              <p className="text-sm text-green-600 dark:text-green-400 mb-4">
                {result.file_name}
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={downloadResult}
                  className="inline-flex items-center px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PPTX
                </button>
                <button
                  onClick={resetConverter}
                  className="inline-flex items-center px-6 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Convert Another
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-2 bg-red-100 dark:bg-red-900/40 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-1">
                  Conversion Failed
                </h3>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                  {result.error}
                </p>
                <button
                  onClick={() => setResult(null)}
                  className="text-sm font-medium text-red-700 dark:text-red-300 hover:underline"
                >
                  Try again
                </button>
              </div>
              <button
                onClick={() => setResult(null)}
                className="flex-shrink-0 p-1 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-red-500" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="mt-8 p-4 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
          💡 How it works
        </h4>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <li>• Conversion happens entirely in your browser - no data is uploaded to any server</li>
          <li>• Each PDF page becomes a slide in the PowerPoint</li>
          <li>• Best for PDF presentations and documents with visual content</li>
          <li>• For large PDFs, conversion may take a few moments</li>
        </ul>
      </div>
    </div>
  );
}

export default PdfToPptxConverter;
