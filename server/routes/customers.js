const express = require('express');
const { prisma } = require('../services/prisma');
const { authenticateSession, requireCounterOrAdmin } = require('../middleware/auth');

const router = express.Router();

// All customer routes require authentication
router.use(authenticateSession);

/**
 * GET /api/customers
 * List all customers with optional search
 */
router.get('/', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { search } = req.query;
        
        const where = { shop_id };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ];
        }

        const customers = await prisma.customer.findMany({
            where,
            orderBy: { name: 'asc' }
        });

        const transformed = customers.map(c => ({
            id: c.uuid,
            name: c.name,
            phone: c.phone || '',
            email: c.email || '',
            notes: c.notes || '',
            total_purchases: c.total_purchases,
            total_credit: c.total_credit,
            created_at: c.created_at,
            created_by: c.created_by
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
        const { shop_id, username } = req.user;
        const { name, phone, email, notes } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Customer name is required' });
        }

        // Validate uniqueness if phone is provided
        if (phone) {
            const existing = await prisma.customer.findFirst({
                where: { shop_id, phone }
            });
            if (existing) {
                return res.status(400).json({ error: 'A customer with this phone number already exists in this shop.' });
            }
        }

        const newCustomer = await prisma.customer.create({
            data: {
                shop_id,
                name: name.trim(),
                phone: phone || null,
                email: email || null,
                notes: notes || null,
                total_purchases: 0,
                total_credit: 0,
                created_by: username
            }
        });

        await logAudit(shop_id, username, 'CUSTOMER_CREATE', 'CUSTOMER', newCustomer.uuid, null, { name, phone }, req);

        res.status(201).json({
            id: newCustomer.uuid,
            name: newCustomer.name,
            phone: newCustomer.phone || '',
            email: newCustomer.email || '',
            notes: newCustomer.notes || '',
            total_purchases: 0,
            total_credit: 0,
            created_at: newCustomer.created_at,
            created_by: newCustomer.created_by
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
        const { shop_id, username } = req.user;
        const { id } = req.params;
        const { name, phone, email, notes } = req.body;

        const currentCustomer = await prisma.customer.findFirst({
            where: { uuid: id, shop_id }
        });

        if (!currentCustomer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const data = {};
        if (name !== undefined) data.name = name.trim();
        if (phone !== undefined) data.phone = phone;
        if (email !== undefined) data.email = email;
        if (notes !== undefined) data.notes = notes;

        const updated = await prisma.customer.update({
            where: { uuid: id },
            data
        });

        await logAudit(shop_id, username, 'CUSTOMER_UPDATE', 'CUSTOMER', id, currentCustomer, updated, req);

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
        const { shop_id } = req.user;
        const { id } = req.params;
        
        const entries = await prisma.customerLedger.findMany({
            where: { customer_id: id, shop_id },
            orderBy: { date: 'desc' }
        });

        const transformed = entries.map(e => ({
            id: e.uuid,
            customer_id: e.customer_id,
            type: e.type,
            amount: e.amount,
            balance: e.balance,
            reference: e.reference || '',
            date: e.date,
            recorded_by: e.recorded_by
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
        const { shop_id, username } = req.user;
        const { id } = req.params;
        const { amount, reference } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid payment amount is required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const customer = await tx.customer.findFirst({
                where: { uuid: id, shop_id }
            });
            
            if (!customer) throw new Error('Customer not found');

            const currentCredit = customer.total_credit;
            const newCredit = Math.max(0, currentCredit - amount);

            const ledgerEntry = await tx.customerLedger.create({
                data: {
                    shop_id,
                    customer_id: id,
                    type: 'payment',
                    amount: amount,
                    balance: newCredit,
                    reference: reference || '',
                    recorded_by: username
                }
            });

            await tx.customer.update({
                where: { uuid: id },
                data: { total_credit: newCredit }
            });

            await tx.auditLog.create({
                data: {
                    shop_id,
                    user: username,
                    action: 'CUSTOMER_PAYMENT',
                    details: JSON.stringify({ entityType: 'CUSTOMER', entityId: id, oldValue: { credit: currentCredit }, newValue: { payment: amount, new_credit: newCredit } }),
                    ip_address: req.ip || 'unknown'
                }
            });

            return { previous_credit: currentCredit, new_credit: newCredit, ledger_entry_id: ledgerEntry.uuid };
        });

        res.json({
            success: true,
            previous_credit: result.previous_credit,
            payment: amount,
            new_credit: result.new_credit,
            ledger_entry_id: result.ledger_entry_id
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(error.message === 'Customer not found' ? 404 : 500).json({ error: error.message || 'Failed to record payment' });
    }
});

/**
 * POST /api/customers/:id/credit
 * Add a credit entry (e.g., from a credit sale)
 */
router.post('/:id/credit', requireCounterOrAdmin, async (req, res) => {
    try {
        const { shop_id, username } = req.user;
        const { id } = req.params;
        const { amount, reference } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid credit amount is required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const customer = await tx.customer.findFirst({
                where: { uuid: id, shop_id }
            });
            
            if (!customer) throw new Error('Customer not found');

            const currentCredit = customer.total_credit;
            const currentPurchases = customer.total_purchases;
            const newCredit = currentCredit + amount;

            const ledgerEntry = await tx.customerLedger.create({
                data: {
                    shop_id,
                    customer_id: id,
                    type: 'credit',
                    amount: amount,
                    balance: newCredit,
                    reference: reference || '',
                    recorded_by: username
                }
            });

            await tx.customer.update({
                where: { uuid: id },
                data: {
                    total_credit: newCredit,
                    total_purchases: currentPurchases + amount
                }
            });

            return { new_credit: newCredit, ledger_entry_id: ledgerEntry.uuid };
        });

        res.json({
            success: true,
            new_credit: result.new_credit,
            ledger_entry_id: result.ledger_entry_id
        });
    } catch (error) {
        console.error('Add credit error:', error);
        res.status(error.message === 'Customer not found' ? 404 : 500).json({ error: error.message || 'Failed to add credit' });
    }
});

async function logAudit(shop_id, user, action, entityType, entityId, oldValue, newValue, req) {
    try {
        const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown';
        await prisma.auditLog.create({
            data: {
                shop_id,
                user: user || 'anonymous',
                action,
                details: JSON.stringify({ entityType, entityId, oldValue, newValue }),
                ip_address: ipAddress
            }
        });
    } catch (error) {
        console.error('Audit log error:', error);
    }
}

module.exports = router;
