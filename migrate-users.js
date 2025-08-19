import mongoose from 'mongoose';
import User from './models/User.js';

async function migrateUsers() {
  try {
    await mongoose.connect('mongodb://localhost:27017/morchis-nomina');
    console.log('✅ Conectado a MongoDB');
    
    // Buscar usuarios que tienen roleId pero no role
    const usersToMigrate = await User.find({
      $or: [
        { role: { $exists: false } },
        { role: null },
        { role: undefined }
      ],
      roleId: { $exists: true, $ne: null }
    });
    
    console.log(`\n🔄 Usuarios a migrar: ${usersToMigrate.length}`);
    
    for (const user of usersToMigrate) {
      console.log(`Migrando usuario: ${user.correo}`);
      
      // Actualizar usando updateOne para evitar problemas de validación
      await User.updateOne(
        { _id: user._id },
        { 
          $set: { role: user.roleId },
          $unset: { roleId: 1 }
        }
      );
      
      console.log(`✅ Usuario ${user.correo} migrado`);
    }
    
    console.log('\n🎉 Migración completada');
    
    // Verificar resultados
    const allUsers = await User.find({}).lean();
    console.log('\n📊 Estado final:');
    allUsers.forEach(user => {
      console.log(`  ${user.correo}: role=${user.role ? '✅' : '❌'}, roleId=${user.roleId ? '⚠️' : '✅'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

migrateUsers();
