import { Suspense } from 'react'
import Sidebar from '@/components/dashboard/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-7">{children}</main>
      </div>
    </div>
  )
}
