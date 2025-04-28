# GRIDALERT - Ausgrid Outage Scraper

A Node.js scraper that extracts live outage data from Ausgrid's outage map and uploads it to Supabase.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browser:
```bash
npx playwright install chromium
```

3. Configure environment variables:
- Copy `.env.example` to `.env`
- Update the Supabase URL and service role key in `.env`

## Usage

Run the scraper:
```bash
node index.js
```

## Data Structure

The scraper extracts the following fields for each outage:
- provider: 'Ausgrid'
- location: Suburb name
- status: Current status
- type: Type of outage
- customersAffected: Number of affected customers
- estRestoration: Estimated restoration time
- lat: Latitude
- lng: Longitude
- raw: Raw data from Ausgrid
- timestamp: When the data was scraped

## Supabase Setup

Create a table named `outages` with the following columns:
- id (uuid, primary key)
- provider (text)
- location (text)
- status (text)
- type (text)
- customersAffected (integer)
- estRestoration (timestamp)
- lat (float)
- lng (float)
- raw (jsonb)
- timestamp (timestamp) 