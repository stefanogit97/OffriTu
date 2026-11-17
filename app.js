"use strict";

const STORAGE_KEY = "coffee-ledger.entries.v1";
const THEME_STORAGE_KEY = "offritu.theme.v1";
const form = document.querySelector("#entry-form");
const themeToggle = document.querySelector("#theme-toggle");
const themeHint = document.querySelector("#theme-hint");
const periodSelect = document.querySelector("#period-select");
const monthSelect = document.querySelector("#month-select");
const message = document.querySelector("#app-message");
const peopleList = document.querySelector("#people-list");
const historyList = document.querySelector("#history-list");
const registerTab = document.querySelector("#tab-registro");
const chartsTab = document.querySelector("#tab-grafici");
const registerPanel = document.querySelector("#panel-registro");
const chartsPanel = document.querySelector("#panel-grafici");
const chartRangeSelect = document.querySelector("#chart-range");
const chartPersonSelect = document.querySelector("#chart-person");
const movementCsvButton = document.querySelector("#movement-csv-button");
const selfKey = "io";
const monthFormatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
const euroFormatter = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const chartGainColor = "#31804f";
const chartLossColor = "#b33e38";
const chartNeutralColor = "#c8c0b7";
const productOptions = ["Caffè", "Cappuccino", "Tè", "Cioccolata", "Caffè premium"];

let entries = [];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function clearMessage() {
  message.textContent = "";
  message.hidden = true;
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Attiva modalità chiara" : "Attiva modalità scura");
  themeToggle.setAttribute("title", isDark ? "Attiva modalità chiara" : "Attiva modalità scura");
  document.querySelector("#theme-toggle-icon").textContent = isDark ? "☀" : "☾";
  document.querySelector("#theme-toggle-label").textContent = isDark ? "Chiaro" : "Scuro";
  themeHint.textContent = isDark
    ? "Modalità Dark Mode attiva: nessuno scroccone sospetta nulla 😎"
    : "Passa al Dark Mode per non dare nell’occhio agli scrocconi ☕";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#171411" : "#70472f";
}

function validateEntry(entry) {
  const date = typeof entry?.date === "string" ? new Date(`${entry.date}T12:00:00`) : null;
  return Boolean(
    entry &&
    typeof entry.id === "string" &&
    productOptions.includes(entry.product) &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry.date) &&
    date &&
    !Number.isNaN(date.getTime()) &&
    localDateString(date) === entry.date &&
    typeof entry.drinker === "string" &&
    entry.drinker.trim() &&
    entry.drinker.trim().length <= 60 &&
    typeof entry.payer === "string" &&
    entry.payer.trim() &&
    entry.payer.trim().length <= 60 &&
    Number.isSafeInteger(entry.quantity) &&
    entry.quantity > 0 &&
    Number.isSafeInteger(entry.unitPriceCents) &&
    entry.unitPriceCents > 0 &&
    entry.unitPriceCents <= 10000 &&
    Number.isSafeInteger(entry.quantity * entry.unitPriceCents) &&
    typeof entry.note === "string" &&
    entry.note.length <= 160
  );
}

function addLegacyProduct(entry) {
  return entry && typeof entry === "object" && entry.product === undefined
    ? { ...entry, product: "Caffè" }
    : entry;
}

function loadEntries() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return [];

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("I dati salvati non hanno un formato valido. Esporta o ripristina un backup valido.");
  }
  const normalized = parsed.map(addLegacyProduct);
  if (!normalized.every(validateEntry)) {
    throw new Error("I dati salvati non hanno un formato valido. Esporta o ripristina un backup valido.");
  }
  return normalized;
}

function saveEntries(nextEntries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
  entries = nextEntries;
  render();
}

function selectedEntries() {
  if (periodSelect.value === "all") return entries;
  const month = monthSelect.value;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  return entries.filter((entry) => entry.date.startsWith(month));
}

function formatMoney(cents) {
  return euroFormatter.format(cents / 100);
}

