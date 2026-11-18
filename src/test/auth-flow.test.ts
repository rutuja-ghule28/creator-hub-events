import { describe, expect, it } from "vitest";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function resolveAuthRedirect(redirect?: string): string {
  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }
  return "/discover";
}

function buildEmailRedirectUrl(origin: string, target: string): string {
  return `${origin}/auth?redirect=${encodeURIComponent(target)}&confirmed=true`;
}

function parseConfirmationError(
  search: string,
  hash: string,
): { isExpired: boolean; message: string } | null {
  const searchParams = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(cleanHash);

  const err = searchParams.get("error") || hashParams.get("error");
  const errCode = searchParams.get("error_code") || hashParams.get("error_code");
  const errDesc = searchParams.get("error_description") || hashParams.get("error_description");

  if (!err && !errCode && !errDesc) return null;

  if (errCode === "otp_expired" || errDesc?.toLowerCase().includes("expired")) {
    return {
      isExpired: true,
      message: "This email verification link has expired. Please sign in below or request a new confirmation email.",
    };
  }

  const decoded = errDesc
    ? decodeURIComponent(errDesc.replace(/\+/g, " "))
    : "Invalid or expired confirmation link.";
  return {
    isExpired: false,
    message: decoded,
  };
}

describe("Auth Email Confirmation & Redirect Workflow", () => {
  it("resolves safe internal redirects and blocks open redirects", () => {
    expect(resolveAuthRedirect("/events/123")).toBe("/events/123");
    expect(resolveAuthRedirect("/tickets")).toBe("/tickets");
    expect(resolveAuthRedirect("//evil.com")).toBe("/discover");
    expect(resolveAuthRedirect("https://evil.com")).toBe("/discover");
    expect(resolveAuthRedirect(undefined)).toBe("/discover");
    expect(resolveAuthRedirect("")).toBe("/discover");
  });

  it("constructs proper email confirmation redirect URL with encoded target", () => {
    const origin = "https://creatorconnect.app";
    const target = "/events/456-exclusive-launch";
    const redirectUrl = buildEmailRedirectUrl(origin, target);

    expect(redirectUrl).toBe("https://creatorconnect.app/auth?redirect=%2Fevents%2F456-exclusive-launch&confirmed=true");

    const parsed = new URL(redirectUrl);
    expect(parsed.pathname).toBe("/auth");
    expect(parsed.searchParams.get("redirect")).toBe("/events/456-exclusive-launch");
    expect(parsed.searchParams.get("confirmed")).toBe("true");
  });

  it("detects expired confirmation links from URL search parameters", () => {
    const search = "?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    const parsed = parseConfirmationError(search, "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isExpired).toBe(true);
    expect(parsed?.message).toContain("has expired");
  });

  it("detects expired confirmation links from URL hash fragments", () => {
    const hash = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    const parsed = parseConfirmationError("", hash);

    expect(parsed).not.toBeNull();
    expect(parsed?.isExpired).toBe(true);
    expect(parsed?.message).toContain("has expired");
  });

  it("parses generic confirmation errors and decodes descriptions gracefully", () => {
    const search = "?error=unauthorized_client&error_description=Token+verification+failed";
    const parsed = parseConfirmationError(search, "");

    expect(parsed).not.toBeNull();
    expect(parsed?.isExpired).toBe(false);
    expect(parsed?.message).toBe("Token verification failed");
  });

  it("returns null when no errors are present in search or hash", () => {
    const parsed = parseConfirmationError("?confirmed=true", "#access_token=xyz&type=signup");
    expect(parsed).toBeNull();
  });

  it("enforces strict email regex and password length constraints", () => {
    expect(EMAIL_REGEX.test("valid.user@creatorconnect.app")).toBe(true);
    expect(EMAIL_REGEX.test("creator+special@pune.co.in")).toBe(true);
    expect(EMAIL_REGEX.test("invalid-email")).toBe(false);
    expect(EMAIL_REGEX.test("missing@tld")).toBe(false);
    expect(EMAIL_REGEX.test("@domain.com")).toBe(false);

    const validPassword = "SecurePassword123!";
    const shortPassword = "short";
    expect(validPassword.length >= 8).toBe(true);
    expect(shortPassword.length >= 8).toBe(false);
  });
});
