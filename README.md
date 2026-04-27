# FinanceAgent AI

FinanceAgent AI is a browser-based personal finance advisor that combines expense tracking, month-aware analysis, rolling baseline learning, and AI-generated financial guidance.

This README is written to serve two purposes:

- explain the current app workflow accurately
- act as a clean source document for reports, case studies, and PPT creation

## Product Summary

The app helps a user:

- upload or log expenses month by month
- maintain a financial profile with income, savings, and mandatory expenses
- compare current spending against a learned 12-month pattern
- view dashboard, analysis, and insights for any selected month
- chat with an AI assistant that understands the active month and the learned baseline

The app is now explicitly month-aware. Closed months remain viewable for comparison, while the learning system keeps adapting from the latest 12 months instead of depending on one static dataset.

## Current App Workflow

### 1. Seed the baseline

The project ships with 12 monthly CSV files inside:

- `data/training_csvs/manifest.csv`
- `data/training_csvs/*.csv`

These files are the initial learning source. They are not treated as permanent truth. They only bootstrap the first rolling baseline.

### 2. Normalize to a common income base

All learning data is normalized to a base monthly income of `Rs. 100000`.

Why this exists:

- users can have different incomes
- raw spending values are not directly comparable across people or across time
- normalization lets the app learn spending proportions first, then scale the pattern back to the active user's income

Example:

- if a month has income `Rs. 50000` and spend `Rs. 37000`
- it is stored in normalized learning form as if that month belonged to `Rs. 100000`
- when the app needs to advise a user with a different income, the learned pattern is scaled to that user

### 3. User logs expenses month by month

Every expense record includes month context:

- `date`
- `category`
- `amount`
- `month`
- `year`

This applies to both:

- manual expense entries
- CSV imports

The app does not assume the month. It derives month and year from the expense date.

### 4. User selects an active month

The active month and year are stored in local storage and drive all month-specific views.

The month selector currently lives in the Analysis view. That selected month affects:

- Analysis
- Dashboard
- Insights
- chatbot context

### 5. Month completion updates the learning window

When the user marks a month as complete:

- that month's expenses are archived
- the month becomes read-only for viewing and comparison
- the completed month is normalized and added into the learning window
- the oldest learning month is dropped if the window already contains 12 months

This means the active learning set always behaves like a rolling 12-month window.

### 6. Advice is generated from the rolling baseline

The app rebuilds the baseline from the latest 12 learning months and uses it to:

- compare category spending
- generate warnings and positive signals
- explain above-pattern or below-pattern behavior
- provide context to the AI assistant

Over time, the user's own completed months gradually replace the original seed CSVs.

## Month-Aware Behavior

The current logic fixes the earlier month-mixing problem.

### Active month rules

All month-specific analysis uses only the selected month context.

### Closed month rules

When a month is closed:

- its expenses are removed from the live active-entry pool
- its archived copy remains available for Dashboard, Analysis, and Insights
- the app can still show that month's transactions and comparisons later

This is why a closed month should still behave like March did in your earlier testing: it stays viewable instead of turning blank.

### Empty and closed states

The UI distinguishes between:

- no expenses logged for a month
- a month that is closed but archived
- a new active month with no transactions yet

## Rolling 12-Month Learning System

### Learning objective

The app learns a category-wise spending pattern from the latest 12 months only.

### Source priority over time

At the beginning:

- the app uses the 12 provided seed CSV months

As the user continues using the product:

- newly completed user months are added
- old seed months or old user months roll off
- the latest 12 months become the dominant basis for recommendations

### What the system does not do

The app does not:

- hardcode category limits
- permanently depend on the old sample dataset
- treat the seed CSVs as universal truth

The app does:

- learn from recent behavior
- normalize that behavior
- scale the comparison to the current user income

## AI and Insights Logic

### AI provider

The current app uses the Groq chat API.

Settings and copy should be understood in that context. Older Gemini references are legacy only and are no longer the live path used by the app.

### What the chatbot receives

The AI system prompt is built from:

- active month and year
- financial profile
- month-specific expense snapshot
- learned 12-month rolling baseline
- rules and alerts derived from the latest analysis

The prompt explicitly carries month context so the AI does not confuse one month with another.

### What the rules engine evaluates

The insights layer compares the selected month's spending against the rolling learned pattern and explains whether the user is:

- above pattern
- below pattern
- close to pattern

This comparison is done category by category and is scaled to the user's income.

## Storage Model

The app is local-first and stores state in browser `localStorage`.

Important keys:

- `fin_activeMonth`
- `fin_activeYear`
- `fin_expenses`
- `fin_learningMonths`
- `fin_completedMonths`
- `fin_chat`
- `fin_profile`
- `fin_apiKey`

### Current logical structure

```js
{
  activeMonth: "April",
  activeYear: 2026,
  expenses: [
    { date, category, amount, month, year, vendor, description, transactionType }
  ],
  completedMonths: {
    "April-2026": [/* archived expenses for that month */]
  },
  learningMonths: [
    {
      monthKey: "2026-04",
      source: "seed" | "user",
      incomeBasis: 50000,
      normalizedIncome: 100000,
      normalizedRecords: [/* normalized monthly records */]
    }
  ]
}
```

### Clear All Data behavior

When the user clears all browser data:

- local storage is reset
- user expenses, profile state, chat state, and learned user months are removed
- the app reloads the initial 12 seed months from `data/training_csvs`

