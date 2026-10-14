import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './dashboard.css'

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className={`${inter.className} antialiased`}>{children}</div>
}