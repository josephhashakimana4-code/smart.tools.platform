const ToolFunctions = {

  bmi: (values) => {
    const weight = parseFloat(values?.weight);
    const height = parseFloat(values?.height);

    if (!weight || !height || height <= 0) {
      return "Invalid input for BMI";
    }

    const bmi = weight / (height * height);
    return `BMI: ${bmi.toFixed(2)}`;
  },

  age: (values) => {
    if (!values?.date) return "Invalid date";

    const birth = new Date(values.date);
    const now = new Date();

    if (isNaN(birth.getTime())) return "Invalid date format";

    let age = now.getFullYear() - birth.getFullYear();

    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }

    return `Age: ${age}`;
  },

  password: (length = 12) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$!";

    let pass = "";
    for (let i = 0; i < length; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return pass;
  },

  word: (values) => {
    const text = values?.text || "";
    const count = text.trim() ? text.trim().split(/\s+/).length : 0;
    return `Words: ${count}`;
  }

};

export default ToolFunctions;