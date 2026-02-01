# UI Updates for Generalized Rule System

## Summary

The UI has been updated to support the new generalized rule engine system, making it more flexible and general-purpose while maintaining all existing functionality.

## Changes Made

### 1. **Branding Updates**
- **Title**: Changed from "AAS SANITY" to "Data Sanity Checker - Rule-Based Data Cleaning"
- **Navbar**: Updated to show "Data Sanity Checker" with current preset badge
- **Tab Labels**: 
  - "Error handling at once" → "Quick Clean"
  - "Changes & as" → "Changes & Results"

### 2. **New Sidebar Features**

#### Rule Configuration Card
- **Preset Selector**: Dropdown to select from available rule presets
- **Preset Info**: Shows number of rules and categories
- **View Rules Button**: Opens modal with detailed rule information

#### Rule Statistics Card
- **Total Rules**: Shows count of rules in current preset
- **Applied Rules**: Tracks how many rules have been applied
- **Categories**: Shows number of rule categories

### 3. **New API Endpoints**

Added to `Backend/api.py`:
- `GET /rule-presets` - List all available presets
- `GET /rule-presets/<name>` - Get info about a specific preset
- `POST /rule-presets/<name>` - Switch to a preset
- `GET /rules` - Get current rules information

### 4. **JavaScript Functions Added**

#### Rule Management
- `loadRulePresets()` - Loads available presets on page load
- `changePreset()` - Switches between rule presets
- `loadPresetInfo()` - Loads and displays preset information
- `showRuleInfo()` - Shows detailed rule information modal
- `updatePresetBadge()` - Updates navbar badge with current preset
- `updateRuleStatistics()` - Updates rule statistics display

### 5. **UI Components**

#### Rule Information Modal
- Displays all rules in current preset
- Shows rule ID, name, category, and type
- Table format for easy browsing
- Shows total rules and categories

#### Preset Selector
- Dropdown populated with available presets
- Shows preset name and rule count
- Automatically updates when preset changes

#### Statistics Display
- Real-time updates of applied rules
- Shows total rules and categories
- Integrated into sidebar

## User Experience Improvements

1. **Clearer Purpose**: Branding now reflects general-purpose data cleaning
2. **Rule Visibility**: Users can see what rules are available
3. **Preset Management**: Easy switching between rule sets
4. **Better Feedback**: Statistics show progress and rule information
5. **Professional Look**: Updated labels and icons

## Backward Compatibility

- All existing functionality preserved
- Old API endpoints still work
- Existing workflows unchanged
- AAS rules remain as default preset

## Future Enhancements

Potential additions:
- Custom rule builder UI
- Rule import/export
- Rule testing/preview
- Rule performance metrics
- Multiple preset support per session

## Testing

To test the new UI:
1. Start the backend server
2. Open the frontend in a browser
3. Check that preset selector loads
4. Click "View Rules" to see rule information
5. Upload a JSON file and verify statistics update

