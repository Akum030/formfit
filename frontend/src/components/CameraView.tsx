/**
 * CameraView — Webcam display + canvas overlay for pose skeleton.
 *
 * Renders the webcam video feed and provides the canvas for OverlaySkeleton.
 * Handles camera permissions, resolution, and mirroring.
 */

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

interface CameraViewProps {
  onVideoReady: (video: HTMLVideoElement) => void;
  width?: number;
  height?: number;
  mirrored?: boolean;
  children?: React.ReactNode;
}

export interface CameraViewRef {
  getCanvas: () => HTMLCanvasElement | null;
  getVideo: () => HTMLVideoElement | null;
}

export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  ({ onVideoReady, width = 640, height = 480, mirrored = true, children }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(true);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
      getVideo: () => videoRef.current,
    }));

    useEffect(() => {
      let stream: MediaStream | null = null;
      let cancelled = false;

      async function startCamera() {
        try {
          setIsStarting(true);
          setCameraError(null);

          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: width },
              height: { ideal: height },
              facingMode: 'user',
              frameRate: { ideal: 30 },
            },
            audio: false,
          });

          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            await video.play();
            setIsStarting(false);
            onVideoReady(video);
          }
        } catch (err) {
          if (!cancelled) {
            console.error('[Camera] Error:', err);
            setCameraError(
              err instanceof DOMException && err.name === 'NotAllowedError'
                ? 'Camera access denied. Please allow camera permissions.'
                : 'Failed to start camera. Check that no other app is using it.'
            );
            setIsStarting(false);
          }
        }
      }

      startCamera();

      return () => {
        cancelled = true;
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
    }, [width, height, onVideoReady]);

    return (
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ width, height }}>
        {/* Video feed */}
        <video
          ref={videoRef}
          width={width}
          height={height}
          autoPlay
          playsInline
          muted
          style={{
            transform: mirrored ? 'scaleX(-1)' : 'none',
            objectFit: 'cover',
          }}
          className="absolute inset-0 w-full h-full"
        />

        {/* Canvas overlay for skeleton */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          style={{
            transform: mirrored ? 'scaleX(-1)' : 'none',
          }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Overlay components (score, issues, etc) */}
        {children}

        {/* Loading state */}
        {isStarting && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gym-900/80">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-gym-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/70 text-sm">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gym-900/90 p-6">
            <div className="text-center max-w-sm">
              <div className="text-4xl mb-3">📷</div>
              <p className="text-gym-red font-medium mb-2">Camera Error</p>
              <p className="text-white/60 text-sm">{cameraError}</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

CameraView.displayName = 'CameraView';
