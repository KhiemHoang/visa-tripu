"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/app/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

type VisaCase = {
  visa_case_id: string;
  case_group_id: string;
  flight_date: string;
  receive_date: string;
  ops_transfer_date: string | null;
  updated_at: string;
  destination_country: string;
  case_group_priority: string;
  customer_name: string;
  passport_number: string | null;
  visa_type_label: string | null;
  visa_type_id: string | null;
  status_id: string | null;
  status_label: string | null;
  status_order: number;
  visa_order_id: number;
  days_until_flight: number;
  unresolved_notes: number;
};

type Note = {
  visa_case_note_id: string;
  note: string;
  is_resolved: boolean;
  created_at: string;
};

type VisaStatus = { visa_status_id: string; status: string; status_order: number };
type VisaType   = { visa_type_id: string; visa_type: string };
type Tab = "all" | "today";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",   label: "Toàn bộ"       },
  { key: "today", label: "Hồ sơ hôm nay" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function VisaListPage() {
  const supabase     = createClient();
  const searchParams = useSearchParams();
  const initialTab   = (searchParams.get("tab") as Tab) ?? "all";

  const [tab,          setTab]          = useState<Tab>(initialTab);
  const [statuses,     setStatuses]     = useState<VisaStatus[]>([]);
  const [visaTypes,    setVisaTypes]    = useState<VisaType[]>([]);
  const [allCases,     setAllCases]     = useState<VisaCase[]>([]);
  const [sentToday,    setSentToday]    = useState<VisaCase[]>([]);
  const [pendingCases, setPendingCases] = useState<VisaCase[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [groupConfirm,   setGroupConfirm]   = useState<{ caseId: string; groupId: string; newStatusId: string } | null>(null);
  const [copied,       setCopied]       = useState(false);

  // Note panel
  const [selectedCase, setSelectedCase] = useState<VisaCase | null>(null);
  const [notes,        setNotes]        = useState<Note[]>([]);
  const [noteInput,    setNoteInput]    = useState("");
  const [notesLoading, setNotesLoading] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

  // Filters (all tab)
  const currentYear = new Date().getFullYear();
  const [dateFrom,       setDateFrom]       = useState(`${currentYear}-01-01`);
  const [dateTo,         setDateTo]         = useState(`${currentYear}-12-31`);
  const [filterStatus,   setFilterStatus]   = useState("");
  const [filterVisaType, setFilterVisaType] = useState("");
  const [filterPriority, setFilterPriority] = useState("");

  useEffect(() => { fetchLookups(); }, []);
  useEffect(() => { fetchCases(); }, [tab, dateFrom, dateTo, filterStatus, filterVisaType, filterPriority, statuses]);
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [notes]);

  // ── Lookups ───────────────────────────────────────────────────────────────

  const fetchLookups = async () => {
    const { data: st } = await supabase.schema("visa").from("tripu_visa_status")
      .select("visa_status_id, status, status_order").order("status_order");
    if (st) setStatuses(st);
    const { data: vt } = await supabase.schema("visa").from("tripu_visa_type")
      .select("visa_type_id, visa_type").order("visa_type");
    if (vt) setVisaTypes(vt);
  };

  // ── Build + sort ──────────────────────────────────────────────────────────

  const buildCases = (data: any[], passportMap: Record<string, string>, noteCountMap: Record<string, number>): VisaCase[] => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    return data.map(d => ({
      visa_case_id:        d.visa_case_id,
      case_group_id:       d.case_group_id,
      flight_date:         d.flight_date,
      receive_date:        d.receive_date,
      ops_transfer_date:   d.ops_transfer_date,
      updated_at:          d.updated_at,
      destination_country: d.destination_country,
      case_group_priority: d.tripu_visa_case_group?.case_group_priority ?? "Standard",
      customer_name:       `${d.tripu_customer.customer_first_name} ${d.tripu_customer.customer_last_name}`,
      passport_number:     passportMap[d.customer_id] ?? null,
      visa_type_label:     d.tripu_visa_type?.visa_type ?? null,
      visa_type_id:        d.visa_type ?? null,
      status_id:           d.status_id ?? null,
      status_label:        d.tripu_visa_status?.status ?? null,
      status_order:        d.tripu_visa_status?.status_order ?? 99,
      visa_order_id:       d.visa_order_id ?? 0,
      days_until_flight:   d.flight_date
        ? Math.ceil((new Date(d.flight_date).setHours(0,0,0,0) - todayMs) / 86400000)
        : 999,
      unresolved_notes:    noteCountMap[d.visa_case_id] ?? 0,
    }));
  };

  const sortCases = (arr: VisaCase[]) => {
    const groupScore: Record<string, { isPriority: boolean; daysUntilFlight: number; statusOrder: number; receiveDate: string }> = {};
    arr.forEach(c => {
      if (!groupScore[c.case_group_id] || c.visa_order_id === 1) {
        groupScore[c.case_group_id] = {
          isPriority:      c.case_group_priority === "Priority",
          daysUntilFlight: c.days_until_flight,
          statusOrder:     c.status_order,
          receiveDate:     c.receive_date,
        };
      }
    });
    return [...arr].sort((a, b) => {
      const ga = groupScore[a.case_group_id];
      const gb = groupScore[b.case_group_id];
      if (ga.isPriority !== gb.isPriority) return ga.isPriority ? -1 : 1;
      if (a.case_group_id === b.case_group_id) return a.visa_order_id - b.visa_order_id;
      if (ga.daysUntilFlight !== gb.daysUntilFlight) return ga.daysUntilFlight - gb.daysUntilFlight;
      if (ga.statusOrder !== gb.statusOrder) return ga.statusOrder - gb.statusOrder;
      if (ga.receiveDate !== gb.receiveDate) return ga.receiveDate < gb.receiveDate ? -1 : 1;
      return 0;
    });
  };

  const fetchPassports = async (ids: string[]) => {
    const { data } = await supabase.schema("visa").from("tripu_customer_identifiers")
      .select("customer_id, identifier_value").in("customer_id", ids)
      .eq("identifier_type", "passport").eq("is_deleted", false);
    const map: Record<string, string> = {};
    (data ?? []).forEach((i: any) => { map[i.customer_id] = i.identifier_value; });
    return map;
  };

  const fetchNotesCounts = async (caseIds: string[]) => {
    const { data } = await supabase.schema("visa").from("tripu_visa_case_note")
      .select("visa_case_id").in("visa_case_id", caseIds).eq("is_resolved", false);
    const map: Record<string, number> = {};
    (data ?? []).forEach((n: any) => { map[n.visa_case_id] = (map[n.visa_case_id] ?? 0) + 1; });
    return map;
  };

  // ── Fetch cases ───────────────────────────────────────────────────────────

  const fetchCases = useCallback(async () => {
    if (!statuses.length) return;
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const BASE_SELECT = `
      visa_case_id, case_group_id, customer_id, flight_date, receive_date,
      ops_transfer_date, updated_at, destination_country, status_id, visa_order_id, visa_type,
      tripu_customer!inner(customer_first_name, customer_last_name),
      tripu_visa_type(visa_type),
      tripu_visa_status(status, status_order),
      tripu_visa_case_group(case_group_priority)
    `;

    if (tab === "all") {
      let q = supabase.schema("visa").from("tripu_visa_case").select(BASE_SELECT).eq("is_deleted", false);
      if (dateFrom)       q = q.gte("receive_date", dateFrom);
      if (dateTo)         q = q.lte("receive_date", dateTo);
      if (filterStatus)   q = q.eq("status_id", filterStatus);
      if (filterVisaType) q = q.eq("visa_type", filterVisaType);
      if (filterPriority) q = q.eq("tripu_visa_case_group.case_group_priority", filterPriority);
      const { data } = await q;
      if (data) {
        const pm = await fetchPassports([...new Set(data.map((d: any) => d.customer_id))]);
        const nm = await fetchNotesCounts(data.map((d: any) => d.visa_case_id));
        setAllCases(sortCases(buildCases(data, pm, nm)));
      }
    } else if (tab === "today") {
      const excludeIds = statuses
        .filter(s => ["Đã gửi PĐH", "Huỷ hồ sơ", "Đã gửi Lãnh sự", "Hoàn tất"].includes(s.status))
        .map(s => s.visa_status_id);
      const sentOpsId = statuses.find(s => s.status === "Đã gửi PĐH")?.visa_status_id;

      const { data } = await supabase.schema("visa").from("tripu_visa_case")
        .select(BASE_SELECT).eq("is_deleted", false)
        .or(`receive_date.eq.${today},${excludeIds.length ? `status_id.not.in.(${excludeIds.join(",")})` : "id.not.is.null"}`);

      if (data) {
        const pm = await fetchPassports([...new Set(data.map((d: any) => d.customer_id))]);
        const nm = await fetchNotesCounts(data.map((d: any) => d.visa_case_id));
        const built = buildCases(data, pm, nm);
        const sent    = built.filter(c => c.status_id === sentOpsId && c.updated_at?.startsWith(today));
        const pending = built.filter(c => !sent.find(s => s.visa_case_id === c.visa_case_id));
        setSentToday(sortCases(sent));
        setPendingCases(sortCases(pending));
      }
    }
    setLoading(false);
  }, [tab, dateFrom, dateTo, filterStatus, filterVisaType, filterPriority, statuses]);

  // ── Status change ─────────────────────────────────────────────────────────

  const handleStatusChange = async (c: VisaCase, newStatusId: string) => {
    if (c.visa_order_id === 1) { setGroupConfirm({ caseId: c.visa_case_id, groupId: c.case_group_id, newStatusId }); return; }
    await applyStatusChange(c.visa_case_id, null, newStatusId);
  };

  const applyStatusChange = async (caseId: string, groupId: string | null, newStatusId: string) => {
    setChangingStatus(caseId);
    if (groupId) {
      await supabase.schema("visa").from("tripu_visa_case").update({ status_id: newStatusId }).eq("case_group_id", groupId);
    } else {
      await supabase.schema("visa").from("tripu_visa_case").update({ status_id: newStatusId }).eq("visa_case_id", caseId);
    }
    setGroupConfirm(null);
    setChangingStatus(null);
    fetchCases();
  };

  // ── Notes ─────────────────────────────────────────────────────────────────

  const openNotePanel = async (c: VisaCase) => {
    setSelectedCase(c);
    setNotesLoading(true);
    const { data } = await supabase.schema("visa").from("tripu_visa_case_note")
      .select("visa_case_note_id, note, is_resolved, created_at")
      .eq("visa_case_id", c.visa_case_id)
      .order("created_at", { ascending: true });
    setNotes(data ?? []);
    setNotesLoading(false);
  };

  const handleAddNote = async () => {
    if (!noteInput.trim() || !selectedCase) return;
    setSubmittingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.schema("visa").from("tripu_visa_case_note")
      .insert({ visa_case_id: selectedCase.visa_case_id, note: noteInput.trim(), is_resolved: false, created_by: user?.id })
      .select("visa_case_note_id, note, is_resolved, created_at").single();
    if (data) setNotes(p => [...p, data]);
    setNoteInput("");
    setSubmittingNote(false);
    fetchCases(); // refresh note count
  };

  const handleResolveNote = async (noteId: string) => {
    await supabase.schema("visa").from("tripu_visa_case_note")
      .update({ is_resolved: true }).eq("visa_case_note_id", noteId);
    setNotes(p => p.map(n => n.visa_case_note_id === noteId ? { ...n, is_resolved: true } : n));
    fetchCases();
  };

  // ── Copy ──────────────────────────────────────────────────────────────────

  const copyToClipboard = (rows: VisaCase[]) => {
    const headers = ["#", "Khách hàng", "Hộ chiếu", "Loại visa", "Quốc gia", "Ngày bay", "Còn lại", "Ngày nhận", "Chuyển PĐH", "Trạng thái"];
    const lines = [
      headers.join("\t"),
      ...rows.map(c => [
        c.visa_order_id,
        c.customer_name,
        c.passport_number ?? "",
        c.visa_type_label ?? "",
        c.destination_country ?? "",
        c.flight_date ? new Date(c.flight_date).toLocaleDateString("vi-VN") : "",
        c.days_until_flight === 999 ? "" : c.days_until_flight < 0 ? "Đã bay" : `${c.days_until_flight} ngày`,
        c.receive_date ? new Date(c.receive_date).toLocaleDateString("vi-VN") : "",
        c.ops_transfer_date ? new Date(c.ops_transfer_date).toLocaleDateString("vi-VN") : "",
        c.status_label ?? "",
      ].join("\t"))
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const totalCount = tab === "today" ? sentToday.length + pendingCases.length : allCases.length;

  return (
    <div className="flex gap-4 h-full">
      {/* Main content */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all ${selectedCase ? "max-w-[calc(100%-360px)]" : ""}`}>
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Danh sách hồ sơ</h1>
            <p className="mt-0.5 text-sm text-gray-500">{totalCount} hồ sơ</p>
          </div>
          <div className="flex items-center gap-2">
            {tab === "today" && (
              <button onClick={() => copyToClipboard(sentToday)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                {copied ? "✓ Đã copy" : "📋 Copy Excel"}
              </button>
            )}
            <a href="/dashboard/visa/new"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              + Tạo hồ sơ mới
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        {tab === "all" && (
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 whitespace-nowrap">Ngày nhận:</span>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              <span className="text-gray-400">—</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500">
              <option value="">Tất cả độ ưu tiên</option>
              <option value="Priority">⚡ Priority</option>
              <option value="Standard">Standard</option>
            </select>
            <select value={filterVisaType} onChange={e => setFilterVisaType(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500">
              <option value="">Tất cả loại visa</option>
              {visaTypes.map(v => <option key={v.visa_type_id} value={v.visa_type_id}>{v.visa_type}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-500">
              <option value="">Tất cả trạng thái</option>
              {statuses.map(s => <option key={s.visa_status_id} value={s.visa_status_id}>{s.status}</option>)}
            </select>
            {(filterStatus || filterVisaType || filterPriority) && (
              <button onClick={() => { setFilterStatus(""); setFilterVisaType(""); setFilterPriority(""); }}
                className="text-sm text-gray-400 hover:text-gray-600">✕ Xoá</button>
            )}
          </div>
        )}

        {/* Tables */}
        {loading ? (
          <p className="text-sm text-gray-400 py-6">Đang tải...</p>
        ) : tab === "today" ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                Đã chuyển PĐH hôm nay ({sentToday.length})
              </p>
              {sentToday.length === 0
                ? <p className="text-sm text-gray-400 px-2">Chưa có hồ sơ nào được chuyển hôm nay.</p>
                : <CaseTable cases={sentToday} statuses={statuses} changingStatus={changingStatus}
                    selectedId={selectedCase?.visa_case_id ?? null}
                    onStatusChange={handleStatusChange} onRowClick={openNotePanel} />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                Chưa xử lý xong ({pendingCases.length})
              </p>
              {pendingCases.length === 0
                ? <p className="text-sm text-gray-400 px-2">Không có hồ sơ nào.</p>
                : <CaseTable cases={pendingCases} statuses={statuses} changingStatus={changingStatus}
                    selectedId={selectedCase?.visa_case_id ?? null}
                    onStatusChange={handleStatusChange} onRowClick={openNotePanel} />}
            </div>
          </div>
        ) : (
          allCases.length === 0
            ? <p className="text-sm text-gray-400 py-6">Không có hồ sơ nào.</p>
            : <CaseTable cases={allCases} statuses={statuses} changingStatus={changingStatus}
                selectedId={selectedCase?.visa_case_id ?? null}
                onStatusChange={handleStatusChange} onRowClick={openNotePanel} />
        )}
      </div>

      {/* Note Panel */}
      {selectedCase && (
        <div className="w-[340px] flex-shrink-0 rounded-xl border border-gray-200 bg-white flex flex-col h-[calc(100vh-120px)] sticky top-4">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedCase.customer_name}</p>
              <p className="text-xs text-gray-400">{selectedCase.passport_number ?? "—"}</p>
            </div>
            <button onClick={() => setSelectedCase(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
            {notesLoading ? (
              <p className="text-sm text-gray-400">Đang tải...</p>
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center mt-4">Chưa có ghi chú nào.</p>
            ) : (
              notes.map(n => (
                <div key={n.visa_case_note_id}
                  className={`rounded-lg px-3 py-2 text-sm ${n.is_resolved ? "bg-gray-50 opacity-60" : "bg-blue-50"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`flex-1 ${n.is_resolved ? "line-through text-gray-400" : "text-gray-800"}`}>
                      {n.note}
                    </p>
                    {!n.is_resolved && (
                      <button onClick={() => handleResolveNote(n.visa_case_note_id)}
                        title="Đánh dấu đã xử lý"
                        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-blue-400 hover:bg-blue-400 hover:border-blue-400 transition-colors flex items-center justify-center">
                        <span className="text-white text-xs leading-none">✓</span>
                      </button>
                    )}
                    {n.is_resolved && (
                      <span className="text-green-500 text-xs flex-shrink-0 mt-0.5">✓</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
              ))
            )}
            <div ref={notesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-200">
            <div className="flex gap-2 items-end">
              <textarea
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                placeholder="Nhập ghi chú, Enter để gửi..."
                rows={2}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <button onClick={handleAddNote} disabled={!noteInput.trim() || submittingNote}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 h-fit">
                Gửi
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Enter để gửi · Shift+Enter xuống dòng</p>
          </div>
        </div>
      )}

      {/* Group confirm */}
      {groupConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Cập nhật trạng thái nhóm</h3>
            <p className="text-sm text-gray-600 mb-5">
              Đây là khách chính. Bạn muốn áp dụng cho{" "}
              <span className="font-medium text-gray-900">toàn bộ nhóm</span> hay chỉ khách này?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setGroupConfirm(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Huỷ</button>
              <button onClick={() => applyStatusChange(groupConfirm.caseId, null, groupConfirm.newStatusId)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">Chỉ khách này</button>
              <button onClick={() => applyStatusChange(groupConfirm.caseId, groupConfirm.groupId, groupConfirm.newStatusId)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Toàn bộ nhóm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

function CaseTable({ cases, statuses, changingStatus, selectedId, onStatusChange, onRowClick }: {
  cases: VisaCase[];
  statuses: VisaStatus[];
  changingStatus: string | null;
  selectedId: string | null;
  onStatusChange: (c: VisaCase, statusId: string) => void;
  onRowClick: (c: VisaCase) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400 w-8">#</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Khách hàng</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Loại visa</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Ngày bay</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Còn lại</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Ngày nhận</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Chuyển PĐH</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Ghi chú</th>
            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cases.map(c => {
            const urgent   = c.days_until_flight <= 10 && c.days_until_flight >= 0;
            const isSelected = c.visa_case_id === selectedId;
            return (
              <tr key={c.visa_case_id} onClick={() => onRowClick(c)}
                className={`cursor-pointer transition-colors ${
                  isSelected ? "bg-blue-50" : urgent ? "bg-orange-50 hover:bg-orange-100" : "hover:bg-gray-50"
                }`}>
                <td className="px-3 py-3 text-center">
                  <span className={`text-xs font-bold ${c.visa_order_id === 1 ? "text-blue-600" : "text-gray-400"}`}>
                    {c.visa_order_id || "—"}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {c.case_group_priority === "Priority" && <span className="text-orange-500 text-xs">⚡</span>}
                    <div>
                      <p className="font-medium text-gray-900">{c.customer_name}</p>
                      {c.passport_number && <p className="text-xs text-gray-400">{c.passport_number}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-600 text-xs">{c.visa_type_label ?? "—"}</td>
                <td className="px-3 py-3 text-gray-600 text-xs">
                  {c.flight_date ? new Date(c.flight_date).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-3"><CountdownBadge days={c.days_until_flight} /></td>
                <td className="px-3 py-3 text-gray-600 text-xs">
                  {c.receive_date ? new Date(c.receive_date).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td className="px-3 py-3 text-gray-600 text-xs">
                  {c.ops_transfer_date ? new Date(c.ops_transfer_date).toLocaleDateString("vi-VN") : "—"}
                </td>
                {/* Note column */}
                <td className="px-3 py-3" onClick={e => { e.stopPropagation(); onRowClick(c); }}>
                  {c.unresolved_notes > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                      💬 {c.unresolved_notes}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">💬</span>
                  )}
                </td>
                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                  {changingStatus === c.visa_case_id ? (
                    <span className="text-xs text-gray-400">Đang lưu...</span>
                  ) : (
                    <select value={c.status_id ?? ""}
                      onChange={e => onStatusChange(c, e.target.value)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 outline-none cursor-pointer ${statusColor(c.status_label)}`}>
                      {statuses.map(s => (
                        <option key={s.visa_status_id} value={s.visa_status_id}>{s.status}</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CountdownBadge({ days }: { days: number }) {
  if (days === 999) return <span className="text-gray-400 text-xs">—</span>;
  if (days < 0)    return <span className="text-xs text-gray-400">Đã bay</span>;
  const cls = days <= 3 ? "text-red-600 font-bold" : days <= 10 ? "text-orange-500 font-semibold" : "text-gray-600";
  return <span className={`text-xs ${cls}`}>{days} ngày</span>;
}

function statusColor(label: string | null): string {
  const map: Record<string, string> = {
    "Chờ bổ sung hồ sơ": "bg-yellow-100 text-yellow-700",
    "Đang xử lý":        "bg-blue-100 text-blue-700",
    "Đã gửi PĐH":        "bg-purple-100 text-purple-700",
    "Đã gửi Lãnh sự":    "bg-indigo-100 text-indigo-700",
    "Hoàn tất":          "bg-green-100 text-green-700",
    "Huỷ hồ sơ":         "bg-red-100 text-red-700",
  };
  return map[label ?? ""] ?? "bg-gray-100 text-gray-600";
}