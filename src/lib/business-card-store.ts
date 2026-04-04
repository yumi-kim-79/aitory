export interface BusinessCard {
  id: string;
  imageData: string; // base64
  name: string;
  company: string;
  title: string;
  department: string;
  phones: string[];
  emails: string[];
  address: string;
  website: string;
  sns: Record<string, string>;
  tags: string[];
  memo: string;
  lastContact: string;
  createdAt: string;
}

const KEY = "aitory_business_cards";

export function getCards(): BusinessCard[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

function persist(cards: BusinessCard[]) {
  localStorage.setItem(KEY, JSON.stringify(cards));
}

export function saveCard(card: BusinessCard): void {
  const list = getCards();
  list.unshift(card);
  persist(list);
}

export function updateCard(card: BusinessCard): void {
  const list = getCards().map((c) => (c.id === card.id ? card : c));
  persist(list);
}

export function deleteCard(id: string): void {
  persist(getCards().filter((c) => c.id !== id));
}

export function getCardById(id: string): BusinessCard | undefined {
  return getCards().find((c) => c.id === id);
}

export function searchCards(query: string): BusinessCard[] {
  const q = query.toLowerCase();
  return getCards().filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.emails.some((e) => e.toLowerCase().includes(q)) ||
      c.phones.some((p) => p.includes(q)),
  );
}

export function generateVCard(card: BusinessCard): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${card.name}`,
    `ORG:${card.company}`,
    `TITLE:${card.title}`,
  ];
  for (const p of card.phones) lines.push(`TEL:${p}`);
  for (const e of card.emails) lines.push(`EMAIL:${e}`);
  if (card.address) lines.push(`ADR:;;${card.address};;;`);
  if (card.website) lines.push(`URL:${card.website}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}
