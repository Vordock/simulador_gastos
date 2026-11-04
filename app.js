(function () {
  "use strict";

  const {
    validateAndParseInputs,
    runFinancialAnalysis,
    formatBRL,
  } = window.FinancialAnalytics;

  // Elementos do DOM
  const screenInput = document.getElementById("screen-input");
  const screenResults = document.getElementById("screen-results");

  const expenseInputs = [
    document.getElementById("expense-0"),
    document.getElementById("expense-1"),
    document.getElementById("expense-2"),
    document.getElementById("expense-3"),
    document.getElementById("expense-4"),
    document.getElementById("expense-5"),
  ];
  const reserveInput = document.getElementById("reserve-input");
  const validationBanner = document.getElementById("validation-banner");
  const btnGenerate = document.getElementById("btn-generate");
  const btnBack = document.getElementById("btn-back");
  const btnNewSimulation = document.getElementById("btn-new-simulation");

  // Elementos de Métricas (Tela 2)
  const badgeStatus = document.getElementById("badge-status");
  const metricMean = document.getElementById("metric-mean");
  const metricAutonomy = document.getElementById("metric-autonomy");
  const metricMax = document.getElementById("metric-max");
  const metricMin = document.getElementById("metric-min");
  const metricVariability = document.getElementById("metric-variability");
  const metricReserve = document.getElementById("metric-reserve");

  // Elementos Prescritivos (Tela 2)
  const prescriptiveCard = document.getElementById("prescriptive-card");
  const prescScenarioTitle = document.getElementById("presc-scenario-title");
  const prescPrimaryMetric = document.getElementById("presc-primary-metric");
  const prescSecondaryMetric = document.getElementById("presc-secondary-metric");
  const prescExplanation = document.getElementById("presc-explanation");
  const prescVariabilityBox = document.getElementById("presc-variability-box");
  const prescVariabilityAlert = document.getElementById("presc-variability-alert");

  // Instância do Chart.js
  let chartInstance = null;

  // ============================================================================
  // VALIDAÇÃO E GESTÃO DE ERROS
  // ============================================================================
  function resetInputBorders() {
    expenseInputs.forEach((input) => input.classList.remove("input-error"));
    reserveInput.classList.remove("input-error");
  }

  function showValidationError(message, offendingIndex = null) {
    resetInputBorders();
    if (offendingIndex !== null && offendingIndex >= 0 && offendingIndex < 6) {
      expenseInputs[offendingIndex].classList.add("input-error");
      expenseInputs[offendingIndex].focus();
    } else if (offendingIndex === 6) {
      reserveInput.classList.add("input-error");
      reserveInput.focus();
    }

    validationBanner.textContent = `⚠ Atenção: ${message}`;
    validationBanner.classList.add("show");
  }

  function hideValidationError() {
    resetInputBorders();
    validationBanner.textContent = "";
    validationBanner.classList.remove("show");
  }

  // ============================================================================
  // PROCESSAMENTO DA ANÁLISE
  // ============================================================================
  function handleGenerateAnalysis() {
    const rawExpenses = expenseInputs.map((input) => input.value);
    const rawReserve = reserveInput.value;

    try {
      const { expenses, reserve } = validateAndParseInputs(rawExpenses, rawReserve);
      hideValidationError();
      const result = runFinancialAnalysis(expenses, reserve, 3);
      populateResults(result);
      showResultsScreen();
    } catch (err) {
      const msg = err.message || String(err);
      let offendingIdx = null;
      for (let i = 1; i <= 6; i++) {
        if (msg.startsWith(`Mês ${i}:`)) {
          offendingIdx = i - 1;
          break;
        }
      }
      if (msg.startsWith("Saldo da Reserva")) {
        offendingIdx = 6;
      }
      showValidationError(msg, offendingIdx);
    }
  }

  // ============================================================================
  // POVOAMENTO DOS RESULTADOS
  // ============================================================================
  function populateResults(result) {
    const { descriptive: desc, prescriptive: presc } = result;

    // 1. Bloco Descritivo
    metricMean.textContent = formatBRL(desc.meanExpense);

    const autonomyText = `${desc.autonomyMonths.toFixed(2).replace(".", ",")} meses`;
    metricAutonomy.textContent = autonomyText;
    metricAutonomy.className = `metric-box-val ${presc.isSafe ? "text-green" : "text-red"}`;

    metricMax.textContent = formatBRL(desc.maxExpense);
    metricMin.textContent = formatBRL(desc.minExpense);

    metricVariability.textContent = `${formatBRL(desc.stdExpense)} (${desc.cvPercentage.toFixed(
      1
    )}%) • ${desc.variabilityQuality}`;
    metricVariability.className = `metric-box-val ${
      desc.isVariabilityGood ? "text-green" : "text-amber"
    }`;

    metricReserve.textContent = formatBRL(desc.reserveBalance);

    // 2. Bloco Prescritivo
    if (presc.isSafe) {
      badgeStatus.textContent = "CENÁRIO SEGURO";
      badgeStatus.className = "badge-status badge-safe";

      prescriptiveCard.className = "prescriptive-card safe-border";
      prescScenarioTitle.textContent = "✓ Cenário Seguro (Autonomia ≥ 3 meses)";
      prescScenarioTitle.className = "presc-scenario-title text-green";

      prescPrimaryMetric.textContent = `Saldo Remanescente Estimado após o 3º Mês: ${formatBRL(
        presc.estimatedRemainingBalance
      )}`;
      prescSecondaryMetric.textContent = `Consumo Acumulado Projetado: ${formatBRL(
        desc.meanExpense * presc.targetMonths
      )}`;
      prescSecondaryMetric.className = "presc-metric-secondary text-green";

      prescExplanation.textContent =
        "Diagnóstico: Sua reserva de emergência atual é suficiente para cobrir integralmente 3 meses do seu padrão médio de consumo sem necessidade de cortes imediatos.";
    } else {
      badgeStatus.textContent = "CENÁRIO CRÍTICO";
      badgeStatus.className = "badge-status badge-critical";

      prescriptiveCard.className = "prescriptive-card critical-border";
      prescScenarioTitle.textContent = "⚠ Cenário Crítico (Autonomia < 3 meses)";
      prescScenarioTitle.className = "presc-scenario-title text-red";

      prescPrimaryMetric.textContent = `1. Teto de Gastos Mensal Obrigatório (Reserva / 3): ${formatBRL(
        presc.mandatoryMonthlyCap
      )}`;
      prescSecondaryMetric.textContent = `2. Corte Mensal Necessário (x̄ − Reserva / 3): ${formatBRL(
        presc.requiredMonthlyCut
      )} (-${presc.requiredCutPercentage.toFixed(1)}%)`;
      prescSecondaryMetric.className = "presc-metric-secondary text-amber";

      prescExplanation.textContent =
        "Prescrição: Para garantir que sua reserva atual dure exatamente 3 meses, reduza suas despesas mensais ao teto obrigatório acima, cortando o valor indicado em relação à sua média atual.";
    }

    // 3. Alerta de Variabilidade e Estabilização
    prescVariabilityAlert.textContent = desc.variabilityAdvice;
    if (desc.isVariabilityGood) {
      prescVariabilityBox.className = "variability-alert-box alert-safe";
    } else {
      prescVariabilityBox.className = "variability-alert-box alert-warning";
    }

    // 4. Renderização do Gráfico Chart.js
    renderLineChart(desc.expenses, desc.meanExpense);
  }

  // ============================================================================
  // RENDERIZAÇÃO DO GRÁFICO (Chart.js)
  // ============================================================================
  function renderLineChart(expenses, meanExpense) {
    const canvas = document.getElementById("expenses-chart");
    const ctx = canvas.getContext("2d");

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    const labels = ["Mês 1", "Mês 2", "Mês 3", "Mês 4", "Mês 5", "Mês 6"];
    const meanLineData = Array(6).fill(meanExpense);

    const minVal = Math.min(...expenses);
    const maxVal = Math.max(...expenses);
    const span = maxVal > minVal ? maxVal - minVal : Math.max(100, maxVal * 0.2);
    const yBottom = Math.max(0, minVal - span * 0.2);
    const yTop = maxVal + span * 0.3;

    chartInstance = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Gastos Mensais",
            data: expenses,
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59, 130, 246, 0.12)",
            fill: true,
            borderWidth: 2.4,
            pointBackgroundColor: "#93C5FD",
            pointBorderColor: "#3B82F6",
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.2,
          },
          {
            label: `Média Mensal (x̄) = ${formatBRL(meanExpense)}`,
            data: meanLineData,
            borderColor: "#F59E0B",
            borderWidth: 2,
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: "#F8FAFC",
              boxWidth: 14,
              font: {
                size: 11,
                weight: "600",
              },
            },
          },
          tooltip: {
            backgroundColor: "#1E293B",
            titleColor: "#F8FAFC",
            bodyColor: "#CBD5E1",
            borderColor: "#334155",
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: function (context) {
                return `${context.dataset.label}: ${formatBRL(context.parsed.y)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(148, 163, 184, 0.12)",
            },
            ticks: {
              color: "#94A3B8",
              font: { size: 11, weight: "600" },
            },
          },
          y: {
            min: yBottom,
            max: yTop,
            grid: {
              color: "rgba(148, 163, 184, 0.15)",
            },
            ticks: {
              color: "#94A3B8",
              font: { size: 10 },
              callback: function (value) {
                return `R$ ${Number(value).toLocaleString("pt-BR", {
                  maximumFractionDigits: 0,
                })}`;
              },
            },
          },
        },
      },
    });
  }

  // ============================================================================
  // NAVEGAÇÃO ENTRE TELAS
  // ============================================================================
  function showInputScreen() {
    screenResults.classList.add("screen-hidden");
    screenInput.classList.remove("screen-hidden");
  }

  function showResultsScreen() {
    screenInput.classList.add("screen-hidden");
    screenResults.classList.remove("screen-hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleNewSimulation() {
    expenseInputs.forEach((input) => (input.value = ""));
    reserveInput.value = "";
    hideValidationError();
    showInputScreen();
    expenseInputs[0].focus();
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================
  btnGenerate.addEventListener("click", handleGenerateAnalysis);
  btnBack.addEventListener("click", showInputScreen);
  btnNewSimulation.addEventListener("click", handleNewSimulation);

  // Suporte a pressionar <Enter> para acionar o cálculo
  [...expenseInputs, reserveInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleGenerateAnalysis();
      }
    });
  });
})();
