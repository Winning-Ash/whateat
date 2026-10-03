import { Schema, Types } from 'mongoose';

export interface Exclusion {
  userId: Types.ObjectId;
  restaurantId: string;
  restaurantName: string;
  createdAt: Date;
}
export const ExclusionSchema = new Schema<Exclusion>({
  userId: { type: Schema.Types.ObjectId, required: true },
  restaurantId: { type: String, required: true, match: /^\d{1,20}$/ },
  restaurantName: { type: String, required: true, maxlength: 300 },
  createdAt: { type: Date, default: Date.now, required: true },
}, { collection: 'user_exclusions' });
ExclusionSchema.index({ userId: 1, restaurantId: 1 }, { unique: true });
