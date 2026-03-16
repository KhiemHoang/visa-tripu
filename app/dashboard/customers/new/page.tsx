'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

// ─── Types ───────────────────────────────────────────
type ContactEntry = { value: string; isPrimary: boolean }
type IdentifierEntry = {
  type: 'cccd' | 'passport'
  value: string
  issued_date: string
  expiry_date: string
}

// ─── Helpers ─────────────────────────────────────────
const emptyContact = (): ContactEntry => ({ value: '', isPrimary: false })
const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const R = <span className="text-red-500">*</span>

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [display, setDisplay] = useState(() => {
    if (!value) return ''
    const [y, m, d] = value.split('-')
    return `${d}/${m}/${y}`
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^\d/]/g, '')
    if (v.length === 2 && display.length === 1) v += '/'
    if (v.length === 5 && display.length === 4) v += '/'
    setDisplay(v)
    if (v.length === 10) {
      const [d, m, y] = v.split('/')
      onChange(`${y}-${m}-${d}`)
    } else {
      onChange('')
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={10}
      placeholder="dd/mm/yyyy"
      value={display}
      onChange={handleChange}
      className={inputCls}
    />
  )
}

// ─── Page ────────────────────────────────────────────
export default function NewCustomerPage() {
  const router = useRouter()

  const [lastName, setLastName]   = useState('')
  const [firstName, setFirstName] = useState('')
  const [dob, setDob]             = useState('')

  const [cccd, setCccd]         = useState<IdentifierEntry>({ type: 'cccd',     value: '', issued_date: '', expiry_date: '' })
  const [passport, setPassport] = useState<IdentifierEntry>({ type: 'passport', value: '', issued_date: '', expiry_date: '' })

  const [phones, setPhones] = useState<ContactEntry[]>([{ value: '', isPrimary: true }])
  const [emails, setEmails] = useState<ContactEntry[]>([{ value: '', isPrimary: true }])

  const [errors, setErrors]   = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'visa' } }
  ), [])

  const setPrimary = (list: ContactEntry[], idx: number): ContactEntry[] =>
    list.map((e, i) => ({ ...e, isPrimary: i === idx }))

  const addContact = (setter: React.Dispatch<React.SetStateAction<ContactEntry[]>>) =>
    setter(prev => [...prev, emptyContact()])

  const removeContact = (setter: React.Dispatch<React.SetStateAction<ContactEntry[]>>, idx: number) =>
    setter(prev => {
      const next = prev.filter((_, i) => i !== idx)
      if (prev[idx].isPrimary && next.length > 0) next[0].isPrimary = true
      return next
    })

  const updateContact = (setter: React.Dispatch<React.SetStateAction<ContactEntry[]>>, idx: number, value: string) =>
    setter(prev => prev.map((e, i) => i === idx ? { ...e, value } : e))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!lastName.trim())  e.lastName  = 'Vui lòng nhập họ'
    if (!firstName.trim()) e.firstName = 'Vui lòng nhập tên'
    if (!cccd.value.trim())     e.cccd     = 'Vui lòng nhập số CCCD'
    if (!passport.value.trim()) e.passport = 'Vui lòng nhập số hộ chiếu'
    if (phones.every(p => !p.value.trim())) e.phones = 'Vui lòng nhập ít nhất 1 số điện thoại'
    if (emails.every(p => !p.value.trim())) e.emails = 'Vui lòng nhập ít nhất 1 email'
    return e
  }

  const checkDuplicate = async () => {
    const dupes: string[] = []
    const { data: byCccd } = await supabase.rpc('search_customer_by_identifier', { search_term: cccd.value.trim() })
    if ((byCccd as { customer_id: string }[] ?? []).length > 0) dupes.push('CCCD đã tồn tại trong hệ thống')
    const { data: byPassport } = await supabase.rpc('search_customer_by_identifier', { search_term: passport.value.trim() })
    if ((byPassport as { customer_id: string }[] ?? []).length > 0) dupes.push('Số hộ chiếu đã tồn tại trong hệ thống')
    return dupes
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    setLoading(true)

    const dupes = await checkDuplicate()
    if (dupes.length > 0) {
      const de: Record<string, string> = {}
      dupes.forEach(d => {
        if (d.includes('CCCD'))     de.cccd     = d
        if (d.includes('hộ chiếu')) de.passport = d
      })
      setErrors(de)
      setLoading(false)
      return
    }

    const { data: customer, error: customerErr } = await supabase
      .from('tripu_customer')
      .insert({ customer_first_name: firstName.trim(), customer_last_name: lastName.trim(), customer_dob: dob || null })
      .select('customer_id')
      .single()

    if (customerErr || !customer) {
      setErrors({ submit: 'Tạo khách hàng thất bại: ' + customerErr?.message })
      setLoading(false)
      return
    }

    const cid = customer.customer_id

    await supabase.from('tripu_customer_identifiers').insert([
      { customer_id: cid, identifier_type: 'cccd',     identifier_value: cccd.value.trim(),     issued_date: cccd.issued_date || null,     expiry_date: cccd.expiry_date || null,     status: 'active' },
      { customer_id: cid, identifier_type: 'passport', identifier_value: passport.value.trim(), issued_date: passport.issued_date || null, expiry_date: passport.expiry_date || null, status: 'active' },
    ])

    await supabase.from('tripu_customer_contacts').insert([
      ...phones.filter(p => p.value.trim()).map(p => ({ customer_id: cid, contact_type: 'phone', contact_value: p.value.trim(), tag: p.isPrimary ? 'primary' : null })),
      ...emails.filter(e => e.value.trim()).map(e => ({ customer_id: cid, contact_type: 'email', contact_value: e.value.trim(), tag: e.isPrimary ? 'primary' : null })),
    ])

    setLoading(false)
    router.push('/dashboard/customers')
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-sm text-gray-400 hover:text-gray-700">← Quay lại</button>
        <h1 className="text-xl font-semibold">Tạo khách hàng mới</h1>
      </div>

      <div className="flex flex-col gap-5">

        {/* ── Thông tin cơ bản ── */}
        <Section title={<>Thông tin cơ bản</>}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={<>Họ {R}</>} error={errors.lastName}>
              <input className={inputCls} placeholder="Nguyễn" value={lastName} onChange={e => setLastName(e.target.value)} />
            </Field>
            <Field label={<>Tên {R}</>} error={errors.firstName}>
              <input className={inputCls} placeholder="Văn A" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </Field>
          </div>
          <Field label="Ngày sinh">
            <DateInput value={dob} onChange={setDob} />
          </Field>
        </Section>

        {/* ── Giấy tờ định danh ── */}
        <Section title="Giấy tờ định danh">
          <div className="mb-2">
            <p className="text-xs font-medium text-gray-600 mb-2">Căn cước công dân {R}</p>
            <Field error={errors.cccd}>
              <input className={inputCls} placeholder="Số CCCD" value={cccd.value} onChange={e => setCccd(v => ({ ...v, value: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Field label="Ngày cấp">
                <DateInput value={cccd.issued_date} onChange={v => setCccd(c => ({ ...c, issued_date: v }))} />
              </Field>
              <Field label="Ngày hết hạn">
                <DateInput value={cccd.expiry_date} onChange={v => setCccd(c => ({ ...c, expiry_date: v }))} />
              </Field>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Hộ chiếu {R}</p>
            <Field error={errors.passport}>
              <input className={inputCls} placeholder="Số hộ chiếu" value={passport.value} onChange={e => setPassport(v => ({ ...v, value: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <Field label="Ngày cấp">
                <DateInput value={passport.issued_date} onChange={v => setPassport(c => ({ ...c, issued_date: v }))} />
              </Field>
              <Field label="Ngày hết hạn">
                <DateInput value={passport.expiry_date} onChange={v => setPassport(c => ({ ...c, expiry_date: v }))} />
              </Field>
            </div>
          </div>
        </Section>

        {/* ── Số điện thoại ── */}
        <Section title={<>Số điện thoại {R}</>}>
          <p className="text-xs text-gray-400 -mt-2">Tích vào ô tròn để chọn số liên lạc mặc định</p>
          {errors.phones && <p className="text-xs text-red-500">{errors.phones}</p>}
          <div className="flex flex-col gap-2">
            {phones.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  title={p.isPrimary ? 'Số chính' : 'Đặt làm số chính'}
                  type="radio"
                  checked={p.isPrimary}
                  onChange={() => setPhones(prev => setPrimary(prev, i))}
                  className="accent-blue-600 shrink-0"
                />
                <input className={inputCls} placeholder="09xx..." value={p.value} onChange={e => updateContact(setPhones, i, e.target.value)} />
                {phones.length > 1 && (
                  <button onClick={() => removeContact(setPhones, i)} className="text-gray-300 hover:text-red-400 text-lg shrink-0">×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => addContact(setPhones)} className="mt-1 text-xs text-blue-600 hover:underline">+ Thêm số</button>
        </Section>

        {/* ── Email ── */}
        <Section title={<>Email {R}</>}>
          <p className="text-xs text-gray-400 -mt-2">Tích vào ô tròn để chọn email liên lạc mặc định</p>
          {errors.emails && <p className="text-xs text-red-500">{errors.emails}</p>}
          <div className="flex flex-col gap-2">
            {emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  title={e.isPrimary ? 'Email chính' : 'Đặt làm email chính'}
                  type="radio"
                  checked={e.isPrimary}
                  onChange={() => setEmails(prev => setPrimary(prev, i))}
                  className="accent-blue-600 shrink-0"
                />
                <input className={inputCls} placeholder="email@..." value={e.value} onChange={ev => updateContact(setEmails, i, ev.target.value)} />
                {emails.length > 1 && (
                  <button onClick={() => removeContact(setEmails, i)} className="text-gray-300 hover:text-red-400 text-lg shrink-0">×</button>
                )}
              </div>
            ))}
          </div>
          <button onClick={() => addContact(setEmails)} className="mt-1 text-xs text-blue-600 hover:underline">+ Thêm email</button>
        </Section>

        {/* ── Submit ── */}
        {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
        <div className="flex gap-3 pb-10">
          <button onClick={() => router.back()} className="flex-1 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50">
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang lưu...' : 'Tạo khách hàng'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────
function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <p className="text-sm font-semibold text-gray-800 mb-4">{title}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function Field({ label, error, children }: { label?: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}