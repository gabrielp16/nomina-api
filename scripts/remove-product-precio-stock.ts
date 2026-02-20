import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://localhost:27017/morchis-nomina';

async function removeProductPrecioStock() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    const collection = db.collection('products');

    // Eliminar los campos precio y stock de todos los documentos
    console.log('\n🔄 Eliminando campos "precio" y "stock" de todos los productos...');
    const result = await collection.updateMany(
      {
        $or: [
          { precio: { $exists: true } },
          { stock: { $exists: true } }
        ]
      },
      {
        $unset: { precio: '', stock: '' }
      }
    );
    console.log(`✅ Campos eliminados de ${result.modifiedCount} productos`);

    // Verificar algunos documentos
    console.log('\n📋 Verificando productos actualizados...');
    const sampleProducts = await collection.find({}).limit(3).toArray();
    sampleProducts.forEach((product, index) => {
      console.log(`\nProducto ${index + 1}:`);
      console.log(`  - Nombre: ${product.nombre}`);
      console.log(`  - Unidad: ${product.unidad}`);
      console.log(`  - Descripción: ${product.descripcion || 'N/A'}`);
      console.log(`  - Tiene precio: ${product.precio !== undefined ? 'SÍ ❌' : 'NO ✅'}`);
      console.log(`  - Tiene stock: ${product.stock !== undefined ? 'SÍ ❌' : 'NO ✅'}`);
    });

    console.log('\n✅ Migración completada exitosamente');
    console.log('\n💡 Nota: Los precios ahora se manejan por cliente en la tabla de precios');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 Conexión cerrada');
  }
}

removeProductPrecioStock();
