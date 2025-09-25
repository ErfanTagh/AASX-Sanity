document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("jsonFileInput");
  const shellWrapper = document.querySelector(".shell-wrapper");
  const shellInteractive = document.querySelector(".code-wrapper");

  const downloadBtn = document.getElementById("downloadCleanedBtn");
  let lastCleanedJson = null;
  let originalJson = null;
  let originalFilename = null;
  let before = null;
  let after = null;
  let before_full = null;
  let after_full = null;
  let complete_after_data = null;
  let complete_before_data = null;
  let currentRule = null;
  let skipRules = [];

  // Add global variable to track rejected rules
  let rejectedRules = [];

  // Add function to add a rule to the rejected list
  function addRejectedRule(ruleNumber) {
    if (!rejectedRules.includes(ruleNumber)) {
      rejectedRules.push(ruleNumber);
      console.log("Rejected rules:", rejectedRules);
    }
  }

  // Add function to reset rejected rules (when new file is uploaded or changes are accepted)
  function resetRejectedRules() {
    rejectedRules = [];
    console.log("Rejected rules reset");
  }

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
          resetRejectedRules(); // Reset rejected rules for new file
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

           shellInteractive.innerHTML = "";

           // Store the cleaned JSON for download
           lastCleanedJson = jsonData["JSON"];

           // Store the applied Keys
           keys = jsonData["KEYS"];

          
            before = jsonData["BEFORE"];
            after = jsonData["AFTER"];
            before_full = jsonData["Before_data"];
            after_full = jsonData["After_data"];
            complete_after_data = jsonData["Complete_after_data"];
            complete_before_data = jsonData["Complete_before_data"];
            currentRule = jsonData["CURRENT_RULE"];
            skipRules = jsonData["SKIP_RULES"] || [];
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
                  const card = createShellCard(item, originalItem, keys);
                  shellWrapper.appendChild(card);
                } catch (error) {
                  console.error(`Error creating card for item ${index}:`, error);
                  const errorCard = document.createElement("div");
                  errorCard.className = "shell-card card p-3";
                  errorCard.innerHTML = `<h5 class="card-title text-danger">Error processing item ${index}</h5>`;
                  shellWrapper.appendChild(errorCard);
                }
              });
              // Create a single code review card in the validation tab
              const codeCard = createCodeCard(before, after, before_full, after_full);
              shellInteractive.innerHTML = "";
              shellInteractive.appendChild(codeCard);
              
              // Create changes and results card for the new tab
              const changesResultsCard = createChangesResultsCard(jsonData["JSON"], originalJson, keys);
              const changesResultsWrapper = document.querySelector(".changes-results-wrapper");
              changesResultsWrapper.innerHTML = "";
              changesResultsWrapper.appendChild(changesResultsCard);
            } else if (typeof jsonData["JSON"] === "object") {
              const card = createShellCard(jsonData["JSON"], originalJson, keys);
              shellWrapper.appendChild(card);
              // Create a single code review card in the validation tab
              const codeCard = createCodeCard(before, after, before_full, after_full);
              shellInteractive.innerHTML = "";
              shellInteractive.appendChild(codeCard);
              
              // Create changes and results card for the new tab
              const changesResultsCard = createChangesResultsCard(jsonData["JSON"], originalJson, keys);
              const changesResultsWrapper = document.querySelector(".changes-results-wrapper");
              changesResultsWrapper.innerHTML = "";
              changesResultsWrapper.appendChild(changesResultsCard);
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
    
    <div>
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
      

    `;

    return card;
  }

  function createCodeCard(before,after,before_full,after_full){
    const card = document.createElement("div");
    card.className = "code-card card shadow";
    card.innerHTML = `
      <div class="card-header bg-primary text-white ">
        <h4 class="mb-0">
          <i class="bi bi-code-slash me-2"></i>
          Code Review: JSON Processing Changes
        </h4>
      </div>
      
      <div class="card-body p-0">
        <!-- Tab Navigation -->
        <ul class="nav nav-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="diff-tab" data-bs-toggle="tab" data-bs-target="#diff" type="button" role="tab">
              <i class="bi bi-arrow-left-right me-1"></i>
              Side by Side
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="before-tab" data-bs-toggle="tab" data-bs-target="#before" type="button" role="tab">
              <i class="bi bi-dash-circle me-1"></i>
              Before
            </button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="after-tab" data-bs-toggle="tab" data-bs-target="#after" type="button" role="tab">
              <i class="bi bi-plus-circle me-1"></i>
              After
            </button>
          </li>
        </ul>

        <!-- Tab Content -->
        <div class="tab-content">
          <!-- Side by Side View -->
          <div class="tab-pane fade show active" id="diff" role="tabpanel">
            <div class="row g-0 code-container">
              <div class="col-md-6 border-end">
                <h6 class="text-warning p-2 m-0">Before:</h6>
                <div class="diff-container bg-dark text-light p-2 rounded" style="max-height:600px; overflow:auto; font-family: 'Courier New', monospace; font-size: 12px;">
                  <pre class="m-0"><code>${escapeHTML(JSON.stringify(before, null, 2))}</code></pre>
                </div>
              </div>
              <div class="col-md-6">
                <h6 class="text-info p-2 m-0">Changes done by script:</h6>
                <div class="diff-container bg-dark text-light p-2 rounded" style="max-height:600px; overflow:auto; font-family: 'Courier New', monospace; font-size: 12px;">
                  <pre class="m-0"><code>${escapeHTML(JSON.stringify(after, null, 2))}</code></pre>
                </div>
              </div>
            </div>
          </div>

          <!-- Before Only -->
          <div class="tab-pane fade" id="before" role="tabpanel">
            <h6 class="text-warning p-2 m-0">Changes Applied:</h6>
            <div class="diff-container bg-dark text-light p-2 rounded" style="max-height:600px; overflow:auto; font-family: 'Courier New', monospace; font-size: 12px;">
              <pre class="m-0"><code>${escapeHTML(JSON.stringify(before, null, 2))}</code></pre>
            </div>
          </div>

          <!-- After Only -->
          <div class="tab-pane fade" id="after" role="tabpanel">
            <h6 class="text-info p-2 m-0">Final Result:</h6>
            <div class="diff-container bg-dark text-light p-2 rounded" style="max-height:600px; overflow:auto; font-family: 'Courier New', monospace; font-size: 12px;">
              <pre class="m-0"><code>${escapeHTML(JSON.stringify(after, null, 2))}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="card-footer bg-light">
        <div class="d-flex justify-content-between align-items-center">
          <div class="text-muted">
            <small>
              <i class="bi bi-info-circle me-1"></i>
              Review the changes and decide whether to accept or reject them.
            </small>
          </div>
          <div class="btn-group" role="group">
            <button type="button" class="btn btn-outline-danger" onclick="rejectChanges()">
              <i class="bi bi-x-circle me-1"></i>
              Reject
            </button>
            <button type="button" class="btn btn-success" onclick="acceptChanges()">
              <i class="bi bi-check-circle me-1"></i>
              Accept Changes
            </button>
               <button type="button" class="btn btn-warning" onclick="downloadCurrentState()">
              <i class="bi bi-download me-1"></i>
              Download Current State
            </button>
          </div>
        </div>
      </div>
      
    `;
    return card;
  }

  function createChangesResultsCard(data,originalData,keys = []) {
    const card = document.createElement("div");
    card.className = "code-card card shadow";
    
        // Generate diff view with error handling
        let diffView = "";
        try {
          diffView = originalData ? generateDetailedDiffView(originalData, data) : "";
        } catch (error) {
          console.error("Error generating diff view:", error);
          diffView = '<div class="diff-line unchanged">Error generating diff view</div>';
        }
    
    
    card.innerHTML = `
      <div class="card-header bg-primary text-white">
        <h4 class="mb-0">
          <i class="bi bi-file-diff me-2"></i>
          Changes Applied & Final Results
        </h4>
      </div>
      
      <div class="card-body">
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

  // Helper function to update code card content with new before/after data
  function updateCodeCardContent(newBefore, newAfter) {
    // Update global variables
    before = newBefore;
    after = newAfter;
    
    // Find all code cards and update their content
    const codeCards = document.querySelectorAll('.code-card');
    codeCards.forEach(card => {
      // Update side by side view
      const beforePre = card.querySelector('#diff .col-md-6:first-child pre code');
      const afterPre = card.querySelector('#diff .col-md-6:last-child pre code');
      if (beforePre) beforePre.textContent = JSON.stringify(newBefore, null, 2);
      if (afterPre) afterPre.textContent = JSON.stringify(newAfter, null, 2);
      
      // Update before-only tab
      const beforeOnlyPre = card.querySelector('#before pre code');
      if (beforeOnlyPre) beforeOnlyPre.textContent = JSON.stringify(newBefore, null, 2);
      
      // Update after-only tab
      const afterOnlyPre = card.querySelector('#after pre code');
      if (afterOnlyPre) afterOnlyPre.textContent = JSON.stringify(newAfter, null, 2);
    });
  }

  // Reload all function
  window.reloadAll = function() {
    // Simply reload the page
    window.location.reload();
  };

  // REJECT/ACCEPT button handlers
  window.rejectChanges = function() {
    console.log("REJECT button clicked");
    console.log("Rejected rules:", rejectedRules);
    
    if (!before) {
      alert("No before data available to reject changes.");
      return;
    }
    
    // Call the reject endpoint with before data and list of rejected rules
    fetch("http://localhost:5000/reject-changes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_data: complete_before_data || before,  // Use complete data if available
        current_rule: currentRule,  // Send current rule to skip
        skip_rules: skipRules,  // Send current skip rules from server
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Reject response:", data);
      
      // Add the current rule to rejected list
      if (data.CURRENT_RULE) {
        addRejectedRule(data.CURRENT_RULE);
      }
      
      // Update skip rules from server response
      if (data.SKIP_RULES) {
        skipRules = data.SKIP_RULES;
      }
      
      // Update global variables from API response
      if (data.BEFORE) before = data.BEFORE;
      if (data.AFTER) after = data.AFTER;
      if (data.CURRENT_RULE) currentRule = data.CURRENT_RULE;
      if (data.Before_data) before_full = data.Before_data;
      if (data.After_data) after_full = data.After_data;
      if (data.Complete_after_data) complete_after_data = data.Complete_after_data;
      if (data.Complete_before_data) complete_before_data = data.Complete_before_data;
      
      // Update the UI with new before/after data
      if (data.AFTER) {
        updateCodeCardContent(data.BEFORE || before, data.AFTER);
        alert(`Changes rejected! Trying next available rule.`);
      } else {
        // No more changes - show completion message and clear the diff view
        updateCodeCardContent(null, null);
        alert("All changes processed! No more rules to apply.");
      }
    })
    .catch(error => {
      console.error("Error rejecting changes:", error);
      alert("Error rejecting changes. Please try again.");
    });
  };

  // Update the acceptChanges function - DON'T reset rejected rules
  window.acceptChanges = function() {
    console.log("ACCEPT button clicked");
    
    // Use the passed parameter or fallback to global after_full
    const dataToUse =  after_full;
    console.log("dataToUse:", dataToUse);
    if (!dataToUse) {
      alert("No after data available to accept changes.");
      return;
    }
    
    // Call the accept endpoint with after data
    fetch("http://localhost:5000/accept-changes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_data: complete_before_data || before,  // Use complete data if available
        after_data: dataToUse,
        complete_after_data: complete_after_data,
        skip_rules: skipRules
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log("Accept response:", data);
      
      // DON'T reset rejected rules - let them persist
      // resetRejectedRules(); // Remove this line
      
      // Update skip rules from server response
      if (data.SKIP_RULES) {
        skipRules = data.SKIP_RULES;
      }
      
      // Update global variables from API response
      if (data.BEFORE) before = data.BEFORE;
      if (data.AFTER) after = data.AFTER;
      if (data.CURRENT_RULE) currentRule = data.CURRENT_RULE;
      if (data.Before_data) before_full = data.Before_data;
      if (data.After_data) after_full = data.After_data;
      if (data.Complete_after_data) complete_after_data = data.Complete_after_data;
      if (data.Complete_before_data) complete_before_data = data.Complete_before_data;
      
      // Update the UI with new before/after data from API response
      if (data.AFTER) {
        updateCodeCardContent(data.BEFORE || after, data.AFTER);
        alert("Changes accepted! UI updated with new data.");
      } else {
        // No more changes - show completion message and clear the diff view
        updateCodeCardContent(null, null);
        alert("All changes processed! No more rules to apply.");
      }
    })
    .catch(error => {
      console.error("Error accepting changes:", error);
      alert("Error accepting changes. Please try again.");
    });
  };

    // Download Current State functionality
    window.downloadCurrentState = function() {
      console.log("Download Current State button clicked");
      
      // Use complete_before_data if available, otherwise use complete_after_data
      const currentData = complete_before_data || complete_after_data;
      
      if (!currentData) {
        alert("No current state data available to download.");
        return;
      }
      
      // Create a download link and trigger download
      const dataStr = JSON.stringify(currentData, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `current_state_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert("Current state downloaded successfully!");
    };
});
