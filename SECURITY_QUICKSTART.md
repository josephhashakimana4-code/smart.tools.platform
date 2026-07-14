<!-- 
Quick Start Guide for Security Features
Place this content in your frontend or add to your wiki
-->

# Security Quick Start Guide

## Installation

1. **Install Dependencies**
```bash
npm install
```

This installs the new security packages:
- `xss` - Input sanitization
- `bytes` - Request size validation

## Configuration

### 1. Set Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

**Critical Variables**:
```env
JWT_ACCESS_SECRET=change_this_to_random_32_chars_or_more
JWT_REFRESH_SECRET=change_this_to_random_32_chars_or_more
ADMIN_PASSWORD=change_this_strong_password
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 2. Generate Secure Secrets

For JWT secrets, generate random strings:

```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows PowerShell
[System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((Get-Random -Count 32 | ForEach-Object {[char]$_}) -join ''))
```

## Running the Server

```bash
# Development
npm run dev

# Production
npm start
```

## Frontend Integration

### 1. Include Auth Service

Add to your HTML:
```html
<script src="/js/auth-service.js"></script>
```

### 2. Initialize Auth

```javascript
const auth = new AuthService();

// Get CSRF token on page load
await auth.getCsrfToken();

// Setup automatic token refresh
auth.setupTokenRefresh();
```

### 3. User Registration

```html
<form id="registerForm">
  <input type="email" id="email" placeholder="Email" required />
  <input type="password" id="password" placeholder="Password (8+ chars, uppercase, lowercase, number, special char)" required />
  <input type="text" id="firstName" placeholder="First Name" required />
  <input type="text" id="lastName" placeholder="Last Name" />
  <button type="submit">Register</button>
</form>

<script>
document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const result = await auth.register(
      document.getElementById('email').value,
      document.getElementById('password').value,
      document.getElementById('firstName').value,
      document.getElementById('lastName').value
    );
    
    alert('Registration successful! Check your email to verify.');
  } catch (error) {
    alert('Registration failed: ' + error.message);
  }
});
</script>
```

### 4. User Login

```html
<form id="loginForm">
  <input type="email" id="email" placeholder="Email" required />
  <input type="password" id="password" placeholder="Password" required />
  <button type="submit">Login</button>
</form>

<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  try {
    const result = await auth.login(
      document.getElementById('email').value,
      document.getElementById('password').value
    );
    
    alert('Login successful! Welcome ' + result.user.firstName);
    // Redirect to dashboard
    window.location.href = '/dashboard';
  } catch (error) {
    alert('Login failed: ' + error.message);
  }
});
</script>
```

### 5. Protected API Calls

```javascript
// Function to make authenticated API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      ...auth.getAuthHeader(),
      'X-CSRF-Token': auth.csrfToken,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.status === 401) {
    // Token expired, try to refresh
    try {
      await auth.refreshAccessToken();
      // Retry the request
      return apiCall(endpoint, options);
    } catch {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  
  return response.json();
}

// Usage
const data = await apiCall('/api/tools', {
  method: 'GET'
});
```

### 6. Logout

```html
<button id="logoutBtn">Logout</button>

<script>
document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await auth.logout();
    window.location.href = '/login';
  } catch (error) {
    console.error('Logout failed:', error);
  }
});
</script>
```

## Testing Security Features

### Test Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'
```

### Test Account Lockout
Try login with wrong password 5 times:
```bash
for i in {1..5}; do
  curl -X POST http://localhost:5000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "WrongPassword"
    }'
  echo "\nAttempt $i\n"
done
```

After 5th attempt, you'll get "Account temporarily locked" error.

### Test Token Refresh
```bash
curl -X POST http://localhost:5000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your_refresh_token_here"
  }'
```

## Monitoring

### View Audit Logs
```bash
# Real-time audit log
tail -f logs/audit.log

# View error audit logs
tail -f logs/error-audit.log

# Search for login events
grep "login" logs/audit.log
```

### Log Entries Example
```json
{
  "level": "info",
  "message": "Login successful",
  "eventType": "login_success",
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "ipAddress": "127.0.0.1",
  "userAgent": "Mozilla/5.0...",
  "success": true,
  "timestamp": "2026-07-14T10:30:00.000Z"
}
```

## Production Deployment

### Pre-Deployment Checklist

- [ ] All environment variables set securely
- [ ] JWT secrets are 32+ characters
- [ ] Admin password is strong and unique
- [ ] HTTPS is enforced
- [ ] ALLOWED_ORIGINS updated for production
- [ ] Database backups configured
- [ ] Log rotation configured
- [ ] SMTP configured for emails
- [ ] Rate limits adjusted for expected load
- [ ] Security headers tested with https://securityheaders.com
- [ ] Dependencies updated: `npm audit fix`
- [ ] CORS thoroughly tested

### Deployment Steps

1. **Clone and Install**
```bash
git clone <repo>
cd smart.tools.platform
npm install
```

2. **Set Environment**
```bash
export NODE_ENV=production
export JWT_ACCESS_SECRET=your_secure_secret
export JWT_REFRESH_SECRET=your_secure_refresh
export ADMIN_PASSWORD=your_strong_password
export ALLOWED_ORIGINS=https://yourdomain.com
# ... other variables
```

3. **Start Server**
```bash
npm start
```

4. **Verify**
```bash
curl https://yourdomain.com/health
```

## Common Issues

### "Invalid CSRF Token"
- Ensure CSRF token is sent in `X-CSRF-Token` header
- Get fresh token: `/api/auth/csrf-token`
- Token expires after 1 hour

### "Account Locked"
- Reset by waiting 30 minutes
- Or use password reset: `/api/auth/forgot-password`
- Or admin can reset in database

### "Email Not Verified"
- Check spam folder for verification email
- TODO: Implement resend verification endpoint

### CORS Errors
- Add origin to `ALLOWED_ORIGINS` env variable
- Restart server: `npm run dev` or `npm start`
- Check browser console for specific origin

### Password Reset Email Not Received
- Check SMTP configuration in .env
- Check spam/junk folders
- Verify email configuration

## Support & Documentation

- **Full Security Docs**: See `SECURITY.md`
- **API Examples**: See auth endpoint comments in `routes/auth.js`
- **Frontend Integration**: See `frontend/js/auth-service.js`
- **Database Schema**: See `models/User.js`

## Next Steps

1. **Email Templates**: Create HTML email templates for verification and password reset
2. **Two-Factor Auth**: Implement TOTP-based 2FA
3. **OAuth**: Add Google, GitHub, Microsoft login
4. **API Keys**: Implement API key authentication for programmatic access
5. **IP Whitelist**: Add per-user IP whitelisting
6. **Device Management**: Track and manage user devices

## Security Best Practices

✅ DO:
- Use HTTPS everywhere
- Keep Node.js updated
- Rotate secrets periodically
- Monitor audit logs
- Use strong passwords
- Enable email verification
- Test all endpoints
- Backup database regularly

❌ DON'T:
- Commit `.env` to git
- Use weak passwords
- Log sensitive data
- Share JWT secrets
- Disable CSRF protection
- Trust user input
- Skip email verification
- Ignore security warnings

## Questions or Issues?

Review these files for detailed information:
1. `SECURITY.md` - Comprehensive security documentation
2. `routes/auth.js` - All authentication endpoints
3. `.env.example` - All configuration options
4. `frontend/js/auth-service.js` - Frontend integration examples
