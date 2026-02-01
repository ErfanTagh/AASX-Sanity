# Project Goal: Generalization of Rules

## Core Objective
Transform the **18 specific AAS (Asset Administration Shell) rules** into **general-purpose rules** that work for **any JSON file**, not just AAS-specific structures.

**Important**: The workflow and structure should remain **exactly the same** as the original - only the rules themselves are generalized. See `ORIGINAL_WORKFLOW_NOTES.md` for detailed workflow documentation.

## Current Status
- ✅ **4 General Rules Implemented:**
  1. Remove empty lists (empty arrays `[]`)
  2. Remove empty strings (empty or whitespace-only strings `""`)
  3. Remove null values (`null`)
  4. Remove empty objects (empty objects `{}`)

- ✅ These 4 rules work for **any JSON structure**, not just AAS files
- ✅ Workflow structure maintained (same as original)

## Future Direction
- Continue generalizing the remaining 18 specific rules
- Identify common patterns in the specific rules
- Create reusable, general-purpose cleaning rules
- Ensure all rules work for **any JSON file**, not just domain-specific structures
- **Maintain original workflow**: Same API, same frontend behavior, same user experience

## Key Principle
**Make JSON cleaning accessible to normal users with any JSON data, not just AAS experts.**

**Workflow Principle:**
- Keep the exact same workflow structure as the original
- Same three-tab interface
- Same accept/reject flow
- Same API endpoints and responses
- Only difference: generalized rules instead of AAS-specific ones

## Documentation
- `ORIGINAL_WORKFLOW_NOTES.md` - Detailed notes on original workflow structure
- `SEQUENCE_DIAGRAM.md` - Original sequence diagrams
- `README.md` - Original project documentation

