function append(val) {
  document.getElementById("display").value += val;
}

function calculate() {
  try {
    const display = document.getElementById("display");
    display.value = eval(display.value);
  } catch {
    display.value = "Error";
  }
}

function clearDisplay() {
  document.getElementById("display").value = "";
}
