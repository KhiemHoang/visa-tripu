import SidebarNav from "./SidebarNav";
import LogoutButtonClient from "./LogoutButtonClient";

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white sticky top-0">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-gray-200 px-6">
        <span className="text-base font-bold text-gray-900">TripU Visa</span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      <div className="border-t border-gray-200 p-3">
        <LogoutButtonClient />
      </div>
    </aside>
  );
}