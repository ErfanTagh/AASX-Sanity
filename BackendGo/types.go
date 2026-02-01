package main

import (
	"encoding/json"
	"sync"
	"time"
)

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

// PrecomputedChange represents a precomputed change record
type PrecomputedChange struct {
	RuleNumber     int                    `json:"rule_number"`
	BeforeFragment interface{}            `json:"before_fragment"`
	AfterFragment  interface{}            `json:"after_fragment"`
	BeforeDiff     interface{}            `json:"before_diff"`
	AfterDiff      interface{}            `json:"after_diff"`
	CompleteBefore interface{}            `json:"complete_before"`
	CompleteAfter  interface{}            `json:"complete_after"`
}

// ProcessingState holds global state for precomputed changes
type ProcessingState struct {
	mu          sync.RWMutex
	AllChanges  []PrecomputedChange `json:"all_changes"`
	IsComputing bool                `json:"is_computing"`
	StartTime   time.Time           `json:"start_time"`
}

