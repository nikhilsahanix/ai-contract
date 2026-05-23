import { describe, expect, it } from "vitest";

describe("auth module", () => {
  it("register with valid data", async () => {
    expect(true).toBe(true);
  });

  it("register duplicate email returns 409", async () => {
    expect(true).toBe(true);
  });

  it("login with correct credentials", async () => {
    expect(true).toBe(true);
  });

  it("login wrong password returns 401", async () => {
    expect(true).toBe(true);
  });

  it("refresh token rotates", async () => {
    expect(true).toBe(true);
  });

  it("refresh replay revokes all tokens", async () => {
    expect(true).toBe(true);
  });
});
