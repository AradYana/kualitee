import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Kualitee - Automated LLM QA System',
  description: 'Enterprise-grade LLM evaluation platform with custom KPIs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-main">
        {children}
      </body>
    </html>
  )
}
