
const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const env = require("../src/config/env");
const Product = require("../src/models/Product");

const {
  startTestDatabase,
  stopTestDatabase,
  clearDatabase,
  createTestUser,
} = require("./testUtils");

describe("Products API", () => {
  let owner;
  let staff;
  let ownerToken;
  let staffToken;
  let product;

  const validProduct = {
    sku: "RICE-001",
    name: "Basmati Rice",
    category: "Groceries",
    unit: "kg",
    sellingPrice: 120,
    lowStockThreshold: 5,
  };

  function createToken(user) {
    return jwt.sign(
      { role: user.role },
      env.JWT_SECRET,
      {
        subject: user._id.toString(),
        expiresIn: env.JWT_EXPIRES_IN,
        algorithm: "HS256",
      }
    );
  }

  async function createProduct(data = validProduct) {
    return Product.create(data);
  }

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
      role: "owner",
    });

    staff = await createTestUser({
      name: "Test Staff",
      email: "staff@example.com",
      role: "staff",
    });

    ownerToken = createToken(owner);
    staffToken = createToken(staff);

    product = await createProduct();
  });

  test("allows Owner to create a product", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...validProduct,
        sku: "OIL-001",
        name: "Sunflower Oil",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.product.sku).toBe("OIL-001");
    expect(response.body.data.product.name).toBe("Sunflower Oil");
  });

  test("automatically converts SKU to uppercase", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        ...validProduct,
        sku: "oil-002",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.product.sku).toBe("OIL-002");
  });

  test("denies Staff from creating products", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        ...validProduct,
        sku: "OIL-003",
      });

    expect(response.status).toBe(403);
  });

  test("rejects invalid product data", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        sku: "A",
        name: "X",
        category: "Groceries",
        unit: "kg",
        sellingPrice: -10,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Request validation failed");
    expect(response.body.errors.length).toBeGreaterThan(0);
  });

  test("rejects duplicate product SKUs", async () => {
    const response = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(validProduct);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  test("allows both Owner and Staff to view active products", async () => {
    const ownerResponse = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`);

    const staffResponse = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(ownerResponse.status).toBe(200);
    expect(staffResponse.status).toBe(200);

    expect(ownerResponse.body.data.products).toHaveLength(1);
    expect(staffResponse.body.data.products).toHaveLength(1);
  });

  test("supports product search by name", async () => {
    const response = await request(app)
      .get("/api/products?search=Basmati")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.products[0].name).toBe("Basmati Rice");
  });

  test("supports pagination", async () => {
    await createProduct({
      ...validProduct,
      sku: "OIL-004",
      name: "Sunflower Oil",
    });

    const response = await request(app)
      .get("/api/products?page=1&limit=1")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.pagination.page).toBe(1);
    expect(response.body.data.pagination.limit).toBe(1);
    expect(response.body.data.pagination.total).toBe(2);
    expect(response.body.data.pagination.totalPages).toBe(2);
  });

  test("allows Owner to update a product", async () => {
    const response = await request(app)
      .patch(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        sellingPrice: 150,
        lowStockThreshold: 10,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.product.sellingPrice).toBe(150);
    expect(response.body.data.product.lowStockThreshold).toBe(10);
  });

  test("denies Staff from updating products", async () => {
    const response = await request(app)
      .patch(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        sellingPrice: 150,
      });

    expect(response.status).toBe(403);
  });

  test("allows Owner to archive a product", async () => {
    const response = await request(app)
      .patch(`/api/products/${product._id}/archive`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.product.isArchived).toBe(true);
  });

  test("hides archived products from the default product list", async () => {
    await Product.findByIdAndUpdate(product._id, {
      isArchived: true,
    });

    const response = await request(app)
      .get("/api/products")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products).toHaveLength(0);
  });

  test("allows Owner to include archived products", async () => {
    await Product.findByIdAndUpdate(product._id, {
      isArchived: true,
    });

    const response = await request(app)
      .get("/api/products?includeArchived=true")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products).toHaveLength(1);
    expect(response.body.data.products[0].isArchived).toBe(true);
  });

  test("does not expose archived products to Staff", async () => {
    await Product.findByIdAndUpdate(product._id, {
      isArchived: true,
    });

    const response = await request(app)
      .get("/api/products?includeArchived=true")
      .set("Authorization", `Bearer ${staffToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.products).toHaveLength(0);
  });

  test("allows Owner to restore an archived product", async () => {
    await Product.findByIdAndUpdate(product._id, {
      isArchived: true,
    });

    const response = await request(app)
      .patch(`/api/products/${product._id}/restore`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.product.isArchived).toBe(false);
  });

  test("returns 404 when Staff requests an archived product by ID", async () => {
    await Product.findByIdAndUpdate(product._id, {
      isArchived: true,
    });

    const response = await request(app)
      .get(`/api/products/${product._id}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(response.status).toBe(404);
  });

  test("rejects invalid pagination parameters", async () => {
    const response = await request(app)
      .get("/api/products?page=0&limit=200")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Invalid query parameters");
  });
});
