import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

// Permisos por defecto del sistema
const defaultPermissions = [
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

  // Permisos por pantalla (estructura CRUD + MANAGE)
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
  
  // Permisos de nómina (para futuro)
  { nombre: 'CREATE_PAYROLL', descripcion: 'Crear registros de nómina', modulo: 'NOMINA', accion: 'CREATE' },
  { nombre: 'READ_PAYROLL', descripcion: 'Ver registros de nómina', modulo: 'NOMINA', accion: 'READ' },
  { nombre: 'UPDATE_PAYROLL', descripcion: 'Actualizar registros de nómina', modulo: 'NOMINA', accion: 'UPDATE' },
  { nombre: 'DELETE_PAYROLL', descripcion: 'Eliminar registros de nómina', modulo: 'NOMINA', accion: 'DELETE' },
  { nombre: 'MANAGE_PAYROLL', descripcion: 'Gestión completa de nómina', modulo: 'NOMINA', accion: 'MANAGE' },
];

// Función para crear permisos
const seedPermissions = async (): Promise<mongoose.Types.ObjectId[]> => {
  console.log('🌱 Creando permisos por defecto...');
  
  const createdPermissions: mongoose.Types.ObjectId[] = [];
  
  for (const permissionData of defaultPermissions) {
    const existingPermission = await Permission.findOne({ nombre: permissionData.nombre });
    
    if (!existingPermission) {
      const permission = new Permission(permissionData);
      await permission.save();
      createdPermissions.push(permission._id);
      console.log(`  ✓ Permiso creado: ${permissionData.nombre}`);
    } else {
      createdPermissions.push(existingPermission._id);
      console.log(`  - Permiso ya existe: ${permissionData.nombre}`);
    }
  }
  
  return createdPermissions;
};

// Función para crear roles
const seedRoles = async (permissionIds: mongoose.Types.ObjectId[]): Promise<{ adminRoleId: mongoose.Types.ObjectId; empleadoRoleId: mongoose.Types.ObjectId }> => {
  console.log('🌱 Creando roles por defecto...');
  
  // Rol de Super Administrador - todos los permisos
  let superAdminRole = await Role.findOne({ nombre: 'Super Administrador' });
  if (!superAdminRole) {
    superAdminRole = new Role({
      nombre: 'Super Administrador',
      descripcion: 'Acceso completo a todas las funcionalidades del sistema',
      permisos: permissionIds,
      isActive: true
    });
    await superAdminRole.save();
    console.log('  ✓ Rol creado: Super Administrador');
  } else {
    console.log('  - Rol ya existe: Super Administrador');
  }

  // Rol de Administrador - permisos básicos de gestión
  const adminPermissions = await Permission.find({
    nombre: {
      $in: [
        'READ_DASHBOARD', 'READ_USERS', 'CREATE_USERS', 'UPDATE_USERS',
        'READ_ROLES', 'READ_PERMISSIONS', 'READ_REPORTS', 'CREATE_REPORTS',
        'READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL'
      ]
    }
  });
  
  let adminRole = await Role.findOne({ nombre: 'Administrador' });
  if (!adminRole) {
    adminRole = new Role({
      nombre: 'Administrador',
      descripcion: 'Gestión de usuarios y operaciones básicas del sistema',
      permisos: adminPermissions.map(p => p._id),
      isActive: true
    });
    await adminRole.save();
    console.log('  ✓ Rol creado: Administrador');
  } else {
    console.log('  - Rol ya existe: Administrador');
  }

  // Rol de Supervisor - permisos intermedios
  const supervisorPermissions = await Permission.find({
    nombre: {
      $in: [
        'READ_DASHBOARD', 'READ_USERS', 'UPDATE_USERS',
        'READ_ROLES', 'READ_PERMISSIONS', 'READ_REPORTS', 'CREATE_REPORTS',
        'READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL', 'READ_AUDIT'
      ]
    }
  });
  
  let supervisorRole = await Role.findOne({ nombre: 'Supervisor' });
  if (!supervisorRole) {
    supervisorRole = new Role({
      nombre: 'Supervisor',
      descripcion: 'Supervisión de operaciones y gestión de nómina',
      permisos: supervisorPermissions.map(p => p._id),
      isActive: true
    });
    await supervisorRole.save();
    console.log('  ✓ Rol creado: Supervisor');
  } else {
    console.log('  - Rol ya existe: Supervisor');
  }

  // Rol de Empleado - acceso limitado (SIN READ_DASHBOARD)
  const empleadoPermissions = await Permission.find({
    nombre: {
      $in: ['READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL', 'DELETE_PAYROLL']
    }
  });
  
  let empleadoRole = await Role.findOne({ nombre: 'Empleado' });
  if (!empleadoRole) {
    empleadoRole = new Role({
      nombre: 'Empleado',
      descripcion: 'Empleado con acceso limitado a gestión de su propia nómina',
      permisos: empleadoPermissions.map(p => p._id),
      isActive: true
    });
    await empleadoRole.save();
    console.log('  ✓ Rol creado: Empleado');
  } else {
    // Update existing role with new permissions
    empleadoRole.permisos = empleadoPermissions.map(p => p._id);
    await empleadoRole.save();
    console.log('  ✓ Rol actualizado: Empleado');
  }

  // Rol de Contador - enfocado en reportes y nómina
  const contadorPermissions = await Permission.find({
    nombre: {
      $in: [
        'READ_DASHBOARD', 'READ_USERS', 'READ_ROLES', 'READ_PERMISSIONS',
        'READ_REPORTS', 'CREATE_REPORTS', 'READ_PAYROLL', 'CREATE_PAYROLL',
        'UPDATE_PAYROLL', 'MANAGE_PAYROLL', 'READ_AUDIT'
      ]
    }
  });
  
  let contadorRole = await Role.findOne({ nombre: 'Contador' });
  if (!contadorRole) {
    contadorRole = new Role({
      nombre: 'Contador',
      descripcion: 'Gestión completa de nómina y generación de reportes',
      permisos: contadorPermissions.map(p => p._id),
      isActive: true
    });
    await contadorRole.save();
    console.log('  ✓ Rol creado: Contador');
  } else {
    console.log('  - Rol ya existe: Contador');
  }

  return {
    adminRoleId: superAdminRole._id,
    empleadoRoleId: empleadoRole._id
  };
};

