import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi } from '../api/employees'
import { branchesApi }  from '../api/branches'
import { fmt }          from '../utils/format'
import { useT }         from '../i18n'
import toast            from 'react-hot-toast'
import clsx             from 'clsx'
import dayjs            from 'dayjs'
import duration         from 'dayjs/plugin/duration'
import {
  Plus, X, Pencil, Trash2, LogIn, LogOut, Clock,
  UserCheck, Users, BarChart2, Calendar, Timer,
} from 'lucide-react'
dayjs.extend(duration)

/** Live work-duration hook — ticks every minute */
function useLiveDuration(checkInTime: string | null) {
  const [elapsed, setElapsed] = useState<string>('0:00')
  useEffect(() => {
    if (!checkInTime) return
    const update = () => {
      const diff = Date.now() - new Date(checkInTime).getTime()
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      setElapsed(`${h}:${String(m).padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [checkInTime])
  return elapsed
}

// ── Role colors ───────────────────────────────────────────────────────────────
const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-900/20 text-red-400 border-red-900/40',
  ADMIN:       'bg-orange-900/20 text-orange-400 border-orange-900/40',
  MANAGER:     'bg-blue-900/20 text-blue-400 border-blue-900/40',
  CASHIER:     'bg-jade/10 text-jade border-jade/30',
}

// ── Employee Modal ─────────────────────────────────────────────────────────────
function EmployeeModal({ emp, onClose }: { emp: any | null; onClose: () => void }) {
  const qc     = useQueryClient()
  const t      = useT()
  const isEdit = !!emp

  const { data: branches = [] } = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })

  const [form, setForm] = useState({
    name:     emp?.name     ?? '',
    role:     emp?.role     ?? 'CASHIER',
    phone:    emp?.phone    ?? '',
    email:    emp?.email    ?? '',
    salary:   emp?.salary   ?? '',
    branchId: emp?.branchId ?? '',
    hireDate: emp?.hireDate ? dayjs(emp.hireDate).format('YYYY-MM-DD') : '',
    isActive: emp?.isActive ?? true,
    notes:    emp?.notes    ?? '',
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const save = useMutation({
    mutationFn: (d: any) => isEdit ? employeesApi.update(emp.id, d) : employeesApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] })
      toast.success(isEdit ? t.notifications.updated : t.notifications.created)
      onClose()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error(t.errors.required)
    save.mutate({
      name:     form.name.trim(),
      role:     form.role,
      phone:    form.phone.trim() || null,
      email:    form.email.trim() || null,
      salary:   form.salary ? Number(form.salary) : null,
      branchId: form.branchId || null,
      hireDate: form.hireDate || null,
      isActive: form.isActive,
      notes:    form.notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-lg font-bold">{isEdit ? t.employees.editEmployee : t.employees.addEmployee}</h2>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div>
            <label className="label">{t.employees.name} *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="John Smith" className="input w-full" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.employees.role}</label>
              <select value={form.role} onChange={e => set('role', e.target.value)} className="input w-full">
                {Object.entries(t.roles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.employees.branch}</label>
              <select value={form.branchId} onChange={e => set('branchId', e.target.value)} className="input w-full">
                <option value="">— {t.sellers.unassigned} —</option>
                {(branches as any[]).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.employees.phone}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+998 …" className="input w-full" />
            </div>
            <div>
              <label className="label">{t.employees.email}</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                type="email" placeholder="email@example.com" className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{t.employees.salary} (UZS)</label>
              <input value={form.salary} onChange={e => set('salary', e.target.value)}
                type="number" min="0" placeholder="Optional" className="input w-full font-mono" />
            </div>
            <div>
              <label className="label">{t.employees.hireDate}</label>
              <input value={form.hireDate} onChange={e => set('hireDate', e.target.value)}
                type="date" className="input w-full" />
            </div>
          </div>
          <div>
            <label className="label">{t.employees.notes}</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              rows={2} className="input w-full resize-none" placeholder="Notes…" />
          </div>
          {isEdit && (
            <div className="flex items-center gap-3">
              <label className="label mb-0">{t.employees.active}</label>
              <button type="button" onClick={() => set('isActive', !form.isActive)}
                className={clsx('w-10 h-5 rounded-full transition-colors relative',
                  form.isActive ? 'bg-jade' : 'bg-surface2 border border-border')}>
                <span className={clsx('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                  form.isActive ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t.common.cancel}</button>
            <button type="submit" disabled={save.isPending} className="btn-primary flex-1 disabled:opacity-50">
              {save.isPending ? t.common.loading : isEdit ? t.common.save : t.employees.addEmployee}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Timesheet Modal ───────────────────────────────────────────────────────────
function TimesheetModal({ emp, onClose }: { emp: any; onClose: () => void }) {
  const t = useT()
  const { data: logs = [] } = useQuery({
    queryKey: ['timesheet', emp.id],
    queryFn:  () => employeesApi.timesheet(emp.id),
  })
  const totalHours = (logs as any[]).reduce((s: number, l: any) => s + Number(l.hoursWorked ?? 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold">{t.employees.timesheet}</h2>
            <p className="text-sm text-muted">{emp.name}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div className="mb-3 bg-surface2 rounded-xl p-3 flex justify-between text-sm">
            <span className="text-muted">{t.employees.totalHours}</span>
            <span className="font-mono font-bold">{totalHours.toFixed(1)}h</span>
          </div>
          <div className="space-y-2">
            {(logs as any[]).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                <div>
                  <div className="font-medium">{dayjs(l.date).format('ddd, DD MMM YYYY')}</div>
                  <div className="text-xs text-muted">
                    {dayjs(l.checkIn).format('HH:mm')} → {l.checkOut ? dayjs(l.checkOut).format('HH:mm') : '…'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono">{l.hoursWorked ? `${Number(l.hoursWorked).toFixed(1)}h` : '—'}</div>
                  <div className={clsx('text-xs', l.status === 'LATE' ? 'text-orange-400' : 'text-jade')}>{l.status}</div>
                </div>
              </div>
            ))}
            {!(logs as any[]).length && <p className="text-center text-muted py-8">{t.common.noData}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Employee Card ─────────────────────────────────────────────────────────────
function EmployeeCard({ emp, onEdit, onDelete, onSheet }: {
  emp: any; onEdit: () => void; onDelete: () => void; onSheet: () => void
}) {
  const t   = useT()
  const qc  = useQueryClient()

  const lastLog   = emp.attendance?.[0]
  const checkedIn = lastLog && !lastLog.checkOut
  const elapsed   = useLiveDuration(checkedIn ? lastLog?.checkIn : null)

  const checkIn  = useMutation({ mutationFn: () => employeesApi.checkIn(emp.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success(`${emp.name} checked in`) },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Error') })
  const checkOut = useMutation({ mutationFn: () => employeesApi.checkOut(emp.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success(`${emp.name} checked out`) },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Error') })

  return (
    <div className="card hover:border-gold/20 transition-colors group">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-10 h-10 rounded-full border flex items-center justify-center font-bold text-sm relative',
            checkedIn ? 'bg-jade/20 border-jade/40 text-jade' : 'bg-gold-dim border-gold/30 text-gold'
          )}>
            {emp.name[0].toUpperCase()}
            {checkedIn && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-jade border-2 border-surface" />
            )}
          </div>
          <div>
            <div className="font-semibold text-sm">{emp.name}</div>
            <span className={clsx('text-xs border px-1.5 py-0.5 rounded', ROLE_COLOR[emp.role] ?? ROLE_COLOR.CASHIER)}>
              {t.roles[emp.role as keyof typeof t.roles] ?? emp.role}
            </span>
          </div>
        </div>
        <div className={clsx('text-xs px-2 py-0.5 rounded-full border', checkedIn
          ? 'border-jade/30 bg-jade/10 text-jade'
          : 'border-border bg-surface2 text-muted')}>
          {checkedIn ? '● Online' : t.employees.checkedOut}
        </div>
      </div>

      {/* Live shift tracker */}
      {checkedIn && lastLog && (
        <div className="mt-2 p-2 bg-jade/5 border border-jade/20 rounded-lg">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-jade">
              <Timer size={10} />
              <span>Shift started {dayjs(lastLog.checkIn).format('HH:mm')}</span>
            </div>
            <div className="font-mono font-bold text-jade">{elapsed}h</div>
          </div>
        </div>
      )}

      {/* Last check-out details */}
      {!checkedIn && lastLog?.checkOut && (
        <div className="mt-2 text-xs text-muted">
          Last out: {dayjs(lastLog.checkOut).format('DD MMM HH:mm')}
          {lastLog.hoursWorked && <span className="ml-1 text-gold font-mono">({Number(lastLog.hoursWorked).toFixed(1)}h)</span>}
        </div>
      )}

      {/* Details */}
      <div className="mt-2 space-y-1 text-xs text-muted">
        {emp.phone && <div>{emp.phone}</div>}
        {emp.salary && <div className="font-mono text-gold">{fmt.compact(Number(emp.salary))} UZS</div>}
        {emp.hireDate && <div>Since {dayjs(emp.hireDate).format('MMM YYYY')}</div>}
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {checkedIn ? (
          <button onClick={() => checkOut.mutate()} disabled={checkOut.isPending}
            className="flex-1 flex items-center justify-center gap-1 btn-secondary text-xs py-1.5 text-rose hover:border-rose/50">
            <LogOut size={12} /> {t.employees.checkOut}
          </button>
        ) : (
          <button onClick={() => checkIn.mutate()} disabled={checkIn.isPending}
            className="flex-1 flex items-center justify-center gap-1 btn-secondary text-xs py-1.5 text-jade hover:border-jade/50">
            <LogIn size={12} /> {t.employees.checkIn}
          </button>
        )}
        <button onClick={onSheet}
          className="p-1.5 rounded-lg border border-border hover:border-gold/50 text-muted hover:text-gold transition-colors">
          <Calendar size={12} />
        </button>
        <button onClick={onEdit}
          className="p-1.5 rounded-lg border border-border hover:bg-surface2 text-muted hover:text-white transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete}
          className="p-1.5 rounded-lg border border-border hover:border-rose/50 text-muted hover:text-rose transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const t   = useT()
  const qc  = useQueryClient()
  const [modal, setModal]   = useState<'create' | 'edit' | 'sheet' | null>(null)
  const [selected, setSel]  = useState<any>(null)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn:  () => employeesApi.list(),
  })

  const remove = useMutation({
    mutationFn: employeesApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); toast.success(t.notifications.deleted) },
  })

  const emps       = employees as any[]
  const checkedIn  = emps.filter(e => e.attendance?.[0] && !e.attendance[0].checkOut).length
  const active     = emps.filter(e => e.isActive).length
  // Total hours worked today across all checked-in employees
  const liveHoursToday = emps
    .filter(e => e.attendance?.[0] && !e.attendance[0].checkOut)
    .reduce((s, e) => s + (Date.now() - new Date(e.attendance[0].checkIn).getTime()) / 3_600_000, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t.employees.title}</h1>
          <p className="text-sm text-muted mt-0.5">{emps.length} {t.employees.title.toLowerCase()}</p>
        </div>
        <button onClick={() => { setSel(null); setModal('create') }} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> {t.employees.addEmployee}
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex items-center gap-3">
          <Users size={18} className="text-gold" />
          <div>
            <p className="text-xs text-muted">{t.employees.title}</p>
            <p className="font-bold">{active} <span className="text-xs font-normal text-muted">active</span></p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <UserCheck size={18} className="text-jade" />
          <div>
            <p className="text-xs text-muted">{t.employees.currentlyin}</p>
            <p className="font-bold text-jade">{checkedIn} <span className="text-xs font-normal text-muted">on shift</span></p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <Timer size={18} className="text-blue-400" />
          <div>
            <p className="text-xs text-muted">Man-hours today</p>
            <p className="font-bold text-blue-400 font-mono">{liveHoursToday.toFixed(1)}h</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted">{t.common.loading}</div>
      ) : emps.length === 0 ? (
        <div className="text-center py-16 text-muted card">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>{t.employees.noEmployees}</p>
          <button onClick={() => { setSel(null); setModal('create') }} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={14} /> {t.employees.addEmployee}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {emps.map(e => (
            <EmployeeCard key={e.id} emp={e}
              onEdit={() => { setSel(e); setModal('edit') }}
              onDelete={() => confirm(`Delete ${e.name}?`) && remove.mutate(e.id)}
              onSheet={() => { setSel(e); setModal('sheet') }}
            />
          ))}
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <EmployeeModal emp={modal === 'edit' ? selected : null}
          onClose={() => { setModal(null); setSel(null) }} />
      )}
      {modal === 'sheet' && selected && (
        <TimesheetModal emp={selected} onClose={() => { setModal(null); setSel(null) }} />
      )}
    </div>
  )
}
