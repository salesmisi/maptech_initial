import { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
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

  const containerRef = useRef<HTMLDivElement>(null);
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

  // CLIENT fallback: extract best full-slide image per slide from PPTX zip
  const parsePptxClientSide = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch file');
      const zip = await JSZip.loadAsync(await res.arrayBuffer());

      // Load media — collect dimensions by loading images
      const media = new Map<string, { blob: Blob; size: number; w: number; h: number }>();
      await Promise.all(
        Object.entries(zip.files)
          .filter(([p, f]) => p.startsWith('ppt/media/') && !f.dir && isValidImageFile(p.split('/').pop() || ''))
          .map(([path, file]) => file.async('blob').then(blob => new Promise<void>(resolve => {
            const img = new Image();
            const objUrl = URL.createObjectURL(blob);
            img.onload = () => {
              const entry = { blob, size: blob.size, w: img.naturalWidth, h: img.naturalHeight };
              URL.revokeObjectURL(objUrl);
              media.set(path, entry);
              media.set(path.split('/').pop()!, entry);
              media.set('../media/' + path.split('/').pop()!, entry);
              resolve();
            };
            img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(); };
            img.src = objUrl;
          })))
      );

      // Find slides
      const slideFiles = Object.keys(zip.files)
        .map(p => { const m = p.match(/ppt\/slides\/slide(\d+)\.xml$/); return m ? { num: +m[1], path: p } : null; })
        .filter(Boolean) as { num: number; path: string }[];
      slideFiles.sort((a, b) => a.num - b.num);
      if (!slideFiles.length) throw new Error('No slides found');

      const parsed: SlideData[] = [];
      for (const { num, path } of slideFiles) {
        const xml = await zip.files[path].async('string');

        // Build rel map
        const rIdMap = new Map<string, string>();
        const relFile = zip.files[`ppt/slides/_rels/slide${num}.xml.rels`];
        if (relFile) {
          const relXml = await relFile.async('string');
          for (const m of relXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
            rIdMap.set(m[1], m[2].startsWith('../') ? 'ppt/' + m[2].slice(3) : m[2]);
          }
        }

        // Collect all images for this slide; score by area, skip tiny/non-slide-ratio images
        const candidates: { entry: { blob: Blob; size: number; w: number; h: number }; score: number }[] = [];
        for (const m of xml.matchAll(/r:embed="(rId\d+)"/g)) {
          const tp = rIdMap.get(m[1]);
          if (tp?.includes('media/')) {
            const e = media.get(tp) ?? media.get(tp.split('/').pop()!);
            if (!e) continue;
            const area = e.w * e.h;
            // Skip tiny images (decorative/icon blobs < 50px)
            if (e.w < 100 || e.h < 100) continue;
            // Prefer images that are wider-than-tall (slide-like aspect ratio)
            const aspect = e.w / e.h;
            const aspectScore = (aspect >= 1.2 && aspect <= 2.0) ? 2 : 1;
            candidates.push({ entry: e, score: area * aspectScore });
          }
        }
        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0]?.entry ?? null;

        parsed.push({ slideNumber: num, imageUrl: best ? URL.createObjectURL(best.blob) : null });
      }

      setSlides(parsed);
      setCurrentSlide(0);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse presentation');
      setLoading(false);
    }
  }, [url]);

  // On mount: try server conversion first, then fall back
  useEffect(() => {
    if (!url) return;
    (async () => {
      const ok = await convertToPdf();
      if (!ok) await parsePptxClientSide();
    })();
  }, [url]); // eslint-disable-line

  const nextSlide = useCallback(() => {
    if (!slides.length) return;
    setSlideDirection('next');
    setTimeout(() => { setCurrentSlide(p => (p < slides.length - 1 ? p + 1 : 0)); setSlideDirection(null); }, 150);
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    if (!slides.length) return;
    setSlideDirection('prev');
    setTimeout(() => { setCurrentSlide(p => (p > 0 ? p - 1 : slides.length - 1)); setSlideDirection(null); }, 150);
  }, [slides.length]);

  useEffect(() => {
    if (isAutoPlaying && slides.length) { autoPlayRef.current = setInterval(nextSlide, 5000); }
    else if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [isAutoPlaying, nextSlide, slides.length]);

  const startPresentation = () => {
    setIsPresentationMode(true);
    setCurrentSlide(0);
    containerRef.current?.requestFullscreen?.().catch(() => {});
  };
  const exitPresentation = () => {
    setIsPresentationMode(false);
    setPointerTool('none');
    setShowThumbnails(false);
    if (document.fullscreenElement) document.exitFullscreen?.();
  };

  useEffect(() => {
    const h = () => { const fs = !!document.fullscreenElement; setIsFullscreen(fs); if (!fs) { setIsPresentationMode(false); setPointerTool('none'); } };
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
        <PDFViewer url={pdfUrl} title={displayName} fileName={displayName.replace(/\.pptx?$/i, '.pdf')} showConvertButton={false} />
      </div>
    );
  }

  // ─── PRESENTATION MODE (fullscreen slideshow using client-side images) ───
  if (isPresentationMode) {
    const slide = slides[currentSlide];
    return (
      <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col" onMouseMove={handleMouseMove} onMouseLeave={() => setShowPointer(false)}>

        {/* Top bar */}
        <div className={`absolute top-0 inset-x-0 z-20 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
            <div className="flex items-center gap-3">
              <Presentation className="w-5 h-5 text-orange-400" />
              <span className="text-white font-medium">{displayName}</span>
              <span className="text-white/60 text-sm">Slide {currentSlide + 1} of {slides.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPointerTool(t => t === 'laser' ? 'none' : 'laser')} className={`p-2 rounded-lg transition-all ${pointerTool === 'laser' ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Laser (L)"><MousePointer2 className="w-4 h-4" /></button>
              <button onClick={() => setPointerTool(t => t === 'spotlight' ? 'none' : 'spotlight')} className={`p-2 rounded-lg transition-all ${pointerTool === 'spotlight' ? 'bg-yellow-400 text-black' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Spotlight (S)"><Circle className="w-4 h-4" /></button>
              <button onClick={() => setShowThumbnails(t => !t)} className={`p-2 rounded-lg transition-all ${showThumbnails ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Grid (G)"><Grid3X3 className="w-4 h-4" /></button>
              <button onClick={() => setIsAutoPlaying(t => !t)} className={`p-2 rounded-lg transition-all ${isAutoPlaying ? 'bg-orange-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`} title="Auto-play (P)">{isAutoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
              <button onClick={() => setShowKeyboardHelp(t => !t)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white" title="Help (?)"><Keyboard className="w-4 h-4" /></button>
              <button onClick={exitPresentation} className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white" title="Exit (Esc)"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>

        {/* Slide — fills entire screen like PowerPoint */}
        <div className="flex-1 relative bg-black" ref={slideRef} onMouseMove={handleMouseMove} onMouseLeave={() => setShowPointer(false)}>
          {slide?.imageUrl ? (
            <img
              src={slide.imageUrl}
              alt={`Slide ${currentSlide + 1}`}
              className={`w-full h-full object-contain select-none transition-all duration-150 ${
                slideDirection === 'next' ? 'opacity-0 scale-[1.02]' : slideDirection === 'prev' ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
              }`}
              draggable={false}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-slate-400">
                <Presentation className="w-24 h-24 mx-auto mb-4 opacity-20" />
                <p className="text-2xl">Slide {currentSlide + 1}</p>
              </div>
            </div>
          )}

          {pointerTool === 'laser' && showPointer && (
            <div className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30" style={{ left: pointerPosition.x, top: pointerPosition.y }}>
              <div className="w-full h-full bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50" />
            </div>
          )}
          {pointerTool === 'spotlight' && showPointer && (
            <div className="absolute inset-0 pointer-events-none z-30" style={{ background: `radial-gradient(circle 120px at ${pointerPosition.x}px ${pointerPosition.y}px, transparent 0%, rgba(0,0,0,0.85) 100%)` }} />
          )}

          <button onClick={prevSlide} className={`absolute left-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white hover:bg-black/70 transition-all ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><ChevronLeft className="w-8 h-8" /></button>
          <button onClick={nextSlide} className={`absolute right-4 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/40 text-white hover:bg-black/70 transition-all ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}><ChevronRight className="w-8 h-8" /></button>
        </div>

        {/* Bottom progress */}
        <div className={`absolute bottom-0 inset-x-0 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="h-1 bg-white/20"><div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} /></div>
          <div className="py-2 text-center text-white/50 text-sm bg-gradient-to-t from-black/80 to-transparent">
            <kbd className="px-1.5 py-0.5 bg-white/20 rounded">←</kbd> <kbd className="px-1.5 py-0.5 bg-white/20 rounded">→</kbd> Navigate &nbsp;•&nbsp; <kbd className="px-1.5 py-0.5 bg-white/20 rounded">Space</kbd> Next &nbsp;•&nbsp; <kbd className="px-1.5 py-0.5 bg-white/20 rounded">Esc</kbd> Exit
          </div>
        </div>

        {/* Thumbnail grid */}
        {showThumbnails && (
          <div className="absolute inset-0 z-40 bg-black/95 overflow-auto p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-xl font-semibold">All Slides</h3>
              <button onClick={() => setShowThumbnails(false)} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {slides.map((s, i) => (
                <button key={i} onClick={() => { setCurrentSlide(i); setShowThumbnails(false); }} className={`relative aspect-video rounded-lg overflow-hidden border-4 transition-all hover:scale-105 ${i === currentSlide ? 'border-orange-500 ring-4 ring-orange-500/30' : 'border-transparent hover:border-white/50'}`}>
                  {s.imageUrl ? <img src={s.imageUrl} alt={`Slide ${i+1}`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">{i+1}</div>}
                  <div className="absolute bottom-1 right-1 px-2 py-0.5 bg-black/70 rounded text-white text-xs">{i+1}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Keyboard help */}
        {showKeyboardHelp && (
          <div className="absolute inset-0 z-40 bg-black/95 flex items-center justify-center">
            <div className="bg-slate-800 rounded-2xl p-8 max-w-lg w-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white text-xl font-semibold">Keyboard Shortcuts</h3>
                <button onClick={() => setShowKeyboardHelp(false)} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20"><X className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-white">
                {[['Next slide','→'],['Prev slide','←'],['First slide','Home'],['Last slide','End'],['Laser pointer','L'],['Spotlight','S'],['Slide grid','G'],['Auto-play','P'],['Exit','Esc']].map(([label, key]) => (
                  <div key={key} className="flex justify-between"><span className="text-white/70">{label}</span><kbd className="px-2 py-1 bg-slate-700 rounded">{key}</kbd></div>
                ))}
              </div>
            </div>
          </div>
        )}
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
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
            <span className="text-slate-500 dark:text-slate-400">
              {conversionStatus === 'converting' ? 'Converting to PDF for full preview…' : 'Loading slides…'}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 gap-4">
            <AlertCircle className="w-16 h-16 text-red-400" />
            <p className="text-slate-700 dark:text-slate-300 text-center">{error}</p>
            <button onClick={handleDownload} className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white flex items-center gap-2">
              <Download className="w-5 h-5" />Download & Open in PowerPoint
            </button>
          </div>
        )}

        {!loading && slides.length > 0 && (
          <div className="p-4">
            {/* Current slide */}
            <div className="relative bg-black rounded-lg overflow-hidden shadow-xl mx-auto" style={{ maxWidth: '800px', aspectRatio: '16/9' }}>
              {slides[currentSlide]?.imageUrl ? (
                <img src={slides[currentSlide].imageUrl!} alt={`Slide ${currentSlide + 1}`} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400">
                  <div className="text-center"><Presentation className="w-16 h-16 mx-auto mb-3 opacity-30" /><p>Slide {currentSlide + 1}</p></div>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-between px-2">
                <button onClick={prevSlide} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronLeft className="w-6 h-6" /></button>
                <button onClick={nextSlide} className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronRight className="w-6 h-6" /></button>
              </div>
              <div className="absolute bottom-2 right-2 px-3 py-1 bg-black/70 rounded-full text-white text-sm">{currentSlide + 1} / {slides.length}</div>
            </div>

            {/* Thumbnails */}
            {slides.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto py-2">
                {slides.map((s, i) => (
                  <button key={i} onClick={() => setCurrentSlide(i)} className={`flex-shrink-0 w-24 h-14 rounded border-2 overflow-hidden transition-all ${i === currentSlide ? 'border-orange-500 ring-2 ring-orange-400/30' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'}`}>
                    {s.imageUrl ? <img src={s.imageUrl} alt={`Slide ${i+1}`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs text-slate-500">{i+1}</div>}
                  </button>
                ))}
              </div>
            )}
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
