import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Code, User, Play, BarChart3, LineChart, FileText, BrainCircuit, Video, Award, ChevronDown } from 'lucide-react'

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

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="border border-border/50 bg-card rounded-lg overflow-hidden transition-all duration-200">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
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

export default function LandingPage({ user }: { user: any }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background">
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
        {/* Hero */}
        <section className="container mx-auto px-4 text-center max-w-4xl mb-32 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 blur-[100px] rounded-full pointer-events-none -z-10" />
          
          <Badge variant="secondary" className="mb-6 py-1.5 px-4 rounded-full border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary mr-2 animate-pulse" />
            AI-Powered · Real-Time · Humanized
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
            Ace Your Next Interview <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-primary">with an AI That Feels Real</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Practice with Alex — an AI interviewer that speaks like a human, reads your resume, watches your confidence, and gives you brutally honest feedback.
          </p>
          
          <div className="flex justify-center gap-4">
            <Button size="lg" className="h-14 px-8 text-lg" onClick={() => navigate(user ? '/setup' : '/auth')}>
              {user ? 'Start Your Interview' : 'Start for Free'} 🚀
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 mb-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything You Need to Land the Job</h2>
            <p className="text-muted-foreground">Complete interview preparation that goes beyond just questions.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i} className={`bg-card/50 backdrop-blur-sm border-t-2 ${f.color}`}>
                <CardContent className="pt-6">
                  <div className="mb-4 p-3 bg-background/50 rounded-lg inline-block">{f.icon}</div>
                  <h3 className="text-xl font-semibold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works (Procedure) */}
        <section className="container mx-auto px-4 mb-32 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">From uploading your resume to getting your final score, the process is seamless and designed to mirror a real interview.</p>
          </div>

          <div className="max-w-5xl mx-auto relative">
            {/* Connecting Line (Hidden on mobile) */}
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-primary/10 via-primary/50 to-primary/10 -translate-y-1/2 z-0" />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
              {[
                { step: '01', icon: <FileText className="w-8 h-8 text-primary" />, title: 'Upload Resume', desc: 'Provide your PDF resume and target job description to set the context.' },
                { step: '02', icon: <BrainCircuit className="w-8 h-8 text-primary" />, title: 'AI Analysis', desc: 'Our engine instantly parses your data to generate targeted, role-specific questions.' },
                { step: '03', icon: <Video className="w-8 h-8 text-primary" />, title: 'Live Interview', desc: 'Turn on your mic and camera. Code, speak, and interact with Alex in real-time.' },
                { step: '04', icon: <Award className="w-8 h-8 text-primary" />, title: 'Get Feedback', desc: 'Receive detailed scoring on technical accuracy, communication, and confidence.' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center relative group">
                  <div className="w-20 h-20 rounded-2xl bg-card border shadow-lg flex items-center justify-center mb-6 relative overflow-hidden transition-transform group-hover:-translate-y-2">
                    <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {item.icon}
                  </div>
                  <Badge variant="secondary" className="mb-3">{item.step}</Badge>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-20 text-center">
             <Button size="lg" className="rounded-full px-8" onClick={() => navigate(user ? '/setup' : '/auth')}>
               Try It Now
             </Button>
          </div>
        </section>

        {/* FAQs */}
        <section className="container mx-auto px-4 mb-32 max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about InterviewAI.</p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-muted-foreground">
        <p>© 2025 InterviewAI. Built to help you grow.</p>
      </footer>
    </div>
  )
}
