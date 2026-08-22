const path = require('path');
const puppeteer = require('puppeteer');
const { renderTemplate } = require('../utils/renderTemplate');

const TEMPLATE_DIR = path.join(__dirname, '../templates/pdf');

// A single shared Chromium instance, launched lazily on first use and reused
// for every PDF render — launching per-request would be far too slow/expensive.
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

async function renderHtmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The HTML is fully self-contained (inline CSS, data-URI QR images) — no
    // external network requests are ever made, so 'networkidle0' has nothing
    // to wait for and is flaky/slow in practice. 'domcontentloaded' is both
    // correct and fast here.
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
  } finally {
    await page.close();
  }
}

function renderPdfTemplate(name, vars) {
  return renderTemplate(TEMPLATE_DIR, name, vars);
}

async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    browserPromise = null;
    await browser.close();
  }
}

function warmBrowser() {
  return getBrowser();
}

module.exports = { renderHtmlToPdf, renderPdfTemplate, closeBrowser, warmBrowser };