// Función para crear usuarios por defecto (preservando datos existentes)
const seedUsers = async (adminRoleId: mongoose.Types.ObjectId, empleadoRoleId: mongoose.Types.ObjectId): Promise<void> => {
  console.log('🌱 Verificando/creando usuarios por defecto...');
  
  // Función helper para crear o actualizar usuario sin tocar la contraseña
  const createOrUpdateUser = async (userData: any, defaultPassword: string, roleName: string) => {
    const existingUser = await User.findOne({ correo: userData.correo });
    
    if (existingUser) {
      console.log(`  - Usuario ya existe: ${userData.correo} - preservando datos existentes`);
      
      // Solo actualizar el rol si es diferente (para mantener roles actualizados)
      if (!existingUser.role.equals(userData.role)) {
        existingUser.role = userData.role;
        await existingUser.save();
        console.log(`    ✓ Rol actualizado para ${userData.correo}`);
      }
      
      return existingUser;
    } else {
      // Crear nuevo usuario solo si no existe
      const newUser = new User({
        ...userData,
        password: defaultPassword // Solo se asigna la contraseña por defecto a usuarios nuevos
      });
      
      await newUser.save();
      console.log(`  ✓ Usuario ${roleName} creado: ${userData.correo} / ${defaultPassword}`);
      return newUser;
    }
  };
  
  // Usuario Super Administrador
  await createOrUpdateUser({
    nombre: 'Super',
    apellido: 'Administrador',
    correo: 'admin@morchis.com',
    numeroCelular: '3001234567',
    role: adminRoleId,
    isActive: true,
    emailVerified: true,
    authProvider: 'local'
  }, 'admin123', 'administrador');

  // Usuario Empleado
  const empleadoUser = await createOrUpdateUser({
    nombre: 'Juan',
    apellido: 'Trabajador',
    correo: 'empleado@morchis.com',
    numeroCelular: '3001234567',
    role: empleadoRoleId,
    isActive: true,
    emailVerified: true,
    authProvider: 'local'
  }, 'empleado123', 'empleado');
  
  // Crear registro de Employee para el usuario empleado (solo si no existe)
  const existingEmployee = await Employee.findOne({ user: empleadoUser._id });
  if (!existingEmployee) {
    const newEmployee = new Employee({
      user: empleadoUser._id,
      salarioPorHora: 15000, // $15,000 por hora
      isActive: true
    });
    
    await newEmployee.save();
    console.log('  ✓ Registro de empleado creado con salario: $15,000/hora');
  } else {
    console.log('  - Registro de empleado ya existe - preservando datos');
  }
};

// Función principal de seeding
const seedDatabase = async (standalone: boolean = true): Promise<void> => {
  try {
    if (standalone) {
      await connectDB();
    }
    
    console.log('🚀 Iniciando proceso de seeding...\n');
    
    // Crear permisos
    const permissionIds = await seedPermissions();
    console.log(`✅ Permisos procesados: ${permissionIds.length}\n`);
    
    // Crear roles
    const { adminRoleId, empleadoRoleId } = await seedRoles(permissionIds);
    console.log('✅ Roles procesados\n');
    
    // Crear usuarios
    await seedUsers(adminRoleId, empleadoRoleId);
    console.log('✅ Usuarios procesados\n');
    
    console.log('🎉 Proceso de seeding completado exitosamente!');
    console.log('\n📋 Credenciales de acceso:');
    console.log('   👤 Admin: admin@morchis.com / admin123');
    console.log('   👤 Empleado: empleado@morchis.com / empleado123');
    
  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    throw error;
  } finally {
    if (standalone) {
      await disconnectDB();
      console.log('\n📦 Conexión a base de datos cerrada');
      process.exit(0);
    }
  }
};

// Ejecutar seeding si el archivo se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}

export default seedDatabase;
