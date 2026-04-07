const express = require('express');
const { v4: uuidv4 } = require('uuid');
const sheets = require('../services/sheets');
const { authenticateSession, requireCounterOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Tab names for customers
const CUSTOMERS_TAB = 'CUSTOMERS';
const LEDGER_TAB = 'CUSTOMER_LEDGER';

// Column headers for auto-creation
const CUSTOMER_HEADERS = ['ID', 'Name', 'Phone', 'Email', 'Notes', 'Total_Purchases', 'Total_Credit', 'Created_At', 'Created_By'];
const LEDGER_HEADERS = ['ID', 'Customer_ID', 'Type', 'Amount', 'Balance', 'Reference', 'Date', 'Recorded_By'];

/**
 * Ensure the Customers and Customer_Ledger tabs exist, create them if not.
 */
async function ensureTabs() {
    const doc = await sheets.getDocument();
    
    if (!doc.sheetsByTitle[CUSTOMERS_TAB]) {
        console.log(`[Customers] Creating "${CUSTOMERS_TAB}" tab...`);
        const sheet = await doc.addSheet({ title: CUSTOMERS_TAB });
        await sheet.setHeaderRow(CUSTOMER_HEADERS);
        console.log(`[Customers] "${CUSTOMERS_TAB}" tab created with headers.`);
    }
    
    if (!doc.sheetsByTitle[LEDGER_TAB]) {
        console.log(`[Customers] Creating "${LEDGER_TAB}" tab...`);
        const sheet = await doc.addSheet({ title: LEDGER_TAB });
        await sheet.setHeaderRow(LEDGER_HEADERS);
        console.log(`[Customers] "${LEDGER_TAB}" tab created with headers.`);
    }
}

// Run tab creation on module load
ensureTabs().catch(err => console.error('[Customers] Failed to ensure tabs:', err.message));

// All customer routes require authentication
router.use(authenticateSession);

/**
 * GET /api/customers
 * List all customers with optional search
 */
router.get('/', async (req, res) => {
    try {
        await ensureTabs();
        const { search } = req.query;
        let customers = await sheets.getAllRows(CUSTOMERS_TAB);

        if (search) {
            const s = search.toLowerCase();
            customers = customers.filter(c =>
                (c.Name || '').toLowerCase().includes(s) ||
                (c.Phone || '').toLowerCase().includes(s) ||
                (c.Email || '').toLowerCase().includes(s)
            );
        }

        const transformed = customers.map(c => ({
            id: c.ID,
            name: c.Name,
            phone: c.Phone || '',
            email: c.Email || '',
            notes: c.Notes || '',
            total_purchases: parseFloat(c.Total_Purchases) || 0,
            total_credit: parseFloat(c.Total_Credit) || 0,
            created_at: c.Created_At,
            created_by: c.Created_By
        }));

        res.json(transformed);
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

/**
 * POST /api/customers
 * Create a new customer
 */
router.post('/', requireCounterOrAdmin, async (req, res) => {
    try {
        await ensureTabs();
        const { name, phone, email, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Customer name is required' });
        }

        const newCustomer = {
            ID: uuidv4(),
            Name: name.trim(),
            Phone: phone || '',
            Email: email || '',
            Notes: notes || '',
            Total_Purchases: 0,
            Total_Credit: 0,
            Created_At: new Date().toISOString(),
            Created_By: req.user.username
        };

        await sheets.addRow(CUSTOMERS_TAB, newCustomer);

        // Audit log
        await logAudit(req.user.username, 'CUSTOMER_CREATE', 'CUSTOMER', newCustomer.ID, null, { name, phone }, req);

        res.status(201).json({
            id: newCustomer.ID,
            name: newCustomer.Name,
            phone: newCustomer.Phone,
            email: newCustomer.Email,
            notes: newCustomer.Notes,
            total_purchases: 0,
            total_credit: 0,
            created_at: newCustomer.Created_At,
            created_by: newCustomer.Created_By
        });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

/**
 * PUT /api/customers/:id
 * Update customer info
 */
router.put('/:id', requireCounterOrAdmin, async (req, res) => {
    try {
        await ensureTabs();
        const { id } = req.params;
        const { name, phone, email, notes } = req.body;

        const updates = {};
        if (name !== undefined) updates.Name = name.trim();
        if (phone !== undefined) updates.Phone = phone;
        if (email !== undefined) updates.Email = email;
        if (notes !== undefined) updates.Notes = notes;

        await sheets.updateRow(CUSTOMERS_TAB, { ID: id }, updates);

        res.json({ success: true, id });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Failed to update customer' });
    }
});

/**
 * GET /api/customers/:id/ledger
 * Get ledger entries for a customer
 */
router.get('/:id/ledger', async (req, res) => {
    try {
        await ensureTabs();
        const { id } = req.params;
        let entries = await sheets.getAllRows(LEDGER_TAB);
        entries = entries.filter(e => e.Customer_ID === id);

        // Sort by date descending
        entries.sort((a, b) => new Date(b.Date) - new Date(a.Date));

        const transformed = entries.map(e => ({
            id: e.ID,
            customer_id: e.Customer_ID,
            type: e.Type,
            amount: parseFloat(e.Amount) || 0,
            balance: parseFloat(e.Balance) || 0,
            reference: e.Reference || '',
            date: e.Date,
            recorded_by: e.Recorded_By
        }));

        res.json(transformed);
    } catch (error) {
        console.error('Get ledger error:', error);
        res.status(500).json({ error: 'Failed to fetch ledger' });
    }
});

/**
 * POST /api/customers/:id/payment
 * Record a payment against a customer's credit balance
 */
router.post('/:id/payment', requireCounterOrAdmin, async (req, res) => {
    try {
        await ensureTabs();
        const { id } = req.params;
        const { amount, reference } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid payment amount is required' });
        }

        // Get customer
        const customer = await sheets.findRow(CUSTOMERS_TAB, { ID: id });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const currentCredit = parseFloat(customer.Total_Credit) || 0;
        const newCredit = Math.max(0, currentCredit - amount);

        // Create ledger entry
        const ledgerEntry = {
            ID: uuidv4(),
            Customer_ID: id,
            Type: 'payment',
            Amount: amount,
            Balance: newCredit,
            Reference: reference || '',
            Date: new Date().toISOString(),
            Recorded_By: req.user.username
        };

        await sheets.addRow(LEDGER_TAB, ledgerEntry);

        // Update customer credit balance
        await sheets.updateRow(CUSTOMERS_TAB, { ID: id }, {
            Total_Credit: newCredit
        });

        // Audit
        await logAudit(req.user.username, 'CUSTOMER_PAYMENT', 'CUSTOMER', id, { credit: currentCredit }, { payment: amount, new_credit: newCredit }, req);

        res.json({
            success: true,
            previous_credit: currentCredit,
            payment: amount,
            new_credit: newCredit,
            ledger_entry_id: ledgerEntry.ID
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

/**
 * POST /api/customers/:id/credit
 * Add a credit entry (e.g., from a credit sale)
 */
router.post('/:id/credit', requireCounterOrAdmin, async (req, res) => {
    try {
        await ensureTabs();
        const { id } = req.params;
        const { amount, reference } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid credit amount is required' });
        }

        const customer = await sheets.findRow(CUSTOMERS_TAB, { ID: id });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const currentCredit = parseFloat(customer.Total_Credit) || 0;
        const currentPurchases = parseFloat(customer.Total_Purchases) || 0;
        const newCredit = currentCredit + amount;

        const ledgerEntry = {
            ID: uuidv4(),
            Customer_ID: id,
            Type: 'credit',
            Amount: amount,
            Balance: newCredit,
            Reference: reference || '',
            Date: new Date().toISOString(),
            Recorded_By: req.user.username
        };

        await sheets.addRow(LEDGER_TAB, ledgerEntry);

        await sheets.updateRow(CUSTOMERS_TAB, { ID: id }, {
            Total_Credit: newCredit,
            Total_Purchases: currentPurchases + amount
        });

        res.json({
            success: true,
            new_credit: newCredit,
            ledger_entry_id: ledgerEntry.ID
        });
    } catch (error) {
        console.error('Add credit error:', error);
        res.status(500).json({ error: 'Failed to add credit' });
    }
});

/**
 * Helper: Log to audit trail
 */
async function logAudit(user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        const TABS = sheets.TABS;
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
