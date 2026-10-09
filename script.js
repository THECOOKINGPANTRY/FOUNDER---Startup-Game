
"use strict";

const SAVE_KEY = "founderEmpireSave_v2";
const THEME_KEY = "founderEmpireTheme";
const SIDEBAR_KEY = "founderEmpireSidebar";

const $ = (id) => document.getElementById(id);
const money = (n) => "$" + Math.round(n || 0).toLocaleString("en-AU");
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

const roles = {
  developer: {
    name: "Developer", icon: "⌘", salary: 40, hiring: 120,
    description: "Improves software products and their sales.",
    benefit: "Software sales +12%", benefitType: "software", bonus: 0.12
  },
  designer: {
    name: "Designer", icon: "✳", salary: 30, hiring: 100,
    description: "Makes your products more appealing to customers.",
    benefit: "All sales +8%", benefitType: "all", bonus: 0.08
  },
  marketer: {
    name: "Marketer", icon: "↗", salary: 35, hiring: 110,
    description: "Gets your products in front of more customers.",
    benefit: "Marketing +20%", benefitType: "marketing", bonus: 0.20
  }
};

const upgradeDefinitions = [
  { id: "equipment", name: "Better equipment", icon: "⌘", price: 250, description: "Upgrade your setup and improve product quality.", effect: "Product sales +10%", max: 3 },
  { id: "website", name: "Professional website", icon: "◇", price: 350, description: "Give customers a better first impression.", effect: "All sales +12%", max: 1 },
  { id: "marketing", name: "Marketing campaign", icon: "↗", price: 200, description: "Build awareness and reach new customers.", effect: "Reputation +5", max: 3 },
  { id: "workspace", name: "Dedicated studio", icon: "▦", price: 400, description: "Move beyond your bedroom and hire more people.", effect: "Unlock office level 2", max: 1, office: 2 },
  { id: "office3", name: "Small office", icon: "▤", price: 1100, description: "Give your growing team room to work.", effect: "Unlock office level 3", max: 1, office: 3, requires: 2 },
  { id: "office4", name: "City headquarters", icon: "▥", price: 3500, description: "Make your company a landmark in the city.", effect: "Unlock office level 4", max: 1, office: 4, requires: 3 },
  { id: "office5", name: "Corporate tower", icon: "▦", price: 12000, description: "A headquarters worthy of a major company.", effect: "Unlock office level 5", max: 1, office: 5, requires: 4 },
  { id: "automation", name: "Automation tools", icon: "⚙", price: 1800, description: "Streamline daily work and reduce operating costs.", effect: "Operating costs −15%", max: 1, requires: 2 },
  { id: "secondBrand", name: "Second brand", icon: "✦", price: 2500, description: "Launch another brand under your company.", effect: "Reputation +10", max: 1, requires: 3 }
];

const initialState = () => ({
  day: 1,
  cash: 500,
  reputation: 10,
  xp: 0,
  level: 1,
  officeLevel: 1,
  products: [],
  employees: [],
  upgrades: {},
  revenueTotal: 0,
  expenseTotal: 0,
  profitToday: 0,
  revenueToday: 0,
  expensesToday: 0,
  history: [{ day: 1, revenue: 0, expenses: 0, profit: 0 }],
  activity: [
    { icon: "✦", text: "Your company has been founded.", day: 1 },
    { icon: "$", text: "You invested $500 in your new business.", day: 1 }
  ],
  goalsClaimed: [],
  lastEventDay: 0
});

let game = loadGame();
let pendingModal = null;

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return initialState();
    const saved = JSON.parse(raw);
    const base = initialState();
    const merged = { ...base, ...saved };
    if (!Array.isArray(merged.products)) merged.products = [];
    if (!Array.isArray(merged.employees)) merged.employees = [];
    if (!Array.isArray(merged.history)) merged.history = base.history;
    if (!Array.isArray(merged.activity)) merged.activity = base.activity;
    if (!merged.upgrades || typeof merged.upgrades !== "object") merged.upgrades = {};
    if (!Array.isArray(merged.goalsClaimed)) merged.goalsClaimed = [];
    return merged;
  } catch {
    return initialState();
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    $("saveStatus").textContent = "Saved just now";
  } catch {
    $("saveStatus").textContent = "Unable to save";
  }
}

function addActivity(icon, text) {
  game.activity.unshift({ icon, text, day: game.day });
  game.activity = game.activity.slice(0, 12);
}

