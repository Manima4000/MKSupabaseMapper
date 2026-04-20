import { Suspense } from 'react'
import Navbar from '@/components/dashboard/navbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg-base)]">
      <Suspense>
        <Navbar />
      </Suspense>
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-10 w-full animate-fade-up">
          {children}
        </div>
      </main>
    </div>
  )
}
