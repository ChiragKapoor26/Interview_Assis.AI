import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_URL } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { UploadCloud, FileText, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react'

const STEPS = ['Upload Resume', 'Role & JD', 'Review']

export default function SetupPage({ user }: { user: any }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeData, setResumeData] = useState<any>(null)
  const [role, setRole] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [uploading, setUploading] = useState(false)
  const [generatingJD, setGeneratingJD] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUploadResume = async () => {
    if (!resumeFile) return
    setUploading(true); setError('')
    try {
      const formData = new FormData()
      formData.append('file', resumeFile)
      const res = await fetch(`${API_URL}/api/resume/upload`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error((await res.json()).detail || 'Upload failed')
      setResumeData(await res.json())
      setStep(1)
    } catch (err: any) { setError(err.message) } finally { setUploading(false) }
  }

  const handleGenerateJD = async () => {
    if (!role.trim()) { setError('Please enter a role first'); return }
    setGeneratingJD(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/jd/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
      })
      if (!res.ok) throw new Error('JD generation failed')
      const data = await res.json()
      setJobDesc(data.job_description)
    } catch (err: any) { setError(err.message) } finally { setGeneratingJD(false) }
  }

  const handleStartInterview = async () => {
    if (!resumeData || !role || !jobDesc) { setError('Please complete all fields'); return }
    setSubmitting(true); setError('')
    try {
      const res = await fetch(`${API_URL}/api/interview/setup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, role, job_description: jobDesc, resume_data: resumeData }),
      })
      if (!res.ok) throw new Error('Setup failed')
      const data = await res.json()
      navigate(`/interview/${data.interview_id}`)
    } catch (err: any) { setError(err.message) } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto pt-10">
        <div className="flex items-center gap-2 font-bold text-xl mb-12 cursor-pointer" onClick={() => navigate('/')}>
          <span className="text-primary">⚡</span> InterviewAI
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-12">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold transition-colors
                ${i < step ? 'bg-primary border-primary text-primary-foreground' : 
                  i === step ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}>
                {i < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`ml-3 font-medium ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`w-16 md:w-32 h-1 mx-4 rounded-full ${i < step ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-4 mb-6 text-sm text-destructive border border-destructive/20 bg-destructive/10 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        <Card className="border-primary/10 shadow-lg">
          {step === 0 && (
            <>
              <CardHeader>
                <CardTitle>Upload Your Resume</CardTitle>
                <CardDescription>Our AI will parse your resume to personalize the entire interview.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div 
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                    ${resumeFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type === 'application/pdf') setResumeFile(f) }}
                >
                  <input ref={fileRef} type="file" accept=".pdf" onChange={e => setResumeFile(e.target.files?.[0] || null)} className="hidden" />
                  {resumeFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-primary" />
                      <span className="font-medium">{resumeFile.name}</span>
                      <span className="text-xs text-muted-foreground">{(resumeFile.size / 1024).toFixed(0)} KB</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <UploadCloud className="w-12 h-12 mb-2 opacity-50" />
                      <span className="font-medium text-foreground">Drag & drop your PDF resume here</span>
                      <span className="text-sm">or click to browse · Max 5MB</span>
                    </div>
                  )}
                </div>
                <Button className="w-full h-12" onClick={handleUploadResume} disabled={!resumeFile || uploading}>
                  {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Parsing...</> : 'Continue →'}
                </Button>
              </CardContent>
            </>
          )}

          {step === 1 && (
            <>
              <CardHeader>
                <div className="mb-4 inline-flex"><Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">✓ Resume Parsed — {resumeData?.name}</Badge></div>
                <CardTitle>Set Your Target Role</CardTitle>
                <CardDescription>Tell us what role you're interviewing for.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Target Role *</Label>
                  <Input placeholder="e.g. Senior Frontend Engineer" value={role} onChange={e => setRole(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Job Description *</Label>
                    <Button variant="ghost" size="sm" onClick={handleGenerateJD} disabled={generatingJD || !role} className="h-8 text-primary">
                      {generatingJD ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generating...</> : <><Sparkles className="mr-2 h-3 w-3" /> Auto-Generate</>}
                    </Button>
                  </div>
                  <Textarea className="h-48 resize-none" placeholder="Paste a job description or auto-generate one..." value={jobDesc} onChange={e => setJobDesc(e.target.value)} />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(0)}>← Back</Button>
                  <Button onClick={() => { if (!role || !jobDesc) { setError('Fill both fields'); return; } setStep(2) }} disabled={!role || !jobDesc}>Review →</Button>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle>Ready to Interview?</CardTitle>
                <CardDescription>Here's a summary of your interview setup. Alex is ready when you are.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 bg-muted/50 p-6 rounded-lg border">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-muted-foreground font-medium">Candidate</div>
                    <div className="col-span-2 font-medium">{resumeData?.name}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-muted-foreground font-medium">Target Role</div>
                    <div className="col-span-2 font-medium">{role}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm text-muted-foreground font-medium">Skills Detected</div>
                    <div className="col-span-2 flex flex-wrap gap-2">
                      {(resumeData?.skills || []).slice(0, 8).map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200 flex gap-3">
                  <span className="text-xl">💡</span>
                  <p>Alex will introduce himself, then dive into your background. Speak naturally — this is a conversation, not an exam. Your camera and mic will activate when you enter.</p>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
                  <Button onClick={handleStartInterview} disabled={submitting} className="min-w-[200px]">
                    {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing...</> : '🚀 Enter Interview Room'}
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
