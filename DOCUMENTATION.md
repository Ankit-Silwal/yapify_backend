# Yapify Backend - Quick Documentation

**WhatsApp clone backend** built with Express.js, TypeScript, PostgreSQL, and Redis.

## Tech Stack
- Express 5.2.1, TypeScript, PostgreSQL, Redis, Nodemailer, bcrypt

## Project Structure
```
src/
├── config/        → db.ts, redis.ts, nodemailer.ts
├── middleware/    → checkSession.ts (session validation)
├── modules/
│   └── auth/      → authManager.ts, authRoutes.ts, otpManager.ts, sessionManager.ts
├── utils/         → createOtp.ts, strongpassword.ts
└── types/         → express.d.ts
```

## Installation & Setup
```bash
npm install
npm run dev       # Development
npm run build     # Build TypeScript
npm start         # Production
```

### Environment Variables (.env)
```
PORT=5000
POSTGRES_PASSWORD=your_password
REDIS_URL=redis://localhost:6379
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

## Database Schema
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints (/api/auth)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ❌ | Register user |
| POST | `/verify` | ❌ | Verify email with OTP |
| POST | `/login` | ❌ | Login |
| POST | `/change-password` | ✅ | Change password |
| POST | `/forgot-password` | ❌ | Request reset OTP |
| POST | `/verify-forgot-password` | ❌ | Verify reset OTP |
| POST | `/change-forgot-password` | ❌ | Change password |
| POST | `/resend-otp` | ❌ | Resend verification OTP |
| GET | `/sessions` | ✅ | Get all sessions |
| DELETE | `/sessions/:sessionId` | ✅ | Logout session |

## Core Features

### Authentication Module (authManager.ts)
- **registerUsers**: Register with email/password (validates strong password)
- **verifyUser**: Verify email with 6-digit OTP (5-min TTL)
- **loginUser**: Login → creates session + secure cookie
- **changePassword**: Change password (requires current password)
- **forgotPassword**: Request password reset OTP
- **changeForgotPassword**: Reset password via OTP

### Session Management (sessionManager.ts)
- Creates 32-byte hex session IDs
- Stores in Redis with 24-hour TTL
- Tracks IP, user agent, creation/expiry time
- Support for multi-device login

### OTP Manager (otpManager.ts)
- Generates random 6-digit OTP (100000-999999)
- 300-second (5 min) expiry in Redis
- One-time use (consumed after verification)
- Separate keys for registration & password reset

### Email (sendingOtp.ts)
- Gmail SMTP integration
- HTML email templates with styled OTP display
- Responsive design, 5-minute expiry warnings

### Utilities
- **createOtp.ts**: Generate 6-digit OTP
- **strongpassword.ts**: Validate (8+ chars, uppercase, lowercase, number, special)
- **checkSession.ts**: Middleware to verify session & extract userId

## Password Requirements
- Minimum 8 characters
- 1 uppercase letter
- 1 lowercase letter
- 1 number
- 1 special character (!@#$%^&*...)

## Security
✅ bcrypt password hashing (10 salt rounds)
✅ HttpOnly secure cookies
✅ SameSite=strict (CSRF protection)
✅ OTP one-time use & expiry
✅ Email verification required
✅ Session TTL management

## Quick Example

**Register**:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "conformPassword": "SecurePass123!"
  }'
```

**Verify OTP** (from email):
```bash
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp": "123456"}'
```

**Login**:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'
# Sets sessionId cookie
```

## Redis Keys
- `session:${sessionId}` → Session data
- `verify:otp:${userId}` → Email verification OTP
- `verify:forgotPasswordOtp:${userId}` → Password reset OTP
- `user:sessions:${userId}` → Set of user session IDs
- `security:changePassword:${userId}` → Temp reset permission (5 min)

## Common Errors
- **409**: Email already exists
- **400**: Invalid input/expired OTP
- **401**: Invalid session/unauthorized
- **404**: User not found
- **500**: Server error

## License
ISC | Author: Ankit Silwal
