const getEmbedUrl = (url: string) => {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
};

const extractVideoId = (url: string) => {
  const match = url.match(/[?&]v=([^&]+)/);
  if (match?.[1]) return match[1];

  const shortMatch = url.match(/youtu\.be\/([^?&\/\s]+)/);
  if (shortMatch?.[1]) return shortMatch[1];

  const embedMatch = url.match(/embed\/([^?&\/\s]+)/);
  if (embedMatch?.[1]) return embedMatch[1];

  return null;
};

export default function YouTubePlayer({ contentUrl, lessonId }: { contentUrl: string; lessonId: number }) {
  const embedUrl = getEmbedUrl(contentUrl);

  return (
    <div className="w-full">
      <div className="relative" style={{ paddingTop: '56.25%' }}>
        {embedUrl ? (
          <iframe
            key={contentUrl}
            className="absolute inset-0 h-full w-full"
            src={embedUrl}
            title={`YouTube video ${lessonId}`}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900 text-sm text-slate-300">
            Invalid YouTube link
          </div>
        )}
      </div>
    </div>
  );
}
