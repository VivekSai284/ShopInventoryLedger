
const request = require("supertest");
const jwt = require("jsonwebtoken");
const env = require("../src/config/env");
const app = require("../src/app");
const Product = require("../src/models/Product");
const StockMovement = require("../src/models/StockMovement");

const {
  startTestDatabase,
  stopTestDatabase,
  clearDatabase,
  createTestUser,
} = require("./testUtils");

let owner;
let staff;
let ownerToken;
let staffToken;

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

async function createProduct({
  sku,
  name,
  category = "Grocery",
  unit = "kg",
  sellingPrice = 50,
  lowStockThreshold = 5,
} = {}) {
  return Product.create({
    sku,
    name,
    category,
    unit,
    sellingPrice,
    lowStockThreshold,
  });
}

async function createMovement({
  product,
  type,
  quantity,
  performedBy = owner,
  direction,
  reason = "Test movement",
  createdAt = new Date("2026-11-10T10:00:00.000Z"),
  reference,
} = {}) {
  const movementData = {
    product: product._id,
    type,
    quantity,
    performedBy: performedBy._id,
    reason,
    createdAt,
    updatedAt: createdAt,
  };

  if (direction) {
    movementData.direction = direction;
  }

  if (reference) {
    movementData.reference = reference;
  }

  return StockMovement.create(movementData);
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
    name: "Report Owner",
    email: "report-owner@example.com",
    role: "owner",
  });

  staff = await createTestUser({
    name: "Report Staff",
    email: "report-staff@example.com",
    role: "staff",
  });

  ownerToken = createToken(owner);
  staffToken = createToken(staff);
});

