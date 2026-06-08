import { useState, useEffect } from 'react'
import { usersApi } from '../lib/api'
import { useMutation }   from '@tanstack/react-query'
import { useAuthStore }  from '../store/authStore'
import { useT }          from '../i18n'
import { useLang, LANGUAGES } from '../i18n'
import { useThemeStore, THEMES as ALL_THEMES } from '../store/themeStore'
import toast             from 'react-hot-toast'
import clsx              from 'clsx'
import {
  User, Store, Bell, Shield, Globe, Palette,
  Save, ChevronRight, Star, Receipt, AlertTriangle, Printer,
  Wifi, WifiOff, RefreshCw,
} from 'lucide-react'
import { usePrinterStore } from '../store/printerStore'
import { xprint, type PrinterStatus } from '../lib/xprint'

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon: any }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Icon size={16} className="text-gold" />
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────
function ToggleRow({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
      </div>
      <button onClick={() => onChange(!value)}
        className={clsx('w-11 h-6 rounded-full transition-colors relative flex-shrink-0',
          value ? 'bg-jade' : 'bg-surface2 border border-border')}>
        <span className={clsx('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
          value ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'profile' | 'store' | 'appearance' | 'notifications' | 'security' | 'printer'

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const user     = useAuthStore(s => s.user)
  const t        = useT()
  const { lang, setLang } = useLang()
  const theme    = useThemeStore(s => s.theme)
  const setTheme = useThemeStore(s => s.setTheme)

  const [tab, setTab] = useState<Tab>('profile')

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'profile',       label: t.settings.profile,       icon: User    },
    { id: 'store',         label: t.settings.store,         icon: Store   },
    { id: 'appearance',    label: t.settings.appearance,    icon: Palette },
    { id: 'notifications', label: t.settings.notifications, icon: Bell    },
    { id: 'security',      label: t.settings.security,      icon: Shield  },
    { id: 'printer',       label: 'Printer',                icon: Printer },
  ]

  // ── Printer state ─────────────────────────────────────────────
  const { settings: ps, setSettings: setPrinterSetting, connect: printerConnect, disconnect: printerDisconnect } = usePrinterStore()
  const [printerStatus, setPrinterStatus] = useState<PrinterStatus>(() => xprint.getStatus())

  useEffect(() => {
    const unsub = xprint.onStatus((s) => setPrinterStatus(s))
    return unsub
  }, [])

  // ── Profile form ──────────────────────────────────────────────
  const [profileForm, setProfile] = useState({
    name:  user?.name  ?? '',
    email: user?.email ?? '',
  })

  // ── Store form ────────────────────────────────────────────────
  const [storeForm, setStore] = useState({
    storeName:      'AVERO & Janze',
    currency:       'UZS',
    taxRate:        '12',
    receiptHeader:  'Thank you for shopping with us!',
    receiptFooter:  'Come back soon!',
    loyaltyEnabled: true,
    pointsPerUnit:  '1',
    pointValue:     '100',
    lowStockGlobal: '5',
  })
  const setS = (k: string, v: any) => setStore(f => ({ ...f, [k]: v }))

  // ── Notification prefs ────────────────────────────────────────
  const [notifs, setNotifs] = useState({
    lowStock:    true,
    newOrder:    false,
    dailyReport: true,
    debtDue:     true,
  })
  const setN = (k: string, v: boolean) => setNotifs(f => ({ ...f, [k]: v }))

  // ── Security form ─────────────────────────────────────────────
  const [secForm, setSec] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  })

  const profileMut = useMutation({
    mutationFn: () => usersApi.updateProfile(profileForm),
    onSuccess: (updated) => {
      // Sync the auth store with updated name/email
      useAuthStore.setState(s => ({ user: s.user ? { ...s.user, ...updated } : s.user }))
      toast.success(t.settings.profileSaved)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const saveProfile = () => {
    if (!profileForm.name.trim()) return toast.error(t.settings.nameRequired)
    profileMut.mutate()
  }

  const saveStore = () => toast.success(t.settings.storeSaved)

  const passwordMut = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword: secForm.currentPassword, newPassword: secForm.newPassword }),
    onSuccess: () => {
      toast.success(t.settings.passwordUpdated)
      setSec({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? t.errors.saveFailed),
  })

  const savePassword = () => {
    if (!secForm.currentPassword)         return toast.error(t.settings.enterCurrent)
    if (secForm.newPassword.length < 6)   return toast.error(t.settings.passwordMin6)
    if (secForm.newPassword !== secForm.confirmPassword) return toast.error(t.settings.passwordMismatch)
    passwordMut.mutate()
  }


  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold">{t.settings.title}</h1>
        <p className="text-sm text-muted mt-0.5">{t.settings.managePrefs}</p>
      </div>

      <div className="flex gap-4">
        {/* Sidebar nav */}
        <div className="w-44 flex-shrink-0">
          <nav className="space-y-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className={clsx('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  tab === id ? 'bg-gold-dim text-gold' : 'text-muted hover:bg-surface2 hover:text-fg')}>
                <Icon size={15} />
                {label}
                {tab === id && <ChevronRight size={13} className="ml-auto" />}
              </button>
            ))}
          </nav>
          <div className="mt-6 px-3">
            <p className="text-xs text-muted">ERP System v1.0</p>
            <p className="text-xs text-muted">NestJS + React</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4">

          {/* ── Profile ── */}
          {tab === 'profile' && (
            <Section title={t.settings.yourProfile} icon={User}>
              <div className="flex items-center gap-4 pb-3 border-b border-border">
                <div className="w-14 h-14 rounded-full bg-gold-dim border-2 border-gold/30 flex items-center justify-center text-gold font-bold text-xl">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div>
                  <div className="font-semibold">{user?.name}</div>
                  <div className="text-xs text-muted">{user?.email}</div>
                  <span className="text-xs bg-surface2 border border-border px-2 py-0.5 rounded mt-1 inline-block">
                    {user?.role}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{t.settings.fullName}</label>
                  <input value={profileForm.name}
                    onChange={e => setProfile(f => ({ ...f, name: e.target.value }))}
                    className="input w-full" />
                </div>
                <div>
                  <label className="label">{t.auth.email}</label>
                  <input value={profileForm.email}
                    onChange={e => setProfile(f => ({ ...f, email: e.target.value }))}
                    type="email" className="input w-full" />
                </div>
              </div>
              <div>
                <label className="label">{t.common.branch}</label>
                <input value={user?.branch?.name ?? user?.branchId ?? '—'} disabled
                  className="input w-full opacity-60 cursor-not-allowed" />
              </div>
              <button onClick={saveProfile} disabled={profileMut.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                <Save size={14} /> {profileMut.isPending ? t.common.loading : t.settings.saveProfile}
              </button>
            </Section>
          )}

          {/* ── Store ── */}
          {tab === 'store' && (
            <div className="space-y-4">
              <Section title={t.settings.storeInfo} icon={Store}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{t.settings.storeName}</label>
                    <input value={storeForm.storeName} onChange={e => setS('storeName', e.target.value)} className="input w-full" />
                  </div>
                  <div>
                    <label className="label">{t.common.currency}</label>
                    <select value={storeForm.currency} onChange={e => setS('currency', e.target.value)} className="input w-full">
                      <option value="UZS">UZS — Uzbek Som</option>
                      <option value="USD">USD — US Dollar</option>
                      <option value="EUR">EUR — Euro</option>
                      <option value="RUB">RUB — Russian Ruble</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">{t.settings.defaultTaxRate}</label>
                  <input value={storeForm.taxRate} onChange={e => setS('taxRate', e.target.value)}
                    type="number" min="0" max="100" step="0.5" className="input w-40" />
                </div>
                <button onClick={saveStore} className="btn-primary flex items-center gap-2">
                  <Save size={14} /> {t.settings.saveStore}
                </button>
              </Section>

              <Section title={t.settings.receiptSettings} icon={Receipt}>
                <div>
                  <label className="label">{t.settings.receiptHeader}</label>
                  <input value={storeForm.receiptHeader} onChange={e => setS('receiptHeader', e.target.value)}
                    placeholder={t.settings.receiptHeaderPh} className="input w-full" />
                </div>
                <div>
                  <label className="label">{t.settings.receiptFooter}</label>
                  <input value={storeForm.receiptFooter} onChange={e => setS('receiptFooter', e.target.value)}
                    placeholder={t.settings.receiptFooterPh} className="input w-full" />
                </div>
                <button onClick={saveStore} className="btn-primary flex items-center gap-2">
                  <Save size={14} /> {t.settings.saveStore}
                </button>
              </Section>

              <Section title={t.settings.loyaltyProgram} icon={Star}>
                <ToggleRow label={t.settings.enableLoyalty}
                  sub={t.settings.enableLoyaltySub}
                  value={storeForm.loyaltyEnabled}
                  onChange={v => setS('loyaltyEnabled', v)} />
                {storeForm.loyaltyEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="label">{t.settings.pointsPer1000}</label>
                      <input value={storeForm.pointsPerUnit} onChange={e => setS('pointsPerUnit', e.target.value)}
                        type="number" min="0" step="0.1" className="input w-full" />
                    </div>
                    <div>
                      <label className="label">{t.settings.pointValue}</label>
                      <input value={storeForm.pointValue} onChange={e => setS('pointValue', e.target.value)}
                        type="number" min="1" className="input w-full" />
                    </div>
                  </div>
                )}
                <button onClick={saveStore} className="btn-primary flex items-center gap-2">
                  <Save size={14} /> {t.settings.saveStore}
                </button>
              </Section>

              <Section title={t.settings.inventoryDefaults} icon={AlertTriangle}>
                <div>
                  <label className="label">{t.settings.globalLowStock}</label>
                  <p className="text-xs text-muted mb-2">{t.settings.globalLowStockSub}</p>
                  <input value={storeForm.lowStockGlobal} onChange={e => setS('lowStockGlobal', e.target.value)}
                    type="number" min="1" className="input w-32" />
                </div>
                <button onClick={saveStore} className="btn-primary flex items-center gap-2">
                  <Save size={14} /> {t.settings.saveStore}
                </button>
              </Section>
            </div>
          )}

          {/* ── Appearance ── */}
          {tab === 'appearance' && (
            <div className="space-y-4">
              <Section title={t.settings.theme} icon={Palette}>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {ALL_THEMES.map((th) => (
                    <button key={th.id} onClick={() => setTheme(th.id)}
                      className={clsx('flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors',
                        theme === th.id
                          ? 'border-gold bg-gold-dim text-gold'
                          : 'border-border hover:border-gold/40 text-muted hover:text-fg')}>
                      <span className="text-xl">{th.emoji}</span>
                      <span className="text-xs font-medium">{th.name}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section title={t.settings.language} icon={Globe}>
                <div className="space-y-2">
                  {LANGUAGES.map(({ code, label, flag }) => (
                    <button key={code}
                      onClick={() => { setLang(code as any); toast.success(t.settings.langChanged) }}
                      className={clsx('w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors text-left',
                        lang === code ? 'border-gold bg-gold-dim' : 'border-border hover:border-gold/40')}>
                      <span className="text-xl">{flag}</span>
                      <span className={clsx('font-medium text-sm', lang === code ? 'text-gold' : 'text-fg')}>{label}</span>
                      {lang === code && <span className="ml-auto text-xs text-gold">{t.settings.activeLanguage}</span>}
                    </button>
                  ))}
                </div>
              </Section>
            </div>
          )}

          {/* ── Notifications ── */}
          {tab === 'notifications' && (
            <Section title={t.settings.notifPrefs} icon={Bell}>
              <ToggleRow label={t.settings.lowStockAlerts}
                sub={t.settings.lowStockAlertsSub}
                value={notifs.lowStock} onChange={v => setN('lowStock', v)} />
              <ToggleRow label={t.settings.newOrderAlerts}
                sub={t.settings.newOrderAlertsSub}
                value={notifs.newOrder} onChange={v => setN('newOrder', v)} />
              <ToggleRow label={t.settings.dailySummary}
                sub={t.settings.dailySummarySub}
                value={notifs.dailyReport} onChange={v => setN('dailyReport', v)} />
              <ToggleRow label={t.settings.debtReminders}
                sub={t.settings.debtRemindersSub}
                value={notifs.debtDue} onChange={v => setN('debtDue', v)} />
              <button onClick={() => toast.success(t.settings.prefsSaved)}
                className="btn-primary flex items-center gap-2 mt-2">
                <Save size={14} /> {t.settings.savePreferences}
              </button>
            </Section>
          )}

          {/* ── Printer ── */}
          {tab === 'printer' && (
            <div className="space-y-4">
              {/* Connection status card */}
              <div className={clsx(
                'flex items-center justify-between p-4 rounded-xl border',
                printerStatus === 'connected'
                  ? 'border-jade/40 bg-jade/5'
                  : printerStatus === 'connecting'
                  ? 'border-yellow-400/40 bg-yellow-400/5'
                  : 'border-border bg-surface2'
              )}>
                <div className="flex items-center gap-3">
                  {printerStatus === 'connected' ? (
                    <Wifi size={20} className="text-jade" />
                  ) : printerStatus === 'connecting' ? (
                    <RefreshCw size={20} className="text-yellow-400 animate-spin" />
                  ) : (
                    <WifiOff size={20} className="text-muted" />
                  )}
                  <div>
                    <div className={clsx('text-sm font-semibold', {
                      'text-jade':         printerStatus === 'connected',
                      'text-yellow-400':   printerStatus === 'connecting',
                      'text-rose':         printerStatus === 'error',
                      'text-muted':        printerStatus === 'disconnected',
                    })}>
                      {printerStatus === 'connected'   ? '🟢 Ulangan'
                       : printerStatus === 'connecting' ? '🟡 Ulanmoqda...'
                       : printerStatus === 'error'      ? '🔴 Xato'
                       :                                  '⚫ Uzilgan'}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      ws://{ps.host}:{ps.port}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {printerStatus !== 'connected' ? (
                    <button onClick={printerConnect} className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5">
                      <Wifi size={13} /> Ulanish
                    </button>
                  ) : (
                    <button onClick={printerDisconnect} className="px-3 py-1.5 text-xs border border-rose/40 text-rose rounded-lg hover:bg-rose/5 flex items-center gap-1.5">
                      <WifiOff size={13} /> Uzish
                    </button>
                  )}
                </div>
              </div>

              <Section title="XPrint Agent Sozlamalari" icon={Printer}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Host (IP manzil)</label>
                    <input
                      value={ps.host}
                      onChange={e => setPrinterSetting({ host: e.target.value })}
                      placeholder="127.0.0.1"
                      className="input w-full font-mono"
                    />
                    <p className="text-xs text-muted mt-1">Odatda: 127.0.0.1 (local)</p>
                  </div>
                  <div>
                    <label className="label">Port</label>
                    <input
                      value={ps.port}
                      onChange={e => setPrinterSetting({ port: Number(e.target.value) })}
                      type="number"
                      min="1024" max="65535"
                      className="input w-full font-mono"
                    />
                    <p className="text-xs text-muted mt-1">Odatda: 3000</p>
                  </div>
                </div>

                <div>
                  <label className="label">Qog'oz kengligi</label>
                  <div className="flex gap-2 mt-1">
                    {(['80mm', '58mm'] as const).map(w => (
                      <button
                        key={w}
                        onClick={() => setPrinterSetting({ width: w })}
                        className={clsx(
                          'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                          ps.width === w
                            ? 'border-gold bg-gold-dim text-gold'
                            : 'border-border text-muted hover:border-gold/40'
                        )}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">Nusxa soni</label>
                  <input
                    value={ps.copies}
                    onChange={e => setPrinterSetting({ copies: Math.max(1, Number(e.target.value)) })}
                    type="number" min="1" max="5"
                    className="input w-24"
                  />
                </div>

                <ToggleRow
                  label="Avtomatik ulanish"
                  sub="Sahifa ochilganda printerga avtomatik ulanadi"
                  value={ps.autoConnect}
                  onChange={v => setPrinterSetting({ autoConnect: v })}
                />

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={printerConnect}
                    className="btn-primary flex items-center gap-2"
                  >
                    <RefreshCw size={14} /> Qayta ulanish
                  </button>
                  <button
                    onClick={() => {
                      xprint.printReceipt({
                        brandName:   'JANZE ERP',
                        branchName:  'Test Branch',
                        orderId:     'TEST-001',
                        dateStr:     new Date().toLocaleDateString('uz-UZ'),
                        timeStr:     new Date().toLocaleTimeString('uz-UZ'),
                        cashierName: 'Admin',
                        payMethod:   'CASH',
                        items:       [{ name: 'Test mahsulot', qty: 2, price: 50000, total: 100000 }],
                        subtotal:    100000,
                        discountAmt: 0,
                        total:       100000,
                        cashGiven:   100000,
                        change:      0,
                      }).then(sent => {
                        if (sent) toast.success('✅ Test chek printerga yuborildi')
                        else toast('📄 Printer yo\'q — brauzer chopi ochildi', { icon: 'ℹ️' })
                      })
                    }}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-muted hover:text-fg hover:border-gold/40 flex items-center gap-2 transition-colors"
                  >
                    <Printer size={14} /> Test chek bosib ko'rish
                  </button>
                </div>
              </Section>

              <Section title="XPrint Agent o'rnatish" icon={Printer}>
                <div className="space-y-3 text-sm text-muted">
                  <p>XPrint — bu kassir kompyuterida ishlaydigan mahalliy agent. U termal printerni WebSocket orqali boshqaradi.</p>
                  <div className="bg-surface rounded-lg p-3 font-mono text-xs space-y-1 border border-border">
                    <p className="text-muted"># 1. Agent yuklab olish</p>
                    <p className="text-fg">https://xprint.uz/download</p>
                    <p className="text-muted mt-2"># 2. Ishga tushirish</p>
                    <p className="text-fg">xprint-agent --port 3000</p>
                    <p className="text-muted mt-2"># 3. Printer qo'shish (Windows)</p>
                    <p className="text-fg">xprint-agent --printer "POS-80"</p>
                  </div>
                  <p className="text-xs">Agent ishlamasa — brauzer chopi avtomatik ishlatiladi (fallback).</p>
                </div>
              </Section>
            </div>
          )}

          {/* ── Security ── */}
          {tab === 'security' && (
            <div className="space-y-4">
              <Section title={t.settings.changePassword} icon={Shield}>
                <div>
                  <label className="label">{t.settings.currentPassword}</label>
                  <input value={secForm.currentPassword}
                    onChange={e => setSec(f => ({ ...f, currentPassword: e.target.value }))}
                    type="password" placeholder="••••••••" className="input w-full" />
                </div>
                <div>
                  <label className="label">{t.settings.newPassword}</label>
                  <input value={secForm.newPassword}
                    onChange={e => setSec(f => ({ ...f, newPassword: e.target.value }))}
                    type="password" placeholder={t.settings.minChars} className="input w-full" />
                </div>
                <div>
                  <label className="label">{t.settings.confirmPassword}</label>
                  <input value={secForm.confirmPassword}
                    onChange={e => setSec(f => ({ ...f, confirmPassword: e.target.value }))}
                    type="password" placeholder={t.settings.repeatPassword} className="input w-full" />
                </div>
                <button onClick={savePassword} disabled={passwordMut.isPending} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                  <Save size={14} /> {passwordMut.isPending ? t.common.loading : t.settings.updatePassword}
                </button>
              </Section>

              <Section title={t.settings.accountInfo} icon={User}>
                <div className="space-y-2 text-sm">
                  {[
                    [t.employees.role, user?.role],
                    [t.common.branch,  user?.branch?.name ?? user?.branchId],
                    [t.settings.accountStatus, t.common.active],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between py-1 border-b border-border last:border-0">
                      <span className="text-muted">{label}</span>
                      <span className="font-medium">{value ?? '—'}</span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
