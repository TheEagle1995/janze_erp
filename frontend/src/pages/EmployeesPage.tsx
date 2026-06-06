import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { employeesApi, branchesApi } from '../lib/api'
import { useState } from 'react'
import { PageHeader, Badge, EmptyState, fmt, fmtDate } from '../components/Shared'
import { Search, Plus, X, Loader2, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['CASHIER','MANAGER','ADMIN','OWNER']
const ROLE_COLORS: Record<string, string> = { CASHIER: 'muted', MANAGER: 'gold', ADMIN: 'green', OWNER: 'red' }

interface EmpForm {
  name: string; email: string; phone: string; role: string; branchId: string; salary: string; pin: string; isActive: boolean
}
const empty: EmpForm = { name: '', email: '', phone: '', role: 'CASHIER', branchId: '', salary: '', pin: '', isActive: true }

export default function EmployeesPage() {
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [page,      setPage]      = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<any>(null)
  const [form,      setForm]      = useState<EmpForm>(empty)

  const { data, isLoading } = useQuery({
    queryKey: ['employees', search, page],
    queryFn:  () => employeesApi.list({ search: search || undefined, page, limit: 25 }),
  })
  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesApi.list })

  const employees = data?.data ?? []
  const meta      = data?.meta ?? {}

  const createMut = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); closeModal(); toast.success('Employee added') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: any) => employeesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees'] }); closeModal(); toast.success('Employee updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const openCreate = () => { setEditing(null); setForm(empty); setShowModal(true) }
  const openEdit   = (e: any) => {
    setEditing(e)
    setForm({ name: e.name, email: e.email ?? '', phone: e.phone ?? '', role: e.role, branchId: e.branchId ?? '', salary: String(e.salary ?? ''), pin: '', isActive: e.isActive })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null) }

  const submit = () => {
    if (!form.name.trim()) return toast.error('Name required')
    const payload = { ...form, salary: form.salary ? Number(form.salary) : undefined, pin: form.pin || undefined }
    if (editing) updateMut.mutate({ id: editing.id, data: payload })
    else         createMut.mutate(payload)
  }

  const f = (k: keyof EmpForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(v => ({ ...v, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  const busy = createMut.isPending || updateMut.isPending

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Employees" subtitle={`${meta.total ?? 0} employees`}
        action={<button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90"><Plus size={14} />Add Employee</button>}
      />

      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search employees…"
            className="bg-surface border border-border rounded-lg pl-8 pr-3 py-1.5 text-sm text-fg w-52 focus:outline-none focus:border-gold/60" />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
        ) : employees.length ? (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Name</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Role</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Branch</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Phone</th>
                <th className="text-right px-4 py-3 text-xs text-muted font-medium">Salary</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Status</th>
                <th className="text-left px-4 py-3 text-xs text-muted font-medium">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((e: any) => (
                <tr key={e.id} className="hover:bg-surface2/30">
                  <td className="px-4 py-3">
                    <p className="text-sm text-fg font-medium">{e.name}</p>
                    {e.email && <p className="text-xs text-muted">{e.email}</p>}
                  </td>
                  <td className="px-4 py-3"><Badge color={ROLE_COLORS[e.role] ?? 'muted'}>{e.role}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted">{e.branch?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted">{e.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-fg">{e.salary ? fmt(e.salary) : '—'}</td>
                  <td className="px-4 py-3"><Badge color={e.isActive ? 'green' : 'muted'}>{e.isActive ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted">{fmtDate(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(e)} className="text-muted hover:text-gold"><Edit2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No employees found" />
        )}

        {meta.lastPage > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border text-sm text-muted">
            <span>Page {page} of {meta.lastPage}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p-1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Prev</button>
              <button disabled={page === meta.lastPage} onClick={() => setPage(p => p+1)} className="px-3 py-1 rounded border border-border disabled:opacity-40 hover:bg-surface2">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">{editing ? 'Edit Employee' : 'Add Employee'}</h2>
              <button onClick={closeModal} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Name *</label>
                <input value={form.name} onChange={f('name')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Email</label>
                  <input type="email" value={form.email} onChange={f('email')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Phone</label>
                  <input value={form.phone} onChange={f('phone')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Role</label>
                  <select value={form.role} onChange={f('role')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Branch</label>
                  <select value={form.branchId} onChange={f('branchId')}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                    <option value="">— select —</option>
                    {branches?.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Salary</label>
                  <input type="number" value={form.salary} onChange={f('salary')} min={0}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">POS PIN</label>
                  <input type="text" value={form.pin} onChange={f('pin')} maxLength={6} placeholder="4–6 digits"
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
                </div>
              </div>
              {editing && (
                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={f('isActive')} className="accent-gold" />
                  Active
                </label>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeModal} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={submit} disabled={busy}
                className="flex-1 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {busy && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
