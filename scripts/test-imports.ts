#!/usr/bin/env node

/**
 * Simple test to validate that all imports work correctly after consolidation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { startHttpTransport, authStorage } from '../src/transport.js'
import { initProxy, ValidationError } from '../src/init-server.js'
import { NotionMCPProxy } from '../src/notion-proxy.js'

async function testImports() {
  console.log('🧪 Testing consolidated imports...')
  
  try {
    // Test basic imports
    console.log('✅ Server import successful')
    console.log('✅ Transport import successful') 
    console.log('✅ Init server import successful')
    console.log('✅ Notion proxy import successful')
    
    // Test that authStorage is available
    if (authStorage) {
      console.log('✅ AuthStorage available')
    }
    
    // Test ValidationError class
    if (ValidationError) {
      console.log('✅ ValidationError class available')
    }
    
    console.log()
    console.log('🎉 All imports working correctly!')
    console.log('✨ V2 implementation consolidation successful!')
    
  } catch (error) {
    console.error('❌ Import test failed:', error)
    process.exit(1)
  }
}

testImports()
