import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL, supabase } from '../lib/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { LayoutDashboard, Mic, LogOut, TrendingUp, Target, Award, ArrowRight, MessageSquareQuote, Sparkles, Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface Interview { interview_id: string; role: string; overall_score: number; created_at: string; feedback?: any }

export default function Dashboard({ user }: { user: any }) {
  const navigate = useNavigate()
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [selected, setSelected] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/dashboard/${user.id}`)
      .then(r => r.json())
      .then(d => { setInterviews(d.interviews || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user.id])

  const chartData = [...interviews].reverse().map((iv, i) => ({ name: `#${i+1}`, score: iv.overall_score }))
  const avg  = interviews.length ? Math.round(interviews.reduce((s,iv) => s+iv.overall_score,0)/interviews.length) : 0
  const best = interviews.length ? Math.max(...interviews.map(iv=>iv.overall_score)) : 0

  const getScoreColor = (s: number) => s >= 80 ? 'text-green-500' : s >= 60 ? 'text-amber-500' : 'text-red-500'
  const getProgressColor = (s: number) => s >= 80 ? 'bg-green-500' : s >= 60 ? 'bg-amber-500' : 'bg-red-500'

  const downloadReport = async () => {
    const element = document.getElementById('report-content')
    if (!element) return
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`interview-report-${selected?.role.replace(/\s+/g, '-') || 'download'}.pdf`)
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-primary">⚡</span> InterviewAI
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Button variant="secondary" className="w-full justify-start font-medium" size="lg">
            <LayoutDashboard className="mr-3 h-5 w-5" /> Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" size="lg" onClick={() => navigate('/setup')}>
            <Mic className="mr-3 h-5 w-5" /> New Interview
          </Button>
        </nav>
        <div className="p-4 border-t border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground">
            {user.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{user.email}</span>
            <button onClick={() => supabase.auth.signOut().then(() => navigate('/'))} className="text-xs text-muted-foreground hover:text-destructive text-left flex items-center mt-1">
              <LogOut className="w-3 h-3 mr-1" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Your Progress</h1>
            <p className="text-muted-foreground">Track your interview performance over time</p>
          </div>
          <Button onClick={() => navigate('/setup')} className="hidden sm:flex"><Mic className="w-4 h-4 mr-2"/> New Interview</Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-purple-500/10 rounded-xl"><Target className="w-8 h-8 text-purple-500" /></div>
              <div><p className="text-sm font-medium text-muted-foreground">Interviews Done</p><h3 className="text-3xl font-bold">{interviews.length}</h3></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-blue-500/10 rounded-xl"><TrendingUp className="w-8 h-8 text-blue-500" /></div>
              <div><p className="text-sm font-medium text-muted-foreground">Average Score</p><h3 className="text-3xl font-bold">{avg}%</h3></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-4 bg-green-500/10 rounded-xl"><Award className="w-8 h-8 text-green-500" /></div>
              <div><p className="text-sm font-medium text-muted-foreground">Best Score</p><h3 className="text-3xl font-bold">{best}%</h3></div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {chartData.length > 1 && (
          <Card className="mb-8">
            <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Score Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top:5, right:10, left:-20, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill:'hsl(var(--muted-foreground))', fontSize:12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fill:'hsl(var(--muted-foreground))', fontSize:12 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background:'hsl(var(--card))', border:'1px solid hsl(var(--border))', borderRadius:8 }} labelStyle={{ color:'hsl(var(--foreground))' }} />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ fill:'hsl(var(--background))', strokeWidth:2, stroke:'hsl(var(--primary))', r:5 }} activeDot={{ r:7, fill:'hsl(var(--primary))' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* History List */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">Interview History</h3>
            {loading && <div className="text-center py-10 text-muted-foreground">Loading...</div>}
            {!loading && interviews.length === 0 && (
              <Card className="p-8 text-center border-dashed">
                <Mic className="w-10 h-10 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground mb-4">No interviews yet</p>
                <Button onClick={() => navigate('/setup')} variant="secondary">Start First Interview</Button>
              </Card>
            )}
            {interviews.map(iv => (
              <Card key={iv.interview_id} className={`cursor-pointer transition-all hover:border-primary/50 ${selected?.interview_id === iv.interview_id ? 'border-primary ring-1 ring-primary' : ''}`} onClick={() => setSelected(iv)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{iv.role}</p>
                    <p className="text-xs text-muted-foreground">{new Date(iv.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={`text-2xl font-bold tracking-tight ${getScoreColor(iv.overall_score)}`}>{iv.overall_score}<span className="text-sm opacity-70">%</span></div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Detailed Feedback */}
          <div className="lg:col-span-2">
            {!selected ? (
              <Card className="h-[400px] flex flex-col items-center justify-center text-center p-8 border-dashed bg-muted/20">
                <ArrowRight className="w-12 h-12 text-muted-foreground mb-4 opacity-50 hidden lg:block" />
                <p className="text-muted-foreground font-medium">Select an interview from the list<br/>to view detailed feedback</p>
              </Card>
            ) : (
              <Card id="report-content" className="overflow-hidden bg-card">
                <CardHeader className="bg-muted/30 border-b pb-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-2xl">{selected.role}</CardTitle>
                      <CardDescription>{new Date(selected.created_at).toLocaleDateString()}</CardDescription>
                      <Button variant="outline" size="sm" className="mt-4" onClick={downloadReport}>
                        <Download className="w-4 h-4 mr-2" /> Download PDF
                      </Button>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className={`text-5xl font-black tracking-tighter ${getScoreColor(selected.overall_score)}`}>
                        {selected.overall_score}<span className="text-2xl opacity-70">%</span>
                      </div>
                      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overall Score</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  {selected.feedback ? (
                    <div className="space-y-8">
                      {/* ATS and Transcript Analysis */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {selected.feedback.ats_score !== undefined && (
                          <div className="p-4 bg-muted/20 border rounded-xl flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Resume ATS Score</p>
                              <p className="text-xs text-muted-foreground mt-1">Based on Job Description</p>
                            </div>
                            <div className={`text-3xl font-black ${getScoreColor(selected.feedback.ats_score)}`}>
                              {selected.feedback.ats_score}%
                            </div>
                          </div>
                        )}
                        {selected.feedback.transcript_analysis && (
                          <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
                            <p className="text-sm font-medium text-primary uppercase tracking-wider mb-2">Transcript Analysis</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {selected.feedback.transcript_analysis}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="h-px bg-border" />

                      {/* Metric Progress Bars */}
                      <div className="space-y-5">
                        {[
                          { label:'Technical',     score: selected.feedback.technical?.score||0,    notes: selected.feedback.technical?.notes },
                          { label:'Communication', score: selected.feedback.communication?.score||0, notes: selected.feedback.communication?.notes },
                          { label:'Confidence',    score: selected.feedback.confidence?.score||0,    notes: selected.feedback.confidence?.notes },
                        ].map(s => (
                          <div key={s.label}>
                            <div className="flex justify-between mb-2">
                              <span className="text-sm font-medium">{s.label}</span>
                              <span className={`text-sm font-bold ${getScoreColor(s.score)}`}>{s.score}%</span>
                            </div>
                            <Progress value={s.score} className="h-2 mb-2" indicatorClassName={getProgressColor(s.score)} />
                            {s.notes && <p className="text-sm text-muted-foreground">{s.notes}</p>}
                          </div>
                        ))}
                      </div>

                      <div className="h-px bg-border" />

                      {/* Strengths & Improvements */}
                      <div className="grid md:grid-cols-2 gap-6">
                        {selected.feedback.strengths?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-green-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4"/> Strengths</h4>
                            <ul className="space-y-2">
                              {selected.feedback.strengths.map((s:string, i:number) => (
                                <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-green-500 mt-0.5">•</span> <span>{s}</span></li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selected.feedback.improvements?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2"><Target className="w-4 h-4"/> Areas to Improve</h4>
                            <ul className="space-y-2">
                              {selected.feedback.improvements.map((s:string, i:number) => (
                                <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-amber-500 mt-0.5">•</span> <span>{s}</span></li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {selected.feedback.encouraging_summary && (
                        <div className="mt-8 p-4 bg-primary/10 border border-primary/20 rounded-lg flex gap-3 text-primary-foreground/90 italic">
                          <MessageSquareQuote className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                          <p className="text-sm leading-relaxed">{selected.feedback.encouraging_summary}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground">Feedback is currently being generated by Alex...</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