function addXP(amount) {
  game.xp += amount;
  let levelled = false;
  while (game.xp >= game.level * 100) {
    game.xp -= game.level * 100;
    game.level += 1;
    game.reputation = clamp(game.reputation + 3, 0, 100);
    levelled = true;
    addActivity("✦", `Company reached level ${game.level}. Reputation increased.`);
  }
  if (levelled) {
    toast("Company level increased!", `You reached level ${game.level}. New opportunities may be available.`);
  }
}

function getSalesMultiplier(product) {
  let multiplier = 1;
  multiplier += game.reputation / 250;
  multiplier += (game.level - 1) * 0.025;
  multiplier += (game.upgrades.equipment || 0) * 0.10;
  if (game.upgrades.website) multiplier += 0.12;
  if (game.upgrades.secondBrand) multiplier += 0.05;

  for (const employee of game.employees) {
    const role = roles[employee.role];
    if (!role) continue;
    if (role.benefitType === "all") multiplier += role.bonus;
    if (role.benefitType === "software" && product.type === "software") multiplier += role.bonus;
  }

  return multiplier;
}

function getMarketingMultiplier() {
  let multiplier = 1;
  for (const employee of game.employees) {
    if (employee.role === "marketer") multiplier += roles.marketer.bonus;
  }
  return multiplier;
}

function getDailyCosts() {
  const salaries = game.employees.reduce((sum, employee) => sum + (roles[employee.role]?.salary || 0), 0);
  const marketing = game.products.reduce((sum, product) => sum + product.marketing, 0);
  const officeCosts = [0, 0, 15, 45, 110, 250][game.officeLevel] || 0;
  const automationReduction = game.upgrades.automation ? 0.85 : 1;
  return {
    salaries,
    marketing: Math.round(marketing * getMarketingMultiplier()),
    office: Math.round(officeCosts * automationReduction),
    total: Math.round((salaries + marketing + officeCosts) * automationReduction)
  };
}

function getOfficeName() {
  return ["", "Home office", "Creative studio", "Small office", "City headquarters", "Corporate tower"][game.officeLevel] || "Home office";
}

function getDayName(day) {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][(day - 1) % 7];
}

function toast(title, message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p>`;
  $("toastStack").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function emptyState(icon, title, description) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${escapeHTML(title)}</strong><p>${escapeHTML(description)}</p></div>`;
}

