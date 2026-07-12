const mongoose = require("mongoose");
const Tool = require("./models/Tool");
require("dotenv").config();

const affiliateLinks = {
  math: {
    label: "Khan Academy math lessons",
    category: "Education",
    url: "https://www.khanacademy.org/math"
  },
  finance: {
    label: "QuickBooks finance software",
    category: "Finance",
    url: "https://quickbooks.intuit.com/"
  },
  health: {
    label: "MyFitnessPal health tracker",
    category: "Health",
    url: "https://www.myfitnesspal.com/"
  },
  utility: {
    label: "Notion productivity workspace",
    category: "Productivity",
    url: "https://www.notion.com/"
  },
  generator: {
    label: "Canva creator toolkit",
    category: "Creator Tools",
    url: "https://www.canva.com/"
  },
  text: {
    label: "Grammarly writing assistant",
    category: "Writing",
    url: "https://www.grammarly.com/"
  },
  seo: {
    label: "Semrush SEO platform",
    category: "SEO",
    url: "https://www.semrush.com/"
  },
  pdf: {
    label: "Adobe Acrobat PDF tools",
    category: "PDF Tools",
    url: "https://www.adobe.com/acrobat.html"
  },
  design: {
    label: "Canva design tool",
    category: "Design",
    url: "https://www.canva.com/"
  },
  developer: {
    label: "GitHub developer platform",
    category: "Developer Tools",
    url: "https://github.com/"
  },
  security: {
    label: "NordPass password manager",
    category: "Security",
    url: "https://nordpass.com/"
  },
  ai: {
    label: "AI productivity workflows",
    category: "AI Tools",
    url: "/ai-tools.html"
  }
};

function affiliateForTool(slug, category) {
  if (category === "ai" || slug.startsWith("ai-")) return affiliateLinks.ai;
  if (slug.includes("pdf") || slug.includes("word-to-pdf")) return affiliateLinks.pdf;
  if (slug.includes("json") || slug.includes("html") || slug.includes("base64") || slug.includes("url-")) return affiliateLinks.developer;
  if (slug.includes("color") || slug.includes("gradient") || slug.includes("css") || slug.includes("image")) return affiliateLinks.design;
  if (slug.includes("password")) return affiliateLinks.security;
  return affiliateLinks[category] || affiliateLinks.utility;
}

