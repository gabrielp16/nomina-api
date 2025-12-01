import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/morchis-nomina';

async function cleanClientIndexes() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    const collection = db.collection('clients');

    // Índices obsoletos que ya no se usan
    const obsoleteIndexes = [
      'isActive_1',  // Campo antiguo
      'nombre_1_apellido_1',  // apellido ya no existe
      'nombre_text_apellido_text_correo_text_numeroDocumento_text'  // Text index obsoleto
    ];

    console.log('\n🗑️  Eliminando índices obsoletos...\n');

    for (const indexName of obsoleteIndexes) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Eliminado: ${indexName}`);
      } catch (error: any) {
        if (error.code === 27) {
          console.log(`ℹ️  Ya eliminado: ${indexName}`);
        } else {
          console.log(`⚠️  Error con ${indexName}:`, error.message);
        }
      }
    }

    // Listar índices finales
    console.log('\n📋 Índices finales:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      const sparse = index.sparse ? ' (sparse)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${sparse}`);
    });

    console.log('\n✅ Limpieza completada');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
  }
}

cleanClientIndexes();
