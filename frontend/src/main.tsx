import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1e2029', color: '#e8e8e0', border: '1px solid #2e3141' },
          success: { iconTheme: { primary: '#56c4a8', secondary: '#1e2029' } },
          error: { iconTheme: { primary: '#e05c6a', secondary: '#1e2029' } },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
)
