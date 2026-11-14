const mongoose = require("mongoose");
const env = require("./env");

const connectDB = async () => {
  try {
    const connection = await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(
      `MongoDB connected: ${connection.connection.host}`
    );

    return connection;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);

    throw error;
  }
};

module.exports = connectDB;