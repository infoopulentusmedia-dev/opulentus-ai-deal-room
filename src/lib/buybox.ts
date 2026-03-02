export const PERSONAL_BUYBOX_ID = "my-personal-buybox";

export interface BuyBoxCriteria {
    id: string; // unique slug like "ali-beydoun"
    name: string; // readable name like "Ali Beydoun"
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

export function saveClientBuyBox(criteria: BuyBoxCriteria) {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("opulentus_clients");
        const clients: Record<string, BuyBoxCriteria> = stored ? JSON.parse(stored) : {};
        clients[criteria.id] = criteria;
        localStorage.setItem("opulentus_clients", JSON.stringify(clients));
    }
}

export function loadClientBuyBox(id: string): BuyBoxCriteria | null {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("opulentus_clients");
        if (stored) {
            try {
                const clients: Record<string, BuyBoxCriteria> = JSON.parse(stored);
                return clients[id] || null;
            } catch (e) {
                console.error("Failed to parse stored clients", e);
            }
        }
    }
    return null;
}

export function loadAllClients(): BuyBoxCriteria[] {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("opulentus_clients");
        if (stored) {
            try {
                const clients: Record<string, BuyBoxCriteria> = JSON.parse(stored);
                return Object.values(clients);
            } catch (e) {
                console.error("Failed to parse stored clients", e);
            }
        }
    }
    return [];
}

export function loadPersonalBuyBox(): BuyBoxCriteria | null {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("opulentus_clients");
        if (stored) {
            try {
                const clients: Record<string, BuyBoxCriteria> = JSON.parse(stored);
                return clients[PERSONAL_BUYBOX_ID] || null;
            } catch (e) {
                console.error("Failed to load personal buy box", e);
            }
        }
    }
    return null;
}

export function saveBuyBox(criteria: BuyBoxCriteria) {
    if (typeof window !== "undefined") {
        localStorage.setItem("opulentus_buybox", JSON.stringify(criteria));
    }
}

export function loadBuyBox(): BuyBoxCriteria | null {
    if (typeof window !== "undefined") {
        const stored = localStorage.getItem("opulentus_buybox");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse stored buybox", e);
            }
        }
    }
    return null;
}
