import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

async function addActivityPermission() {
  try {
    await connectDB();
    console.log('🔄 Agregando permiso READ_ACTIVITY...');

    // Verificar si el permiso ya existe
    const existingPermission = await Permission.findOne({ nombre: 'READ_ACTIVITY' });
    
    if (!existingPermission) {
      // Crear el permiso READ_ACTIVITY
      const activityPermission = new Permission({
        nombre: 'READ_ACTIVITY',
        descripcion: 'Permite leer el registro de actividades del sistema',
        modulo: 'ACTIVITY',
        accion: 'READ'
      });

      await activityPermission.save();
      console.log('✅ Permiso READ_ACTIVITY creado exitosamente');

      // Agregar el permiso al rol Super Administrador
      const superAdminRole = await Role.findOne({ name: 'Super Administrador' });
      if (superAdminRole) {
        if (!superAdminRole.permisos.includes(activityPermission._id)) {
          superAdminRole.permisos.push(activityPermission._id);
          await superAdminRole.save();
          console.log('✅ Permiso READ_ACTIVITY agregado al rol Super Administrador');
        }
      }

      // Agregar el permiso al rol Administrador
      const adminRole = await Role.findOne({ name: 'Administrador' });
      if (adminRole) {
        if (!adminRole.permisos.includes(activityPermission._id)) {
          adminRole.permisos.push(activityPermission._id);
          await adminRole.save();
          console.log('✅ Permiso READ_ACTIVITY agregado al rol Administrador');
        }
      }
    } else {
      console.log('⚠️ El permiso READ_ACTIVITY ya existe');
    }

    console.log('🎉 Proceso completado exitosamente');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDB();
  }
}

addActivityPermission();
