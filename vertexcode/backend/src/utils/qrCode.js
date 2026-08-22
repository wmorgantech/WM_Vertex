const QRCode = require('qrcode');

function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, { margin: 1, width: 180, color: { dark: '#111827', light: '#ffffff' } });
}

module.exports = { generateQrDataUrl };
