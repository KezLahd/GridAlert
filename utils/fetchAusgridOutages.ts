import axios from 'axios'
import { supabase } from './supabaseClient'

// Note: This API endpoint is no longer accessible
// Ausgrid now requires using their web portal or customer service for outage information
export async function fetchAndUploadOutages() {
  try {
    console.log('⚠️ Ausgrid API is no longer publicly accessible')
    console.log('Please use the Ausgrid web portal at https://www.ausgrid.com.au/Outages/Current-Outages')
    
    // For development/testing purposes only
    const mockData = [{
      area: 'Test Area',
      cause: 'API Unavailable',
      classification: 'Test',
      customers_affected: 0,
      est_restore_time: new Date().toISOString(),
      start_time: new Date().toISOString(),
      lat: -33.8688,
      lng: 151.2093,
      polygons: []
    }]

    const { error } = await supabase
      .from('energy_api.ausgrid_outages')
      .insert(mockData)

    if (error) console.error('❌ Upload failed:', error.message)
    else console.log('✅ Mock data uploaded successfully')
  } catch (err) {
    console.error('❌ Error:', err)
  }
}
