"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

export default function LogoutButtonClient() {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <button
      onClick={handleLogout}
      className="w-full rounded-md px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
    >
      Đăng xuất
    </button>
  );
}