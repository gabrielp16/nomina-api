import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Permission from './models/Permission.js';
import Role from './models/Role.js';
import User from './models/User.js';
import Employee from './models/Employee.js';
import { connectDB, disconnectDB } from './config/database.js';

// Load Railway environment variables
dotenv.config({ path: '.env.railway' });

console.log('🚀 Iniciando configuración Railway (modo producción)...');
console.log('MongoDB URI:', process.env.MONGODB_URI?.substring(0, 50) + '...');

// Verificar si es el primer deploy (base de datos vacía)
const isFirstDeploy = async (): Promise<boolean> => {
  const userCount = await User.countDocuments();
  const roleCount = await Role.countDocuments();
  return userCount === 0 && roleCount === 0;
};

// Configuración completa para primer deploy
const firstTimeSetup = async () => {
  console.log('🏗️ Primer deploy detectado - configuración completa...');
  
  // Importar y ejecutar seed completo
  const seedDatabase = (await import('./scripts/seed.js')).default;
  await seedDatabase(false); // false = no standalone mode
  
  console.log('✅ Configuración inicial completada');
  console.log('📋 Credenciales por defecto creadas:');
  console.log('   👤 Admin: admin@morchis.com / admin123');
  console.log('   👤 Usuario: usuario@morchis.com / usuario123');
  console.log('   👤 Empleado: empleado@morchis.com / empleado123');
  console.log('');
  console.log('⚠️  IMPORTANTE: Cambia las contraseñas por defecto después del primer acceso');
};

// Configuración de producción (preserva datos existentes)
const productionSync = async () => {
  console.log('🔄 Deploy en base de datos existente - sincronizando...');
  
  // Solo sincronizar permisos y roles, preservar usuarios
  const requiredPermissions = [
    { nombre: 'CREATE_USERS', descripcion: 'Crear nuevos usuarios', modulo: 'USUARIOS', accion: 'CREATE' },
    { nombre: 'READ_USERS', descripcion: 'Ver lista de usuarios', modulo: 'USUARIOS', accion: 'READ' },
    { nombre: 'UPDATE_USERS', descripcion: 'Actualizar información de usuarios', modulo: 'USUARIOS', accion: 'UPDATE' },
    { nombre: 'DELETE_USERS', descripcion: 'Eliminar usuarios del sistema', modulo: 'USUARIOS', accion: 'DELETE' },
    { nombre: 'MANAGE_USERS', descripcion: 'Gestión completa de usuarios', modulo: 'USUARIOS', accion: 'MANAGE' },
    { nombre: 'CREATE_ROLES', descripcion: 'Crear nuevos roles', modulo: 'ROLES', accion: 'CREATE' },
    { nombre: 'READ_ROLES', descripcion: 'Ver lista de roles', modulo: 'ROLES', accion: 'READ' },
    { nombre: 'UPDATE_ROLES', descripcion: 'Actualizar roles existentes', modulo: 'ROLES', accion: 'UPDATE' },
    { nombre: 'DELETE_ROLES', descripcion: 'Eliminar roles del sistema', modulo: 'ROLES', accion: 'DELETE' },
    { nombre: 'MANAGE_ROLES', descripcion: 'Gestión completa de roles', modulo: 'ROLES', accion: 'MANAGE' },
    { nombre: 'CREATE_PERMISSIONS', descripcion: 'Crear nuevos permisos', modulo: 'PERMISOS', accion: 'CREATE' },
    { nombre: 'READ_PERMISSIONS', descripcion: 'Ver lista de permisos', modulo: 'PERMISOS', accion: 'READ' },
    { nombre: 'UPDATE_PERMISSIONS', descripcion: 'Actualizar permisos existentes', modulo: 'PERMISOS', accion: 'UPDATE' },
    { nombre: 'DELETE_PERMISSIONS', descripcion: 'Eliminar permisos del sistema', modulo: 'PERMISOS', accion: 'DELETE' },
    { nombre: 'MANAGE_PERMISSIONS', descripcion: 'Gestión completa de permisos', modulo: 'PERMISOS', accion: 'MANAGE' },
    { nombre: 'READ_DASHBOARD', descripcion: 'Ver dashboard principal', modulo: 'DASHBOARD', accion: 'READ' },
    { nombre: 'READ_REPORTS', descripcion: 'Ver reportes del sistema', modulo: 'REPORTES', accion: 'READ' },
    { nombre: 'CREATE_REPORTS', descripcion: 'Generar nuevos reportes', modulo: 'REPORTES', accion: 'CREATE' },
    { nombre: 'READ_SETTINGS', descripcion: 'Ver configuración del sistema', modulo: 'CONFIGURACION', accion: 'READ' },
    { nombre: 'UPDATE_SETTINGS', descripcion: 'Actualizar configuración del sistema', modulo: 'CONFIGURACION', accion: 'UPDATE' },
    { nombre: 'MANAGE_SETTINGS', descripcion: 'Gestión completa de configuración', modulo: 'CONFIGURACION', accion: 'MANAGE' },
    { nombre: 'READ_AUDIT', descripcion: 'Ver logs de auditoría', modulo: 'AUDITORIA', accion: 'READ' },
    { nombre: 'CREATE_PAYROLL', descripcion: 'Crear registros de nómina', modulo: 'NOMINA', accion: 'CREATE' },
    { nombre: 'READ_PAYROLL', descripcion: 'Ver registros de nómina', modulo: 'NOMINA', accion: 'READ' },
    { nombre: 'UPDATE_PAYROLL', descripcion: 'Actualizar registros de nómina', modulo: 'NOMINA', accion: 'UPDATE' },
    { nombre: 'DELETE_PAYROLL', descripcion: 'Eliminar registros de nómina', modulo: 'NOMINA', accion: 'DELETE' },
    { nombre: 'MANAGE_PAYROLL', descripcion: 'Gestión completa de nómina', modulo: 'NOMINA', accion: 'MANAGE' },
  ];

  // Sincronizar permisos
  const permissionIds: mongoose.Types.ObjectId[] = [];
  for (const permData of requiredPermissions) {
    let permission = await Permission.findOne({ nombre: permData.nombre });
    if (!permission) {
      permission = new Permission(permData);
      await permission.save();
      console.log(`  ✓ Permiso agregado: ${permData.nombre}`);
    }
    permissionIds.push(permission._id);
  }

  console.log('✅ Permisos y roles sincronizados');
  console.log('👥 Usuarios existentes preservados (incluyendo contraseñas modificadas)');
};

const runSetup = async () => {
  try {
    await connectDB();
    console.log('✅ Conectado a MongoDB Atlas');
    
    if (await isFirstDeploy()) {
      await firstTimeSetup();
    } else {
      await productionSync();
    }
    
    console.log('🎉 Configuración Railway completada exitosamente!');
    
  } catch (error) {
    console.error('❌ Error en configuración Railway:', error);
    throw error;
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

runSetup();
