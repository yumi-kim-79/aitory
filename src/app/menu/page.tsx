"use client";

import { useState } from "react";
import Link from "next/link";

const PLATFORMS = ["배달의민족", "쿠팡이츠", "카카오채널", "인쇄용"];
const MOODS = ["모던", "전통", "캐주얼", "고급"];

interface MenuItem { name: string; price: string; desc: string }
interface PlatformResult { platform: string; menus: { name: string; price: string; description: string }[] }
interface MenuResult { platforms: PlatformResult[] }

export default function MenuPage() {
  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [items, setItems] = useState<MenuItem[]>([{ name: "", price: "", desc: "" }]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["배달의민족"]);
  const [mood, setMood] = useState("캐주얼");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MenuResult | null>(null);
  const [error, setError] = useState("");

  const addItem = () => setItems((p) => [...p, { name: "", price: "", desc: "" }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, j) => j !== i));
  const updateItem = (i: number, field: keyof MenuItem, value: string) =>
    setItems((p) => { const n = [...p]; n[i] = { ...n[i], [field]: value }; return n; });
  const togglePlatform = (p: string) =>
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);

  const handleSubmit = async () => {
    if (!storeName.trim()) { setError("가게명을 입력해주세요."); return; }
    if (items.every((i) => !i.name.trim())) { setError("메뉴를 1개 이상 입력해주세요."); return; }
    if (selectedPlatforms.length === 0) { setError("플랫폼을 1개 이상 선택해주세요."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const res = await fetch("/api/menu/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeName, storeDesc, items: items.filter((i) => i.name), platforms: selectedPlatforms, mood }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "생성 실패");
      else setResult(data);
    } catch { setError("서버 연결 실패"); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex flex-col flex-1 items-center justify-center px-4">
      <div className="text-center">
        <div className="inline-block w-16 h-16 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">메뉴판을 생성하고 있어요...</h2>
        <p className="text-slate-500">AI가 매력적인 메뉴 설명을 작성합니다</p>
      </div>
    </div>
  );

  if (result) return <ResultScreen result={result} onReset={() => setResult(null)} />;

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">AI 식당 메뉴판</h1>
          <p className="text-lg text-slate-500">메뉴 정보를 입력하면 매력적인 메뉴판을 자동 생성합니다</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">가게명 *</label><input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="예: 맛있는 치킨집" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">가게 소개</label><input value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} placeholder="예: 30년 전통 숯불치킨" className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" /></div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">메뉴 항목</label>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <input value={item.name} onChange={(e) => updateItem(i, "name", e.target.value)} placeholder="메뉴명 *" className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input value={item.price} onChange={(e) => updateItem(i, "price", e.target.value)} placeholder="가격" className="w-24 p-2.5 border border-slate-300 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  <input value={item.desc} onChange={(e) => updateItem(i, "desc", e.target.value)} placeholder="간단 설명" className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400" />
                  {items.length > 1 && <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-red-500 px-1 text-lg">&times;</button>}
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">+ 메뉴 추가</button>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">출력 플랫폼</p>
            <div className="flex flex-wrap gap-2">{PLATFORMS.map((p) => (
              <button key={p} onClick={() => togglePlatform(p)} className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${selectedPlatforms.includes(p) ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"}`}>{selectedPlatforms.includes(p) ? "✓ " : ""}{p}</button>
            ))}</div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">분위기/톤</p>
            <div className="flex gap-2">{MOODS.map((m) => (
              <button key={m} onClick={() => setMood(m)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mood === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{m}</button>
            ))}</div>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button onClick={handleSubmit} disabled={!storeName.trim() || items.every((i) => !i.name.trim()) || selectedPlatforms.length === 0} className="w-full py-4 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            메뉴판 생성하기<span className="text-sm bg-white/20 px-2 py-0.5 rounded">3 크레딧</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultScreen({ result, onReset }: { result: MenuResult; onReset: () => void }) {
  const [activeTab, setActiveTab] = useState(result.platforms[0]?.platform || "");
  const [copied, setCopied] = useState(false);
  const active = result.platforms.find((p) => p.platform === activeTab);

  const handleCopyAll = async () => {
    if (!active) return;
    const text = active.menus.map((m) => `${m.name} ${m.price}\n${m.description}`).join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">메뉴판 결과</h1>
          <button onClick={onReset} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200">다시 생성</button>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto">{result.platforms.map((p) => (
          <button key={p.platform} onClick={() => setActiveTab(p.platform)} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${activeTab === p.platform ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{p.platform}</button>
        ))}</div>

        {active && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
            <div className="flex justify-end mb-4">
              <button onClick={handleCopyAll} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200">{copied ? "전체 복사됨!" : "전체 복사"}</button>
            </div>
            <div className="divide-y divide-slate-100">
              {active.menus.map((m, i) => (
                <div key={i} className="py-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900">{m.name}</span>
                    <span className="text-slate-600 font-medium">{m.price}</span>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed">{m.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
