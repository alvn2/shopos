require('dotenv').config();
const sheets = require('../services/sheets');

async function test() {
    try {
        const doc = await sheets.testConnection();
        console.log(doc);
        
        if (doc.connected) {
            const users = await sheets.getAllRows('USERS');
            console.log('USERS count:', users.length);
            
            const inventory = await sheets.getAllRows('INVENTORY');
            console.log('INVENTORY count:', inventory.length);
        }
    } catch(e) {
        console.error(e);
    }
}
test();