function formatCsvField(value) {
  const text = String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function formatCsvMoney(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function downloadCsv(rows, filename, messageText) {
  const csv = `\uFEFF${rows.map((row) => row.map(formatCsvField).join(";")).join("\r\n")}`;
  const file = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(file);
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMessage(messageText);
  window.setTimeout(clearMessage, 2500);
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function createCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function getPersonKey(name) {
  return name.trim().toLocaleLowerCase("it");
}

function classifyScroungeIndex(offered, received) {
  const index = received > 0 ? offered / received : offered > 0 ? Infinity : null;
  if (index === null) return { index, label: "Nessun dato", level: "none" };
  if (index === 0) return { index, label: "Leggenda dello scrocco", level: "legend" };
  if (index < 0.5) return { index, label: "Scroccone", level: "scroccone" };
  if (index < 0.9) return { index, label: "Furbetto", level: "furbetto" };
  if (index <= 1.1) return { index, label: "Equilibrato", level: "balanced" };
  if (index <= 2) return { index, label: "Molto generoso", level: "generous" };
  return { index, label: "Santo patrono del caffè", level: "patron" };
}

function getPeople(periodEntries) {
  const people = new Map();
  const personFor = (name) => {
    const key = getPersonKey(name);
    if (!people.has(key)) {
      people.set(key, {
        name: name.trim(),
        offered: 0,
        received: 0,
        balanceCents: 0,
        beverageBalance: 0
      });
    }
    return people.get(key);
  };

  for (const entry of periodEntries) {
    const drinkerKey = getPersonKey(entry.drinker);
    const payerKey = getPersonKey(entry.payer);
    if (drinkerKey === payerKey) continue;

    const totalCents = entry.quantity * entry.unitPriceCents;
    if (drinkerKey === selfKey) {
      const payer = personFor(entry.payer);
      payer.offered += entry.quantity;
      payer.balanceCents -= totalCents;
      payer.beverageBalance -= entry.quantity;
    } else if (payerKey === selfKey) {
      const drinker = personFor(entry.drinker);
      drinker.received += entry.quantity;
      drinker.balanceCents += totalCents;
      drinker.beverageBalance += entry.quantity;
    }
  }

  return [...people.values()].map((person) => ({
    ...person,
    ...classifyScroungeIndex(person.offered, person.received)
  })).sort((a, b) => a.balanceCents - b.balanceCents || a.name.localeCompare(b.name, "it"));
}

function renderSummary(periodEntries) {
  const beveragesOfferedByMe = periodEntries.reduce((sum, entry) => (
  getPersonKey(entry.payer) === selfKey &&
  getPersonKey(entry.drinker) !== selfKey
    ? sum + entry.quantity
    : sum
), 0);
  const beveragesConsumedByMe = periodEntries.reduce((sum, entry) => (
    getPersonKey(entry.drinker) === selfKey ? sum + entry.quantity : sum
  ), 0);
  const paidByMe = periodEntries.reduce((sum, entry) => (
    getPersonKey(entry.payer) === selfKey ? sum + entry.quantity * entry.unitPriceCents : sum
  ), 0);
  const people = getPeople(periodEntries);
  const totalOfferedToMe = periodEntries.reduce(
  (sum, entry) =>
    getPersonKey(entry.drinker) === selfKey &&
    getPersonKey(entry.payer) !== selfKey
      ? sum + entry.quantity * entry.unitPriceCents
      : sum,
  0
);
  const netBalance = totalOfferedToMe - paidByMe;
  const netBalanceCard = document.querySelector("#net-balance-card");
  const periodLabel = periodSelect.value === "all"
    ? "Da sempre"
    : monthSelect.value
      ? monthFormatter.format(new Date(`${monthSelect.value}-01T12:00:00`))
      : "Seleziona un mese";
  document.querySelector("#total-offered-by-me").textContent = String(beveragesOfferedByMe);
  document.querySelector("#total-beverages").textContent = String(beveragesConsumedByMe);
  document.querySelector("#total-paid-by-me").textContent = formatMoney(paidByMe);
  document.querySelector("#total-offered-to-me").textContent = formatMoney(totalOfferedToMe);
  document.querySelector("#total-net-balance").textContent = netBalance > 0
    ? `+${formatMoney(netBalance)}`
    : formatMoney(netBalance);
  document.querySelector("#period-caption").textContent = periodLabel;
  document.querySelector("#footer-paid-coffees").textContent = periodLabel;
  document.querySelector("#footer-paid-money").textContent = periodLabel;
  document.querySelector("#footer-received-money").textContent = periodLabel;
  document.querySelector("#net-balance-status").textContent =
  netBalance > 0
    ? `Sei in gain di ${formatMoney(netBalance)} · ${periodLabel}`
    : netBalance < 0
      ? `Sei in perdita di ${formatMoney(Math.abs(netBalance))} · ${periodLabel}`
      : `In pari · ${periodLabel}`;
  netBalanceCard.classList.remove("summary-net-positive", "summary-net-negative", "summary-net-neutral");
  netBalanceCard.classList.add(netBalance > 0
    ? "summary-net-positive"
    : netBalance < 0
      ? "summary-net-negative"
      : "summary-net-neutral");
}

function renderPeople(periodEntries) {
  const people = getPeople(periodEntries);
  peopleList.replaceChildren();
  document.querySelector("#people-empty").hidden = people.length > 0;

  for (const person of people) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.className = "person-name";
    nameCell.textContent = person.name;
    const total = document.createElement("span");
    total.className = "person-email";
    total.textContent = `${person.offered} offerte · ${person.received} ricevute`;
    nameCell.append(total);
    row.append(nameCell);

    const beverageBalanceClass = person.beverageBalance > 0
      ? "balance balance-positive"
      : person.beverageBalance < 0
        ? "balance balance-negative"
        : "balance balance-zero";
    const beverageBalanceText = person.beverageBalance > 0
      ? `+${person.beverageBalance}`
      : String(person.beverageBalance);
    row.append(createCell(beverageBalanceText, beverageBalanceClass));

    const scroungeCell = document.createElement("td");
    scroungeCell.className = "scrounge-cell";
    const scroungeValue = document.createElement("span");
    scroungeValue.className = "scrounge-value";
    const indexText = person.index === null
  ? "—"
  : Number.isFinite(person.index)
    ? `${Math.round(person.index * 100)}%`
    : "";
    if (indexText) {
  scroungeValue.textContent = indexText;
  scroungeValue.setAttribute(
    "aria-label",
    `Indice dello scrocco ${indexText}`
  );
  scroungeCell.append(scroungeValue);
}
    const badge = document.createElement("span");
    badge.className = `scrounge-badge scrounge-${person.level}`;
    badge.textContent = person.label;
    scroungeCell.append(scroungeValue, badge);
    row.append(scroungeCell);

    const balanceClass = person.balanceCents < 0
      ? "balance balance-positive align-right"
      : person.balanceCents > 0
        ? "balance balance-negative align-right"
        : "balance balance-zero align-right";
    const balanceText =
     person.balanceCents > 0
    ? `Perdita ${formatMoney(person.balanceCents)}`
    : person.balanceCents < 0
      ? `Gain ${formatMoney(Math.abs(person.balanceCents))}`
      : "In pari";
    row.append(createCell(balanceText, balanceClass));
    peopleList.append(row);
  }
}


  

function renderBalanceSummary() {

  const monthEntries =
    monthSelect.value
      ? entries.filter(entry =>
          entry.date.startsWith(monthSelect.value))
      : [];

  const monthCoffee =
    monthEntries.reduce((sum, entry) => {

      const payer = getPersonKey(entry.payer);
      const drinker = getPersonKey(entry.drinker);

      if (payer === selfKey && drinker !== selfKey) {
        return sum + entry.quantity;
      }

      if (drinker === selfKey && payer !== selfKey) {
        return sum - entry.quantity;
      }

      return sum;

    }, 0);

  const monthEuro =
    monthEntries.reduce((sum, entry) => {

      const payer = getPersonKey(entry.payer);
      const drinker = getPersonKey(entry.drinker);

      const total =
        entry.quantity * entry.unitPriceCents;

      if (payer === selfKey && drinker !== selfKey) {
        return sum + total;
      }

      if (drinker === selfKey && payer !== selfKey) {
        return sum - total;
      }

      return sum;

    }, 0);

  const totalCoffee =
    entries.reduce((sum, entry) => {

      const payer = getPersonKey(entry.payer);
      const drinker = getPersonKey(entry.drinker);

      if (payer === selfKey && drinker !== selfKey) {
        return sum + entry.quantity;
      }

      if (drinker === selfKey && payer !== selfKey) {
        return sum - entry.quantity;
      }

      return sum;

    }, 0);

  const totalEuro =
    entries.reduce((sum, entry) => {

      const payer = getPersonKey(entry.payer);
      const drinker = getPersonKey(entry.drinker);

      const total =
        entry.quantity * entry.unitPriceCents;

      if (payer === selfKey && drinker !== selfKey) {
        return sum + total;
      }

      if (drinker === selfKey && payer !== selfKey) {
        return sum - total;
      }

      return sum;

    }, 0);

  document.querySelector("#month-summary-coffee").textContent =
    `${monthCoffee > 0 ? "+" : ""}${monthCoffee} ☕`;

  document.querySelector("#month-summary-euro").textContent =
    `${monthEuro > 0 ? "+" : ""}${formatMoney(monthEuro)}`;

  document.querySelector("#all-summary-coffee").textContent =
    `${totalCoffee > 0 ? "+" : ""}${totalCoffee} ☕`;

  document.querySelector("#all-summary-euro").textContent =
    `${totalEuro > 0 ? "+" : ""}${formatMoney(totalEuro)}`;

}

function renderHistory(periodEntries) {
  const sortedEntries = [...periodEntries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  historyList.replaceChildren();
  document.querySelector("#history-empty").hidden = sortedEntries.length > 0;
  movementCsvButton.disabled = sortedEntries.length === 0;

  for (const entry of sortedEntries) {
    const row = document.createElement("tr");
    row.append(
      createCell(formatDate(entry.date)),
      createCell(entry.product),
      createCell(entry.drinker),
      createCell(entry.payer),
      createCell(String(entry.quantity)),
      createCell(formatMoney(entry.quantity * entry.unitPriceCents)),
      createCell(entry.note || "—")
    );
    const actions = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Elimina";
    deleteButton.setAttribute("aria-label", `Elimina movimento del ${formatDate(entry.date)} per ${entry.drinker}`);
    deleteButton.addEventListener("click", () => {
      if (!window.confirm("Eliminare questo movimento?")) return;
      try {
        saveEntries(entries.filter((item) => item.id !== entry.id));
        clearMessage();
      } catch (error) {
        showMessage(`Impossibile salvare la modifica: ${error.message}`);
      }
    });
    actions.append(deleteButton);
    row.append(actions);
    historyList.append(row);
  }
}

function getChartPeople() {
  const people = new Map();
  for (const entry of entries) {
    const drinkerKey = getPersonKey(entry.drinker);
    const payerKey = getPersonKey(entry.payer);
    if (drinkerKey === selfKey && payerKey !== selfKey && !people.has(payerKey)) {
      people.set(payerKey, entry.payer.trim());
    } else if (payerKey === selfKey && drinkerKey !== selfKey && !people.has(drinkerKey)) {
      people.set(drinkerKey, entry.drinker.trim());
    }
  }
  return [...people.entries()]
    .map(([key, name]) => ({ key, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
}

function refreshChartPeople(people) {
  const previousSelection = chartPersonSelect.value || "all";
  chartPersonSelect.replaceChildren();
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "Tutte le persone";
  chartPersonSelect.append(allOption);

  for (const person of people) {
    const option = document.createElement("option");
    option.value = `person:${person.key}`;
    option.textContent = person.name;
    chartPersonSelect.append(option);
  }

  chartPersonSelect.value = people.some((person) => `person:${person.key}` === previousSelection)
    ? previousSelection
    : "all";
}

function getChartMonths(range, selectedPerson) {
  const selectedKey = selectedPerson === "all" ? null : selectedPerson.slice("person:".length);
  const monthKeys = [...new Set(entries.filter((entry) => {
    const drinkerKey = getPersonKey(entry.drinker);
    const payerKey = getPersonKey(entry.payer);
    if (drinkerKey === selfKey && payerKey !== selfKey) return !selectedKey || payerKey === selectedKey;
    if (payerKey === selfKey && drinkerKey !== selfKey) return !selectedKey || drinkerKey === selectedKey;
    return false;
  }).map((entry) => entry.date.slice(0, 7)))].sort();
  const visibleMonthKeys = range === "all" ? monthKeys : monthKeys.slice(-Number(range));

  return visibleMonthKeys.map((key) => {
    const [year, month] = key.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    const monthName = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date);
    return { key, label: `${monthName} '${String(year).slice(-2)}` };
  });
}

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, String(value));
  }
  if (text) element.textContent = text;
  return element;
}

function formatChartAmount(value, isEuro) {
  if (isEuro) {
    const signedValue = value > 0 ? `+${euroFormatter.format(value)}` : euroFormatter.format(value);
    return signedValue;
  }
  return value > 0 ? `+${value}` : String(value);
}

function wrapChartName(name, maxCharacters = 15) {
  const lines = [];
  let line = "";
  for (const word of name.split(/\s+/)) {
    for (let offset = 0; offset < word.length; offset += maxCharacters) {
      const part = word.slice(offset, offset + maxCharacters);
      if (line && line.length + part.length + 1 > maxCharacters) {
        lines.push(line);
        line = "";
      }
      line = line ? `${line} ${part}` : part;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [name];
}

function drawBalanceChart(svg, emptyState, months, people, monthlyData, isEuro) {
  const hasData = monthlyData.some((month) => month.hasMovement);
  svg.replaceChildren();
  svg.hidden = !hasData;
  emptyState.hidden = hasData;
  if (!hasData || !people.length) return;

  const title = svgElement("title", {}, isEuro ? "Saldo mensile in euro" : "Saldo mensile in bevande");
  const description = svgElement("desc", {}, "Il nome sotto ogni barra identifica la persona; il valore accanto indica il saldo del mese.");
  svg.append(title, description);

  const nameLines = people.map((person) => wrapChartName(person.name));
  const maxNameLines = Math.max(...nameLines.map((lines) => lines.length));
  const plotHeight = 245;
  const margin = { top: 24, right: 20, bottom: maxNameLines * 12 + 46, left: 62 };
  const groupStep = Math.max(138, people.length * 104 + 24);
  const contentWidth = margin.left + margin.right + months.length * groupStep;
  const width = Math.max(contentWidth, svg.parentElement.clientWidth);
  const height = margin.top + plotHeight + margin.bottom;
  const plotWidth = width - margin.left - margin.right;
  const plotBottom = margin.top + plotHeight;
  const values = monthlyData.flatMap((month) => people.map((person) => {
    const balance = month.values.get(person.key);
    return isEuro ? balance.balanceCents / 100 : balance.beverageBalance;
  }));
  const maxAbs = Math.max(0, ...values.map((value) => Math.abs(value)));
  const bound = maxAbs === 0 ? 1 : Math.ceil(maxAbs * 1.12);
  const yFor = (value) => margin.top + ((bound - value) / (bound * 2)) * plotHeight;
  const zeroY = yFor(0);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  for (let tick = -2; tick <= 2; tick += 1) {
    const value = (bound * tick) / 2;
    const y = yFor(value);
    svg.append(svgElement("line", {
      x1: margin.left,
      x2: margin.left + plotWidth,
      y1: y,
      y2: y,
      class: tick === 0 ? "chart-zero-line" : "chart-grid-line"
    }));
    const axisValue = isEuro
      ? `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value)} €`
      : new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(value);
    svg.append(svgElement("text", {
      x: margin.left - 9,
      y: y + 4,
      "text-anchor": "end",
      class: "chart-axis-label"
    }, axisValue));
  }

  const groupWidth = plotWidth / months.length;
  const slotWidth = groupWidth / people.length;
  const barWidth = Math.min(36, slotWidth * 0.42);

  months.forEach((month, monthIndex) => {
    const monthData = monthlyData[monthIndex];
    const groupCenter = margin.left + groupWidth * (monthIndex + 0.5);

    people.forEach((person, personIndex) => {
      const balance = monthData.values.get(person.key);
      const value = isEuro ? balance.balanceCents / 100 : balance.beverageBalance;
      const valueY = yFor(value);
      const barCenter = margin.left + groupWidth * monthIndex + slotWidth * (personIndex + 0.5);
      const bar = svgElement("rect", {
        x: barCenter - barWidth / 2,
        y: Math.min(zeroY, valueY),
        width: barWidth,
        height: Math.max(1, Math.abs(zeroY - valueY)),
        rx: 3,
        fill: value < 0 ? chartLossColor : value > 0 ? chartGainColor : chartNeutralColor,
        stroke: "none",
        class: "chart-bar",
        tabindex: 0,
        "aria-label": `${person.name}, ${month.label}: ${formatChartAmount(value, isEuro)}${isEuro ? "" : " bevande"}`
      });
      bar.append(svgElement("title", {}, `${person.name} · ${month.label}: ${formatChartAmount(value, isEuro)}${isEuro ? "" : " bevande"}`));
      svg.append(bar);

      const valueLabelY = value > 0
        ? Math.max(margin.top + 12, valueY - 7)
        : value < 0
          ? Math.min(plotBottom - 3, valueY + 14)
          : zeroY - 7;
      svg.append(svgElement("text", {
        x: barCenter,
        y: valueLabelY,
        "text-anchor": "middle",
        class: "chart-value-label"
      }, formatChartAmount(value, isEuro)));

      const personLabel = svgElement("text", {
        x: barCenter,
        y: plotBottom + 14,
        "text-anchor": "middle",
        class: "chart-person-label",
        "aria-label": person.name
      });
      nameLines[personIndex].forEach((line, lineIndex) => {
        personLabel.append(svgElement("tspan", {
          x: barCenter,
          dy: lineIndex === 0 ? 0 : 12
        }, line));
      });
      svg.append(personLabel);
    });

    svg.append(svgElement("text", {
      x: groupCenter,
      y: height - 10,
      "text-anchor": "middle",
      class: "chart-month-label"
    }, month.label));
  });
}

function renderCharts() {
  const allPeople = getChartPeople();
  refreshChartPeople(allPeople);
  const selectedPerson = chartPersonSelect.value;
  const people = selectedPerson === "all"
    ? allPeople
    : allPeople.filter((person) => `person:${person.key}` === selectedPerson);
  const months = getChartMonths(chartRangeSelect.value, selectedPerson);
  const monthlyData = months.map((month) => ({
    hasMovement: false,
    values: new Map(people.map((person) => [person.key, { beverageBalance: 0, balanceCents: 0 }]))
  }));
  const monthIndexByKey = new Map(months.map((month, index) => [month.key, index]));

  for (const entry of entries) {
    const monthIndex = monthIndexByKey.get(entry.date.slice(0, 7));
    if (monthIndex === undefined) continue;

    const month = monthlyData[monthIndex];
    const drinkerKey = getPersonKey(entry.drinker);
    const payerKey = getPersonKey(entry.payer);
    const totalCents = entry.quantity * entry.unitPriceCents;

    if (drinkerKey === selfKey && payerKey !== selfKey) {
  const person = month.values.get(payerKey);
  if (!person) continue;

  month.hasMovement = true;

  person.beverageBalance += entry.quantity;
  person.balanceCents += totalCents;

} else if (payerKey === selfKey && drinkerKey !== selfKey) {
  const person = month.values.get(drinkerKey);
  if (!person) continue;

  month.hasMovement = true;

  person.beverageBalance -= entry.quantity;
  person.balanceCents -= totalCents;
}
  }

  drawBalanceChart(
    document.querySelector("#coffee-chart"),
    document.querySelector("#coffee-chart-empty"),
    months,
    people,
    monthlyData,
    false
  );
  drawBalanceChart(
    document.querySelector("#euro-chart"),
    document.querySelector("#euro-chart-empty"),
    months,
    people,
    monthlyData,
    true
  );
}

function activateTab(selectedTab) {
  const showCharts = selectedTab === chartsTab;
  registerTab.classList.toggle("is-active", !showCharts);
  chartsTab.classList.toggle("is-active", showCharts);
  registerTab.setAttribute("aria-selected", String(!showCharts));
  chartsTab.setAttribute("aria-selected", String(showCharts));
  registerTab.tabIndex = showCharts ? -1 : 0;
  chartsTab.tabIndex = showCharts ? 0 : -1;
  registerPanel.hidden = showCharts;
  chartsPanel.hidden = !showCharts;
  if (showCharts) renderCharts();
}

function render() {
  const periodEntries = selectedEntries();
  renderSummary(periodEntries);
  renderPeople(periodEntries);
  renderBalanceSummary();
  renderHistory(periodEntries);
  if (!chartsPanel.hidden) renderCharts();
}

function setDefaultMonth() {
  monthSelect.value = localDateString().slice(0, 7);
}

function updatePeriodControls() {
  monthSelect.hidden = periodSelect.value !== "month";
  render();
}

form.addEventListener("invalid", (event) => {
  const labels = {
    date: "la data",
    product: "la bevanda",
    quantity: "la quantità",
    drinker: "chi ha bevuto",
    payer: "chi ha pagato",
    price: "il costo per bevanda"
  };
  const field = event.target;
  showMessage(`Controlla ${labels[field.name] || "i campi obbligatori"} e riprova.`);
}, true);

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessage();
  const data = new FormData(form);
  const price = Number(data.get("price"));
  const entry = {
    id: crypto.randomUUID(),
    date: String(data.get("date")),
    product: String(data.get("product")),
    drinker: String(data.get("drinker")).trim(),
    payer: String(data.get("payer")).trim(),
    quantity: Number(data.get("quantity")),
    unitPriceCents: Math.round(price * 100),
    note: String(data.get("note")).trim()
  };

  if (!validateEntry(entry) || !Number.isFinite(price)) {
    showMessage("Controlla i campi: scegli una bevanda e inserisci quantità e costo validi.");
    return;
  }

  try {
    saveEntries([...entries, entry]);
    form.reset();
    form.elements.date.value = localDateString();
    showMessage("Bevanda registrata.");
    window.setTimeout(clearMessage, 2500);
  } catch (error) {
    showMessage(`Impossibile salvare il movimento: ${error.message}`);
  }
});

periodSelect.addEventListener("change", updatePeriodControls);
monthSelect.addEventListener("change", render);
chartRangeSelect.addEventListener("change", renderCharts);
chartPersonSelect.addEventListener("change", renderCharts);
window.addEventListener("resize", () => {
  if (!chartsPanel.hidden) renderCharts();
});
themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    showMessage(`La modalità è attiva, ma non è stato possibile salvarla: ${error.message}`);
  }
});