function switchPage(page) {
  const allowed = ["overview", "products", "team", "office", "finances"];
  if (!allowed.includes(page)) page = "overview";
  document.querySelectorAll(".page").forEach(el => el.classList.toggle("active", el.id === `page-${page}`));
  document.querySelectorAll(".nav-link[data-page]").forEach(el => el.classList.toggle("active", el.dataset.page === page));
  const titles = {
    overview: "Company overview",
    products: "Products & development",
    team: "Your team",
    office: "Office & city",
    finances: "Company finances"
  };
  $("pageTitle").textContent = titles[page];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAll() {
  renderHeader();
  renderStats();
  renderWorld();
  renderGoals();
  renderChart();
  renderActivity();
  renderProducts();
  renderTeam();
  renderOffice();
  renderFinances();
  saveGame();
}

function renderHeader() {
  $("dateLabel").textContent = `DAY ${game.day} · ${getDayName(game.day).toUpperCase()}`;
  $("topCash").textContent = money(game.cash);
  $("sideLevel").textContent = game.level;
  $("heroLevel").textContent = game.level;
  $("welcomeTitle").textContent = game.level < 3 ? "Your empire starts here." : game.level < 6 ? "You're building momentum." : "You're building an empire.";
  $("welcomeText").textContent = `${getOfficeName()} · Day ${game.day}`;
  const xpPercent = clamp((game.xp / (game.level * 100)) * 100, 0, 100);
  $("sideXp").style.width = `${xpPercent}%`;
  $("sideXpText").textContent = `${game.xp} / ${game.level * 100} XP`;
}

function renderStats() {
  const costs = getDailyCosts();
  const profit = game.profitToday;
  $("statCash").textContent = money(game.cash);
  $("statProfit").textContent = `${profit > 0 ? "+" : ""}${money(profit)}`;
  $("statProfit").style.color = profit > 0 ? "var(--green)" : profit < 0 ? "var(--red)" : "var(--text)";
  $("profitHint").textContent = `Daily running costs ${money(costs.total)}`;
  $("cashHint").textContent = game.cash < 200 ? "Cash is running low" : "Available to invest";
  $("statRep").innerHTML = `${game.reputation}<span class="unit">/100</span>`;
  $("repProgress").style.width = `${game.reputation}%`;
  $("statTeam").textContent = game.employees.length;
  $("teamHint").textContent = game.employees.length === 0 ? "Just you for now" : `${game.employees.length} specialist${game.employees.length === 1 ? "" : "s"} hired`;
}

function renderWorld() {
  const level = game.officeLevel;
  $("worldTitle").textContent = getOfficeName();
  $("officeLevel").textContent = `${level} / 5`;
  $("worldEmployees").textContent = `${game.employees.length} hired`;
  $("sceneCaption").textContent = level === 1 ? "Your first workspace" : level === 2 ? "A dedicated creative studio" : level === 3 ? "A growing company office" : level === 4 ? "Your city headquarters" : "Your corporate empire";
  $("buildingSign").textContent = game.upgrades.secondBrand ? "FOUNDER GROUP" : "FOUNDER";
  const building = $("officeBuilding");
  const sizes = {
    1: { width: 174, height: 134 },
    2: { width: 198, height: 155 },
    3: { width: 218, height: 176 },
    4: { width: 242, height: 202 },
    5: { width: 255, height: 218 }
  };
  building.style.width = `${sizes[level].width}px`;
  building.style.height = `${sizes[level].height}px`;
  building.style.background = level >= 4 ? "#d4dfd0" : level >= 2 ? "#e3e2c9" : "#e8e1c8";
  const windows = $("buildingWindows");
  const count = level === 1 ? 12 : level === 2 ? 16 : level === 3 ? 20 : level === 4 ? 24 : 28;
  windows.innerHTML = Array.from({ length: count }, (_, i) => `<i style="${i % 5 === 0 && game.employees.length > 0 ? "background:#f5d99a" : ""}"></i>`).join("");
  windows.style.gridTemplateColumns = `repeat(${level >= 4 ? 4 : 4},1fr)`;
  windows.style.top = level >= 3 ? "45px" : "35px";
  $("buildingWindows").style.bottom = level >= 4 ? "37px" : "32px";
  const scene = $("worldScene");
  scene.dataset.level = level;
  $("cityHeading").textContent = level >= 4 ? "A company on the map" : level >= 2 ? "Your growing business district" : "A small start";
  $("cityRank").textContent = level >= 5 ? "CORPORATE DISTRICT" : level >= 4 ? "CITY DISTRICT" : level >= 2 ? "GROWING DISTRICT" : "STARTUP DISTRICT";
  $("cityWorld").classList.toggle("city-expanded", level >= 3);
  const cityBuildings = document.querySelectorAll(".city-lot");
  cityBuildings.forEach((lot, index) => {
    const label = lot.querySelector("small");
    if (index === 1) {
      label.textContent = level >= 4 ? "HEADQUARTERS" : level >= 2 ? "YOUR HQ" : "HOME OFFICE";
    } else if (index === 2) {
      label.textContent = level >= 3 ? "NEW OFFICE" : "AVAILABLE";
      lot.style.opacity = level >= 3 ? "1" : ".65";
    } else if (index === 3) {
      label.textContent = level >= 4 ? "EXPANSION" : "AVAILABLE";
      lot.style.opacity = level >= 4 ? "1" : ".65";
    }
  });
}

const goals = [
  { id: "firstProduct", icon: "◇", title: "Launch your first product", detail: "Create something to sell.", reward: "100 XP", check: () => game.products.length >= 1, progress: () => game.products.length ? "Completed" : "Not started" },
  { id: "firstHire", icon: "♙", title: "Hire your first employee", detail: "Build a team around you.", reward: "150 XP", check: () => game.employees.length >= 1, progress: () => `${game.employees.length} / 1 hired` },
  { id: "firstThousand", icon: "$", title: "Earn $1,000 in revenue", detail: "Prove your business model.", reward: "200 XP", check: () => game.revenueTotal >= 1000, progress: () => `${Math.min(100, Math.floor(game.revenueTotal / 1000 * 100))}%` },
  { id: "officeTwo", icon: "▦", title: "Move into a studio", detail: "Upgrade your workspace.", reward: "250 XP", check: () => game.officeLevel >= 2, progress: () => game.officeLevel >= 2 ? "Completed" : `${money(400)} needed` },
  { id: "repTwentyFive", icon: "✳", title: "Reach 25 reputation", detail: "Build trust with customers.", reward: "150 XP", check: () => game.reputation >= 25, progress: () => `${game.reputation} / 25` },
  { id: "tenThousand", icon: "↗", title: "Build $10,000 in revenue", detail: "Grow beyond your first customers.", reward: "500 XP", check: () => game.revenueTotal >= 10000, progress: () => `${Math.min(100, Math.floor(game.revenueTotal / 10000 * 100))}%` }
];

function renderGoals() {
  const available = goals.filter(goal => !game.goalsClaimed.includes(goal.id));
  $("goalList").innerHTML = available.slice(0, 4).map(goal => {
    const complete = goal.check();
    return `<div class="goal-item">
      <div class="goal-icon">${goal.icon}</div>
      <div class="goal-copy"><strong>${escapeHTML(goal.title)}</strong><small>${escapeHTML(goal.detail)} · ${escapeHTML(goal.progress())}</small></div>
      ${complete
        ? `<button class="secondary-button claim-goal" data-goal="${goal.id}">Claim</button>`
        : `<span class="goal-reward">${goal.reward}</span>`}
    </div>`;
  }).join("") || emptyState("✦", "All caught up", "Keep growing to unlock new milestones.");
}

function claimGoal(id) {
  const goal = goals.find(item => item.id === id);
  if (!goal || game.goalsClaimed.includes(id) || !goal.check()) return;
  game.goalsClaimed.push(id);
  const reward = parseInt(goal.reward, 10) || 100;
  addXP(reward);
  addActivity("✦", `Milestone completed: ${goal.title}.`);
  toast("Milestone claimed", `${goal.title} · ${reward} XP earned.`);
  renderAll();
}

function renderChart() {
  const recent = game.history.slice(-7);
  const maxRevenue = Math.max(1, ...recent.map(d => d.revenue));
  const total = recent.reduce((sum, d) => sum + d.revenue, 0);
  $("chartRevenue").textContent = money(total);
  $("chartAverage").textContent = `Average ${money(total / Math.max(1, recent.length))}/day`;
  $("revenueChart").innerHTML = recent.map((item, i) => {
    const height = item.revenue > 0 ? Math.max(5, item.revenue / maxRevenue * 100) : 3;
    return `<div class="chart-column"><div class="chart-bar-wrap"><div class="chart-bar" style="height:${height}%" title="${money(item.revenue)}"></div></div><small>${i === recent.length - 1 ? "Now" : "D" + item.day}</small></div>`;
  }).join("");
  $("financeChart").innerHTML = game.history.slice(-10).map((item, i, arr) => {
    const max = Math.max(1, ...arr.map(d => Math.max(d.revenue, d.expenses)));
    return `<div class="chart-column"><div class="chart-bar-wrap" style="gap:3px;align-items:end">
      <div class="chart-bar" style="height:${Math.max(3, item.revenue / max * 100)}%;background:var(--green)" title="Revenue ${money(item.revenue)}"></div>
      <div class="chart-bar" style="height:${Math.max(3, item.expenses / max * 100)}%;background:var(--red)" title="Expenses ${money(item.expenses)}"></div>
    </div><small>${i === arr.length - 1 ? "Now" : "D" + item.day}</small></div>`;
  }).join("");
}

function renderActivity() {
  const icons = ["✦", "$", "↗", "♙", "◇"];
  $("activityList").innerHTML = game.activity.slice(0, 5).map((item, index) => `
    <div class="activity-item">
      <div class="activity-icon">${escapeHTML(item.icon || icons[index % icons.length])}</div>
      <div class="activity-copy"><p>${escapeHTML(item.text)}</p><small>Day ${item.day}</small></div>
    </div>`).join("");
}

function renderProducts() {
  $("productCount").textContent = `${game.products.length} PRODUCT${game.products.length === 1 ? "" : "S"}`;
  const list = $("productList");
  if (!game.products.length) {
    list.innerHTML = emptyState("◇", "Your next big idea", "Create your first product to start generating sales.");
    return;
  }

  const icons = { software: "⌘", creative: "✳", physical: "▣" };
  const labels = { software: "Software / SaaS", creative: "Creative service", physical: "Physical product" };
  list.innerHTML = game.products.map(product => `
    <article class="product-card">
      <div class="product-card-top">
        <div class="product-art">${icons[product.type] || "◇"}</div>
        <div class="product-info"><strong>${escapeHTML(product.name)}</strong><small>${labels[product.type] || "Product"} · ${product.launched ? "Live in market" : "In development"}</small></div>
        <div class="product-price"><strong>${money(product.price)}</strong><small>per sale</small></div>
      </div>
      <div class="product-metrics">
        <div><span>Sales</span><strong>${product.sales || 0}</strong></div>
        <div><span>Revenue</span><strong>${money(product.revenue || 0)}</strong></div>
        <div><span>Marketing / day</span><strong>${money(product.marketing)}</strong></div>
      </div>
      <div class="product-actions">
        <label style="flex:1;min-width:0">Price
          <input aria-label="Price for ${escapeHTML(product.name)}" type="number" min="1" max="10000" value="${product.price}" data-product-price="${product.id}">
        </label>
        <label style="flex:1;min-width:0">Marketing/day
          <input aria-label="Marketing budget for ${escapeHTML(product.name)}" type="number" min="0" max="10000" value="${product.marketing}" data-product-marketing="${product.id}">
        </label>
        <button class="secondary-button save-product" data-product="${product.id}">Save</button>
      </div>
    </article>`).join("");
}

function renderTeam() {
  const salaryTotal = game.employees.reduce((sum, employee) => sum + roles[employee.role].salary, 0);
  $("teamSummary").innerHTML = `
    <div class="team-summary"><small>Team members</small><strong>${game.employees.length}</strong></div>
    <div class="team-summary"><small>Daily salaries</small><strong>${money(salaryTotal)}</strong></div>
    <div class="team-summary"><small>Productivity bonus</small><strong>+${Math.round((game.employees.reduce((sum, employee) => sum + roles[employee.role].bonus, 0)) * 100)}%</strong></div>`;

  $("hireGrid").innerHTML = Object.entries(roles).map(([id, role]) => {
    const count = game.employees.filter(employee => employee.role === id).length;
    const max = game.officeLevel === 1 ? 2 : game.officeLevel === 2 ? 4 : game.officeLevel === 3 ? 8 : game.officeLevel === 4 ? 15 : 30;
    const locked = game.employees.length >= max;
    return `<article class="hire-card">
      <div class="avatar">${role.icon}</div>
      <h3>${role.name}</h3>
      <p>${role.description}</p>
      <div class="hire-pay"><span>Hiring cost</span><strong>${money(role.hiring)}</strong></div>
      <div class="hire-pay"><span>Daily salary</span><strong>${money(role.salary)}</strong></div>
      <div class="hire-pay"><span>Bonus</span><strong>${role.benefit}</strong></div>
      <button class="primary-button hire-button" data-role="${id}" ${locked || game.cash < role.hiring ? "disabled" : ""}>${locked ? "Upgrade office to hire" : game.cash < role.hiring ? "Not enough cash" : `Hire ${role.name}`}</button>
      <small style="margin-top:8px;color:var(--muted)">${count} hired</small>
    </article>`;
  }).join("");

  $("rosterCount").textContent = `${game.employees.length} EMPLOYEE${game.employees.length === 1 ? "" : "S"}`;
  $("rosterList").innerHTML = game.employees.length ? game.employees.map(employee => {
    const role = roles[employee.role];
    return `<div class="roster-item">
      <div class="avatar">${role.icon}</div>
      <div class="roster-info"><strong>${escapeHTML(employee.name)}</strong><small>${role.name} · ${role.benefit}</small></div>
      <div class="roster-cost"><strong>${money(role.salary)}/day</strong><small>Employee</small></div>
      <button class="secondary-button fire-button" data-employee="${employee.id}" title="Dismiss employee">×</button>
    </div>`;
  }).join("") : emptyState("♙", "Your team starts with you", "Hire a specialist when your business is ready.");
}

function renderOffice() {
  const current = game.officeLevel;
  $("upgradeGrid").innerHTML = upgradeDefinitions.map(item => {
    const owned = game.upgrades[item.id] || 0;
    const maxed = owned >= item.max;
    const lockedByOffice = item.requires && current < item.requires;
    const lockedByLevel = item.id === "office3" && current < 2 || item.id === "office4" && current < 3 || item.id === "office5" && current < 4;
    const locked = lockedByOffice || lockedByLevel;
    const price = item.price * (item.id === "equipment" ? Math.pow(1.8, owned) : 1);
    const canBuy = !maxed && !locked && game.cash >= price;
    const label = maxed ? "Owned" : locked ? `Requires office ${item.requires || current + 1}` : game.cash < price ? "Not enough cash" : `Buy · ${money(price)}`;
    return `<article class="upgrade-card">
      <div class="upgrade-icon">${item.icon}</div>
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="upgrade-bottom"><strong>${escapeHTML(item.effect)}${item.max > 1 ? ` · ${owned}/${item.max}` : ""}</strong></div>
      <button class="${maxed ? "secondary-button" : "primary-button"}" data-upgrade="${item.id}" ${canBuy ? "" : "disabled"} style="width:100%;margin-top:13px">${label}</button>
    </article>`;
  }).join("");
}

function renderFinances() {
  const costs = getDailyCosts();
  $("financeRevenue").textContent = money(game.revenueTotal);
  $("financeExpenses").textContent = money(game.expenseTotal);
  $("financeProfit").textContent = money(game.revenueTotal - game.expenseTotal);
  $("financeBurn").textContent = money(costs.total);
  const parts = [
    ["Employee salaries", costs.salaries],
    ["Product marketing", costs.marketing],
    ["Office costs", costs.office]
  ];
  const max = Math.max(1, ...parts.map(item => item[1]));
  $("costBreakdown").innerHTML = parts.map(([label, value]) => `
    <div class="cost-line"><div class="cost-line-top"><span>${label}</span><strong>${money(value)}/day</strong></div>
      <div class="cost-track"><span style="width:${value / max * 100}%"></span></div>
    </div>`).join("");
  if (game.cash < costs.total * 3 && costs.total > 0) {
    $("financeAdvice").textContent = "Your cash reserve is low compared with your daily costs. Consider increasing sales, lowering marketing, or dismissing a team member.";
  } else if (!game.products.length) {
    $("financeAdvice").textContent = "You have no products generating income yet. Develop a product to start bringing in revenue.";
  } else {
    $("financeAdvice").textContent = "Tip: reinvest your profits in product quality, marketing and people. Keep enough cash aside to cover your daily operating costs.";
  }
}

function developProduct() {
  const name = $("productName").value.trim();
  const type = $("productType").value;
  const price = clamp(Number($("productPrice").value) || 1, 1, 10000);
  const marketing = clamp(Number($("productMarketing").value) || 0, 0, 10000);
  const cost = type === "physical" ? 220 : type === "creative" ? 120 : 150;

  if (!name) {
    toast("Give your product a name", "Enter a name before developing your product.");
    $("productName").focus();
    return;
  }
  if (game.cash < cost) {
    toast("Not enough cash", `You need ${money(cost)} to develop this product.`);
    return;
  }

  game.cash -= cost;
  game.expenseTotal += cost;
  game.expensesToday += cost;
  const product = {
    id: `p${Date.now()}${Math.floor(Math.random() * 1000)}`,
    name, type, price, marketing,
    sales: 0, revenue: 0, launched: true
  };
  game.products.push(product);
  game.reputation = clamp(game.reputation + 2, 0, 100);
  addXP(25);
  addActivity("◇", `${name} launched at ${money(price)} per sale.`);
  toast("Product launched!", `${name} is now available in the market.`);
  $("productName").value = "";
  renderAll();
}

function hireEmployee(roleId) {
  const role = roles[roleId];
  if (!role || game.cash < role.hiring) return;
  const max = game.officeLevel === 1 ? 2 : game.officeLevel === 2 ? 4 : game.officeLevel === 3 ? 8 : game.officeLevel === 4 ? 15 : 30;
  if (game.employees.length >= max) {
    toast("Office is full", "Upgrade your office to support more employees.");
    return;
  }
  game.cash -= role.hiring;
  game.expenseTotal += role.hiring;
  game.expensesToday += role.hiring;
  const firstNames = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Sam", "Avery", "Jamie", "Charlie", "Drew", "Robin"];
  const lastNames = ["Parker", "Reed", "Morgan", "Bennett", "Hayes", "Ellis", "Brooks", "Blake", "Carter", "Miller"];
  const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
  game.employees.push({ id: `e${Date.now()}`, name, role: roleId });
  addXP(20);
  addActivity("♙", `${name} joined as your ${role.name.toLowerCase()}.`);
  toast("New teammate!", `${name} joined the company.`);
  renderAll();
}

function dismissEmployee(id) {
  const employee = game.employees.find(item => item.id === id);
  if (!employee) return;
  if (!confirm(`Dismiss ${employee.name}? This removes their daily salary and their productivity bonus.`)) return;
  game.employees = game.employees.filter(item => item.id !== id);
  addActivity("♙", `${employee.name} left the company.`);
  renderAll();
  toast("Team updated", `${employee.name} is no longer employed.`);
}

function saveProduct(id) {
  const product = game.products.find(item => item.id === id);
  if (!product) return;
  const priceInput = document.querySelector(`[data-product-price="${id}"]`);
  const marketingInput = document.querySelector(`[data-product-marketing="${id}"]`);
  if (!priceInput || !marketingInput) return;
  product.price = clamp(Number(priceInput.value) || 1, 1, 10000);
  product.marketing = clamp(Number(marketingInput.value) || 0, 0, 10000);
  addActivity("◇", `${product.name} pricing and marketing were updated.`);
  renderAll();
  toast("Product updated", `${product.name} settings have been saved.`);
}

function buyUpgrade(id) {
  const item = upgradeDefinitions.find(upgrade => upgrade.id === id);
  if (!item) return;
  const owned = game.upgrades[id] || 0;
  const price = item.price * (id === "equipment" ? Math.pow(1.8, owned) : 1);
  if (owned >= item.max || game.cash < price) return;
  if (item.requires && game.officeLevel < item.requires) return;
  if (id === "office3" && game.officeLevel < 2 || id === "office4" && game.officeLevel < 3 || id === "office5" && game.officeLevel < 4) return;

  game.cash -= price;
  game.expenseTotal += price;
  game.expensesToday += price;
  game.upgrades[id] = owned + 1;
  if (item.office) game.officeLevel = Math.max(game.officeLevel, item.office);
  if (id === "marketing") game.reputation = clamp(game.reputation + 5, 0, 100);
  if (id === "secondBrand") game.reputation = clamp(game.reputation + 10, 0, 100);
  addXP(20);
  addActivity(item.icon, `${item.name} purchased for ${money(price)}.`);
  toast("Upgrade purchased", `${item.name} is now part of your company.`);
  renderAll();
}

function getDailySales(product) {
  const base = {
    software: 2.8,
    creative: 2.1,
    physical: 1.7
  }[product.type] || 2;
  const marketingBoost = 1 + Math.sqrt(Math.max(0, product.marketing)) / 5;
  const priceFactor = clamp(30 / Math.max(5, product.price), 0.25, 2.5);
  const randomFactor = 0.72 + Math.random() * 0.65;
  const demand = base * getSalesMultiplier(product) * marketingBoost * priceFactor * randomFactor;
  return Math.max(0, Math.floor(demand));
}

function advanceDay() {
  game.day += 1;
  game.revenueToday = 0;
  game.expensesToday = 0;
  const costs = getDailyCosts();
  let revenue = 0;

  for (const product of game.products) {
    const sales = getDailySales(product);
    const earned = sales * product.price;
    product.sales += sales;
    product.revenue += earned;
    revenue += earned;
  }

  game.cash += revenue;
  game.revenueTotal += revenue;
  game.revenueToday = revenue;
  game.expenseTotal += costs.total;
  game.expensesToday += costs.total;
  game.cash -= costs.total;
  game.profitToday = revenue - costs.total;
  game.reputation = clamp(game.reputation + (revenue > costs.total ? 1 : revenue > 0 ? 0.3 : -0.4), 0, 100);
  addXP(Math.max(2, Math.floor(revenue / 100) + (revenue > 0 ? 2 : 0)));
  game.history.push({ day: game.day, revenue, expenses: costs.total, profit: revenue - costs.total });
  game.history = game.history.slice(-30);

  if (revenue > 0) addActivity("$", `Day ${game.day}: generated ${money(revenue)} in sales.`);
  else addActivity("↗", `Day ${game.day}: no sales recorded. Review your product and marketing.`);
  if (costs.total > 0) addActivity("−", `Daily operating costs: ${money(costs.total)}.`);
  if (game.cash < 0) {
    game.reputation = clamp(game.reputation - 2, 0, 100);
    addActivity("!", "Cash balance has gone negative. Your business is at risk.");
  }

  renderAll();
  toast(`Day ${game.day} complete`, `Sales ${money(revenue)} · Costs ${money(costs.total)} · Net ${money(revenue - costs.total)}`);

  if (game.day % 4 === 0 && game.day !== game.lastEventDay) {
    game.lastEventDay = game.day;
    setTimeout(showRandomEvent, 500);
  }
}

function showRandomEvent() {
  const events = [
    {
      icon: "✦", title: "A creator notices your product",
      text: "A popular creator has offered to feature your product. It could bring in new customers.",
      options: [
        { label: "Pay $100 for promotion", effect: () => { if (game.cash < 100) return false; game.cash -= 100; game.expenseTotal += 100; game.reputation = clamp(game.reputation + 8, 0, 100); addActivity("✦", "A creator promoted your product."); return true; } },
        { label: "Decline for now", effect: () => true }
      ]
    },
    {
      icon: "⚙", title: "Unexpected equipment repair",
      text: "Some equipment needs repairing. Fixing it now avoids a bigger problem later.",
      options: [
        { label: "Repair it · $80", effect: () => { if (game.cash < 80) return false; game.cash -= 80; game.expenseTotal += 80; addActivity("⚙", "Equipment was repaired."); return true; } },
        { label: "Do it yourself", effect: () => { game.reputation = clamp(game.reputation - 2, 0, 100); addActivity("⚙", "You delayed an equipment repair."); return true; } }
      ]
    },
    {
      icon: "↗", title: "Customer buzz",
      text: "Customers are talking about your company. You can turn this attention into momentum.",
      options: [
        { label: "Launch a small campaign · $60", effect: () => { if (game.cash < 60) return false; game.cash -= 60; game.expenseTotal += 60; game.reputation = clamp(game.reputation + 6, 0, 100); addActivity("↗", "A customer campaign boosted awareness."); return true; } },
        { label: "Enjoy the attention", effect: () => { game.reputation = clamp(game.reputation + 2, 0, 100); return true; } }
      ]
    },
    {
      icon: "$", title: "A small investor is interested",
      text: "An investor likes your progress and offers a small amount of funding in exchange for a little time to pitch your vision.",
      options: [
        { label: "Accept $250 funding", effect: () => { game.cash += 250; addActivity("$", "An investor contributed $250."); return true; } },
        { label: "Pass on the offer", effect: () => true }
      ]
    }
  ];

  const event = events[Math.floor(Math.random() * events.length)];
  openModal(event.icon, event.title, event.text, event.options.map(option => ({
    label: option.label,
    action: () => {
      const success = option.effect();
      closeModal();
      if (!success) toast("Not enough cash", "You couldn't afford that option.");
      renderAll();
    }
  })));
}

function openModal(icon, title, text, actions) {
  pendingModal = true;
  $("modalIcon").textContent = icon;
  $("modalTitle").textContent = title;
  $("modalText").textContent = text;
  $("modalEyebrow").textContent = "COMPANY EVENT";
  $("modalActions").innerHTML = "";
  actions.forEach(action => {
    const button = document.createElement("button");
    button.className = action.label.toLowerCase().includes("decline") || action.label.toLowerCase().includes("pass") ? "secondary-button" : "primary-button";
    button.textContent = action.label;
    button.addEventListener("click", action.action);
    $("modalActions").appendChild(button);
  });
  $("modalBackdrop").hidden = false;
}

function closeModal() {
  pendingModal = null;
  $("modalBackdrop").hidden = true;
}

function resetGame() {
  if (!confirm("Start a new company? This will erase your current FOUNDER save.")) return;
  game = initialState();
  closeModal();
  renderAll();
  switchPage("overview");
  toast("New company founded", "Your next empire starts with $500.");
}

function setupTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.dataset.theme = theme;
  $("themeText").textContent = theme === "dark" ? "Light mode" : "Dark mode";
  $("themeIcon").textContent = theme === "dark" ? "☼" : "☾";
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY, next);
  $("themeText").textContent = next === "dark" ? "Light mode" : "Dark mode";
  $("themeIcon").textContent = next === "dark" ? "☼" : "☾";
}

