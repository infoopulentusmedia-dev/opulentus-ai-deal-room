import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from './server';

/**
 * Extract the authenticated agent's user ID from the request cookies.
 * Returns { agentId } on success, or a NextResponse error to return immediately.
 */
export async function requireAgent(): Promise<
    { agentId: string; error?: never } | { agentId?: never; error: NextResponse }
> {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            error: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    return { agentId: user.id };
}
