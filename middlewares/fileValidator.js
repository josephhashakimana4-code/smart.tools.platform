const path = require("path");

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function validateFileSignature(file) {

  if (!file || !file.buffer) {
    return false;
  }

  if (file.size > MAX_FILE_SIZE) {
    return false;
  }

  if (file.size < 10) {
    return false;
  }

  const buffer = file.buffer;
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === ".pdf") {
    return buffer.slice(0, 5).toString() === "%PDF-";
  }

  if (ext === ".docx") {
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    );
  }

  if (ext === ".doc") {
    return (
      buffer[0] === 0xd0 &&
      buffer[1] === 0xcf &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xe0
    );
  }

  return false;
}

module.exports = validateFileSignature;
