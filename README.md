# Meridian Academic ERP — College Student Marks Management System

A full-stack Student Marks Management System built with **React + TypeScript + Express + PostgreSQL (Cloud SQL via Drizzle ORM)**, **Firebase Auth**, **Chart.js**, **jsPDF**, and **SheetJS (XLSX)**.

## Core Portals & Demonstration Credentials

All portal passwords are stored as salted `scrypt` hashes in PostgreSQL (never plaintext). You can also authenticate using **Google Sign-In (Firebase Auth)**.

| Portal | Username | Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@2026` | Full CRUD for students, faculty, departments, classes, subjects, examinations, configurable grade boundaries, marks moderation, analytics, and PDF/Excel reports |
| **Teacher** | `teacher` | `Teacher@2026` | View assigned classes & subjects, batch marks entry with automatic max-score validation, live grade calculation, class analytics, and subject PDF/Excel reports |
| **Student** | `student` | `Student@2026` | Strictly isolated personal results portal, subject-wise marks breakdown, examination history, Chart.js progress graphs, downloadable PDF marksheet, and print view |
| **HOD** | `hod` | `Hod@2026` | Department-wise & class-wise analytics, topper leaderboards, failure statistics, academic improvement intervention lists, student comparison charts, and broadcast notices |

## Relational Database Schema (PostgreSQL / Drizzle ORM)

- `departments`, `classes`, `users`, `students`, `subjects`, `examinations`, `marks`, `grade_boundaries`, `activities`, `notifications`, `college_settings`

## Local Development

```bash
npm install
npm run dev
```

Ensure Cloud SQL PostgreSQL environment variables (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`) are configured in your runtime environment.
