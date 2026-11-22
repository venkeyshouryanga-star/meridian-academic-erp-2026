import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/security.ts';
import { db } from '../db/index.ts';
import { departments, students, users } from '../db/schema.ts';
import { ensureSeeded } from '../db/seed.ts';
import type { AuthUser, UserRole } from '../shared/types.ts';

export interface AuthRequest extends Request {
  authUser?: AuthUser;
}

const OWNER_ADMIN_EMAIL = 'vaddevenkey7@gmail.com';

async function hydrateAuthUser(userId: number): Promise<AuthUser | null> {
  const rows = await db
    .select({
      id: users.id,
      uid: users.uid,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
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
    .where(eq(users.id, userId))
    .limit(1);

  if (!rows.length || !rows[0].isActive) return null;
  const u = rows[0];

  let studentId: number | null = null;
  let rollNumber: string | null = null;

  if (u.role === 'student') {
    const [stu] = await db
      .select({ id: students.id, rollNumber: students.rollNumber })
      .from(students)
      .where(eq(students.userId, u.id))
      .limit(1);
    if (stu) {
      studentId = stu.id;
      rollNumber = stu.rollNumber;
    }
  }

  return {
    id: u.id,
    uid: u.uid,
    username: u.username,
    email: u.email,
    fullName: u.fullName,
    role: u.role as UserRole,
    departmentId: u.departmentId,
    departmentName: u.departmentName,
    designation: u.designation,
    phone: u.phone,
    avatarUrl: u.avatarUrl,
    studentId,
    rollNumber,
  };
}

export async function upsertFirebaseUser(
  uid: string,
  email: string,
  displayName?: string,
  photoURL?: string
): Promise<AuthUser> {
  await ensureSeeded();

  const existingByUid = await db
    .select()
    .from(users)
    .where(eq(users.uid, uid))
    .limit(1);

  if (existingByUid.length > 0) {
    const hydrated = await hydrateAuthUser(existingByUid[0].id);
    if (hydrated) return hydrated;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existingByEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existingByEmail.length > 0) {
    const [updated] = await db
      .update(users)
      .set({
        uid,
        fullName: displayName || existingByEmail[0].fullName,
        avatarUrl: photoURL || existingByEmail[0].avatarUrl,
      })
      .where(eq(users.id, existingByEmail[0].id))
      .returning();
    const hydrated = await hydrateAuthUser(updated.id);
    if (hydrated) return hydrated;
  }

  const baseUsername =
    normalizedEmail.split('@')[0].replace(/[^a-z0-9._-]/gi, '') || `user_${uid.slice(0, 6)}`;
  const uniqueUsername = `${baseUsername}_${uid.slice(0, 4).toLowerCase()}`;
  const assignedRole: UserRole =
    normalizedEmail === OWNER_ADMIN_EMAIL ? 'admin' : 'admin';

  const [created] = await db
    .insert(users)
    .values({
      uid,
      username: uniqueUsername,
      email: normalizedEmail,
      fullName: displayName || baseUsername,
      role: assignedRole,
      designation: assignedRole === 'admin' ? 'Academic Administrator (SSO)' : 'Faculty Member',
      avatarUrl: photoURL || '/src/assets/images/avatar_admin_dean_1795351455226.jpg',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: normalizedEmail,
        fullName: displayName || baseUsername,
      },
    })
    .returning();

  const hydrated = await hydrateAuthUser(created.id);
  if (!hydrated) {
    throw new Error('Unable to initialize authenticated account.');
  }
  return hydrated;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is missing.' });
  }

  try {
    await ensureSeeded();

    // 1. Try institutional server-signed session token
    if (token.startsWith('meridian.')) {
      const payload = verifySessionToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      }
      const user = await hydrateAuthUser(payload.userId);
      if (!user) {
        return res.status(401).json({ error: 'Account is inactive or no longer exists.' });
      }
      req.authUser = user;
      return next();
    }

    // 2. Verify Firebase Auth ID Token (Google SSO)
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || `${decodedToken.uid}@meridian.edu`;
    const user = await upsertFirebaseUser(
      decodedToken.uid,
      email,
      decodedToken.name,
      decodedToken.picture
    );
    req.authUser = user;
    return next();
  } catch (error) {
    console.error('Authentication verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized: invalid or expired credentials.' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    return next();
  };
};
