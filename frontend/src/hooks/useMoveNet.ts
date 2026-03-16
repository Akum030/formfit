/**
 * useMoveNet — Loads TensorFlow.js MoveNet model and runs pose estimation
 * on webcam frames at ~15 FPS.
 *
 * Returns: pose keypoints, loading state, FPS stats.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Keypoint } from '../types';

// MoveNet model types from @tensorflow-models/pose-detection
type PoseDetector = {
  estimatePoses(
    image: HTMLVideoElement | HTMLCanvasElement,
    config?: { flipHorizontal?: boolean }
  ): Promise<Array<{ keypoints: Array<{ x: number; y: number; score?: number; name?: string }> }>>;
  dispose(): void;
};

interface UseMoveNetResult {
  keypoints: Keypoint[];
  isLoading: boolean;
  isReady: boolean;
  fps: number;
  error: string | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
}

const TARGET_FPS = 15;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

export function useMoveNet(): UseMoveNetResult {
  const [keypoints, setKeypoints] = useState<Keypoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const detectorRef = useRef<PoseDetector | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number>(0);
  const runningRef = useRef(false);
  const fpsCountRef = useRef(0);
  const fpsTimerRef = useRef(0);

  // Load the model once
  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamic imports so TF.js doesn't block initial render
        const tf = await import('@tensorflow/tfjs-core');
        await import('@tensorflow/tfjs-backend-webgl');
        await tf.ready();

        const poseDetection = await import('@tensorflow-models/pose-detection');

        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          {
            modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
          }
        );

        if (cancelled) {
          detector.dispose();
          return;
        }

        detectorRef.current = detector as unknown as PoseDetector;
        setIsLoading(false);
        setIsReady(true);
        console.log('[MoveNet] Model loaded (SinglePose Thunder)');
      } catch (err) {
        if (!cancelled) {
          console.error('[MoveNet] Failed to load:', err);
          setError(err instanceof Error ? err.message : 'Failed to load pose model');
          setIsLoading(false);
        }
      }
    }

    loadModel();
    return () => { cancelled = true; };
  }, []);

  // Detection loop
  const runDetection = useCallback(async () => {
    if (!runningRef.current || !detectorRef.current || !videoRef.current) return;

    const video = videoRef.current;
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(runDetection, 50);
      });
      return;
    }

    const start = performance.now();

    try {
      const poses = await detectorRef.current.estimatePoses(video, {
        flipHorizontal: false,
      });

      if (poses.length > 0) {
        setKeypoints(poses[0].keypoints as Keypoint[]);
      }
    } catch (err) {
      // Silently skip frame errors — model can sometimes fail on edge frames
    }

    // FPS tracking
    fpsCountRef.current++;
    const now = performance.now();
    if (now - fpsTimerRef.current >= 1000) {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
      fpsTimerRef.current = now;
    }

    // Schedule next frame
    const elapsed = now - start;
    const delay = Math.max(0, FRAME_INTERVAL - elapsed);

    if (runningRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(runDetection, delay);
      });
    }
  }, []);

  const startDetection = useCallback((video: HTMLVideoElement) => {
    videoRef.current = video;
    runningRef.current = true;
    fpsTimerRef.current = performance.now();
    fpsCountRef.current = 0;
    runDetection();
  }, [runDetection]);

  const stopDetection = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    setKeypoints([]);
    setFps(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (detectorRef.current) {
        detectorRef.current.dispose();
        detectorRef.current = null;
      }
    };
  }, []);

  return { keypoints, isLoading, isReady, fps, error, startDetection, stopDetection };
}
