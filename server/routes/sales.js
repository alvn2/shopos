const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sheets = require('../services/sheets');
const { authenticateSession } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { addSaleToQueue } = require('../services/queueService');

const router = express.Router();
const TABS = sheets.TABS;

router.use(authenticateSession);

/**
 * POST /api/sales
 * Record a new sale
 */
router.post('/', async (req, res) => {
    try {
        const { batch_id, date, items, total_kes, payment_method, customer_name, notes } = req.body;

        if (!batch_id) {
            return res.status(400).json({ error: 'Receipt number (batch_id) is required' });
        }

        // Check for duplicate receipt number
        const existingSale = await sheets.findRow(TABS.SALES, { Batch_ID: batch_id });
        if (existingSale) {
            return res.status(409).json({ error: 'Receipt number already exists' });
        }

        const saleDate = date || new Date().toISOString();

        // Create sale record
        const saleRecord = {
            Date: saleDate,
            Batch_ID: batch_id,
            Items_JSON: JSON.stringify(items || []),
            Total_KES: total_kes || 0,
            Payment_Method: payment_method || 'Cash',
            Customer_Name: customer_name || '',
            Notes: notes || '',
            Sold_By: req.user.username
        };

        // Queue the sale for background processing to avoid Google Sheets API rate limits
        await addSaleToQueue({
            saleRecord,
            itemsData: items,
            reqInfo: {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        res.status(201).json({
            message: 'Sale recorded successfully',
            batch_id: batch_id,
            total: total_kes
        });
    } catch (error) {
        console.error('Create sale error:', error);
        res.status(500).json({ error: 'Failed to record sale' });
    }
});

/**
 * GET /api/sales
 * Get all sales with optional filters and pagination
 */
router.get('/', async (req, res) => {
    try {
        const { from, to, payment_method, page, limit } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 0; // 0 means no pagination

        let sales = await sheets.getAllRows(TABS.SALES);

        // Filter by date range
        if (from) {
            const fromDate = new Date(from);
            sales = sales.filter(s => new Date(s.Date) >= fromDate);
        }
        if (to) {
            const toDate = new Date(to);
            sales = sales.filter(s => new Date(s.Date) <= toDate);
        }

        // Filter by payment method
        if (payment_method && payment_method !== 'All') {
            sales = sales.filter(s => s.Payment_Method === payment_method);
        }

        // Sort by date descending (most recent first)
        sales.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        const total = sales.length;

        // Pagination
        if (limitNum > 0) {
            const offset = (pageNum - 1) * limitNum;
            sales = sales.slice(offset, offset + limitNum);
        }

        // Transform for frontend
        const transformed = sales.map(s => ({
            date: s.Date,
            batch_id: s.Batch_ID,
            items: JSON.parse(s.Items_JSON || '[]'),
            total_kes: parseFloat(s.Total_KES) || 0,
            payment_method: s.Payment_Method,
            customer_name: s.Customer_Name,
            notes: s.Notes,
            sold_by: s.Sold_By
        }));

        // Return paginated or full response
        if (limitNum > 0) {
            return res.json({
                sales: transformed,
                total,
                page: pageNum,
                limit: limitNum,
                total_pages: Math.ceil(total / limitNum)
            });
        }

        res.json(transformed);
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

/**
 * Helper: Log to audit trail
 */
async function logAudit(user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        await sheets.addRow(TABS.AUDIT_LOG, {
            Timestamp: new Date().toISOString(),
            User: user,
            Action: action,
            Entity_Type: entityType,
            Entity_ID: entityId,
            Old_Value: oldValue ? JSON.stringify(oldValue) : '',
            New_Value: newValue ? JSON.stringify(newValue) : '',
            IP_Address: req?.ip || '',
            Device_Info: (req?.headers?.['user-agent'] || '').substring(0, 200)
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

module.exports = router;
