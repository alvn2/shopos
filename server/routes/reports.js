const express = require('express');
const sheets = require('../services/sheets');
const { authenticateSession, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const TABS = sheets.TABS;

router.use(authenticateSession);

/**
 * GET /api/reports/sales-summary
 * Get sales summary with metrics and chart data
 */
router.get('/sales-summary', async (req, res) => {
    try {
        const { from, to } = req.query;

        let sales = await sheets.getAllRows(TABS.SALES);

        // Default to last 30 days if no date range
        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : now;

        sales = sales.filter(s => {
            const saleDate = new Date(s.Date);
            return saleDate >= fromDate && saleDate <= toDate;
        });

        // Calculate metrics
        const totalSales = sales.reduce((sum, s) => sum + (parseFloat(s.Total_KES) || 0), 0);
        const totalTransactions = sales.length;
        const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

        // Payment method breakdown
        const paymentMethods = {};
        sales.forEach(s => {
            const method = s.Payment_Method || 'Cash';
            paymentMethods[method] = (paymentMethods[method] || 0) + 1;
        });

        // Convert to percentages
        const paymentMethodPercents = {};
        Object.keys(paymentMethods).forEach(method => {
            paymentMethodPercents[method] = Math.round((paymentMethods[method] / totalTransactions) * 100);
        });

        // Chart data - group by date
        const chartData = {};
        sales.forEach(s => {
            const date = s.Date.split('T')[0]; // Get just the date part
            if (!chartData[date]) {
                chartData[date] = 0;
            }
            chartData[date] += parseFloat(s.Total_KES) || 0;
        });

        const chartArray = Object.keys(chartData)
            .sort()
            .map(date => ({
                date,
                sales: chartData[date]
            }));

        // Calculate growth vs previous period
        const periodDays = Math.ceil((toDate - fromDate) / (24 * 60 * 60 * 1000));
        const prevFromDate = new Date(fromDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

        const allSales = await sheets.getAllRows(TABS.SALES);
        const prevSales = allSales.filter(s => {
            const saleDate = new Date(s.Date);
            return saleDate >= prevFromDate && saleDate < fromDate;
        });
        const prevTotal = prevSales.reduce((sum, s) => sum + (parseFloat(s.Total_KES) || 0), 0);

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
        const inventory = await sheets.getAllRows(TABS.INVENTORY);

        // Calculate counts
        let inStock = 0;
        let lowStock = 0;
        let outOfStock = 0;
        const outOfStockItems = [];

        inventory.forEach(item => {
            const stockQty = parseInt(item.Stock_Qty) || 0;
            const minStock = parseInt(item.Min_Stock) || 5;

            if (stockQty === 0) {
                outOfStock++;
                outOfStockItems.push({
                    uuid: item.UUID,
                    part_number: item.Part_Number,
                    name: item.Name,
                    last_updated: item.Last_Updated
                });
            } else if (stockQty <= minStock) {
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
        const { from, to, limit = 20 } = req.query;

        let sales = await sheets.getAllRows(TABS.SALES);
        const inventory = await sheets.getAllRows(TABS.INVENTORY);

        // Filter by date
        if (from) {
            const fromDate = new Date(from);
            sales = sales.filter(s => new Date(s.Date) >= fromDate);
        }
        if (to) {
            const toDate = new Date(to);
            sales = sales.filter(s => new Date(s.Date) <= toDate);
        }

        // Aggregate by product
        const productStats = {};

        sales.forEach(sale => {
            const items = JSON.parse(sale.Items_JSON || '[]');
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

        // Convert to array and sort
        let products = Object.values(productStats);
        products.sort((a, b) => b.qty_sold - a.qty_sold);
        products = products.slice(0, parseInt(limit));

        // Add rank
        products = products.map((p, index) => ({
            rank: index + 1,
            ...p
        }));

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
        const { from, to } = req.query;

        let sales = await sheets.getAllRows(TABS.SALES);
        const inventory = await sheets.getAllRows(TABS.INVENTORY);
        const settingsRows = await sheets.getAllRows(TABS.SETTINGS);

        // Get settings
        const settings = {};
        settingsRows.forEach(s => {
            settings[s.Key] = s.Value;
        });
        const aedRate = parseFloat(settings.aed_exchange_rate) || 36.50;
        const overheadFactor = parseFloat(settings.overhead_factor) || 1.35;

        // Create inventory lookup
        const inventoryMap = {};
        inventory.forEach(item => {
            inventoryMap[item.UUID] = {
                aed_buying_price: parseFloat(item.AED_Buying_Price) || 0,
                selling_price: parseFloat(item.Selling_Price) || 0
            };
        });

        // Filter by date
        const now = new Date();
        const fromDate = from ? new Date(from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const toDate = to ? new Date(to) : now;

        sales = sales.filter(s => {
            const saleDate = new Date(s.Date);
            return saleDate >= fromDate && saleDate <= toDate;
        });

        // Calculate profit
        let totalRevenue = 0;
        let totalProfit = 0;

        sales.forEach(sale => {
            totalRevenue += parseFloat(sale.Total_KES) || 0;

            const items = JSON.parse(sale.Items_JSON || '[]');
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

        // Find loss-making items
        const lossMakingItems = [];
        inventory.forEach(item => {
            const aedCost = parseFloat(item.AED_Buying_Price) || 0;
            const sellingPrice = parseFloat(item.Selling_Price) || 0;
            const landedCost = aedCost * aedRate * overheadFactor;

            if (sellingPrice < landedCost && sellingPrice > 0) {
                lossMakingItems.push({
                    name: item.Name,
                    part_number: item.Part_Number,
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
