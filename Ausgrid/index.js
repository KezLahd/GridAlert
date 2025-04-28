import { chromium } from 'playwright';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Helper function to safely format dates
function formatDate(dateStr) {
  try {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    
    // Convert to AEST (UTC+10)
    const aestDate = new Date(date.getTime() + (10 * 60 * 60 * 1000));
    return aestDate.toISOString();
  } catch (error) {
    console.log(`Error formatting date: ${dateStr}`, error);
    return null;
  }
}

// Helper function to get current AEST time
function getCurrentAEST() {
  const now = new Date();
  return new Date(now.getTime() + (10 * 60 * 60 * 1000));
}

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    auth: {
      persistSession: false
    },
    db: {
      schema: 'api'
    }
  }
);

// Verify environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY must be set in .env file');
  process.exit(1);
}

// Helper function to manage backups
function manageBackups(type) {
  const backupDir = 'backups';
  const timestamp = getCurrentAEST().toISOString().replace(/[:.]/g, '-');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  // Get all existing backups of this type
  const files = fs.readdirSync(backupDir)
    .filter(file => file.startsWith(`${type}_backup_`))
    .sort();

  // If we have 5 or more backups, delete the oldest one
  if (files.length >= 5) {
    fs.unlinkSync(`${backupDir}/${files[0]}`);
  }

  return `${backupDir}/${type}_backup_${timestamp}.json`;
}

async function checkUnplannedOutages() {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('\nChecking for unplanned outages...');
    const unplannedResponse = await page.goto('https://www.ausgrid.com.au/webapi/OutageListData/GetDetailedUnplannedOutages', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    const unplannedOutages = await unplannedResponse.json();
    console.log(`Found ${unplannedOutages.length} unplanned outages`);

    // Format unplanned outages
    const formattedUnplannedOutages = unplannedOutages.map(outage => ({
      statusheading: outage.StatusHeading || '',
      area_suburb: outage.Area || '',
      cause: outage.Cause || '',
      customers_affected: outage.Customers || '',
      estimated_finish_time: formatDate(outage.EstRestTime),
      start_time: formatDate(outage.StartDateTime),
      webid: outage.WebId || '',
      status: outage.Status || '',
      created_at: getCurrentAEST().toISOString()
    }));

    try {
      // Always delete existing unplanned outages
      const { error: deleteError } = await supabase
        .from('unplanned_outages')
        .delete()
        .neq('webid', 0);
      
      if (deleteError) {
        console.error('Error deleting unplanned outages:', deleteError);
        return;
      }

      // Always insert new unplanned outages
      const { data, error: insertError } = await supabase
        .from('unplanned_outages')
        .insert(formattedUnplannedOutages)
        .select();

      if (insertError) {
        console.error('Error inserting unplanned outages:', insertError);
      } else {
        console.log(`Successfully updated ${data.length} unplanned outages`);
      }

      // Save to backup file with rolling system
      const backup = {
        unplanned_outages: formattedUnplannedOutages,
        last_updated: getCurrentAEST().toISOString()
      };
      const backupPath = manageBackups('unplanned');
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      console.log(`Backup saved to ${backupPath}`);

    } catch (error) {
      console.error('Database operation error:', error);
    }

  } catch (error) {
    console.error('Error checking unplanned outages:', error);
  } finally {
    await browser.close();
  }
}

