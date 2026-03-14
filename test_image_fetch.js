const url = "https://images1.loopnet.com/i2/6sPTfHnTYojHiezdpQaFQ6q_Fw6a05kFHLtBH2TiIWw/674x462/image.jpg";
fetch(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.loopnet.com/'
    }
}).then(res => {
    console.log("Status:", res.status);
    console.log("Headers:", res.headers);
}).catch(console.error);
