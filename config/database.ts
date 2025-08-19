import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer | null = null;

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://localhost:27017/morchis-nomina';
    
    console.log('🔄 Intentando conectar a MongoDB...');
    
    try {
      // Intentar conectar a MongoDB local/remoto primero
      await mongoose.connect(mongoURI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 3000, // Reducido para fallar más rápido
        socketTimeoutMS: 45000,
      });
      
      console.log('✅ MongoDB conectado exitosamente en:', mongoURI);
      return;
      
    } catch (localError) {
      console.log('⚠️  MongoDB local no disponible, iniciando base de datos en memoria...');
      
      try {
        // Si falla, usar MongoDB en memoria
        mongoServer = await MongoMemoryServer.create({
          instance: {
            dbName: 'morchis-nomina-test'
          },
          binary: {
            downloadDir: './mongodb-memory-server',
          }
        });
        
        const memoryUri = mongoServer.getUri();
        
        await mongoose.connect(memoryUri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        
        console.log('✅ Base de datos en memoria conectada exitosamente');
        console.log('📝 Nota: Los datos se perderán al reiniciar el servidor');
        console.log('💡 Para persistencia, instala MongoDB o usa MongoDB Atlas');
      } catch (memoryError) {
        console.log('❌ Error con base de datos en memoria, usando datos simulados...');
        
        // Fallback final: continuar sin base de datos para desarrollo básico
        await mongoose.connect('mongodb://localhost/fake', {
          bufferCommands: false,
          serverSelectionTimeoutMS: 1000,
        }).catch(() => {
          console.log('⚠️  Usando modo de desarrollo sin base de datos');
          console.log('📝 Algunas funciones estarán limitadas');
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error crítico conectando a la base de datos:', error);
    console.log('💡 El servidor continuará sin base de datos (modo limitado)');
    // No hacer exit para permitir desarrollo del frontend
  }
};

const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    
    if (mongoServer) {
      await mongoServer.stop();
      console.log('🔄 Base de datos en memoria cerrada');
    } else {
      console.log('📦 Conexión a MongoDB cerrada');
    }
  } catch (error) {
    console.error('❌ Error cerrando la base de datos:', error);
  }
};

export { connectDB, disconnectDB };
