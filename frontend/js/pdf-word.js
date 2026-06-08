async function uploadPDF() {
  const API_BASE = window.location.protocol === "file:" ? "http://localhost:5000" : "";
  const fileInput = document.getElementById("pdfFile");
  const status = document.getElementById("status");
  const downloadLink = document.getElementById("downloadLink");

  if (!fileInput.files[0]) {
    status.innerText = "Please select a PDF file.";
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  status.innerText = "Converting... please wait.";
  downloadLink.style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/api/tools/pdf-to-word`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (data.success && data.downloadUrl) {
      const filename = data.filename || decodeURIComponent(data.downloadUrl.split("/").pop() || "converted-file.docx");
      const encodedUrl = encodeURIComponent(data.downloadUrl);
      const encodedFilename = encodeURIComponent(filename);
      status.innerHTML = `
        <div class="download-panel">
          <strong>Your Word file is ready.</strong>
          <span>${filename}</span>
          <button type="button" class="download-btn" onclick="downloadPDFFile('${encodedUrl}', '${encodedFilename}', 'inlineDownloadStatus')">Download File</button>
          <a class="direct-link" href="${data.downloadUrl}" target="_blank">Open database download link</a>
          ${data.directUrl ? `<a class="direct-link" href="${data.directUrl}" target="_blank">Open direct file link</a>` : ""}
          <small id="inlineDownloadStatus">Click Download File, then check your PC Downloads folder.</small>
        </div>
      `;
      downloadLink.href = data.downloadUrl;
      downloadLink.innerText = "Download Word File";
      downloadLink.className = "download-btn";
      downloadLink.style.display = "inline-block";
      downloadLink.target = "_blank";
      downloadLink.setAttribute("download", filename);
      showPDFDownloadPopup(data.downloadUrl, filename, data.directUrl);
    } else {
      status.innerText = data.message || "Conversion failed.";
    }
  } catch (err) {
    console.error(err);
    status.innerText = "Server error. Make sure the backend is running.";
  }
}

function showPDFDownloadPopup(url, filename, directUrl = "") {
  const oldPopup = document.querySelector(".download-modal");
  if (oldPopup) oldPopup.remove();
  const encodedUrl = encodeURIComponent(url);
  const encodedFilename = encodeURIComponent(filename);

  const popup = document.createElement("div");
  popup.className = "download-modal";
  popup.innerHTML = `
    <div class="download-modal-box">
      <button class="modal-close" onclick="closePDFDownloadPopup()">×</button>
      <h2>Conversion Complete</h2>
      <p>Your Word file is ready.</p>
      <strong class="download-filename">${filename}</strong>
      <button type="button" class="download-btn big" onclick="downloadPDFFile('${encodedUrl}', '${encodedFilename}', 'downloadStatus')">Download Now</button>
      <p id="downloadStatus" class="download-status">After clicking download, your browser will save the file to your PC Downloads folder unless you chose another folder.</p>
      ${directUrl ? `<a class="direct-link" href="${directUrl}" target="_blank">Backup direct file link</a>` : ""}
    </div>
  `;

  document.body.appendChild(popup);
}

function closePDFDownloadPopup() {
  document.querySelector(".download-modal")?.remove();
}

function markPDFDownloadStarted() {
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

async function downloadPDFFile(encodedUrl, encodedFilename, statusId) {
  const status = document.getElementById(statusId);
  const url = decodeURIComponent(encodedUrl);
  const filename = decodeURIComponent(encodedFilename || "converted-file.docx");

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
    link.download = filename;
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
