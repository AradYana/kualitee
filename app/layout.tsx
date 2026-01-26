import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KUALITEE - Automated LLM QA System',
  description: 'Industrial-scale LLM evaluation with 90s MS-DOS aesthetics',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="crt-screen bg-dos-black text-matrix-green font-dos min-h-screen">
        <div className="scanline-overlay" />
        <main className="relative z-10 flicker">
          {children}
        </main>
      </body>
    </html>
  )
}
