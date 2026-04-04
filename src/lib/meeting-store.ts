export interface ActionItem {
  task: string;
  assignee: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  done: boolean;
}

export interface MeetingRecord {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  meetingType: string;
  summary: string;
  bulletPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  nextAgenda: string[];
  fullMinutes: string;
  createdAt: string;
}

const KEY = "aitory_meetings";

export function getMeetings(): MeetingRecord[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

function persist(list: MeetingRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveMeeting(m: MeetingRecord): void {
  const list = getMeetings();
  list.unshift(m);
  persist(list);
}

export function deleteMeeting(id: string): void {
  persist(getMeetings().filter((m) => m.id !== id));
}

export function updateMeeting(m: MeetingRecord): void {
  persist(getMeetings().map((x) => (x.id === m.id ? m : x)));
}

export function getMeetingById(id: string): MeetingRecord | undefined {
  return getMeetings().find((m) => m.id === id);
}
