
const SAVE_KEY = "founderGameSave_v1";

const BUSINESS_TYPES = {
  software: {
    name: "Digital Software Studio",
    icon: "💻",
    description: "Build digital tools and software products.",
    developmentCost: 150,
    baseDemand: 3,
    unitCost: 2,
    defaultPrice: 40
  },
  agency: {
    name: "Creative Design Agency",
    icon: "🎨",
    description: "Create branding and design work for clients.",
    developmentCost: 80,
    baseDemand: 4,
    unitCost: 5,
    defaultPrice: 30
  },
  product: {
    name: "Product Startup",
    icon: "📦",
    description: "Design and sell physical products.",
    developmentCost: 200,
    baseDemand: 2,
    unitCost: 12,
    defaultPrice: 60
  }
};

function newGame() {
  return {
    businessType: null,
    companyName: "",
    cash: 500,
    day: 1,
    reputation: 10,
    quality: 25,
    customers: 0,
    lifetimeRevenue: 0,
    lifetimeExpenses: 0,
    expenses: {
      development: 0,
      marketing: 0,
      wages: 0,
      upgrades: 0,
      other: 0
    },
    product: null,
    employees: [],
    upgrades: {
      equipment: false,
      homeOffice: false
    },
    history: [],
    activity: ["Your entrepreneurial journey is ready to begin."],
    lastRevenue: 0,
    lastProfit: 0,
    lastExpenses: 0,
    lifetimeSales: 0
  };
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return newGame();

    const saved = JSON.parse(raw);
    const base = newGame();

    return {
      ...base,
      ...saved,
      expenses: { ...base.expenses, ...(saved.expenses || {}) },
      upgrades: { ...base.upgrades, ...(saved.upgrades || {}) },
      employees: Array.isArray(saved.employees) ? saved.employees : [],
      history: Array.isArray(saved.history) ? saved.history : [],
      activity: Array.isArray(saved.activity) ? saved.activity : []
    };
  } catch (error) {
    console.error("Could not load save:", error);
    return newGame();
  }
}

let game = loadGame();

function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(game));
}

function money(amount) {
  return "$" + Math.round(amount).toLocaleString("en-AU");
}

function getBusiness() {
  return BUSINESS_TYPES[game.businessType] || null;
}

function addActivity(message) {
  game.activity.unshift(`Day ${game.day}: ${message}`);
  game.activity = game.activity.slice(0, 12);
}

function spend(amount, category, description) {
  amount = Math.round(amount);
  if (amount < 0 || game.cash < amount) return false;

  game.cash -= amount;
  game.lifetimeExpenses += amount;

  if (Object.hasOwn(game.expenses, category)) {
    game.expenses[category] += amount;
  } else {
    game.expenses.other += amount;
  }

  if (description) addActivity(`${description} (${money(amount)}).`);
  return true;
}

function earn(amount) {
  amount = Math.max(0, Math.round(amount));
  game.cash += amount;
  game.lifetimeRevenue += amount;
  return amount;
}

function startBusiness(type) {
  if (!BUSINESS_TYPES[type]) return;

  if (game.businessType) {
    const confirmed = confirm(
      "Starting a new company will erase your current save. Continue?"
    );
    if (!confirmed) return;
    game = newGame();
  }

  game.businessType = type;
  game.companyName = BUSINESS_TYPES[type].name;
  addActivity(`You founded ${game.companyName}.`);
  saveGame();
  window.location.href = "index.html";
}

function resetGame() {
  if (!confirm("Permanently reset your FOUNDER save? This cannot be undone.")) {
    return;
  }

  localStorage.removeItem(SAVE_KEY);
  game = newGame();
  window.location.href = "index.html";
}

function launchProduct() {
  const business = getBusiness();

  if (!business) {
    alert("Choose a startup first.");
    return;
  }

  if (game.product) {
    alert("You have already launched your first product. More product slots can be added in a future update.");
    return;
  }

  const nameInput = document.getElementById("product-name");
  const priceInput = document.getElementById("product-price");
  const marketingInput = document.getElementById("marketing-budget");

  const name = nameInput ? nameInput.value.trim() : "";
  const price = Number(priceInput?.value);
  const marketing = Number(marketingInput?.value);

  if (!name) {
    alert("Give your product a name first.");
    return;
  }

  if (!Number.isFinite(price) || price < 5 || price > 500) {
    alert("Choose a price between $5 and $500.");
    return;
  }

  if (!Number.isFinite(marketing) || marketing < 0 || marketing > 200) {
    alert("Choose a daily marketing budget between $0 and $200.");
    return;
  }

  if (game.cash < business.developmentCost) {
    alert("You don't have enough cash to develop this product.");
    return;
  }

  if (!spend(business.developmentCost, "development", `Developed ${name}`)) {
    return;
  }

  game.product = {
    name,
    price: Math.round(price),
    marketing: Math.round(marketing),
    sales: 0
  };

  addActivity(`${name} launched at ${money(price)} per sale.`);
  saveGame();
  renderAll();
  alert(`${name} is ready! Return to the dashboard and advance the day to start selling.`);
}

