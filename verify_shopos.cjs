// Native fetch is available in Node 18+
const BASE_URL = 'http://localhost:5000/api';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin';

// Simple UUID fallback
const uuidv4 = () => 'test-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();


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
        const data = await response.json().catch(() => ({}));
        return { status: response.status, data };
    } catch (error) {
        log(`Request failed: ${method} ${endpoint} - ${error.message}`, 'error');
        return { status: 500, error };
    }
}

async function runTests() {
    console.log('\n--- STARTING RIGOROUS SHOPOS VERIFICATION ---\n');

    // 1. Health Check
    const health = await request('GET', '/health');
    if (health.status === 200) log('Health Check Passed', 'success');
    else log('Health Check Failed', 'error');

    // 2. Auth: Login
    const login = await request('POST', '/auth/login', { username: ADMIN_USER, password: ADMIN_PASS, device_info: 'TestRunner' });
    if (login.status === 200 && login.data.session_id) {
        sessionToken = login.data.session_id;
        log(`Login Successful (Session: ${sessionToken.substring(0, 10)}...)`, 'success');
    } else {
        log('Login Failed - Aborting Tests', 'error');
        process.exit(1);
    }

    // 3. Auth: Verify
    const verify = await request('GET', '/auth/verify');
    if (verify.status === 200 && verify.data.valid) log('Session Verification Passed', 'success');
    else log('Session Verification Failed', 'error');

    // 4. Inventory: Create
    const newItem = {
        part_number: `TEST-${Date.now()}`,
        name: 'Automated Test Widget',
        selling_price: 1500,
        stock_qty: 10,
        min_stock: 2
    };
    const create = await request('POST', '/inventory', newItem);
    if (create.status === 201) {
        testItemId = create.data.uuid;
        log(`Inventory Create Passed (UUID: ${testItemId})`, 'success');
    } else {
        log(`Inventory Create Failed: ${JSON.stringify(create.data)}`, 'error');
    }

    // 5. Inventory: Get All
    const getAll = await request('GET', '/inventory');
    if (getAll.status === 200 && Array.isArray(getAll.data)) {
        const found = getAll.data.find(i => i.uuid === testItemId);
        if (found) log('Inventory Get All (Consistency Check) Passed', 'success');
        else log('Inventory Get All Failed: Created item not found (Consistency Delay?)', 'warn');
    } else {
        log('Inventory Get All Failed', 'error');
    }

    // 6. Inventory: Update Single
    if (testItemId) {
        const update = await request('PUT', `/inventory/${testItemId}`, { selling_price: 2000 });
        if (update.status === 200) log('Inventory Update Passed', 'success');
        else log('Inventory Update Failed', 'error');
    }

    // 7. Inventory: Batch Update
    if (testItemId) {
        const batchUpdate = await request('PUT', '/inventory/batch-update', {
            updates: [{ uuid: testItemId, stock_qty: 50 }]
        });
        if (batchUpdate.status === 200 && batchUpdate.data.success) log('Inventory Batch Update Passed', 'success');
        else log(`Inventory Batch Update Failed: ${JSON.stringify(batchUpdate.data)}`, 'error');
    }

    // 8. Reports: Sales Summary (Object Check)
    const salesReport = await request('GET', '/reports/sales-summary?payment_method=All');
    if (salesReport.status === 200) {
        if (salesReport.data.metrics && Array.isArray(salesReport.data.chart_data)) {
            log('Reports: Sales Summary Structure Valid (Object with metrics/chart_data)', 'success');
        } else if (Array.isArray(salesReport.data)) {
            log('Reports: Sales Summary Returned Array (Old Format - Client May Crash)', 'warn');
        } else {
            log('Reports: Sales Summary Invalid Format', 'error');
        }
    } else {
        log('Reports: Sales Summary Failed', 'error');
    }

    // 9. Reports: Inventory Health (Crash Check)
    const healthReport = await request('GET', '/reports/inventory-health');
    if (healthReport.status === 200 && healthReport.data.summary) {
        log('Reports: Inventory Health Passed', 'success');
    } else {
        log('Reports: Inventory Health Failed', 'error');
    }

    // 10. Inventory: Delete (Cleanup)
    if (testItemId) {
        const del = await request('DELETE', `/inventory/${testItemId}`);
        if (del.status === 200) log('Inventory Delete (Cleanup) Passed', 'success');
        else log('Inventory Delete Failed', 'error');
    }

    console.log('\n--- VERIFICATION COMPLETE ---\n');
}

runTests();
