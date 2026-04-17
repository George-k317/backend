 import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authRoutes from "./auth";

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/auth", authRoutes);

// test route
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// connect MongoDB
if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI missing");
}

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
