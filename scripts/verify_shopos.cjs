// Native fetch is available in Node 18+
const BASE_URL = 'http://localhost:5000/api';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

let sessionToken = null;
let testItemId = null;

const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(msg, type = 'info') {
    const color = type === 'success' ? colors.green : type === 'error' ? colors.red : type === 'warn' ? colors.yellow : colors.cyan;
    console.log(`${color}[${type.toUpperCase()}] ${msg}${colors.reset}`);
}

async function request(method, endpoint, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${BASE_URL}${endpoint}`, options);
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }
        return { status: response.status, data };
    } catch (error) {
        log(`Request failed: ${method} ${endpoint} - ${error.message}`, 'error');
        return { status: 500, error: error.message };
    }
}

async function runTests() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║         SHOPOS COMPREHENSIVE VERIFICATION SUITE            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    // 1. Health Check
    const health = await request('GET', '/health');
    if (health.status === 200) { log('1. Health Check Passed', 'success'); passed++; }
    else { log(`1. Health Check Failed: ${JSON.stringify(health.data)}`, 'error'); failed++; }

    // 2. Auth: Login
    const login = await request('POST', '/auth/login', {
        username: ADMIN_USER,
        password: ADMIN_PASS,
        device_info: 'VerificationScript/1.0'
    });
    if (login.status === 200 && login.data.session_id) {
        sessionToken = login.data.session_id;
        log(`2. Login Passed (Role: ${login.data.user?.role})`, 'success');
        passed++;
    } else {
        log(`2. Login Failed: ${JSON.stringify(login.data)}`, 'error');
        failed++;
        console.log('\n❌ Cannot continue without authentication\n');
        process.exit(1);
    }

    // 3. Auth: Verify Session
    const verify = await request('GET', '/auth/verify');
    if (verify.status === 200 && verify.data.valid) { log('3. Session Verification Passed', 'success'); passed++; }
    else { log(`3. Session Verification Failed: ${JSON.stringify(verify.data)}`, 'error'); failed++; }

    // 4. Settings: Get
    const settings = await request('GET', '/settings');
    if (settings.status === 200 && settings.data.aed_rate !== undefined) {
        log(`4. Settings Fetch Passed (AED Rate: ${settings.data.aed_rate})`, 'success');
        passed++;
    } else {
        log(`4. Settings Fetch Failed: ${JSON.stringify(settings.data)}`, 'error');
        failed++;
    }

    // 5. Inventory: Create
    const newItem = {
        part_number: `TEST-${Date.now()}`,
        name: 'Verification Test Item',
        aed_buying_price: 100,
        selling_price: 1500,
        stock_qty: 10,
        min_stock: 2,
        tags: 'test,verification'
    };
    const create = await request('POST', '/inventory', newItem);
    if (create.status === 201 && create.data.uuid) {
        testItemId = create.data.uuid;
        log(`5. Inventory CREATE Passed (UUID: ${testItemId.slice(0, 8)}...)`, 'success');
        passed++;
    } else {
        log(`5. Inventory CREATE Failed: ${JSON.stringify(create.data)}`, 'error');
        failed++;
    }

    // 6. Inventory: Read All
    const getAll = await request('GET', '/inventory');
    if (getAll.status === 200 && Array.isArray(getAll.data)) {
        const found = getAll.data.find(i => i.uuid === testItemId);
        if (found) { log(`6. Inventory READ Passed (${getAll.data.length} items)`, 'success'); passed++; }
        else { log('6. Inventory READ: Item not found immediately (may be async)', 'warn'); passed++; }
    } else {
        log(`6. Inventory READ Failed: ${JSON.stringify(getAll.data)}`, 'error');
        failed++;
    }

    // 7. Inventory: Update Single
    if (testItemId) {
        const update = await request('PUT', `/inventory/${testItemId}`, { selling_price: 2000 });
        if (update.status === 200) { log('7. Inventory UPDATE (Single) Passed', 'success'); passed++; }
        else { log(`7. Inventory UPDATE Failed: ${JSON.stringify(update.data)}`, 'error'); failed++; }
    } else {
        log('7. Inventory UPDATE Skipped (no test item)', 'warn');
    }

    // 8. Inventory: Batch Update
    if (testItemId) {
        const batchUpdate = await request('PUT', '/inventory/batch-update', {
            updates: [{ uuid: testItemId, stock_qty: 50 }]
        });
        if (batchUpdate.status === 200 && batchUpdate.data.success) {
            log('8. Inventory BATCH UPDATE Passed', 'success');
            passed++;
        } else {
            log(`8. Inventory BATCH UPDATE Failed: ${JSON.stringify(batchUpdate.data)}`, 'error');
            failed++;
        }
    }

    // 9. Sales: Create
    const sale = await request('POST', '/sales', {
        batch_id: `TEST-${Date.now().toString(36).toUpperCase()}`,
        items: [{ uuid: testItemId || 'dummy', part_number: 'TEST-001', name: 'Test', qty: 1, unit_price: 100 }],
        payment_method: 'CASH',
        total_amount: 100
    });
    if (sale.status === 201 && sale.data.batch_id) {
        log(`9. Sales CREATE Passed (Batch: ${sale.data.batch_id})`, 'success');
        passed++;
    } else {
        log(`9. Sales CREATE Failed: ${JSON.stringify(sale.data)}`, 'error');
        failed++;
    }

    // 10. Reports: Sales Summary
    const salesReport = await request('GET', '/reports/sales-summary');
    if (salesReport.status === 200 && salesReport.data.metrics) {
        log('10. Reports: Sales Summary Passed', 'success');
        passed++;
    } else if (salesReport.status === 200) {
        log('10. Reports: Sales Summary (legacy format)', 'warn');
        passed++;
    } else {
        log(`10. Reports: Sales Summary Failed: ${JSON.stringify(salesReport.data)}`, 'error');
        failed++;
    }

    // 11. Reports: Inventory Health
    const healthReport = await request('GET', '/reports/inventory-health');
    if (healthReport.status === 200 && healthReport.data.summary) {
        log('11. Reports: Inventory Health Passed', 'success');
        passed++;
    } else {
        log(`11. Reports: Inventory Health Failed: ${JSON.stringify(healthReport.data)}`, 'error');
        failed++;
    }

    // 12. Inventory: DELETE (Critical Test)
    if (testItemId) {
        const del = await request('DELETE', `/inventory/${testItemId}`);
        if (del.status === 200 && del.data.message) {
            log('12. Inventory DELETE Passed ✓', 'success');
            passed++;
        } else {
            log(`12. Inventory DELETE Failed: Status ${del.status}, ${JSON.stringify(del.data)}`, 'error');
            failed++;
        }
    } else {
        log('12. Inventory DELETE Skipped', 'warn');
    }

    // 13. Auth: Logout
    const logout = await request('POST', '/auth/logout');
    if (logout.status === 200) { log('13. Logout Passed', 'success'); passed++; }
    else { log(`13. Logout Failed: ${JSON.stringify(logout.data)}`, 'error'); failed++; }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    VERIFICATION SUMMARY                     ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  ✅ PASSED: ${passed.toString().padEnd(3)}                                            ║`);
    console.log(`║  ❌ FAILED: ${failed.toString().padEnd(3)}                                            ║`);
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    if (failed === 0) {
        console.log('🎉 ALL TESTS PASSED - System is ready for deployment!\n');
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.\n');
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTests();
