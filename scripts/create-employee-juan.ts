import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

const createEmployeeForJuan = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('🔗 Conectado a la base de datos');
    
    // Find Juan Trabajador user
    const juanUser = await User.findOne({ correo: 'empleado@morchis.com' });
    
    if (!juanUser) {
      console.log('❌ Usuario empleado@morchis.com no encontrado');
      return;
    }
    
    console.log(`✅ Usuario encontrado: ${juanUser.nombre} ${juanUser.apellido}`);
    
    // Check if employee record already exists
    const existingEmployee = await Employee.findOne({ user: juanUser._id });
    
    if (existingEmployee) {
      console.log('✅ El usuario ya tiene un registro de empleado');
      console.log(`   Salario: $${existingEmployee.salarioPorHora}/hora - Activo: ${existingEmployee.isActive}`);
      return;
    }
    
    // Create employee record
    const newEmployee = new Employee({
      user: juanUser._id,
      salarioPorHora: 5000, // Salario por defecto de $5000/hora
      isActive: true
    });
    
    await newEmployee.save();
    
    console.log('✅ Registro de empleado creado exitosamente');
    console.log(`   Usuario: ${juanUser.nombre} ${juanUser.apellido} (${juanUser.correo})`);
    console.log(`   Salario: $${newEmployee.salarioPorHora}/hora`);
    console.log(`   Fecha de creación: ${newEmployee.createdAt.toISOString().split('T')[0]}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDB();
    console.log('📦 Conexión cerrada');
    process.exit(0);
  }
};

createEmployeeForJuan();
