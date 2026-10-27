# 🍪 Shivkrupa Snacks — Ledger & Cashbook App

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web%20PWA-green.svg?style=for-the-badge)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers%20%7C%20Express-orange.svg?style=for-the-badge)
![Database](https://img.shields.io/badge/database-Neon%20Serverless%20PostgreSQL-3b82f6.svg?style=for-the-badge)
![License](https://img.shields.io/badge/license-ISC-lightgrey.svg?style=for-the-badge)

<p align="center">
  <b>A modern, lightning-fast digital ledger (उधारी वही) and daily cashflow manager (रोकड वही) custom-crafted for retail counters, snack shops, and wholesale distribution businesses.</b>
</p>

[🌐 Live Web Demo](https://shivkrupa-snacks.firwithrj.workers.dev) • [📱 Download Android APK](shivkrupa-snacks.apk) • [📸 View Screenshots](#-app-showcase--demo) • [⚡ Quick Start](#-quick-start)

---

</div>

## 📌 Overview

**Shivkrupa Snacks Ledger** is an end-to-end financial tracking application that bridges the gap between daily counter sales and customer credit tracking. Built to replace cumbersome physical logbooks, it provides instant visibility into customer receivables, daily income and expenditures, payment recovery status, and quality defect tracking.

The application operates as both a **progressive web application (PWA)** and a **native Android app** powered by Capacitor, featuring full **offline-first local caching** and background synchronization.

---

## 📸 App Showcase & Demo

### 1. 📊 Dashboard & Analytics

The real-time dashboard offers instant visibility into key financial indicators, net market debt, income vs. expense cash balance, customizable date filters, and recent transaction activities.

| ☀️ Dashboard (Light Mode) | 🌙 Dashboard (Dark Mode) |
| :---: | :---: |
| <img src="screenshots/01_dashboard_light.png" alt="Dashboard Light Mode" width="380"/> | <img src="screenshots/10_dashboard_dark.png" alt="Dashboard Dark Mode" width="380"/> |

---

### 2. 👥 Borrower Management & Customer Profiles

Search customers in milliseconds by name, phone number, or borrowed product. Tap into any customer profile to view their detailed timeline, net outstanding balance, and 1-tap call or WhatsApp contact shortcuts.

| 📇 Customer Directory | 👤 Customer Profile & Ledger |
| :---: | :---: |
| <img src="screenshots/02_borrowers_list.png" alt="Borrowers Directory" width="380"/> | <img src="screenshots/03_borrower_profile.png" alt="Borrower Profile" width="380"/> |

---

### 3. ✍️ Transaction Recording & Defect Detection

Easily record newly borrowed stock or received payments. Features built-in **Defect Stage Tracking** (`In House`, `QC`, `Assembly`) to identify food preparation or packaging issues before settling accounts.

| ➕ Record Borrow / Credit Goods | 💰 Record Payment Received |
| :---: | :---: |
| <img src="screenshots/04_modal_add_borrow.png" alt="Add Borrow Modal" width="380"/> | <img src="screenshots/05_modal_receive_payment.png" alt="Receive Payment Modal" width="380"/> |

---

### 4. 💸 Daily Cashflow & Business Khata

Log and monitor every rupee entering and leaving your shop. Track Cash vs. Online (UPI, QR, GPay, PhonePe) transactions with dedicated filters and real-time net profit calculation.

| 💵 Cashflow Ledger (Light) | 🌃 Cashflow Ledger (Dark) |
| :---: | :---: |
| <img src="screenshots/07_cashflow_ledger.png" alt="Cashflow Ledger" width="380"/> | <img src="screenshots/11_cashflow_dark.png" alt="Cashflow Dark" width="380"/> |

| 🟢 Fast Inflow Entry | 🔴 Overdue Pending Collections |
| :---: | :---: |
| <img src="screenshots/08_modal_add_income.png" alt="Add Income Modal" width="380"/> | <img src="screenshots/06_pending_dues.png" alt="Pending Dues List" width="380"/> |

---

### 5. 📑 Business Reports & Large Screen POS

Generate detailed summaries (Daily, Monthly, Borrower-wise, and Outstanding Dues) and export directly to **Excel (.xlsx)** or **PDF** with a single click. The UI seamlessly adapts to tablets, laptops, and desktop POS counters.

| 📈 Detailed Reports & PDF/Excel Export | 💻 Desktop & Tablet POS View |
| :---: | :---: |
| <img src="screenshots/09_reports_analytics.png" alt="Reports and Export" width="380"/> | <img src="screenshots/12_desktop_responsive.png" alt="Desktop POS View" width="500"/> |

---

## ✨ Key Features

- **📒 Customer Credit Book (उधारी वही)**: Maintain clean running balances for every vendor, tea stall, canteen, and regular customer.
- **📞 1-Tap WhatsApp & Calling**: Contact debtors directly with automated balance reminder templates via WhatsApp or telephone call.
- **🔍 Multi-Parameter Instant Search**: Search records across names, phone numbers, or specific inventory items (e.g. Samosa, Farsan, Batata Vada).
- **⚠️ Defect Detection Tracking**: Tag transactions with defect detection stages (`In House`, `QC`, `Assembly`) to prevent disputes and monitor product quality.
- **💰 Complete Cashflow Ledger**: Separate daily store sales from credit collections, monitoring cash in hand vs. digital UPI accounts.
- **⏳ Prioritized Pending Dues**: Dedicated view highlighting all borrowers who have outstanding balances to expedite recovery.
- **📤 Export to Excel & PDF**: Generate printable PDF summaries or raw Excel sheets for accountant reconciliation.
- **🌓 Adaptive Dark & Light Themes**: Seamless toggle with persistent state saved in user preferences.
- **⚡ Offline-First Architecture**: Changes are saved instantly to local cache and synchronized automatically with the database once the internet connection returns.
- **📱 Native Mobile Experience**: Packaged with Capacitor 8 into an installable Android APK (`shivkrupa-snacks.apk`).

---

## 🏗️ Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────┐
│                   Client Layer                         │
│  - Vanilla HTML5 / Modern CSS3 (Variables & Neumorphic)│
│  - Tabler Icons Webfont & Google Outfit / Sans Fonts   │
│  - Offline Cache & Conflict-Free Queue (LocalStorage)  │
│  - Native Android Wrapper (Capacitor 8)                │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP / JSON API
                           ▼
┌────────────────────────────────────────────────────────┐
│                   Server / API Layer                   │
│  Option A: Cloudflare Workers (Hono framework)         │
│  Option B: Node.js Express Server (Local/Production)   │
└──────────────────────────┬─────────────────────────────┘
                           │ Connection Pool / SQL
                           ▼
┌────────────────────────────────────────────────────────┐
│                  Database Storage                      │
│  - Neon Serverless PostgreSQL                          │
│  - Optimized Indexes (borrowers, transactions, dates)  │
│  - Aggregated JSON Subqueries                          │
└────────────────────────────────────────────────────────┘
```

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Vanilla JavaScript (ES6+), HTML5, CSS3, Tabler Icons, Outfit Font |
| **Mobile Runtime** | Capacitor 8 (`@capacitor/android`, `@capacitor/cli`, `@capacitor/core`) |
| **Cloud Edge Backend** | Cloudflare Workers, Hono Framework (`hono/cors`) |
| **Traditional Backend** | Node.js, Express 5, `pg`, `cors`, `dotenv` |
| **Database** | Neon Serverless PostgreSQL (`@neondatabase/serverless`) |
| **Automation & Tooling** | Puppeteer Core (Automated HD Screenshot Suite), Wrangler CLI |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)
- PostgreSQL database (or free [Neon PostgreSQL](https://neon.tech))

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/borrow-tracking-app.git
cd "Borrow Tracking App"
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (refer to `.env.example`):
```env
PORT=3000
DATABASE_URL="postgresql://username:password@your-neon-host.neon.tech/neondb?sslmode=require"
```

### 3. Initialize Database Schema
Run the schema setup script or apply `schema.sql` directly to your database:
```bash
node migrate.js
```
*Or execute `schema.sql` using `psql` or the Neon SQL Editor.*

### 4. Run Locally
```bash
npm start
```
Visit `http://localhost:3000` in your browser.

---

## ☁️ Cloudflare Workers Deployment

To run and deploy the edge API on Cloudflare Workers:

```bash
# Test locally on Wrangler edge runtime
npx wrangler dev

# Deploy to Cloudflare edge network
npx wrangler deploy
```

Configuration is defined in [wrangler.toml](wrangler.toml):
```toml
name = "shivkrupa-snacks"
main = "worker.js"
compatibility_date = "2025-01-01"

[assets]
directory = "./public"
```

---

## 📱 Android App Build (Capacitor)

The repository includes a ready-to-install Android APK: `shivkrupa-snacks.apk`.

To build or modify the native Android package:
```bash
# Sync web assets to native Android project
npx cap sync android

# Open project in Android Studio
npx cap open android
```
From Android Studio, choose **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## 📸 Regenerating Screenshots

This project includes an automated headless browser script powered by Puppeteer Core that takes high-resolution screenshots of all views:

```bash
npm run screenshots
```
Generated images will be saved directly into the `screenshots/` directory.

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/borrowers` | Fetch all borrowers with aggregated transactions |
| `POST` | `/api/borrowers` | Create a new borrower (supports opening balance) |
| `GET` | `/api/borrowers/:id` | Fetch single borrower details and full history |
| `DELETE` | `/api/borrowers/:id` | Remove a borrower and cascade delete transactions |
| `POST` | `/api/transactions` | Add a new credit borrow or payment received |
| `DELETE` | `/api/transactions/:id` | Delete a specific transaction |
| `GET` | `/api/cashflow` | Fetch all daily income and expense records |
| `POST` | `/api/cashflow` | Record a new income or expense entry |
| `DELETE` | `/api/cashflow/:id` | Remove a cashflow entry |

---

## 📂 Project Structure

```
Borrow Tracking App/
├── android/                   # Capacitor native Android Gradle project
├── public/                    # Web frontend assets
│   ├── css/
│   │   └── style.css          # Design system, themes & animations
│   ├── js/
│   │   └── app.js             # Client logic, offline queue & DOM rendering
│   └── index.html             # Single-page application markup
├── screenshots/               # High-resolution screenshots for README
│   ├── 01_dashboard_light.png
│   ├── 02_borrowers_list.png
│   ├── 03_borrower_profile.png
│   ├── 04_modal_add_borrow.png
│   ├── 05_modal_receive_payment.png
│   ├── 06_pending_dues.png
│   ├── 07_cashflow_ledger.png
│   ├── 08_modal_add_income.png
│   ├── 09_reports_analytics.png
│   ├── 10_dashboard_dark.png
│   ├── 11_cashflow_dark.png
│   └── 12_desktop_responsive.png
├── capacitor.config.json      # Capacitor configuration
├── db.js                      # Neon serverless database client
├── migrate.js                 # Database migration runner
├── package.json               # Dependencies & scripts
├── schema.sql                 # PostgreSQL schema definition
├── server.js                  # Express.js REST server
├── shivkrupa-snacks.apk       # Compiled Android APK
├── take_screenshots.js        # Automated Puppeteer screenshot generator
├── worker.js                  # Cloudflare Workers Hono serverless backend
└── wrangler.toml              # Cloudflare Workers deployment config
```

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).

<div align="center">
  <b>Shivkrupa Snacks</b> — Making business khata and borrow tracking effortless.
</div>
