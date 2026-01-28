/**
 * Setup script to add initial admin user to Google Sheets
 * Run with: node setup-admin.js
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const sheets = require('./services/sheets');

async function setup() {
    console.log('🔧 Setting up ShopOS database...\n');

    try {
        // Test connection
        const connection = await sheets.testConnection();
        if (!connection.connected) {
            console.error('❌ Could not connect to Google Sheets:', connection.error);
            process.exit(1);
        }
        console.log(`✅ Connected to: ${connection.title}`);
        console.log(`   Tabs: ${connection.sheets.join(', ')}\n`);

        // Check if admin user exists
        const existingAdmin = await sheets.findRow('USERS', { Username: 'admin' });

        if (existingAdmin) {
            console.log('⚠️  Admin user already exists, skipping...');
        } else {
            // Create admin user
            const hashedPassword = await bcrypt.hash('admin', 10);
            await sheets.addRow('USERS', {
                Username: 'admin',
                Password_Hash: hashedPassword,
                Role: 'admin',
                Full_Name: 'Shop Owner',
                Created_At: new Date().toISOString(),
                Last_Login: '',
                Is_Active: 'TRUE'
            });
            console.log('✅ Admin user created (password: admin)');
        }

        // Check if default settings exist
        const existingRate = await sheets.findRow('SETTINGS', { Key: 'aed_rate' });

        if (existingRate) {
            console.log('⚠️  Settings already exist, skipping...');
        } else {
            // Add default settings
            const now = new Date().toISOString();
            await sheets.addRow('SETTINGS', { Key: 'aed_rate', Value: '36.5', Updated_At: now, Updated_By: 'system' });
            await sheets.addRow('SETTINGS', { Key: 'conversion_percent', Value: '13', Updated_At: now, Updated_By: 'system' });
            await sheets.addRow('SETTINGS', { Key: 'default_min_stock', Value: '5', Updated_At: now, Updated_By: 'system' });
            console.log('✅ Default settings created');
        }

        console.log('\n🎉 Setup complete! You can now start the server with: npm run dev');
        console.log('   Login with: admin / admin');

    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
}

setup();
