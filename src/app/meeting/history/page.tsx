"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getMeetings, deleteMeeting, type MeetingRecord } from "@/lib/meeting-store";

export default function MeetingHistoryPage() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);

  useEffect(() => {
    setMeetings(getMeetings());
  }, []);

  const handleDelete = (id: string) => {
    deleteMeeting(id);
    setMeetings(getMeetings());
  };

  return (
    <div className="flex flex-col flex-1 items-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <Link href="/meeting" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm mb-6 transition-colors">&larr; 회의록 만들기</Link>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">회의록 이력</h1>

        {meetings.length === 0 ? (
          <p className="text-center text-slate-400 py-12">생성한 회의록이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-4 p-5 bg-white rounded-xl border border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900 truncate">{m.title}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{m.meetingType}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {m.date} · {m.attendees.join(", ")} · 액션아이템 {m.actionItems.length}개
                  </p>
                </div>
                <button onClick={() => handleDelete(m.id)} className="text-slate-400 hover:text-red-500 text-sm px-2">삭제</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
