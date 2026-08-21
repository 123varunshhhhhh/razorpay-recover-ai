import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Recover AI - Razorpay Buildathon',
  description: 'AI-Powered Revenue Recovery Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen text-slate-100 font-sans selection:bg-indigo-500/30">
        {children}
      </body>
    </html>
  )
}
