import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Para obtener __dirname en ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar modelos
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import Activity from '../models/Activity.js';

// Configuración de conexiones
const LOCAL_DB = 'mongodb://localhost:27017/morchis-nomina';
const ATLAS_DB = 'mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function exportFromLocal() {
    console.log('🔄 Conectando a MongoDB local...');
    await mongoose.connect(LOCAL_DB);
    
    const data = {};
    
    try {
        // Exportar todas las colecciones
        console.log('📤 Exportando usuarios...');
        data.users = await User.find({});
        console.log(`✅ ${data.users.length} usuarios exportados`);
        
        console.log('📤 Exportando empleados...');
        data.employees = await Employee.find({});
        console.log(`✅ ${data.employees.length} empleados exportados`);
        
        console.log('📤 Exportando roles...');
        data.roles = await Role.find({});
        console.log(`✅ ${data.roles.length} roles exportados`);
        
        console.log('📤 Exportando permisos...');
        data.permissions = await Permission.find({});
        console.log(`✅ ${data.permissions.length} permisos exportados`);
        
        console.log('📤 Exportando actividades...');
        data.activities = await Activity.find({});
        console.log(`✅ ${data.activities.length} actividades exportadas`);
        
        // Guardar datos en archivo JSON
        const backupPath = path.join(__dirname, 'backup-data.json');
        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
        console.log(`💾 Datos guardados en: ${backupPath}`);
        
    } catch (error) {
        console.error('❌ Error exportando datos:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB local');
    }
    
    return data;
}

async function importToAtlas(data) {
    console.log('🔄 Conectando a MongoDB Atlas...');
    
    await mongoose.connect(ATLAS_DB);
    
    try {
        // Limpiar colecciones existentes (opcional)
        console.log('🧹 Limpiando colecciones existentes en Atlas...');
        await User.deleteMany({});
        await Employee.deleteMany({});
        await Role.deleteMany({});
        await Permission.deleteMany({});
        await Activity.deleteMany({});
        
        // Importar datos
        if (data.roles && data.roles.length > 0) {
            console.log('📥 Importando roles...');
            await Role.insertMany(data.roles);
            console.log(`✅ ${data.roles.length} roles importados`);
        }
        
        if (data.permissions && data.permissions.length > 0) {
            console.log('📥 Importando permisos...');
            await Permission.insertMany(data.permissions);
            console.log(`✅ ${data.permissions.length} permisos importados`);
        }
        
        if (data.users && data.users.length > 0) {
            console.log('📥 Importando usuarios...');
            await User.insertMany(data.users);
            console.log(`✅ ${data.users.length} usuarios importados`);
        }
        
        if (data.employees && data.employees.length > 0) {
            console.log('📥 Importando empleados...');
            await Employee.insertMany(data.employees);
            console.log(`✅ ${data.employees.length} empleados importados`);
        }
        
        if (data.activities && data.activities.length > 0) {
            console.log('📥 Importando actividades...');
            await Activity.insertMany(data.activities);
            console.log(`✅ ${data.activities.length} actividades importadas`);
        }
        
        console.log('🎉 Migración completada exitosamente!');
        
    } catch (error) {
        console.error('❌ Error importando datos a Atlas:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Desconectado de MongoDB Atlas');
    }
}

async function migrate() {
    try {
        console.log('🚀 Iniciando migración a MongoDB Atlas...\n');
        
        // Paso 1: Exportar desde local
        const data = await exportFromLocal();
        
        console.log('\n📊 Resumen de datos exportados:');
        console.log(`- Usuarios: ${data.users?.length || 0}`);
        console.log(`- Empleados: ${data.employees?.length || 0}`);
        console.log(`- Roles: ${data.roles?.length || 0}`);
        console.log(`- Permisos: ${data.permissions?.length || 0}`);
        console.log(`- Actividades: ${data.activities?.length || 0}`);
        
        // Paso 2: Importar a Atlas
        console.log('\n🔄 Iniciando importación a Atlas...');
        await importToAtlas(data);
        
        console.log('\n🎊 ¡Migración completada exitosamente!');
        console.log('💡 Ahora puedes actualizar tu .env para usar Atlas permanentemente');
        
    } catch (error) {
        console.error('\n💥 Error durante la migración:', error);
        process.exit(1);
    }
}

// Ejecutar solo si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    migrate();
}

export { migrate, exportFromLocal, importToAtlas };
