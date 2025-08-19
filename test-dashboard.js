// Script de prueba para los endpoints del dashboard
import axios from 'axios';

async function testDashboard() {
  try {
    console.log('🧪 Iniciando pruebas de los endpoints del dashboard...\n');

    // 1. Login para obtener token
    console.log('1. Haciendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      correo: 'admin@morchis.com',
      password: 'admin123'
    });

    if (!loginResponse.data.success) {
      throw new Error('Error en login');
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Login exitoso\n');

    // 2. Probar endpoint de estadísticas
    console.log('2. Probando endpoint de estadísticas...');
    const statsResponse = await axios.get('http://localhost:3001/api/dashboard/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Estadísticas obtenidas:');
    console.log(JSON.stringify(statsResponse.data, null, 2));
    console.log('');

    // 3. Probar endpoint de actividades recientes
    console.log('3. Probando endpoint de actividades recientes...');
    const activitiesResponse = await axios.get('http://localhost:3001/api/dashboard/recent-activities?limit=3', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Actividades recientes obtenidas:');
    console.log(JSON.stringify(activitiesResponse.data, null, 2));
    console.log('');

    console.log('🎉 Todas las pruebas completadas exitosamente!');

  } catch (error) {
    console.error('❌ Error en las pruebas:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testDashboard();
