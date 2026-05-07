import React         from 'react'
import ReactDOM      from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster }   from 'react-hot-toast'
import App           from './App'
import './index.css'
// Import themeStore so its IIFE runs and applies the saved theme before paint
import { useThemeStore } from './stores/themeStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

// Toaster that adapts to the active theme via CSS variables
function ThemedToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: 'var(--toaster-bg)',
          color:      'var(--toaster-color)',
          border:     '1px solid var(--toaster-border)',
        },
      }}
    />
  )
}

// Suppress "unused import" warning – we side-effect-import the store
void useThemeStore

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
