import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Activity } from '../models/Activity.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

async function seedActivities() {
  try {
    await connectDB();
    console.log('🔄 Agregando actividades de prueba...');

    const sampleActivities = [
      {
        userId: '507f1f77bcf86cd799439011',
        userName: 'Super Administrador',
        userEmail: 'admin@morchis.com',
        action: 'LOGIN',
        resource: 'AUTHENTICATION',
        details: 'Usuario administrador inició sesión en el sistema',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutos atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439012',
        userName: 'María García',
        userEmail: 'supervisor@morchis.com',
        action: 'CREATE_USER',
        resource: 'USERS',
        resourceId: 'user-001',
        details: 'Creó un nuevo empleado en el sistema de nómina',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutos atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439011',
        userName: 'Super Administrador',
        userEmail: 'admin@morchis.com',
        action: 'UPDATE_ROLE',
        resource: 'ROLES',
        resourceId: 'role-admin',
        details: 'Modificó permisos del rol Administrador para incluir acceso a actividad',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hora atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439012',
        userName: 'María García',
        userEmail: 'supervisor@morchis.com',
        action: 'DELETE_PERMISSION',
        resource: 'PERMISSIONS',
        resourceId: 'perm-008',
        details: 'Eliminó temporalmente el permiso READ_REPORTS por mantenimiento',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
        status: 'warning'
      },
      {
        userId: '507f1f77bcf86cd799439014',
        userName: 'Usuario Prueba',
        userEmail: 'usuario@morchis.com',
        action: 'FAILED_LOGIN',
        resource: 'AUTHENTICATION',
        details: 'Intento de login fallido - credenciales incorrectas',
        ipAddress: '192.168.1.103',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 horas atrás
        status: 'error'
      },
      {
        userId: '507f1f77bcf86cd799439012',
        userName: 'María García',
        userEmail: 'supervisor@morchis.com',
        action: 'UPDATE_USER',
        resource: 'USERS',
        resourceId: 'user-001',
        details: 'Actualizó información salarial de empleado',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 horas atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439011',
        userName: 'Super Administrador',
        userEmail: 'admin@morchis.com',
        action: 'CREATE_ROLE',
        resource: 'ROLES',
        resourceId: 'role-supervisor',
        details: 'Creó un nuevo rol: Supervisor de Nómina con permisos específicos',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 horas atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439014',
        userName: 'Usuario Prueba',
        userEmail: 'usuario@morchis.com',
        action: 'LOGIN',
        resource: 'AUTHENTICATION',
        details: 'Inicio de sesión exitoso después de reseteo de contraseña',
        ipAddress: '192.168.1.105',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 horas atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439012',
        userName: 'María García',
        userEmail: 'supervisor@morchis.com',
        action: 'LOGIN',
        resource: 'AUTHENTICATION',
        details: 'Primera sesión como supervisor de nómina',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 7 * 60 * 60 * 1000), // 7 horas atrás
        status: 'success'
      },
      {
        userId: '507f1f77bcf86cd799439011',
        userName: 'Super Administrador',
        userEmail: 'admin@morchis.com',
        action: 'CREATE_PERMISSION',
        resource: 'PERMISSIONS',
        resourceId: 'perm-activity',
        details: 'Creó el permiso READ_ACTIVITY para el módulo de actividades',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 horas atrás
        status: 'success'
      }
    ];

    // Eliminar actividades existentes para evitar duplicados
    await Activity.deleteMany({});
    console.log('🗑️ Actividades existentes eliminadas');

    // Insertar las nuevas actividades
    const insertedActivities = await Activity.insertMany(sampleActivities);
    console.log(`✅ ${insertedActivities.length} actividades de prueba creadas exitosamente`);

    console.log('🎉 Proceso de seeding de actividades completado');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDB();
  }
}

seedActivities();
