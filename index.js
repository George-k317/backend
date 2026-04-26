const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","DELETE","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json());

const MONGO_URI = process.env.MONGODB_URI || "";
const JWT_SECRET = process.env.JWT_SECRET || "secret123";

if (!MONGO_URI) { console.error("MONGODB_URI not set"); process.exit(1); }

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, default: "" },
  gender: { type: String, default: "" },
  nationality: { type: String, default: "" },
  dob: { type: String, default: "" },
  balance: { type: Number, default: 0 },
  lifetime: { type: Number, default: 0 },
  surveyCount: { type: Number, default: 0 },
  lastSurveyDate: { type: String, default: "" }
});
const User = mongoose.model("User", UserSchema);

function auth(req, res, next) {
  const token = req.header("Authorization");
  if (!token) return res.status(401).json({ msg: "No token" });
  try { const decoded = jwt.verify(token, JWT_SECRET); req.user = decoded; next(); }
  catch { res.status(401).json({ msg: "Invalid token" }); }
}

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }));
app.get("/", (req, res) => res.json({ message: "Daily Telegraph Backend Running" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name, gender, nationality, dob } = req.body;
    if (!email || !password) return res.status(400).json({ msg: "Email and password required" });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ msg: "User already exists" });
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed, name, gender, nationality, dob });
    await user.save();
    res.json({ msg: "Registered successfully" });
  } catch (err) { res.status(500).json({ msg: "Server error" }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ msg: "Email and password required" });
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Wrong password" });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token });
  } catch (err) { res.status(500).json({ msg: "Server error" }); }
});

app.get("/api/survey/dashboard", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    const today = new Date().toDateString();
    if (user.lastSurveyDate !== today) { user.surveyCount = 0; user.lastSurveyDate = today; await user.save(); }
    res.json({ balance: user.balance, lifetime: user.lifetime, surveyCount: user.surveyCount, user: { name: user.name, gender: user.gender, nationality: user.nationality, dob: user.dob } });
  } catch (err) { res.status(500).json({ msg: "Server error" }); }
});

app.post("/api/survey/complete", auth, async (req, res) => {
  try {
    const { reward } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    const today = new Date().toDateString();
    if (user.lastSurveyDate !== today) { user.surveyCount = 0; user.lastSurveyDate = today; }
    if (user.surveyCount >= 4) return res.status(400).json({ msg: "Daily limit reached" });
    const amount = parseFloat(reward) || 0;
    user.balance += amount; user.lifetime += amount; user.surveyCount += 1;
    await user.save();
    res.json({ balance: user.balance, lifetime: user.lifetime, surveyCount: user.surveyCount });
  } catch (err) { res.status(500).json({ msg: "Server error" }); }
});

app.post("/api/survey/withdraw", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.balance < 34) return res.status(400).json({ msg: "Minimum withdrawal is $34" });
    user.balance = 0; await user.save();
    res.json({ msg: "Withdrawal successful" });
  } catch (err) { res.status(500).json({ msg: "Server error" }); }
});

app.use((req, res) => res.status(404).json({ msg: "Not Found" }));

const PORT = parseInt(process.env.PORT || "5000", 10);
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
