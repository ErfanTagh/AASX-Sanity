document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("jsonFileInput");
  const shellWrapper = document.querySelector(".shell-wrapper");
  const downloadBtn = document.getElementById("downloadCleanedBtn");
  let lastCleanedJson = null;
  let originalJson = null;
  let originalFilename = null;

  if (fileInput) {
    fileInput.addEventListener("change", function (event) {
      const file = event.target.files[0];
      if (!file) return;

      // Store original filename
      originalFilename = file.name;

      // Store original JSON for comparison
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          originalJson = JSON.parse(e.target.result);
        } catch (error) {
          console.error("Error parsing original JSON:", error);
        }
      };
      reader.readAsText(file);

      const formData = new FormData();
      formData.append("file", file);

      fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Upload failed");
          return response.json();
        })
                 .then((jsonData) => {
           // Clear any existing cards
           shellWrapper.innerHTML = "";

           // Store the cleaned JSON for download
           lastCleanedJson = jsonData["JSON"];

           // Store the applied Keys
           keys = jsonData["KEYS"];

           if (downloadBtn) {
             downloadBtn.disabled = false;
           }

           // Show success toast with auto-hide after 5 seconds
           const successToast = new bootstrap.Toast(document.getElementById('successToast'), {
             delay: 3000,
             autohide: true
           });
           successToast.show();

           // Display the cleaned JSON as cards with diff view
           try {
            if (Array.isArray(jsonData["JSON"])) {
              jsonData["JSON"].forEach((item, index) => {
                try {
                  const originalItem = originalJson && Array.isArray(originalJson) ? originalJson[index] : null;
                  const card = createShellCard(item, originalItem,keys);
                  shellWrapper.appendChild(card);
                } catch (error) {
                  console.error(`Error creating card for item ${index}:`, error);
                  // Create a simple error card
                  const errorCard = document.createElement("div");
                  errorCard.className = "shell-card card p-3";
                  errorCard.innerHTML = `<h5 class="card-title text-danger">Error processing item ${index}</h5>`;
                  shellWrapper.appendChild(errorCard);
                }
              });
            } else if (typeof jsonData["JSON"] === "object") {
              const card = createShellCard(jsonData["JSON"], originalJson,keys);
              shellWrapper.appendChild(card);
            } else {
              alert("Unsupported JSON format from server.");
            }
          } catch (error) {
            console.error("Error displaying JSON data:", error);
            alert("Error displaying the processed data. Check console for details.");
          }
        })
        .catch((err) => {
          console.error(err);
          alert("Error uploading or processing file.");
        });
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      console.log("Download button clicked");
      console.log("lastCleanedJson:", lastCleanedJson);
      console.log("originalFilename:", originalFilename);
      
      if (!lastCleanedJson) {
        console.log("No cleaned JSON data available");
        return;
      }
      const blob = new Blob([
        JSON.stringify(lastCleanedJson, null, 2)
      ], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Create download filename based on original filename
      let downloadFilename = "cleaned_output.json";
      if (originalFilename) {
        // Remove .json extension if it exists and add _cleaned.json
        const nameWithoutExt = originalFilename.replace(/\.json$/i, '');
        downloadFilename = `${nameWithoutExt}_cleaned.json`;
      }
      a.download = downloadFilename;
      console.log("Download filename:", downloadFilename);
      document.body.appendChild(a);
      console.log("Download link created and clicked");
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log("Download cleanup completed");
      }, 0);
    });
  }

  function createShellCard(data, originalData,keys = []) {
    const card = document.createElement("div");
    card.className = "shell-card card p-3";

    // Use safe defaults for missing properties with proper error handling
    let title = "";
    try {
      // Look for idShort in AssetInformation or use the main idShort
      title = data.assetAdministrationShells?.[0]?.idShort || data.idShort || "";
    } catch (error) {
      console.error("Error accessing title:", error);
      title = data.idShort || "";
    }
    
    const displayName = data.displayName || "";
    const description = keys;
    const category = data.category || "";
    const semanticId = data.semanticId?.keys?.[0]?.value || "";

    // Generate diff view with error handling
    let diffView = "";
    try {
      diffView = originalData ? generateDetailedDiffView(originalData, data) : "";
    } catch (error) {
      console.error("Error generating diff view:", error);
      diffView = '<div class="diff-line unchanged">Error generating diff view</div>';
    }

      const tableRows = keys.map(rule => `
    <tr>
      <td>${rule.id}</td>
      <td>${rule.desc}</td>
    </tr>
  `).join("");

    card.innerHTML = `
      <h5 class="card-title">${escapeHTML(title)}</h5>
      <p class="text-muted fst-italic small">${escapeHTML(displayName)}</p>
      <p class="text-info small">
     
        ${category ? `<span>${escapeHTML(category)}</span><br>` : ""}
        ${semanticId ? `<span>Semantic ID: ${escapeHTML(semanticId)}</span>` : ""}
      </p>
      
       <div class="rules-wrapper">
      <table class="rules-table">
        <thead>
          Rules Applied: 
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
      
      <div class="row mt-3">
        ${diffView ? `
          <div class="col-md-6">
            <h6 class="text-warning">Changes Applied:</h6>
            <div class="diff-container bg-dark text-light p-2 rounded" style="max-height:600px; overflow:auto; font-family: 'Courier New', monospace; font-size: 12px;">
              ${diffView}
            </div>
          </div>
        ` : ''}
        
        <div class="${diffView ? 'col-md-6' : 'col-md-12'}">
          <h6 class="text-info">Final Result:</h6>
          <pre class="bg-dark text-light p-2 mt-2 small" style="max-height:600px; overflow:auto;">${escapeHTML(JSON.stringify(data, null, 2))}</pre>
        </div>
      </div>
    `;

    return card;
  }

  function generateDetailedDiffView(original, modified) {
    const originalStr = JSON.stringify(original, null, 2);
    const modifiedStr = JSON.stringify(modified, null, 2);
    
    return buildDiffHtml(originalStr, modifiedStr);
  }

  function buildDiffHtml(orig, mod) {
    const parts = diffLines(orig, mod, { newlineIsToken: false });
    let html = '';

    parts.forEach(part => {
      if (part.removed) {
        html += `<div class="diff-line deleted">${escapeHTML(part.value)}</div>`;
      } else if (part.added) {
        html += `<div class="diff-line added">${escapeHTML(part.value)}</div>`;
      }
      // unchanged lines are ignored → no noisy output
    });

    return html || '<div class="diff-line unchanged">No changes detected</div>';
  }

  function diffLines(oldStr, newStr, options = {}) {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    const parts = [];
    
    let i = 0, j = 0;
    
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        // Lines are identical - skip unchanged lines
        i++;
        j++;
      } else {
        // Find the longest common subsequence
        let removed = [];
        let added = [];
        
        // Collect removed lines
        while (i < oldLines.length && (j >= newLines.length || oldLines[i] !== newLines[j])) {
          removed.push(oldLines[i]);
          i++;
        }
        
        // Collect added lines
        while (j < newLines.length && (i >= oldLines.length || oldLines[i] !== newLines[j])) {
          added.push(newLines[j]);
          j++;
        }
        
        // Add removed lines
        if (removed.length > 0) {
          parts.push({
            removed: true,
            added: false,
            value: removed.join('\n')
          });
        }
        
        // Add added lines
        if (added.length > 0) {
          parts.push({
            removed: false,
            added: true,
            value: added.join('\n')
          });
        }
      }
    }
    
    return parts;
  }

  // Helper to prevent XSS
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Reload all function
  window.reloadAll = function() {
    // Simply reload the page
    window.location.reload();
  };
});
