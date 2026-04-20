const FIELD_KEYWORDS = {
    date: ["date", "transactiondate", "spenton", "purchasedate", "entrydate"],
    category: ["category", "type", "group", "bucket", "segment", "tag"],
    amount: ["amount", "expense", "debit", "spend", "spent", "total", "cost", "price", "value"],
    vendor: ["vendor", "merchant", "payee", "store", "shop", "outlet", "receiver", "beneficiary"],
    description: ["description", "note", "notes", "memo", "remarks", "remark", "narration", "details"],
    paymentMode: ["paymentmode", "paymentmethod", "payment", "mode", "method", "channel"],
    month: ["month", "period"]
};

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
    const normalizedHeaders = headers.map((header) => normalizeHeader(header));
    const requiredHeaders = ["date", "category", "amountspent"];
    const hasStrictHeaders = normalizedHeaders.length === requiredHeaders.length
        && requiredHeaders.every((header) => normalizedHeaders.includes(header));

    if (!hasStrictHeaders) {
        return {
            records: [],
            issues: ["Expense import requires exactly these headers: date, category, amount_spent."]
        };
    }

    const headerMap = headers.reduce((map, header, index) => {
        map[normalizeHeader(header)] = headers[index];
        return map;
    }, {});

    const rows = lines.slice(1).map((line) => {
        const cells = splitCsvLine(line, delimiter);
        return {
            date: cells[headers.indexOf(headerMap.date)] ?? "",
            category: cells[headers.indexOf(headerMap.category)] ?? "",
            amount_spent: cells[headers.indexOf(headerMap.amountspent)] ?? ""
        };
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

    const normalizedHeaderList = Object.keys(rows[0] || {}).map((key) => normalizeHeader(key));
    const requiredNormalizedHeaders = ["date", "category", "amountspent"];
    const hasStrictHeaders = normalizedHeaderList.length === requiredNormalizedHeaders.length
        && requiredNormalizedHeaders.every((header) => normalizedHeaderList.includes(header));

    if (!hasStrictHeaders) {
        return {
            records: [],
            issues: ["Expense import requires exactly these headers: date, category, amount_spent."]
        };
    }

    const normalizedRows = rows.map((row) => {
        const normalized = {};
        Object.entries(row || {}).forEach(([key, value]) => {
            normalized[normalizeHeader(key)] = value;
        });
        return {
            date: normalized.date ?? "",
            category: normalized.category ?? "",
            amount_spent: normalized.amountspent ?? ""
        };
    });

    const records = normalizedRows.reduce((list, row, index) => {
        const record = buildUserExpenseRecord(row, index, sourceName);
        if (record) {
            list.push(record);
        }
        return list;
    }, []);

    if (!records.length) {
        return {
            records: [],
            issues: ["No valid expense rows were found. Check that every row has date, category, and amount_spent."]
        };
    }

    return {
        records,
        issues: []
    };
}