const toolDescriptions = {
  "calculator": "Perform everyday arithmetic with a simple online calculator for addition, subtraction, multiplication, division, and bracketed expressions.",
  "percentage-calculator": "Find percentages quickly, including percent of a number, discounts, increases, decreases, and simple percentage-based comparisons.",
  "average-calculator": "Calculate the mean value from a list of numbers, useful for grades, prices, scores, measurements, and quick data checks.",
  "fraction-calculator": "Add, subtract, multiply, and divide fractions, then simplify the result into a cleaner fraction format.",
  "scientific-calculator": "Run common scientific calculations such as square roots, powers, trigonometry, logarithms, and advanced numeric operations.",
  "ratio-calculator": "Simplify ratios and compare two values in their smallest proportional form for recipes, scaling, finance, and math work.",
  "discount-calculator": "Calculate sale price, discount amount, and savings from an original price and discount percentage.",
  "tip-calculator": "Estimate a restaurant tip, total bill, and per-person split using bill amount, tip percentage, and number of people.",
  "loan-calculator": "Estimate monthly loan payments, total repayment, and total interest using loan amount, annual rate, and repayment term.",
  "interest-calculator": "Calculate simple interest and final balance from principal amount, interest rate, and time period.",
  "compound-interest-calculator": "Estimate compound growth over time using principal, annual interest rate, and investment or savings duration.",
  "mortgage-calculator": "Estimate monthly mortgage payments based on home loan amount, interest rate, and repayment term.",
  "tax-calculator": "Calculate tax amount and total cost after tax from a price or amount and a tax percentage.",
  "profit-margin-calculator": "Find profit and profit margin from revenue and cost, useful for pricing, ecommerce, and business planning.",
  "currency-calculator": "Convert an amount using a custom exchange rate for quick manual currency and pricing estimates.",
  "savings-calculator": "Project savings growth from monthly contributions, estimated annual return, and saving duration.",
  "bmi-calculator": "Calculate Body Mass Index from weight and height to get a quick general body weight category estimate.",
  "bmr-calculator": "Estimate Basal Metabolic Rate using weight, height, age, and gender to understand daily resting calorie needs.",
  "calorie-calculator": "Estimate daily maintenance calories from BMR for a practical starting point in nutrition planning.",
  "ideal-weight-calculator": "Estimate a healthy weight range from height using common BMI-based guidance.",
  "body-fat-calculator": "Estimate body fat percentage from BMI, age, and gender using a simple health estimation formula.",
  "water-intake-calculator": "Estimate daily water intake from body weight for a quick hydration planning reference.",
  "pregnancy-due-date-calculator": "Estimate a pregnancy due date from the first day of the last menstrual period using a standard 280-day calculation.",
  "heart-rate-calculator": "Estimate maximum heart rate and moderate exercise heart-rate zones based on age.",
  "age-calculator": "Calculate age in years from a birth date and today's date for forms, planning, and quick checks.",
  "unit-converter": "Convert common measurement units with a flexible general-purpose converter for length, weight, time, area, volume, and more.",
  "length-converter": "Convert distance and length values between meters, kilometers, centimeters, miles, yards, feet, and inches.",
  "weight-converter": "Convert weight and mass values between kilograms, grams, pounds, ounces, and tonnes.",
  "temperature-converter": "Convert temperatures between Celsius, Fahrenheit, and Kelvin for weather, cooking, science, and study.",
  "time-converter": "Convert time values between seconds, minutes, hours, days, and weeks.",
  "speed-converter": "Convert speed values between meters per second, kilometers per hour, miles per hour, and knots.",
  "area-converter": "Convert area measurements between square meters, square kilometers, acres, hectares, and square feet.",
  "volume-converter": "Convert volume values between liters, milliliters, gallons, quarts, and cups.",
  "data-storage-converter": "Convert digital storage sizes between bytes, KB, MB, GB, and TB.",
  "time-zone-converter": "Convert a selected date and time to another UTC offset for quick scheduling across regions.",
  "date-difference-calculator": "Find the number of days between two dates for deadlines, travel, billing, and planning.",
  "countdown-timer": "Start a simple countdown timer in seconds for workouts, study sessions, cooking, or timed tasks.",
  "stopwatch": "Measure elapsed time with a simple stopwatch that can start, stop, and reset.",
  "qr-code-generator": "Create a QR code from text or a URL for sharing links, contact information, or short messages.",
  "password-generator": "Generate strong random passwords with letters, numbers, and symbols for safer account creation.",
  "username-generator": "Generate quick username ideas using short readable words and random numbers.",
  "random-number-generator": "Generate a random number inside a custom minimum and maximum range.",
  "uuid-generator": "Generate a unique UUID for development, database records, testing, and identifiers.",
  "lorem-ipsum-generator": "Generate placeholder text paragraphs for mockups, layouts, content drafts, and design previews.",
  "hashtag-generator": "Turn keywords or topic ideas into clean social media hashtags.",
  "meta-tag-generator": "Generate basic HTML title and meta description tags for webpages.",
  "robots-txt-generator": "Create a simple robots.txt file with a sitemap reference for website crawling guidance.",
  "sitemap-generator": "Generate a basic XML sitemap from a list of URLs for search engine discovery.",
  "slug-generator": "Convert a title or phrase into a clean URL-friendly slug.",
  "color-palette-generator": "Generate a quick set of random color swatches for design ideas and UI inspiration.",
  "word-counter": "Count words, characters, sentences, and lines in pasted text for writing, SEO, and editing.",
  "character-counter": "Count characters in text for titles, descriptions, messages, social posts, and form limits.",
  "sentence-counter": "Count sentences in a block of text to review readability and writing structure.",
  "case-converter": "Convert text to uppercase, lowercase, or title case for clean formatting.",
  "text-reverser": "Reverse text character-by-character for quick transformations, tests, and playful formatting.",
  "remove-extra-spaces": "Clean messy text by removing repeated spaces and trimming extra whitespace.",
  "line-counter": "Count lines in pasted text, lists, code snippets, notes, or data blocks.",
  "text-sorter": "Sort lines alphabetically to organize lists, keywords, names, or simple datasets.",
  "duplicate-line-remover": "Remove repeated lines from a list while keeping one copy of each item.",
  "find-and-replace": "Find specific text and replace it throughout a pasted block of content.",
  "url-encoder": "Encode text or URLs into a safe format for query strings and web requests.",
  "url-decoder": "Decode URL-encoded text back into readable characters.",
  "base64-encoder": "Encode text into Base64 for testing, development, and simple data transformations.",
  "base64-decoder": "Decode Base64 text back into readable plain text.",
  "json-formatter": "Format raw JSON into readable, indented structure for debugging and development.",
  "json-validator": "Check whether JSON is valid and identify formatting errors before using it in code or APIs.",
  "html-encoder": "Convert HTML characters into safe escaped entities for display in webpages or code examples.",
  "html-decoder": "Convert escaped HTML entities back into readable HTML characters.",
  "markdown-previewer": "Preview basic Markdown formatting such as headings, bold text, and line breaks.",
  "csv-to-json-converter": "Convert simple CSV data into JSON objects using the first row as field names.",
  "seo-title-checker": "Check an SEO title length and see whether it fits a common search-friendly character range.",
  "meta-description-checker": "Check meta description length and get guidance for search result snippet readability.",
  "keyword-density-checker": "Measure how often a keyword appears in text and calculate its keyword density percentage.",
  "serp-snippet-preview": "Preview how a title, URL, and meta description may appear in a search result snippet.",
  "heading-structure-checker": "Count HTML heading tags from H1 to H6 to review webpage content structure.",
  "open-graph-checker": "Generate Open Graph meta tags for better link previews on social platforms.",
  "twitter-card-checker": "Generate Twitter Card meta tags for better shared link previews.",
  "canonical-url-checker": "Generate a canonical URL tag to help identify the preferred version of a webpage.",
  "schema-markup-helper": "Create basic website schema markup in JSON-LD format for structured data starters.",
  "alt-text-checker": "Check pasted HTML image tags and count images missing alt text.",
  "image-compressor": "Compress an uploaded image in the browser and download a smaller JPEG version.",
  "image-resizer": "Resize an uploaded image to a custom width and download the resized version.",
  "pdf-to-word": "Convert PDF files to Word documents using the server's document engine to keep layout, text, tables, and images as close to the original as possible.",
  "word-to-pdf": "Convert Word documents to PDF while preserving the original document layout, fonts, tables, and page structure when Microsoft Word is available.",
  "pdf-compressor": "Compress PDF files while keeping the document as a PDF and preserving page order and visible layout.",
  "merge-pdf": "Combine multiple PDF files into one PDF while keeping the original pages and their formatting intact.",
  "split-pdf": "Extract a page from a PDF while keeping that page's original formatting and layout.",
  "color-picker": "Pick a color visually and copy its HEX value for design, branding, and CSS work.",
  "hex-to-rgb-converter": "Convert a HEX color code into RGB format for CSS, design systems, and development.",
  "rgb-to-hex-converter": "Convert RGB color values into a HEX color code for CSS and design use.",
  "gradient-generator": "Generate a simple CSS linear gradient from two selected colors.",
  "css-box-shadow-generator": "Generate CSS box-shadow code from blur and spread values for UI styling.",
  "css-button-generator": "Generate a preview button and basic CSS styles from custom text and color.",
  "email-validator": "Check whether an email address matches a common valid email format.",
  "phone-number-formatter": "Clean and format phone number digits into a readable standard pattern when possible.",
  "ip-address-lookup": "Check whether an entered value follows a valid IPv4 address format.",
  "screen-resolution-checker": "Display your screen resolution and current browser viewport size.",
  "browser-info-checker": "Show browser user agent, language, and platform information for troubleshooting.",
  "typing-speed-test": "Measure typing speed in words per minute while you type a sample sentence.",
  "reading-time-calculator": "Estimate reading time from word count using a typical reading speed.",
  "ai-prompt-generator": "Create structured prompts for AI assistants based on task, audience, and tone.",
  "ai-blog-title-generator": "Generate practical blog title ideas from a topic or keyword.",
  "ai-meta-description-generator": "Draft a search-friendly meta description from a page topic and benefit.",
  "ai-email-writer": "Create a clean email draft from a goal, recipient, and preferred tone.",
  "ai-social-caption-generator": "Generate a short social media caption for common business platforms.",
  "ai-business-idea-generator": "Brainstorm business ideas from an industry and target market."
};

