import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Permission from './models/Permission.js';
import Role from './models/Role.js';
import User from './models/User.js';
import { connectDB, disconnectDB } from './config/database.js';

// Cargar variables de entorno
dotenv.config({ path: '.env.railway' });

console.log('🚀 Iniciando configuración de producción (preservando datos)...');
console.log('MongoDB URI:', process.env.MONGODB_URI?.substring(0, 50) + '...');

// Permisos requeridos del sistema (se crearán solo si no existen)
const requiredPermissions = [
  // Permisos de usuarios
  { nombre: 'CREATE_USERS', descripcion: 'Crear nuevos usuarios', modulo: 'USUARIOS', accion: 'CREATE' },
  { nombre: 'READ_USERS', descripcion: 'Ver lista de usuarios', modulo: 'USUARIOS', accion: 'READ' },
  { nombre: 'UPDATE_USERS', descripcion: 'Actualizar información de usuarios', modulo: 'USUARIOS', accion: 'UPDATE' },
  { nombre: 'DELETE_USERS', descripcion: 'Eliminar usuarios del sistema', modulo: 'USUARIOS', accion: 'DELETE' },
  { nombre: 'MANAGE_USERS', descripcion: 'Gestión completa de usuarios', modulo: 'USUARIOS', accion: 'MANAGE' },

  // Permisos de roles
  { nombre: 'CREATE_ROLES', descripcion: 'Crear nuevos roles', modulo: 'ROLES', accion: 'CREATE' },
  { nombre: 'READ_ROLES', descripcion: 'Ver lista de roles', modulo: 'ROLES', accion: 'READ' },
  { nombre: 'UPDATE_ROLES', descripcion: 'Actualizar roles existentes', modulo: 'ROLES', accion: 'UPDATE' },
  { nombre: 'DELETE_ROLES', descripcion: 'Eliminar roles del sistema', modulo: 'ROLES', accion: 'DELETE' },
  { nombre: 'MANAGE_ROLES', descripcion: 'Gestión completa de roles', modulo: 'ROLES', accion: 'MANAGE' },

  // Permisos de permisos
  { nombre: 'CREATE_PERMISSIONS', descripcion: 'Crear nuevos permisos', modulo: 'PERMISOS', accion: 'CREATE' },
  { nombre: 'READ_PERMISSIONS', descripcion: 'Ver lista de permisos', modulo: 'PERMISOS', accion: 'READ' },
  { nombre: 'UPDATE_PERMISSIONS', descripcion: 'Actualizar permisos existentes', modulo: 'PERMISOS', accion: 'UPDATE' },
  { nombre: 'DELETE_PERMISSIONS', descripcion: 'Eliminar permisos del sistema', modulo: 'PERMISOS', accion: 'DELETE' },
  { nombre: 'MANAGE_PERMISSIONS', descripcion: 'Gestión completa de permisos', modulo: 'PERMISOS', accion: 'MANAGE' },

  // Permisos del dashboard
  { nombre: 'READ_DASHBOARD', descripcion: 'Ver dashboard principal', modulo: 'DASHBOARD', accion: 'READ' },
  { nombre: 'READ_REPORTS', descripcion: 'Ver reportes del sistema', modulo: 'REPORTES', accion: 'READ' },
  { nombre: 'CREATE_REPORTS', descripcion: 'Generar nuevos reportes', modulo: 'REPORTES', accion: 'CREATE' },

  // Permisos de configuración
  { nombre: 'READ_SETTINGS', descripcion: 'Ver configuración del sistema', modulo: 'CONFIGURACION', accion: 'READ' },
  { nombre: 'UPDATE_SETTINGS', descripcion: 'Actualizar configuración del sistema', modulo: 'CONFIGURACION', accion: 'UPDATE' },
  { nombre: 'MANAGE_SETTINGS', descripcion: 'Gestión completa de configuración', modulo: 'CONFIGURACION', accion: 'MANAGE' },

  // Permisos de auditoría
  { nombre: 'READ_AUDIT', descripcion: 'Ver logs de auditoría', modulo: 'AUDITORIA', accion: 'READ' },
  
  // Permisos de nómina
  { nombre: 'CREATE_PAYROLL', descripcion: 'Crear registros de nómina', modulo: 'NOMINA', accion: 'CREATE' },
  { nombre: 'READ_PAYROLL', descripcion: 'Ver registros de nómina', modulo: 'NOMINA', accion: 'READ' },
  { nombre: 'UPDATE_PAYROLL', descripcion: 'Actualizar registros de nómina', modulo: 'NOMINA', accion: 'UPDATE' },
  { nombre: 'DELETE_PAYROLL', descripcion: 'Eliminar registros de nómina', modulo: 'NOMINA', accion: 'DELETE' },
  { nombre: 'MANAGE_PAYROLL', descripcion: 'Gestión completa de nómina', modulo: 'NOMINA', accion: 'MANAGE' },
];

