const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../services/prisma');
const { authenticateSession } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

router.use(authenticateSession);

/**
 * POST /api/sales
 * Record a new sale
 */
router.post('/', async (req, res) => {
    try {
        const { shop_id, username } = req.user;
        const { batch_id, date, items, total_kes, total_price, payment_method, customer_name, notes } = req.body;

        if (!batch_id) {
            return res.status(400).json({ error: 'Receipt number (batch_id) is required' });
        }

        const saleTotal = total_price !== undefined ? total_price : (total_kes || 0);

        // Check for duplicate receipt number for this shop
        const existingSale = await prisma.sale.findFirst({
            where: { batch_id, shop_id }
        });

        if (existingSale) {
            return res.status(409).json({ error: 'Receipt number already exists' });
        }

        const saleDate = date ? new Date(date) : new Date();

        // Use a transaction to create the sale and decrement inventory
        await prisma.$transaction(async (tx) => {
            // 1. Create Sale
            const sale = await tx.sale.create({
                data: {
                    shop_id,
                    batch_id,
                    date: saleDate,
                    items_json: JSON.stringify(items || []),
                    total_price: saleTotal,
                    payment_method: payment_method || 'Cash',
                    customer_name: customer_name || '',
                    notes: notes || '',
                    sold_by: username
                }
            });

            // 2. Decrement inventory
            if (items && Array.isArray(items)) {
                for (const item of items) {
                    if (item.uuid) {
                        // Find current item
                        const invItem = await tx.inventoryItem.findFirst({
                            where: { uuid: item.uuid, shop_id }
                        });

                        if (invItem) {
                            const qtySold = parseInt(item.qty) || 1;
                            const newStock = Math.max(0, invItem.stock_qty - qtySold);
                            
                            await tx.inventoryItem.update({
                                where: { uuid: invItem.uuid },
                                data: {
                                    stock_qty: newStock,
                                    updated_by: username
                                }
                            });
                        }
                    }
                }
            }

            // 3. Audit log
            await tx.auditLog.create({
                data: {
                    shop_id,
                    user: username,
                    action: 'SALE_CREATE',
                    details: JSON.stringify({ batch_id, total: saleTotal, items_count: items ? items.length : 0 }),
                    ip_address: req.ip || 'unknown'
                }
            });
        });

        res.status(201).json({
            message: 'Sale recorded successfully',
            batch_id: batch_id,
            total: saleTotal
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
        const { shop_id } = req.user;
        const { from, to, payment_method, page, limit } = req.query;
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(limit) || 0; // 0 means no pagination

        const where = { shop_id };

        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from);
            if (to) where.date.lte = new Date(to);
        }

        if (payment_method && payment_method !== 'All') {
            where.payment_method = payment_method;
        }

        const queryOpts = {
            where,
            orderBy: { date: 'desc' }
        };

        const total = await prisma.sale.count({ where });

        if (limitNum > 0) {
            queryOpts.skip = (pageNum - 1) * limitNum;
            queryOpts.take = limitNum;
        }

        const sales = await prisma.sale.findMany(queryOpts);

        // Transform for frontend
        const transformed = sales.map(s => ({
            date: s.date.toISOString(),
            batch_id: s.batch_id,
            items: JSON.parse(s.items_json || '[]'),
            total_kes: s.total_price,
            total_price: s.total_price,
            payment_method: s.payment_method,
            customer_name: s.customer_name,
            notes: s.notes,
            sold_by: s.sold_by
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

module.exports = router;
