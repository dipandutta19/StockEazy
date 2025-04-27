const apiKey = "WEI87EGK99AWPF56";
let chart = null;
let symbol = "";

const tabs = {
    'Home': 'tab-home',
    'Search': 'tab-search',
    'About': 'tab-about'
};

// --- Navigation ---
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        this.classList.add('active');

        Object.values(tabs).forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove('active', 'animate__animated', 'animate__fadeIn');
        });

        const targetId = tabs[this.textContent.trim()];
        const target = document.getElementById(targetId);
        target.classList.add('active', 'animate__animated', 'animate__fadeIn');
    });
});

// --- Utility Functions ---
function showError(message, containerId = 'searchResult') {
    document.getElementById(containerId).innerHTML = `
      <div class="alert alert-danger">${message}</div>
    `;
}

function showLoading(containerId = 'searchResult') {
    document.getElementById(containerId).innerHTML = `
      <div class="spinner-container">
        <div class="spinner-border" role="status"></div>
      </div>
    `;
}

// --- Autocomplete with Debounce ---
let debounceTimer;
document.getElementById('stockSearch').addEventListener('input', function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(autocompleteSymbols, 300);
});

async function autocompleteSymbols() {
    const input = document.getElementById("stockSearch").value.trim();
    const datalist = document.getElementById("symbolList");
    datalist.innerHTML = "";

    if (input.length < 2) return;

    try {
        const response = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${input}&apikey=${apiKey}`);
        const data = await response.json();
        const matches = data.bestMatches || [];

        matches.forEach(match => {
            const option = document.createElement("option");
            option.value = match["1. symbol"];
            option.label = match["2. name"];
            datalist.appendChild(option);

            option.addEventListener("click", function() {
                document.getElementById("stockSearch").value = option.value;
                searchStock();
            });
        });
    } catch (error) {
        console.error("Autocomplete error:", error);
    }
}

// --- Search Stock ---
async function searchStock() {
    const rawInput = document.getElementById('stockSearch').value.trim();
    const result = document.getElementById('searchResult');

    if (!rawInput) {
        showError("Please enter a stock name or symbol.");
        return;
    }

    showLoading();

    try {
        symbol = rawInput.toUpperCase();

        if (!/^[A-Za-z0-9.\-]+$/.test(symbol)) {
            const searchRes = await fetch(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(rawInput)}&apikey=${apiKey}`);
            const searchData = await searchRes.json();
            if (!searchData.bestMatches || searchData.bestMatches.length === 0) {
                showError(`No stock found for <strong>${rawInput}</strong>.`);
                hideLoading();
                return;
            }
            symbol = searchData.bestMatches[0]["1. symbol"];
        }

        const [quoteRes, overviewRes] = await Promise.all([
            fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`),
            fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`)
        ]);

        const quoteData = await quoteRes.json();
        const overviewData = await overviewRes.json();

        const quote = quoteData["Global Quote"];
        const overview = overviewData;

        if (!overview || !overview["Name"]) {
            showError(`Stock symbol <strong>${symbol}</strong> not found.`);
            hideLoading();
            return;
        }

        if (!quote || !quote["01. symbol"] || !overview || !overview["Name"]) {
            showError(`Stock symbol <strong>${symbol}</strong> not found.`);
            hideLoading();
            return;
        }

        const change = quote["09. change"];
        const changePercent = quote["10. change percent"];
        const isPositive = parseFloat(change) >= 0;

        const changeBadge = `
          <span class="badge ${isPositive ? 'bg-success' : 'bg-danger'}">
            ${isPositive ? '▲' : '▼'} ${change} (${changePercent})
          </span>`;

        result.innerHTML = `
          <div class="result-card shadow p-4 animate__animated animate__fadeIn">
            <div class="card-body">
              <h3 class="card-title mb-3">
                <i class="bi bi-graph-up-arrow text-primary"></i> ${quote["01. symbol"]} (${overview["Name"]})
                ${changeBadge}
              </h3>

              ${generateQuoteDetails(quote)}

              <div class="row justify-content-center mt-4">
                <div class="col text-center">
                  ${generateTimeframeButtons()}
                </div>
              </div>

              <div class="mt-4 chart-container">
                <canvas id="stockChart" width="400" height="200" aria-label="Stock Price Chart"></canvas>
              </div>

              <div class="mt-4 text-start">
                <p><strong>Sector:</strong> ${overview["Sector"] || "N/A"}</p>
                <p><strong>Industry:</strong> ${overview["Industry"] || "N/A"}</p>
                <p class="text-muted small">${overview["Description"] || "No description available."}</p>
              </div>
            </div>
          </div>`;

        await renderChart(symbol, 'daily');
        hideLoading();
    } catch (error) {
        console.error(error);
        showError("An error occurred while fetching stock data.");
        hideLoading();
    }
}

