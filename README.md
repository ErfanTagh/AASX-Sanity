# AAS Sanity Checker

A web-based tool for validating and automatically fixing Asset Administration Shell (AAS) JSON files according to AAS specifications. This tool helps reduce manual error handling by automatically detecting and correcting both meta-model and constraint-related errors.

## 🎯 About the Project

AAS Sanity Checker is a Master's project designed to facilitate the validation phase of Asset Administration Shells (AAS). The project aims to:

- Automatically handle common AAS errors
- Reduce manual validation work
- Provide an interactive review process for rule-based corrections
- Ensure compliance with AAS specifications

The system uses a rule-based approach with 18 specialized rules that detect and fix common issues in AAS JSON files, covering both meta-model structure and constraint violations.

## ✨ Features

### 🔍 **Interactive Rule Validation**
- **Step-by-step review**: Review each rule change individually before applying
- **Accept/Reject decisions**: Full control over which rules to apply
- **Real-time diff view**: See exactly what changes before accepting
- **Accept All & Download**: Fast-track option with precomputed cache (15-30x faster)

### 📊 **Three-Pane Comparison View**
- **Original Upload**: View the unmodified JSON you uploaded
- **Current State**: See the current state with your accepted changes
- **Final Result**: Preview the fully cleaned JSON with all rules applied
- **Resizable panes**: Drag dividers to adjust pane sizes

### 📜 **Rule Validation History**
- Track all accept/reject decisions
- View before/after for any historical decision
- Download any previous state
- Complete audit trail with timestamps

### 🎨 **Modern UI**
- Dark theme optimized for code review
- Bootstrap 5 based responsive design
- Loading indicators for all async operations
- Toast notifications for success messages

### 🔧 **18 Validation Rules**

The system includes 18 specialized rules covering:

1. **Meta-Model Validation**:
   - Remove empty lists and arrays
   - Clean up empty semantic IDs and value IDs
   - Handle empty idShort fields
   - Fix SubmodelElementCollection structures
   - Manage ReferenceElement values

2. **Constraint Validation**:
   - Set default file names for File elements
   - Fix entity types (SelfManagedEntity → CoManagedEntity)
   - Handle MultiLanguageProperty defaults
   - Convert ConceptDescription to GlobalReference
   - Fix boolean string conversions
   - Add missing DataSpecification definitions

3. **Data Cleanup**:
   - Remove BulkCount elements with empty values
   - Fix language codes (en? → en)
   - Handle empty Property values based on valueType

## ⚡ Performance Optimizations

The AAS Sanity Checker includes sophisticated performance optimizations for handling large JSON files:

### Background Precomputation
- **Intelligent Snapshot Management**: Background processing uses optimized snapshot strategy
- **15-30x Faster**: Reduced processing time from 5+ minutes to 10-20 seconds
- **Smart Caching**: Precomputes all changes for instant "Accept All" operations
- **Non-blocking**: User can start reviewing immediately while background processes

### Technical Details
- **Parallel Processing**: ThreadPoolExecutor processes multiple arrays concurrently
- **Optimized Deep Copies**: Skips unnecessary JSON snapshots during background search (`snapshot=False`)
- **Fragment-Only Snapshots**: Only copies changed elements, not entire JSON trees
- **Reference-Based Processing**: Uses object references instead of expensive copies where safe
- **Smart Caching**: Background thread precomputes all changes silently while user reviews first rule

### Performance Metrics
- **Before optimization**: 304 seconds (5+ minutes) for 13 changes
- **After optimization**: 10-20 seconds for 13 changes
- **Speedup**: 15-30x faster
- **Per iteration**: 21.77s → 0.7-1.5s (reduced from 4 deep copies to 2)

**Real-world result**: Processing a 7,500-line AAS JSON with 13 changes takes ~10-20 seconds instead of 5+ minutes.

## 🚀 Getting Started

### Prerequisites

- **Docker** and **Docker Compose** installed on your system
- No other software required!

### Installation & Running with Docker

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd PythonProject2
   ```

2. **Start the application**:
   ```bash
   docker compose up -d --build
   ```

   This command will:
   - Build the backend (Flask API) container
   - Build the frontend (Nginx) container
   - Start both services in detached mode
   - Set up networking between containers

3. **Access the application**:
   - Open your browser and navigate to: **http://localhost**
   - The backend API runs on: **http://localhost:5000**

4. **Stop the application**:
   ```bash
   docker compose down
   ```

5. **Rebuild after code changes**:
   ```bash
   docker compose down
   docker compose up -d --build
   ```

### Docker Services

The application consists of two Docker services:

- **Backend (Flask)**: Python-based REST API on port 5000
- **Frontend (Nginx)**: Static web server on port 80

Both services are connected via a Docker network and restart automatically unless stopped.

## 📖 Usage Guide

### Basic Workflow

1. **Upload JSON File**:
   - Click "Load more..." button in the sidebar
   - Select your AAS JSON file
   - The system automatically processes it and shows the first rule change

2. **Review Changes** (Tab 2: Rule Validation):
   - View the **Before** and **After** side-by-side
   - See which rule is being applied
   - Choose to **Accept**, **Reject**, or **Accept All & Download**

3. **Track Progress**:
   - Monitor **Pending**, **Approved**, and **Rejected** counters
   - View real-time status of validation progress

4. **View Results** (Tab 3: Changes & Results):
   - See complete validation history
   - Compare Original → Current → Final states
   - Download any historical state

5. **Download**:
   - **Download Current State**: Get JSON at current validation point
   - **Download cleaned JSON**: Get fully processed JSON (all rules)
   - **Accept All & Download**: Auto-accept remaining rules and download

### Advanced Features

#### **Quick Filter** (Tab 3)
- Filter the finished JSON by ID, assetId, idShort, or displayName
- Real-time search with live result count
- Only visible in the Changes & Results tab

#### **State History**
- Every accepted change creates a new state
- Download any previous state as JSON
- View detailed before/after diff for any decision

## 🏗️ Project Structure

```
PythonProject2/
├── Backend/
│   ├── api.py                          # Flask REST API
│   ├── rule_processor.py               # Step-by-step rule processing
│   ├── RuleBasedScriptToCheckBugsV04_1.py  # Core rule functions
│   ├── helpers.py                      # Utility functions
│   ├── requirements.txt                # Python dependencies
│   └── Dockerfile                      # Backend Docker configuration
├── index.html                          # Main HTML page
├── script.js                           # Frontend JavaScript logic
├── styles.css                          # Custom CSS styling
├── docker-compose.yml                  # Docker orchestration
├── Dockerfile.frontend                 # Frontend Docker configuration
└── README.md                           # This file
```

## 🔌 API Endpoints

### Main Endpoints:
- `POST /upload` - Upload and process JSON file
- `POST /accept-changes` - Accept current rule change
- `POST /reject-changes` - Reject current rule change
- `POST /get-next-change` - Get next rule to review
- `GET /download/<filename>` - Download processed file
- `POST /download-current-state` - Download current validation state
- `POST /apply-single-rule` - Apply a specific rule repeatedly

## 🛠️ Development

### Running Without Docker

#### Backend:
```bash
cd Backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python api.py
```

#### Frontend:
Serve the root directory with any web server:
```bash
python -m http.server 8080
```

### Making Changes

After modifying code:
```bash
# Rebuild and restart
docker compose down
docker compose up -d --build

# Or rebuild without cache (for major changes)
docker compose build --no-cache
docker compose up -d
```

### View Logs

```bash
# View all logs
docker compose logs

# Follow backend logs
docker compose logs -f backend

# Follow frontend logs
docker compose logs -f frontend
```

## 📋 Rule Reference

| Rule # | Category | Description |
|--------|----------|-------------|
| 1 | Meta-Model | Remove specified keys if they are empty lists |
| 2 | Meta-Model | Remove semanticId with empty keys |
| 3 | Meta-Model | Remove valueId with empty keys |
| 4 | Meta-Model | Remove empty idShort fields |
| 5 | Meta-Model | Set default file names for File elements |
| 6 | Meta-Model | Add default keys for AnnotatedRelationshipElement |
| 7 | Meta-Model | Remove empty value in SubmodelElementCollection |
| 8 | Constraints | Change entityType to CoManagedEntity when appropriate |
| 9 | Constraints | Add default values for MultiLanguageProperty |
| 10 | Constraints | Fix ConceptDescription to GlobalReference |
| 11 | Meta-Model | Remove empty ReferenceElement values |
| 12 | Meta-Model | Remove idShort in SubmodelElementCollection value items |
| 13 | Constraints | Set default value for Property with empty value |
| 14 | Constraints | Fix language code 'en?' to 'en' |
| 15 | Constraints | Convert boolean strings to numeric equivalents |
| 16 | Meta-Model | Handle MultiLanguageProperty with empty arrays |
| 17 | Constraints | Add missing DataSpecification definitions |
| 18 | Meta-Model | Remove BulkCount elements with empty values |

## 🎨 User Interface

### Tab 1: Shells
- View all AAS shells in your uploaded file
- Card-based display with syntax highlighting
- Shows applied rules with color-coded badges

### Tab 2: Rule Validation
- Interactive rule-by-rule validation
- Side-by-side before/after comparison
- Accept, Reject, or Accept All options
- Real-time status counters (Pending/Approved/Rejected)
- Loading indicators during processing

### Tab 3: Changes & Results
- **Rule Validation History**: Complete audit trail of all decisions
- **Three-pane comparison**: Original → Current → Final
- **Resizable panes**: Drag dividers to adjust view
- **Quick Filter**: Search through finished JSON

## 🔒 Security Features

- File type validation (JSON only)
- Path traversal prevention in downloads
- CORS enabled for local development
- Input sanitization and validation

## 🐛 Troubleshooting

### Container Issues
```bash
# Check container status
docker compose ps

# View logs for errors
docker compose logs backend
docker compose logs frontend

# Restart services
docker compose restart
```

### Port Conflicts
If ports 80 or 5000 are already in use, modify `docker-compose.yml`:
```yaml
ports:
  - "8080:80"    # Frontend
  - "5001:5000"  # Backend
```

### Code Changes Not Reflecting
```bash
# Force rebuild without cache
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 📞 Support

For questions or issues, contact:
- **Monireh Pourjafarian**: Monireh.Pourjafarian@smartfactory.de

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is part of academic research. Please contact the maintainers for licensing information.

## 🎓 Project Status

Active development as part of a Master's project. The tool is functional and ready for use in AAS validation workflows.

## 🙏 Acknowledgments

- Developed as part of a Master's project
- SmartFactory-KL for project support
- AAS specification community

---

**Made with ❤️ for the AAS Community**