import { neon } from '@neondatabase/serverless';

const databaseUrl = import.meta.env.VITE_DATABASE_URL as string | undefined;

export const sql = databaseUrl ? neon(databaseUrl) : null;
