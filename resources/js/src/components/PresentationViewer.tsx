import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { init as initPptxPreview } from 'pptx-preview';
import PDFViewer from './PDFViewer';
import {
  Presentation,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Monitor,
  MousePointer2,
  Circle,
  X,
  Grid3X3,
  Keyboard,
} from 'lucide-react';

interface PresentationViewerProps {
  url: string;
  title?: string;
  fileName?: string;
  fileSize?: string;
  className?: string;
}

interface SlideData {
  slideNumber: number;
  imageUrl: string | null;
}

type PointerTool = 'none' | 'laser' | 'spotlight';

function getCsrfToken(): string {
  for (const cookie of document.cookie.split(';')) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'XSRF-TOKEN') return decodeURIComponent(value);
  }
  return '';
}

function isValidImageFile(filename: string): boolean {
  const ext = filename.toLowerCase().split('.').pop() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext);
}

export default function PresentationViewer({ url, title, fileName, className = '' }: PresentationViewerProps) {
  const displayName = fileName || title || 'Presentation';

  // PDF conversion (server-side via LibreOffice)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'converting' | 'done' | 'failed'>('idle');
  const [isLibreOfficeAvailable, setIsLibreOfficeAvailable] = useState<boolean | null>(null);

  // Fallback client-side slide images
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Presentation mode
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [pointerTool, setPointerTool] = useState<PointerTool>('none');
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const [showPointer, setShowPointer] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState({ width: 1280, height: 720 });
  const [presentationRatio, setPresentationRatio] = useState(16 / 9);

  const containerRef = useRef<HTMLDivElement>(null);
  const previewShellRef = useRef<HTMLDivElement>(null);
  const pptxPreviewRef = useRef<HTMLDivElement>(null);
  const pptxPreviewerRef = useRef<any>(null);
  const pptxBufferRef = useRef<ArrayBuffer | null>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Auto-hide controls in fullscreen
  useEffect(() => {
    if (!isPresentationMode) { setShowControls(true); return; }
    const handler = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = window.setTimeout(() => {
        if (!showThumbnails && !showKeyboardHelp) setShowControls(false);
      }, 3000);
    };
    window.addEventListener('mousemove', handler);
    return () => { window.removeEventListener('mousemove', handler); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [isPresentationMode, showThumbnails, showKeyboardHelp]);

  useEffect(() => {
    const shell = previewShellRef.current;
    if (!shell) return;

    const updateSize = () => {
      const rect = shell.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = presentationRatio || (16 / 9);
      let width = rect.width;
      let height = width / ratio;

      if (height > rect.height) {
        height = rect.height;
        width = height * ratio;
      }

      setPreviewDimensions({
        width: Math.max(640, Math.floor(width)),
        height: Math.max(480, Math.floor(height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);

    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isPresentationMode, presentationRatio]);

  // SERVER: Convert PPTX → PDF via LibreOffice
  const convertToPdf = useCallback(async (): Promise<boolean> => {
    setConversionStatus('converting');
    try {
      await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      const res = await fetch('/api/convert/pptx-as-pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.pdf_url) {
        setPdfUrl(data.pdf_url);
        setConversionStatus('done');
        setLoading(false);
        return true;
      }
    } catch (e) {
      console.error('PDF conversion failed:', e);
    }
    setConversionStatus('failed');
    return false;
  }, [url]);

  const renderPptxIntoHost = useCallback(async (host: HTMLDivElement, arrayBuffer: ArrayBuffer, width: number, height: number) => {
    if (pptxPreviewerRef.current?.destroy) {
      pptxPreviewerRef.current.destroy();
    }

    host.innerHTML = '';

    const previewer = initPptxPreview(host, {
      width,
      height,
      mode: 'slide',
    });

    pptxPreviewerRef.current = previewer;
    await previewer.preview(arrayBuffer);

    const pptWidth = previewer.pptx?.width;
    const pptHeight = previewer.pptx?.height;
    if (pptWidth && pptHeight) {
      setPresentationRatio(pptWidth / pptHeight);
    }

    setSlides(Array.from({ length: previewer.slideCount }, (_, index) => ({
      slideNumber: index + 1,
      imageUrl: null,
    })));
    setCurrentSlide(0);
  }, []);

  // CLIENT fallback: render PPTX directly in the browser
  const parsePptxClientSide = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let previewHost = pptxPreviewRef.current;
      if (!previewHost) {
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        previewHost = pptxPreviewRef.current;
      }
      if (!previewHost) throw new Error('Preview container not ready');

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch file');

      const arrayBuffer = await res.arrayBuffer();
      pptxBufferRef.current = arrayBuffer;
      await renderPptxIntoHost(previewHost, arrayBuffer, previewDimensions.width, previewDimensions.height);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to render presentation');
      setLoading(false);
    }
  }, [previewDimensions.height, previewDimensions.width, renderPptxIntoHost, url]);

  useEffect(() => {
    const host = pptxPreviewRef.current;
    const arrayBuffer = pptxBufferRef.current;
    if (!host || !arrayBuffer || loading || error) return;

    void renderPptxIntoHost(host, arrayBuffer, previewDimensions.width, previewDimensions.height);
  }, [error, loading, previewDimensions.height, previewDimensions.width, renderPptxIntoHost]);

  // On mount: try server conversion first, then fall back
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    (async () => {
      try {
        const availabilityRes = await fetch('/api/convert/availability', { credentials: 'include' });
        const availabilityData = await availabilityRes.json();
        const available = !!availabilityData?.libreoffice_available;

        if (cancelled) return;
        setIsLibreOfficeAvailable(available);

        if (available) {
          const ok = await convertToPdf();
          if (!ok && !cancelled) await parsePptxClientSide();
        } else {
          await parsePptxClientSide();
        }
      } catch {
        if (!cancelled) {
          setIsLibreOfficeAvailable(false);
          await parsePptxClientSide();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]); // eslint-disable-line

  const nextSlide = useCallback(() => {
    pptxPreviewerRef.current?.renderNextSlide?.();
  }, []);

  const prevSlide = useCallback(() => {
    pptxPreviewerRef.current?.renderPreSlide?.();
  }, []);

  useEffect(() => {
    if (isAutoPlaying && slides.length) { autoPlayRef.current = setInterval(nextSlide, 5000); }
    else if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [isAutoPlaying, nextSlide, slides.length]);

  const startPresentation = () => {
    setIsPresentationMode(true);
  };
  const exitPresentation = () => {
    setIsPresentationMode(false);
    setPointerTool('none');
    setShowThumbnails(false);
  };

  useEffect(() => {
    const h = () => { const fs = !!document.fullscreenElement; setIsFullscreen(fs); };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (pointerTool !== 'none' && slideRef.current) {
      const r = slideRef.current.getBoundingClientRect();
      setPointerPosition({ x: e.clientX - r.left, y: e.clientY - r.top });
      setShowPointer(true);
    }
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!isPresentationMode && !isFullscreen) return;
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); nextSlide(); break;
        case 'ArrowLeft':  case 'PageUp':             e.preventDefault(); prevSlide(); break;
        case 'Home': e.preventDefault(); setCurrentSlide(0); break;
        case 'End':  e.preventDefault(); setCurrentSlide(slides.length - 1); break;
        case 'Escape': showThumbnails ? setShowThumbnails(false) : showKeyboardHelp ? setShowKeyboardHelp(false) : exitPresentation(); break;
        case 'l': case 'L': e.preventDefault(); setPointerTool(t => t === 'laser' ? 'none' : 'laser'); break;
        case 's': case 'S': e.preventDefault(); setPointerTool(t => t === 'spotlight' ? 'none' : 'spotlight'); break;
        case 'g': case 'G': e.preventDefault(); setShowThumbnails(t => !t); break;
        case '?': e.preventDefault(); setShowKeyboardHelp(t => !t); break;
        case 'p': case 'P': e.preventDefault(); setIsAutoPlaying(t => !t); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [nextSlide, prevSlide, slides.length, isPresentationMode, isFullscreen, showThumbnails, showKeyboardHelp]);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url;
    a.download = displayName.match(/\.pptx?$/i) ? displayName : displayName + '.pptx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const progressPercent = slides.length > 0 ? ((currentSlide + 1) / slides.length) * 100 : 0;

  // ─── If PDF conversion succeeded: use PDFViewer which handles "Start Presentation" itself ───
  if (pdfUrl) {
    return (
      <div className={className}>
        <div className="mb-2 flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-700">
          <Presentation className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <span className="text-slate-800 dark:text-slate-100 font-medium truncate">{displayName}</span>
          <span className="ml-auto px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">PPTX → PDF</span>
          <button onClick={handleDownload} className="p-1.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors" title="Download original PPTX">
            <Download className="w-4 h-4" />
          </button>
        </div>
        <Suspense fallback={<div className="p-6">Loading presentation...</div>}>
          <PDFViewer url={pdfUrl} title={displayName} fileName={displayName.replace(/\.pptx?$/i, '.pdf')} showConvertButton={false} />
        </Suspense>
      </div>
    );
  }

  // ─── PRESENTATION MODE ───
  if (isPresentationMode) {
    return (
      <div ref={containerRef} className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4" onMouseMove={handleMouseMove} onMouseLeave={() => setShowPointer(false)}>
        <div className="relative w-full max-w-[1400px] h-[90vh] bg-slate-950 rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
          <div className={`absolute top-0 inset-x-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <Presentation className="w-5 h-5 text-orange-400" />
                <span className="text-white font-medium">{displayName}</span>
                <span className="text-white/60 text-sm">Presentation mode</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPointerTool(t => t === 'laser' ? 'none' : 'laser')} className={`p-2 rounded-lg transition-all ${pointerTool === 'laser' ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Laser (L)"><MousePointer2 className="w-4 h-4" /></button>
                <button onClick={() => setPointerTool(t => t === 'spotlight' ? 'none' : 'spotlight')} className={`p-2 rounded-lg transition-all ${pointerTool === 'spotlight' ? 'bg-yellow-400 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Spotlight (S)"><Circle className="w-4 h-4" /></button>
                <button onClick={() => setShowKeyboardHelp(t => !t)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" title="Help (?)"><Keyboard className="w-4 h-4" /></button>
                <button onClick={exitPresentation} className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white" title="Exit"><X className="w-4 h-4" /></button>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 pt-16">
            <div className="h-full flex items-center justify-center">
                <div ref={previewShellRef} className="w-full h-full flex items-center justify-center">
                <div
                  ref={pptxPreviewRef}
                    className="overflow-hidden rounded-xl bg-white dark:bg-slate-950 shadow-xl mx-auto"
                    style={{
                      width: `${previewDimensions.width}px`,
                      height: `${previewDimensions.height}px`,
                    }}
                />
              </div>
            </div>
          </div>

          {showKeyboardHelp && (
            <div className="absolute inset-0 z-40 bg-black/90 flex items-center justify-center p-6">
              <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-white text-xl font-semibold">Keyboard Shortcuts</h3>
                  <button onClick={() => setShowKeyboardHelp(false)} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-white">
                  {[['Laser pointer','L'],['Spotlight','S'],['Help','?'],['Exit','Esc']].map(([label, key]) => (
                    <div key={key} className="flex justify-between"><span className="text-white/70">{label}</span><kbd className="px-2 py-1 bg-slate-700 rounded">{key}</kbd></div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── NORMAL VIEW ───
  return (
    <div ref={containerRef} className={`bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-3 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl">
            <Presentation className="h-8 w-8 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">{displayName}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">PowerPoint Presentation</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">PPTX</span>
              {slides.length > 0 && <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">{slides.length} slide{slides.length !== 1 ? 's' : ''}</span>}
              {conversionStatus === 'converting' && <span className="text-blue-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Converting for full preview…</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center gap-2 sm:gap-3 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={startPresentation}
          disabled={loading || (!!error && !slides.length)}
          className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all text-sm shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Monitor className="h-5 w-5 mr-2" />
          Start Presentation
        </button>
        {slides.length > 1 && (
          <button onClick={() => setIsAutoPlaying(t => !t)} className={`inline-flex items-center px-4 py-2 rounded-lg font-medium transition-colors text-sm ${isAutoPlaying ? 'bg-orange-500 text-white' : 'bg-slate-600 text-white hover:bg-slate-700'}`}>
            {isAutoPlaying ? <><Pause className="h-4 w-4 mr-2" />Pause</> : <><Play className="h-4 w-4 mr-2" />Auto Play</>}
          </button>
        )}
        <button onClick={handleDownload} className="inline-flex items-center px-4 py-2 border border-green-600 text-green-600 dark:text-green-400 rounded-lg font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm">
          <Download className="h-4 w-4 mr-2" />Download
        </button>
      </div>

      {/* Preview */}
      <div className="relative bg-slate-100 dark:bg-slate-900" style={{ minHeight: '400px' }}>
        {conversionStatus === 'failed' && !pdfUrl && (
          <div className="px-4 pt-4">
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Preview is approximate in this environment. The downloaded PPTX opens in PowerPoint with the original formatting, but the browser preview can shift fonts and layout when server-side conversion is unavailable.
            </div>
          </div>
        )}
        <div ref={previewShellRef} className="p-4">
          <div
            ref={pptxPreviewRef}
            className="overflow-hidden rounded-lg bg-white dark:bg-slate-950 shadow-xl mx-auto"
            style={{
              width: `${previewDimensions.width}px`,
              height: `${previewDimensions.height}px`,
            }}
          />
        </div>

        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
            <span className="text-slate-500 dark:text-slate-400">
              {conversionStatus === 'converting' ? 'Converting to PDF for full preview…' : 'Loading slides…'}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-4 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm">
            <AlertCircle className="w-16 h-16 text-red-400" />
            <p className="text-slate-700 dark:text-slate-300 text-center">{error}</p>
            <button onClick={handleDownload} className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white flex items-center gap-2">
              <Download className="w-5 h-5" />Download & Open in PowerPoint
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Click <strong>Start Presentation</strong> for fullscreen slideshow &nbsp;•&nbsp; <strong>Download</strong> to open in Microsoft PowerPoint or Canva
        </p>
      </div>
    </div>
  );
}
