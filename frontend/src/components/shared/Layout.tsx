import { Outlet } from 'react-router-dom'
import Sidebar    from './Sidebar'
import TopBar     from './TopBar'
import { useUIStore } from '../../stores/uiStore'
import clsx from 'clsx'

export default function Layout() {
  const open = useUIStore(s => s.sidebarOpen)
  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className={clsx('flex flex-col flex-1 min-w-0 transition-all duration-200', open ? 'ml-60' : 'ml-16')}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
