// Script simple de migración usando mongoose directo
import mongoose from 'mongoose';

const LOCAL_DB = 'mongodb://localhost:27017/morchis-nomina';
const ATLAS_DB = 'mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function migrateData() {
    let localConnection = null;
    let atlasConnection = null;
    
    try {
        console.log('🚀 Iniciando migración a MongoDB Atlas...\n');
        
        // Conexión a MongoDB local
        console.log('🔄 Conectando a MongoDB local...');
        localConnection = await mongoose.connect(LOCAL_DB);
        const localDb = mongoose.connection.db;
        console.log('✅ Conectado a MongoDB local');
        
        // Obtener todas las colecciones de local
        console.log('\n📤 Obteniendo colecciones de MongoDB local...');
        const collections = await localDb.listCollections().toArray();
        console.log(`📋 Encontradas ${collections.length} colecciones:`);
        
        const data = {};
        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`  - ${collectionName}`);
            
            const documents = await localDb.collection(collectionName).find({}).toArray();
            data[collectionName] = documents;
            console.log(`    � ${documents.length} documentos`);
        }
        
        // Cerrar conexión local
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB local');
        
        // Conectar a Atlas
        console.log('\n🔄 Conectando a MongoDB Atlas...');
        atlasConnection = await mongoose.connect(ATLAS_DB);
        const atlasDb = mongoose.connection.db;
        console.log('✅ Conectado a MongoDB Atlas');
        
        // Migrar datos
        console.log('\n📥 Migrando datos a Atlas...');
        for (const [collectionName, documents] of Object.entries(data)) {
            if (documents.length > 0) {
                console.log(`\n🔄 Migrando ${collectionName}...`);
                
                // Limpiar colección existente
                await atlasDb.collection(collectionName).deleteMany({});
                
                // Insertar documentos
                await atlasDb.collection(collectionName).insertMany(documents);
                console.log(`  ✅ ${documents.length} documentos migrados`);
            }
        }
        
        console.log('\n🎊 ¡Migración completada exitosamente!');
        console.log('💡 Tu aplicación ahora puede usar MongoDB Atlas');
        
    } catch (error) {
        console.error('\n💥 Error durante la migración:', error.message);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('� Conexiones cerradas');
        }
    }
}

// Ejecutar migración
migrateData();
