function doPost(e) {
  try {
    // 1. Target your specific tab
    var sheetName = "FinalOrders"; // <- Change this to your tab name (e.g., "Tickets")
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
    
    // 2. Parse the rows sent by the app
    var rows = JSON.parse(e.postData.contents);
    
    // 3. Append them directly
    rows.forEach(function(row) {
      sheet.appendRow(row);
    });
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message).setMimeType(ContentService.MimeType.TEXT);
  }
}