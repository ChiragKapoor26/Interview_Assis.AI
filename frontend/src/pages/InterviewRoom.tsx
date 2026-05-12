import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '@monaco-editor/react'
import { API_URL } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Mic, PhoneOff, Code2, VideoOff, MessageSquareQuote, Eye, Smile, Zap, Loader2 } from 'lucide-react'
import { useFacialAnalysis } from '../hooks/useFacialAnalysis'

interface Message { role: 'agent' | 'user'; text: string }

const PING_INTERVAL_MS = 25_000
const MAX_RECONNECT    = 3

/* ─── Metric Bar ─────────────────────────────────────────────── */
function MetricBar({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: number; color: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`shrink-0 ${color}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-muted-foreground font-medium">{label}</span>
          <span className={`font-bold tabular-nums ${color}`}>{value}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              value >= 70 ? 'bg-green-500' : value >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/* ─── Facial HUD ─────────────────────────────────────────────── */
function FacialHUD({ metrics, isReady }: {
  metrics: { eyeContact: number; smileRatio: number; confidence: number; faceDetected: boolean }
  isReady: boolean
}) {
  if (!isReady) return (
    <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
      <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Loading AI vision…
      </div>
    </div>
  )
  return (
    <>
      <div className="absolute top-2 right-2 pointer-events-none">
        <div className={`w-3 h-3 rounded-full border-2 ${
          metrics.faceDetected
            ? 'border-green-400 bg-green-400/30 animate-pulse'
            : 'border-red-400 bg-red-400/20'
        }`} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4 pointer-events-none">
        <div className="space-y-1.5">
          <MetricBar icon={<Eye className="w-3 h-3" />}   label="Eye Contact" value={metrics.faceDetected ? metrics.eyeContact : 0}  color="text-blue-400"   />
          <MetricBar icon={<Smile className="w-3 h-3" />} label="Expression"  value={metrics.faceDetected ? metrics.smileRatio : 0}  color="text-yellow-400" />
          <MetricBar icon={<Zap className="w-3 h-3" />}   label="Confidence"  value={metrics.faceDetected ? metrics.confidence : 0}  color="text-purple-400" />
        </div>
      </div>
    </>
  )
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function InterviewRoom({ user }: { user: any }) {
  const { id: interviewId } = useParams()
  const navigate = useNavigate()

  /* ── Refs ──────────────────────────────────────────────────── */
  const wsRef             = useRef<WebSocket | null>(null)
  const pingTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectCountRef = useRef(0)
  const intentionalClose  = useRef(false)
  const audioQueueRef     = useRef<string[]>([])
  const isPlayingRef      = useRef(false)
  const audioElRef        = useRef<HTMLAudioElement | null>(null)
  const videoRef          = useRef<HTMLVideoElement>(null)
  const recognitionRef    = useRef<any>(null)
  const transcriptEndRef  = useRef<HTMLDivElement>(null)
  const facialMetricsLog  = useRef<any[]>([])

  /* ── State ─────────────────────────────────────────────────── */
  const [messages, setMessages]               = useState<Message[]>([])
  const [agentText, setAgentText]             = useState('')
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false)
  const [isListening, setIsListening]         = useState(false)
  const [connected, setConnected]             = useState(false)
  const [interviewDone, setInterviewDone]     = useState(false)
  const [questionIndex, setQuestionIndex]     = useState(0)
  const [code, setCode]                       = useState('// Write your solution here\n\n')
  const [language, setLanguage]               = useState('javascript')
  const [cameraOn, setCameraOn]               = useState(false)

  const { metrics: liveMetrics, isReady: facialReady } = useFacialAnalysis(videoRef, cameraOn)

  /* ── Facial snapshot every 5 s ─────────────────────────────── */
  useEffect(() => {
    if (!cameraOn || interviewDone || !liveMetrics.faceDetected) return
    const t = setInterval(() => {
      facialMetricsLog.current.push({
        eye_contact: liveMetrics.eyeContact / 100,
        smile_ratio: liveMetrics.smileRatio / 100,
        confidence:  liveMetrics.confidence  / 100,
        ts: Date.now(),
      })
    }, 5000)
    return () => clearInterval(t)
  }, [cameraOn, interviewDone, liveMetrics])

  /* ── Auto-scroll transcript ────────────────────────────────── */
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── Audio queue ───────────────────────────────────────────── */
  const playNextAudio = useCallback(() => {
    if (!audioQueueRef.current.length) {
      isPlayingRef.current = false
      setIsAgentSpeaking(false)
      return
    }
    isPlayingRef.current = true
    const b64  = audioQueueRef.current.shift()!
    const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'audio/mpeg' })
    const url  = URL.createObjectURL(blob)
    const el   = audioElRef.current
    if (!el) { URL.revokeObjectURL(url); playNextAudio(); return }
    el.src     = url
    el.onended = () => { URL.revokeObjectURL(url); playNextAudio() }
    el.onerror = () => { URL.revokeObjectURL(url); playNextAudio() }
    el.play().catch(() => { URL.revokeObjectURL(url); playNextAudio() })
  }, [])

  const enqueueAudio = useCallback((b64: string) => {
    audioQueueRef.current.push(b64)
    if (!isPlayingRef.current) playNextAudio()
  }, [playNextAudio])

  /* ─────────────────────────────────────────────────────────────
     WEBSOCKET EFFECT — single self-contained effect.

     Key insight: the local `cancelled` boolean belongs to THIS
     invocation only. React Strict Mode double-fires effects:
       Run 1 → cleanup → cancelled=true → ws1 closes harmlessly
       Run 2 → cancelled=false → ws2 connects and stays open ✅

     Never extracted to useCallback: a callback would capture a
     stale `cancelled` from a different closure scope.
  ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!interviewId) return

    // Strict Mode / unmount guard — local to this effect invocation
    let cancelled = false

    // ── Camera (non-blocking, does not delay WS) ─────────────
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        if (videoRef.current) { videoRef.current.srcObject = stream; setCameraOn(true) }
      })
      .catch(() => setCameraOn(false))

    // ── Derive WS URL — handles http/https → ws/wss ──────────
    // e.g. "http://localhost:8000" → "ws://localhost:8000"
    //      "https://api.myapp.com" → "wss://api.myapp.com"
    const wsBase = API_URL.replace(/^https?/, m => m === 'https' ? 'wss' : 'ws')
    const wsUrl  = `${wsBase}/ws/interview/${interviewId}`
    console.log('[WS] Connecting →', wsUrl)

    // ── Create socket ────────────────────────────────────────
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl)
    } catch (err) {
      console.error('[WS] Could not construct WebSocket:', err)
      return
    }
    wsRef.current = ws

    // ── Handlers ─────────────────────────────────────────────
    ws.onopen = () => {
      // Strict Mode cleanup may have fired before the handshake finished.
      // If so, close this zombie socket immediately and bail.
      if (cancelled) {
        console.log('[WS] Cancelled before open — closing zombie socket')
        ws.close()
        return
      }
      console.log('[WS] Connected ✓')
      reconnectCountRef.current = 0
      intentionalClose.current  = false
      setConnected(true)

      // Keep-alive ping
      if (pingTimerRef.current) clearInterval(pingTimerRef.current)
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, PING_INTERVAL_MS)
    }

    ws.onmessage = ({ data }) => {
      if (cancelled) return
      try {
        const msg = JSON.parse(data)
        switch (msg.type) {
          case 'pong': break

          case 'agent_turn':
            setAgentText(msg.text)
            setIsAgentSpeaking(true)
            setMessages(prev => [...prev, { role: 'agent', text: msg.text }])
            setQuestionIndex(msg.question_index ?? 0)
            if (msg.is_complete) setInterviewDone(true)
            break

          case 'audio':
            if (msg.data) enqueueAudio(msg.data)
            break

          case 'interview_complete':
            setInterviewDone(true)
            break

          default:
            console.warn('[WS] Unknown message type:', msg.type)
        }
      } catch (e) {
        console.error('[WS] Parse error:', e)
      }
    }

    ws.onerror = () => {
      // onclose fires right after onerror — handle reconnect there
      if (!cancelled) console.error('[WS] Socket error')
    }

    ws.onclose = ({ code, reason }) => {
      // If cancelled=true this close was triggered by our own cleanup → ignore
      if (cancelled) return

      console.warn(`[WS] Closed — code=${code} reason="${reason}"`)
      setConnected(false)
      if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null }

      if (!intentionalClose.current && reconnectCountRef.current < MAX_RECONNECT) {
        reconnectCountRef.current++
        const delay = reconnectCountRef.current * 1500
        console.warn(`[WS] Reconnecting in ${delay}ms (${reconnectCountRef.current}/${MAX_RECONNECT})`)
        setTimeout(() => {
          if (!cancelled) {
            // Re-open a fresh socket with the same handlers
            const ws2 = new WebSocket(wsUrl)
            wsRef.current = ws2
            ws2.onopen    = ws.onopen
            ws2.onmessage = ws.onmessage
            ws2.onerror   = ws.onerror
            ws2.onclose   = ws.onclose
          }
        }, delay)
      } else if (!intentionalClose.current) {
        console.error('[WS] Max reconnect attempts reached')
      }
    }

    // ── Cleanup (runs on unmount or before re-run) ───────────
    return () => {
      cancelled = true   // ← makes every handler a no-op from this point
      if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null }
      recognitionRef.current?.stop()
      // Close only if still connecting or open (not already closing/closed)
      if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId])
  // Only re-run when interview changes. enqueueAudio is referentially stable.

  /* ── Speech recognition ─────────────────────────────────────── */
  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous     = false
    r.interimResults = false
    r.lang           = 'en-US'
    r.onstart  = () => setIsListening(true)
    r.onend    = () => setIsListening(false)
    r.onerror  = () => setIsListening(false)
    r.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript.trim()
      if (transcript && wsRef.current?.readyState === WebSocket.OPEN) {
        setMessages(prev => [...prev, { role: 'user', text: transcript }])
        wsRef.current!.send(JSON.stringify({ type: 'user_turn', transcript, code_content: code }))
      }
    }
    r.start()
    recognitionRef.current = r
  }, [code])

  const stopRecognition = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  /* ── Helpers ────────────────────────────────────────────────── */
  const summarizeFacialMetrics = () => {
    const log = facialMetricsLog.current
    if (!log.length) return null
    const avg = (k: string) => log.reduce((s: number, m: any) => s + (m[k] || 0), 0) / log.length
    return {
      eye_contact: avg('eye_contact').toFixed(2),
      smile_ratio: avg('smile_ratio').toFixed(2),
      confidence:  avg('confidence').toFixed(2),
    }
  }

  const handleEndInterview = async () => {
    intentionalClose.current = true
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_interview' }))
      wsRef.current.close()
    }
    try {
      await fetch(`${API_URL}/api/interview/end`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_id:   interviewId,
          user_id:        user?.id,
          transcript:     messages,
          facial_metrics: summarizeFacialMetrics(),
        }),
      })
    } catch {}
    navigate('/dashboard')
  }

  const progress = Math.min(100, (questionIndex / 10) * 100)

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <audio ref={audioElRef} className="hidden" />

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          <span className="text-primary">⚡</span> InterviewAI
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`w-2 h-2 rounded-full transition-colors ${
              connected
                ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
                : 'bg-yellow-500 animate-pulse'
            }`} />
            {connected
              ? 'Live'
              : reconnectCountRef.current > 0
                ? `Reconnecting… (${reconnectCountRef.current}/${MAX_RECONNECT})`
                : 'Connecting…'}
          </div>

          <div className="flex items-center gap-3 w-48">
            <Progress value={progress} className="h-1.5" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">Q {questionIndex}/10</span>
          </div>

          {cameraOn && facialReady && liveMetrics.faceDetected && (
            <div className="hidden md:flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className={`font-bold tabular-nums ${
                liveMetrics.confidence >= 70 ? 'text-green-400'
                : liveMetrics.confidence >= 40 ? 'text-yellow-400'
                : 'text-red-400'
              }`}>{liveMetrics.confidence}%</span>
            </div>
          )}
        </div>

        <Button variant="destructive" size="sm" onClick={handleEndInterview} className="font-semibold">
          <PhoneOff className="w-4 h-4 mr-2" /> End
        </Button>
      </header>

      {/* ── Main Grid ───────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">

        {/* Left Panel */}
        <div className="lg:col-span-4 border-r bg-muted/20 flex flex-col p-4 gap-4 overflow-y-auto">

          {/* Agent Card */}
          <Card className="bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center font-bold text-lg">A</div>
                <div className="flex-1">
                  <h3 className="font-semibold">Alex</h3>
                  <p className="text-xs text-muted-foreground">Senior Engineer</p>
                </div>
                <Badge
                  variant={isAgentSpeaking ? 'default' : 'secondary'}
                  className={`transition-colors ${isAgentSpeaking ? 'bg-primary/20 text-primary border-primary/30' : ''}`}
                >
                  {isAgentSpeaking ? '🔊 Speaking' : '💤 Listening'}
                </Badge>
              </div>
              <p className="min-h-[60px] text-sm text-muted-foreground leading-relaxed">
                {agentText || (connected ? 'Alex is ready…' : 'Connecting to Alex…')}
              </p>
            </CardContent>
          </Card>

          {/* Transcript */}
          <Card className="flex-1 flex flex-col min-h-0 bg-card">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <MessageSquareQuote className="w-3.5 h-3.5" /> Transcript
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {connected ? 'Conversation will appear here…' : 'Establishing connection…'}
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {m.role === 'agent' ? 'Alex' : 'You'}
                  </span>
                  <div className={`px-3 py-2 rounded-xl text-sm max-w-[90%] ${
                    m.role === 'agent'
                      ? 'bg-primary/10 border border-primary/20 text-foreground rounded-tl-none'
                      : 'bg-blue-500/10 border border-blue-500/20 text-foreground rounded-tr-none'
                  }`}>{m.text}</div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </CardContent>
          </Card>

          {/* Camera + Mic */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="overflow-hidden bg-black aspect-[4/3] relative">
              {cameraOn ? (
                <>
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
                  <FacialHUD metrics={liveMetrics} isReady={facialReady} />
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                  <VideoOff className="w-6 h-6 mb-2 opacity-50" />
                  <span className="text-xs">Camera Off</span>
                </div>
              )}
            </Card>

            <div className="flex flex-col justify-center">
              <Button
                variant={isListening ? 'destructive' : 'outline'}
                className={`h-full w-full flex-col gap-2 rounded-xl transition-all ${isListening ? 'animate-pulse ring-2 ring-destructive/50' : ''}`}
                onMouseDown={startRecognition}
                onMouseUp={stopRecognition}
                onTouchStart={startRecognition}
                onTouchEnd={stopRecognition}
                disabled={!connected || isAgentSpeaking || interviewDone}
              >
                <Mic className={`w-6 h-6 ${isListening ? '' : 'text-primary'}`} />
                <span className="whitespace-normal text-xs">
                  {!connected ? 'Connecting…' : isListening ? 'Listening…' : 'Hold to Speak'}
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel – Code Editor */}
        <div className="lg:col-span-8 flex flex-col bg-[#1e1e1e]">
          <div className="h-12 border-b border-white/5 bg-[#252526] flex items-center justify-between px-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
              <Code2 className="w-4 h-4" /> Code Editor
            </div>
            <div className="w-32">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-8 bg-white/5 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex-1">
            <Editor
              language={language}
              value={code}
              onChange={v => setCode(v || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 16 },
                fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Interview Complete Modal ─────────────────────────── */}
      {interviewDone && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full shadow-2xl border-primary/20 text-center p-6">
            <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🎉</span>
            </div>
            <CardTitle className="text-2xl mb-3">Interview Complete!</CardTitle>

            {facialMetricsLog.current.length > 0 && (() => {
              const s = summarizeFacialMetrics()!
              return (
                <div className="grid grid-cols-3 gap-3 my-4 text-center">
                  {[
                    { label: 'Eye Contact', value: Math.round(Number(s.eye_contact) * 100), color: 'text-blue-400' },
                    { label: 'Expression',  value: Math.round(Number(s.smile_ratio)  * 100), color: 'text-yellow-400' },
                    { label: 'Confidence',  value: Math.round(Number(s.confidence)   * 100), color: 'text-purple-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-muted/40 rounded-xl p-3">
                      <div className={`text-2xl font-bold ${color}`}>{value}%</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              )
            })()}

            <p className="text-muted-foreground mb-8">
              Great job! Alex is generating your personalized feedback report.
            </p>
            <Button className="w-full" size="lg" onClick={() => navigate('/dashboard')}>
              View My Feedback →
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}