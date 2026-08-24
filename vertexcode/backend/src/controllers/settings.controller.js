const prisma = require('../config/db');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

// GET /api/settings — company identity used on generated documents.
// Readable by any authenticated user (offer-letter/certificate rendering
// context needs it); only Super Admin can change it.
async function getSettings(req, res) {
  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return sendSuccess(res, 200, settings);
}

// PUT /api/settings
async function updateSettings(req, res) {
  const { companyName, companyAddress, companyLogoUrl, signatoryName, signatoryTitle } = req.body;
  const before = await prisma.appSettings.findUnique({ where: { id: 1 } });

  const settings = await prisma.appSettings.upsert({
    where: { id: 1 },
    update: { companyName, companyAddress, companyLogoUrl, signatoryName, signatoryTitle },
    create: { id: 1, companyName, companyAddress, companyLogoUrl, signatoryName, signatoryTitle },
  });

  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'APP_SETTINGS', entityId: '1', entityLabel: 'Company document settings', before, after: settings });
  return sendSuccess(res, 200, settings);
}

module.exports = { getSettings, updateSettings };
