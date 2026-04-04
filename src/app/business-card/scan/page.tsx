"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveCard, type BusinessCard } from "@/lib/business-card-store";

const TAGS = ["VIP", "잠재고객", "거래중", "파트너", "협력사", "기타"];

interface ScannedCard {
  name: string;
  company: string;
  title: string;
  department: string;
  phones: string[];
  emails: string[];
  address: string;
  website: string;
  sns: Record<string, string>;
  _imageData: string;
  _error?: string;
}

export default function ScanPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanned, setScanned] = useState<ScannedCard[]>([]);
  const [editIndex, setEditIndex] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async () => {
    if (files.length === 0) return;
    setError("");
    setLoading(true);
    setSaved(false);

    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/business-card/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "스캔 실패"); return; }
      setScanned(data.cards || []);
      setEditIndex(0);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  const current = scanned[editIndex];

  const updateField = (field: keyof ScannedCard, value: unknown) => {
    setScanned((prev) => {
      const next = [...prev];
      next[editIndex] = { ...next[editIndex], [field]: value };
      return next;
    });
  };

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleSave = () => {
    if (!current) return;
    const card: BusinessCard = {
      id: crypto.randomUUID(),
      imageData: current._imageData || "",
      name: current.name,
      company: current.company,
      title: current.title,
      department: current.department,
      phones: current.phones,
      emails: current.emails,
      address: current.address,
      website: current.website,
      sns: current.sns || {},
      tags,
      memo,
      lastContact: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    saveCard(card);

    if (editIndex < scanned.length - 1) {
      setEditIndex(editIndex + 1);
      setTags([]);
      setMemo("");
      setSaved(false);
    } else {
      setSaved(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">명함을 스캔하고 있어요...</h2>
          <p className="text-slate-500">AI가 명함에서 연락처 정보를 인식합니다</p>
        </div>
      </div>
    );
  }

  if (saved) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">저장 완료!</h2>
          <p className="text-slate-500 mb-6">{scanned.length}개 명함이 저장되었습니다.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/business-card" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800">거래처 목록 보기</Link>
            <button onClick={() => { setScanned([]); setFiles([]); setSaved(false); }} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">더 스캔하기</button>
          </div>
        </div>
      </div>
    );
  }

  // 결과 편집
  if (current) {
    return (
      <div className="flex flex-col flex-1 items-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <p className="text-sm text-slate-500 mb-4">
            명함 {editIndex + 1} / {scanned.length}
          </p>

          {current._imageData && (
            <img src={current._imageData} alt="명함" className="w-full max-h-48 object-contain rounded-xl border border-slate-200 mb-6 bg-slate-50" />
          )}

          {current._error && (
            <p className="text-red-500 text-sm mb-4">{current._error}</p>
          )}

          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">이름</label>
                <input value={current.name} onChange={(e) => updateField("name", e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">회사명</label>
                <input value={current.company} onChange={(e) => updateField("company", e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">직책</label>
                <input value={current.title} onChange={(e) => updateField("title", e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">부서</label>
                <input value={current.department} onChange={(e) => updateField("department", e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">전화번호</label>
              <input value={current.phones.join(", ")} onChange={(e) => updateField("phones", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="쉼표로 구분" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">이메일</label>
              <input value={current.emails.join(", ")} onChange={(e) => updateField("emails", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="쉼표로 구분" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">주소</label>
                <input value={current.address} onChange={(e) => updateField("address", e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1 block">웹사이트</label>
                <input value={current.website} onChange={(e) => updateField("website", e.target.value)} className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
              </div>
            </div>

            {/* 태그 */}
            <div>
              <label className="text-xs font-medium text-slate-500 mb-2 block">태그</label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map((t) => (
                  <button key={t} onClick={() => toggleTag(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tags.includes(t) ? "bg-blue-50 border border-blue-300 text-blue-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                    {tags.includes(t) ? "✓ " : ""}{t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">메모</label>
              <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
            </div>

            <button onClick={handleSave} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
              {editIndex < scanned.length - 1 ? `저장하고 다음 명함 (${editIndex + 2}/${scanned.length})` : "저장하기"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 업로드 화면
  return (
    <div className="flex flex-col flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/business-card" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 거래처 목록</Link>
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">명함 스캔</h1>
          <p className="text-lg text-slate-500">명함 사진을 업로드하면 AI가 연락처를 자동 인식합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          {files.length > 0 && (
            <div className="mb-3 space-y-2">
              {files.map((f, i) => (
                <div key={`${f.name}-${i}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-purple-500 text-sm font-bold px-2 py-0.5 rounded bg-purple-50">IMG</span>
                  <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 text-lg px-1">&times;</button>
                </div>
              ))}
            </div>
          )}

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const newFiles = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
              setFiles((prev) => [...prev, ...newFiles]);
            }}
            className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${files.length > 0 ? "p-6" : "p-12"} ${dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"}`}
          >
            <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]); e.target.value = ""; }} />
            {files.length > 0 ? (
              <p className="text-slate-500 text-sm">클릭하거나 드래그하여 추가</p>
            ) : (
              <>
                <div className="text-4xl mb-3">📷</div>
                <p className="text-slate-600 font-medium">명함 사진을 업로드하세요</p>
                <p className="text-slate-400 text-sm mt-1">JPG, PNG · 여러 장 가능</p>
              </>
            )}
          </div>

          {error && <p className="mt-4 text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleScan} disabled={files.length === 0} className="w-full mt-6 py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            스캔 시작
            <span className="text-sm bg-white/20 px-2 py-0.5 rounded">1 크레딧/장</span>
          </button>
        </div>
      </div>
    </div>
  );
}
