const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Xander AI IDE...');

function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`\n📦 Running: ${command}`);
    const result = execSync(command, { 
      cwd, 
      stdio: 'inherit',
      shell: true 
    });
    return result;
  } catch (error) {
    console.error(`❌ Error running command: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

// Install root dependencies
console.log('\n📦 Installing root dependencies...');
runCommand('npm install');

// Install backend dependencies
console.log('\n📦 Installing backend dependencies...');
runCommand('npm install', path.join(process.cwd(), 'apps/backend'));

// Install web dependencies  
console.log('\n📦 Installing web dependencies...');
runCommand('npm install', path.join(process.cwd(), 'apps/web'));

// Install desktop dependencies
console.log('\n📦 Installing desktop dependencies...');
runCommand('npm install', path.join(process.cwd(), 'apps/desktop'));

console.log('\n✅ Installation completed successfully!');
console.log('\n🎉 Xander AI IDE is ready to run!');
console.log('\nTo start development:');
console.log('  npm run dev:backend  # Backend API on port 3001');
console.log('  npm run dev:web      # Web portal on port 3000');
console.log('  npm run dev:desktop  # Desktop app');
console.log('\nMake sure you have PostgreSQL, Redis, and Qdrant running!');
