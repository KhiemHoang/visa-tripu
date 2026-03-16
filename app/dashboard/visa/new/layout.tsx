import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tạo hồ sơ visa mới | TripU Visa',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}