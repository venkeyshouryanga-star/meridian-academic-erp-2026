import { Router, Request, Response } from 'express';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  activities,
  classes,
  collegeSettings,
  departments,
  examinations,
  gradeBoundaries,
  marks,
  notifications,
  students,
  subjects,
  users,
} from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import { hashPassword, signSessionToken, verifyPassword } from '../lib/security.ts';
import {
  AuthRequest,
  requireAuth,
  requireRole,
  upsertFirebaseUser,
} from '../middleware/auth.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  AnalyticsPayload,
  GradeBoundary,
  MarkEntry,
  StudentResultSummary,
  UserRole,
  resolveGrade,
  round2,
} from '../shared/types.ts';

export const apiRouter = Router();

async function logActivity(
  actor: { id: number; fullName: string; role: string },
  action: string,
  entityType: string,
  details: string
) {
  try {
    await db.insert(activities).values({
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      entityType,
      details,
    });
  } catch (err) {
    console.error('Failed to write activity log:', err);
  }
}

async function fetchGradeBoundaries(): Promise<GradeBoundary[]> {
  try {
    const rows = await db
      .select()
      .from(gradeBoundaries)
      .orderBy(asc(gradeBoundaries.sortOrder));
    return rows;
  } catch (error) {
    console.error('Failed to load grade boundaries:', error);
    throw new Error('Could not load grading configuration.', { cause: error });
  }
}

async function computeEnrichedMarksAndResults(filters: {
  studentId?: number;
  departmentId?: number;
  classId?: number;
  subjectId?: number;
  examinationId?: number;
  academicYear?: string;
  search?: string;
  resultStatus?: string;
  teacherUserId?: number;
}): Promise<{
  markEntries: MarkEntry[];
  results: StudentResultSummary[];
  boundaries: GradeBoundary[];
}> {
  const boundaries = await fetchGradeBoundaries();

  const allStudents = await db
    .select({
      id: students.id,
      rollNumber: students.rollNumber,
      fullName: students.fullName,
      email: students.email,
      departmentId: students.departmentId,
      departmentName: departments.name,
      departmentCode: departments.code,
      classId: students.classId,
      className: classes.name,
      semester: classes.semester,
      academicYear: classes.academicYear,
    })
    .from(students)
    .innerJoin(departments, eq(students.departmentId, departments.id))
    .innerJoin(classes, eq(students.classId, classes.id));

  const studentMap = new Map(allStudents.map((s) => [s.id, s]));

  const allSubjects = await db.select().from(subjects);
  const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));

  const allExams = await db.select().from(examinations);
  const examMap = new Map(allExams.map((e) => [e.id, e]));

  const rawMarks = await db.select().from(marks).orderBy(desc(marks.updatedAt));

  const searchLower = filters.search?.trim().toLowerCase() || '';

  const enriched: MarkEntry[] = [];
  for (const m of rawMarks) {
    const stu = studentMap.get(m.studentId);
    const sub = subjectMap.get(m.subjectId);
    const exam = examMap.get(m.examinationId);
    if (!stu || !sub || !exam) continue;

    if (filters.studentId && stu.id !== filters.studentId) continue;
    if (filters.departmentId && stu.departmentId !== filters.departmentId) continue;
    if (filters.classId && stu.classId !== filters.classId) continue;
    if (filters.subjectId && sub.id !== filters.subjectId) continue;
    if (filters.examinationId && exam.id !== filters.examinationId) continue;
    if (filters.academicYear && exam.academicYear !== filters.academicYear) continue;
    if (filters.teacherUserId && sub.teacherId !== filters.teacherUserId) continue;

    if (searchLower) {
      const matches =
        stu.fullName.toLowerCase().includes(searchLower) ||
        stu.rollNumber.toLowerCase().includes(searchLower) ||
        sub.name.toLowerCase().includes(searchLower) ||
        sub.code.toLowerCase().includes(searchLower);
      if (!matches) continue;
    }

    const pct = m.maxMarks > 0 ? round2((m.marksObtained / m.maxMarks) * 100) : 0;
    const status: 'Pass' | 'Fail' = m.marksObtained >= m.passingMarks ? 'Pass' : 'Fail';
    const g = resolveGrade(pct, boundaries);

    enriched.push({
      id: m.id,
      studentId: stu.id,
      studentName: stu.fullName,
      rollNumber: stu.rollNumber,
      departmentId: stu.departmentId,
      departmentName: stu.departmentName,
      departmentCode: stu.departmentCode,
      classId: stu.classId,
      className: stu.className,
      subjectId: sub.id,
      subjectCode: sub.code,
      subjectName: sub.name,
      examinationId: exam.id,
      examinationName: exam.name,
      examType: exam.examType,
      academicYear: exam.academicYear,
      marksObtained: m.marksObtained,
      maxMarks: m.maxMarks,
      passingMarks: m.passingMarks,
      percentage: pct,
      grade: g.grade,
      status,
      remarks: m.remarks,
      updatedAt: m.updatedAt.toISOString(),
    });
  }

  // Group into Student Result Cards per (studentId, examinationId)
  const grouped = new Map<string, MarkEntry[]>();
  for (const entry of enriched) {
    const key = `${entry.studentId}:${entry.examinationId}`;
    const arr = grouped.get(key) || [];
    arr.push(entry);
    grouped.set(key, arr);
  }

  let results: StudentResultSummary[] = [];
  for (const entries of grouped.values()) {
    const first = entries[0];
    const stu = studentMap.get(first.studentId)!;
    const totalObtained = round2(entries.reduce((acc, e) => acc + e.marksObtained, 0));
    const totalMax = entries.reduce((acc, e) => acc + e.maxMarks, 0);
    const pct = totalMax > 0 ? round2((totalObtained / totalMax) * 100) : 0;
    const failedSubjectsCount = entries.filter((e) => e.status === 'Fail').length;
    const resultStatus: 'Pass' | 'Fail' = failedSubjectsCount === 0 ? 'Pass' : 'Fail';
    const g = resolveGrade(pct, boundaries);

    results.push({
      studentId: stu.id,
      rollNumber: stu.rollNumber,
      studentName: stu.fullName,
      email: stu.email,
      departmentId: stu.departmentId,
      departmentName: stu.departmentName,
      departmentCode: stu.departmentCode,
      classId: stu.classId,
      className: stu.className,
      semester: stu.semester,
      examinationId: first.examinationId,
      examinationName: first.examinationName,
      academicYear: first.academicYear,
      subjectsCount: entries.length,
      totalObtained,
      totalMax,
      percentage: pct,
      grade: g.grade,
      gradePoint: g.gradePoint,
      resultStatus,
      failedSubjectsCount,
      subjects: entries
        .map((e) => ({
          markId: e.id,
          subjectId: e.subjectId,
          subjectCode: e.subjectCode,
          subjectName: e.subjectName,
          credits: subjectMap.get(e.subjectId)?.credits ?? 4,
          marksObtained: e.marksObtained,
          maxMarks: e.maxMarks,
          passingMarks: e.passingMarks,
          percentage: e.percentage,
          grade: e.grade,
          status: e.status,
          remarks: e.remarks,
        }))
        .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode)),
    });
  }

  if (filters.resultStatus && (filters.resultStatus === 'Pass' || filters.resultStatus === 'Fail')) {
    results = results.filter((r) => r.resultStatus === filters.resultStatus);
    const allowedKeys = new Set(results.map((r) => `${r.studentId}:${r.examinationId}`));
    return {
      markEntries: enriched.filter((e) => allowedKeys.has(`${e.studentId}:${e.examinationId}`)),
      results: results.sort((a, b) => b.percentage - a.percentage),
      boundaries,
    };
  }

  return {
    markEntries: enriched,
    results: results.sort((a, b) => b.percentage - a.percentage),
    boundaries,
  };
}

