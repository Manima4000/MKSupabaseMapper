import { Suspense } from 'react'
import Sidebar from '@/components/dashboard/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-[var(--bg-base)]">
      <Suspense>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1400px] mx-auto p-8 lg:p-12 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
