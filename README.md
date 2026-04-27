# FinanceAgent AI — Premium Personal Finance Advisor

A sophisticated AI-powered personal finance management application that analyzes spending patterns, provides intelligent insights, and delivers actionable financial advice — all running entirely in your browser.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Workflow](#workflow)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [Usage Guide](#usage-guide)
- [Data Privacy & Storage](#data-privacy--storage)
- [Technical Stack](#technical-stack)
- [Troubleshooting](#troubleshooting)
- [Future Enhancements](#future-enhancements)

---

## Overview

**FinanceAgent AI** is a client-side personal finance dashboard that combines statistical analysis, a rule-based insights engine, and AI-powered chat (via **Groq API**) to help users understand and manage their spending. The app uses your spending history, financial profile, and a hidden reference baseline to deliver personalized recommendations — with zero backend or server dependency.

### Key Capabilities
- Import and analyze expense data from **CSV and Excel (.xlsx/.xls)** files
- Get AI-powered financial advice via integrated **Groq-powered** chat (Llama 3.3 70B)
- Track spending patterns against a hidden reference baseline
- Real-time financial health scoring (0–100)
- Category-based expense analysis with automatic categorization
- Interactive dashboard with visual insights, charts, and savings tracking
- Direct-answer engine that resolves many queries without an API call

---

## Key Features

### 1. **Chat Workspace** 💬
- Interactive AI chat assistant powered by **Groq API** (Llama 3.3 70B Versatile)
- Contextual system prompt built from your live spending data, financial profile, and rule-engine findings
- **Direct-answer mode**: resolves common queries (savings rate, top categories, biggest expenses, monthly totals, etc.) instantly without any API call
- Automated insight digest: proactively pushes a spending snapshot when new data arrives
- Quick-action buttons: *Analyze spending*, *Upload CSV*, *Create budget*
- Conversation history persisted in local storage across sessions

### 2. **Expense Analysis** 📊
- **CSV Import**: Upload personal expense files — parser auto-detects delimiter, column mapping, and date formats
- **Excel Import**: Native `.xlsx` / `.xls` support via the SheetJS (XLSX) library
- **Manual Entry**: Add expenses individually via a modal with date, category, vendor, description, and amount
- **Data Preview**: Review parsed rows with confirm/cancel before committing the import
- **Automatic Category Detection**: Keyword-based rules map vendors/descriptions to categories (Food, Transport, Entertainment, Investment, Income, etc.)
- **Transaction Type Inference**: Distinguishes expenses, income, and investments from column values, debit/credit columns, and text patterns
- **Duplicate Detection**: Prevents duplicate entries using a composite key of date + category + amount + transaction type

### 3. **Financial Dashboard** 📈
- **Summary Cards**: Total spent, transaction count, top vendors, major categories
- **Category Donut Chart**: Expense distribution by category
- **Cash Flow Chart**: Monthly spending trend visualization
- **Savings Progress**: Visual gauge of savings goal achievement
- **Investment Allocation**: Breakdown of investment distribution
- **Agent Insights**: AI-generated recommendations rendered on the dashboard
- **Tax Estimate**: Rough quarterly tax liability estimate based on current spend

### 4. **Financial Insights** 🎯
- **Spending Health Score**: Rule-engine-calculated score (0–100) factoring:
  - Profile completeness
  - Alert count and severity
  - Spending mix vs. baseline distribution
  - Budget load (income pressure)
  - Savings goal achievement
- **Smart Alerts** (by severity):
  - **High**: Critical spending issues requiring immediate attention
  - **Medium**: Notable patterns worth monitoring
  - **Low**: Informational insights
  - **Positive**: Good spending behaviors to maintain
- **Category Comparisons**: Your spending share vs. baseline median share per category
- **Insight Rail**: Live sidebar cards on the chat workspace with the top findings

### 5. **Financial Profile** 👤
- Dedicated profile page (`profile.html`) to manage:
  - **Monthly Income**
  - **Current Savings**
  - **Monthly Savings Goal**
  - **Mandatory Monthly Expenses**
- Profile-aware calculations: affordability checks, savings rate, budget load, and savings capacity
- Field-level validation with inline error messages
- Profile values stored in localStorage and automatically reflected across dashboard, insights, and AI context

### 6. **Settings & Data Management** ⚙️
- **Groq API Key Configuration**: Stored locally in the browser — used only for AI chat requests
- **Reset Workspace**: Clear all expenses, conversations, profile data, and cached insights
- **Clear Transactions**: Remove only transaction data without touching profile or API key
- **Privacy First**: All data stays in your browser (`localStorage`); nothing is sent to any server except the Groq chat API

---

## Workflow

### User Journey

```
1. SET UP PROFILE
   └─> Fill in financial profile (income, savings, goals, mandatory expenses)

2. IMPORT EXPENSE DATA
   └─> Upload CSV or Excel file with transaction history
   └─> Review parsed preview before confirming import
   └─> App builds a reference baseline from the bundled dataset

3. ANALYZE & TRACK
   └─> View dashboard with spending trends, charts, and summary cards
   └─> Add new expenses manually via the floating + button
   └─> System compares new spending against baseline and profile

4. GET INSIGHTS
   └─> Dashboard shows health score and severity-ranked alerts
   └─> Insight rail displays live findings on the chat workspace
   └─> Rules engine flags spending anomalies and positive behaviors

5. CHAT WITH AI ADVISOR
   └─> Ask questions about spending — many answered instantly via direct-answer engine
   └─> Complex queries routed to Groq API with full financial context
   └─> Receive context-aware advice with actionable recommendations
```

### Detailed Steps

#### Step 1: Initial Setup
1. Open the app and navigate to **Settings**
2. Enter your **Groq API Key** (required for AI chat — get one from [console.groq.com](https://console.groq.com))
3. Go to **Profile Page** (Settings → Edit Profile) and fill in:
   - Monthly income
   - Current savings
   - Monthly savings goal
   - Mandatory monthly expenses

#### Step 2: Data Import
1. Click **New Analysis** or go to the **Analysis** tab
2. Upload a CSV or Excel file — or use the bundled sample dataset
3. The parser auto-detects columns, delimiters, and date formats
4. Review the data preview, then click **Import** to confirm
5. The app automatically:
   - Parses and validates entries
   - Infers transaction types (expense / income / investment)
   - Auto-categorizes rows using keyword rules
   - Merges new data and deduplicates against existing entries

#### Step 3: Dashboard Monitoring
1. Go to the **Dashboard** tab to see:
   - Summary statistics cards
   - Monthly cash flow trend
   - Category donut breakdown
   - Savings progress gauge
   - Agent insights and investment allocation
2. Add expenses manually using the **+** floating button
3. Each new expense is compared against the baseline and profile in real time

#### Step 4: Insight Generation
1. Navigate to the **Insights** tab
2. View category-level comparisons against the reference baseline
3. Health score updates automatically as data changes
4. Alerts are ranked by severity and displayed with suggested actions

#### Step 5: AI Advisor Chat
1. Click on the **Workspace** (Chat) tab
2. Ask questions like:
   - *"What are my top spending categories?"*
   - *"Am I on track with my savings?"*
   - *"What's my savings rate?"*
   - *"Which category is too high?"*
   - *"What should I focus on improving?"*
3. Many queries are answered instantly; others get a Groq-powered AI response with full context

---

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Groq API key (free — get from [console.groq.com](https://console.groq.com))
- CSV or Excel file with expense data (optional — sample dataset included)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/upendra-devhub/FinanceAgent-AI.git
   cd FinanceAgent-AI
   ```

2. **Open in browser**
   ```bash
   # Simply open index.html directly in your browser
   # Or use a local web server (recommended for module imports)
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

3. **Configure API Key**
   - Open the **Settings** tab
   - Paste your Groq API key (starts with `gsk_`)
   - The key is saved in localStorage and used only for chat requests

### Sample Data
The project includes `data/personal_expense_dataset.csv` — a sample expense dataset so you can explore all features without needing your own data. The app loads this automatically as the reference baseline.

---

## Project Structure

```
FinanceAgent-AI/
├── index.html                          # Main app interface (sidebar + 5 views)
├── profile.html                        # Dedicated financial profile editor
├── styles.css                          # Full application styling
├── GROQ_MIGRATION.md                   # Groq API migration documentation
├── REFACTORING_SUMMARY.md              # Refactoring changelog
│
├── data/
│   └── personal_expense_dataset.csv    # Bundled reference dataset
│
└── js/
    ├── app.js                          # Main app hub: state, routing, events, coordination
    ├── baselineEngine.js               # Builds reference baseline from the bundled dataset
    ├── chatService.js                  # Groq API integration, direct-answer engine, digest builder
    ├── csvParser.js                    # CSV & Excel parsing, column mapping, category detection
    ├── formatters.js                   # Currency, number, and percentage formatting utilities
    ├── profileManager.js               # Profile validation & financial field management
    ├── profilePage.js                  # Profile page interactions (profile.html)
    ├── rulesEngine.js                  # Insight generation, health scoring, alert rules
    ├── stats.js                        # Statistical calculations (quantiles, IQR, outliers)
    ├── storage.js                      # localStorage management (CRUD for all data)
    ├── uiRenderer.js                   # Dynamic UI rendering (cards, charts, modals, lists)
    └── userStats.js                    # User metrics computation (categories, trends, comparisons)
```

---

## Core Modules

### **app.js** — Application Hub
- Central state management (`manualExpenses`, `datasetRecords`, `conversation`, `baseline`, `userStats`, `comparisonInsights`)
- View routing via sidebar navigation (Chat, Analysis, Dashboard, Insights, Settings) with hash-based URL support
- Coordinates the full data pipeline: parse → baseline → user stats → comparison insights → render
- Modal management: Add Expense modal, Reset Data modal, Clear Transactions modal
- File import orchestration with preview, confirm, and cancel workflow
- Quick-action buttons that pre-fill chat prompts
- Automatic insight publishing on data changes

### **baselineEngine.js** — Reference Baseline Builder
- Processes the bundled historical expense dataset
- Calculates spending distributions by category and month
- Creates statistical profiles (mean, median, quartiles, standard deviation)
- Builds vendor and category frequency maps
- Provides reference data for the comparison algorithms in `rulesEngine.js`

### **chatService.js** — AI Integration & Direct Answers
- **Groq API** integration (`https://api.groq.com/openai/v1/chat/completions`)
- Uses the `llama-3.3-70b-versatile` model (configurable)
- `buildGroqSystemInstruction()` — constructs a detailed system prompt with the user's full financial context
- `tryAnswerDirect()` — pattern-matched direct-answer engine resolving ~15 query types without API calls (savings rate, category spend, monthly totals, budget load, etc.)
- `buildAutomatedInsightDigest()` — generates proactive spending snapshots
- Conversation format conversion between internal `{role, parts}` and OpenAI-compatible `{role, content}`
- Backward-compatible `requestGeminiResponse()` wrapper (delegates to Groq)

### **csvParser.js** — Data Import Engine
- **Multi-format support**: CSV (auto-detected delimiters: `,`, `;`, `\t`, `|`) and Excel via SheetJS
- **Flexible column mapping**: keyword-based header detection for date, amount, category, vendor, description, payment mode, debit, credit, and transaction type
- **Auto-categorization**: keyword rules map vendors/descriptions to categories (Food, Transport, Shopping, Health, Entertainment, Investment, Income, etc.)
- **Transaction type inference**: distinguishes expenses, income, and investments from debit/credit columns, column values, and text patterns
- **Robust date parsing**: supports ISO, `MM/DD/YYYY`, `DD/MM/YYYY`, month names, and ambiguous formats
- **Signed currency handling**: parses negative amounts, parenthesized values, and debit/credit text markers

### **rulesEngine.js** — Intelligence & Scoring
- Generates spending alerts at four severity levels (high, medium, low, positive)
- Calculates financial health score (0–100) with five weighted factors
- Compares user spending against the baseline distribution per category
- Flags categories running above or below the reference median
- Creates actionable recommendations with suggested next steps
- Builds category comparison data for the Insights view

### **stats.js** — Statistical Analysis
- Quantile and percentile computation (with interpolation)
- Standard deviation and interquartile range (IQR)
- Outlier detection using statistical fences
- Monthly and weekly grouping utilities
- Data distribution summaries

### **storage.js** — Data Persistence
- Manages all `localStorage` reads and writes
- Stores/retrieves: expenses, conversations, profile fields, API key, insight signatures, and uploaded datasets
- JSON serialization with error-safe parsing
- Full workspace reset via `clearAllStoredData()`

### **uiRenderer.js** — Visual Rendering
- Renders all UI components dynamically: summary cards, charts, expense lists, modals, chat bubbles
- Data-driven visualizations (donut chart, cash flow bars, savings gauge)
- Import preview with row count and confirm/cancel buttons
- Chat history rendering with role-based styling
- Loading state management

### **userStats.js** — User Metrics
- Aggregates user expenses into category breakdowns, monthly trends, and vendor rankings
- Computes financial comparisons: budget load, savings rate, savings capacity, and target savings rate
- Integrates profile data (income, savings, goal, mandatory expenses) into calculations
- Tracks metadata: record count, date ranges, and current calendar period

### **profileManager.js** — Profile Management
- Validates financial profile inputs with field-level error messages
- Ensures all required numeric fields are completed
- Reads profile from localStorage via `storage.js`
- Returns normalized profile values for use in stats and chat context

### **formatters.js** — Formatting Utilities
- `formatCurrency()` — INR currency formatting with locale support
- `formatNumber()` — locale-aware number formatting
- `formatPercent()` — percentage formatting with configurable precision

---

## Usage Guide

### Adding an Expense
1. Click the floating **+** button (bottom-right) or the **+** icon in the chat input
2. Fill in the modal:
   - **Date**: When the expense occurred
   - **Category**: Select from auto-populated categories
   - **Vendor**: Where you spent (e.g., D-Mart, Swiggy, Uber)
   - **Description**: Optional note
   - **Amount**: Expense amount
3. Click **Save** — the expense is added instantly and all views update

### Importing Expense History
1. Go to the **Analysis** tab
2. Click **Browse Files** or drag a CSV/Excel file onto the upload zone
3. Review the preview of parsed transactions
4. Click **Import** to confirm, or **Cancel** to discard
5. The app:
   - Auto-detects columns and date formats
   - Infers transaction types (expense / income / investment)
   - Deduplicates against existing data
   - Updates all dashboards and insights

### Supported File Formats
| Format | Extensions | Notes |
|--------|-----------|-------|
| CSV | `.csv` | Auto-detects delimiter (`,`, `;`, `\t`, `\|`) |
| Excel | `.xlsx`, `.xls` | First sheet is parsed via SheetJS |

### Expected Columns (flexible naming)
```
Date, Category, Amount, Vendor, Description
2024-01-15, Food, 45.50, Grocery Store, Weekly shopping
2024-01-16, Transport, 12.00, Taxi, Ride to office
```

The parser also supports: separate **Debit**/**Credit** columns, **Payment Mode**, **Transaction Type**, and **Month** columns.

### Asking Questions in Chat
Examples of effective queries:
- *"What are my top 3 spending categories?"*
- *"How much did I spend on food?"*
- *"Am I on track with my savings?"*
- *"What's my savings rate?"*
- *"Which category is too high?"*
- *"What are my biggest expenses?"*
- *"What should I focus on improving?"*
- *"Do my expenses exceed income?"*

Many of these are resolved instantly via the direct-answer engine. Complex or open-ended queries are routed to the Groq AI.

### Understanding Health Score
| Range | Band | Meaning |
|-------|------|---------|
| 80–100 | Strong | Excellent spending discipline |
| 60–79 | Stable | Good overall financial health |
| 40–59 | Watchlist | Some areas need attention |
| 0–39 | At Risk | Significant spending concerns |

**Health score factors:**
- ✅ Complete financial profile
- ✅ Few/no high-severity alerts
- ✅ Balanced expense distribution vs. baseline
- ✅ Savings goal achievement
- ✅ Budget load within income limits

### Resetting Data
- **Reset All Data** (Settings → Reset Workspace): Clears everything — profile, API key, transactions, chat history, and cached insights
- **Clear Transactions** (Analysis tab): Removes only expenses while preserving profile and API key

---

## Data Privacy & Storage

- **No Server**: All data stored locally in browser (`localStorage`)
- **No Tracking**: No analytics, cookies, or user tracking
- **API Key**: Stored locally; sent only to Groq's API endpoint for chat requests
- **Offline-Ready**: The app works without internet after initial load (except AI chat)
- **No Data Leaves Your Browser**: The only external request is the Groq chat API call

---

## Technical Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6 Modules) |
| **AI Integration** | Groq API — Llama 3.3 70B Versatile |
| **Excel Parsing** | SheetJS (XLSX) via CDN |
| **Icons** | Google Material Symbols |
| **Typography** | Google Fonts (Manrope) |
| **Storage** | Browser localStorage |
| **Architecture** | Modular vanilla JS — no frameworks, no build step |

---

## API Requirements

### Groq API
The chat feature requires a Groq API key:

1. Visit [console.groq.com](https://console.groq.com)
2. Sign up for a free account
3. Navigate to **API Keys** section
4. Create a new key (starts with `gsk_`)
5. Paste the key into Settings → Groq API Key

**Model**: `llama-3.3-70b-versatile` (configurable in `chatService.js`)  
**Parameters**: `max_tokens: 1024`, `temperature: 0.7`  
**Rate Limits**: Check your Groq dashboard for current quotas

---

## Browser Compatibility

- ✅ Chrome / Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

**Requires:**
- ES6+ Module support (`<script type="module">`)
- localStorage API
- Fetch API

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chat not working | Verify Groq API key in Settings is correct (starts with `gsk_`) |
| "Groq API request failed" | Check internet connection and Groq service status |
| "Groq returned an empty response" | Try a simpler query or check rate limits |
| Data not saving | Ensure browser localStorage is enabled and not full |
| CSV import fails | Verify the file has at least a header row + one data row with Date and Amount columns |
| Excel import fails | Ensure the page loaded the SheetJS library (check browser console) |
| Profile changes not reflecting | The app auto-reads profile on focus; try switching tabs |
| Health score not updating | Add or import expenses, and complete your financial profile |

---

## Future Enhancements

- Budget planning and forecasting
- Recurring expense detection
- Multi-currency support
- Transaction export / download
- Custom category creation
- Spending forecasts with ML
- Mobile-responsive layout improvements
- Cloud sync across devices
- Receipt image OCR
- Bill reminders

---

## License

[Add your license information here]

---

## Version

**Current Version**: 2.0.0  
**Last Updated**: April 2026  
**AI Provider**: Groq (migrated from Google Gemini)

---

**Happy budgeting! Let FinanceAgent AI help you achieve your financial goals.** 🎯💰
