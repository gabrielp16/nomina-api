import dotenv from 'dotenv';
import seedDatabase from './scripts/seed.js';
import { connectDB, disconnectDB } from './config/database.js';

// Load Railway environment variables
dotenv.config({ path: '.env.railway' });

console.log('🌱 Starting Railway database seeding...');
console.log('MongoDB URI:', process.env.MONGODB_URI?.substring(0, 50) + '...');

const runSeed = async () => {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB Atlas');
    
    await seedDatabase(true); // true = standalone mode
    
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📋 Available credentials:');
    console.log('   👤 Admin: admin@morchis.com / admin123');
    console.log('   👤 Usuario: usuario@morchis.com / usuario123');
    console.log('   👤 Empleado: empleado@morchis.com / empleado123');
    
  } catch (error) {
    console.error('❌ Seeding error:', error);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

runSeed();