This works because the CSVs live inside the project, not only in browser storage.

## Key Screens and Their Roles

### Workspace

- conversational finance assistant
- quick actions such as analysis and CSV upload
- month-aware chat context
- live insight cards

### Analysis

- CSV import and transaction review
- month and year selector for active context
- manual expense management
- month completion control
- archived month comparison

### Dashboard

- current or selected month financial overview
- category distribution
- spending summary
- savings and affordability indicators

### Insights

- rule-based alerts
- baseline comparisons
- health-oriented recommendations

### Settings

- Groq API key
- local data reset
- persistent configuration

### Profile

- income
- savings
- savings goals
- mandatory monthly expenses

The profile is important because the learned baseline is scaled to the user's income before comparison.

## Technical Workflow

### Baseline creation flow

1. Load seed months from `data/training_csvs/manifest.csv`
2. Parse each monthly CSV
3. Convert each learning month to normalized `Rs. 100000` form
4. Save those months into `fin_learningMonths`
5. Build the active baseline from the latest 12 learning months
6. Scale baseline expectations to the user's income when generating advice

### User month completion flow

1. User logs or imports expenses for a selected month
2. User marks the month complete
3. The app archives that month into `fin_completedMonths`
4. The completed month is converted into normalized learning format
5. That month is merged into the rolling 12-month learning window
6. The oldest learning month is dropped if needed
7. The baseline is rebuilt
8. Future insights use the updated 12-month window

### Closed month viewing flow

1. User selects a month
2. If the month is open, analysis uses live expenses
3. If the month is closed, analysis reads the archived copy from `fin_completedMonths`
4. Dashboard and Insights still show that month's data instead of showing an empty state

## Current Project Structure

```text
f1/
  index.html
  profile.html
  styles.css
  README.md
  GROQ_MIGRATION.md
  REFACTORING_SUMMARY.md
  data/
    training_csvs/
      manifest.csv
      2026-01_balanced_expenses.csv
      2026-02_frugal_expenses.csv
      2026-03_overspending_expenses.csv
      2026-04_balanced_expenses.csv
      2026-05_balanced_expenses.csv
      2026-06_overspending_expenses.csv
      2026-07_frugal_expenses.csv
      2026-08_balanced_expenses.csv
      2026-09_overspending_expenses.csv
      2026-10_balanced_expenses.csv
      2026-11_frugal_expenses.csv
      2026-12_overspending_expenses.csv
  js/
    app.js
    baselineEngine.js
    chatService.js
    csvParser.js
    formatters.js
    monthlyManager.js
    profileManager.js
    profilePage.js
    rulesEngine.js
    stats.js
    storage.js
    uiRenderer.js
    userStats.js
```

## Module Responsibilities

### `js/app.js`

- central app controller
- bootstraps seed learning data
- manages active month state
- rebuilds baseline
- coordinates views, chat, import, completion, and rendering

### `js/baselineEngine.js`

- normalization to `Rs. 100000`
- learning month creation
- rolling 12-month merge logic
- baseline generation scaled to target income

### `js/storage.js`

- local storage persistence
- active month save and restore
- live expenses
- archived completed months
- rolling learning months

### `js/chatService.js`

- Groq prompt construction
- month-aware AI context
- conversation formatting and request handling

### `js/rulesEngine.js`

- spending comparisons against the learned baseline
- alert generation
- advice framing for above, below, or near-pattern behavior

### `js/csvParser.js`

- CSV parsing
- field normalization
- date-driven month/year extraction

### `js/uiRenderer.js`

- dashboard cards
- insights UI
- closed month and empty states
- transaction and analysis rendering

### `js/userStats.js`

- month-specific aggregates
- category summaries
- transaction counts and spending totals

## Setup and Run

### Requirements

- modern browser
- local web server recommended
- Groq API key for full AI chat responses

### Run locally

```bash
python -m http.server 3000
```

Then open:

- `http://127.0.0.1:3000/index.html`

## How to Demonstrate the App

For a live demo, this sequence is the clearest:

1. Open Settings and enter a Groq API key
2. Fill the financial profile with income, savings, goal, and mandatory expenses
3. Go to Analysis and confirm the active month
4. Upload a CSV or add manual expenses for that month
5. Show Dashboard and Insights for the selected month
6. Mark the month complete
7. Switch back to that month and show that archived analysis still renders
8. Explain that the completed month was added into the rolling 12-month learning window

## Report and PPT Notes

If you are turning this project into a report or presentation, the most important story is:

### Problem solved

The original risk was month mixing and stale baseline logic. Different months could affect each other, and advice could be inconsistent.

### Current solution

The app now uses:

- explicit month/year state
- archived closed months for comparison
- a rolling 12-month learning window
- income normalization to a shared baseline
- AI prompts that include active month context

### Business value

- advice becomes time-aware
- insights become more personalized over time
- old data does not pollute the current month
- users can still compare with prior months after closure

### Good presentation sections

- project overview
- problem statement
- architecture and storage design
- rolling baseline learning logic
- month completion flow
- AI prompt and insights flow
- user benefits

## Limitations and Assumptions

- the app is local-first and depends on browser storage persistence
- seed CSVs are treated as normalized learning months because they do not carry per-month user income
- full AI chat quality depends on a valid Groq API key
- clearing data removes browser state, but the project seed CSVs remain available for re-initialization

## Version Note

This README reflects the current month-aware, archive-aware, rolling 12-month learning workflow in the project as of April 28, 2026.
