"use client";

import { useRef, useState, useEffect } from "react";
import {
  type Plan,
  PLAN_LIMITS,
  PLAN_LABELS,
  getPlan,
  setPlan as savePlan,
} from "@/lib/plan";

const ALLOWED_EXTENSIONS = [
  "pdf", "docx", "xlsx", "xls",
  "jpg", "jpeg", "png", "webp",
];

const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

function getFileIcon(name: string) {
  if (name.endsWith(".pdf")) return <span className="text-red-500">PDF</span>;
  if (name.endsWith(".docx")) return <span className="text-blue-500">DOC</span>;
  if (/\.(xlsx|xls)$/i.test(name)) return <span className="text-emerald-500">XLS</span>;
  return <span className="text-purple-500">IMG</span>;
}

const PLAN_BADGE: Record<Plan, { className: string; label: string }> = {
  free: { className: "bg-slate-100 text-slate-600", label: "무료 체험" },
  starter: { className: "bg-blue-100 text-blue-700", label: "스타터" },
  pro: { className: "bg-amber-100 text-amber-700", label: "PRO ⭐" },
};

function getUpgradeMessage(plan: Plan): string {
  if (plan === "free")
    return `무료 플랜은 최대 ${PLAN_LIMITS.free.maxFiles}개까지 업로드 가능합니다. 스타터 플랜으로 업그레이드하면 ${PLAN_LIMITS.starter.maxFiles}개까지 가능해요!`;
  if (plan === "starter")
    return `스타터 플랜은 최대 ${PLAN_LIMITS.starter.maxFiles}개까지 업로드 가능합니다. Pro 플랜으로 업그레이드하면 ${PLAN_LIMITS.pro.maxFiles}개까지 가능해요!`;
  return `최대 ${PLAN_LIMITS.pro.maxFiles}개까지 업로드 가능합니다.`;
}

export default function FileUploadArea({
  files,
  dragging,
  error,
  onFilesChange,
  onDraggingChange,
  onError,
}: {
  files: File[];
  dragging: boolean;
  error: string;
  onFilesChange: (f: File[]) => void;
  onDraggingChange: (d: boolean) => void;
  onError: (e: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [plan, setPlanState] = useState<Plan>("free");

  useEffect(() => {
    setPlanState(getPlan());
  }, []);

  const maxFiles = PLAN_LIMITS[plan].maxFiles;
  const badge = PLAN_BADGE[plan];

  const handlePlanChange = (p: Plan) => {
    setPlanState(p);
    savePlan(p);
  };

  const validateAndAdd = (newFiles: FileList | File[]) => {
    const valid: File[] = [];
    for (const f of Array.from(newFiles)) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (HEIC_EXTENSIONS.has(ext)) {
        onError(
          "HEIC 파일은 지원하지 않습니다. 아이폰 설정에서 JPG로 변경하거나 변환 후 업로드해주세요.",
        );
        return;
      }
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        onError(`"${f.name}" — 지원하지 않는 형식입니다.`);
        return;
      }
      if (f.size > 10 * 1024 * 1024) {
        onError(`"${f.name}" — 10MB를 초과합니다.`);
        return;
      }
      valid.push(f);
    }
    const merged = [...files, ...valid];
    if (merged.length > maxFiles) {
      onError(getUpgradeMessage(plan));
      return;
    }
    onFilesChange(merged);
    onError("");
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* 안내 박스 + 플랜 토글 */}
      <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 mb-2">
              💡 이용 안내
            </p>
            <ul className="text-xs text-blue-700 space-y-1 leading-relaxed">
              <li>• 하나의 계약서를 분석합니다</li>
              <li>
                • 계약서가 여러 장인 경우 모두 선택하면 하나로 합쳐서 분석됩니다
              </li>
              <li>
                • 서로 다른 계약서는 각각 따로 업로드해서 분석해주세요
              </li>
              <li>
                • 지원 형식: PDF, Word(.docx), Excel(.xlsx), 이미지(JPG, PNG)
              </li>
            </ul>
          </div>
          {/* 플랜 토글 (테스트용) */}
          <div className="flex gap-1 shrink-0">
            {(["free", "starter", "pro"] as Plan[]).map((p) => (
              <button
                key={p}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlanChange(p);
                }}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  plan === p
                    ? PLAN_BADGE[p].className + " ring-2 ring-offset-1 ring-blue-300"
                    : "bg-white text-slate-400 hover:text-slate-600"
                }`}
              >
                {PLAN_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 플랜 배지 + 파일 목록 */}
      {files.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">
              업로드된 파일 ({files.length}/{maxFiles})
            </span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="space-y-2">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <span className="text-sm font-bold px-2 py-0.5 rounded bg-slate-100">
                  {getFileIcon(f.name)}
                </span>
                <span className="text-sm text-slate-700 flex-1 truncate">
                  {f.name}
                </span>
                <span className="text-xs text-slate-400">
                  {(f.size / 1024).toFixed(0)}KB
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(i);
                  }}
                  className="text-slate-400 hover:text-red-500 text-lg leading-none px-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 드래그 앤 드롭 영역 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          onDraggingChange(true);
        }}
        onDragLeave={() => onDraggingChange(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDraggingChange(false);
          if (e.dataTransfer.files.length > 0)
            validateAndAdd(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-colors ${
          files.length > 0 ? "p-6" : "p-12"
        } ${
          dragging
            ? "border-blue-500 bg-blue-50"
            : files.length > 0
              ? "border-slate-300 bg-slate-50 hover:bg-slate-100"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0)
              validateAndAdd(e.target.files);
            e.target.value = "";
          }}
        />
        {dragging ? (
          <>
            <div className="text-4xl mb-3">📥</div>
            <p className="text-blue-600 font-medium">여기에 파일을 놓으세요</p>
          </>
        ) : files.length > 0 ? (
          <p className="text-slate-500 text-sm">
            클릭하거나 드래그하여 파일 추가 ({files.length}/{maxFiles})
          </p>
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-3">
              <span className="text-2xl font-bold px-2 py-1 rounded bg-red-50 text-red-500">
                PDF
              </span>
              <span className="text-2xl font-bold px-2 py-1 rounded bg-blue-50 text-blue-500">
                DOC
              </span>
              <span className="text-2xl font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-500">
                XLS
              </span>
              <span className="text-2xl font-bold px-2 py-1 rounded bg-purple-50 text-purple-500">
                IMG
              </span>
            </div>
            <p className="text-slate-600 font-medium">
              클릭하거나 파일을 드래그하세요
            </p>
            <p className="text-slate-400 text-sm mt-1">
              PDF, Word, Excel, 이미지(JPG, PNG) 형식 지원
            </p>
            <p className="text-slate-400 text-xs mt-0.5">
              최대 {maxFiles}개 · 10MB 이하
            </p>
          </>
        )}
      </div>
      {error && (
        <p className="mt-4 text-red-500 text-sm text-center">{error}</p>
      )}
    </>
  );
}