// Función para sincronizar permisos (crear solo los que faltan)
const syncPermissions = async (): Promise<mongoose.Types.ObjectId[]> => {
  console.log('🔄 Sincronizando permisos del sistema...');
  
  const permissionIds: mongoose.Types.ObjectId[] = [];
  
  for (const permissionData of requiredPermissions) {
    let permission = await Permission.findOne({ nombre: permissionData.nombre });
    
    if (!permission) {
      permission = new Permission(permissionData);
      await permission.save();
      console.log(`  ✓ Permiso creado: ${permissionData.nombre}`);
    } else {
      // Actualizar descripción si ha cambiado
      if (permission.descripcion !== permissionData.descripcion) {
        permission.descripcion = permissionData.descripcion;
        await permission.save();
        console.log(`  ↻ Permiso actualizado: ${permissionData.nombre}`);
      } else {
        console.log(`  - Permiso existe: ${permissionData.nombre}`);
      }
    }
    
    permissionIds.push(permission._id);
  }
  
  return permissionIds;
};

// Función para sincronizar roles (crear/actualizar sin afectar usuarios)
const syncRoles = async (permissionIds: mongoose.Types.ObjectId[]) => {
  console.log('🔄 Sincronizando roles del sistema...');
  
  // Definir configuraciones de roles
  const roleConfigs = [
    {
      nombre: 'Super Administrador',
      descripcion: 'Acceso completo a todas las funcionalidades del sistema',
      permisos: permissionIds // Todos los permisos
    },
    {
      nombre: 'Administrador',
      descripcion: 'Gestión de usuarios y operaciones básicas del sistema',
      permisos: await Permission.find({
        nombre: {
          $in: [
            'READ_DASHBOARD', 'READ_USERS', 'CREATE_USERS', 'UPDATE_USERS',
            'READ_ROLES', 'READ_PERMISSIONS', 'READ_REPORTS', 'CREATE_REPORTS',
            'READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL'
          ]
        }
      }).select('_id').then(perms => perms.map(p => p._id))
    },
    {
      nombre: 'Usuario',
      descripcion: 'Acceso básico de solo lectura al sistema',
      permisos: await Permission.find({
        nombre: { $in: ['READ_DASHBOARD', 'READ_PAYROLL', 'READ_REPORTS'] }
      }).select('_id').then(perms => perms.map(p => p._id))
    },
    {
      nombre: 'Supervisor',
      descripcion: 'Supervisión de operaciones y gestión de nómina',
      permisos: await Permission.find({
        nombre: {
          $in: [
            'READ_DASHBOARD', 'READ_USERS', 'UPDATE_USERS',
            'READ_ROLES', 'READ_PERMISSIONS', 'READ_REPORTS', 'CREATE_REPORTS',
            'READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL', 'READ_AUDIT'
          ]
        }
      }).select('_id').then(perms => perms.map(p => p._id))
    },
    {
      nombre: 'Empleado',
      descripcion: 'Empleado con acceso limitado a gestión de su propia nómina',
      permisos: await Permission.find({
        nombre: { $in: ['READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL', 'DELETE_PAYROLL'] }
      }).select('_id').then(perms => perms.map(p => p._id))
    },
    {
      nombre: 'Contador',
      descripcion: 'Gestión completa de nómina y generación de reportes',
      permisos: await Permission.find({
        nombre: {
          $in: [
            'READ_DASHBOARD', 'READ_USERS', 'READ_ROLES', 'READ_PERMISSIONS',
            'READ_REPORTS', 'CREATE_REPORTS', 'READ_PAYROLL', 'CREATE_PAYROLL',
            'UPDATE_PAYROLL', 'MANAGE_PAYROLL', 'READ_AUDIT'
          ]
        }
      }).select('_id').then(perms => perms.map(p => p._id))
    }
  ];

  for (const roleConfig of roleConfigs) {
    let role = await Role.findOne({ nombre: roleConfig.nombre });
    
    if (!role) {
      role = new Role({
        ...roleConfig,
        isActive: true
      });
      await role.save();
      console.log(`  ✓ Rol creado: ${roleConfig.nombre}`);
    } else {
      // Actualizar permisos del rol si han cambiado
      const currentPermissions = role.permisos.map(p => p.toString()).sort();
      const newPermissions = roleConfig.permisos.map(p => p.toString()).sort();
      
      if (JSON.stringify(currentPermissions) !== JSON.stringify(newPermissions)) {
        role.permisos = roleConfig.permisos;
        role.descripcion = roleConfig.descripcion;
        await role.save();
        console.log(`  ↻ Rol actualizado: ${roleConfig.nombre}`);
      } else {
        console.log(`  - Rol existe: ${roleConfig.nombre}`);
      }
    }
  }
};

