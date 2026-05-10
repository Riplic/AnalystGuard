const API = "http://127.0.0.1:8001";

// =========================
// CHART INSTANCE REGISTRY
// Keeps track of every Chart.js instance so we can
// destroy them cleanly before re-drawing (prevents
// "Canvas already in use" errors on re-analysis).
// =========================
const charts = {
    impact:         null,   // legacy – kept hidden but tracked
    originalImpact: null,   // req #1 – original case SHAP
    modifiedImpact: null,   // req #1 – modified case SHAP
    probCompare:    null,   // req #2 – before vs after probability
    metricsBar:     null,   // req #3 – accuracy / precision / recall / F1
    classDist:      null,   // req #4 – approval vs rejection count
    featureMean:    null,   // req #4 – feature averages bar
};

function destroyChart(key) {
    if (charts[key]) {
        charts[key].destroy();
        charts[key] = null;
    }
}

/* =========================
   GLOBAL FIELD CONFIG
========================= */
const fields    = ["age", "income", "credit", "loan", "years"];
const modFields = ["mod_age", "mod_income", "mod_credit", "mod_loan", "mod_years"];

/* =========================
   LOADING HANDLER
========================= */
function setLoading(btn, state, loadingText, originalText) {
    if (!btn) return;
    btn.disabled  = state;
    btn.innerText = state ? loadingText : originalText;
}

function setStatus(id, text, type = "neutral") {
    const el = document.getElementById(id);
    if (!el) return;
    el.className  = `status-badge ${type}`;
    el.innerText  = text;
}

/* =========================
   REAL-TIME VALIDATION
========================= */
function setError(id, msg) {
    const input = document.getElementById(id);
    if (!input) return;
    const errorBox = input.parentNode.querySelector(".error-text");
    if (errorBox) errorBox.innerText = msg;
    input.classList.add("error");
}

function clearError(id) {
    const input = document.getElementById(id);
    if (!input) return;
    const errorBox = input.parentNode.querySelector(".error-text");
    if (errorBox) errorBox.innerText = "";
    input.classList.remove("error");
}

function attachValidation(list) {
    list.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", () => {
            const val = el.value.trim();
            if (val === "")      { setError(id, "Required field");  return; }
            if (isNaN(val))      { setError(id, "Must be numeric"); return; }
            clearError(id);
        });
    });
}

attachValidation(fields);
attachValidation(modFields);

/* =========================
   RESET (FULL CLEAN STATE)
========================= */
function resetAll() {
    try {
        [...fields, ...modFields].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        });

        document.querySelectorAll(".error-text").forEach(e => e.innerText = "");
        document.querySelectorAll("input").forEach(i => i.classList.remove("error"));

        ["prediction", "probabilityBox", "flipResult", "comparisonPanel", "datasetInfo", "metricsBox"]
            .forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = "";
            });

        // Destroy all chart instances
        Object.keys(charts).forEach(destroyChart);

        // Hide chart panels
        const fcPanel = document.getElementById("featureChartsPanel");
        if (fcPanel) fcPanel.style.display = "none";

        const dsCard = document.getElementById("datasetSummaryCard");
        if (dsCard) dsCard.style.display = "none";

        const mWrapper = document.getElementById("metricsChartWrapper");
        if (mWrapper) mWrapper.style.display = "none";

        setStatus("modelStatus", "Model: Not Trained", "neutral");
        setStatus("flipStatus",  "Flip: No",           "neutral");

        ["tn", "fp", "fn", "tp"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = "-";
        });

        const exportBtn = document.getElementById("exportBtn");
        if (exportBtn) exportBtn.disabled = true;

    } catch (err) {
        showModal("error", "Reset Error", "Failed to reset UI state.");
    }
}