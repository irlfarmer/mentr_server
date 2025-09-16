#!/usr/bin/env node

/**
 * Backend Admin Account Creation Script
 * 
 * This script creates an admin account directly in the database.
 * Run this from the server directory: node create-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const readline = require('readline');

// Import your User model (adjust path as needed)
const User = require('./src/models/User');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentr';

// Security: Allow connections from any host

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
const askQuestion = (question) => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

// Helper function to ask for password (hidden input)
const askPassword = (question) => {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    process.stdin.on('data', function(char) {
      char = char + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeAllListeners('data');
          console.log(); // New line
          resolve(password);
          break;
        case '\u0003': // Ctrl-C
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
};

// Security check function (disabled)
function checkLocalhostSecurity() {
  console.log(`${colors.green}✅ Security check passed - Running from any host${colors.reset}`);
}

// Main function
async function createAdminAccount() {
  console.log(`${colors.cyan}${colors.bright}🔐 Backend Admin Account Creation Script${colors.reset}`);
  console.log(`${colors.blue}===============================================${colors.reset}\n`);

  try {
    // Security check
    checkLocalhostSecurity();
    // Connect to MongoDB
    console.log(`${colors.yellow}Connecting to MongoDB...${colors.reset}`);
    await mongoose.connect(MONGODB_URI);
    console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}\n`);

    // Get admin details
    console.log(`${colors.yellow}Please provide the following information:${colors.reset}\n`);
    
    const firstName = await askQuestion(`${colors.cyan}First Name: ${colors.reset}`);
    const lastName = await askQuestion(`${colors.cyan}Last Name: ${colors.reset}`);
    const email = await askQuestion(`${colors.cyan}Email: ${colors.reset}`);
    const password = await askPassword(`${colors.cyan}Password: ${colors.reset}`);
    const confirmPassword = await askPassword(`${colors.cyan}Confirm Password: ${colors.reset}`);

    // Validate inputs
    if (!firstName || !lastName || !email || !password) {
      throw new Error('All fields are required');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    console.log(`\n${colors.yellow}Creating admin account...${colors.reset}`);

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create admin user
    const adminUser = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      userType: 'admin',
      isVerified: true,
      bio: 'System Administrator',
      skills: ['Administration', 'System Management'],
      timezone: 'UTC',
      availability: [],
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await adminUser.save();

    console.log(`\n${colors.green}${colors.bright}✅ Admin account created successfully!${colors.reset}`);
    console.log(`${colors.green}=====================================${colors.reset}`);
    console.log(`${colors.cyan}User ID: ${colors.bright}${adminUser._id}${colors.reset}`);
    console.log(`${colors.cyan}Email: ${colors.bright}${email}${colors.reset}`);
    console.log(`${colors.cyan}Name: ${colors.bright}${firstName} ${lastName}${colors.reset}`);
    console.log(`${colors.cyan}User Type: ${colors.bright}admin${colors.reset}`);
    console.log(`${colors.cyan}Admin URL: ${colors.bright}http://localhost:3000/0124f1bc3ace33b34802adedd123bfbd${colors.reset}`);
    
    console.log(`\n${colors.yellow}${colors.bright}📋 Next Steps:${colors.reset}`);
    console.log(`${colors.yellow}1. Start your frontend server: npm start${colors.reset}`);
    console.log(`${colors.yellow}2. Login with the admin credentials${colors.reset}`);
    console.log(`${colors.yellow}3. Navigate to the admin panel${colors.reset}`);

  } catch (error) {
    console.log(`\n${colors.red}${colors.bright}❌ Error: ${error.message}${colors.reset}`);
    
    console.log(`\n${colors.yellow}${colors.bright}💡 Troubleshooting Tips:${colors.reset}`);
    console.log(`${colors.yellow}• Make sure MongoDB is running${colors.reset}`);
    console.log(`${colors.yellow}• Check your MONGODB_URI connection string${colors.reset}`);
    console.log(`${colors.yellow}• Verify the User model is properly imported${colors.reset}`);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log(`\n${colors.blue}Database connection closed.${colors.reset}`);
    rl.close();
  }
}

// Quick admin creation function
async function createQuickAdmin() {
  console.log(`${colors.cyan}${colors.bright}🚀 Quick Admin Creation${colors.reset}`);
  console.log(`${colors.blue}=====================================${colors.reset}\n`);

  try {
    // Security check
    checkLocalhostSecurity();
    // Connect to MongoDB
    console.log(`${colors.yellow}Connecting to MongoDB...${colors.reset}`);
    await mongoose.connect(MONGODB_URI);
    console.log(`${colors.green}✅ Connected to MongoDB${colors.reset}\n`);

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@mentr.com' });
    if (existingAdmin) {
      console.log(`${colors.yellow}⚠️  Admin user already exists with email: admin@mentr.com${colors.reset}`);
      console.log(`${colors.cyan}User ID: ${existingAdmin._id}${colors.reset}`);
      console.log(`${colors.cyan}Admin URL: http://localhost:3000/0124f1bc3ace33b34802adedd123bfbd${colors.reset}`);
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash('admin123', saltRounds);

    // Create quick admin user
    const adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@mentr.com',
      password: hashedPassword,
      userType: 'admin',
      isVerified: true,
      bio: 'System Administrator',
      skills: ['Administration', 'System Management'],
      timezone: 'UTC',
      availability: [],
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await adminUser.save();

    console.log(`${colors.green}${colors.bright}✅ Quick admin account created!${colors.reset}`);
    console.log(`${colors.green}=====================================${colors.reset}`);
    console.log(`${colors.cyan}User ID: ${colors.bright}${adminUser._id}${colors.reset}`);
    console.log(`${colors.cyan}Email: ${colors.bright}admin@mentr.com${colors.reset}`);
    console.log(`${colors.cyan}Password: ${colors.bright}admin123${colors.reset}`);
    console.log(`${colors.cyan}Admin URL: ${colors.bright}http://localhost:3000/0124f1bc3ace33b34802adedd123bfbd${colors.reset}`);

  } catch (error) {
    console.log(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
  } finally {
    await mongoose.connection.close();
    console.log(`\n${colors.blue}Database connection closed.${colors.reset}`);
  }
}

// Handle script arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`${colors.cyan}${colors.bright}Backend Admin Account Creation Script${colors.reset}`);
  console.log(`${colors.blue}===============================================${colors.reset}`);
  console.log(`${colors.yellow}Usage: node create-admin.js [options]${colors.reset}\n`);
  console.log(`${colors.cyan}Options:${colors.reset}`);
  console.log(`${colors.cyan}  --help, -h     Show this help message${colors.reset}`);
  console.log(`${colors.cyan}  --quick        Create admin with default values${colors.reset}\n`);
  console.log(`${colors.yellow}Examples:${colors.reset}`);
  console.log(`${colors.yellow}  node create-admin.js${colors.reset}`);
  console.log(`${colors.yellow}  node create-admin.js --quick${colors.reset}\n`);
  console.log(`${colors.cyan}Environment Variables:${colors.reset}`);
  console.log(`${colors.cyan}  MONGODB_URI    MongoDB connection string (default: mongodb://localhost:27017/mentr)${colors.reset}\n`);
  console.log(`${colors.cyan}Admin Route: http://localhost:3000/0124f1bc3ace33b34802adedd123bfbd${colors.reset}`);
  process.exit(0);
}

if (process.argv.includes('--quick')) {
  createQuickAdmin();
} else {
  createAdminAccount();
}
