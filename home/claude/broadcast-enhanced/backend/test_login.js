import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/User.js";

dotenv.config();

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB");
    
    // Check if any users exist
    const users = await User.find({});
    console.log("Total users:", users.length);
    if (users.length > 0) {
      console.log("First user:", users[0].email);
    } else {
      console.log("No users found in the database. Please register first.");
    }
    
    process.exit(0);
  } catch (err) {
    console.error("Error connecting to DB or querying:", err);
    process.exit(1);
  }
};

testLogin();
