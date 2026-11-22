export type UserRole = 'admin' | 'teacher' | 'student' | 'hod';

export interface AuthUser {
  id: number;
  uid: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: number | null;
  departmentName?: string | null;
  designation: string;
  phone: string;
  avatarUrl: string;
  studentId?: number | null;
  rollNumber?: string | null;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description: string;
  hodName: string;
  studentCount?: number;
  subjectCount?: number;
  classCount?: number;
}

export interface ClassGroup {
  id: number;
  name: string;
  semester: number;
  section: string;
  academicYear: string;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  studentCount?: number;
}

export interface StudentRecord {
  id: number;
  userId: number | null;
  rollNumber: string;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  admissionYear: number;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  classId: number;
  className?: string;
  semester?: number;
  guardianName: string;
  address: string;
  username?: string | null;
}

export interface SubjectRecord {
  id: number;
  code: string;
  name: string;
  departmentId: number;
  departmentName?: string;
  departmentCode?: string;
  classId: number;
  className?: string;
  teacherId: number | null;
  teacherName?: string | null;
  maxMarks: number;
  passingMarks: number;
  credits: number;
}

export interface ExaminationRecord {
  id: number;
  name: string;
  examType: string;
  academicYear: string;
  semester: number;
  startDate: string;
  endDate: string;
  status: string;
}

export interface GradeBoundary {
  id: number;
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoint: number;
  description: string;
  sortOrder: number;
}

export interface MarkEntry {
  id: number;
  studentId: number;
  studentName: string;
  rollNumber: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  classId: number;
  className: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  examinationId: number;
  examinationName: string;
  examType: string;
  academicYear: string;
  marksObtained: number;
  maxMarks: number;
  passingMarks: number;
  percentage: number;
  grade: string;
  status: 'Pass' | 'Fail';
  remarks: string;
  updatedAt: string;
}

export interface StudentResultSummary {
  studentId: number;
  rollNumber: string;
  studentName: string;
  email: string;
  departmentId: number;
  departmentName: string;
  departmentCode: string;
  classId: number;
  className: string;
  semester: number;
  examinationId: number | null;
  examinationName: string;
  academicYear: string;
  subjectsCount: number;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: string;
  gradePoint: number;
  resultStatus: 'Pass' | 'Fail';
  failedSubjectsCount: number;
  subjects: Array<{
    markId: number;
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    credits: number;
    marksObtained: number;
    maxMarks: number;
    passingMarks: number;
    percentage: number;
    grade: string;
    status: 'Pass' | 'Fail';
    remarks: string;
  }>;
}

export interface ActivityItem {
  id: number;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  details: string;
  createdAt: string;
}

export interface NotificationItem {
  id: number;
  targetRole: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

export interface CollegeSettings {
  id: number;
  collegeName: string;
  collegeCode: string;
  affiliation: string;
  address: string;
  email: string;
  phone: string;
  currentAcademicYear: string;
}

export interface AnalyticsPayload {
  summary: {
    totalStudents: number;
    totalTeachers: number;
    totalSubjects: number;
    totalExaminations: number;
    totalMarksEntries: number;
    overallPassPercentage: number;
    averagePercentage: number;
    passedCount: number;
    failedCount: number;
  };
  studentPerformance: Array<{
    studentId: number;
    rollNumber: string;
    studentName: string;
    departmentCode: string;
    className: string;
    percentage: number;
    grade: string;
    status: 'Pass' | 'Fail';
  }>;
  subjectPerformance: Array<{
    subjectId: number;
    subjectCode: string;
    subjectName: string;
    departmentCode: string;
    averagePercentage: number;
    passRate: number;
    entriesCount: number;
    highestMarks: number;
    maxMarks: number;
  }>;
  classPerformance: Array<{
    classId: number;
    className: string;
    departmentCode: string;
    averagePercentage: number;
    passRate: number;
    studentCount: number;
  }>;
  departmentPerformance: Array<{
    departmentId: number;
    departmentCode: string;
    departmentName: string;
    averagePercentage: number;
    passRate: number;
    studentCount: number;
    failCount: number;
  }>;
  examTrend: Array<{
    examinationId: number;
    examinationName: string;
    startDate: string;
    averagePercentage: number;
    passRate: number;
    entriesCount: number;
  }>;
  gradeDistribution: Array<{
    grade: string;
    count: number;
  }>;
  toppers: Array<{
    studentId: number;
    rollNumber: string;
    studentName: string;
    departmentCode: string;
    className: string;
    percentage: number;
    grade: string;
    totalObtained: number;
    totalMax: number;
  }>;
  needsImprovement: Array<{
    studentId: number;
    rollNumber: string;
    studentName: string;
    departmentCode: string;
    className: string;
    percentage: number;
    grade: string;
    failedSubjectsCount: number;
    resultStatus: 'Pass' | 'Fail';
  }>;
}

export function resolveGrade(
  percentage: number,
  boundaries: GradeBoundary[]
): { grade: string; gradePoint: number; description: string } {
  const sorted = [...boundaries].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const b of sorted) {
    if (percentage >= b.minPercentage && percentage <= b.maxPercentage + 0.001) {
      return {
        grade: b.grade,
        gradePoint: b.gradePoint,
        description: b.description,
      };
    }
  }
  const fallback = sorted[sorted.length - 1];
  return fallback
    ? { grade: fallback.grade, gradePoint: fallback.gradePoint, description: fallback.description }
    : { grade: 'E', gradePoint: 0, description: 'Needs Improvement' };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
