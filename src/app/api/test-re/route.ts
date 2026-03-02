import { NextResponse } from "next/server";
import { getRealCompToken } from "@/lib/realcomp/api";

export async function GET() {
    try {
        const token = await getRealCompToken();
        const baseUrl = 'https://apiidx.realcomp.com/odata';

        const res = await fetch(baseUrl + '/Property?$top=1', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'OData-Version': '4.0',
                'OData-MaxVersion': '4.0',
                'Accept': 'application/json',
                'Host': 'rcapi.realcomp.com'
            }
        });

        if (res.ok) {
            const data = await res.json();
            return NextResponse.json({ success: true, count: data.value?.length || 0, headerOverride: true });
        } else {
            const txt = await res.text();
            return NextResponse.json({ success: false, status: res.status, preview: txt.slice(0, 200) });
        }
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message });
    }
}
