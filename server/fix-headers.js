require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

async function fixHeaders() {
    try {
        console.log('Connecting to Google Sheets...');
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        console.log(`Connected to: ${doc.title}`);

        const tabs = ['INVENTORY', 'SALES', 'USERS', 'SESSIONS', 'SETTINGS', 'AUDIT_LOG'];

        for (const tabName of tabs) {
            const sheet = doc.sheetsByTitle[tabName];
            if (!sheet) {
                console.log(`Sheet ${tabName} not found, skipping.`);
                continue;
            }

            console.log(`Checking sheet: ${tabName}`);

            // Load cells of the first row (Header)
            // We use standard A1:Z1 range assumption
            await sheet.loadCells('A1:Z1');

            const headers = [];
            let duplicateFound = false;

            for (let i = 0; i < 26; i++) { // Check up to Z
                const cell = sheet.getCell(0, i);
                const value = cell.value;

                if (!value) break; // Stop at empty cell

                const valueStr = String(value);

                if (headers.includes(valueStr)) {
                    console.log(`[${tabName}] Found DUPLICATE header: "${valueStr}" at column index ${i}`);
                    const newHeader = `${valueStr}_Dup_${i}`;
                    console.log(`--> Renaming to: "${newHeader}"`);
                    cell.value = newHeader;
                    duplicateFound = true;
                } else {
                    headers.push(valueStr);
                }
            }

            if (duplicateFound) {
                console.log(`Saving fixes for ${tabName}...`);
                await sheet.saveUpdatedCells();
                console.log(`Fixed ${tabName}.\n`);
            } else {
                console.log(`No duplicates in ${tabName}.\n`);
            }
        }

        console.log('Done!');
    } catch (error) {
        console.error('Error:', error);
    }
}

fixHeaders();