// ============================================================================
// AUTH ROUTES
// ============================================================================

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const { username, password, role } = req.body as {
      username?: string;
      password?: string;
      role?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const identifier = username.trim().toLowerCase();
    const matched = await db
      .select({
        id: users.id,
        uid: users.uid,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        role: users.role,
        departmentId: users.departmentId,
        designation: users.designation,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        departmentName: departments.name,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);

    if (!matched.length || !matched[0].passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const userRow = matched[0];
    if (!userRow.isActive) {
      return res.status(403).json({ error: 'This account is currently disabled.' });
    }

    if (role && ['admin', 'teacher', 'student', 'hod'].includes(role) && userRow.role !== role) {
      return res.status(403).json({
        error: `Account "${userRow.username}" belongs to the ${userRow.role.toUpperCase()} portal. Please switch portal tab.`,
      });
    }

    const valid = verifyPassword(password, userRow.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    let studentId: number | null = null;
    let rollNumber: string | null = null;
    if (userRow.role === 'student') {
      const [stu] = await db
        .select({ id: students.id, rollNumber: students.rollNumber })
        .from(students)
        .where(eq(students.userId, userRow.id))
        .limit(1);
      if (stu) {
        studentId = stu.id;
        rollNumber = stu.rollNumber;
      }
    }

    const token = signSessionToken({
      userId: userRow.id,
      uid: userRow.uid,
      username: userRow.username,
      role: userRow.role as UserRole,
    });

    return res.json({
      token,
      user: {
        id: userRow.id,
        uid: userRow.uid,
        username: userRow.username,
        email: userRow.email,
        fullName: userRow.fullName,
        role: userRow.role,
        departmentId: userRow.departmentId,
        departmentName: userRow.departmentName,
        designation: userRow.designation,
        phone: userRow.phone,
        avatarUrl: userRow.avatarUrl,
        studentId,
        rollNumber,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Authentication service failed. Please try again.' });
  }
});

apiRouter.post('/auth/firebase', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Firebase ID token is required.' });
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email || `${decoded.uid}@meridian.edu`;
    const user = await upsertFirebaseUser(decoded.uid, email, decoded.name, decoded.picture);
    return res.json({ user });
  } catch (error) {
    console.error('Firebase SSO sync error:', error);
    return res.status(401).json({ error: 'Google sign-in verification failed.' });
  }
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
  return res.json({ user: req.authUser });
});

apiRouter.post('/auth/logout', requireAuth, (_req: AuthRequest, res: Response) => {
  return res.json({ ok: true });
});

apiRouter.get('/public/college', async (_req: Request, res: Response) => {
  try {
    await ensureSeeded();
    const [settings] = await db.select().from(collegeSettings).limit(1);
    return res.json({
      collegeName: settings?.collegeName || 'Meridian Institute of Engineering & Technology',
      collegeCode: settings?.collegeCode || 'MIET-2026',
      affiliation: settings?.affiliation || 'Autonomous Institution',
      currentAcademicYear: settings?.currentAcademicYear || '2026-2027',
    });
  } catch (error) {
    console.error('Failed to load college info:', error);
    return res.status(500).json({ error: 'Unable to load institution details.' });
  }
});

// ============================================================================
// ANALYTICS & DASHBOARD OVERVIEW
// ============================================================================

apiRouter.get('/analytics', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const examinationId = req.query.examinationId ? Number(req.query.examinationId) : undefined;
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const classId = req.query.classId ? Number(req.query.classId) : undefined;
    const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;

    const studentFilterId =
      user.role === 'student' ? user.studentId ?? -1 : undefined;
    const teacherFilterId =
      user.role === 'teacher' && req.query.scope !== 'all' ? user.id : undefined;

    const allExams = await db.select().from(examinations).orderBy(asc(examinations.startDate));
    const defaultExamId =
      examinationId ||
      allExams.find((e) => e.examType === 'Final')?.id ||
      allExams[allExams.length - 1]?.id;

    // 1. Primary snapshot for selected exam (or Final exam by default)
    const { markEntries, results, boundaries } = await computeEnrichedMarksAndResults({
      studentId: studentFilterId,
      departmentId,
      classId,
      examinationId: defaultExamId,
      academicYear,
      teacherUserId: teacherFilterId,
    });

    // 2. Cross-exam trend data
    const allTime = await computeEnrichedMarksAndResults({
      studentId: studentFilterId,
      departmentId,
      classId,
      academicYear,
      teacherUserId: teacherFilterId,
    });

    const allStudentsRows = await db.select().from(students);
    const allTeachersRows = await db
      .select()
      .from(users)
      .where(or(eq(users.role, 'teacher'), eq(users.role, 'hod')));
    const allSubjectsRows = await db.select().from(subjects);
    const allDeptsRows = await db.select().from(departments);
    const allClassesRows = await db.select().from(classes);

    const passedCount = results.filter((r) => r.resultStatus === 'Pass').length;
    const failedCount = results.filter((r) => r.resultStatus === 'Fail').length;
    const overallPassPercentage =
      results.length > 0 ? round2((passedCount / results.length) * 100) : 0;
    const averagePercentage =
      results.length > 0
        ? round2(results.reduce((sum, r) => sum + r.percentage, 0) / results.length)
        : 0;

    // Subject-wise aggregation
    const subjMap = new Map<number, MarkEntry[]>();
    for (const m of markEntries) {
      const list = subjMap.get(m.subjectId) || [];
      list.push(m);
      subjMap.set(m.subjectId, list);
    }
    const subjectPerformance = Array.from(subjMap.entries()).map(([subjectId, entries]) => {
      const first = entries[0];
      const avg = round2(entries.reduce((s, e) => s + e.percentage, 0) / entries.length);
      const passRate = round2(
        (entries.filter((e) => e.status === 'Pass').length / entries.length) * 100
      );
      const highestMarks = Math.max(...entries.map((e) => e.marksObtained));
      return {
        subjectId,
        subjectCode: first.subjectCode,
        subjectName: first.subjectName,
        departmentCode: first.departmentCode,
        averagePercentage: avg,
        passRate,
        entriesCount: entries.length,
        highestMarks,
        maxMarks: first.maxMarks,
      };
    });

    // Class-wise aggregation
    const classPerfMap = new Map<number, StudentResultSummary[]>();
    for (const r of results) {
      const list = classPerfMap.get(r.classId) || [];
      list.push(r);
      classPerfMap.set(r.classId, list);
    }
    const classPerformance = Array.from(classPerfMap.entries()).map(([cid, list]) => {
      const first = list[0];
      const avg = round2(list.reduce((s, r) => s + r.percentage, 0) / list.length);
      const passRate = round2(
        (list.filter((r) => r.resultStatus === 'Pass').length / list.length) * 100
      );
      return {
        classId: cid,
        className: first.className,
        departmentCode: first.departmentCode,
        averagePercentage: avg,
        passRate,
        studentCount: list.length,
      };
    });

    // Department-wise aggregation
    const deptPerfMap = new Map<number, StudentResultSummary[]>();
    for (const r of results) {
      const list = deptPerfMap.get(r.departmentId) || [];
      list.push(r);
      deptPerfMap.set(r.departmentId, list);
    }
    const departmentPerformance = allDeptsRows
      .map((d) => {
        const list = deptPerfMap.get(d.id) || [];
        if (list.length === 0) return null;
        const avg = round2(list.reduce((s, r) => s + r.percentage, 0) / list.length);
        const failCount = list.filter((r) => r.resultStatus === 'Fail').length;
        const passRate = round2(((list.length - failCount) / list.length) * 100);
        return {
          departmentId: d.id,
          departmentCode: d.code,
          departmentName: d.name,
          averagePercentage: avg,
          passRate,
          studentCount: list.length,
          failCount,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Exam progression trend
    const examTrend = allExams
      .map((ex) => {
        const list = allTime.results.filter((r) => r.examinationId === ex.id);
        if (list.length === 0) return null;
        const avg = round2(list.reduce((s, r) => s + r.percentage, 0) / list.length);
        const passRate = round2(
          (list.filter((r) => r.resultStatus === 'Pass').length / list.length) * 100
        );
        return {
          examinationId: ex.id,
          examinationName: ex.name,
          startDate: ex.startDate,
          averagePercentage: avg,
          passRate,
          entriesCount: allTime.markEntries.filter((m) => m.examinationId === ex.id).length,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Grade Distribution
    const gradeCounts = new Map<string, number>();
    for (const b of boundaries) gradeCounts.set(b.grade, 0);
    for (const r of results) {
      gradeCounts.set(r.grade, (gradeCounts.get(r.grade) || 0) + 1);
    }
    const gradeDistribution = boundaries.map((b) => ({
      grade: b.grade,
      count: gradeCounts.get(b.grade) || 0,
    }));

    const toppers = results.slice(0, 6).map((r) => ({
      studentId: r.studentId,
      rollNumber: r.rollNumber,
      studentName: r.studentName,
      departmentCode: r.departmentCode,
      className: r.className,
      percentage: r.percentage,
      grade: r.grade,
      totalObtained: r.totalObtained,
      totalMax: r.totalMax,
    }));

    const needsImprovement = results
      .filter((r) => r.resultStatus === 'Fail' || r.percentage < 65)
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 8)
      .map((r) => ({
        studentId: r.studentId,
        rollNumber: r.rollNumber,
        studentName: r.studentName,
        departmentCode: r.departmentCode,
        className: r.className,
        percentage: r.percentage,
        grade: r.grade,
        failedSubjectsCount: r.failedSubjectsCount,
        resultStatus: r.resultStatus,
      }));

    const payload: AnalyticsPayload = {
      summary: {
        totalStudents:
          user.role === 'teacher'
            ? new Set(allTime.markEntries.map((m) => m.studentId)).size || allStudentsRows.length
            : allStudentsRows.length,
        totalTeachers: allTeachersRows.length,
        totalSubjects:
          user.role === 'teacher'
            ? allSubjectsRows.filter((s) => s.teacherId === user.id).length
            : allSubjectsRows.length,
        totalExaminations: allExams.length,
        totalMarksEntries: allTime.markEntries.length,
        overallPassPercentage,
        averagePercentage,
        passedCount,
        failedCount,
      },
      studentPerformance: results.slice(0, 12).map((r) => ({
        studentId: r.studentId,
        rollNumber: r.rollNumber,
        studentName: r.studentName,
        departmentCode: r.departmentCode,
        className: r.className,
        percentage: r.percentage,
        grade: r.grade,
        status: r.resultStatus,
      })),
      subjectPerformance: subjectPerformance.sort((a, b) => b.averagePercentage - a.averagePercentage),
      classPerformance,
      departmentPerformance,
      examTrend,
      gradeDistribution,
      toppers,
      needsImprovement,
    };

    return res.json({
      analytics: payload,
      selectedExaminationId: defaultExamId ?? null,
      classesCount: allClassesRows.length,
    });
  } catch (error) {
    console.error('Analytics fetch failed:', error);
    return res.status(500).json({ error: 'Unable to compute academic analytics.' });
  }
});

// ============================================================================
// DEPARTMENTS & CLASSES
// ============================================================================

apiRouter.get('/departments', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const depts = await db.select().from(departments).orderBy(asc(departments.code));
    const allStudents = await db.select({ departmentId: students.departmentId }).from(students);
    const allSubjects = await db.select({ departmentId: subjects.departmentId }).from(subjects);
    const allClasses = await db.select({ departmentId: classes.departmentId }).from(classes);

    const enriched = depts.map((d) => ({
      ...d,
      studentCount: allStudents.filter((s) => s.departmentId === d.id).length,
      subjectCount: allSubjects.filter((s) => s.departmentId === d.id).length,
      classCount: allClasses.filter((c) => c.departmentId === d.id).length,
    }));

    return res.json({ departments: enriched });
  } catch (error) {
    console.error('Failed to fetch departments:', error);
    return res.status(500).json({ error: 'Failed to load departments.' });
  }
});

apiRouter.post('/departments', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, code, description, hodName } = req.body;
    if (!name?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }
    const [created] = await db
      .insert(departments)
      .values({
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: String(description || '').trim(),
        hodName: String(hodName || '').trim(),
      })
      .returning();

    await logActivity(req.authUser!, 'Added Department', 'department', `Created ${created.code} — ${created.name}`);
    return res.status(201).json({ department: created });
  } catch (error: unknown) {
    const pgErr = error as { code?: string };
    if (pgErr?.code === '23505') {
      return res.status(409).json({ error: 'A department with this code already exists.' });
    }
    console.error('Create department error:', error);
    return res.status(500).json({ error: 'Could not create department.' });
  }
});

