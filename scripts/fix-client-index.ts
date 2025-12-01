import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/morchis-nomina';

async function fixClientIndexes() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    const collection = db.collection('clients');

    // Listar índices existentes
    console.log('\n📋 Índices actuales:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Eliminar el índice antiguo 'email_1' si existe
    try {
      console.log('\n🗑️  Intentando eliminar índice antiguo "email_1"...');
      await collection.dropIndex('email_1');
      console.log('✅ Índice "email_1" eliminado');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('ℹ️  El índice "email_1" no existe (ya fue eliminado)');
      } else {
        console.log('⚠️  Error al eliminar índice:', error.message);
      }
    }

    // Verificar si existe el índice correo_1
    const hasCorreoIndex = indexes.some(idx => idx.name === 'correo_1');
    
    if (!hasCorreoIndex) {
      console.log('\n📝 Creando índice "correo_1" con sparse:true...');
      await collection.createIndex({ correo: 1 }, { sparse: true });
      console.log('✅ Índice "correo_1" creado');
    } else {
      console.log('\nℹ️  El índice "correo_1" ya existe');
    }

    // Listar índices finales
    console.log('\n📋 Índices finales:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\n✅ Índices corregidos exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
  }
}

fixClientIndexes();
