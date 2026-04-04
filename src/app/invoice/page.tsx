"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  saveInvoice,
  getSenderInfo,
  saveSenderInfo,
  type SenderInfo,
  type ClientInfo,
  type InvoiceItem,
  type InvoiceData,
} from "@/lib/invoice-store";

const DOC_TYPES = ["견적서", "인보이스", "발주서", "납품확인서"];
const PAY_TERMS = ["즉시", "7일", "14일", "30일", "협의"];

export default function InvoicePage() {
  const [docType, setDocType] = useState("견적서");
  const [sender, setSender] = useState<SenderInfo>({
    companyName: "", bizNumber: "", phone: "", email: "", address: "",
  });
  const [saveSenderChecked, setSaveSenderChecked] = useState(false);
  const [client, setClient] = useState<ClientInfo>({
    clientName: "", contactPerson: "", phone: "", email: "", address: "",
  });
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: "", quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [validUntil, setValidUntil] = useState("");
  const [payTerms, setPayTerms] = useState("30일");
  const [memo, setMemo] = useState("");
  const [aiGreeting, setAiGreeting] = useState(true);
  const [aiPayment, setAiPayment] = useState(true);
  const [aiClosing, setAiClosing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InvoiceData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getSenderInfo();
    if (saved) { setSender(saved); setSaveSenderChecked(true); }
  }, []);

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        item.amount = Number(item.quantity) * Number(item.unitPrice);
      }
      next[idx] = item;
      return next;
    });
  };

  const addItem = () =>
    setItems((prev) => [...prev, { name: "", quantity: 1, unitPrice: 0, amount: 0 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!sender.companyName.trim()) { setError("상호명을 입력해주세요."); return; }
    if (!client.clientName.trim()) { setError("고객사명을 입력해주세요."); return; }
    if (items.every((i) => !i.name.trim())) { setError("항목을 1개 이상 입력해주세요."); return; }

    if (saveSenderChecked) saveSenderInfo(sender);
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/invoice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType, sender, client, items, subtotal, tax, total, paymentTerms: payTerms, memo }),
      });
      const data = await res.json();

      const invoiceData: InvoiceData = {
        docType, sender, client,
        items: items.filter((i) => i.name.trim()),
        subtotal, tax, total,
        validUntil, paymentTerms: payTerms, memo,
        greeting: aiGreeting ? data.greeting || "" : "",
        paymentGuide: aiPayment ? data.payment_guide || "" : "",
        closing: aiClosing ? data.closing || "" : "",
      };

      setResult(invoiceData);

      saveInvoice({
        id: crypto.randomUUID(),
        type: docType,
        clientName: client.clientName,
        total,
        createdAt: new Date().toISOString(),
        data: invoiceData,
      });
    } catch {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">견적서를 생성하고 있어요...</h2>
          <p className="text-slate-500">AI가 전문적인 문구를 작성합니다</p>
        </div>
      </div>
    );
  }

  if (result) {
    return <ResultScreen data={result} onReset={() => setResult(null)} />;
  }

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 견적서/인보이스</h1>
          <p className="text-lg text-slate-500">전문적인 견적서를 자동으로 생성합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* 문서 종류 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">문서 종류</label>
            <div className="flex gap-2">
              {DOC_TYPES.map((t) => (
                <button key={t} onClick={() => setDocType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${docType === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* 발신자 */}
          <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium text-slate-700 px-2">내 정보 (발신)</legend>
            <input value={sender.companyName} onChange={(e) => setSender({ ...sender, companyName: e.target.value })} placeholder="상호명/이름 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={sender.bizNumber} onChange={(e) => setSender({ ...sender, bizNumber: e.target.value })} placeholder="사업자번호 (선택)" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={sender.phone} onChange={(e) => setSender({ ...sender, phone: e.target.value })} placeholder="연락처" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={sender.email} onChange={(e) => setSender({ ...sender, email: e.target.value })} placeholder="이메일" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={sender.address} onChange={(e) => setSender({ ...sender, address: e.target.value })} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input type="checkbox" checked={saveSenderChecked} onChange={(e) => setSaveSenderChecked(e.target.checked)} className="rounded" />
              내 정보 저장 (다음에 자동 입력)
            </label>
          </fieldset>

          {/* 수신자 */}
          <fieldset className="border border-slate-200 rounded-xl p-4 space-y-3">
            <legend className="text-sm font-medium text-slate-700 px-2">고객 정보 (수신)</legend>
            <input value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} placeholder="고객사명 *" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            <div className="grid grid-cols-2 gap-3">
              <input value={client.contactPerson} onChange={(e) => setClient({ ...client, contactPerson: e.target.value })} placeholder="담당자명" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="연락처" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} placeholder="이메일" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              <input value={client.address} onChange={(e) => setClient({ ...client, address: e.target.value })} placeholder="주소" className="p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
          </fieldset>

          {/* 항목 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">작업 항목</label>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input value={item.name} onChange={(e) => updateItem(idx, "name", e.target.value)} placeholder="항목명" className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input type="number" value={item.quantity || ""} onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))} placeholder="수량" className="w-16 p-2.5 border border-slate-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input type="number" value={item.unitPrice || ""} onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value))} placeholder="단가" className="w-28 p-2.5 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <span className="w-24 p-2.5 text-sm text-right text-slate-700 shrink-0">{item.amount.toLocaleString()}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-slate-400 hover:text-red-500 text-lg px-1">&times;</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ 항목 추가</button>
            <div className="mt-3 text-right text-sm space-y-1">
              <p className="text-slate-500">소계: {subtotal.toLocaleString()}원</p>
              <p className="text-slate-500">부가세(10%): {tax.toLocaleString()}원</p>
              <p className="text-lg font-bold text-slate-900">합계: {total.toLocaleString()}원</p>
            </div>
          </div>

          {/* 추가 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">유효기간</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">결제 조건</label>
              <div className="flex flex-wrap gap-1.5">
                {PAY_TERMS.map((t) => (
                  <button key={t} onClick={() => setPayTerms(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${payTerms === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{t}</button>
                ))}
              </div>
            </div>
          </div>

          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특이사항/메모" className="w-full h-20 p-3 border border-slate-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-slate-400" />

          {/* AI 옵션 */}
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={aiGreeting} onChange={(e) => setAiGreeting(e.target.checked)} className="rounded" />인사말 자동 생성</label>
            <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={aiPayment} onChange={(e) => setAiPayment(e.target.checked)} className="rounded" />결제 안내 자동 생성</label>
            <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" checked={aiClosing} onChange={(e) => setAiClosing(e.target.checked)} className="rounded" />서명 문구 자동 생성</label>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={!sender.companyName.trim() || !client.clientName.trim()} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            견적서 생성하기
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">2 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 결과 화면 ──

function ResultScreen({ data, onReset }: { data: InvoiceData; onReset: () => void }) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const download = async (endpoint: string, filename: string, setLoading: (b: boolean) => void) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">{data.docType} 미리보기</h1>
          <div className="flex gap-2">
            <Link href="/invoice/history" className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">이력 보기</Link>
            <button onClick={onReset} className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">새로 만들기</button>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-6">{data.docType}</h2>

          <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
            <div>
              <p className="text-blue-600 font-medium mb-1">발신</p>
              <p className="font-semibold">{data.sender.companyName}</p>
              {data.sender.bizNumber && <p className="text-slate-500">{data.sender.bizNumber}</p>}
              <p className="text-slate-500">{data.sender.phone}</p>
              <p className="text-slate-500">{data.sender.email}</p>
            </div>
            <div>
              <p className="text-blue-600 font-medium mb-1">수신</p>
              <p className="font-semibold">{data.client.clientName}</p>
              {data.client.contactPerson && <p className="text-slate-500">{data.client.contactPerson}</p>}
              <p className="text-slate-500">{data.client.phone}</p>
              <p className="text-slate-500">{data.client.email}</p>
            </div>
          </div>

          {data.greeting && <p className="text-sm text-slate-600 mb-4 italic">{data.greeting}</p>}

          {/* 테이블 */}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left p-2.5 font-medium text-slate-700">품목</th>
                <th className="text-center p-2.5 font-medium text-slate-700 w-16">수량</th>
                <th className="text-right p-2.5 font-medium text-slate-700 w-28">단가</th>
                <th className="text-right p-2.5 font-medium text-slate-700 w-28">금액</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="p-2.5">{item.name}</td>
                  <td className="p-2.5 text-center">{item.quantity}</td>
                  <td className="p-2.5 text-right">{item.unitPrice.toLocaleString()}원</td>
                  <td className="p-2.5 text-right">{item.amount.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="text-right text-sm space-y-1 mb-6">
            <p className="text-slate-500">소계: {data.subtotal.toLocaleString()}원</p>
            <p className="text-slate-500">부가세(10%): {data.tax.toLocaleString()}원</p>
            <p className="text-xl font-bold text-slate-900">합계: {data.total.toLocaleString()}원</p>
          </div>

          {data.paymentGuide && <p className="text-sm text-slate-600 mb-2">{data.paymentGuide}</p>}
          {data.closing && <p className="text-sm text-slate-600 mb-4">{data.closing}</p>}

          <p className="text-right text-sm font-medium text-slate-900">{data.sender.companyName} <span className="text-blue-600">(인)</span></p>
        </div>

        {/* 다운로드 */}
        <div className="flex gap-3 mt-6">
          <button onClick={() => download("/api/invoice/download-pdf", `${data.docType}.pdf`, setDownloadingPdf)} disabled={downloadingPdf} className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2">
            {downloadingPdf ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</> : <>PDF 다운로드<span className="text-xs bg-white/20 px-2 py-0.5 rounded">2 크레딧</span></>}
          </button>
          <button onClick={() => download("/api/invoice/download-word", `${data.docType}.docx`, setDownloadingWord)} disabled={downloadingWord} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center gap-2">
            {downloadingWord ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</> : <>Word 다운로드<span className="text-xs bg-white/20 px-2 py-0.5 rounded">1 크레딧</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}