apiRouter.put('/departments/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, code, description, hodName } = req.body;
    if (!name?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Department name and code are required.' });
    }
    const [updated] = await db
      .update(departments)
      .set({
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        description: String(description || '').trim(),
        hodName: String(hodName || '').trim(),
      })
      .where(eq(departments.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Department not found.' });
    await logActivity(req.authUser!, 'Updated Department', 'department', `Updated ${updated.code} — ${updated.name}`);
    return res.json({ department: updated });
  } catch (error) {
    console.error('Update department error:', error);
    return res.status(500).json({ error: 'Could not update department.' });
  }
});

apiRouter.delete('/departments/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(departments).where(eq(departments.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Department not found.' });
    await logActivity(req.authUser!, 'Removed Department', 'department', `Deleted department ${deleted.code}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete department error:', error);
    return res.status(500).json({ error: 'Could not delete department.' });
  }
});

apiRouter.get('/classes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const rows = await db
      .select({
        id: classes.id,
        name: classes.name,
        semester: classes.semester,
        section: classes.section,
        academicYear: classes.academicYear,
        departmentId: classes.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
      })
      .from(classes)
      .innerJoin(departments, eq(classes.departmentId, departments.id))
      .orderBy(asc(departments.code), asc(classes.semester), asc(classes.section));

    const allStudents = await db.select({ classId: students.classId }).from(students);
    const filtered = departmentId ? rows.filter((c) => c.departmentId === departmentId) : rows;
    const enriched = filtered.map((c) => ({
      ...c,
      studentCount: allStudents.filter((s) => s.classId === c.id).length,
    }));
    return res.json({ classes: enriched });
  } catch (error) {
    console.error('Fetch classes error:', error);
    return res.status(500).json({ error: 'Could not load classes.' });
  }
});

apiRouter.post('/classes', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, semester, section, academicYear, departmentId } = req.body;
    if (!name?.trim() || !departmentId || !semester) {
      return res.status(400).json({ error: 'Class name, semester, and department are required.' });
    }
    const [created] = await db
      .insert(classes)
      .values({
        name: String(name).trim(),
        semester: Number(semester),
        section: String(section || 'A').trim().toUpperCase(),
        academicYear: String(academicYear || '2026-2027').trim(),
        departmentId: Number(departmentId),
      })
      .returning();

    await logActivity(req.authUser!, 'Added Class', 'class', `Created class ${created.name}`);
    return res.status(201).json({ classGroup: created });
  } catch (error) {
    console.error('Create class error:', error);
    return res.status(500).json({ error: 'Could not create class.' });
  }
});

apiRouter.delete('/classes/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(classes).where(eq(classes.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Class not found.' });
    await logActivity(req.authUser!, 'Removed Class', 'class', `Deleted class ${deleted.name}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete class error:', error);
    return res.status(500).json({ error: 'Could not delete class.' });
  }
});

