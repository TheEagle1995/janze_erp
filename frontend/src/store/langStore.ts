import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LangCode = 'en' | 'uz' | 'ru'

export interface Language {
  code:  LangCode
  label: string
  flag:  string
}

export const LANGUAGES: Language[] = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский',   flag: '🇷🇺' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
]

// ── Translations ────────────────────────────────────────────────────────────
type Dict = Record<string, string>

const translations: Record<LangCode, Dict> = {
  en: {
    // Nav
    'nav.dashboard':   'Dashboard',
    'nav.pos':         'POS',
    'nav.products':    'Products',
    'nav.orders':      'Orders',
    'nav.analytics':   'Analytics',
    'nav.customers':   'Customers',
    'nav.inventory':   'Inventory',
    'nav.finance':     'Finance',
    'nav.employees':   'Employees',
    'nav.suppliers':   'Suppliers',
    'nav.discounts':   'Discounts',
    'nav.debts':       'Debts',
    'nav.branches':    'Branches',
    'nav.aiInsights':  'AI Insights',
    'nav.settings':    'Settings',
    // Common
    'common.save':     'Save',
    'common.cancel':   'Cancel',
    'common.create':   'Create',
    'common.edit':     'Edit',
    'common.delete':   'Delete',
    'common.search':   'Search',
    'common.filter':   'Filter',
    'common.loading':  'Loading...',
    'common.noData':   'No data',
    'common.all':      'All',
    'common.active':   'Active',
    'common.inactive': 'Inactive',
    // Dashboard
    'dashboard.title':        'Dashboard',
    'dashboard.subtitle':     'Business overview',
    'dashboard.revenue':      'Revenue',
    'dashboard.itemsSold':    'Items Sold',
    'dashboard.newCustomers': 'New Customers',
    'dashboard.avgOrder':     'Avg Order',
    'dashboard.recentSales':  'Recent Sales',
    'dashboard.topProducts':  'Top Products',
    'dashboard.today':        'Today',
    'dashboard.thisWeek':     'This Week',
    'dashboard.thisMonth':    'This Month',
    // Settings
    'settings.title':       'Settings',
    'settings.subtitle':    'Account & system configuration',
    'settings.profile':     'My Profile',
    'settings.appearance':  'Appearance',
    'settings.language':    'Language',
    'settings.users':       'System Users',
    'settings.updateProfile': 'Update Profile',
    'settings.dangerZone':  'Danger Zone',
    'settings.signOut':     'Sign out',
    'settings.theme':       'Theme',
    'settings.selectTheme': 'Select a theme',
    'settings.selectLang':  'Select language',
    // AI Insights
    'ai.title':          'AI Insights',
    'ai.subtitle':       'Smart business analysis',
    'ai.healthScore':    'Business Health Score',
    'ai.forecast':       'Next Period Forecast',
    'ai.recommendations':'Recommendations',
    'ai.highPriority':   'High Priority',
    'ai.medPriority':    'Medium Priority',
    'ai.lowPriority':    'Low Priority',
  },

  uz: {
    // Nav
    'nav.dashboard':   'Boshqaruv paneli',
    'nav.pos':         'Kassa',
    'nav.products':    'Mahsulotlar',
    'nav.orders':      'Buyurtmalar',
    'nav.analytics':   'Tahlil',
    'nav.customers':   'Mijozlar',
    'nav.inventory':   'Inventar',
    'nav.finance':     'Moliya',
    'nav.employees':   'Xodimlar',
    'nav.suppliers':   'Yetkazib beruvchilar',
    'nav.discounts':   'Chegirmalar',
    'nav.debts':       'Qarzlar',
    'nav.branches':    'Filiallar',
    'nav.aiInsights':  'AI Tahlili',
    'nav.settings':    'Sozlamalar',
    // Common
    'common.save':     'Saqlash',
    'common.cancel':   'Bekor qilish',
    'common.create':   'Yaratish',
    'common.edit':     'Tahrirlash',
    'common.delete':   "O'chirish",
    'common.search':   'Qidirish',
    'common.filter':   'Filtrlash',
    'common.loading':  'Yuklanmoqda...',
    'common.noData':   "Ma'lumot yo'q",
    'common.all':      'Hammasi',
    'common.active':   'Faol',
    'common.inactive': 'Faol emas',
    // Dashboard
    'dashboard.title':        'Boshqaruv paneli',
    'dashboard.subtitle':     'Biznes ko\'rinishi',
    'dashboard.revenue':      'Daromad',
    'dashboard.itemsSold':    'Sotilgan mahsulotlar',
    'dashboard.newCustomers': 'Yangi mijozlar',
    'dashboard.avgOrder':     "O'rtacha buyurtma",
    'dashboard.recentSales':  "So'nggi sotuvlar",
    'dashboard.topProducts':  'Top mahsulotlar',
    'dashboard.today':        'Bugun',
    'dashboard.thisWeek':     'Bu hafta',
    'dashboard.thisMonth':    'Bu oy',
    // Settings
    'settings.title':       'Sozlamalar',
    'settings.subtitle':    'Hisob va tizim sozlamalari',
    'settings.profile':     'Mening profilim',
    'settings.appearance':  "Ko'rinish",
    'settings.language':    'Til',
    'settings.users':       'Tizim foydalanuvchilari',
    'settings.updateProfile': 'Profilni yangilash',
    'settings.dangerZone':  'Xavfli zona',
    'settings.signOut':     'Chiqish',
    'settings.theme':       'Mavzu',
    'settings.selectTheme': 'Mavzuni tanlang',
    'settings.selectLang':  'Tilni tanlang',
    // AI Insights
    'ai.title':          'AI Tahlili',
    'ai.subtitle':       'Aqlli biznes tahlili',
    'ai.healthScore':    'Biznes salomatligi',
    'ai.forecast':       'Keyingi davr bashorati',
    'ai.recommendations':'Tavsiyalar',
    'ai.highPriority':   'Yuqori ustuvorlik',
    'ai.medPriority':    "O'rta ustuvorlik",
    'ai.lowPriority':    'Past ustuvorlik',
  },

  ru: {
    // Nav
    'nav.dashboard':   'Панель управления',
    'nav.pos':         'Касса',
    'nav.products':    'Товары',
    'nav.orders':      'Заказы',
    'nav.analytics':   'Аналитика',
    'nav.customers':   'Клиенты',
    'nav.inventory':   'Инвентарь',
    'nav.finance':     'Финансы',
    'nav.employees':   'Сотрудники',
    'nav.suppliers':   'Поставщики',
    'nav.discounts':   'Скидки',
    'nav.debts':       'Долги',
    'nav.branches':    'Филиалы',
    'nav.aiInsights':  'ИИ Аналитика',
    'nav.settings':    'Настройки',
    // Common
    'common.save':     'Сохранить',
    'common.cancel':   'Отмена',
    'common.create':   'Создать',
    'common.edit':     'Редактировать',
    'common.delete':   'Удалить',
    'common.search':   'Поиск',
    'common.filter':   'Фильтр',
    'common.loading':  'Загрузка...',
    'common.noData':   'Нет данных',
    'common.all':      'Все',
    'common.active':   'Активный',
    'common.inactive': 'Неактивный',
    // Dashboard
    'dashboard.title':        'Панель управления',
    'dashboard.subtitle':     'Обзор бизнеса',
    'dashboard.revenue':      'Выручка',
    'dashboard.itemsSold':    'Продано товаров',
    'dashboard.newCustomers': 'Новые клиенты',
    'dashboard.avgOrder':     'Средний чек',
    'dashboard.recentSales':  'Последние продажи',
    'dashboard.topProducts':  'Топ товары',
    'dashboard.today':        'Сегодня',
    'dashboard.thisWeek':     'На этой неделе',
    'dashboard.thisMonth':    'В этом месяце',
    // Settings
    'settings.title':       'Настройки',
    'settings.subtitle':    'Настройки аккаунта и системы',
    'settings.profile':     'Мой профиль',
    'settings.appearance':  'Внешний вид',
    'settings.language':    'Язык',
    'settings.users':       'Пользователи системы',
    'settings.updateProfile': 'Обновить профиль',
    'settings.dangerZone':  'Опасная зона',
    'settings.signOut':     'Выйти',
    'settings.theme':       'Тема',
    'settings.selectTheme': 'Выберите тему',
    'settings.selectLang':  'Выберите язык',
    // AI Insights
    'ai.title':          'ИИ Аналитика',
    'ai.subtitle':       'Умный бизнес-анализ',
    'ai.healthScore':    'Рейтинг здоровья бизнеса',
    'ai.forecast':       'Прогноз на следующий период',
    'ai.recommendations':'Рекомендации',
    'ai.highPriority':   'Высокий приоритет',
    'ai.medPriority':    'Средний приоритет',
    'ai.lowPriority':    'Низкий приоритет',
  },
}

// ── Store ────────────────────────────────────────────────────────────────────
interface LangState {
  lang:    LangCode
  setLang: (l: LangCode) => void
  t:       (key: string, fallback?: string) => string
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: 'uz',
      setLang: (lang) => set({ lang }),
      t: (key: string, fallback?: string) => {
        const dict = translations[get().lang] ?? translations.uz
        return dict[key] ?? fallback ?? key
      },
    }),
    { name: 'janze-lang' }
  )
)

/** Convenience hooks */
export const useT    = () => useLangStore(s => s.t)
export const useLang = () => useLangStore(s => ({ lang: s.lang, setLang: s.setLang }))
