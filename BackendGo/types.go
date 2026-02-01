package main

import "encoding/json"

// StepwiseResult represents the result of stepwise processing
type StepwiseResult struct {
	BeforeFragment  json.RawMessage `json:"before_fragment"`
	AfterFragment   json.RawMessage `json:"after_fragment"`
	RuleID          *int            `json:"rule_id"`
	CompleteAfter   json.RawMessage `json:"complete_after"`
	CompleteBefore  json.RawMessage `json:"complete_before"`
}

// IssueCounts tracks the number of issues found
type IssueCounts struct {
	EmptyLists   int `json:"empty_lists"`
	EmptyStrings int `json:"empty_strings"`
	NullValues   int `json:"null_values"`
	EmptyObjects int `json:"empty_objects"`
	Duplicates   int `json:"duplicates"`
	TotalIssues  int `json:"total_issues"`
}

// IndividualChange represents a single change that can be applied
type IndividualChange struct {
	Path        string          `json:"path"`
	FieldName   string          `json:"fieldName"`
	BeforeValue json.RawMessage `json:"beforeValue"`
	AfterValue  json.RawMessage `json:"afterValue"`
	RuleID      int             `json:"ruleId"`
	ParentBefore json.RawMessage `json:"parentBefore"`
	ParentAfter  json.RawMessage `json:"parentAfter"`
}

// NodeContext holds context for tree traversal
type NodeContext struct {
	Parent    interface{} // map[string]interface{} or []interface{}
	ParentKey string
	Current   interface{} // map[string]interface{} or []interface{}
}

// RuleProcessor holds the state for rule processing
type RuleProcessor struct {
	BooleanConversionMode string // "boolean" or "numeric"
}