const tabs = [registerTab, chartsTab];
for (const tab of tabs) {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    activateTab(nextTab);
    nextTab.focus();
  });
}

function exportBackup() {
  const backup = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(backup);
  link.href = url;
  link.download = `offritu-${localDateString()}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showMessage("Backup scaricato.");
  window.setTimeout(clearMessage, 2500);
}

document.querySelectorAll(".export-backup-button").forEach((button) => {
  button.addEventListener("click", exportBackup);
});



movementCsvButton.addEventListener("click", () => {
  const movementEntries = [...selectedEntries()].sort((a, b) => (
    b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
  ));
  if (!movementEntries.length) return;

  const csvRows = [
    ["Data", "Bevanda", "Chi ha bevuto", "Chi ha pagato", "Quantità", "Costo unitario (€)", "Costo totale (€)", "Nota"],
    ...movementEntries.map((entry) => [
      entry.date,
      entry.product,
      entry.drinker,
      entry.payer,
      entry.quantity,
      formatCsvMoney(entry.unitPriceCents),
      formatCsvMoney(entry.quantity * entry.unitPriceCents),
      entry.note
    ])
  ];
  downloadCsv(csvRows, `offritu-movimenti-${localDateString()}.csv`, "Movimenti scaricati.");
});

document.querySelectorAll(".pdf-button").forEach((button) => {
  button.addEventListener("click", () => window.print());
});

document.querySelectorAll(".import-file").forEach((input) => {
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) {
        throw new Error("Il file non contiene un backup valido.");
      }
      const imported = parsed.map(addLegacyProduct);
      if (!imported.every(validateEntry)) throw new Error("Il file non contiene un backup valido.");
      if (!window.confirm(`Sostituire i dati correnti con ${imported.length} movimenti?`)) return;
      saveEntries(imported);
      showMessage("Backup importato.");
      window.setTimeout(clearMessage, 2500);
    } catch (error) {
      showMessage(`Importazione non riuscita: ${error.message}`);
    } finally {
      input.value = "";
    }
  });
});

form.elements.date.value = localDateString();
setDefaultMonth();

try {
  applyTheme(localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light");
} catch (error) {
  applyTheme("light");
  showMessage(`Impossibile caricare la preferenza del tema: ${error.message}`);
}

try {
  entries = loadEntries();
  render();
} catch (error) {
  showMessage(`Impossibile caricare i dati salvati: ${error.message}`);
  form.querySelectorAll("input, button").forEach((control) => { control.disabled = true; });
  document.querySelectorAll(".export-backup-button, .import-file").forEach((control) => { control.disabled = true; });
  movementCsvButton.disabled = true;
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

