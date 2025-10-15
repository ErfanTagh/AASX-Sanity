document.addEventListener("DOMContentLoaded", function () {
  const fileInput = document.getElementById("jsonFileInput");
  const shellWrapper = document.querySelector(".shell-wrapper");
  const shellInteractive = document.querySelector(".code-wrapper");

  const downloadBtn = document.getElementById("downloadCleanedBtn");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const loadingMessage = document.getElementById("loadingMessage");
  
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
  // Status counters

  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  // Add global variable to track rejected rules
  let rejectedRules = [];
  
  // Loading helper functions
  function showLoading(message = "Processing...") {
    if (loadingOverlay) {
      loadingOverlay.style.display = 'flex';
      if (loadingMessage) {
        loadingMessage.textContent = message;
      }
    }
  }
  
  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }
  }
  
  // Track history of all accept/decline decisions
  let changeHistory = [];
  
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
  
  // Add change to history - track both accepted and rejected
  function addToChangeHistory(ruleNumber, action, beforeData, afterData, completeAfterJson) {
    const historyItem = {
      ruleNumber: ruleNumber,
      action: action, // 'accepted' or 'rejected'
      timestamp: new Date().toISOString(),
      before: beforeData, // Fragment that changed
      after: afterData, // Fragment after change
      completeAfterJson: action === 'accepted' ? completeAfterJson : null, // Full JSON only for accepted changes
      state: action === 'accepted' ? (changeHistory.filter(h => h.action === 'accepted').length + 1) : null
    };
    changeHistory.push(historyItem);
    updateChangesHistoryDisplay();
  }
  
  // Update the changes history display in tab 3
  function updateChangesHistoryDisplay() {
    const historySection = document.getElementById('changesHistorySection');
    if (!historySection) return;
    
    // Build history HTML
    let historyHTML = `
      <div class="card bg-dark text-light shadow mb-3">
        <div class="card-header bg-secondary d-flex justify-content-between align-items-center">
          <h5 class="mb-0">
            <i class="bi bi-clock-history me-2"></i>
            Rule Validation History (${changeHistory.length} decisions)
          </h5>
          <span class="badge bg-info">
            ${changeHistory.filter(h => h.action === 'accepted').length} Accepted | 
            ${changeHistory.filter(h => h.action === 'rejected').length} Rejected
          </span>
        </div>
        <div class="card-body p-0">
          <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
            <table class="table table-dark table-hover table-sm mb-0">
              <thead style="position: sticky; top: 0; background-color: #1e293b; z-index: 1;">
                <tr>
                  <th width="8%">#</th>
                  <th width="12%">Rule</th>
                  <th width="15%">Action</th>
                  <th width="20%">Timestamp</th>
                  <th width="10%">State</th>
                  <th width="35%">Actions</th>
                </tr>
              </thead>
              <tbody>
    `;
    
    if (changeHistory.length === 0) {
      historyHTML += `
        <tr>
          <td colspan="6" class="text-center text-muted p-4">
            <i class="bi bi-inbox" style="font-size: 2rem;"></i>
            <p class="mt-2 mb-0">No decisions made yet. Accept or reject changes in the Rule Validation tab.</p>
          </td>
        </tr>
      `;
    } else {
      // Show in reverse chronological order (newest first)
      changeHistory.slice().reverse().forEach((item, index) => {
        const actualIndex = changeHistory.length - index - 1;
        const timeFormatted = new Date(item.timestamp).toLocaleString();
        const actionBadge = item.action === 'accepted' 
          ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Accepted</span>'
          : '<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Rejected</span>';
        
        const stateBadge = item.state 
          ? `<span class="badge bg-info">State ${item.state}</span>`
          : '<span class="badge bg-secondary">-</span>';
        
        historyHTML += `
          <tr class="${item.action === 'accepted' ? 'table-success' : 'table-danger'}" style="--bs-table-bg-opacity: 0.1;">
            <td><strong>${changeHistory.length - index}</strong></td>
            <td><span class="badge bg-primary">Rule ${item.ruleNumber}</span></td>
            <td>${actionBadge}</td>
            <td><small>${timeFormatted}</small></td>
            <td>${stateBadge}</td>
            <td>
              <button class="btn btn-sm btn-outline-info me-1" onclick="showHistoryDetail(${actualIndex})" title="View Diff">
                <i class="bi bi-eye"></i> View
              </button>
              ${item.action === 'accepted' ? `
                <button class="btn btn-sm btn-outline-success" onclick="downloadHistoryState(${actualIndex})" title="Download State">
                  <i class="bi bi-download"></i> Download
                </button>
              ` : ''}
            </td>
          </tr>
        `;
      });
    }
    
    historyHTML += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    historySection.innerHTML = historyHTML;
  }
  
  // Update the current state pane
  function updateCurrentStateDisplay(currentData) {
    const currentStateContent = document.getElementById('currentStateContent');
    if (!currentStateContent) return;
    
    const jsonHtml = `<pre class="m-0"><code>${escapeHTML(JSON.stringify(currentData || {}, null, 2))}</code></pre>`;
    currentStateContent.innerHTML = jsonHtml;
  }
  
  // Show detailed view of a history item
  window.showHistoryDetail = function(index) {
    const item = changeHistory[index];
    if (!item) return;
    
    const actionText = item.action === 'accepted' ? 'Accepted' : 'Rejected';
    const actionClass = item.action === 'accepted' ? 'success' : 'danger';
    const stateText = item.state ? `State ${item.state}` : 'No State Change';
    
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-xl">
        <div class="modal-content bg-dark text-light">
          <div class="modal-header border-${actionClass}">
            <h5 class="modal-title">
              <span class="badge bg-${actionClass}">${actionText}</span>
              Rule ${item.ruleNumber} - ${stateText}
            </h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <strong>Timestamp:</strong> ${new Date(item.timestamp).toLocaleString()}
              <span class="ms-3"><strong>Action:</strong> <span class="badge bg-${actionClass}">${actionText}</span></span>
              ${item.state ? `<span class="ms-3"><strong>Result:</strong> <span class="badge bg-info">State ${item.state}</span></span>` : ''}
            </div>
            <div class="row">
              <div class="col-md-6">
                <h6 class="text-warning">
                  <i class="bi bi-file-earmark-code"></i> Before:
                  ${item.state && item.state > 1 ? ` (State ${item.state - 1})` : ' (Original)'}
                </h6>
                <pre class="bg-secondary p-3 rounded" style="max-height: 500px; overflow: auto;"><code>${escapeHTML(JSON.stringify(item.before, null, 2))}</code></pre>
              </div>
              <div class="col-md-6">
                <h6 class="${item.action === 'accepted' ? 'text-success' : 'text-danger'}">
                  <i class="bi bi-file-earmark-${item.action === 'accepted' ? 'check' : 'x'}"></i> After:
                  ${item.action === 'accepted' ? (item.state ? ` (State ${item.state})` : '') : ' (Rejected - Not Applied)'}
                </h6>
                <pre class="bg-secondary p-3 rounded" style="max-height: 500px; overflow: auto;"><code>${escapeHTML(JSON.stringify(item.after, null, 2))}</code></pre>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            ${item.action === 'accepted' ? `
              <button type="button" class="btn btn-success" onclick="downloadHistoryState(${index})">
                <i class="bi bi-download"></i> Download State ${item.state}
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    modal.addEventListener('hidden.bs.modal', () => {
      modal.remove();
    });
  };
  
  // Download a specific history state - downloads the complete JSON
  window.downloadHistoryState = function(index) {
    const item = changeHistory[index];
    if (!item) return;
    
    // Download the complete JSON file, not just the fragment
    const completeJson = item.completeAfterJson || item.after;
    const dataStr = JSON.stringify(completeJson, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date(item.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `${item.action}_rule_${item.ruleNumber}_${item.state ? `state_${item.state}_` : ''}${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

      // Show simple loading overlay
      showLoading("Processing JSON file...");

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
         


              // Fetch keys applied length
              fetch("http://localhost:5000/keys-applied-length", {
                method: "GET"
              })
              .then(response => response.json())
              .then(data => {
                  pendingCount = data.keys_applied_length;
                  const penE3 = document.getElementById('pendingCount');
                  
                  if (penE3) penE3.textContent = String(pendingCount);
              })
              .catch(error => {
                console.error("Error fetching keys applied length:", error);
              }); 
           
           // Hide loading overlay
           hideLoading();
           
           // Show success toast with auto-hide after 5 seconds
           const successToast = new bootstrap.Toast(document.getElementById('successToast'), {
             delay: 3000,
             autohide: true
           });
           successToast.show();

           // Initialize the first rule for review
           try {
             // Get the first rule to review
             fetch("http://localhost:5000/get-next-change", {
               method: "POST",
               headers: {
                 "Content-Type": "application/json",
               },
               body: JSON.stringify({
                 current_data: complete_before_data || before,
                 skip_rules: skipRules
               })
             })
             .then(response => response.json())
             .then(data => {
               console.log("First rule response:", data);
               
               if (data.BEFORE && data.AFTER) {
                 // Update global variables
                 before = data.BEFORE;
                 after = data.AFTER;
                 currentRule = data.CURRENT_RULE;
                 
                 // Display the first rule for review
                 updateCodeCardContent(before, after);
               } else {
                 console.log("No more rules to apply");
               }
             })
             .catch(error => {
               console.error("Error getting first rule:", error);
             });
           } catch (error) {
            console.error('Error initializing rule discovery:', error);
          }

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
              
              // Add Download button at the bottom of Shells tab
              const downloadBtnWrapper = document.createElement("div");
              downloadBtnWrapper.className = "download-btn-container";
              downloadBtnWrapper.innerHTML = `
                <button class="btn btn-success btn-lg download-cleaned-btn" id="downloadCleanedBtn" onclick="downloadCleanedJSON()">
                  <i class="bi bi-download me-2"></i>Download Cleaned JSON
                </button>
              `;
              shellWrapper.appendChild(downloadBtnWrapper);
              
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
              
              // Add Download button at the bottom of Shells tab
              const downloadBtnWrapper = document.createElement("div");
              downloadBtnWrapper.className = "download-btn-container";
              downloadBtnWrapper.innerHTML = `
                <button class="btn btn-success btn-lg download-cleaned-btn" id="downloadCleanedBtn" onclick="downloadCleanedJSON()">
                  <i class="bi bi-download me-2"></i>Download Cleaned JSON
                </button>
              `;
              shellWrapper.appendChild(downloadBtnWrapper);
              
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
          hideLoading(); // Hide loading overlay on error
          alert("Error uploading or processing file.");
        });
    });
  }

  // Global download function for cleaned JSON
  window.downloadCleanedJSON = function() {
      console.log("Download button clicked");
      console.log("lastCleanedJson:", lastCleanedJson);
      console.log("originalFilename:", originalFilename);
      
      if (!lastCleanedJson) {
        console.log("No cleaned JSON data available");
      alert("No cleaned JSON data available to download.");
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
  };

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
          Founded Errors & Applied Rules:
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
      
      <div class="validation-header">
          <h2><i class="bi bi-shield-check"></i> Rule Validation System</h2>
          <p>Review and approve/reject rule-based changes to your JSON files</p>
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
          <div class="d-flex gap-2" role="group">
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
            <button type="button" class="btn btn-primary" onclick="acceptAllAndDownload()">
              <i class="bi bi-check-all me-1"></i>
              Accept All & Download
            </button>
          </div>
        </div>
      </div>

      <!-- Status Display -->
        <div class="status-bar">
          <div class="status-item">
            <div class="status-number pending" id="pendingCount">0</div>
            <div class="status-label">Pending</div>
          </div>
          <div class="status-item">
            <div class="status-number approved" id="approvedCount">0</div>
            <div class="status-label">Approved</div>
          </div>
          <div class="status-item">
            <div class="status-number rejected" id="rejectedCount">0</div>
            <div class="status-label">Rejected</div>
          </div>
        </div>

        <!-- Changes Container -->
        <div id="changesContainer" style="display: none;">
          <h4><i class="bi bi-list-check"></i> Pending Changes</h4>
          <div id="pendingChangesList" class="mb-4"></div>
          
          <h4><i class="bi bi-check-circle"></i> Approved Changes</h4>
          <div id="approvedChangesList" class="mb-4"></div>
          
          <h4><i class="bi bi-x-circle"></i> Rejected Changes</h4>
          <div id="rejectedChangesList" class="mb-4"></div>
        </div>
      
    `;
    return card;
  }

  function createChangesResultsCard(data, originalData, keys = []) {
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
      
      <div class="card-body p-3">
        <!-- History Section -->
        <div id="changesHistorySection" class="mb-3">
          <div class="card bg-dark text-light shadow">
            <div class="card-header bg-secondary">
              <h5 class="mb-0">
                <i class="bi bi-clock-history me-2"></i>
                Rule Validation History
              </h5>
            </div>
            <div class="card-body p-3 text-center text-muted">
              <i class="bi bi-inbox" style="font-size: 2rem;"></i>
              <p class="mt-2 mb-0">No decisions made yet. Accept or reject changes in the Rule Validation tab.</p>
            </div>
          </div>
        </div>
        
        <!-- Three-Pane Comparison -->
        <div class="resizable-container-three">
          <!-- Original Uploaded JSON Pane -->
          <div class="resizable-pane-three history">
            <h6 class="text-secondary p-2 m-0 bg-dark border-bottom">
              <i class="bi bi-file-earmark-arrow-up me-2"></i>Original Upload
            </h6>
            <div id="originalUploadContent" class="diff-container bg-dark text-light p-2" style="height: calc(100% - 40px); overflow: auto; font-family: 'Courier New', monospace; font-size: 12px;">
              <pre class="m-0"><code>${escapeHTML(JSON.stringify(originalData || {}, null, 2))}</code></pre>
            </div>
          </div>
          
          <div class="resizable-divider-three"></div>
          
          <!-- Current State Pane -->
          <div class="resizable-pane-three middle">
            <h6 class="text-warning p-2 m-0 bg-dark border-bottom">
              <i class="bi bi-file-code me-2"></i>Current State (Downloadable)
            </h6>
            <div id="currentStateContent" class="diff-container bg-dark text-light p-2" style="height: calc(100% - 40px); overflow: auto; font-family: 'Courier New', monospace; font-size: 12px;">
              <pre class="m-0"><code>${escapeHTML(JSON.stringify(originalData || {}, null, 2))}</code></pre>
            </div>
          </div>
          
          <div class="resizable-divider-three"></div>
          
          <!-- Final Result Pane -->
          <div class="resizable-pane-three right">
            <h6 class="text-success p-2 m-0 bg-dark border-bottom">
              <i class="bi bi-download me-2"></i>Cleaned JSON (Download Button)
            </h6>
            <div class="diff-container bg-dark text-light p-2" style="height: calc(100% - 40px); overflow: auto; font-family: 'Courier New', monospace; font-size: 12px;">
              <pre class="m-0"><code>${escapeHTML(JSON.stringify(data, null, 2))}</code></pre>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Initialize three-pane resizable functionality
    setTimeout(() => initializeThreePaneResizable(card), 0);
    
    // Initialize history display
    setTimeout(() => updateChangesHistoryDisplay(), 0);
    
    return card;
  }
  
  // Function to make three panes resizable
  function initializeThreePaneResizable(card) {
    const dividers = card.querySelectorAll('.resizable-divider-three');
    const panes = card.querySelectorAll('.resizable-pane-three');
    const container = card.querySelector('.resizable-container-three');
    
    if (dividers.length !== 2 || panes.length !== 3 || !container) {
      console.error('Three-pane resizable elements not found');
      return;
    }
    
    const [divider1, divider2] = dividers;
    const [pane1, pane2, pane3] = panes;
    
    let activeDivider = null;
    
    // Handle first divider
    divider1.addEventListener('mousedown', (e) => {
      activeDivider = 1;
      document.body.classList.add('resizing');
      e.preventDefault();
    });
    
    // Handle second divider
    divider2.addEventListener('mousedown', (e) => {
      activeDivider = 2;
      document.body.classList.add('resizing');
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!activeDivider) return;
      
      const containerRect = container.getBoundingClientRect();
      const containerLeft = containerRect.left;
      const containerWidth = containerRect.width;
      const dividerWidth = 8; // Width of each divider
      
      if (activeDivider === 1) {
        // Resizing between pane1 and pane2
        let newPane1Width = e.clientX - containerLeft;
        const minWidth = containerWidth * 0.15;
        const pane3Width = pane3.getBoundingClientRect().width;
        const maxWidth = containerWidth - pane3Width - dividerWidth * 2 - containerWidth * 0.15;
        
        if (newPane1Width < minWidth) newPane1Width = minWidth;
        if (newPane1Width > maxWidth) newPane1Width = maxWidth;
        
        const pane1Percent = (newPane1Width / containerWidth) * 100;
        const pane3Percent = (pane3Width / containerWidth) * 100;
        const pane2Percent = 100 - pane1Percent - pane3Percent - ((dividerWidth * 2) / containerWidth * 100);
        
        pane1.style.flex = `0 0 ${pane1Percent}%`;
        pane2.style.flex = `0 0 ${pane2Percent}%`;
        
      } else if (activeDivider === 2) {
        // Resizing between pane2 and pane3
        const divider2Rect = divider2.getBoundingClientRect();
        let newPane3Width = containerRect.right - e.clientX;
        const minWidth = containerWidth * 0.15;
        const pane1Width = pane1.getBoundingClientRect().width;
        const maxWidth = containerWidth - pane1Width - dividerWidth * 2 - containerWidth * 0.15;
        
        if (newPane3Width < minWidth) newPane3Width = minWidth;
        if (newPane3Width > maxWidth) newPane3Width = maxWidth;
        
        const pane1Percent = (pane1Width / containerWidth) * 100;
        const pane3Percent = (newPane3Width / containerWidth) * 100;
        const pane2Percent = 100 - pane1Percent - pane3Percent - ((dividerWidth * 2) / containerWidth * 100);
        
        pane2.style.flex = `0 0 ${pane2Percent}%`;
        pane3.style.flex = `0 0 ${pane3Percent}%`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (activeDivider) {
        activeDivider = null;
        document.body.classList.remove('resizing');
      }
    });
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
    
    // Show loading
    showLoading("Rejecting changes and finding next rule...");
    
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
      
      // Add to change history with complete JSON
      addToChangeHistory(
        data.CURRENT_RULE || currentRule,
        'rejected',
        data.BEFORE || before,
        data.AFTER || after,
        data.Complete_after_data || complete_after_data
      );
      
      // Update counters
      rejectedCount += 1;
      if (pendingCount > 0) pendingCount -= 1;
      const rejEl = document.getElementById('rejectedCount');
      const penEl = document.getElementById('pendingCount');
      if (rejEl) rejEl.textContent = String(rejectedCount);
      if (penEl) penEl.textContent = String(pendingCount);

      // Update the current state display in tab 3
      updateCurrentStateDisplay(complete_before_data || before);
      
      // Update the UI with new before/after data
      if (data.AFTER) {
        updateCodeCardContent(data.BEFORE || before, data.AFTER);
        hideLoading();
        alert(`Changes rejected! Trying next available rule.`);
      } else {
        // No more changes - show completion message and clear the diff view
        updateCodeCardContent(null, null);
        hideLoading();
        alert("All changes processed! No more rules to apply.");
      }
    })
    .catch(error => {
      console.error("Error rejecting changes:", error);
      hideLoading();
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
    
    // Show loading
    showLoading("Accepting changes and applying rule...");
    
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
        skip_rules: skipRules,
        current_rule: currentRule
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
      
      // Add to change history with complete JSON
      addToChangeHistory(
        currentRule,
        'accepted',
        data.BEFORE || before,
        data.AFTER || after,
        data.Complete_after_data || complete_after_data
      );
      
      // Update counters
      approvedCount += 1;
      if (pendingCount > 0) pendingCount -= 1;
      const appEl = document.getElementById('approvedCount');
      const penEl = document.getElementById('pendingCount');
      if (appEl) appEl.textContent = String(approvedCount);
      if (penEl) penEl.textContent = String(pendingCount);

      // Update the current state display in tab 3
      updateCurrentStateDisplay(data.Complete_after_data || complete_after_data);
      
      // Update the UI with new before/after data from API response
      if (data.AFTER) {
        updateCodeCardContent(data.BEFORE || after, data.AFTER);
        hideLoading();
        alert("Changes accepted! UI updated with new data.");
      } else {
        // No more changes - show completion message and clear the diff view
        updateCodeCardContent(null, null);
        hideLoading();
        alert("All changes processed! No more rules to apply.");
      }
    })
    .catch(error => {
      console.error("Error accepting changes:", error);
      hideLoading();
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

  // Accept all remaining rules and download - FAST VERSION
  window.acceptAllAndDownload = async function() {
    if (!originalJson) {
      alert("No original JSON data available. Please upload a file first.");
      return;
    }
    
    const confirmed = confirm(
      `This will automatically accept all remaining rules and download the final JSON.\n\n` +
      `Pending rules: ${pendingCount}\n` +
      `Rejected rules will be skipped.\n\n` +
      `Are you sure you want to proceed?`
    );
    
    if (!confirmed) return;
    
    console.log("Accept All & Download - Fast version using clean_json_iterative");
    
    // Show loading
    showLoading("Processing all rules with your decisions...");
    
    try {
      // Call backend to apply all rules except rejected ones
      // We send the original JSON and the list of rejected rules
      const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json_data: originalJson,
          skip_rules: skipRules // Pass the rejected rules to skip
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Get the fully cleaned JSON
      const finalCleanedJson = data.JSON || data.cleaned_data;
      
      if (!finalCleanedJson) {
        throw new Error("No cleaned data received from server");
      }
      
      console.log("Fast processing complete");
      
      // Show final loading message
      showLoading("Preparing download...");
      
      // Download the final result
      const dataStr = JSON.stringify(finalCleanedJson, null, 2);
      const dataBlob = new Blob([dataStr], {type: 'application/json'});
      const url = URL.createObjectURL(dataBlob);
      
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = originalFilename 
        ? `cleaned_${originalFilename.replace('.json', '')}_${timestamp}.json`
        : `fully_cleaned_${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Update counters - all pending become approved
      const remainingPending = pendingCount;
      approvedCount += remainingPending;
      pendingCount = 0;
      
      const appEl = document.getElementById('approvedCount');
      const penEl = document.getElementById('pendingCount');
      if (appEl) appEl.textContent = String(approvedCount);
      if (penEl) penEl.textContent = String(pendingCount);
      
      hideLoading();
      alert(`Successfully processed and downloaded the cleaned JSON file!`);
      
    } catch (error) {
      console.error("Error during accept all:", error);
      hideLoading();
      alert("Error processing rules. Please try again.");
    }
  };

});

