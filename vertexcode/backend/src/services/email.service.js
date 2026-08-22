const path = require('path');
const nodemailer = require('nodemailer');
const { renderTemplate } = require('../utils/renderTemplate');

const TEMPLATE_DIR = path.join(__dirname, '../templates/emails');

// Generic SMTP transport — Gmail and Brevo (and any other provider) both speak
// standard SMTP, so switching providers later is purely an .env change; no
// business logic here references a specific provider.
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

/**
 * Sends an email. Never throws — a failed send is logged and swallowed so it
 * can never block or fail the underlying business action (document rejection,
 * approval, PDF generation, etc. must succeed even if SMTP is down).
 */
async function sendMail({ to, subject, html, attachments }) {
  try {
    await getTransporter().sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'VertexWM'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[email.service] Failed to send "${subject}" to ${to}:`, err.message);
  }
}

function renderEmailTemplate(name, vars) {
  return renderTemplate(TEMPLATE_DIR, name, vars);
}

module.exports = { sendMail, renderEmailTemplate };
