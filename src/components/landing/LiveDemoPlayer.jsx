import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Maximize2, Minimize2, ChevronRight } from 'lucide-react';
import { SCENES, performStep, resolveTarget, getRect, sleep } from '@/lib/demoRobot.js';

/**
 * Live demo player — renders the real <App isDemo /> in an iframe at /demo
 * and drives it from the parent via postMessage. The iframe is fully
 * non-interactive (pointer-events:none) so visitors only watch — like a
 * video. The robot still works because it dispatches synthetic events
 * directly via JS, bypassing the pointer layer.
 */

const VW = 1440;
const VH = 860;
const DEMO_PATH = '/demo';

const LiveDemoPlayer = () => {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const cancelRef = useRef(false);
  const pausedRef = useRef(false);
  const readyRef = useRef(false);
  const sceneIdxRef = useRef(0);

  const [sceneIdx, setSceneIdx] = useState(0);
  const [caption, setCaption] = useState('');
  const [cursor, setCursor] = useState({ x: 200, y: 200, visible: true, clicking: false });
  const [iframeReady, setIframeReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [scale, setScale] = useState(1);

  const scene = SCENES[sceneIdx];

  /* ---- responsive scaling ---- */
  useEffect(() => {
    const update = () => {
      const stage = stageRef.current;
      if (!stage) return;
      setScale(Math.max(0.25, stage.clientWidth / VW));
    };
    update();
    const ro = new ResizeObserver(update);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener('resize', update);
    return () => { ro.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  /* ---- fullscreen ---- */
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, []);

  /* ---- pause ---- */
  const waitWhilePaused = useCallback(async () => {
    while (pausedRef.current && !cancelRef.current) await sleep(120);
  }, []);
  const togglePause = useCallback(() => {
    setPaused((p) => { pausedRef.current = !p; return !p; });
  }, []);

  /* ---- iframe ready handshake ---- */
  useEffect(() => {
    const onMessage = (e) => {
      if (e?.data?.type === 'storepilot:ready') {
        readyRef.current = true;
        setIframeReady(true);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  /* ---- helpers ---- */
  const sendGoto = (tab) => {
    try {
      iframeRef.current?.contentWindow?.postMessage({ type: 'storepilot:goto', tab }, '*');
    } catch { /* noop */ }
  };

  const moveCursorTo = useCallback(async (x, y, ms = 600) => {
    setCursor((c) => ({ ...c, x, y, visible: true }));
    await sleep(ms);
  }, []);
  const flashClick = useCallback(async () => {
    setCursor((c) => ({ ...c, clicking: true }));
    await sleep(220);
    setCursor((c) => ({ ...c, clicking: false }));
  }, []);

  /* ---- run a scene's steps ---- */
  const runScene = useCallback(async (s) => {
    const iframe = iframeRef.current;
    const stage = stageRef.current;
    const container = containerRef.current;
    if (!iframe || !stage || !container || !s) return;

    for (const step of s.steps) {
      if (cancelRef.current) return;
      await waitWhilePaused();
      if (cancelRef.current) return;

      if (step.kind === 'caption') {
        setCaption(step.text);
        continue;
      }

      const target = await resolveTarget(step, iframe);
      if (target) {
        const rect = getRect(target);
        if (rect) {
          // Cursor overlay is rendered inside the stage div, so its coordinate
          // space is the stage's own top-left. Multiply iframe-relative rect by
          // the scale factor that the iframe is rendered at.
          const x = rect.x * scale;
          const y = rect.y * scale;
          await moveCursorTo(x, y, 650);
          if (step.kind !== 'type') await flashClick();
        }
      }
      await performStep(step, iframe);
    }
  }, [scale, moveCursorTo, flashClick, waitWhilePaused]);

  /* ---- master loop ---- */
  useEffect(() => {
    cancelRef.current = false;
    let cancelled = false;

    const waitForReady = async () => {
      const start = performance.now();
      while (!readyRef.current && !cancelled) {
        if (performance.now() - start > 15000) return false;
        await sleep(150);
      }
      return !cancelled;
    };

    const loop = async () => {
      while (!cancelled) {
        const ok = await waitForReady();
        if (!ok || cancelled) return;
        await sleep(500);

        const idx = sceneIdxRef.current;
        const s = SCENES[idx];
        setCaption(s.subtitle || '');
        sendGoto(s.tab);
        await sleep(600);
        if (cancelled) return;

        await Promise.race([
          runScene(s),
          (async () => {
            const cap = s.duration || 15000;
            const start = performance.now();
            while (performance.now() - start < cap && !cancelled) await sleep(200);
          })(),
        ]);
        if (cancelled) return;

        await sleep(800);
        while (pausedRef.current && !cancelled) await sleep(150);
        if (cancelled) return;
        const next = (sceneIdxRef.current + 1) % SCENES.length;
        sceneIdxRef.current = next;
        setSceneIdx(next);
      }
    };

    loop();
    return () => { cancelled = true; cancelRef.current = true; };
  }, [runScene]);

  const jumpTo = (i) => {
    sceneIdxRef.current = i;
    setSceneIdx(i);
    setCaption(SCENES[i]?.subtitle || '');
    sendGoto(SCENES[i].tab);
  };
  const goNext = () => jumpTo((sceneIdxRef.current + 1) % SCENES.length);

  return (
    <div
      ref={containerRef}
      className={`relative mx-auto rounded-2xl overflow-hidden shadow-2xl border border-border bg-card ${
        fullscreen ? 'w-full max-w-none rounded-none h-screen flex flex-col' : 'w-full max-w-7xl flex flex-col'
      }`}
      style={
        fullscreen
          ? undefined
          : {
              // Cap overall height so the entire player (chrome + stage) fits
              // the viewport, then derive a matching max-width that preserves
              // the 1440 / (860 + ~88px chrome) aspect so the stage never gets
              // cropped or pushed off-screen mid-scroll.
              maxHeight: 'calc(100vh - 80px)',
              maxWidth: 'min(100%, calc((100vh - 80px) * (1440 / 970)))',
            }
      }
    >
      {/* Browser chrome */}
      <div className="flex items-center px-4 py-2.5 bg-muted/60 border-b border-border gap-3 flex-shrink-0">
        <div className="flex space-x-1.5 flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-red-400" />
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-background/70 border border-border rounded-md px-3 py-1 text-xs text-muted-foreground text-center font-mono truncate">
            app.storepilot.com/{scene?.tab || 'pos'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-400' : 'bg-green-500 animate-pulse'}`} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
            {paused ? 'Paused' : 'Live'}
          </span>
          <button type="button" onClick={togglePause}
            className="ml-2 p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={paused ? 'Resume' : 'Pause'} title={paused ? 'Resume' : 'Pause'}>
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
          <button type="button" onClick={goNext}
            className="p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Next scene" title="Next scene">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={toggleFullscreen}
            className="p-1.5 rounded-md hover:bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enlarge'} title={fullscreen ? 'Exit fullscreen' : 'Enlarge'}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="relative bg-background overflow-hidden"
        style={fullscreen ? { flex: 1 } : { aspectRatio: `${VW} / ${VH}` }}>
        <iframe
          ref={iframeRef}
          title="StorePilot live demo"
          src="/demo?embedded=1&tab=pos"
          tabIndex={-1}
          aria-hidden="true"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => {
            // Fallback: if postMessage handshake never arrives, treat iframe load as ready.
            readyRef.current = true;
            setIframeReady(true);
          }}
          className="absolute top-0 left-0 border-0 bg-background select-none"
          style={{
            width: VW,
            height: VH,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            pointerEvents: 'none', // <-- iframe is a pure video; visitors can't click into it
          }}
        />

        {/* Transparent click-shield: catches any stray events on top of the iframe area */}
        <div
          className="absolute inset-0 z-10"
          style={{ pointerEvents: 'auto', cursor: 'default' }}
          aria-hidden="true"
          onClick={(e) => e.preventDefault()}
        />

        {/* Cursor overlay */}
        <AnimatePresence>
          {cursor.visible && (
            <motion.div key="cursor"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, x: cursor.x, y: cursor.y }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 130, damping: 20, mass: 0.6 }}
              className="pointer-events-none absolute top-0 left-0 z-20"
              style={{ width: 0, height: 0 }}
              aria-hidden="true"
            >
              <AnimatePresence>
                {cursor.clicking && (
                  <motion.span key="ripple"
                    initial={{ scale: 0, opacity: 0.6 }}
                    animate={{ scale: 2.4, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className="absolute -top-5 -left-5 w-10 h-10 rounded-full bg-primary/50"
                  />
                )}
              </AnimatePresence>
              <svg width="22" height="26" viewBox="0 0 22 26" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                <path d="M2 2 L2 20 L7 16 L10 23 L13 22 L10 15 L17 14 Z"
                  fill="white" stroke="black" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {!iframeReady && (
          <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-background flex items-center justify-center z-30">
            <div className="text-sm text-muted-foreground animate-pulse">Loading live demo…</div>
          </div>
        )}

        {/* Caption */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-30 pointer-events-none px-4 max-w-full">
          <AnimatePresence mode="wait">
            <motion.div key={caption}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="px-4 py-2 rounded-full bg-black/75 text-white text-sm font-medium shadow-lg backdrop-blur-sm whitespace-nowrap"
            >
              {caption}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Scene strip */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/40 border-t border-border flex-shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{scene?.title}</div>
          <div className="text-xs text-muted-foreground truncate">{scene?.subtitle}</div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {SCENES.map((s, i) => (
            <button key={s.id} type="button" onClick={() => jumpTo(i)}
              aria-label={`Play ${s.title}`} title={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === sceneIdx ? 'w-8 bg-primary' : 'w-2 bg-border hover:bg-muted-foreground/40'
              }`} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveDemoPlayer;