// ============================================================================
// STUDENTS MANAGEMENT
// ============================================================================

apiRouter.get('/students', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const search = req.query.search ? String(req.query.search).trim().toLowerCase() : '';
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const classId = req.query.classId ? Number(req.query.classId) : undefined;

    const rows = await db
      .select({
        id: students.id,
        userId: students.userId,
        rollNumber: students.rollNumber,
        fullName: students.fullName,
        email: students.email,
        phone: students.phone,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        admissionYear: students.admissionYear,
        departmentId: students.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        classId: students.classId,
        className: classes.name,
        semester: classes.semester,
        guardianName: students.guardianName,
        address: students.address,
        username: users.username,
      })
      .from(students)
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .leftJoin(users, eq(students.userId, users.id))
      .orderBy(asc(students.rollNumber));

    let filtered = rows;

    // Student role strict data isolation
    if (user.role === 'student') {
      filtered = filtered.filter((s) => s.userId === user.id);
    } else if (user.role === 'teacher' && req.query.assignedOnly === 'true') {
      const assignedSubjects = await db
        .select({ classId: subjects.classId })
        .from(subjects)
        .where(eq(subjects.teacherId, user.id));
      const classIds = new Set(assignedSubjects.map((s) => s.classId));
      filtered = filtered.filter((s) => classIds.has(s.classId));
    }

    if (departmentId) filtered = filtered.filter((s) => s.departmentId === departmentId);
    if (classId) filtered = filtered.filter((s) => s.classId === classId);
    if (search) {
      filtered = filtered.filter(
        (s) =>
          s.fullName.toLowerCase().includes(search) ||
          s.rollNumber.toLowerCase().includes(search) ||
          s.email.toLowerCase().includes(search)
      );
    }

    return res.json({ students: filtered });
  } catch (error) {
    console.error('Fetch students error:', error);
    return res.status(500).json({ error: 'Could not load student records.' });
  }
});

