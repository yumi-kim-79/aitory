export type Plan = "free" | "starter" | "pro";

export const PLAN_LIMITS = {
  free: { maxFiles: 3, analysisPerMonth: 10 },
  starter: { maxFiles: 10, analysisPerMonth: 100 },
  pro: { maxFiles: 20, analysisPerMonth: 999 },
} as const;

export const PLAN_LABELS: Record<Plan, string> = {
  free: "무료 체험",
  starter: "스타터",
  pro: "PRO",
};

export function getPlan(): Plan {
  if (typeof window === "undefined") return "free";
  return (localStorage.getItem("aitory_plan") as Plan) || "free";
}

export function setPlan(plan: Plan): void {
  localStorage.setItem("aitory_plan", plan);
}
