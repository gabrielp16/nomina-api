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
    { nombre: 'CREATE_ACTIVITY', descripcion: 'Crear registros en gestión de actividad', modulo: 'ACTIVITY', accion: 'CREATE' },
    { nombre: 'READ_ACTIVITY', descripcion: 'Ver gestión de actividad', modulo: 'ACTIVITY', accion: 'READ' },
    { nombre: 'UPDATE_ACTIVITY', descripcion: 'Actualizar registros en gestión de actividad', modulo: 'ACTIVITY', accion: 'UPDATE' },
    { nombre: 'DELETE_ACTIVITY', descripcion: 'Eliminar registros en gestión de actividad', modulo: 'ACTIVITY', accion: 'DELETE' },
    { nombre: 'MANAGE_ACTIVITY', descripcion: 'Gestión completa de actividad', modulo: 'ACTIVITY', accion: 'MANAGE' },
    { nombre: 'CREATE_CLIENTS', descripcion: 'Crear registros de clientes', modulo: 'CLIENTS', accion: 'CREATE' },
    { nombre: 'READ_CLIENTS', descripcion: 'Ver pantalla de clientes', modulo: 'CLIENTS', accion: 'READ' },
    { nombre: 'UPDATE_CLIENTS', descripcion: 'Actualizar registros de clientes', modulo: 'CLIENTS', accion: 'UPDATE' },
    { nombre: 'DELETE_CLIENTS', descripcion: 'Eliminar registros de clientes', modulo: 'CLIENTS', accion: 'DELETE' },
    { nombre: 'MANAGE_CLIENTS', descripcion: 'Gestión completa de clientes', modulo: 'CLIENTS', accion: 'MANAGE' },
    { nombre: 'CREATE_EMPLOYEES', descripcion: 'Crear registros de empleados', modulo: 'EMPLOYEES', accion: 'CREATE' },
    { nombre: 'READ_EMPLOYEES', descripcion: 'Ver pantalla de empleados', modulo: 'EMPLOYEES', accion: 'READ' },
    { nombre: 'UPDATE_EMPLOYEES', descripcion: 'Actualizar registros de empleados', modulo: 'EMPLOYEES', accion: 'UPDATE' },
    { nombre: 'DELETE_EMPLOYEES', descripcion: 'Eliminar registros de empleados', modulo: 'EMPLOYEES', accion: 'DELETE' },
    { nombre: 'MANAGE_EMPLOYEES', descripcion: 'Gestión completa de empleados', modulo: 'EMPLOYEES', accion: 'MANAGE' },
    { nombre: 'CREATE_PRODUCTS', descripcion: 'Crear registros de productos', modulo: 'PRODUCTS', accion: 'CREATE' },
    { nombre: 'READ_PRODUCTS', descripcion: 'Ver pantalla de productos', modulo: 'PRODUCTS', accion: 'READ' },
    { nombre: 'UPDATE_PRODUCTS', descripcion: 'Actualizar registros de productos', modulo: 'PRODUCTS', accion: 'UPDATE' },
    { nombre: 'DELETE_PRODUCTS', descripcion: 'Eliminar registros de productos', modulo: 'PRODUCTS', accion: 'DELETE' },
    { nombre: 'MANAGE_PRODUCTS', descripcion: 'Gestión completa de productos', modulo: 'PRODUCTS', accion: 'MANAGE' },
    { nombre: 'CREATE_INVENTORY', descripcion: 'Crear registros de inventario', modulo: 'INVENTORY', accion: 'CREATE' },
    { nombre: 'READ_INVENTORY', descripcion: 'Ver pantalla de inventario', modulo: 'INVENTORY', accion: 'READ' },
    { nombre: 'UPDATE_INVENTORY', descripcion: 'Actualizar registros de inventario', modulo: 'INVENTORY', accion: 'UPDATE' },
    { nombre: 'DELETE_INVENTORY', descripcion: 'Eliminar registros de inventario', modulo: 'INVENTORY', accion: 'DELETE' },
    { nombre: 'MANAGE_INVENTORY', descripcion: 'Gestión completa de inventario', modulo: 'INVENTORY', accion: 'MANAGE' },
    { nombre: 'CREATE_ORDERS', descripcion: 'Crear registros de órdenes', modulo: 'ORDERS', accion: 'CREATE' },
    { nombre: 'READ_ORDERS', descripcion: 'Ver pantalla de órdenes', modulo: 'ORDERS', accion: 'READ' },
    { nombre: 'UPDATE_ORDERS', descripcion: 'Actualizar registros de órdenes', modulo: 'ORDERS', accion: 'UPDATE' },
    { nombre: 'DELETE_ORDERS', descripcion: 'Eliminar registros de órdenes', modulo: 'ORDERS', accion: 'DELETE' },
    { nombre: 'MANAGE_ORDERS', descripcion: 'Gestión completa de órdenes', modulo: 'ORDERS', accion: 'MANAGE' },
    { nombre: 'CREATE_INVOICE_POS', descripcion: 'Crear registros de facturación POS', modulo: 'INVOICE_POS', accion: 'CREATE' },
    { nombre: 'READ_INVOICE_POS', descripcion: 'Ver pantalla de facturación POS', modulo: 'INVOICE_POS', accion: 'READ' },
    { nombre: 'UPDATE_INVOICE_POS', descripcion: 'Actualizar registros de facturación POS', modulo: 'INVOICE_POS', accion: 'UPDATE' },
    { nombre: 'DELETE_INVOICE_POS', descripcion: 'Eliminar registros de facturación POS', modulo: 'INVOICE_POS', accion: 'DELETE' },
    { nombre: 'MANAGE_INVOICE_POS', descripcion: 'Gestión completa de facturación POS', modulo: 'INVOICE_POS', accion: 'MANAGE' },
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
