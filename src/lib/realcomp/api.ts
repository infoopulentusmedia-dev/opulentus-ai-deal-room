export async function getRealCompToken() {
    const tokenUrl = process.env.REALCOMP_OAUTH_TOKEN_URL;
    const clientId = process.env.REALCOMP_CLIENT_ID;
    const clientSecret = process.env.REALCOMP_CLIENT_SECRET;
    const scope = process.env.REALCOMP_SCOPE;

    if (!tokenUrl || !clientId || !clientSecret || !scope) {
        throw new Error('Missing RealComp OAuth credentials in environment.');
    }

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            grant_type: process.env.REALCOMP_AUTH_MODE || 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            audience: scope
        }),
        cache: 'no-store',
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to fetch RealComp token: ${response.status} ${errText}`);
    }

    const data = await response.json();
    return data.access_token;
}

export async function fetchRealCompProperties({ top = 5, skip = 0, filter = '' } = {}) {
    const token = await getRealCompToken();
    const baseUrl = process.env.REALCOMP_API_BASE_URL;

    if (!baseUrl) {
        throw new Error('Missing REALCOMP_API_BASE_URL');
    }

    const propertyUrl = new URL('Property', baseUrl);
    propertyUrl.searchParams.append('$top', top.toString());
    propertyUrl.searchParams.append('$skip', skip.toString());

    if (filter) {
        propertyUrl.searchParams.append('$filter', filter);
    }

    console.log('[RealComp] Fetching:', propertyUrl.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout

    let response;
    try {
        response = await fetch(propertyUrl.toString(), {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
                // RESO Web API requires OData-Version header to be specified
                'OData-Version': '4.0',
                'OData-MaxVersion': '4.0'
            },
            cache: 'no-store', // Avoid Vercel's 2MB Edge Cache limit crash
            signal: controller.signal
        });
    } catch (e: any) {
        if (e.name === 'AbortError') {
            throw new Error('RealComp API request timed out after 10 seconds');
        }
        throw e;
    } finally {
        clearTimeout(timeoutId);
    }

    if (!response.ok) {
        const errText = await response.text();
        console.error('[RealComp] Error:', response.status, errText.slice(0, 500));
        throw new Error(`Failed to fetch properties from RealComp: ${response.status} ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    console.log(`[RealComp Debug] Status: ${response.status}`);
    console.log(`[RealComp Debug] Parsed JSON keys: ${Object.keys(data).join(', ')}`);
    console.log(`[RealComp Debug] First item keys: ${data.value && data.value.length > 0 ? Object.keys(data.value[0]).slice(0, 10).join(', ') : 'NONE'}`);
    console.log(`[RealComp Debug] Raw Output Snapshot:`, JSON.stringify(data).slice(0, 500));
    console.log(`[RealComp] Got ${data.value?.length || 0} properties`);
    return data;
}
