// Jest Setup File
// Runs before all test suites

// Set test environment
process.env.NODE_ENV = "test";
process.env.MONGO_URI = "";
process.env.JWT_ACCESS_SECRET = "test_access_secret_key_32_characters_min";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret_key_32_characters_min";
process.env.ADMIN_PASSWORD = "test_admin_password_123";

// Increase Jest timeout for slow operations
jest.setTimeout(30000);

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("MongooseError")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
