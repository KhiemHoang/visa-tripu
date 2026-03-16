import { createClient } from '@/app/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Lấy thông tin staff từ tripu_staff
  const { data: staff } = await supabase
    .from('tripu_staff')
    .select('*')
    .eq('auth_user_id', user.id)
    .single()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-medium">Dashboard</h1>
      <p className="text-gray-500 mt-2">Xin chào, {staff?.staff_name ?? user.email}</p>
    </div>
  )
}