# CORS Configuration Guide

## Problem
You're seeing the error: **"CORS Missing Allow Origin"** when trying to access the backend API.

This happens because the backend server at `https://air-qua-monitor-back.onrender.com` is not configured to allow requests from your frontend origin.

## Solution: Configure CORS on the Backend

### For FastAPI Backend

Add CORS middleware to your FastAPI application:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Add CORS middleware the
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://localhost:3001",
        "https://air-qua-monitor-front.vercel.app",  # Production frontend
        "https://www.air-qua-monitor-front.vercel.app",  # With www (if applicable)
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
)
```

**Important**: Make sure this middleware is added BEFORE your routes are defined.

### For Flask Backend

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)

# Allow all origins (for development)
CORS(app)

# Or specify origins (for production)
CORS(app, origins=["http://localhost:3000", "https://your-frontend-domain.com"])
```

### For Express.js Backend

```javascript
const express = require('express');
const cors = require('cors');
const app = express();

// Allow all origins (for development)
app.use(cors());

// Or specify origins (for production)
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
  credentials: true
}));
```

## Recommended Production Configuration

For production, **DO NOT** use `allow_origins=["*"]`. Instead, specify your exact frontend domain:

```python
# FastAPI example - PRODUCTION CONFIGURATION
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://air-qua-monitor-front.vercel.app",  # Production frontend
        "http://localhost:3000",  # Keep for local development/testing
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

**Your specific configuration should be:**
- **Backend**: `https://air-qua-monitor-back.onrender.com`
- **Frontend**: `https://air-qua-monitor-front.vercel.app`
- **Allow Origin**: `https://air-qua-monitor-front.vercel.app`

## Testing CORS Configuration

After updating your backend, test with:

### Test OPTIONS (Preflight) Request:
```bash
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://air-qua-monitor-back.onrender.com/api/v1/auth/login \
     -v
```

### Test Actual Login Request:
```bash
# Test with production frontend origin
curl -H "Origin: https://air-qua-monitor-front.vercel.app" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -X POST \
     -d "username=test@example.com&password=test123" \
     https://air-qua-monitor-back.onrender.com/api/v1/auth/login \
     -v
```

You should see in the response headers:
```
Access-Control-Allow-Origin: https://air-qua-monitor-front.vercel.app
Access-Control-Allow-Credentials: true
```

You should see headers like:
```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Allow-Credentials: true
```

## Important: Login Endpoint CORS

The login endpoint (`/api/v1/auth/login`) uses `application/x-www-form-urlencoded` content type. Make sure your CORS configuration allows:
- **Content-Type header**: `application/x-www-form-urlencoded`
- **POST method** for the login endpoint
- **OPTIONS method** for preflight requests

## Frontend Configuration

The frontend is already configured to use:
- **Backend URL**: `https://air-qua-monitor-back.onrender.com`
- **API Version**: `v1`
- **Frontend URL**: `https://air-qua-monitor-front.vercel.app`

You can override the backend URL by setting the environment variable:
```bash
NEXT_PUBLIC_API_BASE_URL=https://air-qua-monitor-back.onrender.com
```

## Production CORS Configuration

For your production setup, the backend at `https://air-qua-monitor-back.onrender.com` needs to allow requests from:
- **Frontend Origin**: `https://air-qua-monitor-front.vercel.app`
- **Local Development**: `http://localhost:3000` (for development)

## Common Issues

1. **Backend not allowing credentials**: Make sure `allow_credentials=True` is set
2. **Missing OPTIONS method**: Preflight requests use OPTIONS method
3. **Headers not allowed**: Make sure `Authorization` and `Content-Type` headers are allowed
4. **Wildcard with credentials**: Cannot use `*` with `allow_credentials=True`

## Next Steps

1. Update your backend CORS configuration
2. Deploy the updated backend
3. Test the frontend connection
4. Verify the error is resolved

