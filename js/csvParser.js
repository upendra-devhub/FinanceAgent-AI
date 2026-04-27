import { buildMonthContextFromDate } from "./monthlyManager.js";

const FIELD_KEYWORDS = {
    date: ["date", "transactiondate", "spenton", "purchasedate", "entrydate"],
    category: ["category", "type", "group", "bucket", "segment", "tag"],
    amount: ["amount", "expense", "debit", "spend", "spent", "total", "cost", "price", "value"],
    vendor: ["vendor", "merchant", "payee", "store", "shop", "outlet", "receiver", "beneficiary"],
    description: ["description", "note", "notes", "memo", "remarks", "remark", "narration", "details"],
    paymentMode: ["paymentmode", "paymentmethod", "payment", "mode", "method", "channel"],
    month: ["month", "period"],
    type: ["type", "transactiontype", "tag", "flow", "direction", "creditdebit", "debitcredit"],
    credit: ["credit", "deposit", "income", "received", "cr"],
    debit: ["debit", "withdrawal", "paid", "dr"]
};

const CATEGORY_RULES = [
    { category: "Food", keywords: ["swiggy", "zomato", "restaurant", "cafe", "food", "grocery", "blinkit", "zepto", "dmart", "mart"] },
    { category: "Rent", keywords: ["rent", "lease", "landlord"] },
    { category: "Transport", keywords: ["uber", "ola", "metro", "fuel", "petrol", "diesel", "cab", "taxi", "rapido"] },
    { category: "Utilities", keywords: ["electricity", "water", "gas", "wifi", "broadband", "mobile", "recharge", "bill"] },
    { category: "Shopping", keywords: ["amazon", "flipkart", "myntra", "shopping", "store", "mall"] },
    { category: "Health", keywords: ["pharmacy", "hospital", "clinic", "doctor", "medicine", "health"] },
    { category: "Entertainment", keywords: ["netflix", "spotify", "movie", "cinema", "prime", "hotstar"] },
    { category: "Investment", keywords: ["mutual fund", "sip", "zerodha", "groww", "upstox", "investment", "stocks", "equity", "nps"] },
    { category: "Income", keywords: ["salary", "payroll", "income", "interest", "dividend", "refund", "cashback"] }
];

const MONTH_INDEX = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
};

function normalizeHeader(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function splitCsvLine(line, delimiter) {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === delimiter && !inQuotes) {
            cells.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current.trim());
    return cells;
}

function detectDelimiter(text) {
    const sampleLines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 5);

    const candidates = [",", ";", "\t", "|"];
    let best = { delimiter: ",", score: -1 };

    candidates.forEach((delimiter) => {
        const counts = sampleLines.map((line) => splitCsvLine(line, delimiter).length);
        const min = Math.min(...counts);
        const max = Math.max(...counts);
        const score = min > 1 ? min - (max - min) : -1;

        if (score > best.score) {
            best = { delimiter, score };
        }
    });

    return best.delimiter;
}

