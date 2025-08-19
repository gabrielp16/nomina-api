// Script para ver colecciones de MongoDB local
import mongoose from 'mongoose';

const LOCAL_DB = 'mongodb://localhost:27017/morchis-nomina';

async function showCollections() {
    try {
        console.log('🔄 Conectando a MongoDB local...');
        await mongoose.connect(LOCAL_DB);
        const db = mongoose.connection.db;
        console.log('✅ Conectado a MongoDB local\n');
        
        console.log('📋 BASE DE DATOS: morchis-nomina');
        console.log('=' .repeat(50));
        
        const collections = await db.listCollections().toArray();
        
        if (collections.length === 0) {
            console.log('📭 No se encontraron colecciones');
            return;
        }
        
        console.log(`📂 Encontradas ${collections.length} colecciones:\n`);
        
        let totalDocuments = 0;
        
        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`📂 ${collectionName}`);
            
            try {
                const count = await db.collection(collectionName).countDocuments();
                totalDocuments += count;
                console.log(`   📊 ${count} documentos`);
                
                // Mostrar algunos campos del primer documento
                const sampleDoc = await db.collection(collectionName).findOne();
                if (sampleDoc) {
                    const fields = Object.keys(sampleDoc).slice(0, 5).join(', ');
                    console.log(`   🏷️  Campos: ${fields}${Object.keys(sampleDoc).length > 5 ? '...' : ''}`);
                }
                console.log();
            } catch (error) {
                console.log(`   ❌ Error al contar documentos: ${error.message}\n`);
            }
        }
        
        console.log('=' .repeat(50));
        console.log(`📊 TOTAL: ${totalDocuments} documentos en ${collections.length} colecciones`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.log('\n💡 SOLUCIÓN:');
            console.log('1. Asegúrate de que MongoDB esté corriendo');
            console.log('2. Verifica que esté en el puerto 27017');
            console.log('3. Prueba ejecutar: mongod');
        }
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('\n🔌 Desconectado de MongoDB');
        }
        process.exit(0);
    }
}

showCollections();
