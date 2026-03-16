import Sidebar from '@/app/components/sidebar/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
        <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-8 bg-gray-100">
        <div className="w-[75%] mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}