function buyUpgrade(type) {
  const upgrades = {
    equipment: {
      cost: 250,
      name: "Professional equipment",
      check: () => !game.upgrades.equipment,
      apply: () => {
        game.upgrades.equipment = true;
      }
    },
    homeOffice: {
      cost: 400,
      name: "Small home office",
      check: () => !game.upgrades.homeOffice,
      apply: () => {
        game.upgrades.homeOffice = true;
      }
    }
  };

  const upgrade = upgrades[type];
  if (!upgrade || !game.businessType) return;

  if (!upgrade.check()) {
    alert("You've already purchased this upgrade.");
    return;
  }

  if (game.cash < upgrade.cost) {
    alert("Not enough cash for this upgrade.");
    return;
  }

  if (!spend(upgrade.cost, "upgrades", `Purchased ${upgrade.name}`)) return;

  upgrade.apply();
  saveGame();
  renderAll();
}

function hireEmployee() {
  if (!game.businessType) {
    alert("Choose a startup first.");
    return;
  }

  if (game.employees.length >= 5) {
    alert("Your first office can support up to five employees in this version.");
    return;
  }

  if (game.cash < 100) {
    alert("You need $100 to hire this employee.");
    return;
  }

  if (!spend(100, "upgrades", "Hired a junior specialist")) return;

  game.employees.push({
    name: `Specialist ${game.employees.length + 1}`,
    salary: 25
  });

  addActivity("A junior specialist joined your team.");
  saveGame();
  renderAll();
}

