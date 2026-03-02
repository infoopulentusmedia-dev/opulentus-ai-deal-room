const STORAGE_KEY = "opulentus_chat_sessions";
const MAX_SESSIONS = 3;

export interface ChatSession {
    id: string;
    headline: string;
    messages: { role: "user" | "model"; text: string; properties?: any[]; headline?: string }[];
    createdAt: number;
    updatedAt: number;
    buyboxSlug?: string;
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadSessions(): ChatSession[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const sessions: ChatSession[] = JSON.parse(raw);
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
    } catch {
        return [];
    }
}

export function saveSession(session: ChatSession): void {
    if (typeof window === "undefined") return;
    try {
        const sessions = loadSessions().filter(s => s.id !== session.id);
        sessions.unshift({ ...session, updatedAt: Date.now() });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
    } catch {
        // localStorage might be full
    }
}

export function createSession(headline?: string, buyboxSlug?: string): ChatSession {
    return {
        id: generateId(),
        headline: headline || "New Chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        buyboxSlug
    };
}

export function getSessionById(id: string): ChatSession | null {
    const sessions = loadSessions();
    return sessions.find(s => s.id === id) || null;
}
