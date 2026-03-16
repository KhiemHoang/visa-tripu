import SidebarNav from './SidebarNav'
import LogoutButtonClient from './LogoutButtonClient'

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white">
      {/* Logo placeholder */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <div className="w-8 h-8 rounded-md bg-gray-200 mr-3" />
        <span className="font-semibold text-gray-800">TripU Visa</span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      {/* Footer — logout */}
      <div className="border-t border-gray-200 p-4">
        <LogoutButtonClient />
      </div>
    </aside>
  )
}