apiRouter.post('/students', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const {
      rollNumber,
      fullName,
      email,
      phone,
      gender,
      dateOfBirth,
      admissionYear,
      departmentId,
      classId,
      guardianName,
      address,
      portalPassword,
    } = req.body;

    if (!rollNumber?.trim() || !fullName?.trim() || !email?.trim() || !departmentId || !classId) {
      return res.status(400).json({
        error: 'Roll number, full name, email, department, and class are required.',
      });
    }

    const cleanRoll = String(rollNumber).trim().toUpperCase();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanUsername = cleanRoll.toLowerCase();

    // Provision student portal login automatically with salted scrypt hash
    const passwordToHash = portalPassword?.trim() || 'Student@2026';
    const [createdUser] = await db
      .insert(users)
      .values({
        uid: `local:${cleanUsername}`,
        username: cleanUsername,
        email: cleanEmail,
        fullName: String(fullName).trim(),
        passwordHash: hashPassword(passwordToHash),
        role: 'student',
        departmentId: Number(departmentId),
        designation: 'Undergraduate Scholar',
        phone: String(phone || '').trim(),
        avatarUrl: '/src/assets/images/avatar_student_scholar_1795351453031.jpg',
      })
      .returning();

    const [createdStudent] = await db
      .insert(students)
      .values({
        userId: createdUser.id,
        rollNumber: cleanRoll,
        fullName: String(fullName).trim(),
        email: cleanEmail,
        phone: String(phone || '').trim(),
        gender: String(gender || 'Not Specified').trim(),
        dateOfBirth: String(dateOfBirth || '').trim(),
        admissionYear: Number(admissionYear || 2026),
        departmentId: Number(departmentId),
        classId: Number(classId),
        guardianName: String(guardianName || '').trim(),
        address: String(address || '').trim(),
      })
      .returning();

    await logActivity(
      req.authUser!,
      'Enrolled Student',
      'student',
      `Added ${createdStudent.fullName} (${createdStudent.rollNumber})`
    );
    return res.status(201).json({ student: createdStudent });
  } catch (error: unknown) {
    const pgErr = error as { code?: string };
    if (pgErr?.code === '23505') {
      return res.status(409).json({
        error: 'A student with this roll number or email already exists.',
      });
    }
    console.error('Create student error:', error);
    return res.status(500).json({ error: 'Could not add student.' });
  }
});

apiRouter.put('/students/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const {
      rollNumber,
      fullName,
      email,
      phone,
      gender,
      dateOfBirth,
      admissionYear,
      departmentId,
      classId,
      guardianName,
      address,
    } = req.body;

    if (!rollNumber?.trim() || !fullName?.trim() || !email?.trim() || !departmentId || !classId) {
      return res.status(400).json({
        error: 'Roll number, full name, email, department, and class are required.',
      });
    }

    const [updated] = await db
      .update(students)
      .set({
        rollNumber: String(rollNumber).trim().toUpperCase(),
        fullName: String(fullName).trim(),
        email: String(email).trim().toLowerCase(),
        phone: String(phone || '').trim(),
        gender: String(gender || 'Not Specified').trim(),
        dateOfBirth: String(dateOfBirth || '').trim(),
        admissionYear: Number(admissionYear || 2024),
        departmentId: Number(departmentId),
        classId: Number(classId),
        guardianName: String(guardianName || '').trim(),
        address: String(address || '').trim(),
      })
      .where(eq(students.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Student not found.' });

    if (updated.userId) {
      await db
        .update(users)
        .set({
          fullName: updated.fullName,
          email: updated.email,
          departmentId: updated.departmentId,
          phone: updated.phone,
        })
        .where(eq(users.id, updated.userId));
    }

    await logActivity(
      req.authUser!,
      'Updated Student Record',
      'student',
      `Modified ${updated.fullName} (${updated.rollNumber})`
    );
    return res.json({ student: updated });
  } catch (error: unknown) {
    const pgErr = error as { code?: string };
    if (pgErr?.code === '23505') {
      return res.status(409).json({ error: 'Roll number or email already belongs to another student.' });
    }
    console.error('Update student error:', error);
    return res.status(500).json({ error: 'Could not update student.' });
  }
});

apiRouter.delete('/students/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(students).where(eq(students.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Student not found.' });

    await db.delete(students).where(eq(students.id, id));
    if (existing.userId) {
      await db.delete(users).where(eq(users.id, existing.userId));
    }

    await logActivity(
      req.authUser!,
      'Deleted Student',
      'student',
      `Removed ${existing.fullName} (${existing.rollNumber})`
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({ error: 'Could not delete student.' });
  }
});

// ============================================================================
// SUBJECTS MANAGEMENT
// ============================================================================

apiRouter.get('/subjects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const classId = req.query.classId ? Number(req.query.classId) : undefined;
    const assignedOnly = req.query.assignedOnly === 'true';

    const rows = await db
      .select({
        id: subjects.id,
        code: subjects.code,
        name: subjects.name,
        departmentId: subjects.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        classId: subjects.classId,
        className: classes.name,
        teacherId: subjects.teacherId,
        teacherName: users.fullName,
        maxMarks: subjects.maxMarks,
        passingMarks: subjects.passingMarks,
        credits: subjects.credits,
      })
      .from(subjects)
      .innerJoin(departments, eq(subjects.departmentId, departments.id))
      .innerJoin(classes, eq(subjects.classId, classes.id))
      .leftJoin(users, eq(subjects.teacherId, users.id))
      .orderBy(asc(subjects.code));

    let filtered = rows;
    if (user.role === 'teacher' && assignedOnly) {
      filtered = filtered.filter((s) => s.teacherId === user.id);
    }
    if (departmentId) filtered = filtered.filter((s) => s.departmentId === departmentId);
    if (classId) filtered = filtered.filter((s) => s.classId === classId);

    return res.json({ subjects: filtered });
  } catch (error) {
    console.error('Fetch subjects error:', error);
    return res.status(500).json({ error: 'Could not load subjects.' });
  }
});

apiRouter.post('/subjects', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, departmentId, classId, teacherId, maxMarks, passingMarks, credits } = req.body;
    if (!code?.trim() || !name?.trim() || !departmentId || !classId) {
      return res.status(400).json({ error: 'Subject code, name, department, and class are required.' });
    }
    const max = Number(maxMarks || 100);
    const pass = Number(passingMarks || 40);
    if (max <= 0 || pass < 0 || pass > max) {
      return res.status(400).json({ error: 'Passing marks must be between 0 and maximum marks.' });
    }

    const [created] = await db
      .insert(subjects)
      .values({
        code: String(code).trim().toUpperCase(),
        name: String(name).trim(),
        departmentId: Number(departmentId),
        classId: Number(classId),
        teacherId: teacherId ? Number(teacherId) : null,
        maxMarks: max,
        passingMarks: pass,
        credits: Number(credits || 4),
      })
      .returning();

    await logActivity(req.authUser!, 'Added Subject', 'subject', `Created ${created.code} — ${created.name}`);
    return res.status(201).json({ subject: created });
  } catch (error: unknown) {
    const pgErr = error as { code?: string };
    if (pgErr?.code === '23505') {
      return res.status(409).json({ error: 'A subject with this code already exists.' });
    }
    console.error('Create subject error:', error);
    return res.status(500).json({ error: 'Could not add subject.' });
  }
});

