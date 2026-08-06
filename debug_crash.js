const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    page.on('requestfailed', request => console.log('NETWORK_FAIL:', request.url(), request.failure()?.errorText));

    const email = `test${Date.now()}@example.com`;
    const password = 'Password123!';

    console.log('Registering user...');
    await page.goto('http://localhost:3000/register', { waitUntil: 'networkidle2' });
    
    await page.type('input[type="text"]', 'Test User');
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => console.log("Navigation timeout"));

    console.log('Going to /wishlist/movies...');
    await page.goto('http://localhost:3000/wishlist/movies', { waitUntil: 'networkidle2' });
    
    console.log('Waiting 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));

    console.log('Clicking Discovery...');
    try {
        const links = await page.$$('a');
        let clicked = false;
        for (const link of links) {
            const text = await page.evaluate(el => el.textContent, link);
            if (text.includes('Discovery') || text.includes('DISCOVERY')) {
                await link.click();
                clicked = true;
                break;
            }
        }
        if (!clicked) console.log('Could not find Discovery link');
    } catch (e) {
        console.log('Error clicking Discovery:', e);
    }

    console.log('Waiting 5 seconds...');
    await new Promise(r => setTimeout(r, 5000));
    
    await browser.close();
})();
