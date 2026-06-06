import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { PageHeader, Badge } from '../components/Shared'
import { Loader2, Plus, X, Edit2 } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['CASHIER','MANAGER','ADMIN','OWNER']
const ROLE_COLORS: Record<string, string> = { CASHIER: 'muted', MANAGER: 'gold', ADMIN: 'green', OWNER: 'red' }

interface UserForm { name: string; email: string; password: string; role: string }
const emptyUser: UserForm = { name: '', email: '', password: '', role: 'CASHIER' }

export default function SettingsPage() {
  const { user: me, logout } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab]             = useState<'users'|'profile'>('profile')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser,   setEditingUser]   = useState<any>(null)
  const [userForm,      setUserForm]      = useState<UserForm>(emptyUser)
  const [profileForm,   setProfileForm]   = useState({ name: me?.name ?? '', email: me?.email ?? '', currentPassword: '', newPassword: '' })

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn:  usersApi.list,
    enabled:  tab === 'users',
  })

  const createUserMut = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowUserModal(false); setUserForm(emptyUser); toast.success('User created') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const updateUserMut = useMutation({
    mutationFn: ({ id, data }: any) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowUserModal(false); toast.success('User updated') },
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })
  const updateProfileMut = useMutation({
    mutationFn: () => usersApi.update(me!.id, { name: profileForm.name, email: profileForm.email, ...(profileForm.newPassword ? { password: profileForm.newPassword } : {}) }),
    onSuccess: () => toast.success('Profile updated'),
    onError:   (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const openCreateUser = () => { setEditingUser(null); setUserForm(emptyUser); setShowUserModal(true) }
  const openEditUser   = (u: any) => {
    setEditingUser(u)
    setUserForm({ name: u.name, email: u.email, password: '', role: u.role })
    setShowUserModal(true)
  }
  const submitUser = () => {
    if (!userForm.name.trim() || !userForm.email.trim()) return toast.error('Name and email required')
    if (!editingUser && !userForm.password) return toast.error('Password required for new user')
    const payload = { ...userForm, password: userForm.password || undefined }
    if (editingUser) updateUserMut.mutate({ id: editingUser.id, data: payload })
    else             createUserMut.mutate(payload)
  }

  const fUser = (k: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setUserForm(v => ({ ...v, [k]: e.target.value }))

  const fProfile = (k: keyof typeof profileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfileForm(v => ({ ...v, [k]: e.target.value }))

  return (
    <div className="h-full flex flex-col">
      <PageHeader title="Settings" subtitle="Account & system configuration" />

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-border">
        {(['profile','users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-fg'
            }`}>
            {t === 'users' ? 'System Users' : 'My Profile'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="max-w-md space-y-6">
            {/* Info card */}
            <div className="bg-surface border border-border rounded-xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center text-gold text-lg font-bold">
                {me?.name?.[0] ?? 'U'}
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">{me?.name}</p>
                <p className="text-xs text-muted">{me?.email}</p>
                <Badge color={ROLE_COLORS[me?.role ?? 'CASHIER']}>{me?.role}</Badge>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-semibold text-fg">Update Profile</h3>
              <div>
                <label className="block text-xs text-muted mb-1">Name</label>
                <input value={profileForm.name} onChange={fProfile('name')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Email</label>
                <input type="email" value={profileForm.email} onChange={fProfile('email')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">New Password (leave blank to keep current)</label>
                <input type="password" value={profileForm.newPassword} onChange={fProfile('newPassword')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <button onClick={() => updateProfileMut.mutate()} disabled={updateProfileMut.isPending}
                className="w-full py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {updateProfileMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Save Changes
              </button>
            </div>

            <div className="bg-surface border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-fg mb-3">Danger Zone</h3>
              <button onClick={() => logout()}
                className="px-4 py-2 border border-rose text-rose rounded-lg text-sm hover:bg-rose/10 transition-colors">
                Sign out
              </button>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted">Manage system access</p>
              <button onClick={openCreateUser} className="flex items-center gap-1.5 px-3 py-1.5 bg-gold text-bg text-sm font-semibold rounded-lg hover:bg-gold/90">
                <Plus size={14} /> Add User
              </button>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center h-32"><Loader2 size={24} className="animate-spin text-gold" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-xs text-muted font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(users ?? []).map((u: any) => (
                    <tr key={u.id} className="hover:bg-surface/50">
                      <td className="px-4 py-3 text-sm text-fg font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-xs text-muted">{u.email}</td>
                      <td className="px-4 py-3"><Badge color={ROLE_COLORS[u.role]}>{u.role}</Badge></td>
                      <td className="px-4 py-3"><Badge color={u.isActive ? 'green' : 'muted'}>{u.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td className="px-4 py-3">
                        {u.id !== me?.id && (
                          <button onClick={() => openEditUser(u)} className="text-muted hover:text-gold"><Edit2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-fg">{editingUser ? 'Edit User' : 'Add User'}</h2>
              <button onClick={() => setShowUserModal(false)} className="text-muted hover:text-fg"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-muted mb-1">Name *</label>
                <input value={userForm.name} onChange={fUser('name')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Email *</label>
                <input type="email" value={userForm.email} onChange={fUser('email')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">{editingUser ? 'New Password (optional)' : 'Password *'}</label>
                <input type="password" value={userForm.password} onChange={fUser('password')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none focus:border-gold/60" />
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Role</label>
                <select value={userForm.role} onChange={fUser('role')}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-fg focus:outline-none">
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowUserModal(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg">Cancel</button>
              <button onClick={submitUser} disabled={createUserMut.isPending || updateUserMut.isPending}
                className="flex-1 py-2 bg-gold text-bg rounded-lg text-sm font-semibold hover:bg-gold/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {(createUserMut.isPending || updateUserMut.isPending) && <Loader2 size={14} className="animate-spin" />}
                {editingUser ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
