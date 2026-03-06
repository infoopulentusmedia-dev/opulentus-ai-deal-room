import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        environment: process.env.NODE_ENV,
        keys: {
            has_APIFY_API_TOKEN: !!process.env.APIFY_API_TOKEN,
            has_REALCOMP_CLIENT_ID: !!process.env.REALCOMP_CLIENT_ID,
            has_REALCOMP_CLIENT_SECRET: !!process.env.REALCOMP_CLIENT_SECRET,
            has_REALCOMP_OAUTH_TOKEN_URL: !!process.env.REALCOMP_OAUTH_TOKEN_URL,
            has_REALCOMP_API_BASE_URL: !!process.env.REALCOMP_API_BASE_URL,
            has_REALCOMP_SCOPE: !!process.env.REALCOMP_SCOPE,
        },
        instructions: "If any of these are false on Vercel, you must manually add them to the Vercel Dashboard -> Settings -> Environment Variables."
    });
}
