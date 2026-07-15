# Troubleshooting Network Errors

## Common NetworkError Issues

### 1. Backend Server Not Running

**Error:** `NetworkError: Cannot connect to backend API at http://localhost:8000`

**Solution:**
- Ensure your backend server is running
- Check if the backend is listening on the correct port (default: 8000)
- Verify the backend URL in `.env.local` or environment variables

```bash
# Check if backend is running
curl http://localhost:8000/docs

# Or check the backend logs
```

### 2. CORS (Cross-Origin Resource Sharing) Issues

**Error:** `NetworkError` or `CORS policy` errors in browser console

**Solution:**
Configure CORS in your backend to allow requests from the frontend origin.

**For FastAPI backend:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**For Express/Node.js backend:**
```javascript
const cors = require('cors');
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));
```

### 3. Wrong API URL Configuration

**Error:** `NetworkError: Cannot reach backend API`

**Solution:**
1. Check your `.env.local` file:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

2. Verify the URL is correct:
   - No trailing slash
   - Correct protocol (http/https)
   - Correct port number
   - Correct hostname

3. Restart your Next.js dev server after changing environment variables:
```bash
npm run dev
```

### 4. Firewall or Network Issues

**Error:** `NetworkError` or connection timeout

**Solution:**
- Check if firewall is blocking the connection
- Verify network connectivity
- Try accessing the backend URL directly in browser: `http://localhost:8000/docs`

### 5. Backend Running on Different Port

**Error:** `NetworkError: Cannot connect to backend API`

**Solution:**
If your backend is running on a different port (e.g., 8001), update the configuration:

```env
# .env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
```

### 6. SSL/HTTPS Issues

**Error:** `NetworkError` when using HTTPS

**Solution:**
- If backend uses HTTP but frontend expects HTTPS (or vice versa), ensure they match
- For development, both should typically use HTTP
- For production, both should use HTTPS

## Debugging Steps

1. **Check Backend Status:**
   ```bash
   # Test backend directly
   curl http://localhost:8000/api/v1/locations/
   ```

2. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Check Console tab for detailed error messages
   - Check Network tab to see the actual request/response

3. **Check Environment Variables:**
   ```bash
   # In your frontend directory
   echo $NEXT_PUBLIC_API_BASE_URL
   # Or check .env.local file
   ```

4. **Verify API Endpoint:**
   - Open browser and navigate to: `http://localhost:8000/docs`
   - If this works, the backend is running
   - If not, start the backend server

5. **Check CORS Headers:**
   - In browser Network tab, check the response headers
   - Look for `Access-Control-Allow-Origin` header
   - Should include your frontend origin

## Quick Fixes

### Restart Everything
```bash
# Stop all servers
# Then restart backend
cd ../air-qua-monitor-backend  # or your backend directory
python -m uvicorn main:app --reload

# Then restart frontend
cd ../air-qua-monitor-front
npm run dev
```

### Clear Browser Cache
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or clear browser cache and localStorage

### Check Backend Logs
Look for errors in your backend console that might indicate:
- Database connection issues
- Port already in use
- Missing environment variables
- Application startup errors

## Testing API Connection

You can test the API connection manually:

```javascript
// In browser console
fetch('http://localhost:8000/api/v1/locations/', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## Still Having Issues?

1. Verify backend is accessible: `http://localhost:8000/docs`
2. Check backend logs for errors
3. Verify CORS configuration in backend
4. Check browser console for detailed error messages
5. Ensure both frontend and backend are running
6. Verify environment variables are set correctly

