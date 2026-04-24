# App Scripts

This folder contains Google Apps Script files that should be added at [script.google.com](https://script.google.com). Each `.gs` file corresponds to a separate Apps Script project tied to a Google Sheet.

## ImageUpload.gs

This script receives ticket data from the Ticket Extractor app and writes it to a Google Sheet.

### Setup

1. Open [script.google.com](https://script.google.com) and create a new project (or open the script editor from your target Google Sheet).
2. Copy the contents of `ImageUpload.gs` into the editor.
3. Save the project.

### Deploying as a Web App

The script must be deployed as a **Web app** so the Ticket Extractor can send data to it.

1. Click **Deploy > New deployment** in the Apps Script editor.
2. Under **Select type**, choose **Web app**.
3. Configure the deployment:
   - **Description** — can be anything.
   - **Execute as** — your account (default).
   - **Who has access** — must be set to **Anyone**.
4. Click **Deploy**.
5. Copy the resulting URL.

### Connecting to the Ticket Extractor

Paste the deployed URL into the **Apps Script URL** field under **Sync Settings** in the Ticket Extractor's Scan tab. Once saved, the app will show a "Connected to Sheet" status and ticket data will sync automatically.
