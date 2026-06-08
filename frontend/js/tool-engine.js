const params = new URLSearchParams(window.location.search);
const slug = params.get("tool");

const tool = tools.find(t => t.slug === slug);

const title = document.getElementById("toolTitle");
const category = document.getElementById("toolCategory");
const box = document.getElementById("toolBox");

// ==========================
// SAFE INIT
// ==========================
if (!tool) {
title.innerText = "Tool Not Found";
box.innerHTML = "<p>This tool does not exist.</p>";
} else {
title.innerText = tool.name;
category.innerText = `Category: ${tool.category}`;

renderTool(tool.slug);
}

// ==========================
// TOOL ROUTER (CLEAN VERSION)
// ==========================
function renderTool(slug) {
const toolsMap = {
bmi: renderBMI,
age: renderAge,
password: renderPassword
};

const toolFunction = toolsMap[slug];

if (toolFunction) {
toolFunction();
} else {
box.innerHTML = `<p>This tool is under development.</p>`;
}
}

// ==========================
// TOOL UI RENDERERS
// ==========================

function renderBMI() {
box.innerHTML = `     <h3>BMI Calculator</h3>     <input id="w" type="number" placeholder="Weight (kg)">     <input id="h" type="number" placeholder="Height (m)">     <button onclick="calcBMI()">Calculate</button>     <p id="result"></p>
  `;
}

function renderAge() {
box.innerHTML = `     <h3>Age Calculator</h3>     <input id="birth" type="date">     <button onclick="calcAge()">Calculate Age</button>     <p id="result"></p>
  `;
}

function renderPassword() {
box.innerHTML = `     <h3>Password Generator</h3>     <button onclick="generatePassword()">Generate</button>     <p id="result"></p>
  `;
}

// ==========================
// TOOL LOGIC FUNCTIONS
// ==========================

function calcBMI() {
const w = parseFloat(document.getElementById("w").value);
const h = parseFloat(document.getElementById("h").value);

if (!w || !h) return alert("Enter valid values");

const bmi = w / (h * h);
document.getElementById("result").innerText = `BMI: ${bmi.toFixed(2)}`;
}

function calcAge() {
const birth = new Date(document.getElementById("birth").value);
const today = new Date();

if (!birth) return alert("Select valid date");

const age = today.getFullYear() - birth.getFullYear();
document.getElementById("result").innerText = `Age: ${age}`;
}

function generatePassword() {
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!";
let pass = "";

for (let i = 0; i < 12; i++) {
pass += chars[Math.floor(Math.random() * chars.length)];
}

document.getElementById("result").innerText = pass;
}
