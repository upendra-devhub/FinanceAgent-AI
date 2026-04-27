# FinanceAgent AI - Premium Personal Finance Advisor

A sophisticated AI-powered personal finance management application that analyzes spending patterns, provides intelligent insights, and offers actionable financial advice.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Workflow](#workflow)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Core Modules](#core-modules)
- [Usage Guide](#usage-guide)

---

## Overview

**FinanceAgent AI** is a web-based personal finance dashboard that combines data analysis, rule-based insights, and AI-powered chat to help users understand and manage their spending. The app uses your spending history and financial profile to deliver personalized recommendations.

### Key Capabilities
- Upload and analyze expense data (CSV format)
- Get AI-powered financial advice via integrated chat
- Track spending patterns against your baseline
- Real-time financial health scoring
- Category-based expense analysis
- Interactive dashboards with visual insights

---

## Key Features

### 1. **Chat Workspace** 💬
- Interactive AI-powered chat assistant powered by Gemini API
- Contextual responses based on your spending data and financial profile
- Direct answer mode for simple queries (savings rate, top categories, etc.)
- Automated insight digest for quick financial updates
- Conversation history saved to local storage

### 2. **Expense Analysis** 📊
- **CSV Import**: Upload personal or bundled expense datasets
- **Manual Entry**: Add expenses individually with date, category, vendor, and amount
- **Data Preview**: Review imported data before confirmation
- **Category Mapping**: Automatically categorizes expenses (Food, Transport, Entertainment, etc.)
- **Duplicate Detection**: Prevents duplicate entries in your dataset

### 3. **Financial Dashboard** 📈
- **User Statistics Cards**: Summary of total spent, transaction count, top vendors, and major categories
- **Category Breakdown**: Donut chart showing expense distribution by category
- **Monthly Trends**: Line chart tracking spending patterns over time
- **Savings Progress**: Visual indicator of savings goal achievement
- **Investment Allocation**: Breakdown of investment distribution (if applicable)
- **Insights Summary**: AI-generated recommendations on the dashboard

### 4. **Financial Insights** 🎯
- **Spending Health Score**: AI-calculated health score (0-100) based on:
  - Profile completeness
  - Alert severity
  - Spending mix vs. baseline
  - Budget load (income pressure)
  - Savings goal achievement
- **Smart Alerts**: 
  - **High Severity**: Critical spending issues requiring attention
  - **Medium Severity**: Notable patterns worth monitoring
  - **Low Severity**: Informational insights
  - **Positive**: Good spending behaviors to maintain
- **Comparative Analysis**: Your spending vs. your baseline spending pattern
- **Category Performance**: How each expense category compares to your typical distribution

### 5. **Financial Profile** 👤
- Store and manage personal financial details:
  - **Monthly Income**: Your regular monthly earnings
  - **Current Savings**: Total savings available
  - **Savings Goal**: Target amount to save
  - **Mandatory Expenses**: Fixed monthly obligations
- Profile-aware calculations for affordability and savings checks
- Validation ensures all critical fields are completed

### 6. **Settings & Data Management** ⚙️
- **API Key Configuration**: Securely store your Gemini API key
- **Data Reset**: Clear all expenses and conversation history
- **Data Export**: Access your stored data locally
- **Privacy First**: All data stored locally in browser (localStorage)

---

## Workflow

### User Journey Overview

```
1. SET UP PROFILE
   └─> Fill in financial profile (income, savings, goals, mandatory expenses)

2. IMPORT EXPENSE DATA
   └─> Upload CSV file with historical expenses
   └─> Review preview before confirming import
   └─> App builds baseline spending pattern from dataset

3. ANALYZE & TRACK
   └─> View dashboard with spending trends
   └─> Add new manual expenses as they occur
   └─> System compares new spending against baseline

4. GET INSIGHTS
   └─> Dashboard shows health score and alerts
   └─> Insights rail displays key findings
   └─> Rules engine flags spending anomalies

5. CHAT WITH AI ADVISOR
   └─> Ask questions about spending
   └─> Receive context-aware advice based on your data
   └─> Get recommendations for improvement
```

### Detailed Workflow Process

#### Step 1: Initial Setup
1. Open the app and navigate to **Settings**
2. Enter your **Gemini API Key** (required for AI chat)
3. Go to **Profile Page** and fill in:
   - Monthly income
   - Current savings total
   - Savings goal
   - Mandatory monthly expenses

#### Step 2: Data Import & Baseline Creation
1. Click **New Analysis** or go to **Analysis Tab**
2. Upload a CSV file with historical expenses or use the bundled sample dataset
3. Review the data preview
4. Click **Import** to process the data
5. System automatically:
   - Parses the CSV and validates entries
   - Creates reference baseline (monthly patterns, category distribution)
   - Calculates statistical distributions (mean, median, standard deviation)

#### Step 3: Dashboard Monitoring
1. Go to **Dashboard Tab** to see:
   - Your spending statistics
   - Monthly trend visualization
   - Category breakdown
   - Savings progress
   - Financial health score
2. Add new expenses manually using the **+** button
3. Each new expense is compared against the baseline

#### Step 4: Insight Generation
1. Navigate to **Insights Tab**
2. View your financial health score and breakdown
3. See alerts categorized by severity:
   - What spending patterns are unusual
   - Savings goal status
   - Budget load analysis
   - Profile-specific recommendations

#### Step 5: AI Advisor Chat
1. Click on **Workspace** (Chat) tab
2. Ask questions like:
   - "What are my top spending categories?"
   - "Am I on track with my savings?"
   - "Why did my food spending increase?"
   - "What should I do to improve my health score?"
3. AI responds with context-aware advice

---

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Gemini API key (get from [Google AI Studio](https://aistudio.google.com))
- CSV file with expense data (optional, sample provided)

### Installation

1. **Clone or download the project**
   ```bash
   git clone <repository-url>
   cd FinanceAgent-AI
   ```

2. **Open in browser**
   ```bash
   # Simply open index.html in your web browser
   # Or use a local web server (recommended)
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

3. **Configure API Key**
   - Open Settings tab
   - Enter your Gemini API key
   - Key is stored securely in browser localStorage

### Sample Data
The project includes `data/personal_expense_dataset.csv` with sample expense data to explore the app's features without needing your own dataset.

---

## Project Structure

```
FinanceAgent-AI/
├── index.html                          # Main app interface
├── profile.html                        # Financial profile editor
├── styles.css                          # Application styling
│
├── data/
│   └── personal_expense_dataset.csv   # Sample expense data
│
└── js/
    ├── app.js                          # Main app logic & state management
    ├── baselineEngine.js               # Builds reference baseline from historical data
    ├── chatService.js                  # AI chat integration (Gemini API)
    ├── csvParser.js                    # CSV parsing & validation
    ├── formatters.js                   # Data formatting utilities
    ├── profileManager.js               # Profile validation & management
    ├── profilePage.js                  # Profile page interactions
    ├── rulesEngine.js                  # Insight generation & scoring
    ├── stats.js                        # Statistical calculations
    ├── storage.js                      # LocalStorage management
    ├── uiRenderer.js                   # Dynamic UI rendering
    └── userStats.js                    # User statistics computation
```

---

## Core Modules

### **app.js** - Application Hub
- Central state management
- View routing (Chat, Analysis, Dashboard, Insights, Settings)
- Event handling for all user interactions
- Coordinates data flow between modules
- Manages modals and user interface updates

### **baselineEngine.js** - Reference Data Builder
- Processes historical expense data
- Calculates spending distributions by category and month
- Creates statistical profiles (mean, median, quartiles, standard deviation)
- Builds vendor and category frequency maps
- Provides reference data for comparison algorithms

### **chatService.js** - AI Integration
- Integrates with Google Gemini API
- Generates system instructions based on user context
- Builds automated insight digests
- Answers direct questions about spending without API calls
- Maintains conversation context for multi-turn dialogue
- Error handling for API failures

### **csvParser.js** - Data Import
- Parses CSV files with flexible column mapping
- Validates expense entries
- Handles bundled dataset parsing
- Supports manual expense row parsing
- Detects and handles data format variations

### **profileManager.js** - Profile Management
- Validates financial profile inputs
- Ensures all required fields are completed
- Provides field-level error messages
- Calculates profile completeness status
- Normalizes numeric values

### **rulesEngine.js** - Intelligence & Scoring
- Generates spending alerts (high, medium, low severity)
- Identifies positive spending behaviors
- Calculates financial health score (0-100)
- Compares user spending against baseline
- Determines category spending anomalies
- Creates actionable recommendations

### **stats.js** - Statistical Analysis
- Computes quantiles and percentiles
- Calculates standard deviation and IQR
- Identifies outliers using statistical fences
- Processes monthly and weekly groupings
- Summarizes data distributions

### **storage.js** - Data Persistence
- Manages localStorage operations
- Stores/retrieves expenses, conversations, profiles
- Handles API key storage securely
- Saves and loads conversation history
- Prevents data loss on browser refresh

### **uiRenderer.js** - Visual Rendering
- Renders all UI components dynamically
- Creates charts and visualizations
- Formats and displays data tables
- Updates loading states
- Manages modal content and status messages

### **userStats.js** - User Metrics
- Aggregates user expense statistics
- Calculates category breakdown
- Computes spending comparisons against baseline
- Determines savings rate and budget load
- Tracks transaction metadata

---

## Usage Guide

### Adding an Expense
1. Click **+ New Analysis** button or floating **+ button**
2. Fill in expense details:
   - **Date**: When the expense occurred
   - **Category**: Type of expense
   - **Vendor**: Where you spent (optional)
   - **Description**: Details about the expense (optional)
   - **Amount**: Expense amount
3. Click **Save Expense**
4. Expense appears in your list and updates all visualizations

### Importing Expense History
1. Go to **Analysis** tab
2. Click **Upload File** or drag CSV file to the upload zone
3. Review the preview of parsed data
4. Click **Import** to process
5. App automatically:
   - Creates baseline from historical data
   - Calculates patterns and distributions
   - Enables comparative analysis

### CSV Format
Expected columns (flexible naming):
```
Date, Category, Amount, Vendor, Description
2024-01-15, Food, 45.50, Grocery Store, Weekly shopping
2024-01-16, Transport, 12.00, Taxi, Ride to office
```

### Asking Questions in Chat
Examples of effective queries:
- "What are my top 3 spending categories?"
- "How much did I spend on food this month?"
- "Am I on track with my savings goal?"
- "Why is my health score low?"
- "Which vendors do I spend the most at?"
- "What should I cut back on?"

### Understanding Health Score
- **80-100 (Strong)**: Excellent spending discipline
- **60-79 (Stable)**: Good overall financial health
- **40-59 (Watchlist)**: Some areas need attention
- **0-39 (At Risk)**: Significant spending concerns

Health score factors:
- ✅ Complete financial profile
- ✅ Few/no high-severity alerts
- ✅ Balanced expense distribution
- ✅ Savings goal achievement
- ✅ Budget load (not over-spending relative to income)

### Resetting Data
1. Go to **Settings**
2. Click **Clear All Data** button
3. Confirm the action (this cannot be undone)
4. All expenses, conversations, and profile data are deleted

---

## Data Privacy & Storage

- **No Server**: All data stored locally in browser (`localStorage`)
- **No Tracking**: No analytics or user tracking
- **API Key**: Stored locally; never sent elsewhere except to Gemini API
- **Offline Ready**: Works without internet after initial load (except chat)

---

## Browser Compatibility

- ✅ Chrome/Chromium (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

Requires:
- ES6+ JavaScript support
- localStorage API
- Fetch API
- Canvas API (for charts)

---

## API Requirements

### Gemini API
The chat feature requires a Google Gemini API key:

1. Visit [Google AI Studio](https://aistudio.google.com)
2. Create a new API key
3. Copy the key to Settings > API Key input
4. Key is stored locally and used only for chat requests

**Rate Limiting**: Gemini API has usage limits. Check your quota on the Google AI Studio dashboard.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chat not working | Verify API key in Settings is correct and valid |
| Data not saving | Check browser localStorage is enabled |
| Charts not loading | Ensure Chart.js is loaded (check browser console) |
| CSV import fails | Verify CSV has required columns: Date, Amount, Category |
| Profile changes not applying | Refresh the page after updating profile |

---

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Components**: Material Symbols Icons
- **Data Visualization**: Chart.js (implied by references)
- **AI Integration**: Google Gemini API
- **Storage**: Browser localStorage
- **Fonts**: Google Fonts (Manrope)

---

## Future Enhancements

- Budget planning and forecasting
- Recurring expense detection
- Multi-currency support
- Transaction export/download
- Custom category creation
- Spending forecasts with ML
- Mobile app version
- Cloud sync across devices
- Receipt image OCR
- Bill reminders

---

## Support

For issues or feature requests, please check your browser console for error messages and verify:
1. API key is valid
2. CSV format matches expected structure
3. Browser localStorage is not full
4. JavaScript is enabled

---

## License

[Add your license information here]

---

## Version

**Current Version**: 1.0.0  
**Last Updated**: 2026

---

**Happy budgeting! Let FinanceAgent AI help you achieve your financial goals.** 🎯💰
