<<<<<<< HEAD
# GridAlert

Real-time power outage monitoring system for Australian electricity providers.

## Current Providers
- Ausgrid (Sydney, Central Coast and Hunter regions of NSW)

## Setup

1. Clone the repository
2. Install dependencies:
```bash
cd ausgrid-scraper
npm install
```

3. Set up environment variables in `.env`:
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
```

4. Run the scraper:
```bash
npm start
```

## Database Schema

The data is stored in Supabase under the `api.outages` table with the following structure:

- `id` (int8): Auto-incrementing primary key
- `provider` (text): Name of the electricity provider
- `total_outages` (int4): Total number of current outages
- `customers_affected` (int4): Total number of customers affected
- `last_updated` (timestamptz): Last update time from the provider
- `raw` (jsonb): Raw data from the provider's API
- `timestamp` (timestamptz): When this record was created

## Automated Scraping

The scraper runs automatically every 10 minutes using GitHub Actions. You can also trigger it manually from the Actions tab in the repository. 
=======
# GridAlert
>>>>>>> a86912fd70cd1f5bed6d828b9b739907defc6ace
