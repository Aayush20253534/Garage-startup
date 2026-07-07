-- Add the restricted staff role used by the private intern portal.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INTERN';