apiRouter.put('/subjects/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { code, name, departmentId, classId, teacherId, maxMarks, passingMarks, credits } = req.body;
    const max = Number(maxMarks || 100);
    const pass = Number(passingMarks || 40);
    if (!code?.trim() || !name?.trim() || !departmentId || !classId) {
      return res.status(400).json({ error: 'Required subject fields are missing.' });
    }
    if (max <= 0 || pass < 0 || pass > max) {
      return res.status(400).json({ error: 'Passing marks cannot exceed maximum marks.' });
    }

    const [updated] = await db
      .update(subjects)
      .set({
        code: String(code).trim().toUpperCase(),
        name: String(name).trim(),
        departmentId: Number(departmentId),
        classId: Number(classId),
        teacherId: teacherId ? Number(teacherId) : null,
        maxMarks: max,
        passingMarks: pass,
        credits: Number(credits || 4),
      })
      .where(eq(subjects.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Subject not found.' });
    await logActivity(req.authUser!, 'Updated Subject', 'subject', `Updated ${updated.code} — ${updated.name}`);
    return res.json({ subject: updated });
  } catch (error) {
    console.error('Update subject error:', error);
    return res.status(500).json({ error: 'Could not update subject.' });
  }
});

apiRouter.delete('/subjects/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(subjects).where(eq(subjects.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Subject not found.' });
    await logActivity(req.authUser!, 'Deleted Subject', 'subject', `Removed ${deleted.code} — ${deleted.name}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete subject error:', error);
    return res.status(500).json({ error: 'Could not delete subject.' });
  }
});

// ============================================================================
// EXAMINATIONS MANAGEMENT
// ============================================================================

apiRouter.get('/examinations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const academicYear = req.query.academicYear ? String(req.query.academicYear) : undefined;
    const rows = await db
      .select()
      .from(examinations)
      .orderBy(desc(examinations.startDate));
    const filtered = academicYear ? rows.filter((e) => e.academicYear === academicYear) : rows;
    return res.json({ examinations: filtered });
  } catch (error) {
    console.error('Fetch exams error:', error);
    return res.status(500).json({ error: 'Could not load examinations.' });
  }
});

apiRouter.post('/examinations', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { name, examType, academicYear, semester, startDate, endDate, status } = req.body;
    if (!name?.trim() || !examType?.trim() || !startDate || !endDate) {
      return res.status(400).json({ error: 'Exam name, type, start date, and end date are required.' });
    }
    const [created] = await db
      .insert(examinations)
      .values({
        name: String(name).trim(),
        examType: String(examType).trim(),
        academicYear: String(academicYear || '2026-2027').trim(),
        semester: Number(semester || 5),
        startDate: String(startDate).trim(),
        endDate: String(endDate).trim(),
        status: String(status || 'Scheduled').trim(),
      })
      .returning();

    await logActivity(req.authUser!, 'Scheduled Examination', 'examination', `Added ${created.name} (${created.academicYear})`);
    await db.insert(notifications).values({
      targetRole: 'all',
      title: `Examination Scheduled: ${created.name}`,
      message: `${created.examType} examination scheduled from ${created.startDate} to ${created.endDate}.`,
      category: 'exam',
    });

    return res.status(201).json({ examination: created });
  } catch (error) {
    console.error('Create exam error:', error);
    return res.status(500).json({ error: 'Could not create examination.' });
  }
});

apiRouter.put('/examinations/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, examType, academicYear, semester, startDate, endDate, status } = req.body;
    const [updated] = await db
      .update(examinations)
      .set({
        name: String(name).trim(),
        examType: String(examType).trim(),
        academicYear: String(academicYear || '2026-2027').trim(),
        semester: Number(semester || 5),
        startDate: String(startDate).trim(),
        endDate: String(endDate).trim(),
        status: String(status || 'Scheduled').trim(),
      })
      .where(eq(examinations.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Examination not found.' });
    await logActivity(req.authUser!, 'Updated Examination', 'examination', `Updated ${updated.name} status to ${updated.status}`);
    return res.json({ examination: updated });
  } catch (error) {
    console.error('Update exam error:', error);
    return res.status(500).json({ error: 'Could not update examination.' });
  }
});

apiRouter.delete('/examinations/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [deleted] = await db.delete(examinations).where(eq(examinations.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Examination not found.' });
    await logActivity(req.authUser!, 'Deleted Examination', 'examination', `Removed examination ${deleted.name}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete exam error:', error);
    return res.status(500).json({ error: 'Could not delete examination.' });
  }
});

// ============================================================================
// MARKS & RESULTS
// ============================================================================

apiRouter.get('/marks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const studentIdParam = req.query.studentId ? Number(req.query.studentId) : undefined;

    // Enforce strict student isolation
    if (user.role === 'student' && studentIdParam && studentIdParam !== user.studentId) {
      return res.status(403).json({ error: 'Students may only view their own marks.' });
    }

    const { markEntries, results, boundaries } = await computeEnrichedMarksAndResults({
      studentId: user.role === 'student' ? user.studentId ?? -1 : studentIdParam,
      departmentId: req.query.departmentId ? Number(req.query.departmentId) : undefined,
      classId: req.query.classId ? Number(req.query.classId) : undefined,
      subjectId: req.query.subjectId ? Number(req.query.subjectId) : undefined,
      examinationId: req.query.examinationId ? Number(req.query.examinationId) : undefined,
      academicYear: req.query.academicYear ? String(req.query.academicYear) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      resultStatus: req.query.resultStatus ? String(req.query.resultStatus) : undefined,
      teacherUserId:
        user.role === 'teacher' && req.query.assignedOnly === 'true' ? user.id : undefined,
    });

    return res.json({ marks: markEntries, results, gradeBoundaries: boundaries });
  } catch (error) {
    console.error('Fetch marks error:', error);
    return res.status(500).json({ error: 'Could not retrieve marks records.' });
  }
});

