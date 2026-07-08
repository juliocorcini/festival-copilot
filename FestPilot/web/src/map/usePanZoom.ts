/**
 * Pan/zoom for the map: pointer drag, wheel zoom (desktop), and two-finger pinch
 * (mobile). The map art is a single transformed "world" layer, so the base image
 * and the live overlay stay perfectly aligned at any zoom.
 *
 * Pan is clamped so the scaled world always covers the viewport's *safe rect* (the
 * viewport minus the in-canvas chrome `insets`) — you can no longer drag into the
 * black void (R2.1, §6 #4), and the initial fit frames the venue inside the visible
 * area rather than behind the top bar / bottom sheet (§6 #6). The geometry lives in
 * the pure, unit-tested `panClamp` module.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { clampPan, fitScale, fitView, DEFAULT_MAX_SCALE, NO_INSETS, type Insets, type View } from "./panClamp";

export type { View };

/** Cosmetic overscroll tolerated at an edge before the clamp bites (px). */
const BLEED = 40;

export function usePanZoom(
  contentW: number,
  contentH: number,
  insets: Insets = NO_INSETS,
  maxScale: number = DEFAULT_MAX_SCALE,
) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const fit = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const userMoved = useRef(false);

  // Live geometry refs the pan/zoom math reads without re-subscribing listeners.
  const world = useRef({ w: contentW, h: contentH });
  world.current = { w: contentW, h: contentH };
  const insetsRef = useRef(insets);
  insetsRef.current = insets;
  // The honest zoom ceiling (D01, DEC-075) — tracks the loaded base's resolution; tightens/loosens live.
  const maxScaleRef = useRef(maxScale);
  maxScaleRef.current = maxScale;
  const vp = useRef({ w: 0, h: 0 });

  // Floor at the cover scale (`fit.current`): zooming out past it would reveal the tinted void again.
  // Ceiling at the base's crisp limit (`maxScaleRef`): zooming past it would only blur the raster.
  const clampScale = useCallback((s: number) => Math.max(fit.current, Math.min(s, maxScaleRef.current)), []);

  const settle = useCallback(
    (v: View): View => clampPan(v, world.current, vp.current, insetsRef.current, BLEED),
    [],
  );

  const zoomAround = useCallback((cx: number, cy: number, factor: number) => {
    userMoved.current = true;
    setView((v) => {
      const ns = clampScale(v.scale * factor);
      const k = ns / v.scale;
      return settle({ scale: ns, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
    });
  }, [clampScale, settle]);

  const recenter = useCallback(() => {
    const el = ref.current;
    if (!el || !contentW || !contentH) return;
    vp.current = { w: el.clientWidth, h: el.clientHeight };
    fit.current = fitScale(world.current, vp.current, insetsRef.current);
    userMoved.current = false;
    setView(fitView(world.current, vp.current, insetsRef.current));
  }, [contentW, contentH]);

  // Mount + geometry changes: refit while untouched, otherwise just re-clamp the current view so
  // a growing bottom sheet or a rotate never strands the art off-screen but also never yanks zoom.
  useEffect(() => {
    const el = ref.current;
    if (!el || !contentW || !contentH) return;
    vp.current = { w: el.clientWidth, h: el.clientHeight };
    fit.current = fitScale(world.current, vp.current, insetsRef.current);
    if (userMoved.current) setView((v) => settle(v));
    else recenter();
  }, [contentW, contentH, insets.top, insets.right, insets.bottom, insets.left, recenter, settle]);

  // Keep the view valid when the viewport itself resizes (rotate, split-view, keyboard).
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      vp.current = { w: el.clientWidth, h: el.clientHeight };
      fit.current = fitScale(world.current, vp.current, insetsRef.current);
      if (userMoved.current) setView((v) => settle(v));
      else recenter();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [recenter, settle]);

  // Native wheel listener so we can preventDefault (React's onWheel is passive).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAround(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAround]);

  // Double-tap zoom (F12): two quick taps (<300ms, <30px apart) toggles between 2× and fit scale.
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const DOUBLE_TAP_MS = 300;
  const DOUBLE_TAP_PX = 30;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const now = Date.now();
      const prev = lastTap.current;
      if (
        prev &&
        now - prev.time < DOUBLE_TAP_MS &&
        Math.abs(e.clientX - prev.x) < DOUBLE_TAP_PX &&
        Math.abs(e.clientY - prev.y) < DOUBLE_TAP_PX
      ) {
        lastTap.current = null;
        const el = ref.current;
        if (el) {
          const r = el.getBoundingClientRect();
          const cx = e.clientX - r.left;
          const cy = e.clientY - r.top;
          setView((v) => {
            const zoomedIn = v.scale > fit.current * 1.5;
            if (zoomedIn) return fitView(world.current, vp.current, insetsRef.current);
            const target = clampScale(fit.current * 2.5);
            const k = target / v.scale;
            return settle({ scale: target, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k });
          });
          userMoved.current = true;
        }
      } else {
        lastTap.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      const dx = Math.abs(e.clientX - prev.x);
      const dy = Math.abs(e.clientY - prev.y);
      if (dx > 3 || dy > 3) lastTap.current = null;
      userMoved.current = true;
      setView((v) => settle({ ...v, x: v.x + (e.clientX - prev.x), y: v.y + (e.clientY - prev.y) }));
    } else if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = ref.current!.getBoundingClientRect();
      if (pinchDist.current) {
        zoomAround((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, dist / pinchDist.current);
      }
      pinchDist.current = dist;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  };

  return {
    ref,
    view,
    recenter,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onPointerLeave: onPointerUp,
    },
  };
}
