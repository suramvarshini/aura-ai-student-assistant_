/**
 * Campus Lost and Found System - Database Seeder Script
 * Populates MongoDB with default Admin user and 10+ realistic test items/claims.
 * Run via CLI: node seed.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Item = require('./models/Item');
const Claim = require('./models/Claim');
const User = require('./models/User');

dotenv.config();

const sampleItems = [
  {
    title: 'Apple MacBook Pro 14" Space Gray',
    type: 'lost',
    category: 'electronics',
    description: 'Left my MacBook Pro inside a black protective sleeve on the 2nd floor library study desk near the window.',
    location: 'Central Library, 2nd Floor',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    contactName: 'Alex Rivera',
    contactEmail: 'alex.rivera@student.campus.edu',
    contactPhone: '+1 555-0192',
    imageUrl: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['MacBook', 'Apple', 'Laptop', 'Electronics', 'Library']
  },
  {
    title: 'Student ID Card & Exam Hall Ticket',
    type: 'found',
    category: 'documents',
    description: 'Found a Campus Student ID Card for name "John Doe" (Reg No: CS202409) along with Midterm exam hall ticket on cafeteria table 4.',
    location: 'Main Student Cafeteria',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    contactName: 'Cafeteria Staff',
    contactEmail: 'cafeteria@campus.edu',
    contactPhone: '+1 555-0144',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Id Card', 'Documents', 'Cafeteria', 'Student ID']
  },
  {
    title: 'Blue SwissGear Backpack with Textbooks',
    type: 'found',
    category: 'bags',
    description: 'Dark blue backpack containing Data Structures textbook and a spiral notebook left under bench in lecture room 102.',
    location: 'Science Block, Room 102',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    contactName: 'Dr. Sarah Connor',
    contactEmail: 's.connor@campus.edu',
    contactPhone: '+1 555-0821',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Backpack', 'Bag', 'Books', 'Science Block']
  },
  {
    title: 'Fossil Silver Metallic Wristwatch',
    type: 'lost',
    category: 'accessories',
    description: 'Lost my silver metal analog wristwatch during basketball practice. It has a tiny scratch on the glass back cover.',
    location: 'Campus Sports Complex / Basketball Court',
    date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    contactName: 'Michael Jordan',
    contactEmail: 'm.jordan@student.campus.edu',
    contactPhone: '+1 555-0773',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Watch', 'Accessories', 'Sports', 'Fossil']
  },
  {
    title: 'Stainless Steel Hydro Flask Water Bottle',
    type: 'found',
    category: 'others',
    description: '32oz black insulated water bottle with university engineering stickers on the side found in Auditorium B after morning lecture.',
    location: 'Main Auditorium B',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    contactName: 'Auditorium Staff',
    contactEmail: 'admin.events@campus.edu',
    contactPhone: '+1 555-0188',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Water Bottle', 'Hydro Flask', 'Auditorium']
  },
  {
    title: 'Sony WH-1000XM4 Wireless Headphones',
    type: 'lost',
    category: 'electronics',
    description: 'Black noise-canceling over-ear headphones in hard zipper case forgotten on desk 12 in Computer Lab 3.',
    location: 'IT Building, Computer Lab 3',
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    contactName: 'David Chen',
    contactEmail: 'd.chen@student.campus.edu',
    contactPhone: '+1 555-0941',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Sony', 'Headphones', 'Electronics', 'Lab']
  },
  {
    title: 'Brown Leather Bi-fold Wallet',
    type: 'found',
    category: 'documents',
    description: 'Found brown leather wallet containing some cash, metro pass, and library card. Handed over to security desk.',
    location: 'Student Activity Union Security Desk',
    date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    contactName: 'Campus Guard Marcus',
    contactEmail: 'security@campus.edu',
    contactPhone: '+1 555-0111',
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Wallet', 'Documents', 'Security', 'Leather']
  },
  {
    title: 'Set of 4 Keys with Red Leather Keychain',
    type: 'lost',
    category: 'accessories',
    description: 'Lost ring with 2 dorm keys, 1 car key (Toyota), and a red leather strap keychain while walking near parking lot B.',
    location: 'Campus North Parking Lot B',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    contactName: 'Emily Watson',
    contactEmail: 'e.watson@student.campus.edu',
    contactPhone: '+1 555-0233',
    imageUrl: 'https://images.unsplash.com/photo-1582142839970-2b93284439bb?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Keys', 'Keychain', 'Accessories', 'Parking']
  },
  {
    title: 'Texas Instruments TI-84 Plus CE Graphing Calculator',
    type: 'found',
    category: 'electronics',
    description: 'Found black TI-84 graphing calculator with yellow name tag "Math CS" on the back cover.',
    location: 'Mathematics Hall, Room 304',
    date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    contactName: 'Prof. Alan Turing',
    contactEmail: 'a.turing@campus.edu',
    contactPhone: '+1 555-0314',
    imageUrl: 'https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Calculator', 'Electronics', 'Math']
  },
  {
    title: 'Black HP 65W USB-C Laptop Power Adapter',
    type: 'lost',
    category: 'electronics',
    description: 'Left laptop charger plugged into the wall outlet near quiet booth #3 in the campus study lounge.',
    location: 'Student Study Lounge',
    date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    contactName: 'Grace Hopper',
    contactEmail: 'g.hopper@student.campus.edu',
    contactPhone: '+1 555-0512',
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=500&auto=format&fit=crop&q=60',
    status: 'active',
    autoTags: ['Charger', 'Electronics', 'HP', 'Power']
  }
];

const seedDB = async (exitOnFinish = true) => {
  try {
    // Clear existing collection records
    await Item.deleteMany({});
    await Claim.deleteMany({});
    await User.deleteMany({});
    console.log('[Seed] Existing collections cleared.');

    // Create Admin User
    const adminUser = await User.create({
      name: 'Campus System Admin',
      email: 'admin@campus.edu',
      password: 'admin123',
      role: 'admin'
    });
    console.log(`[Seed] Admin User Created: ${adminUser.email} (Password: admin123)`);

    // Insert Sample Lost & Found Items
    const insertedItems = await Item.insertMany(sampleItems);
    console.log(`[Seed] ${insertedItems.length} Lost & Found items seeded successfully.`);

    // Create a Sample Claim Request on the Student ID Card item
    const foundIdCard = insertedItems.find(item => item.title.includes('Student ID Card'));
    if (foundIdCard) {
      await Claim.create({
        itemId: foundIdCard._id,
        claimantName: 'John Doe',
        claimantEmail: 'john.doe@student.campus.edu',
        claimantPhone: '+1 555-0999',
        proofDescription: 'My Student Registration Number is CS202409. The ID card photo matches my student portal profile and my hall ticket lists Midterm Data Structures exam.',
        status: 'pending',
        adminNotes: ''
      });
      console.log(`[Seed] Sample pending claim created for item: "${foundIdCard.title}".`);
    }

    console.log('[Seed] All database seed operations finished clean!');
    if (exitOnFinish) process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    if (exitOnFinish) process.exit(1);
  }
};

// If run directly from node CLI
if (require.main === module) {
  const connStr = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campus_lost_found';
  mongoose.connect(connStr, { serverSelectionTimeoutMS: 3000 })
    .then(() => seedDB(true))
    .catch(async () => {
      console.log('[Seed Info] Local MongoDB not detected. Initializing Memory Server for seeding...');
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      await mongoose.connect(mongod.getUri());
      await seedDB(false);
      console.log('[Seed Info] Seeded Memory database successfully.');
      process.exit(0);
    });
}

module.exports = seedDB;
