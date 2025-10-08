# AAS Sanity Checker - Sequence Diagrams

## 1. File Upload and Initial Processing

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Flask API
    participant RuleProcessor as Rule Processor
    participant CleanJSON as Clean JSON Engine

    User->>Frontend: Upload JSON file
    Frontend->>API: POST /upload (file)
    API->>CleanJSON: clean_json_iterative(data)
    CleanJSON->>CleanJSON: Apply all 18 rules
    CleanJSON-->>API: Fully cleaned JSON
    API->>RuleProcessor: clean_json_stepwise(data, skip_rules=[])
    RuleProcessor->>RuleProcessor: Find first rule change
    RuleProcessor-->>API: (before, after, rule_num, complete_before, complete_after)
    API-->>Frontend: JSON response with:
    Note over API,Frontend: - Cleaned JSON (all rules)<br/>- First rule change (before/after)<br/>- Complete JSON states<br/>- Current rule number
    Frontend->>Frontend: Display in 3 tabs:
    Note over Frontend: Tab 1: Shell cards<br/>Tab 2: Rule validation<br/>Tab 3: Changes & Results
    Frontend->>User: Show first rule for review
```

## 2. Accept Changes Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Flask API
    participant SingleRule as Single Rule Engine
    participant RuleProcessor as Rule Processor

    User->>Frontend: Click "Accept Changes"
    Frontend->>Frontend: Show loading overlay
    Frontend->>API: POST /accept-changes
    Note over Frontend,API: Sends:<br/>- current_data<br/>- complete_after_data<br/>- current_rule<br/>- skip_rules
    API->>SingleRule: clean_json_single_rule(complete_after_data, current_rule)
    SingleRule->>SingleRule: Apply rule repeatedly until no changes
    SingleRule-->>API: (cleaned_data, changes_count)
    API->>API: Add rule to skip_rules
    API->>RuleProcessor: process_json_data_step_by_step(cleaned_data, skip_rules)
    RuleProcessor->>RuleProcessor: Find next rule (excluding skipped)
    RuleProcessor-->>API: Next rule change or "No more changes"
    API-->>Frontend: Response with:
    Note over API,Frontend: - BEFORE/AFTER fragments<br/>- Complete JSON states<br/>- Next rule number<br/>- Updated skip_rules<br/>- MORE_CHANGES flag
    Frontend->>Frontend: Add to change history
    Frontend->>Frontend: Update counters
    Frontend->>Frontend: Update Tab 3 displays
    Frontend->>Frontend: Hide loading overlay
    Frontend->>User: Show next rule or completion message
```

## 3. Reject Changes Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Flask API
    participant RuleProcessor as Rule Processor

    User->>Frontend: Click "Reject"
    Frontend->>Frontend: Show loading overlay
    Frontend->>API: POST /reject-changes
    Note over Frontend,API: Sends:<br/>- current_data<br/>- current_rule (to skip)<br/>- skip_rules
    API->>API: Add current_rule to skip_rules
    API->>RuleProcessor: process_json_data_step_by_step(current_data, skip_rules)
    RuleProcessor->>RuleProcessor: Find next rule (excluding rejected ones)
    RuleProcessor-->>API: Next rule change or "No more changes"
    API-->>Frontend: Response with next rule
    Frontend->>Frontend: Add to change history (rejected)
    Frontend->>Frontend: Update counters (rejected++)
    Frontend->>Frontend: Hide loading overlay
    Frontend->>User: Show next rule or completion message
```

## 4. Accept All & Download Flow

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant API as Flask API
    participant SingleRule as Single Rule Engine
    participant RuleProcessor as Rule Processor

    User->>Frontend: Click "Accept All & Download"
    Frontend->>User: Confirm dialog
    User->>Frontend: Confirm
    Frontend->>Frontend: Show loading: "Accepting all rules..."
    
    loop For each remaining rule
        Frontend->>API: POST /accept-changes
        API->>SingleRule: clean_json_single_rule(data, current_rule)
        SingleRule-->>API: Fully applied rule
        API->>RuleProcessor: Get next rule
        RuleProcessor-->>API: Next rule or complete
        API-->>Frontend: Updated state
        Frontend->>Frontend: Update loading: "Rule X accepted..."
        
        alt No more rules
            Frontend->>Frontend: Break loop
        end
    end
    
    Frontend->>Frontend: Show loading: "Preparing download..."
    Frontend->>Frontend: Create Blob from final JSON
    Frontend->>User: Trigger download
    Frontend->>Frontend: Update counters (all to approved)
    Frontend->>Frontend: Hide loading overlay
    Frontend->>User: Success message
```

## 5. View History & Download State

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant ChangeHistory as Change History
    participant Modal

    User->>Frontend: Navigate to Tab 3
    Frontend->>Frontend: Display history table
    User->>Frontend: Click "View" on history item
    Frontend->>ChangeHistory: Get history item by index
    ChangeHistory-->>Frontend: {rule, action, before, after, completeAfterJson}
    Frontend->>Modal: Create and show modal
    Modal->>User: Display before/after comparison
    
    alt User clicks Download
        User->>Modal: Click "Download State"
        Modal->>ChangeHistory: Get completeAfterJson
        ChangeHistory-->>Modal: Complete JSON for that state
        Modal->>Modal: Create Blob
        Modal->>User: Trigger download
    end
    
    User->>Modal: Close
    Modal->>Frontend: Destroy modal
