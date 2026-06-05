import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import emailjs from '@emailjs/browser'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle, Code, User, Play, BarChart3, LineChart,
  FileText, BrainCircuit, Video, Award, ChevronDown,
  Star, Send, Loader2
} from 'lucide-react'

// 1. Sign up free at https://www.emailjs.com
// 2. Create a service (Gmail) → copy Service ID below
// 3. Create an email template with variables:
//    {{from_name}}, {{from_email}}, {{rating}}, {{category}}, {{message}}
//    Set "To Email" in template to: chirag.gndu05@gmail.com
// 4. Copy your Public Key from Account → API Keys
const EMAILJS_SERVICE_ID  = 'service_ajnyw97'
const EMAILJS_TEMPLATE_ID = 'template_kjqu7oq'
const EMAILJS_PUBLIC_KEY  = '0Yve-am7mudySB0Kv'

/* ─── Feedback form component ────────────────────────────────────── */
const CATEGORIES = ['Bug Report', 'Feature Request', 'UX / Design', 'General Feedback', 'Other']

function FeedbackSection() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [category, setCategory] = useState(CATEGORIES[3])
  const [message, setMessage]   = useState('')
  const [rating, setRating]     = useState(0)
  const [hovered, setHovered]   = useState(0)
  const [status, setStatus]     = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !message.trim() || rating === 0) return
    setStatus('sending')
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          from_name:  name.trim(),
          from_email: email.trim(),
          rating:     `${rating} / 5 stars`,
          category,
          message:    message.trim(),
          to_email:   'chirag.gndu05@gmail.com',
        },
        EMAILJS_PUBLIC_KEY
      )
      setStatus('success')
      setName(''); setEmail(''); setMessage(''); setRating(0); setCategory(CATEGORIES[3])
    } catch {
      setStatus('error')
    }
  }

  const inputCls = `w-full rounded-lg border border-border/60 bg-background/60 px-4 py-3 text-sm
    placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50
    focus:border-primary/60 transition-all duration-200`

  return (
    <section className="container mx-auto px-4 mb-32 max-w-2xl">
      <Reveal className="text-center mb-12">
        <Badge variant="secondary" className="mb-4 py-1 px-3 rounded-full">
          <span className="w-2 h-2 rounded-full bg-primary mr-2" />
          We're Listening
        </Badge>
        <h2 className="text-3xl font-bold mb-4">Share Your Feedback</h2>
        <p className="text-muted-foreground">
          Found a bug, have a feature idea, or just want to say hi? We read every message.
        </p>
      </Reveal>

      <Reveal delay={100}>
        <TiltCard>
          <Card className="bg-card/50 backdrop-blur-sm border border-border/50 border-t-2 border-t-primary/60">
            <CardContent className="pt-8 pb-8 px-8 space-y-6">

              {/* Star rating */}
              <div>
                <p className="text-sm font-medium mb-3 text-muted-foreground">How would you rate InterviewAI?</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHovered(star)}
                      onMouseLeave={() => setHovered(0)}
                      className="transition-transform duration-100 hover:scale-110 focus:outline-none"
                      aria-label={`Rate ${star} star`}
                    >
                      <Star
                        className={`w-8 h-8 transition-colors duration-150 ${
                          star <= (hovered || rating)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-3 text-sm text-muted-foreground self-center">
                      {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
                    </span>
                  )}
                </div>
              </div>

              {/* Name + Email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Your Name</label>
                  <input
                    className={inputCls}
                    placeholder="Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email Address</label>
                  <input
                    className={inputCls}
                    type="email"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Category pills */}
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 focus:outline-none
                        ${category === cat
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background/40 border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Your Message</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={4}
                  placeholder="Tell us what you think, what could be better, or what you'd love to see..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Sent directly to <span className="text-primary">chirag.gndu05@gmail.com</span>
                </p>
                <Button
                  onClick={handleSubmit}
                  disabled={status === 'sending' || !name || !email || !message || rating === 0}
                  className="gap-2 min-w-[130px]"
                >
                  {status === 'sending' ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  ) : (
                    <><Send className="w-4 h-4" /> Send Feedback</>
                  )}
                </Button>
              </div>

              {/* Status messages */}
              {status === 'success' && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Thanks for your feedback! We'll review it shortly.
                </div>
              )}
              {status === 'error' && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                  Something went wrong. Please try again or email us directly at chirag.gndu05@gmail.com
                </div>
              )}

            </CardContent>
          </Card>
        </TiltCard>
      </Reveal>
    </section>
  )
}

/* ─── Scroll-reveal hook ─────────────────────────────────────────── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, visible }
}

/* ─── 3-D tilt card ──────────────────────────────────────────────── */
function TiltCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    const glow = glowRef.current
    if (!card || !glow) return

    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left   // px from left
    const y = e.clientY - rect.top    // px from top
    const cx = rect.width / 2
    const cy = rect.height / 2

    const rotateX = ((y - cy) / cy) * -10   // max ±10 deg
    const rotateY = ((x - cx) / cx) * 10

    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px) scale(1.03)`
    glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(139,92,246,0.25) 0%, transparent 70%)`
    glow.style.opacity = '1'
  }, [])

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    const glow = glowRef.current
    if (!card || !glow) return
    card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)'
    glow.style.opacity = '0'
  }, [])

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        transition: 'transform 0.15s ease-out',
        willChange: 'transform',
        transformStyle: 'preserve-3d',
        position: 'relative',
      }}
    >
      {/* mouse-tracking glow layer */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          opacity: 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      {children}
    </div>
  )
}

/* ─── Data ───────────────────────────────────────────────────────── */
const features = [
  { icon: <User className="h-6 w-6 text-purple-400" />, title: 'Real-Time AI Interviewer', desc: 'Alex, your AI interviewer, speaks naturally and adapts to your answers just like a real senior engineer would.', color: 'border-purple-500/50' },
  { icon: <CheckCircle className="h-6 w-6 text-blue-400" />, title: 'Resume-Driven', desc: 'Every interview is personalized. Alex reads your resume deeply and asks questions specific to your experience.', color: 'border-blue-500/50' },
  { icon: <Code className="h-6 w-6 text-cyan-400" />, title: 'Live Coding Environment', desc: 'Solve DSA problems in a Monaco editor while Alex watches your approach and gives real-time hints.', color: 'border-cyan-500/50' },
  { icon: <Play className="h-6 w-6 text-green-400" />, title: 'Facial Analysis', desc: 'MediaPipe tracks your confidence, eye contact, and composure — giving you insights no other platform offers.', color: 'border-green-500/50' },
  { icon: <BarChart3 className="h-6 w-6 text-pink-400" />, title: 'Deep Feedback', desc: 'Get honest, actionable feedback on technical skills, communication, and confidence after every session.', color: 'border-pink-500/50' },
  { icon: <LineChart className="h-6 w-6 text-orange-400" />, title: 'Progress Dashboard', desc: 'Track your improvement across multiple interviews. See your scores grow over time with visual charts.', color: 'border-orange-500/50' },
]

const faqs = [
  { q: "What makes InterviewAI different from other mock interview platforms?", a: "Unlike static platforms, Alex uses live voice, real-time code analysis, and facial expression tracking to simulate a true human interviewer. Alex adapts to your answers dynamically instead of reading from a script." },
  { q: "Do I need to install any software to use the platform?", a: "No, everything runs directly in your browser! The live code editor, video processing for facial tracking, and real-time audio streaming all work seamlessly without any downloads." },
  { q: "Which programming languages are supported for technical interviews?", a: "Currently, our Monaco-powered live coding environment supports JavaScript, TypeScript, Python, Java, and C++." },
  { q: "Is my audio and video data stored or recorded?", a: "Privacy is our priority. Your video stream is processed locally in your browser for facial metrics—no video is ever saved. Audio is only used momentarily to generate transcripts for the AI." },
  { q: "Can I practice for non-technical roles?", a: "Yes! While our core focus is software engineering with live coding, Alex can adapt to behavioral, product management, or system design questions based on the specific job description you provide during setup." },
  { q: "How is the final interview score calculated?", a: "Your final score is a weighted average of three main pillars: Technical Accuracy (your code and problem-solving), Communication (clarity of your transcripts), and Confidence (tracked via facial metrics like eye contact)." }
]

/* ─── Sub-components ─────────────────────────────────────────────── */
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="border border-border/50 bg-card rounded-lg overflow-hidden transition-all duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
      >
        <span className="font-semibold">{question}</span>
        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-200 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="px-6 pb-4 text-muted-foreground leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Reveal wrapper ─────────────────────────────────────────────── */
function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, visible } = useScrollReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0px)' : 'translateY(40px)',
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────── */
export default function LandingPage({ user }: { user: any }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="text-primary">⚡</span> InterviewAI
          </div>
          <div className="flex gap-4">
            {user ? (
              <>
                <Button variant="outline" onClick={async () => await supabase.auth.signOut()}>Sign Out</Button>
                <Button variant="ghost" onClick={() => navigate('/dashboard')}>Dashboard</Button>
                <Button onClick={() => navigate('/setup')}>Start Interview</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>Sign In</Button>
                <Button onClick={() => navigate('/auth')}>Get Started</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-16">

        {/* ── Hero ── */}
        <section className="container mx-auto px-4 text-center max-w-4xl mb-32 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10" />

          {/* Hero items animate in on mount with staggered delays */}
          <div
            style={{
              opacity: 1,
              animation: 'heroFadeUp 0.7s ease 0.1s both',
            }}
          >
            <Badge variant="secondary" className="mb-6 py-1.5 px-4 rounded-full border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
              AI-Powered · Real-Time · Humanized
            </Badge>
          </div>

          <div style={{ animation: 'heroFadeUp 0.7s ease 0.25s both' }}>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Ace Your Next Interview <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-primary">
                with an AI That Feels Real
              </span>
            </h1>
          </div>

          <div style={{ animation: 'heroFadeUp 0.7s ease 0.4s both' }}>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Practice with Alex — an AI interviewer that speaks like a human, reads your resume, watches your confidence, and gives you brutally honest feedback.
            </p>
          </div>

          <div style={{ animation: 'heroFadeUp 0.7s ease 0.55s both' }} className="flex justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg" onClick={() => navigate(user ? '/setup' : '/auth')}>
              {user ? 'Start Your Interview' : 'Start for Free'} 🚀
            </Button>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="container mx-auto px-4 mb-32">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Land the Job</h2>
            <p className="text-muted-foreground">Complete interview preparation that goes beyond just questions.</p>
          </Reveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 80}>
                <TiltCard className="h-full">
                  <Card className={`bg-card/50 backdrop-blur-sm border-t-2 ${f.color} h-full`}>
                    <CardContent className="pt-6">
                      <div className="mb-4 p-3 bg-background/50 rounded-lg inline-block">{f.icon}</div>
                      <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                    </CardContent>
                  </Card>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="container mx-auto px-4 mb-32 relative">
          <Reveal className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From uploading your resume to getting your final score, the process is seamless and designed to mirror a real interview.
            </p>
          </Reveal>

          <div className="max-w-5xl mx-auto relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              {[
                { step: '01', icon: <FileText className="w-8 h-8 text-primary" />, title: 'Upload Resume', desc: 'Provide your PDF resume and target job description to set the context.' },
                { step: '02', icon: <BrainCircuit className="w-8 h-8 text-primary" />, title: 'AI Analysis', desc: 'Our engine instantly parses your data to generate targeted, role-specific questions.' },
                { step: '03', icon: <Video className="w-8 h-8 text-primary" />, title: 'Live Interview', desc: 'Turn on your mic and camera. Code, speak, and interact with Alex in real-time.' },
                { step: '04', icon: <Award className="w-8 h-8 text-primary" />, title: 'Get Feedback', desc: 'Receive detailed scoring on technical accuracy, communication, and confidence.' },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 100}>
                  <div className="flex flex-col items-center text-center relative group">
                    <div className="w-20 h-20 rounded-2xl bg-card border shadow-lg flex items-center justify-center mb-6 relative overflow-hidden transition-transform group-hover:-translate-y-2">
                      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      {item.icon}
                    </div>
                    <Badge variant="secondary" className="mb-3">{item.step}</Badge>
                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal className="mt-20 text-center" delay={200}>
            <Button size="lg" className="rounded-full px-8" onClick={() => navigate(user ? '/setup' : '/auth')}>
              Try It Now
            </Button>
          </Reveal>
        </section>

        {/* ── Feedback ── */}
        <FeedbackSection />

        {/* ── FAQs ── */}
        <section className="container mx-auto px-4 mb-32 max-w-3xl">
          <Reveal className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about InterviewAI.</p>
          </Reveal>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <Reveal key={i} delay={i * 60}>
                <FAQItem question={faq.q} answer={faq.a} />
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-muted-foreground">
        <p>© 2025 InterviewAI. Built to help you grow.</p>
      </footer>

      {/* ── Global keyframes ── */}
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}