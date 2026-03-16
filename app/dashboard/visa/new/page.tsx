'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ───────────────────────────────────────────
type Customer = {
  customer_id: string
  customer_first_name: string
  customer_last_name: string
  tripu_customer_contacts: { contact_type: string; contact_value: string }[]
  tripu_customer_identifiers: { identifier_type: string; identifier_value: string }[]
}

// ─── Page ────────────────────────────────────────────
export default function NewVisaPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', phone: '', email: '', identifier: '' })
  const [results, setResults] = useState<Customer[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Customer | null>(null)

  // ─── Supabase client ───────────────────────────────
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'visa' } }
  ), [])

  // ─── Search logic ─────────────────────────────────
  const handleSearch = async () => {
    setLoading(true)
    setSelected(null)

    const { identifier, email, phone, name } = form
    let ids: string[] = []

    if (identifier) {
      const { data } = await supabase.rpc('search_customer_by_identifier', { search_term: identifier })
      ids = [...ids, ...(data as { customer_id: string }[] ?? []).map(r => r.customer_id)]
    }
    if (email) {
      const { data } = await supabase.rpc('search_customer_by_contact', { search_term: email, contact_type_filter: ['email'] })
      ids = [...ids, ...(data as { customer_id: string }[] ?? []).map(r => r.customer_id)]
    }
    if (phone) {
      const { data } = await supabase.rpc('search_customer_by_contact', { search_term: phone, contact_type_filter: ['phone', 'zalo'] })
      ids = [...ids, ...(data as { customer_id: string }[] ?? []).map(r => r.customer_id)]
    }
    if (name) {
      const { data } = await supabase.rpc('search_customer_by_name', { search_term: name })
      ids = [...ids, ...(data as { customer_id: string }[] ?? []).map(r => r.customer_id)]
    }

    const finalIds = [...new Set(ids)]
    if (finalIds.length === 0) {
      setResults([])
      setLoading(false)
      return
    }

    const fetched = await Promise.all(
      finalIds.map(id =>
        supabase
          .from('tripu_customer')
          .select(`
            customer_id,
            customer_first_name,
            customer_last_name,
            tripu_customer_contacts(contact_type, contact_value),
            tripu_customer_identifiers(identifier_type, identifier_value)
          `)
          .eq('customer_id', id)
          .eq('is_deleted', false)
          .single()
      )
    )

    const data = fetched.filter(r => r.data !== null).map(r => r.data) as Customer[]
    setResults(data)
    setLoading(false)
  }

  const noResults = results !== null && results.length === 0
  const hasResults = results !== null && results.length > 0

  // ─── UI ──────────────────────────────────────────
  return (
    <div>
      <h1 className="text-xl font-semibold mb-6">Tạo hồ sơ visa mới</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">1</span>
          <span className="text-sm font-medium text-blue-600">Khách hàng</span>
        </div>
        <div className="flex-1 h-px bg-gray-200 mx-2" />
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-gray-200 text-gray-400 text-xs flex items-center justify-center font-medium">2</span>
          <span className="text-sm text-gray-400">Thông tin visa</span>
        </div>
      </div>

      {/* Search form */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-4">Tìm kiếm khách hàng</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Passport / CCCD</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Số định danh..."
              value={form.identifier}
              onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@..."
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Số điện thoại</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="09xx..."
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Họ tên</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nguyễn Văn A..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || Object.values(form).every(v => !v)}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Đang tìm...' : 'Tìm kiếm'}
        </button>
      </div>

      {/* Results — 2 col */}
      {(hasResults || noResults) && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Cột trái — danh sách khách */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Kết quả tìm kiếm</p>
            {noResults && (
              <p className="text-sm text-gray-500 py-3">Không tìm thấy khách hàng phù hợp.</p>
            )}
            {hasResults && (
              <div className="bg-white rounded-xl border divide-y overflow-hidden">
                {results.map(c => {
                  const phone = c.tripu_customer_contacts.find(x => x.contact_type === 'phone')?.contact_value
                  const identifier = c.tripu_customer_identifiers[0]
                  const isSelected = selected?.customer_id === c.customer_id
                  return (
                    <div
                      key={c.customer_id}
                      onClick={() => setSelected(isSelected ? null : c)}
                      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium">{c.customer_last_name} {c.customer_first_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {identifier ? `${identifier.identifier_type.toUpperCase()}: ${identifier.identifier_value}` : ''}
                          {identifier && phone ? ' · ' : ''}
                          {phone ?? ''}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-xs text-blue-500 font-medium">Đã chọn</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cột phải — hồ sơ visa của khách đang chọn */}
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Hồ sơ visa</p>
            {!selected ? (
              <div className="bg-white rounded-xl border px-4 py-6 text-center text-sm text-gray-400">
                Chọn khách hàng để xem hồ sơ
              </div>
            ) : (
              <div className="bg-white rounded-xl border px-4 py-6 text-center text-sm text-gray-400">
                {/* TODO: fetch visa cases by selected.customer_id */}
                Chưa có hồ sơ nào
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 max-w-sm">
        <button
          disabled={results === null}
          onClick={() => router.push('/dashboard/customers/new')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors
            ${results !== null
              ? 'border-blue-600 text-blue-600 hover:bg-blue-50'
              : 'border-gray-200 text-gray-300 cursor-not-allowed'
            }`}
        >
          + Tạo khách hàng mới
        </button>
        <button
          disabled={!selected}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Tiếp tục →
        </button>
      </div>
    </div>
  )
}