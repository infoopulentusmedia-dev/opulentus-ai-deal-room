const fetch = require('node-fetch');

async function testProperty(address) {
    const mapKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!mapKey) {
        console.error("Missing GOOGLE_MAPS_API_KEY");
        return;
    }

    const encodedAddress = encodeURIComponent(address);
    console.log(`\nTesting Address: ${address}`);
    
    try {
        const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodedAddress}&key=${mapKey}`;
        const metaRes = await fetch(metaUrl);
        const metaData = await metaRes.json();
        
        console.log(`Google Meta Status: ${metaData.status}`);
        
        let finalUrl = '';
        if (metaData.status === 'OK') {
            console.log("✅ Result: Using standard Street View (Imagery Exists)");
            finalUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${encodedAddress}&key=${mapKey}`;
        } else {
            console.log("⚠️ Result: Using HYBRID SATELLITE MAP (No Street View Imagery)");
            const markerFormat = encodeURIComponent(`color:0xD4AF37|${address}`);
            finalUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=18&size=600x300&maptype=hybrid&markers=${markerFormat}&key=${mapKey}`;
        }
        
        console.log(`Final Image URL: ${finalUrl}`);
    } catch (e) {
        console.error("Error:", e);
    }
}

async function runTests() {
    // 1. A normal city building (Should have Street View)
    await testProperty("3100 Brush St, Detroit, MI");
    
    // 2. A vacant lot / private road (Should trigger Hybrid Satellite Map)
    await testProperty("00 Oak Hollow Dr, Holly, MI");
}

runTests();
