import { getFinancialProfile, saveFinancialProfile } from "./profileManager.js";

const elements = {
    form: document.getElementById("profileForm"),
    income: document.getElementById("profileIncome"),
    savings: document.getElementById("profileSavings"),
    goal: document.getElementById("profileGoal"),
    mandatory: document.getElementById("profileMandatory"),
    incomeError: document.getElementById("incomeError"),
    savingsError: document.getElementById("savingsError"),
    goalError: document.getElementById("goalError"),
    mandatoryError: document.getElementById("mandatoryError"),
    status: document.getElementById("profileStatus")
};

function fillForm() {
    const profile = getFinancialProfile();
    elements.income.value = profile.values.income;
    elements.savings.value = profile.values.savings;
    elements.goal.value = profile.values.goal;
    elements.mandatory.value = profile.values.mandatory;
}

function clearErrors() {
    elements.incomeError.textContent = "";
    elements.savingsError.textContent = "";
    elements.goalError.textContent = "";
    elements.mandatoryError.textContent = "";
    elements.status.textContent = "";
    elements.status.classList.remove("success");
}

function showErrors(errors) {
    elements.incomeError.textContent = errors.income || "";
    elements.savingsError.textContent = errors.savings || "";
    elements.goalError.textContent = errors.goal || "";
    elements.mandatoryError.textContent = errors.mandatory || "";
    elements.status.textContent = "Please fix the highlighted fields.";
}

function handleSubmit(event) {
    event.preventDefault();
    clearErrors();

    const result = saveFinancialProfile({
        income: elements.income.value,
        savings: elements.savings.value,
        goal: elements.goal.value,
        mandatory: elements.mandatory.value
    });

    if (!result.isValid) {
        showErrors(result.errors);
        return;
    }

    elements.status.textContent = "Financial profile saved. You can return to the dashboard now.";
    elements.status.classList.add("success");
}

fillForm();
elements.form.addEventListener("submit", handleSubmit);
