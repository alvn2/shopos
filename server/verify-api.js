const fetch = require('node-fetch');

async function test() {
    try {
        console.log('1. Logging in...');
        const loginRes = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin', device_info: 'test_script' })
        });

        if (!loginRes.ok) {
            console.error('Login failed:', loginRes.status);
            return;
        }

        const data = await loginRes.json();
        const sessionId = data.session_id; // Using sessionId from response
        const user = data.user;
        console.log('Login Success. Session ID:', sessionId);

        console.log('2. Fetching Inventory (Authorization: Bearer)...');
        const invRes = await fetch('http://localhost:5000/api/inventory', {
            headers: {
                'Authorization': `Bearer ${sessionId}`,
                'x-session-id': sessionId // Send both just in case, but testing Bearer mainly
            }
        });

        if (!invRes.ok) {
            const err = await invRes.text();
            console.error('Inventory Fetch Failed:', invRes.status, err);
            return;
        }

        const inventory = await invRes.json();
        console.log(`Inventory Fetched! Items: ${inventory.length}`);

        if (inventory.length > 0) {
            console.log('Sample Item:', inventory[0].Name);
        }

    } catch (e) {
        console.error('Test Error:', e);
    }
}

test();
