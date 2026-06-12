import { Semester } from '../models/Semester.js';
import { ApiError } from './ApiError.js';

export const getActiveSemester = (orgId) =>
  orgId ? Semester.findOne({ organization: orgId, isActive: true }) : null;

// For write paths that require a term to exist.
export async function requireActiveSemester(orgId) {
  const s = await getActiveSemester(orgId);
  if (!s) {
    throw new ApiError(409, 'No active semester. An admin must start a semester first.');
  }
  return s;
}
