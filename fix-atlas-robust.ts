import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// MongoDB Atlas connection string
const MONGODB_URI = 'mongodb+srv://morchisAdmin:5CIH0HsAFpLFiIvN@cluster0.q3hpq.mongodb.net/morchis-nomina?retryWrites=true&w=majority&appName=Cluster0';

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

async function fixDatabase() {
  try {
    console.log('🔧 Connecting to MongoDB Atlas...');
    
    // Try connecting with different options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(MONGODB_URI, options);
    console.log('✅ Connected to Atlas!');

    // Definir modelos después de la conexión
    const Permission = mongoose.model('Permission', permissionSchema);
    const Role = mongoose.model('Role', roleSchema);  
    const User = mongoose.model('User', userSchema);

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
    
    console.log('🎉 Database fix completed!');
    console.log('📋 Credentials: admin@morchis.com / admin123');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    
    // Try with local connection as fallback
    console.log('🔄 Trying local database...');
    try {
      await mongoose.disconnect();
      await mongoose.connect('mongodb://localhost:27017/morchis-nomina');
      console.log('✅ Connected to local MongoDB!');
      console.log('ℹ️ Note: Connected to LOCAL database, not Atlas');
      
      // Define models again for local
      const Permission = mongoose.model('Permission', permissionSchema);
      const Role = mongoose.model('Role', roleSchema);  
      const User = mongoose.model('User', userSchema);
      
      console.log('🧹 Cleaning local data...');
      await User.deleteMany({});
      await Role.deleteMany({});
      await Permission.deleteMany({});
      
      console.log('Local database cleaned. Atlas fix failed.');
      
    } catch (localError) {
      console.error('❌ Local fallback also failed:', localError);
    }
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected');
    process.exit(0);
  }
}

fixDatabase();
