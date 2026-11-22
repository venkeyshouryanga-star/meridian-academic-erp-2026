import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description').default('').notNull(),
  hodName: text('hod_name').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const classes = pgTable('classes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  semester: integer('semester').notNull(),
  section: text('section').default('A').notNull(),
  academicYear: text('academic_year').default('2026-2027').notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  passwordHash: text('password_hash'),
  role: text('role').notNull(), // 'admin' | 'teacher' | 'student' | 'hod'
  departmentId: integer('department_id').references(() => departments.id, {
    onDelete: 'set null',
  }),
  designation: text('designation').default('').notNull(),
  phone: text('phone').default('').notNull(),
  avatarUrl: text('avatar_url').default('').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const students = pgTable('students', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' })
    .unique(),
  rollNumber: text('roll_number').notNull().unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').default('').notNull(),
  gender: text('gender').default('Not Specified').notNull(),
  dateOfBirth: text('date_of_birth').default('').notNull(),
  admissionYear: integer('admission_year').default(2024).notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'cascade' })
    .notNull(),
  classId: integer('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  guardianName: text('guardian_name').default('').notNull(),
  address: text('address').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const subjects = pgTable('subjects', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  departmentId: integer('department_id')
    .references(() => departments.id, { onDelete: 'cascade' })
    .notNull(),
  classId: integer('class_id')
    .references(() => classes.id, { onDelete: 'cascade' })
    .notNull(),
  teacherId: integer('teacher_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  maxMarks: integer('max_marks').default(100).notNull(),
  passingMarks: integer('passing_marks').default(40).notNull(),
  credits: integer('credits').default(4).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const examinations = pgTable('examinations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  examType: text('exam_type').notNull(), // 'Internal' | 'Mid-Term' | 'Final' | 'Practical'
  academicYear: text('academic_year').default('2026-2027').notNull(),
  semester: integer('semester').default(5).notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').default('Published').notNull(), // 'Scheduled' | 'Ongoing' | 'Published'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const marks = pgTable(
  'marks',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id, { onDelete: 'cascade' })
      .notNull(),
    examinationId: integer('examination_id')
      .references(() => examinations.id, { onDelete: 'cascade' })
      .notNull(),
    marksObtained: doublePrecision('marks_obtained').notNull(),
    maxMarks: integer('max_marks').notNull(),
    passingMarks: integer('passing_marks').notNull(),
    remarks: text('remarks').default('').notNull(),
    enteredBy: integer('entered_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('marks_student_subject_exam_idx').on(
      table.studentId,
      table.subjectId,
      table.examinationId
    ),
  ]
);

export const gradeBoundaries = pgTable('grade_boundaries', {
  id: serial('id').primaryKey(),
  grade: text('grade').notNull().unique(),
  minPercentage: doublePrecision('min_percentage').notNull(),
  maxPercentage: doublePrecision('max_percentage').notNull(),
  gradePoint: doublePrecision('grade_point').notNull(),
  description: text('description').default('').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  actorId: integer('actor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  targetRole: text('target_role').default('all').notNull(),
  targetUserId: integer('target_user_id').references(() => users.id, {
    onDelete: 'cascade',
  }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  category: text('category').default('academic').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const collegeSettings = pgTable('college_settings', {
  id: serial('id').primaryKey(),
  collegeName: text('college_name').notNull(),
  collegeCode: text('college_code').notNull(),
  affiliation: text('affiliation').notNull(),
  address: text('address').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  currentAcademicYear: text('current_academic_year').default('2026-2027').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const departmentsRelations = relations(departments, ({ many }) => ({
  classes: many(classes),
  students: many(students),
  subjects: many(subjects),
  users: many(users),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  department: one(departments, {
    fields: [classes.departmentId],
    references: [departments.id],
  }),
  students: many(students),
  subjects: many(subjects),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  department: one(departments, {
    fields: [students.departmentId],
    references: [departments.id],
  }),
  classGroup: one(classes, {
    fields: [students.classId],
    references: [classes.id],
  }),
  marks: many(marks),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  department: one(departments, {
    fields: [subjects.departmentId],
    references: [departments.id],
  }),
  classGroup: one(classes, {
    fields: [subjects.classId],
    references: [classes.id],
  }),
  teacher: one(users, {
    fields: [subjects.teacherId],
    references: [users.id],
  }),
  marks: many(marks),
}));

export const marksRelations = relations(marks, ({ one }) => ({
  student: one(students, {
    fields: [marks.studentId],
    references: [students.id],
  }),
  subject: one(subjects, {
    fields: [marks.subjectId],
    references: [subjects.id],
  }),
  examination: one(examinations, {
    fields: [marks.examinationId],
    references: [examinations.id],
  }),
}));