apiRouter.post(
  '/marks',
  requireAuth,
  requireRole(['admin', 'teacher']),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const body = req.body;
      const entriesInput: Array<{
        studentId: number;
        subjectId: number;
        examinationId: number;
        marksObtained: number;
        remarks?: string;
      }> = Array.isArray(body.entries) ? body.entries : [body];

      if (entriesInput.length === 0) {
        return res.status(400).json({ error: 'At least one mark entry is required.' });
      }

      const subjectIds = [...new Set(entriesInput.map((e) => Number(e.subjectId)))];
      const subjectRows = await db
        .select()
        .from(subjects)
        .where(inArray(subjects.id, subjectIds));
      const subjectMap = new Map(subjectRows.map((s) => [s.id, s]));

      const saved = [];
      for (const item of entriesInput) {
        const studentId = Number(item.studentId);
        const subjectId = Number(item.subjectId);
        const examinationId = Number(item.examinationId);
        const marksObtained = Number(item.marksObtained);

        if (!studentId || !subjectId || !examinationId || Number.isNaN(marksObtained)) {
          return res.status(400).json({ error: 'Invalid student, subject, exam, or score value.' });
        }

        const subject = subjectMap.get(subjectId);
        if (!subject) {
          return res.status(404).json({ error: `Subject ID ${subjectId} not found.` });
        }

        if (user.role === 'teacher' && subject.teacherId !== user.id) {
          return res.status(403).json({
            error: `You are not assigned to enter marks for ${subject.code} (${subject.name}).`,
          });
        }

        if (marksObtained < 0 || marksObtained > subject.maxMarks) {
          return res.status(400).json({
            error: `Marks for ${subject.code} must be between 0 and ${subject.maxMarks}. Received ${marksObtained}.`,
          });
        }

        const [upserted] = await db
          .insert(marks)
          .values({
            studentId,
            subjectId,
            examinationId,
            marksObtained,
            maxMarks: subject.maxMarks,
            passingMarks: subject.passingMarks,
            remarks: String(item.remarks || '').trim(),
            enteredBy: user.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [marks.studentId, marks.subjectId, marks.examinationId],
            set: {
              marksObtained,
              maxMarks: subject.maxMarks,
              passingMarks: subject.passingMarks,
              remarks: String(item.remarks || '').trim(),
              enteredBy: user.id,
              updatedAt: new Date(),
            },
          })
          .returning();

        saved.push(upserted);
      }

      await logActivity(
        user,
        'Recorded Student Marks',
        'marks',
        `Saved ${saved.length} mark ${saved.length === 1 ? 'entry' : 'entries'} across subject evaluation.`
      );

      return res.status(201).json({ savedCount: saved.length, marks: saved });
    } catch (error) {
      console.error('Save marks error:', error);
      return res.status(500).json({ error: 'Could not save marks.' });
    }
  }
);

apiRouter.delete(
  '/marks/:id',
  requireAuth,
  requireRole(['admin', 'teacher']),
  async (req: AuthRequest, res: Response) => {
    try {
      const user = req.authUser!;
      const id = Number(req.params.id);
      const [existing] = await db.select().from(marks).where(eq(marks.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: 'Mark record not found.' });

      if (user.role === 'teacher') {
        const [subj] = await db
          .select()
          .from(subjects)
          .where(eq(subjects.id, existing.subjectId))
          .limit(1);
        if (!subj || subj.teacherId !== user.id) {
          return res.status(403).json({ error: 'You may only delete marks for your assigned subjects.' });
        }
      }

      await db.delete(marks).where(eq(marks.id, id));
      await logActivity(user, 'Deleted Mark Entry', 'marks', `Removed mark entry #${id}`);
      return res.json({ ok: true });
    } catch (error) {
      console.error('Delete mark error:', error);
      return res.status(500).json({ error: 'Could not delete mark entry.' });
    }
  }
);

// ============================================================================
// USERS / FACULTY MANAGEMENT
// ============================================================================

apiRouter.get('/users', requireAuth, requireRole(['admin', 'hod', 'teacher']), async (req: AuthRequest, res: Response) => {
  try {
    const roleFilter = req.query.role ? String(req.query.role) : undefined;
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        departmentId: users.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
        designation: users.designation,
        phone: users.phone,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .orderBy(asc(users.role), asc(users.fullName));

    const filtered = roleFilter ? rows.filter((u) => u.role === roleFilter) : rows;
    return res.json({ users: filtered });
  } catch (error) {
    console.error('Fetch users error:', error);
    return res.status(500).json({ error: 'Could not load faculty/user directory.' });
  }
});

apiRouter.post('/users', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, fullName, password, role, departmentId, designation, phone } = req.body;
    if (!username?.trim() || !email?.trim() || !fullName?.trim() || !password?.trim() || !role) {
      return res.status(400).json({ error: 'Username, email, full name, password, and role are required.' });
    }
    if (!['admin', 'teacher', 'hod'].includes(role)) {
      return res.status(400).json({ error: 'Use Student Enrollment to create student accounts.' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanEmail = String(email).trim().toLowerCase();

    const [created] = await db
      .insert(users)
      .values({
        uid: `local:${cleanUsername}`,
        username: cleanUsername,
        email: cleanEmail,
        fullName: String(fullName).trim(),
        passwordHash: hashPassword(String(password)),
        role,
        departmentId: departmentId ? Number(departmentId) : null,
        designation: String(designation || (role === 'hod' ? 'Head of Department' : 'Faculty Member')).trim(),
        phone: String(phone || '').trim(),
        avatarUrl:
          role === 'teacher'
            ? '/src/assets/images/avatar_faculty_prof_1795351454135.jpg'
            : '/src/assets/images/avatar_admin_dean_1795351455226.jpg',
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        role: users.role,
        departmentId: users.departmentId,
        designation: users.designation,
        phone: users.phone,
        isActive: users.isActive,
      });

    await logActivity(req.authUser!, 'Provisioned Staff Account', 'user', `Created ${role.toUpperCase()} account for ${created.fullName}`);
    return res.status(201).json({ user: created });
  } catch (error: unknown) {
    const pgErr = error as { code?: string };
    if (pgErr?.code === '23505') {
      return res.status(409).json({ error: 'Username or email is already registered.' });
    }
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Could not create account.' });
  }
});

