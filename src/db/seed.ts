import { count } from 'drizzle-orm';
import { db } from './index.ts';
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
} from './schema.ts';
import { hashPassword } from '../lib/security.ts';

let seedPromise: Promise<void> | null = null;
let seededChecked = false;

export async function ensureSeeded(): Promise<void> {
  if (seededChecked) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      const [{ value: deptCount }] = await db.select({ value: count() }).from(departments);
      if (Number(deptCount) > 0) {
        seededChecked = true;
        return;
      }

      // 1. College Settings
      await db.insert(collegeSettings).values({
        collegeName: 'Meridian Institute of Engineering & Technology',
        collegeCode: 'MIET-2026',
        affiliation: 'Autonomous Institution · Accredited NAAC A+',
        address: '42 Academic Boulevard, Innovation District, Bengaluru 560064',
        email: 'registrar@meridian.edu',
        phone: '+91 80 4120 8800',
        currentAcademicYear: '2026-2027',
      });

      // 2. Configurable Grade Boundaries
      await db.insert(gradeBoundaries).values([
        { grade: 'A+', minPercentage: 90, maxPercentage: 100, gradePoint: 10.0, description: 'Outstanding', sortOrder: 1 },
        { grade: 'A', minPercentage: 80, maxPercentage: 89.99, gradePoint: 9.0, description: 'Excellent', sortOrder: 2 },
        { grade: 'B', minPercentage: 70, maxPercentage: 79.99, gradePoint: 8.0, description: 'Very Good', sortOrder: 3 },
        { grade: 'C', minPercentage: 60, maxPercentage: 69.99, gradePoint: 7.0, description: 'Good', sortOrder: 4 },
        { grade: 'D', minPercentage: 50, maxPercentage: 59.99, gradePoint: 6.0, description: 'Satisfactory', sortOrder: 5 },
        { grade: 'E', minPercentage: 0, maxPercentage: 49.99, gradePoint: 0.0, description: 'Needs Improvement', sortOrder: 6 },
      ]);

      // 3. Departments
      const insertedDepts = await db
        .insert(departments)
        .values([
          {
            name: 'Computer Science & Engineering',
            code: 'CSE',
            description: 'Algorithms, distributed systems, software engineering, and machine intelligence.',
            hodName: 'Dr. Kavitha Subramanian',
          },
          {
            name: 'Electronics & Communication',
            code: 'ECE',
            description: 'VLSI design, embedded architectures, signal processing, and RF systems.',
            hodName: 'Dr. Arvind Narayanan',
          },
          {
            name: 'AI & Data Science',
            code: 'AIDS',
            description: 'Statistical modeling, deep learning, data engineering, and computational analytics.',
            hodName: 'Dr. Meenakshi Deshmukh',
          },
          {
            name: 'Mechanical Engineering',
            code: 'MECH',
            description: 'Thermodynamics, robotics, precision manufacturing, and structural mechanics.',
            hodName: 'Dr. Rajeshwar Kulkarni',
          },
        ])
        .returning();

      const deptMap = new Map(insertedDepts.map((d) => [d.code, d]));
      const cseId = deptMap.get('CSE')!.id;
      const eceId = deptMap.get('ECE')!.id;
      const aidsId = deptMap.get('AIDS')!.id;
      const mechId = deptMap.get('MECH')!.id;

      // 4. Classes
      const insertedClasses = await db
        .insert(classes)
        .values([
          { name: 'CSE Semester 5 - A', semester: 5, section: 'A', academicYear: '2026-2027', departmentId: cseId },
          { name: 'CSE Semester 5 - B', semester: 5, section: 'B', academicYear: '2026-2027', departmentId: cseId },
          { name: 'ECE Semester 5 - A', semester: 5, section: 'A', academicYear: '2026-2027', departmentId: eceId },
          { name: 'AI-DS Semester 3 - A', semester: 3, section: 'A', academicYear: '2026-2027', departmentId: aidsId },
          { name: 'MECH Semester 5 - A', semester: 5, section: 'A', academicYear: '2026-2027', departmentId: mechId },
        ])
        .returning();

      const cse5A = insertedClasses[0].id;
      const cse5B = insertedClasses[1].id;
      const ece5A = insertedClasses[2].id;
      const aids3A = insertedClasses[3].id;
      const mech5A = insertedClasses[4].id;

      // 5. Core Users (Admin, Teachers, HODs) — hashed with salted scrypt
      const adminHash = hashPassword('Admin@2026');
      const teacherHash = hashPassword('Teacher@2026');
      const hodHash = hashPassword('Hod@2026');
      const studentHash = hashPassword('Student@2026');

      const insertedStaff = await db
        .insert(users)
        .values([
          {
            uid: 'local:admin',
            username: 'admin',
            email: 'admin@meridian.edu',
            fullName: 'Dr. Nandini Raghavan',
            passwordHash: adminHash,
            role: 'admin',
            departmentId: cseId,
            designation: 'Dean of Academic Affairs',
            phone: '+91 98450 11200',
            avatarUrl: '/src/assets/images/avatar_admin_dean_1795351455226.jpg',
          },
          {
            uid: 'local:teacher',
            username: 'teacher',
            email: 'eleanor.vance@meridian.edu',
            fullName: 'Prof. Eleanor Vance',
            passwordHash: teacherHash,
            role: 'teacher',
            departmentId: cseId,
            designation: 'Associate Professor, CSE',
            phone: '+91 98450 22310',
            avatarUrl: '/src/assets/images/avatar_faculty_prof_1795351454135.jpg',
          },
          {
            uid: 'local:teacher2',
            username: 'prof.sharma',
            email: 'rohan.sharma@meridian.edu',
            fullName: 'Prof. Rohan Sharma',
            passwordHash: teacherHash,
            role: 'teacher',
            departmentId: eceId,
            designation: 'Assistant Professor, ECE',
            phone: '+91 98450 22314',
            avatarUrl: '/src/assets/images/avatar_faculty_prof_1795351454135.jpg',
          },
          {
            uid: 'local:teacher3',
            username: 'prof.iyer',
            email: 'ananya.iyer@meridian.edu',
            fullName: 'Dr. Ananya Iyer',
            passwordHash: teacherHash,
            role: 'teacher',
            departmentId: aidsId,
            designation: 'Professor, AI & Data Science',
            phone: '+91 98450 22318',
            avatarUrl: '/src/assets/images/avatar_faculty_prof_1795351454135.jpg',
          },
          {
            uid: 'local:hod',
            username: 'hod',
            email: 'hod.cse@meridian.edu',
            fullName: 'Dr. Kavitha Subramanian',
            passwordHash: hodHash,
            role: 'hod',
            departmentId: cseId,
            designation: 'Head of Department, CSE',
            phone: '+91 98450 33100',
            avatarUrl: '/src/assets/images/avatar_admin_dean_1795351455226.jpg',
          },
        ])
        .returning();

      const adminUser = insertedStaff[0];
      const teacher1 = insertedStaff[1];
      const teacher2 = insertedStaff[2];
      const teacher3 = insertedStaff[3];

      // 6. Subjects
      const insertedSubjects = await db
        .insert(subjects)
        .values([
          { code: 'CS501', name: 'Database Management Systems', departmentId: cseId, classId: cse5A, teacherId: teacher1.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'CS502', name: 'Operating Systems', departmentId: cseId, classId: cse5A, teacherId: teacher1.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'CS503', name: 'Computer Networks', departmentId: cseId, classId: cse5A, teacherId: teacher1.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'CS504', name: 'Software Engineering', departmentId: cseId, classId: cse5A, teacherId: teacher1.id, maxMarks: 100, passingMarks: 40, credits: 3 },
          { code: 'CS505', name: 'Web Systems Architecture', departmentId: cseId, classId: cse5B, teacherId: teacher1.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'CS506', name: 'Compiler Design', departmentId: cseId, classId: cse5B, teacherId: teacher1.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'EC501', name: 'Digital Signal Processing', departmentId: eceId, classId: ece5A, teacherId: teacher2.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'EC502', name: 'VLSI Circuit Design', departmentId: eceId, classId: ece5A, teacherId: teacher2.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'EC503', name: 'Embedded Microcontrollers', departmentId: eceId, classId: ece5A, teacherId: teacher2.id, maxMarks: 100, passingMarks: 40, credits: 3 },
          { code: 'AD301', name: 'Statistical Machine Learning', departmentId: aidsId, classId: aids3A, teacherId: teacher3.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'AD302', name: 'Data Structures & Warehousing', departmentId: aidsId, classId: aids3A, teacherId: teacher3.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'ME501', name: 'Applied Thermodynamics', departmentId: mechId, classId: mech5A, teacherId: teacher2.id, maxMarks: 100, passingMarks: 40, credits: 4 },
          { code: 'ME502', name: 'Kinematics of Machinery', departmentId: mechId, classId: mech5A, teacherId: teacher2.id, maxMarks: 100, passingMarks: 40, credits: 4 },
        ])
        .returning();

      const subjByCode = new Map(insertedSubjects.map((s) => [s.code, s]));

      // 7. Examinations
      const insertedExams = await db
        .insert(examinations)
        .values([
          {
            name: 'Internal Assessment I',
            examType: 'Internal',
            academicYear: '2026-2027',
            semester: 5,
            startDate: '2026-08-18',
            endDate: '2026-08-24',
            status: 'Published',
          },
          {
            name: 'Mid-Semester Examination',
            examType: 'Mid-Term',
            academicYear: '2026-2027',
            semester: 5,
            startDate: '2026-09-28',
            endDate: '2026-10-05',
            status: 'Published',
          },
          {
            name: 'End-Semester Final Exam',
            examType: 'Final',
            academicYear: '2026-2027',
            semester: 5,
            startDate: '2026-11-04',
            endDate: '2026-11-16',
            status: 'Published',
          },
        ])
        .returning();

      const examIA1 = insertedExams[0];
      const examMid = insertedExams[1];
      const examFinal = insertedExams[2];

      // 8. Students (16 realistic students across departments, first student is primary demo 'student' account)
      const studentSpecs = [
        { username: 'student', roll: 'CSE24001', name: 'Aarav Menon', email: 'aarav.menon@meridian.edu', dept: cseId, cls: cse5A, gender: 'Male', dob: '2005-04-14', guardian: 'Suresh Menon', scores: { CS501: [88, 91, 94], CS502: [84, 86, 89], CS503: [81, 85, 92], CS504: [90, 92, 95] } },
        { username: 'cse24002', roll: 'CSE24002', name: 'Diya Krishnan', email: 'diya.krishnan@meridian.edu', dept: cseId, cls: cse5A, gender: 'Female', dob: '2005-07-22', guardian: 'Ramesh Krishnan', scores: { CS501: [92, 95, 96], CS502: [89, 91, 93], CS503: [86, 89, 91], CS504: [94, 93, 97] } },
        { username: 'cse24003', roll: 'CSE24003', name: 'Siddharth Verma', email: 'siddharth.verma@meridian.edu', dept: cseId, cls: cse5A, gender: 'Male', dob: '2005-02-11', guardian: 'Alok Verma', scores: { CS501: [71, 74, 78], CS502: [68, 72, 75], CS503: [64, 67, 71], CS504: [76, 79, 82] } },
        { username: 'cse24004', roll: 'CSE24004', name: 'Meera Nair', email: 'meera.nair@meridian.edu', dept: cseId, cls: cse5A, gender: 'Female', dob: '2005-09-03', guardian: 'Vinod Nair', scores: { CS501: [79, 82, 85], CS502: [75, 78, 81], CS503: [77, 80, 84], CS504: [82, 84, 88] } },
        { username: 'cse24005', roll: 'CSE24005', name: 'Kabir Malhotra', email: 'kabir.malhotra@meridian.edu', dept: cseId, cls: cse5A, gender: 'Male', dob: '2005-11-19', guardian: 'Deepak Malhotra', scores: { CS501: [42, 46, 51], CS502: [34, 38, 35], CS503: [48, 45, 52], CS504: [55, 58, 61] } },
        { username: 'cse24006', roll: 'CSE24006', name: 'Ishita Banerjee', email: 'ishita.banerjee@meridian.edu', dept: cseId, cls: cse5A, gender: 'Female', dob: '2005-05-30', guardian: 'Subrata Banerjee', scores: { CS501: [62, 66, 69], CS502: [58, 61, 64], CS503: [54, 59, 63], CS504: [67, 71, 74] } },
        { username: 'cse24007', roll: 'CSE24007', name: 'Pranav Joshi', email: 'pranav.joshi@meridian.edu', dept: cseId, cls: cse5B, gender: 'Male', dob: '2005-08-12', guardian: 'Milind Joshi', scores: { CS505: [84, 87, 90], CS506: [79, 83, 86] } },
        { username: 'cse24008', roll: 'CSE24008', name: 'Anjali Deshpande', email: 'anjali.deshpande@meridian.edu', dept: cseId, cls: cse5B, gender: 'Female', dob: '2005-01-27', guardian: 'Prakash Deshpande', scores: { CS505: [91, 93, 95], CS506: [88, 90, 92] } },
        { username: 'cse24009', roll: 'CSE24009', name: 'Vikramaditya Rao', email: 'vikram.rao@meridian.edu', dept: cseId, cls: cse5B, gender: 'Male', dob: '2005-06-08', guardian: 'Srinivas Rao', scores: { CS505: [36, 39, 37], CS506: [44, 42, 48] } },
        { username: 'ece24001', roll: 'ECE24001', name: 'Neha Choudhary', email: 'neha.choudhary@meridian.edu', dept: eceId, cls: ece5A, gender: 'Female', dob: '2005-03-17', guardian: 'Mahesh Choudhary', scores: { EC501: [85, 88, 91], EC502: [82, 84, 87], EC503: [88, 90, 93] } },
        { username: 'ece24002', roll: 'ECE24002', name: 'Rohan Kulkarni', email: 'rohan.kulkarni@meridian.edu', dept: eceId, cls: ece5A, gender: 'Male', dob: '2005-10-09', guardian: 'Sanjay Kulkarni', scores: { EC501: [69, 73, 76], EC502: [65, 68, 72], EC503: [74, 77, 80] } },
        { username: 'ece24003', roll: 'ECE24003', name: 'Tanvi Saxena', email: 'tanvi.saxena@meridian.edu', dept: eceId, cls: ece5A, gender: 'Female', dob: '2005-12-02', guardian: 'Vivek Saxena', scores: { EC501: [38, 41, 36], EC502: [45, 49, 53], EC503: [52, 55, 58] } },
        { username: 'aid25001', roll: 'AID25001', name: 'Devansh Kapoor', email: 'devansh.kapoor@meridian.edu', dept: aidsId, cls: aids3A, gender: 'Male', dob: '2006-02-20', guardian: 'Rajiv Kapoor', scores: { AD301: [89, 92, 94], AD302: [85, 88, 91] } },
        { username: 'aid25002', roll: 'AID25002', name: 'Shreya Reddy', email: 'shreya.reddy@meridian.edu', dept: aidsId, cls: aids3A, gender: 'Female', dob: '2006-06-15', guardian: 'Venkat Reddy', scores: { AD301: [76, 80, 83], AD302: [79, 82, 86] } },
        { username: 'mec24001', roll: 'MEC24001', name: 'Aditya Tiwari', email: 'aditya.tiwari@meridian.edu', dept: mechId, cls: mech5A, gender: 'Male', dob: '2005-07-07', guardian: 'Narendra Tiwari', scores: { ME501: [72, 76, 80], ME502: [68, 73, 77] } },
        { username: 'mec24002', roll: 'MEC24002', name: 'Harshitha Gowda', email: 'harshitha.gowda@meridian.edu', dept: mechId, cls: mech5A, gender: 'Female', dob: '2005-09-25', guardian: 'Manjunath Gowda', scores: { ME501: [81, 84, 88], ME502: [85, 87, 90] } },
      ];

      const markRowsToInsert: Array<{
        studentId: number;
        subjectId: number;
        examinationId: number;
        marksObtained: number;
        maxMarks: number;
        passingMarks: number;
        remarks: string;
        enteredBy: number;
      }> = [];

      const examsOrdered = [examIA1, examMid, examFinal];

      for (const spec of studentSpecs) {
        const [studentUser] = await db
          .insert(users)
          .values({
            uid: `local:${spec.username}`,
            username: spec.username,
            email: spec.email,
            fullName: spec.name,
            passwordHash: studentHash,
            role: 'student',
            departmentId: spec.dept,
            designation: 'Undergraduate Scholar',
            phone: '+91 98451 40000',
            avatarUrl: '/src/assets/images/avatar_student_scholar_1795351453031.jpg',
          })
          .returning();

        const [studentRow] = await db
          .insert(students)
          .values({
            userId: studentUser.id,
            rollNumber: spec.roll,
            fullName: spec.name,
            email: spec.email,
            phone: '+91 98451 40000',
            gender: spec.gender,
            dateOfBirth: spec.dob,
            admissionYear: spec.roll.includes('25') ? 2025 : 2024,
            departmentId: spec.dept,
            classId: spec.cls,
            guardianName: spec.guardian,
            address: 'Bengaluru, Karnataka',
          })
          .returning();

        for (const [subCode, examMarks] of Object.entries(spec.scores)) {
          const subject = subjByCode.get(subCode);
          if (!subject) continue;
          examMarks.forEach((score, idx) => {
            const exam = examsOrdered[idx];
            markRowsToInsert.push({
              studentId: studentRow.id,
              subjectId: subject.id,
              examinationId: exam.id,
              marksObtained: score,
              maxMarks: subject.maxMarks,
              passingMarks: subject.passingMarks,
              remarks:
                score >= 90
                  ? 'Distinction performance'
                  : score < subject.passingMarks
                    ? 'Requires remedial coaching'
                    : 'Satisfactory progress',
              enteredBy: subject.teacherId ?? teacher1.id,
            });
          });
        }
      }

      if (markRowsToInsert.length > 0) {
        await db.insert(marks).values(markRowsToInsert);
      }

      // 9. Recent Activities
      await db.insert(activities).values([
        {
          actorId: adminUser.id,
          actorName: adminUser.fullName,
          actorRole: 'admin',
          action: 'Published Examination Results',
          entityType: 'examination',
          details: 'Published End-Semester Final Exam results for Academic Year 2026-2027.',
        },
        {
          actorId: teacher1.id,
          actorName: teacher1.fullName,
          actorRole: 'teacher',
          action: 'Submitted Subject Marks',
          entityType: 'marks',
          details: 'Finalized CS501 Database Management Systems marks for CSE Semester 5 - A.',
        },
        {
          actorId: teacher2.id,
          actorName: teacher2.fullName,
          actorRole: 'teacher',
          action: 'Updated Evaluation Sheet',
          entityType: 'marks',
          details: 'Recorded EC501 Digital Signal Processing scores for ECE Semester 5 - A.',
        },
        {
          actorId: adminUser.id,
          actorName: adminUser.fullName,
          actorRole: 'admin',
          action: 'Verified Grade Boundaries',
          entityType: 'settings',
          details: 'Confirmed 6-tier autonomous grading scale (A+ through E) for 2026-2027.',
        },
      ]);

      // 10. Notifications
      await db.insert(notifications).values([
        {
          targetRole: 'all',
          title: 'End-Semester Final Results Published',
          message: 'Verified marks and downloadable PDF transcripts for End-Semester Final Exam 2026-2027 are now live.',
          category: 'result',
        },
        {
          targetRole: 'teacher',
          title: 'Marks Moderation Window',
          message: 'Please review borderline scores and confirm subject remarks before semester archival.',
          category: 'exam',
        },
        {
          targetRole: 'hod',
          title: 'Department Academic Review Ready',
          message: 'Department-wise pass percentages, topper rankings, and remediation lists have been refreshed.',
          category: 'academic',
        },
        {
          targetRole: 'student',
          title: 'Transcript PDF Download Available',
          message: 'Open My Results to inspect subject breakdowns and export your official college marksheet.',
          category: 'result',
        },
      ]);

      seededChecked = true;
    } catch (error) {
      seedPromise = null;
      console.error('Database seed error:', error);
      throw new Error('Failed to initialize academic records.', { cause: error });
    }
  })();

  return seedPromise;
}
