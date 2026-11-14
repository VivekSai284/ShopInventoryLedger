const os = require("os");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const User = require("../src/models/User");

let replicaSet;

async function startTestDatabase() {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger",
    },
  });

  const uri = replicaSet.getUri();

  await mongoose.connect(uri, {
    runtimeAdapters: {
        os,
    },
});
}

async function stopTestDatabase() {
  await mongoose.disconnect();

  if (replicaSet) {
    await replicaSet.stop();
    replicaSet = null;
  }
}

async function clearDatabase() {
  const collections = mongoose.connection.collections;

  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
}

async function createTestUser({
  name = "Test User",
  email = "test@example.com",
  password = "TestPassword123!",
  role = "staff",
} = {}) {
  const passwordHash = await bcrypt.hash(password, 4);

  return User.create({
    name,
    email,
    passwordHash,
    role,
  });
}

module.exports = {
  startTestDatabase,
  stopTestDatabase,
  clearDatabase,
  createTestUser,
};
