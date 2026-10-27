const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sampleBorrowers = [
  {
    id: 1,
    name: "Ramesh Patel (Jay Ambe Kirana)",
    phone: "9820123456",
    address: "Market Yard, Shop #12",
    notes: "Daily farsan & snacks supply. Weekly settlement.",
    created_at: "2026-10-01T08:00:00.000Z",
    transactions: [
      { id: 101, borrower_id: 1, type: "borrow", date: "2026-10-27", item: "Samosa & Kachori (80 pcs)", qty: 80, amount: 1600, remarks: "Morning fresh batch", defect_detected: "none", created_at: "2026-10-27T06:30:00Z" },
      { id: 102, borrower_id: 1, type: "received", date: "2026-10-26", item: "", qty: 1, amount: 5000, remarks: "GPay online settlement", defect_detected: "none", created_at: "2026-10-26T14:15:00Z" },
      { id: 103, borrower_id: 1, type: "borrow", date: "2026-10-25", item: "Special Farsan 15kg", qty: 15, amount: 3600, remarks: "Festival weekend stock", defect_detected: "none", created_at: "2026-10-25T10:00:00Z" },
      { id: 104, borrower_id: 1, type: "borrow", date: "2026-10-23", item: "Opening balance", qty: 1, amount: 4300, remarks: "Carried forward balance", defect_detected: "none", created_at: "2026-10-23T09:00:00Z" }
    ]
  },
  {
    id: 2,
    name: "Sunil Sharma (Highway Tea Stall)",
    phone: "9876543210",
    address: "Bypass Octroi Naka",
    notes: "Bakery toast & snacks. Settles on Sundays.",
    created_at: "2026-10-05T09:30:00.000Z",
    transactions: [
      { id: 201, borrower_id: 2, type: "borrow", date: "2026-10-27", item: "Batata Vada (100 pcs)", qty: 100, amount: 1800, remarks: "Breakfast rush order", defect_detected: "in house", created_at: "2026-10-27T07:15:00Z" },
      { id: 202, borrower_id: 2, type: "received", date: "2026-10-25", item: "", qty: 1, amount: 4000, remarks: "Cash payment received", defect_detected: "none", created_at: "2026-10-25T18:00:00Z" },
      { id: 203, borrower_id: 2, type: "borrow", date: "2026-10-24", item: "Cream Rolls & Toast (40 pkts)", qty: 40, amount: 2400, remarks: "Weekly batch", defect_detected: "none", created_at: "2026-10-24T11:00:00Z" },
      { id: 204, borrower_id: 2, type: "borrow", date: "2026-10-20", item: "Opening balance", qty: 1, amount: 4000, remarks: "Opening balance", defect_detected: "none", created_at: "2026-10-20T08:00:00Z" }
    ]
  },
  {
    id: 3,
    name: "Mahesh Kulkarni (Apex Tech Canteen)",
    phone: "9765432109",
    address: "IT Park Phase 2, Tower B Canteen",
    notes: "Corporate event caterer. Monthly billing cycle.",
    created_at: "2026-10-08T11:00:00.000Z",
    transactions: [
      { id: 301, borrower_id: 3, type: "borrow", date: "2026-10-26", item: "Mini Samosa & Dhokla Trays", qty: 25, amount: 4500, remarks: "Evening conference snacks", defect_detected: "QC", created_at: "2026-10-26T16:00:00Z" },
      { id: 302, borrower_id: 3, type: "received", date: "2026-10-24", item: "", qty: 1, amount: 15000, remarks: "Bank NEFT transfer", defect_detected: "none", created_at: "2026-10-24T12:30:00Z" },
      { id: 303, borrower_id: 3, type: "borrow", date: "2026-10-22", item: "Afternoon Snacks Box (150 pkts)", qty: 150, amount: 7500, remarks: "Quarterly townhall", defect_detected: "none", created_at: "2026-10-22T13:00:00Z" },
      { id: 304, borrower_id: 3, type: "borrow", date: "2026-10-15", item: "Opening balance", qty: 1, amount: 10000, remarks: "Opening balance", defect_detected: "none", created_at: "2026-10-15T09:00:00Z" }
    ]
  },
  {
    id: 4,
    name: "Pooja Deshmukh (Shreeji Caterers)",
    phone: "9422011223",
    address: "Station Road, Old Ganpati Galli",
    notes: "Wedding sweets & farsan partner.",
    created_at: "2026-10-10T14:00:00.000Z",
    transactions: [
      { id: 401, borrower_id: 4, type: "received", date: "2026-10-27", item: "", qty: 1, amount: 4000, remarks: "Cash paid by manager", defect_detected: "none", created_at: "2026-10-27T11:00:00Z" },
      { id: 402, borrower_id: 4, type: "borrow", date: "2026-10-25", item: "Mixed Sweets Box (25 boxes)", qty: 25, amount: 6250, remarks: "Engagement party boxes", defect_detected: "none", created_at: "2026-10-25T15:30:00Z" },
      { id: 403, borrower_id: 4, type: "received", date: "2026-10-23", item: "", qty: 1, amount: 10000, remarks: "UPI PhonePe", defect_detected: "none", created_at: "2026-10-23T19:00:00Z" },
      { id: 404, borrower_id: 4, type: "borrow", date: "2026-10-20", item: "Jalebi & Fafda 10kg", qty: 10, amount: 4800, remarks: "Sunday morning rush", defect_detected: "none", created_at: "2026-10-20T07:45:00Z" },
      { id: 405, borrower_id: 4, type: "borrow", date: "2026-10-10", item: "Opening balance", qty: 1, amount: 5450, remarks: "Opening balance", defect_detected: "none", created_at: "2026-10-10T10:00:00Z" }
    ]
  },
  {
    id: 5,
    name: "Ganesh Shinde (College Kiosk)",
    phone: "9324567891",
    address: "University Gate No. 3",
    notes: "Daily hot snacks counter.",
    created_at: "2026-10-15T09:00:00.000Z",
    transactions: [
      { id: 501, borrower_id: 5, type: "received", date: "2026-10-27", item: "", qty: 1, amount: 1200, remarks: "UPI QR payment", defect_detected: "none", created_at: "2026-10-27T13:00:00Z" },
      { id: 502, borrower_id: 5, type: "borrow", date: "2026-10-26", item: "Poha & Upma Platters", qty: 30, amount: 1200, remarks: "Student breakfast supply", defect_detected: "none", created_at: "2026-10-26T08:00:00Z" },
      { id: 503, borrower_id: 5, type: "received", date: "2026-10-22", item: "", qty: 1, amount: 3950, remarks: "UPI payment", defect_detected: "none", created_at: "2026-10-22T17:00:00Z" },
      { id: 504, borrower_id: 5, type: "borrow", date: "2026-10-18", item: "Sandwich Bread & Butter", qty: 20, amount: 4200, remarks: "Bulk supply", defect_detected: "none", created_at: "2026-10-18T10:00:00Z" }
    ]
  }
];

