const puppeteer = require('puppeteer');

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    let errorsFound = false;

    // Listen for all console logs
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.error(`[Browser Console Error] ${msg.text()}`);
            errorsFound = true;
        }
    });

    // Listen for uncaught exceptions
    page.on('pageerror', err => {
        console.error(`[Browser Page Error] ${err.toString()}`);
        errorsFound = true;
    });

    try {
        console.log('Navigating to live Vercel app...');
        await page.goto('https://opulentus.vercel.app', { waitUntil: 'networkidle0', timeout: 30000 });

        console.log('Waiting for potential delayed client-side hydration errors...');
        await new Promise(r => setTimeout(r, 5000));

        if (!errorsFound) {
            console.log('Navigating to Morning Brief...');
            await page.goto('https://opulentus.vercel.app/morning-brief', { waitUntil: 'networkidle0', timeout: 30000 });
            await new Promise(r => setTimeout(r, 5000));
        }

    } catch (err) {
        console.error('[Navigation Script Error]', err);
    }

    if (!errorsFound) {
        console.log('No client-side Javascript errors detected during the test.');
    }

    await browser.close();
    process.exit(0);
})();
