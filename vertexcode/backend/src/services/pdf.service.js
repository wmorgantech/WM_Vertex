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

// `headerTemplate`/`footerTemplate` (Puppeteer's own repeating-per-page
// mechanism — a separate, isolated rendering context from the body HTML, so
// styles must be inline) are opt-in: omitted, behavior is byte-identical to
// before for every existing caller. Passing one requires non-zero top/bottom
// `margin` (the body content's page area is inset by that margin, leaving
// room for the repeating header/footer to actually be visible instead of
// overlapping the content).
async function renderHtmlToPdf(html, { headerTemplate, footerTemplate, margin } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // The HTML is fully self-contained (inline CSS, data-URI QR images) — no
    // external network requests are ever made, so 'networkidle0' has nothing
    // to wait for and is flaky/slow in practice. 'domcontentloaded' is both
    // correct and fast here.
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    const displayHeaderFooter = !!(headerTemplate || footerTemplate);
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: margin || { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      ...(displayHeaderFooter && {
        displayHeaderFooter: true,
        headerTemplate: headerTemplate || '<span></span>',
        footerTemplate: footerTemplate || '<span></span>',
      }),
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
