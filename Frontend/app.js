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

/* =========================
   PREDICT
========================= */
async function predict(event) {
    const btn          = event?.target;
    const originalText = btn?.innerText;

    try {
        const values = getValues(fields);
        setLoading(btn, true, "Predicting...", originalText);

        const res  = await fetch(`${API}/predict`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ values })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        document.getElementById("prediction").innerHTML = `
            <div class="result-card">
                <h3>${data.label}</h3>
            </div>
        `;

        document.getElementById("probabilityBox").innerHTML = `
            <div class="metric-grid">
                <div class="metric">Approved: ${data.probability_approved}%</div>
                <div class="metric">Rejected: ${data.probability_rejected}%</div>
            </div>
        `;

    } catch (err) {
        showModal("error", "Prediction Error", err.message);
    } finally {
        setLoading(btn, false, "", originalText || "Predict");
    }
}

/* ============================================================
   CHART HELPERS
   Each helper is self-contained: destroys old instance,
   creates new one, and returns the Chart object.
============================================================ */

/**
 * Renders a horizontal bar chart of SHAP feature impacts.
 * Positive values → green, negative → red.
 * Used for both original and modified case panels.
 *
 * @param {string} canvasId - DOM id of the <canvas>
 * @param {string} key      - key in `charts` registry
 * @param {Array}  features - [{feature, impact}, …]
 * @param {string} label    - dataset label string
 */
function renderImpactChart(canvasId, key, features, label) {
    destroyChart(key);

    if (!features || features.length === 0) return;

    const ctx    = document.getElementById(canvasId);
    if (!ctx)    return;

    const sorted = [...features].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    charts[key] = new Chart(ctx, {
        type: "bar",
        data: {
            labels:   sorted.map(f => f.feature),
            datasets: [{
                label:           label,
                data:            sorted.map(f => f.impact),
                backgroundColor: sorted.map(f => f.impact > 0 ? "#22c55e" : "#ef4444"),
                borderRadius:    4,
            }]
        },
        options: {
            indexAxis:   "y",       // horizontal bars – easier to read feature names
            responsive:  true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` Impact: ${ctx.parsed.x.toFixed(4)}`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: "SHAP Value (impact on prediction)" }
                }
            }
        }
    });
}

/**
 * Renders a grouped bar chart comparing approval probability
 * before and after the modification.
 *
 * @param {number} before - probability before (0–100)
 * @param {number} after  - probability after  (0–100)
 */
function renderProbCompareChart(before, after) {
    destroyChart("probCompare");

    const ctx = document.getElementById("probCompareChart");
    if (!ctx) return;

    charts.probCompare = new Chart(ctx, {
        type: "bar",
        data: {
            labels:   ["Original Case", "Modified Case"],
            datasets: [
                {
                    label:           "Approval Probability (%)",
                    data:            [before, after],
                    backgroundColor: [
                        before >= 50 ? "#22c55e" : "#ef4444",
                        after  >= 50 ? "#22c55e" : "#ef4444",
                    ],
                    borderRadius: 6,
                    barThickness: 60,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y.toFixed(1)}% approval`
                    }
                }
            },
            scales: {
                y: {
                    min:   0,
                    max:   100,
                    title: { display: true, text: "Approval Probability (%)" }
                }
            }
        }
    });
}

/**
 * Renders the model performance bar chart.
 * Shows Accuracy, Precision, Recall, F1 as percentage bars.
 *
 * @param {object} data - { accuracy, precision, recall, f1_score } (0–1 scale)
 */
function renderMetricsBarChart(data) {
    destroyChart("metricsBar");

    const ctx = document.getElementById("metricsBarChart");
    if (!ctx) return;

    const labels  = ["Accuracy", "Precision", "Recall", "F1 Score"];
    const values  = [
        +(data.accuracy  * 100).toFixed(2),
        +(data.precision * 100).toFixed(2),
        +(data.recall    * 100).toFixed(2),
        +(data.f1_score  * 100).toFixed(2),
    ];
    const colors  = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981"];

    charts.metricsBar = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label:           "Score (%)",
                data:            values,
                backgroundColor: colors,
                borderRadius:    6,
                barThickness:    50,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y.toFixed(2)}%`
                    }
                }
            },
            scales: {
                y: {
                    min:   0,
                    max:   100,
                    title: { display: true, text: "Score (%)" }
                }
            }
        }
    });

    const wrapper = document.getElementById("metricsChartWrapper");
    if (wrapper) wrapper.style.display = "block";
}

/**
 * Renders the two dataset summary charts:
 *  1. Doughnut – Approved vs Rejected class distribution
 *  2. Horizontal bar – mean value per feature
 *
 * @param {object} summary - response from /dataset-summary
 */
function renderDatasetSummaryCharts(summary) {
    // --- 1. Class Distribution (doughnut) ---
    destroyChart("classDist");

    const ctxDist = document.getElementById("classDistChart");
    if (ctxDist) {
        charts.classDist = new Chart(ctxDist, {
            type: "doughnut",
            data: {
                labels:   ["Approved", "Rejected"],
                datasets: [{
                    data:            [summary.approved, summary.rejected],
                    backgroundColor: ["#22c55e", "#ef4444"],
                    hoverOffset:     8,
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const total = summary.total;
                                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                                return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // --- 2. Feature Averages (horizontal bar) ---
    destroyChart("featureMean");

    const ctxMean = document.getElementById("featureMeanChart");
    if (ctxMean && summary.features && summary.feature_means) {
        const featureLabels = summary.features;
        const meanValues    = featureLabels.map(f => summary.feature_means[f] ?? 0);

        charts.featureMean = new Chart(ctxMean, {
            type: "bar",
            data: {
                labels:   featureLabels,
                datasets: [{
                    label:           "Mean Value",
                    data:            meanValues,
                    backgroundColor: "#3b82f6",
                    borderRadius:    4,
                }]
            },
            options: {
                indexAxis:  "y",
                responsive: true,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` Mean: ${ctx.parsed.x}`
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: "Mean Value" } }
                }
            }
        });
    }

    // Show the card
    const card = document.getElementById("datasetSummaryCard");
    if (card) card.style.display = "block";
}
