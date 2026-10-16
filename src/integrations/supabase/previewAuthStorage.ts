import { sessionOnlyStorage } from "@/lib/session";

/**
 * Replaced legacy storage broker with standard session-only storage.
 */
export function brokeredPreviewStorage() {
  return sessionOnlyStorage;
}
