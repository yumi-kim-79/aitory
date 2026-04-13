"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import ShortsGenerator from "@/components/trend/ShortsGenerator";

type MainTab = "trends" | "content" | "blog" | "kbuzz" | "auto";

interface TrendKeyword { title: string; traffic: string }
interface Article { title: string; source: string; summary: string; url: string; publishedAt?: string }

function formatDate(dateStr?: string): { label: string; color: string } {
  if (!dateStr) return { label: "", color: "" };
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff <= 0) return { label: "오늘", color: "text-emerald-600 bg-emerald-50" };
  if (diff === 1) return { label: "어제", color: "text-blue-600 bg-blue-50" };
  if (diff <= 3) return { label: `${diff}일 전`, color: "text-blue-600 bg-blue-50" };
  return { label: `${diff}일 전`, color: "text-slate-500 bg-slate-50" };
}

function formatTraffic(traffic: string): { label: string; color: string } {
  if (!traffic) return { label: "급상승", color: "text-amber-600" };
  const num = parseInt(traffic.replace(/[^0-9]/g, ""), 10);
  if (isNaN(num)) return { label: traffic, color: "text-slate-400" };
  const formatted = num.toLocaleString();
  if (num >= 1000) return { label: `🔥 +${formatted}`, color: "text-red-500" };
  if (num >= 500) return { label: `▲ +${formatted}`, color: "text-emerald-600" };
  return { label: `▲ +${formatted}`, color: "text-emerald-500" };
}
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
  const [publishResult, setPublishResult] = useState<{ postUrl: string; status: string; tweetUrl?: string; tweetError?: string } | null>(null);
  const [publishError, setPublishError] = useState("");
  const [publishStatus, setPublishStatus] = useState<"draft" | "publish">("draft");
  const [apiError, setApiError] = useState("");
  const [autoPublishing, setAutoPublishing] = useState(false);
  const [autoCooldown, setAutoCooldown] = useState(false);
  const [autoImagePublishing, setAutoImagePublishing] = useState(false);
  const [autoTweeting, setAutoTweeting] = useState(false);
  const [republishing, setRepublishing] = useState(false);
  const [v3Running, setV3Running] = useState(false);
  const [bulkIndexing, setBulkIndexing] = useState(false);
  const [indexPending, setIndexPending] = useState<number | null>(null);
  const [indexProcessed, setIndexProcessed] = useState(0);
  const [indexTotal, setIndexTotal] = useState(0);
  const indexStopRef = useRef(false);
  const [seoUpdating, setSeoUpdating] = useState(false);
  const [seoPending, setSeoPending] = useState<number | null>(null);
  const [seoProcessed, setSeoProcessed] = useState(0);
  const [seoTotal, setSeoTotal] = useState(0);
  const seoStopRef = useRef(false);
  const [autoResults, setAutoResults] = useState<{ keyword: string; ok?: boolean; success?: boolean; postUrl?: string; wpUrl?: string; tweetUrl?: string; tweetError?: string; indexed?: boolean; title?: string; error?: string }[]>([]);

  const [bulkTweeting, setBulkTweeting] = useState(false);
  const [bulkTweetLog, setBulkTweetLog] = useState("");
  const [bulkTweetPending, setBulkTweetPending] = useState<number | null>(null);

  const [copied, setCopied] = useState("");

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    try { const res = await fetch("/api/trend/fetch"); const data = await res.json(); if (data.keywords) setKeywords(data.keywords); if (data.updatedAt) setUpdatedAt(data.updatedAt); }
    catch {} finally { setLoadingTrends(false); }
  }, []);

  useEffect(() => { fetchTrends(); }, [fetchTrends]);
  useEffect(() => { const t = setInterval(fetchTrends, 30 * 60 * 1000); return () => clearInterval(t); }, [fetchTrends]);

  // 자동발행 탭 진입 시 색인/SEO 업데이트 대기 글 개수 조회
  useEffect(() => {
    if (mainTab !== "auto" || !isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getIdToken();
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const [idxRes, seoRes] = await Promise.all([
          fetch("/api/indexing/bulk", { headers }),
          fetch("/api/auto-publish/seo-update", { headers }),
        ]);
        if (idxRes.ok) {
          const data = await idxRes.json();
          if (!cancelled) setIndexPending(typeof data.pending === "number" ? data.pending : null);
        }
        if (seoRes.ok) {
          const data = await seoRes.json();
          if (!cancelled) setSeoPending(typeof data.pending === "number" ? data.pending : null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [mainTab, isAdmin, getIdToken]);

  const selectKeyword = (kw: string) => {
    setSelectedKeyword(kw);
    setArticles([]); setSnsContent(null); setBlogPost(null); setPublishResult(null); setNewsError(""); setApiError("");
  };

  const handleNewsSearch = async () => {
    if (!selectedKeyword) return;
    setLoadingNews(true); setNewsError("");
    try {
      const res = await fetch("/api/trend/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyword: selectedKeyword }) });
      const data = await res.json();
      if (!res.ok) { setNewsError(data.error || "뉴스 검색 실패"); return; }
      setArticles(data.articles || []);
    } catch { setNewsError("서버 연결 실패"); } finally { setLoadingNews(false); }
  };

  const handleGenerate = async (mode: "sns" | "blog" | "kbuzz") => {
    if (!selectedKeyword || !user) return;
    const isBlog = mode === "blog" || mode === "kbuzz";
    const setLoading = mode === "sns" ? setLoadingSns : setLoadingBlog;
    setLoading(true); setApiError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/trend/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword: selectedKeyword, mode, articles }),
      });
      const data = await res.json().catch(() => ({ error: `응답 오류 (${res.status})` }));
      if (!res.ok) { setApiError(data.error || "생성 실패"); return; }
      if (mode === "sns") setSnsContent(data); else setBlogPost(data);
    } catch (e) { setApiError(e instanceof Error ? e.message : "서버 연결 실패"); }
    finally { setLoading(false); }
  };

  const handlePublish = async () => {
    if (!blogPost || !user) return;
    setPublishing(true); setPublishError("");
    try {
      const token = await getIdToken();
      const res = await fetch("/api/trend/post-to-wp", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: blogPost.title, content: blogPost.content, excerpt: blogPost.excerpt, slug: blogPost.slug, status: publishStatus, tags: blogPost.tags, category: blogPost.category, keyword: selectedKeyword || "" }) });
      const data = await res.json();
      if (data.ok) setPublishResult({ postUrl: data.postUrl, status: data.status, tweetUrl: data.tweetUrl, tweetError: data.tweetError });
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
        <button onClick={handleNewsSearch} disabled={loadingNews} className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:bg-slate-300 flex items-center justify-center gap-2 mb-6">
          🔍 뉴스 검색하기<span className="text-xs bg-white/20 px-2 py-0.5 rounded">무료</span>
        </button>
      )}
      {loadingNews && <div className="text-center py-8"><div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" /><p className="text-slate-500 text-sm mt-2">뉴스 검색 중...</p></div>}
      {newsError && (
        <div className="text-center py-4 mb-4">
          <p className="text-red-500 text-sm">{newsError}</p>
          <button onClick={handleNewsSearch} className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium">다시 시도</button>
        </div>
      )}
      {articles.length > 0 && (
        <div className="space-y-3 mb-6">
          <h2 className="text-lg font-bold text-slate-900">&ldquo;{selectedKeyword}&rdquo; 관련 뉴스</h2>
          {articles.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block p-4 bg-white rounded-xl border border-slate-200 hover:shadow-sm">
              <p className="font-semibold text-slate-900 text-sm mb-1">{a.title}</p>
              <p className="text-xs text-slate-500">{a.summary}</p>
              <div className="flex items-center gap-2 mt-1">
                {a.source && <span className="text-xs text-slate-400">{a.source}</span>}
                {a.publishedAt && (() => { const d = formatDate(a.publishedAt); return <span className={`text-xs px-1.5 py-0.5 rounded ${d.color}`}>{d.label}</span>; })()}
              </div>
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
        <div
          className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-h2:text-lg prose-h2:mt-6"
          dangerouslySetInnerHTML={{
            __html: blogPost.content
              .replace(/<!-- 이미지:([^|]+)\|([^>]+)-->/g, '<div style="padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;margin:12px 0">📸 이미지:$1| $2</div>')
              .replace(/\[📸이미지:([^\]]+)\]/g, '<div style="padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;margin:12px 0">📸 이미지:$1</div>')
              .replace(/^## (.+)$/gm, "<h2>$1</h2>")
              .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"),
          }}
        />
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
      {isAdmin && publishError && <div className="p-4 bg-red-50 rounded-xl border border-red-200"><p className="text-sm text-red-700">{publishError}</p></div>}
      {isAdmin && publishResult && <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200"><p className="text-sm font-medium text-emerald-800 mb-1">발행 완료! ({publishResult.status})</p><a href={publishResult.postUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">{publishResult.postUrl}</a>{publishResult.tweetUrl && <p className="text-xs text-sky-600 mt-1"><a href={publishResult.tweetUrl} target="_blank" rel="noopener noreferrer" className="underline">🐦 X 포스팅 완료</a></p>}{publishResult.tweetError && <p className="text-xs text-amber-600 mt-1">⚠️ X 포스팅 실패: {publishResult.tweetError}</p>}</div>}
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
          {isAdmin && <button onClick={() => setMainTab("kbuzz")} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${mainTab === "kbuzz" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>🚀 Kbuzz</button>}
          {isAdmin && <button onClick={() => setMainTab("auto")} className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap ${mainTab === "auto" ? "bg-purple-600 text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100"}`}>🤖 자동발행</button>}
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
                <div className="flex-1 min-w-0"><p className="font-semibold truncate">{kw.title}</p>{kw.traffic && (() => { const t = formatTraffic(kw.traffic); return <p className={`text-xs ${selectedKeyword === kw.title ? "text-white/60" : t.color}`}>{t.label}</p>; })()}</div>
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
              <button onClick={() => handleGenerate("kbuzz")} disabled={loadingBlog} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2">
                {loadingBlog ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />생성 중...</> : <>🚀 Kbuzz 포스팅 생성<span className="text-xs bg-white/20 px-2 py-0.5 rounded">3 크레딧</span></>}
              </button>
            )}
            <BlogPreview />
          </div>
        )}

        {/* 탭5: 자동 발행 (관리자만) */}
        {mainTab === "auto" && isAdmin && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">🤖 자동 발행 시스템</h2>
              <div className="space-y-3 text-sm text-slate-600 mb-6">
                <p>매일 <strong>07:00</strong> (KST) 자동 발행</p>
                <p><strong>1단계</strong> (07:00): 롱테일 제목 + SEO+AEO + Google 색인 자동 적용 → WP <span className="text-amber-600 font-medium">draft</span> 저장</p>
                <p><strong>2단계</strong> (07:05): DALL-E 이미지 생성 → WP 이미지 업로드 → <span className="text-amber-600 font-medium">검수 후 수동 발행</span></p>
                <p><strong>3단계</strong> (수동): X 트윗 발행 (텍스트만)</p>
                <p><strong>4단계</strong> (수동): 인기글 재발행 - 최근 30일 글 5개 다른 각도로 재작성</p>
                <p><strong>V3</strong> (수동): 롱테일 제목 3안 + AI 요약박스 + FAQ + JSON-LD + Google 색인</p>
                <p>K-콘텐츠 50%: <strong>K-연예/한류</strong>(3), <strong>K-스포츠</strong>(2) + 일반(5) = 10개</p>
                <p className="text-red-500">정치/선거/탄핵 키워드는 자동 제외됩니다.</p>
              </div>
              <button
                onClick={async () => {
                  setAutoPublishing(true); setAutoResults([]);
                  try {
                    console.log("[auto] 1. ID 토큰 획득 시도...");
                    const token = await getIdToken();
                    if (!token) {
                      console.error("[auto] ID 토큰 획득 실패 (null)");
                      setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰을 가져올 수 없습니다. 로그아웃 후 다시 로그인해주세요." }]);
                      return;
                    }
                    console.log("[auto] 2. 토큰 획득 성공, API 호출 시작...");
                    const res = await fetch("/api/trend/trigger-publish", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${token}` },
                      signal: AbortSignal.timeout(280000),
                    });
                    console.log("[auto] 3. 응답 수신:", res.status);
                    const data = await res.json();
                    console.log("[auto] 4. 응답 데이터:", data);
                    if (!res.ok) {
                      setAutoResults([{ keyword: "서버 오류", ok: false, error: data.error || `HTTP ${res.status}` }]);
                    } else if (data.results?.length) {
                      setAutoResults(data.results);
                    } else {
                      setAutoResults([{ keyword: data.stage || "완료", success: data.success, error: data.message || data.error }]);
                    }
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error("[auto] 에러:", msg);
                    setAutoResults([{ keyword: "에러", ok: false, error: `API 호출 실패: ${msg}` }]);
                  } finally { setAutoPublishing(false); }
                }}
                disabled={autoPublishing}
                className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:bg-purple-300 flex items-center justify-center gap-2"
              >
                {autoPublishing ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Draft 저장 중... (2~4분, 10개 병렬)</> : "🚀 1단계: Draft 저장 (V3 자동화)"}
              </button>
              <button
                onClick={async () => {
                  setAutoImagePublishing(true); setAutoResults([]);
                  try {
                    const token = await getIdToken();
                    if (!token) { setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰 실패" }]); return; }
                    const res = await fetch("/api/trend/trigger-publish-image", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(280000) });
                    const data = await res.json();
                    if (!res.ok) { setAutoResults([{ keyword: "오류", ok: false, error: data.error || `HTTP ${res.status}` }]); }
                    else if (data.results?.length) { setAutoResults(data.results.map((r: { keyword: string; success: boolean; error?: string }) => ({ keyword: r.keyword, success: r.success, ok: r.success, error: r.error }))); }
                    else if (data.message) { setAutoResults([{ keyword: "완료", success: true, error: data.message }]); }
                  } catch (err) {
                    setAutoResults([{ keyword: "에러", ok: false, error: `호출 실패: ${err instanceof Error ? err.message : String(err)}` }]);
                  } finally { setAutoImagePublishing(false); }
                }}
                disabled={autoImagePublishing}
                className="w-full py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 disabled:bg-amber-300 flex items-center justify-center gap-2 mt-3"
              >
                {autoImagePublishing ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />이미지 생성 중... (2~4분)</> : "🖼️ 2단계: 이미지 생성 (검수 후 수동 발행)"}
              </button>
              <button
                onClick={async () => {
                  setAutoTweeting(true); setAutoResults([]);
                  try {
                    const token = await getIdToken();
                    if (!token) { setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰 실패" }]); return; }
                    const res = await fetch("/api/trend/post-to-x-bulk", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(290000) });
                    const data = await res.json();
                    if (!res.ok) { setAutoResults([{ keyword: "오류", ok: false, error: data.error || `HTTP ${res.status}` }]); }
                    else if (data.results?.length) { setAutoResults(data.results.map((r: { keyword: string; success: boolean; tweetUrl?: string; error?: string }) => ({ keyword: r.keyword, success: r.success, ok: r.success, tweetUrl: r.tweetUrl, error: r.error }))); }
                    else { setAutoResults([{ keyword: "완료", success: true, error: data.message || `처리 ${data.total || 0}개` }]); }
                  } catch (err) {
                    setAutoResults([{ keyword: "에러", ok: false, error: `호출 실패: ${err instanceof Error ? err.message : String(err)}` }]);
                  } finally { setAutoTweeting(false); }
                }}
                disabled={autoTweeting}
                className="w-full py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 disabled:bg-sky-300 flex items-center justify-center gap-2 mt-3"
              >
                {autoTweeting ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />트윗 발행 중... (30초 이내)</> : "🐦 3단계: X 트윗 발행 (텍스트만)"}
              </button>
              <button
                onClick={async () => {
                  setRepublishing(true); setAutoResults([]);
                  try {
                    const token = await getIdToken();
                    if (!token) { setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰 실패" }]); return; }
                    const res = await fetch("/api/trend/republish-popular", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(290000) });
                    const data = await res.json();
                    if (!res.ok) { setAutoResults([{ keyword: "오류", ok: false, error: data.error || `HTTP ${res.status}` }]); }
                    else if (data.results?.length) { setAutoResults(data.results.map((r: { originalKeyword: string; newTitle?: string; newWpUrl?: string; success: boolean; error?: string }) => ({ keyword: `${r.originalKeyword}${r.newTitle ? ` → ${r.newTitle}` : ''}`, success: r.success, ok: r.success, wpUrl: r.newWpUrl, error: r.error }))); }
                    else { setAutoResults([{ keyword: "완료", success: true, error: data.message || `재발행 ${data.total || 0}개` }]); }
                  } catch (err) {
                    setAutoResults([{ keyword: "에러", ok: false, error: `호출 실패: ${err instanceof Error ? err.message : String(err)}` }]);
                  } finally { setRepublishing(false); }
                }}
                disabled={republishing}
                className="w-full py-3 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 disabled:bg-indigo-300 flex items-center justify-center gap-2 mt-3"
              >
                {republishing ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />재발행 중... (3~5분 소요)</> : "🔄 4단계: 인기글 재발행 (5개)"}
              </button>
              <button
                onClick={async () => {
                  setV3Running(true); setAutoResults([]);
                  try {
                    const token = await getIdToken();
                    if (!token) { setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰 실패" }]); return; }
                    const res = await fetch("/api/auto-publish/v3", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(290000) });
                    const data = await res.json();
                    if (!res.ok) { setAutoResults([{ keyword: "오류", ok: false, error: data.error || `HTTP ${res.status}` }]); }
                    else if (data.results?.length) {
                      setAutoResults(data.results.map((r: { keyword: string; category: string; success: boolean; title?: string; wpUrl?: string; indexed?: boolean; error?: string }) => ({
                        keyword: r.title ? `${r.keyword} → ${r.title}` : r.keyword,
                        success: r.success, ok: r.success, wpUrl: r.wpUrl, indexed: r.indexed, error: r.error,
                      })));
                    }
                    else { setAutoResults([{ keyword: "완료", success: true, error: data.message || `처리 ${data.total || 0}개, 색인 ${data.indexed || 0}개` }]); }
                  } catch (err) {
                    setAutoResults([{ keyword: "에러", ok: false, error: `호출 실패: ${err instanceof Error ? err.message : String(err)}` }]);
                  } finally { setV3Running(false); }
                }}
                disabled={v3Running}
                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 disabled:bg-emerald-300 flex items-center justify-center gap-2 mt-3"
              >
                {v3Running ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />V3 실행 중... (3~5분 소요)</> : "🚀 V3: SEO+롱테일+색인 자동화"}
              </button>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async () => {
                    setBulkIndexing(true); setAutoResults([]);
                    indexStopRef.current = false;
                    setIndexProcessed(0);
                    // 분모는 최초 pending 개수로 고정
                    const initialTotal = indexPending ?? 0;
                    setIndexTotal(initialTotal);
                    let totalSucceeded = 0;
                    let totalFailed = 0;
                    try {
                      while (true) {
                        if (indexStopRef.current) { console.log("[bulk-index] 사용자 중단"); break; }
                        // 매 배치마다 토큰 강제 갱신
                        const token = await getIdToken(true);
                        if (!token) { setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰 실패" }]); break; }
                        const res = await fetch("/api/indexing/bulk", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120000) });
                        const data = await res.json();
                        if (!res.ok) {
                          setAutoResults([{ keyword: "오류", ok: false, error: data.error || `HTTP ${res.status}` }]);
                          break;
                        }
                        const batchProcessed = data.total ?? 0;
                        totalSucceeded += data.succeeded ?? 0;
                        totalFailed += data.failed ?? 0;
                        // 분자는 누적 처리 완료 개수 (성공+실패), 분모 초과 방지
                        setIndexProcessed(Math.min(totalSucceeded + totalFailed, initialTotal));
                        const remaining = data.totalRemaining ?? 0;
                        if (batchProcessed === 0 || remaining === 0) break;
                      }
                      setAutoResults([{
                        keyword: indexStopRef.current ? "📡 색인 요청 중단됨" : "📡 색인 요청 완료",
                        success: !indexStopRef.current,
                        error: `처리 ${totalSucceeded + totalFailed}개 / 성공 ${totalSucceeded} / 실패 ${totalFailed}`,
                      }]);
                      setIndexPending(Math.max(0, initialTotal - (totalSucceeded + totalFailed)));
                    } catch (err) {
                      setAutoResults([{ keyword: "에러", ok: false, error: `호출 실패: ${err instanceof Error ? err.message : String(err)}` }]);
                    } finally { setBulkIndexing(false); }
                  }}
                  disabled={bulkIndexing || indexPending === 0}
                  className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-medium hover:bg-cyan-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {bulkIndexing
                    ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />색인 요청 중... ({indexProcessed}/{indexTotal})</>
                    : indexPending === null ? "📡 기존 글 전체 색인 요청 (조회 중...)"
                    : indexPending === 0 ? "✅ 모든 글 색인 완료"
                    : `📡 기존 글 전체 색인 요청 (${indexPending}개 대기 중)`}
                </button>
                {bulkIndexing && (
                  <button
                    onClick={() => { indexStopRef.current = true; }}
                    className="px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 text-sm"
                  >
                    중단
                  </button>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={async () => {
                    setSeoUpdating(true); setAutoResults([]);
                    seoStopRef.current = false;
                    setSeoProcessed(0);
                    // 분모는 최초 pending 개수로 고정 (배치 진행 중 변하지 않음)
                    const initialTotal = seoPending ?? 0;
                    setSeoTotal(initialTotal);
                    let totalSucceeded = 0;
                    let totalFailed = 0;
                    let firestoreFailedCount = 0;
                    let firstFirestoreError: string | undefined;
                    let firstWpError: string | undefined;
                    let stopReason = "";
                    const MAX_BATCHES = 14;  // 69 ÷ 5 ≈ 14
                    let batchCount = 0;
                    try {
                      while (true) {
                        if (seoStopRef.current) { stopReason = "사용자 중단"; break; }
                        if (batchCount >= MAX_BATCHES) { stopReason = `최대 배치 수(${MAX_BATCHES}) 초과로 중단`; break; }
                        batchCount++;
                        // 매 배치마다 토큰 강제 갱신 (1시간 만료 방지)
                        const token = await getIdToken(true);
                        if (!token) { setAutoResults([{ keyword: "인증 오류", ok: false, error: "로그인 토큰 실패" }]); return; }
                        const res = await fetch("/api/auto-publish/seo-update", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(290000) });
                        const data = await res.json();
                        if (!res.ok) {
                          setAutoResults([{ keyword: "서버 오류", ok: false, error: data.error || `HTTP ${res.status}` }]);
                          return;
                        }
                        const batchProcessed = data.total ?? 0;
                        const batchSucceeded = data.succeeded ?? 0;
                        const batchFailed = data.failed ?? 0;
                        totalSucceeded += batchSucceeded;
                        totalFailed += batchFailed;
                        if (!firstWpError && data.firstError) firstWpError = data.firstError;
                        // Firestore 저장 실패 개수 집계
                        if (Array.isArray(data.results)) {
                          for (const r of data.results as { firestoreSaved?: boolean; firestoreError?: string }[]) {
                            if (r.firestoreSaved === false || r.firestoreError) {
                              firestoreFailedCount++;
                              if (!firstFirestoreError && r.firestoreError) firstFirestoreError = r.firestoreError;
                            }
                          }
                        }
                        // 분자는 누적 성공+실패 합계로
                        setSeoProcessed(Math.min(totalSucceeded + totalFailed, initialTotal));

                        // 안전장치 1: 배치 성공률 0% → 즉시 중단
                        if (batchProcessed > 0 && batchSucceeded === 0) {
                          stopReason = `배치 성공률 0% (${batchFailed}건 모두 실패) → 즉시 중단`;
                          break;
                        }
                        // 안전장치 2: 서버에서 wpBroken 신호 → 즉시 중단
                        if (data.wpBroken) {
                          stopReason = "WP API 실패 감지 (Claude 크레딧 보호)";
                          break;
                        }
                        // 정상 종료
                        const remaining = data.totalRemaining ?? 0;
                        if (batchProcessed === 0 || remaining === 0) break;
                      }
                      const fsNote = firestoreFailedCount > 0
                        ? ` ⚠️ Firestore 저장 실패 ${firestoreFailedCount}건${firstFirestoreError ? ` (${firstFirestoreError.slice(0, 80)})` : ""}`
                        : "";
                      const wpNote = firstWpError ? ` ⚠️ WP 첫 에러: ${firstWpError.slice(0, 100)}` : "";
                      const stopNote = stopReason ? ` [중단: ${stopReason}]` : "";
                      setAutoResults([{
                        keyword: stopReason ? "✨ SEO+AEO 업데이트 중단됨" : "✨ SEO+AEO 업데이트 완료",
                        success: !stopReason && firestoreFailedCount === 0 && totalFailed === 0,
                        error: `처리 ${totalSucceeded + totalFailed}개 / 성공 ${totalSucceeded} / 실패 ${totalFailed}${fsNote}${wpNote}${stopNote}`,
                      }]);
                      setSeoPending(Math.max(0, initialTotal - (totalSucceeded + totalFailed)));
                    } catch (err) {
                      setAutoResults([{ keyword: "에러", ok: false, error: `호출 실패: ${err instanceof Error ? err.message : String(err)}` }]);
                    } finally { setSeoUpdating(false); }
                  }}
                  disabled={seoUpdating || seoPending === 0}
                  className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-medium hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {seoUpdating
                    ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />업데이트 중... ({seoProcessed}/{seoTotal})</>
                    : seoPending === null ? "✨ 기존 글 SEO+AEO 업데이트 (조회 중...)"
                    : seoPending === 0 ? "✅ 모든 글 SEO+AEO 완료"
                    : `✨ 기존 글 SEO+AEO 업데이트 (${seoPending}개 대기 중)`}
                </button>
                {seoUpdating && (
                  <button
                    onClick={() => { seoStopRef.current = true; }}
                    className="px-4 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 text-sm"
                  >
                    중단
                  </button>
                )}
              </div>
            </div>

            {/* 기존 글 X 일괄 포스팅 */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mt-4">
              <h3 className="text-sm font-bold text-slate-900 mb-3">📤 기존 글 X 일괄 포스팅</h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const token = await getIdToken(true);
                      if (!token) return;
                      const res = await fetch("/api/admin/bulk-tweet-existing", {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ dryRun: true }),
                      });
                      const data = await res.json();
                      setBulkTweetPending(data.pending ?? 0);
                      setBulkTweetLog(`전체 ${data.total ?? 0}개 / 이미 포스팅 ${data.alreadyPosted ?? 0}개 / 대상 ${data.pending ?? 0}개`);
                    } catch (e) { setBulkTweetLog(`조회 실패: ${e instanceof Error ? e.message : String(e)}`); }
                  }}
                  disabled={bulkTweeting}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs hover:bg-slate-200 disabled:opacity-50"
                >
                  🔍 대상 확인
                </button>
                <button
                  onClick={async () => {
                    setBulkTweeting(true); setBulkTweetLog("시작...\n");
                    try {
                      const token = await getIdToken(true);
                      if (!token) { setBulkTweetLog("인증 실패"); setBulkTweeting(false); return; }
                      const res = await fetch("/api/admin/bulk-tweet-existing", {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ dryRun: false }),
                        signal: AbortSignal.timeout(290000),
                      });
                      if (!res.body) { setBulkTweetLog("스트림 없음"); setBulkTweeting(false); return; }
                      const reader = res.body.getReader();
                      const decoder = new TextDecoder();
                      let acc = "";
                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        acc += decoder.decode(value, { stream: true });
                        setBulkTweetLog(acc);
                      }
                    } catch (e) { setBulkTweetLog((prev) => prev + `\n에러: ${e instanceof Error ? e.message : String(e)}`); }
                    finally { setBulkTweeting(false); }
                  }}
                  disabled={bulkTweeting || bulkTweetPending === 0}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  {bulkTweeting ? "포스팅 중..." : `🚀 실행 (${bulkTweetPending ?? "?"}개)`}
                </button>
              </div>
              {bulkTweetLog && (
                <pre className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap max-h-60 overflow-y-auto">{bulkTweetLog}</pre>
              )}
            </div>

            {autoResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-700">발행 결과</h3>
                {autoResults.map((r, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${r.success || r.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{r.success || r.ok ? "✅" : "❌"} {r.keyword}</span>
                      {(r.wpUrl || r.postUrl) && <a href={r.wpUrl || r.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">{r.wpUrl || r.postUrl}</a>}
                    </div>
                    {typeof r.indexed === "boolean" && (
                      <span className={`text-xs mt-1 inline-block ${r.indexed ? "text-emerald-700" : "text-slate-500"}`}>
                        {r.indexed ? "🔍 Google 색인 요청 성공" : "🔍 Google 색인 미설정/실패"}
                      </span>
                    )}
                    {r.tweetUrl && (
                      <a href={r.tweetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 underline mt-1 inline-block">🐦 트윗됨</a>
                    )}
                    {r.tweetError && <p className="text-xs text-amber-600 mt-1">🐦 트윗 실패: {r.tweetError}</p>}
                    {r.error && <p className="text-xs text-red-600 mt-1">{r.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Shorts 콘텐츠 생성 (관리자 전용, 모든 탭에서 표시) */}
        {isAdmin && <ShortsGenerator />}
      </div>
    </div>
  );
}