function showLoading() {
    document.getElementById('loading').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function generateQuoteDetails(quote) {
    return `
      <div class="row mb-2"><div class="col-6"><strong>Price:</strong></div><div class="col-6 text-success fw-bold">$${quote["05. price"]}</div></div>
      <div class="row mb-2"><div class="col-6"><strong>Open:</strong></div><div class="col-6">$${quote["02. open"]}</div></div>
      <div class="row mb-2"><div class="col-6"><strong>High:</strong></div><div class="col-6">$${quote["03. high"]}</div></div>
      <div class="row mb-2"><div class="col-6"><strong>Low:</strong></div><div class="col-6">$${quote["04. low"]}</div></div>
      <div class="row mb-2"><div class="col-6"><strong>Previous Close:</strong></div><div class="col-6">$${quote["08. previous close"]}</div></div>
      <div class="row mb-2"><div class="col-6"><strong>Volume:</strong></div><div class="col-6">${quote["06. volume"]}</div></div>
      <div class="row mt-3"><div class="col text-muted small">Last Trading Day: ${quote["07. latest trading day"]}</div></div>`;
}

function generateTimeframeButtons() {
    return `
      <div id="timeframeButtons">
        <button class="btn btn-outline-primary me-2" data-timeframe="hourly" onclick="changeTimeframe('hourly')">Hourly</button>
        <button class="btn btn-outline-primary me-2" data-timeframe="daily" onclick="changeTimeframe('daily')">Daily</button>
        <button class="btn btn-outline-primary me-2" data-timeframe="weekly" onclick="changeTimeframe('weekly')">Weekly</button>
        <button class="btn btn-outline-primary me-2" data-timeframe="monthly" onclick="changeTimeframe('monthly')">Monthly</button>
        <button class="btn btn-outline-primary" data-timeframe="yearly" onclick="changeTimeframe('yearly')">Yearly</button>
      </div>`;
}

// --- Chart Functions ---
async function renderChart(symbol, timeframe = 'daily') {
    let functionType;
    let interval = '';

    switch (timeframe) {
        case 'hourly':
            functionType = 'TIME_SERIES_INTRADAY';
            interval = '&interval=60min';
            break;
        case 'daily':
            functionType = 'TIME_SERIES_DAILY';
            break;
        case 'weekly':
            functionType = 'TIME_SERIES_WEEKLY';
            break;
        case 'monthly':
        case 'yearly':
            functionType = 'TIME_SERIES_MONTHLY';
            break;
    }

    try {
        const url = `https://www.alphavantage.co/query?function=${functionType}${interval}&symbol=${symbol}&apikey=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        const keyMap = {
            'TIME_SERIES_INTRADAY': 'Time Series (60min)',
            'TIME_SERIES_DAILY': 'Time Series (Daily)',
            'TIME_SERIES_WEEKLY': 'Weekly Time Series',
            'TIME_SERIES_MONTHLY': 'Monthly Time Series'
        };

        const series = data[keyMap[functionType]];
        if (!series) {
            showError('No chart data found.');
            return;
        }

        const labels = Object.keys(series).reverse();
        const values = labels.map(date => parseFloat(series[date]['4. close']));

        if (chart) chart.destroy();

        const canvas = document.getElementById('stockChart');
        canvas.width = 400;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');

        // ✨ Fade animation starts
        canvas.classList.remove('fade-chart');
        void canvas.offsetWidth;
        canvas.classList.add('fade-chart');
        // ✨ Fade animation ends

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${symbol} Closing Price`,
                    data: values,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    tension: 0.4,
                    pointRadius: 3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 90,
                            minRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    } catch (error) {
        console.error("Error rendering chart:", error);
        showError('Failed to load chart.');
    }
}

// Timeframe switcher
function changeTimeframe(timeframe) {
    renderChart(symbol, timeframe);
    updateActiveButton(timeframe);
}

function updateActiveButton(activeTimeframe) {
    const buttons = document.querySelectorAll('#timeframeButtons button');
    buttons.forEach(button => {
        if (button.getAttribute('data-timeframe') === activeTimeframe) {
            button.classList.remove('btn-outline-primary');
            button.classList.add('btn-primary');
        } else {
            button.classList.remove('btn-primary');
            button.classList.add('btn-outline-primary');
        }
    });
}

// Trigger search on 'Enter'
document.getElementById("stockSearch").addEventListener("keypress", function (e) {
    if (e.key === "Enter") searchStock();
});
