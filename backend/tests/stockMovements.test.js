const request = require("supertest");
const jwt = require("jsonwebtoken");

const app = require("../src/app");
const env = require("../src/config/env");

const Product = require("../src/models/Product");
const StockMovement = require("../src/models/StockMovement");

const {
  startTestDatabase,
  stopTestDatabase,
  clearDatabase,
  createTestUser,
} = require("./testUtils");

describe("Stock Movements API", () => {
  let owner;
  let staff;
  let ownerToken;
  let staffToken;
  let product;

  function createToken(user) {
    return jwt.sign({ role: user.role }, env.JWT_SECRET, {
      subject: user._id.toString(),
      expiresIn: env.JWT_EXPIRES_IN,
      algorithm: "HS256",
    });
  }

  async function createProduct() {
    return Product.create({
      sku: "RICE-001",
      name: "Basmati Rice",
      category: "Groceries",
      unit: "kg",
      sellingPrice: 120,
      lowStockThreshold: 5,
    });
  }

  async function recordPurchase(quantity, reference) {
    return request(app)
      .post("/api/stock/purchases")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        productId: product._id.toString(),
        quantity,
        reason: "Initial stock purchase",
        ...(reference ? { reference } : {}),
      });
  }

  async function recordSale(quantity, token = staffToken, reference) {
    return request(app)
      .post("/api/stock/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        productId: product._id.toString(),
        quantity,
        reason: "Customer sale",
        ...(reference ? { reference } : {}),
      });
  }

  async function getStock(token = ownerToken) {
    return request(app)
      .get(`/api/stock/${product._id}/stock`)
      .set("Authorization", `Bearer ${token}`);
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

  test("allows Owner to record a purchase", async () => {
    const response = await recordPurchase(100);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.movement.type).toBe("purchase");
    expect(response.body.data.movement.quantity).toBe(100);
    expect(response.body.data.stockAfter).toBe(100);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(100);
  });

  test("denies Staff from recording purchases", async () => {
    const response = await request(app)
      .post("/api/stock/purchases")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 100,
        reason: "Purchase attempt",
      });

    expect(response.status).toBe(403);
  });

  test("allows Staff to record a sale", async () => {
    await recordPurchase(100);

    const response = await recordSale(30);

    expect(response.status).toBe(201);
    expect(response.body.data.movement.type).toBe("sale");
    expect(response.body.data.stockAfter).toBe(70);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(70);
  });

  test("allows Owner to record a sale", async () => {
    await recordPurchase(100);

    const response = await recordSale(20, ownerToken);

    expect(response.status).toBe(201);
    expect(response.body.data.stockAfter).toBe(80);
  });

  test("rejects a sale that exceeds available stock", async () => {
    await recordPurchase(10);

    const response = await recordSale(15);

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/Insufficient stock/);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(10);
  });

  test("allows Staff to record a return linked to an original sale", async () => {
    await recordPurchase(50);

    const sale = await recordSale(20);
    const originalSaleId = sale.body.data.movement._id;

    const response = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        originalSaleId,
        quantity: 5,
        reason: "Customer returned item",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.movement.type).toBe("return");
    expect(response.body.data.movement.originalSale).toBe(originalSaleId);
    expect(response.body.data.stockAfter).toBe(35);
  });

  test("allows Owner to record an inbound adjustment", async () => {
    const response = await request(app)
      .post("/api/stock/adjustments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 15,
        direction: "in",
        reason: "Opening stock correction",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.stockAfter).toBe(15);
  });

  test("allows Owner to record an outbound adjustment", async () => {
    await recordPurchase(50);

    const response = await request(app)
      .post("/api/stock/adjustments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 10,
        direction: "out",
        reason: "Damaged stock removal",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.stockAfter).toBe(40);
  });

  test("denies Staff from recording adjustments", async () => {
    const response = await request(app)
      .post("/api/stock/adjustments")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 10,
        direction: "in",
        reason: "Adjustment attempt",
      });

    expect(response.status).toBe(403);
  });

  test("rejects outbound adjustment that causes negative stock", async () => {
    await recordPurchase(5);

    const response = await request(app)
      .post("/api/stock/adjustments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 10,
        direction: "out",
        reason: "Excess stock removal",
      });

    expect(response.status).toBe(409);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(5);
  });

  test("rejects invalid movement quantity", async () => {
    const response = await recordPurchase(0);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Request validation failed");
  });

  test("rejects an invalid adjustment direction", async () => {
    const response = await request(app)
      .post("/api/stock/adjustments")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 5,
        direction: "sideways",
        reason: "Invalid direction",
      });

    expect(response.status).toBe(400);
  });

  test("rejects movement for an archived product", async () => {
    await Product.findByIdAndUpdate(product._id, {
      isArchived: true,
    });

    const response = await recordPurchase(10);

    expect(response.status).toBe(404);
  });

  test("rejects duplicate movement references", async () => {
    const first = await recordPurchase(20, "PURCHASE-1001");

    expect(first.status).toBe(201);

    const second = await recordPurchase(10, "PURCHASE-1001");

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
    expect(second.body.message).toMatch(/reference has already been used/i);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(20);
  });

  test("returns accurate movement history", async () => {
    await recordPurchase(100);
    await recordSale(25);

    const response = await request(app)
      .get(`/api/stock/${product._id}/history`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.currentStock).toBe(75);
    expect(response.body.data.movements).toHaveLength(2);
    expect(response.body.data.pagination.total).toBe(2);

    const types = response.body.data.movements.map((movement) => movement.type);

    expect(types).toContain("purchase");
    expect(types).toContain("sale");
  });

  test("filters movement history by type", async () => {
    await recordPurchase(100);
    await recordSale(20);

    const response = await request(app)
      .get(`/api/stock/${product._id}/history?type=sale`)
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.movements).toHaveLength(1);
    expect(response.body.data.movements[0].type).toBe("sale");
    expect(response.body.data.pagination.total).toBe(1);
  });

  test("prevents concurrent sales from overselling stock", async () => {
    await recordPurchase(10);

    const results = await Promise.all([recordSale(7), recordSale(7)]);

    const successfulSales = results.filter(
      (response) => response.status === 201,
    );

    const failedSales = results.filter((response) => response.status === 409);

    expect(successfulSales).toHaveLength(1);
    expect(failedSales).toHaveLength(1);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(3);

    const salesCount = await StockMovement.countDocuments({
      product: product._id,
      type: "sale",
    });

    expect(salesCount).toBe(1);
  });

  test("rejects a return without an original sale ID", async () => {
    await recordPurchase(50);
    await recordSale(20);

    const response = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        quantity: 5,
        reason: "Customer returned item",
      });

    expect(response.status).toBe(400);
  });

  test("rejects a return exceeding the original sale quantity", async () => {
    await recordPurchase(50);

    const sale = await recordSale(10);

    const response = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        originalSaleId: sale.body.data.movement._id,
        quantity: 11,
        reason: "Excess return",
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/remaining returnable quantity/i);
  });

  test("allows partial returns but prevents returning more than the sale quantity", async () => {
    await recordPurchase(50);

    const sale = await recordSale(10);
    const originalSaleId = sale.body.data.movement._id;

    const firstReturn = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        originalSaleId,
        quantity: 4,
        reason: "First partial return",
      });

    expect(firstReturn.status).toBe(201);

    const secondReturn = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        originalSaleId,
        quantity: 6,
        reason: "Second partial return",
      });

    expect(secondReturn.status).toBe(201);

    const thirdReturn = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: product._id.toString(),
        originalSaleId,
        quantity: 1,
        reason: "Excess partial return",
      });

    expect(thirdReturn.status).toBe(409);

    const stock = await getStock();

    expect(stock.body.data.currentStock).toBe(50);
  });

  test("rejects an original sale belonging to another product", async () => {
    await recordPurchase(50);

    const sale = await recordSale(10);

    const anotherProduct = await Product.create({
      sku: "OIL-001",
      name: "Sunflower Oil",
      category: "Groceries",
      unit: "litre",
      sellingPrice: 150,
      lowStockThreshold: 5,
    });

    const response = await request(app)
      .post("/api/stock/returns")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        productId: anotherProduct._id.toString(),
        originalSaleId: sale.body.data.movement._id,
        quantity: 5,
        reason: "Wrong product return",
      });

    expect(response.status).toBe(400);
  });
});
