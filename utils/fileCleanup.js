const fs = require("fs");
const path = require("path");

function cleanupFolder(folder, ageMinutes = 60) {

  if (!fs.existsSync(folder)) return;

  const now = Date.now();

  fs.readdirSync(folder).forEach(file => {

    const filePath = path.join(folder, file);

    const stats = fs.statSync(filePath);

    const age =
      (now - stats.mtimeMs) / (1000 * 60);

    if (age > ageMinutes) {
      fs.unlinkSync(filePath);
      console.log("Deleted expired file:", file);
    }

  });
}

module.exports = cleanupFolder;
