import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

const updateEmployeePermissions = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('🔗 Conectado a la base de datos');
    
    // Find the Empleado role
    const empleadoRole = await Role.findOne({ nombre: 'Empleado' });
    if (!empleadoRole) {
      console.error('❌ No se encontró el rol Empleado');
      return;
    }
    
    console.log('👤 Rol Empleado encontrado');
    
    // Find the required permissions
    const requiredPermissions = await Permission.find({
      nombre: {
        $in: ['READ_DASHBOARD', 'READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL']
      }
    });
    
    console.log(`🔑 Permisos encontrados: ${requiredPermissions.length}`);
    requiredPermissions.forEach(p => console.log(`  - ${p.nombre}`));
    
    // Update the role with new permissions
    empleadoRole.permisos = requiredPermissions.map(p => p._id);
    await empleadoRole.save();
    
    console.log('✅ Rol Empleado actualizado con nuevos permisos');
    console.log('📋 Permisos asignados:');
    console.log('  - READ_DASHBOARD');
    console.log('  - READ_PAYROLL');
    console.log('  - CREATE_PAYROLL');
    console.log('  - UPDATE_PAYROLL');
    
  } catch (error) {
    console.error('❌ Error actualizando permisos:', error);
    throw error;
  } finally {
    await disconnectDB();
    console.log('📦 Conexión cerrada');
    process.exit(0);
  }
};

updateEmployeePermissions();
