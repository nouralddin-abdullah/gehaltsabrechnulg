import { describe, it, expect } from "vitest";
import { validateSignup, validateLogin } from "@/lib/auth/validation";

describe("validateSignup", () => {
  it("accepts valid input", () => {
    expect(
      validateSignup({ username: "maxm", email: "max@acme.de", password: "supersecret" }),
    ).toEqual({});
  });
  it("rejects short username, bad email, short password", () => {
    const e = validateSignup({ username: "ab", email: "nope", password: "short" });
    expect(e.username).toBeTruthy();
    expect(e.email).toBeTruthy();
    expect(e.password).toBeTruthy();
  });
});

describe("validateLogin", () => {
  it("requires an email and a password", () => {
    const e = validateLogin({ email: "", password: "" });
    expect(e.email).toBeTruthy();
    expect(e.password).toBeTruthy();
  });
});
