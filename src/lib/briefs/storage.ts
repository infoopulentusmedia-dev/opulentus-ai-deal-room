/**
 * Supabase Storage helpers for per-agent brief files.
 *
 * Brief files live at `briefs/{agentId}/{clientId}.json`, with a
 * `briefs/{agentId}/manifest.json` index listing all of that agent's
 * client briefs. The `briefs` bucket is private — these helpers use
 * the service role key to bypass RLS.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const authHeaders = () => ({
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
});

export interface BriefManifest {
    generatedAt?: string;
    lastUpdated?: string;
    clientIds: string[];
    clientNames: Record<string, string>;
}

/** Delete a single brief file. Best-effort — swallows errors. */
export async function deleteBriefFile(agentId: string, clientId: string): Promise<void> {
    try {
        await fetch(
            `${SUPABASE_URL}/storage/v1/object/briefs/${agentId}/${clientId}.json`,
            { method: "DELETE", headers: authHeaders() },
        );
    } catch {
        /* non-fatal */
    }
}

/** Read an agent's manifest. Returns an empty manifest if missing. */
export async function readManifest(agentId: string): Promise<BriefManifest> {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/storage/v1/object/briefs/${agentId}/manifest.json?t=${Date.now()}`,
            { headers: authHeaders(), cache: "no-store" },
        );
        if (!res.ok) return { clientIds: [], clientNames: {} };
        return (await res.json()) as BriefManifest;
    } catch {
        return { clientIds: [], clientNames: {} };
    }
}

/** Overwrite an agent's manifest. PUT first, fall back to POST (create). */
export async function writeManifest(agentId: string, manifest: BriefManifest): Promise<void> {
    const body = JSON.stringify(manifest);
    const headers = { ...authHeaders(), "Content-Type": "application/json" };
    const url = `${SUPABASE_URL}/storage/v1/object/briefs/${agentId}/manifest.json`;

    const put = await fetch(url, { method: "PUT", headers, body });
    if (put.ok) return;

    const post = await fetch(url, { method: "POST", headers, body });
    if (!post.ok) {
        const text = await post.text();
        throw new Error(`Manifest write failed for ${agentId}: ${post.status} ${text}`);
    }
}

/**
 * Remove a client from an agent's brief storage: delete the brief JSON,
 * prune from the manifest. Safe to call when the files/manifest don't
 * exist — cleanup runs best-effort so it never blocks a DB delete.
 */
export async function removeClientFromBriefs(agentId: string, clientId: string): Promise<void> {
    await deleteBriefFile(agentId, clientId);

    const manifest = await readManifest(agentId);
    if (!manifest.clientIds.includes(clientId) && !(clientId in manifest.clientNames)) {
        return;
    }

    const nextNames = { ...manifest.clientNames };
    delete nextNames[clientId];

    await writeManifest(agentId, {
        ...manifest,
        lastUpdated: new Date().toISOString(),
        clientIds: manifest.clientIds.filter(id => id !== clientId),
        clientNames: nextNames,
    });
}
