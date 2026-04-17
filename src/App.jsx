import { useState, useEffect } from 'react'
import hotLogo from './assets/hotlogo.svg'
import { parseJobDescription } from './parseJob'
import { supabase } from './supabase'
import './App.css'

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn']
const PRIORITIES = ['high', 'medium', 'low']

function toRow(app) {
  return {
    date: app.date,
    company: app.company,
    role: app.role,
    salary: app.salary,
    status: app.status,
    resume_version: app.resumeVersion,
    priority: app.priority,
    reference: app.reference,
    reference_url: app.referenceUrl,
    notes: app.notes,
    job_description: app.jobDescription,
  }
}

function fromRow(row) {
  return {
    id: row.id,
    date: row.date,
    company: row.company,
    role: row.role,
    salary: row.salary,
    status: row.status,
    resumeVersion: row.resume_version,
    priority: row.priority,
    reference: row.reference,
    referenceUrl: row.reference_url,
    notes: row.notes,
    jobDescription: row.job_description,
  }
}

function statusBadgeClass(status) {
  return `badge badge-${status}`
}

function priorityBadgeClass(priority) {
  return `badge badge-${priority}`
}

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function computeStats(apps) {
  const total = apps.length
  const interviewing = apps.filter(a => a.status === 'interviewing').length
  const offers = apps.filter(a => a.status === 'offer').length
  const responded = apps.filter(a => ['interviewing', 'offer', 'rejected'].includes(a.status)).length
  const rate = total > 0 ? Math.round((responded / total) * 100) : 0

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const thisWeek = apps.filter(a => a.date && new Date(a.date) >= oneWeekAgo).length

  return { total, interviewing, offers, rate, thisWeek }
}

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  company: '',
  role: '',
  salary: '',
  status: 'applied',
  resumeVersion: '',
  priority: 'medium',
  reference: '',
  referenceUrl: '',
  notes: '',
  jobDescription: '',
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [showAdd, setShowAdd] = useState(false)
  const [addTab, setAddTab] = useState('smart')
  const [form, setForm] = useState(EMPTY_FORM)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setApps([]); setLoading(false); return }
    setLoading(true)
    supabase.from('applications').select('*').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('fetch error:', error)
        if (!error && data) setApps(data.map(fromRow))
        setLoading(false)
      })
  }, [session])

  const stats = computeStats(apps)

  async function addApp(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('applications').insert([{ ...toRow(form), user_id: session.user.id }]).select().single()
    if (error) { console.error('insert error:', error); return }
    console.log('insert result:', data)
    if (data) setApps(prev => [fromRow(data), ...prev])
    setForm(EMPTY_FORM)
    setShowAdd(false)
  }

  async function deleteApp(id) {
    await supabase.from('applications').delete().eq('id', id)
    setApps(prev => prev.filter(a => a.id !== id))
    setSelected(null)
  }

  async function saveEdit(e) {
    e.preventDefault()
    const { data, error } = await supabase.from('applications').update(toRow(editForm)).eq('id', selected.id).select().single()
    if (!error && data) setApps(prev => prev.map(a => a.id === selected.id ? fromRow(data) : a))
    setSelected(null)
    setEditForm(null)
  }

  function openDetail(app) {
    setSelected(app)
    setEditForm({ ...app })
  }

  if (authLoading) return <div className="app-loading">Loading...</div>
  if (!session) return <LoginScreen />

  if (loading) return <div className="app-loading">Loading...</div>

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">HIRED OR TIRED</span>
        <img src={hotLogo} alt="Hired or Tired" className="logo-img" />
        <div className="profile-menu">
          <button className="profile-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
          <div className="profile-dropdown">
            <p className="profile-email">{session.user.email}</p>
            <button className="profile-signout" onClick={() => supabase.auth.signOut()}>Log Out</button>
          </div>
        </div>
      </header>

      <div className="stats-grid">
        <StatCard label="Applied:" value={stats.total} delta={stats.thisWeek > 0 ? `+${stats.thisWeek} this week` : null} />
        <StatCard label="Interviewing:" value={stats.interviewing} />
        <StatCard label="Response Rate:" value={`${stats.rate}%`} />
        <StatCard label="Offers:" value={stats.offers} />
      </div>

      <div className="toolbar">
        <button className="btn-new" onClick={() => setShowAdd(true)}>
          <span className="btn-new-icon">+</span>
          New application
        </button>
        <div className="view-toggle">
          <button className={`view-btn${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>List</button>
          <button className={`view-btn${view === 'kanban' ? ' active' : ''}`} onClick={() => setView('kanban')}>Kanban</button>
        </div>
      </div>

      {view === 'list' ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>date</th>
                <th>company</th>
                <th>role</th>
                <th>salary/pay</th>
                <th>status</th>
                <th>resume sent</th>
                <th>priority</th>
                <th>reference</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 ? (
                <tr className="empty-row"><td colSpan={8}>No applications yet — add your first one</td></tr>
              ) : apps.map(app => (
                <tr key={app.id} onClick={() => openDetail(app)}>
                  <td>{formatDate(app.date)}</td>
                  <td>{app.company}</td>
                  <td>{app.role}</td>
                  <td>{app.salary || '—'}</td>
                  <td><span className={statusBadgeClass(app.status)}>{app.status}</span></td>
                  <td>{app.resumeVersion || '—'}</td>
                  <td>{app.priority ? <span className={priorityBadgeClass(app.priority)}>{app.priority}</span> : '—'}</td>
                  <td>
                    {app.referenceUrl
                      ? <a href={app.referenceUrl} target="_blank" rel="noopener noreferrer" className="reference-link" onClick={e => e.stopPropagation()}>{app.reference || app.referenceUrl}</a>
                      : app.reference || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <KanbanView apps={apps} onSelect={openDetail} />
      )}

      {showAdd && (
        <Modal title="New Application" onClose={() => { setShowAdd(false); setAddTab('manual') }}>
          <div className="modal-tabs">
            <button className={`modal-tab${addTab === 'smart' ? ' active' : ''}`} type="button" onClick={() => setAddTab('smart')}>Smart Paste</button>
            <button className={`modal-tab${addTab === 'manual' ? ' active' : ''}`} type="button" onClick={() => setAddTab('manual')}>Manual</button>
          </div>
          {addTab === 'smart' ? (
            <SmartPaste onParsed={parsed => { setForm(f => ({ ...f, ...parsed })); setAddTab('manual') }} />
          ) : (
            <form onSubmit={addApp}>
              <AppForm form={form} setForm={setForm} />
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowAdd(false)}>Cancel</button>
                <button type="submit" className="btn-submit">Add Application</button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {selected && editForm && (
        <Modal title="Application Detail" onClose={() => { setSelected(null); setEditForm(null) }}>
          <form onSubmit={saveEdit}>
            <AppForm form={editForm} setForm={setEditForm} />
            <div className="form-actions">
              <button type="button" className="btn-danger" onClick={() => deleteApp(selected.id)}>Delete</button>
              <button type="button" className="btn-cancel" onClick={() => { setSelected(null); setEditForm(null) }}>Cancel</button>
              <button type="submit" className="btn-submit">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function StatCard({ label, value, delta }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  )
}

function KanbanView({ apps, onSelect }) {
  return (
    <div className="kanban">
      {['applied', 'interviewing', 'offer', 'rejected'].map(status => {
        const col = apps.filter(a => a.status === status)
        return (
          <div key={status} className="kanban-col">
            <div className="kanban-col-header">
              {status}
              <span className="kanban-col-count">{col.length}</span>
            </div>
            {col.length === 0 ? (
              <div className="kanban-empty">None</div>
            ) : col.map(app => (
              <div key={app.id} className="kanban-card" onClick={() => onSelect(app)}>
                <div className="kanban-card-company">{app.company}</div>
                <div className="kanban-card-role">{app.role}</div>
                <div className="kanban-card-footer">
                  <span className="kanban-card-salary">{app.salary || '—'}</span>
                  {app.priority && <span className={priorityBadgeClass(app.priority)}>{app.priority}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AppForm({ form, setForm }) {
  function set(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <div className="form-grid">
      <div className="form-group">
        <label className="form-label">Date</label>
        <input className="form-input" type="date" value={form.date} onChange={set('date')} required />
      </div>
      <div className="form-group">
        <label className="form-label">Company</label>
        <input className="form-input" type="text" value={form.company} onChange={set('company')} placeholder="e.g. Figma" required />
      </div>
      <div className="form-group">
        <label className="form-label">Role</label>
        <input className="form-input" type="text" value={form.role} onChange={set('role')} placeholder="e.g. Product Designer" required />
      </div>
      <div className="form-group">
        <label className="form-label">Salary / Pay</label>
        <input className="form-input" type="text" value={form.salary} onChange={set('salary')} placeholder="e.g. $120,000" />
      </div>
      <div className="form-group">
        <label className="form-label">Status</label>
        <select className="form-select" value={form.status} onChange={set('status')}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Priority</label>
        <select className="form-select" value={form.priority} onChange={set('priority')}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Resume Version</label>
        <input className="form-input" type="text" value={form.resumeVersion} onChange={set('resumeVersion')} placeholder="e.g. v3" />
      </div>
      <div className="form-group">
        <label className="form-label">Reference / Source</label>
        <input className="form-input" type="text" value={form.reference} onChange={set('reference')} placeholder="e.g. LinkedIn" />
      </div>
      <div className="form-group full">
        <label className="form-label">Listing URL</label>
        <input className="form-input" type="url" value={form.referenceUrl} onChange={set('referenceUrl')} placeholder="https://..." />
      </div>
      <div className="form-group full">
        <label className="form-label">Notes</label>
        <textarea className="form-input" value={form.notes} onChange={set('notes')} placeholder="Any notes..." rows={3} style={{ resize: 'vertical' }} />
      </div>
      <div className="form-group full">
        <label className="form-label">Job Description</label>
        <textarea className="form-input job-description-area" value={form.jobDescription} onChange={set('jobDescription')} placeholder="Paste the full job description here..." rows={12} style={{ resize: 'vertical' }} />
      </div>
    </div>
  )
}

function SmartPaste({ onParsed }) {
  const [smartTab, setSmartTab] = useState('url')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function extractFromText(content, referenceUrl) {
    const parsed = await parseJobDescription(content)
    const clean = {}
    if (parsed.company) clean.company = parsed.company
    if (parsed.role) clean.role = parsed.role
    if (parsed.salary) clean.salary = parsed.salary
    if (parsed.reference) clean.reference = parsed.reference
    if (parsed.jobDescription) clean.jobDescription = parsed.jobDescription
    if (referenceUrl) clean.referenceUrl = referenceUrl
    onParsed(clean)
  }

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      await extractFromText(text.trim())
    } catch (err) {
      setError(err?.message || 'Could not extract details. Check your API key or try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleUrlExtract() {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url.trim())}`
      const res = await fetch(proxyUrl)
      if (!res.ok) throw new Error(`Failed to fetch URL (HTTP ${res.status})`)
      const pageText = await res.text()
      if (!pageText) throw new Error('No content returned from URL')
      const clean = pageText
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
      if (!clean) throw new Error('Page appears to be empty')
      await extractFromText(clean.slice(0, 8000), url.trim())
    } catch (err) {
      setError(err?.message || 'Could not fetch or parse the URL. Try pasting the text instead.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="smart-paste">
      <div className="smart-paste-tabs">
        <button
          type="button"
          className={`smart-paste-tab${smartTab === 'url' ? ' active' : ''}`}
          onClick={() => setSmartTab('url')}
        >URL</button>
        <button
          type="button"
          className={`smart-paste-tab${smartTab === 'paste' ? ' active' : ''}`}
          onClick={() => setSmartTab('paste')}
        >Paste Text</button>
      </div>

      {smartTab === 'paste' ? (
        <>
          <p className="smart-paste-hint">Paste a job description below — AI will extract the details for you.</p>
          <textarea
            className="form-input smart-paste-area"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste job description text here..."
            rows={10}
            autoFocus
          />
          {error && <p className="smart-paste-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn-submit" onClick={handleExtract} disabled={!text.trim() || loading}>
              {loading ? 'Extracting...' : 'Extract Info'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="smart-paste-hint">Paste a job posting URL — AI will fetch and extract the details for you.</p>
          <input
            className="form-input"
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://jobs.example.com/posting/123"
            autoFocus
          />
          {error && <p className="smart-paste-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn-submit" onClick={handleUrlExtract} disabled={!url.trim() || loading}>
              {loading ? 'Fetching...' : 'Extract Info'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <img src={hotLogo} alt="Hired or Tired" className="login-logo" />
      <h1 className="login-title">HIRED OR TIRED</h1>
      <p className="login-subtitle">Track your job applications</p>
      {sent ? (
        <p className="login-sent">Check your email for a magic link to sign in.</p>
      ) : (
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="form-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="smart-paste-error">{error}</p>}
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  )
}
