import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`[MongoDB] Connected: ${conn.connection.host}`);

    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      console.log("[MongoDB] Connection closed on app termination.");
      process.exit(0);
    });
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
