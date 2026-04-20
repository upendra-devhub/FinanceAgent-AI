import { toNumber } from "./stats.js";
import { getProfile, saveProfileField } from "./storage.js";

const REQUIRED_FIELDS = ["income", "savings", "goal", "mandatory"];

function normalizeProfileValues(profile = {}) {
    return {
        income: String(profile.income ?? "").trim(),
        savings: String(profile.savings ?? "").trim(),
        goal: String(profile.goal ?? "").trim(),
        mandatory: String(profile.mandatory ?? "").trim()
    };
}

export function validateFinancialProfile(profile = {}) {
    const values = normalizeProfileValues(profile);
    const errors = {};

    REQUIRED_FIELDS.forEach((field) => {
        const value = values[field];
        if (value === "") {
            errors[field] = "This field is required.";
            return;
        }

        const numericValue = Number.parseFloat(value);
        if (!Number.isFinite(numericValue)) {
            errors[field] = "Enter a valid number.";
            return;
        }

        if (numericValue < 0) {
            errors[field] = "Value cannot be negative.";
        }
    });

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        values
    };
}

export function getFinancialProfile() {
    const values = normalizeProfileValues(getProfile());
    const missingFields = REQUIRED_FIELDS.filter((field) => values[field] === "");

    return {
        values,
        numbers: {
            income: toNumber(values.income),
            savings: toNumber(values.savings),
            goal: toNumber(values.goal),
            mandatory: toNumber(values.mandatory)
        },
        missingFields,
        isComplete: missingFields.length === 0
    };
}

export function saveFinancialProfile(profile = {}) {
    const result = validateFinancialProfile(profile);
    if (!result.isValid) {
        return result;
    }

    REQUIRED_FIELDS.forEach((field) => {
        saveProfileField(field, result.values[field]);
    });

    return {
        ...result,
        profile: getFinancialProfile()
    };
}
