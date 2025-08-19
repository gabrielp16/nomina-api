import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import Role from '../models/Role.js';
import { connectDB, disconnectDB } from '../config/database.js';

dotenv.config();

const checkUsersAndEmployees = async (): Promise<void> => {
  try {
    await connectDB();
    console.log('🔗 Conectado a la base de datos');
    
    console.log('\n👥 Usuarios en la base de datos:');
    const users = await User.find({});
    users.forEach((user: any) => {
      console.log(`- ${user.nombre} ${user.apellido} (${user.correo})`);
    });
    
    console.log('\n💼 Empleados en la base de datos:');
    const employees = await Employee.find({}).populate('user');
    employees.forEach((emp: any) => {
      const user = emp.user;
      console.log(`- ${user.nombre} ${user.apellido} (${user.correo}) - Salario: $${emp.salarioPorHora}/hora - Activo: ${emp.isActive}`);
    });
    
    console.log('\n🔍 Buscando usuario "Juan Trabajador":');
    const juanUser = await User.findOne({
      $or: [
        { nombre: { $regex: /juan/i } },
        { apellido: { $regex: /trabajador/i } },
        { correo: { $regex: /juan/i } }
      ]
    });
    
    if (juanUser) {
      console.log(`✅ Encontrado: ${(juanUser as any).nombre} ${(juanUser as any).apellido} (${(juanUser as any).correo})`);
      
      const juanEmployee = await Employee.findOne({ user: juanUser._id });
      if (juanEmployee) {
        console.log(`✅ Registro de empleado encontrado - Salario: $${juanEmployee.salarioPorHora}/hora`);
      } else {
        console.log(`❌ No tiene registro de empleado`);
      }
    } else {
      console.log(`❌ Usuario "Juan Trabajador" no encontrado`);
    }
    
    // También buscar por empleado@morchis.com
    console.log('\n🔍 Buscando usuario "empleado@morchis.com":');
    const empleadoUser = await User.findOne({ correo: 'empleado@morchis.com' });
    
    if (empleadoUser) {
      console.log(`✅ Encontrado: ${(empleadoUser as any).nombre} ${(empleadoUser as any).apellido} (${(empleadoUser as any).correo})`);
      
      const empleadoEmployee = await Employee.findOne({ user: empleadoUser._id });
      if (empleadoEmployee) {
        console.log(`✅ Registro de empleado encontrado - Salario: $${empleadoEmployee.salarioPorHora}/hora`);
      } else {
        console.log(`❌ No tiene registro de empleado`);
      }
    } else {
      console.log(`❌ Usuario "empleado@morchis.com" no encontrado`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await disconnectDB();
    console.log('📦 Conexión cerrada');
    process.exit(0);
  }
};

checkUsersAndEmployees();