// Función para verificar usuario administrador crítico
const ensureAdminUser = async () => {
  console.log('👤 Verificando usuario administrador...');
  
  const adminRole = await Role.findOne({ nombre: 'Super Administrador' });
  if (!adminRole) {
    console.log('  ❌ Error: No se encontró el rol de Super Administrador');
    return;
  }

  const adminUser = await User.findOne({ correo: 'admin@morchis.com' });
  
  if (!adminUser) {
    // Solo crear admin si no existe ninguno
    const newAdmin = new User({
      nombre: 'Super',
      apellido: 'Administrador',
      correo: 'admin@morchis.com',
      numeroCelular: '3001234567',
      password: 'admin123',
      role: adminRole._id,
      isActive: true,
      emailVerified: true,
      authProvider: 'local'
    });
    
    await newAdmin.save();
    console.log('  ✓ Usuario administrador creado: admin@morchis.com');
    console.log('  ⚠️  IMPORTANTE: Cambia la contraseña por defecto (admin123)');
  } else {
    console.log('  ✓ Usuario administrador existe - datos preservados');
    
    // Asegurar que tenga el rol correcto
    if (!adminUser.role.equals(adminRole._id)) {
      adminUser.role = adminRole._id;
      await adminUser.save();
      console.log('  ↻ Rol de administrador actualizado');
    }
  }
};

// Función principal de configuración de producción
const setupProduction = async () => {
  try {
    await connectDB();
    console.log('✅ Conectado a MongoDB Atlas');
    
    // Sincronizar permisos (crear solo los que faltan)
    const permissionIds = await syncPermissions();
    console.log(`✅ Permisos sincronizados: ${permissionIds.length}`);
    
    // Sincronizar roles (actualizar permisos sin afectar usuarios)
    await syncRoles(permissionIds);
    console.log('✅ Roles sincronizados');
    
    // Asegurar usuario administrador
    await ensureAdminUser();
    console.log('✅ Usuario administrador verificado');
    
    console.log('\n🎉 Configuración de producción completada!');
    console.log('📋 Usuarios existentes han sido preservados');
    console.log('🔒 Las contraseñas modificadas no han sido alteradas');
    
  } catch (error) {
    console.error('❌ Error en configuración de producción:', error);
    throw error;
  } finally {
    await disconnectDB();
    process.exit(0);
  }
};

setupProduction();