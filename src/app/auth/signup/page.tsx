import { NewOrgRegistrationForm } from "@/components/auth/new-org-registration-form";

/**
 * Signup Page - New Organization Registration Only
 *
 * This page is for NEW organizations only. Existing organization members
 * should be invited through the join-request system.
 */
export default function SignUpPage() {
  return <NewOrgRegistrationForm />;
}