require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const connectDB = require("../src/config/database");
const env = require("../src/config/env");

const User = require("../src/models/User");
const Product = require("../src/models/Product");
const StockMovement = require("../src/models/StockMovement");

const sampleProducts = [
  {
    sku: "RICE-001",
    name: "Basmati Rice",
    category: "Groceries",
    unit: "kg",
    sellingPrice: 120,
    lowStockThreshold: 10,
    openingQuantity: 50,
  },
  {
    sku: "OIL-001",
    name: "Sunflower Oil",
    category: "Groceries",
    unit: "litre",
    sellingPrice: 150,
    lowStockThreshold: 8,
    openingQuantity: 30,
  },
  {
    sku: "SOAP-001",
    name: "Bathing Soap",
    category: "Personal Care",
    unit: "piece",
    sellingPrice: 35,
    lowStockThreshold: 12,
    openingQuantity: 40,
  },
];

function isPlaceholderPassword(password) {
  return (
    password.includes("CHANGE_THIS") ||
    password.includes("YOUR_PASSWORD")
  );
}

async function getOrCreateUser({ name, email, password, role }) {
  let user = await User.findOne({ email });

  if (user) {
    if (user.role !== role) {
      throw new Error(
        `Existing account ${email} does not have the expected role "${role}". ` +
          "Resolve this account manually; the seed script will not change its role."
      );
    }

    console.log(`Existing ${role} account preserved: ${email}`);
    return user;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    user = await User.create({
      name,
      email,
      passwordHash,
      role,
      isActive: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      // Another process may have created the account concurrently.
      user = await User.findOne({ email });

      if (!user || user.role !== role) {
        throw error;
      }

      return user;
    }

    throw error;
  }

  console.log(`Created ${role} account: ${email}`);
  return user;
}

async function seed() {
  if (
        !env.OWNER_EMAIL ||
        !env.OWNER_PASSWORD ||
        !env.STAFF_EMAIL ||
        !env.STAFF_PASSWORD
    ) {
    throw new Error(
        "Seed requires OWNER_EMAIL, OWNER_PASSWORD, STAFF_EMAIL, and STAFF_PASSWORD in .env."
    );
    }

    if (
    isPlaceholderPassword(env.OWNER_PASSWORD) ||
    isPlaceholderPassword(env.STAFF_PASSWORD)
    ) {
    throw new Error(
        "Replace placeholder owner and staff passwords in .env before seeding."
    );
    }

  if (env.OWNER_EMAIL === env.STAFF_EMAIL) {
    throw new Error("Owner and staff must use different email addresses.");
  }

  await connectDB();

  const owner = await getOrCreateUser({
    name: env.OWNER_NAME,
    email: env.OWNER_EMAIL,
    password: env.OWNER_PASSWORD,
    role: "owner",
  });

  await getOrCreateUser({
    name: env.STAFF_NAME,
    email: env.STAFF_EMAIL,
    password: env.STAFF_PASSWORD,
    role: "staff",
  });

  for (const item of sampleProducts) {
    const {
      openingQuantity,
      ...productFields
    } = item;

    // setOnInsert means rerunning the seed does not overwrite changes
    // made to an existing product.
    let product = await Product.findOneAndUpdate(
      { sku: productFields.sku },
      { $setOnInsert: productFields },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    const reference = `seed-opening-${product.sku}-v1`;

    if (openingQuantity > 0) {
      // Each opening movement has a stable unique reference.
      // Rerunning this script won't duplicate it.
      try {
        await StockMovement.updateOne(
          { reference },
          {
            $setOnInsert: {
              product: product._id,
              type: "opening",
              quantity: openingQuantity,
              reason: "Initial inventory loaded during system setup",
              performedBy: owner._id,
              reference,
            },
          },
          {
            upsert: true,
            runValidators: true,
          }
        );
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }

        // A duplicate-key race is safe only if the reference now exists.
        const existingMovement = await StockMovement.findOne({ reference });

        if (!existingMovement) {
          throw error;
        }
      }
    }

    console.log(
      `Product ready: ${product.sku} — ${product.name} ` +
        `(opening quantity: ${openingQuantity})`
    );
  }

  console.log("\nSeed completed successfully.");
  console.log("Owner email:", env.OWNER_EMAIL);
  console.log("Staff email:", env.STAFF_EMAIL);
  console.log("Existing account passwords were not changed.");
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });