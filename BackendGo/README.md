# AAS Sanity Backend - Go

High-performance JSON cleaning backend with step-by-step rule validation, implemented in Go.

## Features

- **7 Cleaning Rules**: Remove empty lists, empty strings, null values, empty objects, duplicates, convert boolean strings, and fix language codes
- **Stepwise Processing**: Review and accept/reject changes one at a time
- **Batch Processing**: Get all changes for a specific rule at once
- **Diff Generation**: Shows only the changed parts between before/after states
- **Boolean Conversion**: User-configurable boolean string conversion (true/false or "1"/"0")
- **Fast JSON Processing**: Leverages Go's efficient JSON handling
- **Parallel Processing**: Uses goroutines and channels to process arrays concurrently (up to 4 workers)
- **Background Precomputation**: Precomputes all changes in background goroutine for instant "Accept All" operations
- **Thread-Safe State Management**: Uses mutex-protected global state for precomputed changes

## API Endpoints

- `POST /upload` - Upload JSON file and get fully cleaned version + first change
- `POST /scan-issues` - Scan JSON file for issues without fixing
- `POST /get-next-change` - Get the next rule change for stepwise processing
- `POST /get-all-changes-for-rule` - Get all individual changes for a specific rule
- `POST /accept-changes` - Accept current changes and get next change
- `POST /reject-changes` - Reject current changes and get next change
- `POST /clean-specific-rule` - Clean only a specific rule type
- `GET /get-precomputed-changes` - Get all precomputed changes from background processing
- `GET /health` - Health check endpoint

## Building

### Local Development

```bash
go mod download
go run .
```

### Docker

```bash
docker build -t aas-sanity-backend .
docker run -p 5000:5000 aas-sanity-backend
```

## Environment Variables

- `SERVER_PORT` - Port to run the server on (default: 5000)

## Rules

1. **Remove empty lists** - Removes fields with empty arrays `[]`
2. **Remove empty strings** - Removes fields with empty or whitespace-only strings `""`
3. **Remove null values** - Removes fields with `null` values
4. **Remove empty objects** - Removes fields with empty objects `{}`
5. **Remove duplicates** - Removes duplicate items from arrays (keeps first occurrence)
6. **Convert boolean strings** - Converts string representations of booleans to actual booleans or numeric strings
7. **Fix language codes** - Removes trailing `?` from language codes (e.g., `"en?"` → `"en"`)

## Performance

Go's efficient JSON processing and memory management make this backend:
- **Faster** than Java for JSON-heavy workloads
- **Lower memory footprint** for large JSON files
- **True Concurrency** with goroutines and channels (no GIL like Python)
- **Parallel Array Processing**: Processes top-level arrays concurrently using goroutines
- **Background Precomputation**: Precomputes all changes silently while user reviews first rule
- **Faster startup** time
- **Smaller Docker images**

### Concurrency Features

- **Goroutines**: Lightweight threads for parallel processing
- **Channels**: Safe communication between goroutines
- **Mutex Protection**: Thread-safe access to shared state
- **WaitGroups**: Synchronization for parallel tasks

## Architecture

- `main.go` - HTTP server setup and routing
- `handlers.go` - API endpoint handlers
- `processor.go` - Rule processing logic (all 7 rules)
- `diff.go` - Diff generation for showing changes
- `types.go` - Data structures and types

