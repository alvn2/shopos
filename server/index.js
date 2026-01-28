require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const sheets = require('./services/sheets');
const sessionService = require('./services/session');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// CORS configuration - MUST be before helmet
// In development, allow all origins. In production, use ALLOWED_ORIGINS env var.
const corsOrigin = process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false)
    : true;

app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
}));

// Security middleware
app.use(helmet());

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Rate limiting - general
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // 200 requests per window
    message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', generalLimiter);

// Rate limiting - auth (stricter)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per 15 minutes
    message: { error: 'Too many login attempts, please try again later' }
});
app.use('/api/auth/login', authLimiter);

// Request logging (development)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/audit', require('./routes/audit'));

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const sheetsStatus = await sheets.testConnection();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            sheets: sheetsStatus.connected ? 'connected' : 'disconnected',
            sheets_title: sheetsStatus.title,
            available_tabs: sheetsStatus.sheets
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// Cron job: Clean up expired sessions every hour
cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running session cleanup...');
    try {
        await sessionService.cleanupExpiredSessions();
    } catch (error) {
        console.error('[Cron] Session cleanup failed:', error);
    }
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                    ShopOS Backend                       ║
╠════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                           ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(20)}         ║
║                                                        ║
║  Endpoints:                                            ║
║    POST   /api/auth/login                              ║
║    POST   /api/auth/logout                             ║
║    GET    /api/inventory                               ║
║    POST   /api/sales                                   ║
║    GET    /api/reports/*                               ║
║    GET    /api/settings                                ║
║    GET    /api/audit                                   ║
║    GET    /api/health                                  ║
╚════════════════════════════════════════════════════════╝
  `);

    // Test Google Sheets connection on startup
    sheets.testConnection().then(result => {
        if (result.connected) {
            console.log(`✅ Google Sheets connected: "${result.title}"`);
            console.log(`   Available tabs: ${result.sheets.join(', ')}`);
        } else {
            console.log(`❌ Google Sheets not connected: ${result.error}`);
            console.log(`   Make sure your .env file is configured correctly`);
        }
    });
});

module.exports = app;
