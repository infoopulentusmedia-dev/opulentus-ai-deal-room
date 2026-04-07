import { NextResponse } from "next/server";
import { fetchRealCompProperties } from "@/lib/realcomp/api";
import { isRealcompCompliant } from "@/lib/realcomp/mapper";

export async function GET() {
    try {
        const data = await fetchRealCompProperties({ top: 5, filter: "StandardStatus eq 'Active'" });
        const raw = data?.value || [];
        const compliant = raw.filter(isRealcompCompliant);
        return NextResponse.json({
            raw_count: raw.length,
            compliant_count: compliant.length,
            sample: raw[0] ? {
                StandardStatus: raw[0].StandardStatus,
                InternetEntireListingDisplayYN: raw[0].InternetEntireListingDisplayYN,
                SyndicateTo: raw[0].SyndicateTo,
                ListPrice: raw[0].ListPrice,
                UnparsedAddress: raw[0].UnparsedAddress,
            } : null
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
