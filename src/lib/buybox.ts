export const PERSONAL_BUYBOX_ID = "my-personal-buybox";
export const GLOBAL_BUYBOX_ID = "global";

export interface BuyBoxCriteria {
    id: string; // unique slug like "ali-beydoun"
    name: string; // readable name like "Ali Beydoun"
    email?: string; // client email for daily blast delivery
    propertyType: string;
    transactionType: string;
    location: string;
    priceMin: string;
    priceMax: string;
    sizeMin: string;
    sizeMax: string;
    specialCriteria: string;
    portfolioHoldings?: string; // Step 12: Existing client assets
}

export const defaultBuyBox: BuyBoxCriteria = {
    id: "",
    name: "",
    propertyType: "",
    transactionType: "",
    location: "",
    priceMin: "",
    priceMax: "",
    sizeMin: "",
    sizeMax: "",
    specialCriteria: ""
};

export async function saveClientBuyBox(criteria: BuyBoxCriteria): Promise<void> {
    try {
        // Extract email so it goes into the dedicated column, not inside buy_box_json
        const { email, ...buyBoxFields } = criteria;
        const payload: any = { ...buyBoxFields };
        if (email !== undefined) {
            payload.email = email;
        }
        await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Failed to sync client to Supabase:", e);
    }
}

export async function loadClientBuyBox(id: string): Promise<BuyBoxCriteria | null> {
    try {
        const res = await fetch('/api/clients');
        if (!res.ok) return null;
        const clients = await res.json();
        const client = clients.find((c: any) => c.id === id);
        if (client && client.buy_box_json) {
            return {
                id: client.id,
                name: client.name,
                ...client.buy_box_json
            } as BuyBoxCriteria;
        }
    } catch (e) {
        console.error("Failed to load client from Supabase:", e);
    }
    return null;
}

export async function loadAllClients(): Promise<BuyBoxCriteria[]> {
    try {
        const res = await fetch('/api/clients');
        if (!res.ok) return getDefaultClientFallback();
        const clients = await res.json();

        if (!clients || clients.length === 0) {
            return getDefaultClientFallback();
        }

        return clients.map((c: any) => ({
            id: c.id,
            name: c.name,
            email: c.email || '',
            ...c.buy_box_json
        } as BuyBoxCriteria));
    } catch (e) {
        console.error("Failed to parse stored clients", e);
        return getDefaultClientFallback();
    }
}

function getDefaultClientFallback(): BuyBoxCriteria[] {
    const defaultClient: BuyBoxCriteria = {
        id: "ali-beydoun",
        name: "Ali Beydoun",
        propertyType: "Strip Center / Retail Plaza",
        transactionType: "Buy",
        location: "Wayne County",
        priceMin: "",
        priceMax: "5000000",
        sizeMin: "",
        sizeMax: "",
        specialCriteria: "Value-add opportunities, power centers, or distressed plazas.",
        portfolioHoldings: ""
    };
    return [defaultClient];
}

export async function loadPersonalBuyBox(): Promise<BuyBoxCriteria | null> {
    return loadClientBuyBox(PERSONAL_BUYBOX_ID);
}

export async function saveBuyBox(criteria: BuyBoxCriteria): Promise<void> {
    const globalCriteria = { ...criteria, id: GLOBAL_BUYBOX_ID, name: "Global Feed" };
    return saveClientBuyBox(globalCriteria);
}

export async function loadBuyBox(): Promise<BuyBoxCriteria | null> {
    const box = await loadClientBuyBox(GLOBAL_BUYBOX_ID);
    if (!box) {
        // Provide a default empty one for the global feed
        return { ...defaultBuyBox, id: GLOBAL_BUYBOX_ID, name: "Global Feed", location: "Global", propertyType: "All" };
    }
    return box;
}
