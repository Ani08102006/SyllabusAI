// GOOGLE SHEETS AUTOMATION SCRIPT
// 1. Go to Google Sheets -> Extensions -> Apps Script
// 2. Paste this code
// 3. Click Deploy -> New Deployment -> Select "Web app"
// 4. Set "Who has access" to "Anyone"
// 5. Copy the Web App URL and set it as GOOGLE_SHEETS_WEBHOOK_URL in your .env file

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Add row
    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.userId || '',
      data.fullName || '',
      data.email || '',
      data.searchQuery || '',
      data.detectedSubject || '',
      data.browser || '',
      data.operatingSystem || '',
      data.device || '',
      data.responseTime || '',
      data.page || ''
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
