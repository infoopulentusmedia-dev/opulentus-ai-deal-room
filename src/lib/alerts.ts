export interface AlertCriteria {
    id: string;
    clientEmail: string;
    platforms: {
        crexi: {
            enabled: boolean;
            predefined: string; // e.g. "Value-Add Retail", "Distressed"
            customInstruction: string;
        };
        loopnet: {
            enabled: boolean;
            predefined: string;
            customInstruction: string;
        };
        mls: {
            enabled: boolean;
            predefined: string;
            customInstruction: string;
        };
    };
    sendFrequency: "daily" | "weekly";
    minMatchScore: number;
}

const STORAGE_KEY = "opulentus_alert_preferences";

export async function loadAlerts(): Promise<Record<string, AlertCriteria>> {
    try {
        const res = await fetch('/api/clients');
        if (!res.ok) return {};
        const clients = await res.json();

        const alertsObj: Record<string, AlertCriteria> = {};
        for (const c of clients) {
            if (c.alert_preferences_json) {
                const alertId = c.id || c.name.toLowerCase().replace(/\s+/g, '-');
                alertsObj[alertId] = {
                    ...c.alert_preferences_json,
                    id: alertId
                };
            }
        }
        return alertsObj;
    } catch {
        return {};
    }
}

export async function saveAlert(alert: AlertCriteria): Promise<void> {
    try {
        // Derive name from id "ali-beydoun" -> "Ali Beydoun", "global" -> "Global"
        const friendlyName = alert.id === 'global' ? 'Global' :
            alert.id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        const payload = {
            id: alert.id,
            name: friendlyName,
            alert_preferences_json: alert
        };

        await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error("Failed to sync alert preferences to Supabase:", e);
    }
}

export async function getAlert(id: string): Promise<AlertCriteria | null> {
    const alerts = await loadAlerts();
    return alerts[id] || null;
}
