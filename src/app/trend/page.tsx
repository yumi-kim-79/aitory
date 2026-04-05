"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface TrendKeyword { title: string; traffic: string }
interface Article { title: string; source: string; summary: string; url: string }
interface SnsContent { summary: string; instagram: string; blog: string; twitter: string }

export default function TrendPage() {
  const [keywords, setKeywords] = useState<TrendKeyword[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [snsContent, setSnsContent] = useState<SnsContent | null>(null);
  const [loadingSns, setLoadingSns] = useState(false);
  const [copied, setCopied] = useState("");

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const res = await fetch("/api/trend/fetch");
      const data = await res.json();
      if (data.keywords) setKeywords(data.keywords);
      if (data.updatedAt) setUpdatedAt(data.updatedAt);
    } catch {} finally { setLoadingTrends(false); }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);

  // 30분마다 자동 새로고침
  useEffect(() => {
    const timer = setInterval(fetchTrends, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchTrends]);

  const handleKeywordClick = async (keyword: string) => {
    setSelectedKeyword(keyword);
    setArticles([]);
    setSnsContent(null);
    setLoadingNews(true);
    try {
      const res = await fetch("/api/trend/news", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword }),
      });
      const data = await res.json();
      setArticles(data.articles || []);
    } catch {} finally { setLoadingNews(false); }
  };

  const handleSummarize = async () => {
    if (!selectedKeyword || articles.length === 0) return;
    setLoadingSns(true);
    try {
      const res = await fetch("/api/trend/summarize", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: selectedKeyword, articles }),
      });
      const data = await res.json();
      if (!data.error) setSnsContent(data);
    } catch {} finally { setLoadingSns(false); }
  };

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label); setTimeout(() => setCopied(""), 2000);
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 홈으로</Link>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-1">🔥 실시간 트렌드</h1>
            {updatedAt && (
              <p className="text-xs text-slate-400">
                마지막 업데이트: {new Date(updatedAt).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
          <button onClick={fetchTrends} disabled={loadingTrends} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 disabled:bg-slate-50">
            {loadingTrends ? "로딩..." : "🔄 새로고침"}
          </button>
        </div>

        {/* 트렌드 키워드 목록 */}
        {loadingTrends && keywords.length === 0 ? (
          <div className="text-center py-12"><div className="inline-block w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {keywords.map((kw, i) => (
              <button
                key={kw.title}
                onClick={() => handleKeywordClick(kw.title)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                  selectedKeyword === kw.title
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <span className={`text-lg font-bold w-8 text-center ${selectedKeyword === kw.title ? "text-white/60" : "text-slate-400"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{kw.title}</p>
                  {kw.traffic && (
                    <p className={`text-xs ${selectedKeyword === kw.title ? "text-white/60" : "text-slate-400"}`}>
                      {kw.traffic}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* 선택된 키워드 뉴스 */}
        {selectedKeyword && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              &ldquo;{selectedKeyword}&rdquo; 관련 뉴스
            </h2>

            {loadingNews ? (
              <div className="text-center py-8"><div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /><p className="text-slate-500 text-sm mt-2">뉴스를 검색하고 있어요...</p></div>
            ) : articles.length === 0 ? (
              <p className="text-slate-400 text-center py-8">관련 뉴스를 찾을 수 없습니다.</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {articles.map((a, i) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                      <p className="font-semibold text-slate-900 text-sm mb-1">{a.title}</p>
                      <p className="text-xs text-slate-500">{a.summary}</p>
                      {a.source && <p className="text-xs text-slate-400 mt-1">{a.source}</p>}
                    </a>
                  ))}
                </div>

                {/* AI 요약 + SNS 콘텐츠 생성 */}
                {!snsContent && (
                  <button
                    onClick={handleSummarize}
                    disabled={loadingSns}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-400 flex items-center justify-center gap-2"
                  >
                    {loadingSns ? (
                      <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 요약 + SNS 콘텐츠 생성 중...</>
                    ) : (
                      <>AI 요약 + SNS 콘텐츠 생성<span className="text-xs bg-white/20 px-2 py-0.5 rounded">2 크레딧</span></>
                    )}
                  </button>
                )}

                {snsContent && (
                  <div className="space-y-4 mt-4">
                    {/* 3줄 요약 */}
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-900">핵심 요약</span>
                        <button onClick={() => copy(snsContent.summary, "summary")} className="text-xs text-slate-400 hover:text-slate-600">{copied === "summary" ? "복사됨 ✓" : "복사"}</button>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{snsContent.summary}</p>
                    </div>

                    {/* SNS 콘텐츠 */}
                    {[
                      { key: "instagram", label: "📸 인스타그램", content: snsContent.instagram },
                      { key: "blog", label: "📝 블로그", content: snsContent.blog },
                      { key: "twitter", label: "🐦 X/트위터", content: snsContent.twitter },
                    ].map((sns) => (
                      <div key={sns.key} className="bg-white rounded-xl border border-slate-200 p-5">
                        <div className="flex justify-between mb-2">
                          <span className="text-sm font-semibold text-slate-900">{sns.label}</span>
                          <button onClick={() => copy(sns.content, sns.key)} className="text-xs text-slate-400 hover:text-slate-600">{copied === sns.key ? "복사됨 ✓" : "복사"}</button>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{sns.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
