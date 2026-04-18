import type { Metadata } from 'next'
import { Geist, Syne, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', weight: ['400', '600', '700', '800'] })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '700'] })

export const metadata: Metadata = {
  title: 'Dashboard — MemberKit Analytics',
  description: 'Painel de acompanhamento de alunos e engajamento',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${syne.variable} ${jetbrainsMono.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  )
}
