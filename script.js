// Loading helper functions - defined globally so they're available everywhere
window.showLoading = function(message = "Processing...") {
  const loadingOverlay = document.getElementById('loadingOverlay');
  const loadingMessage = document.getElementById('loadingMessage');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
    if (loadingMessage) {
      loadingMessage.textContent = message;
    }
  }
};

window.hideLoading = function() {
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
};

// Global variables for file upload state
window.originalJson = null;
window.originalFilename = null;
window.booleanConversionMode = "boolean"; // "boolean" or "numeric" - default to boolean values

// Helper function to find the first rule that has changes
window.findFirstRuleWithChanges = async function(currentData, skipRules = []) {
  for (let ruleId = 1; ruleId <= 7; ruleId++) {
    if (skipRules.includes(ruleId)) continue;
    
    try {
      const response = await fetch("http://localhost:5001/get-all-changes-for-rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_data: currentData,
          rule_id: ruleId,
          skip_rules: skipRules,
          boolean_conversion_mode: window.booleanConversionMode || "boolean"
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.count > 0) {
          return ruleId;
        }
      }
    } catch (error) {
      console.error(`Error checking rule ${ruleId}:`, error);
    }
  }
  return null;
};

// Helper function to load all changes for a specific rule
window.loadAllChangesForRule = async function(currentData, ruleId, skipRules = []) {
  try {
    const response = await fetch("http://localhost:5001/get-all-changes-for-rule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current_data: currentData,
        rule_id: ruleId,
        skip_rules: skipRules
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error loading changes for rule ${ruleId}:`, error);
    throw error;
  }
};

// Function to count all pending rule changes
window.countAllPendingChanges = async function(currentData, skipRules = []) {
  let count = 0;
  let currentDataCopy = JSON.parse(JSON.stringify(currentData));
  let currentSkipRules = [...skipRules];
  const maxIterations = 1000; // Safety limit
  
  console.log("Counting all pending changes...");
  
  for (let i = 0; i < maxIterations; i++) {
    try {
      const response = await fetch("http://localhost:5001/get-next-change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_data: currentDataCopy,
          skip_rules: currentSkipRules
        })
      });
      
      if (!response.ok) {
        console.warn("Error counting changes:", response.status);
        break;
      }
      
      const data = await response.json();
      
      if (!data.BEFORE || !data.AFTER || data.CURRENT_RULE === null) {
        // No more changes
        break;
      }
      
      count++;
      
      // Update for next iteration
      if (data.Complete_after_data) {
        currentDataCopy = data.Complete_after_data;
      }
      if (data.CURRENT_RULE !== null) {
        currentSkipRules.push(data.CURRENT_RULE);
      }
      
      // Log progress every 10 changes
      if (count % 10 === 0) {
        console.log(`  Counted ${count} changes so far...`);
      }
    } catch (error) {
      console.error("Error counting changes:", error);
      break;
    }
  }
  
  console.log(`Total pending changes: ${count}`);
  return count;
};

// Display issue summary - defined globally
window.displayIssueSummary = function(issues) {
  const issueSummary = document.getElementById('issueSummary');
  const issueCounts = document.getElementById('issueCounts');
  
  if (!issueSummary || !issueCounts) {
    console.error("Issue summary elements not found");
    return;
  }
  
  const issueTypes = [
    { key: 'empty_lists', label: 'Empty Lists', icon: 'bi-list-ul', code: '[]' },
    { key: 'empty_strings', label: 'Empty Strings', icon: 'bi-quote', code: '""' },
    { key: 'null_values', label: 'Null Values', icon: 'bi-x-circle', code: 'null' },
    { key: 'empty_objects', label: 'Empty Objects', icon: 'bi-braces', code: '{}' },
    { key: 'duplicates', label: 'Duplicates in Arrays', icon: 'bi-arrow-repeat', code: 'dup' }
  ];
  
  let html = '';
  
  // Always show the issue counts, even when they're zero (after cleaning)
  issueTypes.forEach((type, index) => {
    const count = issues[type.key] || 0;
    const hasIssues = count > 0;
    const ruleId = index + 1; // Rule IDs: 1=empty lists, 2=empty strings, 3=null values, 4=empty objects, 5=duplicates
    html += `
      <div class="issue-count-item ${hasIssues ? 'has-issues' : ''}">
        <i class="bi ${type.icon} mb-2" style="font-size: 1.5rem; color: ${hasIssues ? '#f59e0b' : '#22c55e'};"></i>
        <span class="issue-count-number">${count}</span>
        <div class="issue-count-label">${type.label}</div>
        <small style="color: #64748b; font-size: 0.75rem;"><code>${type.code}</code></small>
        ${hasIssues ? `<button class="btn btn-sm btn-danger mt-2 remove-issue-btn" onclick="removeSpecificIssue(${ruleId})" style="width: 100%;">
          <i class="bi bi-trash me-1"></i>Remove
        </button>` : ''}
      </div>
    `;
  });
  
  issueCounts.innerHTML = html;
  issueSummary.style.display = 'block';
};

// Define handleFileUpload IMMEDIATELY so it's available when HTML onchange fires
window.handleFileUpload = function(event) {
  console.log("=== handleFileUpload called ===");
  console.log("Event:", event);
  console.log("Event target:", event.target);
  
  const file = event.target.files[0];
  if (!file) {
    console.log("No file selected");
    return;
  }
  
  // Mark event as handled to prevent old handler from running
  event.handledByQuickClean = true;
  event.stopPropagation();
  event.preventDefault();
  
  console.log("File selected:", file.name);
  console.log("File size:", file.size, "bytes");
  console.log("File type:", file.type);
  
  // Store original filename
  window.originalFilename = file.name;
  
  // Show filename immediately - CRITICAL VISUAL FEEDBACK
  const fileNameDisplay = document.getElementById('uploadedFileName');
  const fileNameText = document.getElementById('fileNameText');
  const uploadAreaEl = document.getElementById('uploadArea');
  const resetButton = document.getElementById('resetButton');
  
  console.log("UI Elements:", {
    fileNameDisplay: !!fileNameDisplay,
    fileNameText: !!fileNameText,
    uploadArea: !!uploadAreaEl,
    resetButton: !!resetButton
  });
  
  if (fileNameDisplay && fileNameText) {
    fileNameText.textContent = file.name;
    fileNameDisplay.style.display = 'block';
    console.log("Filename displayed");
  } else {
    console.error("Could not find fileNameDisplay or fileNameText elements!");
  }
  
  // Show rule settings card after file is uploaded
  const ruleSettingsCard = document.getElementById('ruleSettingsCard');
  if (ruleSettingsCard) {
    ruleSettingsCard.style.display = 'block';
    console.log("Rule settings card shown");
  }
  
  if (uploadAreaEl) {
    uploadAreaEl.style.display = 'none';
    console.log("Upload area hidden");
  }
  
  if (resetButton) {
    resetButton.style.display = 'block';
    console.log("Reset button shown");
  }
  
  // Show loading
  console.log("Showing loading indicator...");
  showLoading("Scanning for issues...");
  
  // First scan for issues
  console.log("Creating FormData...");
  const formData = new FormData();
  formData.append("file", file);
  console.log("FormData created, file appended");
  
  console.log("Making fetch request to http://localhost:5001/scan-issues");
  fetch("http://localhost:5001/scan-issues", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      console.log("Response status:", response.status, response.statusText);
      if (!response.ok) {
        return response.text().then(text => {
          console.error("Response error:", text);
          throw new Error(`Scan failed: ${response.status} ${response.statusText}`);
        });
      }
      return response.json();
    })
    .then((scanResult) => {
      console.log("Scan result received:", scanResult);
      hideLoading();
      
      if (!scanResult || !scanResult.issues) {
        console.error("Invalid scan result format:", scanResult);
        alert("Invalid response from server. Please check the console for details.");
        return;
      }
      
      // Read and store the JSON
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          window.originalJson = JSON.parse(e.target.result);
          window.currentState = JSON.parse(JSON.stringify(window.originalJson)); // Initialize current state
          console.log("JSON parsed successfully");
          console.log("originalJson stored globally:", !!window.originalJson);
          console.log("currentState initialized:", !!window.currentState);
          
          // Display issue summary
          displayIssueSummary(scanResult.issues);
          
          // Display the uploaded JSON
          displayUploadedJSON(window.originalJson, file.name);
          
          // CRITICAL: Start processing for Rule Validation tab IMMEDIATELY
          // Find the first rule that has changes, then load ALL changes for that rule
          console.log("Starting Rule Validation processing...");
          showLoading("Preparing Rule Validation...");
          
          findFirstRuleWithChanges(window.originalJson, [])
            .then(ruleId => {
              if (ruleId) {
                console.log(`Found first rule with changes: Rule ${ruleId}`);
                return loadAllChangesForRule(window.originalJson, ruleId, []);
              } else {
                console.log("No rules with changes found");
                return null;
              }
            })
            .then(data => {
              hideLoading();
              
              if (!data || data.count === 0) {
                const validationTabContent = document.getElementById('validation');
                if (validationTabContent) {
                  validationTabContent.innerHTML = `
                    <div class="card shadow">
                      <div class="card-body text-center p-5">
                        <i class="bi bi-check-circle" style="font-size: 4rem; color: #22c55e; margin-bottom: 1rem;"></i>
                        <h3 class="mb-3">JSON is Already Clean</h3>
                        <p class="text-muted mb-4">
                          No rule changes were needed. Your JSON file is already clean!
                        </p>
                      </div>
                    </div>
                  `;
                }
                return;
              }
              
              // Store changes globally
              window.currentRule = data.ruleId;
              window.allChanges = data.changes.map(c => ({
                ...c,
                accepted: false,
                rejected: false
              }));
              window.skipRules = [];
              window.pendingCount = data.count;
              
              // Initialize Changes & Results tab
              if (typeof updateChangesResultsTab === 'function') {
                // Get cleaned JSON (will be available after proceedWithCleaning)
                // For now, use original JSON as placeholder
                setTimeout(() => {
                  if (window.lastCleanedJson) {
                    updateChangesResultsTab(window.originalJson, window.lastCleanedJson);
                  }
                }, 500);
              }
              
              const ruleNames = {
                1: "Remove empty lists",
                2: "Remove empty strings",
                3: "Remove null values",
                4: "Remove empty objects",
                5: "Remove duplicates",
                6: "Convert boolean strings",
                7: "Fix language codes"
              };
              
              // Populate validation tab with all changes
              const validationTabContent = document.getElementById('validation');
              if (validationTabContent && window.createAllChangesCard) {
                setTimeout(() => {
                  const card = window.createAllChangesCard(
                    data.ruleId,
                    window.allChanges,
                    ruleNames[data.ruleId] || `Rule ${data.ruleId}`
                  );
                  validationTabContent.innerHTML = "";
                  validationTabContent.appendChild(card);
                  console.log(`✓ Validation tab populated with ${data.count} changes for Rule ${data.ruleId}`);
                }, 100);
              }
            })
            .catch(error => {
              hideLoading();
              console.error("Error loading rule changes:", error);
              // Don't show alert - this is background processing, user can still use Quick Clean
              console.warn("Rule Validation tab will not be pre-populated, but Quick Clean will still work");
            });
          
        } catch (error) {
          hideLoading();
          console.error("Error parsing JSON:", error);
          alert("Error parsing JSON file: " + error.message);
        }
      };
      reader.onerror = function(error) {
        hideLoading();
        console.error("FileReader error:", error);
        alert("Error reading file: " + error.message);
      };
      reader.readAsText(file);
    })
    .catch((error) => {
      hideLoading();
      console.error("Scan error:", error);
      alert("Error scanning file: " + error.message + "\n\nPlease check:\n1. Backend is running on port 5001\n2. Browser console for more details");
    });
};

// Make createShellCard globally accessible
let createShellCard;

document.addEventListener("DOMContentLoaded", function () {
  console.log("=== DOMContentLoaded - Script.js loaded ===");
  const fileInput = document.getElementById("jsonFileInput");
  console.log("File input element:", fileInput ? "Found" : "NOT FOUND");
  
  // Add a visible indicator that script loaded
  const uploadArea = document.getElementById("uploadArea");
  if (uploadArea) {
    const indicator = document.createElement("div");
    indicator.id = "scriptLoadedIndicator";
    indicator.style.cssText = "position: fixed; top: 10px; right: 10px; background: #10b981; color: white; padding: 5px 10px; border-radius: 5px; z-index: 10000; font-size: 12px;";
    indicator.textContent = "✓ Script Loaded";
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 3000);
  }
  
  // Initialize boolean conversion mode radio buttons
  const booleanTrueRadio = document.getElementById('booleanTrue');
  const booleanNumericRadio = document.getElementById('booleanNumeric');
  const booleanConversionHint = document.getElementById('booleanConversionHint');
  
  if (booleanTrueRadio && booleanNumericRadio) {
    // Set initial state
    booleanTrueRadio.checked = window.booleanConversionMode === "boolean";
    booleanNumericRadio.checked = window.booleanConversionMode === "numeric";
    updateBooleanConversionHint();
    
    // Add event listeners
    booleanTrueRadio.addEventListener('change', function() {
      if (this.checked) {
        window.booleanConversionMode = "boolean";
        updateBooleanConversionHint();
      }
    });
    
    booleanNumericRadio.addEventListener('change', function() {
      if (this.checked) {
        window.booleanConversionMode = "numeric";
        updateBooleanConversionHint();
      }
    });
  }
  
  function updateBooleanConversionHint() {
    if (booleanConversionHint) {
      if (window.booleanConversionMode === "boolean") {
        booleanConversionHint.textContent = 'Converts "true"/"false" strings to boolean values (true/false)';
      } else {
        booleanConversionHint.textContent = 'Converts "true"/"false" strings to numeric strings ("1"/"0")';
      }
    }
  }
  
  const shellWrapper = document.querySelector(".shell-wrapper");
  const shellInteractive = document.querySelector(".code-wrapper");
  
  // Initialize Rule Validation tab when clicked - but only if truly empty
  const validationTab = document.getElementById('validation-tab');
  const validationTabContent = document.getElementById('validation');
  
  if (validationTab && validationTabContent) {
    // Only show initial message on page load if tab is completely empty
    // Use a flag to track if we've already initialized to avoid clearing content later
    let validationTabInitialized = false;
    
    // Check if tab is empty on page load
    const isEmpty = !validationTabContent.hasChildNodes() || 
                    validationTabContent.innerHTML.trim() === '' ||
                    validationTabContent.innerHTML.includes('Rule Validation System') && 
                    validationTabContent.innerHTML.includes('Upload a JSON file');
    
    if (isEmpty && !window.originalJson) {
      validationTabContent.innerHTML = `
        <div class="card shadow">
          <div class="card-body text-center p-5">
            <i class="bi bi-shield-check" style="font-size: 4rem; color: #6c757d; margin-bottom: 1rem;"></i>
            <h3 class="mb-3">Rule Validation System</h3>
            <p class="text-muted mb-4">
              Upload a JSON file to start the rule validation process.<br>
              You'll be able to review and accept/reject each rule change step by step.
            </p>
            <button class="btn btn-primary btn-lg" onclick="document.getElementById('jsonFileInput').click()">
              <i class="bi bi-cloud-upload me-2"></i>Upload JSON File
            </button>
          </div>
        </div>
      `;
      validationTabInitialized = true;
    }
    
    // Listen for tab show event - but NEVER clear content that was set by file processing
    validationTab.addEventListener('shown.bs.tab', function() {
      // If validation data is ready but tab is empty, populate it now
      if (window.validationDataReady && window.before && window.after && window.currentRule !== null) {
        if (!validationTabContent.hasChildNodes() || 
            validationTabContent.innerHTML.includes('Upload a JSON file') ||
            validationTabContent.innerHTML.includes('Rule Validation System') && 
            validationTabContent.innerHTML.includes('Upload a JSON file')) {
          console.log("Tab clicked - populating validation tab with ready data");
          if (window.createCodeCard) {
            const codeCard = window.createCodeCard(
              window.before, 
              window.after, 
              window.before_full || window.before, 
              window.after_full || window.after
            );
            validationTabContent.innerHTML = "";
            validationTabContent.appendChild(codeCard);
            window.validationDataReady = false; // Mark as populated
            console.log("✓ Validation tab populated on tab click");
          }
        }
      }
      
      // Check if content exists and is NOT the default message
      const hasRealContent = validationTabContent.hasChildNodes() && 
                            validationTabContent.innerHTML.trim() !== '' &&
                            !validationTabContent.innerHTML.includes('Upload a JSON file to start');
      
      // Only show default message if:
      // 1. Tab is empty AND
      // 2. No file has been uploaded AND  
      // 3. We haven't already initialized it
      if (!hasRealContent && !window.originalJson && !validationTabInitialized) {
        validationTabContent.innerHTML = `
          <div class="card shadow">
            <div class="card-body text-center p-5">
              <i class="bi bi-shield-check" style="font-size: 4rem; color: #6c757d; margin-bottom: 1rem;"></i>
              <h3 class="mb-3">Rule Validation System</h3>
              <p class="text-muted mb-4">
                Upload a JSON file to start the rule validation process.<br>
                You'll be able to review and accept/reject each rule change step by step.
              </p>
              <button class="btn btn-primary btn-lg" onclick="document.getElementById('jsonFileInput').click()">
                <i class="bi bi-cloud-upload me-2"></i>Upload JSON File
              </button>
            </div>
          </div>
        `;
        validationTabInitialized = true;
      }
    });
  }
  
  // Test if handleFileUpload is accessible
  if (typeof window.handleFileUpload === 'function') {
    console.log("✓ handleFileUpload function is defined");
  } else {
    console.error("✗ handleFileUpload function is NOT defined!");
  }
  
  // Add drag and drop support (reuse uploadArea from above)
  if (uploadArea && fileInput) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('dragover');
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('dragover');
      }, false);
    });
    
    uploadArea.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0 && files[0].name.endsWith('.json')) {
        fileInput.files = files;
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
      } else {
        alert('Please drop a JSON file');
      }
    }, false);
  }

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

  // Make counters global so they persist across function calls
  window.pendingCount = 0;
  window.approvedCount = 0;
  window.rejectedCount = 0;
  
  // Local aliases for backward compatibility
  let pendingCount = window.pendingCount;
  let approvedCount = window.approvedCount;
  let rejectedCount = window.rejectedCount;

  // Add global variable to track rejected rules
  let rejectedRules = [];
  
  // Rule preset management
  let currentPreset = 'aas_rules';
  let availablePresets = [];
  let currentRulesInfo = null;
  
  // Loading helper functions - now defined globally above, but keep references for backward compatibility
  // (These are now window.showLoading and window.hideLoading)
  
  // Track history of all accept/decline decisions
  // Make changeHistory globally accessible
  window.changeHistory = [];
  
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
      state: action === 'accepted' ? ((window.changeHistory || []).filter(h => h.action === 'accepted').length + 1) : null
    };
    if (!window.changeHistory) window.changeHistory = [];
    window.changeHistory.push(historyItem);
    updateChangesHistoryDisplay();
  }
  
  // Update the changes history display in tab 3
  function updateChangesHistoryDisplay() {
    const historySection = document.getElementById('changesHistorySection');
    if (!historySection) return;
    
    const history = window.changeHistory || [];
    
    // Build history HTML
    let historyHTML = `
      <div class="card bg-dark text-light shadow mb-3">
        <div class="card-header bg-secondary d-flex justify-content-between align-items-center">
          <h5 class="mb-0">
            <i class="bi bi-clock-history me-2"></i>
            Rule Validation History (${history.length} decisions)
          </h5>
          <span class="badge bg-info">
            ${history.filter(h => h.action === 'accepted').length} Accepted | 
            ${history.filter(h => h.action === 'rejected').length} Rejected
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
    
    if (history.length === 0) {
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
      history.slice().reverse().forEach((item, index) => {
        const actualIndex = history.length - index - 1;
        const timeFormatted = new Date(item.timestamp).toLocaleString();
        const actionBadge = item.action === 'accepted' 
          ? '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Accepted</span>'
          : '<span class="badge bg-danger"><i class="bi bi-x-circle"></i> Rejected</span>';
        
        const stateBadge = item.state 
          ? `<span class="badge bg-info">State ${item.state}</span>`
          : '<span class="badge bg-secondary">-</span>';
        
        historyHTML += `
          <tr class="${item.action === 'accepted' ? 'table-success' : 'table-danger'}" style="--bs-table-bg-opacity: 0.1;">
            <td><strong>${history.length - index}</strong></td>
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
    const history = window.changeHistory || [];
    const item = history[index];
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
    const history = window.changeHistory || [];
    const item = history[index];
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

  // OLD FILE UPLOAD HANDLER - Disabled for Quick Clean feature
  // This handler is for the old rule validation system
  // The Quick Clean feature uses handleFileUpload() instead
  // OLD FILE UPLOAD HANDLER - Only runs if Quick Clean handler didn't process it
  // This is for the old rule validation system
  if (fileInput) {
    console.log("Adding old event listener (should be disabled by onchange)");
    fileInput.addEventListener("change", function (event) {
      console.log("OLD handler triggered - checking if already handled");
      // Check if handleFileUpload already processed this (Quick Clean feature)
      // If the event was already handled, don't process it again
      if (event.handledByQuickClean) {
        console.log("Event already handled by Quick Clean, skipping old handler");
        return;
      }
      console.log("OLD handler proceeding (this shouldn't happen for Quick Clean)");
      
      const file = event.target.files[0];
      if (!file) return;

      // Store original filename
      window.originalFilename = file.name;

      // Store original JSON for comparison
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          window.originalJson = JSON.parse(e.target.result);
          window.currentState = JSON.parse(JSON.stringify(window.originalJson)); // Initialize current state
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

      // Add boolean conversion mode to form data
      formData.append("boolean_conversion_mode", window.booleanConversionMode || "boolean");
      
      fetch("http://localhost:5001/upload", {
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
           window.lastCleanedJson = jsonData["JSON"];

           // Store the applied Keys
           keys = jsonData["KEYS"] || [];
          
          // Update applied rules count if available
          if (jsonData.keys_applied_length !== undefined) {
            const appliedRulesEl = document.getElementById('appliedRules');
            if (appliedRulesEl) {
              appliedRulesEl.textContent = jsonData.keys_applied_length;
            }
          }
          
          // Refresh rule info after processing
          loadPresetInfo();

          
            before = jsonData["BEFORE"];
            after = jsonData["AFTER"];
            before_full = jsonData["Before_data"];
            after_full = jsonData["After_data"];
            complete_after_data = jsonData["Complete_after_data"];
            complete_before_data = jsonData["Complete_before_data"];
            currentRule = jsonData["CURRENT_RULE"];
            skipRules = jsonData["SKIP_RULES"] || [];
         


              // Fetch keys applied length
              fetch("http://localhost:5001/keys-applied-length", {
                method: "GET"
              })
              .then(response => response.json())
              .then(data => {
                  window.pendingCount = data.keys_applied_length || 0;
                  
                  // Update applied rules display
                  const appliedRulesEl = document.getElementById('appliedRules');
                  if (appliedRulesEl) {
                    appliedRulesEl.textContent = window.approvedCount;
                  }
                  const penE3 = document.getElementById('pendingCount');
                  
                  if (penE3) penE3.textContent = String(window.pendingCount);
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

           // Immediately populate validation tab if we have before/after data from upload
           const validationTabContent = document.getElementById('validation');
           console.log("Checking validation tab population:", {
             validationTabContent: !!validationTabContent,
             before: !!before,
             after: !!after,
             before_full: !!before_full,
             after_full: !!after_full
           });
           
           if (validationTabContent) {
             if (before && after) {
               console.log("Setting validation tab with upload response data (BEFORE/AFTER)");
               const codeCard = createCodeCard(before, after, before_full || before, after_full || after);
               validationTabContent.innerHTML = "";
               validationTabContent.appendChild(codeCard);
             } else if (before_full && after_full) {
               console.log("Setting validation tab with upload response data (Before_data/After_data)");
               const codeCard = createCodeCard(before_full, after_full, before_full, after_full);
               validationTabContent.innerHTML = "";
               validationTabContent.appendChild(codeCard);
             } else {
               console.log("No before/after data in upload response, will wait for /get-next-change");
             }
           } else {
             console.error("Validation tab content element not found!");
           }

           // Initialize the first rule for review in validation tab
           try {
             // Get the first rule to review using the original JSON data
             const dataToSend = complete_before_data || originalJson || jsonData["JSON"];
             
             console.log("Calling /get-next-change with data:", dataToSend ? "present" : "missing");
             
             fetch("http://localhost:5001/get-next-change", {
               method: "POST",
               headers: {
                 "Content-Type": "application/json",
               },
               body: JSON.stringify({
                 current_data: dataToSend,
                 skip_rules: skipRules
               })
             })
             .then(response => response.json())
             .then(data => {
               console.log("First rule response:", data);
               
               if (data.BEFORE && data.AFTER) {
                 console.log("✓ Rule change found, updating validation tab");
                 // Update global variables
                 before = data.BEFORE;
                 after = data.AFTER;
                 before_full = data.Before_data || data.BEFORE;
                 after_full = data.After_data || data.AFTER;
                 currentRule = data.CURRENT_RULE;
                 complete_after_data = data.Complete_after_data;
                 complete_before_data = data.Complete_before_data;
                 
                 // Create and display the validation card
                 const validationTabContent = document.getElementById('validation');
                 console.log("Validation tab content element:", validationTabContent);
                 if (validationTabContent) {
                   const codeCard = createCodeCard(before, after, before_full, after_full);
                   validationTabContent.innerHTML = "";
                   validationTabContent.appendChild(codeCard);
                   console.log("✓ Validation card created and appended");
                 } else {
                   console.error("✗ Validation tab content element not found!");
                 }
               } else {
                 console.log("No more rules to apply - JSON is already clean");
                 // Show message that JSON is clean
                 const validationTabContent = document.getElementById('validation');
                 if (validationTabContent) {
                   validationTabContent.innerHTML = `
                     <div class="card shadow">
                       <div class="card-body text-center p-5">
                         <i class="bi bi-check-circle" style="font-size: 4rem; color: #22c55e; margin-bottom: 1rem;"></i>
                         <h3 class="mb-3">JSON is Already Clean</h3>
                         <p class="text-muted mb-4">
                           No rule changes were needed. Your JSON file is already clean!
                         </p>
                       </div>
                     </div>
                   `;
                 }
               }
             })
             .catch(error => {
               console.error("Error getting first rule:", error);
               console.log("Attempting fallback: using before/after from upload response");
               // On error, still try to show validation UI if we have before/after data
               const validationTabContent = document.getElementById('validation');
               if (validationTabContent) {
                 if (before && after) {
                   console.log("Using before/after from upload response");
                   const codeCard = createCodeCard(before, after, before_full, after_full);
                   validationTabContent.innerHTML = "";
                   validationTabContent.appendChild(codeCard);
                 } else if (before_full && after_full) {
                   console.log("Using before_full/after_full from upload response");
                   const codeCard = createCodeCard(before_full, after_full, before_full, after_full);
                   validationTabContent.innerHTML = "";
                   validationTabContent.appendChild(codeCard);
                 } else {
                   console.log("No validation data available, showing message");
                   validationTabContent.innerHTML = `
                     <div class="card shadow">
                       <div class="card-body text-center p-5">
                         <i class="bi bi-exclamation-triangle" style="font-size: 4rem; color: #f59e0b; margin-bottom: 1rem;"></i>
                         <h3 class="mb-3">Unable to Load Validation</h3>
                         <p class="text-muted mb-4">
                           Could not retrieve rule changes. Please try uploading the file again.
                         </p>
                         <button class="btn btn-primary btn-lg" onclick="document.getElementById('jsonFileInput').click()">
                           <i class="bi bi-cloud-upload me-2"></i>Upload JSON File Again
                         </button>
                       </div>
                     </div>
                   `;
                 }
               }
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
                  const card = window.createShellCard(item, originalItem, keys);
                  shellWrapper.appendChild(card);
                } catch (error) {
                  console.error(`Error creating card for item ${index}:`, error);
                  const errorCard = document.createElement("div");
                  errorCard.className = "shell-card card p-3";
                  errorCard.innerHTML = `<h5 class="card-title text-danger">Error processing item ${index}</h5>`;
                  shellWrapper.appendChild(errorCard);
                }
              });
              
              // Add Download button at the TOP of Shells tab for better visibility
              const downloadBtnWrapper = document.createElement("div");
              downloadBtnWrapper.className = "download-btn-container sticky-download";
              downloadBtnWrapper.innerHTML = `
                <button class="btn btn-success btn-lg download-cleaned-btn" id="downloadCleanedBtn" onclick="downloadCleanedJSON()">
                  <i class="bi bi-download me-2"></i>Download Cleaned JSON
                </button>
              `;
              // Insert at the beginning instead of appending at the end
              shellWrapper.insertBefore(downloadBtnWrapper, shellWrapper.firstChild);
              
              // Create a single code review card in the validation tab
              // Use the validation tab element directly, not shellInteractive
              const validationTabContent = document.getElementById('validation') || shellInteractive;
              if (validationTabContent && before && after) {
                const codeCard = createCodeCard(before, after, before_full, after_full);
                validationTabContent.innerHTML = "";
                validationTabContent.appendChild(codeCard);
              }
              
              // Create changes and results card for the new tab
              const changesResultsCard = createChangesResultsCard(jsonData["JSON"], originalJson, keys);
              const changesResultsWrapper = document.querySelector(".changes-results-wrapper");
              changesResultsWrapper.innerHTML = "";
              changesResultsWrapper.appendChild(changesResultsCard);
            } else if (typeof jsonData["JSON"] === "object") {
              const card = window.createShellCard(jsonData["JSON"], originalJson, keys);
              shellWrapper.appendChild(card);
              
              // Add Download button at the TOP of Shells tab for better visibility
              const downloadBtnWrapper = document.createElement("div");
              downloadBtnWrapper.className = "download-btn-container sticky-download";
              downloadBtnWrapper.innerHTML = `
                <button class="btn btn-success btn-lg download-cleaned-btn" id="downloadCleanedBtn" onclick="downloadCleanedJSON()">
                  <i class="bi bi-download me-2"></i>Download Cleaned JSON
                </button>
              `;
              // Insert at the beginning instead of appending at the end
              shellWrapper.insertBefore(downloadBtnWrapper, shellWrapper.firstChild);
              
              // Create a single code review card in the validation tab
              // Use the validation tab element directly, not shellInteractive
              const validationTabContent = document.getElementById('validation') || shellInteractive;
              if (validationTabContent && before && after) {
                const codeCard = createCodeCard(before, after, before_full, after_full);
                validationTabContent.innerHTML = "";
                validationTabContent.appendChild(codeCard);
              }
              
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
      console.log("window.lastCleanedJson:", !!window.lastCleanedJson);
      console.log("window.originalFilename:", window.originalFilename);
      
      // Use global variable
      const cleanedData = window.lastCleanedJson;
      const filename = window.originalFilename;
      
      if (!cleanedData) {
        console.log("No cleaned JSON data available");
        alert("No cleaned JSON data available to download.");
        return;
      }
      
      const blob = new Blob([
        JSON.stringify(cleanedData, null, 2)
      ], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Create download filename based on original filename
      let downloadFilename = "cleaned_output.json";
      if (filename) {
        // Remove .json extension if it exists and add _cleaned.json
        const nameWithoutExt = filename.replace(/\.json$/i, '');
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

  window.createShellCard = function(data, originalData,keys = []) {
    const card = document.createElement("div");
    card.className = "shell-card card p-3";

    // Use safe defaults for missing properties with proper error handling
    // Support both AAS-specific and general JSON structures
    let title = "";
    try {
      // Try AAS-specific fields first
      title = data.assetAdministrationShells?.[0]?.idShort || 
              data.idShort || 
              data.name || 
              data.id || 
              data.title ||
              "JSON Object";
    } catch (error) {
      console.error("Error accessing title:", error);
      title = data.idShort || data.name || data.id || "JSON Object";
    }
    
    const displayName = data.displayName || data.name || "";
    const description = keys;
    const category = data.category || "";
    const semanticId = data.semanticId?.keys?.[0]?.value || "";

    // Check if JSON was actually cleaned by comparing with original
    let wasCleaned = false;
    if (originalData) {
      try {
        const originalStr = JSON.stringify(originalData);
        const cleanedStr = JSON.stringify(data);
        wasCleaned = originalStr !== cleanedStr;
      } catch (e) {
        console.error("Error comparing JSON:", e);
        // If we can't compare, assume it was cleaned if keys are provided
        wasCleaned = keys.length > 0;
      }
    } else {
      // If no original data, assume it was cleaned if keys are provided
      wasCleaned = keys.length > 0;
    }

    // Rules table removed - no longer displaying applied rules

    card.innerHTML = `
    
    <div>
      <h5 class="card-title mb-3">${escapeHTML(title)}</h5>
      ${displayName ? `<p class="text-muted fst-italic small mb-2">${escapeHTML(displayName)}</p>` : ""}
      ${category || semanticId ? `<p class="text-info small mb-3">
        ${category ? `<span>${escapeHTML(category)}</span><br>` : ""}
        ${semanticId ? `<span>Semantic ID: ${escapeHTML(semanticId)}</span>` : ""}
      </p>` : ""}
      
      ${!wasCleaned ? '<div class="alert alert-success mb-3"><i class="bi bi-check-circle-fill me-2"></i>JSON was already clean - no changes needed</div>' : ''}
    
    <div class="mt-4">
      <div class="d-flex align-items-center justify-content-between mb-3" style="padding: 0.75rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%); border-radius: 8px; border: 1px solid rgba(34, 197, 94, 0.3);">
        <div class="d-flex align-items-center">
          <h6 class="text-success mb-0 me-3" style="font-size: 1.1rem; font-weight: 600;">
            <i class="bi bi-check-circle-fill me-2"></i>Cleaned JSON
          </h6>
          <small class="text-muted" style="color: #94a3b8 !important;">All empty values removed</small>
        </div>
        <button class="btn btn-success btn-sm download-cleaned-btn-inline" onclick="downloadCleanedJSON()" style="white-space: nowrap;">
          <i class="bi bi-download me-2"></i>Download
        </button>
      </div>
      <div class="json-display-container">
        <pre class="json-code"><code class="language-json">${escapeHTML(JSON.stringify(data, null, 2))}</code></pre>
      </div>
    </div>

    `;

    return card;
  }

  // Function to create a card showing all individual changes for a rule type
  window.createAllChangesCard = function(ruleId, changes, ruleName) {
    const card = document.createElement("div");
    card.className = "code-card card shadow";
    
    // Group changes by status (pending, approved, rejected)
    const pendingChanges = changes.filter(c => !c.accepted && !c.rejected);
    const approvedChanges = changes.filter(c => c.accepted);
    const rejectedChanges = changes.filter(c => c.rejected);
    
    let changesHtml = '';
    
    if (pendingChanges.length > 0) {
      changesHtml += `
        <div class="mb-4">
          <h5 class="text-warning mb-3">
            <i class="bi bi-clock-history me-2"></i>
            Pending Changes (${pendingChanges.length})
          </h5>
          <div class="list-group">
      `;
      
      pendingChanges.forEach((change, index) => {
        const changeId = `change-${ruleId}-${index}`;
        
        // For Rule 5 (duplicates), show full array context if available
        const isDuplicateRule = ruleId === 5;
        const hasParentContext = change.parentBefore && change.parentAfter;
        const isArrayContext = Array.isArray(change.parentBefore) && Array.isArray(change.parentAfter);
        
        let displayHtml = '';
        if (isDuplicateRule && hasParentContext && isArrayContext) {
          // Show full array context for duplicates
          const beforeCount = change.parentBefore.length;
          const afterCount = change.parentAfter.length;
          const removedIndex = change.path.match(/\[(\d+)\]/)?.[1] || '?';
          
          displayHtml = `
            <div class="row g-2">
              <div class="col-md-6">
                <small class="text-muted d-block mb-1">
                  <strong>Full Array Before:</strong>
                  <span class="badge bg-secondary ms-1">${beforeCount} items</span>
                </small>
                <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 11px; max-height: 150px; overflow: auto;"><code>${escapeHTML(JSON.stringify(change.parentBefore, null, 2))}</code></pre>
              </div>
              <div class="col-md-6">
                <small class="text-muted d-block mb-1">
                  <strong>Full Array After:</strong>
                  <span class="badge bg-success ms-1">${afterCount} items</span>
                </small>
                <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 11px; max-height: 150px; overflow: auto;"><code>${escapeHTML(JSON.stringify(change.parentAfter, null, 2))}</code></pre>
              </div>
            </div>
          `;
        } else if (ruleId === 6 || ruleId === 7) {
          // Rules 6 and 7 modify values, not remove them
          displayHtml = `
            <div class="row g-2">
              <div class="col-md-6">
                <small class="text-muted d-block mb-1">Before:</small>
                <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 11px; max-height: 100px; overflow: auto;"><code>${escapeHTML(JSON.stringify(change.beforeValue, null, 2))}</code></pre>
              </div>
              <div class="col-md-6">
                <small class="text-muted d-block mb-1">After (modified):</small>
                <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 11px; max-height: 100px; overflow: auto;"><code>${escapeHTML(JSON.stringify(change.afterValue, null, 2))}</code></pre>
              </div>
            </div>
          `;
        } else {
          // Standard display for removal rules (1-5)
          displayHtml = `
            <div class="row g-2">
              <div class="col-md-6">
                <small class="text-muted d-block mb-1">Before:</small>
                <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 11px; max-height: 100px; overflow: auto;"><code>${escapeHTML(JSON.stringify(change.beforeValue, null, 2))}</code></pre>
              </div>
              <div class="col-md-6">
                <small class="text-muted d-block mb-1">After (removed):</small>
                <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 11px; max-height: 100px; overflow: auto;"><code>null</code></pre>
              </div>
            </div>
          `;
        }
        
        changesHtml += `
          <div class="list-group-item" id="${changeId}">
            <div class="d-flex justify-content-between align-items-center">
              <div class="flex-grow-1">
                <h6 class="mb-2">
                  <code class="text-info">${escapeHTML(change.path)}</code>
                  <span class="badge bg-secondary ms-2">${ruleName}</span>
                </h6>
                ${displayHtml}
              </div>
              <div class="ms-3 d-flex flex-column gap-2">
                <button class="btn btn-sm btn-success" onclick="acceptIndividualChange(${ruleId}, ${index})">
                  <i class="bi bi-check-circle me-1"></i>Accept
                </button>
                <button class="btn btn-sm btn-danger" onclick="rejectIndividualChange(${ruleId}, ${index})">
                  <i class="bi bi-x-circle me-1"></i>Reject
                </button>
              </div>
            </div>
          </div>
        `;
      });
      
      changesHtml += `
          </div>
        </div>
      `;
    }
    
    if (approvedChanges.length > 0) {
      changesHtml += `
        <div class="mb-4">
          <h5 class="text-success mb-3">
            <i class="bi bi-check-circle me-2"></i>
            Approved Changes (${approvedChanges.length})
          </h5>
          <div class="list-group">
      `;
      
      approvedChanges.forEach((change, index) => {
        changesHtml += `
          <div class="list-group-item bg-success bg-opacity-10">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <h6 class="mb-2">
                  <code class="text-success">${escapeHTML(change.path)}</code>
                  <span class="badge bg-success ms-2">Approved</span>
                </h6>
                <small class="text-muted">This change has been accepted.</small>
              </div>
            </div>
          </div>
        `;
      });
      
      changesHtml += `
          </div>
        </div>
      `;
    }
    
    if (rejectedChanges.length > 0) {
      changesHtml += `
        <div class="mb-4">
          <h5 class="text-danger mb-3">
            <i class="bi bi-x-circle me-2"></i>
            Rejected Changes (${rejectedChanges.length})
          </h5>
          <div class="list-group">
      `;
      
      rejectedChanges.forEach((change, index) => {
        changesHtml += `
          <div class="list-group-item bg-danger bg-opacity-10">
            <div class="d-flex justify-content-between align-items-start">
              <div class="flex-grow-1">
                <h6 class="mb-2">
                  <code class="text-danger">${escapeHTML(change.path)}</code>
                  <span class="badge bg-danger ms-2">Rejected</span>
                </h6>
                <small class="text-muted">This change has been rejected.</small>
              </div>
            </div>
          </div>
        `;
      });
      
      changesHtml += `
          </div>
        </div>
      `;
    }
    
    card.innerHTML = `
      <div class="card-header bg-primary text-white">
        <h4 class="mb-0">
          <i class="bi bi-list-check me-2"></i>
          Rule ${ruleId}: ${ruleName}
        </h4>
      </div>
      
      <div class="card-body p-0">
        <!-- Action buttons at the top - always visible -->
        <div class="bg-light border-bottom p-3 sticky-top" style="z-index: 10;">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-success" onclick="acceptAllForRule(${ruleId})">
                <i class="bi bi-check-all me-1"></i>Accept All (${pendingChanges.length})
              </button>
              <button class="btn btn-danger" onclick="rejectAllForRule(${ruleId})">
                <i class="bi bi-x-circle me-1"></i>Reject All (${pendingChanges.length})
              </button>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-warning" onclick="downloadCurrentValidationState()">
                <i class="bi bi-download me-1"></i>Download Current State
              </button>
              <button class="btn btn-primary" onclick="loadNextRule()">
                <i class="bi bi-arrow-right me-1"></i>Next Rule
              </button>
            </div>
          </div>
        </div>
        
        <!-- Content area -->
        <div class="p-3">
          <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            Found <strong>${changes.length}</strong> changes. Review and accept or reject each one individually.
          </div>
          ${changesHtml}
        </div>
      </div>
    `;
    
    return card;
  };

  window.createCodeCard = function(before,after,before_full,after_full){
    // Initialize counters if not already set
    // pendingCount should already be set by countAllPendingChanges, but ensure it's at least 1 if we have a rule
    if (window.pendingCount === undefined || window.pendingCount === null) {
      window.pendingCount = 1; // Fallback if counting didn't happen
      console.log("Initializing pendingCount (fallback): pendingCount = 1");
    }
    if (window.approvedCount === undefined || window.approvedCount === null) {
      window.approvedCount = 0;
    }
    if (window.rejectedCount === undefined || window.rejectedCount === null) {
      window.rejectedCount = 0;
    }
    console.log("createCodeCard: Counters - pending:", window.pendingCount, "approved:", window.approvedCount, "rejected:", window.rejectedCount);
    
    console.log("=== DEBUG: createCodeCard called ===");
    console.log("before parameter:", JSON.stringify(before, null, 2));
    console.log("after parameter:", JSON.stringify(after, null, 2));
    console.log("before_full parameter:", JSON.stringify(before_full, null, 2));
    console.log("after_full parameter:", JSON.stringify(after_full, null, 2));
    
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
            <div class="status-number pending" id="pendingCount">${window.pendingCount || 0}</div>
            <div class="status-label">Pending</div>
          </div>
          <div class="status-item">
            <div class="status-number approved" id="approvedCount">${window.approvedCount || 0}</div>
            <div class="status-label">Approved</div>
          </div>
          <div class="status-item">
            <div class="status-number rejected" id="rejectedCount">${window.rejectedCount || 0}</div>
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
    
    // Get current state (with accepted changes applied)
    const currentState = computeCurrentStateFromAcceptedChanges() || originalData;
    const history = window.changeHistory || [];
    const acceptedCount = history.filter(h => h.action === 'accepted').length;
    
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
          <!-- History will be populated by updateChangesHistoryDisplay -->
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
              <i class="bi bi-file-code me-2"></i>Current State (${acceptedCount} changes accepted)
            </h6>
            <div id="currentStateContent" class="diff-container bg-dark text-light p-2" style="height: calc(100% - 40px); overflow: auto; font-family: 'Courier New', monospace; font-size: 12px;">
              <pre class="m-0"><code>${escapeHTML(JSON.stringify(currentState || {}, null, 2))}</code></pre>
            </div>
          </div>
          
          <div class="resizable-divider-three"></div>
          
          <!-- Final Result Pane -->
          <div class="resizable-pane-three right">
            <h6 class="text-success p-2 m-0 bg-dark border-bottom d-flex justify-content-between align-items-center">
              <span>
                <i class="bi bi-download me-2"></i>Final Cleaned JSON
              </span>
              <button class="btn btn-sm btn-success" onclick="downloadCleanedJSON()">
                <i class="bi bi-download"></i> Download
              </button>
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
    // If it's an object, stringify it first
    if (typeof str === 'object') {
      str = JSON.stringify(str, null, 2);
    }
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
  // Update rejectChanges for stepwise Phase 1 processing
  // Handle individual change acceptance/rejection
  window.acceptIndividualChange = function(ruleId, changeIndex) {
    if (!window.allChanges || !window.allChanges[changeIndex]) {
      console.error("Change not found");
      return;
    }
    
    const change = window.allChanges[changeIndex];
    change.accepted = true;
    change.rejected = false;
    
    // Apply this change to current state
    if (window.currentState) {
      applyChangeToState(change, window.currentState);
    } else {
      // Recompute current state
      computeCurrentStateFromAcceptedChanges();
    }
    
    // Track in change history
    if (typeof addToChangeHistory === 'function') {
      const currentState = computeCurrentStateFromAcceptedChanges();
      addToChangeHistory(
        ruleId,
        'accepted',
        change.beforeValue,
        change.afterValue,
        currentState
      );
    }
    
    // Update counters
    if (window.approvedCount === undefined) window.approvedCount = 0;
    window.approvedCount++;
    if (window.pendingCount > 0) window.pendingCount--;
    
    // Refresh the display
    refreshAllChangesCard(ruleId);
    
    // Update Changes & Results tab
    updateChangesResultsTab();
  };
  
  window.rejectIndividualChange = function(ruleId, changeIndex) {
    if (!window.allChanges || !window.allChanges[changeIndex]) {
      console.error("Change not found");
      return;
    }
    
    const change = window.allChanges[changeIndex];
    change.accepted = false;
    change.rejected = true;
    
    // Track in change history
    if (typeof addToChangeHistory === 'function') {
      addToChangeHistory(
        ruleId,
        'rejected',
        change.beforeValue,
        change.afterValue,
        null // No state change for rejected
      );
    }
    
    // Update counters
    if (window.rejectedCount === undefined) window.rejectedCount = 0;
    window.rejectedCount++;
    if (window.pendingCount > 0) window.pendingCount--;
    
    // Refresh the display
    refreshAllChangesCard(ruleId);
    
    // Update Changes & Results tab
    updateChangesResultsTab();
  };
  
  window.acceptAllForRule = function(ruleId) {
    if (!window.allChanges) return;
    
    const pending = window.allChanges.filter(c => !c.accepted && !c.rejected);
    pending.forEach(change => {
      change.accepted = true;
      change.rejected = false;
      // Apply change to current state
      if (window.currentState) {
        applyChangeToState(change, window.currentState);
      }
      
      // Track each change in history
      if (typeof addToChangeHistory === 'function') {
        const currentState = computeCurrentStateFromAcceptedChanges();
        addToChangeHistory(
          ruleId,
          'accepted',
          change.beforeValue,
          change.afterValue,
          currentState
        );
      }
    });
    
    // Add rule to skipRules
    if (window.skipRules && !window.skipRules.includes(ruleId)) {
      window.skipRules.push(ruleId);
    }
    
    // Recompute current state to ensure consistency
    computeCurrentStateFromAcceptedChanges();
    
    if (window.approvedCount === undefined) window.approvedCount = 0;
    window.approvedCount += pending.length;
    window.pendingCount = Math.max(0, window.pendingCount - pending.length);
    
    refreshAllChangesCard(ruleId);
    
    // Update Changes & Results tab
    updateChangesResultsTab();
  };
  
  window.rejectAllForRule = function(ruleId) {
    if (!window.allChanges) return;
    
    const pending = window.allChanges.filter(c => !c.accepted && !c.rejected);
    pending.forEach(change => {
      change.accepted = false;
      change.rejected = true;
      
      // Track each change in history
      if (typeof addToChangeHistory === 'function') {
        addToChangeHistory(
          ruleId,
          'rejected',
          change.beforeValue,
          change.afterValue,
          null // No state change for rejected
        );
      }
    });
    
    if (window.rejectedCount === undefined) window.rejectedCount = 0;
    window.rejectedCount += pending.length;
    window.pendingCount = Math.max(0, window.pendingCount - pending.length);
    
    refreshAllChangesCard(ruleId);
    
    // Update Changes & Results tab
    updateChangesResultsTab();
  };
  
  window.loadNextRule = async function() {
    if (!window.originalJson) {
      alert("No JSON data available");
      return;
    }
    
    // Add current rule to skipRules if it exists
    if (window.currentRule && window.skipRules) {
      if (!window.skipRules.includes(window.currentRule)) {
        window.skipRules.push(window.currentRule);
      }
    }
    
    // Use current state (with accepted changes) to find next rule
    const stateToUse = computeCurrentStateFromAcceptedChanges() || window.originalJson;
    
    // Find next rule with changes
    const nextRuleId = await findFirstRuleWithChanges(stateToUse, window.skipRules || []);
    
    if (!nextRuleId) {
      alert("No more rules with changes found!");
      return;
    }
    
    // Load all changes for next rule using current state
    showLoading(`Loading changes for Rule ${nextRuleId}...`);
    try {
      const data = await loadAllChangesForRule(stateToUse, nextRuleId, window.skipRules || []);
      
      window.currentRule = data.ruleId;
      window.allChanges = data.changes.map(c => ({
        ...c,
        accepted: false,
        rejected: false
      }));
      
      const ruleNames = {
        1: "Remove empty lists",
        2: "Remove empty strings",
        3: "Remove null values",
        4: "Remove empty objects",
        5: "Remove duplicates"
      };
      
      const validationTabContent = document.getElementById('validation');
      if (validationTabContent && window.createAllChangesCard) {
        const card = window.createAllChangesCard(
          data.ruleId,
          window.allChanges,
          ruleNames[data.ruleId] || `Rule ${data.ruleId}`
        );
        validationTabContent.innerHTML = "";
        validationTabContent.appendChild(card);
      }
      
      hideLoading();
    } catch (error) {
      hideLoading();
      console.error("Error loading next rule:", error);
      alert("Error loading next rule: " + error.message);
    }
  };
  
  function refreshAllChangesCard(ruleId) {
    const ruleNames = {
      1: "Remove empty lists",
      2: "Remove empty strings",
      3: "Remove null values",
      4: "Remove empty objects",
      5: "Remove duplicates"
    };
    
    const validationTabContent = document.getElementById('validation');
    if (validationTabContent && window.createAllChangesCard && window.allChanges) {
      const card = window.createAllChangesCard(
        ruleId,
        window.allChanges,
        ruleNames[ruleId] || `Rule ${ruleId}`
      );
      validationTabContent.innerHTML = "";
      validationTabContent.appendChild(card);
    }
    
    // Update status bar
    const pendingEl = document.getElementById('pendingCount');
    const approvedEl = document.getElementById('approvedCount');
    const rejectedEl = document.getElementById('rejectedCount');
    if (pendingEl) pendingEl.textContent = window.pendingCount || 0;
    if (approvedEl) approvedEl.textContent = window.approvedCount || 0;
    if (rejectedEl) rejectedEl.textContent = window.rejectedCount || 0;
  }
  
  // Download current state from Rule Validation tab
  window.downloadCurrentValidationState = function() {
    // Compute current state from original + all accepted changes
    const currentState = computeCurrentStateFromAcceptedChanges();
    
    if (!currentState) {
      alert("No current state available. Please accept at least one change first.");
      return;
    }
    
    const dataStr = JSON.stringify(currentState, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const acceptedCount = window.approvedCount || 0;
    a.download = `current_state_${acceptedCount}_accepted_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✓ Downloaded current state with ${acceptedCount} accepted changes`);
  };
  
  // Compute current state by applying all accepted changes to original JSON
  function computeCurrentStateFromAcceptedChanges() {
    if (!window.originalJson) {
      return window.currentState || null;
    }
    
    // If no changes tracked, return original
    if (!window.allChanges || window.allChanges.length === 0) {
      return window.originalJson;
    }
    
    // Deep copy original
    let current = JSON.parse(JSON.stringify(window.originalJson));
    
    // Apply all accepted changes
    window.allChanges.forEach(change => {
      if (change.accepted && change.path && change.fieldName) {
        applyChangeToState(change, current);
      }
    });
    
    // Update global current state
    window.currentState = current;
    return current;
  }
  
  // Helper function to apply a change to a state object
  function applyChangeToState(change, targetState) {
    if (!targetState || !change.path || !change.fieldName) return;
    
    try {
      // Rules 6 and 7 modify values, not remove them
      const isModificationRule = change.ruleId === 6 || change.ruleId === 7;
      
      // Parse the path (e.g., "description" or "user.description" or "items[0].name")
      const pathParts = change.path.split('.');
      let current = targetState;
      
      // Navigate to parent object (skip last part which is the field name)
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (part.includes('[')) {
          // Handle array index like "items[0]"
          const match = part.match(/^(.+)\[(\d+)\]$/);
          if (match) {
            const key = match[1];
            const index = parseInt(match[2]);
            if (current[key] && Array.isArray(current[key]) && current[key][index]) {
              current = current[key][index];
            } else {
              return; // Path doesn't exist
            }
          }
        } else {
          if (current[part] && typeof current[part] === 'object') {
            current = current[part];
          } else {
            return; // Path doesn't exist
          }
        }
      }
      
      const fieldName = pathParts[pathParts.length - 1];
      if (current && typeof current === 'object' && !Array.isArray(current)) {
        if (isModificationRule && change.afterValue !== null && change.afterValue !== undefined) {
          // For modification rules, update the value
          // Convert afterValue from JSON if it's a string
          let newValue = change.afterValue;
          if (typeof newValue === 'string') {
            try {
              newValue = JSON.parse(newValue);
            } catch (e) {
              // Keep as string if parsing fails
            }
          }
          current[fieldName] = newValue;
        } else {
          // For removal rules, delete the field
          delete current[fieldName];
        }
      }
    } catch (error) {
      console.error("Error applying change to state:", error, change);
    }
  }

  window.rejectChanges = function() {
    console.log("REJECT button clicked");
    
    if (!window.currentStepState) {
      alert("No pending change to reject.");
      return;
    }
    
    const stepState = window.currentStepState;
    const state = currentProcessingState;
    
    // Skip this specific path
    state.skipRules.push(stepState.path);
    
    // Add to change history
    if (typeof addToChangeHistory === 'function') {
      addToChangeHistory(
        stepState.ruleIndex + 1,
        'rejected',
        stepState.beforeFragment,
        stepState.afterFragment,
        state.currentData
      );
    }
    
    // Update counters (use global window variables)
    window.rejectedCount += 1;
    if (window.pendingCount > 0) window.pendingCount -= 1;
    const rejEl = document.getElementById('rejectedCount');
    const penEl = document.getElementById('pendingCount');
    if (rejEl) rejEl.textContent = String(window.rejectedCount);
    if (penEl) penEl.textContent = String(window.pendingCount);
    
    // Process next step
    showLoading("Finding next change...");
    setTimeout(() => {
      processNextStep();
    }, 100);
  };

  // Update the acceptChanges function for stepwise Phase 1 processing
  window.acceptChanges = function() {
    console.log("ACCEPT button clicked");
    
    if (!window.currentStepState) {
      alert("No pending change to accept.");
      return;
    }
    
    const stepState = window.currentStepState;
    const state = currentProcessingState;
    
    // Apply the change
    state.currentData = JSON.parse(JSON.stringify(stepState.afterData));
    
    // Add to change history
    if (typeof addToChangeHistory === 'function') {
      addToChangeHistory(
        stepState.ruleIndex + 1,
        'accepted',
        stepState.beforeFragment,
        stepState.afterFragment,
        state.currentData
      );
    }
    
    // Update counters (use global window variables)
    window.approvedCount += 1;
    if (window.pendingCount > 0) window.pendingCount -= 1;
    const appEl = document.getElementById('approvedCount');
    const penEl = document.getElementById('pendingCount');
    if (appEl) appEl.textContent = String(window.approvedCount);
    if (penEl) penEl.textContent = String(window.pendingCount);
    
    // Update current state display
    if (typeof updateCurrentStateDisplay === 'function') {
      updateCurrentStateDisplay(state.currentData);
    }
    
    // Process next step
    showLoading("Finding next change...");
    setTimeout(() => {
      processNextStep();
    }, 100);
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
    if (!window.originalJson) {
      alert("No original JSON data available. Please upload a file first.");
      return;
    }
    
      const confirmed = confirm(
      `This will automatically accept all remaining rules and download the final JSON.\n\n` +
      `Pending rules: ${window.pendingCount}\n` +
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
      const response = await fetch("http://localhost:5001/upload", {
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
      
      // Update counters - all pending become approved (use global window variables)
      const remainingPending = window.pendingCount;
      window.approvedCount += remainingPending;
      window.pendingCount = 0;
      
      const appEl = document.getElementById('approvedCount');
      const penEl = document.getElementById('pendingCount');
      if (appEl) appEl.textContent = String(window.approvedCount);
      if (penEl) penEl.textContent = String(window.pendingCount);
      
      hideLoading();
      alert(`Successfully processed and downloaded the cleaned JSON file!`);
      
    } catch (error) {
      console.error("Error during accept all:", error);
      hideLoading();
      alert("Error processing rules. Please try again.");
    }
  };

  // Rule Preset Management Functions
  async function loadRulePresets() {
    try {
      // Skip preset loading for Java backend (endpoint doesn't exist)
      // We're using the 4 general rules now
      console.log("Skipping preset loading - using 4 general rules");
      return;
      
      const response = await fetch('/rule-presets');
      const data = await response.json();
      
      availablePresets = data.presets || [];
      currentPreset = data.current || 'aas_rules';
      
      // Update preset selector
      const presetSelect = document.getElementById('presetSelect');
      if (presetSelect) {
        presetSelect.innerHTML = '';
        availablePresets.forEach(preset => {
          const option = document.createElement('option');
          option.value = preset;
          option.textContent = preset === 'aas_rules' ? 'AAS Rules (18 rules)' : preset;
          if (preset === currentPreset) {
            option.selected = true;
          }
          presetSelect.appendChild(option);
        });
      }
      
      // Update badge
      updatePresetBadge();
      
      // Load current preset info
      await loadPresetInfo();
    } catch (error) {
      console.error('Error loading presets:', error);
    }
  }

  async function loadPresetInfo() {
    try {
      // For generalized rules, we don't need to fetch from backend
      // Use the 4 general rules directly
      const generalRulesInfo = {
        total_rules: 4,
        rules_by_category: {
          "General Cleaning": 4
        },
        rules: [
          { id: 1, name: "Remove empty lists", category: "General Cleaning" },
          { id: 2, name: "Remove empty strings", category: "General Cleaning" },
          { id: 3, name: "Remove null values", category: "General Cleaning" },
          { id: 4, name: "Remove empty objects", category: "General Cleaning" }
        ]
      };
      
      currentRulesInfo = generalRulesInfo;
      
      // Update preset info display
      const presetInfo = document.getElementById('presetInfo');
      if (presetInfo) {
        presetInfo.textContent = `4 rules in 1 category`;
      }
      
      // Update statistics
      updateRuleStatistics(generalRulesInfo);
    } catch (error) {
      console.error('Error loading preset info:', error);
      // Fallback: Set basic info even if update fails
      const totalRulesEl = document.getElementById('totalRules');
      const ruleCategoriesEl = document.getElementById('ruleCategories');
      if (totalRulesEl) totalRulesEl.textContent = '4';
      if (ruleCategoriesEl) ruleCategoriesEl.textContent = '1';
    }
  }

  async function changePreset() {
    const presetSelect = document.getElementById('presetSelect');
    const newPreset = presetSelect.value;
    
    if (newPreset === currentPreset) return;
    
    showLoading(`Switching to ${newPreset}...`);
    
    try {
      const response = await fetch(`/rule-presets/${newPreset}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        currentPreset = newPreset;
        updatePresetBadge();
        await loadPresetInfo();
        
        // Reset state when changing presets
        reloadAll();
        
        hideLoading();
        alert(`Switched to preset: ${newPreset}\n${data.rules_info.total_rules} rules loaded`);
      } else {
        throw new Error(data.error || 'Failed to switch preset');
      }
    } catch (error) {
      console.error('Error changing preset:', error);
      hideLoading();
      alert(`Error switching preset: ${error.message}`);
      // Reset selector
      presetSelect.value = currentPreset;
    }
  }

  function updatePresetBadge() {
    const badge = document.getElementById('currentPresetBadge');
    if (badge) {
      // For generalized rules, always show "General Rules"
      badge.innerHTML = `<span class="badge bg-info">General Rules</span>`;
    }
  }

  function updateRuleStatistics(rulesInfo) {
    if (!rulesInfo) return;
    
    const totalRulesEl = document.getElementById('totalRules');
    const appliedRulesEl = document.getElementById('appliedRules');
    const ruleCategoriesEl = document.getElementById('ruleCategories');
    
    if (totalRulesEl) {
      totalRulesEl.textContent = rulesInfo.total_rules || 0;
    }
    
    if (appliedRulesEl) {
      // This will be updated when rules are applied
      appliedRulesEl.textContent = '0';
    }
    
    if (ruleCategoriesEl) {
      const categories = Object.keys(rulesInfo.rules_by_category || {});
      ruleCategoriesEl.textContent = categories.length || 0;
    }
  }

  async function showRuleInfo() {
    try {
      const response = await fetch('/rules');
      const data = await response.json();
      
      if (data.error) {
        alert(`Error: ${data.error}`);
        return;
      }
      
      // Create modal to show rule information
      const modal = document.createElement('div');
      modal.className = 'modal fade';
      modal.innerHTML = `
        <div class="modal-dialog modal-lg">
          <div class="modal-content bg-dark text-light">
            <div class="modal-header">
              <h5 class="modal-title">
                <i class="bi bi-list-check me-2"></i>Rule Information
                <span class="badge bg-info ms-2">${data.current_preset}</span>
              </h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body" style="max-height: 600px; overflow-y: auto;">
              <div class="mb-3">
                <strong>Total Rules:</strong> ${data.rules_info.total_rules}
                <span class="ms-3"><strong>Categories:</strong> ${Object.keys(data.rules_info.rules_by_category || {}).length}</span>
              </div>
              <div class="table-responsive">
                <table class="table table-dark table-sm">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.rules.map(rule => `
                      <tr>
                        <td><span class="badge bg-primary">${rule.id}</span></td>
                        <td>${rule.desc || rule.name || 'Unknown'}</td>
                        <td><span class="badge bg-secondary">${rule.category || 'uncategorized'}</span></td>
                        <td><small class="text-muted">${rule.type || 'unknown'}</small></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      
      modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
      });
    } catch (error) {
      console.error('Error showing rule info:', error);
      alert(`Error loading rule information: ${error.message}`);
    }
  }

  // Initialize on page load - but fail gracefully if preset endpoint doesn't exist
  loadRulePresets().catch(err => {
    console.log("Preset loading skipped (endpoint not available in Java backend)");
  });

  // Test function to verify handleFileUpload is accessible
  window.testFileUpload = function() {
    console.log("=== TEST: testFileUpload called ===");
    if (typeof window.handleFileUpload === 'function') {
      alert("✓ handleFileUpload function exists!\n\nNow try uploading a file to see if it works.");
      console.log("✓ handleFileUpload is a function");
    } else {
      alert("✗ ERROR: handleFileUpload function NOT FOUND!\n\nCheck browser console for details.");
      console.error("✗ handleFileUpload is NOT a function");
    }
    
    const fileInput = document.getElementById('jsonFileInput');
    if (fileInput) {
      console.log("✓ File input element found");
      alert("File input found. Click the upload area to select a file.");
    } else {
      console.error("✗ File input element NOT found");
      alert("ERROR: File input element not found!");
    }
  };
  
  // Display issue summary - now defined globally above (window.displayIssueSummary)
  
  // Proceed with cleaning - matches original workflow
  window.proceedWithCleaning = function() {
    console.log("proceedWithCleaning called, originalJson:", !!window.originalJson);
    if (!window.originalJson) {
      alert("No file uploaded. Please upload a JSON file first.");
      return;
    }
    
    window.showLoading("Cleaning JSON file...");
    
    // Use upload endpoint (does full clean + stepwise like original)
    const formData = new FormData();
    const fileInput = document.getElementById('jsonFileInput');
    if (fileInput && fileInput.files[0]) {
      formData.append("file", fileInput.files[0]);
      
      // Add boolean conversion mode to form data
      formData.append("boolean_conversion_mode", window.booleanConversionMode || "boolean");
      
      fetch("http://localhost:5001/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Upload failed");
          return response.json();
        })
        .then((jsonData) => {
          console.log("proceedWithCleaning: Response received:", jsonData);
          console.log("proceedWithCleaning: JSON field:", jsonData["JSON"]);
          console.log("proceedWithCleaning: JSON type:", typeof jsonData["JSON"]);
          console.log("proceedWithCleaning: JSON isArray:", Array.isArray(jsonData["JSON"]));
          
          // Use same selectors as original code
          const shellWrapper = document.querySelector(".shell-wrapper") || document.getElementById('shells');
          const validationTabContent = document.getElementById('validation');
          
          console.log("proceedWithCleaning: shellWrapper found:", !!shellWrapper);
          console.log("proceedWithCleaning: validationTabContent found:", !!validationTabContent);
          
          if (!shellWrapper) {
            console.error("shellWrapper not found!");
            window.hideLoading();
            alert("Error: Could not find Quick Clean tab element!");
            return;
          }
          
          // Clear existing content (like original)
          console.log("proceedWithCleaning: Clearing shellWrapper...");
          shellWrapper.innerHTML = "";
          
          // Store the cleaned JSON for download (like original)
          window.lastCleanedJson = jsonData["JSON"];
          window.keys = jsonData["KEYS"] || [];
          
          console.log("proceedWithCleaning: lastCleanedJson stored:", !!window.lastCleanedJson);
          console.log("proceedWithCleaning: keys:", window.keys);
          
          // Store stepwise data (like original Python workflow)
          window.before = jsonData["BEFORE"];
          window.after = jsonData["AFTER"];
          window.before_full = jsonData["Before_data"];
          window.after_full = jsonData["After_data"];
          window.complete_after_data = jsonData["Complete_after_data"];
          window.complete_before_data = jsonData["Complete_before_data"];
          window.currentRule = jsonData["CURRENT_RULE"];
          window.skipRules = jsonData["SKIP_RULES"] || [];
          
          console.log("proceedWithCleaning: Stepwise data stored:", {
            before: !!window.before,
            after: !!window.after,
            before_full: !!window.before_full,
            after_full: !!window.after_full,
            currentRule: window.currentRule
          });
          
          // CRITICAL: Populate validation tab IMMEDIATELY with first rule change (like Python workflow)
          if (validationTabContent) {
            if (window.before && window.after) {
              console.log("proceedWithCleaning: Populating validation tab with BEFORE/AFTER from upload response");
              const codeCard = createCodeCard(
                window.before, 
                window.after, 
                window.before_full || window.before, 
                window.after_full || window.after
              );
              validationTabContent.innerHTML = "";
              validationTabContent.appendChild(codeCard);
              console.log("✓ Validation tab populated with first rule change");
            } else if (window.before_full && window.after_full) {
              console.log("proceedWithCleaning: Populating validation tab with Before_data/After_data from upload response");
              const codeCard = createCodeCard(
                window.before_full, 
                window.after_full, 
                window.before_full, 
                window.after_full
              );
              validationTabContent.innerHTML = "";
              validationTabContent.appendChild(codeCard);
              console.log("✓ Validation tab populated with fragments");
            } else if (window.currentRule === null) {
              console.log("proceedWithCleaning: No rules to apply - JSON is clean");
              validationTabContent.innerHTML = `
                <div class="card shadow">
                  <div class="card-body text-center p-5">
                    <i class="bi bi-check-circle" style="font-size: 4rem; color: #22c55e; margin-bottom: 1rem;"></i>
                    <h3 class="mb-3">JSON is Already Clean</h3>
                    <p class="text-muted mb-4">
                      No rule changes were needed. Your JSON file is already clean!
                    </p>
                  </div>
                </div>
              `;
            } else {
              console.log("proceedWithCleaning: No before/after data, will call /get-next-change");
            }
          } else {
            console.error("proceedWithCleaning: Validation tab content element not found!");
          }
          
          // Initialize Changes & Results tab
          if (typeof updateChangesResultsTab === 'function') {
            updateChangesResultsTab(window.originalJson, jsonData["JSON"]);
          }
          
          // Display cleaned JSON in Quick Clean tab (exactly like original)
          console.log("proceedWithCleaning: Starting to display JSON...");
          try {
            if (Array.isArray(jsonData["JSON"])) {
              console.log("proceedWithCleaning: Processing as array, length:", jsonData["JSON"].length);
              jsonData["JSON"].forEach((item, index) => {
                try {
                  const originalItem = window.originalJson && Array.isArray(window.originalJson) ? window.originalJson[index] : null;
                  console.log(`proceedWithCleaning: Creating card for item ${index}...`);
                  const card = createShellCard(item, originalItem, window.keys);
                  console.log(`proceedWithCleaning: Card created for item ${index}:`, card);
                  shellWrapper.appendChild(card);
                  console.log(`proceedWithCleaning: Card ${index} appended to shellWrapper`);
                } catch (error) {
                  console.error(`Error creating card for item ${index}:`, error);
                  const errorCard = document.createElement("div");
                  errorCard.className = "shell-card card p-3";
                  errorCard.innerHTML = `<h5 class="card-title text-danger">Error processing item ${index}</h5>`;
                  shellWrapper.appendChild(errorCard);
                }
              });
              
              // Download button is now inside the card header, no need for separate wrapper
              console.log("proceedWithCleaning: Download button added for array");
            } else if (typeof jsonData["JSON"] === "object" && jsonData["JSON"] !== null) {
              console.log("proceedWithCleaning: Processing as object");
              console.log("proceedWithCleaning: jsonData['JSON'] keys:", Object.keys(jsonData["JSON"]).slice(0, 5));
              if (jsonData["JSON"]["users"] && jsonData["JSON"]["users"][0]) {
                const firstUser = jsonData["JSON"]["users"][0];
                console.log("proceedWithCleaning: First user keys:", Object.keys(firstUser).slice(0, 10));
                console.log("proceedWithCleaning: Has 'description'?", 'description' in firstUser);
                console.log("proceedWithCleaning: Has 'tags'?", 'tags' in firstUser);
              }
              console.log("proceedWithCleaning: Calling createShellCard...");
              const card = createShellCard(jsonData["JSON"], window.originalJson, window.keys);
              console.log("proceedWithCleaning: Card created:", card);
              console.log("proceedWithCleaning: Card innerHTML length:", card.innerHTML ? card.innerHTML.length : 0);
              console.log("proceedWithCleaning: Card innerHTML preview:", card.innerHTML.substring(0, 200));
              shellWrapper.appendChild(card);
              console.log("proceedWithCleaning: Card appended to shellWrapper");
              console.log("proceedWithCleaning: shellWrapper children count:", shellWrapper.children.length);
              console.log("proceedWithCleaning: shellWrapper innerHTML length:", shellWrapper.innerHTML.length);
              console.log("proceedWithCleaning: shellWrapper computed style display:", window.getComputedStyle(shellWrapper).display);
              console.log("proceedWithCleaning: shellWrapper computed style visibility:", window.getComputedStyle(shellWrapper).visibility);
              console.log("proceedWithCleaning: shellWrapper classes:", shellWrapper.className);
              console.log("proceedWithCleaning: Card computed style display:", window.getComputedStyle(card).display);
              console.log("proceedWithCleaning: Card computed style visibility:", window.getComputedStyle(card).visibility);
              
              // Force tab to be visible (like original)
              const shellsTabButton = document.getElementById('shells-tab');
              if (shellsTabButton) {
                const tab = new bootstrap.Tab(shellsTabButton);
                tab.show();
                console.log("proceedWithCleaning: Tab switched to Quick Clean");
              }
              
              // Download button is now inside the card header, no need for separate wrapper
              console.log("proceedWithCleaning: Download button added for object");
            } else {
              console.error("proceedWithCleaning: Unsupported JSON format:", typeof jsonData["JSON"], jsonData["JSON"]);
              alert("Unsupported JSON format from server.");
            }
          } catch (error) {
            console.error("Error displaying JSON data:", error);
            console.error("Error stack:", error.stack);
            alert("Error displaying the processed data: " + error.message);
          }
          
          // Update issue summary to show all zeros after cleaning
          const zeroIssues = {
            empty_lists: 0,
            empty_strings: 0,
            null_values: 0,
            empty_objects: 0,
            duplicates: 0,
            total_issues: 0
          };
          window.displayIssueSummary(zeroIssues);
          
          // If validation tab wasn't populated above (no before/after in response), try get-next-change
          if (validationTabContent && !window.before && !window.after && window.currentRule === null) {
            console.log("proceedWithCleaning: No rule change in upload response, calling /get-next-change as fallback");
            const dataToSend = window.complete_before_data || window.originalJson || jsonData["JSON"];
            
            fetch("http://localhost:5001/get-next-change", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                current_data: dataToSend,
                skip_rules: window.skipRules || []
              })
            })
            .then(response => response.json())
            .then(data => {
              console.log("proceedWithCleaning: get-next-change fallback response:", data);
              
              if (data.BEFORE && data.AFTER) {
                window.before = data.BEFORE;
                window.after = data.AFTER;
                window.before_full = data.Before_data || data.BEFORE;
                window.after_full = data.After_data || data.AFTER;
                window.currentRule = data.CURRENT_RULE;
                window.complete_after_data = data.Complete_after_data;
                window.complete_before_data = data.Complete_before_data;
                
                const codeCard = createCodeCard(window.before, window.after, window.before_full, window.after_full);
                validationTabContent.innerHTML = "";
                validationTabContent.appendChild(codeCard);
                console.log("proceedWithCleaning: Validation tab populated via fallback");
              }
            })
            .catch(error => {
              console.error("proceedWithCleaning: Error in fallback get-next-change:", error);
            });
          }
          
          // Hide loading
          console.log("proceedWithCleaning: Hiding loading...");
          window.hideLoading();
          
          // Refresh rule info
          loadPresetInfo();
          
          console.log("proceedWithCleaning: Complete!");
        })
        .catch((error) => {
          window.hideLoading();
          console.error("Error:", error);
          alert("Error processing file: " + error.message);
        });
    }
  };
  
  // Remove specific issue type
  window.removeSpecificIssue = function(ruleId) {
    if (!window.originalJson) {
      alert("No JSON data available. Please upload a file first.");
      return;
    }
    
    // Get current JSON (use cleaned version if available, otherwise original)
    const currentJson = window.lastCleanedJson || window.originalJson;
    
    if (!currentJson) {
      alert("No JSON data available.");
      return;
    }
    
    // Show loading
    window.showLoading(`Removing ${window.getRuleName(ruleId)}...`);
    
    // Call backend to clean specific rule
    console.log("Calling /clean-specific-rule with ruleId:", ruleId);
    console.log("Current JSON keys:", Object.keys(currentJson || {}));
    
    fetch("http://localhost:5001/clean-specific-rule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        json_data: currentJson,
        rule_id: ruleId
      })
    })
      .then((response) => {
        console.log("Response status:", response.status, response.statusText);
        if (!response.ok) {
          return response.text().then(text => {
            console.error("Error response:", text);
            try {
              const err = JSON.parse(text);
              throw new Error(err.error || "Failed to clean specific rule");
            } catch (e) {
              throw new Error(`HTTP ${response.status}: ${text}`);
            }
          });
        }
        return response.json();
      })
      .then((result) => {
        window.hideLoading();
        
        // Update the cleaned JSON
        window.lastCleanedJson = result.cleaned_json;
        window.originalJson = result.cleaned_json; // Update original to reflect changes
        
        // Update issue summary with new counts
        window.displayIssueSummary(result.issues);
        
        // Refresh the cleaned JSON display
        const shellWrapper = document.querySelector(".shell-wrapper");
        if (shellWrapper && window.lastCleanedJson) {
          shellWrapper.innerHTML = "";
          if (Array.isArray(window.lastCleanedJson)) {
            window.lastCleanedJson.forEach((item, index) => {
              const originalItem = window.originalJson && Array.isArray(window.originalJson) ? window.originalJson[index] : null;
              if (typeof window.createShellCard === 'function') {
                const card = window.createShellCard(item, originalItem, window.keys || []);
                shellWrapper.appendChild(card);
              } else {
                // Fallback: just display the JSON
                const pre = document.createElement("pre");
                pre.className = "json-code";
                const code = document.createElement("code");
                code.className = "language-json";
                code.textContent = JSON.stringify(item, null, 2);
                pre.appendChild(code);
                shellWrapper.appendChild(pre);
              }
            });
          } else if (typeof window.lastCleanedJson === "object" && window.lastCleanedJson !== null) {
            if (typeof window.createShellCard === 'function') {
              const card = window.createShellCard(window.lastCleanedJson, window.originalJson, window.keys || []);
              shellWrapper.appendChild(card);
            } else {
              // Fallback: just display the JSON
              const pre = document.createElement("pre");
              pre.className = "json-code";
              const code = document.createElement("code");
              code.className = "language-json";
              code.textContent = JSON.stringify(window.lastCleanedJson, null, 2);
              pre.appendChild(code);
              shellWrapper.appendChild(pre);
            }
          }
        }
      })
      .catch((error) => {
        window.hideLoading();
        console.error("Error removing specific issue:", error);
        console.error("Error stack:", error.stack);
        let errorMessage = "Error removing issue: " + error.message;
        if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
          errorMessage += "\n\nPlease check:\n1. Backend is running on port 5001\n2. No CORS issues\n3. Browser console for more details";
        }
        alert(errorMessage);
      });
  };
  
  // Helper function to get rule name - make it global
  window.getRuleName = function(ruleId) {
    const ruleNames = {
      1: "Empty Lists",
      2: "Empty Strings",
      3: "Null Values",
      4: "Empty Objects"
    };
    return ruleNames[ruleId] || "Issue";
  };
  
  // Clear upload
  window.clearUpload = function() {
    const fileInput = document.getElementById('jsonFileInput');
    const fileNameDisplay = document.getElementById('uploadedFileName');
    const uploadAreaEl = document.getElementById('uploadArea');
    const issueSummary = document.getElementById('issueSummary');
    const resetButton = document.getElementById('resetButton');
    
    if (fileInput) fileInput.value = '';
    if (fileNameDisplay) fileNameDisplay.style.display = 'none';
    if (uploadAreaEl) uploadAreaEl.style.display = 'block';
    if (issueSummary) issueSummary.style.display = 'none';
    if (resetButton) resetButton.style.display = 'none';
    
    // Hide rule settings card when clearing
    const ruleSettingsCard = document.getElementById('ruleSettingsCard');
    if (ruleSettingsCard) {
      ruleSettingsCard.style.display = 'none';
    }
    
    // Clear change history and state
    window.changeHistory = [];
    window.originalJson = null;
    window.originalFilename = null;
    window.currentState = null;
    window.allChanges = null;
    window.currentRule = null;
    window.pendingCount = 0;
    window.approvedCount = 0;
    window.rejectedCount = 0;
    
    // Clear Changes & Results tab
    const changesResultsWrapper = document.querySelector('.changes-results-wrapper');
    if (changesResultsWrapper) {
      changesResultsWrapper.innerHTML = '';
    }
  };
  
  // Old file upload handler (for compatibility)
  const oldFileUploadHandler = function(event) {
    // Check if handleFileUpload already processed this
    if (event.handledByQuickClean) {
      return;
    }
    
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

    fetch("http://localhost:5001/upload", {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Upload failed");
        return response.json();
      })
      .then((jsonData) => {
        hideLoading();
        
        // Clear any existing cards
        if (shellWrapper) shellWrapper.innerHTML = "";
        if (shellInteractive) shellInteractive.innerHTML = "";

        // Store the cleaned JSON for download
        window.lastCleanedJson = jsonData["JSON"];

        // Store the applied Keys
        keys = jsonData["KEYS"] || [];
       
       // Update applied rules count if available
       if (jsonData.keys_applied_length !== undefined) {
         const appliedRulesEl = document.getElementById('appliedRules');
         if (appliedRulesEl) {
           appliedRulesEl.textContent = jsonData.keys_applied_length;
         }
       }
       
       // Refresh rule info after processing
       loadPresetInfo();

       
         before = jsonData["BEFORE"];
         after = jsonData["AFTER"];
         before_full = jsonData["Before_data"];
         after_full = jsonData["After_data"];
         complete_after_data = jsonData["Complete_after_data"];
         complete_before_data = jsonData["Complete_before_data"];
         currentRule = jsonData["CURRENT_RULE"];
         skipRules = jsonData["SKIP_RULES"] || [];
      });
  };

  // Display uploaded JSON in viewer
  window.displayUploadedJSON = function(jsonData, filename) {
    console.log("displayUploadedJSON called with filename:", filename);
    const shellsTab = document.getElementById('shells');
    console.log("shellsTab element:", shellsTab);
    if (!shellsTab) {
      console.error("shellsTab element not found!");
      return;
    }
    
    // Format file size
    const fileSize = JSON.stringify(jsonData).length;
    const fileSizeFormatted = fileSize > 1024 ? (fileSize / 1024).toFixed(2) + ' KB' : fileSize + ' bytes';
    
    // Count all Phase 1 rule types
    const emptyArrayCount = countEmptyArrays(jsonData);
    const emptyStringCount = countEmptyStrings(jsonData);
    const nullValueCount = countNullValues(jsonData);
    const emptyObjectCount = countEmptyObjects(jsonData);
    const totalIssues = emptyArrayCount + emptyStringCount + nullValueCount + emptyObjectCount;
    
    shellsTab.innerHTML = `
      <div class="card bg-dark text-light mb-3">
        <div class="card-header bg-primary">
          <h5 class="mb-0">
            <i class="bi bi-file-earmark-json me-2"></i>Uploaded JSON: ${escapeHTML(filename)}
          </h5>
        </div>
        <div class="card-body">
          <div class="alert alert-info mb-3">
            <div class="row mb-2">
              <div class="col-md-3">
                <strong><i class="bi bi-info-circle me-2"></i>File Size:</strong> ${fileSizeFormatted}
              </div>
              <div class="col-md-3">
                <strong><i class="bi bi-list-ul me-2"></i>Empty Arrays:</strong> <span class="badge bg-warning">${emptyArrayCount}</span>
              </div>
              <div class="col-md-3">
                <strong><i class="bi bi-quote me-2"></i>Empty Strings:</strong> <span class="badge bg-warning">${emptyStringCount}</span>
              </div>
              <div class="col-md-3">
                <strong><i class="bi bi-check-circle me-2"></i>Status:</strong> <span class="badge bg-success">Ready to Clean</span>
              </div>
            </div>
            <div class="row">
              <div class="col-md-3">
                <strong><i class="bi bi-x-circle me-2"></i>Null Values:</strong> <span class="badge bg-warning">${nullValueCount}</span>
              </div>
              <div class="col-md-3">
                <strong><i class="bi bi-braces me-2"></i>Empty Objects:</strong> <span class="badge bg-warning">${emptyObjectCount}</span>
              </div>
              <div class="col-md-3">
                <strong><i class="bi bi-exclamation-triangle me-2"></i>Total Issues:</strong> <span class="badge bg-danger">${totalIssues}</span>
              </div>
            </div>
          </div>
          <div class="mb-3">
            <h6 class="text-light mb-2">
              <i class="bi bi-code-square me-2"></i>JSON Viewer
            </h6>
            <pre class="bg-secondary p-3 rounded" style="max-height: 600px; overflow: auto; color: #e9ecef; font-size: 0.9em;"><code id="jsonViewer">${escapeHTML(JSON.stringify(jsonData, null, 2))}</code></pre>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-success" onclick="quickClean()">
              <i class="bi bi-magic me-2"></i>Clean JSON
            </button>
            <button class="btn btn-outline-info" onclick="copyJSONToClipboard(originalJson)">
              <i class="bi bi-clipboard me-2"></i>Copy JSON
            </button>
            <button class="btn btn-outline-secondary" onclick="downloadJSON(originalJson, originalFilename)">
              <i class="bi bi-download me-2"></i>Download Original
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Switch to Quick Clean tab
    const shellsTabButton = document.getElementById('shells-tab');
    console.log("shellsTabButton:", shellsTabButton);
    if (shellsTabButton) {
      // Use Bootstrap's tab API to switch tabs
      const tab = new bootstrap.Tab(shellsTabButton);
      tab.show();
      console.log("Tab switched to Quick Clean");
    } else {
      console.error("shellsTabButton not found!");
    }
  };

  // Count empty arrays in JSON
  function countEmptyArrays(obj) {
    let count = 0;
    if (Array.isArray(obj)) {
      if (obj.length === 0) count++;
      obj.forEach(item => {
        count += countEmptyArrays(item);
      });
    } else if (obj !== null && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          count += countEmptyArrays(obj[key]);
        }
      }
    }
    return count;
  }

  // Remove empty strings from JSON (Rule 2)
  function removeEmptyStringsFromObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => removeEmptyStringsFromObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const cleaned = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Remove empty strings (including whitespace-only strings)
          if (typeof value === 'string' && value.trim() === '') {
            continue; // Skip this key
          }
          
          // Recursively clean nested objects/arrays
          cleaned[key] = removeEmptyStringsFromObject(value);
        }
      }
      
      return cleaned;
    }
    
    return obj;
  }

  // Count empty strings in JSON
  function countEmptyStrings(obj) {
    let count = 0;
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        count += countEmptyStrings(item);
      });
    } else if (obj !== null && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (typeof value === 'string' && value.trim() === '') {
            count++;
          } else {
            count += countEmptyStrings(value);
          }
        }
      }
    }
    return count;
  }

  // Remove null values from JSON (Rule 3)
  function removeNullValuesFromObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => removeNullValuesFromObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const cleaned = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Remove null values
          if (value === null) {
            continue; // Skip this key
          }
          
          // Recursively clean nested objects/arrays
          cleaned[key] = removeNullValuesFromObject(value);
        }
      }
      
      return cleaned;
    }
    
    return obj;
  }

  // Count null values in JSON
  function countNullValues(obj) {
    let count = 0;
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        count += countNullValues(item);
      });
    } else if (obj !== null && typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (value === null) {
            count++;
          } else {
            count += countNullValues(value);
          }
        }
      }
    }
    return count;
  }

  // Remove empty objects from JSON (Rule 4)
  function removeEmptyObjectsFromObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => removeEmptyObjectsFromObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const cleaned = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Remove empty objects
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const cleanedValue = removeEmptyObjectsFromObject(value);
            // Only add if the cleaned object is not empty
            if (Object.keys(cleanedValue).length > 0) {
              cleaned[key] = cleanedValue;
            }
            // If empty, skip it (don't add to cleaned)
          } else {
            // Recursively clean nested objects/arrays
            cleaned[key] = removeEmptyObjectsFromObject(value);
          }
        }
      }
      
      return cleaned;
    }
    
    return obj;
  }

  // Count empty objects in JSON
  function countEmptyObjects(obj) {
    let count = 0;
    if (Array.isArray(obj)) {
      obj.forEach(item => {
        count += countEmptyObjects(item);
      });
    } else if (obj !== null && typeof obj === 'object') {
      // Check if this object is empty
      if (Object.keys(obj).length === 0) {
        count++;
      }
      // Recursively count in nested objects
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          count += countEmptyObjects(obj[key]);
        }
      }
    }
    return count;
  }

  // Copy JSON to clipboard
  window.copyJSONToClipboard = function(jsonData) {
    const jsonString = JSON.stringify(jsonData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      alert("JSON copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    });
  };

  // Download JSON file
  window.downloadJSON = function(jsonData, filename) {
    const dataStr = JSON.stringify(jsonData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Stepwise processing state
  let currentProcessingState = {
    currentData: null,
    enabledRules: [],
    currentRuleIndex: 0,
    skipRules: []
  };

  // Find first occurrence of a specific rule type and return before/after fragments
  function findNextRuleChange(data, ruleType, skipPaths = []) {
    const beforeFragment = {};
    const afterFragment = {};
    let foundPath = null;
    let foundValue = null;
    
    function searchForRule(obj, parent = null, parentKey = null, path = '') {
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          searchForRule(item, obj, index, path ? `${path}[${index}]` : `[${index}]`);
        });
      } else if (obj !== null && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const currentPath = path ? `${path}.${key}` : key;
            const value = obj[key];
            let shouldRemove = false;
            
            // Check if this matches the rule type and hasn't been skipped
            if (skipPaths.indexOf(currentPath) === -1) {
              if (ruleType === 'empty_array' && Array.isArray(value) && value.length === 0) {
                shouldRemove = true;
              } else if (ruleType === 'empty_string' && typeof value === 'string' && value.trim() === '') {
                shouldRemove = true;
              } else if (ruleType === 'null_value' && value === null) {
                shouldRemove = true;
              } else if (ruleType === 'empty_object' && typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
                shouldRemove = true;
              }
              
              if (shouldRemove) {
                foundPath = currentPath;
                foundValue = value;
                // Build fragment showing this specific change
                const keys = currentPath.split('.');
                let current = beforeFragment;
                for (let i = 0; i < keys.length - 1; i++) {
                  if (!current[keys[i]]) current[keys[i]] = {};
                  current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
                return true; // Found!
              }
            }
            
            // Recursively search nested objects
            if (typeof value === 'object' && value !== null) {
              if (searchForRule(value, obj, key, currentPath)) {
                return true; // Found in nested structure
              }
            }
          }
        }
      }
      return false;
    }
    
    searchForRule(data);
    
    return {
      found: foundPath !== null,
      path: foundPath,
      beforeFragment: beforeFragment,
      afterFragment: {} // After is empty since we're removing
    };
  }

  // Apply a single rule change to the data
  function applyRuleChange(data, ruleType, path) {
    const keys = path.split('.');
    let current = data;
    
    // Navigate to the parent of the target
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i].includes('[')) {
        // Handle array indices
        const [arrayKey, index] = keys[i].split('[');
        const idx = parseInt(index.replace(']', ''));
        current = current[arrayKey][idx];
      } else {
        current = current[keys[i]];
      }
    }
    
    // Remove the target key
    const targetKey = keys[keys.length - 1];
    if (targetKey.includes('[')) {
      const [arrayKey, index] = targetKey.split('[');
      const idx = parseInt(index.replace(']', ''));
      current[arrayKey].splice(idx, 1);
    } else {
      delete current[targetKey];
    }
    
    return data;
  }

  // Process next step in stepwise cleaning
  function processNextStep() {
    const state = currentProcessingState;
    
    // Check if we've processed all rules
    if (state.currentRuleIndex >= state.enabledRules.length) {
      hideLoading();
      // All rules processed - show final result
      displayCleanedResult(state.currentData, {
        emptyLists: 0,
        emptyStrings: 0,
        nullValues: 0,
        emptyObjects: 0
      });
      updateChangesResultsTab(originalJson, state.currentData);
      
      const successToast = new bootstrap.Toast(document.getElementById('successToast'), {
        delay: 3000,
        autohide: true
      });
      successToast.show();
      return;
    }
    
    const currentRule = state.enabledRules[state.currentRuleIndex];
    const ruleType = currentRule.type;
    const ruleName = currentRule.name;
    
    // Find next change for this rule
    const change = findNextRuleChange(state.currentData, ruleType, state.skipRules);
    
    if (!change.found) {
      // No more changes for this rule, move to next rule
      state.currentRuleIndex++;
      processNextStep();
      return;
    }
    
    // Show the change in Rule Validation tab
    const beforeData = JSON.parse(JSON.stringify(state.currentData));
    const afterData = JSON.parse(JSON.stringify(state.currentData));
    applyRuleChange(afterData, ruleType, change.path);
    
    // Store current state for accept/reject
    window.currentStepState = {
      ruleType: ruleType,
      ruleName: ruleName,
      ruleIndex: state.currentRuleIndex,
      path: change.path,
      beforeData: beforeData,
      afterData: afterData,
      beforeFragment: change.beforeFragment,
      afterFragment: change.afterFragment
    };
    
    // Update Rule Validation tab
    updateRuleValidationTab(change.beforeFragment, change.afterFragment, {});
    
    // Switch to Rule Validation tab
    const validationTabButton = document.getElementById('validation-tab');
    if (validationTabButton) {
      const tab = new bootstrap.Tab(validationTabButton);
      tab.show();
    }
    
    hideLoading();
  }

  // Quick Clean function - starts stepwise processing
  window.quickClean = async function() {
    if (!window.originalJson) {
      alert("Please upload a JSON file first!");
      return;
    }
    
    // Get all checkbox states
    const removeEmptyLists = document.getElementById('removeEmptyListsCheck').checked;
    const removeEmptyStrings = document.getElementById('removeEmptyStringsCheck').checked;
    const removeNullValues = document.getElementById('removeNullValuesCheck').checked;
    const removeEmptyObjects = document.getElementById('removeEmptyObjectsCheck').checked;
    
    // Check if at least one rule is enabled
    if (!removeEmptyLists && !removeEmptyStrings && !removeNullValues && !removeEmptyObjects) {
      alert("Please enable at least one cleaning option!");
      return;
    }
    
    // Build enabled rules list
    const enabledRules = [];
    if (removeEmptyLists) enabledRules.push({ type: 'empty_array', name: 'Remove empty lists', id: 1 });
    if (removeEmptyStrings) enabledRules.push({ type: 'empty_string', name: 'Remove empty strings', id: 2 });
    if (removeNullValues) enabledRules.push({ type: 'null_value', name: 'Remove null values', id: 3 });
    if (removeEmptyObjects) enabledRules.push({ type: 'empty_object', name: 'Remove empty objects', id: 4 });
    
    // Initialize processing state
    currentProcessingState = {
      currentData: JSON.parse(JSON.stringify(window.originalJson)),
      enabledRules: enabledRules,
      currentRuleIndex: 0,
      skipRules: []
    };
    
    showLoading("Finding first change...");
    
    // Start stepwise processing
    setTimeout(() => {
      processNextStep();
    }, 100);
  };

  // Update Rule Validation tab with before/after comparison
  function updateRuleValidationTab(originalData, cleanedData, stats, targetElement) {
    // Use provided target element or default to validation tab
    const validationTabContent = targetElement || document.getElementById('validation') || document.querySelector('.code-wrapper');
    if (!validationTabContent) {
      console.error("Validation tab not found");
      return;
    }
    
    try {
      // For Rule Validation, show the full before/after comparison
      // The createCodeCard will handle displaying it properly
      const codeCard = createCodeCard(
        originalData,  // Before: original data
        cleanedData,    // After: cleaned data
        originalData,  // Full before
        cleanedData    // Full after
      );
      
      validationTabContent.innerHTML = '';
      validationTabContent.appendChild(codeCard);
      
      // Update status counters
      approvedCount = 1;
      pendingCount = 0;
      rejectedCount = 0;
      
      const pendingEl = document.getElementById('pendingCount');
      const approvedEl = document.getElementById('approvedCount');
      const rejectedEl = document.getElementById('rejectedCount');
      
      if (pendingEl) pendingEl.textContent = '0';
      if (approvedEl) approvedEl.textContent = '1';
      if (rejectedEl) rejectedEl.textContent = '0';
    } catch (error) {
      console.error("Error updating Rule Validation tab:", error);
      if (validationTabContent) {
        validationTabContent.innerHTML = `
          <div class="alert alert-warning">
            <h5>Error displaying validation</h5>
            <p>${error.message}</p>
          </div>
        `;
      }
    }
  }

  // Update Changes & Results tab with three-pane view
  function updateChangesResultsTab(originalData, cleanedData) {
    const changesResultsTab = document.querySelector('.changes-results-wrapper');
    if (!changesResultsTab) {
      console.error("Changes & Results tab not found");
      return;
    }
    
    try {
      // Get current state (with accepted changes applied)
      const currentState = computeCurrentStateFromAcceptedChanges() || window.originalJson;
      const finalCleaned = cleanedData || window.lastCleanedJson || currentState;
      const original = originalData || window.originalJson;
      
      if (!original) return;
      
      // Update the three-pane view if it exists
      const currentStateContent = document.getElementById('currentStateContent');
      if (currentStateContent) {
        currentStateContent.innerHTML = `<pre class="m-0"><code>${escapeHTML(JSON.stringify(currentState, null, 2))}</code></pre>`;
      }
      
      // Update history display
      if (typeof updateChangesHistoryDisplay === 'function') {
        updateChangesHistoryDisplay();
      }
      
      // If the Changes & Results card doesn't exist yet, create it
      if (!changesResultsTab.querySelector('.code-card')) {
        const changesCard = createChangesResultsCard(finalCleaned, original, []);
        changesResultsTab.innerHTML = '';
        changesResultsTab.appendChild(changesCard);
      }
    } catch (error) {
      console.error("Error updating Changes & Results tab:", error);
      if (changesResultsTab) {
        changesResultsTab.innerHTML = `
          <div class="alert alert-warning">
            <h5>Error displaying changes</h5>
            <p>${error.message}</p>
          </div>
        `;
      }
    }
  }
  
  // Make it globally accessible
  window.updateChangesResultsTab = updateChangesResultsTab;

  // Helper function to get changed parts (shows all removed items from Phase 1 rules)
  function getChangedParts(before, after) {
    // Simple comparison: if they're the same, return full objects
    if (JSON.stringify(before) === JSON.stringify(after)) {
      return {
        before: before,
        after: after
      };
    }
    
    // Find keys that were removed (empty arrays, empty strings, null values, empty objects)
    const removedKeys = [];
    
    function findRemovedKeys(beforeObj, afterObj, parentObj = null, parentKey = null) {
      if (typeof beforeObj !== 'object' || beforeObj === null) return;
      if (typeof afterObj !== 'object' || afterObj === null) {
        // afterObj is null/undefined, but beforeObj exists - this shouldn't happen in our case
        return;
      }
      
      // Check all keys in beforeObj
      for (const key in beforeObj) {
        const beforeValue = beforeObj[key];
        const afterValue = afterObj[key];
        
        // Check if this key was removed entirely
        if (!(key in afterObj)) {
          removedKeys.push({
            key: key,
            value: beforeValue,
            parent: parentObj,
            parentKey: parentKey
          });
        } else if (typeof beforeValue === 'object' && beforeValue !== null && !Array.isArray(beforeValue)) {
          // Recursively check nested objects
          findRemovedKeys(beforeValue, afterValue, beforeObj, key);
        }
      }
    }
    
    findRemovedKeys(before, after);
    
    // Build a fragment showing only the removed parts
    function buildFragment(removedItems) {
      const fragment = {};
      
      removedItems.forEach(item => {
        if (item.parentKey === null) {
          // Top-level key
          fragment[item.key] = item.value;
        } else {
          // Nested key - need to build the path
          if (!fragment[item.parentKey]) {
            fragment[item.parentKey] = {};
          }
          fragment[item.parentKey][item.key] = item.value;
        }
      });
      
      return fragment;
    }
    
    const beforeFragment = buildFragment(removedKeys);
    
    // If we have removed items, show them; otherwise show full comparison
    if (removedKeys.length > 0 && Object.keys(beforeFragment).length > 0) {
      return {
        before: beforeFragment,
        after: {} // After shows empty since items were removed
      };
    }
    
    // No specific changes detected, show full comparison
    return {
      before: before,
      after: after
    };
  }

  // Helper function to remove empty lists recursively - removes ALL empty arrays
  function removeEmptyListsFromObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => removeEmptyListsFromObject(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const cleaned = {};
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Remove ALL empty arrays regardless of field name
          if (Array.isArray(value) && value.length === 0) {
            // Skip this key (don't add it to cleaned object)
            continue;
          }
          
          // Recursively clean nested objects/arrays
          cleaned[key] = removeEmptyListsFromObject(value);
        }
      }
      
      return cleaned;
    }
    
    return obj;
  }

  // Display cleaned result
  function displayCleanedResult(cleanedData, stats = {}) {
    // Switch to Quick Clean tab and display result
    const shellsTab = document.getElementById('shells');
    if (shellsTab) {
      // Calculate stats
      const originalSize = JSON.stringify(window.originalJson).length;
      const cleanedSize = JSON.stringify(cleanedData).length;
      const reduction = ((1 - cleanedSize / originalSize) * 100).toFixed(1);
      
      // Build stats display
      const statsItems = [];
      if (stats.emptyLists > 0) {
        statsItems.push(`<div class="col-md-3"><strong><i class="bi bi-list-ul me-2"></i>Empty Arrays:</strong> ${stats.emptyLists}</div>`);
      }
      if (stats.emptyStrings > 0) {
        statsItems.push(`<div class="col-md-3"><strong><i class="bi bi-quote me-2"></i>Empty Strings:</strong> ${stats.emptyStrings}</div>`);
      }
      if (stats.nullValues > 0) {
        statsItems.push(`<div class="col-md-3"><strong><i class="bi bi-x-circle me-2"></i>Null Values:</strong> ${stats.nullValues}</div>`);
      }
      if (stats.emptyObjects > 0) {
        statsItems.push(`<div class="col-md-3"><strong><i class="bi bi-braces me-2"></i>Empty Objects:</strong> ${stats.emptyObjects}</div>`);
      }
      
      const totalRemoved = (stats.emptyLists || 0) + (stats.emptyStrings || 0) + (stats.nullValues || 0) + (stats.emptyObjects || 0);
      
      // Show in the shells tab
      shellsTab.innerHTML = `
        <div class="card bg-dark text-light mb-3">
          <div class="card-header bg-success">
            <h5 class="mb-0">
              <i class="bi bi-check-circle me-2"></i>Cleaned JSON Result
            </h5>
          </div>
          <div class="card-body">
            <div class="alert alert-success mb-3">
              <div class="row mb-2">
                ${statsItems.join('')}
              </div>
              <div class="row">
                <div class="col-md-4">
                  <strong><i class="bi bi-trash me-2"></i>Total Removed:</strong> ${totalRemoved} items
                </div>
                <div class="col-md-4">
                  <strong><i class="bi bi-file-earmark me-2"></i>Size Reduction:</strong> ${reduction}%
                </div>
                <div class="col-md-4">
                  <strong><i class="bi bi-check-circle me-2"></i>Status:</strong> <span class="badge bg-success">Cleaned</span>
                </div>
              </div>
            </div>
            <pre class="bg-secondary p-3 rounded" style="max-height: 600px; overflow: auto; color: #e9ecef; font-size: 0.9em;"><code>${escapeHTML(JSON.stringify(cleanedData, null, 2))}</code></pre>
            <div class="mt-3 d-flex gap-2 flex-wrap">
              <button class="btn btn-success" onclick="downloadCleanedJSON()">
                <i class="bi bi-download me-2"></i>Download Cleaned JSON
              </button>
              <button class="btn btn-outline-info" onclick="copyToClipboard()">
                <i class="bi bi-clipboard me-2"></i>Copy to Clipboard
              </button>
              <button class="btn btn-outline-primary" onclick="switchToValidationTab()">
                <i class="bi bi-shield-check me-2"></i>View Rule Validation
              </button>
              <button class="btn btn-outline-secondary" onclick="switchToChangesTab()">
                <i class="bi bi-file-diff me-2"></i>View Changes & Results
              </button>
            </div>
          </div>
        </div>
      `;
      
      // Switch to Quick Clean tab
      const shellsTabButton = document.getElementById('shells-tab');
      if (shellsTabButton) {
        const tab = new bootstrap.Tab(shellsTabButton);
        tab.show();
      }
    }
  }

  // Helper functions to switch tabs
  window.switchToValidationTab = function() {
    const validationTabButton = document.getElementById('validation-tab');
    if (validationTabButton) {
      const tab = new bootstrap.Tab(validationTabButton);
      tab.show();
    }
  };

  window.switchToChangesTab = function() {
    const changesTabButton = document.getElementById('changes-results-tab');
    if (changesTabButton) {
      const tab = new bootstrap.Tab(changesTabButton);
      tab.show();
    }
  };

  // Copy cleaned JSON to clipboard
  window.copyToClipboard = function() {
    if (!window.lastCleanedJson) {
      alert("No cleaned JSON available.");
      return;
    }
    
    const jsonString = JSON.stringify(window.lastCleanedJson, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      alert("JSON copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    });
  };

});



