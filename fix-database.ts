import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Cargar variables de entorno
dotenv.config();

// Esquemas simples
const roleSchema = new mongoose.Schema({
  nombre: { type: String, unique: true },
  descripcion: String,
  permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }]
});

const userSchema = new mongoose.Schema({
  nombre: String,
  apellido: String,
  correo: { type: String, unique: true },
  numeroCelular: String,
  password: String,
  role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  isActive: { type: Boolean, default: true },
  authProvider: { type: String, default: 'local' }
});

const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);

const fixDatabase = async () => {
  try {
    console.log('🔧 Connecting to MongoDB...');
    console.log('URI:', process.env.MONGODB_URI?.substring(0, 50) + '...');
    
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('✅ Connected!');

    // Limpiar datos existentes
    console.log('🧹 Cleaning existing data...');
    await User.deleteMany({});
    await Role.deleteMany({});

    // Crear rol admin
    console.log('🎭 Creating admin role...');
    const adminRole = new Role({
      nombre: 'Administrador',
      descripcion: 'Acceso completo al sistema',
      permissions: []
    });
    await adminRole.save();
    console.log('✅ Admin role created with ID:', adminRole._id);

    // Crear usuario admin
    console.log('👤 Creating admin user...');
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = new User({
      nombre: 'Admin',
      apellido: 'Sistema',
      correo: 'admin@morchis.com',
      numeroCelular: '1234567890',
      password: hashedPassword,
      role: adminRole._id,
      isActive: true,
      authProvider: 'local'
    });
    
    await adminUser.save();
    console.log('✅ Admin user created with ID:', adminUser._id);

    // Verificar datos
    console.log('🔍 Verifying data...');
    const testUser = await User.findOne({ correo: 'admin@morchis.com' }).populate('role');
    
    if (testUser) {
      console.log('✅ Verification successful!');
      console.log('User ID:', testUser._id);
      console.log('Role:', testUser.role.nombre);
    } else {
      console.log('❌ Verification failed');
    }

    console.log('🎉 Database fix completed!');
    console.log('📋 Credentials: admin@morchis.com / admin123');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected');
    process.exit(0);
  }
};

fixDatabase();
