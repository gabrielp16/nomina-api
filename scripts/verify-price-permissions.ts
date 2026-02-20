import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../config/database.js';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';

dotenv.config();

async function verifyPricePermissions() {
  try {
    await connectDB();
    console.log('🔍 Verificando permisos para gestión de precios...\n');

    // Permisos requeridos para la gestión de precios
    const requiredPermissions = [
      'READ_PAYROLL',    // Para ver precios
      'UPDATE_PAYROLL',  // Para actualizar precios
      'MANAGE_PAYROLL'   // Para gestión completa de precios
    ];

    for (const permName of requiredPermissions) {
      const perm = await Permission.findOne({ nombre: permName });
      if (perm) {
        console.log(`✅ ${permName}: ${perm.descripcion}`);
      } else {
        console.log(`❌ ${permName}: NO ENCONTRADO`);
      }
    }

    console.log('\n📋 Roles con acceso a gestión de precios:\n');

    const rolesWithAccess = await Role.find({
      permisos: { 
        $in: await Permission.find({ 
          nombre: { $in: requiredPermissions } 
        }).distinct('_id') 
      }
    }).populate('permisos', 'nombre descripcion');

    for (const role of rolesWithAccess) {
      console.log(`  📌 ${role.nombre}`);
      const pricePerms = role.permisos.filter((p: any) => 
        requiredPermissions.includes(p.nombre)
      );
      pricePerms.forEach((p: any) => {
        console.log(`     - ${p.nombre}`);
      });
      console.log('');
    }

    console.log('✅ Verificación completada\n');
    console.log('📝 Nota: Los endpoints de precios usan los siguientes permisos:');
    console.log('   - READ_PAYROLL: GET /api/product-prices/*');
    console.log('   - MANAGE_PAYROLL: POST, PUT, DELETE /api/product-prices/*\n');

  } catch (error) {
    console.error('❌ Error al verificar permisos:', error);
    throw error;
  } finally {
    await disconnectDB();
  }
}

verifyPricePermissions();
