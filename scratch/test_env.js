const fs = require("fs");
const path = require("path");

function getEnv(key) {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = new RegExp(`^${key}=(.*)$`, "m").exec(content);
      if (match) {
        console.log(`Raw match for ${key}:`, JSON.stringify(match[1]));
        return match[1].trim();
      }
    }
  } catch (e) {
    console.error("Error reading fallback .env:", e);
  }
  return process.env[key]?.trim();
}

console.log("RAZORPAY_KEY_ID:", JSON.stringify(getEnv("RAZORPAY_KEY_ID")));
console.log("RAZORPAY_KEY_SECRET:", JSON.stringify(getEnv("RAZORPAY_KEY_SECRET")));
