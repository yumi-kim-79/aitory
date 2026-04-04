"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getInvoices, deleteInvoice, type SavedInvoice } from "@/lib/invoice-store";

export default function InvoiceHistoryPage() {
  const [invoices, setInvoices] = useState<SavedInvoice[]>([]);

  useEffect(() => {
    setInvoices(getInvoices());
  }, []);

  const handleDelete = (id: string) => {
    deleteInvoice(id);
    setInvoices(getInvoices());
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/invoice" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 견적서 만들기</Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">견적서 이력</h1>

        {invoices.length === 0 ? (
          <p className="text-center text-slate-400 py-12">생성한 견적서가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{inv.type}</span>
                    <span className="font-medium text-slate-900 truncate">{inv.clientName}</span>
                  </div>
                  <p className="text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString("ko-KR")}</p>
                </div>
                <p className="font-semibold text-slate-900 shrink-0">{inv.total.toLocaleString()}원</p>
                <button onClick={() => handleDelete(inv.id)} className="text-slate-400 hover:text-red-500 text-sm px-2">삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
