import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IClientCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const clientCategorySchema = new Schema<IClientCategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
      unique: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

clientCategorySchema.index({ name: 1 }, { unique: true });

export default mongoose.model<IClientCategory>('ClientCategory', clientCategorySchema);