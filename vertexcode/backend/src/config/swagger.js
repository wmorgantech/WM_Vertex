const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

// Schema-only documentation, generated from code structure — never contains
// real credentials, secrets, or user data. Safe to expose in production; it
// only describes the API shape, it doesn't bypass or weaken auth (every
// protected route documented with `security: [bearerAuth]` still goes
// through the exact same `authenticate` middleware as always).
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'VertexWM API',
      version: '1.0.0',
      description:
        'Smart Employee & Internship Management Platform — REST API.\n\n' +
        'To test a protected endpoint: log in via `POST /auth/login`, copy the ' +
        '`accessToken` from the response, click **Authorize** below, and paste it ' +
        '(the "Bearer " prefix is added automatically).',
    },
    servers: [
      { url: (process.env.APP_URL || `http://localhost:${process.env.PORT || 5111}`) + '/api', description: 'Current environment' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ApiError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'object', nullable: true },
          },
        },
        ApiSuccess: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {},
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'you@yourcompany.com' },
            password: { type: 'string', format: 'password' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'INTERN', 'TRAINEE'] },
            designation: { type: 'string', nullable: true },
            employmentType: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'ALUMNI'] },
            departmentId: { type: 'string', format: 'uuid', nullable: true },
            managerId: { type: 'string', format: 'uuid', nullable: true },
            avatarUrl: { type: 'string', nullable: true },
            joinDate: { type: 'string', format: 'date-time' },
          },
        },
        LoginResponse: {
          allOf: [
            { $ref: '#/components/schemas/ApiSuccess' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    user: { $ref: '#/components/schemas/User' },
                    accessToken: { type: 'string', description: '15-minute JWT — use this in Authorize' },
                    refreshToken: { type: 'string', description: '7-day JWT — used by POST /auth/refresh' },
                  },
                },
              },
            },
          ],
        },
        UserCreateRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', format: 'password' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            phone: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'INTERN', 'TRAINEE'], default: 'EMPLOYEE' },
            designation: { type: 'string', nullable: true },
            employmentType: { type: 'string', default: 'FULL_TIME' },
            departmentId: { type: 'string', format: 'uuid', nullable: true },
            managerId: { type: 'string', format: 'uuid', nullable: true },
            locationId: { type: 'string', format: 'uuid', nullable: true },
            joinDate: { type: 'string', format: 'date', nullable: true },
          },
        },
        CodeMaster: {
          type: 'object',
          description: 'Shape shared by all code-based master lists (task types/priorities/statuses, timesheet statuses, leave types, expense categories, employment types, college types).',
          properties: {
            code: { type: 'string' },
            label: { type: 'string' },
            color: { type: 'string', nullable: true },
            isFinal: { type: 'boolean', nullable: true },
            paid: { type: 'boolean', nullable: true },
            active: { type: 'boolean' },
            sortOrder: { type: 'integer' },
          },
        },
        Department: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            headId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        Designation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            departmentId: { type: 'string', format: 'uuid', nullable: true },
            active: { type: 'boolean' },
            sortOrder: { type: 'integer' },
          },
        },
        Location: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            address: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            active: { type: 'boolean' },
          },
        },
        InternshipBatch: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            program: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED'] },
            description: { type: 'string', nullable: true },
          },
        },
        InternEnrollment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            batchId: { type: 'string', format: 'uuid' },
            mentorId: { type: 'string', format: 'uuid', nullable: true },
            completionStatus: { type: 'string', enum: ['IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'EXTENDED', 'CONVERTED_TO_EMPLOYEE'] },
            performanceRating: { type: 'number', nullable: true },
            progressPercent: { type: 'integer' },
            stipend: { type: 'number', nullable: true },
            category: { type: 'string', enum: ['FREE_INTERNSHIP', 'JOT'], nullable: true },
          },
        },
        College: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            typeCode: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            contactPerson: { type: 'string', nullable: true },
            phone: { type: 'string', nullable: true },
            email: { type: 'string', nullable: true },
            active: { type: 'boolean' },
          },
        },
        Workshop: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            collegeId: { type: 'string', format: 'uuid' },
            topic: { type: 'string' },
            technology: { type: 'string', nullable: true },
            proposedDate: { type: 'string', format: 'date-time', nullable: true },
            status: { type: 'string', enum: ['LEAD', 'CONTACTED', 'DISCUSSION', 'PROPOSED', 'SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'FOLLOW_UP_REQUIRED'] },
            assignedEmployeeId: { type: 'string', format: 'uuid', nullable: true },
            followUpDate: { type: 'string', format: 'date-time', nullable: true },
            remarks: { type: 'string', nullable: true },
          },
        },
        MOU: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            collegeId: { type: 'string', format: 'uuid' },
            mouType: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['DISCUSSION', 'DRAFT', 'SENT', 'UNDER_REVIEW', 'APPROVED', 'SIGNED', 'ACTIVE', 'EXPIRED', 'RENEWED', 'CANCELLED'] },
            assignedEmployeeId: { type: 'string', format: 'uuid', nullable: true },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            endDate: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Enquiry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            contactName: { type: 'string' },
            contactEmail: { type: 'string', nullable: true },
            contactPhone: { type: 'string', nullable: true },
            companyName: { type: 'string', nullable: true },
            subject: { type: 'string' },
            description: { type: 'string', nullable: true },
            source: { type: 'string', enum: ['WEBSITE', 'REFERRAL', 'PHONE', 'EMAIL', 'WALK_IN', 'SOCIAL_MEDIA', 'OTHER'] },
            assignedEmployeeId: { type: 'string', format: 'uuid', nullable: true },
            status: { type: 'string', enum: ['NEW', 'CONTACTED', 'IN_PROGRESS', 'FOLLOW_UP_REQUIRED', 'CONVERTED', 'CLOSED', 'CANCELLED'] },
            followUpDate: { type: 'string', format: 'date-time', nullable: true },
            nextAction: { type: 'string', nullable: true },
            remarks: { type: 'string', nullable: true },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] },
            managerId: { type: 'string', format: 'uuid' },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            endDate: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            type: { type: 'string' },
            priority: { type: 'string' },
            status: { type: 'string' },
            progress: { type: 'integer' },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            projectId: { type: 'string', format: 'uuid', nullable: true },
            assigneeId: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        Attendance: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            clockIn: { type: 'string', format: 'date-time', nullable: true },
            clockOut: { type: 'string', format: 'date-time', nullable: true },
            status: { type: 'string', enum: ['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND'] },
            workHours: { type: 'number', nullable: true },
          },
        },
        Timesheet: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            projectId: { type: 'string', format: 'uuid', nullable: true },
            position: { type: 'string', nullable: true },
            hoursLogged: { type: 'number' },
            description: { type: 'string', nullable: true },
            status: { type: 'string' },
          },
        },
        LeaveRequest: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            leaveTypeCode: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            reason: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] },
            rejectionReason: { type: 'string', nullable: true },
          },
        },
        Expense: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            categoryCode: { type: 'string' },
            title: { type: 'string' },
            amount: { type: 'number' },
            expenseDate: { type: 'string', format: 'date' },
            paymentMode: { type: 'string', nullable: true },
            vendor: { type: 'string', nullable: true },
          },
        },
        DailyWorkUpdate: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            date: { type: 'string', format: 'date' },
            summary: { type: 'string' },
            tasksCompleted: { type: 'string', nullable: true },
            blockers: { type: 'string', nullable: true },
            planForTomorrow: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['SUBMITTED', 'REVIEWED', 'FLAGGED'] },
            managerFeedback: { type: 'string', nullable: true },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            type: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string', nullable: true },
            link: { type: 'string', nullable: true },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CustomFieldDefinition: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            entityType: { type: 'string', enum: ['EMPLOYEE', 'INTERN', 'TRAINEE', 'COLLEGE', 'WORKSHOP'] },
            name: { type: 'string' },
            fieldType: { type: 'string', enum: ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTISELECT', 'CHECKBOX', 'TEXTAREA'] },
            options: { type: 'array', items: { type: 'string' } },
            required: { type: 'boolean' },
            active: { type: 'boolean' },
          },
        },
        Permission: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['ADMIN'], description: 'Only ADMIN is configurable — SUPER_ADMIN always has full access' },
            module: { type: 'string' },
            action: { type: 'string' },
            allowed: { type: 'boolean' },
          },
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            actorId: { type: 'string', format: 'uuid' },
            action: { type: 'string' },
            module: { type: 'string' },
            entityId: { type: 'string' },
            entityLabel: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        InternDocument: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            enrollmentId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['BONAFIDE', 'COLLEGE_ID', 'RESUME', 'ADDITIONAL', 'PERMISSION_LETTER'] },
            fileName: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'PENDING_REVIEW', 'REJECTED', 'VERIFIED'] },
            adminRemarks: { type: 'string', nullable: true },
          },
        },
      },
    },
    // No global `security` — applied per-route so public endpoints
    // (login/refresh/logout) correctly show as not requiring a token.
  },
  // swagger-jsdoc's bundled glob (v9+) treats backslashes as escape
  // characters, not path separators — path.join()'s native Windows
  // backslashes silently match zero files unless normalized to forward
  // slashes first.
  apis: [path.join(__dirname, '../routes/*.js').split(path.sep).join('/')],
});

module.exports = swaggerSpec;
