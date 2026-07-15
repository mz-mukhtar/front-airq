/**
 * Client-side password validation mirroring the backend policy
 * (app/services/password_validation.py). This is for UX only — the backend
 * remains the source of truth and re-validates every password.
 */

const SPECIAL_CHARS = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/;

const COMMON_PASSWORDS = new Set([
  "password", "password123", "12345678", "123456789", "1234567890",
  "qwerty", "abc123", "letmein", "welcome", "admin", "root",
  "passw0rd", "password1", "password123", "admin123",
]);

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordCheck {
  valid: boolean;
  requirements: PasswordRequirement[];
  errors: string[];
}

function hasSequentialChars(pw: string): boolean {
  const s = pw.toLowerCase();
  for (let i = 0; i + 2 < s.length + 1 && i + 3 <= s.length; i++) {
    const chunk = s.slice(i, i + 3);
    if (/^\d{3}$/.test(chunk)) {
      const d = chunk.split("").map(Number);
      if (d[1] === d[0] + 1 && d[2] === d[1] + 1) return true;
    }
    if (/^[a-z]{3}$/.test(chunk)) {
      const c = chunk.split("").map((ch) => ch.charCodeAt(0));
      if (c[1] === c[0] + 1 && c[2] === c[1] + 1) return true;
    }
  }
  return false;
}

/** Validate a password against the backend policy. Returns per-rule status. */
export function validatePassword(password: string): PasswordCheck {
  const pw = password ?? "";

  const requirements: PasswordRequirement[] = [
    { id: "length", label: "12–128 characters", met: pw.length >= 12 && pw.length <= 128 },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(pw) },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(pw) },
    { id: "digit", label: "A number", met: /\d/.test(pw) },
    { id: "special", label: "A special character (!@#$…)", met: SPECIAL_CHARS.test(pw) },
  ];

  const errors: string[] = [];
  if (pw && COMMON_PASSWORDS.has(pw.toLowerCase())) {
    errors.push("Password is too common and easily guessable");
  }
  if (/(.)\1{3,}/.test(pw)) {
    errors.push("Too many repeated characters in a row");
  }
  if (hasSequentialChars(pw)) {
    errors.push("Avoid sequential characters like 123 or abc");
  }

  const valid = pw.length > 0 && requirements.every((r) => r.met) && errors.length === 0;
  return { valid, requirements, errors };
}