apiRouter.delete('/users/:id', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (id === req.authUser!.id) {
      return res.status(400).json({ error: 'You cannot delete your own active session account.' });
    }
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'User not found.' });
    await logActivity(req.authUser!, 'Removed User Account', 'user', `Deleted user ${deleted.username}`);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Could not delete account.' });
  }
});

// ============================================================================
// GRADE BOUNDARIES, SETTINGS, ACTIVITIES, NOTIFICATIONS & PROFILE
// ============================================================================

apiRouter.get('/grade-boundaries', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const boundaries = await fetchGradeBoundaries();
    return res.json({ gradeBoundaries: boundaries });
  } catch (error) {
    console.error('Fetch grade boundaries error:', error);
    return res.status(500).json({ error: 'Could not load grade boundaries.' });
  }
});

apiRouter.put(
  '/grade-boundaries',
  requireAuth,
  requireRole(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const items = req.body.boundaries as Array<{
        id: number;
        grade: string;
        minPercentage: number;
        maxPercentage: number;
        gradePoint: number;
        description: string;
      }>;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Grade boundaries array is required.' });
      }

      for (const item of items) {
        if (item.minPercentage < 0 || item.maxPercentage > 100 || item.minPercentage > item.maxPercentage) {
          return res.status(400).json({ error: `Invalid percentage range for grade ${item.grade}.` });
        }
        await db
          .update(gradeBoundaries)
          .set({
            minPercentage: Number(item.minPercentage),
            maxPercentage: Number(item.maxPercentage),
            gradePoint: Number(item.gradePoint),
            description: String(item.description || '').trim(),
          })
          .where(eq(gradeBoundaries.id, Number(item.id)));
      }

      await logActivity(req.authUser!, 'Updated Grading Scale', 'settings', 'Modified college grade boundaries.');
      const updated = await fetchGradeBoundaries();
      return res.json({ gradeBoundaries: updated });
    } catch (error) {
      console.error('Update grade boundaries error:', error);
      return res.status(500).json({ error: 'Could not update grading scale.' });
    }
  }
);

apiRouter.get('/settings', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const [settings] = await db.select().from(collegeSettings).limit(1);
    return res.json({ settings });
  } catch (error) {
    console.error('Fetch settings error:', error);
    return res.status(500).json({ error: 'Could not load college settings.' });
  }
});

apiRouter.put('/settings', requireAuth, requireRole(['admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { collegeName, collegeCode, affiliation, address, email, phone, currentAcademicYear } = req.body;
    const [existing] = await db.select().from(collegeSettings).limit(1);
    if (!existing) {
      const [created] = await db
        .insert(collegeSettings)
        .values({
          collegeName: String(collegeName || 'Meridian Institute of Engineering & Technology').trim(),
          collegeCode: String(collegeCode || 'MIET-2026').trim(),
          affiliation: String(affiliation || '').trim(),
          address: String(address || '').trim(),
          email: String(email || '').trim(),
          phone: String(phone || '').trim(),
          currentAcademicYear: String(currentAcademicYear || '2026-2027').trim(),
        })
        .returning();
      return res.json({ settings: created });
    }

    const [updated] = await db
      .update(collegeSettings)
      .set({
        collegeName: String(collegeName || existing.collegeName).trim(),
        collegeCode: String(collegeCode || existing.collegeCode).trim(),
        affiliation: String(affiliation || existing.affiliation).trim(),
        address: String(address || existing.address).trim(),
        email: String(email || existing.email).trim(),
        phone: String(phone || existing.phone).trim(),
        currentAcademicYear: String(currentAcademicYear || existing.currentAcademicYear).trim(),
        updatedAt: new Date(),
      })
      .where(eq(collegeSettings.id, existing.id))
      .returning();

    await logActivity(req.authUser!, 'Updated College Settings', 'settings', `Updated institution profile (${updated.currentAcademicYear}).`);
    return res.json({ settings: updated });
  } catch (error) {
    console.error('Update settings error:', error);
    return res.status(500).json({ error: 'Could not update college settings.' });
  }
});

apiRouter.get('/activities', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit || 15), 50);
    const rows = await db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
    return res.json({ activities: rows });
  } catch (error) {
    console.error('Fetch activities error:', error);
    return res.status(500).json({ error: 'Could not load activity log.' });
  }
});

apiRouter.get('/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const rows = await db
      .select()
      .from(notifications)
      .where(
        or(
          eq(notifications.targetRole, 'all'),
          eq(notifications.targetRole, user.role),
          eq(notifications.targetUserId, user.id)
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(20);
    return res.json({ notifications: rows });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ error: 'Could not load notifications.' });
  }
});

apiRouter.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
    return res.json({ ok: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ error: 'Could not update notification.' });
  }
});

apiRouter.post('/notifications', requireAuth, requireRole(['admin', 'hod']), async (req: AuthRequest, res: Response) => {
  try {
    const { targetRole, title, message, category } = req.body;
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'Notification title and message are required.' });
    }
    const [created] = await db
      .insert(notifications)
      .values({
        targetRole: String(targetRole || 'all'),
        title: String(title).trim(),
        message: String(message).trim(),
        category: String(category || 'academic'),
      })
      .returning();
    await logActivity(req.authUser!, 'Sent Broadcast Notice', 'notification', `Sent "${created.title}" to ${created.targetRole}`);
    return res.status(201).json({ notification: created });
  } catch (error) {
    console.error('Create notification error:', error);
    return res.status(500).json({ error: 'Could not publish announcement.' });
  }
});

apiRouter.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.authUser!;
    const { fullName, phone, designation, newPassword } = req.body;
    const updates: Record<string, unknown> = {};
    if (fullName?.trim()) updates.fullName = String(fullName).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (designation !== undefined && user.role !== 'student') {
      updates.designation = String(designation).trim();
    }
    if (newPassword?.trim()) {
      if (String(newPassword).trim().length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      updates.passwordHash = hashPassword(String(newPassword).trim());
    }

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }

    if (user.role === 'student' && user.studentId && (fullName?.trim() || phone !== undefined)) {
      await db
        .update(students)
        .set({
          ...(fullName?.trim() ? { fullName: String(fullName).trim() } : {}),
          ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
        })
        .where(and(eq(students.id, user.studentId), eq(students.userId, user.id)));
    }

    await logActivity(user, 'Updated Profile', 'profile', 'Updated personal account details.');
    return res.json({ ok: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Could not update profile.' });
  }
});
