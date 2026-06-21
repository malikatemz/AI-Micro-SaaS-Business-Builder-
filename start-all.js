#!/usr/bin/env node
/**
 * SoloStack Pro - Start All Systems
 * Runs all 7 AI SaaS systems concurrently
 */

const { spawn } = require('child_process');
const path = require('path');

const systems = [
  { name: 'SEO Brief Builder', port: 3001, dir: 'seo-brief' },
  { name: 'Invoice Nudger', port: 3002, dir: 'invoice-nudger' },
  { name: 'Meeting Notes', port: 3003, dir: 'meeting-notes' },
  { name: 'Payment Recovery', port: 3004, dir: 'payment-recovery' },
  { name: 'Client Portal', port: 3005, dir: 'client-portal' },
  { name: 'Proposal Generator', port: 3006, dir: 'proposal-generator' },
  { name: 'Job Board', port: 3007, dir: 'job-board' }
];

console.log('\n🚀 SoloStack Pro - Starting All Systems\n');

const processes = systems.map(system => {
  console.log(`Starting ${system.name} on port ${system.port}...`);
  
  const proc = spawn('node', ['server.js'], {
    cwd: path.join(__dirname, 'systems', system.dir),
    stdio: 'pipe',
    shell: true
  });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`[${system.port}] ${data}`);
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`[${system.port}] ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`${system.name} exited with code ${code}`);
  });

  return { ...system, proc };
});

console.log('\n✅ All systems started!');
console.log('\n📊 System URLs:');
systems.forEach(s => {
  console.log(`   ${s.name}: http://localhost:${s.port}`);
});

console.log('\n🛑 Press Ctrl+C to stop all systems\n');

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all systems...');
  processes.forEach(p => p.proc.kill());
  process.exit();
});
