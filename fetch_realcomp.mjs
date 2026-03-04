import fetch from 'node-fetch';

async function testRealcomp() {
    const tokenUrl = 'https://auth.realcomp.com/Token';
    const clientId = 'stcl_7ee9ca94-e8da-4205-8534-9cf4aafec784';
    const clientSecret = '4J8_kzO8S2WjdmCOfymoIuOEvI';
    const scope = 'rcapi.realcomp.com';

    console.log('Fetching token...');
    try {
        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
                audience: scope
            })
        });

        if (!tokenRes.ok) {
            console.error('Token fetch failed:', await tokenRes.text());
            return;
        }

        const tokenData = await tokenRes.json();
        const token = tokenData.access_token;
        console.log('Got token. Fetching properties...');

        // Fetch 3 properties
        const propUrl = 'https://idxapi.realcomp.com/odata/Property?$top=3';

        const propRes = await fetch(propUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'OData-Version': '4.0',
                'OData-MaxVersion': '4.0'
            }
        });

        if (!propRes.ok) {
            console.error('Property fetch failed:', await propRes.text());
            return;
        }

        const data = await propRes.json();
        console.log('--- SAMPLE REALCOMP DATA ---');
        console.log(JSON.stringify(data.value, null, 2));

    } catch (err) {
        console.error('Error:', err);
    }
}

testRealcomp();
