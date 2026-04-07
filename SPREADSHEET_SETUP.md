# ShopOS - Google Sheets Database Setup Guide

This guide will help you set up the Google Sheets database for ShopOS.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Name: `ShopOS` → Click "Create"
4. Wait for project to be created

## Step 2: Enable Google Sheets API

1. In the left sidebar, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click on it → Click "Enable"

## Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "+ Create Credentials" → "Service Account"
3. Fill in:
   - Service account name: `shopos-backend`
   - Service account ID: (auto-filled)
   - Description: `Backend access to ShopOS database`
4. Click "Create and Continue"
5. Skip the role and access steps (click "Done")
6. Click on the new service account email
7. Go to "Keys" tab → "Add Key" → "Create new key"
8. Select "JSON" → "Create"
9. **Save the downloaded JSON file securely!**

## Step 4: Create the Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Rename it to: `ShopOS_DB`
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```

## Step 5: Share with Service Account

1. Open the downloaded JSON key file
2. Copy the `client_email` value (looks like: `shopos-backend@your-project.iam.gserviceaccount.com`)
3. In your Google Sheet, click "Share"
4. Paste the service account email
5. Give it "Editor" access
6. Click "Send" (uncheck "Notify people" if prompted)

## Step 6: Create the Tabs

Create 6 tabs (sheets) with these exact names and columns:

> **Note:** Two additional tabs (`CUSTOMERS` and `CUSTOMER_LEDGER`) will be auto-created by the backend on first use. You don't need to create them manually.

### Tab 1: INVENTORY
| Column | Header |
|--------|--------|
| A | UUID |
| B | Part_Number |
| C | Name |
| D | Tags |
| E | AED_Buying_Price |
| F | Selling_Price |
| G | Stock_Qty |
| H | Min_Stock |
| I | Last_Updated |
| J | Updated_By |

### Tab 2: SALES
| Column | Header |
|--------|--------|
| A | Date |
| B | Batch_ID |
| C | Items_JSON |
| D | Total_KES |
| E | Payment_Method |
| F | Customer_Name |
| G | Notes |
| H | Sold_By |

### Tab 3: AUDIT_LOG
| Column | Header |
|--------|--------|
| A | Timestamp |
| B | User |
| C | Action |
| D | Entity_Type |
| E | Entity_ID |
| F | Old_Value |
| G | New_Value |
| H | IP_Address |
| I | Device_Info |

### Tab 4: USERS
| Column | Header |
|--------|--------|
| A | Username |
| B | Password_Hash |
| C | Role |
| D | Full_Name |
| E | Created_At |
| F | Last_Login |
| G | Is_Active |

### Tab 5: SESSIONS
| Column | Header |
|--------|--------|
| A | Session_ID |
| B | Username |
| C | Device_Info |
| D | IP_Address |
| E | Created_At |
| F | Last_Active |
| G | Expires_At |

### Tab 6: SETTINGS
| Column | Header |
|--------|--------|
| A | Key |
| B | Value |
| C | Updated_At |
| D | Updated_By |

## Step 7: Add Initial Data

### Add Admin User to USERS tab:

To generate a password hash, run this in Node.js:
```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('your-password', 10).then(console.log);
```

Then add a row:
| Username | Password_Hash | Role | Full_Name | Created_At | Last_Login | Is_Active |
|----------|---------------|------|-----------|------------|------------|-----------|
| admin | (paste hash) | admin | Shop Owner | 2026-01-28T00:00:00Z | | TRUE |

### Add Default Settings to SETTINGS tab:

| Key | Value | Updated_At | Updated_By |
|-----|-------|------------|------------|
| aed_exchange_rate | 36.50 | 2026-01-28T00:00:00Z | admin |
| overhead_factor | 1.35 | 2026-01-28T00:00:00Z | admin |
| default_min_stock | 5 | 2026-01-28T00:00:00Z | admin |

### Add Sample Inventory (Optional):

| UUID | Part_Number | Name | Tags | AED_Buying_Price | Selling_Price | Stock_Qty | Min_Stock | Last_Updated | Updated_By |
|------|-------------|------|------|------------------|---------------|-----------|-----------|--------------|------------|
| 550e8400-e29b-41d4-a716-446655440000 | 90915-YZZD2 | Oil Filter 1KD | Service,LC79 | 45 | 1500 | 12 | 5 | 2026-01-28T00:00:00Z | admin |

## Step 8: Configure Environment Variables

1. Copy `server/.env.example` to `server/.env`
2. Fill in:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`: The `client_email` from JSON key
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: The `private_key` from JSON key (keep the quotes and \n)
   - `SHEET_ID`: Your spreadsheet ID from Step 4

## Step 9: Test the Connection

```bash
cd server
npm install
npm run dev
```

Check the console output - it should show:
```
✅ Google Sheets connected: "ShopOS_DB"
   Available tabs: INVENTORY, SALES, AUDIT_LOG, USERS, SESSIONS, SETTINGS
```

## Troubleshooting

### "Sheet not found" error
- Make sure tab names match exactly (case-sensitive)
- Ensure the sheet is shared with the service account

### "Authentication failed" error
- Check that the private key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Make sure `\n` in the private key are preserved

### "Permission denied" error
- Verify the service account has Editor access to the sheet
- Check the service account email is correct
