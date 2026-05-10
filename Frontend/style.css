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