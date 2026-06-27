/**
 * Camera QR scanner for joining a squad (E03/DEC-103). iOS Safari has no `BarcodeDetector`, so frames
 * are decoded with **jsQR — lazy-loaded only when the scanner opens**, so it never weighs on the main
 * bundle. The typed link/code entry stays the primary, fully-reliable path; scanning is a convenience
 * that always degrades honestly: no camera or a denied permission shows a clear message back to typing.
 * The `MediaStream` is torn down on every exit path (success / close / unmount) so the camera light
 * never lingers.
 */
import { useEffect, useRef, useState } from "react";
import { useT } from "../../i18n";

type ScanStatus = "starting" | "scanning" | "denied" | "nocam";

export function QrScanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }): JSX.Element {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<ScanStatus>("starting");
  // Read the latest callback without restarting the camera when the parent re-renders.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let decode: typeof import("jsqr").default | null = null;

    const stop = (): void => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };

    const tick = (): void => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && decode && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const found = decode(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (found?.data) {
              stop();
              onResultRef.current(found.data);
              return;
            }
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const start = async (): Promise<void> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("nocam");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        decode = (await import("jsqr")).default;
        if (cancelled) return;
        setStatus("scanning");
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : "";
        setStatus(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "nocam");
      }
    };

    void start();
    return stop;
  }, []);

  const failed = status === "denied" || status === "nocam";

  return (
    <div className="qr-scanner" role="dialog" aria-modal="true" aria-label={t("join.scanTitle")}>
      <div className="qr-scanner-stage">
        <video ref={videoRef} className="qr-scanner-video" playsInline muted />
        {!failed && <div className="qr-scanner-reticle" aria-hidden="true" />}
        <canvas ref={canvasRef} hidden />
      </div>
      <div className="qr-scanner-foot">
        {status === "starting" && <p className="qr-scanner-hint">{t("join.scanStarting")}</p>}
        {status === "scanning" && <p className="qr-scanner-hint">{t("join.scanAlign")}</p>}
        {status === "denied" && <p className="qr-scanner-msg">{t("join.cameraDenied")}</p>}
        {status === "nocam" && <p className="qr-scanner-msg">{t("join.cameraNone")}</p>}
      </div>
      <button className="lightbox-close qr-scanner-close" onClick={onClose} aria-label={t("common.close")}>
        <span className="ms" aria-hidden="true">close</span>
      </button>
    </div>
  );
}
