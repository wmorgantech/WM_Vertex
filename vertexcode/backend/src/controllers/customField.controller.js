const prisma = require('../config/db');
const ApiError = require('../utils/apiError');
const { sendSuccess } = require('../utils/apiResponse');
const { recordAudit } = require('../utils/audit');

const ENTITY_TYPES = ['EMPLOYEE', 'INTERN', 'TRAINEE', 'COLLEGE', 'WORKSHOP'];
const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTISELECT', 'CHECKBOX', 'TEXTAREA'];

// GET /api/custom-fields?entityType=EMPLOYEE — definitions for one entity type
async function listDefinitions(req, res) {
  const { entityType } = req.query;
  if (entityType && !ENTITY_TYPES.includes(entityType)) throw new ApiError(400, 'Invalid entityType');
  const rows = await prisma.customFieldDefinition.findMany({
    where: { ...(entityType && { entityType }), active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  return sendSuccess(res, 200, rows);
}

// GET /api/custom-fields/all — every definition, incl. inactive (Super Admin config screen)
async function listAllDefinitions(req, res) {
  const rows = await prisma.customFieldDefinition.findMany({ orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }] });
  return sendSuccess(res, 200, rows);
}

async function createDefinition(req, res) {
  const { entityType, name, fieldType, options, required, sortOrder } = req.body;
  if (!entityType || !ENTITY_TYPES.includes(entityType)) throw new ApiError(400, 'A valid entityType is required');
  if (!name || !name.trim()) throw new ApiError(400, 'name is required');
  if (!fieldType || !FIELD_TYPES.includes(fieldType)) throw new ApiError(400, 'A valid fieldType is required');
  if (['DROPDOWN', 'MULTISELECT'].includes(fieldType) && (!Array.isArray(options) || options.length === 0)) {
    throw new ApiError(400, 'options are required for dropdown/multiselect fields');
  }

  const row = await prisma.customFieldDefinition.create({
    data: { entityType, name: name.trim(), fieldType, options: options || [], required: !!required, sortOrder: sortOrder ?? 0 },
  });
  await recordAudit({ actorId: req.user.id, action: 'CREATED', module: 'CUSTOM_FIELD', entityId: row.id, entityLabel: `${row.entityType}: ${row.name}`, after: row });
  return sendSuccess(res, 201, row);
}

async function updateDefinition(req, res) {
  const { name, fieldType, options, required, active, sortOrder } = req.body;
  const before = await prisma.customFieldDefinition.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Custom field not found');
  if (fieldType && !FIELD_TYPES.includes(fieldType)) throw new ApiError(400, 'Invalid fieldType');

  const row = await prisma.customFieldDefinition.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(fieldType !== undefined && { fieldType }),
      ...(options !== undefined && { options }),
      ...(required !== undefined && { required }),
      ...(active !== undefined && { active }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  await recordAudit({ actorId: req.user.id, action: 'UPDATED', module: 'CUSTOM_FIELD', entityId: row.id, entityLabel: `${row.entityType}: ${row.name}`, before, after: row });
  return sendSuccess(res, 200, row);
}

async function deleteDefinition(req, res) {
  const before = await prisma.customFieldDefinition.findUnique({ where: { id: req.params.id } });
  if (!before) throw new ApiError(404, 'Custom field not found');
  await prisma.customFieldDefinition.delete({ where: { id: req.params.id } }); // cascades CustomFieldValue rows
  await recordAudit({ actorId: req.user.id, action: 'DELETED', module: 'CUSTOM_FIELD', entityId: before.id, entityLabel: `${before.entityType}: ${before.name}`, before });
  return sendSuccess(res, 200, { message: 'Custom field removed' });
}

// GET /api/custom-fields/values?entityType=EMPLOYEE&entityId=... — definitions + this record's values, merged
async function getValues(req, res) {
  const { entityType, entityId } = req.query;
  if (!entityType || !ENTITY_TYPES.includes(entityType) || !entityId) {
    throw new ApiError(400, 'entityType and entityId are required');
  }
  const definitions = await prisma.customFieldDefinition.findMany({
    where: { entityType, active: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
  const values = await prisma.customFieldValue.findMany({
    where: { entityId, fieldId: { in: definitions.map((d) => d.id) } },
  });
  const valueByField = new Map(values.map((v) => [v.fieldId, v.value]));

  return sendSuccess(res, 200, definitions.map((d) => ({ ...d, value: valueByField.get(d.id) ?? null })));
}

// PUT /api/custom-fields/values — { entityType, entityId, values: [{ fieldId, value }] }
async function setValues(req, res) {
  const { entityType, entityId, values } = req.body;
  if (!entityType || !ENTITY_TYPES.includes(entityType) || !entityId || !Array.isArray(values)) {
    throw new ApiError(400, 'entityType, entityId and values are required');
  }

  const definitions = await prisma.customFieldDefinition.findMany({ where: { entityType, active: true } });
  const defById = new Map(definitions.map((d) => [d.id, d]));

  for (const v of values) {
    const def = defById.get(v.fieldId);
    if (!def) throw new ApiError(400, `Unknown field id: ${v.fieldId}`);
    if (def.required && (v.value === null || v.value === undefined || v.value === '')) {
      throw new ApiError(400, `${def.name} is required`);
    }
  }

  await prisma.$transaction(
    values.map((v) =>
      prisma.customFieldValue.upsert({
        where: { fieldId_entityId: { fieldId: v.fieldId, entityId } },
        update: { value: v.value === '' || v.value === undefined ? null : String(v.value) },
        create: { fieldId: v.fieldId, entityId, value: v.value === '' || v.value === undefined ? null : String(v.value) },
      })
    )
  );

  const updated = await prisma.customFieldValue.findMany({ where: { entityId, fieldId: { in: [...defById.keys()] } } });
  return sendSuccess(res, 200, updated);
}

module.exports = { listDefinitions, listAllDefinitions, createDefinition, updateDefinition, deleteDefinition, getValues, setValues };
