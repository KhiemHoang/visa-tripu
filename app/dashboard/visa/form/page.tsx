"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

type VisaType  = { visa_type_id: string; visa_type: string };
type Companion = { full_name: string; passport_number: string };

const COUNTRIES = [{ name: "Nhật Bản", code: "JP" }];

export default function VisaFormPage() {
  const router   = useRouter();
  const supabase = createClient();

  const [mainName,     setMainName]     = useState("");
  const [mainPassport, setMainPassport] = useState("");
  const [visaTypes,    setVisaTypes]    = useState<VisaType[]>([]);
  const [visaTypeId,   setVisaTypeId]   = useState("");
  const [flightDate,   setFlightDate]   = useState("");
  const [destination,  setDestination]  = useState("Nhật Bản");
  const [priority,     setPriority]     = useState<"Standard" | "Priority">("Standard");
  const [companions,   setCompanions]   = useState<Companion[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState("");

  const isPriority    = priority === "Priority";
  const accentColor   = isPriority ? "#f97316" : "#2563eb";
  const accentBg      = isPriority ? "bg-orange-50" : "bg-blue-50";
  const accentText    = isPriority ? "text-orange-600" : "text-blue-600";
  const accentBorder  = isPriority ? "border-orange-200" : "border-blue-200";
  const btnCls        = isPriority ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-600 hover:bg-blue-700";

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.schema("visa").from("tripu_visa_type")
        .select("visa_type_id, visa_type").order("visa_type");
      if (data?.length) { setVisaTypes(data); setVisaTypeId(data[0].visa_type_id); }
    };
    fetch();
    setTimeout(() => firstInputRef.current?.focus(), 100);
  }, []);

  const addCompanion    = () => setCompanions(p => [...p, { full_name: "", passport_number: "" }]);
  const removeCompanion = (i: number) => setCompanions(p => p.filter((_, idx) => idx !== i));
  const updateCompanion = (i: number, f: keyof Companion, v: string) =>
    setCompanions(p => p.map((c, idx) => idx === i ? { ...c, [f]: v } : c));

  const handleSubmit = async () => {
    if (!mainName.trim()) { setError("Vui lòng nhập họ tên khách chính."); return; }
    if (!visaTypeId || !flightDate) { setError("Vui lòng chọn loại visa và ngày khởi hành."); return; }
    setError("");
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: { user } } = await supabase.auth.getUser();
      const staffId = user?.id ?? null;

      let finalCustomerId: string | null = null;
      if (mainPassport.trim()) {
        const { data } = await supabase.schema("visa").from("tripu_customer_identifiers")
          .select("customer_id").eq("identifier_value", mainPassport.trim())
          .eq("identifier_type", "passport").eq("is_deleted", false).maybeSingle();
        finalCustomerId = data?.customer_id ?? null;
      }
      if (!finalCustomerId) {
        const parts = mainName.trim().split(" ");
        const { data: newCust, error: e } = await supabase.schema("visa").from("tripu_customer")
          .insert({ customer_first_name: parts.slice(0, -1).join(" ") || mainName.trim(), customer_last_name: parts.at(-1) || "", create_by: staffId, updated_by: staffId })
          .select("customer_id").single();
        if (e || !newCust) throw new Error("Không thể tạo khách hàng.");
        finalCustomerId = newCust.customer_id;
        if (mainPassport.trim()) {
          await supabase.schema("visa").from("tripu_customer_identifiers").insert({
            customer_id: finalCustomerId, identifier_type: "passport",
            identifier_value: mainPassport.trim(), status: "active",
            created_by: staffId, updated_by: staffId,
          });
        }
      }

      const { data: group, error: gErr } = await supabase.schema("visa").from("tripu_visa_case_group")
        .insert({ group_rep_cus: finalCustomerId, case_group_priority: priority, created_by: staffId, updated_by: staffId })
        .select("case_group_id").single();
      if (gErr || !group) throw new Error("Không thể tạo nhóm hồ sơ.");
      const groupId = group.case_group_id;

      const { error: mErr } = await supabase.schema("visa").from("tripu_visa_case").insert({
        customer_id: finalCustomerId, case_group_id: groupId, visa_type: visaTypeId,
        flight_date: flightDate, destination_country: destination, receive_date: today,
        visa_order_id: 1, assigned_staff_id: staffId, created_by: staffId, updated_by: staffId,
      });
      if (mErr) throw new Error(mErr.message);

      for (const [idx, c] of companions.entries()) {
        if (!c.full_name.trim()) continue;
        let cid: string | null = null;
        if (c.passport_number.trim()) {
          const { data } = await supabase.schema("visa").from("tripu_customer_identifiers")
            .select("customer_id").eq("identifier_value", c.passport_number.trim())
            .eq("identifier_type", "passport").eq("is_deleted", false).maybeSingle();
          cid = data?.customer_id ?? null;
        }
        if (!cid) {
          const parts = c.full_name.trim().split(" ");
          const { data: nc } = await supabase.schema("visa").from("tripu_customer")
            .insert({ customer_first_name: parts.slice(0, -1).join(" ") || c.full_name.trim(), customer_last_name: parts.at(-1) || "", create_by: staffId, updated_by: staffId })
            .select("customer_id").single();
          if (!nc) continue;
          cid = nc.customer_id;
          if (c.passport_number.trim()) {
            await supabase.schema("visa").from("tripu_customer_identifiers").insert({
              customer_id: cid, identifier_type: "passport",
              identifier_value: c.passport_number.trim(), status: "active",
              created_by: staffId, updated_by: staffId,
            });
          }
        }
        await supabase.schema("visa").from("tripu_visa_case").insert({
          customer_id: cid, case_group_id: groupId, visa_type: visaTypeId,
          flight_date: flightDate, destination_country: destination, receive_date: today,
          visa_order_id: idx + 2, assigned_staff_id: staffId, created_by: staffId, updated_by: staffId,
        });
      }
      router.push("/dashboard/visa/list?tab=today");
    } catch (e: any) {
      setError(e.message ?? "Đã xảy ra lỗi.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const inputCls = `w-full h-full bg-transparent outline-none text-sm text-gray-800
    placeholder:text-gray-300 focus:bg-blue-50/60 rounded-sm px-1 transition-colors`;

  return (
    <div className="max-w-5xl" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tạo hồ sơ visa mới</h1>
        <p className="mt-1 text-xs text-gray-400">Tab để di chuyển · Enter để tạo hồ sơ</p>
      </div>

      {/* Card wrapper */}
      <div className="rounded-lg border border-gray-900 bg-white overflow-hidden">

        {/* ── Section: Thông tin chung ── */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-700 mb-3">Thông tin chung</p>
          <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100">
            {/* Loại visa */}
            <div className="col-span-1 p-3">
              <label className="block text-xs text-gray-400 mb-1.5">Loại visa</label>
              <select value={visaTypeId} onChange={e => setVisaTypeId(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-800 outline-none focus:text-blue-600 transition-colors cursor-pointer">
                {visaTypes.map(v => <option key={v.visa_type_id} value={v.visa_type_id}>{v.visa_type}</option>)}
              </select>
            </div>
            {/* Quốc gia */}
            <div className="col-span-1 p-3">
              <label className="block text-xs text-gray-400 mb-1.5">Quốc gia đến</label>
              <select value={destination} onChange={e => setDestination(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-800 outline-none focus:text-blue-600 transition-colors cursor-pointer">
                {COUNTRIES.map(c => <option key={c.name} value={c.name}>{c.name} 🇯🇵</option>)}
              </select>
            </div>
            {/* Ngày bay */}
            <div className="col-span-1 p-3">
              <label className="block text-xs text-gray-400 mb-1.5">Ngày khởi hành</label>
              <input type="date" value={flightDate} onChange={e => setFlightDate(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-800 outline-none focus:text-blue-600 transition-colors" />
            </div>
            {/* Priority toggle */}
            <div className="col-span-1 p-3">
              <label className="block text-xs text-gray-400 mb-1.5">Ưu tiên</label>
              <button
                type="button"
                onClick={() => setPriority(p => p === "Priority" ? "Standard" : "Priority")}
                className={`flex items-center gap-2 text-sm font-medium transition-all ${isPriority ? "text-orange-500" : "text-gray-400 hover:text-gray-600"}`}>
                <div className={`relative rounded-full transition-colors flex-shrink-0 ${isPriority ? "bg-orange-400" : "bg-gray-300"}`}
                  style={{ height: "18px", width: "32px" }}>
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${isPriority ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                {isPriority ? "⚡ Priority" : "Standard"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Section: Danh sách khách ── */}
        <div>
          <div className="px-5 pt-3 pb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-700">Danh sách khách</p>
          </div>

          {/* Table header */}
          <div className="grid text-[11px] font-semibold uppercase tracking-widest text-gray-400 border-b border-gray-100 px-5 py-2"
            style={{ gridTemplateColumns: "32px 1fr 160px 48px" }}>
            <span className="text-center">#</span>
            <span className="pl-2">Họ tên</span>
            <span>Số hộ chiếu</span>
            <span></span>
          </div>

          {/* Khách chính */}
          <div className={`grid items-center border-b border-gray-100 px-5 py-0 h-11 ${accentBg}`}
            style={{ gridTemplateColumns: "32px 1fr 160px 48px" }}>
            <span className={`text-center text-xs font-bold ${accentText}`}>1</span>
            <div className="pl-2 h-full flex items-center">
              <input ref={firstInputRef} type="text" value={mainName}
                onChange={e => setMainName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className={inputCls} />
            </div>
            <div className="h-full flex items-center">
              <input type="text" value={mainPassport}
                onChange={e => setMainPassport(e.target.value)}
                placeholder="A1234567"
                className={inputCls} />
            </div>
            <div className="flex justify-center">
              <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full
                ${isPriority ? "bg-orange-100 text-orange-500" : "bg-blue-100 text-blue-500"}`}>
                chính
              </span>
            </div>
          </div>

          {/* Khách đi kèm */}
          {companions.map((c, idx) => (
            <div key={idx} className="grid items-center border-b border-gray-100 px-5 py-0 h-11 hover:bg-gray-50 transition-colors group"
              style={{ gridTemplateColumns: "32px 1fr 160px 48px" }}>
              <span className="text-center text-xs text-gray-300">{idx + 2}</span>
              <div className="pl-2 h-full flex items-center">
                <input type="text" value={c.full_name}
                  onChange={e => updateCompanion(idx, "full_name", e.target.value)}
                  placeholder="Nguyễn Văn B"
                  className={inputCls} />
              </div>
              <div className="h-full flex items-center">
                <input type="text" value={c.passport_number}
                  onChange={e => updateCompanion(idx, "passport_number", e.target.value)}
                  placeholder="B7654321"
                  className={inputCls} />
              </div>
              <div className="flex justify-center">
                <button onClick={() => removeCompanion(idx)}
                  className="text-gray-200 hover:text-red-400 text-lg leading-none transition-colors opacity-0 group-hover:opacity-100">
                  ×
                </button>
              </div>
            </div>
          ))}

          {/* Thêm khách */}
          <button onClick={addCompanion}
            className={`w-full py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 border-t border-dashed
              ${isPriority
                ? "border-orange-200 text-orange-400 hover:text-orange-600 hover:bg-orange-50"
                : "border-blue-200 text-blue-400 hover:text-blue-600 hover:bg-blue-50"}`}>
            <span className="text-base leading-none">+</span>
            Thêm khách đi kèm
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button onClick={handleSubmit} disabled={submitting}
          className={`rounded-xl px-6 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-50 transition-colors ${btnCls}`}>
          {submitting ? "Đang lưu..." : "Tạo hồ sơ"}
        </button>
      </div>
    </div>
  );
}