import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session (important for cookie-based auth)
    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Allow these paths without auth
    const publicPaths = ['/login', '/shared'];
    const isPublic = publicPaths.some(p => pathname.startsWith(p));
    const isApi = pathname.startsWith('/api'); // API routes handle their own auth (requireAgent or cron-secret)
    const isStatic = pathname.startsWith('/_next') || pathname.startsWith('/favicon');

    if (!user && !isPublic && !isApi && !isStatic) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // If user is logged in and tries to go to /login, redirect to dashboard
    if (user && pathname === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        // Match all paths except static files and images
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
