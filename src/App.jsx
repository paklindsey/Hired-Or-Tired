import { useState, useEffect } from 'react'
import hotLogo from './assets/hotlogo.svg'
import { parseJobDescription } from './parseJob'
import './App.css'

const STATUSES = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn']
const PRIORITIES = ['high', 'medium', 'low']

const SAMPLE_DATA = [
  {
    id: 1,
    date: '2026-04-15',
    company: 'Figma',
    role: 'Project Manager',
    salary: '$100,000',
    status: 'applied',
    resumeVersion: 'v3',
    priority: 'high',
    reference: 'LinkedIn',
    notes: '',
  },
]

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue]
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

function computeStats(apps, prevApps) {
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
  notes: '',
}

export default function App() {
  const [apps, setApps] = useLocalStorage('hot-apps', SAMPLE_DATA)
  const [view, setView] = useState('list')
  const [showAdd, setShowAdd] = useState(false)
  const [addTab, setAddTab] = useState('manual')
  const [form, setForm] = useState(EMPTY_FORM)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const stats = computeStats(apps)

  function addApp(e) {
    e.preventDefault()
    const newApp = { ...form, id: Date.now() }
    setApps(prev => [newApp, ...prev])
    setForm(EMPTY_FORM)
    setShowAdd(false)
  }

  function deleteApp(id) {
    setApps(prev => prev.filter(a => a.id !== id))
    setSelected(null)
  }

  function saveEdit(e) {
    e.preventDefault()
    setApps(prev => prev.map(a => a.id === selected.id ? { ...editForm, id: selected.id } : a))
    setSelected(null)
    setEditForm(null)
  }

  function openDetail(app) {
    setSelected(app)
    setEditForm({ ...app })
  }

  return (
    <div className="app">
      <header className="header">
        <span className="header-title">HIRED OR TIRED</span>
        <img src={hotLogo} alt="Hired or Tired" className="logo-img" />
        <button className="profile-btn" title="Profile">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>
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
                  <td>{app.reference || '—'}</td>
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
            <button className={`modal-tab${addTab === 'manual' ? ' active' : ''}`} type="button" onClick={() => setAddTab('manual')}>Manual</button>
            <button className={`modal-tab${addTab === 'smart' ? ' active' : ''}`} type="button" onClick={() => setAddTab('smart')}>Smart Paste</button>
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
        <label className="form-label">Notes</label>
        <textarea className="form-input" value={form.notes} onChange={set('notes')} placeholder="Any notes..." rows={3} style={{ resize: 'vertical' }} />
      </div>
    </div>
  )
}

function SmartPaste({ onParsed }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleExtract() {
    if (!text.trim()) return
    setLoading(true)
    setError(null)
    try {
      const parsed = await parseJobDescription(text.trim())
      const clean = {}
      if (parsed.company) clean.company = parsed.company
      if (parsed.role) clean.role = parsed.role
      if (parsed.salary) clean.salary = parsed.salary
      if (parsed.reference) clean.reference = parsed.reference
      if (parsed.notes) clean.notes = parsed.notes
      onParsed(clean)
    } catch (err) {
      setError(err?.message || 'Could not extract details. Check your API key or try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="smart-paste">
      <p className="smart-paste-hint">Paste a job description below — Gemini will extract the details for you.</p>
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
    </div>
  )
}
