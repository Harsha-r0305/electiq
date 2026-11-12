export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const httpError = (status, message) => new HttpError(status, message);

// Translate PostgreSQL errors into safe, readable API errors.
export function mapError(e) {
  if (e instanceof HttpError) return [e.status, e.message];
  switch (e?.code) {
    case '42501': return [403, 'You do not have permission to do that.'];
    case '23505': return [409, 'That record already exists.'];
    case '23503': return [409, 'A referenced record does not exist, or this record is still in use.'];
    case '23514': return [400, `A value is outside the allowed range (${e.constraint ?? 'check constraint'}).`];
    case '23502': return [400, 'A required value is missing.'];
    case '22003': case '22P02': case 'P0001': case 'P0002': return [400, e.message];
  }
  console.error(e);
  return [500, 'Something went wrong on the server.'];
}
