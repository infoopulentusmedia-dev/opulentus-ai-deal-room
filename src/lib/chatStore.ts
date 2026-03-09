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

export async function loadSessions(clientId?: string): Promise<ChatSession[]> {
    try {
        const url = clientId ? `/api/chat-sessions?clientId=${clientId}` : `/api/chat-sessions`;
        const res = await fetch(url);
        if (!res.ok) return [];

        const data = await res.json();
        if (!Array.isArray(data)) return [];

        return data.map((row: any) => ({
            ...row.chat_json,
            updatedAt: new Date(row.updated_at).getTime()
        } as ChatSession));
    } catch {
        return [];
    }
}

export async function saveSession(session: ChatSession, clientId?: string): Promise<void> {
    try {
        const payload = {
            session: { ...session, updatedAt: Date.now() },
            clientId: clientId || session.buyboxSlug || 'global'
        };

        await fetch('/api/chat-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Failed to sync chat session to Supabase:", e);
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

export async function getSessionById(id: string): Promise<ChatSession | null> {
    try {
        const sessions = await loadSessions();
        return sessions.find(s => s.id === id) || null;
    } catch {
        return null;
    }
}
