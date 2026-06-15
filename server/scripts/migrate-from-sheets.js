require('dotenv').config();
process.env.DATABASE_URL = process.env.DIRECT_URL;
const sheets = require('../services/sheets');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SHOP_ID = 'STEPMOTORS';

async function migrate() {
    console.log('🚀 Starting Data Migration from Google Sheets to Postgres...\n');

    try {
        const doc = await sheets.testConnection();
        if (!doc.connected) {
            console.error('❌ Could not connect to Google Sheets:', doc.error);
            process.exit(1);
        }
        console.log(`✅ Connected to Google Sheets: ${doc.title}`);

        // 1. MIGRATE USERS
        console.log('\nMigrating USERS...');
        const users = await sheets.getAllRows('USERS');
        for (const u of users) {
            if (!u.Username) continue;
            let role = 'worker';
            if (u.Role && ['admin', 'counter', 'worker'].includes(u.Role.toLowerCase())) {
                role = u.Role.toLowerCase();
            }
            
            await prisma.user.upsert({
                where: { shop_id_username: { shop_id: SHOP_ID, username: u.Username } },
                update: {},
                create: {
                    shop_id: SHOP_ID,
                    username: u.Username,
                    password_hash: u.Password_Hash,
                    role: role,
                    full_name: u.Full_Name || u.Username,
                    created_at: new Date(u.Created_At || Date.now()),
                    is_active: u.Is_Active === 'TRUE'
                }
            });
        }
        console.log(`✅ Migrated ${users.length} users.`);

        // 2. MIGRATE INVENTORY
        console.log('\nMigrating INVENTORY...');
        const inventory = await sheets.getAllRows('INVENTORY');
        for (const item of inventory) {
            if (!item.Part_Number) continue;
            await prisma.inventoryItem.upsert({
                where: { shop_id_part_number: { shop_id: SHOP_ID, part_number: item.Part_Number } },
                update: {
                    name: item.Name,
                    make: item.Make || 'Unknown',
                    selling_price: parseFloat(item.Selling_Price) || 0,
                    stock_qty: parseInt(item.Stock_Qty, 10) || 0,
                    min_stock: parseInt(item.Min_Stock, 10) || 0,
                    updated_by: item.Updated_By || 'system'
                },
                create: {
                    uuid: item.UUID,
                    shop_id: SHOP_ID,
                    part_number: item.Part_Number,
                    name: item.Name,
                    tags: item.Tags || '',
                    make: item.Make || 'Unknown',
                    aed_buying_price: parseFloat(item.AED_Buying_Price) || 0,
                    ksh_buying_price: parseFloat(item.KSH_Buying_Price) || 0,
                    selling_price: parseFloat(item.Selling_Price) || 0,
                    stock_qty: parseInt(item.Stock_Qty, 10) || 0,
                    min_stock: parseInt(item.Min_Stock, 10) || 0,
                    last_updated: new Date(item.Last_Updated || Date.now()),
                    updated_by: item.Updated_By || 'system'
                }
            });
        }
        console.log(`✅ Migrated ${inventory.length} inventory items.`);

        // 3. MIGRATE CUSTOMERS
        try {
            console.log('\nMigrating CUSTOMERS...');
            const customers = await sheets.getAllRows('CUSTOMERS');
            for (const c of customers) {
                if (!c.UUID) continue;
                // Ensure customer phone exists
                if (!c.Phone) c.Phone = 'Unknown-' + c.UUID;
                
                await prisma.customer.upsert({
                    where: { shop_id_phone: { shop_id: SHOP_ID, phone: c.Phone } },
                    update: {},
                    create: {
                        uuid: c.UUID,
                        shop_id: SHOP_ID,
                        name: c.Name || 'Unknown',
                        phone: c.Phone,
                        email: c.Email || '',
                        notes: c.Notes || '',
                        total_purchases: parseFloat(c.Total_Purchases) || 0,
                        total_credit: parseFloat(c.Total_Credit) || 0,
                        created_at: new Date(c.Created_At || Date.now()),
                        created_by: c.Created_By || (await prisma.user.findFirst({ where: { shop_id: SHOP_ID } })).uuid
                    }
                });
            }
            console.log(`✅ Migrated ${customers.length} customers.`);
        } catch(e) {
            console.log('⚠️ Customers tab missing or failed:', e.message);
        }

        // 4. MIGRATE SALES
        console.log('\nMigrating SALES...');
        const sales = await sheets.getAllRows('SALES');
        // Group sales by Batch_ID if needed, but since Sale model is one row per receipt
        for (const s of sales) {
            if (!s.UUID) continue;
            let user = await prisma.user.findFirst({ where: { shop_id: SHOP_ID, username: s.Sold_By } });
            if (!user) user = await prisma.user.findFirst({ where: { shop_id: SHOP_ID } });

            await prisma.sale.upsert({
                where: { uuid: s.UUID },
                update: {},
                create: {
                    uuid: s.UUID,
                    shop_id: SHOP_ID,
                    batch_id: s.Batch_ID || s.UUID,
                    items_json: s.Items_JSON || '[]',
                    total_kes: parseFloat(s.Total_KES) || 0,
                    payment_method: s.Payment_Method || 'Cash',
                    customer_name: s.Customer_Name || '',
                    sold_by: user.uuid,
                    date: new Date(s.Date || Date.now()),
                    notes: ''
                }
            });
        }
        console.log(`✅ Migrated ${sales.length} sales.`);

        // 5. MIGRATE SETTINGS
        console.log('\nMigrating SETTINGS...');
        const settings = await sheets.getAllRows('SETTINGS');
        const settingsMap = {};
        for(const s of settings) {
            settingsMap[s.Key] = parseFloat(s.Value) || 0;
        }
        await prisma.settings.upsert({
            where: { shop_id: SHOP_ID },
            update: {
                aed_rate: settingsMap['aed_rate'] || 36.5,
                conversion_percent: settingsMap['conversion_percent'] || 13.0,
                default_min_stock: parseInt(settingsMap['default_min_stock'], 10) || 5,
            },
            create: {
                shop_id: SHOP_ID,
                aed_rate: settingsMap['aed_rate'] || 36.5,
                conversion_percent: settingsMap['conversion_percent'] || 13.0,
                default_min_stock: parseInt(settingsMap['default_min_stock'], 10) || 5,
            }
        });
        console.log(`✅ Migrated settings.`);

        console.log('\n🎉 Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
