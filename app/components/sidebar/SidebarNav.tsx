'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  {
    group: 'Quản lý visa',
    items: [
      { label: 'Tạo hồ sơ mới', href: '/dashboard/visa/new' },
      { label: 'Danh sách hồ sơ', href: '/dashboard/visa' },
    ],
  },
  {
    group: 'Quản lý khách hàng',
    items: [
      { label: 'Tạo khách hàng mới', href: '/dashboard/customers/new' },
      { label: 'Danh sách khách hàng', href: '/dashboard/customers' },
      { label: 'Hồ sơ khách hàng', href: '/dashboard/customers/portfolio' },
    ],
  },
  {
    group: 'Cài đặt',
    items: [
      { label: 'Tài khoản của tôi', href: '/dashboard/settings/account' },
      { label: 'Cài đặt hệ thống', href: '/dashboard/settings/system' },
    ],
  },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-6 px-3 py-4">
      {nav.map((section) => (
        <div key={section.group}>
          <p className="px-3 mb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
            {section.group}
          </p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? 'bg-gray-100 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}