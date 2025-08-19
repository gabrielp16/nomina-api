import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// MongoDB Atlas connection string from .env.production
const MONGODB_URI = 'mongodb+srv://gabrielp16:Sun$tudi024@cluster0.ndzbaxv.mongodb.net/morchis-nomina?retryWrites=true&w=majority&appName=Cluster0';

// Schemas
const permissionSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  descripcion: String,
  modulo: { type: String, required: true },
  accion: { type: String, required: true }
});

const roleSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  descripcion: String,
  permisos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  activo: { type: Boolean, default: true }
});

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  rol: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
  activo: { type: Boolean, default: true },
  fechaCreacion: { type: Date, default: Date.now },
  ultimoAcceso: { type: Date, default: null }
});

// Models
const Permission = mongoose.model('Permission', permissionSchema);
const Role = mongoose.model('Role', roleSchema);
const User = mongoose.model('User', userSchema);

async function fixDatabase() {
  try {
    console.log('🔧 Connecting to MongoDB Atlas (Production)...');
    console.log(`URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}...`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to Production Atlas!');

    // Clean existing data
    console.log('🧹 Cleaning existing data...');
    await User.deleteMany({});
    await Role.deleteMany({});
    await Permission.deleteMany({});

    // Create permissions first
    console.log('🔐 Creating permissions...');
    const permissions = await Permission.create([
      {
        nombre: 'Gestión de Usuarios',
        descripcion: 'Crear, editar, eliminar y ver usuarios',
        modulo: 'usuarios',
        accion: 'gestionar'
      },
      {
        nombre: 'Gestión de Roles',
        descripcion: 'Crear, editar, eliminar y ver roles',
        modulo: 'roles',
        accion: 'gestionar'
      },
      {
        nombre: 'Gestión de Permisos',
        descripcion: 'Crear, editar, eliminar y ver permisos',
        modulo: 'permisos',
        accion: 'gestionar'
      },
      {
        nombre: 'Dashboard',
        descripcion: 'Acceso al panel principal',
        modulo: 'dashboard',
        accion: 'ver'
      }
    ]);

    console.log(`✅ Created ${permissions.length} permissions`);

    // Create admin role
    console.log('🎭 Creating admin role...');
    const adminRole = await Role.create({
      nombre: 'Administrador',
      descripcion: 'Rol con acceso completo al sistema',
      permisos: permissions.map((p: any) => p._id),
      activo: true
    });

    console.log(`✅ Admin role created with ID: ${adminRole._id}`);

    // Hash password
    console.log('🔒 Hashing password...');
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Create admin user
    console.log('👤 Creating admin user...');
    const adminUser = await User.create({
      nombre: 'Administrador',
      correo: 'admin@morchis.com',
      password: hashedPassword,
      rol: adminRole._id,
      activo: true,
      fechaCreacion: new Date(),
      ultimoAcceso: null
    });

    console.log(`✅ Admin user created with ID: ${adminUser._id}`);

    // Verify the data
    console.log('🔍 Verifying data...');
    const userWithRole = await User.findById(adminUser._id).populate('rol');
    if (!userWithRole) {
      throw new Error('User verification failed');
    }

    console.log('✅ Verification successful!');
    console.log(`User ID: ${userWithRole._id}`);
    console.log(`Role: ${(userWithRole.rol as any).nombre}`);
    
    console.log('🎉 Database fix completed for PRODUCTION Atlas!');
    console.log('📋 Credentials: admin@morchis.com / admin123');
    console.log('🌐 Database: cluster0.ndzbaxv.mongodb.net');
    
  } catch (error) {
    console.error('❌ Error fixing production database:', error);
    if (error instanceof Error && error.message.includes('ENOTFOUND')) {
      console.log('🔧 DNS resolution failed. Trying alternative connection...');
      
      // Try with different options
      try {
        await mongoose.disconnect();
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 30000,
          socketTimeoutMS: 45000
        });
        console.log('✅ Connected with alternative options!');
        // Retry the operation...
        console.log('🔄 Retrying database operations...');
        await fixDatabase();
      } catch (retryError) {
        console.error('❌ Retry also failed:', retryError);
      }
    }
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected');
    process.exit(0);
  }
}

fixDatabase();
