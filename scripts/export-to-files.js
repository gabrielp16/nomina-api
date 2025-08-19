// Script para exportar todas las colecciones a archivos JSON
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_DB = 'mongodb://localhost:27017/morchis-nomina';

async function exportToFiles() {
    try {
        console.log('🚀 EXPORTADOR DE COLECCIONES LOCALES');
        console.log('=' .repeat(50));
        
        console.log('🔄 Conectando a MongoDB local...');
        await mongoose.connect(LOCAL_DB);
        const db = mongoose.connection.db;
        console.log('✅ Conectado a MongoDB local\n');
        
        // Crear carpeta de backup
        const backupDir = path.join(__dirname, 'backup-collections');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }
        console.log(`📁 Carpeta de backup: ${backupDir}\n`);
        
        const collections = await db.listCollections().toArray();
        console.log(`📂 Exportando ${collections.length} colecciones...\n`);
        
        let totalExported = 0;
        const exportSummary = {};
        
        for (const collection of collections) {
            const collectionName = collection.name;
            console.log(`🔄 Exportando ${collectionName}...`);
            
            try {
                const documents = await db.collection(collectionName).find({}).toArray();
                
                // Guardar en archivo JSON
                const fileName = `${collectionName}.json`;
                const filePath = path.join(backupDir, fileName);
                
                fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
                
                totalExported += documents.length;
                exportSummary[collectionName] = documents.length;
                
                console.log(`✅ ${documents.length} documentos → ${fileName}`);
                
            } catch (error) {
                console.log(`❌ Error exportando ${collectionName}: ${error.message}`);
                exportSummary[collectionName] = `Error: ${error.message}`;
            }
        }
        
        // Crear archivo de resumen
        const summaryPath = path.join(backupDir, 'export-summary.json');
        const summaryData = {
            exportDate: new Date().toISOString(),
            totalCollections: collections.length,
            totalDocuments: totalExported,
            collections: exportSummary,
            connectionString: LOCAL_DB
        };
        
        fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
        
        console.log('\n' + '=' .repeat(50));
        console.log('🎊 ¡EXPORTACIÓN COMPLETADA!');
        console.log(`📊 Total: ${totalExported} documentos exportados`);
        console.log(`📁 Ubicación: ${backupDir}`);
        console.log('\n📋 Archivos creados:');
        
        const files = fs.readdirSync(backupDir);
        files.forEach(file => {
            const filePath = path.join(backupDir, file);
            const stats = fs.statSync(filePath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            console.log(`  📄 ${file} (${sizeKB} KB)`);
        });
        
        console.log('\n💡 Para usar en otra máquina:');
        console.log('1. Copia toda la carpeta "backup-collections"');
        console.log('2. Usa el script import-from-files.js');
        
    } catch (error) {
        console.error('❌ Error durante la exportación:', error.message);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
            console.log('\n🔌 Desconectado de MongoDB');
        }
        process.exit(0);
    }
}

exportToFiles();
