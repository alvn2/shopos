const express = require('express');
const { prisma } = require('../services/prisma');
const { authenticateSession, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateSession);

/**
 * GET /api/reports/sales-summary
 * Get sales summary with metrics and chart data
 */
router.get('/sales-summary', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { from, to } = req.query;

        // Default to last 30 days if no date range
        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : now;

        const sales = await prisma.sale.findMany({
            where: {
                shop_id,
                date: { gte: fromDate, lte: toDate }
            }
        });

        const totalSales = sales.reduce((sum, s) => sum + (s.total_kes || 0), 0);
        const totalTransactions = sales.length;
        const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

        const paymentMethods = {};
        sales.forEach(s => {
            const method = s.payment_method || 'Cash';
            paymentMethods[method] = (paymentMethods[method] || 0) + 1;
        });

        const paymentMethodPercents = {};
        Object.keys(paymentMethods).forEach(method => {
            paymentMethodPercents[method] = Math.round((paymentMethods[method] / totalTransactions) * 100);
        });

        const chartData = {};
        sales.forEach(s => {
            const dateStr = s.date.toISOString().split('T')[0];
            if (!chartData[dateStr]) {
                chartData[dateStr] = 0;
            }
            chartData[dateStr] += (s.total_kes || 0);
        });

        const chartArray = Object.keys(chartData)
            .sort()
            .map(date => ({ date, sales: chartData[date] }));

        const periodDays = Math.ceil((toDate - fromDate) / (24 * 60 * 60 * 1000));
        const prevFromDate = new Date(fromDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

        const prevSales = await prisma.sale.findMany({
            where: {
                shop_id,
                date: { gte: prevFromDate, lt: fromDate }
            }
        });
        
        const prevTotal = prevSales.reduce((sum, s) => sum + (s.total_kes || 0), 0);
        const growthPercent = prevTotal > 0 ? ((totalSales - prevTotal) / prevTotal) * 100 : 0;

        res.json({
            metrics: {
                total_sales: totalSales,
                total_transactions: totalTransactions,
                average_transaction: Math.round(averageTransaction * 100) / 100,
                growth_percent: Math.round(growthPercent * 10) / 10,
                payment_methods: paymentMethodPercents
            },
            chart_data: chartArray
        });
    } catch (error) {
        console.error('Sales summary error:', error);
        res.status(500).json({ error: 'Failed to generate sales summary' });
    }
});

/**
 * GET /api/reports/inventory-health
 * Get inventory health metrics
 */
router.get('/inventory-health', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const inventory = await prisma.inventoryItem.findMany({
            where: { shop_id, is_deleted: false }
        });

        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        const outOfStockItems = [];

        inventory.forEach(item => {
            if (item.stock_qty <= 0) {
                outOfStock++;
                outOfStockItems.push({
                    uuid: item.uuid,
                    part_number: item.part_number,
                    name: item.name,
                    last_updated: item.updated_at
                });
            } else if (item.stock_qty <= item.min_stock) {
                lowStock++;
            } else {
                inStock++;
            }
        });

        res.json({
            summary: {
                total_items: inventory.length,
                in_stock: inStock,
                low_stock: lowStock,
                out_of_stock: outOfStock
            },
            out_of_stock_items: outOfStockItems
        });
    } catch (error) {
        console.error('Inventory health error:', error);
        res.status(500).json({ error: 'Failed to generate inventory health report' });
    }
});

/**
 * GET /api/reports/top-products
 * Get top selling products
 */
router.get('/top-products', async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { from, to, limit = 20 } = req.query;

        const where = { shop_id };
        if (from || to) {
            where.date = {};
            if (from) where.date.gte = new Date(from);
            if (to) where.date.lte = new Date(to);
        }

        const sales = await prisma.sale.findMany({ where });

        const productStats = {};

        sales.forEach(sale => {
            const items = JSON.parse(sale.items_json || '[]');
            items.forEach(item => {
                if (!productStats[item.uuid]) {
                    productStats[item.uuid] = {
                        uuid: item.uuid,
                        name: item.name,
                        part_number: item.part_number,
                        qty_sold: 0,
                        revenue: 0
                    };
                }
                productStats[item.uuid].qty_sold += item.qty || 0;
                productStats[item.uuid].revenue += (item.unit_price || 0) * (item.qty || 0);
            });
        });

        let products = Object.values(productStats);
        products.sort((a, b) => b.qty_sold - a.qty_sold);
        products = products.slice(0, parseInt(limit));
        products = products.map((p, index) => ({ rank: index + 1, ...p }));

        res.json({ products });
    } catch (error) {
        console.error('Top products error:', error);
        res.status(500).json({ error: 'Failed to generate top products report' });
    }
});

/**
 * GET /api/reports/profit-analysis (Admin only)
 * Get profit analysis
 */
router.get('/profit-analysis', requireAdmin, async (req, res) => {
    try {
        const { shop_id } = req.user;
        const { from, to } = req.query;

        // Get settings for AED rate and conversion percent
        const shopSettings = await prisma.settings.findUnique({ where: { shop_id } });
        
        const aedRate = shopSettings?.aed_rate || 36.50;
        const conversionPercent = shopSettings?.conversion_percent || 13.0;
        // Overhead factor: 1 + (conversion_percent / 100)
        const overheadFactor = 1 + (conversionPercent / 100);

        // Get inventory for cost basis
        const inventory = await prisma.inventoryItem.findMany({ where: { shop_id } });
        const inventoryMap = {};
        inventory.forEach(item => {
            inventoryMap[item.uuid] = {
                aed_buying_price: item.aed_buying_price || 0,
                selling_price: item.selling_price || 0
            };
        });

        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : now;

        const sales = await prisma.sale.findMany({
            where: {
                shop_id,
                date: { gte: fromDate, lte: toDate }
            }
        });

        let totalRevenue = 0;
        let totalProfit = 0;

        sales.forEach(sale => {
            totalRevenue += (sale.total_kes || 0);

            const items = JSON.parse(sale.items_json || '[]');
            items.forEach(item => {
                const invItem = inventoryMap[item.uuid];
                if (invItem) {
                    const landedCost = invItem.aed_buying_price * aedRate * overheadFactor;
                    const unitProfit = (item.unit_price || invItem.selling_price) - landedCost;
                    totalProfit += unitProfit * (item.qty || 0);
                }
            });
        });

        const totalCogs = totalRevenue - totalProfit;
        const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

        const lossMakingItems = [];
        inventory.forEach(item => {
            const aedCost = item.aed_buying_price || 0;
            const sellingPrice = item.selling_price || 0;
            const landedCost = aedCost * aedRate * overheadFactor;

            if (sellingPrice < landedCost && sellingPrice > 0) {
                lossMakingItems.push({
                    name: item.name,
                    part_number: item.part_number,
                    selling_price: sellingPrice,
                    landed_cost: Math.round(landedCost * 100) / 100,
                    loss_per_unit: Math.round((sellingPrice - landedCost) * 100) / 100
                });
            }
        });

        res.json({
            metrics: {
                total_profit: Math.round(totalProfit * 100) / 100,
                total_revenue: Math.round(totalRevenue * 100) / 100,
                total_cogs: Math.round(totalCogs * 100) / 100,
                average_margin: Math.round(averageMargin * 10) / 10
            },
            loss_making_items: lossMakingItems
        });
    } catch (error) {
        console.error('Profit analysis error:', error);
        res.status(500).json({ error: 'Failed to generate profit analysis' });
    }
});

module.exports = router;
