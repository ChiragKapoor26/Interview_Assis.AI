import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

export interface FacialMetrics {
  eyeContact: number    // 0–100
  smileRatio: number    // 0–100
  confidence: number    // 0–100
  faceDetected: boolean
}

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export function useFacialAnalysis(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean = true
) {
  const [metrics, setMetrics] = useState<FacialMetrics>({
    eyeContact: 0,
    smileRatio: 0,
    confidence: 0,
    faceDetected: false,
  })
  const [isReady, setIsReady] = useState(false)

  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const animFrameRef = useRef<number>(0)
  const isRunning = useRef(false)

  const runDetection = useCallback(() => {
    const video = videoRef.current
    if (!isRunning.current || !landmarkerRef.current || !video) return
    if (video.readyState < 2 || video.paused || video.videoWidth === 0) {
      animFrameRef.current = requestAnimationFrame(runDetection)
      return
    }

    try {
      const result = landmarkerRef.current.detectForVideo(video, performance.now())

      if (result.faceLandmarks.length > 0 && result.faceBlendshapes?.length > 0) {
        const shapes = result.faceBlendshapes[0].categories
        const get = (name: string) =>
          shapes.find((b) => b.categoryName === name)?.score ?? 0

        // Eye openness (1 = wide open, 0 = closed)
        const eyeOpenness = 1 - (get('eyeBlinkLeft') + get('eyeBlinkRight')) / 2

        // Smile (0–1)
        const smile = (get('mouthSmileLeft') + get('mouthSmileRight')) / 2

        // Head centering: nose tip x should be close to 0.5
        const lm = result.faceLandmarks[0]
        const noseX = lm[1]?.x ?? 0.5
        const noseY = lm[1]?.y ?? 0.5
        const xCenter = 1 - Math.min(1, Math.abs(noseX - 0.5) * 4)
        const yCenter = 1 - Math.min(1, Math.abs(noseY - 0.4) * 4)
        const faceCentered = (xCenter + yCenter) / 2

        // Eye contact = open eyes + face is centred/looking forward
        const eyeContact = Math.round(eyeOpenness * faceCentered * 100)
        const smileRatio = Math.round(smile * 100)
        // Confidence = weighted average
        const confidence = Math.round(eyeContact * 0.55 + smileRatio * 0.25 + faceCentered * 20)

        setMetrics({
          eyeContact: Math.min(100, eyeContact),
          smileRatio: Math.min(100, smileRatio),
          confidence: Math.min(100, confidence),
          faceDetected: true,
        })
      } else {
        setMetrics((prev) => ({ ...prev, faceDetected: false, eyeContact: 0, confidence: 0 }))
      }
    } catch {
      // silently skip frame errors
    }

    animFrameRef.current = requestAnimationFrame(runDetection)
  }, [videoRef])

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL)
        if (cancelled) return
        landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        })
        if (cancelled) return
        setIsReady(true)
        isRunning.current = true
        animFrameRef.current = requestAnimationFrame(runDetection)
      } catch (err) {
        console.warn('[MediaPipe] Failed to initialise face landmarker:', err)
      }
    }

    init()

    return () => {
      cancelled = true
      isRunning.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [enabled, runDetection])

  return { metrics, isReady }
}