function parseCurrencyValue(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    const parsed = Number.parseFloat(cleaned);

    return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function parseSignedCurrencyValue(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const raw = String(value).trim();
    const negativeByText = /\b(debit|withdrawal|paid|dr)\b/i.test(raw) || /^\(.*\)$/.test(raw);
    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    const parsed = Number.parseFloat(cleaned);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return negativeByText && parsed > 0 ? -parsed : parsed;
}

function parseDateValue(value) {
    if (!value) {
        return null;
    }

    const trimmed = String(value).trim();
    const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch.map(Number);
        return new Date(year, month - 1, day, 12);
    }

    const slashMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (slashMatch) {
        let [, first, second, third] = slashMatch.map(Number);
        if (third < 100) {
            third += 2000;
        }

        const monthFirst = new Date(third, first - 1, second, 12);
        const dayFirst = new Date(third, second - 1, first, 12);
        const monthFirstValid = monthFirst.getMonth() === first - 1 && monthFirst.getDate() === second;
        const dayFirstValid = dayFirst.getMonth() === second - 1 && dayFirst.getDate() === first;

        if (monthFirstValid && !dayFirstValid) {
            return monthFirst;
        }

        if (dayFirstValid && !monthFirstValid) {
            return dayFirst;
        }

        return monthFirstValid ? monthFirst : null;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildUserExpenseRecord(row, index, sourceName) {
    const date = parseDateValue(row.date);
    const amount = parseCurrencyValue(row.amount_spent);
    const category = String(row.category || "").trim();

    if (!date || amount === null || !category) {
        return null;
    }

    return {
        id: `${sourceName}-${index + 1}`,
        date: date.toISOString().slice(0, 10),
        category,
        amount,
        vendor: "",
        description: ""
    };
}

function detectCategory(...values) {
    const haystack = values
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const match = CATEGORY_RULES.find((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)));
    return match?.category || "Uncategorized";
}

function normalizeTransactionType(value) {
    const normalized = String(value || "").toLowerCase();

    if (/(income|credit|deposit|salary|refund|cashback|received|\bcr\b)/.test(normalized)) {
        return "income";
    }

    if (/(invest|investment|sip|mutual|stock|equity|nps|zerodha|groww|upstox)/.test(normalized)) {
        return "investment";
    }

    return "expense";
}

function inferTransactionType({ rawType, amount, category, description, vendor, debitAmount, creditAmount }) {
    if (rawType) {
        return normalizeTransactionType(rawType);
    }

    const textType = normalizeTransactionType(`${category} ${description} ${vendor}`);
    if (textType === "investment") {
        return "investment";
    }

    if (creditAmount !== null && creditAmount > 0) {
        return "income";
    }

    if (debitAmount !== null && debitAmount > 0) {
        return "expense";
    }

    if (textType !== "expense") {
        return textType;
    }

    return amount < 0 ? "expense" : "expense";
}

function looksLikeTransactionTypeColumn(rows, header) {
    if (!header) {
        return false;
    }

    const values = rows
        .slice(0, 25)
        .map((row) => String(row?.[header] || "").trim().toLowerCase())
        .filter(Boolean);

    if (!values.length) {
        return false;
    }

    const transactionTypeHits = values.filter((value) => /^(expense|income|investment|credit|debit|dr|cr|withdrawal|deposit)$/.test(value));
    return transactionTypeHits.length / values.length >= 0.5;
}

function buildFlexibleUserRecord(row, index, sourceName, mapping) {
    const date = mapping.date ? parseDateValue(row[mapping.date]) : null;
    const rawDescription = mapping.description ? row[mapping.description] : "";
    const rawVendor = mapping.vendor ? row[mapping.vendor] : "";
    const rawCategory = mapping.category ? row[mapping.category] : "";
    const rawType = mapping.type ? row[mapping.type] : "";
    const rawDebit = mapping.debit ? parseCurrencyValue(row[mapping.debit]) : null;
    const rawCredit = mapping.credit ? parseCurrencyValue(row[mapping.credit]) : null;
    const signedAmount = mapping.amount ? parseSignedCurrencyValue(row[mapping.amount]) : null;

    const amount = rawDebit !== null && rawDebit > 0
        ? rawDebit
        : rawCredit !== null && rawCredit > 0
            ? rawCredit
            : signedAmount !== null
                ? Math.abs(signedAmount)
                : null;

    const category = String(rawCategory || detectCategory(rawVendor, rawDescription, rawType)).trim();
    const transactionType = inferTransactionType({
        rawType,
        amount: signedAmount ?? amount ?? 0,
        category,
        description: rawDescription,
        vendor: rawVendor,
        debitAmount: rawDebit,
        creditAmount: rawCredit
    });

    if (!date || amount === null || amount <= 0) {
        return null;
    }

    const monthContext = buildMonthContextFromDate(date);

    return {
        id: `${sourceName}-${index + 1}`,
        date: date.toISOString().slice(0, 10),
        month: monthContext?.month || "",
        year: monthContext?.year || "",
        category: transactionType === "income" && category === "Uncategorized" ? "Income" : category,
        amount,
        vendor: String(rawVendor || "").trim(),
        description: String(rawDescription || "").trim(),
        transactionType,
        source: "user-import"
    };
}

function findMappedHeader(headers, rows, fieldName) {
    const keywords = FIELD_KEYWORDS[fieldName];
    let bestHeader = null;
    let bestScore = -1;

    headers.forEach((header) => {
        const normalized = normalizeHeader(header);
        const score = keywords.reduce((total, keyword) => {
            if (normalized === keyword) {
                return total + 10;
            }
            if (normalized.includes(keyword)) {
                return total + 5;
            }
            return total;
        }, 0);

        if (score > bestScore) {
            bestScore = score;
            bestHeader = header;
        }
    });

    if (bestScore > 0) {
        return bestHeader;
    }

    if (fieldName === "amount") {
        let bestNumericHeader = null;
        let bestNumericScore = 0;

        headers.forEach((header) => {
            const numericHits = rows.slice(0, 25).reduce((count, row) => {
                return parseCurrencyValue(row[header]) !== null ? count + 1 : count;
            }, 0);

            if (numericHits > bestNumericScore) {
                bestNumericScore = numericHits;
                bestNumericHeader = header;
            }
        });

        return bestNumericHeader;
    }

    return null;
}

function inferMonthKey(date, monthLabel) {
    if (date) {
        const month = String(date.getMonth() + 1).padStart(2, "0");
        return `${date.getFullYear()}-${month}`;
    }

    if (!monthLabel) {
        return null;
    }

    const normalized = String(monthLabel).trim().toLowerCase();
    const monthIndex = MONTH_INDEX[normalized];

    if (monthIndex === undefined) {
        return null;
    }

    const assumedYear = new Date().getFullYear();
    return `${assumedYear}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function parseExpenseCsv(text, sourceName = "dataset.csv") {
    const delimiter = detectDelimiter(text);
    const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
        return {
            records: [],
            metadata: {
                sourceName,
                delimiter,
                headers: [],
                mapping: {}
            },
            issues: ["The CSV does not contain enough rows to analyze."]
        };
    }

    const headers = splitCsvLine(lines[0], delimiter);
    const rows = lines.slice(1).map((line) => {
        const cells = splitCsvLine(line, delimiter);
        return headers.reduce((record, header, index) => {
            record[header] = cells[index] ?? "";
            return record;
        }, {});
    });

    const mapping = {
        date: findMappedHeader(headers, rows, "date"),
        category: findMappedHeader(headers, rows, "category"),
        amount: findMappedHeader(headers, rows, "amount"),
        vendor: findMappedHeader(headers, rows, "vendor"),
        description: findMappedHeader(headers, rows, "description"),
        paymentMode: findMappedHeader(headers, rows, "paymentMode"),
        month: findMappedHeader(headers, rows, "month")
    };

    const issues = [];
    if (!mapping.amount) {
        issues.push("No amount-like column was detected, so expense totals may be incomplete.");
    }

    const records = rows.reduce((list, row, index) => {
        const amount = parseCurrencyValue(mapping.amount ? row[mapping.amount] : null);

        if (amount === null) {
            return list;
        }

        const date = mapping.date ? parseDateValue(row[mapping.date]) : null;
        const category = mapping.category ? row[mapping.category] : "";
        const vendor = mapping.vendor ? row[mapping.vendor] : "";
        const description = mapping.description ? row[mapping.description] : "";
        const paymentMode = mapping.paymentMode ? row[mapping.paymentMode] : "";
        const monthLabel = mapping.month ? row[mapping.month] : "";

        list.push({
            id: `dataset-${index + 1}`,
            source: "dataset",
            date,
            dateLabel: date ? date.toISOString().slice(0, 10) : "",
            monthKey: inferMonthKey(date, monthLabel),
            amount,
            category: String(category || description || "Uncategorized").trim() || "Uncategorized",
            vendor: String(vendor || "").trim(),
            description: String(description || "").trim(),
            paymentMode: String(paymentMode || "").trim(),
            raw: row
        });

        return list;
    }, []);

    return {
        records,
        metadata: {
            sourceName,
            delimiter,
            headers,
            mapping
        },
        issues
    };
}

export function parseUserExpenseCsv(text, sourceName = "expenses.csv") {
    const delimiter = detectDelimiter(text);
    const lines = text
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
        return {
            records: [],
            issues: ["The expense file must include a header row plus at least one expense row."]
        };
    }

    const headers = splitCsvLine(lines[0], delimiter);
    const rows = lines.slice(1).map((line) => {
        const cells = splitCsvLine(line, delimiter);
        return headers.reduce((record, header, index) => {
            record[header] = cells[index] ?? "";
            return record;
        }, {});
    });

    return parseUserExpenseRows(rows, sourceName);
}

export function parseUserExpenseRows(rows, sourceName = "expenses-import") {
    if (!Array.isArray(rows) || !rows.length) {
        return {
            records: [],
            issues: ["No expense rows were found in the uploaded file."]
        };
    }

    const headers = Object.keys(rows[0] || {});
    const typeHeader = findMappedHeader(headers, rows, "type");
    const categoryHeader = findMappedHeader(headers, rows, "category");
    const reservedTypeHeader = looksLikeTransactionTypeColumn(rows, typeHeader) ? typeHeader : null;
    const safeCategoryHeader = reservedTypeHeader && categoryHeader === reservedTypeHeader ? null : categoryHeader;

    const mapping = {
        date: findMappedHeader(headers, rows, "date"),
        category: safeCategoryHeader,
        amount: findMappedHeader(headers, rows, "amount"),
        vendor: findMappedHeader(headers, rows, "vendor"),
        description: findMappedHeader(headers, rows, "description"),
        paymentMode: findMappedHeader(headers, rows, "paymentMode"),
        type: typeHeader,
        debit: findMappedHeader(headers, rows, "debit"),
        credit: findMappedHeader(headers, rows, "credit")
    };

    if (!mapping.date || (!mapping.amount && !mapping.debit && !mapping.credit)) {
        return {
            records: [],
            issues: ["I could not detect date and amount columns. Include columns like date plus amount, debit, or credit."]
        };
    }

    let invalidRowCount = 0;
    const records = rows.reduce((list, row, index) => {
        const record = buildFlexibleUserRecord(row, index, sourceName, mapping);
        if (record) {
            list.push(record);
        } else {
            invalidRowCount += 1;
        }
        return list;
    }, []);

    if (!records.length) {
        return {
            records: [],
            issues: ["No valid transaction rows were found. Check that rows include a date and non-zero amount."]
        };
    }

    const summary = records.reduce((totals, record) => {
        totals[record.transactionType] = (totals[record.transactionType] || 0) + record.amount;
        return totals;
    }, { income: 0, expense: 0, investment: 0 });

    const detectedMonths = Array.from(new Set(records.map((record) => `${record.month}-${record.year}`)))
        .map((value) => {
            const [month, year] = value.split("-");
            return {
                month,
                year: Number.parseInt(year, 10),
                label: `${month} ${year}`
            };
        });

    return {
        records,
        issues: [],
        metadata: {
            sourceName,
            headers,
            mapping,
            invalidRowCount,
            detectedMonths
        },
        summary
    };
}
