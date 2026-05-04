"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { type: "link"; label: string; href: string }
  | { type: "group"; label: string; children: { label: string; href: string }[] };

const NAV: NavItem[] = [
  {
    type: "link",
    label: "Dashboard",
    href: "/dashboard",
  },
  {
    type: "group",
    label: "Quản lý hồ sơ",
    children: [
      { label: "Tạo hồ sơ mới", href: "/dashboard/visa/form" },
      { label: "Danh sách hồ sơ", href: "/dashboard/visa/list" },
    ],
  },
  {
    type: "group",
    label: "Cài đặt",
    children: [
      { label: "Tài khoản của tôi", href: "/dashboard/settings/account" },
      { label: "Cài đặt hệ thống", href: "/dashboard/settings/system" },
    ],
  },
];

export default function SidebarNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (pathname === href) return true;
    return pathname.startsWith(href + "/") && !NAV.flatMap(i => i.type === "group" ? i.children : [i]).some(
      item => item.href !== href && pathname.startsWith(item.href)
    );
  };

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV.map((item, i) => {
        if (item.type === "link") {
          return (
            <Link
              key={i}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-gray-200 text-gray-900"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <div key={i} className="mt-4">
            <p className="mb-1 px-3 text-xs font-bold uppercase tracking-widest text-gray-400">
              {item.label}
            </p>
            <div className="flex flex-col gap-1">
              {item.children.map((child) => (
                <Link
                  key={child.href}
                  href={child.href}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive(child.href)
                      ? "bg-gray-200 font-medium text-gray-900"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {child.label}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}