function describeTool(slug) {
  return toolDescriptions[slug] || "Use this free browser-based tool for quick online productivity tasks.";
}

const tools = [
  ["Calculator", "math", "calculator"],
  ["Percentage Calculator", "math", "percentage-calculator"],
  ["Average Calculator", "math", "average-calculator"],
  ["Fraction Calculator", "math", "fraction-calculator"],
  ["Scientific Calculator", "math", "scientific-calculator"],
  ["Ratio Calculator", "math", "ratio-calculator"],
  ["Discount Calculator", "math", "discount-calculator"],
  ["Tip Calculator", "math", "tip-calculator"],
  ["Loan Calculator", "finance", "loan-calculator"],
  ["Interest Calculator", "finance", "interest-calculator"],
  ["Compound Interest Calculator", "finance", "compound-interest-calculator"],
  ["Mortgage Calculator", "finance", "mortgage-calculator"],
  ["Tax Calculator", "finance", "tax-calculator"],
  ["Profit Margin Calculator", "finance", "profit-margin-calculator"],
  ["Currency Calculator", "finance", "currency-calculator"],
  ["Savings Calculator", "finance", "savings-calculator"],
  ["BMI Calculator", "health", "bmi-calculator"],
  ["BMR Calculator", "health", "bmr-calculator"],
  ["Calorie Calculator", "health", "calorie-calculator"],
  ["Ideal Weight Calculator", "health", "ideal-weight-calculator"],
  ["Body Fat Calculator", "health", "body-fat-calculator"],
  ["Water Intake Calculator", "health", "water-intake-calculator"],
  ["Pregnancy Due Date Calculator", "health", "pregnancy-due-date-calculator"],
  ["Heart Rate Calculator", "health", "heart-rate-calculator"],
  ["Age Calculator", "utility", "age-calculator"],
  ["Unit Converter", "utility", "unit-converter"],
  ["Length Converter", "utility", "length-converter"],
  ["Weight Converter", "utility", "weight-converter"],
  ["Temperature Converter", "utility", "temperature-converter"],
  ["Time Converter", "utility", "time-converter"],
  ["Speed Converter", "utility", "speed-converter"],
  ["Area Converter", "utility", "area-converter"],
  ["Volume Converter", "utility", "volume-converter"],
  ["Data Storage Converter", "utility", "data-storage-converter"],
  ["Time Zone Converter", "utility", "time-zone-converter"],
  ["Date Difference Calculator", "utility", "date-difference-calculator"],
  ["Countdown Timer", "utility", "countdown-timer"],
  ["Stopwatch", "utility", "stopwatch"],
  ["QR Code Generator", "generator", "qr-code-generator"],
  ["Password Generator", "generator", "password-generator"],
  ["Username Generator", "generator", "username-generator"],
  ["Random Number Generator", "generator", "random-number-generator"],
  ["UUID Generator", "generator", "uuid-generator"],
  ["Lorem Ipsum Generator", "generator", "lorem-ipsum-generator"],
  ["Hashtag Generator", "generator", "hashtag-generator"],
  ["Meta Tag Generator", "generator", "meta-tag-generator"],
  ["Robots.txt Generator", "generator", "robots-txt-generator"],
  ["Sitemap Generator", "generator", "sitemap-generator"],
  ["Slug Generator", "generator", "slug-generator"],
  ["Color Palette Generator", "generator", "color-palette-generator"],
  ["Word Counter", "text", "word-counter"],
  ["Character Counter", "text", "character-counter"],
  ["Sentence Counter", "text", "sentence-counter"],
  ["Case Converter", "text", "case-converter"],
  ["Text Reverser", "text", "text-reverser"],
  ["Remove Extra Spaces", "text", "remove-extra-spaces"],
  ["Line Counter", "text", "line-counter"],
  ["Text Sorter", "text", "text-sorter"],
  ["Duplicate Line Remover", "text", "duplicate-line-remover"],
  ["Find and Replace", "text", "find-and-replace"],
  ["URL Encoder", "utility", "url-encoder"],
  ["URL Decoder", "utility", "url-decoder"],
  ["Base64 Encoder", "utility", "base64-encoder"],
  ["Base64 Decoder", "utility", "base64-decoder"],
  ["JSON Formatter", "utility", "json-formatter"],
  ["JSON Validator", "utility", "json-validator"],
  ["HTML Encoder", "utility", "html-encoder"],
  ["HTML Decoder", "utility", "html-decoder"],
  ["Markdown Previewer", "text", "markdown-previewer"],
  ["CSV to JSON Converter", "utility", "csv-to-json-converter"],
  ["SEO Title Checker", "seo", "seo-title-checker"],
  ["Meta Description Checker", "seo", "meta-description-checker"],
  ["Keyword Density Checker", "seo", "keyword-density-checker"],
  ["SERP Snippet Preview", "seo", "serp-snippet-preview"],
  ["Heading Structure Checker", "seo", "heading-structure-checker"],
  ["Open Graph Checker", "seo", "open-graph-checker"],
  ["Twitter Card Checker", "seo", "twitter-card-checker"],
  ["Canonical URL Checker", "seo", "canonical-url-checker"],
  ["Schema Markup Helper", "seo", "schema-markup-helper"],
  ["Alt Text Checker", "seo", "alt-text-checker"],
  ["Image Compressor", "utility", "image-compressor"],
  ["Image Resizer", "utility", "image-resizer"],
  ["PDF to Word", "utility", "pdf-to-word"],
  ["Word to PDF", "utility", "word-to-pdf"],
  ["PDF Compressor", "utility", "pdf-compressor"],
  ["Merge PDF", "utility", "merge-pdf"],
  ["Split PDF", "utility", "split-pdf"],
  ["Color Picker", "utility", "color-picker"],
  ["HEX to RGB Converter", "utility", "hex-to-rgb-converter"],
  ["RGB to HEX Converter", "utility", "rgb-to-hex-converter"],
  ["Gradient Generator", "generator", "gradient-generator"],
  ["CSS Box Shadow Generator", "generator", "css-box-shadow-generator"],
  ["CSS Button Generator", "generator", "css-button-generator"],
  ["Email Validator", "utility", "email-validator"],
  ["Phone Number Formatter", "utility", "phone-number-formatter"],
  ["IP Address Lookup", "utility", "ip-address-lookup"],
  ["Screen Resolution Checker", "utility", "screen-resolution-checker"],
  ["Browser Info Checker", "utility", "browser-info-checker"],
  ["Typing Speed Test", "utility", "typing-speed-test"],
  ["Reading Time Calculator", "text", "reading-time-calculator"],
  ["AI Prompt Generator", "ai", "ai-prompt-generator"],
  ["AI Blog Title Generator", "ai", "ai-blog-title-generator"],
  ["AI Meta Description Generator", "ai", "ai-meta-description-generator"],
  ["AI Email Writer", "ai", "ai-email-writer"],
  ["AI Social Caption Generator", "ai", "ai-social-caption-generator"],
  ["AI Business Idea Generator", "ai", "ai-business-idea-generator"]
].map(([name, category, slug]) => {
  const affiliate = affiliateForTool(slug, category);

  return {
    name,
    category,
    slug,
    description: describeTool(slug),
    affiliateUrl: affiliate.url,
    affiliateLabel: affiliate.label,
    affiliateCategory: affiliate.category,
    status: "active"
  };
});

async function seedTools() {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/toolsdb");

  await Tool.deleteMany({});
  await Tool.insertMany(tools);

  const count = await Tool.countDocuments({ status: "active" });
  console.log(`Seed complete. Active tools in database: ${count}`);
  await mongoose.disconnect();
}

module.exports = { tools, seedTools };

if (require.main === module) {
  seedTools().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
}
