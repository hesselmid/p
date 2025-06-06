import { db } from './db';
import { sessionsTable, usersTable, type UserRole } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';

export async function createSession(userId: number, cookies: Cookies): Promise<string> {
	const sessionId = crypto.randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

	await db.insert(sessionsTable).values({
		id: sessionId,
		userId,
		expiresAt
	});

	cookies.set('session', sessionId, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		expires: expiresAt
	});

	return sessionId;
}

export async function getSessionUser(sessionId: string | undefined) {
	if (!sessionId) {
		return null;
	}

	const now = new Date();
	const result = await db
		.select({
			id: usersTable.id,
			email: usersTable.email,
			firstName: usersTable.firstName,
			lastName: usersTable.lastName,
			role: usersTable.role
		})
		.from(sessionsTable)
		.innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
		.where(and(eq(sessionsTable.id, sessionId), gt(sessionsTable.expiresAt, now)))
		.limit(1);

	if (result.length > 0) {
		return {
			id: result[0].id,
			email: result[0].email,
			firstName: result[0].firstName,
			lastName: result[0].lastName,
			role: result[0].role as UserRole
		};
	}
	return null;
}

export async function deleteSession(sessionId: string, cookies: Cookies) {
	await db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId));
	cookies.delete('session', { path: '/' });
}
