import { httpError } from './errors';

export function str(v, name, { min = 1, max = 500, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    throw httpError(400, `${name} is required.`);
  }
  const s = String(v).trim();
  if (s.length < min || s.length > max) throw httpError(400, `${name} must be ${min}-${max} characters.`);
  return s;
}
export function int(v, name, { min = -2147483648, max = 2147483647, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return null;
    throw httpError(400, `${name} is required.`);
  }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw httpError(400, `${name} must be a whole number between ${min} and ${max}.`);
  return n;
}
export function num(v, name, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isFinite(n) || n < min || n > max) throw httpError(400, `${name} must be a number between ${min} and ${max}.`);
  return n;
}
export const oneOf = (v, name, list) => {
  if (!list.includes(v)) throw httpError(400, `${name} must be one of: ${list.join(', ')}.`);
  return v;
};
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
export function password(v) {
  const s = String(v ?? '');
  if (s.length < 8 || s.length > 72 || !/[A-Za-z]/.test(s) || !/\d/.test(s))
    throw httpError(400, 'Password must be 8-72 characters and include a letter and a number.');
  return s;
}