function setupSidebar() {
  const collapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  updateCollapseButton();
}

function updateCollapseButton() {
  const collapsed = document.body.classList.contains("sidebar-collapsed");
  $("collapseButton").textContent = collapsed ? "⇥" : "⇤";
  $("collapseButton").title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  $("collapseButton").setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-collapsed");
  localStorage.setItem(SIDEBAR_KEY, document.body.classList.contains("sidebar-collapsed"));
  updateCollapseButton();
}

function setupEvents() {
  document.querySelectorAll(".nav-link[data-page]").forEach(button => {
    button.addEventListener("click", () => switchPage(button.dataset.page));
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => switchPage(button.dataset.goto));
  });

  $("collapseButton").addEventListener("click", toggleSidebar);
  $("themeButton").addEventListener("click", toggleTheme);
  $("resetButton").addEventListener("click", resetGame);
  $("nextDayButton").addEventListener("click", advanceDay);
  $("developButton").addEventListener("click", developProduct);

  $("productType").addEventListener("change", () => {
    const type = $("productType").value;
    const cost = type === "physical" ? 220 : type === "creative" ? 120 : 150;
    $("developmentCost").textContent = money(cost);
    $("developButton").textContent = `Develop product — ${money(cost)}`;
  });

  $("goalList").addEventListener("click", event => {
    const button = event.target.closest("[data-goal]");
    if (button) claimGoal(button.dataset.goal);
  });

  $("hireGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-role]");
    if (button) hireEmployee(button.dataset.role);
  });

  $("rosterList").addEventListener("click", event => {
    const button = event.target.closest("[data-employee]");
    if (button) dismissEmployee(button.dataset.employee);
  });

  $("upgradeGrid").addEventListener("click", event => {
    const button = event.target.closest("[data-upgrade]");
    if (button) buyUpgrade(button.dataset.upgrade);
  });

  $("productList").addEventListener("click", event => {
    const button = event.target.closest("[data-product]");
    if (button) saveProduct(button.dataset.product);
  });

  $("modalBackdrop").addEventListener("click", event => {
    if (event.target === $("modalBackdrop")) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && pendingModal) closeModal();
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    const text = button.querySelector(".nav-text")?.textContent?.trim();
    if (text) button.dataset.tooltip = text;
  });
}

function init() {
  setupTheme();
  setupSidebar();
  setupEvents();
  renderAll();
  switchPage("overview");
}

init();
