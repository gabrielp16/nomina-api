import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

async function updateUsersWithActivityPermission() {
  try {
    await connectDB();
    console.log('🔄 Actualizando usuarios con permisos de actividad...');

    // 1. Verificar que el permiso READ_ACTIVITY existe
    let activityPermission = await Permission.findOne({ nombre: 'READ_ACTIVITY' });
    
    if (!activityPermission) {
      console.log('⚠️ Permiso READ_ACTIVITY no encontrado, creándolo...');
      activityPermission = new Permission({
        nombre: 'READ_ACTIVITY',
        descripcion: 'Permite leer el registro de actividades del sistema',
        modulo: 'ACTIVITY',
        accion: 'READ'
      });
      await activityPermission.save();
      console.log('✅ Permiso READ_ACTIVITY creado');
    }

    // 2. Obtener todos los roles
    const superAdminRole = await Role.findOne({ name: 'Super Administrador' });
    const adminRole = await Role.findOne({ name: 'Administrador' });
    const userRole = await Role.findOne({ name: 'Usuario' });

    // 3. Agregar el permiso READ_ACTIVITY a los roles Super Administrador y Administrador
    if (superAdminRole && !superAdminRole.permisos.includes(activityPermission._id)) {
      superAdminRole.permisos.push(activityPermission._id);
      await superAdminRole.save();
      console.log('✅ Permiso READ_ACTIVITY agregado al rol Super Administrador');
    }

    if (adminRole && !adminRole.permisos.includes(activityPermission._id)) {
      adminRole.permisos.push(activityPermission._id);
      await adminRole.save();
      console.log('✅ Permiso READ_ACTIVITY agregado al rol Administrador');
    }

    // 4. También agregar al rol Usuario para que puedan ver actividad
    if (userRole && !userRole.permisos.includes(activityPermission._id)) {
      userRole.permisos.push(activityPermission._id);
      await userRole.save();
      console.log('✅ Permiso READ_ACTIVITY agregado al rol Usuario');
    }

    // 5. Crear un tercer usuario (Supervisor) si no existe
    const supervisorRole = await Role.findOne({ name: 'Supervisor' });
    if (supervisorRole) {
      // Agregar permiso READ_ACTIVITY al rol Supervisor también
      if (!supervisorRole.permisos.includes(activityPermission._id)) {
        supervisorRole.permisos.push(activityPermission._id);
        await supervisorRole.save();
        console.log('✅ Permiso READ_ACTIVITY agregado al rol Supervisor');
      }

      // Verificar si ya existe el usuario supervisor
      const existingSupervisor = await User.findOne({ correo: 'supervisor@morchis.com' });
      
      if (!existingSupervisor) {
        const supervisorUser = new User({
          nombre: 'María',
          apellido: 'García',
          correo: 'supervisor@morchis.com',
          numeroCelular: '+1122334455',
          password: 'supervisor123',
          role: supervisorRole._id,
          isActive: true,
          emailVerified: true,
          authProvider: 'local'
        });

        await supervisorUser.save();
        console.log('✅ Usuario supervisor creado: supervisor@morchis.com / supervisor123');
      } else {
        console.log('⚠️ Usuario supervisor ya existe');
      }
    }

    // 6. Verificar usuarios existentes y sus permisos
    console.log('\n📋 Verificando usuarios con acceso a actividad:');
    
    const usersWithActivity = await User.find({})
      .populate({
        path: 'role',
        populate: {
          path: 'permisos'
        }
      });

    for (const user of usersWithActivity) {
      if (user.role && typeof user.role === 'object' && 'permisos' in user.role) {
        const role = user.role as any;
        const hasActivityPermission = role.permisos?.some((perm: any) => 
          perm.nombre === 'READ_ACTIVITY'
        );
        console.log(`  👤 ${user.correo} (${role.name}) - ${hasActivityPermission ? '✅ Tiene acceso' : '❌ Sin acceso'}`);
      } else {
        console.log(`  👤 ${user.correo} (Sin rol) - ❌ Sin acceso`);
      }
    }

    console.log('\n🎉 Proceso de actualización completado exitosamente!');
    
    console.log('\n📋 Credenciales de acceso actualizadas:');
    console.log('   👤 Super Admin: admin@morchis.com / admin123');
    console.log('   👤 Usuario Prueba: usuario@morchis.com / usuario123');
    console.log('   👤 Supervisor: supervisor@morchis.com / supervisor123');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDB();
  }
}

updateUsersWithActivityPermission();
