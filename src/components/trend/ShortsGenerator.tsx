"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface PublishedItem {
  id: string;
  keyword: string;
  category: string;
  kbuzzTitle: string;
  kbuzzUrl: string;
  kbuzzPublishedAt: string;
  metaDesc?: string;
}

type ShortsTab = "script" | "description" | "hashtags";

function extractSection(text: string, tag: string): string {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[/${tag}\\]`);
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

function formatDate(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function ShortsGenerator() {
  const { getIdToken } = useAuth();
  const [items, setItems] = useState<PublishedItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [streamError, setStreamError] = useState("");
  const [activeTab, setActiveTab] = useState<ShortsTab>("script");
  const [copiedTab, setCopiedTab] = useState<ShortsTab | null>(null);

  const fetchList = useCallback(async () => {
    setLoadingList(true); setListError("");
    try {
      const token = await getIdToken();
      if (!token) { setListError("로그인이 필요합니다."); return; }
      const res = await fetch("/api/trend/published-list", { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setListError(data.error || `HTTP ${res.status}`); return; }
      setItems(data.items || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "목록 조회 실패");
    } finally {
      setLoadingList(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const generateShorts = async (item: PublishedItem) => {
    setSelectedId(item.id);
    setStreamText("");
    setStreamError("");
    setActiveTab("script");
    setStreaming(true);
    try {
      const token = await getIdToken();
      if (!token) { setStreamError("로그인이 필요합니다."); setStreaming(false); return; }
      const res = await fetch("/api/trend/shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: item.kbuzzTitle,
          kbuzzUrl: item.kbuzzUrl,
          keyword: item.keyword,
          category: item.category,
          metaDesc: item.metaDesc,
        }),
      });
      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "");
        setStreamError(`생성 실패: ${res.status} ${errText.slice(0, 200)}`);
        setStreaming(false);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setStreamText(acc);
      }
    } catch (e) {
      setStreamError(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setStreaming(false);
    }
  };

  const copyToClipboard = async (tab: ShortsTab, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTab(tab);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch {}
  };

  const scriptText = extractSection(streamText, "SCRIPT");
  const descriptionText = extractSection(streamText, "DESCRIPTION");
  const hashtagsText = extractSection(streamText, "HASHTAGS");

  const tabContent: Record<ShortsTab, string> = {
    script: scriptText,
    description: descriptionText,
    hashtags: hashtagsText,
  };
  const tabLabels: Record<ShortsTab, string> = {
    script: "📝 스크립트",
    description: "📄 설명문",
    hashtags: "#️⃣ 해시태그",
  };

  return (
    <div className="mt-8 mb-8">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 sm:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">🎬 Shorts 콘텐츠 생성</h2>
          <button
            onClick={fetchList}
            disabled={loadingList}
            className="text-xs px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50"
          >
            {loadingList ? "조회 중..." : "🔄 새로고침"}
          </button>
        </div>
        <p className="text-sm text-slate-600 mb-4">발행된 Kbuzz 글에서 선택해 YouTube Shorts 콘텐츠(스크립트/설명문/해시태그)를 자동 생성합니다.</p>

        {listError && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700">{listError}</p>
          </div>
        )}

        {!loadingList && items.length === 0 && !listError && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-sm text-slate-500">발행된 Kbuzz 글이 없습니다. (kbuzzStatus &quot;published&quot; 필요)</p>
          </div>
        )}

        {items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {items.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition ${isSelected ? "bg-blue-50 border-blue-300" : "bg-slate-50 border-slate-200 hover:border-slate-300"}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex flex-wrap gap-1.5">
                      {item.category && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{item.category}</span>}
                      {item.keyword && <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full">{item.keyword}</span>}
                    </div>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2">{item.kbuzzTitle}</h3>
                  <p className="text-xs text-slate-500 mb-3">{formatDate(item.kbuzzPublishedAt)}</p>
                  <div className="flex gap-2">
                    <a
                      href={item.kbuzzUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center text-xs px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                    >
                      🔗 Kbuzz 보기
                    </a>
                    <button
                      onClick={() => generateShorts(item)}
                      disabled={streaming}
                      className="flex-1 text-xs px-3 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:bg-rose-300 font-medium"
                    >
                      {streaming && isSelected ? "생성 중..." : "🎬 Shorts 생성"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 결과 영역 */}
        {(streaming || streamText || streamError) && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            {streamError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-xs text-red-700">{streamError}</p>
              </div>
            )}

            {streaming && !streamText && (
              <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin" />
                Claude가 Shorts 콘텐츠를 생성하는 중...
              </div>
            )}

            {streamText && (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(["script", "description", "hashtags"] as ShortsTab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium ${activeTab === tab ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                    >
                      {tabLabels[tab]}
                    </button>
                  ))}
                  {streaming && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 px-3 py-2">
                      <span className="inline-block w-3 h-3 border-2 border-slate-300 border-t-rose-500 rounded-full animate-spin" />
                      스트리밍 중...
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500">{tabLabels[activeTab]}</span>
                    <button
                      onClick={() => copyToClipboard(activeTab, tabContent[activeTab])}
                      disabled={!tabContent[activeTab]}
                      className="text-xs px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 disabled:opacity-40"
                    >
                      {copiedTab === activeTab ? "✅ 복사됨!" : "📋 복사"}
                    </button>
                  </div>
                  <pre className="text-sm text-slate-800 whitespace-pre-wrap break-words font-sans leading-relaxed">
                    {tabContent[activeTab] || (streaming ? "생성 중..." : "(내용 없음)")}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
