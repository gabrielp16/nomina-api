const mongoose = require('mongoose');
require('dotenv').config();

// Usar la URI de MongoDB desde las variables de entorno
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/payroll_system';

// Modo seguro: solo verificar, no modificar (cambiar a false para ejecutar cambios)
const DRY_RUN = true;

async function addDescuadreField() {
  try {
    console.log('🔍 MODO SEGURO:', DRY_RUN ? 'SOLO VERIFICACIÓN (no se harán cambios)' : 'EJECUTARÁ CAMBIOS');
    console.log('🔌 Conectando a MongoDB Atlas...');
    console.log('📍 URI:', MONGODB_URI.replace(/mongodb\+srv:\/\/[^:]+:[^@]+@/, 'mongodb+srv://***:***@'));
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');

    const db = mongoose.connection.db;
    const payrollsCollection = db.collection('payrolls');

    // Obtener estadísticas generales
    const totalPayrolls = await payrollsCollection.countDocuments({});
    console.log(`📊 Total de registros en la colección: ${totalPayrolls}`);

    // Buscar todos los documentos que no tienen el campo descuadre
    const payrollsWithoutDescuadre = await payrollsCollection.find({
      descuadre: { $exists: false }
    }).toArray();

    const payrollsWithDescuadre = await payrollsCollection.countDocuments({
      descuadre: { $exists: true }
    });

    console.log(`� Registros SIN campo descuadre: ${payrollsWithoutDescuadre.length}`);
    console.log(`📋 Registros CON campo descuadre: ${payrollsWithDescuadre}`);

    if (payrollsWithoutDescuadre.length > 0) {
      console.log('\n🔍 ANÁLISIS DE REGISTROS SIN DESCUADRE:');
      
      // Mostrar algunos ejemplos de registros que se van a actualizar
      const ejemplos = payrollsWithoutDescuadre.slice(0, 3);
      ejemplos.forEach((payroll, index) => {
        console.log(`\n📄 Ejemplo ${index + 1}:`);
        console.log(`   - ID: ${payroll._id}`);
        console.log(`   - Empleado: ${payroll.employee}`);
        console.log(`   - Fecha: ${payroll.fecha}`);
        console.log(`   - Salario Bruto: ${payroll.salarioBruto || 'N/A'}`);
        console.log(`   - Total Consumos: ${payroll.totalConsumos || 0}`);
        console.log(`   - Adelanto Nómina: ${payroll.adelantoNomina || 0}`);
        console.log(`   - Descuadre actual: ${payroll.descuadre || 'NO EXISTE'}`);
        console.log(`   - Total Descuentos actual: ${payroll.totalDescuentos || 0}`);
        console.log(`   - Salario Neto actual: ${payroll.salarioNeto || 'N/A'}`);
        
        // Mostrar lo que sería el nuevo cálculo
        const totalConsumos = payroll.totalConsumos || 0;
        const adelantoNomina = payroll.adelantoNomina || 0;
        const descuadreNuevo = 0; // Se agregaría con valor 0
        const nuevoTotalDescuentos = totalConsumos + adelantoNomina + descuadreNuevo;
        const salarioBruto = payroll.salarioBruto || 0;
        const deudaMorchis = payroll.deudaMorchis || 0;
        const nuevoSalarioNeto = salarioBruto - nuevoTotalDescuentos + deudaMorchis;
        
        console.log(`   ➜ CAMBIOS PROPUESTOS:`);
        console.log(`     - Descuadre nuevo: 0`);
        console.log(`     - Total Descuentos nuevo: ${nuevoTotalDescuentos} (actual: ${payroll.totalDescuentos || 0})`);
        console.log(`     - Salario Neto nuevo: ${nuevoSalarioNeto} (actual: ${payroll.salarioNeto || 'N/A'})`);
      });

      if (!DRY_RUN) {
        console.log('\n⚠️  EJECUTANDO CAMBIOS...');
        // Agregar el campo descuadre con valor 0 a todos los documentos que no lo tienen
        const result = await payrollsCollection.updateMany(
          { descuadre: { $exists: false } },
          { $set: { descuadre: 0 } }
        );

        console.log(`✅ Se actualizaron ${result.modifiedCount} registros con el campo descuadre = 0`);
      } else {
        console.log('\n🛡️  MODO SEGURO: No se realizaron cambios al campo descuadre');
      }
    } else {
      console.log('✅ Todos los registros ya tienen el campo descuadre');
    }

    // Actualizar también el campo totalDescuentos para incluir descuadre en el cálculo
    console.log('\n🔄 ANÁLISIS DE RECÁLCULO DE TOTALES...');
    
    const allPayrolls = await payrollsCollection.find({}).toArray();
    let needsRecalculation = 0;
    let recalculatedCount = 0;

    console.log('\n📊 ANÁLISIS DE CONSISTENCIA:');
    
    for (const payroll of allPayrolls.slice(0, 5)) { // Solo mostrar los primeros 5 para análisis
      const totalConsumos = payroll.totalConsumos || 0;
      const adelantoNomina = payroll.adelantoNomina || 0;
      const descuadre = payroll.descuadre || 0;
      
      const expectedTotalDescuentos = totalConsumos + adelantoNomina + descuadre;
      const actualTotalDescuentos = payroll.totalDescuentos || 0;
      
      const salarioBruto = payroll.salarioBruto || 0;
      const deudaMorchis = payroll.deudaMorchis || 0;
      const expectedSalarioNeto = salarioBruto - expectedTotalDescuentos + deudaMorchis;
      const actualSalarioNeto = payroll.salarioNeto || 0;
      
      console.log(`\n📄 Registro ${payroll._id}:`);
      console.log(`   - Total Descuentos: actual=${actualTotalDescuentos}, esperado=${expectedTotalDescuentos}`);
      console.log(`   - Salario Neto: actual=${actualSalarioNeto}, esperado=${expectedSalarioNeto}`);
      
      if (actualTotalDescuentos !== expectedTotalDescuentos || Math.abs(actualSalarioNeto - expectedSalarioNeto) > 0.01) {
        console.log(`   ⚠️  NECESITA RECALCULO`);
        needsRecalculation++;
      } else {
        console.log(`   ✅ CONSISTENTE`);
      }
    }

    // Contar todos los que necesitan recálculo
    for (const payroll of allPayrolls) {
      const totalConsumos = payroll.totalConsumos || 0;
      const adelantoNomina = payroll.adelantoNomina || 0;
      const descuadre = payroll.descuadre || 0;
      const expectedTotalDescuentos = totalConsumos + adelantoNomina + descuadre;
      const actualTotalDescuentos = payroll.totalDescuentos || 0;
      const salarioBruto = payroll.salarioBruto || 0;
      const deudaMorchis = payroll.deudaMorchis || 0;
      const expectedSalarioNeto = salarioBruto - expectedTotalDescuentos + deudaMorchis;
      const actualSalarioNeto = payroll.salarioNeto || 0;
      
      if (actualTotalDescuentos !== expectedTotalDescuentos || Math.abs(actualSalarioNeto - expectedSalarioNeto) > 0.01) {
        if (!DRY_RUN) {
          await payrollsCollection.updateOne(
            { _id: payroll._id },
            { 
              $set: { 
                totalDescuentos: expectedTotalDescuentos,
                salarioNeto: expectedSalarioNeto
              } 
            }
          );
        }
        recalculatedCount++;
      }
    }

    console.log(`\n📊 RESUMEN:`);
    console.log(`   - Total registros analizados: ${allPayrolls.length}`);
    console.log(`   - Registros que necesitan recálculo: ${recalculatedCount}`);
    
    if (!DRY_RUN) {
      console.log(`✅ Se recalcularon ${recalculatedCount} registros con los nuevos totales`);
    } else {
      console.log(`🛡️  MODO SEGURO: No se realizaron recálculos`);
    }

    // Verificar el resultado final
    if (!DRY_RUN) {
      const verification = await payrollsCollection.find({}).limit(3).toArray();
      console.log('\n📋 VERIFICACIÓN POST-CAMBIOS - Primeros 3 registros:');
      verification.forEach((payroll, index) => {
        console.log(`${index + 1}. ID: ${payroll._id}`);
        console.log(`   - Descuadre: ${payroll.descuadre}`);
        console.log(`   - Total Descuentos: ${payroll.totalDescuentos}`);
        console.log(`   - Salario Neto: ${payroll.salarioNeto}`);
        console.log('');
      });
    } else {
      console.log('\n🛡️  Para ejecutar los cambios reales:');
      console.log('   1. Cambia DRY_RUN = false en el script');
      console.log('   2. Ejecuta el script nuevamente');
      console.log('\n⚠️  IMPORTANTE: Asegúrate de tener un backup de tu base de datos antes de ejecutar cambios');
    }

  } catch (error) {
    console.error('❌ Error al analizar/migrar datos:', error);
    console.error('📍 Detalles del error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Desconectado de MongoDB Atlas');
  }
}

addDescuadreField();
