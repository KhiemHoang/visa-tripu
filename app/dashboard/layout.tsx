import Sidebar from "@/app/components/sidebar/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="w-[75%] mx-auto py-8">
          {children}
        </div>
      </main>
    </div>
  );
}