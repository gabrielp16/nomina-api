import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';

// Cargar variables de entorno
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/morchis-nomina';

async function createEmployeeRole() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Conectado a MongoDB');

    // Buscar permisos necesarios para empleados
    const payrollPermissions = await Permission.find({
      nombre: { $in: ['READ_PAYROLL', 'CREATE_PAYROLL', 'UPDATE_PAYROLL', 'DELETE_PAYROLL'] }
    });

    if (payrollPermissions.length === 0) {
      console.log('No se encontraron permisos de nómina. Ejecuta primero el seed principal.');
      return;
    }

    // Verificar si ya existe el rol de empleado
    let employeeRole = await Role.findOne({ nombre: 'Empleado' });

    if (!employeeRole) {
      // Crear rol de empleado con permisos limitados
      employeeRole = new Role({
        nombre: 'Empleado',
        descripcion: 'Empleado que puede gestionar su propia nómina',
        permisos: payrollPermissions.map(p => p._id),
        isActive: true
      });

      await employeeRole.save();
      console.log('✅ Rol de Empleado creado');
    } else {
      console.log('✅ Rol de Empleado ya existe');
    }

    // Crear un usuario empleado de ejemplo
    const existingEmployee = await User.findOne({ correo: 'empleado@morchis.com' });
    
    if (!existingEmployee) {
      const employeeUser = new User({
        nombre: 'Juan',
        apellido: 'Trabajador',
        correo: 'empleado@morchis.com',
        numeroCelular: '+57 300 123 4567',
        password: 'empleado123',
        role: employeeRole._id,
        isActive: true
      });

      await employeeUser.save();
      console.log('✅ Usuario empleado de ejemplo creado: empleado@morchis.com / empleado123');
    } else {
      console.log('✅ Usuario empleado de ejemplo ya existe');
    }

    console.log('\n🎉 Setup de empleado completado!');
    console.log('\nPuedes usar las siguientes credenciales:');
    console.log('👑 Admin: admin@morchis.com / admin123');
    console.log('👤 Empleado: empleado@morchis.com / empleado123');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createEmployeeRole();
