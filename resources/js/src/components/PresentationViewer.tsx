import { useState, useEffect, useRef } from 'react';
import {
  Presentation,
  Download,
  ExternalLink,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Loader,
  Monitor,
} from 'lucide-react';

interface SlideData {
  id: number;
  imageUrl: string;
}

interface PresentationViewerProps {
  /** URL to the presentation file (PPT/PPTX) */
  url: string;
  /** Title of the presentation */
  title?: string;
  /** File name to display */
  fileName?: string;
  /** File size to display */
  fileSize?: string;
}

export function PresentationViewer({
  url,
  title = 'Presentation',
  fileName,
  fileSize,
}: PresentationViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const playIntervalRef = useRef<number | null>(null);

  // Extract file name from URL if not provided
  const displayFileName = fileName || url?.split('/').pop() || 'presentation.pptx';
  const fileExtension = displayFileName.split('.').pop()?.toUpperCase() || 'PPTX';

  // Load and parse the PPTX file
  useEffect(() => {
    loadPresentation();
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [url]);

  const loadPresentation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch presentation');

      const blob = await response.blob();

      // PPTX files are ZIP archives - we'll extract slide images
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(blob);

      // Find slide images in the PPTX (they're in ppt/media/)
      const slideImages: SlideData[] = [];
      const mediaFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith('ppt/media/') && /\.(png|jpg|jpeg|gif|emf|wmf)$/i.test(name)
      );

      // Also check for slide thumbnails
      const thumbnailFile = zip.files['docProps/thumbnail.jpeg'] || zip.files['docProps/thumbnail.png'];

      // Extract relationship files to understand slide order
      const slideRels: string[] = [];
      const presentationRels = zip.files['ppt/_rels/presentation.xml.rels'];

      if (presentationRels) {
        const relsContent = await presentationRels.async('text');
        const slideMatches = relsContent.matchAll(/Target="slides\/slide(\d+)\.xml"/g);
        for (const match of slideMatches) {
          slideRels.push(match[1]);
        }
      }

      // Count actual slides from slide XML files
      const slideXmlFiles = Object.keys(zip.files).filter(
        (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)
      );
      const slideCount = slideXmlFiles.length;

      if (slideCount > 0) {
        // Generate placeholder slides with extracted images if available
        for (let i = 0; i < slideCount; i++) {
          slideImages.push({
            id: i + 1,
            imageUrl: '', // Will use placeholder
          });
        }

        // Try to match media to slides (simplified)
        for (let i = 0; i < Math.min(mediaFiles.length, slideCount); i++) {
          const mediaBlob = await zip.files[mediaFiles[i]].async('blob');
          slideImages[i].imageUrl = URL.createObjectURL(mediaBlob);
        }
      }

      if (slideImages.length === 0 && thumbnailFile) {
        // Use thumbnail as single preview
        const thumbBlob = await thumbnailFile.async('blob');
        slideImages.push({
          id: 1,
          imageUrl: URL.createObjectURL(thumbBlob),
        });
      }

      if (slideImages.length === 0) {
        // Create placeholder slides based on content
        for (let i = 0; i < Math.max(slideCount, 1); i++) {
          slideImages.push({
            id: i + 1,
            imageUrl: '',
          });
        }
      }

      setSlides(slideImages);
      setIsLoading(false);
    } catch (err) {
      console.error('Error loading presentation:', err);
      // Fallback: create a single placeholder slide
      setSlides([{ id: 1, imageUrl: '' }]);
      setError('Preview extraction limited - download to view full presentation');
      setIsLoading(false);
    }
  };

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides.length) {
      setCurrentSlide(index);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => {
      if (prev < slides.length - 1) {
        return prev + 1;
      } else if (isPlaying) {
        return 0; // Loop back
      }
      return prev;
    });
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const togglePlay = () => {
    if (isPlaying) {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      playIntervalRef.current = window.setInterval(() => {
        setCurrentSlide((prev) => {
          if (prev < slides.length - 1) {
            return prev + 1;
          }
          return 0; // Loop back to first slide
        });
      }, 3000);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen && containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, slides.length, isFullscreen]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`presentation-viewer ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-900 flex flex-col' : 'space-y-4'}`}
    >
      {/* Header Card - Hidden in fullscreen */}
      {!isFullscreen && (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 p-3 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl">
              <Presentation className="h-8 w-8 text-orange-500" />
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
                {title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                {displayFileName}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-slate-500">
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full font-medium">
                  {fileExtension}
                </span>
                {fileSize && <span>Size: {fileSize}</span>}
                {slides.length > 0 && (
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-full">
                    {slides.length} slide{slides.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Fullscreen / Presentation Mode */}
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm shadow-sm"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4 mr-2" />
                Exit Fullscreen
              </>
            ) : (
              <>
                <Monitor className="h-4 w-4 mr-2" />
                Present Fullscreen
              </>
            )}
          </button>

          {/* Play/Pause Slideshow */}
          {slides.length > 1 && (
            <button
              onClick={togglePlay}
              className="inline-flex items-center px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors text-sm"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Auto Play
                </>
              )}
            </button>
          )}

          {/* Download */}
          <a
            href={url}
            download
            className="inline-flex items-center px-4 py-2 border border-green-600 text-green-600 dark:text-green-400 dark:border-green-500 rounded-lg font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </a>

          {/* Open in new tab */}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open File
          </a>
        </div>
      </div>
      )}

      {/* Fullscreen Floating Controls */}
      {isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full">
          {/* Exit Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-sm font-medium transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
            Exit
          </button>

          {/* Play/Pause */}
          {slides.length > 1 && (
            <button
              onClick={togglePlay}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-sm font-medium transition-colors"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Play
                </>
              )}
            </button>
          )}

          {/* Slide Info */}
          <div className="text-white/80 text-sm font-medium px-2">
            {currentSlide + 1} / {slides.length}
          </div>

          {/* Download */}
          <a
            href={url}
            download
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-full text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* Slide Viewer */}
      <div
        className={`bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden relative ${
          isFullscreen ? 'flex-1' : 'rounded-xl border border-slate-700'
        }`}
        style={{ height: isFullscreen ? '100%' : '500px', minHeight: '400px' }}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
            <Loader className="h-10 w-10 animate-spin text-orange-500 mb-4" />
            <p className="text-slate-300 text-sm">Loading presentation...</p>
          </div>
        )}

        {/* Slide Content */}
        {!isLoading && slides.length > 0 && (
          <>
            {/* Current Slide */}
            <div className="absolute inset-0 flex items-center justify-center p-8">
              {slides[currentSlide]?.imageUrl ? (
                <img
                  src={slides[currentSlide].imageUrl}
                  alt={`Slide ${currentSlide + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              ) : (
                /* Placeholder slide */
                <div className="w-full max-w-4xl aspect-[16/9] bg-white dark:bg-slate-100 rounded-lg shadow-2xl flex flex-col items-center justify-center p-8">
                  <Presentation className="h-20 w-20 text-orange-400 mb-4" />
                  <h2 className="text-2xl font-bold text-slate-700 mb-2">Slide {currentSlide + 1}</h2>
                  <p className="text-slate-500 text-center max-w-md">
                    {error || 'Download the presentation to view the full content in PowerPoint or compatible software.'}
                  </p>
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            {slides.length > 1 && (
              <>
                {/* Previous Button */}
                <button
                  onClick={prevSlide}
                  disabled={currentSlide === 0}
                  className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all ${
                    currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <ChevronLeft className="h-8 w-8 text-white" />
                </button>

                {/* Next Button */}
                <button
                  onClick={nextSlide}
                  disabled={currentSlide === slides.length - 1 && !isPlaying}
                  className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all ${
                    currentSlide === slides.length - 1 && !isPlaying ? 'opacity-30 cursor-not-allowed' : 'opacity-80 hover:opacity-100'
                  }`}
                >
                  <ChevronRight className="h-8 w-8 text-white" />
                </button>
              </>
            )}

            {/* Slide Counter & Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
              {/* Dots Navigation */}
              {slides.length > 1 && slides.length <= 20 && (
                <div className="flex gap-1.5">
                  {slides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        index === currentSlide
                          ? 'bg-orange-500 scale-125'
                          : 'bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Slide Number */}
              <div className="px-4 py-1.5 bg-black/50 backdrop-blur-sm rounded-full">
                <span className="text-white text-sm font-medium">
                  {currentSlide + 1} / {slides.length}
                </span>
              </div>
            </div>

            {/* Keyboard hints */}
            {!isFullscreen && (
              <div className="absolute bottom-4 right-4">
                <div className="px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-lg text-xs text-white/70">
                  ← → to navigate
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Thumbnail Strip (when not fullscreen and multiple slides) */}
      {!isFullscreen && !isLoading && slides.length > 1 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                className={`flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentSlide
                    ? 'border-orange-500 ring-2 ring-orange-500/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-400'
                }`}
              >
                {slide.imageUrl ? (
                  <img
                    src={slide.imageUrl}
                    alt={`Slide ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {index + 1}
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PresentationViewer;
