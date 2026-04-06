"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type MainTab = "trends" | "content" | "blog" | "kbuzz";

interface TrendKeyword { title: string; traffic: string }
interface Article { title: string; source: string; summary: string; url: string }
interface SnsContent { summary: string; instagram: string; blog: string; twitter: string; youtube?: string }
interface BlogPost { title: string; slug?: string; content: string; category: string; tags: string[]; excerpt: string; imageAlt?: string }

export default function TrendPage() {
  const { user, getIdToken } = useAuth();
  const isAdmin = user?.role === "admin";

  const [mainTab, setMainTab] = useState<MainTab>("trends");
  const [keywords, setKeywords] = useState<TrendKeyword[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState("");

  const [snsContent, setSnsContent] = useState<SnsContent | null>(null);
  const [loadingSns, setLoadingSns] = useState(false);
  const [blogPost, setBlogPost] = useState<BlogPost | null>(null);
  const [loadingBlog, setLoadingBlog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ postUrl: string; status: string } | null>(null);
  const [publishError, setPublishError] = useState("");
  const [publishStatus, setPublishStatus] = useState<"draft" | "publish">("draft");
  const [apiError, setApiError] = useState("");

  const [copied, setCopied] = useState("");

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    try { const res = await fetch("/api/trend/fetch"); const data = await res.json(); if (data.keywords) setKeywords(data.keywords); if (data.updatedAt) setUpdatedAt(data.updatedAt); }
    catch {} finally { setLoadingTrends(false); }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);
  useEffect(() => { const t = setInterval(fetchTrends, 30 * 60 * 1000); return () => clearInterval(t); }, [fetchTrends]);

  const selectKeyword = (kw: string) => {
    setSelectedKeyword(kw);
    setArticles([]); setSnsContent(null); setBlogPost(null); setPublishResult(null); setNewsError(""); setApiError("");
  };

  const handleNewsSearch = async () => {
    if (!selectedKeyword || !user) return;
    setLoadingNews(true); setNewsError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/trend/news", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ keyword: selectedKeyword }) });
      const data = await res.json();
      if (!res.ok) { setNewsError(data.error || "뉴스 검색 실패"); return; }
      setArticles(data.articles || []);
    } catch { setNewsError("서버 연결 실패"); } finally { setLoadingNews(false); }
  };

  const handleGenerate = async (mode: "sns" | "blog") => {
    if (!selectedKeyword || !user) return;
    const setLoading = mode === "sns" ? setLoadingSns : setLoadingBlog;
    setLoading(true); setApiError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/trend/generate", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ keyword: selectedKeyword, mode, articles }) });
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || "생성 실패"); return; }
      if (mode === "sns") setSnsContent(data); else setBlogPost(data);
    } catch { setApiError("서버 연결 실패"); } finally { setLoading(false); }
  };

  const handlePublish = async () => {
    if (!blogPost || !user) return;
    setPublishing(true); setPublishError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/trend/post-to-wp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: blogPost.title, content: blogPost.content, excerpt: blogPost.excerpt, slug: blogPost.slug, status: publishStatus }) });
      const data = await res.json();
      if (data.ok) setPublishResult({ postUrl: data.postUrl, status: data.status });
      else setPublishError(data.error || "발행 실패");
    } catch (e) { setPublishError(e instanceof Error ? e.message : "발행 실패"); }
    finally { setPublishing(false); }
  };

  const handleDownloadDocx = async () => {
    if (!blogPost) return;
    try {
      const res = await fetch("/api/trend/download-docx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(blogPost) });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "blog-post.docx"; a.click(); URL.revokeObjectURL(url);
    } catch {}
  };

  const copy = async (text: string, label: string) => { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(""), 2000); };

  // 뉴스 표시 컴포넌트
  const NewsSection = () => (
    <>
      {selectedKeyword && !articles.length && !loadingNews && !newsError && (
        <button onClick={handleNewsSearch} disabled={!user || loadingNews} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-300 flex items-center justify-center gap-2 mb-6">
          {!user ? "로그인 후 이용 가능" : <>🔍 뉴스 검색하기<span className="text-xs bg-white/20 px-2 py-0.5 rounded">1 크레딧</span></>}
        </button>
      )}
      {loadingNews && <div className="text-center py-8"><div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /><p className="text-slate-500 text-sm mt-2">뉴스 검색 중...</p></div>}
      {newsError && <p className="text-red-500 text-sm text-center py-4 mb-4">{newsError}</p>}
      {articles.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-lg font-bold text-slate-900">&ldquo;{selectedKeyword}&rdquo; 관련 뉴스</h2>
          {articles.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block p-4 bg-white rounded-xl border border-slate-200 hover:shadow-sm">
              <p className="font-semibold text-slate-900 text-sm mb-1">{a.title}</p>
              <p className="text-xs text-slate-500">{a.summary}</p>
              {a.source && <p className="text-xs text-slate-400 mt-1">{a.source}</p>}
            </a>
          ))}
        </div>
      )}
    </>
  );

  // 블로그 미리보기 컴포넌트
  const BlogPreview = () => blogPost ? (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">{blogPost.category}</span>
          <div className="flex gap-1 flex-wrap">{blogPost.tags.map((t, i) => <span key={i} className="text-xs text-slate-400">#{t}</span>)}</div>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">{blogPost.title}</h2>
        <div className="text-sm text-slate-700 leading-relaxed space-y-3">
          {blogPost.content.split("\n").map((line, i) => {
            const t = line.trim();
            if (!t) return null;
            if (/^\[대표이미지:|^\[본문이미지:/.test(t)) return <div key={i} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-medium">📸 {t.replace(/^\[|\]$/g, "")}</div>;
            if (t.startsWith("## ")) return <h3 key={i} className="text-lg font-bold text-slate-900 mt-4">{t.slice(3)}</h3>;
            if (t.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{t.slice(2)}</li>;
            return <p key={i}>{t}</p>;
          })}
        </div>
        {blogPost.excerpt && <p className="mt-4 text-xs text-slate-400 italic">메타: {blogPost.excerpt}</p>}
      </div>

      <div className="flex gap-3">
        <button onClick={() => copy(blogPost.content, "blog")} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 flex items-center justify-center gap-2">
          {copied === "blog" ? "복사됨 ✓" : "📋 전체 복사"}
        </button>
        <button onClick={handleDownloadDocx} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
          📥 Word 다운로드
        </button>
      </div>

      {isAdmin && !publishResult && (
        <div className="flex gap-3">
          <div className="flex gap-2">
            <button onClick={() => setPublishStatus("draft")} className={`px-4 py-2 rounded-lg text-sm font-medium ${publishStatus === "draft" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>임시저장</button>
            <button onClick={() => setPublishStatus("publish")} className={`px-4 py-2 rounded-lg text-sm font-medium ${publishStatus === "publish" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>즉시발행</button>
          </div>
          <button onClick={handlePublish} disabled={publishing} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-300">
            {publishing ? "발행 중..." : "🚀 Kbuzz에 발행하기"}
          </button>
        </div>
      )}
      {publishError && <div className="p-4 bg-red-50 rounded-xl border border-red-200"><p className="text-sm text-red-700">{publishError}</p></div>}
      {publishResult && <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200"><p className="text-sm font-medium text-emerald-800 mb-1">발행 완료! ({publishResult.status})</p><a href={publishResult.postUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">{publishResult.postUrl}</a></div>}
    </div>
  ) : null;

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-16">
      <div className="w-full max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6">&larr; 홈으로</Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-1">🔥 실시간 트렌드</h1>
            {updatedAt && <p className="text-xs text-slate-400">업데이트: {new Date(updatedAt).toLocaleString("ko-KR")}</p>}
          </div>
          <button onClick={fetchTrends} disabled={loadingTrends} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 disabled:opacity-50">
            {loadingTrends ? "로딩..." : "🔄"}
          </button>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button onClick={() => setMainTab("trends")} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${mainTab === "trends" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>🔥 트렌드</button>
          <button onClick={() => setMainTab("content")} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${mainTab === "content" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>✍️ AI 콘텐츠</button>
          <button onClick={() => setMainTab("blog")} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${mainTab === "blog" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>📝 AI 블로그 글</button>
          {isAdmin && <button onClick={() => setMainTab("kbuzz")} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${mainTab === "kbuzz" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>🚀 Kbuzz 발행</button>}
        </div>

        {/* 키워드 그리드 */}
        {loadingTrends && keywords.length === 0 ? (
          <div className="text-center py-12"><div className="inline-block w-10 h-10 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {keywords.map((kw, i) => (
              <button key={kw.title} onClick={() => selectKeyword(kw.title)}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selectedKeyword === kw.title ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"}`}>
                <span className={`text-lg font-bold w-8 text-center ${selectedKeyword === kw.title ? "text-white/60" : "text-slate-400"}`}>{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{kw.title}</p>{kw.traffic && <p className={`text-xs ${selectedKeyword === kw.title ? "text-white/60" : "text-slate-400"}`}>{kw.traffic}</p>}</div>
              </button>
            ))}
          </div>
        )}

        {apiError && <p className="text-red-500 text-sm text-center mb-4">{apiError}</p>}

        {/* 탭1: 트렌드 + 뉴스 */}
        {mainTab === "trends" && selectedKeyword && <NewsSection />}

        {/* 탭2: SNS 콘텐츠 */}
        {mainTab === "content" && selectedKeyword && (
          <div className="mb-8">
            <NewsSection />
            {articles.length > 0 && !snsContent && (
              <button onClick={() => handleGenerate("sns")} disabled={loadingSns || !user} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-300 flex items-center justify-center gap-2">
                {loadingSns ? "생성 중..." : <>✍️ AI SNS 콘텐츠 생성<span className="text-xs bg-white/20 px-2 py-0.5 rounded">2 크레딧</span></>}
              </button>
            )}
            {snsContent && (
              <div className="space-y-4">
                {[
                  { key: "summary", label: "📋 핵심 요약", c: snsContent.summary },
                  { key: "instagram", label: "📸 인스타그램", c: snsContent.instagram },
                  { key: "blog", label: "📝 블로그", c: snsContent.blog },
                  { key: "twitter", label: "🐦 X/트위터", c: snsContent.twitter },
                  ...(snsContent.youtube ? [{ key: "youtube", label: "🎬 유튜브", c: snsContent.youtube }] : []),
                ].map((s) => (
                  <div key={s.key} className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex justify-between mb-2"><span className="text-sm font-semibold text-slate-900">{s.label}</span><button onClick={() => copy(s.c, s.key)} className="text-xs text-slate-400 hover:text-slate-600">{copied === s.key ? "복사됨 ✓" : "복사"}</button></div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{s.c}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 탭3: AI 블로그 글 (전체 사용자) */}
        {mainTab === "blog" && (
          <div className="mb-8">
            {!selectedKeyword && <p className="text-slate-400 text-center py-8">위에서 트렌드 키워드를 선택하세요</p>}
            {selectedKeyword && <NewsSection />}
            {selectedKeyword && articles.length > 0 && !blogPost && (
              <button onClick={() => handleGenerate("blog")} disabled={loadingBlog || !user} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-300 flex items-center justify-center gap-2">
                {!user ? "로그인 후 이용 가능" : loadingBlog ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />AI 블로그 글 생성 중...</> : <>📝 AI 블로그 글 생성<span className="text-xs bg-white/20 px-2 py-0.5 rounded">3 크레딧</span></>}
              </button>
            )}
            <BlogPreview />
          </div>
        )}

        {/* 탭4: Kbuzz 발행 (관리자만) */}
        {mainTab === "kbuzz" && isAdmin && (
          <div className="mb-8">
            {!selectedKeyword && <p className="text-slate-400 text-center py-8">위에서 트렌드 키워드를 선택하세요</p>}
            {selectedKeyword && <NewsSection />}
            {selectedKeyword && articles.length > 0 && !blogPost && (
              <button onClick={() => handleGenerate("blog")} disabled={loadingBlog} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2">
                {loadingBlog ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</> : <>🚀 Kbuzz 포스팅 생성<span className="text-xs bg-white/20 px-2 py-0.5 rounded">3 크레딧</span></>}
              </button>
            )}
            <BlogPreview />
          </div>
        )}
      </div>
    </div>
  );
}
