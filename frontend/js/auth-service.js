// Frontend Authentication Integration Guide
// Place this in frontend/js/auth-service.js

class AuthService {
  constructor() {
    this.accessToken = localStorage.getItem("accessToken");
    this.refreshToken = localStorage.getItem("refreshToken");
    this.csrfToken = null;
    this.user = JSON.parse(localStorage.getItem("user") || "null");
  }

  /**
   * Get CSRF token from server
   */
  async getCsrfToken() {
    try {
      const response = await fetch("/api/auth/csrf-token");
      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error("Failed to get CSRF token:", error);
      throw error;
    }
  }

  /**
   * User Registration
   */
  async register(email, password, firstName, lastName = "") {
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ email, password, firstName, lastName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed");
      }

      // Clear CSRF token after use
      this.csrfToken = null;

      return {
        success: true,
        userId: data.userId,
        message: data.message
      };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  /**
   * User Login
   */
  async login(email, password) {
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store tokens
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.user = data.user;

      localStorage.setItem("accessToken", this.accessToken);
      localStorage.setItem("refreshToken", this.refreshToken);
      localStorage.setItem("user", JSON.stringify(this.user));

      // Clear CSRF token after use
      this.csrfToken = null;

      return { success: true, user: data.user };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  /**
   * User Logout
   */
  async logout() {
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "X-CSRF-Token": this.csrfToken
        }
      });

      // Clear local storage regardless of response
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");

      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      this.csrfToken = null;

      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      // Clear local storage anyway
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      throw error;
    }
  }

  /**
   * Verify Email
   */
  async verifyEmail(verificationToken) {
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ verificationToken })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Email verification failed");
      }

      this.csrfToken = null;
      return { success: true };
    } catch (error) {
      console.error("Email verification error:", error);
      throw error;
    }
  }

  /**
   * Request Password Reset
   */
  async forgotPassword(email) {
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();
      this.csrfToken = null;

      return {
        success: data.success,
        message: data.message
      };
    } catch (error) {
      console.error("Forgot password error:", error);
      throw error;
    }
  }

  /**
   * Reset Password with Token
   */
  async resetPassword(resetToken, newPassword) {
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ resetToken, newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Password reset failed");
      }

      this.csrfToken = null;
      return { success: true };
    } catch (error) {
      console.error("Reset password error:", error);
      throw error;
    }
  }

  /**
   * Change Password (authenticated user)
   */
  async changePassword(currentPassword, newPassword) {
    if (!this.csrfToken) await this.getCsrfToken();
    if (!this.accessToken) throw new Error("Not authenticated");

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`,
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({
          password: currentPassword,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Password change failed");
      }

      // Re-authentication required
      this.logout();
      this.csrfToken = null;

      return {
        success: true,
        message: data.message,
        code: data.code
      };
    } catch (error) {
      console.error("Change password error:", error);
      throw error;
    }
  }

  /**
   * Get Current User Profile
   */
  async getProfile() {
    if (!this.accessToken) throw new Error("Not authenticated");
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          "Authorization": `Bearer ${this.accessToken}`,
          "X-CSRF-Token": this.csrfToken
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, try to refresh
          return await this.refreshAccessToken();
        }
        throw new Error(data.message || "Failed to get profile");
      }

      this.user = data.user;
      localStorage.setItem("user", JSON.stringify(this.user));

      return { success: true, user: data.user };
    } catch (error) {
      console.error("Get profile error:", error);
      throw error;
    }
  }

  /**
   * Update User Profile
   */
  async updateProfile(firstName, lastName, privacySettings = {}) {
    if (!this.accessToken) throw new Error("Not authenticated");
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`,
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({
          firstName,
          lastName,
          privacySettings
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          return await this.refreshAccessToken();
        }
        throw new Error(data.message || "Profile update failed");
      }

      this.user = data.user;
      localStorage.setItem("user", JSON.stringify(this.user));
      this.csrfToken = null;

      return { success: true, user: data.user };
    } catch (error) {
      console.error("Update profile error:", error);
      throw error;
    }
  }

  /**
   * Delete Account
   */
  async deleteAccount(password) {
    if (!this.accessToken) throw new Error("Not authenticated");
    if (!this.csrfToken) await this.getCsrfToken();

    try {
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`,
          "X-CSRF-Token": this.csrfToken
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Account deletion failed");
      }

      // Clear local storage
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");

      this.accessToken = null;
      this.refreshToken = null;
      this.user = null;
      this.csrfToken = null;

      return { success: true };
    } catch (error) {
      console.error("Account deletion error:", error);
      throw error;
    }
  }

  /**
   * Refresh Access Token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) throw new Error("No refresh token available");

    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      const data = await response.json();

      if (!response.ok) {
        // Refresh token expired, need to login again
        this.logout();
        throw new Error("Session expired. Please login again.");
      }

      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;

      localStorage.setItem("accessToken", this.accessToken);
      localStorage.setItem("refreshToken", this.refreshToken);

      return { success: true };
    } catch (error) {
      console.error("Token refresh error:", error);
      this.logout();
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Get authorization header for API calls
   */
  getAuthHeader() {
    return this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {};
  }

  /**
   * Automatically refresh token before expiry
   */
  setupTokenRefresh(expiresIn = 15 * 60 * 1000) {
    // Refresh token 1 minute before expiry
    const refreshTime = expiresIn - 60 * 1000;

    setInterval(async () => {
      if (this.isAuthenticated()) {
        try {
          await this.refreshAccessToken();
          console.log("Token refreshed successfully");
        } catch (error) {
          console.error("Automatic token refresh failed:", error);
        }
      }
    }, refreshTime);
  }
}

// Export for use in other scripts
if (typeof module !== "undefined" && module.exports) {
  module.exports = AuthService;
}

// Usage Example:
/*
const auth = new AuthService();

// Initialize
await auth.getCsrfToken();

// Register
try {
  const result = await auth.register(
    "user@example.com",
    "SecurePass123!",
    "John",
    "Doe"
  );
  console.log("Registration successful:", result);
} catch (error) {
  console.error("Registration failed:", error.message);
}

// Login
try {
  const result = await auth.login("user@example.com", "SecurePass123!");
  console.log("Login successful:", result.user);
  auth.setupTokenRefresh(); // Auto-refresh tokens
} catch (error) {
  console.error("Login failed:", error.message);
}

// Make authenticated API call
try {
  const response = await fetch("/api/protected-endpoint", {
    headers: {
      ...auth.getAuthHeader(),
      "X-CSRF-Token": auth.csrfToken
    }
  });
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error("API call failed:", error);
}

// Logout
try {
  await auth.logout();
  console.log("Logged out successfully");
} catch (error) {
  console.error("Logout failed:", error.message);
}
*/
