import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { CollegeSettings, MarkEntry, StudentResultSummary } from '../shared/types';

export function exportStudentResultPDF(
  result: StudentResultSummary,
  college?: CollegeSettings | null
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const collegeName = college?.collegeName || 'Meridian Institute of Engineering & Technology';
  const affiliation = college?.affiliation || 'Autonomous Institution · NAAC A+';
  const address = college?.address || '42 Academic Boulevard, Bengaluru 560064';

  // Header band
  doc.setFillColor(11, 25, 51);
  doc.rect(0, 0, 595.28, 92, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(collegeName, 40, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(affiliation, 40, 54);
  doc.text(address, 40, 68);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('STATEMENT OF MARKS', 555, 42, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Academic Year: ${result.academicYear}`, 555, 58, { align: 'right' });

  // Student info block
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Name:', 40, 122);
  doc.text('Roll Number:', 340, 122);
  doc.text('Department:', 40, 142);
  doc.text('Class / Semester:', 340, 142);
  doc.text('Examination:', 40, 162);
  doc.text('Result Status:', 340, 162);

  doc.setFont('helvetica', 'normal');
  doc.text(result.studentName, 125, 122);
  doc.text(result.rollNumber, 435, 122);
  doc.text(`${result.departmentName} (${result.departmentCode})`, 125, 142);
  doc.text(`${result.className} · Sem ${result.semester}`, 435, 142);
  doc.text(result.examinationName, 125, 162);

  doc.setFont('helvetica', 'bold');
  if (result.resultStatus === 'Pass') {
    doc.setTextColor(21, 128, 61);
  } else {
    doc.setTextColor(185, 28, 28);
  }
  doc.text(result.resultStatus.toUpperCase(), 435, 162);

  // Subject table
  autoTable(doc, {
    startY: 184,
    head: [['Code', 'Subject Title', 'Credits', 'Max', 'Pass', 'Obtained', '%', 'Grade', 'Status']],
    body: result.subjects.map((s) => [
      s.subjectCode,
      s.subjectName,
      String(s.credits),
      String(s.maxMarks),
      String(s.passingMarks),
      String(s.marksObtained),
      `${s.percentage.toFixed(1)}%`,
      s.grade,
      s.status,
    ]),
    styles: { fontSize: 9, cellPadding: 6, textColor: [15, 23, 42] },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right' },
      7: { halign: 'center', fontStyle: 'bold' },
      8: { halign: 'center' },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 380;

  // Summary box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(40, finalY + 20, 515, 62, 4, 4, 'FD');

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL MARKS', 60, finalY + 42);
  doc.text('PERCENTAGE', 195, finalY + 42);
  doc.text('OVERALL GRADE', 325, finalY + 42);
  doc.text('GRADE POINT', 445, finalY + 42);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`${result.totalObtained} / ${result.totalMax}`, 60, finalY + 64);
  doc.text(`${result.percentage.toFixed(2)}%`, 195, finalY + 64);
  doc.text(result.grade, 325, finalY + 64);
  doc.text(result.gradePoint.toFixed(1), 445, finalY + 64);

  // Signatures
  const sigY = Math.min(finalY + 150, 760);
  doc.setDrawColor(148, 163, 184);
  doc.line(40, sigY, 180, sigY);
  doc.line(415, sigY, 555, sigY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Controller of Examinations', 40, sigY + 14);
  doc.text('Head of Department / Principal', 415, sigY + 14);

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated electronically on ${new Date().toLocaleDateString()} via Meridian Academic ERP.`,
    40,
    812
  );

  doc.save(`Result_${result.rollNumber}_${result.examinationName.replace(/\s+/g, '_')}.pdf`);
}

export function exportClassReportPDF(
  title: string,
  results: StudentResultSummary[],
  college?: CollegeSettings | null
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const collegeName = college?.collegeName || 'Meridian Institute of Engineering & Technology';

  doc.setFillColor(11, 25, 51);
  doc.rect(0, 0, 841.89, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(collegeName, 40, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(title, 40, 52);

  const passCount = results.filter((r) => r.resultStatus === 'Pass').length;
  const passRate = results.length ? ((passCount / results.length) * 100).toFixed(1) : '0.0';
  const avgPct = results.length
    ? (results.reduce((s, r) => s + r.percentage, 0) / results.length).toFixed(2)
    : '0.00';

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.text(
    `Students Evaluated: ${results.length}   |   Passed: ${passCount}   |   Failed: ${results.length - passCount}   |   Pass Rate: ${passRate}%   |   Mean Score: ${avgPct}%`,
    40,
    94
  );

  autoTable(doc, {
    startY: 110,
    head: [['Rank', 'Roll No', 'Student Name', 'Dept', 'Class', 'Exam', 'Obtained', 'Max', '%', 'Grade', 'Status']],
    body: results.map((r, i) => [
      String(i + 1),
      r.rollNumber,
      r.studentName,
      r.departmentCode,
      r.className,
      r.examinationName,
      String(r.totalObtained),
      String(r.totalMax),
      `${r.percentage.toFixed(1)}%`,
      r.grade,
      r.resultStatus,
    ]),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${title.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}

export function exportSubjectReportPDF(
  title: string,
  entries: MarkEntry[],
  college?: CollegeSettings | null
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const collegeName = college?.collegeName || 'Meridian Institute of Engineering & Technology';

  doc.setFillColor(11, 25, 51);
  doc.rect(0, 0, 595.28, 70, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(collegeName, 40, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text(title, 40, 52);

  autoTable(doc, {
    startY: 90,
    head: [['Roll No', 'Student', 'Subject', 'Exam', 'Score', 'Max', '%', 'Grade', 'Status']],
    body: entries.map((e) => [
      e.rollNumber,
      e.studentName,
      `${e.subjectCode} ${e.subjectName}`,
      e.examinationName,
      String(e.marksObtained),
      String(e.maxMarks),
      `${e.percentage.toFixed(1)}%`,
      e.grade,
      e.status,
    ]),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [29, 78, 216], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${title.replace(/[^a-z0-9]+/gi, '_')}.pdf`);
}

export function exportMarksExcel(
  filename: string,
  rows: Array<Record<string, string | number>>
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Academic_Report');
  XLSX.writeFile(workbook, `${filename.replace(/[^a-z0-9_-]+/gi, '_')}.xlsx`);
}
