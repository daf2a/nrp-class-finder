import puppeteer, { Browser } from 'puppeteer';

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({ 
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized']
        });
    }
    return browserInstance;
}

export async function getMyITSSession(): Promise<string> {
    const browser = await getBrowser();
    const pages = await browser.pages();
    const page = pages.length ? pages[0] : await browser.newPage();
    
    try {
        // Check if already logged in
        await page.goto('https://akademik.its.ac.id/home.php');
        const content = await page.content();
        
        // If not logged in, do login process
        if (content.includes('myitsauth.php')) {
            await page.goto('https://akademik.its.ac.id/myitsauth.php', {
                waitUntil: 'networkidle0'
            });
            
            // Wait for successful login
            await page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 60000
            });
        }

        const cookies = await page.cookies();
        const sessionCookie = cookies.find(c => c.name === 'PHPSESSID');

        if (!sessionCookie) {
            throw new Error('Session cookie not found');
        }

        return sessionCookie.value;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

export async function cleanup() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

export async function verifySession(sessionId: string): Promise<boolean> {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    try {
        await page.setCookie({
            name: 'PHPSESSID',
            value: sessionId,
            domain: 'akademik.its.ac.id'
        });

        const response = await page.goto('https://akademik.its.ac.id/home.php');
        const content = await response?.text() || '';
        
        await page.close();
        return !content.includes('myitsauth.php');
    } catch (err) {
        const error = err as Error;
        console.error('Session verification error:', error.message);
        await page.close();
        return false;
    }
}
