import { useEffect, useRef, useId } from 'react';

const getCookie = (name: string) => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
};

const getXsrfToken = async (): Promise<string> => {
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
  return decodeURIComponent(getCookie('XSRF-TOKEN') || '');
};

export default function YouTubePlayer({ contentUrl, lessonId }: { contentUrl: string; lessonId: number }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const playerElementId = useId().replace(/:/g, '_');

  const extractVideoId = (url: string) => {
    const m = url.match(/[?&]v=([^&]+)/);
    if (m && m[1]) return m[1];
    const short = url.match(/youtu\.be\/(.+)$/);
    if (short && short[1]) return short[1];
    const embed = url.match(/embed\/(.+)$/);
    if (embed && embed[1]) return embed[1];
    return null;
  };

  useEffect(() => {
    const videoId = extractVideoId(contentUrl);
    if (!videoId || !wrapperRef.current) return;

    // Create a new element for the player inside the wrapper
    const playerElement = document.createElement('div');
    playerElement.id = `yt-player-${playerElementId}`;
    playerElement.style.width = '100%';
    playerElement.style.height = '100%';
    wrapperRef.current.innerHTML = '';
    wrapperRef.current.appendChild(playerElement);

    const setupPlayer = () => {
      try {
        const YT = (window as any).YT;
        if (!YT || !YT.Player) return;
        if (playerRef.current && playerRef.current.destroy) {
          try {
            playerRef.current.destroy();
          } catch (e) {
            // Ignore destroy errors
          }
          playerRef.current = null;
        }

        playerRef.current = new YT.Player(playerElement.id, {
          height: '100%',
          width: '100%',
          videoId,
          playerVars: {
            origin: window.location.origin,
            rel: 0,
            enablejsapi: 1,
          },
          events: {
            onReady: (e: any) => {
              (async () => {
                try {
                  const token = await getXsrfToken();
                  await fetch('/api/lesson-events', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token }, body: JSON.stringify({ lesson_id: lessonId, event_type: 'yt_ready', data: { videoId } }) });
                } catch (err) {}
              })();
            },
            onStateChange: (e: any) => {
              const YT = (window as any).YT;
              const state = e.data;
              if (state === YT.PlayerState.PLAYING) {
                (async () => { try { const token = await getXsrfToken(); await fetch('/api/lesson-events',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-XSRF-TOKEN':token},body:JSON.stringify({lesson_id:lessonId,event_type:'yt_play',data:{time:playerRef.current.getCurrentTime()}})}); } catch(err){} })();
              } else if (state === YT.PlayerState.PAUSED) {
                (async () => { try { const token = await getXsrfToken(); await fetch('/api/lesson-events',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-XSRF-TOKEN':token},body:JSON.stringify({lesson_id:lessonId,event_type:'yt_pause',data:{time:playerRef.current.getCurrentTime()}})}); } catch(err){} })();
              } else if (state === YT.PlayerState.ENDED) {
                (async () => { try { const token = await getXsrfToken(); await fetch('/api/lesson-events',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','X-XSRF-TOKEN':token},body:JSON.stringify({lesson_id:lessonId,event_type:'yt_end'})}); } catch(err){} })();
              }
            }
          }
        });

        if (pollRef.current) window.clearInterval(pollRef.current);
        pollRef.current = window.setInterval(() => {
          try {
            if (playerRef.current && playerRef.current.getCurrentTime) {
              const current = playerRef.current.getCurrentTime();
              const duration = playerRef.current.getDuration();
              const pct = duration ? Math.round((current / duration) * 100) : 0;
              // optionally send progress events or log
            }
          } catch (err) {}
        }, 5000) as unknown as number;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('YouTube player init failed', err);
      }
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      (window as any).onYouTubeIframeAPIReady = () => {
        setupPlayer();
      };
    } else {
      setupPlayer();
    }

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // Ignore destroy errors - DOM may already be cleaned up
        }
        playerRef.current = null;
      }
      // Clear the wrapper contents to prevent removeChild errors
      if (wrapperRef.current) {
        wrapperRef.current.innerHTML = '';
      }
    };
  }, [contentUrl, lessonId, playerElementId]);

  return <div ref={wrapperRef} className="w-full h-full" />;
}
