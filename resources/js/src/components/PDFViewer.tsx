import { useState, useEffect, useRef, useCallback } from 'react';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  FileText,
  Download,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Loader,
  Monitor,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Presentation,
  MousePointer2,
  Circle,
  X,
  Grid3X3,
  Keyboard,
} from 'lucide-react';

interface PDFViewerProps {
  url: string;
  title?: string;
  fileName?: string;
  fileSize?: string;
  lessonId?: number;
  moduleId?: number;
  onConverted?: (pptxUrl: string) => void;
  showConvertButton?: boolean;
}

type PointerTool = 'none' | 'laser' | 'spotlight';

export function PDFViewer({
  url,
  title = 'Document',
  fileName,
  fileSize,
  lessonId,
  moduleId,
  onConverted,
  showConvertButton = true,
}: PDFViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(5000);
  const [scale, setScale] = useState(1);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState(false);
  const [pointerTool, setPointerTool] = useState<PointerTool>('none');
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [showPointer, setShowPointer] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  const displayFileName = fileName || url?.split('/').pop() || 'document.pdf';

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = window.setTimeout(() => {
          if (!showThumbnails && !showKeyboardHelp) setShowControls(false);
        }, 3000);
      };
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
    } else {
      setShowControls(true);
    }
  }, [isFullscreen, showThumbnails, showKeyboardHelp]);

  // Load PDF document
  useEffect(() => {
    const loadPDF = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingProgress(0);

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);

        const images: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.5 });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          images.push(canvas.toDataURL('image/png'));
          setLoadingProgress(Math.round((i / pdf.numPages) * 100));
        }

        setPageImages(images);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(err?.message || 'Failed to load PDF document');
        setIsLoading(false);
      }
    };

    loadPDF();

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [url]);

  const goToPage = (page: number, direction?: 'next' | 'prev') => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      setSlideDirection(direction || (page > currentPage ? 'next' : 'prev'));
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPage(page);
        setTimeout(() => setIsTransitioning(false), 50);
      }, 150);
    }
  };

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1, 'next');
    } else if (isPlaying) {
      goToPage(1, 'next');
    }
  }, [currentPage, totalPages, isPlaying]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1, 'prev');
    }
  }, [currentPage]);

  const togglePlay = () => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = window.setInterval(nextPage, playSpeed);
    }
  };

  useEffect(() => {
    if (isPlaying && playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = window.setInterval(nextPage, playSpeed);
    }
  }, [playSpeed, nextPage, isPlaying]);

  const toggleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const resetZoom = () => setScale(1);

  const handlePointerMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (pointerTool !== 'none' && slideRef.current) {
      const rect = slideRef.current.getBoundingClientRect();
      setPointerPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setShowPointer(true);
    }
  };

  const handlePointerLeave = () => {
    setShowPointer(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
        case 'Home':
          e.preventDefault();
          goToPage(1, 'prev');
          break;
        case 'End':
          e.preventDefault();
          goToPage(totalPages, 'next');
          break;
        case 'Escape':
          if (showKeyboardHelp) setShowKeyboardHelp(false);
          else if (showThumbnails) setShowThumbnails(false);
          else if (isFullscreen) document.exitFullscreen?.();
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'g':
        case 'G':
          e.preventDefault();
          setShowThumbnails(prev => !prev);
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          setPointerTool(prev => prev === 'laser' ? 'none' : 'laser');
          break;
        case 's':
        case 'S':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setPointerTool(prev => prev === 'spotlight' ? 'none' : 'spotlight');
          }
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePlay();
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
        case '?':
          e.preventDefault();
          setShowKeyboardHelp(prev => !prev);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPage, prevPage, isFullscreen, totalPages, showKeyboardHelp, showThumbnails]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const convertToPptx = async () => {
    if (isConverting) return;

    setIsConverting(true);
    setConvertError(null);
    setConvertSuccess(false);

    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });

      const xsrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

      let endpoint = '/api/convert/pdf-to-pptx';
      let body: FormData | string;
      const headers: Record<string, string> = {};

      if (xsrfToken) {
        headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrfToken);
      }

      if (lessonId) {
        endpoint = `/api/convert/lessons/${lessonId}/pdf-to-pptx`;
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({});
      } else if (moduleId) {
        endpoint = `/api/convert/modules/${moduleId}/pdf-to-pptx`;
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({});
      } else {
        const fileResponse = await fetch(url);
        const blob = await fileResponse.blob();
        const formData = new FormData();
        formData.append('file', blob, fileName || 'document.pdf');
        body = formData;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers,
        body,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Conversion failed');
      }

      setConvertSuccess(true);
      if (onConverted && result.file_url) {
        onConverted(result.file_url);
      }
      alert(`PDF converted to PowerPoint successfully!${result.file_url ? `\nDownload: ${result.file_url}` : ''}`);

    } catch (err: any) {
      console.error('Conversion error:', err);
      setConvertError(err.message || 'Failed to convert PDF to PowerPoint');
      alert(`Conversion failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsConverting(false);
    }
  };

  const currentPageImage = pageImages[currentPage - 1];
  const progressPercent = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`pdf-viewer ${isFullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : 'space-y-4'}`}
    >
      {/* Header Card (non-fullscreen) */}
      {!isFullscreen && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 p-3 bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 rounded-xl">
                <FileText className="h-8 w-8 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{displayFileName}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full font-medium">PDF</span>
                  {fileSize && <span>Size: {fileSize}</span>}
                  {totalPages > 0 && (
                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                      {totalPages} page{totalPages !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
            >
              <Monitor className="h-5 w-5 mr-2" />
              Start Presentation
            </button>

            {totalPages > 1 && (
              <button
                onClick={togglePlay}
                className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                  isPlaying
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-slate-600 text-white hover:bg-slate-700'
                }`}
              >
                {isPlaying ? <><Pause className="h-4 w-4 mr-2" />Pause</> : <><Play className="h-4 w-4 mr-2" />Auto Play</>}
              </button>
            )}

            <div className="inline-flex items-center gap-1 border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              <button onClick={zoomOut} className="px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ZoomOut className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
              <button onClick={resetZoom} className="px-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 min-w-[50px]">
                {Math.round(scale * 100)}%
              </button>
              <button onClick={zoomIn} className="px-2 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <ZoomIn className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>

            <a
              href={url}
              download
              className="inline-flex items-center px-4 py-2 border border-green-600 text-green-600 dark:text-green-400 rounded-lg font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </a>

            {showConvertButton && (
              <button
                onClick={convertToPptx}
                disabled={isConverting}
                className={`inline-flex items-center px-4 py-2 border rounded-lg font-medium transition-colors text-sm ${
                  isConverting
                    ? 'border-slate-400 text-slate-400 cursor-not-allowed'
                    : convertSuccess
                    ? 'border-green-600 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                    : 'border-orange-600 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                }`}
              >
                {isConverting ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Converting...</>
                ) : convertSuccess ? (
                  <><Presentation className="h-4 w-4 mr-2" />Converted!</>
                ) : (
                  <><Presentation className="h-4 w-4 mr-2" />Convert to PPTX</>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Controls */}
      {isFullscreen && (
        <>
          <div
            className={`absolute top-0 left-0 right-0 z-30 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <X className="h-4 w-4" />
                  Exit
                </button>
                <span className="text-white/90 font-medium">{title}</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
                  <button
                    onClick={() => setPointerTool(pointerTool === 'laser' ? 'none' : 'laser')}
                    className={`p-2 rounded-md transition-colors ${pointerTool === 'laser' ? 'bg-red-500 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    title="Laser Pointer (L)"
                  >
                    <MousePointer2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPointerTool(pointerTool === 'spotlight' ? 'none' : 'spotlight')}
                    className={`p-2 rounded-md transition-colors ${pointerTool === 'spotlight' ? 'bg-yellow-500 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                    title="Spotlight (S)"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
                    <button
                      onClick={togglePlay}
                      className={`p-2 rounded-md transition-colors ${isPlaying ? 'bg-orange-500 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                      title={isPlaying ? 'Pause (P)' : 'Auto Play (P)'}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    {isPlaying && (
                      <select
                        value={playSpeed}
                        onChange={(e) => setPlaySpeed(Number(e.target.value))}
                        className="bg-transparent text-white/90 text-sm border-0 focus:ring-0 cursor-pointer"
                      >
                        <option value={2000} className="text-black">2s</option>
                        <option value={3000} className="text-black">3s</option>
                        <option value={5000} className="text-black">5s</option>
                        <option value={10000} className="text-black">10s</option>
                      </select>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 bg-white/10 backdrop-blur-sm rounded-lg p-1">
                  <button onClick={zoomOut} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors">
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button onClick={resetZoom} className="px-2 text-white/90 text-sm min-w-[45px] hover:bg-white/10 rounded-md transition-colors">
                    {Math.round(scale * 100)}%
                  </button>
                  <button onClick={zoomIn} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md transition-colors">
                    <ZoomIn className="h-4 w-4" />
                  </button>
                </div>

                <button
                  onClick={() => setShowThumbnails(!showThumbnails)}
                  className={`p-2 rounded-lg transition-colors ${showThumbnails ? 'bg-blue-500 text-white' : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'}`}
                  title="Slide Overview (G)"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                  className="p-2 bg-white/10 rounded-lg text-white/70 hover:text-white hover:bg-white/20 transition-colors"
                  title="Keyboard Shortcuts (?)"
                >
                  <Keyboard className="h-4 w-4" />
                </button>

                <a
                  href={url}
                  download
                  className="p-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-colors"
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          <div
            className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
            }`}
          >
            <div className="h-1 bg-white/20">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-t from-black/80 to-transparent">
              <button
                onClick={prevPage}
                disabled={currentPage === 1}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === 1
                    ? 'text-white/30 cursor-not-allowed'
                    : 'text-white bg-white/10 hover:bg-white/20'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>

              <div className="flex items-center gap-3">
                <span className="text-white/90 font-medium text-lg">
                  {currentPage} <span className="text-white/50">/ {totalPages}</span>
                </span>
              </div>

              <button
                onClick={nextPage}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentPage === totalPages
                    ? 'text-white/30 cursor-not-allowed'
                    : 'text-white bg-white/10 hover:bg-white/20'
                }`}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* Page Viewer */}
      <div
        ref={slideRef}
        className={`overflow-hidden relative ${isFullscreen ? 'flex-1' : 'rounded-xl border border-slate-200 dark:border-slate-700'}`}
        style={{
          height: isFullscreen ? '100%' : '500px',
          minHeight: '400px',
          background: isFullscreen ? '#000' : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
          cursor: pointerTool !== 'none' ? 'none' : 'default',
        }}
        onMouseMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
      >
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
            <Loader className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-slate-200 text-lg font-medium">Loading Presentation...</p>
            <p className="text-slate-400 text-sm mt-1">Preparing {loadingProgress}% of slides</p>
            <div className="w-64 h-2 bg-slate-700 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        )}

        {!isLoading && (error || pageImages.length === 0) && (
          <div className="absolute inset-0 flex flex-col">
            <iframe
              src={`${url}#toolbar=1&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0"
              title={title}
              style={{ background: 'white' }}
            />
          </div>
        )}

        {!isLoading && !error && currentPageImage && (
          <>
            {isFullscreen ? (
              /* PowerPoint / Canva style: slide fills the entire screen, letterboxed */
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <img
                  src={currentPageImage}
                  alt={`Slide ${currentPage} of ${totalPages}`}
                  className={`w-full h-full object-contain select-none transition-all duration-150 ease-out ${
                    isTransitioning
                      ? slideDirection === 'next' ? 'opacity-0 scale-[1.02]' : 'opacity-0 scale-[0.98]'
                      : 'opacity-100 scale-100'
                  }`}
                  draggable={false}
                />
              </div>
            ) : (
              /* Normal preview: contained with padding */
              <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8 overflow-hidden">
                <div
                  className={`relative shadow-2xl rounded-lg overflow-hidden bg-white transition-all duration-300 ease-out ${
                    isTransitioning
                      ? slideDirection === 'next' ? 'opacity-0 translate-x-8' : 'opacity-0 -translate-x-8'
                      : 'opacity-100 translate-x-0'
                  }`}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    maxWidth: '100%',
                    maxHeight: '100%',
                  }}
                >
                  <img
                    src={currentPageImage}
                    alt={`Page ${currentPage}`}
                    className="block max-w-full h-auto select-none"
                    style={{ maxHeight: '450px' }}
                    draggable={false}
                  />
                </div>
              </div>
            )}

            {pointerTool === 'laser' && showPointer && (
              <div
                className="absolute pointer-events-none z-40"
                style={{
                  left: pointerPosition.x - 8,
                  top: pointerPosition.y - 8,
                }}
              >
                <div className="w-4 h-4 bg-red-500 rounded-full shadow-lg animate-pulse"
                  style={{ boxShadow: '0 0 20px 5px rgba(239, 68, 68, 0.6)' }}
                />
              </div>
            )}

            {pointerTool === 'spotlight' && showPointer && (
              <div
                className="absolute inset-0 pointer-events-none z-40"
                style={{
                  background: `radial-gradient(circle 150px at ${pointerPosition.x}px ${pointerPosition.y}px, transparent 0%, rgba(0,0,0,0.85) 100%)`,
                }}
              />
            )}

            {!isFullscreen && (
              <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium">
                {currentPage} / {totalPages}
              </div>
            )}

            {isFullscreen && (
              <div className="absolute bottom-16 right-6 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full text-white/70 text-sm font-medium pointer-events-none">
                {currentPage} / {totalPages}
              </div>
            )}

            {totalPages > 1 && (
              <>
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all ${
                    currentPage === 1 ? 'opacity-20 cursor-not-allowed' : 'opacity-70 hover:opacity-100'
                  } ${isFullscreen ? 'p-4' : 'p-3'}`}
                >
                  <ChevronLeft className={`text-white ${isFullscreen ? 'h-10 w-10' : 'h-8 w-8'}`} />
                </button>
                <button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/30 hover:bg-black/50 backdrop-blur-sm transition-all ${
                    currentPage === totalPages ? 'opacity-20 cursor-not-allowed' : 'opacity-70 hover:opacity-100'
                  } ${isFullscreen ? 'p-4' : 'p-3'}`}
                >
                  <ChevronRight className={`text-white ${isFullscreen ? 'h-10 w-10' : 'h-8 w-8'}`} />
                </button>
              </>
            )}

            {!isFullscreen && totalPages > 1 && totalPages <= 20 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => goToPage(i + 1)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      i + 1 === currentPage ? 'bg-blue-500 scale-125' : 'bg-white/40 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {isFullscreen && showThumbnails && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-auto p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white text-xl font-semibold">Slide Overview</h3>
              <button
                onClick={() => setShowThumbnails(false)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {pageImages.map((img, index) => (
                <button
                  key={index}
                  onClick={() => {
                    goToPage(index + 1);
                    setShowThumbnails(false);
                  }}
                  className={`relative aspect-[4/3] rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    index + 1 === currentPage
                      ? 'border-blue-500 ring-2 ring-blue-500/50'
                      : 'border-white/20 hover:border-white/40'
                  }`}
                >
                  <img src={img} alt={`Page ${index + 1}`} className="w-full h-full object-contain bg-white" />
                  <div className="absolute bottom-0 left-0 right-0 py-1 bg-black/70 text-white text-xs font-medium text-center">
                    {index + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {isFullscreen && showKeyboardHelp && (
          <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white text-xl font-semibold">Keyboard Shortcuts</h3>
                <button
                  onClick={() => setShowKeyboardHelp(false)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  ['→ / Space / PageDown', 'Next slide'],
                  ['← / PageUp', 'Previous slide'],
                  ['Home', 'First slide'],
                  ['End', 'Last slide'],
                  ['F', 'Toggle fullscreen'],
                  ['G', 'Slide overview'],
                  ['L', 'Laser pointer'],
                  ['S', 'Spotlight'],
                  ['P', 'Auto play/pause'],
                  ['+ / -', 'Zoom in/out'],
                  ['0', 'Reset zoom'],
                  ['Esc', 'Exit/close'],
                  ['?', 'Show/hide this help'],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-white/70">{desc}</span>
                    <kbd className="px-2 py-1 bg-slate-700 rounded text-white font-mono text-xs">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!isFullscreen && !isLoading && totalPages > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
            {pageImages.map((img, index) => (
              <button
                key={index}
                onClick={() => goToPage(index + 1)}
                className={`flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border-2 transition-all bg-white hover:scale-105 ${
                  index + 1 === currentPage
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-400'
                }`}
              >
                <img
                  src={img}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFViewer;
