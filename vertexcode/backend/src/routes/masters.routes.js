const router = require('express').Router();
const authenticate = require('../middleware/auth');
const { isSuperAdmin } = require('../middleware/rbac');
const ctrl = require('../controllers/masters.controller');

router.use(authenticate);

// Reads are available to any authenticated user (needed to populate dropdowns
// in employee/user forms). Writes are Super-Admin-only configuration.
router.get('/designations', ctrl.listDesignations);
router.post('/designations', isSuperAdmin, ctrl.createDesignation);
router.put('/designations/:id', isSuperAdmin, ctrl.updateDesignation);
router.delete('/designations/:id', isSuperAdmin, ctrl.deleteDesignation);

router.get('/locations', ctrl.listLocations);
router.post('/locations', isSuperAdmin, ctrl.createLocation);
router.put('/locations/:id', isSuperAdmin, ctrl.updateLocation);
router.delete('/locations/:id', isSuperAdmin, ctrl.deleteLocation);

router.get('/employment-types', ctrl.listEmploymentTypes);
router.post('/employment-types', isSuperAdmin, ctrl.createEmploymentType);
router.put('/employment-types/:code', isSuperAdmin, ctrl.updateEmploymentType);
router.delete('/employment-types/:code', isSuperAdmin, ctrl.deleteEmploymentType);

router.get('/college-types', ctrl.listCollegeTypes);
router.post('/college-types', isSuperAdmin, ctrl.createCollegeType);
router.put('/college-types/:code', isSuperAdmin, ctrl.updateCollegeType);
router.delete('/college-types/:code', isSuperAdmin, ctrl.deleteCollegeType);

router.get('/task-types', ctrl.taskTypeCrud.list);
router.post('/task-types', isSuperAdmin, ctrl.taskTypeCrud.create);
router.put('/task-types/:code', isSuperAdmin, ctrl.taskTypeCrud.update);
router.delete('/task-types/:code', isSuperAdmin, ctrl.taskTypeCrud.remove);

router.get('/task-priorities', ctrl.taskPriorityCrud.list);
router.post('/task-priorities', isSuperAdmin, ctrl.taskPriorityCrud.create);
router.put('/task-priorities/:code', isSuperAdmin, ctrl.taskPriorityCrud.update);
router.delete('/task-priorities/:code', isSuperAdmin, ctrl.taskPriorityCrud.remove);

router.get('/task-statuses', ctrl.taskStatusCrud.list);
router.post('/task-statuses', isSuperAdmin, ctrl.taskStatusCrud.create);
router.put('/task-statuses/:code', isSuperAdmin, ctrl.taskStatusCrud.update);
router.delete('/task-statuses/:code', isSuperAdmin, ctrl.taskStatusCrud.remove);

router.get('/timesheet-statuses', ctrl.timesheetStatusCrud.list);
router.post('/timesheet-statuses', isSuperAdmin, ctrl.timesheetStatusCrud.create);
router.put('/timesheet-statuses/:code', isSuperAdmin, ctrl.timesheetStatusCrud.update);
router.delete('/timesheet-statuses/:code', isSuperAdmin, ctrl.timesheetStatusCrud.remove);

router.get('/leave-types', ctrl.leaveTypeCrud.list);
router.post('/leave-types', isSuperAdmin, ctrl.leaveTypeCrud.create);
router.put('/leave-types/:code', isSuperAdmin, ctrl.leaveTypeCrud.update);
router.delete('/leave-types/:code', isSuperAdmin, ctrl.leaveTypeCrud.remove);

router.get('/expense-categories', ctrl.expenseCategoryCrud.list);
router.post('/expense-categories', isSuperAdmin, ctrl.expenseCategoryCrud.create);
router.put('/expense-categories/:code', isSuperAdmin, ctrl.expenseCategoryCrud.update);
router.delete('/expense-categories/:code', isSuperAdmin, ctrl.expenseCategoryCrud.remove);

module.exports = router;
