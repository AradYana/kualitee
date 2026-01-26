import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kualitee - Automated LLM QA System v1.0',
  description: 'Industrial-scale LLM evaluation with a Neo-Retro aesthetic',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#cec5b4' }}>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}