const sampleCashflow = [
  { id: 1, type: "income", amount: 8450, date: "2026-10-27", payment_method: "online", description: "Counter Daily UPI Sales (QR Code)", created_at: "2026-10-27T12:00:00Z" },
  { id: 2, type: "income", amount: 4350, date: "2026-10-27", payment_method: "cash", description: "Counter Cash Snacks Sales", created_at: "2026-10-27T13:30:00Z" },
  { id: 3, type: "expense", amount: 3200, date: "2026-10-27", payment_method: "online", description: "Refined Groundnut Oil (2 x 15L Tins)", created_at: "2026-10-27T10:15:00Z" },
  { id: 4, type: "expense", amount: 850, date: "2026-10-27", payment_method: "cash", description: "Commercial LPG Cylinder Delivery", created_at: "2026-10-27T11:00:00Z" },
  { id: 5, type: "income", amount: 12500, date: "2026-10-26", payment_method: "online", description: "Catering Advance - Rotary Club High Tea", created_at: "2026-10-26T15:00:00Z" },
  { id: 6, type: "expense", amount: 1600, date: "2026-10-26", payment_method: "cash", description: "Fresh Potatoes & Green Chillies Wholesale", created_at: "2026-10-26T08:30:00Z" },
  { id: 7, type: "expense", amount: 2400, date: "2026-10-26", payment_method: "online", description: "Maida, Besan & Spices Grocery Batch", created_at: "2026-10-26T14:00:00Z" },
  { id: 8, type: "income", amount: 7200, date: "2026-10-25", payment_method: "cash", description: "Bulk Diwali Farsan Pre-orders", created_at: "2026-10-25T16:00:00Z" },
  { id: 9, type: "expense", amount: 950, date: "2026-10-25", payment_method: "cash", description: "Food Packaging Boxes & Paper Bags", created_at: "2026-10-25T11:30:00Z" },
  { id: 10, type: "income", amount: 9800, date: "2026-10-24", payment_method: "online", description: "Online Zomato & Swiggy Daily Payout", created_at: "2026-10-24T18:00:00Z" }
];

const publicDir = path.join(__dirname, 'public');

