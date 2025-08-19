// Script para probar la conexión a MongoDB Atlas
import mongoose from 'mongoose';

const ATLAS_DB = 'mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/morchis-nomina?retryWrites=true&w=majority&appName=Cluster0';

async function testAtlasConnection() {
    try {
        console.log('🔄 Probando conexión a MongoDB Atlas...');
        console.log('🌐 URL:', ATLAS_DB.replace(/:[^:@]*@/, ':****@'));
        
        await mongoose.connect(ATLAS_DB, {
            serverSelectionTimeoutMS: 10000, // 10 segundos de timeout
        });
        
        console.log('✅ ¡Conexión a MongoDB Atlas exitosa!');
        
        // Probar una operación básica
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        console.log(`📋 Colecciones encontradas: ${collections.length}`);
        if (collections.length > 0) {
            console.log('📂 Colecciones disponibles:');
            collections.forEach(col => {
                console.log(`  - ${col.name}`);
            });
        } else {
            console.log('📭 Base de datos vacía - lista para recibir datos');
        }
        
        await mongoose.disconnect();
        console.log('🔌 Desconectado de Atlas');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error conectando a Atlas:');
        console.error('Mensaje:', error.message);
        
        if (error.message.includes('IP')) {
            console.log('\n💡 Solución:');
            console.log('1. Ve a https://cloud.mongodb.com/');
            console.log('2. Selecciona tu proyecto/cluster');
            console.log('3. Ve a "Network Access" en el menú lateral');
            console.log('4. Haz clic en "ADD IP ADDRESS"');
            console.log('5. Selecciona "ALLOW ACCESS FROM ANYWHERE"');
            console.log('6. Espera 2-3 minutos y prueba nuevamente');
        }
        
        return false;
    }
}

// Ejecutar prueba
testAtlasConnection()
    .then(success => {
        if (success) {
            console.log('\n🎉 Atlas está listo para usar!');
            console.log('💡 Ahora puedes iniciar tu aplicación normalmente');
        } else {
            console.log('\n⚠️ Configura el acceso en Atlas y prueba nuevamente');
        }
        process.exit(success ? 0 : 1);
    });
