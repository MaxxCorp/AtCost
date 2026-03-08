const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];

  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[error] ${err.name}: ${err.message}`));

  await page.goto('http://localhost:5174/contacts');
  await page.waitForTimeout(2000);

  // Click the "New Contact" button if it exists
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await b.textContent();
    if (text && text.includes('New Contact')) {
      await b.click();
      break;
    }
  }

  await page.waitForTimeout(1000);
  console.log(logs.join('\n'));
  await browser.close();
})();
