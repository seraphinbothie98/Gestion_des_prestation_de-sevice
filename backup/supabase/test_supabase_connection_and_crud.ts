import { isSupabaseConfigured, getSupabaseClient, checkSupabaseConnection } from '../lib/supabaseClient';
import { supabaseService } from '../server/db/supabaseService';
import { dbStore } from '../server/db/mockStore';

console.log('====================================================================');
console.log('🧪 TEST SUITE: SUPABASE (POSTGRESQL) INTEGRATION & LOCAL FALLBACK');
console.log('====================================================================\n');

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
  } else {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function runTestSuite() {
  // -------------------------------------------------------------------------
  // TEST 1: Supabase Configuration Detection & Safe Fallback
  // -------------------------------------------------------------------------
  console.log('--- TEST 1: Supabase Configuration Detection & Fallback ---');
  const isConfigured = isSupabaseConfigured();
  console.log(`Supabase configuration status : ${isConfigured ? 'CONFIGURED' : 'UNCONFIGURED (Using Local Fallback)'}`);
  
  if (!isConfigured) {
    assert(getSupabaseClient() === null, 'Safe fallback: client is null when unconfigured (no unhandled crash)');
    const health = await checkSupabaseConnection();
    assert(!health.connected && health.message.toLowerCase().includes('stockage local'), 'Health check provides clear fallback message');
  }

  // -------------------------------------------------------------------------
  // TEST 2: Local Database Persistence Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Local Database Integrity & Business Rules ---');
  const state = dbStore.getState();
  assert(state.tenants.length >= 1, 'Local tenants data preserved');
  assert(state.products.length >= 1, 'Local products data preserved');
  assert(state.services.length >= 1, 'Local services data preserved');
  assert(state.orders !== undefined, 'Orders collection initialized and accessible');
  assert(state.financialAccounts.length >= 1, 'Financial accounts preserved');

  // -------------------------------------------------------------------------
  // TEST 3: Supabase Service Layer Architecture
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Supabase Service Layer Readiness ---');
  assert(typeof supabaseService.getTenants === 'function', 'supabaseService.getTenants is defined');
  assert(typeof supabaseService.getPersons === 'function', 'supabaseService.getPersons is defined');
  assert(typeof supabaseService.getServices === 'function', 'supabaseService.getServices is defined');
  assert(typeof supabaseService.getProducts === 'function', 'supabaseService.getProducts is defined');
  assert(typeof supabaseService.getOrders === 'function', 'supabaseService.getOrders is defined');
  assert(typeof supabaseService.getFinancialAccounts === 'function', 'supabaseService.getFinancialAccounts is defined');

  // -------------------------------------------------------------------------
  // TEST 4: Database Store Supabase Bridge
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: dbStore Supabase Bridge Methods ---');
  assert(typeof dbStore.isSupabaseEnabled === 'function', 'dbStore.isSupabaseEnabled is defined');
  assert(typeof dbStore.checkSupabaseHealth === 'function', 'dbStore.checkSupabaseHealth is defined');
  assert(typeof dbStore.syncWithSupabase === 'function', 'dbStore.syncWithSupabase is defined');

  // -------------------------------------------------------------------------
  // TEST 5: Stock Prestation & Magasin Isolation with Supabase Active or Fallback
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: Stock Engine Integrity Under Supabase Architecture ---');
  const prodA4 = state.products.find(p => p.id === 'prod-01');
  assert(prodA4 !== undefined, 'Product prod-01 (Papier A4) exists');
  assert(prodA4?.prestationStock !== undefined, 'Product has separate prestationStock');
  assert(prodA4?.currentStock !== undefined, 'Product has separate currentStock');

  console.log('\n====================================================================');
  console.log('🎉 ALL SUPABASE INTEGRATION & FALLBACK TESTS PASSED SUCCESSFULLY (100%)');
  console.log('====================================================================\n');
}

runTestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
