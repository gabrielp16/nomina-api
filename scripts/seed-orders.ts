import mongoose from 'mongoose';
import { connectDB } from '../config/database.js';
import Client from '../models/Client.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

const sampleClients = [
  {
    nombre: 'Juan',
    apellido: 'Pérez',
    correo: 'juan.perez@example.com',
    telefono: '+34 600 123 456',
    direccion: 'Calle Mayor 123, Madrid',
    empresa: 'Distribuciones JP'
  },
  {
    nombre: 'María',
    apellido: 'González',
    correo: 'maria.gonzalez@example.com',
    telefono: '+34 600 789 012',
    direccion: 'Avenida Libertad 45, Barcelona',
    empresa: 'Comercial González'
  },
  {
    nombre: 'Carlos',
    apellido: 'Rodríguez',
    correo: 'carlos.rodriguez@example.com',
    telefono: '+34 600 345 678',
    direccion: 'Plaza España 8, Valencia',
    empresa: 'Importaciones CR'
  },
  {
    nombre: 'Ana',
    apellido: 'López',
    correo: 'ana.lopez@example.com',
    telefono: '+34 600 901 234',
    direccion: 'Gran Vía 67, Sevilla'
  }
];

const sampleProducts = [
  {
    nombre: 'Aceite de Oliva Virgen Extra',
    descripcion: 'Aceite de oliva de primera calidad procedente de aceitunas seleccionadas',
    unidad: 'LT',
    categoria: 'Alimentación',
    precio: 12.50,
    stock: 150
  },
  {
    nombre: 'Harina de Trigo',
    descripcion: 'Harina de trigo especial para repostería y panadería',
    unidad: 'KG',
    categoria: 'Alimentación',
    precio: 2.80,
    stock: 300
  },
  {
    nombre: 'Detergente Industrial',
    descripcion: 'Detergente concentrado para limpieza industrial',
    unidad: 'LT',
    categoria: 'Limpieza',
    precio: 8.90,
    stock: 100
  },
  {
    nombre: 'Papel Higiénico',
    descripcion: 'Papel higiénico suave de 3 capas',
    unidad: 'UN',
    categoria: 'Higiene',
    precio: 1.25,
    stock: 500
  },
  {
    nombre: 'Azúcar Blanco',
    descripcion: 'Azúcar refinado de caña',
    unidad: 'KG',
    categoria: 'Alimentación',
    precio: 1.80,
    stock: 200
  }
];

async function seedOrdersData() {
  try {
    console.log('🌱 Iniciando seeding de datos para órdenes...');
    
    // Conectar a la base de datos
    await connectDB();

    // Verificar y crear clientes
    console.log('👥 Creando clientes de ejemplo...');
    const createdClients = [];
    
    for (const clientData of sampleClients) {
      const existingClient = await Client.findOne({ correo: clientData.correo });
      if (!existingClient) {
        const client = new Client(clientData);
        const savedClient = await client.save();
        createdClients.push(savedClient);
        console.log(`  ✓ Cliente creado: ${client.nombre} ${client.apellido}`);
      } else {
        createdClients.push(existingClient);
        console.log(`  - Cliente ya existe: ${existingClient.nombre} ${existingClient.apellido}`);
      }
    }

    // Verificar y crear productos
    console.log('📦 Creando productos de ejemplo...');
    const createdProducts = [];
    
    for (const productData of sampleProducts) {
      const existingProduct = await Product.findOne({ nombre: productData.nombre });
      if (!existingProduct) {
        const product = new Product(productData);
        const savedProduct = await product.save();
        createdProducts.push(savedProduct);
        console.log(`  ✓ Producto creado: ${product.nombre}`);
      } else {
        createdProducts.push(existingProduct);
        console.log(`  - Producto ya existe: ${existingProduct.nombre}`);
      }
    }

    // Crear algunas órdenes de ejemplo
    console.log('📋 Creando órdenes de ejemplo...');
    const existingOrders = await Order.countDocuments();
    
    if (existingOrders === 0) {
      const sampleOrders = [
        {
          fecha: new Date('2024-11-01'),
          cliente: createdClients[0]._id,
          producto: createdProducts[0]._id,
          lote: 'LOT-001',
          cantidad: 10,
          precio: 12.50,
          estado: 'ENTREGADO'
        },
        {
          fecha: new Date('2024-11-05'),
          cliente: createdClients[1]._id,
          producto: createdProducts[1]._id,
          lote: 'LOT-002',
          cantidad: 25,
          precio: 2.80,
          estado: 'PAGADO'
        },
        {
          fecha: new Date('2024-11-10'),
          cliente: createdClients[2]._id,
          producto: createdProducts[2]._id,
          lote: 'LOT-003',
          cantidad: 5,
          precio: 8.90,
          estado: 'POR PAGAR'
        },
        {
          fecha: new Date('2024-11-12'),
          cliente: createdClients[0]._id,
          producto: createdProducts[3]._id,
          lote: 'LOT-004',
          cantidad: 100,
          precio: 1.25,
          estado: 'POR PAGAR'
        },
        {
          fecha: new Date('2024-11-12'),
          cliente: createdClients[3]._id,
          producto: createdProducts[4]._id,
          lote: 'LOT-005',
          cantidad: 50,
          precio: 1.80,
          estado: 'CANCELADO'
        }
      ];

      for (const orderData of sampleOrders) {
        const order = new Order(orderData);
        await order.save();
        console.log(`  ✓ Orden creada: ${order.lote}`);
      }
    } else {
      console.log(`  - Ya existen ${existingOrders} órdenes en la base de datos`);
    }

    console.log('🎉 Seeding de datos para órdenes completado exitosamente!');
    console.log(`📊 Resumen:`);
    console.log(`   👥 Clientes: ${createdClients.length}`);
    console.log(`   📦 Productos: ${createdProducts.length}`);
    console.log(`   📋 Órdenes: ${await Order.countDocuments()}`);

  } catch (error) {
    console.error('❌ Error durante el seeding:', error);
    throw error;
  }
}

// Ejecutar el seeding si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  seedOrdersData()
    .then(() => {
      console.log('✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Proceso falló:', error);
      process.exit(1);
    });
}

export default seedOrdersData;