```

## 6. Quick Filter Flow (Tab 3)

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant QuickFilter as Quick Filter
    participant SearchEngine as Search Engine

    User->>Frontend: Navigate to Tab 3
    Frontend->>Frontend: Show Quick Filter inputs
    User->>QuickFilter: Type in filter field (e.g., "idShort")
    QuickFilter->>QuickFilter: Debounce 300ms
    QuickFilter->>SearchEngine: searchInFinishedCode(finishedJson, filters)
    SearchEngine->>SearchEngine: Traverse JSON recursively
    SearchEngine->>SearchEngine: Match against all filters
    SearchEngine-->>QuickFilter: Array of matching items
    QuickFilter->>Frontend: updateFinishedCodeDisplay(filtered results)
    Frontend->>Frontend: Update filter count: "X / Total"
    Frontend->>User: Display filtered results in cards
    
    alt User clicks "Clear Quick Filter"
        User->>QuickFilter: Click clear
        QuickFilter->>QuickFilter: Clear all input fields
        QuickFilter->>Frontend: Show original full data
        Frontend->>User: Reset display
    end
```

## 7. Three-Pane Resizable View

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Pane1 as Original Upload
    participant Divider1 as Divider 1
    participant Pane2 as Current State
    participant Divider2 as Divider 2
    participant Pane3 as Final Result

    User->>Frontend: Navigate to Tab 3
    Frontend->>Pane1: Display original JSON
    Frontend->>Pane2: Display current state
    Frontend->>Pane3: Display final result (all rules)
    
    User->>Divider1: Mouse down on divider
    Divider1->>Frontend: Set activeDivider = 1
    Frontend->>Frontend: Add 'resizing' class to body
    
    loop While dragging
        User->>Frontend: Move mouse
        Frontend->>Frontend: Calculate new pane widths
        Frontend->>Pane1: Update flex: X%
        Frontend->>Pane2: Update flex: Y%
    end
    
    User->>Frontend: Mouse up
    Frontend->>Frontend: Remove 'resizing' class
    Frontend->>User: Panes resized
```

## 8. Complete User Journey

```mermaid
sequenceDiagram
    actor User
    participant System as AAS Sanity System
    
    Note over User,System: PHASE 1: Upload & Discovery
    User->>System: Upload AAS JSON file
    System->>System: Process with all 18 rules
    System->>System: Identify first rule change
    System-->>User: Show first rule for review
    
    Note over User,System: PHASE 2: Interactive Validation
    loop For each rule
        System->>User: Show before/after diff
        alt User accepts
            User->>System: Click "Accept"
            System->>System: Apply rule completely
            System->>System: Add to change history
            System->>System: Find next rule
        else User rejects
            User->>System: Click "Reject"
            System->>System: Skip this rule
            System->>System: Find next rule
        else User accepts all
            User->>System: Click "Accept All & Download"
            System->>System: Auto-accept all remaining rules
            System->>User: Download final JSON
            Note over User,System: SKIP TO PHASE 4
        end
    end
    
    Note over User,System: PHASE 3: Review Results
    User->>System: Navigate to Tab 3
    System-->>User: Show:
    Note over System,User: - Original vs Current vs Final<br/>- Complete validation history<br/>- Download options
    
    Note over User,System: PHASE 4: Download
    alt Download final result
        User->>System: Click "Download cleaned JSON"
        System-->>User: Fully processed JSON file
    else Download current state
        User->>System: Click "Download Current State"
        System-->>User: JSON at current validation point
    else Download historical state
        User->>System: Click download on history item
        System-->>User: JSON from that specific state
    end
```

## Data Flow Architecture

```mermaid
graph TB
    A[User Uploads JSON] --> B[Flask API /upload]
    B --> C[clean_json_iterative]
    C --> D[Apply All 18 Rules]
    D --> E[lastCleanedJson]
    B --> F[clean_json_stepwise]
    F --> G[Find First Rule Change]
    G --> H[Return to Frontend]
    
    H --> I{User Decision}
    I -->|Accept| J[POST /accept-changes]
    I -->|Reject| K[POST /reject-changes]
    I -->|Accept All| L[Loop: POST /accept-changes]
    
    J --> M[clean_json_single_rule]
    M --> N[Apply rule completely]
    N --> O[process_json_data_step_by_step]
    O --> P[Find next rule]
    P --> H
    
    K --> Q[Add to skip_rules]
    Q --> O
    
    L --> R[Accept all remaining]
    R --> S[Download final JSON]
    
    E --> T[Tab 3: Final Result Pane]
    H --> U[Tab 2: Rule Validation]
    H --> V[Tab 3: Current State Pane]
    A --> W[Tab 3: Original Upload Pane]
```


