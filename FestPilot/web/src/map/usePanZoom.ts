/**
 * Pan/zoom for the map: pointer drag, wheel zoom (desktop), and two-finger pinch
 * (mobile). The map art is a single transformed "world" layer, so the base image
 * and the live overlay stay perfectly aligned at any zoom.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

export interface View { x: number; y: number; scale: number; }

const MAX_SCALE = 12;

export function usePanZoom(contentW: number, contentH: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const fit = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);

  const clamp = useCallback((s: number) => Math.max(fit.current * 0.9, Math.min(s, MAX_SCALE)), []);

  const zoomAround = useCallback((cx: number, cy: number, factor: number) => {
    setView((v) => {
      const ns = clamp(v.scale * factor);
      const k = ns / v.scale;
      return { scale: ns, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k };
    });
  }, [clamp]);

  const recenter = useCallback(() => {
    const el = ref.current;
    if (!el || !contentW || !contentH) return;
    const vw = el.clientWidth, vh = el.clientHeight;
    const s = Math.min(vw / contentW, vh / contentH);
    fit.current = s;
    setView({ scale: s, x: (vw - contentW * s) / 2, y: (vh - contentH * s) / 2 });
  }, [contentW, contentH]);

  useEffect(() => { recenter(); }, [recenter]);

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

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      setView((v) => ({ ...v, x: v.x + (e.clientX - prev.x), y: v.y + (e.clientY - prev.y) }));
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
