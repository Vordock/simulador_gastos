/**
 * Módulo de Análise Financeira (Descritiva e Prescritiva)
 * Compatível diretamente com o navegador (file:// e http/https).
 */
(function (global) {
  "use strict";

  function parseMonetaryInput(rawValue) {
    if (rawValue === null || rawValue === undefined) {
      throw new Error("Valor ausente.");
    }

    let cleaned = String(rawValue)
      .trim()
      .replace("R$", "")
      .replace(/\s+/g, "");

    if (!cleaned) {
      throw new Error("Campo vazio.");
    }

    // Suporte a formatos como '1.250,50' ou '1250,50' ou '1250.50'
    if (cleaned.includes(",") && cleaned.includes(".")) {
      if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
        cleaned = cleaned.replace(/\./g, "").replace(",", ".");
      } else {
        cleaned = cleaned.replace(/,/g, "");
      }
    } else if (cleaned.includes(",")) {
      cleaned = cleaned.replace(",", ".");
    }

    const value = parseFloat(cleaned);
    if (Number.isNaN(value) || !Number.isFinite(value)) {
      throw new Error(`Valor numérico inválido: '${rawValue}'`);
    }

    if (value < 0) {
      throw new Error("Valores negativos não são permitidos.");
    }

    return value;
  }

  function validateAndParseInputs(rawExpenses, rawReserve) {
    if (!Array.isArray(rawExpenses) || rawExpenses.length !== 6) {
      throw new Error("São necessários exatamente 6 meses de gastos.");
    }

    const expenses = [];
    for (let i = 0; i < rawExpenses.length; i++) {
      try {
        const val = parseMonetaryInput(rawExpenses[i]);
        expenses.push(val);
      } catch (err) {
        throw new Error(`Mês ${i + 1}: ${err.message}`);
      }
    }

    const total = expenses.reduce((acc, curr) => acc + curr, 0);
    if (total <= 0) {
      throw new Error(
        "A soma dos gastos dos 6 meses deve ser maior que zero para o cálculo de autonomia."
      );
    }

    let reserve;
    try {
      reserve = parseMonetaryInput(rawReserve);
    } catch (err) {
      throw new Error(`Saldo da Reserva Atual: ${err.message}`);
    }

    return { expenses, reserve };
  }

  function sampleStandardDeviation(values, mean) {
    if (values.length <= 1) return 0;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      (values.length - 1);
    return Math.sqrt(variance);
  }

  function formatBRL(value) {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "R$ 0,00";
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  function computeDescriptiveMetrics(expenses, reserveBalance) {
    const n = expenses.length;
    const total = expenses.reduce((acc, val) => acc + val, 0);
    const meanVal = total / n;
    const maxVal = Math.max(...expenses);
    const minVal = Math.min(...expenses);
    const stdVal = sampleStandardDeviation(expenses, meanVal);
    const amplitudeVal = maxVal - minVal;
    const cvPct = meanVal > 0 ? (stdVal / meanVal) * 100 : 0;
    const autonomy = meanVal > 0 ? reserveBalance / meanVal : Infinity;

    const isVarGood = cvPct <= 20.0;
    const varQuality = isVarGood ? "Boa (Estável)" : "Ruim (Alta Oscilação)";

    let varAdvice = "";
    if (isVarGood) {
      varAdvice = `✓ Variabilidade Baixa: Seus gastos oscilam moderadamente (${cvPct.toFixed(
        1
      )}% da média, DP: ${formatBRL(
        stdVal
      )}). Manter essa previsibilidade favorece a segurança da sua reserva.`;
    } else {
      varAdvice = `⚡ Alerta de Estabilização: Seus gastos apresentam alta oscilação (${cvPct.toFixed(
        1
      )}% da média, DP: ${formatBRL(
        stdVal
      )}). Mesmo em caso de cenário seguro, procure estabilizar e nivelar seus gastos para evitar que meses de pico consumam sua reserva mais depressa.`;
    }

    return {
      expenses,
      reserveBalance,
      meanExpense: meanVal,
      maxExpense: maxVal,
      minExpense: minVal,
      stdExpense: stdVal,
      cvPercentage: cvPct,
      amplitude: amplitudeVal,
      autonomyMonths: autonomy,
      isVariabilityGood: isVarGood,
      variabilityQuality: varQuality,
      variabilityAdvice: varAdvice,
    };
  }

  function computePrescriptiveScenario(descriptive, targetMonths = 3) {
    const reserve = descriptive.reserveBalance;
    const meanExp = descriptive.meanExpense;
    const autonomy = descriptive.autonomyMonths;

    const isSafe = autonomy >= targetMonths - 1e-9;
    const mandatoryCap = reserve / targetMonths;

    let remaining = 0;
    let requiredCut = 0;
    let cutPct = 0;
    let statusLabel = "";

    if (isSafe) {
      remaining = Math.max(0, reserve - meanExp * targetMonths);
      requiredCut = 0;
      cutPct = 0;
      statusLabel = "CENÁRIO SEGURO (Autonomia ≥ 3 meses)";
    } else {
      remaining = 0;
      requiredCut = Math.max(0, meanExp - mandatoryCap);
      cutPct = meanExp > 0 ? (requiredCut / meanExp) * 100 : 0;
      statusLabel = "CENÁRIO CRÍTICO (Autonomia < 3 meses)";
    }

    return {
      targetMonths,
      isSafe,
      statusLabel,
      estimatedRemainingBalance: remaining,
      mandatoryMonthlyCap: mandatoryCap,
      requiredMonthlyCut: requiredCut,
      requiredCutPercentage: cutPct,
    };
  }

  function runFinancialAnalysis(expenses, reserveBalance, targetMonths = 3) {
    const descriptive = computeDescriptiveMetrics(expenses, reserveBalance);
    const prescriptive = computePrescriptiveScenario(descriptive, targetMonths);
    return { descriptive, prescriptive };
  }

  // Exporta globalmente para compatibilidade universal
  global.FinancialAnalytics = {
    parseMonetaryInput,
    validateAndParseInputs,
    computeDescriptiveMetrics,
    computePrescriptiveScenario,
    runFinancialAnalysis,
    formatBRL,
  };
})(typeof window !== "undefined" ? window : globalThis);
