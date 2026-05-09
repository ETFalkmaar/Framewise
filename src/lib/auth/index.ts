export {
  AUTH_ERROR_CODES,
  NotAuthenticatedError,
  ForbiddenError,
  InvalidCredentialsError,
  RateLimitedError,
  type AuthErrorCode,
} from './errors';

export { sessionOptions, getSession, type SessionData } from './session';

export { verifyCredentials, startSession, endSession } from './login';

export {
  getCurrentUser,
  requireCurrentUser,
  getCurrentUserWithTenants,
  getActiveTenantForUser,
  isUserSuperAdmin,
  SUPER_ADMIN_ID,
} from './current-user';

export {
  canEditPages,
  canManageTenant,
  canViewTenant,
  isSuperAdmin,
  assertCanEditPages,
  assertCanManageTenant,
  assertCanViewTenant,
} from './permissions';

export { toPublicUser, type PublicUser } from './public-user';

export {
  AuthProvider,
  useUser,
  useOptionalUser,
  useUserTenants,
  useActiveTenantId,
} from './client-context';
