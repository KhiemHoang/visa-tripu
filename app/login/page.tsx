"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [view, setView] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Email hoặc mật khẩu không đúng.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard/settings/account`,
    });

    setLoading(false);

    if (error) {
      setError("Không thể gửi email. Vui lòng thử lại.");
      return;
    }

    setMessage("Đã gửi link đặt lại mật khẩu. Kiểm tra hộp thư của bạn.");
  };

  const switchView = (v: "login" | "forgot") => {
    setView(v);
    setError("");
    setMessage("");
    setPassword("");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        {/* Logo */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">TripU Visa</h1>
          <p className="mt-1 text-sm text-gray-500">
            {view === "login" ? "Đăng nhập vào hệ thống" : "Đặt lại mật khẩu"}
          </p>
        </div>

        {/* Login Form */}
        {view === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <button
              type="button"
              onClick={() => switchView("forgot")}
              className="text-center text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              Quên mật khẩu?
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {view === "forgot" && (
          <form onSubmit={handleForgot} className="flex flex-col gap-4">
            <p className="text-sm text-gray-600">
              Nhập email tài khoản của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {message && <p className="text-sm text-green-600">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-lg bg-gray-900 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-50"
            >
              {loading ? "Đang gửi..." : "Gửi link đặt lại"}
            </button>

            <button
              type="button"
              onClick={() => switchView("login")}
              className="text-center text-sm text-gray-500 hover:text-gray-700 hover:underline"
            >
              ← Quay lại đăng nhập
            </button>
          </form>
        )}
      </div>
    </div>
  );
}