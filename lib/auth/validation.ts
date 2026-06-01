export type FieldErrors = Record<string, string>;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validateSignup(input: {
  username: string;
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.username.trim().length < 3)
    errors.username = "Username must be at least 3 characters.";
  if (!EMAIL.test(input.email)) errors.email = "Enter a valid email address.";
  if (input.password.length < 8)
    errors.password = "Password must be at least 8 characters.";
  return errors;
}

export function validateLogin(input: {
  email: string;
  password: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!input.email) errors.email = "Email is required.";
  if (!input.password) errors.password = "Password is required.";
  return errors;
}
