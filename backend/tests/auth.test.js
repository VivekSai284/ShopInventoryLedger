const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../src/config/env");
const app = require("../src/app");

const {
  startTestDatabase,
  stopTestDatabase,
  clearDatabase,
  createTestUser,
} = require("./testUtils");

describe("Authentication and authorization API", () => {
  let owner;
  let staff;
  let ownerToken;
  let staffToken;

  beforeAll(async () => {
    await startTestDatabase();
  });

  afterAll(async () => {
    await stopTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();

    owner = await createTestUser({
      name: "Test Owner",
      email: "owner@example.com",
      password: "OwnerPassword123!",
      role: "owner",
    });

    staff = await createTestUser({
      name: "Test Staff",
      email: "staff@example.com",
      password: "StaffPassword123!",
      role: "staff",
    });

    ownerToken = jwt.sign({ role: owner.role }, env.JWT_SECRET, {
      subject: owner._id.toString(),
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: "HS256",
    });

    staffToken = jwt.sign({ role: staff.role }, env.JWT_SECRET, {
      subject: staff._id.toString(),
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: "HS256",
    });
  });

  test("allows login with valid credentials", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "owner@example.com",
      password: "OwnerPassword123!",
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
    expect(response.body.data.user.role).toBe("owner");
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  test("rejects login with an incorrect password", async () => {
    const response = await request(app).post("/api/auth/login").send({
      email: "owner@example.com",
      password: "WrongPassword123!",
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  test("rejects access to the profile without a token", async () => {
    const response = await request(app).get("/api/auth/me");

    expect(response.status).toBe(401);
  });

  test("returns the current user with a valid token", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe("owner@example.com");
    expect(response.body.data.user.role).toBe("owner");
  });

  test("denies Staff access to Owner-only reports", async () => {
    const response = await request(app)
      .get("/api/reports/summary")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  test("allows Owner access to reports", async () => {
    const response = await request(app)
      .get("/api/reports/summary")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