function advanceDay() {
  const business = getBusiness();

  if (!business) {
    window.location.href = "startup.html";
    return;
  }

  if (!game.product) {
    alert("Develop your first product before advancing the business day.");
    window.location.href = "products.html";
    return;
  }

  game.day++;

  let revenue = 0;
  let expensesToday = 0;
  let unitsSold = 0;

  // Charge marketing first.
  const marketing = game.product.marketing;
  if (marketing > 0) {
    if (spend(marketing, "marketing", `Marketing campaign`)) {
      expensesToday += marketing;
    } else {
      addActivity("You couldn't afford today's marketing campaign.");
    }
  }

  // Pay employees.
  for (const employee of game.employees) {
    if (spend(employee.salary, "wages", `Paid ${employee.name}`)) {
      expensesToday += employee.salary;
    } else {
      addActivity("You couldn't afford all employee wages today.");
      break;
    }
  }

  // Sales are affected by quality, price, marketing, reputation and upgrades.
  const priceFactor = Math.max(
    0.2,
    Math.min(1.5, business.defaultPrice / game.product.price)
  );

  const qualityFactor = 0.5 + game.quality / 100;
  const reputationFactor = 0.75 + game.reputation / 100;
  const marketingFactor = 1 + Math.min(marketing / 50, 2);
  const officeFactor =
    1 +
    (game.upgrades.equipment ? 0.15 : 0) +
    (game.upgrades.homeOffice ? 0.2 : 0);

  const employeeFactor = 1 + game.employees.length * 0.12;

  const demand =
    business.baseDemand *
    qualityFactor *
    reputationFactor *
    marketingFactor *
    officeFactor *
    employeeFactor *
    priceFactor;

  unitsSold = Math.max(0, Math.floor(demand + Math.random() * 2 - 0.5));

  // Product-specific costs are charged for every unit sold.
  const variableCosts = unitsSold * business.unitCost;

  if (variableCosts > 0) {
    if (game.cash >= variableCosts) {
      spend(variableCosts, "other", `Fulfilled ${unitsSold} sale(s)`);
      expensesToday += variableCosts;
    } else {
      // The business cannot fulfil more sales than it can afford.
      unitsSold = Math.floor(game.cash / business.unitCost);
      const adjustedCosts = unitsSold * business.unitCost;

      if (adjustedCosts > 0) {
        spend(adjustedCosts, "other", `Fulfilled ${unitsSold} sale(s)`);
        expensesToday += adjustedCosts;
      }
    }
  }

  revenue = unitsSold * game.product.price;
  earn(revenue);

  game.product.sales += unitsSold;
  game.lifetimeSales += unitsSold;
  game.customers += Math.max(0, Math.ceil(unitsSold * 0.6));

  // Quality and reputation improve gradually with successful sales.
  if (unitsSold > 0) {
    game.reputation = Math.min(
      100,
      game.reputation + (game.quality >= 50 ? 2 : 1)
    );
  } else {
    game.reputation = Math.max(0, game.reputation - 1);
  }

  // A successful product gets a small chance of a news event.
  if (unitsSold >= 5 && Math.random() < 0.2) {
    game.reputation = Math.min(100, game.reputation + 3);
    addActivity("Your product received positive attention! Reputation increased.");
  }

  game.lastRevenue = revenue;
  game.lastExpenses = expensesToday;
  game.lastProfit = revenue - expensesToday;

  game.history.unshift({
    day: game.day,
    revenue,
    expenses: expensesToday,
    profit: revenue - expensesToday,
    unitsSold
  });

  game.history = game.history.slice(0, 10);

  addActivity(
    `Day completed: ${unitsSold} sale(s), ${money(revenue)} revenue, ${money(expensesToday)} tracked costs.`
  );

  saveGame();
  renderAll();
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHTML(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function show(id, visible) {
  const element = document.getElementById(id);
  if (element) element.hidden = !visible;
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function renderDashboard() {
  const active = Boolean(game.businessType);
  show("no-company", !active);
  show("dashboard-content", active);

  if (!active) return;

  setText("day-label", `YOUR COMPANY · DAY ${game.day}`);
  setText("welcome-text", `Welcome to ${game.companyName}.`);
  setText("stat-cash", money(game.cash));
  setText("stat-revenue", money(game.lastRevenue));
  setText("stat-profit", money(game.lifetimeRevenue - game.lifetimeExpenses));
  setText("stat-reputation", `${game.reputation}/100`);

  const reputationBar = document.getElementById("reputation-bar");
  if (reputationBar) reputationBar.style.width = `${game.reputation}%`;

  setText("company-name", game.companyName);
  setText(
    "company-description",
    getBusiness().description + (game.product ? ` Your product is ${game.product.name}.` : " Develop your first product to begin.")
  );

  setText("company-stage", game.upgrades.homeOffice ? "Home Office" : "Bedroom Startup");
  setText("overview-products", game.product ? "1" : "0");
  setText("overview-employees", String(game.employees.length));
  setText("overview-customers", game.customers.toLocaleString("en-AU"));

  const objectives = [
    ["Choose a business", Boolean(game.businessType)],
    ["Launch a product", Boolean(game.product)],
    ["Earn $1,000 revenue", game.lifetimeRevenue >= 1000]
  ];

  setHTML("objectives", objectives.map(([name, done]) => `
    <div class="list-item">
      <div class="item-title">${done ? "✓" : "○"} ${name}</div>
      <span class="pill">${done ? "COMPLETE" : "IN PROGRESS"}</span>
    </div>
  `).join(""));

  setHTML("activity-feed", game.activity.length
    ? game.activity.map(item => `<div class="list-item"><div class="item-desc">${safeText(item)}</div></div>`).join("")
    : '<div class="empty">No activity yet.</div>');
}

function renderProducts() {
  const active = Boolean(game.businessType);
  show("product-locked", !active);
  show("products-content", active);
  if (!active) return;

  setText("product-cash", `${money(game.cash)} available`);
  setText("development-info", `Development cost: ${money(getBusiness().developmentCost)}. You currently have ${money(game.cash)}.`);
  setText("launch-button", game.product ? "Product Launched" : `Develop Product — ${money(getBusiness().developmentCost)}`);

  const button = document.getElementById("launch-button");
  if (button) button.disabled = Boolean(game.product);

  if (game.product) {
    setText("product-count", "1 PRODUCT");
    setHTML("product-list", `
      <div class="list-item">
        <div class="item-left">
          <div class="icon-box">${getBusiness().icon}</div>
          <div>
            <div class="item-title">${safeText(game.product.name)}</div>
            <div class="item-desc">${safeText(getBusiness().name)} · ${game.product.sales} total sales</div>
            <div class="green small" style="margin-top:6px">${money(game.product.price)} per sale</div>
          </div>
        </div>
        <span class="pill">LIVE</span>
      </div>
      <div class="money-row"><span class="muted">Daily marketing budget</span><strong>${money(game.product.marketing)}</strong></div>
      <div class="btn-row" style="margin-top:15px">
        <button class="btn" onclick="changeMarketing()">Change Marketing</button>
        <button class="btn" onclick="improveQuality()">Improve Quality — $100</button>
      </div>
    `);
  } else {
    setText("product-count", "0 PRODUCTS");
    setHTML("product-list", '<div class="empty">Your first product will appear here once you launch it.</div>');
  }
}

function changeMarketing() {
  if (!game.product) return;
  const input = prompt("Enter a new daily marketing budget ($0–$200):", game.product.marketing);
  if (input === null) return;

  const value = Number(input);
  if (!Number.isFinite(value) || value < 0 || value > 200) {
    alert("Enter an amount between $0 and $200.");
    return;
  }

  game.product.marketing = Math.round(value);
  addActivity(`Daily marketing budget changed to ${money(value)}.`);
  saveGame();
  renderAll();
}

function improveQuality() {
  if (!game.product) return;
  if (game.quality >= 100) {
    alert("Your product quality is already at its maximum.");
    return;
  }

  if (!spend(100, "development", "Improved product quality")) {
    alert("You need $100 to improve product quality.");
    return;
  }

  game.quality = Math.min(100, game.quality + 15);
  addActivity(`Product quality increased to ${game.quality}/100.`);
  saveGame();
  renderAll();
}

function renderOffice() {
  const active = Boolean(game.businessType);
  show("office-locked", !active);
  show("office-content", active);
  if (!active) return;

  setText("office-cash", `${money(game.cash)} available`);
  setText("office-name", game.upgrades.homeOffice ? "Small Home Office" : "Bedroom Office");
  setText("office-stage", game.upgrades.homeOffice ? "LEVEL 2" : "LEVEL 1");
  setText("office-title", game.upgrades.homeOffice ? "Your own workspace" : "Your bedroom desk");
  setText("office-description", game.upgrades.homeOffice ? "A dedicated workspace to grow your company." : "A laptop, a desk and plenty of ambition.");

  const bonus = (game.upgrades.equipment ? 15 : 0) + (game.upgrades.homeOffice ? 20 : 0);
  setText("office-bonus", `+${bonus}%`);
  setText("team-count", String(game.employees.length));

  setText("equipment-button", game.upgrades.equipment ? "Owned" : "Buy — $250");
  setText("home-office-button", game.upgrades.homeOffice ? "Owned" : "Buy — $400");
  setText("hire-button", game.employees.length >= 5 ? "Team Full" : "Hire — $100");

  const equipmentButton = document.getElementById("equipment-button");
  const homeButton = document.getElementById("home-office-button");
  const hireButton = document.getElementById("hire-button");

  if (equipmentButton) equipmentButton.disabled = game.upgrades.equipment;
  if (homeButton) homeButton.disabled = game.upgrades.homeOffice;
  if (hireButton) hireButton.disabled = game.employees.length >= 5;

  setHTML("employee-list", game.employees.length
    ? game.employees.map(employee => `
      <div class="list-item">
        <div class="item-left"><div class="icon-box">👤</div>
          <div><div class="item-title">${safeText(employee.name)}</div><div class="item-desc">Specialist · ${money(employee.salary)}/day</div></div>
        </div>
        <span class="pill">ACTIVE</span>
      </div>
    `).join("")
    : '<div class="empty">You haven’t hired anyone yet.</div>');
}

function renderFinances() {
  const active = Boolean(game.businessType);
  show("finance-locked", !active);
  show("finance-content", active);
  if (!active) return;

  const profit = game.lifetimeRevenue - game.lifetimeExpenses;

  setText("finance-day", `DAY ${game.day}`);
  setText("finance-cash", money(game.cash));
  setText("finance-revenue", money(game.lifetimeRevenue));
  setText("finance-expenses", money(game.lifetimeExpenses));
  setText("finance-profit", money(profit));

  setText("expense-development", money(game.expenses.development));
  setText("expense-marketing", money(game.expenses.marketing));
  setText("expense-wages", money(game.expenses.wages));
  setText("expense-upgrades", money(game.expenses.upgrades));
  setText("expense-other", money(game.expenses.other));

  setHTML("finance-history", game.history.length
    ? game.history.map(day => `
      <div class="list-item">
        <div><div class="item-title">Day ${day.day}</div><div class="item-desc">${day.unitsSold} sale(s) · Revenue ${money(day.revenue)} · Costs ${money(day.expenses)}</div></div>
        <strong class="${day.profit >= 0 ? "green" : "red"}">${day.profit >= 0 ? "+" : ""}${money(day.profit)}</strong>
      </div>
    `).join("")
    : '<div class="empty">Advance the day to generate your first financial results.</div>');

  let advice = "Keep monitoring your cash balance and reinvest carefully.";

  if (game.cash < 100) {
    advice = "Cash is running low. Reduce marketing, avoid upgrades and focus on generating revenue.";
  } else if (profit < 0) {
    advice = "Your company has spent more than it has earned so far. Review your costs and make sure your product can attract customers.";
  } else if (game.lifetimeRevenue >= 1000) {
    advice = "You've passed $1,000 in lifetime revenue. Consider improving product quality or investing in your workspace.";
  } else if (game.product && game.product.marketing > 50) {
    advice = "Your marketing budget is substantial. Check whether the extra sales justify the daily cost.";
  }

  setText("finance-advice", advice);
}

function renderAll() {
  renderDashboard();
  renderProducts();
  renderOffice();
  renderFinances();
}

document.addEventListener("DOMContentLoaded", () => {
  renderAll();
});