function startMockServer(port) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (req.url === '/api/borrowers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sampleBorrowers));
        return;
      }

      if (req.url === '/api/cashflow') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(sampleCashflow));
        return;
      }

      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(publicDir, reqPath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
          '.html': 'text/html',
          '.css': 'text/css',
          '.js': 'application/javascript',
          '.png': 'image/png',
          '.json': 'application/json'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      resolve(server);
    });
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const PORT = 4567;
  const server = await startMockServer(PORT);
  console.log(`Mock server running at http://127.0.0.1:${PORT}`);

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      `--user-data-dir=${path.join(process.env.TEMP, 'puppeteer_shots_' + Date.now())}`
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2 });

  await page.goto(`http://127.0.0.1:${PORT}`, { waitUntil: 'networkidle0' });
  await sleep(600);

  // 1. Dashboard (Light Theme)
  console.log('Capturing: 01_dashboard_light.png');
  await page.screenshot({ path: path.join(screenshotsDir, '01_dashboard_light.png'), fullPage: false });

  // 2. Borrowers Page
  console.log('Capturing: 02_borrowers_list.png');
  await page.evaluate(() => showPage('borrowers', document.getElementById('nav-btn-borrowers')));
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '02_borrowers_list.png'), fullPage: false });

  // 3. Borrower Profile
  console.log('Capturing: 03_borrower_profile.png');
  await page.evaluate(() => openProfile(1));
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '03_borrower_profile.png'), fullPage: false });

  // 4. Add Borrow Modal open
  console.log('Capturing: 04_modal_add_borrow.png');
  await page.evaluate(() => {
    openModal('borrow-modal');
    document.getElementById('b-item').value = 'Special Farsan 10kg';
    document.getElementById('b-qty').value = '10';
    document.getElementById('b-amt').value = '2400';
    document.getElementById('b-defect').value = 'none';
    document.getElementById('b-rem').value = 'Catering order batch';
  });
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '04_modal_add_borrow.png'), fullPage: false });
  // Close modal
  await page.evaluate(() => closeModal('borrow-modal'));
  await sleep(300);

  // 5. Receive Payment Modal open
  console.log('Capturing: 05_modal_receive_payment.png');
  await page.evaluate(() => {
    openModal('receive-modal');
    document.getElementById('r-amt').value = '3500';
    document.getElementById('r-rem').value = 'UPI GPay Ref #847291';
  });
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '05_modal_receive_payment.png'), fullPage: false });
  await page.evaluate(() => closeModal('receive-modal'));
  await sleep(300);

  // 6. Pending Dues Page
  console.log('Capturing: 06_pending_dues.png');
  await page.evaluate(() => showPage('pending', document.getElementById('nav-btn-pending')));
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '06_pending_dues.png'), fullPage: false });

  // 7. Cashflow Page (Income & Expense)
  console.log('Capturing: 07_cashflow_ledger.png');
  await page.evaluate(() => showPage('cashflow', document.getElementById('nav-btn-cashflow')));
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '07_cashflow_ledger.png'), fullPage: false });

  // 8. Add Income Modal
  console.log('Capturing: 08_modal_add_income.png');
  await page.evaluate(() => {
    openModal('income-modal');
    document.getElementById('in-amt').value = '6500';
    document.getElementById('in-method').value = 'online';
    document.getElementById('in-desc').value = 'Daily Counter UPI Sales Batch #2';
  });
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '08_modal_add_income.png'), fullPage: false });
  await page.evaluate(() => closeModal('income-modal'));
  await sleep(300);

  // 9. Reports Page (Borrower-wise Report)
  console.log('Capturing: 09_reports_analytics.png');
  await page.evaluate(() => {
    showPage('reports', document.getElementById('nav-btn-reports'));
    showReport('borrower');
  });
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '09_reports_analytics.png'), fullPage: false });

  // 10. Dark Mode Dashboard
  console.log('Capturing: 10_dashboard_dark.png');
  await page.evaluate(() => {
    showPage('dashboard', document.getElementById('nav-btn-dashboard'));
    toggleTheme();
  });
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '10_dashboard_dark.png'), fullPage: false });

  // 11. Dark Mode Cashflow
  console.log('Capturing: 11_cashflow_dark.png');
  await page.evaluate(() => showPage('cashflow', document.getElementById('nav-btn-cashflow')));
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '11_cashflow_dark.png'), fullPage: false });

  // 12. Desktop / Tablet Responsive View (Light Mode)
  console.log('Capturing: 12_desktop_responsive.png');
  await page.evaluate(() => {
    toggleTheme(); // back to light
    showPage('dashboard', document.getElementById('nav-btn-dashboard'));
  });
  await page.setViewport({ width: 1280, height: 850, deviceScaleFactor: 2 });
  await sleep(400);
  await page.screenshot({ path: path.join(screenshotsDir, '12_desktop_responsive.png'), fullPage: false });

  await browser.close();
  server.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Error taking screenshots:', err);
  process.exit(1);
});
