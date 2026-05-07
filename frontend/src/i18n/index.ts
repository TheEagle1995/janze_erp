/**
 * Centralized i18n system
 * ─────────────────────────────────────────────────────────────
 * Usage:
 *   import { useT } from '../i18n'
 *   const t = useT()
 *   t.nav.dashboard          → 'Dashboard' | 'Bosh sahifa' | 'Главная'
 *   t.common.save            → 'Save' | 'Saqlash' | 'Сохранить'
 *   t.products.addProduct    → 'Add Product' | …
 *   t.status.PENDING         → 'Pending' | …
 *
 * Adding a new language:
 *   1. Create src/i18n/XX.ts (copy en.ts and translate)
 *   2. Add to the `locales` map below
 *   3. Add to LANGUAGES list
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import en, { type Translations } from './en'
import uz from './uz'
import ru from './ru'

export type Lang = 'en' | 'uz' | 'ru'

export const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'uz', label: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', label: 'Русский',   flag: '🇷🇺' },
  { code: 'en', label: 'English',   flag: '🇬🇧' },
]

const locales: Record<Lang, Translations> = { en, uz, ru }

// ── Store ─────────────────────────────────────────────────────
interface I18nState {
  lang:    Lang
  t:       Translations
  setLang: (l: Lang) => void
}

export const useI18n = create<I18nState>()(
  persist(
    (set) => ({
      lang:    'uz',                    // default: Uzbek
      t:       locales['uz'],
      setLang: (l) => set({ lang: l, t: locales[l] }),
    }),
    { name: 'avero-lang-v2' }
  )
)

/** Short alias — same as useI18n().t */
export const useT = () => useI18n(s => s.t)

/** Get just the language code */
export const useLang = () => useI18n(s => ({ lang: s.lang, setLang: s.setLang }))

export type { Translations }
