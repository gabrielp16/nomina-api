import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/morchis-nomina';

async function removeProductCategoria() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    const collection = db.collection('products');

    // Listar índices actuales
    console.log('\n📋 Índices actuales:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      const sparse = index.sparse ? ' (sparse)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${sparse}`);
    });

    // Eliminar el índice de categoria si existe
    try {
      console.log('\n🗑️  Eliminando índice "categoria_1"...');
      await collection.dropIndex('categoria_1');
      console.log('✅ Índice "categoria_1" eliminado');
    } catch (error: any) {
      if (error.code === 27) {
        console.log('ℹ️  El índice "categoria_1" no existe (ya fue eliminado)');
      } else {
        console.log('⚠️  Error al eliminar índice:', error.message);
      }
    }

    // Eliminar el campo categoria de todos los documentos
    console.log('\n🔄 Eliminando campo "categoria" de todos los productos...');
    const result = await collection.updateMany(
      { categoria: { $exists: true } },
      { $unset: { categoria: '' } }
    );
    console.log(`✅ Campo "categoria" eliminado de ${result.modifiedCount} productos`);

    // Listar índices finales
    console.log('\n📋 Índices finales:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      const sparse = index.sparse ? ' (sparse)' : '';
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}${sparse}`);
    });

    console.log('\n✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
  }
}

removeProductCategoria();
