document.addEventListener("DOMContentLoaded", function () {

  const form = document.getElementById("contactForm");
  const status = document.getElementById("status");

  if (!form || !status) {
    console.error("Contact form or status element not found");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const message = document.getElementById("message").value.trim();

    // Basic validation
    if (!name || !email || !message) {
      status.innerText = "Please fill all fields!";
      status.style.color = "red";
      return;
    }

    try {
      status.innerText = "Sending...";
      status.style.color = "black";

      const apiBase = window.location.protocol === "file:" ? "http://localhost:5000" : window.location.origin;
      const response = await fetch(`${apiBase}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, email, message })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        status.innerText = "Message sent successfully!";
        status.style.color = "green";
        this.reset();
      } else {
        status.innerText = data.message || "Failed to send message";
        status.style.color = "red";
      }

    } catch (error) {
      console.error("Contact Error:", error);
      status.innerText = "Server error. Please try again.";
      status.style.color = "red";
    }
  });

});
