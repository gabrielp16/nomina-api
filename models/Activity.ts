import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IActivity extends Document {
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  status: 'success' | 'warning' | 'error';
}

interface IActivityModel extends Model<IActivity> {
  logActivity(activityData: Partial<IActivity>): Promise<IActivity>;
}

const ActivitySchema = new Schema<IActivity>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN',
      'LOGOUT',
      'FAILED_LOGIN',
      'CREATE',
      'UPDATE',
      'DELETE',
      'ACTIVATE',
      'DEACTIVATE',
      'CREATE_USER',
      'UPDATE_USER',
      'DELETE_USER',
      'CREATE_ROLE',
      'UPDATE_ROLE',
      'DELETE_ROLE',
      'CREATE_PERMISSION',
      'UPDATE_PERMISSION',
      'DELETE_PERMISSION',
      'ASSIGN_ROLE',
      'REMOVE_ROLE',
      'CHANGE_PASSWORD',
      'RESET_PASSWORD',
      'EXPORT_DATA',
      'IMPORT_DATA',
      'SYSTEM_BACKUP',
      'SYSTEM_RESTORE'
    ]
  },
  resource: {
    type: String,
    required: true,
    enum: [
      'AUTHENTICATION',
      'USER',
      'ROLE', 
      'PERMISSION',
      'USERS',
      'ROLES',
      'PERMISSIONS',
      'EMPLOYEE',
      'PAYROLL',
      'SYSTEM',
      'DATA'
    ]
  },
  resourceId: {
    type: String,
    required: false
  },
  details: {
    type: String,
    required: false
  },
  ipAddress: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['success', 'warning', 'error'],
    default: 'success'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Índices para optimizar consultas
ActivitySchema.index({ timestamp: -1 });
ActivitySchema.index({ userId: 1, timestamp: -1 });
ActivitySchema.index({ action: 1, timestamp: -1 });
ActivitySchema.index({ resource: 1, timestamp: -1 });

// Método estático para crear una actividad
ActivitySchema.statics.logActivity = async function(activityData: Partial<IActivity>) {
  try {
    const activity = new this(activityData);
    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    throw error;
  }
};

export const Activity = mongoose.model<IActivity, IActivityModel>('Activity', ActivitySchema);
