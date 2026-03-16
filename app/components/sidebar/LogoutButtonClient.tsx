'use client'
import { supabase } from '@/app/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LogoutButtonClient() {
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
    >
      Đăng xuất
    </button>
  )
}