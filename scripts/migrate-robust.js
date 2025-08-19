// Script de migración mejorado con mejor manejo de errores
import mongoose from 'mongoose';

const LOCAL_DB = 'mongodb://localhost:27017/morchis-nomina';
const ATLAS_DB = 'mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/morchis-nomina?retryWrites=true&w=majority&appName=Cluster0';

async function testConnections() {
    console.log('🔧 Probando conexiones...\n');
    
    // Probar conexión local
    try {
        console.log('🔄 Probando MongoDB local...');
        await mongoose.connect(LOCAL_DB, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ MongoDB local: CONECTADO');
        await mongoose.disconnect();
    } catch (error) {
        console.log('❌ MongoDB local: NO DISPONIBLE');
        console.log('   Error:', error.message);
        return false;
    }
    
    // Probar conexión Atlas
    try {
        console.log('🔄 Probando MongoDB Atlas...');
        await mongoose.connect(ATLAS_DB, { serverSelectionTimeoutMS: 10000 });
        console.log('✅ MongoDB Atlas: CONECTADO');
        await mongoose.disconnect();
        return true;
    } catch (error) {
        console.log('❌ MongoDB Atlas: NO DISPONIBLE');
        console.log('   Error:', error.message);
        
        if (error.message.includes('IP')) {
            console.log('\n💡 SOLUCIÓN:');
            console.log('1. Ve a https://cloud.mongodb.com/');
            console.log('2. Selecciona tu proyecto');
            console.log('3. Ve a "Network Access"');
            console.log('4. Haz clic en "ADD IP ADDRESS"');
            console.log('5. Selecciona "ALLOW ACCESS FROM ANYWHERE"');
            console.log('6. Confirma y espera 2-3 minutos');
            console.log('7. Ejecuta este script nuevamente\n');
        }
        return false;
    }
}

async function exportData() {
    console.log('📤 Exportando datos desde MongoDB local...\n');
    
    try {
        await mongoose.connect(LOCAL_DB);
        const db = mongoose.connection.db;
        
        const collections = await db.listCollections().toArray();
        console.log(`📋 Encontradas ${collections.length} colecciones:\n`);
        
        const exportData = {};
        let totalDocuments = 0;
        
        for (const collection of collections) {
            const collectionName = collection.name;
            const documents = await db.collection(collectionName).find({}).toArray();
            exportData[collectionName] = documents;
            totalDocuments += documents.length;
            
            console.log(`✅ ${collectionName}: ${documents.length} documentos`);
        }
        
        await mongoose.disconnect();
        
        console.log(`\n📊 Total: ${totalDocuments} documentos exportados`);
        return exportData;
        
    } catch (error) {
        console.error('❌ Error exportando datos:', error.message);
        throw error;
    }
}

async function importData(data) {
    console.log('\n📥 Importando datos a MongoDB Atlas...\n');
    
    try {
        await mongoose.connect(ATLAS_DB);
        const db = mongoose.connection.db;
        
        let totalImported = 0;
        
        for (const [collectionName, documents] of Object.entries(data)) {
            if (documents.length > 0) {
                console.log(`🔄 Importando ${collectionName}...`);
                
                // Limpiar colección existente
                await db.collection(collectionName).deleteMany({});
                
                // Insertar documentos en lotes para evitar timeouts
                const batchSize = 100;
                for (let i = 0; i < documents.length; i += batchSize) {
                    const batch = documents.slice(i, i + batchSize);
                    await db.collection(collectionName).insertMany(batch);
                }
                
                totalImported += documents.length;
                console.log(`✅ ${documents.length} documentos importados`);
            } else {
                console.log(`⚠️  ${collectionName}: colección vacía, omitiendo`);
            }
        }
        
        await mongoose.disconnect();
        
        console.log(`\n🎊 ¡Migración completada!`);
        console.log(`📊 Total importado: ${totalImported} documentos`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Error importando datos:', error.message);
        throw error;
    }
}

async function migrate() {
    try {
        console.log('🚀 MIGRACIÓN A MONGODB ATLAS\n');
        console.log('=' .repeat(40) + '\n');
        
        // Paso 1: Probar conexiones
        const canConnect = await testConnections();
        if (!canConnect) {
            console.log('❌ No se puede conectar a Atlas. Configura el acceso primero.');
            process.exit(1);
        }
        
        console.log('\n' + '='.repeat(40));
        
        // Paso 2: Exportar datos
        const data = await exportData();
        
        console.log('\n' + '='.repeat(40));
        
        // Paso 3: Importar datos
        await importData(data);
        
        console.log('\n' + '='.repeat(40));
        console.log('🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
        console.log('💡 Tu aplicación ahora puede usar MongoDB Atlas');
        
    } catch (error) {
        console.error('\n💥 ERROR DURANTE LA MIGRACIÓN:', error.message);
        console.error('\n📞 Si el problema persiste, verifica:');
        console.error('1. Que MongoDB local esté corriendo');
        console.error('2. Que el acceso de red esté configurado en Atlas');
        console.error('3. Que las credenciales de Atlas sean correctas');
        process.exit(1);
    }
}

// Ejecutar migración
migrate();
