const params = new URLSearchParams(window.location.search);
const rawSlug = params.get("slug") || window.location.pathname.split("/").pop() || "";
const slug = normalizeSlug(rawSlug);

const toolName = document.getElementById("toolName");
const toolCategory = document.getElementById("toolCategory");
const toolBox = document.getElementById("toolBox");
const affiliateLink = document.getElementById("affiliateLink");
const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;

let currentTool = null;
let stopwatchTimer = null;
let stopwatchStart = 0;
let stopwatchElapsed = 0;
let countdownTimer = null;
let typingStartedAt = null;

function normalizeSlug(value) {
  const aliases = {
    percentagecalculator: "percentage-calculator",
    bmi: "bmi-calculator",
    age: "age-calculator",
    unitconverter: "unit-converter",
    pdftoword: "pdf-to-word",
    pdfword: "pdf-to-word",
    wordtopdf: "word-to-pdf",
    mergepdf: "merge-pdf",
    splitpdf: "split-pdf",
    pdfcompressor: "pdf-compressor",
    qrcode: "qr-code-generator",
    qrgenerator: "qr-code-generator",
    password: "password-generator",
    wordcounter: "word-counter",
    charactercounter: "character-counter"
  };

  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const compact = raw.replace(/-/g, "");
  return aliases[raw] || aliases[compact] || raw;
}

async function loadTool() {
  if (!slug) {
    showError("Tool Not Found", "No tool was selected.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/tools/${encodeURIComponent(slug)}`);

    if (!res.ok) {
      showError("Tool Not Found", "This tool does not exist or is not active.");
      return;
    }

    currentTool = await res.json();
    trackToolView(currentTool.slug);
    document.title = `${currentTool.name} | Smart Tools Hub`;
    toolName.innerText = currentTool.name;
    toolCategory.innerText = `Category: ${currentTool.category}`;
    affiliateLink.href = currentTool.affiliateUrl
      ? `${API_BASE}/api/tools/${encodeURIComponent(currentTool.slug)}/affiliate`
      : "affiliate-disclosure.html";
    affiliateLink.innerHTML = `
      <span>${currentTool.affiliateCategory || "Recommended"}</span>
      <strong>${currentTool.affiliateLabel || `Recommended resource for ${currentTool.name}`}</strong>
    `;
    updateToolSEO(currentTool);

    renderTool(currentTool);
    loadRelatedTools(currentTool);
    if (typeof smartLoadAds === "function") {
      smartLoadAds("top", ".header + .ad");
      smartLoadAds("in-tool", ".footer + .ad, .ad:last-of-type");
    }
  } catch (err) {
    showError("Connection Error", "Failed to load this tool. Make sure the backend is running.");
    console.error(err);
  }
}

function trackToolView(toolSlug) {
  apiFetch(`${API_BASE}/api/tools/${encodeURIComponent(toolSlug)}/view`, {
    method: "POST",
    keepalive: true
  }).catch(() => {});
  if (typeof smartTrack === "function") {
    smartTrack("tool_view", { toolSlug });
  }
}

function showError(title, message) {
  toolName.innerText = title;
  toolCategory.innerText = "";
  toolBox.innerHTML = `<p>${message}</p>`;

  const fallbackTitle = title === "Tool Not Found" ? "Tool Not Found | Smart Tools Hub" : "Smart Tools Hub";
  document.title = fallbackTitle;
  upsertMeta('meta[name="description"]', {
    name: "description",
    content: "Browse free online tools and business solutions on Smart Tools Hub."
  });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: fallbackTitle });
  upsertMeta('meta[property="og:description"]', {
    property: "og:description",
    content: "Browse free online tools and business solutions on Smart Tools Hub."
  });
  upsertMeta('meta[property="og:url"]', {
    property: "og:url",
    content: `${window.location.origin}${window.location.pathname}`
  });
}

function setBox(tool, body) {
  toolBox.innerHTML = `
    <h2>${tool.name}</h2>
    <p class="tool-description">${tool.description || descriptions[tool.slug] || "Use this free online tool for quick everyday work."}</p>
    ${body}
  `;
}

function upsertMeta(selector, attrs) {
  let tag = document.head.querySelector(selector);

  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }

  Object.entries(attrs).forEach(([key, value]) => tag.setAttribute(key, value));
}

function updateToolSEO(tool) {
  const url = tool.canonicalUrl || `${window.location.origin}${window.location.pathname}?slug=${encodeURIComponent(tool.slug)}`;
  const title = tool.metaTitle || `${tool.name} | Smart Tools Hub`;
  const description = tool.metaDescription || tool.description || `Use ${tool.name} free online at Smart Tools Hub.`;

  document.title = title;
  upsertMeta('meta[name="description"]', { name: "description", content: description });
  if (tool.metaKeywords) upsertMeta('meta[name="keywords"]', { name: "keywords", content: tool.metaKeywords });
  upsertMeta('meta[property="og:title"]', { property: "og:title", content: title });
  upsertMeta('meta[property="og:description"]', { property: "og:description", content: description });
  upsertMeta('meta[property="og:url"]', { property: "og:url", content: url });
  upsertMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
  if (tool.ogImage) upsertMeta('meta[property="og:image"]', { property: "og:image", content: tool.ogImage });
  upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary" });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;

  const oldSchema = document.getElementById("toolSchema");
  if (oldSchema) oldSchema.remove();

  const schema = document.createElement("script");
  schema.type = "application/ld+json";
  schema.id = "toolSchema";
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    description,
    applicationCategory: tool.category,
    operatingSystem: "Any",
    url
  });
  document.head.appendChild(schema);
}

