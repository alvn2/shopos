/**
 * ShopOS - Google Sheets to Neon Postgres Synchronization Script
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Paste this code into Code.gs
 * 4. Refresh your Google Sheet to see the new "ShopOS Sync" menu
 */

// Replace these with your actual shop settings
const SHOP_ID = 'STEPMOTORS'; // Or 'CARWORLD'
const DB_URL = 'jdbc:postgresql://ep-steep-haze-aiichtdy-pooler.c-4.us-east-1.aws.neon.tech:5432/neondb?ssl=true';
const DB_USER = 'neondb_owner';
const DB_PASS = 'npg_3KF8kgOTLCMB';

/**
 * Creates the custom menu in Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ShopOS Sync')
    .addItem('⬇️ Pull Live Stock (From Neon)', 'pullLiveStock')
    .addItem('⬆️ Push Updates (To Neon)', 'pushUpdates')
    .addToUi();
}

/**
 * Connect to the Neon PostgreSQL database
 */
function getDbConnection() {
  try {
    return Jdbc.getConnection(DB_URL, DB_USER, DB_PASS);
  } catch (e) {
    throw new Error('Database connection failed: ' + e.message);
  }
}

/**
 * Pull Live Stock from Neon Postgres and populate the Google Sheet
 */
function pullLiveStock() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('INVENTORY');
  
  if (!sheet) {
    ui.alert('Error', 'Could not find a sheet named "INVENTORY". Please create it.', ui.ButtonSet.OK);
    return;
  }
  
  try {
    const conn = getDbConnection();
    const stmt = conn.createStatement();
    // Query the inventory for the specific shop
    const rs = stmt.executeQuery(`SELECT uuid, part_number, name, make, selling_price, stock_qty, min_stock FROM "InventoryItem" WHERE shop_id = '${SHOP_ID}' ORDER BY name ASC`);
    
    // Read the results
    const data = [];
    while (rs.next()) {
      data.push([
        rs.getString(1), // uuid
        rs.getString(2), // part_number
        rs.getString(3), // name
        rs.getString(4), // make
        rs.getDouble(5), // selling_price
        rs.getInt(6),    // stock_qty
        rs.getInt(7)     // min_stock
      ]);
    }
    
    rs.close();
    stmt.close();
    conn.close();
    
    if (data.length > 0) {
      // Clear existing data (leaving headers on row 1)
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
      }
      
      // Write new data
      sheet.getRange(2, 1, data.length, 7).setValues(data);
      ui.alert('Success', `Successfully pulled ${data.length} items from the live database.`, ui.ButtonSet.OK);
    } else {
      ui.alert('Info', 'No inventory items found for this shop in the database.', ui.ButtonSet.OK);
    }
    
  } catch (e) {
    ui.alert('Sync Failed', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Push Updates from Google Sheet to Neon Postgres
 */
function pushUpdates() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('INVENTORY');
  
  if (!sheet) {
    ui.alert('Error', 'Could not find a sheet named "INVENTORY".', ui.ButtonSet.OK);
    return;
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert('Info', 'No data to push.', ui.ButtonSet.OK);
    return;
  }
  
  const response = ui.alert('Confirm Sync', 'Are you sure you want to push these updates to the live database? This will overwrite the live stock levels with what is currently in this sheet.', ui.ButtonSet.YES_NO);
  
  if (response !== ui.Button.YES) return;
  
  // Get all data
  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  
  let successCount = 0;
  let errorCount = 0;
  
  try {
    const conn = getDbConnection();
    conn.setAutoCommit(false); // Use transaction
    
    // Prepare statement for updating existing items
    const pstmt = conn.prepareStatement(`
      UPDATE "InventoryItem" 
      SET part_number = ?, name = ?, make = ?, selling_price = ?, stock_qty = ?, min_stock = ?, updated_by = 'Google Sheets'
      WHERE uuid = ? AND shop_id = ?
    `);
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const uuid = row[0];
      
      if (!uuid) continue; // Skip empty rows
      
      try {
        pstmt.setString(1, String(row[1])); // part_number
        pstmt.setString(2, String(row[2])); // name
        pstmt.setString(3, String(row[3])); // make
        pstmt.setDouble(4, Number(row[4])); // selling_price
        pstmt.setInt(5, Number(row[5]));    // stock_qty
        pstmt.setInt(6, Number(row[6]));    // min_stock
        pstmt.setString(7, String(uuid));   // uuid
        pstmt.setString(8, SHOP_ID);        // shop_id
        
        pstmt.addBatch();
        successCount++;
      } catch (rowErr) {
        errorCount++;
        Logger.log('Error preparing row ' + (i + 2) + ': ' + rowErr.message);
      }
    }
    
    if (successCount > 0) {
      pstmt.executeBatch();
      conn.commit();
      ui.alert('Success', `Successfully updated ${successCount} items in the database. ${errorCount > 0 ? `(${errorCount} errors skipped)` : ''}`, ui.ButtonSet.OK);
    } else {
      ui.alert('Info', 'No valid rows found to push.', ui.ButtonSet.OK);
    }
    
    pstmt.close();
    conn.close();
    
  } catch (e) {
    ui.alert('Sync Failed', 'An error occurred while pushing to the database: ' + e.message, ui.ButtonSet.OK);
  }
}
