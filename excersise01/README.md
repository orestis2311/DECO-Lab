# Fitness Tracker with Solid Pod Integration

A web application that converts fitness activity files (TCX format) to RDF/Turtle format and automatically stores them in your Solid Pod.

## Features

### Activity Conversion
- Upload TCX fitness files
- Automatic conversion to RDF/Turtle (TTL) format
- Extraction of GPS coordinates, heart rate, power output, and other metrics
- Interactive map visualization with activity routes
- Real-time statistics display

### Solid Pod Integration
- **WebID Authentication** - Login with your Solid Pod credentials
- **Automatic Upload** - Converted TTL files automatically saved to your Pod
- **Structured Storage** - Activities stored in `/private/fitness/` directory
- **Naming** - Files named as `activitytype-YYYY-MM-DD-count.ttl`
- **Metadata Enrichment** - Metadata added to each activity

### Automatic Index Management
- **index.ttl** file automatically created and maintained
- References to all activity files
- Individual activity metadata (creator, title, type, timestamp)
- Individual statistics (duration, heart rate, power, distance)
- Aggregate summaries (total count, distance, duration, average HR)
- Updated automatically after every upload

## Prerequisites

- Node.js 
- npm 
- A Solid Pod account 

## Installation

### 1. Clone the Repository
```bash
git  
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

## Running the Application

### 1. Start the Backend Server
```bash
cd backend
node server.js
```
The backend will run on `http://localhost:3001`

### 2. Start the Frontend
Open a new terminal:
```bash
cd frontend
npm start
```
The frontend will run on `http://localhost:3000`

## How to Test with a Solid Pod

### Step 1: Create a Solid Pod (if you don't have one)

1. Go to [https://datapod.igrant.io](https://datapod.igrant.io)
2. Click "Sign Up" or "Register"
3. Choose a Pod name (e.g., `yourname`)
4. Create a password
5. Complete registration
6. Your Pod will be at: `https://yourname.datapod.igrant.io`

### Step 2: Login to the Application

1. Open `http://localhost:3000` in your browser
2. Click the **"Login"** button
3. You'll be redirected to `https://datapod.igrant.io`
4. Enter your Pod credentials
5. You'll be redirected back to the application

### Step 3: Upload a Fitness Activity

1. Click **"Select file"** or drag & drop a TCX file
2. Supported formats: `.tcx`
3. Watch the upload progress:
4. Success message appears
5. Pod confirmation: "Saved to Pod: activitytype-YYYY-MM-DD-count.ttl"

### Step 4: Verify Files in Your Pod

#### Using a Pod Browser:
1. Go to [https://podbrowser.inrupt.com](https://podbrowser.inrupt.com)
2. Login with your Pod credentials
3. Navigate to `/private/fitness/`
4. You should see:
   - `activitytype-YYYY-MM-DD-1.ttl` (your first activity)
   - `index.ttl` (activity index)

#### Direct URL Access:
- Your activities: `https://yourname.datapod.igrant.io/private/fitness/`
- Specific activity: `https://yourname.datapod.igrant.io/private/fitness/run-2025-01-15-1.ttl`
- Index file: `https://yourname.datapod.igrant.io/private/fitness/index.ttl`




## Technology Stack

### Frontend
- **React** - UI framework
- **@inrupt/solid-client** - Solid Pod interaction
- **@inrupt/solid-client-authn-browser** - WebID authentication

### Backend
- **Node.js** - Runtime
- **Express** - Web server
- **Multer** - File upload handling
- **Custom TCX converter** - TCX to TTL conversion