async function loadRelatedTools(tool) {
  const container = document.getElementById("relatedTools");
  if (!container) return;

  try {
    let rows = [];

    if (tool.category === "ai") {
      const res = await fetch(`${API_BASE}/api/tools`);
      const tools = await res.json();
      rows = tools
        .filter((item) => item.category === "ai" && item.slug !== tool.slug)
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .slice(0, 6);
    } else {
      const res = await fetch(`${API_BASE}/api/analytics/related-tools/${encodeURIComponent(tool.slug)}`);
      const data = await res.json();
      rows = [...(data.related || []), ...(data.popular || [])]
      .filter((item, index, list) => list.findIndex((other) => other.slug === item.slug) === index)
      .slice(0, 6);
    }

    container.innerHTML = rows.length ? "" : `<p>No related tools yet.</p>`;
    rows.forEach((item) => {
      const card = document.createElement("a");
      card.className = "related-tool-card";
      card.href = `/tools/${encodeURIComponent(item.slug)}`;
      card.innerHTML = `<strong>${item.name}</strong><span>${formatToolCategory(item.category)}</span>`;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = "";
  }
}

function formatToolCategory(category = "utility") {
  if (String(category).toLowerCase() === "ai") return "AI";
  return String(category)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function result(value) {
  document.getElementById("result").innerHTML = value;
}

function readNumber(id) {
  return Number(document.getElementById(id).value);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function copyResult() {
  const text = document.getElementById("result")?.innerText || "";
  navigator.clipboard?.writeText(text);
}

function renderTool(tool) {
  const renderers = {
    "calculator": renderExpressionTool,
    "percentage-calculator": renderPercentage,
    "average-calculator": renderAverage,
    "fraction-calculator": renderFraction,
    "scientific-calculator": renderScientific,
    "ratio-calculator": renderRatio,
    "discount-calculator": renderDiscount,
    "tip-calculator": renderTip,
    "loan-calculator": renderLoan,
    "interest-calculator": renderInterest,
    "compound-interest-calculator": renderCompoundInterest,
    "mortgage-calculator": renderMortgage,
    "tax-calculator": renderTax,
    "profit-margin-calculator": renderProfitMargin,
    "currency-calculator": renderCurrency,
    "savings-calculator": renderSavings,
    "bmi-calculator": renderBMI,
    "bmr-calculator": renderBMR,
    "calorie-calculator": renderCalorie,
    "ideal-weight-calculator": renderIdealWeight,
    "body-fat-calculator": renderBodyFat,
    "water-intake-calculator": renderWaterIntake,
    "pregnancy-due-date-calculator": renderPregnancyDueDate,
    "heart-rate-calculator": renderHeartRate,
    "age-calculator": renderAge,
    "unit-converter": () => renderConverter(tool, "length"),
    "length-converter": () => renderConverter(tool, "length"),
    "weight-converter": () => renderConverter(tool, "weight"),
    "temperature-converter": renderTemperature,
    "time-converter": () => renderConverter(tool, "time"),
    "speed-converter": () => renderConverter(tool, "speed"),
    "area-converter": () => renderConverter(tool, "area"),
    "volume-converter": () => renderConverter(tool, "volume"),
    "data-storage-converter": () => renderConverter(tool, "data"),
    "time-zone-converter": renderTimeZone,
    "date-difference-calculator": renderDateDifference,
    "countdown-timer": renderCountdown,
    "stopwatch": renderStopwatch,
    "qr-code-generator": renderQR,
    "password-generator": renderPassword,
    "username-generator": renderUsername,
    "random-number-generator": renderRandomNumber,
    "uuid-generator": renderUUID,
    "lorem-ipsum-generator": renderLorem,
    "hashtag-generator": renderHashtag,
    "meta-tag-generator": renderMetaTags,
    "robots-txt-generator": renderRobots,
    "sitemap-generator": renderSitemap,
    "slug-generator": renderSlug,
    "color-palette-generator": renderPalette,
    "word-counter": renderTextStats,
    "character-counter": renderTextStats,
    "sentence-counter": renderTextStats,
    "case-converter": renderCaseConverter,
    "text-reverser": renderTextReverser,
    "remove-extra-spaces": renderSpaceCleaner,
    "line-counter": renderTextStats,
    "text-sorter": renderTextSorter,
    "duplicate-line-remover": renderDuplicateRemover,
    "find-and-replace": renderFindReplace,
    "url-encoder": renderURLEncoder,
    "url-decoder": renderURLDecoder,
    "base64-encoder": renderBase64Encoder,
    "base64-decoder": renderBase64Decoder,
    "json-formatter": renderJSONFormatter,
    "json-validator": renderJSONValidator,
    "html-encoder": renderHTMLEncoder,
    "html-decoder": renderHTMLDecoder,
    "markdown-previewer": renderMarkdownPreviewer,
    "csv-to-json-converter": renderCSVToJSON,
    "seo-title-checker": renderSEOTitle,
    "meta-description-checker": renderMetaDescription,
    "keyword-density-checker": renderKeywordDensity,
    "serp-snippet-preview": renderSERP,
    "heading-structure-checker": renderHeadingChecker,
    "open-graph-checker": renderOpenGraph,
    "twitter-card-checker": renderTwitterCard,
    "canonical-url-checker": renderCanonical,
    "schema-markup-helper": renderSchema,
    "alt-text-checker": renderAltText,
    "image-compressor": renderImageCompressor,
    "image-resizer": renderImageResizer,
    "pdf-to-word": renderDocumentTool,
    "word-to-pdf": renderDocumentTool,
    "pdf-compressor": renderDocumentTool,
    "merge-pdf": renderDocumentTool,
    "split-pdf": renderDocumentTool,
    "color-picker": renderColorPicker,
    "hex-to-rgb-converter": renderHexToRGB,
    "rgb-to-hex-converter": renderRGBToHex,
    "gradient-generator": renderGradient,
    "css-box-shadow-generator": renderBoxShadow,
    "css-button-generator": renderButtonGenerator,
    "email-validator": renderEmailValidator,
    "phone-number-formatter": renderPhoneFormatter,
    "ip-address-lookup": renderIPLookup,
    "screen-resolution-checker": renderScreenResolution,
    "browser-info-checker": renderBrowserInfo,
    "typing-speed-test": renderTypingTest,
    "reading-time-calculator": renderReadingTime,
    "ai-prompt-generator": renderAIPromptGenerator,
    "ai-blog-title-generator": renderAIBlogTitleGenerator,
    "ai-meta-description-generator": renderAIMetaDescriptionGenerator,
    "ai-email-writer": renderAIEmailWriter,
    "ai-social-caption-generator": renderAISocialCaptionGenerator,
    "ai-business-idea-generator": renderAIBusinessIdeaGenerator
  };

  const renderer = renderers[tool.slug] || renderTextStats;
  renderer(tool);
}

const descriptions = {
  "calculator": "Calculate simple arithmetic expressions quickly.",
  "percentage-calculator": "Find percentages, percentage change, and values from rates.",
  "average-calculator": "Calculate the average of numbers separated by commas or spaces.",
  "fraction-calculator": "Add, subtract, multiply, or divide two fractions.",
  "scientific-calculator": "Run common scientific calculations such as powers, roots, sine, cosine, and logarithms.",
  "ratio-calculator": "Simplify a ratio and calculate equivalent ratio values.",
  "discount-calculator": "Calculate sale price and total savings after a discount.",
  "tip-calculator": "Split a bill and calculate tips per person.",
  "loan-calculator": "Estimate monthly loan payments from principal, rate, and term.",
  "bmi-calculator": "Calculate body mass index from weight and height."
};

function actionButton(label, fn) {
  return `<button class="primary-btn tool-action" data-action="${fn.replace("()", "")}">${label}</button>`;
}

function copyButton() {
  return `<button class="secondary-btn tool-action" data-action="copyResult">Copy Result</button>`;
}

function renderExpressionTool(tool) {
  setBox(tool, `
    <input id="expr" class="tool-input" placeholder="Example: 25 * (4 + 10)">
    ${actionButton("Calculate", "calculateExpression()")}
    <p id="result" class="result"></p>
  `);
}

function calculateExpression() {
  const value = document.getElementById("expr").value.trim();

  if (!/^[0-9+\-*/().\s%]+$/.test(value)) {
    return result("Please enter a valid math expression.");
  }

  try {
    const tokens = value.replace(/\s+/g, "").match(/\d+(\.\d+)?|[()+\-*/%]/g);

    if (!tokens || tokens.join("") !== value.replace(/\s+/g, "")) {
      return result("Invalid expression.");
    }

    const precedence = {
      "+": 1,
      "-": 1,
      "*": 2,
      "/": 2,
      "%": 2
    };

    const output = [];
    const operators = [];

    tokens.forEach(token => {
      if (!isNaN(token)) {
        output.push(Number(token));
      } else if (token === "(") {
        operators.push(token);
      } else if (token === ")") {
        while (operators.length && operators[operators.length - 1] !== "(") {
          output.push(operators.pop());
        }
        operators.pop();
      } else {
        while (
          operators.length &&
          precedence[operators[operators.length - 1]] >= precedence[token]
        ) {
          output.push(operators.pop());
        }
        operators.push(token);
      }
    });

    while (operators.length) {
      output.push(operators.pop());
    }

    const stack = [];

    output.forEach(token => {
      if (typeof token === "number") {
        stack.push(token);
      } else {
        const b = stack.pop();
        const a = stack.pop();

        if (token === "+") stack.push(a + b);
        if (token === "-") stack.push(a - b);
        if (token === "*") stack.push(a * b);
        if (token === "/") stack.push(a / b);
        if (token === "%") stack.push(a % b);
      }
    });

    result("Result: " + stack[0]);

  } catch (error) {
    console.error("Calculator error:", error);
    result("Unable to calculate expression.");
  }
}

function renderPercentage(tool) {
  setBox(tool, `
    <input id="value" class="tool-input" type="text" inputmode="decimal" placeholder="Value">
    <input id="percent" class="tool-input" type="text" inputmode="decimal" placeholder="Percent">
    ${actionButton("Calculate Percent", "calculatePercentage()")}
    <p id="result" class="result"></p>
  `);
}

function calculatePercentage() {
  const value = readNumber("value");
  const percent = readNumber("percent");
  result(`${percent}% of ${value} = ${(value * percent / 100).toFixed(2)}`);
}

function renderAverage(tool) {
  setBox(tool, `
    <textarea id="numbers" class="tool-textarea" placeholder="Enter numbers separated by commas or spaces"></textarea>
    ${actionButton("Calculate Average", "calculateAverage()")}
    <p id="result" class="result"></p>
  `);
}

function numberList(id = "numbers") {
  return document.getElementById(id).value.split(/[\s,]+/).map(Number).filter(n => !Number.isNaN(n));
}

function calculateAverage() {
  const nums = numberList();
  if (!nums.length) return result("Enter at least one number.");
  result(`Average: ${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)} | Count: ${nums.length}`);
}

function renderFraction(tool) {
  setBox(tool, `
    <input id="f1" class="tool-input" placeholder="First fraction, e.g. 1/2">
    <select id="op" class="tool-input"><option>+</option><option>-</option><option>*</option><option>/</option></select>
    <input id="f2" class="tool-input" placeholder="Second fraction, e.g. 3/4">
    ${actionButton("Calculate Fraction", "calculateFraction()")}
    <p id="result" class="result"></p>
  `);
}

function parseFraction(value) {
  const parts = value.split("/").map(Number);
  if (parts.length === 1) return [parts[0], 1];
  return [parts[0], parts[1]];
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : Math.abs(a);
}

function calculateFraction() {
  const [a, b] = parseFraction(document.getElementById("f1").value);
  const [c, d] = parseFraction(document.getElementById("f2").value);
  const op = document.getElementById("op").value;
  if (!a || !b || !c || !d) return result("Enter valid fractions.");
  let n;
  let den;
  if (op === "+") [n, den] = [a * d + c * b, b * d];
  if (op === "-") [n, den] = [a * d - c * b, b * d];
  if (op === "*") [n, den] = [a * c, b * d];
  if (op === "/") [n, den] = [a * d, b * c];
  const div = gcd(n, den);
  result(`Result: ${n / div}/${den / div}`);
}

function renderScientific(tool) {
  setBox(tool, `
    <input id="sciValue" class="tool-input" type="text" inputmode="decimal" placeholder="Number">
    <select id="sciOp" class="tool-input">
      <option value="sqrt">Square root</option><option value="square">Square</option><option value="cube">Cube</option>
      <option value="sin">Sine</option><option value="cos">Cosine</option><option value="tan">Tangent</option>
      <option value="log">Log10</option><option value="ln">Natural log</option>
    </select>
    ${actionButton("Calculate", "calculateScientific()")}
    <p id="result" class="result"></p>
  `);
}

function calculateScientific() {
  const x = readNumber("sciValue");
  const op = document.getElementById("sciOp").value;
  const map = {
    sqrt: Math.sqrt(x), square: x ** 2, cube: x ** 3, sin: Math.sin(x),
    cos: Math.cos(x), tan: Math.tan(x), log: Math.log10(x), ln: Math.log(x)
  };
  result(`Result: ${Number(map[op]).toFixed(6)}`);
}

function renderRatio(tool) {
  setBox(tool, `
    <input id="a" class="tool-input" type="text" inputmode="decimal" placeholder="First value">
    <input id="b" class="tool-input" type="text" inputmode="decimal" placeholder="Second value">
    ${actionButton("Simplify Ratio", "calculateRatio()")}
    <p id="result" class="result"></p>
  `);
}

function calculateRatio() {
  const a = readNumber("a");
  const b = readNumber("b");
  if (!a || !b) return result("Enter two valid numbers.");
  const div = gcd(a, b);
  result(`Simplified ratio: ${a / div}:${b / div}`);
}

function renderDiscount(tool) {
  setBox(tool, `
    <input id="price" class="tool-input" type="text" inputmode="decimal" placeholder="Original price">
    <input id="discount" class="tool-input" type="text" inputmode="decimal" placeholder="Discount %">
    ${actionButton("Calculate Sale Price", "calculateDiscount()")}
    <p id="result" class="result"></p>
  `);
}

function calculateDiscount() {
  const price = readNumber("price");
  const discount = readNumber("discount");
  const savings = price * discount / 100;
  result(`Sale price: ${(price - savings).toFixed(2)} | You save: ${savings.toFixed(2)}`);
}

function renderTip(tool) {
  setBox(tool, `
    <input id="bill" class="tool-input" type="text" inputmode="decimal" placeholder="Bill amount">
    <input id="tip" class="tool-input" type="text" inputmode="decimal" value="15" placeholder="Tip %">
    <input id="people" class="tool-input" type="text" inputmode="decimal" value="1" placeholder="People">
    ${actionButton("Calculate Tip", "calculateTip()")}
    <p id="result" class="result"></p>
  `);
}

function calculateTip() {
  const bill = readNumber("bill");
  const tip = readNumber("tip");
  const people = readNumber("people") || 1;
  const tipAmount = bill * tip / 100;
  result(`Tip: ${tipAmount.toFixed(2)} | Total: ${(bill + tipAmount).toFixed(2)} | Per person: ${((bill + tipAmount) / people).toFixed(2)}`);
}

function renderLoan(tool) {
  setBox(tool, financeFields("Loan principal", "Annual interest %", "Years", "calculateLoan()"));
}

function financeFields(a, b, c, fn) {
  return `
    <input id="amount" class="tool-input" type="text" inputmode="decimal" placeholder="${a}">
    <input id="rate" class="tool-input" type="text" inputmode="decimal" placeholder="${b}">
    <input id="years" class="tool-input" type="text" inputmode="decimal" placeholder="${c}">
    ${actionButton("Calculate", fn)}
    <p id="result" class="result"></p>
  `;
}

function calculateLoan() {
  const p = readNumber("amount");
  const r = readNumber("rate") / 100 / 12;
  const n = readNumber("years") * 12;
  const payment = (p * r) / (1 - Math.pow(1 + r, -n));
  result(`Monthly payment: ${payment.toFixed(2)} | Total paid: ${(payment * n).toFixed(2)}`);
}

function renderInterest(tool) {
  setBox(tool, financeFields("Principal", "Annual interest %", "Years", "calculateSimpleInterest()"));
}

function calculateSimpleInterest() {
  const p = readNumber("amount");
  const r = readNumber("rate");
  const t = readNumber("years");
  const interest = p * r * t / 100;
  result(`Interest: ${interest.toFixed(2)} | Total: ${(p + interest).toFixed(2)}`);
}

function renderCompoundInterest(tool) {
  setBox(tool, financeFields("Principal", "Annual interest %", "Years", "calculateCompoundInterest()"));
}

function calculateCompoundInterest() {
  const p = readNumber("amount");
  const r = readNumber("rate") / 100;
  const t = readNumber("years");
  const total = p * Math.pow(1 + r / 12, 12 * t);
  result(`Future value: ${total.toFixed(2)} | Interest earned: ${(total - p).toFixed(2)}`);
}

function renderMortgage(tool) { renderLoan(tool); }
function renderTax(tool) { setBox(tool, financeFields("Amount", "Tax %", "1", "calculateTax()")); }
function calculateTax() {
  const amount = readNumber("amount");
  const tax = amount * readNumber("rate") / 100;
  result(`Tax: ${tax.toFixed(2)} | Total with tax: ${(amount + tax).toFixed(2)}`);
}
function renderProfitMargin(tool) { setBox(tool, financeFields("Revenue", "Cost", "1", "calculateProfitMargin()")); }
function calculateProfitMargin() {
  const revenue = readNumber("amount");
  const cost = readNumber("rate");
  result(`Profit: ${(revenue - cost).toFixed(2)} | Margin: ${(((revenue - cost) / revenue) * 100).toFixed(2)}%`);
}
function renderCurrency(tool) { setBox(tool, financeFields("Amount", "Exchange rate", "1", "calculateCurrency()")); }
function calculateCurrency() { result(`Converted amount: ${(readNumber("amount") * readNumber("rate")).toFixed(2)}`); }
function renderSavings(tool) { setBox(tool, financeFields("Monthly savings", "Annual return %", "Years", "calculateSavings()")); }
function calculateSavings() {
  const monthly = readNumber("amount");
  const r = readNumber("rate") / 100 / 12;
  const n = readNumber("years") * 12;
  const total = monthly * ((Math.pow(1 + r, n) - 1) / r);
  result(`Estimated savings: ${total.toFixed(2)}`);
}

function renderBMI(tool) {
  setBox(tool, `
    <input id="weight" class="tool-input" type="text" inputmode="decimal" placeholder="Weight in kg">
    <input id="height" class="tool-input" type="text" inputmode="decimal" placeholder="Height in cm">
    ${actionButton("Calculate BMI", "calculateBMI()")}
    <p id="result" class="result"></p>
  `);
}

function calculateBMI() {
  const weight = readNumber("weight");
  const height = readNumber("height") / 100;
  if (!weight || !height) return result("Enter valid weight and height.");
  const bmi = weight / (height * height);
  result(`BMI: ${bmi.toFixed(2)}`);
}

function renderBMR(tool) {
  setBox(tool, `
    <input id="weight" class="tool-input" type="text" inputmode="decimal" placeholder="Weight in kg">
    <input id="height" class="tool-input" type="text" inputmode="decimal" placeholder="Height in cm">
    <input id="age" class="tool-input" type="text" inputmode="decimal" placeholder="Age">
    <select id="gender" class="tool-input"><option value="male">Male</option><option value="female">Female</option></select>
    ${actionButton("Calculate BMR", "calculateBMR()")}
    <p id="result" class="result"></p>
  `);
}

function calculateBMR() {
  const w = readNumber("weight");
  const h = readNumber("height");
  const a = readNumber("age");
  const male = document.getElementById("gender").value === "male";
  const bmr = 10 * w + 6.25 * h - 5 * a + (male ? 5 : -161);
  result(`Estimated BMR: ${bmr.toFixed(0)} calories/day`);
}

function renderCalorie(tool) {
  renderBMR(tool);
  toolBox.querySelector(".primary-btn").setAttribute("onclick", "calculateCalories()");
}
function calculateCalories() {
  calculateBMR();
  const bmr = document.getElementById("result").innerText.match(/\d+/)?.[0] || 0;
  result(`Estimated maintenance calories: ${(Number(bmr) * 1.4).toFixed(0)} calories/day`);
}
function renderIdealWeight(tool) {
  setBox(tool, `
    <input id="height" class="tool-input" type="text" inputmode="decimal" placeholder="Height in cm">
    ${actionButton("Calculate Ideal Weight", "calculateIdealWeight()")}
    <p id="result" class="result"></p>
  `);
}
function calculateIdealWeight() {
  const h = readNumber("height") / 100;
  result(`Healthy BMI weight range: ${(18.5 * h * h).toFixed(1)} kg - ${(24.9 * h * h).toFixed(1)} kg`);
}
function renderBodyFat(tool) {
  setBox(tool, `
    <input id="bmi" class="tool-input" type="text" inputmode="decimal" placeholder="BMI">
    <input id="age" class="tool-input" type="text" inputmode="decimal" placeholder="Age">
    <select id="gender" class="tool-input"><option value="male">Male</option><option value="female">Female</option></select>
    ${actionButton("Estimate Body Fat", "calculateBodyFat()")}
    <p id="result" class="result"></p>
  `);
}
function calculateBodyFat() {
  const bmi = readNumber("bmi");
  const age = readNumber("age");
  const male = document.getElementById("gender").value === "male";
  const fat = 1.2 * bmi + 0.23 * age - (male ? 16.2 : 5.4);
  result(`Estimated body fat: ${fat.toFixed(1)}%`);
}
function renderWaterIntake(tool) {
  setBox(tool, `<input id="weight" class="tool-input" type="text" inputmode="decimal" placeholder="Weight in kg">${actionButton("Calculate Water", "calculateWater()")}<p id="result" class="result"></p>`);
}
function calculateWater() { result(`Suggested water intake: ${(readNumber("weight") * 0.033).toFixed(2)} liters/day`); }
function renderPregnancyDueDate(tool) {
  setBox(tool, `<input id="date" class="tool-input" type="date">${actionButton("Calculate Due Date", "calculateDueDate()")}<p id="result" class="result"></p>`);
}
function calculateDueDate() {
  const d = new Date(document.getElementById("date").value);
  if (isNaN(d)) return result("Select a valid date.");
  d.setDate(d.getDate() + 280);
  result(`Estimated due date: ${d.toDateString()}`);
}
function renderHeartRate(tool) {
  setBox(tool, `<input id="age" class="tool-input" type="text" inputmode="decimal" placeholder="Age">${actionButton("Calculate Heart Rate Zones", "calculateHeartRate()")}<p id="result" class="result"></p>`);
}
function calculateHeartRate() {
  const max = 220 - readNumber("age");
  result(`Max heart rate: ${max} bpm | Moderate zone: ${Math.round(max * 0.5)}-${Math.round(max * 0.7)} bpm`);
}

const unitMaps = {
  length: { meter: 1, kilometer: 1000, centimeter: 0.01, millimeter: 0.001, mile: 1609.344, yard: 0.9144, foot: 0.3048, inch: 0.0254 },
  weight: { kilogram: 1, gram: 0.001, pound: 0.45359237, ounce: 0.0283495, tonne: 1000 },
  time: { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800 },
  speed: { "m/s": 1, "km/h": 0.277778, mph: 0.44704, knot: 0.514444 },
  area: { "square meter": 1, "square kilometer": 1000000, acre: 4046.856, hectare: 10000, "square foot": 0.092903 },
  volume: { liter: 1, milliliter: 0.001, gallon: 3.78541, quart: 0.946353, cup: 0.236588 },
  data: { byte: 1, KB: 1024, MB: 1048576, GB: 1073741824, TB: 1099511627776 }
};

function renderConverter(tool, type) {
  const units = Object.keys(unitMaps[type]);
  const options = units.map(u => `<option value="${u}">${u}</option>`).join("");
  setBox(tool, `
    <input id="convValue" class="tool-input" type="text" inputmode="decimal" placeholder="Value">
    <select id="fromUnit" class="tool-input">${options}</select>
    <select id="toUnit" class="tool-input">${options}</select>
    <input id="convType" type="hidden" value="${type}">
    ${actionButton("Convert", "convertUnit()")}
    <p id="result" class="result"></p>
  `);
}
function convertUnit() {
  const type = document.getElementById("convType").value;
  const value = readNumber("convValue");
  const from = document.getElementById("fromUnit").value;
  const to = document.getElementById("toUnit").value;
  result(`${value} ${from} = ${(value * unitMaps[type][from] / unitMaps[type][to]).toFixed(6)} ${to}`);
}
function renderTemperature(tool) {
  setBox(tool, `
    <input id="tempValue" class="tool-input" type="text" inputmode="decimal" placeholder="Temperature">
    <select id="fromTemp" class="tool-input"><option>C</option><option>F</option><option>K</option></select>
    <select id="toTemp" class="tool-input"><option>F</option><option>C</option><option>K</option></select>
    ${actionButton("Convert", "convertTemperature()")}
    <p id="result" class="result"></p>
  `);
}
function convertTemperature() {
  const v = readNumber("tempValue");
  const from = document.getElementById("fromTemp").value;
  const to = document.getElementById("toTemp").value;
  let c = from === "C" ? v : from === "F" ? (v - 32) * 5 / 9 : v - 273.15;
  const out = to === "C" ? c : to === "F" ? c * 9 / 5 + 32 : c + 273.15;
  result(`${out.toFixed(2)} ${to}`);
}
function renderAge(tool) {
  setBox(tool, `<input id="birth" class="tool-input" type="date">${actionButton("Calculate Age", "calculateAge()")}<p id="result" class="result"></p>`);
}
function calculateAge() {
  const birth = new Date(document.getElementById("birth").value);
  const now = new Date();
  if (isNaN(birth)) return result("Select a valid birth date.");
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  result(`Age: ${age} years`);
}
function renderDateDifference(tool) {
  setBox(tool, `<input id="d1" class="tool-input" type="date"><input id="d2" class="tool-input" type="date">${actionButton("Find Difference", "calculateDateDifference()")}<p id="result" class="result"></p>`);
}
function calculateDateDifference() {
  const a = new Date(document.getElementById("d1").value);
  const b = new Date(document.getElementById("d2").value);
  result(`Difference: ${Math.abs(Math.round((b - a) / 86400000))} days`);
}
function renderTimeZone(tool) {
  setBox(tool, `<input id="tzDate" class="tool-input" type="datetime-local"><input id="tzOffset" class="tool-input" type="text" inputmode="decimal" placeholder="Target UTC offset, e.g. 2">${actionButton("Convert Time", "convertTimeZone()")}<p id="result" class="result"></p>`);
}
function convertTimeZone() {
  const date = new Date(document.getElementById("tzDate").value);
  const offset = readNumber("tzOffset");
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  result(`Converted time: ${new Date(utc + offset * 3600000).toLocaleString()}`);
}
function renderCountdown(tool) {
  setBox(tool, `<input id="seconds" class="tool-input" type="text" inputmode="decimal" placeholder="Seconds">${actionButton("Start Countdown", "startCountdown()")}<button class="secondary-btn tool-action" data-action="pauseCountdown">Pause</button><p id="result" class="result"></p>`);
}
function startCountdown() {
  clearInterval(countdownTimer);
  let seconds = readNumber("seconds");
  countdownTimer = setInterval(() => {
    result(`${seconds} seconds remaining`);
    if (seconds-- <= 0) {
      clearInterval(countdownTimer);
      result("Time is up.");
    }
  }, 1000);
}
function renderStopwatch(tool) {
  setBox(tool, `${actionButton("Start", "startStopwatch()")}<button class="secondary-btn tool-action" data-action="stopStopwatch">Stop</button><button class="secondary-btn tool-action" data-action="resetStopwatch">Reset</button><p id="result" class="result">00:00.0</p>`);
}
function startStopwatch() {
  clearInterval(stopwatchTimer);
  stopwatchStart = Date.now() - stopwatchElapsed;
  stopwatchTimer = setInterval(() => {
    stopwatchElapsed = Date.now() - stopwatchStart;
    result((stopwatchElapsed / 1000).toFixed(1) + " seconds");
  }, 100);
}
function stopStopwatch() { clearInterval(stopwatchTimer); }
function resetStopwatch() { clearInterval(stopwatchTimer); stopwatchElapsed = 0; result("00:00.0"); }

function renderPassword(tool) {
  setBox(tool, `<input id="length" class="tool-input" type="text" inputmode="decimal" value="12" min="4" max="64">${actionButton("Generate Password", "generatePassword()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function generatePassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!%";
  const len = Math.min(Math.max(readNumber("length") || 12, 4), 64);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  result(out);
}
function renderUsername(tool) {
  setBox(tool, `${actionButton("Generate Username", "generateUsername()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function generateUsername() {
  const words = ["smart", "bright", "swift", "clear", "nova", "pixel", "logic", "hub"];
  result(`${words[Math.floor(Math.random() * words.length)]}_${Math.floor(Math.random() * 9000 + 1000)}`);
}
function renderRandomNumber(tool) {
  setBox(tool, `<input id="min" class="tool-input" type="text" inputmode="decimal" value="1"><input id="max" class="tool-input" type="text" inputmode="decimal" value="100">${actionButton("Generate Number", "generateRandomNumber()")}<p id="result" class="result"></p>`);
}
function generateRandomNumber() {
  const min = readNumber("min");
  const max = readNumber("max");
  result(String(Math.floor(Math.random() * (max - min + 1)) + min));
}
function renderUUID(tool) {
  setBox(tool, `${actionButton("Generate UUID", "generateUUID()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function generateUUID() { result(crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => ((Math.random() * 16) | 0).toString(16))); }
function renderLorem(tool) {
  setBox(tool, `<input id="paragraphs" class="tool-input" type="text" inputmode="decimal" value="2" min="1" max="10">${actionButton("Generate Text", "generateLorem()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function generateLorem() {
  const p = readNumber("paragraphs") || 2;
  const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae justo at lectus gravida facilisis.";
  result(Array.from({ length: p }, () => text).join("<br><br>"));
}
function renderHashtag(tool) {
  setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="Enter keywords or a topic"></textarea>${actionButton("Generate Hashtags", "generateHashtags()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function generateHashtags() {
  const tags = document.getElementById("text").value.split(/[\s,]+/).filter(Boolean).map(w => "#" + w.replace(/[^a-z0-9]/gi, ""));
  result(tags.join(" "));
}
function renderQR(tool) {
  setBox(tool, `<input id="qrText" class="tool-input" placeholder="Text or URL">${actionButton("Generate QR Code", "generateQR()")}<div id="result" class="result"></div>`);
}
function generateQR() {
  const data = encodeURIComponent(document.getElementById("qrText").value);
  document.getElementById("result").innerHTML = `<img alt="QR code" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${data}">`;
}
function renderMetaTags(tool) {
  setBox(tool, `<input id="title" class="tool-input" placeholder="Page title"><textarea id="desc" class="tool-textarea" placeholder="Meta description"></textarea>${actionButton("Generate Meta Tags", "generateMetaTags()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}
function generateMetaTags() {
  const title = escapeHTML(document.getElementById("title").value);
  const desc = escapeHTML(document.getElementById("desc").value);
  result(`&lt;title&gt;${title}&lt;/title&gt;\n&lt;meta name="description" content="${desc}"&gt;`);
}
function renderRobots(tool) {
  setBox(tool, `<input id="site" class="tool-input" placeholder="https://example.com">${actionButton("Generate Robots.txt", "generateRobots()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}
function generateRobots() { result(`User-agent: *\nAllow: /\nSitemap: ${document.getElementById("site").value.replace(/\/$/, "")}/sitemap.xml`); }
function renderSitemap(tool) {
  setBox(tool, `<textarea id="urls" class="tool-textarea" placeholder="Enter one URL per line"></textarea>${actionButton("Generate Sitemap", "generateSitemap()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}
function generateSitemap() {
  const urls = document.getElementById("urls").value.split(/\n+/).filter(Boolean);
  result(escapeHTML(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join("\n")}\n</urlset>`));
}
function renderSlug(tool) {
  setBox(tool, `<input id="text" class="tool-input" placeholder="Title or phrase">${actionButton("Generate Slug", "generateSlug()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function generateSlug() { result(document.getElementById("text").value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }
function renderPalette(tool) {
  setBox(tool, `${actionButton("Generate Palette", "generatePalette()")}<div id="result" class="result swatches"></div>`);
}
function generatePalette() {
  const colors = Array.from({ length: 5 }, () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"));
  document.getElementById("result").innerHTML = colors.map(c => `<span class="swatch" style="background:${c}">${c}</span>`).join("");
}

function renderTextStats(tool) {
  setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="Paste text here"></textarea>${actionButton("Analyze Text", "analyzeText()")}<p id="result" class="result"></p>`);
}
function analyzeText() {
  const text = document.getElementById("text").value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  result(`Words: ${words} | Characters: ${text.length} | Sentences: ${text.split(/[.!?]+/).filter(Boolean).length} | Lines: ${text.split(/\n/).length}`);
}
function renderCaseConverter(tool) {
  setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="Paste text here"></textarea><select id="caseMode" class="tool-input"><option value="upper">UPPERCASE</option><option value="lower">lowercase</option><option value="title">Title Case</option></select>${actionButton("Convert Case", "convertCase()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function convertCase() {
  const text = document.getElementById("text").value;
  const mode = document.getElementById("caseMode").value;
  result(mode === "upper" ? text.toUpperCase() : mode === "lower" ? text.toLowerCase() : text.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
}
function renderTextReverser(tool) { setBox(tool, `<textarea id="text" class="tool-textarea"></textarea>${actionButton("Reverse Text", "reverseText()")} ${copyButton()}<p id="result" class="result"></p>`); }
function reverseText() { result(document.getElementById("text").value.split("").reverse().join("")); }
function renderSpaceCleaner(tool) { setBox(tool, `<textarea id="text" class="tool-textarea"></textarea>${actionButton("Remove Extra Spaces", "cleanSpaces()")} ${copyButton()}<p id="result" class="result"></p>`); }
function cleanSpaces() { result(document.getElementById("text").value.replace(/\s+/g, " ").trim()); }
function renderTextSorter(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="One item per line"></textarea>${actionButton("Sort Lines", "sortLines()")} ${copyButton()}<p id="result" class="result"></p>`); }
function sortLines() { result(document.getElementById("text").value.split(/\n/).sort().join("<br>")); }
function renderDuplicateRemover(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="One item per line"></textarea>${actionButton("Remove Duplicates", "removeDuplicates()")} ${copyButton()}<p id="result" class="result"></p>`); }
function removeDuplicates() { result([...new Set(document.getElementById("text").value.split(/\n/))].join("<br>")); }
function renderFindReplace(tool) {
  setBox(tool, `<textarea id="text" class="tool-textarea"></textarea><input id="find" class="tool-input" placeholder="Find"><input id="replace" class="tool-input" placeholder="Replace with">${actionButton("Replace", "findReplace()")} ${copyButton()}<p id="result" class="result"></p>`);
}
function findReplace() {
  const find = document.getElementById("find").value;
  result(document.getElementById("text").value.split(find).join(document.getElementById("replace").value));
}

function renderURLEncoder(tool) { renderTransform(tool, "Text or URL", "encodeURIComponent(input)", "encodeText"); }
function renderURLDecoder(tool) { renderTransform(tool, "Encoded URL text", "decodeURIComponent(input)", "decodeText"); }
function renderBase64Encoder(tool) { renderTransform(tool, "Text", "btoa(unescape(encodeURIComponent(input)))", "encodeBase64"); }
function renderBase64Decoder(tool) { renderTransform(tool, "Base64 text", "decodeURIComponent(escape(atob(input)))", "decodeBase64"); }
function renderHTMLEncoder(tool) { renderTransform(tool, "HTML text", "escapeHTML(input)", "encodeHTMLText"); }
function renderHTMLDecoder(tool) { renderTransform(tool, "Encoded HTML", "decodeHTML(input)", "decodeHTMLText"); }
function renderTransform(tool, placeholder, expression, fnName) {
  window[fnName] = () => {
    const input = document.getElementById("text").value;
    try { result(eval(expression)); } catch { result("Unable to transform this input."); }
  };
  setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="${placeholder}"></textarea><button class="primary-btn" class="primary-btn tool-action" data-action="${fnName}">Convert</button> ${copyButton()}<p id="result" class="result"></p>`);
}
function decodeHTML(input) {
  const div = document.createElement("div");
  div.innerHTML = input;
  return div.textContent;
}
function renderJSONFormatter(tool) { setBox(tool, `<textarea id="json" class="tool-textarea" placeholder='{"name":"Smart Tools"}'></textarea>${actionButton("Format JSON", "formatJSON()")} ${copyButton()}<pre id="result" class="result"></pre>`); }
function formatJSON() { try { result(escapeHTML(JSON.stringify(JSON.parse(document.getElementById("json").value), null, 2))); } catch (e) { result(`Invalid JSON: ${e.message}`); } }
function renderJSONValidator(tool) { renderJSONFormatter(tool); toolBox.querySelector(".primary-btn").textContent = "Validate JSON"; }
function renderMarkdownPreviewer(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="# Heading"></textarea>${actionButton("Preview Markdown", "previewMarkdown()")}<div id="result" class="result"></div>`); }
function previewMarkdown() {
  let html = escapeHTML(document.getElementById("text").value);
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>").replace(/^## (.*)$/gm, "<h2>$1</h2>").replace(/^# (.*)$/gm, "<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
  result(html);
}
function renderCSVToJSON(tool) { setBox(tool, `<textarea id="csv" class="tool-textarea" placeholder="name,age&#10;Joseph,30"></textarea>${actionButton("Convert CSV", "csvToJSON()")} ${copyButton()}<pre id="result" class="result"></pre>`); }
function csvToJSON() {
  const rows = document.getElementById("csv").value.trim().split(/\n/).map(r => r.split(","));
  const headers = rows.shift() || [];
  result(escapeHTML(JSON.stringify(rows.map(row => Object.fromEntries(headers.map((h, i) => [h.trim(), row[i]?.trim() || ""]))), null, 2)));
}

function renderSEOTitle(tool) { setBox(tool, `<input id="title" class="tool-input" placeholder="SEO title">${actionButton("Check Title", "checkSEOTitle()")}<p id="result" class="result"></p>`); }
function checkSEOTitle() { const t = document.getElementById("title").value; result(`Length: ${t.length} characters. ${t.length >= 50 && t.length <= 60 ? "Good SEO title length." : "Aim for about 50-60 characters."}`); }
function renderMetaDescription(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="Meta description"></textarea>${actionButton("Check Description", "checkMetaDescription()")}<p id="result" class="result"></p>`); }
function checkMetaDescription() { const t = document.getElementById("text").value; result(`Length: ${t.length} characters. ${t.length >= 120 && t.length <= 160 ? "Good length." : "Aim for about 120-160 characters."}`); }
function renderKeywordDensity(tool) { setBox(tool, `<input id="keyword" class="tool-input" placeholder="Keyword"><textarea id="text" class="tool-textarea"></textarea>${actionButton("Check Density", "checkKeywordDensity()")}<p id="result" class="result"></p>`); }
function checkKeywordDensity() {
  const keyword = document.getElementById("keyword").value.toLowerCase();
  const text = document.getElementById("text").value.toLowerCase();
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const count = keyword ? (text.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length : 0;
  result(`Keyword count: ${count} | Density: ${words ? ((count / words) * 100).toFixed(2) : 0}%`);
}
function renderSERP(tool) { setBox(tool, `<input id="title" class="tool-input" placeholder="Title"><textarea id="desc" class="tool-textarea" placeholder="Description"></textarea><input id="url" class="tool-input" placeholder="https://example.com/page">${actionButton("Preview", "previewSERP()")}<div id="result" class="result"></div>`); }
function previewSERP() { result(`<strong style="color:#1a0dab">${escapeHTML(document.getElementById("title").value)}</strong><br><span style="color:#006621">${escapeHTML(document.getElementById("url").value)}</span><br>${escapeHTML(document.getElementById("desc").value)}`); }
function renderHeadingChecker(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="Paste HTML"></textarea>${actionButton("Check Headings", "checkHeadings()")}<p id="result" class="result"></p>`); }
function checkHeadings() { const html = document.getElementById("text").value; result([1,2,3,4,5,6].map(n => `H${n}: ${(html.match(new RegExp(`<h${n}[\\s>]`, "gi")) || []).length}`).join(" | ")); }
function renderOpenGraph(tool) { renderSocialMeta(tool, "Open Graph", "generateOpenGraph()"); }
function renderTwitterCard(tool) { renderSocialMeta(tool, "Twitter Card", "generateTwitterCard()"); }
function renderSocialMeta(tool, label, fn) { setBox(tool, `<input id="title" class="tool-input" placeholder="Title"><textarea id="desc" class="tool-textarea" placeholder="Description"></textarea><input id="image" class="tool-input" placeholder="Image URL">${actionButton(`Generate ${label}`, fn)} ${copyButton()}<pre id="result" class="result"></pre>`); }
function generateOpenGraph() { result(escapeHTML(`<meta property="og:title" content="${document.getElementById("title").value}">\n<meta property="og:description" content="${document.getElementById("desc").value}">\n<meta property="og:image" content="${document.getElementById("image").value}">`)); }
function generateTwitterCard() { result(escapeHTML(`<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:title" content="${document.getElementById("title").value}">\n<meta name="twitter:description" content="${document.getElementById("desc").value}">\n<meta name="twitter:image" content="${document.getElementById("image").value}">`)); }
function renderCanonical(tool) { setBox(tool, `<input id="url" class="tool-input" placeholder="Canonical URL">${actionButton("Generate Canonical Tag", "generateCanonical()")} ${copyButton()}<pre id="result" class="result"></pre>`); }
function generateCanonical() { result(escapeHTML(`<link rel="canonical" href="${document.getElementById("url").value}">`)); }
function renderSchema(tool) { setBox(tool, `<input id="name" class="tool-input" placeholder="Business or website name"><input id="url" class="tool-input" placeholder="URL">${actionButton("Generate Schema", "generateSchema()")} ${copyButton()}<pre id="result" class="result"></pre>`); }
function generateSchema() { result(escapeHTML(JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: document.getElementById("name").value, url: document.getElementById("url").value }, null, 2))); }
function renderAltText(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder='<img src="photo.jpg" alt="Description">'></textarea>${actionButton("Check Alt Text", "checkAltText()")}<p id="result" class="result"></p>`); }
function checkAltText() { const html = document.getElementById("text").value; const imgs = html.match(/<img\b[^>]*>/gi) || []; const missing = imgs.filter(img => !/\salt=/i.test(img)).length; result(`Images found: ${imgs.length} | Missing alt text: ${missing}`); }

function renderImageCompressor(tool) { renderImageTool(tool, "Compress Image", "processImage(false)"); }
function renderImageResizer(tool) { renderImageTool(tool, "Resize Image", "processImage(true)"); }
function renderImageTool(tool, label, fn) {
  setBox(tool, `<input id="imageFile" class="tool-input" type="file" accept="image/*"><input id="imageWidth" class="tool-input" type="text" inputmode="decimal" placeholder="Width px for resize"><button class="primary-btn tool-action" data-action="${fn.replace("()", "")}">${label}</button><div id="result" class="result"></div>`);
}
function processImage(resize) {
  const file = document.getElementById("imageFile").files[0];
  if (!file) return result("Choose an image first.");
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    const width = resize && readNumber("imageWidth") ? readNumber("imageWidth") : img.width;
    canvas.width = width;
    canvas.height = Math.round(img.height * (width / img.width));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const originalType = file.type || "image/png";
    const supportedType = ["image/png", "image/jpeg", "image/webp"].includes(originalType)
      ? originalType
      : "image/png";
    const extension = supportedType === "image/jpeg" ? "jpg" : supportedType.split("/")[1];
    const quality = supportedType === "image/png" ? undefined : 0.82;
    const url = canvas.toDataURL(supportedType, quality);
    const filename = `smart-tools-image.${extension}`;
    document.getElementById("result").innerHTML = `
      <div class="download-panel">
        <strong>Your image is ready.</strong>
        <span>Format kept as ${supportedType.replace("image/", "").toUpperCase()}</span>
        <a class="primary-btn" download="${filename}" href="${url}">Download Image</a>
      </div>
      <img class="preview-image" src="${url}" alt="Processed image">
    `;
  };
  img.src = URL.createObjectURL(file);
}
function renderDocumentTool(tool) {
  const accepts = {
    "pdf-to-word": ".pdf",
    "word-to-pdf": ".doc,.docx",
    "pdf-compressor": ".pdf",
    "merge-pdf": ".pdf",
    "split-pdf": ".pdf"
  };
  const multiple = tool.slug === "merge-pdf" ? "multiple" : "";
  const extra = tool.slug === "split-pdf"
    ? `<input id="pageNumber" class="tool-input" type="text" inputmode="decimal" value="1" placeholder="Page number to extract">`
    : "";
  const pdfRecommendation = tool.slug.includes("pdf") || tool.slug.includes("word")
    ? `
      <div class="tool-recommendation">
        <span>Need exact layout?</span>
        <a href="${tool.affiliateUrl || "https://www.adobe.com/acrobat.html"}" target="_blank" rel="sponsored nofollow noopener">
          ${tool.affiliateLabel || "Adobe Acrobat PDF tools"}
        </a>
      </div>
    `
    : "";
  const mode = tool.slug === "pdf-to-word"
    ? `
      <label class="tool-label" for="conversionMode">Conversion mode</label>
      <select id="conversionMode" class="tool-input">
        <option value="preserve" selected>Preserve layout - best formatting</option>
        <option value="fast">Fast text conversion - quickest</option>
      </select>
    `
    : "";

  setBox(tool, `
    <p class="format-note">Preserve-layout mode is selected by default for better formatting. For complex PDFs, Adobe Acrobat may still give the closest professional result.</p>
    <input id="documentFiles" class="tool-input" type="file" accept="${accepts[tool.slug]}" ${multiple}>
    ${mode}
    ${extra}
    <button class="primary-btn tool-action" data-action="processDocumentTool" data-slug="${tool.slug}">${tool.name}</button>
    ${pdfRecommendation}
    <div id="result" class="result"></div>
  `);
}

async function processDocumentTool(slug) {
  const input = document.getElementById("documentFiles");
  const files = Array.from(input.files || []);

  if (!files.length) {
    result("Please choose a file first.");
    return;
  }

  if (slug === "merge-pdf" && files.length < 2) {
    result("Please choose at least two PDF files to merge.");
    return;
  }

  const formData = new FormData();
  if (slug === "merge-pdf") {
    files.forEach((file) => formData.append("files", file));
  } else {
    formData.append("file", files[0]);
  }

  if (slug === "split-pdf") {
    formData.append("page", document.getElementById("pageNumber").value || "1");
  }

  if (slug === "pdf-to-word") {
    formData.append("mode", document.getElementById("conversionMode").value || "fast");
  }

  startProcessingStatus(slug);

  try {
    const res = await apiFetch(`${API_BASE}/api/tools/${slug}`, {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    stopProcessingStatus();

    if (!data.success) {
      result(data.message || "File processing failed.");
      return;
    }

    const sizeInfo = data.originalSize && data.compressedSize
      ? `<br>Original: ${(data.originalSize / 1024).toFixed(1)} KB | Output: ${(data.compressedSize / 1024).toFixed(1)} KB`
      : "";

    showDownloadResult(data.downloadUrl, data.filename || `${currentTool.name} result`, sizeInfo, data.directUrl);
  } catch (err) {
    stopProcessingStatus();
    console.error(err);
    result("Server error. Make sure the backend is running and try again.");
  }
}

let processingStatusTimer = null;

function startProcessingStatus(slug) {
  clearInterval(processingStatusTimer);
  const startedAt = Date.now();
  const mode = document.getElementById("conversionMode")?.value || "";

  const renderStatus = () => {
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const modeText = slug === "pdf-to-word" && mode === "preserve"
      ? "Preserve-layout mode can take longer because Word rebuilds the document structure."
      : "Fast mode is optimized for speed.";

    result(`
      <div class="processing-panel">
        <strong>Processing file...</strong>
        <span>${seconds}s elapsed</span>
        <small>${modeText}</small>
      </div>
    `);
  };

  renderStatus();
  processingStatusTimer = setInterval(renderStatus, 1000);
}

function stopProcessingStatus() {
  clearInterval(processingStatusTimer);
  processingStatusTimer = null;
}

function showDownloadResult(url, label, details = "", directUrl = "") {
  const safeLabel = escapeHTML(label);
  const encodedUrl = encodeURIComponent(url);
  const encodedLabel = encodeURIComponent(label);
  const safeDetails = details ? `<small>${details}</small>` : "";
  const fallbackLink = directUrl ? `<a class="direct-link" href="${directUrl}" target="_blank">Open direct file link</a>` : "";

  result(`
    <div class="download-panel">
      <strong>Your file is ready.</strong>
      <span>${safeLabel}</span>
      <button type="button" class="download-btn tool-action" data-action="downloadConvertedFile" data-url="${encodedUrl}" data-label="${encodedLabel}" data-status="inlineDownloadStatus">Download File</button>
      <a class="direct-link" href="${url}" target="_blank">Open database download link</a>
      ${fallbackLink}
      ${safeDetails}
      <small id="inlineDownloadStatus">Click Download File, then check your PC Downloads folder.</small>
    </div>
  `);

  showDownloadPopup(url, label, details, directUrl);
}

function showDownloadPopup(url, label, details = "", directUrl = "") {
  const oldPopup = document.querySelector(".download-modal");
  if (oldPopup) oldPopup.remove();
  const encodedUrl = encodeURIComponent(url);
  const encodedLabel = encodeURIComponent(label);

  const popup = document.createElement("div");
  popup.className = "download-modal";
  popup.innerHTML = `
    <div class="download-modal-box">
      <button class="modal-close tool-action" data-action="closeDownloadPopup">×</button>
      <h2>Conversion Complete</h2>
      <p>Your converted file is ready to download.</p>
      <strong class="download-filename">${escapeHTML(label)}</strong>
      <button type="button" class="download-btn big tool-action" data-action="downloadConvertedFile" data-url="${encodedUrl}" data-label="${encodedLabel}" data-status="downloadStatus">Download Now</button>
      <p id="downloadStatus" class="download-status">After clicking download, your browser will save the file to your PC Downloads folder unless you chose a different folder.</p>
      ${directUrl ? `<a class="direct-link" href="${directUrl}" target="_blank">Backup direct file link</a>` : ""}
      ${details ? `<small>${details}</small>` : ""}
    </div>
  `;

  document.body.appendChild(popup);
}

function closeDownloadPopup() {
  document.querySelector(".download-modal")?.remove();
}

function markDownloadStarted() {
  const status = document.getElementById("downloadStatus");
  if (status) {
    status.innerText = "Download started successfully. Check your PC Downloads folder.";
    status.classList.add("success");
  }

  const inlineStatus = document.getElementById("inlineDownloadStatus");
  if (inlineStatus) {
    inlineStatus.innerText = "Download started successfully. Check your PC Downloads folder.";
    inlineStatus.classList.add("success");
  }
}

async function downloadConvertedFile(encodedUrl, encodedLabel, statusId) {
  const status = document.getElementById(statusId);
  const url = decodeURIComponent(encodedUrl);
  console.log("Download URL:", url);
  const label = decodeURIComponent(encodedLabel || "converted-file");

  if (status) {
    status.innerText = "Downloading... please wait.";
    status.classList.remove("success");
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Download failed");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = label;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);

    if (status) {
      status.innerText = "Download started successfully. Check your PC Downloads folder.";
      status.classList.add("success");
    }

    const inlineStatus = document.getElementById("inlineDownloadStatus");
    if (inlineStatus) {
      inlineStatus.innerText = "Download started successfully. Check your PC Downloads folder.";
      inlineStatus.classList.add("success");
    }
  } catch (err) {
    console.error(err);
    if (status) {
      status.innerText = "Download failed. Use the direct download link below.";
    }
  }
}

function renderColorPicker(tool) { setBox(tool, `<input id="color" class="tool-input" type="color" value="#1e88e5">${actionButton("Show Color", "showColor()")}<p id="result" class="result"></p>`); }
function showColor() { const c = document.getElementById("color").value; result(`<span class="swatch" style="background:${c}">${c}</span>`); }
function renderHexToRGB(tool) { setBox(tool, `<input id="hex" class="tool-input" placeholder="#1e88e5">${actionButton("Convert to RGB", "hexToRGB()")}<p id="result" class="result"></p>`); }
function hexToRGB() { const h = document.getElementById("hex").value.replace("#", ""); result(`rgb(${parseInt(h.slice(0,2),16)}, ${parseInt(h.slice(2,4),16)}, ${parseInt(h.slice(4,6),16)})`); }
function renderRGBToHex(tool) { setBox(tool, `<input id="r" class="tool-input" type="text" inputmode="decimal" placeholder="R"><input id="g" class="tool-input" type="text" inputmode="decimal" placeholder="G"><input id="b" class="tool-input" type="text" inputmode="decimal" placeholder="B">${actionButton("Convert to HEX", "rgbToHex()")}<p id="result" class="result"></p>`); }
function rgbToHex() { result("#" + [readNumber("r"), readNumber("g"), readNumber("b")].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")); }
function renderGradient(tool) { setBox(tool, `<input id="c1" class="tool-input" type="color" value="#1e88e5"><input id="c2" class="tool-input" type="color" value="#0f766e">${actionButton("Generate Gradient", "generateGradient()")} ${copyButton()}<p id="result" class="result"></p>`); }
function generateGradient() { result(`background: linear-gradient(135deg, ${document.getElementById("c1").value}, ${document.getElementById("c2").value});`); }
function renderBoxShadow(tool) { setBox(tool, `<input id="blur" class="tool-input" type="text" inputmode="decimal" value="20" placeholder="Blur"><input id="spread" class="tool-input" type="text" inputmode="decimal" value="0" placeholder="Spread">${actionButton("Generate Shadow", "generateShadow()")} ${copyButton()}<p id="result" class="result"></p>`); }
function generateShadow() { result(`box-shadow: 0 8px ${readNumber("blur")}px ${readNumber("spread")}px rgba(0,0,0,0.18);`); }
function renderButtonGenerator(tool) { setBox(tool, `<input id="label" class="tool-input" placeholder="Button text"><input id="color" class="tool-input" type="color" value="#1e88e5">${actionButton("Generate Button CSS", "generateButtonCSS()")} ${copyButton()}<div id="result" class="result"></div>`); }
function generateButtonCSS() { const color = document.getElementById("color").value; const label = escapeHTML(document.getElementById("label").value || "Button"); result(`<button style="background:${color};color:white;border:0;border-radius:8px;padding:10px 14px">${label}</button><br><br>background: ${color}; color: white; border-radius: 8px;`); }
function renderEmailValidator(tool) { setBox(tool, `<input id="email" class="tool-input" placeholder="email@example.com">${actionButton("Validate Email", "validateEmail()")}<p id="result" class="result"></p>`); }
function validateEmail() { result(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(document.getElementById("email").value) ? "Valid email format." : "Invalid email format."); }
function renderPhoneFormatter(tool) { setBox(tool, `<input id="phone" class="tool-input" placeholder="Phone number">${actionButton("Format Phone", "formatPhone()")}<p id="result" class="result"></p>`); }
function formatPhone() { const d = document.getElementById("phone").value.replace(/\D/g, ""); result(d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : `Digits only: ${d}`); }
function renderIPLookup(tool) { setBox(tool, `<input id="ip" class="tool-input" placeholder="IP address">${actionButton("Check IP Format", "lookupIP()")}<p id="result" class="result"></p>`); }
function lookupIP() { result(/^(\d{1,3}\.){3}\d{1,3}$/.test(document.getElementById("ip").value) ? "Valid IPv4 format." : "Enter a valid IPv4 address."); }
function renderScreenResolution(tool) { setBox(tool, `${actionButton("Check Screen", "checkScreen()")}<p id="result" class="result"></p>`); }
function checkScreen() { result(`Screen: ${screen.width} x ${screen.height} | Viewport: ${innerWidth} x ${innerHeight}`); }
function renderBrowserInfo(tool) { setBox(tool, `${actionButton("Show Browser Info", "showBrowserInfo()")}<p id="result" class="result"></p>`); }
function showBrowserInfo() { result(`Browser: ${navigator.userAgent}<br>Language: ${navigator.language}<br>Platform: ${navigator.platform}`); }
function renderTypingTest(tool) { setBox(tool, `<p class="sample-text">The quick brown fox jumps over the lazy dog while Smart Tools Hub measures typing speed.</p><textarea id="typing" class="tool-textarea" oninput="checkTyping()" placeholder="Start typing the sentence above"></textarea><p id="result" class="result"></p>`); }
function checkTyping() {
  if (!typingStartedAt) typingStartedAt = Date.now();
  const words = document.getElementById("typing").value.trim().split(/\s+/).filter(Boolean).length;
  const minutes = (Date.now() - typingStartedAt) / 60000;
  result(`Speed: ${minutes ? Math.round(words / minutes) : 0} WPM`);
}
function renderReadingTime(tool) { setBox(tool, `<textarea id="text" class="tool-textarea" placeholder="Paste article text"></textarea>${actionButton("Calculate Reading Time", "calculateReadingTime()")}<p id="result" class="result"></p>`); }
function calculateReadingTime() { const words = document.getElementById("text").value.trim().split(/\s+/).filter(Boolean).length; result(`Words: ${words} | Reading time: ${Math.max(1, Math.ceil(words / 200))} minute(s)`); }

function renderAIPromptGenerator(tool) {
  setBox(tool, `
    <p class="format-note">Build a complete prompt you can paste into ChatGPT, Gemini, Claude, or another AI assistant.</p>
    <input id="aiTask" class="tool-input" placeholder="What should AI help with?">
    <input id="aiAudience" class="tool-input" placeholder="Audience or context">
    <select id="aiTone" class="tool-input"><option>Professional</option><option>Friendly</option><option>Persuasive</option><option>Technical</option><option>Simple</option></select>
    <input id="aiFormat" class="tool-input" placeholder="Preferred output, e.g. checklist, table, email, plan">
    ${actionButton("Generate Prompt", "generateAIPrompt()")} ${copyButton()}
    <pre id="result" class="result"></pre>
  `);
}

function generateAIPrompt() {
  const task = document.getElementById("aiTask").value || "create useful content";
  const audience = document.getElementById("aiAudience").value || "general users";
  const tone = document.getElementById("aiTone").value.toLowerCase();
  const format = document.getElementById("aiFormat").value || "clear sections with examples";
  result(`Role: Act as an expert assistant.\n\nTask: Help me ${escapeHTML(task)}.\n\nAudience/context: ${escapeHTML(audience)}.\n\nTone: Use a ${escapeHTML(tone)} tone.\n\nOutput format: ${escapeHTML(format)}.\n\nRequirements:\n1. Start with the best answer directly.\n2. Include practical steps and examples.\n3. Mention assumptions if anything is unclear.\n4. End with a short summary and next action.`);
}

function renderAIBlogTitleGenerator(tool) {
  setBox(tool, `<p class="format-note">Generate SEO-friendly article titles grouped by intent.</p><input id="topic" class="tool-input" placeholder="Topic or keyword"><input id="reader" class="tool-input" placeholder="Target reader, e.g. small businesses">${actionButton("Generate Titles", "generateBlogTitles()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}

function generateBlogTitles() {
  const topic = escapeHTML(document.getElementById("topic").value || "online tools");
  const reader = escapeHTML(document.getElementById("reader").value || "busy professionals");
  result([
    `How-To: How ${reader} Can Use ${topic} to Save Time`,
    `Guide: The Complete Beginner Guide to ${topic}`,
    `List: 10 Practical ${topic} Ideas for ${reader}`,
    `Comparison: ${topic} Tools, Tips, and Common Mistakes`,
    `Business: How ${topic} Helps Teams Work Faster`,
    `SEO: ${topic}: Best Practices, Examples, and Quick Wins`,
    `Problem/Solution: Struggling With ${topic}? Start Here`,
    `Checklist: A Simple ${topic} Checklist for Better Results`
  ].join("\n"));
}

function renderAIMetaDescriptionGenerator(tool) {
  setBox(tool, `<p class="format-note">Create concise meta descriptions for search snippets. Aim for roughly 140 to 160 characters.</p><input id="pageTopic" class="tool-input" placeholder="Page topic"><input id="benefit" class="tool-input" placeholder="Main benefit"><input id="audience" class="tool-input" placeholder="Audience">${actionButton("Generate Meta Description", "generateAIMetaDescription()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}

function generateAIMetaDescription() {
  const topic = document.getElementById("pageTopic").value || "Smart Tools Hub";
  const benefit = document.getElementById("benefit").value || "finish everyday work faster";
  const audience = document.getElementById("audience").value || "students, creators, and businesses";
  const description = `Use ${topic} to ${benefit} with simple, fast, browser-friendly tools built for ${audience}.`;
  result(`${escapeHTML(description)}\n\nLength: ${description.length} characters`);
}

function renderAIEmailWriter(tool) {
  setBox(tool, `<p class="format-note">Draft a complete email you can edit before sending.</p><input id="emailGoal" class="tool-input" placeholder="Email purpose"><input id="emailRecipient" class="tool-input" placeholder="Recipient"><input id="emailDetails" class="tool-input" placeholder="Key details to include"><select id="emailTone" class="tool-input"><option>Professional</option><option>Friendly</option><option>Direct</option><option>Sales</option></select>${actionButton("Draft Email", "generateAIEmail()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}

function generateAIEmail() {
  const goal = escapeHTML(document.getElementById("emailGoal").value || "share an update");
  const recipient = escapeHTML(document.getElementById("emailRecipient").value || "there");
  const details = escapeHTML(document.getElementById("emailDetails").value || "the important details are below");
  const tone = escapeHTML(document.getElementById("emailTone").value.toLowerCase());
  result(`Subject: ${goal}\n\nHi ${recipient},\n\nI hope you are well. I am writing to ${goal}. I will keep this ${tone} and easy to act on.\n\nKey details:\n- ${details}\n- Next step: Please reply with your feedback or confirmation.\n- Timeline: We can move forward as soon as you are ready.\n\nThank you,\n[Your name]`);
}

function renderAISocialCaptionGenerator(tool) {
  setBox(tool, `<p class="format-note">Create captions with a hook, value statement, CTA, and hashtags.</p><input id="captionTopic" class="tool-input" placeholder="Product, service, or topic"><input id="captionAudience" class="tool-input" placeholder="Audience"><select id="captionPlatform" class="tool-input"><option>LinkedIn</option><option>Instagram</option><option>Facebook</option><option>X</option></select>${actionButton("Generate Caption", "generateAISocialCaption()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}

function generateAISocialCaption() {
  const topic = escapeHTML(document.getElementById("captionTopic").value || "our latest service");
  const audience = escapeHTML(document.getElementById("captionAudience").value || "business owners");
  const platform = document.getElementById("captionPlatform").value;
  result(`Hook: ${topic} should make work easier, not more complicated.\n\nCaption: We built this for ${audience} who want reliable results, faster decisions, and cleaner daily workflows.\n\nCall to action: Explore it today and see how much time you can save.\n\nHashtags: #SmartTools #Productivity #BusinessTools #${platform}`);
}

function renderAIBusinessIdeaGenerator(tool) {
  setBox(tool, `<p class="format-note">Brainstorm business ideas with target customer, offer, and revenue model.</p><input id="industry" class="tool-input" placeholder="Industry or interest"><input id="market" class="tool-input" placeholder="Target market"><input id="budget" class="tool-input" placeholder="Budget or resources">${actionButton("Generate Ideas", "generateAIBusinessIdeas()")} ${copyButton()}<pre id="result" class="result"></pre>`);
}

function generateAIBusinessIdeas() {
  const industry = escapeHTML(document.getElementById("industry").value || "technology");
  const market = escapeHTML(document.getElementById("market").value || "local businesses");
  const budget = escapeHTML(document.getElementById("budget").value || "lean startup resources");
  result([
    `1. Advisory Service\nCustomer: ${market}\nOffer: Monthly ${industry} guidance and support\nRevenue: Retainer packages\nFit: Works with ${budget}`,
    `2. Done-For-You Setup\nCustomer: Busy ${market}\nOffer: Setup, configuration, and handover\nRevenue: Fixed project fee plus support`,
    `3. Training Workshops\nCustomer: Teams new to ${industry}\nOffer: Practical sessions and templates\nRevenue: Per-seat or company workshop fee`,
    `4. Subscription Toolkit\nCustomer: ${market}\nOffer: Templates, calculators, guides, and dashboards\nRevenue: Monthly subscription`,
    `5. Niche Automation Agency\nCustomer: ${market}\nOffer: Automate repeated tasks using ${industry}\nRevenue: Setup fee plus maintenance`
  ].join("\n\n"));
}

loadTool();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js").catch(() => {});


document.addEventListener("click", (event) => {
    const button = event.target.closest(".tool-action");

    if (!button) return;

    const action = button.dataset.action;
    const fn = globalThis[action];

    if (typeof fn !== "function") {
        console.error("Tool function not found:", action);
        return;
    }

    if (action === "downloadConvertedFile") {
        fn(
            button.dataset.url,
            button.dataset.label,
            button.dataset.status
        );
    } else if (action === "processDocumentTool") {
        fn(button.dataset.slug);
    } else {
        fn();
    }
});