describe("Reports API", () => {
  describe("Authorization", () => {
    test("Staff cannot access the summary report", async () => {
      const response = await request(app)
        .get("/api/reports/summary")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });

    test("Staff cannot access the inventory report", async () => {
      const response = await request(app)
        .get("/api/reports/inventory")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });

    test("Staff cannot access the movement report", async () => {
      const response = await request(app)
        .get("/api/reports/movements")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(response.status).toBe(403);
    });

    test("Unauthenticated users cannot access reports", async () => {
      const response = await request(app)
        .get("/api/reports/summary");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/reports/summary", () => {
    test("Owner can retrieve the summary report", async () => {
      const response = await request(app)
        .get("/api/reports/summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("totalProducts");
      expect(response.body.data).toHaveProperty("lowStockProducts");
      expect(response.body.data).toHaveProperty("outOfStockProducts");
      expect(response.body.data).toHaveProperty("healthyProducts");
      expect(response.body.data).toHaveProperty("stockByUnit");
      expect(response.body.data).toHaveProperty("totalInventoryValue");
      expect(response.body.data).toHaveProperty("movements");
    });

    test("Summary calculates inventory value from current stock and selling price", async () => {
      const rice = await createProduct({
        sku: "RICE-REPORT",
        name: "Report Rice",
        unit: "kg",
        sellingPrice: 50,
      });

      const milk = await createProduct({
        sku: "MILK-REPORT",
        name: "Report Milk",
        unit: "litre",
        sellingPrice: 30,
      });

      await createMovement({
        product: rice,
        type: "purchase",
        quantity: 10,
      });

      await createMovement({
        product: rice,
        type: "sale",
        quantity: 2,
      });

      await createMovement({
        product: milk,
        type: "purchase",
        quantity: 3,
      });

      const response = await request(app)
        .get("/api/reports/summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.totalProducts).toBe(2);

      // Rice: (10 - 2) * 50 = 400
      // Milk: 3 * 30 = 90
      // Total inventory value = 490
      expect(response.body.data.totalInventoryValue).toBe(490);
    });

    test("Summary includes movement counts and quantities by type", async () => {
      const product = await createProduct({
        sku: "MOVE-REPORT",
        name: "Movement Report Product",
      });

      await createMovement({
        product,
        type: "purchase",
        quantity: 10,
        reference: "REPORT-PURCHASE-1",
      });

      await createMovement({
        product,
        type: "purchase",
        quantity: 5,
        reference: "REPORT-PURCHASE-2",
      });

      await createMovement({
        product,
        type: "sale",
        quantity: 3,
        reference: "REPORT-SALE-1",
      });

      const response = await request(app)
        .get("/api/reports/summary")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);

      expect(response.body.data.movements.purchase).toEqual(
        expect.objectContaining({
          movementCount: 2,
          totalQuantity: 15,
        })
      );

      expect(response.body.data.movements.sale).toEqual(
        expect.objectContaining({
          movementCount: 1,
          totalQuantity: 3,
        })
      );
    });
  });

  describe("GET /api/reports/inventory", () => {
    test("Owner can retrieve inventory report", async () => {
      await createProduct({
        sku: "INV-001",
        name: "Inventory Product",
      });

      const response = await request(app)
        .get("/api/reports/inventory")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.inventory)).toBe(true);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.inventory).toHaveLength(1);
    });

    test("Inventory report includes current stock and inventory value", async () => {
      const product = await createProduct({
        sku: "INV-VALUE",
        name: "Inventory Value Product",
        sellingPrice: 40,
      });

      await createMovement({
        product,
        type: "purchase",
        quantity: 8,
      });

      const response = await request(app)
        .get("/api/reports/inventory")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);

      const row = response.body.data.inventory.find(
        (item) => item.sku === "INV-VALUE"
      );

      expect(row).toBeDefined();
      expect(row.currentStock).toBe(8);
      expect(row.inventoryValue).toBe(320);
    });

    test("Inventory report filters products by category", async () => {
      await createProduct({
        sku: "CAT-RICE",
        name: "Category Rice",
        category: "Rice",
      });

      await createProduct({
        sku: "CAT-OIL",
        name: "Category Oil",
        category: "Oil",
      });

      const response = await request(app)
        .get("/api/reports/inventory?category=Rice")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.inventory).toHaveLength(1);
      expect(response.body.data.inventory[0].category).toBe("Rice");
    });

    test("Inventory report searches by product name or SKU", async () => {
      await createProduct({
        sku: "SEARCH-001",
        name: "Special Basmati Rice",
      });

      await createProduct({
        sku: "SEARCH-002",
        name: "Sunflower Oil",
      });

      const response = await request(app)
        .get("/api/reports/inventory?search=Basmati")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.inventory).toHaveLength(1);
      expect(response.body.data.inventory[0].name).toBe(
        "Special Basmati Rice"
      );
    });

    test("Inventory report supports pagination", async () => {
      await createProduct({ sku: "PAGE-001", name: "Page Product One" });
      await createProduct({ sku: "PAGE-002", name: "Page Product Two" });
      await createProduct({ sku: "PAGE-003", name: "Page Product Three" });

      const response = await request(app)
        .get("/api/reports/inventory?page=1&limit=2")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.inventory).toHaveLength(2);
      expect(response.body.data.pagination).toEqual(
        expect.objectContaining({
          page: 1,
          limit: 2,
          total: 3,
          totalPages: 2,
        })
      );
    });
  });

  describe("GET /api/reports/movements", () => {
    test("Owner can retrieve movement report", async () => {
      const product = await createProduct({
        sku: "MOV-001",
        name: "Movement Product",
      });

      await createMovement({
        product,
        type: "purchase",
        quantity: 10,
      });

      const response = await request(app)
        .get("/api/reports/movements")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.movements)).toBe(true);
      expect(response.body.data.movements).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
    });

    test("Movement report filters by movement type", async () => {
      const product = await createProduct({
        sku: "TYPE-001",
        name: "Movement Type Product",
      });

      await createMovement({
        product,
        type: "purchase",
        quantity: 10,
        reference: "TYPE-PURCHASE",
      });

      await createMovement({
        product,
        type: "sale",
        quantity: 2,
        reference: "TYPE-SALE",
      });

      const response = await request(app)
        .get("/api/reports/movements?type=sale")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.movements).toHaveLength(1);
      expect(response.body.data.movements[0].type).toBe("sale");
    });

    test("Movement report includes populated product and user details", async () => {
      const product = await createProduct({
        sku: "POP-001",
        name: "Populated Product",
      });

      await createMovement({
        product,
        type: "purchase",
        quantity: 6,
      });

      const response = await request(app)
        .get("/api/reports/movements")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);

      const movement = response.body.data.movements[0];

      expect(movement.product).toEqual(
        expect.objectContaining({
          sku: "POP-001",
          name: "Populated Product",
        })
      );

      expect(movement.performedBy).toEqual(
        expect.objectContaining({
          name: "Report Owner",
          email: "report-owner@example.com",
          role: "owner",
        })
      );
    });

    test("Movement report rejects an invalid movement type", async () => {
      const response = await request(app)
        .get("/api/reports/movements?type=invalid")
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
    });

    test("Movement report rejects an invalid date range", async () => {
      const response = await request(app)
        .get(
          "/api/reports/movements?dateFrom=2026-11-20T00:00:00%2B00:00&dateTo=2026-11-10T00:00:00%2B00:00"
        )
        .set("Authorization", `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
    });
  });
});
