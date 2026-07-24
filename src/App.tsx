import { lazy, Suspense, useCallback, useEffect, useRef } from 'react';
import { ArrowsIn, Eye, EyeSlash, Waveform } from '@phosphor-icons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AdaptiveQualityController } from './components/AdaptiveQualityController';
import { FirstRunGuide } from './components/FirstRunGuide';
import { LyricsStage } from './components/LyricsStage';
import { RightDrawer } from './components/RightDrawer';
import { SideRail } from './components/SideRail';
import { TopStatus } from './components/TopStatus';
import { Transport } from './components/Transport';
import { setApiBaseUrl } from './netease/api';
import { CoverPaletteController } from './palette/CoverPaletteController';
import { mediaCommandFromKey, type MediaCommand } from './player/mediaControls';
import { useAuthStore } from './store/authStore';
import { useLocalLibraryStore } from './store/localLibraryStore';
import { persistPlayerSession, usePlayerStore } from './store/playerStore';
import { useUiStore } from './store/uiStore';
import { useVisualStore } from './store/visualStore';
import { shouldShowLyrics } from './ui/lyricsVisibility';

const SonicScene = lazy(() => import('./scene/SonicScene'));

export default function App() {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const palette = useVisualStore((state) => state.runtimePalette);
  const introComplete = useUiStore((state) => state.introComplete);
  const setIntroComplete = useUiStore((state) => state.setIntroComplete);
  const immersive = useUiStore((state) => state.immersive);
  const fullscreen = useUiStore((state) => state.fullscreen);
  const setFullscreen = useUiStore((state) => state.setFullscreen);
  const immersiveLyricsVisible = useUiStore((state) => state.immersiveLyricsVisible);
  const toggleImmersiveLyrics = useUiStore((state) => state.toggleImmersiveLyrics);
  const drawer = useUiStore((state) => state.drawer);
  const closeDrawer = useUiStore((state) => state.closeDrawer);
  const toggleImmersive = useUiStore((state) => state.toggleImmersive);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initializeLocalLibrary = useLocalLibraryStore((state) => state.initialize);
  const applyAuthStatus = useAuthStore((state) => state.applyStatus);
  const mode = usePlayerStore((state) => state.mode);
  const playing = usePlayerStore((state) => state.playing);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const error = usePlayerStore((state) => state.error);
  const clearError = usePlayerStore((state) => state.clearError);
  const startDemo = usePlayerStore((state) => state.startDemo);
  const toggle = usePlayerStore((state) => state.toggle);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const seek = usePlayerStore((state) => state.seek);
  const lyricsAvailable = usePlayerStore((state) => state.lyrics.length > 0);
  const localTracks = useLocalLibraryStore((state) => state.tracks);
  const lastMediaCommand = useRef<{ command: MediaCommand | null; at: number }>({ command: null, at: 0 });

  const completeIntro = useCallback(() => setIntroComplete(true), [setIntroComplete]);
  const dispatchMediaCommand = useCallback((command: MediaCommand) => {
    const now = performance.now();
    if (lastMediaCommand.current.command === command && now - lastMediaCommand.current.at < 180) return;
    lastMediaCommand.current = { command, at: now };
    const player = usePlayerStore.getState();
    if (command === 'previous') void player.previous();
    else if (command === 'next') void player.next();
    else void player.toggle();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        if (window.sonicAtlas) {
          const runtime = await window.sonicAtlas.getRuntimeConfig();
          if (cancelled) return;
          setApiBaseUrl(runtime.apiBaseUrl);
          setFullscreen(runtime.fullscreen);
          usePlayerStore.getState().rebindMedia();
          unsubscribe = window.sonicAtlas.onAuthChanged(applyAuthStatus);
        }
        await Promise.all([initializeAuth(), initializeLocalLibrary()]);
      } catch {
        // The visual demo remains usable when the local music service is unavailable.
      }
    })();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applyAuthStatus, initializeAuth, initializeLocalLibrary, setFullscreen]);

  useEffect(() => window.sonicAtlas?.onFullscreenChanged(setFullscreen), [setFullscreen]);

  useEffect(() => {
    const timer = window.setInterval(persistPlayerSession, 5_000);
    const save = () => persistPlayerSession();
    window.addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', save);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', save);
      persistPlayerSession();
    };
  }, []);

  useEffect(() => {
    usePlayerStore.getState().syncLocalTracks(localTracks);
  }, [localTracks]);

  useEffect(() => window.sonicAtlas?.onMediaCommand(dispatchMediaCommand), [dispatchMediaCommand]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    const setHandler = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Some Electron/macOS combinations expose Media Session without every action.
      }
    };
    setHandler('play', () => {
      if (!usePlayerStore.getState().playing) dispatchMediaCommand('toggle');
    });
    setHandler('pause', () => {
      if (usePlayerStore.getState().playing) dispatchMediaCommand('toggle');
    });
    setHandler('previoustrack', () => dispatchMediaCommand('previous'));
    setHandler('nexttrack', () => dispatchMediaCommand('next'));
    return () => {
      setHandler('play', null);
      setHandler('pause', null);
      setHandler('previoustrack', null);
      setHandler('nexttrack', null);
    };
  }, [dispatchMediaCommand]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      navigator.mediaSession.metadata = currentTrack && 'MediaMetadata' in window
        ? new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artists.join(' / '),
            album: currentTrack.album.name,
            artwork: currentTrack.coverUrl ? [{ src: currentTrack.coverUrl }] : [],
          })
        : null;
    } catch {
      // Metadata is an enhancement; playback controls remain available without it.
    }
  }, [currentTrack, playing]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        useUiStore.getState().openDrawer('search');
        return;
      }
      if (isTyping || !introComplete) return;
      const mediaCommand = mediaCommandFromKey(event);
      if (mediaCommand) {
        event.preventDefault();
        dispatchMediaCommand(mediaCommand);
      } else if (event.code === 'Space') {
        event.preventDefault();
        void toggle();
      } else if (event.key === 'ArrowLeft') {
        seek(Math.max(0, currentTime - 5));
      } else if (event.key === 'ArrowRight') {
        seek(currentTime + 5);
      } else if (event.key.toLowerCase() === 'i') {
        toggleImmersive();
      } else if (event.key.toLowerCase() === 'l' && (immersive || fullscreen) && lyricsAvailable) {
        toggleImmersiveLyrics();
      } else if (event.key === 'Escape') {
        if (drawer) closeDrawer();
        else if (immersive) toggleImmersive();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeDrawer, currentTime, dispatchMediaCommand, drawer, fullscreen, immersive, introComplete, lyricsAvailable, seek, toggle, toggleImmersive, toggleImmersiveLyrics]);

  const focusedVisualMode = immersive || fullscreen;
  const showLyrics = shouldShowLyrics(focusedVisualMode, immersiveLyricsVisible);

  return (
    <main
      className="app-shell"
      style={{ '--theme-accent': palette.uiAccent, '--theme-hot': palette.hot } as React.CSSProperties}
    >
      <CoverPaletteController />
      <AdaptiveQualityController />
      <Suspense fallback={<div className="scene-loading"><Waveform /> 建立声音坐标</div>}>
        <SonicScene reducedMotion={prefersReducedMotion} />
      </Suspense>
      <div className="ambient-vignette" />
      <NoiseOverlay />
      <AnimatePresence>
        {introComplete && showLyrics ? <LyricsStage immersive={focusedVisualMode} reducedMotion={prefersReducedMotion} /> : null}
      </AnimatePresence>

      <AnimatePresence>
        {introComplete && !immersive ? (
          <motion.div className="hud-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
            <TopStatus />
            <SideRail />
            <Transport />
            <RightDrawer />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {introComplete && mode === 'idle' && !immersive && !drawer ? (
        <motion.button className="demo-gate" type="button" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => void startDemo()}>
          <Waveform />
          <span><strong>启动程序化演示</strong><small>触碰后启用 110 BPM 有声地形</small></span>
        </motion.button>
      ) : null}

      {focusedVisualMode ? (
        <div className="immersive-controls">
          {lyricsAvailable ? (
            <button type="button" onClick={toggleImmersiveLyrics} title="显示或隐藏歌词（L）" aria-label={immersiveLyricsVisible ? '隐藏歌词' : '显示歌词'}>
              {immersiveLyricsVisible ? <EyeSlash /> : <Eye />}
            </button>
          ) : null}
          {immersive ? <button type="button" onClick={toggleImmersive} aria-label="退出沉浸模式"><ArrowsIn /></button> : null}
        </div>
      ) : null}

      <AnimatePresence>
        {error ? (
          <motion.button className="error-toast" type="button" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={clearError}>
            <span>{error}</span><small>点击关闭</small>
          </motion.button>
        ) : null}
      </AnimatePresence>

      {!introComplete ? <FirstRunGuide reducedMotion={prefersReducedMotion} onComplete={completeIntro} /> : null}
    </main>
  );
}

function NoiseOverlay() {
  return (
    <svg className="noise-overlay" width="100%" height="100%" aria-hidden="true">
      <filter id="sonic-noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.78" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#sonic-noise)" opacity="0.035" />
    </svg>
  );
}
