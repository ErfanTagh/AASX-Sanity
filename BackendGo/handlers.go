package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"
)

// Handlers holds the rule processor and processing state
type Handlers struct {
	processor      *RuleProcessor
	processingState *ProcessingState
}

// Global processing state
var globalProcessingState = &ProcessingState{
	AllChanges:  []PrecomputedChange{},
	IsComputing: false,
}

// NewHandlers creates a new handlers instance
func NewHandlers() *Handlers {
	return &Handlers{
		processor: &RuleProcessor{
			BooleanConversionMode: "boolean",
		},
		processingState: globalProcessingState,
	}
}

// CleanSpecificRule handles /clean-specific-rule endpoint
func (h *Handlers) CleanSpecificRule(w http.ResponseWriter, r *http.Request) {
	var request struct {
		JSONData interface{} `json:"json_data"`
		RuleID   int         `json:"rule_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid request: %v"}`, err), http.StatusBadRequest)
		return
	}

	if request.JSONData == nil {
		http.Error(w, `{"error": "No JSON data provided"}`, http.StatusBadRequest)
		return
	}

	if request.RuleID < 1 || request.RuleID > 7 {
		http.Error(w, `{"error": "Invalid rule_id. Must be 1, 2, 3, 4, 5, 6, or 7"}`, http.StatusBadRequest)
		return
	}

	cleanedData := h.processor.cleanSpecificRule(request.JSONData, request.RuleID)
	issues := h.processor.scanForIssues(cleanedData)

	response := map[string]interface{}{
		"success":     true,
		"cleaned_json": cleanedData,
		"issues": map[string]interface{}{
			"empty_lists":   issues.EmptyLists,
			"empty_strings": issues.EmptyStrings,
			"null_values":   issues.NullValues,
			"empty_objects": issues.EmptyObjects,
			"duplicates":    issues.Duplicates,
			"total_issues":  issues.TotalIssues,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// ScanIssues handles /scan-issues endpoint
func (h *Handlers) ScanIssues(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(50 << 20); err != nil { // 50MB
		http.Error(w, fmt.Sprintf(`{"error": "Failed to parse form: %v"}`, err), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error": "No file provided"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size == 0 {
		http.Error(w, `{"error": "No file provided"}`, http.StatusBadRequest)
		return
	}

	var data interface{}
	if err := json.NewDecoder(file).Decode(&data); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid JSON: %v"}`, err), http.StatusBadRequest)
		return
	}

	issues := h.processor.scanForIssues(data)

	response := map[string]interface{}{
		"success":    true,
		"has_issues": issues.TotalIssues > 0,
		"issues": map[string]interface{}{
			"empty_lists":   issues.EmptyLists,
			"empty_strings": issues.EmptyStrings,
			"null_values":   issues.NullValues,
			"empty_objects": issues.EmptyObjects,
			"duplicates":    issues.Duplicates,
			"total_issues":  issues.TotalIssues,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// Upload handles /upload endpoint
func (h *Handlers) Upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(50 << 20); err != nil { // 50MB
		http.Error(w, fmt.Sprintf(`{"error": "Failed to parse form: %v"}`, err), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, `{"error": "No file provided"}`, http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size == 0 {
		http.Error(w, `{"error": "No file provided"}`, http.StatusBadRequest)
		return
	}

	var originalData interface{}
	if err := json.NewDecoder(file).Decode(&originalData); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid JSON: %v"}`, err), http.StatusBadRequest)
		return
	}

	// Get boolean conversion mode from form
	booleanMode := r.FormValue("boolean_conversion_mode")
	if booleanMode == "" {
		booleanMode = "boolean"
	}
	h.processor.BooleanConversionMode = booleanMode

	// Do full clean using parallel processing
	cleanedData := h.processor.cleanAllParallel(originalData)

	// Start background precomputation in a goroutine (non-blocking)
	go h.processor.precomputeAllChanges(originalData, h.processingState)

	// Also get first stepwise change for display purposes
	skipRules := make(map[int]bool)
	result := h.processor.processStepwise(originalData, skipRules)

	response := map[string]interface{}{
		"JSON": cleanedData,
		"KEYS": []interface{}{},
	}

	if result.RuleID != nil {
		var beforeFragment, afterFragment interface{}
		json.Unmarshal(result.BeforeFragment, &beforeFragment)
		json.Unmarshal(result.AfterFragment, &afterFragment)

		var completeAfter, completeBefore interface{}
		json.Unmarshal(result.CompleteAfter, &completeAfter)
		json.Unmarshal(result.CompleteBefore, &completeBefore)

		diff := extractChangedParts(beforeFragment, afterFragment)

		response["Before_data"] = beforeFragment
		response["After_data"] = afterFragment
		response["Complete_after_data"] = completeAfter
		response["Complete_before_data"] = completeBefore
		response["CURRENT_RULE"] = *result.RuleID
		response["BEFORE"] = diff.BeforeTree
		response["AFTER"] = diff.AfterTree
	} else {
		response["Before_data"] = nil
		response["After_data"] = nil
		response["Complete_after_data"] = nil
		response["Complete_before_data"] = nil
		response["CURRENT_RULE"] = nil
		response["BEFORE"] = nil
		response["AFTER"] = nil
	}

	skipRulesList := []int{}
	response["SKIP_RULES"] = skipRulesList

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetNextChange handles /get-next-change endpoint
func (h *Handlers) GetNextChange(w http.ResponseWriter, r *http.Request) {
	var request struct {
		CurrentData interface{} `json:"current_data"`
		SkipRules   []int        `json:"skip_rules"`
		BooleanConversionMode string `json:"boolean_conversion_mode"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid request: %v"}`, err), http.StatusBadRequest)
		return
	}

	// Set boolean conversion mode
	if request.BooleanConversionMode != "" {
		h.processor.BooleanConversionMode = request.BooleanConversionMode
	}

	skipRules := make(map[int]bool)
	for _, ruleID := range request.SkipRules {
		skipRules[ruleID] = true
	}

	result := h.processor.processStepwise(request.CurrentData, skipRules)

	if result.RuleID == nil {
		response := map[string]interface{}{
			"BEFORE":       nil,
			"AFTER":        nil,
			"CURRENT_RULE": nil,
			"MORE_CHANGES": false,
			"MESSAGE":      "No more changes found. Processing complete.",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	var beforeFragment, afterFragment interface{}
	json.Unmarshal(result.BeforeFragment, &beforeFragment)
	json.Unmarshal(result.AfterFragment, &afterFragment)

	var completeAfter, completeBefore interface{}
	json.Unmarshal(result.CompleteAfter, &completeAfter)
	json.Unmarshal(result.CompleteBefore, &completeBefore)

	diff := extractChangedParts(beforeFragment, afterFragment)

	response := map[string]interface{}{
		"BEFORE":            diff.BeforeTree,
		"AFTER":             diff.AfterTree,
		"CURRENT_RULE":      *result.RuleID,
		"Complete_after_data": completeAfter,
		"Complete_before_data": completeBefore,
		"MORE_CHANGES":      true,
		"MESSAGE":           fmt.Sprintf("Rule %d applied. Review the changes below.", *result.RuleID),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// GetAllChangesForRule handles /get-all-changes-for-rule endpoint
func (h *Handlers) GetAllChangesForRule(w http.ResponseWriter, r *http.Request) {
	var request struct {
		CurrentData interface{} `json:"current_data"`
		RuleID      int         `json:"rule_id"`
		SkipRules   []int       `json:"skip_rules"`
		BooleanConversionMode string `json:"boolean_conversion_mode"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid request: %v"}`, err), http.StatusBadRequest)
		return
	}

	// Set boolean conversion mode
	if request.BooleanConversionMode != "" {
		h.processor.BooleanConversionMode = request.BooleanConversionMode
	}

	if request.RuleID < 1 || request.RuleID > 7 {
		http.Error(w, `{"error": "Invalid rule_id. Must be 1, 2, 3, 4, 5, 6, or 7"}`, http.StatusBadRequest)
		return
	}

	skipRules := make(map[int]bool)
	for _, ruleID := range request.SkipRules {
		skipRules[ruleID] = true
	}

	changes := h.processor.getAllChangesForRule(request.CurrentData, request.RuleID, skipRules)

	// Convert changes to JSON-serializable format
	changesList := []map[string]interface{}{}
	for _, change := range changes {
		changeMap := map[string]interface{}{
			"path":        change.Path,
			"fieldName":   change.FieldName,
			"beforeValue": json.RawMessage(change.BeforeValue),
			"afterValue":  json.RawMessage(change.AfterValue),
			"ruleId":      change.RuleID,
		}

		// For Rule 5 (duplicates), send full arrays for better context
		// For other rules, send diff
		if request.RuleID == 5 {
			changeMap["parentBefore"] = json.RawMessage(change.ParentBefore)
			changeMap["parentAfter"] = json.RawMessage(change.ParentAfter)
		} else {
			// Extract diff for parent objects
			var parentBefore, parentAfter interface{}
			json.Unmarshal(change.ParentBefore, &parentBefore)
			json.Unmarshal(change.ParentAfter, &parentAfter)

			diff := extractChangedParts(parentBefore, parentAfter)
			changeMap["parentBefore"] = diff.BeforeTree
			changeMap["parentAfter"] = diff.AfterTree
		}

		changesList = append(changesList, changeMap)
	}

	response := map[string]interface{}{
		"ruleId":  request.RuleID,
		"changes": changesList,
		"count":   len(changesList),
		"MESSAGE": fmt.Sprintf("Found %d changes for Rule %d", len(changesList), request.RuleID),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// AcceptChanges handles /accept-changes endpoint
func (h *Handlers) AcceptChanges(w http.ResponseWriter, r *http.Request) {
	var request struct {
		CompleteAfterData interface{} `json:"complete_after_data"`
		CurrentRule       *int         `json:"current_rule"`
		SkipRules         []int        `json:"skip_rules"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid request: %v"}`, err), http.StatusBadRequest)
		return
	}

	skipRules := make(map[int]bool)
	for _, ruleID := range request.SkipRules {
		skipRules[ruleID] = true
	}

	if request.CurrentRule != nil {
		skipRules[*request.CurrentRule] = true
	}

	// Find next change
	result := h.processor.processStepwise(request.CompleteAfterData, skipRules)

	if result.RuleID == nil {
		skipRulesList := []int{}
		for ruleID := range skipRules {
			skipRulesList = append(skipRulesList, ruleID)
		}

		response := map[string]interface{}{
			"status":      "accepted",
			"message":     "All changes processed",
			"BEFORE":      nil,
			"AFTER":       nil,
			"CURRENT_RULE": nil,
			"MORE_CHANGES": false,
			"SKIP_RULES":  skipRulesList,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	var beforeFragment, afterFragment interface{}
	json.Unmarshal(result.BeforeFragment, &beforeFragment)
	json.Unmarshal(result.AfterFragment, &afterFragment)

	var completeAfter, completeBefore interface{}
	json.Unmarshal(result.CompleteAfter, &completeAfter)
	json.Unmarshal(result.CompleteBefore, &completeBefore)

	diff := extractChangedParts(beforeFragment, afterFragment)

	skipRulesList := []int{}
	for ruleID := range skipRules {
		skipRulesList = append(skipRulesList, ruleID)
	}

	response := map[string]interface{}{
		"status":            "accepted",
		"message":           "Changes accepted",
		"BEFORE":            diff.BeforeTree,
		"AFTER":             diff.AfterTree,
		"CURRENT_RULE":      *result.RuleID,
		"Complete_after_data": completeAfter,
		"Complete_before_data": completeBefore,
		"Before_data":       beforeFragment,
		"After_data":        afterFragment,
		"MORE_CHANGES":      true,
		"SKIP_RULES":        skipRulesList,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// RejectChanges handles /reject-changes endpoint
func (h *Handlers) RejectChanges(w http.ResponseWriter, r *http.Request) {
	var request struct {
		CurrentData interface{} `json:"current_data"`
		CurrentRule *int         `json:"current_rule"`
		SkipRules   []int        `json:"skip_rules"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, fmt.Sprintf(`{"error": "Invalid request: %v"}`, err), http.StatusBadRequest)
		return
	}

	skipRules := make(map[int]bool)
	for _, ruleID := range request.SkipRules {
		skipRules[ruleID] = true
	}

	if request.CurrentRule != nil {
		skipRules[*request.CurrentRule] = true
	}

	// Find next change
	result := h.processor.processStepwise(request.CurrentData, skipRules)

	if result.RuleID == nil {
		skipRulesList := []int{}
		for ruleID := range skipRules {
			skipRulesList = append(skipRulesList, ruleID)
		}

		response := map[string]interface{}{
			"status":      "rejected",
			"message":     "Changes rejected, no more changes found",
			"BEFORE":      nil,
			"AFTER":       nil,
			"CURRENT_RULE": nil,
			"MORE_CHANGES": false,
			"SKIP_RULES":  skipRulesList,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
		return
	}

	var beforeFragment, afterFragment interface{}
	json.Unmarshal(result.BeforeFragment, &beforeFragment)
	json.Unmarshal(result.AfterFragment, &afterFragment)

	var completeAfter, completeBefore interface{}
	json.Unmarshal(result.CompleteAfter, &completeAfter)
	json.Unmarshal(result.CompleteBefore, &completeBefore)

	diff := extractChangedParts(beforeFragment, afterFragment)

	skipRulesList := []int{}
	for ruleID := range skipRules {
		skipRulesList = append(skipRulesList, ruleID)
	}

	response := map[string]interface{}{
		"status":            "rejected",
		"message":           "Changes rejected, trying next available rule",
		"BEFORE":            diff.BeforeTree,
		"AFTER":             diff.AfterTree,
		"CURRENT_RULE":      *result.RuleID,
		"Complete_after_data": completeAfter,
		"Complete_before_data": completeBefore,
		"MORE_CHANGES":      true,
		"SKIP_RULES":        skipRulesList,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HealthCheck handles health check endpoint
func (h *Handlers) HealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// GetPrecomputedChanges handles /get-precomputed-changes endpoint
func (h *Handlers) GetPrecomputedChanges(w http.ResponseWriter, r *http.Request) {
	h.processingState.mu.RLock()
	defer h.processingState.mu.RUnlock()

	response := map[string]interface{}{
		"all_changes":  h.processingState.AllChanges,
		"is_computing": h.processingState.IsComputing,
		"count":        len(h.processingState.AllChanges),
	}

	if !h.processingState.StartTime.IsZero() {
		response["start_time"] = h.processingState.StartTime.Format(time.RFC3339)
		if !h.processingState.IsComputing {
			elapsed := time.Since(h.processingState.StartTime)
			response["elapsed_seconds"] = elapsed.Seconds()
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// CORS middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

