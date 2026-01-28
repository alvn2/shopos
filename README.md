# ShopOS - Parts Inventory Management System

A complete inventory management system for auto parts shops, built with React + Vite (frontend) and Node.js + Express (backend), using Google Sheets as the database.

---

## 🚀 Deployment Guide

### Prerequisites
- Node.js 18+ installed
- A Google Cloud Platform account with a Service Account
- A domain or hosting service (Vercel, Railway, Render, VPS, etc.)

---

## Part 1: Google Sheets Setup

### 1.1 Create Service Account
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → Service Account**
5. Fill in the service account details and click **Create**
6. Skip the optional steps and click **Done**
7. Click on your new service account, go to **Keys** tab
8. Click **Add Key → Create new key → JSON**
9. Download the JSON file (keep it safe!)

### 1.2 Enable Google Sheets API
1. Go to **APIs & Services → Library**
2. Search for "Google Sheets API" and enable it

### 1.3 Create & Share Spreadsheet
1. Create a new Google Spreadsheet
2. Share it with your service account email (found in the JSON file as `client_email`)
3. Give the service account **Editor** access
4. Copy the Spreadsheet ID from the URL: `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`

### 1.4 Create Required Tabs
Create these tabs (exact names required):
- `INVENTORY`
- `USERS`
- `SESSIONS`
- `SALES`
- `SETTINGS`
- `AUDIT_LOG`

See `SPREADSHEET_SETUP.md` for column headers for each tab.

---

## Part 2: Backend Deployment

### 2.1 Environment Variables
Create a `.env` file in the `server/` directory:

```env
# Server
PORT=5000
NODE_ENV=production

# Google Sheets
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# CORS (your frontend domain)
ALLOWED_ORIGINS=https://your-frontend-domain.com

# Session
SESSION_SECRET=your-random-secret-here-at-least-32-chars
SESSION_EXPIRY_HOURS=24
```

> **Important:** The `GOOGLE_PRIVATE_KEY` must include the `\n` newlines as shown. Copy it directly from the JSON file.

### 2.2 Deploy to Railway (Recommended)

1. **Push code to GitHub**
2. Go to [railway.app](https://railway.app/) and sign in
3. Click **New Project → Deploy from GitHub repo**
4. Select your repository
5. Set the **Root Directory** to `server`
6. Add all environment variables from section 2.1
7. Railway will auto-detect Node.js and deploy

**Build Command:** `npm install`  
**Start Command:** `npm start`

### 2.3 Deploy to Render

1. Go to [render.com](https://render.com/) and sign in
2. Click **New → Web Service**
3. Connect your GitHub repository
4. Set:
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
5. Add environment variables
6. Deploy

### 2.4 Deploy to VPS (Ubuntu/Debian)

```bash
# 1. SSH into your server
ssh user@your-server-ip

# 2. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Clone your repository
git clone https://github.com/yourusername/shopos.git
cd shopos/server

# 4. Install dependencies
npm install --production

# 5. Create .env file
nano .env
# (paste your environment variables)

# 6. Install PM2 for process management
sudo npm install -g pm2

# 7. Start the server
pm2 start index.js --name shopos-backend

# 8. Save PM2 config for auto-restart
pm2 save
pm2 startup
```

#### Setup Nginx Reverse Proxy (VPS)
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site and restart nginx
sudo ln -s /etc/nginx/sites-available/shopos-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Add SSL with Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## Part 3: Frontend Deployment

### 3.1 Configure API URL
Edit `services/api.ts` and update the `API_BASE_URL`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.yourdomain.com/api';
```

Or set the environment variable `VITE_API_URL` during build.

### 3.2 Build for Production

```bash
cd /path/to/shopos
npm install
npm run build
```

This creates a `dist/` folder with static files.

### 3.3 Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com/) and sign in
3. Click **Add New → Project**
4. Import your GitHub repository
5. Set:
   - **Root Directory**: `.` (root)
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add environment variable:
   - `VITE_API_URL` = `https://your-backend-domain.com/api`
7. Deploy

### 3.4 Deploy to Netlify

1. Go to [netlify.com](https://netlify.com/) and sign in
2. Click **Add new site → Import an existing project**
3. Connect GitHub and select your repo
4. Set:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`
5. Add environment variable `VITE_API_URL`
6. Deploy

### 3.5 Deploy to VPS (Static Files)

```bash
# Build locally
npm run build

# Upload dist folder to server
scp -r dist/* user@your-server:/var/www/shopos/

# Or use rsync
rsync -avz --delete dist/ user@your-server:/var/www/shopos/
```

#### Nginx config for static frontend:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/shopos;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Part 4: Post-Deployment Checklist

### 4.1 Create Admin User
Add a row to the `USERS` tab in your Google Sheet:

| uuid | username | password_hash | full_name | role | is_active | created_at |
|------|----------|--------------|-----------|------|-----------|------------|
| (generate UUID) | admin | admin | Administrator | admin | TRUE | 2026-01-28T00:00:00Z |

> **Note:** For production, you should hash passwords. The current implementation uses plain text for demo purposes.

### 4.2 Test Endpoints
```bash
# Health check
curl https://api.yourdomain.com/api/health

# Login
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### 4.3 Verify Frontend
1. Open your frontend URL
2. Log in with admin credentials
3. Test inventory CRUD operations
4. Test sales recording
5. Check reports page
6. Verify Settings access (admin only)

---

## 🔧 Environment Variables Reference

### Backend (`server/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `GOOGLE_SPREADSHEET_ID` | **Yes** | Your Google Sheet ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | **Yes** | Service account email |
| `GOOGLE_PRIVATE_KEY` | **Yes** | Service account private key |
| `ALLOWED_ORIGINS` | Yes (prod) | Comma-separated allowed origins |
| `SESSION_SECRET` | No | Secret for session signing |
| `SESSION_EXPIRY_HOURS` | No | Session duration (default: 24) |

### Frontend (`.env` or build-time)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | **Yes** | Backend API URL |

---

## 🐛 Troubleshooting

### CORS Errors
- Ensure `ALLOWED_ORIGINS` includes your frontend domain
- Check that the backend is accessible from the frontend

### Google Sheets Connection Failed
- Verify the service account email has Editor access to the sheet
- Check that the Spreadsheet ID is correct
- Ensure the private key is formatted correctly with `\n` newlines

### Login Issues
- Check that the USERS tab has correct column headers
- Verify the admin user exists with matching credentials
- Check browser console for API errors

### 404 on Page Refresh
- Ensure your hosting is configured for SPA routing (all routes → index.html)

---

## 📁 Project Structure

```
shopos/
├── components/          # React components
├── pages/               # Page components
├── contexts/            # React contexts (Auth, Offline)
├── services/            # API service layer
├── types/               # TypeScript types
├── index.html           # HTML entry point
├── index.tsx            # React entry point
├── App.tsx              # Main app component
├── tailwind.config.js   # Tailwind configuration
├── vite.config.ts       # Vite configuration
└── server/              # Backend
    ├── index.js         # Express server entry
    ├── routes/          # API routes
    ├── services/        # Business logic (sheets, session)
    └── middleware/      # Auth middleware
```

---

## 📝 License

MIT License - feel free to use this for your business!
