// Script para importar colecciones desde archivos JSON a Atlas
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ATLAS_DB = 'mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/morchis-nomina?retryWrites=true&w=majority&appName=Cluster0';

async function importFromFiles() {
    try {
        console.log('🚀 IMPORTADOR DE COLECCIONES A ATLAS');
        console.log('=' .repeat(50));
        
        const backupDir = path.join(__dirname, 'backup-collections');
        
        // Verificar que existe la carpeta de backup
        if (!fs.existsSync(backupDir)) {
            console.log('❌ No se encontró la carpeta backup-collections');
            console.log('💡 Primero ejecuta export-to-files.js o copia la carpeta desde la máquina origen');
            process.exit(1);
        }
        
        // Leer resumen de exportación
        const summaryPath = path.join(backupDir, 'export-summary.json');
        let exportSummary = null;
        
        if (fs.existsSync(summaryPath)) {
            exportSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
            console.log(`📊 Backup del: ${new Date(exportSummary.exportDate).toLocaleString()}`);
            console.log(`📂 ${exportSummary.totalCollections} colecciones, ${exportSummary.totalDocuments} documentos\n`);
        }
        
        console.log('🔄 Conectando a MongoDB Atlas...');
        await mongoose.connect(ATLAS_DB, { serverSelectionTimeoutMS: 10000 });
        const db = mongoose.connection.db;
        console.log('✅ Conectado a MongoDB Atlas\n');
        
        // Buscar archivos JSON
        const files = fs.readdirSync(backupDir).filter(file => 
            file.endsWith('.json') && file !== 'export-summary.json'
        );
        
        if (files.length === 0) {
            console.log('❌ No se encontraron archivos de colecciones para importar');
            process.exit(1);
        }
        
        console.log(`📥 Importando ${files.length} colecciones...\n`);
        
        let totalImported = 0;
        
        for (const file of files) {
            const collectionName = file.replace('.json', '');
            const filePath = path.join(backupDir, file);
            
            console.log(`🔄 Importando ${collectionName}...`);
            
            try {
                const fileContent = fs.readFileSync(filePath, 'utf8');
                const documents = JSON.parse(fileContent);
                
                if (!Array.isArray(documents)) {
                    console.log(`⚠️  ${collectionName}: formato inválido, omitiendo...`);
                    continue;
                }
                
                if (documents.length === 0) {
                    console.log(`⚠️  ${collectionName}: vacía, omitiendo...`);
                    continue;
                }
                
                // Limpiar colección existente
                await db.collection(collectionName).deleteMany({});
                
                // Insertar en lotes
                const batchSize = 100;
                for (let i = 0; i < documents.length; i += batchSize) {
                    const batch = documents.slice(i, i + batchSize);
                    await db.collection(collectionName).insertMany(batch);
                }
                
                totalImported += documents.length;
                console.log(`✅ ${documents.length} documentos importados`);
                
            } catch (error) {
                console.log(`❌ Error importando ${collectionName}: ${error.message}`);
            }
        }
        
        console.log('\n' + '=' .repeat(50));
        console.log('🎊 ¡IMPORTACIÓN COMPLETADA!');
        console.log(`📊 Total: ${totalImported} documentos importados a Atlas`);
        console.log('💡 Verifica en https://cloud.mongodb.com/ → Browse Collections');
        
    } catch (error) {
        console.error('❌ Error durante la importación:', error.message);
        
        if (error.message.includes('IP')) {
            console.log('\n💡 SOLUCIÓN:');
            console.log('1. Configura Network Access en MongoDB Atlas');
            console.log('2. Permite acceso desde cualquier lugar (0.0.0.0/0)');
        }
        
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('\n🔌 Desconectado de Atlas');
        }
        process.exit(0);
    }
}

importFromFiles();