async function checkPlannedOutages() {
  const browser = await chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('\nChecking for planned outages...');
    const plannedResponse = await page.goto('https://www.ausgrid.com.au/webapi/OutageListData/GetDetailedPlannedOutages', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    const plannedOutages = await plannedResponse.json();
    console.log(`Found ${plannedOutages.length} planned outages`);

    // Get current AEST date for filtering
    const now = getCurrentAEST();

    // Separate planned outages into current and future
    const currentPlannedOutages = plannedOutages.filter(outage => {
      try {
        const startDate = new Date(outage.StartDateTime);
        const endDate = new Date(outage.EndDateTime);
        // Convert to AEST for comparison
        const aestStartDate = new Date(startDate.getTime() + (10 * 60 * 60 * 1000));
        const aestEndDate = new Date(endDate.getTime() + (10 * 60 * 60 * 1000));
        return !isNaN(aestStartDate.getTime()) && !isNaN(aestEndDate.getTime()) && 
               aestStartDate <= now;
      } catch (error) {
        console.log(`Error processing planned outage dates:`, error);
        return false;
      }
    });

    const futurePlannedOutages = plannedOutages.filter(outage => {
      try {
        const startDate = new Date(outage.StartDateTime);
        // Convert to AEST for comparison
        const aestStartDate = new Date(startDate.getTime() + (10 * 60 * 60 * 1000));
        return !isNaN(aestStartDate.getTime()) && aestStartDate > now;
      } catch (error) {
        console.log(`Error processing planned outage dates:`, error);
        return false;
      }
    });

    // Format planned outages
    const formatPlannedOutage = (outage) => {
      const startDate = new Date(outage.StartDateTime);
      const endDate = new Date(outage.EndDateTime);
      const aestStartDate = new Date(startDate.getTime() + (10 * 60 * 60 * 1000));
      const aestEndDate = new Date(endDate.getTime() + (10 * 60 * 60 * 1000));
      
      let details = outage.Detail || '';
      if (aestEndDate < now) {
        details = 'Expected to have finished';
      }

      return {
        area_suburb: outage.Area || '',
        cause: outage.Cause || '',
        details: details,
        customers_affected: outage.Customers || '',
        end_date_time: formatDate(outage.EndDateTime),
        start_date_time: formatDate(outage.StartDateTime),
        status: outage.Status || '',
        streets_affected: outage.Streets || '',
        webid: outage.WebId || '',
        jobid: outage.JobId || '',
        created_at: getCurrentAEST().toISOString()
      };
    };

    const formattedCurrentPlannedOutages = currentPlannedOutages.map(formatPlannedOutage);
    const formattedFuturePlannedOutages = futurePlannedOutages.map(formatPlannedOutage);

    try {
      // Delete existing planned outages
      const { error: deleteCurrentError } = await supabase
        .from('current_planned_outages')
        .delete()
        .neq('webid', 0);
      
      if (deleteCurrentError) {
        console.error('Error deleting current planned outages:', deleteCurrentError);
        return;
      }

      const { error: deleteFutureError } = await supabase
        .from('future_planned_outages')
        .delete()
        .neq('webid', 0);
      
      if (deleteFutureError) {
        console.error('Error deleting future planned outages:', deleteFutureError);
        return;
      }

      // Insert new planned outages
      const { data: currentData, error: currentError } = await supabase
        .from('current_planned_outages')
        .insert(formattedCurrentPlannedOutages)
        .select();

      if (currentError) {
        console.error('Error inserting current planned outages:', currentError);
      } else {
        console.log(`Successfully updated ${currentData.length} current planned outages`);
      }

      const { data: futureData, error: futureError } = await supabase
        .from('future_planned_outages')
        .insert(formattedFuturePlannedOutages)
        .select();

      if (futureError) {
        console.error('Error inserting future planned outages:', futureError);
      } else {
        console.log(`Successfully updated ${futureData.length} future planned outages`);
      }

      // Save to backup file with rolling system
      const backup = {
        current_planned_outages: formattedCurrentPlannedOutages,
        future_planned_outages: formattedFuturePlannedOutages,
        last_updated: getCurrentAEST().toISOString()
      };
      const backupPath = manageBackups('planned');
      fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
      console.log(`Backup saved to ${backupPath}`);

    } catch (error) {
      console.error('Database operation error:', error);
    }

  } catch (error) {
    console.error('Error checking planned outages:', error);
  } finally {
    await browser.close();
  }
}

// Function to start the monitoring
function startMonitoring() {
  console.log('Starting outage monitoring...');
  console.log('Environment variables:', {
    SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Not set',
    SUPABASE_KEY: process.env.SUPABASE_KEY ? 'Set' : 'Not set'
  });
  
  // Run unplanned outages check immediately and every 5 minutes
  console.log('Starting unplanned outage monitoring...');
  checkUnplannedOutages().catch(error => {
    console.error('Error in initial unplanned outage check:', error);
  });
  setInterval(() => {
    console.log('Running scheduled unplanned outage check...');
    checkUnplannedOutages().catch(error => {
      console.error('Error in scheduled unplanned outage check:', error);
    });
  }, 5 * 60 * 1000);
  
  // Run planned outages check immediately and every 24 hours
  console.log('Starting planned outage monitoring...');
  checkPlannedOutages().catch(error => {
    console.error('Error in initial planned outage check:', error);
  });
  setInterval(() => {
    console.log('Running scheduled planned outage check...');
    checkPlannedOutages().catch(error => {
      console.error('Error in scheduled planned outage check:', error);
    });
  }, 24 * 60 * 60 * 1000);
}

// Start the monitoring
startMonitoring();

// Keep the process running
process.on('SIGINT', () => {
  console.log('Stopping outage monitoring...');
  process.exit(0);
}); 