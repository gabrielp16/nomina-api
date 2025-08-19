import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

const createEmployeeRecord = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('🔗 Conectado a la base de datos');
    
    // Buscar el usuario empleado
    const empleadoUser = await User.findOne({ correo: 'empleado@morchis.com' });
    
    if (!empleadoUser) {
      console.error('❌ Usuario empleado no encontrado');
      return;
    }
    
    console.log('👤 Usuario empleado encontrado:', empleadoUser.nombre, empleadoUser.apellido);
    
    // Verificar si ya existe un registro de empleado para este usuario
    const existingEmployee = await Employee.findOne({ user: empleadoUser._id });
    
    if (existingEmployee) {
      console.log('✅ El registro de empleado ya existe');
      console.log('   - ID Empleado:', existingEmployee._id);
      console.log('   - Salario por hora:', existingEmployee.salarioPorHora);
      console.log('   - Activo:', existingEmployee.isActive);
      return;
    }
    
    // Crear registro de empleado
    const newEmployee = new Employee({
      user: empleadoUser._id,
      salarioPorHora: 15000, // $15,000 por hora
      isActive: true
    });
    
    await newEmployee.save();
    
    console.log('✅ Registro de empleado creado exitosamente');
    console.log('   - ID Empleado:', newEmployee._id);
    console.log('   - Salario por hora:', newEmployee.salarioPorHora);
    
  } catch (error) {
    console.error('❌ Error creando registro de empleado:', error);
    throw error;
  } finally {
    await disconnectDB();
    console.log('📦 Conexión cerrada');
    process.exit(0);
  }
};

createEmployeeRecord();
